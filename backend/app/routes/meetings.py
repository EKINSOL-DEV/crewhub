"""REST API routes for AI-orchestrated meetings."""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.db.meeting_models import MeetingConfig, MeetingState, StartMeetingRequest
from app.services.meeting_orchestrator import (
    start_meeting,
    cancel_meeting,
    get_meeting,
    list_meetings,
)

router = APIRouter()


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


@router.get("")
async def api_list_meetings(
    days: int = Query(30, ge=1, le=365),
    room_id: Optional[str] = None,
    project_id: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
):
    """List recent meetings."""
    meetings = await list_meetings(days=days, room_id=room_id, project_id=project_id, limit=limit)
    return {"meetings": meetings}


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
