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

MSG_PROJECT_NOT_FOUND = "Project not found"

logger = logging.getLogger(__name__)
router = APIRouter()

_SKIP_DIRS = {".git", "node_modules", ".DS_Store", "__pycache__", ".venv", "venv"}


def _scan_project_md_files(base_dir: Path, resolved: Path) -> list:
    """Scan a project directory for markdown files (safe, depth-limited)."""
    md_files: list[str] = []
    for md_path in sorted(base_dir.rglob("*.md")):
        try:
            if not md_path.resolve().is_relative_to(resolved):
                continue
        except (OSError, ValueError):
            continue
        parts = md_path.relative_to(base_dir).parts
        if any(p.startswith(".") or p == "node_modules" for p in parts):
            continue
        if len(parts) > 4:
            continue
        try:
            if md_path.stat().st_size > 1_000_000:
                continue
        except OSError:
            continue
        md_files.append(str(md_path.relative_to(base_dir)))
        if len(md_files) >= 200:
            break
    return md_files


def _build_project_md_tree(base_dir: Path, current_dir: Path, resolved: Path, depth: int = 0) -> list:
    """Recursively build a tree of markdown files (depth ≤ 4)."""
    if depth > 4:
        return []
    items = []
    try:
        entries = sorted(current_dir.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
    except PermissionError:
        return []
    for item in entries:
        if item.name.startswith(".") or item.name in _SKIP_DIRS:
            continue
        if item.is_dir():
            children = _build_project_md_tree(base_dir, item, resolved, depth + 1)
            if children:
                items.append({"name": item.name, "type": "folder", "children": children})
        elif item.is_file() and item.suffix == ".md":
            try:
                if not item.resolve().is_relative_to(resolved) or item.stat().st_size > 1_000_000:
                    continue
            except (OSError, ValueError):
                continue
            items.append({"name": item.name, "type": "file", "path": str(item.relative_to(base_dir))})
    return items


def _resolve_existing_project_dir(folder_path: str) -> Path | None:
    """Resolve configured folder path if it exists."""
    if not folder_path:
        return None
    expanded = Path(os.path.expanduser(folder_path))
    return expanded if expanded.exists() else None


def _resolve_slug_project_dir(project_name: str) -> Path | None:
    """Resolve project folder using slug fallback."""
    name_slug = re.sub(r"[^a-zA-Z0-9]+", "-", project_name).strip("-")
    candidate = SYNOLOGY_PROJECTS_BASE / name_slug
    return candidate if candidate.exists() else None


def _validate_project_root(project_dir: Path) -> Path:
    """Ensure project folder is inside allowed roots."""
    resolved_base = project_dir.resolve()
    if any(resolved_base.is_relative_to(root) for root in ALLOWED_PROJECT_ROOTS if root.exists()):
        return resolved_base
    logger.warning(f"Project folder outside allowed roots: {resolved_base}")
    raise HTTPException(403, "Project folder outside allowed roots")


async def _resolve_project_markdown_root(project) -> Path | None:
    """Resolve a project directory with configured path first, then slug fallback."""
    configured = _resolve_existing_project_dir(project.folder_path or "")
    if configured:
        return configured
    return _resolve_slug_project_dir(project.name)


# ========================================
# PROJECTS CRUD
# ========================================


@router.get("", response_model=dict, responses={500: {"description": "Internal server error"}})
async def list_projects():
    """Get all projects."""
    try:
        projects = await project_service.list_projects()
        return {"projects": [p.model_dump() for p in projects]}
    except Exception as e:
        logger.error(f"Failed to list projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/overview", response_model=dict, responses={500: {"description": "Internal server error"}})
async def projects_overview():
    """Get all projects with room counts and agent counts for HQ dashboard."""
    try:
        overview = await project_service.get_projects_overview()
        return {"projects": overview}
    except Exception as e:
        logger.error(f"Failed to get projects overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    responses={404: {"description": "Not found"}, 500: {"description": "Internal server error"}},
)
async def get_project(project_id: str):
    """Get a specific project by ID."""
    try:
        project = await project_service.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=MSG_PROJECT_NOT_FOUND)
        return project
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get project {project_id}: {e}")  # NOSONAR
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=ProjectResponse, responses={500: {"description": "Internal server error"}})
async def create_project(project: ProjectCreate):
    """Create a new project."""
    try:
        result = await project_service.create_project(project)
        await broadcast("rooms-refresh", {"action": "project_created", "project_id": result.id})
        return result
    except Exception as e:
        logger.error(f"Failed to create project: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put(
    "/{project_id}",
    response_model=ProjectResponse,
    responses={
        400: {"description": "Bad request"},
        404: {"description": "Not found"},
        500: {"description": "Internal server error"},
    },
)
async def update_project(project_id: str, project: ProjectUpdate):
    """Update an existing project."""
    try:
        result = await project_service.update_project(project_id, project)
        if result is None:
            raise HTTPException(status_code=404, detail=MSG_PROJECT_NOT_FOUND)
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
        logger.error(f"Failed to update project {project_id}: {e}")  # NOSONAR
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(
    "/{project_id}",
    responses={
        400: {"description": "Bad request"},
        404: {"description": "Not found"},
        500: {"description": "Internal server error"},
    },
)
async def delete_project(project_id: str):
    """Delete a project. Only archived projects can be deleted."""
    try:
        deleted_id = await project_service.delete_project(project_id)
        if deleted_id is None:
            raise HTTPException(status_code=404, detail=MSG_PROJECT_NOT_FOUND)
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
        logger.error(f"Failed to delete project {project_id}: {e}")  # NOSONAR
        raise HTTPException(status_code=500, detail=str(e))


# ========================================
# PROJECT FILE OPERATIONS
# (File I/O stays in the route — no SQL, no service needed)
# ========================================


@router.get(
    "/{project_id}/markdown-files",
    responses={
        403: {"description": "Forbidden"},
        404: {"description": "Not found"},
        500: {"description": "Internal server error"},
    },
)
async def list_markdown_files(project_id: str):
    """List markdown files in a project's Synology Drive folder."""
    try:
        project = await project_service.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=MSG_PROJECT_NOT_FOUND)

        project_dir = await _resolve_project_markdown_root(project)
        if not project_dir:
            return {"files": [], "warning": "Project folder not found"}

        resolved_base = _validate_project_root(project_dir)
        md_files = await asyncio.to_thread(_scan_project_md_files, project_dir, resolved_base)
        tree = await asyncio.to_thread(_build_project_md_tree, project_dir, project_dir, resolved_base)
        return {"files": md_files, "tree": tree, "root": project.name}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list markdown files for project {project_id}: {e}")  # NOSONAR
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{project_id}/upload-document",
    responses={
        400: {"description": "Bad request"},
        403: {"description": "Forbidden"},
        404: {"description": "Not found"},
    },
)
async def upload_document(project_id: str, file: Annotated[UploadFile, File(...)]):
    """Upload a markdown document to a project's meetings folder."""
    project = await project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, MSG_PROJECT_NOT_FOUND)

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
