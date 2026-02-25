"""Rooms API routes."""

import logging
from typing import List

from fastapi import APIRouter, HTTPException

import app.services.room_service as room_svc
from app.db.models import Room, RoomCreate, RoomProjectAssign, RoomUpdate
from app.routes.sse import broadcast

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=dict, responses={500: {"description": "Internal server error"}})
async def list_rooms():
    """Get all rooms sorted by sort_order."""
    try:
        rooms = await room_svc.list_rooms()
        return {"rooms": [room.model_dump() for room in rooms]}
    except Exception as e:
        logger.error(f"Failed to list rooms: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{room_id}", response_model=Room, responses={500: {"description": "Internal server error"}})
async def get_room(room_id: str):
    """Get a specific room by ID."""
    try:
        return await room_svc.get_room(room_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get room {room_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=Room, responses={500: {"description": "Internal server error"}})
async def create_room(room: RoomCreate):
    """Create a new room."""
    try:
        created = await room_svc.create_room(room)
        await broadcast("rooms-refresh", {"action": "created", "room_id": room.id})
        return created
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create room: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{room_id}", response_model=Room, responses={500: {"description": "Internal server error"}})
async def update_room(room_id: str, room: RoomUpdate):
    """Update an existing room."""
    try:
        updated = await room_svc.update_room(room_id, room)
        await broadcast("rooms-refresh", {"action": "updated", "room_id": room_id})
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update room {room_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{room_id}", responses={500: {"description": "Internal server error"}})
async def delete_room(room_id: str):
    """Delete a room."""
    try:
        result = await room_svc.delete_room(room_id)
        await broadcast("rooms-refresh", {"action": "deleted", "room_id": room_id})
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete room {room_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{room_id}/project", response_model=Room, responses={500: {"description": "Internal server error"}})
async def assign_project(room_id: str, body: RoomProjectAssign):
    """Assign a project to a room."""
    try:
        room = await room_svc.assign_project_to_room(room_id, body.project_id)
        await broadcast("rooms-refresh", {"action": "project_assigned", "room_id": room_id})
        return room
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to assign project to room {room_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{room_id}/project", response_model=Room, responses={500: {"description": "Internal server error"}})
async def clear_project(room_id: str):
    """Clear project assignment from a room."""
    try:
        room = await room_svc.clear_project_from_room(room_id)
        await broadcast("rooms-refresh", {"action": "project_cleared", "room_id": room_id})
        return room
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to clear project from room {room_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{room_id}/hq", response_model=Room, responses={500: {"description": "Internal server error"}})
async def set_hq(room_id: str):
    """Set a room as HQ. Only one room can be HQ at a time."""
    try:
        room = await room_svc.set_room_as_hq(room_id)
        await broadcast("rooms-refresh", {"action": "hq_changed", "room_id": room_id})
        return room
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to set HQ for room {room_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/reorder", response_model=dict, responses={500: {"description": "Internal server error"}})
async def reorder_rooms(room_order: List[str]):
    """Reorder rooms by updating sort_order."""
    try:
        result = await room_svc.reorder_rooms(room_order)
        await broadcast("rooms-refresh", {"action": "reordered"})
        return result
    except Exception as e:
        logger.error(f"Failed to reorder rooms: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{room_id}/context", responses={404: {"description": "Not found"}})
async def get_room_context(room_id: str, channel: str = "crewhub-ui"):
    """Get the context envelope for a room.

    Returns both the raw envelope and the formatted text block
    that would be injected into an agent's prompt.

    Args:
        room_id: Room ID to build context for.
        channel: Simulated channel for privacy tier (default: crewhub-ui = internal).
    """
    from app.services.context_envelope import build_crewhub_context, format_context_block

    envelope = await build_crewhub_context(room_id=room_id, channel=channel)
    if envelope is None:
        raise HTTPException(status_code=404, detail="Room not found")

    return {
        "envelope": envelope,
        "formatted": format_context_block(envelope),
        "channel": channel,
        "privacy": envelope.get("privacy", "unknown"),
    }
