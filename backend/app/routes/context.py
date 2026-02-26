"""Session Context API routes for bot context injection."""

import json
import logging
from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.db.database import get_db
from app.services.context_envelope import build_crewhub_context, format_context_block

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Response Models ─────────────────────────────────────────────


class RoomContext(BaseModel):
    id: str
    name: str
    is_hq: bool
    project_id: Optional[str] = None


class ProjectContext(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    folder_path: Optional[str] = None
    status: str


class TaskSummary(BaseModel):
    id: str
    title: str
    status: str
    priority: str
    assigned_session_key: Optional[str] = None


class TasksContext(BaseModel):
    assigned_to_me: list[TaskSummary]
    in_progress: list[TaskSummary]
    blocked: list[TaskSummary]
    todo_count: int
    done_count: int


class HistoryEvent(BaseModel):
    event_type: str
    payload: Optional[dict] = None
    created_at: int


class SessionContextResponse(BaseModel):
    room: Optional[RoomContext] = None
    project: Optional[ProjectContext] = None
    tasks: Optional[TasksContext] = None
    recent_history: list[HistoryEvent] = []


# ── Helpers ─────────────────────────────────────────────────────


async def _resolve_session_room_id(db, session_key: str) -> Optional[str]:
    """Resolve a room_id for a session key via assignment table or agent default."""
    async with db.execute(
        "SELECT room_id FROM session_room_assignments WHERE session_key = ?", (session_key,)
    ) as cursor:
        row = await cursor.fetchone()
        if row:
            return row["room_id"]

    async with db.execute("SELECT default_room_id FROM agents WHERE agent_session_key = ?", (session_key,)) as cursor:
        row = await cursor.fetchone()
        if row and row.get("default_room_id"):
            return row["default_room_id"]

    return None


def _row_to_task_summary(row) -> TaskSummary:
    return TaskSummary(
        id=row["id"],
        title=row["title"],
        status=row["status"],
        priority=row["priority"],
        assigned_session_key=row.get("assigned_session_key"),
    )


async def _fetch_project_context(db, project_id: str, session_key: str) -> tuple:
    """Fetch project details, tasks, and recent history for a project."""
    async with db.execute(
        "SELECT id, name, description, folder_path, status FROM projects WHERE id = ?", (project_id,)
    ) as cursor:
        proj_row = await cursor.fetchone()

    project = None
    if proj_row:
        project = ProjectContext(
            id=proj_row["id"],
            name=proj_row["name"],
            description=proj_row.get("description"),
            folder_path=proj_row.get("folder_path"),
            status=proj_row.get("status", "active"),
        )

    async with db.execute(
        """SELECT id, title, status, priority, assigned_session_key FROM tasks
           WHERE project_id = ? AND assigned_session_key = ?
           ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
           LIMIT 10""",
        (project_id, session_key),
    ) as cursor:
        assigned_rows = await cursor.fetchall()

    async with db.execute(
        """SELECT id, title, status, priority, assigned_session_key FROM tasks
           WHERE project_id = ? AND status = 'in_progress' ORDER BY updated_at DESC LIMIT 10""",
        (project_id,),
    ) as cursor:
        in_progress_rows = await cursor.fetchall()

    async with db.execute(
        """SELECT id, title, status, priority, assigned_session_key FROM tasks
           WHERE project_id = ? AND status = 'blocked' ORDER BY updated_at DESC LIMIT 5""",
        (project_id,),
    ) as cursor:
        blocked_rows = await cursor.fetchall()

    async with db.execute(
        "SELECT COUNT(*) as cnt FROM tasks WHERE project_id = ? AND status = 'todo'", (project_id,)
    ) as cursor:
        todo_count = (await cursor.fetchone())["cnt"]

    async with db.execute(
        "SELECT COUNT(*) as cnt FROM tasks WHERE project_id = ? AND status = 'done'", (project_id,)
    ) as cursor:
        done_count = (await cursor.fetchone())["cnt"]

    tasks = TasksContext(
        assigned_to_me=[_row_to_task_summary(r) for r in assigned_rows],
        in_progress=[_row_to_task_summary(r) for r in in_progress_rows],
        blocked=[_row_to_task_summary(r) for r in blocked_rows],
        todo_count=todo_count,
        done_count=done_count,
    )

    async with db.execute(
        """SELECT event_type, payload_json, created_at FROM project_history
           WHERE project_id = ? ORDER BY created_at DESC LIMIT 10""",
        (project_id,),
    ) as cursor:
        history_rows = await cursor.fetchall()

    recent_history = []
    for h in history_rows:
        payload = None
        if h.get("payload_json"):
            try:
                payload = json.loads(h["payload_json"])
            except json.JSONDecodeError:
                pass
        recent_history.append(HistoryEvent(event_type=h["event_type"], payload=payload, created_at=h["created_at"]))

    return project, tasks, recent_history


# ── Routes ──────────────────────────────────────────────────────


async def _fetch_room_context(db, room_id: str) -> Optional[RoomContext]:
    """Fetch room context by id."""
    async with db.execute("SELECT id, name, is_hq, project_id FROM rooms WHERE id = ?", (room_id,)) as cursor:
        room_row = await cursor.fetchone()
    if not room_row:
        return None
    return RoomContext(
        id=room_row["id"],
        name=room_row["name"],
        is_hq=bool(room_row["is_hq"]),
        project_id=room_row.get("project_id"),
    )


async def _build_session_context(db, session_key: str) -> SessionContextResponse:
    """Build full session context response from DB."""
    room_id = await _resolve_session_room_id(db, session_key)
    if not room_id:
        return SessionContextResponse()

    room = await _fetch_room_context(db, room_id)
    if not room:
        return SessionContextResponse()

    if not room.project_id:
        return SessionContextResponse(room=room)

    project, tasks, recent_history = await _fetch_project_context(db, room.project_id, session_key)
    return SessionContextResponse(room=room, project=project, tasks=tasks, recent_history=recent_history)


@router.get(
    "/{session_key}/context",
    response_model=SessionContextResponse,
    responses={500: {"description": "Internal server error"}},
)
async def get_session_context(session_key: str):
    """
    Get full context for a bot session.

    Returns room, project, tasks, and recent history based on the session's
    room assignment. This endpoint is designed for context injection into
    bot system prompts.

    Usage by OpenClaw:
    ```
    context = await fetch_session_context(session_key)
    if context.project:
        system_prompt += f"Project: {context.project.name}\\n{context.project.description}"
        system_prompt += f"\\nAssigned tasks: {len(context.tasks.assigned_to_me)}"
    ```
    """
    try:
        async with get_db() as db:
            return await _build_session_context(db, session_key)
    except Exception as e:
        logger.error(f"Failed to get session context for {session_key}: {e}")  # NOSONAR
        raise HTTPException(status_code=500, detail=str(e))


def _append_task_prompt(lines: list[str], tasks) -> None:
    if not tasks:
        return
    lines.extend(["", "## Tasks"])
    if tasks.assigned_to_me:
        lines.append(f"**Assigned to you ({len(tasks.assigned_to_me)}):**")
        lines.extend([f"- [{t.priority.upper()}] {t.title} ({t.status})" for t in tasks.assigned_to_me[:5]])
    if tasks.blocked:
        lines.append(f"**Blocked ({len(tasks.blocked)}):**")
        lines.extend([f"- {t.title}" for t in tasks.blocked[:3]])
    lines.append(f"- Todo: {tasks.todo_count}, Done: {tasks.done_count}")


@router.get("/{session_key}/context/prompt", response_model=dict)
async def get_session_context_prompt(session_key: str):
    """Get a formatted system prompt snippet for context injection."""
    context = await get_session_context(session_key)
    if not context.room:
        return {"prompt": ""}

    lines = ["## Current Assignment", f"- Room: {context.room.name}" + (" (HQ)" if context.room.is_hq else "")]
    if context.project:
        lines.append(f"- Project: {context.project.name}")
        if context.project.description:
            lines.append(f"- Description: {context.project.description}")
        if context.project.folder_path:
            lines.append(f"- Folder: {context.project.folder_path}")
    _append_task_prompt(lines, context.tasks)
    return {"prompt": "\n".join(lines)}


# ── Context Envelope (v2) ──────────────────────────────────────


@router.get(
    "/{session_key}/context/envelope", response_model=dict, responses={500: {"description": "Internal server error"}}
)
async def get_context_envelope(
    session_key: str,
    channel: Annotated[Optional[str], Query(None, description="Origin channel (whatsapp, slack, crewhub-ui, ...)")],
    spawned_from: Annotated[Optional[str], Query(None, description="Parent session key")],
):
    """
    Get a CrewHub context envelope for a session.

    Returns a compact JSON envelope (≤2KB) suitable for injection into
    agent system prompts. Respects privacy tiers: external channels
    (whatsapp, slack, discord) strip participants and tasks.

    The response includes:
    - envelope: the raw JSON object
    - block: a fenced code block ready for preamble injection
    """
    try:
        async with get_db() as db:
            room_id = await _resolve_session_room_id(db, session_key)
            if not room_id:
                return {"envelope": None, "block": ""}

        envelope = await build_crewhub_context(
            room_id=room_id,
            channel=channel,
            session_key=session_key,
        )

        if not envelope:
            return {"envelope": None, "block": ""}

        return {
            "envelope": envelope,
            "block": format_context_block(envelope),
        }

    except Exception as e:
        logger.error(f"Failed to get context envelope for {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rooms/{room_id}/context-envelope", response_model=dict, responses={404: {"description": "Not found"}})
async def get_room_context_envelope(
    room_id: str,
    channel: Annotated[Optional[str], Query(None)],
    session_key: Annotated[Optional[str], Query(None)],
):
    """Get context envelope directly by room_id (for spawn flows)."""
    envelope = await build_crewhub_context(
        room_id=room_id,
        channel=channel,
        session_key=session_key,
    )

    if not envelope:
        raise HTTPException(status_code=404, detail="Room not found")

    return {
        "envelope": envelope,
        "block": format_context_block(envelope),
    }
