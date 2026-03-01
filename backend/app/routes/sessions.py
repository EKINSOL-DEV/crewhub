"""
Session management routes.
Handles listing, viewing, and killing agent sessions.

Uses ConnectionManager to aggregate sessions from all agent connections.
"""

from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..services.connections import get_connection_manager

router = APIRouter()


class SessionPatch(BaseModel):
    model: Optional[str] = None


@router.get("")
async def list_sessions():
    """Get all active sessions from all connections."""
    manager = await get_connection_manager()
    sessions = await manager.get_all_sessions()

    return {"sessions": [s.to_dict() for s in sessions]}


@router.get("/{session_key:path}/history", responses={503: {"description": "Service unavailable"}})
async def get_session_history(session_key: str, limit: Annotated[int, Query(ge=1, le=500)] = 50):
    """Get message history for a specific session.

    For Claude Code sessions (claude:* keys), returns standardized HistoryMessage dicts.
    For OpenClaw sessions, returns raw JSONL entries for backward compatibility.

    Args:
        session_key: URL-encoded session key (e.g., agent:main:main or claude:<id>)
        limit: Maximum number of messages to return (1-500)
    """
    manager = await get_connection_manager()

    if session_key.startswith("claude:"):
        messages = await manager.get_session_history(session_key, limit=limit)
        return {
            "messages": [m.to_dict() for m in messages],
            "count": len(messages),
            "format": "standard",
        }

    # CC fixed agent key — resolve to actual Claude session
    if session_key.startswith("cc:"):
        from ..services.cc_chat import _agent_sessions

        agent_id = session_key[3:]
        cc_session_id = _agent_sessions.get(agent_id)
        if cc_session_id:
            claude_key = f"claude:{cc_session_id}"
            messages = await manager.get_session_history(claude_key, limit=limit)
            return {
                "messages": [m.to_dict() for m in messages],
                "count": len(messages),
                "format": "standard",
            }
        return {"messages": [], "count": 0, "format": "standard"}

    conn = manager.get_default_openclaw()
    if not conn:
        raise HTTPException(status_code=503, detail="No OpenClaw connection available")

    history = await conn.get_session_history_raw(session_key, limit)

    return {"messages": history, "count": len(history), "format": "raw"}


@router.patch(
    "/{session_key:path}",
    responses={
        400: {"description": "Bad request"},
        404: {"description": "Not found"},
        500: {"description": "Internal server error"},
        502: {"description": "HTTP 502"},
        503: {"description": "Service unavailable"},
    },
)
async def patch_session(session_key: str, patch: SessionPatch):
    """Update session configuration (e.g., switch model).

    Args:
        session_key: URL-encoded session key
        patch: Fields to update (model, etc.)
    """
    if not patch.model:
        raise HTTPException(status_code=400, detail="No fields to update")

    manager = await get_connection_manager()
    conn = manager.get_default_openclaw()
    if not conn:
        raise HTTPException(status_code=503, detail="No OpenClaw connection available")

    sessions = await conn.get_sessions_raw()
    session = next((s for s in sessions if s.get("key") == session_key), None)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session_id = session.get("sessionId")
    if not session_id:
        raise HTTPException(status_code=500, detail="Session missing sessionId")

    success = await conn.patch_session(session_id, model=patch.model)

    if not success:
        raise HTTPException(status_code=502, detail="Failed to update session")

    return {"success": True, "sessionKey": session_key, "model": patch.model}


@router.delete("/{session_key:path}", responses={500: {"description": "Internal server error"}})
async def kill_session(session_key: str):
    """Terminate a session.

    Args:
        session_key: URL-encoded session key
    """
    manager = await get_connection_manager()
    success = await manager.kill_session(session_key)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to kill session")

    return {"success": True, "sessionKey": session_key}
