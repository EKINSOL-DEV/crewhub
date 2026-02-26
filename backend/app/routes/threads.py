"""
Thread (Group Chat) routes for CrewHub.
Handles thread CRUD, participants, and message routing.
"""

import json
import logging
import time
import uuid
from typing import Annotated, Optional

import aiosqlite
from fastapi import APIRouter, HTTPException, Query

from app.db.database import get_db
from app.db.thread_models import (
    ThreadCreate,
    ThreadMessageSend,
    ThreadParticipantAdd,
    ThreadUpdate,
)
from app.routes.sse import broadcast
from app.services.connections import get_connection_manager

SQL_GET_THREAD = "SELECT * FROM threads WHERE id = ?"
MSG_THREAD_NOT_FOUND = "Thread not found"

logger = logging.getLogger(__name__)
router = APIRouter(tags=["threads"])

MAX_PARTICIPANTS = 5


def _gen_id() -> str:
    return str(uuid.uuid4())


def _now_ms() -> int:
    return int(time.time() * 1000)


def _generate_auto_title(agent_names: list[str]) -> str:
    """Generate auto title from agent names."""
    if len(agent_names) == 0:
        return "Empty group"
    if len(agent_names) == 1:
        return agent_names[0]
    if len(agent_names) <= 3:
        return ", ".join(agent_names)
    return f"Crew with {len(agent_names)} agents"


async def _get_thread_response(db: aiosqlite.Connection, thread_id: str) -> dict:
    """Build full thread response with participants."""
    cursor = await db.execute(SQL_GET_THREAD, (thread_id,))
    row = await cursor.fetchone()
    if not row:
        return None

    cursor = await db.execute(
        "SELECT * FROM thread_participants WHERE thread_id = ? AND is_active = 1 ORDER BY joined_at", (thread_id,)
    )
    participants = [dict(r) for r in await cursor.fetchall()]

    settings = {}
    try:
        settings = json.loads(row["settings_json"]) if row["settings_json"] else {}
    except (json.JSONDecodeError, TypeError):
        pass

    return {
        "id": row["id"],
        "kind": row["kind"],
        "title": row["title"],
        "title_auto": row["title_auto"],
        "created_by": row["created_by"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "archived_at": row["archived_at"],
        "last_message_at": row["last_message_at"],
        "participant_count": len(participants),
        "participants": [
            {
                "id": p["id"],
                "thread_id": p["thread_id"],
                "agent_id": p["agent_id"],
                "agent_name": p["agent_name"],
                "agent_icon": p["agent_icon"],
                "agent_color": p["agent_color"],
                "role": p["role"],
                "is_active": bool(p["is_active"]),
                "joined_at": p["joined_at"],
                "left_at": p["left_at"],
            }
            for p in participants
        ],
        "settings": settings,
    }


# ── Thread CRUD ─────────────────────────────────────────────────


@router.post("", responses={400: {"description": "Bad request"}, 404: {"description": "Not found"}})
async def create_thread(body: ThreadCreate):
    """Create a new thread (group chat)."""
    agent_ids = body.participant_agent_ids
    if len(agent_ids) < 2 and body.kind == "group":
        raise HTTPException(status_code=400, detail="Group threads need at least 2 agents")
    if len(agent_ids) > MAX_PARTICIPANTS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_PARTICIPANTS} participants allowed")

    # Remove duplicates preserving order
    seen = set()
    unique_ids = []
    for aid in agent_ids:
        if aid not in seen:
            seen.add(aid)
            unique_ids.append(aid)
    agent_ids = unique_ids

    now = _now_ms()
    thread_id = _gen_id()
    settings_json = json.dumps(body.settings or {"maxParticipants": MAX_PARTICIPANTS})

    async with get_db() as db:
        # Resolve agent info
        placeholders = ",".join("?" * len(agent_ids))
        cursor = await db.execute(f"SELECT id, name, icon, color FROM agents WHERE id IN ({placeholders})", agent_ids)
        agents = {r["id"]: dict(r) for r in await cursor.fetchall()}

        # Validate all agents exist
        missing = [aid for aid in agent_ids if aid not in agents]
        if missing:
            raise HTTPException(status_code=404, detail=f"Agents not found: {', '.join(missing)}")

        # Generate auto title
        agent_names = [agents[aid]["name"] for aid in agent_ids]
        title_auto = _generate_auto_title(agent_names)

        # Insert thread
        await db.execute(
            """INSERT INTO threads (id, kind, title, title_auto, created_by, created_at, updated_at, settings_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (thread_id, body.kind, body.title, title_auto, "user", now, now, settings_json),
        )

        # Insert participants
        for i, aid in enumerate(agent_ids):
            agent = agents[aid]
            role = "owner" if i == 0 else "member"
            await db.execute(
                """INSERT INTO thread_participants (id, thread_id, agent_id, agent_name, agent_icon, agent_color, role, is_active, joined_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)""",
                (_gen_id(), thread_id, aid, agent["name"], agent.get("icon"), agent.get("color"), role, now),
            )

        # System message
        await db.execute(
            """INSERT INTO thread_messages (id, thread_id, role, content, created_at)
               VALUES (?, ?, 'system', ?, ?)""",
            (_gen_id(), thread_id, f"Group created with {', '.join(agent_names)}", now),
        )

        await db.commit()

        result = await _get_thread_response(db, thread_id)

    # SSE broadcast
    await broadcast("thread.created", result)

    return result


@router.get("")
async def list_threads(
    kind: Annotated[Optional[str], Query(default=None)],
    archived: Annotated[bool, Query(default=False)],
    limit: Annotated[int, Query(default=50, ge=1, le=200)],
):
    """List threads, optionally filtered by kind."""
    async with get_db() as db:
        conditions = []
        params = []

        if kind:
            conditions.append("t.kind = ?")
            params.append(kind)

        if not archived:
            conditions.append("t.archived_at IS NULL")
        else:
            conditions.append("t.archived_at IS NOT NULL")

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        cursor = await db.execute(
            f"""SELECT t.* FROM threads t {where}
                ORDER BY COALESCE(t.last_message_at, t.created_at) DESC
                LIMIT ?""",
            params + [limit],
        )
        threads = await cursor.fetchall()

        results = []
        for t in threads:
            result = await _get_thread_response(db, t["id"])
            if result:
                results.append(result)

    return {"threads": results}


@router.get("/{thread_id}", responses={404: {"description": "Not found"}})
async def get_thread(thread_id: str):
    """Get thread detail with participants."""
    async with get_db() as db:
        result = await _get_thread_response(db, thread_id)
        if not result:
            raise HTTPException(status_code=404, detail=MSG_THREAD_NOT_FOUND)
        return result


@router.patch("/{thread_id}", responses={404: {"description": "Not found"}})
async def update_thread(thread_id: str, body: ThreadUpdate):
    """Update thread (rename, archive)."""
    now = _now_ms()
    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM threads WHERE id = ?", (thread_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail=MSG_THREAD_NOT_FOUND)

        if body.title is not None:
            await db.execute("UPDATE threads SET title = ?, updated_at = ? WHERE id = ?", (body.title, now, thread_id))

        if body.archived is not None:
            archived_at = now if body.archived else None
            await db.execute(
                "UPDATE threads SET archived_at = ?, updated_at = ? WHERE id = ?", (archived_at, now, thread_id)
            )

        await db.commit()
        result = await _get_thread_response(db, thread_id)

    await broadcast("thread.updated", result)
    return result


# ── Participants ────────────────────────────────────────────────


@router.post(
    "/{thread_id}/participants", responses={400: {"description": "Bad request"}, 404: {"description": "Not found"}}
)
async def add_participants(thread_id: str, body: ThreadParticipantAdd):
    """Add agents to a thread."""
    now = _now_ms()
    async with get_db() as db:
        cursor = await db.execute(SQL_GET_THREAD, (thread_id,))
        thread = await cursor.fetchone()
        if not thread:
            raise HTTPException(status_code=404, detail=MSG_THREAD_NOT_FOUND)

        # Count current active participants
        cursor = await db.execute(
            "SELECT COUNT(*) as cnt FROM thread_participants WHERE thread_id = ? AND is_active = 1", (thread_id,)
        )
        current_count = (await cursor.fetchone())["cnt"]

        if current_count + len(body.agent_ids) > MAX_PARTICIPANTS:
            raise HTTPException(status_code=400, detail=f"Would exceed max {MAX_PARTICIPANTS} participants")

        # Resolve agents
        placeholders = ",".join("?" * len(body.agent_ids))
        cursor = await db.execute(
            f"SELECT id, name, icon, color FROM agents WHERE id IN ({placeholders})", body.agent_ids
        )
        agents = {r["id"]: dict(r) for r in await cursor.fetchall()}

        added = []
        for aid in body.agent_ids:
            if aid not in agents:
                continue

            agent = agents[aid]
            # Check if already exists (reactivate if inactive)
            cursor = await db.execute(
                "SELECT id, is_active FROM thread_participants WHERE thread_id = ? AND agent_id = ?", (thread_id, aid)
            )
            existing = await cursor.fetchone()

            if existing:
                if not existing["is_active"]:
                    await db.execute(
                        "UPDATE thread_participants SET is_active = 1, left_at = NULL, joined_at = ? WHERE id = ?",
                        (now, existing["id"]),
                    )
                    added.append(aid)
            else:
                await db.execute(
                    """INSERT INTO thread_participants (id, thread_id, agent_id, agent_name, agent_icon, agent_color, role, is_active, joined_at)
                       VALUES (?, ?, ?, ?, ?, ?, 'member', 1, ?)""",
                    (_gen_id(), thread_id, aid, agent["name"], agent.get("icon"), agent.get("color"), now),
                )
                added.append(aid)

        if added:
            # Update auto title
            cursor = await db.execute(
                "SELECT agent_name FROM thread_participants WHERE thread_id = ? AND is_active = 1", (thread_id,)
            )
            names = [r["agent_name"] for r in await cursor.fetchall()]
            title_auto = _generate_auto_title(names)
            await db.execute(
                "UPDATE threads SET title_auto = ?, updated_at = ? WHERE id = ?", (title_auto, now, thread_id)
            )

            # System message
            added_names = [agents[a]["name"] for a in added]
            await db.execute(
                """INSERT INTO thread_messages (id, thread_id, role, content, created_at)
                   VALUES (?, ?, 'system', ?, ?)""",
                (_gen_id(), thread_id, f"{', '.join(added_names)} joined the group", now),
            )

        await db.commit()
        result = await _get_thread_response(db, thread_id)

    for aid in added:
        await broadcast("thread.participant.joined", {"threadId": thread_id, "agentId": aid})

    return result


@router.delete("/{thread_id}/participants/{agent_id}", responses={404: {"description": "Not found"}})
async def remove_participant(thread_id: str, agent_id: str):
    """Remove an agent from a thread (soft delete)."""
    now = _now_ms()
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT id, agent_name FROM thread_participants WHERE thread_id = ? AND agent_id = ? AND is_active = 1",
            (thread_id, agent_id),
        )
        participant = await cursor.fetchone()
        if not participant:
            raise HTTPException(status_code=404, detail="Participant not found or already removed")

        await db.execute(
            "UPDATE thread_participants SET is_active = 0, left_at = ? WHERE id = ?", (now, participant["id"])
        )

        # Update auto title
        cursor = await db.execute(
            "SELECT agent_name FROM thread_participants WHERE thread_id = ? AND is_active = 1", (thread_id,)
        )
        names = [r["agent_name"] for r in await cursor.fetchall()]
        title_auto = _generate_auto_title(names)
        await db.execute("UPDATE threads SET title_auto = ?, updated_at = ? WHERE id = ?", (title_auto, now, thread_id))

        # System message
        await db.execute(
            """INSERT INTO thread_messages (id, thread_id, role, content, created_at)
               VALUES (?, ?, 'system', ?, ?)""",
            (_gen_id(), thread_id, f"{participant['agent_name']} left the group", now),
        )

        await db.commit()
        result = await _get_thread_response(db, thread_id)

    await broadcast("thread.participant.left", {"threadId": thread_id, "agentId": agent_id})
    return result


# ── Messages ────────────────────────────────────────────────────


@router.get("/{thread_id}/messages", responses={404: {"description": "Not found"}})
async def get_messages(
    thread_id: str,
    limit: Annotated[int, Query(default=50, ge=1, le=200)],
    before: Annotated[Optional[int], Query(default=None)],
):
    """Get messages for a thread with pagination."""
    async with get_db() as db:
        # Verify thread exists
        cursor = await db.execute("SELECT id FROM threads WHERE id = ?", (thread_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail=MSG_THREAD_NOT_FOUND)

        conditions = ["thread_id = ?"]
        params: list = [thread_id]

        if before is not None:
            conditions.append("created_at < ?")
            params.append(before)

        where = " AND ".join(conditions)
        cursor = await db.execute(
            f"""SELECT * FROM thread_messages
                WHERE {where}
                ORDER BY created_at DESC
                LIMIT ?""",
            params + [limit + 1],
        )
        rows = await cursor.fetchall()

    has_more = len(rows) > limit
    rows = rows[:limit]
    rows.reverse()  # chronological order

    messages = []
    for r in rows:
        target_ids = None
        if r["target_agent_ids_json"]:
            try:
                target_ids = json.loads(r["target_agent_ids_json"])
            except (json.JSONDecodeError, TypeError):
                pass

        messages.append(
            {
                "id": r["id"],
                "thread_id": r["thread_id"],
                "role": r["role"],
                "content": r["content"],
                "agent_id": r["agent_id"],
                "agent_name": r["agent_name"],
                "routing_mode": r["routing_mode"],
                "target_agent_ids": target_ids,
                "created_at": r["created_at"],
            }
        )

    return {
        "messages": messages,
        "hasMore": has_more,
        "oldestTimestamp": messages[0]["created_at"] if messages else None,
    }


async def _route_to_agent(conn, thread_id: str, agent_id: str, participants: list, full_message: str) -> Optional[dict]:
    """Send a message to one agent, save the response, and return the saved message dict (or None on failure)."""
    try:
        response_text = await conn.send_chat(message=full_message, agent_id=agent_id, timeout=90.0)
        if not response_text:
            return None

        agent_info = next((p for p in participants if p["agent_id"] == agent_id), None)
        agent_name = agent_info["agent_name"] if agent_info else agent_id
        msg_id = _gen_id()
        msg_now = _now_ms()

        async with get_db() as db:
            await db.execute(
                "INSERT INTO thread_messages (id, thread_id, role, content, agent_id, agent_name, created_at) VALUES (?, ?, 'assistant', ?, ?, ?, ?)",
                (msg_id, thread_id, response_text, agent_id, agent_name, msg_now),
            )
            await db.execute(
                "UPDATE threads SET last_message_at = ?, updated_at = ? WHERE id = ?", (msg_now, msg_now, thread_id)
            )
            await db.commit()

        return {
            "id": msg_id,
            "thread_id": thread_id,
            "role": "assistant",
            "content": response_text,
            "agent_id": agent_id,
            "agent_name": agent_name,
            "routing_mode": None,
            "target_agent_ids": None,
            "created_at": msg_now,
        }
    except Exception as e:
        logger.error(f"Failed to get response from agent {agent_id}: {e}")
        err_id = _gen_id()
        err_now = _now_ms()
        async with get_db() as db:
            await db.execute(
                "INSERT INTO thread_messages (id, thread_id, role, content, agent_id, agent_name, created_at) VALUES (?, ?, 'system', ?, ?, ?, ?)",
                (err_id, thread_id, "Failed to reach agent", agent_id, agent_id, err_now),
            )
            await db.commit()
        return None


@router.post(
    "/{thread_id}/messages", responses={400: {"description": "Bad request"}, 404: {"description": "Not found"}}
)
async def send_message(thread_id: str, body: ThreadMessageSend):
    """Send a message to a thread, routing to agents."""
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(content) > 5000:
        content = content[:5000]

    now = _now_ms()

    async with get_db() as db:
        # Get thread + active participants
        cursor = await db.execute(SQL_GET_THREAD, (thread_id,))
        thread = await cursor.fetchone()
        if not thread:
            raise HTTPException(status_code=404, detail=MSG_THREAD_NOT_FOUND)
        if thread["archived_at"]:
            raise HTTPException(status_code=400, detail="Thread is archived")

        cursor = await db.execute(
            "SELECT * FROM thread_participants WHERE thread_id = ? AND is_active = 1", (thread_id,)
        )
        participants = [dict(r) for r in await cursor.fetchall()]

        if not participants:
            raise HTTPException(status_code=400, detail="No active participants in thread")

        # Determine target agents
        if body.routing_mode == "targeted" and body.target_agent_ids:
            target_ids = [p["agent_id"] for p in participants if p["agent_id"] in body.target_agent_ids]
        else:
            target_ids = [p["agent_id"] for p in participants]

        if not target_ids:
            raise HTTPException(status_code=400, detail="No valid target agents")

        # Save user message
        user_msg_id = _gen_id()
        target_json = json.dumps(body.target_agent_ids) if body.target_agent_ids else None
        await db.execute(
            """INSERT INTO thread_messages (id, thread_id, role, content, routing_mode, target_agent_ids_json, created_at)
               VALUES (?, ?, 'user', ?, ?, ?, ?)""",
            (user_msg_id, thread_id, content, body.routing_mode, target_json, now),
        )

        await db.execute("UPDATE threads SET last_message_at = ?, updated_at = ? WHERE id = ?", (now, now, thread_id))
        await db.commit()

    # Broadcast user message event
    user_msg = {
        "id": user_msg_id,
        "thread_id": thread_id,
        "role": "user",
        "content": content,
        "agent_id": None,
        "agent_name": None,
        "routing_mode": body.routing_mode,
        "target_agent_ids": body.target_agent_ids,
        "created_at": now,
    }
    await broadcast("thread.message.created", {"threadId": thread_id, "message": user_msg})

    # Route to each target agent via OpenClaw
    manager = await get_connection_manager()
    conn = manager.get_default_openclaw()

    responses = []
    if conn:
        participant_names = [p["agent_name"] for p in participants]
        context = (
            f"[Group Chat: {thread.get('title') or thread.get('title_auto', 'Group')}]\n"
            f"[Participants: {', '.join(participant_names)}]\n"
            f"[Routing: {body.routing_mode}]\n\n"
        )
        for agent_id in target_ids:
            resp_msg = await _route_to_agent(conn, thread_id, agent_id, participants, context + content)
            if resp_msg:
                responses.append(resp_msg)
                await broadcast("thread.message.created", {"threadId": thread_id, "message": resp_msg})
    else:
        logger.warning("No OpenClaw connection available for thread message routing")

    return {
        "success": True,
        "user_message": user_msg,
        "responses": responses,
        "routed_to": target_ids,
    }
