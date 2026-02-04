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


# ── Default metadata for well-known agents ────────────────────────────

_AGENT_DEFAULTS = {
    "main": {"name": "Main", "icon": "🤖", "color": "#3b82f6", "session_key": "agent:main:main", "sort": 0},
    "dev": {"name": "Dev", "icon": "💻", "color": "#10b981", "session_key": "agent:dev:main", "sort": 1},
    "flowy": {"name": "Flowy", "icon": "🌊", "color": "#8b5cf6", "session_key": "agent:flowy:main", "sort": 2},
    "creator": {"name": "Creator", "icon": "🎨", "color": "#f59e0b", "session_key": "agent:creator:main", "sort": 3},
    "reviewer": {"name": "Reviewer", "icon": "🔍", "color": "#ef4444", "session_key": "agent:reviewer:main", "sort": 4},
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

                # INSERT OR IGNORE — won't overwrite user customisations
                await db.execute(
                    """
                    INSERT OR IGNORE INTO agents
                        (id, name, icon, color, agent_session_key,
                         default_model, default_room_id, sort_order,
                         is_pinned, auto_spawn, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, NULL, 'headquarters', ?, FALSE, TRUE, ?, ?)
                    """,
                    (agent_id, name, icon, color, session_key, sort_order, now, now),
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
