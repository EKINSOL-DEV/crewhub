"""Session Display Names API routes."""
import time
import logging
from fastapi import APIRouter, HTTPException

from app.db.database import get_db
from app.db.models import SessionDisplayName, SessionDisplayNameUpdate
from app.routes.sse import broadcast

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=dict)
async def list_display_names():
    """Get all session display names."""
    try:
        async with get_db() as db:
            async with db.execute(
                "SELECT * FROM session_display_names ORDER BY updated_at DESC"
            ) as cursor:
                rows = await cursor.fetchall()
                names = [SessionDisplayName(**row) for row in rows]
            return {"display_names": [n.model_dump() for n in names]}
    except Exception as e:
        logger.error(f"Failed to list display names: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_key}", response_model=SessionDisplayName)
async def get_display_name(session_key: str):
    """Get display name for a specific session."""
    try:
        async with get_db() as db:
            async with db.execute(
                "SELECT * FROM session_display_names WHERE session_key = ?",
                (session_key,)
            ) as cursor:
                row = await cursor.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Display name not found")
                return SessionDisplayName(**row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get display name for {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_key}", response_model=SessionDisplayName)
async def set_display_name(session_key: str, data: SessionDisplayNameUpdate):
    """Set or update display name for a session."""
    try:
        async with get_db() as db:
            now = int(time.time() * 1000)
            
            # Upsert display name
            await db.execute("""
                INSERT INTO session_display_names (session_key, display_name, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(session_key) DO UPDATE SET
                    display_name = excluded.display_name,
                    updated_at = excluded.updated_at
            """, (session_key, data.display_name, now))
            await db.commit()
            
            # Return the display name
            async with db.execute(
                "SELECT * FROM session_display_names WHERE session_key = ?",
                (session_key,)
            ) as cursor:
                row = await cursor.fetchone()
                result = SessionDisplayName(**row)

            # Broadcast SSE event so other clients update their cache
            await broadcast("display-name-updated", {
                "session_key": session_key,
                "display_name": data.display_name,
                "action": "set",
            })
            return result
    except Exception as e:
        logger.error(f"Failed to set display name for {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{session_key}")
async def delete_display_name(session_key: str):
    """Delete a session display name."""
    try:
        async with get_db() as db:
            # Check if exists
            async with db.execute(
                "SELECT session_key FROM session_display_names WHERE session_key = ?",
                (session_key,)
            ) as cursor:
                if not await cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Display name not found")
            
            await db.execute(
                "DELETE FROM session_display_names WHERE session_key = ?",
                (session_key,)
            )
            await db.commit()

            # Broadcast SSE event so other clients update their cache
            await broadcast("display-name-updated", {
                "session_key": session_key,
                "display_name": None,
                "action": "deleted",
            })
            return {"success": True, "deleted": session_key}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete display name {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
