"""Room Assignment Rules API routes."""
import re
import time
import uuid
import logging
from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.database import get_db
from app.db.models import RoomAssignmentRule, RoomAssignmentRuleCreate, RoomAssignmentRuleUpdate
from app.routes.sse import broadcast

logger = logging.getLogger(__name__)
router = APIRouter()

# Valid rule types for validation
VALID_RULE_TYPES = {"keyword", "model", "label_pattern", "session_type", "session_key_contains"}


class BulkRuleItem(BaseModel):
    """A single rule in a bulk update request."""
    room_id: str
    rule_type: str
    rule_value: str
    priority: int = 0


class BulkRulesRequest(BaseModel):
    """Request model for bulk updating all rules."""
    rules: List[BulkRuleItem]


def _validate_rule_type(rule_type: str) -> None:
    """Validate that a rule type is one of the allowed values."""
    if rule_type not in VALID_RULE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid rule_type '{rule_type}'. Allowed: {', '.join(sorted(VALID_RULE_TYPES))}"
        )


def _validate_regex_pattern(rule_type: str, rule_value: str) -> None:
    """If rule_type is label_pattern, test-compile the regex."""
    if rule_type == "label_pattern":
        try:
            re.compile(rule_value)
        except re.error as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid regex pattern '{rule_value}': {e}"
            )


@router.get("", response_model=dict)
async def list_rules():
    """Get all room assignment rules sorted by priority."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            async with db.execute(
                "SELECT * FROM room_assignment_rules ORDER BY priority DESC, created_at ASC"
            ) as cursor:
                rows = await cursor.fetchall()
                rules = [RoomAssignmentRule(**row) for row in rows]
            return {"rules": [r.model_dump() for r in rules]}
        finally:
            await db.close()
    except Exception as e:
        logger.error(f"Failed to list rules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{rule_id}", response_model=RoomAssignmentRule)
async def get_rule(rule_id: str):
    """Get a specific rule by ID."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            async with db.execute(
                "SELECT * FROM room_assignment_rules WHERE id = ?", (rule_id,)
            ) as cursor:
                row = await cursor.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Rule not found")
                return RoomAssignmentRule(**row)
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get rule {rule_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=RoomAssignmentRule)
async def create_rule(rule: RoomAssignmentRuleCreate):
    """Create a new room assignment rule."""
    # Validate rule_type
    _validate_rule_type(rule.rule_type)
    # Validate regex if label_pattern
    _validate_regex_pattern(rule.rule_type, rule.rule_value)
    
    try:
        db = await get_db()
        try:
            now = int(time.time() * 1000)
            rule_id = str(uuid.uuid4())
            
            # Verify room exists
            async with db.execute(
                "SELECT id FROM rooms WHERE id = ?", (rule.room_id,)
            ) as cursor:
                if not await cursor.fetchone():
                    raise HTTPException(status_code=400, detail="Room not found")
            
            await db.execute("""
                INSERT INTO room_assignment_rules (id, room_id, rule_type, rule_value, priority, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (rule_id, rule.room_id, rule.rule_type, rule.rule_value, rule.priority, now))
            await db.commit()
            
            # Return created rule
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            async with db.execute(
                "SELECT * FROM room_assignment_rules WHERE id = ?", (rule_id,)
            ) as cursor:
                row = await cursor.fetchone()
                result = RoomAssignmentRule(**row)
            
            await broadcast("rooms-refresh", {"action": "rule_created", "rule_id": rule_id})
            return result
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create rule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{rule_id}", response_model=RoomAssignmentRule)
async def update_rule(rule_id: str, rule: RoomAssignmentRuleUpdate):
    """Update an existing rule."""
    # Validate rule_type if provided
    update_data = rule.model_dump(exclude_unset=True)
    if "rule_type" in update_data and update_data["rule_type"] is not None:
        _validate_rule_type(update_data["rule_type"])
    # Validate regex if label_pattern (check both new type and value)
    rule_type = update_data.get("rule_type")
    rule_value = update_data.get("rule_value")
    if rule_type == "label_pattern" and rule_value is not None:
        _validate_regex_pattern(rule_type, rule_value)
    
    try:
        db = await get_db()
        try:
            # Check if rule exists
            async with db.execute(
                "SELECT id FROM room_assignment_rules WHERE id = ?", (rule_id,)
            ) as cursor:
                if not await cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Rule not found")
            
            # Build update query dynamically
            updates = []
            values = []
            update_data = rule.model_dump(exclude_unset=True)
            
            for field, value in update_data.items():
                if value is not None:
                    updates.append(f"{field} = ?")
                    values.append(value)
            
            if updates:
                values.append(rule_id)
                await db.execute(
                    f"UPDATE room_assignment_rules SET {', '.join(updates)} WHERE id = ?",
                    values
                )
                await db.commit()
            
            # Return updated rule
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            async with db.execute(
                "SELECT * FROM room_assignment_rules WHERE id = ?", (rule_id,)
            ) as cursor:
                row = await cursor.fetchone()
                result = RoomAssignmentRule(**row)
            
            await broadcast("rooms-refresh", {"action": "rule_updated", "rule_id": rule_id})
            return result
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update rule {rule_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{rule_id}")
async def delete_rule(rule_id: str):
    """Delete a room assignment rule."""
    try:
        db = await get_db()
        try:
            # Check if rule exists
            async with db.execute(
                "SELECT id FROM room_assignment_rules WHERE id = ?", (rule_id,)
            ) as cursor:
                if not await cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Rule not found")
            
            await db.execute(
                "DELETE FROM room_assignment_rules WHERE id = ?", (rule_id,)
            )
            await db.commit()
            
            await broadcast("rooms-refresh", {"action": "rule_deleted", "rule_id": rule_id})
            return {"success": True, "deleted": rule_id}
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete rule {rule_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/bulk", response_model=dict)
async def bulk_update_rules(request: BulkRulesRequest):
    """Replace all rules with a new set (atomic bulk update)."""
    # Validate all rules first before touching the database
    for rule in request.rules:
        _validate_rule_type(rule.rule_type)
        _validate_regex_pattern(rule.rule_type, rule.rule_value)

    try:
        db = await get_db()
        try:
            # Validate all room_ids exist
            for rule in request.rules:
                async with db.execute(
                    "SELECT id FROM rooms WHERE id = ?", (rule.room_id,)
                ) as cursor:
                    if not await cursor.fetchone():
                        raise HTTPException(
                            status_code=400,
                            detail=f"Room not found: {rule.room_id}"
                        )

            # Delete all existing rules
            await db.execute("DELETE FROM room_assignment_rules")

            # Insert new rules
            now = int(time.time() * 1000)
            for rule in request.rules:
                rule_id = str(uuid.uuid4())
                await db.execute("""
                    INSERT INTO room_assignment_rules (id, room_id, rule_type, rule_value, priority, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (rule_id, rule.room_id, rule.rule_type, rule.rule_value, rule.priority, now))

            await db.commit()

            # Fetch and return the new rules
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            async with db.execute(
                "SELECT * FROM room_assignment_rules ORDER BY priority DESC, created_at ASC"
            ) as cursor:
                rows = await cursor.fetchall()
                rules = [RoomAssignmentRule(**row) for row in rows]

            await broadcast("rooms-refresh", {"action": "rules_bulk_updated", "count": len(rules)})
            return {"rules": [r.model_dump() for r in rules], "count": len(rules)}
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to bulk update rules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/room/{room_id}", response_model=dict)
async def get_rules_for_room(room_id: str):
    """Get all rules for a specific room."""
    try:
        db = await get_db()
        try:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            async with db.execute(
                "SELECT * FROM room_assignment_rules WHERE room_id = ? ORDER BY priority DESC",
                (room_id,)
            ) as cursor:
                rows = await cursor.fetchall()
                rules = [RoomAssignmentRule(**row) for row in rows]
            return {"rules": [r.model_dump() for r in rules]}
        finally:
            await db.close()
    except Exception as e:
        logger.error(f"Failed to get rules for room {room_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
