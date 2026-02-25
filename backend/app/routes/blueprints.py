"""
API routes for custom blueprint management (modding).

Provides CRUD endpoints for custom room blueprints,
plus import/export functionality for sharing blueprints as JSON files.
"""

import json
import logging
import re
import time
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel

from ..db.database import get_db
from ..db.models import (
    BlueprintJson,
    CustomBlueprintCreate,
    CustomBlueprintResponse,
    CustomBlueprintUpdate,
    generate_id,
)
from .sse import broadcast

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/blueprints", tags=["blueprints"])

# =============================================================================
# Constants
# =============================================================================

MAX_GRID_SIZE = 40
MIN_GRID_SIZE = 4

# Known prop IDs from the built-in registry (Phase 1c).
# This list is used for validation; unknown propIds trigger a warning, not a hard error,
# since custom props may be added by mods.
KNOWN_PROP_IDS = {
    # Furniture
    "desk-with-monitor",
    "desk-with-dual-monitors",
    "desk-small",
    "desk-large",
    "conference-table",
    "round-table",
    "chair",
    "office-chair",
    "couch",
    "couch-l-shaped",
    "bookshelf",
    "bookshelf-tall",
    "filing-cabinet",
    "locker",
    "wardrobe",
    "bed",
    "bunk-bed",
    "workbench",
    "standing-desk",
    # Tech
    "server-rack",
    "monitor-wall",
    "projector-screen",
    "cable-mess",
    "satellite-dish",
    "antenna",
    "router-hub",
    # Decoration
    "plant",
    "plant-large",
    "plant-hanging",
    "flower-pot",
    "lamp",
    "lamp-floor",
    "lamp-desk",
    "ceiling-light",
    "rug",
    "rug-large",
    "painting",
    "notice-board",
    "whiteboard",
    "clock",
    "trophy",
    "globe",
    # Kitchen / break
    "coffee-machine",
    "water-cooler",
    "vending-machine",
    "fridge",
    "microwave",
    # Interaction markers
    "work-point",
    "work-point-1",
    "work-point-2",
    "work-point-3",
    "work-point-4",
    "coffee-point",
    "sleep-corner",
}

VALID_INTERACTION_TYPES = {"work", "coffee", "sleep"}


# =============================================================================
# Validation
# =============================================================================


def validate_blueprint(bp: BlueprintJson) -> tuple[list[str], list[str]]:
    """
    Validate a blueprint JSON structure.

    Returns a tuple of (errors, warnings).
    Empty errors list = valid. Warnings are informational.
    """
    errors: list[str] = []
    warnings: list[str] = []

    # Grid dimensions
    if bp.gridWidth < MIN_GRID_SIZE or bp.gridWidth > MAX_GRID_SIZE:
        errors.append(f"gridWidth must be between {MIN_GRID_SIZE} and {MAX_GRID_SIZE}, got {bp.gridWidth}")
    if bp.gridDepth < MIN_GRID_SIZE or bp.gridDepth > MAX_GRID_SIZE:
        errors.append(f"gridDepth must be between {MIN_GRID_SIZE} and {MAX_GRID_SIZE}, got {bp.gridDepth}")

    # Must have at least one door
    if not bp.doors and not bp.doorPositions:
        errors.append("Blueprint must have at least one door")

    # Validate walkable center unconditionally (it's a required field)
    if bp.walkableCenter.x < 0 or bp.walkableCenter.x >= bp.gridWidth:
        errors.append(f"walkableCenter.x ({bp.walkableCenter.x}) out of grid bounds (0-{bp.gridWidth - 1})")
    if bp.walkableCenter.z < 0 or bp.walkableCenter.z >= bp.gridDepth:
        errors.append(f"walkableCenter.z ({bp.walkableCenter.z}) out of grid bounds (0-{bp.gridDepth - 1})")

    # Validate placements
    occupied: dict[tuple[int, int], str] = {}
    for i, p in enumerate(bp.placements):
        # Check bounds
        if p.x < 0 or p.x >= bp.gridWidth or p.z < 0 or p.z >= bp.gridDepth:
            errors.append(f"Placement [{i}] propId='{p.propId}' at ({p.x},{p.z}) is out of grid bounds")
            continue

        # Check span bounds
        span_w = p.span.w if p.span else 1
        span_d = p.span.d if p.span else 1
        if p.x + span_w > bp.gridWidth:
            errors.append(f"Placement [{i}] propId='{p.propId}' span exceeds grid width at x={p.x}, span.w={span_w}")
        if p.z + span_d > bp.gridDepth:
            errors.append(f"Placement [{i}] propId='{p.propId}' span exceeds grid depth at z={p.z}, span.d={span_d}")

        # Check for overlap (only for non-interaction props)
        if p.type != "interaction":
            for dx in range(span_w):
                for dz in range(span_d):
                    cell = (p.x + dx, p.z + dz)
                    if cell in occupied:
                        errors.append(
                            f"Placement [{i}] propId='{p.propId}' overlaps with '{occupied[cell]}' at cell {cell}"
                        )
                    else:
                        occupied[cell] = p.propId

        # Warn on unknown propIds (not a hard error — mods can add custom props)
        if p.propId not in KNOWN_PROP_IDS:
            warnings.append(f"Unknown propId '{p.propId}' in placement [{i}] (may be from a mod)")

        # Validate interaction type if present
        if p.interactionType and p.interactionType not in VALID_INTERACTION_TYPES:
            errors.append(
                f"Placement [{i}] has unknown interactionType '{p.interactionType}'. Valid: {VALID_INTERACTION_TYPES}"
            )

    # Helper to validate doors are on wall edges
    def _validate_doors(door_list: list, label: str):
        for i, door in enumerate(door_list):
            on_edge = door.x == 0 or door.x == bp.gridWidth - 1 or door.z == 0 or door.z == bp.gridDepth - 1
            if not on_edge:
                errors.append(
                    f"{label}[{i}] at ({door.x},{door.z}) must be on a wall edge "
                    f"(x=0, x={bp.gridWidth - 1}, z=0, or z={bp.gridDepth - 1})"
                )

    # Validate both door fields
    _validate_doors(bp.doors, "doors")
    _validate_doors(bp.doorPositions, "doorPositions")

    # Warn if both door fields are present and counts differ
    if bp.doors and bp.doorPositions and len(bp.doors) != len(bp.doorPositions):
        warnings.append(
            f"doors ({len(bp.doors)} entries) and doorPositions ({len(bp.doorPositions)} entries) "
            f"have different counts — consider using a single canonical field"
        )

    return errors, warnings


# =============================================================================
# Helper
# =============================================================================


def row_to_response(row: dict) -> dict:
    """Convert a database row to a response dict."""
    bp_json = json.loads(row["blueprint_json"]) if isinstance(row["blueprint_json"], str) else row["blueprint_json"]
    return {
        "id": row["id"],
        "name": row["name"],
        "room_id": row.get("room_id"),
        "blueprint": bp_json,
        "source": row["source"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


# =============================================================================
# Routes
# =============================================================================


@router.get("")
async def list_blueprints(
    source: Optional[str] = None,
    room_id: Optional[str] = None,
) -> list[CustomBlueprintResponse]:
    """
    List all custom blueprints.

    Optional filters:
    - source: filter by source ('user', 'import', 'mod')
    - room_id: filter by associated room
    """
    async with get_db() as db:
        query = "SELECT * FROM custom_blueprints WHERE 1=1"
        params: list = []

        if source:
            query += " AND source = ?"
            params.append(source)
        if room_id:
            query += " AND room_id = ?"
            params.append(room_id)

        query += " ORDER BY updated_at DESC"

        async with db.execute(query, params) as cursor:
            rows = await cursor.fetchall()

    return [row_to_response(row) for row in rows]


@router.get("/export/{blueprint_id}")
async def export_blueprint(blueprint_id: str):
    """
    Export a blueprint as a downloadable JSON file.

    Returns the blueprint JSON with Content-Disposition header for download.
    """
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM custom_blueprints WHERE id = ?",
            (blueprint_id,),
        ) as cursor:
            row = await cursor.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Blueprint not found: {blueprint_id}",
        )

    bp_json = json.loads(row["blueprint_json"]) if isinstance(row["blueprint_json"], str) else row["blueprint_json"]

    # Pretty-print JSON for readable export
    content = json.dumps(bp_json, indent=2, ensure_ascii=False)
    # Strict sanitize: only allow [a-z0-9-_], strip everything else
    safe_name = re.sub(r"[^a-z0-9\-_]", "", row["name"].replace(" ", "-").lower())
    safe_name = safe_name.strip("-_")
    if not safe_name:
        safe_name = "blueprint"

    return Response(
        content=content,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}.json"',
        },
    )


@router.get("/{blueprint_id}", response_model=CustomBlueprintResponse)
async def get_blueprint(blueprint_id: str):
    """Get a single custom blueprint by ID."""
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM custom_blueprints WHERE id = ?",
            (blueprint_id,),
        ) as cursor:
            row = await cursor.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Blueprint not found: {blueprint_id}",
        )

    return row_to_response(row)


@router.post("", response_model=CustomBlueprintResponse, status_code=status.HTTP_201_CREATED)
async def create_blueprint(body: CustomBlueprintCreate):
    """
    Create a new custom blueprint.

    Validates the blueprint JSON structure before storing.
    """
    # Validate blueprint
    errors, warnings = validate_blueprint(body.blueprint)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Blueprint validation failed", "errors": errors, "warnings": warnings},
        )

    blueprint_id = body.blueprint.id or generate_id()
    now = int(time.time() * 1000)
    blueprint_json = body.blueprint.model_dump()

    # Ensure the stored blueprint has the correct ID
    blueprint_json["id"] = blueprint_id

    async with get_db() as db:
        # Check for duplicate ID
        async with db.execute(
            "SELECT id FROM custom_blueprints WHERE id = ?",
            (blueprint_id,),
        ) as cursor:
            existing = await cursor.fetchone()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Blueprint with id '{blueprint_id}' already exists",
            )

        await db.execute(
            """
            INSERT INTO custom_blueprints (id, name, room_id, blueprint_json, source, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                blueprint_id,
                body.name,
                body.room_id,
                json.dumps(blueprint_json),
                body.source,
                now,
                now,
            ),
        )
        await db.commit()

    logger.info(f"Blueprint created: {blueprint_id} ({body.name})")

    response = {
        "id": blueprint_id,
        "name": body.name,
        "room_id": body.room_id,
        "blueprint": blueprint_json,
        "source": body.source,
        "created_at": now,
        "updated_at": now,
    }
    if warnings:
        response["warnings"] = warnings
    return response


@router.post("/import", response_model=CustomBlueprintResponse, status_code=status.HTTP_201_CREATED)
async def import_blueprint(body: BlueprintJson):
    """
    Import a blueprint from a raw JSON blueprint file.

    Accepts the blueprint JSON directly (as exported by /export/{id}).
    Sets source to 'import'.
    """
    # Validate
    errors, warnings = validate_blueprint(body)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Blueprint validation failed", "errors": errors, "warnings": warnings},
        )

    blueprint_id = body.id or generate_id()
    now = int(time.time() * 1000)
    blueprint_json = body.model_dump()
    blueprint_json["id"] = blueprint_id

    async with get_db() as db:
        # Check for duplicate — on import, generate a new ID if collision
        async with db.execute(
            "SELECT id FROM custom_blueprints WHERE id = ?",
            (blueprint_id,),
        ) as cursor:
            existing = await cursor.fetchone()

        if existing:
            blueprint_id = generate_id()
            blueprint_json["id"] = blueprint_id

        await db.execute(
            """
            INSERT INTO custom_blueprints (id, name, room_id, blueprint_json, source, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                blueprint_id,
                body.name,
                None,
                json.dumps(blueprint_json),
                "import",
                now,
                now,
            ),
        )
        await db.commit()

    logger.info(f"Blueprint imported: {blueprint_id} ({body.name})")

    response = {
        "id": blueprint_id,
        "name": body.name,
        "room_id": None,
        "blueprint": blueprint_json,
        "source": "import",
        "created_at": now,
        "updated_at": now,
    }
    if warnings:
        response["warnings"] = warnings
    return response


@router.put("/{blueprint_id}", response_model=CustomBlueprintResponse)
async def update_blueprint(blueprint_id: str, body: CustomBlueprintUpdate):
    """
    Update an existing custom blueprint.

    Only provided fields are updated (partial update).
    """
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM custom_blueprints WHERE id = ?",
            (blueprint_id,),
        ) as cursor:
            row = await cursor.fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Blueprint not found: {blueprint_id}",
            )

        # Build update
        now = int(time.time() * 1000)
        name = body.name if body.name is not None else row["name"]
        room_id = body.room_id if body.room_id is not None else row.get("room_id")
        source = body.source if body.source is not None else row["source"]

        update_warnings: list[str] = []
        if body.blueprint is not None:
            # Validate the new blueprint
            errors, update_warnings = validate_blueprint(body.blueprint)
            if errors:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={"message": "Blueprint validation failed", "errors": errors, "warnings": update_warnings},
                )
            bp_json = body.blueprint.model_dump()
            bp_json["id"] = blueprint_id
            blueprint_json_str = json.dumps(bp_json)
        else:
            blueprint_json_str = row["blueprint_json"]
            bp_json = json.loads(blueprint_json_str) if isinstance(blueprint_json_str, str) else blueprint_json_str

        await db.execute(
            """
            UPDATE custom_blueprints
            SET name = ?, room_id = ?, blueprint_json = ?, source = ?, updated_at = ?
            WHERE id = ?
            """,
            (name, room_id, blueprint_json_str, source, now, blueprint_id),
        )
        await db.commit()

    logger.info(f"Blueprint updated: {blueprint_id}")

    response = {
        "id": blueprint_id,
        "name": name,
        "room_id": room_id,
        "blueprint": bp_json,
        "source": source,
        "created_at": row["created_at"],
        "updated_at": now,
    }
    if update_warnings:
        response["warnings"] = update_warnings
    return response


@router.delete("/{blueprint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_blueprint(blueprint_id: str):
    """Delete a custom blueprint by ID."""
    async with get_db() as db:
        cursor = await db.execute(
            "DELETE FROM custom_blueprints WHERE id = ?",
            (blueprint_id,),
        )
        await db.commit()
        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Blueprint not found: {blueprint_id}",
            )

    logger.info(f"Blueprint deleted: {blueprint_id}")


# =============================================================================
# Prop Movement & Deletion (Interactive Editing)
# =============================================================================


class MovePropRequest(BaseModel):
    """Request body for moving a prop within a blueprint."""

    propId: str
    fromX: int
    fromZ: int
    toX: int
    toZ: int
    rotation: Optional[int] = None
    span: Optional[dict] = None  # Updated span after rotation (w/d swapped)


class DeletePropRequest(BaseModel):
    """Request body for deleting a prop from a blueprint."""

    propId: str
    x: int
    z: int


import os

# =============================================================================
# Blueprint load/save helpers (reduces duplication in move_prop / delete_prop)
# =============================================================================

_BLUEPRINT_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "frontend", "src", "lib", "grid", "blueprints"
)


def _sanitize_blueprint_id(blueprint_id: str) -> str:
    """Sanitize blueprint_id to prevent path traversal."""
    safe_id = re.sub(r"[^a-zA-Z0-9_-]", "", blueprint_id)
    if not safe_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid blueprint ID")
    return safe_id


async def _load_blueprint(blueprint_id: str) -> tuple[dict, Optional[dict], str]:
    """
    Load a blueprint by ID.

    Returns (bp_json, db_row_or_None, source).
    source is 'db' or 'file'.
    Raises HTTPException if not found.
    """
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM custom_blueprints WHERE id = ?",
            (blueprint_id,),
        ) as cursor:
            row = await cursor.fetchone()

    if row:
        bp_json = json.loads(row["blueprint_json"]) if isinstance(row["blueprint_json"], str) else row["blueprint_json"]
        return bp_json, row, "db"

    # Try built-in blueprint file (with path traversal protection)
    safe_id = _sanitize_blueprint_id(blueprint_id)
    blueprint_path = os.path.join(_BLUEPRINT_DIR, f"{safe_id}.json")
    abs_path = os.path.abspath(blueprint_path)
    abs_dir = os.path.abspath(_BLUEPRINT_DIR)
    if not abs_path.startswith(abs_dir + os.sep) and abs_path != abs_dir:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid blueprint ID")

    if not os.path.exists(blueprint_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Blueprint not found: {blueprint_id}",
        )

    with open(blueprint_path) as f:
        bp_json = json.load(f)
    return bp_json, None, "file"


async def _save_blueprint(blueprint_id: str, bp_json: dict, db_row: Optional[dict], source: str) -> None:
    """Save a blueprint back to its source (db or file)."""
    if source == "db":
        now = int(time.time() * 1000)
        async with get_db() as db:
            await db.execute(
                "UPDATE custom_blueprints SET blueprint_json = ?, updated_at = ? WHERE id = ?",
                (json.dumps(bp_json), now, blueprint_id),
            )
            await db.commit()
    else:
        safe_id = _sanitize_blueprint_id(blueprint_id)
        blueprint_path = os.path.join(_BLUEPRINT_DIR, f"{safe_id}.json")
        with open(blueprint_path, "w") as f:
            json.dump(bp_json, f, indent=2)


def _validate_bounds(x: int, z: int, grid_width: int, grid_depth: int, span_w: int = 1, span_d: int = 1) -> None:
    """Validate that position + span is within grid bounds.

    Props can be placed at any cell 0..gridSize-1 (walls are visual 3D geometry,
    not grid occupants).
    """
    if x < 0 or z < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Position ({x},{z}) is outside room bounds"
        )
    if x + span_w > grid_width:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Position x={x} + span w={span_w} exceeds grid width {grid_width}",
        )
    if z + span_d > grid_depth:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Position z={z} + span d={span_d} exceeds grid depth {grid_depth}",
        )


def _check_overlap(
    placements: list[dict], x: int, z: int, span_w: int, span_d: int, exclude_index: Optional[int] = None
) -> None:
    """Check for overlap with other props. exclude_index is the index of the prop being moved."""
    for i, p in enumerate(placements):
        if i == exclude_index:
            continue
        if p.get("type") == "interaction":
            continue
        p_span = p.get("span") or {}
        pw = p_span.get("w", 1)
        pd = p_span.get("d", 1)
        px, pz = p.get("x", 0), p.get("z", 0)
        if x < px + pw and x + span_w > px and z < pz + pd and z + span_d > pz:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Position ({x},{z}) overlaps with prop '{p.get('propId')}' at ({px},{pz})",
            )


@router.patch("/{blueprint_id}/move-prop")
async def move_prop(blueprint_id: str, body: MovePropRequest):
    """
    Move a prop to a new position within a blueprint.

    Updates the placement in the blueprint JSON and broadcasts the change via SSE.
    Works with both custom blueprints (database) and built-in blueprints (JSON files).
    """
    bp_json, db_row, source = await _load_blueprint(blueprint_id)
    placements = bp_json.get("placements", [])
    grid_width = bp_json.get("gridWidth", 20)
    grid_depth = bp_json.get("gridDepth", 20)

    # Find the placement
    found_index = None
    for i, p in enumerate(placements):
        if p.get("propId") == body.propId and p.get("x") == body.fromX and p.get("z") == body.fromZ:
            found_index = i
            break

    if found_index is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prop '{body.propId}' not found at position ({body.fromX}, {body.fromZ})",
        )

    # Determine span — use request span if provided (rotation may have swapped w/d),
    # otherwise fall back to the stored span.
    prop = placements[found_index]
    if body.span and "w" in body.span and "d" in body.span:
        span_w = body.span["w"]
        span_d = body.span["d"]
    else:
        span = prop.get("span") or {}
        span_w = span.get("w", 1)
        span_d = span.get("d", 1)

    # Server-side validation: bounds check
    _validate_bounds(body.toX, body.toZ, grid_width, grid_depth, span_w, span_d)

    # Server-side validation: overlap check (exclude the prop being moved)
    _check_overlap(placements, body.toX, body.toZ, span_w, span_d, exclude_index=found_index)

    # Apply the move
    prop["x"] = body.toX
    prop["z"] = body.toZ
    if body.rotation is not None:
        prop["rotation"] = body.rotation
    if body.span and "w" in body.span and "d" in body.span:
        prop["span"] = {"w": span_w, "d": span_d}

    await _save_blueprint(blueprint_id, bp_json, db_row, source)
    logger.info(
        f"Prop moved in blueprint {blueprint_id}: {body.propId} from ({body.fromX},{body.fromZ}) to ({body.toX},{body.toZ})"
    )

    # Broadcast update to all clients
    await broadcast(
        "blueprint-update",
        {
            "blueprintId": blueprint_id,
            "action": "prop-moved",
            "propId": body.propId,
            "fromX": body.fromX,
            "fromZ": body.fromZ,
            "toX": body.toX,
            "toZ": body.toZ,
            "rotation": body.rotation,
        },
    )

    return {"success": True, "blueprintId": blueprint_id}


@router.delete("/{blueprint_id}/delete-prop")
async def delete_prop(blueprint_id: str, body: DeletePropRequest):
    """
    Delete a prop from a blueprint.

    Removes the placement from the blueprint JSON and broadcasts the change via SSE.
    """
    bp_json, db_row, source = await _load_blueprint(blueprint_id)
    placements = bp_json.get("placements", [])

    # Find and remove the placement
    original_len = len(placements)
    placements = [
        p for p in placements if not (p.get("propId") == body.propId and p.get("x") == body.x and p.get("z") == body.z)
    ]

    if len(placements) == original_len:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prop '{body.propId}' not found at position ({body.x}, {body.z})",
        )

    bp_json["placements"] = placements
    await _save_blueprint(blueprint_id, bp_json, db_row, source)
    logger.info(f"Prop deleted from blueprint {blueprint_id}: {body.propId} at ({body.x},{body.z})")

    # Broadcast update to all clients
    await broadcast(
        "blueprint-update",
        {
            "blueprintId": blueprint_id,
            "action": "prop-deleted",
            "propId": body.propId,
            "x": body.x,
            "z": body.z,
        },
    )

    return {"success": True, "blueprintId": blueprint_id}
