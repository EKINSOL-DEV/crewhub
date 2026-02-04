"""
Chat routes for CrewHub agent chat.
Handles message history retrieval, sending messages, and session info.
Phase 1: non-streaming (send message, get full response).
"""

import re
import time
import logging
from typing import Optional

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

_last_send: dict[str, float] = {}
COOLDOWN_SECONDS = 3.0


def _check_rate_limit(session_key: str) -> None:
    """Enforce max 1 send per COOLDOWN_SECONDS per session."""
    now = time.time()
    last = _last_send.get(session_key, 0)
    if now - last < COOLDOWN_SECONDS:
        remaining = COOLDOWN_SECONDS - (now - last)
        raise HTTPException(
            status_code=429,
            detail=f"Rate limited. Try again in {remaining:.1f}s",
        )
    _last_send[session_key] = now


# ── Models ──────────────────────────────────────────────────────


class SendMessageBody(BaseModel):
    message: str


# ── Routes ──────────────────────────────────────────────────────


@router.get("/api/chat/{session_key}/history")
async def get_chat_history(
    session_key: str,
    limit: int = Query(default=30, ge=1, le=100),
    before: Optional[int] = Query(default=None),
):
    """Get chat history for a session with pagination."""
    _validate_session_key(session_key)

    manager = await get_connection_manager()
    conn = manager.get_default_openclaw()
    if not conn:
        return {"messages": [], "hasMore": False, "oldestTimestamp": None}
    
    raw_entries = await conn.get_session_history_raw(session_key, limit=0)

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
                    elif btype == "tool_use":
                        tools.append({
                            "name": block.get("name", "unknown"),
                            "status": "called",
                        })
                    elif btype == "tool_result":
                        tool_name = block.get("toolName") or block.get("name") or "tool"
                        is_error = block.get("isError", False)
                        tools.append({
                            "name": tool_name,
                            "status": "error" if is_error else "done",
                        })

        content = "\n".join(content_parts).strip()
        if not content and not tools:
            continue

        # Token usage (can be on entry level or message level)
        usage = entry.get("usage") or msg.get("usage") or {}
        tokens = usage.get("totalTokens", 0) if isinstance(usage, dict) else 0

        messages.append({
            "id": f"msg-{idx}",
            "role": role,
            "content": content,
            "timestamp": timestamp,
            "tokens": tokens,
            "tools": tools if tools else [],
        })

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


@router.post("/api/chat/{session_key}/send")
async def send_chat_message(session_key: str, body: SendMessageBody):
    """Send a message to an agent and get a response (non-streaming)."""
    _validate_session_key(session_key)
    _check_rate_limit(session_key)

    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(message) > 5000:
        message = message[:5000]
    # Remove null bytes
    message = message.replace("\x00", "")

    agent_id = _get_agent_id(session_key)

    manager = await get_connection_manager()
    conn = manager.get_default_openclaw()
    if not conn:
        return {"response": None, "tokens": 0, "success": False, "error": "No OpenClaw connection"}
    
    try:
        response_text = await conn.send_chat(
            message=message,
            agent_id=agent_id,
            timeout=90.0,
        )
    except Exception as e:
        logger.error(f"send_chat error: {e}")
        return {"response": None, "tokens": 0, "success": False, "error": str(e)}

    if response_text:
        return {"response": response_text, "tokens": 0, "success": True}
    else:
        return {"response": None, "tokens": 0, "success": False, "error": "No response from agent"}


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
