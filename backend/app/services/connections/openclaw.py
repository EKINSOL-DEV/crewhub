"""
OpenClaw Gateway connection implementation.

Core class: OpenClawConnection — maintains a persistent WebSocket to the
OpenClaw Gateway with auto-reconnect and event routing.

Heavy helpers live in focused sibling modules:
  _handshake.py      — v2 device-identity auth / connect handshake
  _session_io.py     — session JSONL file reading and kill_session
  _extended_api.py   — send_chat, streaming, cron jobs, system queries
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from typing import Any, Optional

import websockets
from websockets.exceptions import ConnectionClosed
from websockets.protocol import State

from ._extended_api import OpenClawExtendedMixin
from ._session_io import OpenClawSessionIOMixin
from .base import (
    AgentConnection,
    ConnectionStatus,
    ConnectionType,
    SessionInfo,
)

logger = logging.getLogger(__name__)


class OpenClawConnection(
    OpenClawExtendedMixin,
    OpenClawSessionIOMixin,
    AgentConnection,
):
    """
    WebSocket connection to OpenClaw Gateway.

    Maintains a persistent connection with auto-reconnect.
    Provides access to sessions, history, and agent communication.

    Config options:
        url: Gateway WebSocket URL (default: ws://127.0.0.1:18789)
        token: Authentication token (optional)
        auto_reconnect: Enable auto-reconnect (default: True)
        reconnect_delay: Initial reconnect delay in seconds (default: 1.0)
        max_reconnect_delay: Maximum reconnect delay (default: 60.0)
    """

    def __init__(
        self,
        connection_id: str,
        name: str,
        config: Optional[dict[str, Any]] = None,
    ) -> None:
        config = config or {}
        super().__init__(
            connection_id=connection_id,
            name=name,
            connection_type=ConnectionType.OPENCLAW,
            config=config,
        )

        self.uri = config.get("url") or os.getenv("OPENCLAW_GATEWAY_URL", "ws://127.0.0.1:18789")
        self.token = config.get("token") or os.getenv("OPENCLAW_GATEWAY_TOKEN", "")

        self.auto_reconnect = config.get("auto_reconnect", True)
        self.reconnect_delay = config.get("reconnect_delay", 1.0)
        self.max_reconnect_delay = config.get("max_reconnect_delay", 60.0)
        self._current_reconnect_delay = self.reconnect_delay

        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self._connecting = False
        self._connect_lock = asyncio.Lock()

        self._response_queues: dict[str, asyncio.Queue] = {}
        self._event_handlers: dict[str, list] = {}
        self._stream_queues: dict[str, asyncio.Queue] = {}
        self._listen_task: Optional[asyncio.Task] = None
        self._reconnect_task: Optional[asyncio.Task] = None

        self._identity_manager = None
        self._device_identity = None

        logger.info(f"OpenClawConnection initialized: uri={self.uri}, token={'set' if self.token else 'none'}")

    # -- Helpers --

    def _ws_is_open(self) -> bool:
        if self.ws is None:
            return False
        try:
            return self.ws.state == State.OPEN
        except AttributeError:
            return not getattr(self.ws, "closed", True)

    def is_connected(self) -> bool:
        return self._status == ConnectionStatus.CONNECTED and self._ws_is_open()

    # -- Connection lifecycle --

    async def connect(self) -> bool:
        """Establish connection to Gateway."""
        if self.is_connected():
            return True

        if self._connecting:
            for _ in range(50):
                await asyncio.sleep(0.1)
                if self.is_connected():
                    return True
            return False

        async with self._connect_lock:
            if self.is_connected():
                return True
            self._connecting = True
            self.status = ConnectionStatus.CONNECTING
            try:
                success = await self._do_connect()
                if success:
                    self._current_reconnect_delay = self.reconnect_delay
                return success
            finally:
                self._connecting = False

    async def _do_connect(self) -> bool:
        """Delegate actual handshake to the focused _handshake module."""
        from ._handshake import perform_handshake

        return await perform_handshake(self)

    async def disconnect(self) -> None:
        """Close the connection gracefully."""
        if self._reconnect_task and not self._reconnect_task.done():
            self._reconnect_task.cancel()
            try:
                await self._reconnect_task
            except asyncio.CancelledError:  # NOSONAR
                pass

        if self._listen_task and not self._listen_task.done():
            self._listen_task.cancel()
            try:
                await self._listen_task
            except asyncio.CancelledError:  # NOSONAR
                pass

        if self.ws:
            try:
                await self.ws.close()
            except Exception as exc:
                logger.debug(f"Error closing WebSocket: {exc}")
            self.ws = None

        self.status = ConnectionStatus.DISCONNECTED
        logger.info(f"Gateway {self.name} disconnected")

    # ---
    # Background listener
    # ---
    async def _listen_loop(  # noqa: C901  # NOSONAR
        self,
    ) -> None:
        """Receive and route messages from the Gateway."""
        logger.debug(f"Listener loop started for {self.name}")
        try:
            while self._ws_is_open():
                try:
                    raw = await self.ws.recv()
                    msg = json.loads(raw)
                    msg_type = msg.get("type")

                    if msg_type == "res":
                        req_id = msg.get("id")
                        q = self._response_queues.get(req_id)
                        if q is not None:
                            try:
                                q.put_nowait(msg)
                            except asyncio.QueueFull:
                                logger.warning(f"Response queue full for {req_id}")

                    elif msg_type == "event":
                        event_name = msg.get("event", "")
                        payload = msg.get("payload", {})
                        if event_name.startswith("session."):
                            self._handle_session_event(event_name, payload)
                        for handler in self._event_handlers.get(event_name, []):
                            try:
                                if asyncio.iscoroutinefunction(handler):
                                    _handler_task = asyncio.create_task(handler(payload))
                                    _handler_task  # noqa: F841, B018 — prevent premature GC
                                else:
                                    handler(payload)
                            except Exception as exc:
                                logger.error(f"Event handler error: {exc}")

                except ConnectionClosed:
                    logger.warning(f"Gateway {self.name} connection closed by server")
                    break
                except json.JSONDecodeError as exc:
                    logger.error(f"Invalid JSON from Gateway: {exc}")
                except Exception as exc:
                    logger.error(f"Listener error: {exc}")
                    break

        finally:
            old_status = self._status
            self.status = ConnectionStatus.DISCONNECTED

            disconnect_err = {
                "type": "res",
                "ok": False,
                "error": {"code": "DISCONNECTED", "message": "Gateway disconnected"},
            }
            for req_id, q in list(self._response_queues.items()):
                try:
                    q.put_nowait({**disconnect_err, "id": req_id})
                except asyncio.QueueFull:
                    pass
            self._response_queues.clear()

            for sq in list(self._stream_queues.values()):
                try:
                    sq.put_nowait(("error", "DISCONNECTED"))
                except Exception:
                    pass

            logger.info(f"Listener loop ended for {self.name}")
            if self.auto_reconnect and old_status == ConnectionStatus.CONNECTED:
                self._schedule_reconnect()

    def _schedule_reconnect(self) -> None:
        """Schedule reconnect with exponential backoff."""
        if self._reconnect_task and not self._reconnect_task.done():
            return

        async def _reconnect():
            self.status = ConnectionStatus.RECONNECTING
            logger.info(f"Reconnecting {self.name} in {self._current_reconnect_delay:.1f}s")
            await asyncio.sleep(self._current_reconnect_delay)
            if await self.connect():
                self._current_reconnect_delay = self.reconnect_delay
            else:
                self._current_reconnect_delay = min(self._current_reconnect_delay * 2, self.max_reconnect_delay)
                self._schedule_reconnect()

        self._reconnect_task = asyncio.create_task(_reconnect())

    def _handle_session_event(self, _event_name: str, payload: dict) -> None:
        try:
            session_data = payload.get("session", payload)
            if isinstance(session_data, dict):
                session = self._parse_session(session_data)
                if session:
                    self._notify_session_update(session)
        except Exception as exc:
            logger.error(f"Error handling session event: {exc}")

    # ---
    # Core API call
    # ---
    async def call(
        self,
        method: str,
        params: Optional[dict[str, Any]] = None,
        timeout: float = 30.0,  # NOSONAR
        *,
        wait_for_final_agent_result: bool = False,
    ) -> Optional[dict[str, Any]]:
        """Make a Gateway API call and return the payload or None on error."""
        if not await self.connect():
            logger.warning(f"Cannot call {method}: not connected")
            return None

        req_id = str(uuid.uuid4())
        q: asyncio.Queue = asyncio.Queue()
        self._response_queues[req_id] = q

        try:
            await self.ws.send(
                json.dumps(
                    {
                        "type": "req",
                        "id": req_id,
                        "method": method,
                        "params": params or {},
                    }
                )
            )
            response = await asyncio.wait_for(q.get(), timeout=timeout)

            if wait_for_final_agent_result and response.get("ok"):
                payload = response.get("payload") or {}
                if isinstance(payload, dict) and payload.get("status") == "accepted":
                    response = await asyncio.wait_for(q.get(), timeout=timeout)

            if response.get("ok"):
                return response.get("payload")
            logger.warning(f"Gateway call {method} failed: {response.get('error', {})}")
            return None

        except TimeoutError:
            logger.warning(f"Gateway call {method} timed out after {timeout}s")
            return None
        except Exception as exc:
            logger.error(f"Gateway call {method} error: {exc}")
            return None
        finally:
            self._response_queues.pop(req_id, None)

    # ---
    # AgentConnection interface
    # ---
    async def get_sessions(self) -> list[SessionInfo]:
        """Get active sessions from the Gateway."""
        result = await self.call("sessions.list")
        if not result or not isinstance(result, dict):
            return []
        sessions = []
        for raw in result.get("sessions", []):
            session = self._parse_session(raw)
            if session:
                sessions.append(session)
        return sessions

    def _parse_session(self, raw: dict[str, Any]) -> Optional[SessionInfo]:
        """Parse raw session data into SessionInfo."""
        try:
            key = raw.get("key", "")
            session_id = raw.get("sessionId", "")
            if not key and not session_id:
                return None
            agent_id, channel = "main", None
            if ":" in key:
                parts = key.split(":")
                if len(parts) > 1:
                    agent_id = parts[1]
                if len(parts) > 2:
                    channel = parts[2]
            return SessionInfo(
                key=key,
                session_id=session_id,
                source=ConnectionType.OPENCLAW.value,
                connection_id=self.connection_id,
                agent_id=agent_id,
                channel=channel,
                label=raw.get("label"),
                model=raw.get("model"),
                status=raw.get("status", "active"),
                created_at=raw.get("createdAt"),
                last_activity=raw.get("lastActivity"),
                metadata={
                    k: v
                    for k, v in raw.items()
                    if k
                    not in {
                        "key",
                        "sessionId",
                        "label",
                        "model",
                        "status",
                        "createdAt",
                        "lastActivity",
                    }
                },
            )
        except Exception as exc:
            logger.error(f"Error parsing session: {exc}")
            return None

    async def get_status(self) -> dict[str, Any]:
        result = await self.call("status")
        return {
            "connection_id": self.connection_id,
            "name": self.name,
            "type": self.connection_type.value,
            "status": self._status.value,
            "uri": self.uri,
            "gateway_status": result or {},
        }

    async def health_check(self) -> bool:
        if not self.is_connected():
            return False
        try:
            return await self.call("status", timeout=5.0) is not None
        except Exception:
            return False

    # ---
    # Event subscription
    # ---
    def subscribe(self, event_name: str, handler) -> None:
        handlers = self._event_handlers.setdefault(event_name, [])
        if handler not in handlers:
            handlers.append(handler)
            logger.debug(f"Subscribed to event: {event_name}")

    def unsubscribe(self, event_name: str, handler) -> None:
        try:
            self._event_handlers.get(event_name, []).remove(handler)
        except ValueError:
            pass
