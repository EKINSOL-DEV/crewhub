"""Session Room Assignments API routes."""
import time
import logging
from fastapi import APIRouter, HTTPException

from app.db.database import get_db
from app.db.models import SessionRoomAssignment, SessionRoomAssignmentCreate
from app.routes.sse import broadcast

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=dict)
async def list_assignments():
    """Get all session room assignments."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            async with db.execute(
                "SELECT * FROM session_room_assignments ORDER BY assigned_at DESC"
            ) as cursor:
                rows = await cursor.fetchall()
                assignments = [SessionRoomAssignment(**row) for row in rows]
            return {"assignments": [a.model_dump() for a in assignments]}
        finally:
            await db.close()
    except Exception as e:
        logger.error(f"Failed to list assignments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_key}", response_model=SessionRoomAssignment)
async def get_assignment(session_key: str):
    """Get assignment for a specific session."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            async with db.execute(
                "SELECT * FROM session_room_assignments WHERE session_key = ?",
                (session_key,)
            ) as cursor:
                row = await cursor.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Assignment not found")
                return SessionRoomAssignment(**row)
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get assignment for {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=SessionRoomAssignment)
async def create_or_update_assignment(assignment: SessionRoomAssignmentCreate):
    """Create or update a session room assignment."""
    try:
        db = await get_db()
        try:
            now = int(time.time() * 1000)
            
            # Verify room exists
            async with db.execute(
                "SELECT id FROM rooms WHERE id = ?", (assignment.room_id,)
            ) as cursor:
                if not await cursor.fetchone():
                    raise HTTPException(status_code=400, detail="Room not found")
            
            # Upsert assignment
            await db.execute("""
                INSERT INTO session_room_assignments (session_key, room_id, assigned_at)
                VALUES (?, ?, ?)
                ON CONFLICT(session_key) DO UPDATE SET
                    room_id = excluded.room_id,
                    assigned_at = excluded.assigned_at
            """, (assignment.session_key, assignment.room_id, now))
            await db.commit()
            
            # Return the assignment
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            async with db.execute(
                "SELECT * FROM session_room_assignments WHERE session_key = ?",
                (assignment.session_key,)
            ) as cursor:
                row = await cursor.fetchone()
                result = SessionRoomAssignment(**row)
            
            await broadcast("rooms-refresh", {
                "action": "assignment_changed",
                "session_key": assignment.session_key,
                "room_id": assignment.room_id,
            })
            return result
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create/update assignment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{session_key}")
async def delete_assignment(session_key: str):
    """Delete a session room assignment."""
    try:
        db = await get_db()
        try:
            # Check if exists
            async with db.execute(
                "SELECT session_key FROM session_room_assignments WHERE session_key = ?",
                (session_key,)
            ) as cursor:
                if not await cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Assignment not found")
            
            await db.execute(
                "DELETE FROM session_room_assignments WHERE session_key = ?",
                (session_key,)
            )
            await db.commit()
            
            await broadcast("rooms-refresh", {
                "action": "assignment_removed",
                "session_key": session_key,
            })
            return {"success": True, "deleted": session_key}
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete assignment {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/room/{room_id}", response_model=dict)
async def get_assignments_for_room(room_id: str):
    """Get all assignments for a specific room."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            async with db.execute(
                "SELECT * FROM session_room_assignments WHERE room_id = ? ORDER BY assigned_at DESC",
                (room_id,)
            ) as cursor:
                rows = await cursor.fetchall()
                assignments = [SessionRoomAssignment(**row) for row in rows]
            return {"assignments": [a.model_dump() for a in assignments]}
        finally:
            await db.close()
    except Exception as e:
        logger.error(f"Failed to get assignments for room {room_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch", response_model=dict)
async def batch_assign(assignments: list[SessionRoomAssignmentCreate]):
    """Batch create/update multiple assignments."""
    try:
        db = await get_db()
        try:
            now = int(time.time() * 1000)
            created = []
            
            for assignment in assignments:
                # Verify room exists
                async with db.execute(
                    "SELECT id FROM rooms WHERE id = ?", (assignment.room_id,)
                ) as cursor:
                    if not await cursor.fetchone():
                        continue  # Skip invalid rooms
                
                await db.execute("""
                    INSERT INTO session_room_assignments (session_key, room_id, assigned_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(session_key) DO UPDATE SET
                        room_id = excluded.room_id,
                        assigned_at = excluded.assigned_at
                """, (assignment.session_key, assignment.room_id, now))
                created.append(assignment.session_key)
            
            await db.commit()
            
            if created:
                await broadcast("rooms-refresh", {
                    "action": "assignments_batch_changed",
                    "session_keys": created,
                })
            return {"success": True, "assigned": created, "count": len(created)}
        finally:
            await db.close()
    except Exception as e:
        logger.error(f"Failed to batch assign: {e}")
        raise HTTPException(status_code=500, detail=str(e))
