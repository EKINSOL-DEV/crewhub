"""Tasks API routes."""
import time
import json
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from app.db.database import get_db
from app.db.models import generate_id
from app.db.task_models import (
    TaskCreate, TaskUpdate, TaskResponse, TaskListResponse,
    HistoryEventResponse
)
from app.routes.sse import broadcast

logger = logging.getLogger(__name__)
router = APIRouter()


async def _add_history_event(
    db,
    project_id: str,
    event_type: str,
    task_id: Optional[str] = None,
    actor_session_key: Optional[str] = None,
    payload: Optional[dict] = None
):
    """Add a history event to project_history table."""
    event_id = generate_id()
    now = int(time.time() * 1000)
    payload_json = json.dumps(payload) if payload else None
    
    await db.execute(
        """INSERT INTO project_history (id, project_id, task_id, event_type, actor_session_key, payload_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (event_id, project_id, task_id, event_type, actor_session_key, payload_json, now)
    )
    
    return event_id


async def _get_display_name(db, session_key: Optional[str]) -> Optional[str]:
    """Get display name for a session key."""
    if not session_key:
        return None
    
    async with db.execute(
        "SELECT display_name FROM session_display_names WHERE session_key = ?",
        (session_key,)
    ) as cursor:
        row = await cursor.fetchone()
        if row:
            return row[0] if isinstance(row, tuple) else row["display_name"]
    
    # Fallback: extract name from session key (agent:dev:main -> dev)
    parts = session_key.split(":")
    if len(parts) >= 2:
        return parts[1].capitalize()
    return session_key


def _row_to_task(row: dict, display_name: Optional[str] = None) -> TaskResponse:
    """Convert database row to TaskResponse."""
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


# ========================================
# TASKS CRUD
# ========================================

@router.get("", response_model=TaskListResponse)
async def list_tasks(
    project_id: Optional[str] = Query(None, description="Filter by project"),
    room_id: Optional[str] = Query(None, description="Filter by room"),
    status: Optional[str] = Query(None, description="Filter by status (comma-separated)"),
    assigned_session_key: Optional[str] = Query(None, description="Filter by assignee"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Get all tasks with optional filters."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            
            # Build query with filters
            query = "SELECT * FROM tasks WHERE 1=1"
            params = []
            
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
            
            # Get total count
            count_query = query.replace("SELECT *", "SELECT COUNT(*) as cnt")
            async with db.execute(count_query, params) as cursor:
                result = await cursor.fetchone()
                total = result["cnt"] if isinstance(result, dict) else result[0]
            
            # Add ordering and pagination
            query += " ORDER BY CASE status WHEN 'blocked' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'todo' THEN 3 WHEN 'review' THEN 4 ELSE 5 END, updated_at DESC"
            query += " LIMIT ? OFFSET ?"
            params.extend([limit, offset])
            
            async with db.execute(query, params) as cursor:
                rows = await cursor.fetchall()
            
            # Get display names for assigned session keys
            tasks = []
            for row in rows:
                display_name = await _get_display_name(db, row["assigned_session_key"])
                tasks.append(_row_to_task(row, display_name))
            
            return TaskListResponse(tasks=tasks, total=total)
        finally:
            await db.close()
    except Exception as e:
        logger.error(f"Failed to list tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    """Get a specific task by ID."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            
            async with db.execute(
                "SELECT * FROM tasks WHERE id = ?", (task_id,)
            ) as cursor:
                row = await cursor.fetchone()
            
            if not row:
                raise HTTPException(status_code=404, detail="Task not found")
            
            display_name = await _get_display_name(db, row["assigned_session_key"])
            return _row_to_task(row, display_name)
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=TaskResponse)
async def create_task(task: TaskCreate):
    """Create a new task."""
    try:
        db = await get_db()
        try:
            # Verify project exists
            async with db.execute(
                "SELECT id FROM projects WHERE id = ?", (task.project_id,)
            ) as cursor:
                if not await cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Project not found")
            
            # Verify room exists if provided
            if task.room_id:
                async with db.execute(
                    "SELECT id FROM rooms WHERE id = ?", (task.room_id,)
                ) as cursor:
                    if not await cursor.fetchone():
                        raise HTTPException(status_code=404, detail="Room not found")
            
            now = int(time.time() * 1000)
            task_id = generate_id()
            
            await db.execute(
                """INSERT INTO tasks (id, project_id, room_id, title, description, status, priority, assigned_session_key, created_by, created_at, updated_at)
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
                    None,  # created_by - can be set later
                    now,
                    now,
                )
            )
            
            # Add history event
            await _add_history_event(
                db,
                task.project_id,
                "task_created",
                task_id,
                task.assigned_session_key,
                {"title": task.title, "status": task.status, "priority": task.priority}
            )
            
            await db.commit()
            
            # Broadcast SSE event
            await broadcast("task-created", {
                "task_id": task_id,
                "project_id": task.project_id,
                "room_id": task.room_id,
            })
            
            display_name = await _get_display_name(db, task.assigned_session_key)
            
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
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task: TaskUpdate):
    """Update a task."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            
            # Get existing task
            async with db.execute(
                "SELECT * FROM tasks WHERE id = ?", (task_id,)
            ) as cursor:
                existing = await cursor.fetchone()
            
            if not existing:
                raise HTTPException(status_code=404, detail="Task not found")
            
            # Build update query
            update_data = task.model_dump(exclude_unset=True)
            if not update_data:
                # Nothing to update, return existing
                display_name = await _get_display_name(db, existing["assigned_session_key"])
                return _row_to_task(existing, display_name)
            
            updates = []
            values = []
            changes = {}
            
            for field, value in update_data.items():
                updates.append(f"{field} = ?")
                values.append(value)
                # Track changes for history
                if existing.get(field) != value:
                    changes[field] = {"old": existing.get(field), "new": value}
            
            now = int(time.time() * 1000)
            updates.append("updated_at = ?")
            values.append(now)
            values.append(task_id)
            
            await db.execute(
                f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?",
                values
            )
            
            # Add history event
            if changes:
                event_type = "task_updated"
                if "status" in changes:
                    event_type = "task_status_changed"
                elif "assigned_session_key" in changes:
                    event_type = "task_assigned"
                
                await _add_history_event(
                    db,
                    existing["project_id"],
                    event_type,
                    task_id,
                    task.assigned_session_key or existing["assigned_session_key"],
                    changes
                )
            
            await db.commit()
            
            # Get updated task
            async with db.execute(
                "SELECT * FROM tasks WHERE id = ?", (task_id,)
            ) as cursor:
                row = await cursor.fetchone()
            
            # Broadcast SSE event
            await broadcast("task-updated", {
                "task_id": task_id,
                "project_id": row["project_id"],
                "room_id": row["room_id"],
                "changes": changes,
            })
            
            display_name = await _get_display_name(db, row["assigned_session_key"])
            return _row_to_task(row, display_name)
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{task_id}")
async def delete_task(task_id: str):
    """Delete a task."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            
            # Get task for history
            async with db.execute(
                "SELECT * FROM tasks WHERE id = ?", (task_id,)
            ) as cursor:
                existing = await cursor.fetchone()
            
            if not existing:
                raise HTTPException(status_code=404, detail="Task not found")
            
            # Add history event before deletion
            await _add_history_event(
                db,
                existing["project_id"],
                "task_deleted",
                task_id,
                None,
                {"title": existing["title"]}
            )
            
            # Delete task
            await db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
            await db.commit()
            
            # Broadcast SSE event
            await broadcast("task-deleted", {
                "task_id": task_id,
                "project_id": existing["project_id"],
                "room_id": existing["room_id"],
            })
            
            return {"success": True, "deleted": task_id}
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========================================
# ROOM & PROJECT TASKS
# ========================================

@router.get("/rooms/{room_id}/tasks", response_model=TaskListResponse)
async def get_room_tasks(
    room_id: str,
    status: Optional[str] = Query(None, description="Filter by status (comma-separated)"),
    limit: int = Query(100, ge=1, le=500),
):
    """Get all tasks for a specific room."""
    return await list_tasks(room_id=room_id, status=status, limit=limit)


@router.get("/projects/{project_id}/tasks", response_model=TaskListResponse)
async def get_project_tasks(
    project_id: str,
    status: Optional[str] = Query(None, description="Filter by status (comma-separated)"),
    limit: int = Query(100, ge=1, le=500),
):
    """Get all tasks for a specific project."""
    return await list_tasks(project_id=project_id, status=status, limit=limit)
