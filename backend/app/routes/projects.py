"""Projects API routes."""
import asyncio
import os
import re
import time
import logging
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, HTTPException, UploadFile, File

from app.db.database import get_db
from app.db.models import ProjectCreate, ProjectUpdate, ProjectResponse, generate_id
from app.routes.sse import broadcast

# Default projects base path (configurable via settings)
DEFAULT_PROJECTS_BASE_PATH = "~/Projects"

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


@router.get("", response_model=dict)
async def list_projects():
    """Get all projects."""
    try:
        async with get_db() as db:
            async with db.execute(
                "SELECT * FROM projects ORDER BY created_at DESC"
            ) as cursor:
                rows = await cursor.fetchall()

            # Get room assignments for each project
            projects = []
            for row in rows:
                async with db.execute(
                    "SELECT id FROM rooms WHERE project_id = ?", (row["id"],)
                ) as cursor:
                    room_rows = await cursor.fetchall()
                    room_ids = [r["id"] for r in room_rows]

                projects.append(ProjectResponse(
                    **row,
                    rooms=room_ids,
                ))

            return {"projects": [p.model_dump() for p in projects]}
    except Exception as e:
        logger.error(f"Failed to list projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/overview", response_model=dict)
async def projects_overview():
    """Get all projects with room counts and agent counts for HQ dashboard."""
    try:
        async with get_db() as db:
            async with db.execute(
                "SELECT * FROM projects ORDER BY created_at DESC"
            ) as cursor:
                rows = await cursor.fetchall()

            overview = []
            for row in rows:
                # Count rooms assigned to this project
                async with db.execute(
                    "SELECT COUNT(*) as count FROM rooms WHERE project_id = ?",
                    (row["id"],),
                ) as cursor:
                    room_count = (await cursor.fetchone())["count"]

                # Count agents in rooms assigned to this project
                async with db.execute(
                    """SELECT COUNT(*) as count FROM agents 
                       WHERE default_room_id IN (
                           SELECT id FROM rooms WHERE project_id = ?
                       )""",
                    (row["id"],),
                ) as cursor:
                    agent_count = (await cursor.fetchone())["count"]

                # Get room IDs
                async with db.execute(
                    "SELECT id FROM rooms WHERE project_id = ?", (row["id"],)
                ) as cursor:
                    room_ids = [r["id"] for r in await cursor.fetchall()]

                overview.append({
                    **ProjectResponse(**row, rooms=room_ids).model_dump(),
                    "room_count": room_count,
                    "agent_count": agent_count,
                })

            return {"projects": overview}
    except Exception as e:
        logger.error(f"Failed to get projects overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str):
    """Get a specific project by ID."""
    try:
        async with get_db() as db:
            async with db.execute(
                "SELECT * FROM projects WHERE id = ?", (project_id,)
            ) as cursor:
                row = await cursor.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Project not found")

            async with db.execute(
                "SELECT id FROM rooms WHERE project_id = ?", (project_id,)
            ) as cursor:
                room_ids = [r["id"] for r in await cursor.fetchall()]

            return ProjectResponse(**row, rooms=room_ids)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}/markdown-files")
async def list_markdown_files(project_id: str):
    """List markdown files in a project's Synology Drive folder."""
    try:
        async with get_db() as db:
            async with db.execute(
                "SELECT * FROM projects WHERE id = ?", (project_id,)
            ) as cursor:
                project = await cursor.fetchone()
                if not project:
                    raise HTTPException(status_code=404, detail="Project not found")

        # Determine project folder path
        folder_path = project.get("folder_path", "")
        project_dir = None

        # Try Synology Drive path first
        if folder_path:
            expanded = Path(os.path.expanduser(folder_path))
            if expanded.exists():
                project_dir = expanded

        # Fallback: try project name in Synology projects base
        if not project_dir:
            name_slug = re.sub(r'[^a-zA-Z0-9]+', '-', project["name"]).strip('-')
            candidate = SYNOLOGY_PROJECTS_BASE / name_slug
            if candidate.exists():
                project_dir = candidate

        if not project_dir or not project_dir.exists():
            return {"files": [], "warning": "Project folder not found"}

        # Security: verify project folder is within allowed roots
        resolved_base = project_dir.resolve()
        if not any(resolved_base.is_relative_to(root) for root in ALLOWED_PROJECT_ROOTS if root.exists()):
            logger.warning(f"Project folder outside allowed roots: {resolved_base}")
            raise HTTPException(403, "Project folder outside allowed roots")

        # Scan for .md files (flat list) in thread pool
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
                if any(p.startswith('.') or p == 'node_modules' for p in parts):
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

        # Build tree structure
        SKIP_DIRS = {'.git', 'node_modules', '.DS_Store', '__pycache__', '.venv', 'venv'}

        def _build_tree(base_dir: Path, current_dir: Path, resolved: Path, depth: int = 0) -> list[dict]:
            if depth > 4:
                return []
            items = []
            try:
                entries = sorted(current_dir.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
            except PermissionError:
                return []
            for item in entries:
                if item.name.startswith('.') or item.name in SKIP_DIRS:
                    continue
                if item.is_dir():
                    children = _build_tree(base_dir, item, resolved, depth + 1)
                    if children:  # Only include folders that have .md files
                        items.append({
                            "name": item.name,
                            "type": "folder",
                            "children": children,
                        })
                elif item.is_file() and item.suffix == '.md':
                    try:
                        resolved_path = item.resolve()
                        if not resolved_path.is_relative_to(resolved):
                            continue
                        if item.stat().st_size > 1_000_000:
                            continue
                    except (OSError, ValueError):
                        continue
                    rel_path = item.relative_to(base_dir)
                    items.append({
                        "name": item.name,
                        "type": "file",
                        "path": str(rel_path),
                    })
            return items

        md_files = await asyncio.to_thread(_scan_files, project_dir, resolved_base)
        tree = await asyncio.to_thread(_build_tree, project_dir, project_dir, resolved_base)

        return {"files": md_files, "tree": tree, "root": project["name"]}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list markdown files for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_id}/upload-document")
async def upload_document(project_id: str, file: UploadFile = File(...)):
    """Upload markdown document to project meetings folder."""
    async with get_db() as db:
        async with db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)) as cursor:
            project = await cursor.fetchone()
            if not project:
                raise HTTPException(404, "Project not found")

    if not file.filename or not file.filename.endswith('.md'):
        raise HTTPException(400, "Only .md files allowed")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 5MB)")

    # Determine project folder
    folder_path = project.get("folder_path", "")
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
        name, ext = filename.rsplit('.', 1)
        save_path = meetings_dir / f"{name}-{counter}.{ext}"
        counter += 1

    await asyncio.to_thread(save_path.write_bytes, content)

    rel_path = save_path.relative_to(project_dir)
    return {"path": str(rel_path), "filename": save_path.name, "size": len(content)}


@router.post("", response_model=ProjectResponse)
async def create_project(project: ProjectCreate):
    """Create a new project."""
    try:
        async with get_db() as db:
            now = int(time.time() * 1000)
            project_id = generate_id()

            # Auto-generate folder_path from name if not provided
            folder_path = project.folder_path
            if not folder_path:
                # Get configurable base path from settings
                base_path = DEFAULT_PROJECTS_BASE_PATH
                try:
                    async with db.execute(
                        "SELECT value FROM settings WHERE key = 'projects_base_path'"
                    ) as cursor:
                        row = await cursor.fetchone()
                        if row:
                            base_path = row[0] if isinstance(row, tuple) else row["value"]
                except Exception:
                    pass  # Use default on any error
                slug = re.sub(r'[^a-zA-Z0-9]+', '-', project.name).strip('-')
                folder_path = f"{base_path}/{slug}"

            await db.execute(
                """INSERT INTO projects (id, name, description, icon, color, folder_path, status, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)""",
                (
                    project_id,
                    project.name,
                    project.description,
                    project.icon,
                    project.color,
                    folder_path,
                    now,
                    now,
                ),
            )
            await db.commit()

            await broadcast("rooms-refresh", {"action": "project_created", "project_id": project_id})

            return ProjectResponse(
                id=project_id,
                name=project.name,
                description=project.description,
                icon=project.icon,
                color=project.color,
                folder_path=folder_path,
                status="active",
                created_at=now,
                updated_at=now,
                rooms=[],
            )
    except Exception as e:
        logger.error(f"Failed to create project: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, project: ProjectUpdate):
    """Update an existing project."""
    try:
        async with get_db() as db:

            # Check if project exists
            async with db.execute(
                "SELECT * FROM projects WHERE id = ?", (project_id,)
            ) as cursor:
                existing = await cursor.fetchone()
                if not existing:
                    raise HTTPException(status_code=404, detail="Project not found")

            update_data = project.model_dump(exclude_unset=True)

            # Archive validation: cannot archive if assigned to rooms
            if update_data.get("status") == "archived" and existing["status"] != "archived":
                async with db.execute(
                    "SELECT id, name FROM rooms WHERE project_id = ?", (project_id,)
                ) as cursor:
                    assigned_rooms = await cursor.fetchall()
                if assigned_rooms:
                    room_names = [r["name"] for r in assigned_rooms]
                    room_ids = [r["id"] for r in assigned_rooms]
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot archive: project is assigned to {len(assigned_rooms)} room(s): {', '.join(room_names)}",
                    )

            # Build update query dynamically
            updates = []
            values = []

            for field, value in update_data.items():
                if value is not None:
                    updates.append(f"{field} = ?")
                    values.append(value)

            if updates:
                updates.append("updated_at = ?")
                values.append(int(time.time() * 1000))
                values.append(project_id)

                await db.execute(
                    f"UPDATE projects SET {', '.join(updates)} WHERE id = ?",
                    values,
                )
                await db.commit()

            # Return updated project
            async with db.execute(
                "SELECT * FROM projects WHERE id = ?", (project_id,)
            ) as cursor:
                row = await cursor.fetchone()

            async with db.execute(
                "SELECT id FROM rooms WHERE project_id = ?", (project_id,)
            ) as cursor:
                room_ids = [r["id"] for r in await cursor.fetchall()]

            await broadcast("rooms-refresh", {"action": "project_updated", "project_id": project_id})

            return ProjectResponse(**row, rooms=room_ids)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    """Delete a project. Only archived projects can be deleted."""
    try:
        async with get_db() as db:

            # Check if project exists
            async with db.execute(
                "SELECT * FROM projects WHERE id = ?", (project_id,)
            ) as cursor:
                existing = await cursor.fetchone()
                if not existing:
                    raise HTTPException(status_code=404, detail="Project not found")

            # Only archived projects can be deleted
            if existing["status"] != "archived":
                raise HTTPException(
                    status_code=400,
                    detail="Only archived projects can be deleted. Archive the project first.",
                )

            # Clear room assignments (safety — archived shouldn't have any)
            await db.execute(
                "UPDATE rooms SET project_id = NULL WHERE project_id = ?",
                (project_id,),
            )

            # Delete the project
            await db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
            await db.commit()

            await broadcast("rooms-refresh", {"action": "project_deleted", "project_id": project_id})

            return {"success": True, "deleted": project_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
