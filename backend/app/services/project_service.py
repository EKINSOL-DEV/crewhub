"""Service layer for project database operations.

All SQL for projects lives here. Routes call these functions and handle
HTTP concerns (exceptions, SSE broadcasts, response formatting).
"""
import logging
import re
import time
from typing import List, Optional

from app.db.database import get_db
from app.db.models import ProjectCreate, ProjectResponse, ProjectUpdate, generate_id

logger = logging.getLogger(__name__)

# Default base path for auto-generated folder_path values
DEFAULT_PROJECTS_BASE_PATH = "~/Projects"


# ── helpers ──────────────────────────────────────────────────────────────────

async def _get_room_ids(db, project_id: str) -> List[str]:
    """Return the list of room IDs assigned to a project."""
    async with db.execute(
        "SELECT id FROM rooms WHERE project_id = ?", (project_id,)
    ) as cursor:
        rows = await cursor.fetchall()
    return [r["id"] for r in rows]


async def _get_base_path(db) -> str:
    """Read the configurable projects base path from settings, falling back to default."""
    try:
        async with db.execute(
            "SELECT value FROM settings WHERE key = 'projects_base_path'"
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return row[0] if isinstance(row, tuple) else row["value"]
    except Exception:
        pass
    return DEFAULT_PROJECTS_BASE_PATH


# ── public service functions ──────────────────────────────────────────────────

async def list_projects() -> List[ProjectResponse]:
    """Return all projects ordered by creation date (newest first)."""
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM projects ORDER BY created_at DESC"
        ) as cursor:
            rows = await cursor.fetchall()

        projects = []
        for row in rows:
            room_ids = await _get_room_ids(db, row["id"])
            projects.append(ProjectResponse(**row, rooms=room_ids))

        return projects


async def get_project(project_id: str) -> Optional[ProjectResponse]:
    """Return a single project by ID, or None if not found."""
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM projects WHERE id = ?", (project_id,)
        ) as cursor:
            row = await cursor.fetchone()

        if not row:
            return None

        room_ids = await _get_room_ids(db, project_id)
        return ProjectResponse(**row, rooms=room_ids)


async def get_projects_overview() -> List[dict]:
    """
    Return all projects enriched with room_count and agent_count.
    Used by the HQ dashboard.
    """
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM projects ORDER BY created_at DESC"
        ) as cursor:
            rows = await cursor.fetchall()

        overview = []
        for row in rows:
            async with db.execute(
                "SELECT COUNT(*) as count FROM rooms WHERE project_id = ?",
                (row["id"],),
            ) as cursor:
                room_count = (await cursor.fetchone())["count"]

            async with db.execute(
                """SELECT COUNT(*) as count FROM agents
                   WHERE default_room_id IN (
                       SELECT id FROM rooms WHERE project_id = ?
                   )""",
                (row["id"],),
            ) as cursor:
                agent_count = (await cursor.fetchone())["count"]

            room_ids = await _get_room_ids(db, row["id"])

            overview.append({
                **ProjectResponse(**row, rooms=room_ids).model_dump(),
                "room_count": room_count,
                "agent_count": agent_count,
            })

        return overview


async def create_project(project: ProjectCreate) -> ProjectResponse:
    """
    Insert a new project row.

    If folder_path is not provided it is auto-generated from the project name
    using the configured base path (or the default ~/Projects).
    """
    async with get_db() as db:
        now = int(time.time() * 1000)
        project_id = generate_id()

        folder_path = project.folder_path
        if not folder_path:
            base_path = await _get_base_path(db)
            slug = re.sub(r"[^a-zA-Z0-9]+", "-", project.name).strip("-")
            folder_path = f"{base_path}/{slug}"

        await db.execute(
            """INSERT INTO projects
                   (id, name, description, icon, color, folder_path, status,
                    created_at, updated_at)
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


async def update_project(
    project_id: str,
    project: ProjectUpdate,
) -> Optional[ProjectResponse]:
    """
    Apply a partial update to a project.

    Returns the updated ProjectResponse, or None if not found.

    Raises:
        ValueError("cannot_archive_with_rooms:<names>") if trying to archive
            a project that still has rooms assigned.
    """
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM projects WHERE id = ?", (project_id,)
        ) as cursor:
            existing = await cursor.fetchone()

        if not existing:
            return None

        update_data = project.model_dump(exclude_unset=True)

        # Archive guard: cannot archive if rooms are still assigned
        if (
            update_data.get("status") == "archived"
            and existing["status"] != "archived"
        ):
            async with db.execute(
                "SELECT id, name FROM rooms WHERE project_id = ?", (project_id,)
            ) as cursor:
                assigned_rooms = await cursor.fetchall()

            if assigned_rooms:
                room_names = ", ".join(r["name"] for r in assigned_rooms)
                raise ValueError(f"cannot_archive_with_rooms:{room_names}")

        # Build dynamic UPDATE
        updates: list = []
        values: list = []

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

        async with db.execute(
            "SELECT * FROM projects WHERE id = ?", (project_id,)
        ) as cursor:
            row = await cursor.fetchone()

        room_ids = await _get_room_ids(db, project_id)
        return ProjectResponse(**row, rooms=room_ids)


async def delete_project(project_id: str) -> Optional[str]:
    """
    Delete a project (only when archived).

    Returns the deleted project_id on success, or None if not found.

    Raises:
        ValueError("not_archived") if the project is not in archived state.
    """
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM projects WHERE id = ?", (project_id,)
        ) as cursor:
            existing = await cursor.fetchone()

        if not existing:
            return None

        if existing["status"] != "archived":
            raise ValueError("not_archived")

        # Clear room assignments (archived projects shouldn't have any, but be safe)
        await db.execute(
            "UPDATE rooms SET project_id = NULL WHERE project_id = ?",
            (project_id,),
        )
        await db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        await db.commit()

        return project_id
