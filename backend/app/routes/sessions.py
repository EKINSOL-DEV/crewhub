"""
Session management routes.
Handles listing, viewing, and killing agent sessions.

Uses ConnectionManager to aggregate sessions from all agent connections.
"""

from typing import Optional

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


@router.get("/{session_key:path}/history")
async def get_session_history(session_key: str, limit: int = Query(default=50, ge=1, le=500)):
    """Get message history for a specific session.

    Returns raw JSONL entries for backward compatibility.

    Args:
        session_key: URL-encoded session key (e.g., agent:main:main)
        limit: Maximum number of messages to return (1-500)
    """
    manager = await get_connection_manager()
    conn = manager.get_default_openclaw()
    if not conn:
        raise HTTPException(status_code=503, detail="No OpenClaw connection available")

    history = await conn.get_session_history_raw(session_key, limit)

    return {"messages": history, "count": len(history)}


@router.patch("/{session_key:path}")
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


@router.delete("/{session_key:path}")
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
