"""Creator Zone — prop CRUD helpers.

Blueprint usage lookup, cascade-delete logic, and part mutation helpers.
No FastAPI / HTTP concerns here.
"""

from __future__ import annotations

import json
import logging

logger = logging.getLogger(__name__)


# ─── Part helpers ─────────────────────────────────────────────────


def apply_color_changes_to_parts(parts: list[dict], color_changes: dict) -> list[dict]:
    """Return a new parts list with colors remapped per ``{old: new}`` mapping."""
    if not color_changes or not parts:
        return parts
    updated = []
    for part in parts:
        p = dict(part)
        for old_c, new_c in color_changes.items():
            if p.get("color", "").lower() == old_c.lower():
                p["color"] = new_c
                break
        updated.append(p)
    return updated


def persist_refined_prop(prop_id: str, refined_code: str, parts: list[dict]) -> None:
    """Write refined code + parts back to the generation-history JSON."""
    from .prop_generator import load_generation_history, save_generation_history

    history = load_generation_history()
    for record in history:
        if record.get("id") == prop_id:
            record["code"] = refined_code
            record["parts"] = parts
            break
    save_generation_history(history)


# ─── Blueprint usage ──────────────────────────────────────────────


async def find_prop_usage_in_blueprints(prop_name: str) -> list[dict]:
    """Return blueprint placements that reference *prop_name*."""
    from ...db.database import get_db

    placements: list[dict] = []
    try:
        async with get_db() as db:
            cursor = await db.execute("SELECT id, name, room_id, blueprint_json FROM custom_blueprints")
            rows = await cursor.fetchall()
            for row in rows:
                bp_json = row["blueprint_json"]
                if isinstance(bp_json, str):
                    bp_json = json.loads(bp_json)
                instances = [p for p in bp_json.get("placements", []) if p.get("propId") == prop_name]
                if instances:
                    placements.append(
                        {
                            "blueprintId": row["id"],
                            "blueprintName": row["name"],
                            "roomId": row["room_id"],
                            "instanceCount": len(instances),
                        }
                    )
    except Exception as exc:
        logger.error(f"Error checking prop usage in blueprints: {exc}")
    return placements


async def cascade_delete_prop_from_blueprints(placements: list[dict], prop_name: str) -> tuple[list[str], int]:
    """Remove every placement of *prop_name* from the given blueprints.

    Returns ``(room_names_affected, total_instances_removed)``.
    """
    from ...db.database import get_db

    deleted_rooms: list[str] = []
    total_removed = 0

    async with get_db() as db:
        for placement in placements:
            cursor = await db.execute(
                "SELECT id, blueprint_json FROM custom_blueprints WHERE id = ?",
                (placement["blueprintId"],),
            )
            row = await cursor.fetchone()
            if not row:
                continue
            bp_json = row["blueprint_json"]
            if isinstance(bp_json, str):
                bp_json = json.loads(bp_json)

            original_count = len(bp_json.get("placements", []))
            bp_json["placements"] = [p for p in bp_json.get("placements", []) if p.get("propId") != prop_name]
            removed = original_count - len(bp_json["placements"])
            total_removed += removed
            deleted_rooms.append(placement.get("blueprintName", placement["blueprintId"]))

            await db.execute(
                "UPDATE custom_blueprints SET blueprint_json = ? WHERE id = ?",
                (json.dumps(bp_json), placement["blueprintId"]),
            )
        await db.commit()

    return deleted_rooms, total_removed
