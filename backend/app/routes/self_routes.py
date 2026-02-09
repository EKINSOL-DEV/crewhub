"""
/api/self/* endpoints for agent self-service.

Agents use these to identify themselves, set display names,
assign rooms, and check their own status — without needing
to know their session key upfront.

Phase 1 of Agent Onboarding Masterplan.
"""

import json
import logging
import time
from typing import Optional

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import (
    APIKeyInfo,
    check_identity_creation_rate,
    record_identity_creation,
    require_scope,
)
from app.db.database import get_db
from app.routes.sse import broadcast

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/self", tags=["self"])


# ── Request/Response Models ───────────────────────────────────────────

class IdentifyRequest(BaseModel):
    agent_id: str = Field(..., min_length=1, max_length=128,
                          description="Stable agent identity, e.g. 'agent:dev'")
    runtime: Optional[str] = Field(None, max_length=64,
                                   description="Runtime type: openclaw, claude-code, codex")
    session_key: Optional[str] = Field(None, max_length=256,
                                       description="Current session key (optional if key is bound)")


class IdentifyResponse(BaseModel):
    agent_id: str
    session_key: Optional[str] = None
    scopes: list[str]
    display_name: Optional[str] = None
    room_id: Optional[str] = None
    agent_metadata: dict = {}
    created: bool = False  # True if agent_id was newly created


class SelfInfoResponse(BaseModel):
    agent_id: Optional[str] = None
    session_key: Optional[str] = None
    scopes: list[str]
    display_name: Optional[str] = None
    room_id: Optional[str] = None
    agent_metadata: dict = {}


class DisplayNameRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=256)


class RoomRequest(BaseModel):
    room_id: str = Field(..., min_length=1, max_length=128)


class HeartbeatRequest(BaseModel):
    status: Optional[str] = None
    task: Optional[str] = None


class OkResponse(BaseModel):
    ok: bool = True


# ── Helpers ───────────────────────────────────────────────────────────

async def _resolve_agent_id(key: APIKeyInfo) -> Optional[str]:
    """Resolve agent_id from API key binding or most recent identity."""
    # 1. Key is bound to agent_id
    if key.agent_id:
        return key.agent_id

    # 2. Check agent_identities for this key
    db = await get_db()
    try:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT agent_id FROM agent_identities WHERE api_key_id = ? ORDER BY last_seen_at DESC LIMIT 1",
            (key.key_id,),
        ) as cursor:
            row = await cursor.fetchone()
            return row["agent_id"] if row else None
    finally:
        await db.close()


async def _resolve_session_key(key: APIKeyInfo, agent_id: str) -> Optional[str]:
    """Resolve most recent session_key for an agent, scoped to the calling key."""
    db = await get_db()
    try:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT session_key FROM agent_identities WHERE agent_id = ? AND api_key_id = ? ORDER BY last_seen_at DESC LIMIT 1",
            (agent_id, key.key_id),
        ) as cursor:
            row = await cursor.fetchone()
            return row["session_key"] if row else None
    finally:
        await db.close()


async def _get_agent_metadata(agent_id: str) -> dict:
    """Fetch agent metadata from agents table."""
    db = await get_db()
    try:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT icon, color, avatar_url, bio, default_model, default_room_id FROM agents WHERE id = ?",
            (agent_id,),
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                return {}
            return {k: row[k] for k in row.keys() if row[k] is not None}
    finally:
        await db.close()


async def _get_display_name(session_key: str) -> Optional[str]:
    """Get display name for a session."""
    db = await get_db()
    try:
        async with db.execute(
            "SELECT display_name FROM session_display_names WHERE session_key = ?",
            (session_key,),
        ) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else None
    finally:
        await db.close()


async def _get_room_id(session_key: str) -> Optional[str]:
    """Get room assignment for a session."""
    db = await get_db()
    try:
        async with db.execute(
            "SELECT room_id FROM session_room_assignments WHERE session_key = ?",
            (session_key,),
        ) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else None
    finally:
        await db.close()


# ── Routes ────────────────────────────────────────────────────────────

@router.post("/identify", response_model=IdentifyResponse)
async def identify(
    body: IdentifyRequest,
    key: APIKeyInfo = Depends(require_scope("self")),
):
    """
    Identify this agent to CrewHub.
    
    Binds the caller's API key to an agent_id and session_key.
    Creates the agent in the registry if it doesn't exist.
    Idempotent: calling with the same data is a no-op.
    
    Binding rules (Section 4.5 of masterplan):
    - Bound key: can only operate as its bound agent_id
    - Unbound self key: can only claim existing agent_id associated with this key
    - Unbound manage+ key: can create new agent_ids (rate-limited)
    """
    agent_id = body.agent_id
    session_key = body.session_key
    now = int(time.time() * 1000)

    # ── Rule 1: Bound keys lock identity ──
    if key.agent_id and key.agent_id != agent_id:
        raise HTTPException(
            status_code=403,
            detail=f"API key is bound to agent_id '{key.agent_id}'. "
                   f"Cannot identify as '{agent_id}'.",
        )

    # ── Check if agent_id exists ──
    db = await get_db()
    try:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id FROM agents WHERE id = ?", (agent_id,)
        ) as cursor:
            agent_exists = await cursor.fetchone() is not None

        if not agent_exists:
            # ── Rule 2: Unbound keys need manage+ to create new identities ──
            if not key.agent_id and not key.has_scope("manage"):
                raise HTTPException(
                    status_code=403,
                    detail=f"Agent '{agent_id}' does not exist. "
                           f"Creating new agents requires 'manage' scope. "
                           f"Your scopes: {key.scopes}",
                )

            # ── Rule 4: Rate limit identity creation ──
            if not check_identity_creation_rate(key.key_id):
                raise HTTPException(
                    status_code=429,
                    detail="Identity creation rate limit exceeded "
                           f"(max {10} per hour per key). "
                           "Try again later.",
                )

            # Auto-create agent in registry
            await db.execute(
                """INSERT INTO agents (id, name, icon, color, agent_session_key,
                   default_room_id, sort_order, is_pinned, auto_spawn, created_at, updated_at)
                   VALUES (?, ?, '🤖', '#6b7280', ?, 'headquarters', 99, 0, 1, ?, ?)""",
                (agent_id, agent_id.split(":")[-1].capitalize(),
                 session_key, now, now),
            )
            await db.commit()
            record_identity_creation(key.key_id, agent_id)
            created = True
            logger.info(f"Auto-created agent '{agent_id}' via identify")
        else:
            created = False

            # ── Rule: Unbound non-manage keys can only claim agent_ids they own ──
            if not key.agent_id and not key.has_scope("manage"):
                async with db.execute(
                    "SELECT api_key_id FROM agent_identities WHERE agent_id = ? LIMIT 1",
                    (agent_id,),
                ) as cursor:
                    existing = await cursor.fetchone()
                if existing and existing[0] != key.key_id:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Agent '{agent_id}' is owned by another key. "
                               f"Cannot claim.",
                    )

            # Update agent_session_key if session_key provided
            if session_key:
                await db.execute(
                    "UPDATE agents SET agent_session_key = ?, updated_at = ? WHERE id = ?",
                    (session_key, now, agent_id),
                )
                await db.commit()

        # ── Insert/update agent_identity binding (ownership-safe) ──
        if session_key:
            # Check if binding exists with different key (prevent takeover)
            async with db.execute(
                "SELECT api_key_id FROM agent_identities WHERE agent_id = ? AND session_key = ?",
                (agent_id, session_key),
            ) as cursor:
                existing_binding = await cursor.fetchone()

            if existing_binding and existing_binding[0] != key.key_id:
                raise HTTPException(
                    status_code=403,
                    detail=f"Identity binding (agent_id={agent_id}, session_key={session_key}) "
                           f"is owned by another key. Cannot overwrite.",
                )

            await db.execute(
                """INSERT INTO agent_identities (agent_id, session_key, api_key_id, runtime, bound_at, last_seen_at)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(agent_id, session_key) DO UPDATE SET
                       runtime = excluded.runtime,
                       last_seen_at = excluded.last_seen_at""",
                (agent_id, session_key, key.key_id, body.runtime, now, now),
            )
            await db.commit()

    finally:
        await db.close()

    # ── Build response ──
    display_name = await _get_display_name(session_key) if session_key else None
    room_id = await _get_room_id(session_key) if session_key else None
    metadata = await _get_agent_metadata(agent_id)

    # If no room assigned and agent has default_room_id, use that
    if not room_id and metadata.get("default_room_id"):
        room_id = metadata["default_room_id"]

    return IdentifyResponse(
        agent_id=agent_id,
        session_key=session_key,
        scopes=key.scopes,
        display_name=display_name or metadata.get("name"),
        room_id=room_id,
        agent_metadata={k: v for k, v in metadata.items()
                       if k not in ("default_room_id",)},
        created=created,
    )


@router.get("", response_model=SelfInfoResponse)
async def get_self(
    key: APIKeyInfo = Depends(require_scope("self")),
):
    """
    Get current identity and status.
    
    Returns the agent_id, session_key, scopes, display name,
    and room assignment for the authenticated caller.
    """
    agent_id = await _resolve_agent_id(key)
    if not agent_id:
        return SelfInfoResponse(
            scopes=key.scopes,
        )

    session_key = await _resolve_session_key(key, agent_id)
    display_name = await _get_display_name(session_key) if session_key else None
    room_id = await _get_room_id(session_key) if session_key else None
    metadata = await _get_agent_metadata(agent_id)

    if not room_id and metadata.get("default_room_id"):
        room_id = metadata["default_room_id"]

    return SelfInfoResponse(
        agent_id=agent_id,
        session_key=session_key,
        scopes=key.scopes,
        display_name=display_name or metadata.get("name"),
        room_id=room_id,
        agent_metadata={k: v for k, v in metadata.items()
                       if k not in ("default_room_id",)},
    )


@router.post("/display-name")
async def set_display_name(
    body: DisplayNameRequest,
    key: APIKeyInfo = Depends(require_scope("self")),
):
    """
    Set display name for the authenticated agent's current session.
    
    Idempotent: setting the same name is a no-op.
    """
    agent_id = await _resolve_agent_id(key)
    if not agent_id:
        raise HTTPException(
            status_code=400,
            detail="No identity found. Call POST /api/self/identify first.",
        )

    session_key = await _resolve_session_key(key, agent_id)
    if not session_key:
        raise HTTPException(
            status_code=400,
            detail="No session key found. Call POST /api/self/identify with a session_key first.",
        )

    now = int(time.time() * 1000)
    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO session_display_names (session_key, display_name, updated_at)
               VALUES (?, ?, ?)
               ON CONFLICT(session_key) DO UPDATE SET
                   display_name = excluded.display_name,
                   updated_at = excluded.updated_at""",
            (session_key, body.display_name, now),
        )
        await db.commit()
    finally:
        await db.close()

    return {"ok": True, "display_name": body.display_name, "session_key": session_key}


@router.post("/room")
async def set_room(
    body: RoomRequest,
    key: APIKeyInfo = Depends(require_scope("self")),
):
    """
    Assign the authenticated agent's current session to a room.
    
    Idempotent: assigning to the same room is a no-op.
    """
    agent_id = await _resolve_agent_id(key)
    if not agent_id:
        raise HTTPException(
            status_code=400,
            detail="No identity found. Call POST /api/self/identify first.",
        )

    session_key = await _resolve_session_key(key, agent_id)
    if not session_key:
        raise HTTPException(
            status_code=400,
            detail="No session key found. Call POST /api/self/identify with a session_key first.",
        )

    # Verify room exists
    db = await get_db()
    try:
        async with db.execute(
            "SELECT id FROM rooms WHERE id = ?", (body.room_id,)
        ) as cursor:
            if not await cursor.fetchone():
                raise HTTPException(status_code=404, detail=f"Room '{body.room_id}' not found.")

        now = int(time.time() * 1000)
        await db.execute(
            """INSERT INTO session_room_assignments (session_key, room_id, assigned_at)
               VALUES (?, ?, ?)
               ON CONFLICT(session_key) DO UPDATE SET
                   room_id = excluded.room_id,
                   assigned_at = excluded.assigned_at""",
            (session_key, body.room_id, now),
        )
        await db.commit()
    finally:
        await db.close()

    await broadcast("rooms-refresh", {
        "action": "assignment_changed",
        "session_key": session_key,
        "room_id": body.room_id,
    })

    return {"ok": True, "room_id": body.room_id, "session_key": session_key}


@router.post("/heartbeat")
async def heartbeat(
    body: HeartbeatRequest,
    key: APIKeyInfo = Depends(require_scope("self")),
):
    """
    Update agent presence/heartbeat.
    
    Optional but useful for real-time dashboards.
    Updates last_seen_at in agent_identities.
    """
    agent_id = await _resolve_agent_id(key)
    if not agent_id:
        raise HTTPException(
            status_code=400,
            detail="No identity found. Call POST /api/self/identify first.",
        )

    session_key = await _resolve_session_key(key, agent_id)
    now = int(time.time() * 1000)

    if session_key:
        db = await get_db()
        try:
            await db.execute(
                "UPDATE agent_identities SET last_seen_at = ? WHERE agent_id = ? AND session_key = ?",
                (now, agent_id, session_key),
            )
            await db.commit()
        finally:
            await db.close()

    return {"ok": True}
