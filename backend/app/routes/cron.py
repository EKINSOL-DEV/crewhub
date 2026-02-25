"""
Cron job management routes.
Full CRUD operations for OpenClaw cron jobs via ConnectionManager.
"""

from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, model_validator

from ..services.connections import get_connection_manager

router = APIRouter()


class ScheduleConfig(BaseModel):
    kind: Literal["at", "every", "cron"]
    atMs: Optional[int] = None  # for kind="at"
    everyMs: Optional[int] = None  # for kind="every"
    anchorMs: Optional[int] = None  # for kind="every"
    expr: Optional[str] = None  # for kind="cron"
    tz: Optional[str] = None  # for kind="cron"

    @model_validator(mode="after")
    def validate_kind_fields(self):
        if self.kind == "at" and self.atMs is None:
            raise ValueError("schedule.atMs is required when kind='at'")
        if self.kind == "every" and (self.everyMs is None or self.everyMs <= 0):
            raise ValueError("schedule.everyMs must be > 0 when kind='every'")
        if self.kind == "cron" and not self.expr:
            raise ValueError("schedule.expr is required when kind='cron'")
        return self


class PayloadConfig(BaseModel):
    kind: Literal["systemEvent", "agentTurn"]
    text: Optional[str] = None  # for kind="systemEvent"
    message: Optional[str] = None  # for kind="agentTurn"
    model: Optional[str] = None  # for kind="agentTurn"
    thinking: Optional[str] = None  # for kind="agentTurn"
    timeoutSeconds: Optional[int] = None  # for kind="agentTurn"

    @model_validator(mode="after")
    def validate_payload_fields(self):
        if self.kind == "systemEvent" and not self.text:
            raise ValueError("payload.text is required for systemEvent")
        if self.kind == "agentTurn" and not self.message:
            raise ValueError("payload.message is required for agentTurn")
        return self


class CronJobCreate(BaseModel):
    schedule: ScheduleConfig
    payload: PayloadConfig
    sessionTarget: Literal["main", "isolated"] = "main"
    name: Optional[str] = None
    enabled: bool = True


class CronJobUpdate(BaseModel):
    schedule: Optional[ScheduleConfig] = None
    payload: Optional[PayloadConfig] = None
    sessionTarget: Optional[Literal["main", "isolated"]] = None
    name: Optional[str] = None
    enabled: Optional[bool] = None


async def _get_openclaw():
    """Get the default OpenClaw connection or raise 503."""
    manager = await get_connection_manager()
    conn = manager.get_default_openclaw()
    if not conn:
        raise HTTPException(status_code=503, detail="No OpenClaw connection available")
    return conn


@router.get("/jobs")
async def list_cron_jobs(all: bool = True):
    """Get all cron jobs."""
    conn = await _get_openclaw()
    jobs = await conn.list_cron_jobs(all_jobs=all)
    return {"jobs": jobs}


@router.post("/jobs", responses={500: {"description": "Internal server error"}})
async def create_cron_job(job: CronJobCreate):
    """Create a new cron job."""
    conn = await _get_openclaw()

    # Convert Pydantic models to dicts, excluding None values
    schedule_dict = {k: v for k, v in job.schedule.model_dump().items() if v is not None}
    payload_dict = {k: v for k, v in job.payload.model_dump().items() if v is not None}

    result = await conn.create_cron_job(
        schedule=schedule_dict,
        payload=payload_dict,
        session_target=job.sessionTarget,
        name=job.name,
        enabled=job.enabled,
    )

    if result is None:
        raise HTTPException(status_code=500, detail="Failed to create cron job")

    return result


@router.get("/jobs/{job_id}", responses={404: {"description": "Not found"}})
async def get_cron_job(job_id: str):
    """Get a specific cron job by ID."""
    conn = await _get_openclaw()
    jobs = await conn.list_cron_jobs(all_jobs=True)

    job = next((j for j in jobs if j.get("id") == job_id), None)

    if job is None:
        raise HTTPException(status_code=404, detail="Cron job not found")

    return job


@router.patch("/jobs/{job_id}", responses={500: {"description": "Internal server error"}})
async def update_cron_job(job_id: str, update: CronJobUpdate):
    """Update a cron job."""
    conn = await _get_openclaw()

    # Build patch dict with only provided fields
    patch = {}

    if update.schedule is not None:
        patch["schedule"] = {k: v for k, v in update.schedule.model_dump().items() if v is not None}

    if update.payload is not None:
        patch["payload"] = {k: v for k, v in update.payload.model_dump().items() if v is not None}

    if update.sessionTarget is not None:
        patch["sessionTarget"] = update.sessionTarget

    if update.name is not None:
        patch["name"] = update.name

    if update.enabled is not None:
        patch["enabled"] = update.enabled

    result = await conn.update_cron_job(job_id, patch)

    if result is None:
        raise HTTPException(status_code=500, detail="Failed to update cron job")

    return result


@router.delete("/jobs/{job_id}", responses={500: {"description": "Internal server error"}})
async def delete_cron_job(job_id: str):
    """Delete a cron job."""
    conn = await _get_openclaw()
    success = await conn.delete_cron_job(job_id)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete cron job")

    return {"success": True}


@router.post("/jobs/{job_id}/enable", responses={500: {"description": "Internal server error"}})
async def enable_cron_job(job_id: str):
    """Enable a cron job."""
    conn = await _get_openclaw()
    success = await conn.enable_cron_job(job_id)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to enable cron job")

    return {"success": True}


@router.post("/jobs/{job_id}/disable", responses={500: {"description": "Internal server error"}})
async def disable_cron_job(job_id: str):
    """Disable a cron job."""
    conn = await _get_openclaw()
    success = await conn.disable_cron_job(job_id)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to disable cron job")

    return {"success": True}


@router.post("/jobs/{job_id}/run", responses={500: {"description": "Internal server error"}})
async def run_cron_job(job_id: str, force: bool = True):
    """Trigger a cron job to run immediately."""
    conn = await _get_openclaw()
    success = await conn.run_cron_job(job_id, force=force)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to run cron job")

    return {"success": True}
