"""
Session management routes.
Handles listing, viewing, spawning, and killing agent sessions.

Pure Gateway monitoring - no database dependencies.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from ..services.gateway import get_gateway

router = APIRouter(tags=["Sessions"])


class SessionPatch(BaseModel):
    model: Optional[str] = None


class SessionSpawn(BaseModel):
    task: str
    model: str = "sonnet"
    label: Optional[str] = None


@router.get("")
async def list_sessions():
    """Get all active sessions."""
    gateway = await get_gateway()
    sessions = await gateway.get_sessions()
    
    return {"sessions": sessions}


@router.get("/{session_key:path}/history")
async def get_session_history(
    session_key: str,
    limit: int = Query(default=50, ge=1, le=500)
):
    """Get message history for a specific session.
    
    Args:
        session_key: URL-encoded session key (e.g., agent:main:main)
        limit: Maximum number of messages to return (1-500)
    """
    gateway = await get_gateway()
    history = await gateway.get_session_history(session_key, limit)
    
    return {"history": history, "count": len(history)}


@router.patch("/{session_key:path}")
async def patch_session(session_key: str, patch: SessionPatch):
    """Update session configuration (e.g., switch model).
    
    Args:
        session_key: URL-encoded session key
        patch: Fields to update (model, etc.)
    """
    gateway = await get_gateway()
    
    if patch.model:
        sessions = await gateway.get_sessions()
        session = next((s for s in sessions if s.get("key") == session_key), None)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_id = session.get("sessionId")
        if not session_id:
            raise HTTPException(status_code=500, detail="Session missing sessionId")
        
        success = await gateway.patch_session(session_id, model=patch.model)
        
        if not success:
            raise HTTPException(status_code=502, detail="Failed to update session")
        
        return {"success": True, "sessionKey": session_key, "model": patch.model}
    
    raise HTTPException(status_code=400, detail="No fields to update")


@router.delete("/{session_key:path}")
async def kill_session(session_key: str):
    """Terminate a session.
    
    Args:
        session_key: URL-encoded session key
    """
    gateway = await get_gateway()
    success = await gateway.kill_session(session_key)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to kill session")
    
    return {"success": True, "sessionKey": session_key}


@router.post("/spawn")
async def spawn_session(spawn: SessionSpawn):
    """Spawn a new sub-agent session.
    
    Args:
        spawn: Task description, model, and optional label
    """
    gateway = await get_gateway()
    result = await gateway.spawn_session(
        task=spawn.task,
        model=spawn.model,
        label=spawn.label
    )
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to spawn session")
    
    return result
