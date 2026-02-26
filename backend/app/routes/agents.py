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


class AgentCreate(BaseModel):
    """Fields required / optional when creating a new agent."""

    id: str  # slug, e.g. "mybot"
    name: str
    icon: Optional[str] = "🤖"
    color: Optional[str] = "#6b7280"
    default_room_id: Optional[str] = "headquarters"
    agent_session_key: Optional[str] = None
    bio: Optional[str] = None


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
    return await agent_svc.create_agent(
        agent_id=agent_id,
        name=payload.name,
        icon=payload.icon or "🤖",
        color=payload.color or "#6b7280",
        default_room_id=payload.default_room_id or "headquarters",
        agent_session_key=payload.agent_session_key,
        bio=payload.bio,
    )


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


@router.post("/{agent_id}/generate-bio", responses={404: {"description": "Not found"}})
async def generate_bio(agent_id: str):
    """
    Generate an AI-powered bio for an agent based on their SOUL.md and recent activity.

    Uses the agent's personality file and chat history to create a fitting bio.
    Falls back to basic generation if context isn't available.
    """
    from pathlib import Path

    from app.db.database import get_db
    from app.services.connections import get_connection_manager

    # 1. Get agent info from DB
    async with get_db() as db:
        async with db.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)) as cursor:
            row = await cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Agent not found")

        agent_name = row["name"]

    # 2. Try to read SOUL.md from agent workspace
    soul_content = ""
    soul_paths = [
        Path.home() / ".openclaw" / "agents" / agent_id / "SOUL.md",
        Path.home() / "clawd" / "SOUL.md" if agent_id == "main" else None,
    ]

    for soul_path in soul_paths:
        if soul_path and soul_path.exists():
            try:
                async with aiofiles.open(soul_path) as f:
                    soul_content = (await f.read())[:2000]
                logger.info(f"Read SOUL.md for {agent_id} from {soul_path}")
                break
            except Exception as e:
                logger.warning(f"Failed to read SOUL.md: {e}")

    # 3. Get recent session history summary
    recent_activity = ""
    try:
        manager = await get_connection_manager()
        conn = manager.get_default_openclaw()
        if conn:
            sessions = await conn.get_sessions_raw()
            agent_session = next(
                (s for s in sessions if s.get("key", "").startswith(f"agent:{agent_id}:")),
                None,
            )

            if agent_session:
                session_key = agent_session.get("key", "")
                history = await conn.get_session_history_raw(session_key, limit=20)

                messages = []
                for msg in history[-10:]:
                    role = msg.get("role", "")
                    content = msg.get("content", "")
                    if isinstance(content, list):
                        text_parts = [b.get("text", "") for b in content if isinstance(b, dict)]
                        content = " ".join(text_parts)
                    if role in ("user", "assistant") and content:
                        messages.append(f"{role}: {content[:100]}")

                if messages:
                    recent_activity = "\n".join(messages[-5:])
                    logger.info(f"Got {len(messages)} recent messages for {agent_id}")
    except Exception as e:
        logger.warning(f"Failed to get session history: {e}")

    # 4. Generate bio using template approach
    bio_templates = {
        "main": "{name} is the orchestrator, managing tasks and coordinating the crew.",
        "dev": "{name} is the developer, writing code and building features.",
        "flowy": "{name} handles marketing, media, and creative content.",
        "creator": "{name} is the video specialist, crafting visual stories.",
        "reviewer": "{name} reviews code and provides feedback for quality.",
    }

    personality_hints = []
    if soul_content:
        soul_lower = soul_content.lower()
        if "helpful" in soul_lower or "assist" in soul_lower:
            personality_hints.append("helpful")
        if "creative" in soul_lower:
            personality_hints.append("creative")
        if "technical" in soul_lower or "code" in soul_lower:
            personality_hints.append("technical")
        if "friendly" in soul_lower or "joyful" in soul_lower:
            personality_hints.append("friendly")

    if agent_id in bio_templates:
        bio = bio_templates[agent_id].format(name=agent_name)
    else:
        if personality_hints:
            traits = " and ".join(personality_hints[:2])
            bio = f"{agent_name} is a {traits} crew member ready to help."
        else:
            bio = f"{agent_name} is a dedicated crew member working hard behind the scenes."

    if recent_activity and len(bio) < 150:
        bio += " Currently active on the team."

    logger.info(f"Generated bio for {agent_id}: {bio}")
    return {"bio": bio, "generated": True}
