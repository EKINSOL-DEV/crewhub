"""Projects API routes.

SQL is delegated to app.services.project_service. This module owns
HTTP concerns: status codes, SSE broadcasts, file I/O, and response shaping.
"""

import asyncio
import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.db.models import ProjectCreate, ProjectResponse, ProjectUpdate
from app.routes.sse import broadcast
from app.services import project_service

# Synology Drive base for project documents
SYNOLOGY_PROJECTS_BASE = Path.home() / "SynologyDrive" / "ekinbot" / "01-Projects"

# Allowed roots for project folders (security boundary)
ALLOWED_PROJECT_ROOTS = [
    Path.home() / "SynologyDrive" / "ekinbot" / "01-Projects",
    Path.home() / "Library" / "CloudStorage" / "SynologyDrive-ekinbot" / "01-Projects",
    Path.home() / "Projects",
]

logger = logging.getLogger(__name__)
router = APIRouter()


# ========================================
# PROJECTS CRUD
# ========================================


@router.get("", response_model=dict)
async def list_projects():
    """Get all projects."""
    try:
        projects = await project_service.list_projects()
        return {"projects": [p.model_dump() for p in projects]}
    except Exception as e:
        logger.error(f"Failed to list projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/overview", response_model=dict)
async def projects_overview():
    """Get all projects with room counts and agent counts for HQ dashboard."""
    try:
        overview = await project_service.get_projects_overview()
        return {"projects": overview}
    except Exception as e:
        logger.error(f"Failed to get projects overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str):
    """Get a specific project by ID."""
    try:
        project = await project_service.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return project
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=ProjectResponse)
async def create_project(project: ProjectCreate):
    """Create a new project."""
    try:
        result = await project_service.create_project(project)
        await broadcast("rooms-refresh", {"action": "project_created", "project_id": result.id})
        return result
    except Exception as e:
        logger.error(f"Failed to create project: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, project: ProjectUpdate):
    """Update an existing project."""
    try:
        result = await project_service.update_project(project_id, project)
        if result is None:
            raise HTTPException(status_code=404, detail="Project not found")
        await broadcast("rooms-refresh", {"action": "project_updated", "project_id": project_id})
        return result
    except HTTPException:
        raise
    except ValueError as e:
        err = str(e)
        if err.startswith("cannot_archive_with_rooms:"):
            room_names = err.split(":", 1)[1]
            count = len(room_names.split(", "))
            raise HTTPException(
                status_code=400,
                detail=f"Cannot archive: project is assigned to {count} room(s): {room_names}",
            )
        raise HTTPException(status_code=400, detail=err)
    except Exception as e:
        logger.error(f"Failed to update project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    """Delete a project. Only archived projects can be deleted."""
    try:
        deleted_id = await project_service.delete_project(project_id)
        if deleted_id is None:
            raise HTTPException(status_code=404, detail="Project not found")
        await broadcast("rooms-refresh", {"action": "project_deleted", "project_id": project_id})
        return {"success": True, "deleted": project_id}
    except HTTPException:
        raise
    except ValueError as e:
        if str(e) == "not_archived":
            raise HTTPException(
                status_code=400,
                detail="Only archived projects can be deleted. Archive the project first.",
            )
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to delete project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========================================
# PROJECT FILE OPERATIONS
# (File I/O stays in the route — no SQL, no service needed)
# ========================================


@router.get("/{project_id}/markdown-files")
async def list_markdown_files(project_id: str):
    """List markdown files in a project's Synology Drive folder."""
    try:
        project = await project_service.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        folder_path = project.folder_path or ""
        project_dir = None

        if folder_path:
            expanded = Path(os.path.expanduser(folder_path))
            if expanded.exists():
                project_dir = expanded

        if not project_dir:
            name_slug = re.sub(r"[^a-zA-Z0-9]+", "-", project.name).strip("-")
            candidate = SYNOLOGY_PROJECTS_BASE / name_slug
            if candidate.exists():
                project_dir = candidate

        if not project_dir or not project_dir.exists():
            return {"files": [], "warning": "Project folder not found"}

        resolved_base = project_dir.resolve()
        if not any(resolved_base.is_relative_to(root) for root in ALLOWED_PROJECT_ROOTS if root.exists()):
            logger.warning(f"Project folder outside allowed roots: {resolved_base}")
            raise HTTPException(403, "Project folder outside allowed roots")

        def _scan_files(base_dir: Path, resolved: Path) -> list[str]:
            md_files: list[str] = []
            for md_path in sorted(base_dir.rglob("*.md")):
                try:
                    resolved_path = md_path.resolve()
                    if not resolved_path.is_relative_to(resolved):
                        continue
                except (OSError, ValueError):
                    continue
                rel = md_path.relative_to(base_dir)
                parts = rel.parts
                if any(p.startswith(".") or p == "node_modules" for p in parts):
                    continue
                if len(parts) > 4:
                    continue
                try:
                    if md_path.stat().st_size > 1_000_000:
                        continue
                except OSError:
                    continue
                md_files.append(str(rel))
                if len(md_files) >= 200:
                    break
            return md_files

        SKIP_DIRS = {".git", "node_modules", ".DS_Store", "__pycache__", ".venv", "venv"}

        def _build_tree(base_dir: Path, current_dir: Path, resolved: Path, depth: int = 0) -> list[dict]:
            if depth > 4:
                return []
            items = []
            try:
                entries = sorted(
                    current_dir.iterdir(),
                    key=lambda p: (not p.is_dir(), p.name.lower()),
                )
            except PermissionError:
                return []
            for item in entries:
                if item.name.startswith(".") or item.name in SKIP_DIRS:
                    continue
                if item.is_dir():
                    children = _build_tree(base_dir, item, resolved, depth + 1)
                    if children:
                        items.append({"name": item.name, "type": "folder", "children": children})
                elif item.is_file() and item.suffix == ".md":
                    try:
                        resolved_path = item.resolve()
                        if not resolved_path.is_relative_to(resolved):
                            continue
                        if item.stat().st_size > 1_000_000:
                            continue
                    except (OSError, ValueError):
                        continue
                    rel_path = item.relative_to(base_dir)
                    items.append({"name": item.name, "type": "file", "path": str(rel_path)})
            return items

        md_files = await asyncio.to_thread(_scan_files, project_dir, resolved_base)
        tree = await asyncio.to_thread(_build_tree, project_dir, project_dir, resolved_base)

        return {"files": md_files, "tree": tree, "root": project.name}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list markdown files for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_id}/upload-document")
async def upload_document(project_id: str, file: Annotated[UploadFile, File(...)]):
    """Upload a markdown document to a project's meetings folder."""
    project = await project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    if not file.filename or not file.filename.endswith(".md"):
        raise HTTPException(400, "Only .md files allowed")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 5MB)")

    folder_path = project.folder_path or ""
    if not folder_path:
        raise HTTPException(400, "Project has no folder path configured")

    project_dir = Path(os.path.expanduser(folder_path)).resolve()

    if not any(project_dir.is_relative_to(root) for root in ALLOWED_PROJECT_ROOTS if root.exists()):
        raise HTTPException(403, "Project folder outside allowed roots")

    today = datetime.now().strftime("%Y-%m-%d")
    meetings_dir = project_dir / "meetings" / today
    await asyncio.to_thread(lambda: meetings_dir.mkdir(parents=True, exist_ok=True))

    filename = file.filename
    save_path = meetings_dir / filename
    counter = 1
    while save_path.exists():
        name, ext = filename.rsplit(".", 1)
        save_path = meetings_dir / f"{name}-{counter}.{ext}"
        counter += 1

    await asyncio.to_thread(save_path.write_bytes, content)

    rel_path = save_path.relative_to(project_dir)
    return {"path": str(rel_path), "filename": save_path.name, "size": len(content)}
