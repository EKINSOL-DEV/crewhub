"""REST API routes for AI-orchestrated meetings."""

import time
import uuid
import logging
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

import aiohttp
import aiosqlite

from app.db.database import DB_PATH
from app.db.meeting_models import (
    MeetingConfig,
    MeetingState,
    StartMeetingRequest,
    SaveActionItemsRequest,
    ActionItemToPlannerRequest,
    ActionItemExecuteRequest,
)
from app.services.meeting_orchestrator import (
    start_meeting,
    cancel_meeting,
    get_meeting,
    list_meetings,
)
from app.routes.sse import broadcast

logger = logging.getLogger(__name__)
router = APIRouter()

def _now_ms() -> int:
    return int(time.time() * 1000)


@router.post("/start", status_code=201)
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
        round_topics = default_topics[:req.num_rounds]
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
        "participants": [
            {"agent_id": p, "sort_order": i}
            for i, p in enumerate(config.participants)
        ],
        "config": {
            "num_rounds": config.num_rounds,
            "round_topics": config.round_topics,
            "max_tokens_per_turn": config.max_tokens_per_turn,
        },
        "created_at": meeting.created_at,
    }


@router.get("/{meeting_id}/status")
async def api_meeting_status(meeting_id: str):
    """Get current state and progress of a meeting."""
    meeting = await get_meeting(meeting_id)
    if not meeting:
        raise HTTPException(404, "Meeting not found")

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


@router.post("/{meeting_id}/cancel")
async def api_cancel_meeting(meeting_id: str):
    """Cancel a running meeting."""
    meeting = await get_meeting(meeting_id)
    if not meeting:
        raise HTTPException(404, "Meeting not found")

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
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    days: int = Query(365, ge=1, le=3650),
):
    """Get meeting history with pagination and filtering (F5)."""
    result = await list_meetings(
        days=days, room_id=room_id, project_id=project_id,
        limit=limit, offset=offset,
    )
    return result


@router.get("")
async def api_list_meetings(
    days: int = Query(30, ge=1, le=365),
    room_id: Optional[str] = None,
    project_id: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    state: Optional[str] = None,
):
    """List recent meetings with pagination."""
    result = await list_meetings(
        days=days, room_id=room_id, project_id=project_id,
        limit=limit, offset=offset, state_filter=state,
    )
    return result


@router.get("/{meeting_id}/output")
async def api_meeting_output(meeting_id: str):
    """Get the final meeting output (markdown)."""
    meeting = await get_meeting(meeting_id)
    if not meeting:
        raise HTTPException(404, "Meeting not found")

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
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM meeting_action_items WHERE meeting_id = ? ORDER BY sort_order",
            (meeting_id,),
        ) as cur:
            rows = await cur.fetchall()
            return {"items": [dict(r) for r in rows]}


@router.post("/{meeting_id}/action-items")
async def api_save_action_items(meeting_id: str, req: SaveActionItemsRequest):
    """Save parsed action items for a meeting."""
    meeting = await get_meeting(meeting_id)
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    now = _now_ms()
    async with aiosqlite.connect(DB_PATH) as db:
        # Delete existing items for this meeting (idempotent save)
        await db.execute("DELETE FROM meeting_action_items WHERE meeting_id = ?", (meeting_id,))

        for i, item in enumerate(req.items):
            item_id = item.id or f"ai_{uuid.uuid4().hex[:8]}"
            await db.execute(
                """INSERT INTO meeting_action_items
                   (id, meeting_id, text, assignee_agent_id, priority, status, sort_order, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (item_id, meeting_id, item.text, item.assignee_agent_id,
                 item.priority, item.status or "pending", i, now, now),
            )
        await db.commit()

    return {"created": len(req.items)}


@router.post("/{meeting_id}/action-items/{item_id}/to-planner")
async def api_action_item_to_planner(meeting_id: str, item_id: str, req: ActionItemToPlannerRequest):
    """Push an action item to Ekinbot Planner as a task."""
    # Verify item exists
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM meeting_action_items WHERE id = ? AND meeting_id = ?",
            (item_id, meeting_id),
        ) as cur:
            item = await cur.fetchone()
            if not item:
                raise HTTPException(404, "Action item not found")

    # Create task in Ekinbot Planner
    try:
        async with aiohttp.ClientSession() as session:
            resp = await session.post(
                "http://localhost:8080/api/tasks",
                json={
                    "title": req.title,
                    "assignee": req.assignee or "",
                    "source": f"meeting:{meeting_id}",
                    "priority": req.priority or "medium",
                },
                timeout=aiohttp.ClientTimeout(total=10),
            )
            if resp.status >= 400:
                error_text = await resp.text()
                raise HTTPException(502, f"Planner API error: {error_text}")
            planner_data = await resp.json()
    except aiohttp.ClientError as e:
        raise HTTPException(502, f"Could not reach Planner API: {str(e)}")

    # Update action item status
    now = _now_ms()
    task_id = planner_data.get("id", planner_data.get("task_id", ""))
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE meeting_action_items SET status = 'planned', planner_task_id = ?, updated_at = ? WHERE id = ?",
            (task_id, now, item_id),
        )
        await db.commit()

    # SSE notification
    await broadcast("action-item-status", {
        "meeting_id": meeting_id,
        "item_id": item_id,
        "status": "planned",
        "planner_task_id": task_id,
    })

    return {
        "item_id": item_id,
        "status": "planned",
        "planner_task_id": task_id,
        "planner_url": f"http://ekinbot.local:5173/tasks/{task_id}",
    }


@router.post("/{meeting_id}/action-items/{item_id}/execute")
async def api_action_item_execute(meeting_id: str, item_id: str, req: ActionItemExecuteRequest):
    """Spawn an agent to execute an action item."""
    # Verify item exists
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
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
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT agent_session_key FROM agents WHERE id = ? OR agent_session_key = ?",
            (agent_id, agent_id),
        ) as cur:
            row = await cur.fetchone()
            session_key = row["agent_session_key"] if row else agent_id

    # Mark as executing before spawning
    now = _now_ms()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE meeting_action_items SET status = 'executing', execution_session_id = ?, updated_at = ? WHERE id = ?",
            (session_key, now, item_id),
        )
        await db.commit()

    await broadcast("action-item-status", {
        "meeting_id": meeting_id,
        "item_id": item_id,
        "status": "executing",
        "session_id": session_key,
    })

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
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "UPDATE meeting_action_items SET status = 'failed', updated_at = ? WHERE id = ?",
                (_now_ms(), item_id),
            )
            await db.commit()
        await broadcast("action-item-status", {
            "meeting_id": meeting_id,
            "item_id": item_id,
            "status": "failed",
            "error": str(e),
        })
        raise HTTPException(502, f"Failed to spawn agent: {str(e)}")

    # Update status based on response
    final_status = "done" if response else "failed"
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE meeting_action_items SET status = ?, updated_at = ? WHERE id = ?",
            (final_status, _now_ms(), item_id),
        )
        await db.commit()

    await broadcast("action-item-status", {
        "meeting_id": meeting_id,
        "item_id": item_id,
        "status": final_status,
        "session_id": session_key,
    })

    return {
        "item_id": item_id,
        "status": final_status,
        "session_id": session_key,
        "response": response[:500] if response else None,
    }


# End of meeting routes
