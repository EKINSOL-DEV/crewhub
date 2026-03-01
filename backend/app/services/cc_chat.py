"""
CC Chat — streaming bridge between CrewHub chat and Claude Code CLI.

Spawns/resumes Claude Code processes for CC-type fixed agents and
yields text deltas that the chat route wraps in SSE events.
"""

import asyncio
import json
import logging
import time
from collections.abc import AsyncGenerator
from typing import Optional

from app.db.database import get_db

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────
STREAM_TOTAL_TIMEOUT = 600  # 10 minutes max for a streaming loop

# ── Session tracking ───────────────────────────────────────────────
# Maps agent_id → last known session_id so subsequent chats use --resume.
_agent_sessions: dict[str, str] = {}


# ── Agent config helper ────────────────────────────────────────────


async def get_agent_config(agent_id: str) -> dict:
    """Load project_path, permission_mode, default_model from DB."""
    async with get_db() as db:
        async with db.execute(
            "SELECT project_path, permission_mode, default_model FROM agents WHERE id = ?",
            (agent_id,),
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                return {}
            keys = row.keys()
            return {
                "project_path": row["project_path"] if "project_path" in keys else None,
                "permission_mode": row["permission_mode"] if "permission_mode" in keys else "default",
                "default_model": row["default_model"],
            }


# ── Process manager singleton ──────────────────────────────────────


def _get_process_manager():
    """Get the ClaudeProcessManager from the connection manager."""
    from app.services.connections.claude_process_manager import ClaudeProcessManager

    # Use a module-level singleton
    if not hasattr(_get_process_manager, "_instance"):
        _get_process_manager._instance = ClaudeProcessManager()
    return _get_process_manager._instance


# ── Shared helpers ─────────────────────────────────────────────────


def _make_output_parser(queue: asyncio.Queue, agent_id: str | None = None):
    """Create an on_output callback that parses JSONL and pushes text deltas."""

    def on_output(process_id: str, line: str) -> None:
        try:
            data = json.loads(line)
        except (json.JSONDecodeError, ValueError):
            return

        if not isinstance(data, dict):
            return

        event_type = data.get("type", "")

        # Extract text from assistant message blocks
        if event_type == "assistant":
            content = data.get("message", {}).get("content", [])
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        text = block.get("text", "")
                        if text:
                            queue.put_nowait(text)
            elif isinstance(content, str) and content:
                queue.put_nowait(content)

        # Extract text from streaming content block deltas
        elif event_type == "content_block_delta":
            delta = data.get("delta", {})
            if isinstance(delta, dict) and delta.get("type") == "text_delta":
                text = delta.get("text", "")
                if text:
                    queue.put_nowait(text)

        # Surface error events from Claude Code
        elif event_type == "error":
            error_msg = data.get("error", {})
            if isinstance(error_msg, dict):
                text = error_msg.get("message", str(error_msg))
            else:
                text = str(error_msg)
            queue.put_nowait(f"[Error: {text}]")

        # Capture session_id from result event for future --resume
        elif event_type == "result":
            if data.get("is_error"):
                error_text = data.get("error", "unknown error")
                queue.put_nowait(f"[Error: {error_text}]")
            sid = data.get("session_id")
            if sid and agent_id:
                _agent_sessions[agent_id] = sid

    return on_output


async def _stream_process(pm, process_id: str, queue: asyncio.Queue) -> AsyncGenerator[str, None]:
    """Async generator with timeout, cleanup, and queue draining."""
    start_time = time.monotonic()

    try:
        while True:
            # Check total timeout
            elapsed = time.monotonic() - start_time
            if elapsed >= STREAM_TOTAL_TIMEOUT:
                yield "[Error: streaming timeout exceeded]"
                break

            cp = pm.get_process(process_id)
            if cp is None:
                break

            # Try to get a chunk with a timeout
            try:
                chunk = await asyncio.wait_for(queue.get(), timeout=1.0)
                if chunk is not None:
                    yield chunk
            except TimeoutError:
                pass

            # Check if process is done and queue is empty
            if cp.status in ("completed", "error", "killed") and queue.empty():
                # Drain any remaining items
                while not queue.empty():
                    chunk = queue.get_nowait()
                    if chunk is not None:
                        yield chunk
                break

    finally:
        pm.remove_process_callback(process_id)
        # Kill orphan process on disconnect
        cp = pm.get_process(process_id)
        if cp and cp.status == "running":
            await pm.kill(process_id)


# ── Streaming response ─────────────────────────────────────────────


async def stream_cc_response(agent_id: str, message: str) -> AsyncGenerator[str, None]:
    """Async generator that spawns/resumes a Claude Code process and yields text deltas.

    The caller (chat route) wraps each yielded string in an SSE `delta` event.
    """
    config = await get_agent_config(agent_id)
    project_path = config.get("project_path")
    permission_mode = config.get("permission_mode", "default")
    model = config.get("default_model")

    if not project_path:
        yield "[Error: No project_path configured for this agent]"
        return

    session_id = _agent_sessions.get(agent_id)
    pm = _get_process_manager()

    queue: asyncio.Queue[Optional[str]] = asyncio.Queue()
    on_output = _make_output_parser(queue, agent_id=agent_id)

    process_id = await pm.spawn_task(
        message=message,
        session_id=session_id,
        project_path=project_path,
        model=model,
        permission_mode=permission_mode,
    )
    pm.set_process_callback(process_id, on_output)

    async for chunk in _stream_process(pm, process_id, queue):
        yield chunk

    # Capture session_id from the process result if not already captured
    cp = pm.get_process(process_id)
    if cp and cp.result_session_id:
        _agent_sessions[agent_id] = cp.result_session_id


# ── Blocking (non-streaming) send ──────────────────────────────────


async def send_cc_blocking(agent_id: str, message: str) -> str:
    """Send a message to a CC agent and collect the full response."""
    chunks: list[str] = []
    async for chunk in stream_cc_response(agent_id, message):
        chunks.append(chunk)
    return "".join(chunks)


# ── Discovered session helpers ────────────────────────────────────


async def stream_cc_discovered_response(session_id: str, project_path: str, message: str) -> AsyncGenerator[str, None]:
    """Stream response for a discovered (non-agent) CC session."""
    pm = _get_process_manager()
    queue: asyncio.Queue[Optional[str]] = asyncio.Queue()
    on_output = _make_output_parser(queue)

    process_id = await pm.spawn_task(
        message=message,
        session_id=session_id,
        project_path=project_path,
    )
    pm.set_process_callback(process_id, on_output)

    async for chunk in _stream_process(pm, process_id, queue):
        yield chunk


async def send_cc_discovered_blocking(session_id: str, project_path: str, message: str) -> str:
    """Send a message to a discovered CC session and collect the full response."""
    chunks: list[str] = []
    async for chunk in stream_cc_discovered_response(session_id, project_path, message):
        chunks.append(chunk)
    return "".join(chunks)
