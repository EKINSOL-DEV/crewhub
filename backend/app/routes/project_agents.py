"""Project Agents API routes — agent templates per room."""

import logging
import shutil
import time
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.database import get_db
from app.routes.sse import broadcast

logger = logging.getLogger(__name__)
router = APIRouter()


class ProjectAgentCreate(BaseModel):
    name: str
    cwd: str
    startup_prompt: str


class ProjectAgentOut(BaseModel):
    id: str
    room_id: str
    name: str
    cwd: str
    startup_prompt: str
    created_at: int


@router.get("/{room_id}/agents")
async def list_agents(room_id: str):
    """List agent templates for a room."""
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM project_agents WHERE room_id = ? ORDER BY created_at ASC",
            (room_id,),
        ) as cursor:
            rows = await cursor.fetchall()
    return {"agents": [dict(r) for r in rows]}


@router.post("/{room_id}/agents", response_model=ProjectAgentOut)
async def create_agent(room_id: str, body: ProjectAgentCreate):
    """Create a new agent template."""
    async with get_db() as db:
        # Verify room exists
        async with db.execute("SELECT id FROM rooms WHERE id = ?", (room_id,)) as cursor:
            if not await cursor.fetchone():
                raise HTTPException(status_code=404, detail="Room not found")

        agent_id = str(uuid.uuid4())
        now = int(time.time() * 1000)
        await db.execute(
            "INSERT INTO project_agents (id, room_id, name, cwd, startup_prompt, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (agent_id, room_id, body.name, body.cwd, body.startup_prompt, now),
        )
        await db.commit()

    return ProjectAgentOut(
        id=agent_id,
        room_id=room_id,
        name=body.name,
        cwd=body.cwd,
        startup_prompt=body.startup_prompt,
        created_at=now,
    )


@router.delete("/{room_id}/agents/{agent_id}")
async def delete_agent(room_id: str, agent_id: str):
    """Delete an agent template."""
    async with get_db() as db:
        async with db.execute(
            "SELECT id FROM project_agents WHERE id = ? AND room_id = ?",
            (agent_id, room_id),
        ) as cursor:
            if not await cursor.fetchone():
                raise HTTPException(status_code=404, detail="Agent not found")
        await db.execute("DELETE FROM project_agents WHERE id = ?", (agent_id,))
        await db.commit()
    return {"success": True, "deleted": agent_id}


@router.post("/{room_id}/agents/{agent_id}/start")
async def start_agent(room_id: str, agent_id: str):
    """Start a Claude Code session from an agent template."""
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM project_agents WHERE id = ? AND room_id = ?",
            (agent_id, room_id),
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Agent not found")

    agent = dict(row)
    cli_path = shutil.which("claude")
    if not cli_path:
        raise HTTPException(status_code=500, detail="Claude CLI not found")

    from app.services.connections.claude_process_manager import ClaudeProcessManager

    manager = ClaudeProcessManager(cli_path=cli_path)
    process_id = await manager.spawn_task(
        message=agent["startup_prompt"],
        project_path=agent["cwd"],
    )

    proc = manager.get_process(process_id)
    session_id = proc.session_id if proc else None
    session_key = f"claude:{session_id}" if session_id else f"claude:proc-{process_id}"

    # Auto-assign to room
    async with get_db() as db:
        now = int(time.time() * 1000)
        await db.execute(
            """INSERT INTO session_room_assignments (session_key, room_id, assigned_at)
               VALUES (?, ?, ?)
               ON CONFLICT(session_key) DO UPDATE SET room_id = excluded.room_id, assigned_at = excluded.assigned_at""",
            (session_key, room_id, now),
        )
        await db.commit()

    await broadcast(
        "rooms-refresh",
        {
            "action": "assignment_changed",
            "session_key": session_key,
            "room_id": room_id,
        },
    )

    return {"session_id": session_id or process_id, "session_key": session_key}
