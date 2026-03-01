"""
Chat routes for CrewHub agent chat.
Handles message history retrieval, sending messages, and session info.
Phase 1: non-streaming (send message, get full response).
"""

from __future__ import annotations

import logging
import re
import time
from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.connections import get_connection_manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])

# ── Validation ──────────────────────────────────────────────────

FIXED_AGENT_PATTERN = re.compile(r"^(agent:[a-zA-Z0-9_-]+:main|cc:[a-zA-Z0-9_-]+|claude:[a-zA-Z0-9_-]+)$")

AGENT_DISPLAY_NAMES = {
    "main": "Assistent",
    "flowy": "Flowy",
    "creator": "Creator",
    "dev": "Dev",
    "reviewer": "Reviewer",
    "webdev": "Webdev",
    "gamedev": "Game Dev",
}


def _validate_session_key(session_key: str) -> None:
    """Only allow fixed agent session keys (agent:*:main or cc:*)."""
    if not FIXED_AGENT_PATTERN.match(session_key):
        raise HTTPException(
            status_code=403,
            detail="Chat is only available for fixed agent sessions (agent:*:main or cc:*)",
        )


def _get_agent_id(session_key: str) -> str:
    """Extract agent id from session key.

    'agent:main:main' -> 'main'
    'cc:mybot' -> 'mybot'
    'claude:abc123' -> 'abc123'
    """
    if session_key.startswith("cc:"):
        return session_key[3:]
    if session_key.startswith("claude:"):
        return session_key[7:]
    parts = session_key.split(":")
    return parts[1] if len(parts) > 1 else "main"


async def _get_agent_source(agent_id: str, session_key: str = "") -> str:
    """Look up the agent's source from the DB. Defaults to 'openclaw'."""
    if session_key.startswith("claude:"):
        return "claude_code"
    try:
        from app.db.database import get_db

        async with get_db() as db:
            async with db.execute("SELECT source FROM agents WHERE id = ?", (agent_id,)) as cursor:
                row = await cursor.fetchone()
                if row and "source" in row.keys():
                    return row["source"]
    except Exception:
        pass
    return "openclaw"


async def _get_discovered_project_path(session_id: str) -> Optional[str]:
    """Get project_path for a discovered CC session from the watcher."""
    try:
        from app.services.connections.claude_code import ClaudeCodeConnection

        manager = await get_connection_manager()
        cc_conn = next(
            (c for c in manager._connections.values() if isinstance(c, ClaudeCodeConnection) and c.is_connected()),
            None,
        )
        if not cc_conn or not cc_conn._watcher:
            return None
        ws = cc_conn._watcher.get_watched_sessions().get(session_id)
        return ws.project_path if ws else None
    except Exception:
        return None


# ── Rate limiter ────────────────────────────────────────────────

# Separate rate limiter dicts for /send and /stream to prevent stream→send fallback
# from getting a 429 when stream fails quickly.
_last_send: dict[str, float] = {}
_last_stream: dict[str, float] = {}
COOLDOWN_SEND = 3.0
COOLDOWN_STREAM = 5.0  # Longer cooldown for stream to allow send fallback within 5s


def _check_rate_limit_send(session_key: str) -> None:
    """Enforce max 1 /send per COOLDOWN_SEND seconds per session."""
    now = time.time()
    last = _last_send.get(session_key, 0)
    if now - last < COOLDOWN_SEND:
        remaining = COOLDOWN_SEND - (now - last)
        raise HTTPException(
            status_code=429,
            detail=f"Rate limited. Try again in {remaining:.1f}s",
        )
    _last_send[session_key] = now


def _check_rate_limit_stream(session_key: str) -> None:
    """Enforce max 1 /stream per COOLDOWN_STREAM seconds per session."""
    now = time.time()
    last = _last_stream.get(session_key, 0)
    if now - last < COOLDOWN_STREAM:
        remaining = COOLDOWN_STREAM - (now - last)
        raise HTTPException(
            status_code=429,
            detail=f"Rate limited. Try again in {remaining:.1f}s",
        )
    _last_stream[session_key] = now


# ── Context separator ────────────────────────────────────────────

# Separator between the crewhub-context block and the actual user message.
# This makes stripping deterministic in the history endpoint.
CREWHUB_MSG_SEP = "\n\n---[user-message-start]---\n"


# ── Models ──────────────────────────────────────────────────────


class SendMessageBody(BaseModel):
    message: str
    room_id: Optional[str] = None


def _normalize_timestamp(value: object) -> int:
    if isinstance(value, str):
        from datetime import datetime

        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return int(dt.timestamp() * 1000)
        except (ValueError, TypeError):
            return 0
    if isinstance(value, (int, float)):
        return int(value * 1000) if value < 1e12 else int(value)
    return 0


def _tool_label(name: str, input_data: dict | None) -> str:
    """Extract a concise label from a tool's input for display in chat bubbles."""
    if not input_data or not isinstance(input_data, dict):
        return ""
    # Map tool names to the most descriptive input field
    field_map: dict[str, list[str]] = {
        "Agent": ["description"],
        "Read": ["file_path"],
        "Write": ["file_path"],
        "Edit": ["file_path"],
        "Bash": ["description", "command"],
        "Grep": ["pattern"],
        "Glob": ["pattern"],
        "WebSearch": ["query"],
        "WebFetch": ["url"],
        "Skill": ["skill"],
    }
    fields = field_map.get(name, [])
    for f in fields:
        val = input_data.get(f)
        if isinstance(val, str) and val:
            # Truncate long values
            return val[:60] + ("…" if len(val) > 60 else "")
    # Fallback: try common fields
    for f in ("description", "file_path", "pattern", "query", "prompt"):
        val = input_data.get(f)
        if isinstance(val, str) and val:
            return val[:60] + ("…" if len(val) > 60 else "")
    return ""


def _extract_content_parts(raw_content: object, raw: bool) -> tuple[list[str], list[dict], list[str]]:  # NOSONAR
    content_parts: list[str] = []
    tools: list[dict] = []
    thinking_blocks: list[str] = []

    if isinstance(raw_content, str):
        return [raw_content], tools, thinking_blocks
    if not isinstance(raw_content, list):
        return content_parts, tools, thinking_blocks

    for block in raw_content:
        if isinstance(block, str):
            content_parts.append(block)
            continue
        if not isinstance(block, dict):
            continue
        btype = block.get("type", "")
        if btype == "text" and block.get("text"):
            content_parts.append(block["text"])
        elif btype == "thinking" and block.get("thinking"):
            thinking_blocks.append(block["thinking"])
        elif btype == "tool_use":
            tool_name = block.get("name", "unknown")
            tool_input = block.get("input", {})
            tool_info: dict = {"name": tool_name, "status": "called"}
            label = _tool_label(tool_name, tool_input)
            if label:
                tool_info["label"] = label
            if raw:
                tool_info["input"] = tool_input
            tools.append(tool_info)
        elif btype == "tool_result":
            result_content = block.get("content", "")
            if raw and isinstance(result_content, str) and len(result_content) > 500:
                result_content = result_content[:500] + "..."
            tool_info = {
                "name": block.get("toolName") or block.get("name") or "tool",
                "status": "error" if block.get("isError", False) else "done",
            }
            if raw:
                tool_info["result"] = result_content
            tools.append(tool_info)

    return content_parts, tools, thinking_blocks


def _strip_context_envelope(content: str) -> str:
    if CREWHUB_MSG_SEP in content:
        return content.split(CREWHUB_MSG_SEP, 1)[1].strip()

    segments = [seg.strip() for seg in content.split("\n\n") if seg.strip()]
    context_prefixes = (
        "```crewhub-context",
        "**You are",
        "**Visual",
        "(You may",
        "## Identity",
        "## Behavior",
        "## Visual",
        "## Persona",
    )
    real_segments = [
        seg
        for seg in segments
        if not any(seg.startswith(prefix) for prefix in context_prefixes)
        and not seg.startswith("```")
        and "crewhub-context" not in seg
    ]
    return real_segments[-1] if real_segments else ""


def _skip_user_message(content: str) -> bool:
    other_markers = [
        "[System Message]",
        "A completed subagent task is ready for user delivery",
        "Conversation info (untrusted metadata)",
        "[HEARTBEAT]",
        "HEARTBEAT_OK",
        "Read HEARTBEAT.md",
    ]
    if any(marker in content for marker in other_markers):
        return True
    stripped = content.strip()
    return stripped.startswith("```") and ("message_id" in content or "sender_id" in content)


def _build_history_message(idx: int, entry: dict, raw: bool) -> dict | None:  # NOSONAR
    msg = entry.get("message", {}) if isinstance(entry.get("message"), dict) else {}
    role = msg.get("role") or entry.get("role")
    if role not in ("user", "assistant", "system"):
        return None

    timestamp = _normalize_timestamp(entry.get("timestamp") or msg.get("timestamp") or 0)
    raw_content = msg.get("content", []) if msg else entry.get("content", [])
    content_parts, tools, thinking_blocks = _extract_content_parts(raw_content, raw)
    content = "\n".join(content_parts).strip()

    if role == "user" and content:
        if "```crewhub-context" in content:
            content = _strip_context_envelope(content)
        elif _skip_user_message(content):
            return None

    if not content and not tools:
        return None

    usage = entry.get("usage") or msg.get("usage") or {}
    tokens = usage.get("totalTokens", 0) if isinstance(usage, dict) else 0
    payload = {
        "id": f"msg-{idx}",
        "role": role,
        "content": content,
        "timestamp": timestamp,
        "tokens": tokens,
        "tools": tools if tools else [],
    }
    if raw and thinking_blocks:
        payload["thinking"] = thinking_blocks
    return payload


def _group_cc_history(history_msgs: list, raw: bool) -> list[dict]:
    """Group consecutive CC HistoryMessages into structured content blocks.

    CC history arrives as one HistoryMessage per event (text, tool_use,
    thinking, tool_result). This groups consecutive assistant events into a
    single message with a structured content list so that
    ``_extract_content_parts()`` can split them into tools/thinking/text.
    """
    results: list[dict] = []
    # Accumulate content blocks for the current assistant turn
    pending_blocks: list[dict] = []
    pending_ts: int = 0
    msg_counter = 0
    # Map tool_use_id -> tool_name for resolving tool_result names
    tool_id_to_name: dict[str, str] = {}

    def flush():
        nonlocal pending_blocks, pending_ts, msg_counter
        if not pending_blocks:
            return
        entry = {
            "message": {"role": "assistant", "content": pending_blocks},
            "timestamp": pending_ts,
        }
        parsed = _build_history_message(msg_counter, entry, raw)
        if parsed is not None:
            results.append(parsed)
        msg_counter += 1
        pending_blocks = []
        pending_ts = 0

    for hm in history_msgs:
        meta = hm.metadata or {}
        meta_type = meta.get("type", "")

        if hm.role == "user":
            flush()
            entry = {
                "message": {"role": "user", "content": hm.content},
                "timestamp": hm.timestamp,
            }
            parsed = _build_history_message(msg_counter, entry, raw)
            if parsed is not None:
                results.append(parsed)
            msg_counter += 1

        elif hm.role == "assistant":
            if not pending_ts and hm.timestamp:
                pending_ts = hm.timestamp

            if meta_type == "tool_use":
                tool_id_to_name[meta.get("tool_use_id", "")] = meta.get("tool_name", "unknown")
                block: dict = {"type": "tool_use", "name": meta.get("tool_name", "unknown")}
                if meta.get("input_data"):
                    block["input"] = meta["input_data"]
                pending_blocks.append(block)
            elif meta_type == "thinking":
                pending_blocks.append({"type": "thinking", "thinking": meta.get("thinking", "")})
            else:
                # Regular text
                if hm.content:
                    pending_blocks.append({"type": "text", "text": hm.content})

        elif hm.role == "tool":
            # Tool result — attach to the current assistant turn
            tool_use_id = meta.get("tool_use_id", "")
            tool_name = tool_id_to_name.get(tool_use_id, "tool")
            pending_blocks.append(
                {
                    "type": "tool_result",
                    "toolName": tool_name,
                    "content": hm.content,
                    "isError": meta.get("is_error", False),
                }
            )

    flush()
    return results


# ── Routes ──────────────────────────────────────────────────────


@router.get("/api/chat/{session_key}/history", responses={403: {"description": "Forbidden"}})
async def get_chat_history(
    session_key: str,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    before: Annotated[Optional[int], Query()] = None,
    raw: Annotated[bool, Query()] = False,
):
    """Get chat history for a session with pagination."""
    _validate_session_key(session_key)
    agent_id = _get_agent_id(session_key)
    source = await _get_agent_source(agent_id, session_key)

    if source == "claude_code":
        # CC agent: resolve the actual Claude session ID and pull history
        from app.services.cc_chat import _agent_sessions
        from app.services.connections.claude_code import ClaudeCodeConnection

        cc_session_id = _agent_sessions.get(agent_id)
        if not cc_session_id:
            return {"messages": [], "hasMore": False, "oldestTimestamp": None}

        # Use claude:{session_id} key that the watcher tracks
        claude_key = f"claude:{cc_session_id}"
        manager = await get_connection_manager()
        cc_conn = next(
            (c for c in manager._connections.values() if isinstance(c, ClaudeCodeConnection) and c.is_connected()),
            None,
        )
        if not cc_conn:
            return {"messages": [], "hasMore": False, "oldestTimestamp": None}

        history_msgs = await cc_conn.get_session_history(claude_key, limit=max(limit * 3, 90))
        messages = _group_cc_history(history_msgs, raw)
    else:
        # OpenClaw agent
        manager = await get_connection_manager()
        conn = manager.get_default_openclaw()
        if not conn:
            return {"messages": [], "hasMore": False, "oldestTimestamp": None}

        fetch_limit = max(limit * 3, 90)
        raw_entries = await conn.get_session_history_raw(session_key, limit=fetch_limit)
        messages = [
            parsed
            for idx, entry in enumerate(raw_entries)
            if (parsed := _build_history_message(idx, entry, raw)) is not None
        ]

    if before is not None:
        messages = [m for m in messages if m["timestamp"] < before]

    has_more = len(messages) > limit
    messages = messages[-limit:]
    return {
        "messages": messages,
        "hasMore": has_more,
        "oldestTimestamp": messages[0]["timestamp"] if messages else None,
    }


@router.post(
    "/api/chat/{session_key}/send",
    responses={
        400: {"description": "Bad request"},
        403: {"description": "Forbidden"},
        429: {"description": "Too many requests"},
    },
)
async def send_chat_message(session_key: str, body: SendMessageBody):
    """Send a message to an agent and get a response (non-streaming)."""
    _validate_session_key(session_key)
    _check_rate_limit_send(session_key)

    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(message) > 5000:
        message = message[:5000]
    # Remove null bytes
    message = message.replace("\x00", "")

    agent_id = _get_agent_id(session_key)
    source = await _get_agent_source(agent_id, session_key)

    if source == "claude_code":
        if session_key.startswith("claude:"):
            # Discovered session — resolve project_path from watcher
            session_id = session_key[7:]
            project_path = await _get_discovered_project_path(session_id)
            if not project_path:
                return {
                    "response": None,
                    "tokens": 0,
                    "success": False,
                    "error": "Cannot resolve project path for discovered session",
                }
            try:
                from app.services.cc_chat import send_cc_discovered_blocking

                response_text = await send_cc_discovered_blocking(session_id, project_path, message)
            except Exception as e:
                logger.error(f"CC discovered send error: {e}")
                return {"response": None, "tokens": 0, "success": False, "error": str(e)}
        else:
            # Fixed CC agent: prepend context then use cc_chat module
            message = await _prepend_context_if_available(session_key, agent_id, body, message)
            try:
                from app.services.cc_chat import send_cc_blocking

                response_text = await send_cc_blocking(agent_id, message)
            except Exception as e:
                logger.error(f"CC send_chat error: {e}")
                return {"response": None, "tokens": 0, "success": False, "error": str(e)}
    else:
        # OpenClaw agent
        # Build context envelope for agent awareness
        try:
            from app.services.context_envelope import build_crewhub_context, format_context_block

            ctx_room_id = await _resolve_room_id(session_key, agent_id, body.room_id)

            if ctx_room_id:
                envelope = await build_crewhub_context(
                    room_id=ctx_room_id, channel="crewhub-ui", session_key=session_key
                )
                if envelope:
                    message = format_context_block(envelope) + CREWHUB_MSG_SEP + message
        except Exception as e:
            logger.warning(f"Failed to build context envelope for chat: {e}")

        manager = await get_connection_manager()
        conn = manager.get_default_openclaw()
        if not conn:
            return {"response": None, "tokens": 0, "success": False, "error": "No OpenClaw connection"}

        try:
            response_text = await conn.send_chat(
                message=message,
                agent_id=agent_id,
                timeout=120.0,
            )
        except Exception as e:
            logger.error(f"send_chat error: {e}")
            return {"response": None, "tokens": 0, "success": False, "error": str(e)}

    if response_text:
        try:
            from app.routes.sse import broadcast

            await broadcast("session-updated", {"key": session_key})
        except Exception as e:
            logger.warning(f"Failed to broadcast session-updated: {e}")
        return {"response": response_text, "tokens": 0, "success": True}
    else:
        return {"response": None, "tokens": 0, "success": False, "error": "No response from agent"}


async def _resolve_room_id(session_key: str, agent_id: str, explicit_room_id: str | None) -> str | None:
    """Resolve the room for context injection.

    Priority: explicit room_id > session_room_assignments (dynamic) > default_room_id (static).
    """
    if explicit_room_id:
        return explicit_room_id
    try:
        from app.db.database import get_db

        async with get_db() as db:
            # Check dynamic assignment first
            cursor = await db.execute(
                "SELECT room_id FROM session_room_assignments WHERE session_key = ?",
                (session_key,),
            )
            row = await cursor.fetchone()
            if row:
                return row["room_id"]

            # Fall back to agent's default_room_id
            cursor = await db.execute("SELECT default_room_id FROM agents WHERE id = ?", (agent_id,))
            row = await cursor.fetchone()
            if row:
                return row["default_room_id"]
    except Exception:
        pass
    return None


async def _prepend_context_if_available(session_key: str, agent_id: str, body: SendMessageBody, message: str) -> str:
    """Prepend CrewHub context envelope to message if a room can be resolved."""
    try:
        from app.services.context_envelope import build_crewhub_context, format_context_block

        ctx_room_id = await _resolve_room_id(session_key, agent_id, body.room_id)

        if ctx_room_id:
            envelope = await build_crewhub_context(room_id=ctx_room_id, channel="crewhub-ui", session_key=session_key)
            if envelope:
                return format_context_block(envelope) + CREWHUB_MSG_SEP + message
    except Exception as e:
        logger.warning(f"Failed to build context envelope for stream: {e}")
    return message


@router.post(
    "/api/chat/{session_key}/stream",
    responses={
        400: {"description": "Bad request"},
        403: {"description": "Forbidden"},
        429: {"description": "Too many requests"},
        503: {"description": "Service unavailable"},
    },
)
async def stream_chat_message(session_key: str, body: SendMessageBody):
    """Send a message to an agent and stream back the response via SSE."""
    import json

    from fastapi.responses import StreamingResponse

    _validate_session_key(session_key)
    _check_rate_limit_stream(session_key)

    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(message) > 5000:
        message = message[:5000]
    message = message.replace("\x00", "")

    agent_id = _get_agent_id(session_key)
    source = await _get_agent_source(agent_id, session_key)

    if source == "claude_code":
        if session_key.startswith("claude:"):
            # Discovered session — stream via cc_chat discovered helper
            disc_session_id = session_key[7:]
            disc_project_path = await _get_discovered_project_path(disc_session_id)
            if not disc_project_path:
                raise HTTPException(status_code=400, detail="Cannot resolve project path for discovered session")

            from app.services.cc_chat import stream_cc_discovered_response

            async def generate_cc_discovered():
                yield "event: start\ndata: {}\n\n"
                try:
                    async for chunk in stream_cc_discovered_response(disc_session_id, disc_project_path, message):
                        yield f"event: delta\ndata: {json.dumps({'text': chunk})}\n\n"
                    yield "event: done\ndata: {}\n\n"
                    try:
                        from app.routes.sse import broadcast

                        await broadcast("session-updated", {"key": session_key})
                    except Exception as e:
                        logger.warning(f"Failed to broadcast session-updated after CC discovered stream: {e}")
                except Exception as e:
                    logger.error(f"CC discovered streaming error: {e}")
                    yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

            return StreamingResponse(
                generate_cc_discovered(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "X-Accel-Buffering": "no",
                    "Connection": "keep-alive",
                },
            )

        # Fixed CC agent: prepend context then stream via cc_chat module
        message = await _prepend_context_if_available(session_key, agent_id, body, message)
        from app.services.cc_chat import stream_cc_response

        async def generate_cc():
            yield "event: start\ndata: {}\n\n"
            try:
                async for chunk in stream_cc_response(agent_id, message):
                    yield f"event: delta\ndata: {json.dumps({'text': chunk})}\n\n"
                yield "event: done\ndata: {}\n\n"
                try:
                    from app.routes.sse import broadcast

                    await broadcast("session-updated", {"key": session_key})
                except Exception as e:
                    logger.warning(f"Failed to broadcast session-updated after CC stream: {e}")
            except Exception as e:
                logger.error(f"CC streaming error: {e}")
                yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(
            generate_cc(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            },
        )

    # OpenClaw agent
    message = await _prepend_context_if_available(session_key, agent_id, body, message)

    manager = await get_connection_manager()
    conn = manager.get_default_openclaw()
    if not conn:
        raise HTTPException(status_code=503, detail="No OpenClaw connection available")

    async def generate():
        yield "event: start\ndata: {}\n\n"
        try:
            async for chunk in conn.send_chat_streaming(message, agent_id=agent_id):
                yield f"event: delta\ndata: {json.dumps({'text': chunk})}\n\n"
            yield "event: done\ndata: {}\n\n"
            try:
                from app.routes.sse import broadcast

                await broadcast("session-updated", {"key": session_key})
            except Exception as e:
                logger.warning(f"Failed to broadcast session-updated after stream: {e}")
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/api/chat/{session_key}/info")
async def get_chat_info(session_key: str):
    """Check if a session supports chat and return metadata."""
    agent_id = _get_agent_id(session_key)
    can_chat = bool(FIXED_AGENT_PATTERN.match(session_key))

    # For CC agents, look up name from DB instead of hardcoded map
    source = await _get_agent_source(agent_id, session_key)
    if session_key.startswith("claude:"):
        agent_name = f"Claude Session {agent_id[:8]}"
    elif source == "claude_code":
        try:
            from app.db.database import get_db

            async with get_db() as db:
                async with db.execute("SELECT name FROM agents WHERE id = ?", (agent_id,)) as cursor:
                    row = await cursor.fetchone()
                    agent_name = row["name"] if row else agent_id.capitalize()
        except Exception:
            agent_name = agent_id.capitalize()
    else:
        agent_name = AGENT_DISPLAY_NAMES.get(agent_id, agent_id.capitalize())

    return {
        "canChat": can_chat,
        "agentId": agent_id,
        "agentName": agent_name,
        "sessionKey": session_key,
        "source": source,
    }
