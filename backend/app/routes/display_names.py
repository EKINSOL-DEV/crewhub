"""Session Display Names API routes."""
import time
import logging
from fastapi import APIRouter, HTTPException

from app.db.database import get_db
from app.db.models import SessionDisplayName, SessionDisplayNameUpdate

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=dict)
async def list_display_names():
    """Get all session display names."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            async with db.execute(
                "SELECT * FROM session_display_names ORDER BY updated_at DESC"
            ) as cursor:
                rows = await cursor.fetchall()
                names = [SessionDisplayName(**row) for row in rows]
            return {"display_names": [n.model_dump() for n in names]}
        finally:
            await db.close()
    except Exception as e:
        logger.error(f"Failed to list display names: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_key}", response_model=SessionDisplayName)
async def get_display_name(session_key: str):
    """Get display name for a specific session."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            async with db.execute(
                "SELECT * FROM session_display_names WHERE session_key = ?",
                (session_key,)
            ) as cursor:
                row = await cursor.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Display name not found")
                return SessionDisplayName(**row)
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get display name for {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_key}", response_model=SessionDisplayName)
async def set_display_name(session_key: str, data: SessionDisplayNameUpdate):
    """Set or update display name for a session."""
    try:
        db = await get_db()
        try:
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
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            async with db.execute(
                "SELECT * FROM session_display_names WHERE session_key = ?",
                (session_key,)
            ) as cursor:
                row = await cursor.fetchone()
                return SessionDisplayName(**row)
        finally:
            await db.close()
    except Exception as e:
        logger.error(f"Failed to set display name for {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{session_key}")
async def delete_display_name(session_key: str):
    """Delete a session display name."""
    try:
        db = await get_db()
        try:
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
            
            return {"success": True, "deleted": session_key}
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete display name {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
