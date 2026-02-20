"""Tasks API routes.

SQL is delegated to app.services.task_service. This module owns
HTTP concerns: status codes, SSE broadcasts, and response shaping.
"""
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.db.task_models import TaskCreate, TaskListResponse, TaskResponse, TaskUpdate
from app.routes.sse import broadcast
from app.services import task_service
from app.services.connections import get_connection_manager

logger = logging.getLogger(__name__)
router = APIRouter()


# ── helpers shared with the /run endpoint ─────────────────────────────────────

async def _not_found(label: str) -> None:
    raise HTTPException(status_code=404, detail=f"{label} not found")


# ========================================
# ROOM & PROJECT SCOPED TASK LISTS
# (must be before /{task_id} to avoid route shadowing)
# ========================================

@router.get("/rooms/{room_id}/tasks", response_model=TaskListResponse)
async def get_room_tasks(
    room_id: str,
    status: Optional[str] = Query(None, description="Filter by status (comma-separated)"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Get all tasks for a specific room."""
    try:
        return await task_service.list_tasks(room_id=room_id, status=status, limit=limit, offset=offset)
    except Exception as e:
        logger.error(f"Failed to list room tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/tasks", response_model=TaskListResponse)
async def get_project_tasks(
    project_id: str,
    status: Optional[str] = Query(None, description="Filter by status (comma-separated)"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Get all tasks for a specific project."""
    try:
        return await task_service.list_tasks(project_id=project_id, status=status, limit=limit, offset=offset)
    except Exception as e:
        logger.error(f"Failed to list project tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========================================
# TASKS CRUD
# ========================================

@router.get("", response_model=TaskListResponse)
async def list_tasks(
    project_id: Optional[str] = Query(None, description="Filter by project"),
    room_id: Optional[str] = Query(None, description="Filter by room"),
    status: Optional[str] = Query(None, description="Filter by status (comma-separated)"),
    assigned_session_key: Optional[str] = Query(None, description="Filter by assignee"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Get all tasks with optional filters."""
    try:
        return await task_service.list_tasks(
            project_id=project_id,
            room_id=room_id,
            status=status,
            assigned_session_key=assigned_session_key,
            limit=limit,
            offset=offset,
        )
    except Exception as e:
        logger.error(f"Failed to list tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    """Get a specific task by ID."""
    try:
        task = await task_service.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return task
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=TaskResponse)
async def create_task(task: TaskCreate):
    """Create a new task."""
    try:
        result = await task_service.create_task(task)
        await broadcast("task-created", {
            "task_id": result.id,
            "project_id": result.project_id,
            "room_id": result.room_id,
        })
        return result
    except ValueError as e:
        err = str(e)
        if "project_not_found" in err:
            raise HTTPException(status_code=404, detail="Project not found")
        if "room_not_found" in err:
            raise HTTPException(status_code=404, detail="Room not found")
        raise HTTPException(status_code=400, detail=err)
    except Exception as e:
        logger.error(f"Failed to create task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task: TaskUpdate):
    """Update a task."""
    try:
        result, changes = await task_service.update_task(task_id, task)
        if result is None:
            raise HTTPException(status_code=404, detail="Task not found")

        await broadcast("task-updated", {
            "task_id": task_id,
            "project_id": result.project_id,
            "room_id": result.room_id,
            "changes": changes,
        })
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{task_id}")
async def delete_task(task_id: str):
    """Delete a task."""
    try:
        deleted = await task_service.delete_task(task_id)
        if deleted is None:
            raise HTTPException(status_code=404, detail="Task not found")

        await broadcast("task-deleted", {
            "task_id": deleted["task_id"],
            "project_id": deleted["project_id"],
            "room_id": deleted["room_id"],
        })
        return {"success": True, "deleted": task_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========================================
# RUN TASK WITH AGENT
# ========================================

class RunRequest(BaseModel):
    """Request body for running a task with an agent's main session."""
    agent_id: str
    extra_instructions: Optional[str] = None


class RunResponse(BaseModel):
    """Response from running a task with an agent."""
    success: bool
    session_key: str
    task_id: str
    agent_id: str


@router.post("/{task_id}/run", response_model=RunResponse)
async def run_task_with_agent(task_id: str, body: RunRequest):
    """
    Send a task to an agent's main session (not spawning a subagent).

    1. Fetches the task details
    2. Builds a prompt from task title + description + extra instructions
    3. Sends the message to the agent's main session
    4. Updates task status to in_progress (via task_service)
    5. Returns the session key
    """
    try:
        # 1. Get the task
        task = await task_service.get_task_row(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        # 2. Get agent info
        agent = await task_service.get_agent_row(body.agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        # 3. Build prompt (with context envelope)
        from app.services.context_envelope import build_crewhub_context, format_context_block

        ctx_room_id = task.get("room_id")
        if not ctx_room_id and agent:
            ctx_room_id = agent.get("default_room_id")

        context_block = ""
        if ctx_room_id:
            agent_session_key = agent.get("agent_session_key") if agent else None
            envelope = await build_crewhub_context(
                room_id=ctx_room_id,
                channel="crewhub-ui",
                session_key=agent_session_key,
            )
            if envelope:
                context_block = format_context_block(envelope) + "\n\n"

        prompt_parts = [f"**Task from Planner:** {task['title']}"]
        if task.get("description"):
            prompt_parts.append(f"\n{task['description']}")
        if body.extra_instructions:
            prompt_parts.append(f"\n**Additional Instructions:** {body.extra_instructions}")

        prompt = context_block + "\n".join(prompt_parts)

        # 4. Send to agent's main session via OpenClaw
        manager = await get_connection_manager()
        conn = manager.get_default_openclaw()

        session_key = f"agent:{agent['name'].lower()}:main"

        if conn:
            try:
                result = await conn.send_message(
                    session_key=session_key,
                    message=prompt,
                    timeout=90.0,
                )
                logger.info(f"Sent task to {session_key}: {result}")
            except Exception as e:
                logger.warning(f"Failed to send to {session_key}: {e}")
                # Continue — task is still assigned even if send failed
        else:
            logger.warning("No OpenClaw connection available")

        # 5. Mark task as in_progress and record history
        await task_service.set_task_running(
            task_id=task_id,
            project_id=task["project_id"],
            previous_status=task["status"],
            agent_id=body.agent_id,
            agent_name=agent["name"],
            session_key=session_key,
            prompt_preview=prompt,
        )

        await broadcast("task-updated", {
            "task_id": task_id,
            "project_id": task["project_id"],
            "room_id": task["room_id"],
            "changes": {"status": {"old": task["status"], "new": "in_progress"}},
        })

        return RunResponse(
            success=True,
            session_key=session_key,
            task_id=task_id,
            agent_id=body.agent_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to run task {task_id} with agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))
