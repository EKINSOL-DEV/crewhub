"""Session history API routes.

Endpoints for viewing and managing archived agent session history.
Reads directly from OpenClaw session files in ~/.openclaw/agents/*/sessions/
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from ..services import history

router = APIRouter()


@router.get("")
async def get_archived_sessions(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    agent_id: Optional[str] = Query(default=None, alias="agent"),
    type: Optional[str] = Query(default=None, alias="type"),
    date_from: Optional[int] = Query(default=None),
    date_to: Optional[int] = Query(default=None),
    search: Optional[str] = Query(default=None),
    include_deleted: bool = Query(default=False),
):
    """Get archived session history with filters.
    
    Args:
        limit: Maximum number of sessions to return (1-500)
        offset: Pagination offset
        agent: Filter by agent ID (main, dev, etc.)
        type: Filter by minion type (main, cron, subagent, etc.)
        date_from: Filter by end timestamp >= this (milliseconds)
        date_to: Filter by end timestamp <= this (milliseconds)
        search: Search in display_name or summary
        include_deleted: Include deleted sessions
        
    Returns:
        {sessions: [...], total: count, limit: int, offset: int}
    """
    result = await history.get_archived_sessions(
        limit=limit,
        offset=offset,
        agent_id=agent_id,
        type_filter=type,
        date_from=date_from,
        date_to=date_to,
        search=search,
        include_deleted=include_deleted,
    )
    
    return result


@router.get("/stats")
async def get_history_stats():
    """Get statistics about archived sessions.
    
    Returns:
        Statistics about stored sessions (counts, types, etc.)
    """
    stats = await history.get_statistics()
    return stats


@router.get("/{session_key:path}")
async def get_session_detail(session_key: str):
    """Get detailed information for a specific archived session.
    
    Args:
        session_key: URL-encoded session key (e.g., agent:main:abc123)
        
    Returns:
        Session details with full message history, or 404 if not found
    """
    session = await history.get_session_detail(session_key)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found in history")
    
    return session


@router.delete("/{session_key:path}")
async def delete_session(session_key: str):
    """Delete a session from history (marks as deleted, not permanent).
    
    Args:
        session_key: URL-encoded session key
        
    Returns:
        {success: bool, sessionKey: str}
    """
    success = await history.delete_session(session_key)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete session")
    
    return {"success": True, "sessionKey": session_key}
