"""REST API routes for AI-orchestrated meetings."""

import logging
import time
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Query

from app.db.database import get_db
from app.db.meeting_models import (
    ActionItemExecuteRequest,
    ActionItemToPlannerRequest,
    MeetingConfig,
    MeetingState,
    SaveActionItemsRequest,
    StartMeetingRequest,
)
from app.routes.sse import broadcast
from app.services.meeting_orchestrator import (
    cancel_meeting,
    get_meeting,
    list_meetings,
    start_meeting,
)

MSG_MEETING_NOT_FOUND = "Meeting not found"

logger = logging.getLogger(__name__)
router = APIRouter()


def _now_ms() -> int:
    return int(time.time() * 1000)


@router.post(
    "/start", status_code=201, responses={400: {"description": "Bad request"}, 409: {"description": "Conflict"}}
)
async def api_start_meeting(req: StartMeetingRequest):
    """Start a new AI-orchestrated meeting."""
    # Validate
    if len(req.participants) < 2:
        raise HTTPException(400, "At least 2 participants required")
    if len(req.participants) > 8:
        raise HTTPException(400, "Maximum 8 participants allowed")
    if len(req.participants) != len(set(req.participants)):
        raise HTTPException(400, "Duplicate participants are not allowed")

    # Build round topics
    default_topics = [
        "What have you been working on?",
        "What will you focus on next?",
        "Any blockers, risks, or things you need help with?",
    ]
    round_topics = req.round_topics
    if round_topics is None:
        round_topics = default_topics[: req.num_rounds]
        # Pad if num_rounds > 3
        while len(round_topics) < req.num_rounds:
            round_topics.append(f"Round {len(round_topics) + 1}")
    elif len(round_topics) != req.num_rounds:
        raise HTTPException(400, f"round_topics length ({len(round_topics)}) must match num_rounds ({req.num_rounds})")

    config = MeetingConfig(
        participants=req.participants,
        num_rounds=req.num_rounds,
        round_topics=round_topics,
        max_tokens_per_turn=req.max_tokens_per_turn,
        document_path=req.document_path,
        document_context=req.document_context,
    )

    try:
        meeting = await start_meeting(
            config=config,
            title=req.title,
            goal=req.goal,
            room_id=req.room_id,
            project_id=req.project_id,
            parent_meeting_id=req.parent_meeting_id,
        )
    except ValueError as e:
        raise HTTPException(409, str(e))

    return {
        "id": meeting.id,
        "title": meeting.title,
        "state": meeting.state.value,
        "participants": [{"agent_id": p, "sort_order": i} for i, p in enumerate(config.participants)],
        "config": {
            "num_rounds": config.num_rounds,
            "round_topics": config.round_topics,
            "max_tokens_per_turn": config.max_tokens_per_turn,
        },
        "created_at": meeting.created_at,
    }


@router.get("/{meeting_id}/status", responses={404: {"description": "Not found"}})
async def api_meeting_status(meeting_id: str):
    """Get current state and progress of a meeting."""
    meeting = await get_meeting(meeting_id)
    if not meeting:
        raise HTTPException(404, MSG_MEETING_NOT_FOUND)

    return {
        "id": meeting["id"],
        "title": meeting["title"],
        "state": meeting["state"],
        "goal": meeting.get("goal", ""),
        "room_id": meeting.get("room_id"),
        "project_id": meeting.get("project_id"),
        "current_round": meeting.get("current_round", 0),
        "current_turn": meeting.get("current_turn", 0),
        "total_rounds": meeting.get("total_rounds", 0),
        "total_participants": meeting.get("total_participants", 0),
        "progress_pct": meeting.get("progress_pct", 0),
        "participants": meeting.get("participants", []),
        "rounds": meeting.get("rounds", []),
        "output_md": meeting.get("output_md"),
        "output_path": meeting.get("output_path"),
        "started_at": meeting.get("started_at"),
        "completed_at": meeting.get("completed_at"),
    }


@router.post(
    "/{meeting_id}/cancel",
    responses={
        404: {"description": "Not found"},
        409: {"description": "Conflict"},
        500: {"description": "Internal server error"},
    },
)
async def api_cancel_meeting(meeting_id: str):
    """Cancel a running meeting."""
    meeting = await get_meeting(meeting_id)
    if not meeting:
        raise HTTPException(404, MSG_MEETING_NOT_FOUND)

    if meeting["state"] in (MeetingState.COMPLETE.value, MeetingState.CANCELLED.value):
        raise HTTPException(409, f"Meeting already {meeting['state']}")

    success = await cancel_meeting(meeting_id)
    if not success:
        raise HTTPException(500, "Failed to cancel meeting")

    # Re-fetch to get fresh cancelled_at
    fresh = await get_meeting(meeting_id)
    return {
        "id": meeting_id,
        "state": "cancelled",
        "cancelled_at": fresh.get("cancelled_at") if fresh else None,
    }


@router.get("/history")
async def api_meeting_history(
    room_id: Optional[str] = None,
    project_id: Optional[str] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    days: Annotated[int, Query(ge=1, le=3650)] = 365,
):
    """Get meeting history with pagination and filtering (F5)."""
    result = await list_meetings(
        days=days,
        room_id=room_id,
        project_id=project_id,
        limit=limit,
        offset=offset,
    )
    return result


@router.get("")
async def api_list_meetings(
    days: Annotated[int, Query(ge=1, le=365)] = 30,
    room_id: Optional[str] = None,
    project_id: Optional[str] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    state: Optional[str] = None,
):
    """List recent meetings with pagination."""
    result = await list_meetings(
        days=days,
        room_id=room_id,
        project_id=project_id,
        limit=limit,
        offset=offset,
        state_filter=state,
    )
    return result


@router.get("/{meeting_id}/output", responses={404: {"description": "Not found"}, 409: {"description": "Conflict"}})
async def api_meeting_output(meeting_id: str):
    """Get the final meeting output (markdown)."""
    meeting = await get_meeting(meeting_id)
    if not meeting:
        raise HTTPException(404, MSG_MEETING_NOT_FOUND)

    if meeting["state"] != MeetingState.COMPLETE.value:
        raise HTTPException(409, f"Meeting not yet complete (state: {meeting['state']})")

    return {
        "id": meeting_id,
        "output_md": meeting.get("output_md"),
        "output_path": meeting.get("output_path"),
    }


# =========================================================================
# F1: Action Items
# =========================================================================


@router.get("/{meeting_id}/action-items")
async def api_get_action_items(meeting_id: str):
    """Get action items for a meeting."""
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM meeting_action_items WHERE meeting_id = ? ORDER BY sort_order",
            (meeting_id,),
        ) as cur:
            rows = await cur.fetchall()
            return {"items": [dict(r) for r in rows]}


@router.post("/{meeting_id}/action-items", responses={404: {"description": "Not found"}})
async def api_save_action_items(meeting_id: str, req: SaveActionItemsRequest):
    """Save parsed action items for a meeting."""
    meeting = await get_meeting(meeting_id)
    if not meeting:
        raise HTTPException(404, MSG_MEETING_NOT_FOUND)

    now = _now_ms()
    async with get_db() as db:
        # Delete existing items for this meeting (idempotent save)
        await db.execute("DELETE FROM meeting_action_items WHERE meeting_id = ?", (meeting_id,))

        for i, item in enumerate(req.items):
            item_id = item.id or f"ai_{uuid.uuid4().hex[:8]}"
            await db.execute(
                """INSERT INTO meeting_action_items
                   (id, meeting_id, text, assignee_agent_id, priority, status, sort_order, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    item_id,
                    meeting_id,
                    item.text,
                    item.assignee_agent_id,
                    item.priority,
                    item.status or "pending",
                    i,
                    now,
                    now,
                ),
            )
        await db.commit()

    return {"created": len(req.items)}


@router.post(
    "/{meeting_id}/action-items/{item_id}/to-planner",
    responses={400: {"description": "Bad request"}, 404: {"description": "Not found"}},
)
async def api_action_item_to_planner(meeting_id: str, item_id: str, req: ActionItemToPlannerRequest):
    """Push an action item to the project task board (or fallback to Ekinbot Planner)."""
    # Verify item exists and get meeting data
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM meeting_action_items WHERE id = ? AND meeting_id = ?",
            (item_id, meeting_id),
        ) as cur:
            item = await cur.fetchone()
            if not item:
                raise HTTPException(404, "Action item not found")

    # Resolve project_id and room_id: prefer request, then meeting data
    project_id = req.project_id
    room_id = None
    meeting = await get_meeting(meeting_id)
    if meeting:
        room_id = meeting.get("room_id")
        if not project_id:
            project_id = meeting.get("project_id")

    if not project_id:
        raise HTTPException(400, "Meeting is not associated with a project. Cannot add to task board.")

    # Resolve assignee to session_key if it looks like an agent name
    assigned_session_key = None
    if req.assignee:
        async with get_db() as db:
            async with db.execute(
                "SELECT agent_session_key FROM agents WHERE id = ? OR agent_session_key = ? OR name = ?",
                (req.assignee, req.assignee, req.assignee),
            ) as cur:
                row = await cur.fetchone()
                if row:
                    assigned_session_key = row["agent_session_key"]

    # Create task in the project via internal task creation
    from app.db.models import generate_id

    task_id = generate_id()
    now = _now_ms()

    async with get_db() as db:
        await db.execute(
            """INSERT INTO tasks (id, project_id, room_id, title, description, status, priority, assigned_session_key, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                task_id,
                project_id,
                room_id,
                req.title,
                f"From meeting: {meeting_id}",
                "todo",
                req.priority or "medium",
                assigned_session_key,
                now,
                now,
            ),
        )
        await db.commit()

    # Update action item status
    async with get_db() as db:
        await db.execute(
            "UPDATE meeting_action_items SET status = 'planned', planner_task_id = ?, updated_at = ? WHERE id = ?",
            (task_id, now, item_id),
        )
        await db.commit()

    # SSE notifications
    await broadcast(
        "task-created",
        {
            "task_id": task_id,
            "project_id": project_id,
            "room_id": room_id,
        },
    )
    await broadcast(
        "action-item-status",
        {
            "meeting_id": meeting_id,
            "item_id": item_id,
            "status": "planned",
            "planner_task_id": task_id,
        },
    )

    return {
        "item_id": item_id,
        "status": "planned",
        "task_id": task_id,
        "project_id": project_id,
    }


@router.post(
    "/{meeting_id}/action-items/{item_id}/execute",
    responses={
        400: {"description": "Bad request"},
        404: {"description": "Not found"},
        502: {"description": "HTTP 502"},
    },
)
async def api_action_item_execute(meeting_id: str, item_id: str, req: ActionItemExecuteRequest):
    """Spawn an agent to execute an action item."""
    # Verify item exists
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM meeting_action_items WHERE id = ? AND meeting_id = ?",
            (item_id, meeting_id),
        ) as cur:
            item = await cur.fetchone()
            if not item:
                raise HTTPException(404, "Action item not found")

    agent_id = req.agent_id or dict(item).get("assignee_agent_id")
    if not agent_id:
        raise HTTPException(400, "No agent specified for execution")

    # Resolve agent session key
    async with get_db() as db:
        async with db.execute(
            "SELECT agent_session_key FROM agents WHERE id = ? OR agent_session_key = ?",
            (agent_id, agent_id),
        ) as cur:
            row = await cur.fetchone()
            session_key = row["agent_session_key"] if row else agent_id

    # Mark as executing before spawning
    now = _now_ms()
    async with get_db() as db:
        await db.execute(
            "UPDATE meeting_action_items SET status = 'executing', execution_session_id = ?, updated_at = ? WHERE id = ?",
            (session_key, now, item_id),
        )
        await db.commit()

    await broadcast(
        "action-item-status",
        {
            "meeting_id": meeting_id,
            "item_id": item_id,
            "status": "executing",
            "session_id": session_key,
        },
    )

    # Spawn agent execution via Gateway
    from app.services.connections import get_connection_manager

    try:
        manager = await get_connection_manager()
        action_text = dict(item)["text"]
        prompt = f"Execute this action item from a meeting: {action_text}\n\nBe concise and take action."
        response = await manager.send_message(
            session_key=session_key,
            message=prompt,
            timeout=60.0,
        )
    except Exception as e:
        logger.error(f"Failed to spawn agent execution: {e}")
        # Mark as failed
        async with get_db() as db:
            await db.execute(
                "UPDATE meeting_action_items SET status = 'failed', updated_at = ? WHERE id = ?",
                (_now_ms(), item_id),
            )
            await db.commit()
        await broadcast(
            "action-item-status",
            {
                "meeting_id": meeting_id,
                "item_id": item_id,
                "status": "failed",
                "error": str(e),
            },
        )
        raise HTTPException(502, f"Failed to spawn agent: {str(e)}")

    # Update status based on response
    final_status = "done" if response else "failed"
    async with get_db() as db:
        await db.execute(
            "UPDATE meeting_action_items SET status = ?, updated_at = ? WHERE id = ?",
            (final_status, _now_ms(), item_id),
        )
        await db.commit()

    await broadcast(
        "action-item-status",
        {
            "meeting_id": meeting_id,
            "item_id": item_id,
            "status": final_status,
            "session_id": session_key,
        },
    )

    return {
        "item_id": item_id,
        "status": final_status,
        "session_id": session_key,
        "response": response[:500] if response else None,
    }


# End of meeting routes
