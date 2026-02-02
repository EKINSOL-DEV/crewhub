"""Rooms API routes."""
import time
import logging
from fastapi import APIRouter, HTTPException
from typing import List

from app.db.database import get_db
from app.db.models import Room, RoomCreate, RoomUpdate

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=dict)
async def list_rooms():
    """Get all rooms sorted by sort_order."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            async with db.execute(
                "SELECT * FROM rooms ORDER BY sort_order ASC"
            ) as cursor:
                rows = await cursor.fetchall()
                rooms = [Room(**row) for row in rows]
            return {"rooms": [room.model_dump() for room in rooms]}
        finally:
            await db.close()
    except Exception as e:
        logger.error(f"Failed to list rooms: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{room_id}", response_model=Room)
async def get_room(room_id: str):
    """Get a specific room by ID."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            async with db.execute(
                "SELECT * FROM rooms WHERE id = ?", (room_id,)
            ) as cursor:
                row = await cursor.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Room not found")
                return Room(**row)
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get room {room_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=Room)
async def create_room(room: RoomCreate):
    """Create a new room."""
    try:
        db = await get_db()
        try:
            now = int(time.time() * 1000)
            
            # Check if ID already exists
            async with db.execute(
                "SELECT id FROM rooms WHERE id = ?", (room.id,)
            ) as cursor:
                if await cursor.fetchone():
                    raise HTTPException(status_code=400, detail="Room ID already exists")
            
            await db.execute("""
                INSERT INTO rooms (id, name, icon, color, sort_order, default_model, speed_multiplier, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                room.id, room.name, room.icon, room.color, 
                room.sort_order, room.default_model, room.speed_multiplier,
                now, now
            ))
            await db.commit()
            
            # Return created room
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            async with db.execute(
                "SELECT * FROM rooms WHERE id = ?", (room.id,)
            ) as cursor:
                row = await cursor.fetchone()
                return Room(**row)
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create room: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{room_id}", response_model=Room)
async def update_room(room_id: str, room: RoomUpdate):
    """Update an existing room."""
    try:
        db = await get_db()
        try:
            # Check if room exists
            async with db.execute(
                "SELECT id FROM rooms WHERE id = ?", (room_id,)
            ) as cursor:
                if not await cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Room not found")
            
            # Build update query dynamically
            updates = []
            values = []
            update_data = room.model_dump(exclude_unset=True)
            
            for field, value in update_data.items():
                if value is not None:
                    updates.append(f"{field} = ?")
                    values.append(value)
            
            if updates:
                updates.append("updated_at = ?")
                values.append(int(time.time() * 1000))
                values.append(room_id)
                
                await db.execute(
                    f"UPDATE rooms SET {', '.join(updates)} WHERE id = ?",
                    values
                )
                await db.commit()
            
            # Return updated room
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            async with db.execute(
                "SELECT * FROM rooms WHERE id = ?", (room_id,)
            ) as cursor:
                row = await cursor.fetchone()
                return Room(**row)
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update room {room_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{room_id}")
async def delete_room(room_id: str):
    """Delete a room."""
    try:
        db = await get_db()
        try:
            # Check if room exists
            async with db.execute(
                "SELECT id FROM rooms WHERE id = ?", (room_id,)
            ) as cursor:
                if not await cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Room not found")
            
            # Delete associated assignments first
            await db.execute(
                "DELETE FROM session_room_assignments WHERE room_id = ?", (room_id,)
            )
            
            # Delete associated rules
            await db.execute(
                "DELETE FROM room_assignment_rules WHERE room_id = ?", (room_id,)
            )
            
            # Delete the room
            await db.execute("DELETE FROM rooms WHERE id = ?", (room_id,))
            await db.commit()
            
            return {"success": True, "deleted": room_id}
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete room {room_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/reorder", response_model=dict)
async def reorder_rooms(room_order: List[str]):
    """Reorder rooms by updating sort_order."""
    try:
        db = await get_db()
        try:
            now = int(time.time() * 1000)
            for i, room_id in enumerate(room_order):
                await db.execute(
                    "UPDATE rooms SET sort_order = ?, updated_at = ? WHERE id = ?",
                    (i, now, room_id)
                )
            await db.commit()
            return {"success": True, "order": room_order}
        finally:
            await db.close()
    except Exception as e:
        logger.error(f"Failed to reorder rooms: {e}")
        raise HTTPException(status_code=500, detail=str(e))
