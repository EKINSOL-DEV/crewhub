"""
OpenClaw Gateway connection implementation.

Connects to an OpenClaw Gateway instance via WebSocket for real-time
session monitoring and agent interaction.
"""

import asyncio
import json
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Any, Optional
import websockets
from websockets.exceptions import ConnectionClosed
from websockets.protocol import State

from .base import (
    AgentConnection,
    ConnectionStatus,
    ConnectionType,
    HistoryMessage,
    SessionInfo,
)

logger = logging.getLogger(__name__)

# Validation for safe IDs (prevent path traversal)
SAFE_ID = re.compile(r"^[a-zA-Z0-9_-]+$")


def _safe_id(value: str) -> str:
    """Validate ID contains only safe characters."""
    if not value or not SAFE_ID.match(value):
        raise ValueError(f"Invalid id: {value}")
    return value


class OpenClawConnection(AgentConnection):
    """
    WebSocket connection to OpenClaw Gateway.
    
    Maintains a persistent connection with auto-reconnect capability.
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
        """
        Initialize OpenClaw connection.
        
        Args:
            connection_id: Unique identifier for this connection
            name: Human-readable name
            config: Configuration dictionary with url, token, etc.
        """
        config = config or {}
        super().__init__(
            connection_id=connection_id,
            name=name,
            connection_type=ConnectionType.OPENCLAW,
            config=config,
        )
        
        # Connection settings
        self.uri = config.get("url") or os.getenv(
            "OPENCLAW_GATEWAY_URL", "ws://127.0.0.1:18789"
        )
        self.token = config.get("token") or os.getenv("OPENCLAW_GATEWAY_TOKEN", "")
        
        # Reconnect settings
        self.auto_reconnect = config.get("auto_reconnect", True)
        self.reconnect_delay = config.get("reconnect_delay", 1.0)
        self.max_reconnect_delay = config.get("max_reconnect_delay", 60.0)
        self._current_reconnect_delay = self.reconnect_delay
        
        # WebSocket state
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self._connecting = False
        self._connect_lock = asyncio.Lock()
        
        # Request/response tracking
        self._response_queues: dict[str, asyncio.Queue] = {}
        self._event_handlers: dict[str, list] = {}
        self._listen_task: Optional[asyncio.Task] = None
        self._reconnect_task: Optional[asyncio.Task] = None
        
        # Device identity (set during _do_connect)
        self._identity_manager = None
        self._device_identity = None
        
        logger.info(
            f"OpenClawConnection initialized: uri={self.uri}, "
            f"token={'set' if self.token else 'none'}"
        )
    
    def _ws_is_open(self) -> bool:
        """Check if WebSocket is open (compatible with websockets 15+)."""
        if self.ws is None:
            return False
        try:
            return self.ws.state == State.OPEN
        except AttributeError:
            return not getattr(self.ws, 'closed', True)
    
    def is_connected(self) -> bool:
        """Check if connected and WebSocket is open."""
        return self._status == ConnectionStatus.CONNECTED and self._ws_is_open()
    
    # =========================================================================
    # Connection lifecycle
    # =========================================================================
    
    async def connect(self) -> bool:
        """
        Establish connection to Gateway.
        
        Returns:
            True if connected successfully, False otherwise.
        """
        if self.is_connected():
            return True
        
        # Wait if already connecting
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
        """
        Internal: perform the actual connection handshake with device identity auth.

        Protocol (matching OpenClaw's v2 device auth, discovered from Control UI source):

        1. Load or create device identity (Ed25519 keypair) for this connection.
           - deviceId = SHA256(raw_public_key_bytes) as hex
        2. Open WebSocket and receive challenge (contains nonce).
        3. Build `device` block: {id, publicKey, signature, signedAt, nonce}
           - signature = Ed25519 sign of:
             "v2|<deviceId>|cli|cli|operator|<scopes CSV>|<signedAtMs>|<token>|<nonce>"
           - auth.token = device token (if known) else gateway token
        4. Send connect request with both `client` and `device` blocks.
        5. On success: check response for `auth.deviceToken` and store it.
           Future connections will use this device token instead of the gateway
           token, granting operator.admin scope.
        6. On device-token-rejected errors: clear stored token so the next
           reconnect will fall back to gateway-token + re-register.
        7. Start background listener only after the handshake completes.
        """
        try:
            logger.info(f"Connecting to Gateway at {self.uri}...")

            # ── Close any existing connection ───────────────────────────────
            if self.ws:
                try:
                    await self.ws.close()
                except Exception as e:
                    logger.debug(f"Error closing old connection: {e}")
                self.ws = None

            # ── Cancel old listener ─────────────────────────────────────────
            if self._listen_task and not self._listen_task.done():
                self._listen_task.cancel()
                try:
                    await self._listen_task
                except asyncio.CancelledError:
                    pass

            # ── 1. Device identity ──────────────────────────────────────────
            from .device_identity import DeviceIdentityManager, CREWHUB_SCOPES
            identity_manager = DeviceIdentityManager()
            identity = await identity_manager.get_or_create_device_identity(
                connection_id=self.connection_id,
                device_name=f"CrewHub-{self.name}",
            )
            self._identity_manager = identity_manager
            self._device_identity = identity

            # ── 2. WebSocket connect ────────────────────────────────────────
            self.ws = await asyncio.wait_for(
                websockets.connect(self.uri, ping_interval=20, ping_timeout=20),
                timeout=10.0,
            )

            # ── 3. Receive challenge ────────────────────────────────────────
            challenge_raw = await asyncio.wait_for(self.ws.recv(), timeout=5.0)
            challenge = json.loads(challenge_raw)

            if (
                challenge.get("type") != "event"
                or challenge.get("event") != "connect.challenge"
            ):
                raise Exception(f"Expected connect.challenge, got: {challenge}")

            nonce = challenge.get("payload", {}).get("nonce", "")
            logger.debug(f"Received challenge nonce: {nonce[:16]}...")

            # ── 4. Build auth token ─────────────────────────────────────────
            # Prefer device token (secure, grants admin scope).
            # Fall back to gateway token for first-time registration.
            use_device_token = bool(identity.device_token)
            auth_token = identity.device_token if use_device_token else (self.token or "")

            if use_device_token:
                logger.debug(
                    f"Authenticating with stored device token "
                    f"(device {identity.device_id[:16]}...)"
                )
            elif self.token:
                logger.info(
                    f"No device token yet — authenticating with gateway token "
                    f"for initial device registration (device {identity.device_id[:16]}...)"
                )
            else:
                logger.warning(
                    "No auth credentials available "
                    "(no device token, no gateway token)"
                )

            # ── 5. Build device block with Ed25519 signature ────────────────
            signed_at_ms = int(__import__("time").time() * 1000)
            device_block = identity.build_device_block(
                nonce=nonce,
                auth_token=auth_token,
                signed_at_ms=signed_at_ms,
            )

            # ── 6. Send connect request ─────────────────────────────────────
            connect_req = {
                "type": "req",
                "id": f"connect-{uuid.uuid4()}",
                "method": "connect",
                "params": {
                    "minProtocol": 3,
                    "maxProtocol": 3,
                    "client": {
                        "id": "cli",
                        "version": "1.0.0",
                        "platform": "crewhub",
                        "mode": "cli",
                    },
                    "device": device_block,  # ← device identity proof
                    "role": "operator",
                    "scopes": CREWHUB_SCOPES,
                    "auth": {"token": auth_token} if auth_token else {},
                    "locale": "en-US",
                    "userAgent": f"crewhub/{self.connection_id}/1.0.0",
                },
            }

            await self.ws.send(json.dumps(connect_req))

            # ── 7. Receive connect response ─────────────────────────────────
            response_raw = await asyncio.wait_for(self.ws.recv(), timeout=5.0)
            response = json.loads(response_raw)

            if not response.get("ok"):
                error = response.get("error", {})
                error_code = error.get("code", "")

                # Device token rejected → clear it; next connect will re-register.
                if use_device_token and error_code in (
                    "DEVICE_TOKEN_INVALID",
                    "DEVICE_NOT_FOUND",
                    "TOKEN_EXPIRED",
                    "UNAUTHORIZED",
                ):
                    logger.warning(
                        f"Device token rejected by gateway ({error_code}) — "
                        "clearing stored token; will re-register on next connect"
                    )
                    identity.device_token = None
                    await identity_manager.clear_device_token(identity.device_id)

                raise Exception(f"Connect rejected: {error.get('message', error)}")

            # ── 8. Extract and store deviceToken from response ──────────────
            # The gateway returns auth.deviceToken when it registers/recognises
            # a device identity for the first time (or after token rotation).
            payload = response.get("payload", {})
            response_auth = payload.get("auth") or {}
            new_device_token = (
                response_auth.get("deviceToken")
                or response_auth.get("token")  # older format fallback
            )

            if new_device_token and new_device_token != auth_token:
                identity.device_token = new_device_token
                await identity_manager.update_device_token(
                    identity.device_id, new_device_token
                )
                logger.info(
                    f"✓ Device token received from gateway — stored for device "
                    f"{identity.device_id[:16]}... "
                    "Future connections will use device-token auth with admin scope."
                )

            # ── 9. Mark connected and start listener ────────────────────────
            self.status = ConnectionStatus.CONNECTED

            auth_mode = "device-token" if use_device_token else "gateway-token"
            got_token = " (got new device token ✓)" if (new_device_token and not use_device_token) else ""
            logger.info(
                f"Gateway '{self.name}' connected [{auth_mode}]{got_token}"
            )

            self._listen_task = asyncio.create_task(self._listen_loop())

            return True

        except asyncio.TimeoutError:
            self._set_error("Connection timed out")
            return False
        except Exception as e:
            self._set_error(str(e))
            return False
    
    async def disconnect(self) -> None:
        """Close the connection gracefully."""
        # Cancel reconnect task
        if self._reconnect_task and not self._reconnect_task.done():
            self._reconnect_task.cancel()
            try:
                await self._reconnect_task
            except asyncio.CancelledError:
                pass
        
        # Cancel listener
        if self._listen_task and not self._listen_task.done():
            self._listen_task.cancel()
            try:
                await self._listen_task
            except asyncio.CancelledError:
                pass
        
        # Close WebSocket
        if self.ws:
            try:
                await self.ws.close()
            except Exception as e:
                logger.debug(f"Error closing WebSocket: {e}")
            self.ws = None
        
        self.status = ConnectionStatus.DISCONNECTED
        logger.info(f"Gateway {self.name} disconnected")
    
    async def _listen_loop(self) -> None:
        """Background task to receive and route messages."""
        logger.debug(f"Listener loop started for {self.name}")
        try:
            while self._ws_is_open():
                try:
                    raw = await self.ws.recv()
                    msg = json.loads(raw)
                    
                    msg_type = msg.get("type")
                    
                    if msg_type == "res":
                        # Route response to waiting caller
                        req_id = msg.get("id")
                        q = self._response_queues.get(req_id)
                        if q is not None:
                            try:
                                q.put_nowait(msg)
                            except asyncio.QueueFull:
                                logger.warning(f"Response queue full for {req_id}")
                    
                    elif msg_type == "event":
                        # Handle event
                        event_name = msg.get("event", "")
                        payload = msg.get("payload", {})
                        
                        # Check for session events
                        if event_name.startswith("session."):
                            self._handle_session_event(event_name, payload)
                        
                        # Call registered handlers
                        if event_name in self._event_handlers:
                            for handler in self._event_handlers[event_name]:
                                try:
                                    if asyncio.iscoroutinefunction(handler):
                                        asyncio.create_task(handler(payload))
                                    else:
                                        handler(payload)
                                except Exception as e:
                                    logger.error(f"Event handler error: {e}")
                    
                except ConnectionClosed:
                    logger.warning(f"Gateway {self.name} connection closed by server")
                    break
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON from Gateway: {e}")
                except Exception as e:
                    logger.error(f"Listener error: {e}")
                    break
                    
        finally:
            old_status = self._status
            self.status = ConnectionStatus.DISCONNECTED
            
            # Notify waiting callers of disconnect
            for req_id, q in list(self._response_queues.items()):
                try:
                    q.put_nowait({
                        "type": "res",
                        "id": req_id,
                        "ok": False,
                        "error": {"code": "DISCONNECTED", "message": "Gateway disconnected"},
                    })
                except asyncio.QueueFull:
                    pass
            self._response_queues.clear()
            
            logger.info(f"Listener loop ended for {self.name}")
            
            # Trigger auto-reconnect if enabled and was previously connected
            if self.auto_reconnect and old_status == ConnectionStatus.CONNECTED:
                self._schedule_reconnect()
    
    def _schedule_reconnect(self) -> None:
        """Schedule a reconnection attempt with exponential backoff."""
        if self._reconnect_task and not self._reconnect_task.done():
            return  # Already scheduled
        
        async def reconnect():
            self.status = ConnectionStatus.RECONNECTING
            logger.info(
                f"Scheduling reconnect for {self.name} in "
                f"{self._current_reconnect_delay:.1f}s"
            )
            await asyncio.sleep(self._current_reconnect_delay)
            
            if await self.connect():
                self._current_reconnect_delay = self.reconnect_delay
            else:
                # Exponential backoff
                self._current_reconnect_delay = min(
                    self._current_reconnect_delay * 2,
                    self.max_reconnect_delay
                )
                self._schedule_reconnect()
        
        self._reconnect_task = asyncio.create_task(reconnect())
    
    def _handle_session_event(self, event_name: str, payload: dict) -> None:
        """Handle session-related events and notify callbacks."""
        try:
            session_data = payload.get("session", payload)
            if not isinstance(session_data, dict):
                return
            
            session = self._parse_session(session_data)
            if session:
                self._notify_session_update(session)
        except Exception as e:
            logger.error(f"Error handling session event: {e}")
    
    # =========================================================================
    # API calls
    # =========================================================================
    
    async def call(
        self,
        method: str,
        params: Optional[dict[str, Any]] = None,
        timeout: float = 30.0,
        *,
        wait_for_final_agent_result: bool = False,
    ) -> Optional[dict[str, Any]]:
        """
        Make a Gateway API call.
        
        Args:
            method: API method name
            params: Method parameters
            timeout: Request timeout in seconds
            wait_for_final_agent_result: Wait for agent to complete
            
        Returns:
            Response payload or None on error.
        """
        if not await self.connect():
            logger.warning(f"Cannot call {method}: not connected")
            return None

        req_id = str(uuid.uuid4())
        request = {
            "type": "req",
            "id": req_id,
            "method": method,
            "params": params or {},
        }

        q: asyncio.Queue = asyncio.Queue()
        self._response_queues[req_id] = q

        try:
            await self.ws.send(json.dumps(request))

            response = await asyncio.wait_for(q.get(), timeout=timeout)

            if wait_for_final_agent_result and response.get("ok"):
                payload = response.get("payload") or {}
                if isinstance(payload, dict) and payload.get("status") == "accepted":
                    response = await asyncio.wait_for(q.get(), timeout=timeout)

            if response.get("ok"):
                return response.get("payload")

            error = response.get("error", {})
            logger.warning(f"Gateway call {method} failed: {error}")
            return None

        except asyncio.TimeoutError:
            logger.warning(f"Gateway call {method} timed out after {timeout}s")
            return None
        except Exception as e:
            logger.error(f"Gateway call {method} error: {e}")
            return None
        finally:
            self._response_queues.pop(req_id, None)
    
    # =========================================================================
    # AgentConnection interface implementation
    # =========================================================================
    
    async def get_sessions(self) -> list[SessionInfo]:
        """Get list of active sessions from Gateway."""
        result = await self.call("sessions.list")
        if not result or not isinstance(result, dict):
            return []
        
        raw_sessions = result.get("sessions", [])
        sessions = []
        
        for raw in raw_sessions:
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
            
            # Parse agent ID and channel from key
            agent_id = "main"
            channel = None
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
                    k: v for k, v in raw.items()
                    if k not in {"key", "sessionId", "label", "model", "status", "createdAt", "lastActivity"}
                },
            )
        except Exception as e:
            logger.error(f"Error parsing session: {e}")
            return None
    
    async def get_session_history(
        self,
        session_key: str,
        limit: int = 50,
    ) -> list[HistoryMessage]:
        """Get message history for a session (reads from file)."""
        try:
            sessions = await self.get_sessions()
            session = next((s for s in sessions if s.key == session_key), None)
            if not session:
                return []
            
            session_id = session.session_id
            if not session_id:
                return []
            
            session_id = _safe_id(session_id)
            agent_id = _safe_id(session.agent_id)
            
            base = Path.home() / ".openclaw" / "agents" / agent_id / "sessions"
            session_file = (base / f"{session_id}.jsonl").resolve()
            
            # Security: ensure path is within base directory
            if not str(session_file).startswith(str(base.resolve())):
                raise ValueError("Invalid session path")
            
            if not session_file.exists():
                return []
            
            messages: list[HistoryMessage] = []
            with open(session_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        raw = json.loads(line)
                        msg = self._parse_history_message(raw)
                        if msg:
                            messages.append(msg)
                    except json.JSONDecodeError:
                        continue
            
            return messages[-limit:] if limit else messages
            
        except (ValueError, OSError) as e:
            logger.error(f"Error reading session history: {e}")
            return []
    
    def _parse_history_message(self, raw: dict[str, Any]) -> Optional[HistoryMessage]:
        """Parse raw history entry into HistoryMessage."""
        try:
            role = raw.get("role", "")
            content = raw.get("content", "")
            
            # Handle different content formats
            if isinstance(content, list):
                # Extract text from content blocks
                text_parts = []
                for block in content:
                    if isinstance(block, dict):
                        if block.get("type") == "text":
                            text_parts.append(block.get("text", ""))
                    elif isinstance(block, str):
                        text_parts.append(block)
                content = "\n".join(text_parts)
            
            if not role:
                return None
            
            return HistoryMessage(
                role=role,
                content=content,
                timestamp=raw.get("timestamp"),
                metadata={
                    k: v for k, v in raw.items()
                    if k not in {"role", "content", "timestamp"}
                },
            )
        except Exception as e:
            logger.error(f"Error parsing history message: {e}")
            return None
    
    async def get_status(self) -> dict[str, Any]:
        """Get detailed Gateway status."""
        result = await self.call("status")
        return {
            "connection_id": self.connection_id,
            "name": self.name,
            "type": self.connection_type.value,
            "status": self._status.value,
            "uri": self.uri,
            "gateway_status": result or {},
        }
    
    async def send_message(
        self,
        session_key: str,
        message: str,
        timeout: float = 90.0,
    ) -> Optional[str]:
        """Send a chat message to a session."""
        # Parse session key for agent ID
        agent_id = "main"
        session_id = None
        
        if ":" in session_key:
            parts = session_key.split(":")
            if len(parts) > 1:
                agent_id = parts[1]
        
        # Find session to get session_id
        sessions = await self.get_sessions()
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

        result = await self.call(
            "agent",
            params,
            timeout=timeout,
            wait_for_final_agent_result=True,
        )

        if not result:
            return None

        # Extract text from various response formats
        agent_result = result.get("result") if isinstance(result, dict) else None
        if isinstance(agent_result, dict):
            payloads = agent_result.get("payloads")
            if isinstance(payloads, list) and payloads:
                text = payloads[0].get("text")
                if isinstance(text, str):
                    return text

        for key in ("text", "response", "content", "reply"):
            val = result.get(key) if isinstance(result, dict) else None
            if isinstance(val, str) and val:
                return val

        return None
    
    async def kill_session(self, session_key: str) -> bool:
        """Kill a session by renaming its file."""
        from datetime import datetime
        
        try:
            sessions = await self.get_sessions()
            session = next((s for s in sessions if s.key == session_key), None)
            if not session:
                return False
            
            session_id = _safe_id(session.session_id)
            if not session_id:
                return False
            
            agent_id = _safe_id(session.agent_id)
            
            base = Path.home() / ".openclaw" / "agents" / agent_id / "sessions"
            session_file = (base / f"{session_id}.jsonl").resolve()
            
            if not str(session_file).startswith(str(base.resolve())):
                return False
            
            if session_file.exists():
                ts = datetime.utcnow().isoformat().replace(':', '-')
                session_file.rename(session_file.with_suffix(f".jsonl.deleted.{ts}"))
                return True
            
            return False
        except (ValueError, OSError) as e:
            logger.error(f"Error killing session: {e}")
            return False
    
    async def health_check(self) -> bool:
        """Check Gateway health by calling status endpoint."""
        if not self.is_connected():
            return False
        
        try:
            result = await self.call("status", timeout=5.0)
            return result is not None
        except Exception:
            return False
    
    # =========================================================================
    # Event subscription
    # =========================================================================
    
    def subscribe(self, event_name: str, handler) -> None:
        """Subscribe to a Gateway event."""
        if event_name not in self._event_handlers:
            self._event_handlers[event_name] = []
        if handler not in self._event_handlers[event_name]:
            self._event_handlers[event_name].append(handler)
            logger.debug(f"Subscribed to event: {event_name}")
    
    def unsubscribe(self, event_name: str, handler) -> None:
        """Unsubscribe from a Gateway event."""
        if event_name in self._event_handlers:
            try:
                self._event_handlers[event_name].remove(handler)
            except ValueError:
                pass
    
    # =========================================================================
    # Raw data access (backward-compat with legacy GatewayClient)
    # =========================================================================
    
    async def get_sessions_raw(self) -> list[dict[str, Any]]:
        """Get raw session dicts from Gateway (legacy format)."""
        result = await self.call("sessions.list")
        if result and isinstance(result, dict):
            return result.get("sessions", [])
        return []
    
    async def get_session_history_raw(
        self,
        session_key: str,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """Get raw JSONL history entries (legacy format)."""
        import json as _json
        
        try:
            sessions = await self.get_sessions_raw()
            session = next(
                (s for s in sessions if s.get("key") == session_key), None
            )
            if not session:
                return []
            
            session_id = session.get("sessionId", "")
            if not session_id:
                return []
            
            session_id = _safe_id(session_id)
            agent_id = "main"
            if ":" in session_key:
                parts = session_key.split(":")
                if len(parts) > 1:
                    agent_id = _safe_id(parts[1])
            
            base = Path.home() / ".openclaw" / "agents" / agent_id / "sessions"
            session_file = (base / f"{session_id}.jsonl").resolve()
            
            if not str(session_file).startswith(str(base.resolve())):
                raise ValueError("Invalid session path")
            
            if not session_file.exists():
                return []
            
            messages: list[dict[str, Any]] = []
            with open(session_file, "r") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            messages.append(_json.loads(line))
                        except _json.JSONDecodeError:
                            continue
            
            return messages[-limit:] if limit else messages
            
        except (ValueError, OSError) as e:
            logger.error(f"Error reading session history: {e}")
            return []
    
    # =========================================================================
    # Extended API methods (migrated from legacy GatewayClient)
    # =========================================================================
    
    async def send_chat(
        self,
        message: str,
        agent_id: str = "main",
        session_id: Optional[str] = None,
        timeout: float = 90.0,
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

        result = await self.call(
            "agent",
            params,
            timeout=timeout,
            wait_for_final_agent_result=True,
        )

        if not result:
            return None

        agent_result = result.get("result") if isinstance(result, dict) else None
        if isinstance(agent_result, dict):
            payloads = agent_result.get("payloads")
            if isinstance(payloads, list) and payloads:
                text = payloads[0].get("text")
                if isinstance(text, str):
                    return text

        for key in ("text", "response", "content", "reply"):
            val = result.get(key) if isinstance(result, dict) else None
            if isinstance(val, str) and val:
                return val

        return None
    
    async def patch_session(
        self, session_id: str, model: Optional[str] = None
    ) -> bool:
        """Update session configuration (e.g., switch model)."""
        params: dict[str, Any] = {"sessionId": session_id}
        if model:
            params["model"] = model
        result = await self.call("session.status", params)
        return result is not None
    
    # ── Cron management ─────────────────────────────────────────────
    
    async def list_cron_jobs(self, all_jobs: bool = True) -> list[dict[str, Any]]:
        """Get list of cron jobs."""
        params = {"includeDisabled": all_jobs} if all_jobs else {}
        result = await self.call("cron.list", params)
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
        return await self.call("cron.add", params)
    
    async def update_cron_job(
        self, job_id: str, patch: dict[str, Any]
    ) -> Optional[dict[str, Any]]:
        """Update an existing cron job."""
        return await self.call("cron.update", {"jobId": job_id, "patch": patch})
    
    async def delete_cron_job(self, job_id: str) -> bool:
        """Delete a cron job."""
        result = await self.call("cron.remove", {"jobId": job_id})
        return result is not None
    
    async def enable_cron_job(self, job_id: str) -> bool:
        """Enable a cron job."""
        return await self.update_cron_job(job_id, {"enabled": True}) is not None
    
    async def disable_cron_job(self, job_id: str) -> bool:
        """Disable a cron job."""
        return await self.update_cron_job(job_id, {"enabled": False}) is not None
    
    async def run_cron_job(self, job_id: str, force: bool = False) -> bool:
        """Trigger a cron job to run immediately."""
        params: dict[str, Any] = {"jobId": job_id}
        if force:
            params["force"] = True
        result = await self.call("cron.run", params)
        return result is not None
    
    # ── System queries ──────────────────────────────────────────────
    
    async def get_presence(self) -> dict[str, Any]:
        """Get connected devices/clients."""
        result = await self.call("system-presence")
        return result or {}
    
    async def list_nodes(self) -> list[dict[str, Any]]:
        """Get list of paired nodes."""
        for method in ["nodes-status", "nodes.list", "nodes"]:
            result = await self.call(method)
            if result and isinstance(result, dict):
                nodes = result.get("nodes", [])
                if nodes or "nodes" in result:
                    return nodes
        return []
