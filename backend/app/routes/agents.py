"""
Agent registry endpoints.

Agents are stored in the local SQLite database.  On startup (and
periodically), agents discovered from the OpenClaw Gateway heartbeat
config are auto-synced so the registry always reflects reality.
"""

import logging
from typing import Optional

import aiofiles
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import app.services.agent_service as agent_svc

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Pydantic models ──────────────────────────────────────────────────


class AgentUpdate(BaseModel):
    """Fields the frontend may PATCH/PUT on an agent."""

    name: Optional[str] = None
    icon: Optional[str] = None
    avatar_url: Optional[str] = None
    color: Optional[str] = None
    agent_session_key: Optional[str] = None
    default_model: Optional[str] = None
    default_room_id: Optional[str] = None
    sort_order: Optional[int] = None
    is_pinned: Optional[bool] = None
    auto_spawn: Optional[bool] = None
    bio: Optional[str] = None
    source: Optional[str] = None
    project_path: Optional[str] = None
    permission_mode: Optional[str] = None
    system_prompt: Optional[str] = None


class AgentCreate(BaseModel):
    """Fields required / optional when creating a new agent."""

    id: str  # slug, e.g. "mybot"
    name: str
    icon: Optional[str] = "🤖"
    color: Optional[str] = "#6b7280"
    default_room_id: Optional[str] = "headquarters"
    agent_session_key: Optional[str] = None
    bio: Optional[str] = None
    source: Optional[str] = "openclaw"
    project_path: Optional[str] = None
    permission_mode: Optional[str] = "default"
    system_prompt: Optional[str] = None
    initial_session_id: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────


@router.get("")
async def list_agents():
    """Return every registered agent (from local DB), with is_stale flag."""
    # Best-effort sync from gateway (non-blocking)
    try:
        await agent_svc.sync_agents_from_gateway()
    except Exception:
        pass

    gateway_ids = await agent_svc.get_gateway_agent_ids()
    gateway_reachable = bool(gateway_ids)

    agents = await agent_svc.list_agents(gateway_ids, gateway_reachable)
    return {"agents": agents}


@router.post("")
async def create_agent(payload: AgentCreate):
    """Create a new agent in the local registry."""
    agent_id = payload.id.strip().lower().replace(" ", "-")
    result = await agent_svc.create_agent(
        agent_id=agent_id,
        name=payload.name,
        icon=payload.icon or "🤖",
        color=payload.color or "#6b7280",
        default_room_id=payload.default_room_id or "headquarters",
        agent_session_key=payload.agent_session_key,
        bio=payload.bio,
        source=payload.source or "openclaw",
        project_path=payload.project_path,
        permission_mode=payload.permission_mode or "default",
    )

    # If this is a CC agent with an initial session, seed the session tracker
    if payload.source == "claude_code" and payload.initial_session_id:
        try:
            from app.services.cc_chat import _agent_sessions

            _agent_sessions[agent_id] = payload.initial_session_id
        except Exception as e:
            logger.warning(f"Failed to seed CC session for {agent_id}: {e}")

    return result


@router.get("/{agent_id}")
async def get_agent(agent_id: str):
    """Get a single agent by ID."""
    gateway_ids = await agent_svc.get_gateway_agent_ids()
    gateway_reachable = bool(gateway_ids)
    return await agent_svc.get_agent(agent_id, gateway_ids, gateway_reachable)


@router.put("/{agent_id}")
async def update_agent(agent_id: str, patch: AgentUpdate):
    """Update agent fields (pin, room, name, icon, …)."""
    updates = patch.model_dump(exclude_unset=True)
    return await agent_svc.update_agent(agent_id, updates)


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str):
    """Remove an agent from the local registry."""
    return await agent_svc.delete_agent(agent_id)


@router.post("/{agent_id}/clone")
async def clone_agent(agent_id: str):
    """Clone an agent's configuration, optionally forking the session."""
    import time
    import uuid
    from app.db.database import get_db

    async with get_db() as db:
        async with db.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)) as cursor:
            source_agent = await cursor.fetchone()
        if not source_agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        new_id = f"{agent_id}-clone-{uuid.uuid4().hex[:6]}"
        new_name = f"{source_agent['name']} (clone)"
        now = int(time.time() * 1000)

        await db.execute(
            """INSERT INTO agents (id, name, icon, avatar_url, color, default_model,
               default_room_id, sort_order, is_pinned, auto_spawn, bio, source,
               project_path, permission_mode, agent_session_key, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (new_id, new_name, source_agent.get("icon"), source_agent.get("avatar_url"),
             source_agent.get("color"), source_agent.get("default_model"),
             source_agent.get("default_room_id"), 0, False, True,
             source_agent.get("bio"), source_agent.get("source", "claude_code"),
             source_agent.get("project_path"), source_agent.get("permission_mode", "default"),
             f"cc:{new_id}", now, now),
        )
        await db.commit()

    return {"success": True, "agent_id": new_id, "name": new_name}


async def _read_agent_soul(agent_id: str) -> str:
    """Try to read SOUL.md from the agent's workspace directory."""
    from pathlib import Path

    soul_paths = [
        Path.home() / ".openclaw" / "agents" / agent_id / "SOUL.md",
        Path.home() / "clawd" / "SOUL.md" if agent_id == "main" else None,
    ]
    for soul_path in soul_paths:
        if soul_path and soul_path.exists():
            try:
                async with aiofiles.open(soul_path) as f:
                    content = (await f.read())[:2000]
                logger.info(f"Read SOUL.md for {agent_id} from {soul_path}")
                return content
            except Exception as e:
                logger.warning(f"Failed to read SOUL.md: {e}")
    return ""


async def _get_agent_recent_activity(agent_id: str) -> str:
    """Fetch a short recent activity summary from the agent's session history."""
    from app.services.connections import get_connection_manager

    try:
        manager = await get_connection_manager()
        conn = manager.get_default_openclaw()
        if not conn:
            return ""
        sessions = await conn.get_sessions_raw()
        agent_session = next((s for s in sessions if s.get("key", "").startswith(f"agent:{agent_id}:")), None)
        if not agent_session:
            return ""
        history = await conn.get_session_history_raw(agent_session.get("key", ""), limit=20)
        messages = []
        for msg in history[-10:]:
            role = msg.get("role", "")
            content = msg.get("content", "")
            if isinstance(content, list):
                content = " ".join(b.get("text", "") for b in content if isinstance(b, dict))
            if role in ("user", "assistant") and content:
                messages.append(f"{role}: {content[:100]}")
        if messages:
            logger.info("Got recent messages for bio generation")
            return "\n".join(messages[-5:])
    except Exception as e:
        logger.warning(f"Failed to get session history: {e}")
    return ""


def _extract_personality_hints(soul_content: str) -> list[str]:
    if not soul_content:
        return []

    soul_lower = soul_content.lower()
    checks = [
        ("helpful", ("helpful", "assist")),
        ("creative", ("creative",)),
        ("technical", ("technical", "code")),
        ("friendly", ("friendly", "joyful")),
    ]

    hints: list[str] = []
    for hint, needles in checks:
        if any(needle in soul_lower for needle in needles):
            hints.append(hint)
    return hints


def _build_bio_from_context(agent_id: str, agent_name: str, soul_content: str, recent_activity: str) -> str:
    """Build a bio string using soul content and template matching."""
    bio_templates = {
        "main": "{name} is the orchestrator, managing tasks and coordinating the crew.",
        "dev": "{name} is the developer, writing code and building features.",
        "flowy": "{name} handles marketing, media, and creative content.",
        "creator": "{name} is the video specialist, crafting visual stories.",
        "reviewer": "{name} reviews code and provides feedback for quality.",
    }
    if agent_id in bio_templates:
        bio = bio_templates[agent_id].format(name=agent_name)
    else:
        personality_hints = _extract_personality_hints(soul_content)
        if personality_hints:
            traits = " and ".join(personality_hints[:2])
            bio = f"{agent_name} is a {traits} crew member ready to help."
        else:
            bio = f"{agent_name} is a dedicated crew member working hard behind the scenes."
    if recent_activity and len(bio) < 150:
        bio += " Currently active on the team."
    return bio


@router.post("/{agent_id}/generate-bio", responses={404: {"description": "Not found"}})
async def generate_bio(agent_id: str):
    """
    Generate an AI-powered bio for an agent based on their SOUL.md and recent activity.

    Uses the agent's personality file and chat history to create a fitting bio.
    Falls back to basic generation if context isn't available.
    """
    from app.db.database import get_db

    async with get_db() as db:
        async with db.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)) as cursor:
            row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Agent not found")
        agent_name = row["name"]

    soul_content = await _read_agent_soul(agent_id)
    recent_activity = await _get_agent_recent_activity(agent_id)
    bio = _build_bio_from_context(agent_id, agent_name, soul_content, recent_activity)

    logger.info("Generated bio successfully")
    return {"bio": bio, "generated": True}
