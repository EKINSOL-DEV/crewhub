"""Agent pipeline routes."""
import json
import time
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.db.database import get_db

router = APIRouter(tags=["pipelines"])

class PipelineStep(BaseModel):
    agent_id: str
    prompt_template: str
    timeout_seconds: int = 300

class PipelineCreate(BaseModel):
    name: str
    description: str = ""
    steps: list[PipelineStep]

class PipelineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    steps: Optional[list[PipelineStep]] = None

@router.get("/api/pipelines")
async def list_pipelines():
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM pipelines ORDER BY created_at DESC")
        rows = await cursor.fetchall()
    return {"pipelines": rows}

@router.post("/api/pipelines")
async def create_pipeline(body: PipelineCreate):
    now = int(time.time() * 1000)
    pid = str(uuid.uuid4())
    steps_json = json.dumps([s.model_dump() for s in body.steps])
    async with get_db() as db:
        await db.execute(
            "INSERT INTO pipelines (id, name, description, steps_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (pid, body.name, body.description, steps_json, now, now),
        )
        await db.commit()
    return {"id": pid, "success": True}

@router.get("/api/pipelines/{pipeline_id}")
async def get_pipeline(pipeline_id: str):
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM pipelines WHERE id = ?", (pipeline_id,))
        row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return row

@router.put("/api/pipelines/{pipeline_id}")
async def update_pipeline(pipeline_id: str, body: PipelineUpdate):
    now = int(time.time() * 1000)
    async with get_db() as db:
        updates = []
        params = []
        if body.name is not None:
            updates.append("name = ?")
            params.append(body.name)
        if body.description is not None:
            updates.append("description = ?")
            params.append(body.description)
        if body.steps is not None:
            updates.append("steps_json = ?")
            params.append(json.dumps([s.model_dump() for s in body.steps]))
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        updates.append("updated_at = ?")
        params.append(now)
        params.append(pipeline_id)
        await db.execute(f"UPDATE pipelines SET {', '.join(updates)} WHERE id = ?", params)
        await db.commit()
    return {"success": True}

@router.delete("/api/pipelines/{pipeline_id}")
async def delete_pipeline(pipeline_id: str):
    async with get_db() as db:
        await db.execute("DELETE FROM pipeline_runs WHERE pipeline_id = ?", (pipeline_id,))
        await db.execute("DELETE FROM pipelines WHERE id = ?", (pipeline_id,))
        await db.commit()
    return {"success": True}

@router.post("/api/pipelines/{pipeline_id}/run")
async def run_pipeline(pipeline_id: str):
    """Start a pipeline run (executes steps sequentially)."""
    now = int(time.time() * 1000)
    run_id = str(uuid.uuid4())
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM pipelines WHERE id = ?", (pipeline_id,))
        pipeline = await cursor.fetchone()
        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")
        await db.execute(
            "INSERT INTO pipeline_runs (id, pipeline_id, status, started_at, created_at) VALUES (?, ?, 'running', ?, ?)",
            (run_id, pipeline_id, now, now),
        )
        await db.commit()
    # Execution happens asynchronously - for now return the run ID
    # Full orchestration would use asyncio.create_task with cc_chat
    return {"run_id": run_id, "status": "running"}

@router.get("/api/pipelines/{pipeline_id}/runs")
async def list_pipeline_runs(pipeline_id: str):
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT * FROM pipeline_runs WHERE pipeline_id = ? ORDER BY created_at DESC",
            (pipeline_id,),
        )
        rows = await cursor.fetchall()
    return {"runs": rows}
