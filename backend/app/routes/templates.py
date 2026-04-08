"""Prompt template CRUD routes."""
import time
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.db.database import get_db

router = APIRouter(tags=["templates"])

class TemplateCreate(BaseModel):
    name: str
    template: str
    project_id: Optional[str] = None
    variables: list[str] = []

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    template: Optional[str] = None
    variables: Optional[list[str]] = None

@router.get("/api/templates")
async def list_templates(project_id: Optional[str] = None):
    async with get_db() as db:
        if project_id:
            cursor = await db.execute(
                "SELECT * FROM prompt_templates WHERE project_id = ? OR project_id IS NULL ORDER BY name",
                (project_id,),
            )
        else:
            cursor = await db.execute("SELECT * FROM prompt_templates ORDER BY name")
        rows = await cursor.fetchall()
    return {"templates": rows}

@router.post("/api/templates")
async def create_template(body: TemplateCreate):
    now = int(time.time() * 1000)
    tid = str(uuid.uuid4())
    async with get_db() as db:
        await db.execute(
            "INSERT INTO prompt_templates (id, project_id, name, template, variables, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (tid, body.project_id, body.name, body.template, str(body.variables), now, now),
        )
        await db.commit()
    return {"id": tid, "success": True}

@router.put("/api/templates/{template_id}")
async def update_template(template_id: str, body: TemplateUpdate):
    now = int(time.time() * 1000)
    async with get_db() as db:
        updates = []
        params = []
        if body.name is not None:
            updates.append("name = ?")
            params.append(body.name)
        if body.template is not None:
            updates.append("template = ?")
            params.append(body.template)
        if body.variables is not None:
            updates.append("variables = ?")
            params.append(str(body.variables))
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        updates.append("updated_at = ?")
        params.append(now)
        params.append(template_id)
        await db.execute(f"UPDATE prompt_templates SET {', '.join(updates)} WHERE id = ?", params)
        await db.commit()
    return {"success": True}

@router.delete("/api/templates/{template_id}")
async def delete_template(template_id: str):
    async with get_db() as db:
        await db.execute("DELETE FROM prompt_templates WHERE id = ? AND is_builtin = FALSE", (template_id,))
        await db.commit()
    return {"success": True}
