"""
Chat routes for CrewHub agent chat.
Handles message history retrieval, sending messages, and session info.
Phase 1: non-streaming (send message, get full response).
"""

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

FIXED_AGENT_PATTERN = re.compile(r"^agent:[a-zA-Z0-9_-]+:main$")

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
    """Only allow fixed agent session keys (agent:*:main)."""
    if not FIXED_AGENT_PATTERN.match(session_key):
        raise HTTPException(
            status_code=403,
            detail="Chat is only available for fixed agent sessions (agent:*:main)",
        )


def _get_agent_id(session_key: str) -> str:
    """Extract agent id from session key like 'agent:main:main' -> 'main'."""
    parts = session_key.split(":")
    return parts[1] if len(parts) > 1 else "main"


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


# ── Routes ──────────────────────────────────────────────────────


@router.get("/api/chat/{session_key}/history")
async def get_chat_history(  # NOSONAR: complexity from multi-source history assembly (connection layer + filesystem fallback) with message transformation, safe to keep
    session_key: str,
    limit: Annotated[int, Query(default=30, ge=1, le=100)],
    before: Annotated[Optional[int], Query(default=None)],
    raw: Annotated[bool, Query(default=False)],
):
    """Get chat history for a session with pagination.

    Args:
        raw: If True, include thinking blocks and detailed tool calls in response.
    """
    _validate_session_key(session_key)

    manager = await get_connection_manager()
    conn = manager.get_default_openclaw()
    if not conn:
        return {"messages": [], "hasMore": False, "oldestTimestamp": None}

    # Fetch limit*3 entries to have enough after filtering, but avoid loading entire history
    fetch_limit = max(limit * 3, 90)
    raw_entries = await conn.get_session_history_raw(session_key, limit=fetch_limit)

    # Parse into chat messages
    # JSONL entries have structure: { type: "message", message: { role, content }, timestamp }
    messages = []
    for idx, entry in enumerate(raw_entries):
        # Messages are nested: entry.message.role / entry.message.content
        msg = entry.get("message", {}) if isinstance(entry.get("message"), dict) else {}
        role = msg.get("role") or entry.get("role")
        if role not in ("user", "assistant", "system"):
            continue

        timestamp = entry.get("timestamp") or msg.get("timestamp") or 0
        # Normalise to millis
        if isinstance(timestamp, str):
            # ISO format like "2026-01-31T16:20:59.818Z"
            from datetime import datetime

            try:
                dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                timestamp = int(dt.timestamp() * 1000)
            except (ValueError, TypeError):
                timestamp = 0
        elif isinstance(timestamp, (int, float)):
            if timestamp < 1e12:
                timestamp = int(timestamp * 1000)
            else:
                timestamp = int(timestamp)

        # Extract text content from the nested message
        content_parts: list[str] = []
        tools: list[dict] = []
        thinking_blocks: list[str] = []
        raw_content = msg.get("content", []) if msg else entry.get("content", [])
        if isinstance(raw_content, str):
            content_parts.append(raw_content)
        elif isinstance(raw_content, list):
            for block in raw_content:
                if isinstance(block, str):
                    content_parts.append(block)
                elif isinstance(block, dict):
                    btype = block.get("type", "")
                    if btype == "text" and block.get("text"):
                        content_parts.append(block["text"])
                    elif btype == "thinking" and block.get("thinking"):
                        # Capture thinking blocks when raw mode enabled
                        thinking_blocks.append(block["thinking"])
                    elif btype == "tool_use":
                        tool_info = {
                            "name": block.get("name", "unknown"),
                            "status": "called",
                        }
                        if raw:
                            # Include input parameters in raw mode
                            tool_info["input"] = block.get("input", {})
                        tools.append(tool_info)
                    elif btype == "tool_result":
                        tool_name = block.get("toolName") or block.get("name") or "tool"
                        is_error = block.get("isError", False)
                        tool_info = {
                            "name": tool_name,
                            "status": "error" if is_error else "done",
                        }
                        if raw:
                            # Include result content in raw mode (truncated)
                            result_content = block.get("content", "")
                            if isinstance(result_content, str) and len(result_content) > 500:
                                result_content = result_content[:500] + "..."
                            tool_info["result"] = result_content
                        tools.append(tool_info)

        content = "\n".join(content_parts).strip()
        if not content and not tools:
            continue

        # Filter/strip internal system messages from chat history
        if role == "user":
            if "```crewhub-context" in content:
                # This is a user message with a context envelope prefix.
                # Extract only the actual user message after the envelope.
                if CREWHUB_MSG_SEP in content:
                    # New format: deterministic separator present
                    content = content.split(CREWHUB_MSG_SEP, 1)[1].strip()
                else:
                    # Legacy format (no separator): split on \n\n blocks, take the last
                    # non-empty block that isn't part of the context/persona header
                    segments = [s.strip() for s in content.split("\n\n") if s.strip()]
                    # Skip segments that are clearly part of the context block header
                    CONTEXT_PREFIXES = (
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
                        s
                        for s in segments
                        if not any(s.startswith(p) for p in CONTEXT_PREFIXES)
                        and not s.startswith("```")
                        and "crewhub-context" not in s
                    ]
                    content = real_segments[-1] if real_segments else ""

                # If nothing useful remains after stripping, skip this message
                if not content:
                    continue
            else:
                # Other system markers without crewhub-context → full skip
                OTHER_MARKERS = [
                    "[System Message]",
                    "A completed subagent task is ready for user delivery",
                    "Conversation info (untrusted metadata)",
                    "[HEARTBEAT]",
                    "HEARTBEAT_OK",
                    "Read HEARTBEAT.md",
                ]
                if any(marker in content for marker in OTHER_MARKERS):
                    continue
                # Also skip messages that are primarily JSON metadata blocks
                stripped = content.strip()
                if stripped.startswith("```") and ("message_id" in content or "sender_id" in content):
                    continue

        # Token usage (can be on entry level or message level)
        usage = entry.get("usage") or msg.get("usage") or {}
        tokens = usage.get("totalTokens", 0) if isinstance(usage, dict) else 0

        message_data = {
            "id": f"msg-{idx}",
            "role": role,
            "content": content,
            "timestamp": timestamp,
            "tokens": tokens,
            "tools": tools if tools else [],
        }

        # Include thinking blocks in raw mode
        if raw and thinking_blocks:
            message_data["thinking"] = thinking_blocks

        messages.append(message_data)

    # Apply cursor-based pagination
    if before is not None:
        messages = [m for m in messages if m["timestamp"] < before]

    has_more = len(messages) > limit
    messages = messages[-limit:]  # take the most recent `limit`

    return {
        "messages": messages,
        "hasMore": has_more,
        "oldestTimestamp": messages[0]["timestamp"] if messages else None,
    }


@router.post("/api/chat/{session_key}/send", responses={400: {"description": "Bad request"}})
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

    # Build context envelope for agent awareness
    try:
        from app.db.database import get_db
        from app.services.context_envelope import build_crewhub_context, format_context_block

        # Determine room_id: prefer request body, fall back to agent default
        ctx_room_id = body.room_id
        if not ctx_room_id:
            async with get_db() as db:
                cursor = await db.execute("SELECT default_room_id FROM agents WHERE id = ?", (agent_id,))
                row = await cursor.fetchone()
                if row:
                    ctx_room_id = row["default_room_id"]

        if ctx_room_id:
            envelope = await build_crewhub_context(room_id=ctx_room_id, channel="crewhub-ui", session_key=session_key)
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
        # Broadcast session-updated so other open chat windows can refresh
        try:
            from app.routes.sse import broadcast

            await broadcast("session-updated", {"key": session_key})
        except Exception as e:
            logger.warning(f"Failed to broadcast session-updated: {e}")
        return {"response": response_text, "tokens": 0, "success": True}
    else:
        return {"response": None, "tokens": 0, "success": False, "error": "No response from agent"}


async def _prepend_context_if_available(session_key: str, agent_id: str, body: "SendMessageBody", message: str) -> str:
    """Prepend CrewHub context envelope to message if a room can be resolved."""
    try:
        from app.db.database import get_db
        from app.services.context_envelope import build_crewhub_context, format_context_block

        ctx_room_id = body.room_id
        if not ctx_room_id:
            async with get_db() as db:
                cursor = await db.execute("SELECT default_room_id FROM agents WHERE id = ?", (agent_id,))
                row = await cursor.fetchone()
                if row:
                    ctx_room_id = row["default_room_id"]

        if ctx_room_id:
            envelope = await build_crewhub_context(room_id=ctx_room_id, channel="crewhub-ui", session_key=session_key)
            if envelope:
                return format_context_block(envelope) + CREWHUB_MSG_SEP + message
    except Exception as e:
        logger.warning(f"Failed to build context envelope for stream: {e}")
    return message


@router.post("/api/chat/{session_key}/stream", responses={400: {"description": "Bad request"}, 503: {"description": "Service unavailable"}})
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
            # Broadcast session-updated so other open chat windows can refresh.
            # Direct await after yield is valid in an async generator.
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
    agent_name = AGENT_DISPLAY_NAMES.get(agent_id, agent_id.capitalize())

    return {
        "canChat": can_chat,
        "agentId": agent_id,
        "agentName": agent_name,
        "sessionKey": session_key,
    }
