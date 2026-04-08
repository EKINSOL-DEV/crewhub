"""Notification rules CRUD."""
import json
import time
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.db.database import get_db

router = APIRouter(tags=["notifications"])

class NotificationRuleCreate(BaseModel):
    agent_id: Optional[str] = None
    project_id: Optional[str] = None
    rule_type: str  # on_error, on_completion, on_idle, on_permission_wait, on_specific_tool
    config: dict = {}
    enabled: bool = True

class NotificationRuleUpdate(BaseModel):
    rule_type: Optional[str] = None
    config: Optional[dict] = None
    enabled: Optional[bool] = None

@router.get("/api/notifications/rules")
async def list_rules(agent_id: Optional[str] = None):
    async with get_db() as db:
        if agent_id:
            cursor = await db.execute(
                "SELECT * FROM notification_rules WHERE agent_id = ? OR agent_id IS NULL ORDER BY created_at",
                (agent_id,),
            )
        else:
            cursor = await db.execute("SELECT * FROM notification_rules ORDER BY created_at")
        rows = await cursor.fetchall()
    return {"rules": rows}

@router.post("/api/notifications/rules")
async def create_rule(body: NotificationRuleCreate):
    now = int(time.time() * 1000)
    rid = str(uuid.uuid4())
    async with get_db() as db:
        await db.execute(
            "INSERT INTO notification_rules (id, agent_id, project_id, rule_type, config_json, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (rid, body.agent_id, body.project_id, body.rule_type, json.dumps(body.config), body.enabled, now, now),
        )
        await db.commit()
    return {"id": rid, "success": True}

@router.put("/api/notifications/rules/{rule_id}")
async def update_rule(rule_id: str, body: NotificationRuleUpdate):
    now = int(time.time() * 1000)
    async with get_db() as db:
        updates = []
        params = []
        if body.rule_type is not None:
            updates.append("rule_type = ?")
            params.append(body.rule_type)
        if body.config is not None:
            updates.append("config_json = ?")
            params.append(json.dumps(body.config))
        if body.enabled is not None:
            updates.append("enabled = ?")
            params.append(body.enabled)
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        updates.append("updated_at = ?")
        params.append(now)
        params.append(rule_id)
        await db.execute(f"UPDATE notification_rules SET {', '.join(updates)} WHERE id = ?", params)
        await db.commit()
    return {"success": True}

@router.delete("/api/notifications/rules/{rule_id}")
async def delete_rule(rule_id: str):
    async with get_db() as db:
        await db.execute("DELETE FROM notification_rules WHERE id = ?", (rule_id,))
        await db.commit()
    return {"success": True}
