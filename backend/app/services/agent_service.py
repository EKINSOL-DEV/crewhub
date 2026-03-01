"""Service layer for agent registry database operations.

All SQL for agents lives here. Routes call these functions and handle
HTTP concerns (response formatting, HTTP exceptions).
Gateway sync helpers also live here since they feed the DB.
"""

import logging
import os
import time
from pathlib import Path
from typing import Optional

from fastapi import HTTPException

from app.db.database import get_db

MSG_AGENT_NOT_FOUND = "Agent not found"

# Known valid permission modes (case-insensitive)
_VALID_PERMISSION_MODES = {
    "full-auto",
    "bypass",
    "bypasspermissions",
    "accept-edits",
    "acceptedits",
    "dont-ask",
    "dontask",
    "plan",
    "default",
}

logger = logging.getLogger(__name__)

# ── Default metadata for well-known agents ────────────────────────────────────

_AGENT_DEFAULTS = {
    "main": {
        "name": "Director",
        "icon": "🎯",
        "color": "#4f46e5",
        "session_key": "agent:main:main",
        "sort": 0,
        "bio": "Director of Bots. Keeps the crew running, manages schedules, and always has an answer. Runs on coffee and Sonnet.",
    },
    "dev": {
        "name": "Dev",
        "icon": "💻",
        "color": "#10b981",
        "session_key": "agent:dev:main",
        "sort": 1,
        "bio": "Senior developer. Lives in the codebase, speaks fluent TypeScript, and ships features at light speed. Powered by Opus.",
    },
    "gamedev": {
        "name": "Game Dev",
        "icon": "🎮",
        "color": "#f97316",
        "session_key": "agent:gamedev:main",
        "sort": 2,
        "bio": "3D world architect. Builds rooms, animates bots, and makes pixels dance. Three.js whisperer on Opus.",
    },
    "flowy": {
        "name": "Flowy",
        "icon": "🌊",
        "color": "#8b5cf6",
        "session_key": "agent:flowy:main",
        "sort": 3,
        "bio": "Marketing maestro and product visionary. Turns ideas into campaigns and roadmaps into reality. Creative force on GPT-5.2.",
    },
    "creator": {
        "name": "Creator",
        "icon": "🎨",
        "color": "#f59e0b",
        "session_key": "agent:creator:main",
        "sort": 4,
        "bio": "A hardworking crew member.",
    },
    "reviewer": {
        "name": "Reviewer",
        "icon": "🔍",
        "color": "#ef4444",
        "session_key": "agent:reviewer:main",
        "sort": 5,
        "bio": "Code critic and quality guardian. Reviews PRs with surgical precision. Runs on GPT-5.2 and strong opinions.",
    },
}


# ── Internal helpers ──────────────────────────────────────────────────────────


def _build_agent_dict(row, display_name: Optional[str], is_stale: bool) -> dict:
    """Convert a DB row + extras into the agent response dict."""
    keys = row.keys()
    return {
        "id": row["id"],
        "name": row["name"],
        "display_name": display_name,
        "icon": row["icon"],
        "avatar_url": row["avatar_url"],
        "color": row["color"],
        "agent_session_key": row["agent_session_key"],
        "default_model": row["default_model"],
        "default_room_id": row["default_room_id"],
        "sort_order": row["sort_order"],
        "is_pinned": bool(row["is_pinned"]),
        "auto_spawn": bool(row["auto_spawn"]),
        "bio": row["bio"] if "bio" in keys else None,
        "source": row["source"] if "source" in keys else "openclaw",
        "project_path": row["project_path"] if "project_path" in keys else None,
        "permission_mode": row["permission_mode"] if "permission_mode" in keys else "default",
        "current_session_id": row["current_session_id"] if "current_session_id" in keys else None,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "is_stale": is_stale,
    }


def _validate_project_path(project_path: str) -> str:
    """Validate and resolve a project_path. Returns resolved absolute path.

    Raises HTTPException 400 if the path does not point to an existing directory.
    """
    resolved = Path(project_path).expanduser().resolve()
    if not resolved.is_dir():
        raise HTTPException(
            status_code=400,
            detail=f"project_path is not a valid directory: {project_path}",
        )
    return str(resolved)


def _validate_permission_mode(mode: str) -> str:
    """Validate permission_mode against known values (case-insensitive).

    Raises HTTPException 400 for unknown values. Returns the original string.
    """
    if mode.lower() not in _VALID_PERMISSION_MODES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown permission_mode: '{mode}'. Valid modes: {', '.join(sorted(_VALID_PERMISSION_MODES))}",
        )
    return mode


# ── Gateway sync ──────────────────────────────────────────────────────────────


async def get_gateway_agent_ids() -> set[str]:
    """Fetch the set of agent IDs currently configured in the OpenClaw gateway."""
    try:
        from app.services.connections import get_connection_manager

        manager = await get_connection_manager()
        conn = manager.get_default_openclaw()
        if not conn:
            return set()
        status = await conn.call("status")
        if not status:
            return set()
        heartbeat = status.get("heartbeat") or {}
        gw_agents = heartbeat.get("agents") or []
        return {a.get("agentId") for a in gw_agents if a.get("agentId")}
    except Exception as e:
        logger.warning(f"Could not fetch gateway agent IDs: {e}")
        return set()


async def sync_agents_from_gateway() -> int:
    """
    Discover agents from the Gateway heartbeat config and ensure each one
    exists in the local DB.  Returns the number of agents upserted.
    """
    try:
        from app.services.connections import get_connection_manager

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

        async with get_db() as db:
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
                upserted += db.total_changes

            await db.commit()

        if upserted:
            logger.info(f"Synced {upserted} new agent(s) from Gateway")
        return upserted

    except Exception as e:
        logger.warning(f"Failed to sync agents from Gateway: {e}")
        return 0


# ── Public service functions ──────────────────────────────────────────────────


async def list_agents(gateway_ids: set[str], gateway_reachable: bool) -> list[dict]:
    """Return all agents from DB with is_stale flag."""
    async with get_db() as db:
        async with db.execute("SELECT * FROM agents ORDER BY sort_order ASC, name ASC") as cursor:
            rows = await cursor.fetchall()

        # Fetch all display names in one query
        display_names: dict[str, str] = {}
        async with db.execute("SELECT session_key, display_name FROM session_display_names") as dn_cursor:
            async for dn_row in dn_cursor:
                display_names[dn_row["session_key"]] = dn_row["display_name"]

    agents = []
    for row in rows:
        session_key = row["agent_session_key"]
        agent_id = row["id"]
        source = row["source"] if "source" in row.keys() else "openclaw"

        if source == "claude_code":
            # CC agents are stale when their project_path doesn't exist on disk
            project_path = row["project_path"] if "project_path" in row.keys() else None
            is_stale = bool(project_path and not os.path.isdir(project_path))
        else:
            # OpenClaw agents use gateway reachability
            is_stale = gateway_reachable and (agent_id not in gateway_ids)

        display_name = display_names.get(session_key) if session_key else None
        agents.append(_build_agent_dict(row, display_name, is_stale))

    return agents


async def get_agent(agent_id: str, gateway_ids: set[str], gateway_reachable: bool) -> dict:
    """Return a single agent by ID. Raises 404 if not found."""
    async with get_db() as db:
        async with db.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)) as cursor:
            row = await cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail=MSG_AGENT_NOT_FOUND)

        session_key = row["agent_session_key"]
        display_name = None
        if session_key:
            async with db.execute(
                "SELECT display_name FROM session_display_names WHERE session_key = ?",
                (session_key,),
            ) as dn_cursor:
                dn_row = await dn_cursor.fetchone()
                if dn_row:
                    display_name = dn_row["display_name"]

    source = row["source"] if "source" in row.keys() else "openclaw"
    if source == "claude_code":
        project_path = row["project_path"] if "project_path" in row.keys() else None
        is_stale = bool(project_path and not os.path.isdir(project_path))
    else:
        is_stale = gateway_reachable and (row["id"] not in gateway_ids)
    return _build_agent_dict(row, display_name, is_stale)


async def create_agent(
    agent_id: str,
    name: str,
    icon: str = "🤖",
    color: str = "#6b7280",
    default_room_id: str = "headquarters",
    agent_session_key: Optional[str] = None,
    bio: Optional[str] = None,
    source: str = "openclaw",
    project_path: Optional[str] = None,
    permission_mode: str = "default",
) -> dict:
    """Insert a new agent. Raises 409 if agent_id already exists."""
    if project_path:
        project_path = _validate_project_path(project_path)
    if permission_mode:
        _validate_permission_mode(permission_mode)

    now = int(time.time() * 1000)

    # CC agents get a cc:<id> session key; OpenClaw agents get agent:<id>:main
    if source == "claude_code":
        session_key = agent_session_key or f"cc:{agent_id}"
    else:
        session_key = agent_session_key or f"agent:{agent_id}:main"

    resolved_bio = bio or f"{name} is a hardworking crew member."

    async with get_db() as db:
        async with db.execute("SELECT id FROM agents WHERE id = ?", (agent_id,)) as cur:
            if await cur.fetchone():
                raise HTTPException(status_code=409, detail=f"Agent '{agent_id}' already exists")

        await db.execute(
            """
            INSERT INTO agents
                (id, name, icon, color, agent_session_key,
                 default_model, default_room_id, sort_order,
                 is_pinned, auto_spawn, bio,
                 source, project_path, permission_mode,
                 created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, NULL, ?, 99, FALSE, TRUE, ?,
                    ?, ?, ?,
                    ?, ?)
            """,
            (
                agent_id,
                name,
                icon,
                color,
                session_key,
                default_room_id,
                resolved_bio,
                source,
                project_path,
                permission_mode,
                now,
                now,
            ),
        )
        await db.commit()

    return {"success": True, "agent_id": agent_id}


async def update_agent(agent_id: str, updates: dict) -> dict:
    """Apply a partial update to an agent. Raises 400 if empty, 404 if not found."""
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "project_path" in updates and updates["project_path"]:
        updates["project_path"] = _validate_project_path(updates["project_path"])
    if "permission_mode" in updates and updates["permission_mode"]:
        _validate_permission_mode(updates["permission_mode"])

    now = int(time.time() * 1000)
    updates["updated_at"] = now

    set_clauses = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [agent_id]

    async with get_db() as db:
        cursor = await db.execute(f"UPDATE agents SET {set_clauses} WHERE id = ?", values)
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail=MSG_AGENT_NOT_FOUND)
        await db.commit()

    # Return updated fields (excluding the internally-added updated_at)
    returned_fields = [k for k in updates if k != "updated_at"]
    return {"success": True, "agent_id": agent_id, "updated": returned_fields}


async def delete_agent(agent_id: str) -> dict:
    """Remove an agent from the registry. Raises 404 if not found."""
    async with get_db() as db:
        cursor = await db.execute("DELETE FROM agents WHERE id = ?", (agent_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail=MSG_AGENT_NOT_FOUND)
        await db.commit()

    return {"status": "deleted", "id": agent_id}
