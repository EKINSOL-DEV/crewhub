"""
Extended API mixin for OpenClawConnection.

Provides higher-level helpers built on top of ``conn.call()``:
- send_message / send_chat / send_chat_streaming
- patch_session
- Cron job management (list / create / update / delete / enable / disable / run)
- System queries (presence, nodes)
- get_sessions_raw (legacy raw format)

All methods assume ``self`` is an ``OpenClawConnection`` instance.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import AsyncGenerator
from typing import Any, Optional

logger = logging.getLogger(__name__)


class OpenClawExtendedMixin:
    """Mixin that adds higher-level API helpers to OpenClawConnection."""

    # ------------------------------------------------------------------
    # Messaging
    # ------------------------------------------------------------------

    async def send_message(
        self,
        session_key: str,
        message: str,
        timeout: float = 90.0,  # NOSONAR
    ) -> Optional[str]:
        """Send a chat message to a session and return the response text."""
        agent_id = "main"
        session_id = None
        if ":" in session_key:
            parts = session_key.split(":")
            if len(parts) > 1:
                agent_id = parts[1]

        sessions = await self.get_sessions()  # type: ignore[attr-defined]
        session = next((s for s in sessions if s.key == session_key), None)
        if session:
            session_id = session.session_id

        params: dict[str, Any] = {
            "message": message,
            "agentId": agent_id,
            "deliver": False,
            "idempotencyKey": str(uuid.uuid4()),
        }
        if session_id:
            params["sessionId"] = session_id

        result = await self.call(  # type: ignore[attr-defined]
            "agent",
            params,
            timeout=timeout,
            wait_for_final_agent_result=True,
        )
        return _extract_text(result)

    async def send_chat(
        self,
        message: str,
        agent_id: str = "main",
        session_id: Optional[str] = None,
        timeout: float = 120.0,  # NOSONAR
        model: Optional[str] = None,
    ) -> Optional[str]:
        """Send a chat message to an agent and return the assistant text."""
        params: dict[str, Any] = {
            "message": message,
            "agentId": agent_id,
            "deliver": False,
            "idempotencyKey": str(uuid.uuid4()),
        }
        if session_id:
            params["sessionId"] = session_id
        if model:
            params["model"] = model

        result = await self.call(  # type: ignore[attr-defined]
            "agent",
            params,
            timeout=timeout,
            wait_for_final_agent_result=True,
        )
        return _extract_text(result)

    async def send_chat_streaming(  # NOSONAR
        self,
        message: str,
        agent_id: str = "main",
        session_id: Optional[str] = None,
        timeout: float = 120.0,  # NOSONAR
    ) -> AsyncGenerator[str, None]:
        """Send a chat message and yield text chunks as they arrive via WS events."""
        idempotency_key = str(uuid.uuid4())
        chunk_queue: asyncio.Queue = asyncio.Queue()
        stream_id = str(uuid.uuid4())
        expected_session_key = f"agent:{agent_id}:main"
        state = {"sent_length": 0, "active_run_id": None}

        def on_chat_event(payload: dict):
            if payload.get("sessionKey") != expected_session_key:
                return
            run_id = payload.get("runId")
            event_state = payload.get("state")
            if state["active_run_id"] is None and event_state == "delta":
                state["active_run_id"] = run_id
            if run_id and state["active_run_id"] and run_id != state["active_run_id"]:
                return
            if event_state == "delta":
                content = payload.get("message", {}).get("content", [])
                text = content[0].get("text", "") if content and isinstance(content[0], dict) else ""
                new_chunk = text[state["sent_length"] :]
                state["sent_length"] = len(text)
                if new_chunk:
                    chunk_queue.put_nowait(("delta", new_chunk))
                return
            if event_state in ("final", "error", "aborted"):
                chunk_queue.put_nowait(("done", event_state))

        self.subscribe("chat", on_chat_event)  # type: ignore[attr-defined]
        self._stream_queues[stream_id] = chunk_queue  # type: ignore[attr-defined]
        agent_task = asyncio.create_task(
            self.call(  # type: ignore[attr-defined]
                "agent",
                {
                    "message": message,
                    "agentId": agent_id,
                    "deliver": False,
                    "idempotencyKey": idempotency_key,
                    **({"sessionId": session_id} if session_id else {}),
                },
                timeout=timeout,
                wait_for_final_agent_result=True,
            )
        )
        try:
            start = asyncio.get_event_loop().time()
            while True:
                remaining = timeout - (asyncio.get_event_loop().time() - start)
                if remaining <= 0:
                    break
                try:
                    kind, data = await asyncio.wait_for(chunk_queue.get(), timeout=min(30.0, remaining))
                except TimeoutError:
                    logger.warning(f"No chunk received in 30s for agent {agent_id}")
                    break
                if kind == "delta":
                    yield data
                    continue
                if kind == "error":
                    logger.warning(f"Stream interrupted: {data}")
                break
        finally:
            if not agent_task.done():
                agent_task.cancel()
                try:
                    await agent_task
                except (asyncio.CancelledError, Exception):
                    pass
            self.unsubscribe("chat", on_chat_event)  # type: ignore[attr-defined]
            self._stream_queues.pop(stream_id, None)  # type: ignore[attr-defined]

    async def patch_session(self, session_id: str, model: Optional[str] = None) -> bool:
        """Update session configuration (e.g., switch model)."""
        params: dict[str, Any] = {"sessionId": session_id}
        if model:
            params["model"] = model
        result = await self.call("session.status", params)  # type: ignore[attr-defined]
        return result is not None

    # ------------------------------------------------------------------
    # Legacy raw sessions
    # ------------------------------------------------------------------

    async def get_sessions_raw(self) -> list[dict[str, Any]]:
        """Return raw session dicts from Gateway (legacy format)."""
        result = await self.call("sessions.list")  # type: ignore[attr-defined]
        if result and isinstance(result, dict):
            return result.get("sessions", [])
        return []

    # ------------------------------------------------------------------
    # Cron management
    # ------------------------------------------------------------------

    async def list_cron_jobs(self, all_jobs: bool = True) -> list[dict[str, Any]]:
        """Get list of cron jobs."""
        params = {"includeDisabled": all_jobs} if all_jobs else {}
        result = await self.call("cron.list", params)  # type: ignore[attr-defined]
        if result and isinstance(result, dict):
            return result.get("jobs", [])
        return []

    async def create_cron_job(
        self,
        schedule: dict,
        payload: dict,
        session_target: str = "main",
        name: Optional[str] = None,
        enabled: bool = True,
    ) -> Optional[dict[str, Any]]:
        """Create a new cron job."""
        params: dict[str, Any] = {
            "schedule": schedule,
            "payload": payload,
            "sessionTarget": session_target,
            "enabled": enabled,
        }
        if name:
            params["name"] = name
        return await self.call("cron.add", params)  # type: ignore[attr-defined]

    async def update_cron_job(self, job_id: str, patch: dict[str, Any]) -> Optional[dict[str, Any]]:
        """Update an existing cron job."""
        return await self.call("cron.update", {"jobId": job_id, "patch": patch})  # type: ignore[attr-defined]

    async def delete_cron_job(self, job_id: str) -> bool:
        result = await self.call("cron.remove", {"jobId": job_id})  # type: ignore[attr-defined]
        return result is not None

    async def enable_cron_job(self, job_id: str) -> bool:
        return await self.update_cron_job(job_id, {"enabled": True}) is not None

    async def disable_cron_job(self, job_id: str) -> bool:
        return await self.update_cron_job(job_id, {"enabled": False}) is not None

    async def run_cron_job(self, job_id: str, force: bool = False) -> bool:
        """Trigger a cron job to run immediately."""
        params: dict[str, Any] = {"jobId": job_id}
        if force:
            params["force"] = True
        result = await self.call("cron.run", params)  # type: ignore[attr-defined]
        return result is not None

    # ------------------------------------------------------------------
    # System queries
    # ------------------------------------------------------------------

    async def get_presence(self) -> dict[str, Any]:
        """Get connected devices/clients."""
        return await self.call("system-presence") or {}  # type: ignore[attr-defined]

    async def list_nodes(self) -> list[dict[str, Any]]:
        """Get list of paired nodes."""
        for method in ["nodes-status", "nodes.list", "nodes"]:
            result = await self.call(method)  # type: ignore[attr-defined]
            if result and isinstance(result, dict):
                nodes = result.get("nodes", [])
                if nodes or "nodes" in result:
                    return nodes
        return []


# ------------------------------------------------------------------
# Shared helper (used by send_message + send_chat)
# ------------------------------------------------------------------


def _extract_text(
    result: Any,
) -> Optional[str]:
    """Extract the assistant reply text from a Gateway agent response."""
    if not isinstance(result, dict):
        return None

    text = _extract_payload_text(result)
    if text is not None:
        return text

    for key in ("text", "response", "content", "reply"):
        val = result.get(key)
        if isinstance(val, str) and val:
            return val
    return None


def _extract_payload_text(result: dict[str, Any]) -> Optional[str]:
    agent_result = result.get("result")
    if not isinstance(agent_result, dict):
        return None
    payloads = agent_result.get("payloads")
    if not isinstance(payloads, list) or not payloads:
        return None
    first = payloads[0]
    if not isinstance(first, dict):
        return None
    text = first.get("text")
    return text if isinstance(text, str) else None
