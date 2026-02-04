"""Projects API routes."""
import re
import time
import logging
from fastapi import APIRouter, HTTPException

from app.db.database import get_db
from app.db.models import ProjectCreate, ProjectUpdate, ProjectResponse, generate_id
from app.routes.sse import broadcast

# Default projects base path (configurable via settings)
DEFAULT_PROJECTS_BASE_PATH = "~/Projects"

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
            # Check if project exists
            async with db.execute(
                "SELECT id FROM projects WHERE id = ?", (project_id,)
            ) as cursor:
                if not await cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Project not found")

            # Build update query dynamically
            updates = []
            values = []
            update_data = project.model_dump(exclude_unset=True)

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
    """Delete a project. Clears room assignments first."""
    try:
        db = await get_db()
        try:
            # Check if project exists
            async with db.execute(
                "SELECT id FROM projects WHERE id = ?", (project_id,)
            ) as cursor:
                if not await cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Project not found")

            # Clear room assignments
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
