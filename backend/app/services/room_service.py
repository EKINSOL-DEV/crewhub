"""Service layer for room database operations.

All SQL for rooms lives here. Routes call these functions and handle
HTTP concerns (SSE broadcasts, response formatting).
"""

import logging
import time
import uuid
from typing import Optional

from fastapi import HTTPException

from app.db.database import get_db
from app.db.models import Room, RoomCreate, RoomUpdate

SQL_CHECK_ROOM = "SELECT id FROM rooms WHERE id = ?"
MSG_ROOM_NOT_FOUND = "Room not found"

logger = logging.getLogger(__name__)

# ── SQL helpers ───────────────────────────────────────────────────────────────

_ROOMS_SELECT = """
    SELECT r.*, p.name as project_name, p.color as project_color
    FROM rooms r
    LEFT JOIN projects p ON r.project_id = p.id
"""


def _row_to_room(row: dict) -> Room:
    """Convert a DB row to a Room model, handling project_name join."""
    return Room(
        id=row["id"],
        name=row["name"],
        icon=row.get("icon"),
        color=row.get("color"),
        sort_order=row.get("sort_order", 0),
        default_model=row.get("default_model"),
        speed_multiplier=row.get("speed_multiplier", 1.0),
        floor_style=row.get("floor_style", "default"),
        wall_style=row.get("wall_style", "default"),
        project_id=row.get("project_id"),
        project_name=row.get("project_name"),
        project_color=row.get("project_color"),
        is_hq=bool(row.get("is_hq", 0)),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


# ── Public service functions ──────────────────────────────────────────────────


async def list_rooms() -> list[Room]:
    """Return all rooms ordered by sort_order."""
    async with get_db() as db:
        async with db.execute(f"{_ROOMS_SELECT} ORDER BY r.sort_order ASC") as cursor:
            rows = await cursor.fetchall()
    return [_row_to_room(row) for row in rows]


async def get_room(room_id: str) -> Room:
    """Return a single room by ID. Raises 404 if not found."""
    async with get_db() as db:
        async with db.execute(f"{_ROOMS_SELECT} WHERE r.id = ?", (room_id,)) as cursor:
            row = await cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=MSG_ROOM_NOT_FOUND)
    return _row_to_room(row)


async def create_room(room: RoomCreate) -> Room:
    """Insert a new room. Raises 400 if ID already exists."""
    async with get_db() as db:
        # Guard against duplicate IDs
        async with db.execute(SQL_CHECK_ROOM, (room.id,)) as cursor:
            if await cursor.fetchone():
                raise HTTPException(status_code=400, detail="Room ID already exists")

        now = int(time.time() * 1000)
        await db.execute(
            """
            INSERT INTO rooms
                (id, name, icon, color, sort_order, default_model,
                 speed_multiplier, floor_style, wall_style, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                room.id,
                room.name,
                room.icon,
                room.color,
                room.sort_order,
                room.default_model,
                room.speed_multiplier,
                room.floor_style,
                room.wall_style,
                now,
                now,
            ),
        )
        await db.commit()

        async with db.execute(f"{_ROOMS_SELECT} WHERE r.id = ?", (room.id,)) as cursor:
            row = await cursor.fetchone()

    return _row_to_room(row)


async def update_room(room_id: str, room: RoomUpdate) -> Room:
    """Update an existing room. Raises 404 if not found."""
    async with get_db() as db:
        async with db.execute(SQL_CHECK_ROOM, (room_id,)) as cursor:
            if not await cursor.fetchone():
                raise HTTPException(status_code=404, detail=MSG_ROOM_NOT_FOUND)

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
                values,
            )
            await db.commit()

        async with db.execute(f"{_ROOMS_SELECT} WHERE r.id = ?", (room_id,)) as cursor:
            row = await cursor.fetchone()

    return _row_to_room(row)


async def delete_room(room_id: str) -> dict:
    """Delete a room and its assignments/rules. Raises 403 for HQ, 404 if not found."""
    async with get_db() as db:
        async with db.execute("SELECT id, is_hq FROM rooms WHERE id = ?", (room_id,)) as cursor:
            row = await cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail=MSG_ROOM_NOT_FOUND)
        if row["is_hq"]:
            raise HTTPException(
                status_code=403,
                detail="Cannot delete Headquarters room. HQ is a protected system room.",
            )

        await db.execute("DELETE FROM session_room_assignments WHERE room_id = ?", (room_id,))
        await db.execute("DELETE FROM room_assignment_rules WHERE room_id = ?", (room_id,))
        await db.execute("DELETE FROM rooms WHERE id = ?", (room_id,))
        await db.commit()

    return {"success": True, "deleted": room_id}


async def assign_project_to_room(room_id: str, project_id: str) -> Room:
    """Assign a project to a room. Raises 404 if room or project not found."""
    async with get_db() as db:
        async with db.execute(SQL_CHECK_ROOM, (room_id,)) as cursor:
            if not await cursor.fetchone():
                raise HTTPException(status_code=404, detail=MSG_ROOM_NOT_FOUND)

        async with db.execute("SELECT id FROM projects WHERE id = ?", (project_id,)) as cursor:
            if not await cursor.fetchone():
                raise HTTPException(status_code=404, detail="Project not found")

        now = int(time.time() * 1000)
        await db.execute(
            "UPDATE rooms SET project_id = ?, updated_at = ? WHERE id = ?",
            (project_id, now, room_id),
        )
        await db.commit()

        async with db.execute(f"{_ROOMS_SELECT} WHERE r.id = ?", (room_id,)) as cursor:
            row = await cursor.fetchone()

    return _row_to_room(row)


async def clear_project_from_room(room_id: str) -> Room:
    """Clear the project assignment from a room. Raises 404 if room not found."""
    async with get_db() as db:
        async with db.execute(SQL_CHECK_ROOM, (room_id,)) as cursor:
            if not await cursor.fetchone():
                raise HTTPException(status_code=404, detail=MSG_ROOM_NOT_FOUND)

        now = int(time.time() * 1000)
        await db.execute(
            "UPDATE rooms SET project_id = NULL, updated_at = ? WHERE id = ?",
            (now, room_id),
        )
        await db.commit()

        async with db.execute(f"{_ROOMS_SELECT} WHERE r.id = ?", (room_id,)) as cursor:
            row = await cursor.fetchone()

    return _row_to_room(row)


async def set_room_as_hq(room_id: str) -> Room:
    """Set a room as HQ (only one at a time). Raises 404 if room not found."""
    async with get_db() as db:
        async with db.execute(SQL_CHECK_ROOM, (room_id,)) as cursor:
            if not await cursor.fetchone():
                raise HTTPException(status_code=404, detail=MSG_ROOM_NOT_FOUND)

        now = int(time.time() * 1000)
        await db.execute("UPDATE rooms SET is_hq = 0, updated_at = ? WHERE is_hq = 1", (now,))
        await db.execute("UPDATE rooms SET is_hq = 1, updated_at = ? WHERE id = ?", (now, room_id))
        await db.commit()

        async with db.execute(f"{_ROOMS_SELECT} WHERE r.id = ?", (room_id,)) as cursor:
            row = await cursor.fetchone()

    return _row_to_room(row)


async def reorder_rooms(room_order: list[str]) -> dict:
    """Update sort_order for a list of room IDs."""
    async with get_db() as db:
        now = int(time.time() * 1000)
        for i, rid in enumerate(room_order):
            await db.execute(
                "UPDATE rooms SET sort_order = ?, updated_at = ? WHERE id = ?",
                (i, now, rid),
            )
        await db.commit()
    return {"success": True, "order": room_order}


async def get_or_create_project_rule(project_name: str) -> Optional[str]:
    """Find a room matching project_name and create an assignment rule.

    Returns room_id if a matching room was found and rule created, else None.
    """
    if not project_name:
        return None

    async with get_db() as db:
        # Find room whose name contains the project name (case-insensitive)
        async with db.execute(
            "SELECT id, name FROM rooms WHERE LOWER(name) LIKE ?",
            (f"%{project_name.lower()}%",),
        ) as cursor:
            row = await cursor.fetchone()

        if not row:
            return None

        room_id = row["id"]
        rule_value = f"claude:{project_name}"

        # Check if rule already exists
        async with db.execute(
            "SELECT id FROM room_assignment_rules WHERE rule_type = 'session_key_contains' AND rule_value = ?",
            (rule_value,),
        ) as cursor:
            if await cursor.fetchone():
                return room_id  # Rule already exists

        # Create new rule
        rule_id = str(uuid.uuid4())
        now = int(time.time() * 1000)
        await db.execute(
            """INSERT INTO room_assignment_rules (id, room_id, rule_type, rule_value, priority, created_at)
               VALUES (?, ?, 'session_key_contains', ?, 10, ?)""",
            (rule_id, room_id, rule_value, now),
        )
        await db.commit()
        logger.info("Created project rule: %s -> room %s", rule_value, room_id)
        return room_id
