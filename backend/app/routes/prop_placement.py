"""
Prop Placement API — Creator Mode backend.

Allows admins to place, move, and remove props in the 3D world.
Changes are broadcast via SSE so all connected clients update live.

Endpoints:
  GET    /api/world/props              → list all placed props
  POST   /api/world/props              → place a prop
  PATCH  /api/world/props/{placed_id}  → move/rotate/scale a prop
  DELETE /api/world/props/{placed_id}  → remove a prop
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import APIKeyInfo, require_scope
from app.db.database import get_db
from app.routes.sse import broadcast

SQL_GET_PLACED_PROP = "SELECT * FROM placed_props WHERE id = ?"

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/world/props", tags=["creator-mode"])


# ── Pydantic models ───────────────────────────────────────────────


class Vec3(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0


class PlacePropRequest(BaseModel):
    prop_id: str = Field(..., description="Prop identifier, e.g. 'builtin:desk' or 'crewhub:gen123'")
    position: Vec3 = Field(default_factory=Vec3)
    rotation_y: float = Field(default=0.0, description="Rotation around Y axis in degrees")
    room_id: Optional[str] = Field(default=None, description="Room ID; null = world floor")
    scale: float = Field(default=1.0, ge=0.1, le=10.0)
    metadata: Optional[dict] = None


class UpdatePropRequest(BaseModel):
    position: Optional[Vec3] = None
    rotation_y: Optional[float] = None
    scale: Optional[float] = Field(default=None, ge=0.1, le=10.0)
    room_id: Optional[str] = None
    # C2 fix: sentinel to explicitly clear room_id to NULL.
    # Because room_id: null is indistinguishable from "not provided" in JSON
    # (both deserialise to None), we need a separate flag. Set clear_room=true
    # to move a prop back to the world floor (room_id → NULL).
    clear_room: bool = False


class PlacedPropResponse(BaseModel):
    id: str
    prop_id: str
    position: Vec3
    rotation_y: float
    scale: float
    room_id: Optional[str]
    placed_by: Optional[str]
    placed_at: float
    metadata: Optional[dict]


def _row_to_response(row: dict) -> PlacedPropResponse:
    meta = None
    if row.get("metadata"):
        try:
            meta = json.loads(row["metadata"])
        except (json.JSONDecodeError, TypeError):
            meta = None
    return PlacedPropResponse(
        id=row["id"],
        prop_id=row["prop_id"],
        position=Vec3(x=row["position_x"], y=row["position_y"], z=row["position_z"]),
        rotation_y=row["rotation_y"],
        scale=row["scale"],
        room_id=row.get("room_id"),
        placed_by=row.get("placed_by"),
        placed_at=row["placed_at"],
        metadata=meta,
    )


def _to_broadcast_data(placed: PlacedPropResponse, action: str) -> dict:
    return {
        "action": action,
        "placed_id": placed.id,
        "prop_id": placed.prop_id,
        "position": {"x": placed.position.x, "y": placed.position.y, "z": placed.position.z},
        "rotation_y": placed.rotation_y,
        "scale": placed.scale,
        "room_id": placed.room_id,
        "placed_by": placed.placed_by,
        "placed_at": placed.placed_at,
    }


# ── Routes ─────────────────────────────────────────────────────────


@router.get("", response_model=dict)
async def list_placed_props(
    room_id: Optional[str] = None,
):
    """
    Get all placed props. Optionally filter by room_id.
    Public endpoint — no auth required (world is read-only for viewers).
    """
    async with get_db() as db:
        if room_id is not None:
            async with db.execute(
                "SELECT * FROM placed_props WHERE room_id = ? ORDER BY placed_at ASC",
                (room_id,),
            ) as cursor:
                rows = await cursor.fetchall()
        else:
            async with db.execute(
                "SELECT * FROM placed_props ORDER BY placed_at ASC",
            ) as cursor:
                rows = await cursor.fetchall()

    props = [_row_to_response(dict(row)).model_dump() for row in rows]
    return {"props": props, "count": len(props)}


@router.post("", response_model=PlacedPropResponse, status_code=201)
async def place_prop(
    body: PlacePropRequest,
    key: Annotated[APIKeyInfo, Depends(require_scope("manage"))],
):
    """Place a prop in the world. Requires manage scope (admin only)."""
    placed_id = str(uuid.uuid4())
    now = time.time()
    meta_json = json.dumps(body.metadata) if body.metadata else None

    async with get_db() as db:
        await db.execute(
            """INSERT INTO placed_props
               (id, prop_id, position_x, position_y, position_z,
                rotation_y, scale, room_id, placed_by, placed_at, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                placed_id,
                body.prop_id,
                body.position.x,
                body.position.y,
                body.position.z,
                body.rotation_y,
                body.scale,
                body.room_id,
                key.name,
                now,
                meta_json,
            ),
        )
        await db.commit()

        async with db.execute(SQL_GET_PLACED_PROP, (placed_id,)) as cursor:
            row = await cursor.fetchone()

    placed = _row_to_response(dict(row))

    await broadcast("prop_update", _to_broadcast_data(placed, "place"))
    logger.info(
        f"[Creator] Placed prop {body.prop_id} at ({body.position.x},{body.position.y},{body.position.z}) room={body.room_id}"
    )

    return placed


@router.patch("/{placed_id}", response_model=PlacedPropResponse, responses={404: {"description": "Not found"}})
async def update_placed_prop(
    placed_id: str,
    body: UpdatePropRequest,
    key: Annotated[APIKeyInfo, Depends(require_scope("manage"))],
):
    """Move, rotate, or rescale an existing placed prop. Requires manage scope."""
    async with get_db() as db:
        async with db.execute(SQL_GET_PLACED_PROP, (placed_id,)) as cursor:
            row = await cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Placed prop not found.")

        row = dict(row)

        # Build update dynamically (only touched fields)
        updates: list[str] = []
        params: list = []

        if body.position is not None:
            updates += ["position_x = ?", "position_y = ?", "position_z = ?"]
            params += [body.position.x, body.position.y, body.position.z]
        if body.rotation_y is not None:
            updates.append("rotation_y = ?")
            params.append(body.rotation_y)
        if body.scale is not None:
            updates.append("scale = ?")
            params.append(body.scale)
        # C2 fix: clear_room=true explicitly sets room_id to NULL;
        # room_id alone cannot distinguish "null provided" from "not provided".
        if body.clear_room:
            updates.append("room_id = ?")
            params.append(None)
        elif body.room_id is not None:
            updates.append("room_id = ?")
            params.append(body.room_id)

        if not updates:
            return _row_to_response(row)

        params.append(placed_id)
        await db.execute(
            f"UPDATE placed_props SET {', '.join(updates)} WHERE id = ?",
            params,
        )
        await db.commit()

        async with db.execute(SQL_GET_PLACED_PROP, (placed_id,)) as cursor:
            updated_row = await cursor.fetchone()

    placed = _row_to_response(dict(updated_row))
    await broadcast("prop_update", _to_broadcast_data(placed, "move"))
    logger.info(f"[Creator] Updated placed prop {placed_id}")

    return placed


@router.delete("/{placed_id}", status_code=204, responses={404: {"description": "Not found"}})
async def delete_placed_prop(
    placed_id: str,
    key: Annotated[APIKeyInfo, Depends(require_scope("manage"))],
):
    """Remove a placed prop from the world. Requires manage scope."""
    async with get_db() as db:
        async with db.execute(SQL_GET_PLACED_PROP, (placed_id,)) as cursor:
            row = await cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Placed prop not found.")

        row = dict(row)
        placed = _row_to_response(row)

        await db.execute("DELETE FROM placed_props WHERE id = ?", (placed_id,))
        await db.commit()

    await broadcast(
        "prop_update",
        {
            **_to_broadcast_data(placed, "remove"),
            "action": "remove",
        },
    )
    logger.info(f"[Creator] Deleted placed prop {placed_id}")
