"""Projects API routes."""
import os
import re
import time
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException

from app.db.database import get_db
from app.db.models import ProjectCreate, ProjectUpdate, ProjectResponse, generate_id
from app.routes.sse import broadcast

# Default projects base path (configurable via settings)
DEFAULT_PROJECTS_BASE_PATH = "~/Projects"

# Synology Drive base for project documents
SYNOLOGY_PROJECTS_BASE = Path.home() / "SynologyDrive" / "ekinbot" / "01-Projects"

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=dict)
async def list_projects():
    """Get all projects."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
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
        finally:
            await db.close()
    except Exception as e:
        logger.error(f"Failed to list projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/overview", response_model=dict)
async def projects_overview():
    """Get all projects with room counts and agent counts for HQ dashboard."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
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
        finally:
            await db.close()
    except Exception as e:
        logger.error(f"Failed to get projects overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str):
    """Get a specific project by ID."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
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
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}/markdown-files")
async def list_markdown_files(project_id: str):
    """List markdown files in a project's Synology Drive folder."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            async with db.execute(
                "SELECT * FROM projects WHERE id = ?", (project_id,)
            ) as cursor:
                project = await cursor.fetchone()
                if not project:
                    raise HTTPException(status_code=404, detail="Project not found")
        finally:
            await db.close()

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

        # Scan for .md files (max depth 3, max 100 files)
        resolved_base = project_dir.resolve()
        md_files: list[str] = []
        for md_path in sorted(project_dir.rglob("*.md")):
            # Security: ensure file is within project dir (no symlink escape)
            try:
                resolved = md_path.resolve()
                if not str(resolved).startswith(str(resolved_base)):
                    continue
            except (OSError, ValueError):
                continue

            # Skip hidden dirs and node_modules
            rel = md_path.relative_to(project_dir)
            parts = rel.parts
            if any(p.startswith('.') or p == 'node_modules' for p in parts):
                continue

            # Max depth 3
            if len(parts) > 4:
                continue

            # Skip files > 1MB
            try:
                if md_path.stat().st_size > 1_000_000:
                    continue
            except OSError:
                continue

            md_files.append(str(rel))
            if len(md_files) >= 100:
                break

        return {"files": md_files}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list markdown files for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=ProjectResponse)
async def create_project(project: ProjectCreate):
    """Create a new project."""
    try:
        db = await get_db()
        try:
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
        finally:
            await db.close()
    except Exception as e:
        logger.error(f"Failed to create project: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, project: ProjectUpdate):
    """Update an existing project."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )

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
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
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
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    """Delete a project. Only archived projects can be deleted."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )

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
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
