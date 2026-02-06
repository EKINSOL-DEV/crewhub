"""
Agent registry endpoints.

Agents are stored in the local SQLite database.  On startup (and
periodically), agents discovered from the OpenClaw Gateway heartbeat
config are auto-synced so the registry always reflects reality.
"""

import json
import logging
import time
from typing import Optional

import aiosqlite
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db.database import get_db
from ..services.connections import get_connection_manager

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


# ── Default metadata for well-known agents ────────────────────────────

_AGENT_DEFAULTS = {
    "main": {"name": "Main", "icon": "🤖", "color": "#3b82f6", "session_key": "agent:main:main", "sort": 0, "bio": "Director of Bots. Keeps the crew running, manages schedules, and always has an answer. Runs on coffee and Sonnet."},
    "dev": {"name": "Dev", "icon": "💻", "color": "#10b981", "session_key": "agent:dev:main", "sort": 1, "bio": "Senior developer. Lives in the codebase, speaks fluent TypeScript, and ships features at light speed. Powered by Opus."},
    "gamedev": {"name": "Game Dev", "icon": "🎮", "color": "#f97316", "session_key": "agent:gamedev:main", "sort": 2, "bio": "3D world architect. Builds rooms, animates bots, and makes pixels dance. Three.js whisperer on Opus."},
    "flowy": {"name": "Flowy", "icon": "🌊", "color": "#8b5cf6", "session_key": "agent:flowy:main", "sort": 3, "bio": "Marketing maestro and product visionary. Turns ideas into campaigns and roadmaps into reality. Creative force on GPT-5.2."},
    "creator": {"name": "Creator", "icon": "🎨", "color": "#f59e0b", "session_key": "agent:creator:main", "sort": 4, "bio": "A hardworking crew member."},
    "reviewer": {"name": "Reviewer", "icon": "🔍", "color": "#ef4444", "session_key": "agent:reviewer:main", "sort": 5, "bio": "Code critic and quality guardian. Reviews PRs with surgical precision. Runs on GPT-5.2 and strong opinions."},
    "wtl": {"name": "WTL", "icon": "💧", "color": "#06b6d4", "session_key": "agent:wtl:main", "sort": 6, "bio": "Waterleau knowledge specialist. Industrial data pipelines, wastewater treatment, and SCADA systems. The domain expert on Sonnet."},
}


async def _row_to_dict(cursor, row) -> dict:
    """Convert a row to a dict using cursor description."""
    return dict(zip([col[0] for col in cursor.description], row))


# ── Gateway sync ──────────────────────────────────────────────────────

async def sync_agents_from_gateway() -> int:
    """
    Discover agents from the Gateway heartbeat config and ensure each
    one exists in the local DB.  Returns the number of agents upserted.
    """
    try:
        manager = await get_connection_manager()
        conn = manager.get_default_openclaw()
        status = await conn.call("status") if conn else None
        if not status:
            return 0

        heartbeat = status.get("heartbeat") or {}
        gw_agents = heartbeat.get("agents") or []
        if not gw_agents:
            return 0

        now = int(time.time() * 1000)
        upserted = 0

        db = await get_db()
        try:
            for gw_agent in gw_agents:
                agent_id = gw_agent.get("agentId")
                if not agent_id:
                    continue

                defaults = _AGENT_DEFAULTS.get(agent_id, {})
                name = defaults.get("name", agent_id.capitalize())
                icon = defaults.get("icon", "🤖")
                color = defaults.get("color", "#6b7280")
                session_key = defaults.get("session_key", f"agent:{agent_id}:main")
                sort_order = defaults.get("sort", 99)

                bio = defaults.get("bio", "A hardworking crew member.")

                # INSERT OR IGNORE — won't overwrite user customisations
                await db.execute(
                    """
                    INSERT OR IGNORE INTO agents
                        (id, name, icon, color, agent_session_key,
                         default_model, default_room_id, sort_order,
                         is_pinned, auto_spawn, bio, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, NULL, 'headquarters', ?, FALSE, TRUE, ?, ?, ?)
                    """,
                    (agent_id, name, icon, color, session_key, sort_order, bio, now, now),
                )
                upserted += db.total_changes  # counts only actual inserts

            await db.commit()
        finally:
            await db.close()

        if upserted:
            logger.info(f"Synced {upserted} new agent(s) from Gateway")
        return upserted

    except Exception as e:
        logger.warning(f"Failed to sync agents from Gateway: {e}")
        return 0


# ── Routes ────────────────────────────────────────────────────────────

@router.get("")
async def list_agents():
    """Return every registered agent (from local DB)."""
    # Best-effort sync from gateway (non-blocking quick call)
    try:
        await sync_agents_from_gateway()
    except Exception:
        pass  # DB data is fine even if gateway is unreachable

    db = await get_db()
    try:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM agents ORDER BY sort_order ASC, name ASC"
        ) as cursor:
            rows = await cursor.fetchall()

        agents = []
        for row in rows:
            agents.append({
                "id": row["id"],
                "name": row["name"],
                "icon": row["icon"],
                "avatar_url": row["avatar_url"],
                "color": row["color"],
                "agent_session_key": row["agent_session_key"],
                "default_model": row["default_model"],
                "default_room_id": row["default_room_id"],
                "sort_order": row["sort_order"],
                "is_pinned": bool(row["is_pinned"]),
                "auto_spawn": bool(row["auto_spawn"]),
                "bio": row["bio"] if "bio" in row.keys() else None,
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            })

        return {"agents": agents}
    finally:
        await db.close()


@router.get("/{agent_id}")
async def get_agent(agent_id: str):
    """Get a single agent by ID."""
    db = await get_db()
    try:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM agents WHERE id = ?", (agent_id,)
        ) as cursor:
            row = await cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Agent not found")

        return {
            "id": row["id"],
            "name": row["name"],
            "icon": row["icon"],
            "avatar_url": row["avatar_url"],
            "color": row["color"],
            "agent_session_key": row["agent_session_key"],
            "default_model": row["default_model"],
            "default_room_id": row["default_room_id"],
            "sort_order": row["sort_order"],
            "is_pinned": bool(row["is_pinned"]),
            "auto_spawn": bool(row["auto_spawn"]),
            "bio": row["bio"] if "bio" in row.keys() else None,
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
    finally:
        await db.close()


@router.put("/{agent_id}")
async def update_agent(agent_id: str, patch: AgentUpdate):
    """Update agent fields (pin, room, name, icon, …)."""
    updates = patch.dict(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    now = int(time.time() * 1000)
    updates["updated_at"] = now

    set_clauses = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [agent_id]

    db = await get_db()
    try:
        cursor = await db.execute(
            f"UPDATE agents SET {set_clauses} WHERE id = ?", values
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Agent not found")
        await db.commit()
    finally:
        await db.close()

    return {"success": True, "agent_id": agent_id, "updated": list(patch.dict(exclude_unset=True).keys())}


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str):
    """Remove an agent from the local registry."""
    db = await get_db()
    try:
        cursor = await db.execute("DELETE FROM agents WHERE id = ?", (agent_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Agent not found")
        await db.commit()
    finally:
        await db.close()

    return {"status": "deleted", "id": agent_id}


@router.post("/{agent_id}/generate-bio")
async def generate_bio(agent_id: str):
    """
    Generate an AI-powered bio for an agent based on their SOUL.md and recent activity.
    
    Uses the agent's personality file and chat history to create a fitting bio.
    Falls back to basic generation if context isn't available.
    """
    from pathlib import Path
    
    # 1. Get agent info from DB
    db = await get_db()
    try:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM agents WHERE id = ?", (agent_id,)
        ) as cursor:
            row = await cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        agent_name = row["name"]
        agent_icon = row["icon"] or "🤖"
    finally:
        await db.close()
    
    # 2. Try to read SOUL.md from agent workspace
    soul_content = ""
    soul_paths = [
        Path.home() / ".openclaw" / "agents" / agent_id / "SOUL.md",
        Path.home() / "clawd" / "SOUL.md" if agent_id == "main" else None,
    ]
    
    for soul_path in soul_paths:
        if soul_path and soul_path.exists():
            try:
                with open(soul_path, 'r') as f:
                    soul_content = f.read()[:2000]  # Limit to 2000 chars
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
            # Get list of sessions to find agent's main session
            sessions = await conn.get_sessions_raw()
            agent_session = next(
                (s for s in sessions if s.get("key", "").startswith(f"agent:{agent_id}:")),
                None
            )
            
            if agent_session:
                session_key = agent_session.get("key", "")
                history = await conn.get_session_history_raw(session_key, limit=20)
                
                # Extract recent user/assistant messages for context
                messages = []
                for msg in history[-10:]:  # Last 10 messages
                    role = msg.get("role", "")
                    content = msg.get("content", "")
                    if isinstance(content, list):
                        # Extract text from content blocks
                        text_parts = [b.get("text", "") for b in content if isinstance(b, dict)]
                        content = " ".join(text_parts)
                    if role in ("user", "assistant") and content:
                        messages.append(f"{role}: {content[:100]}")
                
                if messages:
                    recent_activity = "\n".join(messages[-5:])  # Last 5 for prompt
                    logger.info(f"Got {len(messages)} recent messages for {agent_id}")
    except Exception as e:
        logger.warning(f"Failed to get session history: {e}")
    
    # 4. Build prompt and call LLM
    prompt_parts = [
        f"Generate a short, friendly bio (2-3 sentences, max 150 characters) for this AI agent.",
        f"Write in third person, make it sound natural and personality-fitting.",
        f"",
        f"Agent name: {agent_name}",
        f"Icon: {agent_icon}",
    ]
    
    if soul_content:
        # Extract key personality traits from SOUL.md (first 500 chars)
        prompt_parts.append(f"")
        prompt_parts.append(f"Personality (from SOUL.md):")
        prompt_parts.append(soul_content[:500])
    
    if recent_activity:
        prompt_parts.append(f"")
        prompt_parts.append(f"Recent activities:")
        prompt_parts.append(recent_activity)
    
    if not soul_content and not recent_activity:
        prompt_parts.append(f"")
        prompt_parts.append(f"Note: No personality file or recent history available. Generate a generic but friendly bio based on the agent name and icon.")
    
    prompt_parts.append(f"")
    prompt_parts.append(f"Respond with ONLY the bio text, no quotes or explanation.")
    
    prompt = "\n".join(prompt_parts)
    
    # Call LLM via gateway
    try:
        manager = await get_connection_manager()
        conn = manager.get_default_openclaw()
        if not conn:
            raise HTTPException(status_code=503, detail="Gateway not connected")
        
        # Use send_chat to get a response
        result = await conn.send_chat(
            message=prompt,
            agent_id="main",  # Use main agent for generation
            timeout=30.0,
        )
        
        if result:
            # Clean up the result (remove quotes, trim)
            bio = result.strip().strip('"\'')
            # Ensure it's not too long
            if len(bio) > 200:
                bio = bio[:197] + "..."
            
            logger.info(f"Generated bio for {agent_id}: {bio}")
            return {"bio": bio, "generated": True}
        else:
            raise HTTPException(status_code=500, detail="Failed to generate bio")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating bio: {e}")
        raise HTTPException(status_code=500, detail=f"Bio generation failed: {str(e)}")
