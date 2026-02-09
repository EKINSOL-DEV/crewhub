"""Session Context API routes for bot context injection."""
import json
import logging
from typing import Optional
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


# ── Routes ──────────────────────────────────────────────────────

@router.get("/{session_key}/context", response_model=SessionContextResponse)
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
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            
            # 1. Find room assignment for this session
            room_id = None
            
            # Check explicit assignment
            async with db.execute(
                "SELECT room_id FROM session_room_assignments WHERE session_key = ?",
                (session_key,)
            ) as cursor:
                row = await cursor.fetchone()
                if row:
                    room_id = row["room_id"]
            
            # If no explicit assignment, check agent default room
            if not room_id:
                async with db.execute(
                    "SELECT default_room_id FROM agents WHERE agent_session_key = ?",
                    (session_key,)
                ) as cursor:
                    row = await cursor.fetchone()
                    if row and row.get("default_room_id"):
                        room_id = row["default_room_id"]
            
            # If still no room, return empty context
            if not room_id:
                return SessionContextResponse()
            
            # 2. Get room details
            async with db.execute(
                "SELECT id, name, is_hq, project_id FROM rooms WHERE id = ?",
                (room_id,)
            ) as cursor:
                room_row = await cursor.fetchone()
            
            if not room_row:
                return SessionContextResponse()
            
            room = RoomContext(
                id=room_row["id"],
                name=room_row["name"],
                is_hq=bool(room_row["is_hq"]),
                project_id=room_row.get("project_id"),
            )
            
            project = None
            tasks = None
            recent_history = []
            
            # 3. Get project details (if assigned)
            if room_row.get("project_id"):
                project_id = room_row["project_id"]
                
                async with db.execute(
                    "SELECT id, name, description, folder_path, status FROM projects WHERE id = ?",
                    (project_id,)
                ) as cursor:
                    proj_row = await cursor.fetchone()
                
                if proj_row:
                    project = ProjectContext(
                        id=proj_row["id"],
                        name=proj_row["name"],
                        description=proj_row.get("description"),
                        folder_path=proj_row.get("folder_path"),
                        status=proj_row.get("status", "active"),
                    )
                
                # 4. Get tasks for this project
                # Tasks assigned to this session
                async with db.execute(
                    """SELECT id, title, status, priority, assigned_session_key 
                       FROM tasks 
                       WHERE project_id = ? AND assigned_session_key = ?
                       ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
                       LIMIT 10""",
                    (project_id, session_key)
                ) as cursor:
                    assigned_rows = await cursor.fetchall()
                
                # In-progress tasks
                async with db.execute(
                    """SELECT id, title, status, priority, assigned_session_key 
                       FROM tasks 
                       WHERE project_id = ? AND status = 'in_progress'
                       ORDER BY updated_at DESC
                       LIMIT 10""",
                    (project_id,)
                ) as cursor:
                    in_progress_rows = await cursor.fetchall()
                
                # Blocked tasks
                async with db.execute(
                    """SELECT id, title, status, priority, assigned_session_key 
                       FROM tasks 
                       WHERE project_id = ? AND status = 'blocked'
                       ORDER BY updated_at DESC
                       LIMIT 5""",
                    (project_id,)
                ) as cursor:
                    blocked_rows = await cursor.fetchall()
                
                # Counts
                async with db.execute(
                    "SELECT COUNT(*) as cnt FROM tasks WHERE project_id = ? AND status = 'todo'",
                    (project_id,)
                ) as cursor:
                    todo_count = (await cursor.fetchone())["cnt"]
                
                async with db.execute(
                    "SELECT COUNT(*) as cnt FROM tasks WHERE project_id = ? AND status = 'done'",
                    (project_id,)
                ) as cursor:
                    done_count = (await cursor.fetchone())["cnt"]
                
                def row_to_summary(row):
                    return TaskSummary(
                        id=row["id"],
                        title=row["title"],
                        status=row["status"],
                        priority=row["priority"],
                        assigned_session_key=row.get("assigned_session_key"),
                    )
                
                tasks = TasksContext(
                    assigned_to_me=[row_to_summary(r) for r in assigned_rows],
                    in_progress=[row_to_summary(r) for r in in_progress_rows],
                    blocked=[row_to_summary(r) for r in blocked_rows],
                    todo_count=todo_count,
                    done_count=done_count,
                )
                
                # 5. Get recent history (last 10 events)
                async with db.execute(
                    """SELECT event_type, payload_json, created_at 
                       FROM project_history 
                       WHERE project_id = ?
                       ORDER BY created_at DESC
                       LIMIT 10""",
                    (project_id,)
                ) as cursor:
                    history_rows = await cursor.fetchall()
                
                for h in history_rows:
                    payload = None
                    if h.get("payload_json"):
                        try:
                            payload = json.loads(h["payload_json"])
                        except json.JSONDecodeError:
                            pass
                    recent_history.append(HistoryEvent(
                        event_type=h["event_type"],
                        payload=payload,
                        created_at=h["created_at"],
                    ))
            
            return SessionContextResponse(
                room=room,
                project=project,
                tasks=tasks,
                recent_history=recent_history,
            )
        finally:
            await db.close()
    except Exception as e:
        logger.error(f"Failed to get session context for {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_key}/context/prompt", response_model=dict)
async def get_session_context_prompt(session_key: str):
    """
    Get a formatted system prompt snippet for context injection.
    
    Returns a ready-to-use text block that can be appended to bot system prompts.
    """
    context = await get_session_context(session_key)
    
    if not context.room:
        return {"prompt": ""}
    
    lines = []
    lines.append(f"## Current Assignment")
    lines.append(f"- Room: {context.room.name}" + (" (HQ)" if context.room.is_hq else ""))
    
    if context.project:
        lines.append(f"- Project: {context.project.name}")
        if context.project.description:
            lines.append(f"- Description: {context.project.description}")
        if context.project.folder_path:
            lines.append(f"- Folder: {context.project.folder_path}")
    
    if context.tasks:
        lines.append("")
        lines.append("## Tasks")
        
        if context.tasks.assigned_to_me:
            lines.append(f"**Assigned to you ({len(context.tasks.assigned_to_me)}):**")
            for t in context.tasks.assigned_to_me[:5]:
                lines.append(f"- [{t.priority.upper()}] {t.title} ({t.status})")
        
        if context.tasks.blocked:
            lines.append(f"**Blocked ({len(context.tasks.blocked)}):**")
            for t in context.tasks.blocked[:3]:
                lines.append(f"- {t.title}")
        
        lines.append(f"- Todo: {context.tasks.todo_count}, Done: {context.tasks.done_count}")
    
    return {"prompt": "\n".join(lines)}


# ── Context Envelope (v2) ──────────────────────────────────────

@router.get("/{session_key}/context/envelope", response_model=dict)
async def get_context_envelope(
    session_key: str,
    channel: Optional[str] = Query(None, description="Origin channel (whatsapp, slack, crewhub-ui, ...)"),
    spawned_from: Optional[str] = Query(None, description="Parent session key"),
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
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )

            # Resolve room_id from session key
            room_id = None

            # Check explicit assignment
            async with db.execute(
                "SELECT room_id FROM session_room_assignments WHERE session_key = ?",
                (session_key,),
            ) as cursor:
                row = await cursor.fetchone()
                if row:
                    room_id = row["room_id"]

            # Fallback: agent default room
            if not room_id:
                async with db.execute(
                    "SELECT default_room_id FROM agents WHERE agent_session_key = ?",
                    (session_key,),
                ) as cursor:
                    row = await cursor.fetchone()
                    if row and row.get("default_room_id"):
                        room_id = row["default_room_id"]

            if not room_id:
                return {"envelope": None, "block": ""}
        finally:
            await db.close()

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


@router.get("/rooms/{room_id}/context-envelope", response_model=dict)
async def get_room_context_envelope(
    room_id: str,
    channel: Optional[str] = Query(None),
    session_key: Optional[str] = Query(None),
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
