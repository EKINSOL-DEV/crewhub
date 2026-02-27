"""Service layer for task database operations.

All SQL for tasks lives here. Routes call these functions and handle
HTTP concerns (exceptions, SSE broadcasts, response formatting).
"""

import json
import logging
import time
from typing import Optional

from app.db.database import get_db
from app.db.models import generate_id
from app.db.task_models import (
    TaskCreate,
    TaskListResponse,
    TaskResponse,
    TaskUpdate,
)

SQL_GET_TASK = "SELECT * FROM tasks WHERE id = ?"

logger = logging.getLogger(__name__)


# ── helpers ──────────────────────────────────────────────────────────────────


async def get_display_name(db, session_key: Optional[str]) -> Optional[str]:
    """Look up human-readable display name for a session key."""
    if not session_key:
        return None

    async with db.execute(
        "SELECT display_name FROM session_display_names WHERE session_key = ?",
        (session_key,),
    ) as cursor:
        row = await cursor.fetchone()
        if row:
            return row[0] if isinstance(row, tuple) else row["display_name"]

    # Fallback: derive name from session key  e.g. "agent:dev:main" → "Dev"
    parts = session_key.split(":")
    if len(parts) >= 2:
        return parts[1].capitalize()
    return session_key


def row_to_task(row, display_name: Optional[str] = None) -> TaskResponse:
    """Convert a database row to a TaskResponse Pydantic model."""
    return TaskResponse(
        id=row["id"],
        project_id=row["project_id"],
        room_id=row["room_id"],
        title=row["title"],
        description=row["description"],
        status=row["status"],
        priority=row["priority"],
        assigned_session_key=row["assigned_session_key"],
        assigned_display_name=display_name,
        created_by=row["created_by"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


async def add_history_event(
    db,
    project_id: str,
    event_type: str,
    task_id: Optional[str] = None,
    actor_session_key: Optional[str] = None,
    payload: Optional[dict] = None,
) -> str:
    """Insert a project_history row and return the new event ID."""
    event_id = generate_id()
    now = int(time.time() * 1000)
    payload_json = json.dumps(payload) if payload else None

    await db.execute(
        """INSERT INTO project_history
               (id, project_id, task_id, event_type, actor_session_key, payload_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (event_id, project_id, task_id, event_type, actor_session_key, payload_json, now),
    )
    return event_id


# ── public service functions ──────────────────────────────────────────────────


async def list_tasks(
    project_id: Optional[str] = None,
    room_id: Optional[str] = None,
    status: Optional[str] = None,
    assigned_session_key: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> TaskListResponse:
    """Return a paginated list of tasks matching the given filters."""
    async with get_db() as db:
        query = "SELECT * FROM tasks WHERE 1=1"
        params: list = []

        if project_id:
            query += " AND project_id = ?"
            params.append(project_id)
        if room_id:
            query += " AND room_id = ?"
            params.append(room_id)
        if status:
            statuses = [s.strip() for s in status.split(",")]
            placeholders = ",".join("?" * len(statuses))
            query += f" AND status IN ({placeholders})"
            params.extend(statuses)
        if assigned_session_key:
            query += " AND assigned_session_key = ?"
            params.append(assigned_session_key)

        count_query = query.replace("SELECT *", "SELECT COUNT(*) as cnt")
        async with db.execute(count_query, params) as cursor:
            result = await cursor.fetchone()
            total = result["cnt"] if isinstance(result, dict) else result[0]

        query += (
            " ORDER BY CASE status"
            " WHEN 'blocked' THEN 1 WHEN 'in_progress' THEN 2"
            " WHEN 'todo' THEN 3 WHEN 'review' THEN 4 ELSE 5 END,"
            " updated_at DESC"
        )
        query += " LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        async with db.execute(query, params) as cursor:
            rows = await cursor.fetchall()

        tasks = []
        for row in rows:
            display_name = await get_display_name(db, row["assigned_session_key"])
            tasks.append(row_to_task(row, display_name))

        return TaskListResponse(tasks=tasks, total=total)


async def get_task(task_id: str) -> Optional[TaskResponse]:
    """Return a single task by ID, or None if not found."""
    async with get_db() as db:
        async with db.execute(SQL_GET_TASK, (task_id,)) as cursor:
            row = await cursor.fetchone()

        if not row:
            return None

        display_name = await get_display_name(db, row["assigned_session_key"])
        return row_to_task(row, display_name)


async def create_task(task: TaskCreate) -> TaskResponse:
    """
    Insert a new task row and its initial history event.

    Raises:
        ValueError("project_not_found") if the project does not exist.
        ValueError("room_not_found")    if a room_id is given but not found.
    """
    async with get_db() as db:
        # Verify project exists
        async with db.execute("SELECT id FROM projects WHERE id = ?", (task.project_id,)) as cursor:
            if not await cursor.fetchone():
                raise ValueError("project_not_found")

        # Verify room exists (when provided)
        if task.room_id:
            async with db.execute("SELECT id FROM rooms WHERE id = ?", (task.room_id,)) as cursor:
                if not await cursor.fetchone():
                    raise ValueError("room_not_found")

        now = int(time.time() * 1000)
        task_id = generate_id()

        await db.execute(
            """INSERT INTO tasks
                   (id, project_id, room_id, title, description,
                    status, priority, assigned_session_key, created_by,
                    created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                task_id,
                task.project_id,
                task.room_id,
                task.title,
                task.description,
                task.status,
                task.priority,
                task.assigned_session_key,
                None,  # created_by — can be set later
                now,
                now,
            ),
        )

        await add_history_event(
            db,
            task.project_id,
            "task_created",
            task_id,
            task.assigned_session_key,
            {"title": task.title, "status": task.status, "priority": task.priority},
        )
        await db.commit()

        display_name = await get_display_name(db, task.assigned_session_key)

        return TaskResponse(
            id=task_id,
            project_id=task.project_id,
            room_id=task.room_id,
            title=task.title,
            description=task.description,
            status=task.status,
            priority=task.priority,
            assigned_session_key=task.assigned_session_key,
            assigned_display_name=display_name,
            created_by=None,
            created_at=now,
            updated_at=now,
        )


async def update_task(
    task_id: str,
    task: TaskUpdate,
) -> tuple[Optional[TaskResponse], Optional[dict]]:
    """
    Apply a partial update to a task.

    Returns:
        (TaskResponse, changes_dict) on success.
        (None, None)                 if task not found.

    ``changes_dict`` maps field names to {"old": …, "new": …} entries.
    An empty dict means the payload contained no changes.
    """
    async with get_db() as db:
        async with db.execute(SQL_GET_TASK, (task_id,)) as cursor:
            existing = await cursor.fetchone()

        if not existing:
            return None, None

        update_data = task.model_dump(exclude_unset=True)

        if not update_data:
            display_name = await get_display_name(db, existing["assigned_session_key"])
            return row_to_task(existing, display_name), {}

        updates: list = []
        values: list = []
        changes: dict = {}

        for field, value in update_data.items():
            updates.append(f"{field} = ?")
            values.append(value)
            if existing.get(field) != value:
                changes[field] = {"old": existing.get(field), "new": value}

        now = int(time.time() * 1000)
        updates.append("updated_at = ?")
        values.append(now)
        values.append(task_id)

        await db.execute(
            f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?",
            values,
        )

        if changes:
            event_type = "task_updated"
            if "status" in changes:
                event_type = "task_status_changed"
            elif "assigned_session_key" in changes:
                event_type = "task_assigned"

            await add_history_event(
                db,
                existing["project_id"],
                event_type,
                task_id,
                task.assigned_session_key or existing["assigned_session_key"],
                changes,
            )

        await db.commit()

        async with db.execute(SQL_GET_TASK, (task_id,)) as cursor:
            row = await cursor.fetchone()

        display_name = await get_display_name(db, row["assigned_session_key"])
        return row_to_task(row, display_name), changes


async def delete_task(task_id: str) -> Optional[dict]:
    """
    Delete a task and record a history event.

    Returns a dict with task_id / project_id / room_id on success,
    or None if the task was not found.
    """
    async with get_db() as db:
        async with db.execute(SQL_GET_TASK, (task_id,)) as cursor:
            existing = await cursor.fetchone()

        if not existing:
            return None

        await add_history_event(
            db,
            existing["project_id"],
            "task_deleted",
            task_id,
            None,
            {"title": existing["title"]},
        )

        await db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        await db.commit()

        return {
            "task_id": task_id,
            "project_id": existing["project_id"],
            "room_id": existing["room_id"],
        }


async def set_task_running(
    task_id: str,
    project_id: str,
    agent_id: str,
    agent_name: str,
    session_key: str,
    prompt_preview: str,
) -> None:
    """
    Mark a task as in_progress after dispatching it to an agent.
    Records a task_sent_to_agent history event and commits.
    """
    async with get_db() as db:
        now = int(time.time() * 1000)
        await db.execute(
            "UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?",
            ("in_progress", now, task_id),
        )
        await add_history_event(
            db,
            project_id,
            "task_sent_to_agent",
            task_id,
            session_key,
            {
                "agent_id": agent_id,
                "agent_name": agent_name,
                "session_key": session_key,
                "prompt_preview": prompt_preview[:200],
            },
        )
        await db.commit()


async def get_task_row(task_id: str):
    """Return the raw database row for a task, or None if not found.

    Used by routes that need access to fields beyond TaskResponse (e.g. run).
    """
    async with get_db() as db:
        async with db.execute(SQL_GET_TASK, (task_id,)) as cursor:
            return await cursor.fetchone()


async def get_agent_row(agent_id: str):
    """Return the raw database row for an agent, or None if not found."""
    async with get_db() as db:
        async with db.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)) as cursor:
            return await cursor.fetchone()
