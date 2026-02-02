"""
OpenClaw Gateway WebSocket client.
Singleton connection manager with persistent connection and auto-reconnect.

Extracted from Ekinbot Planner for ClawCrew.
"""
import asyncio
import json
import logging
import os
import re
import uuid
from typing import Optional, Any, Callable, AsyncGenerator
import websockets
from websockets.exceptions import ConnectionClosed
from websockets.protocol import State

logger = logging.getLogger(__name__)

# Validation for safe IDs (prevent path traversal)
SAFE_ID = re.compile(r"^[a-zA-Z0-9_-]+$")


def _safe_id(value: str) -> str:
    """Validate ID contains only safe characters."""
    if not value or not SAFE_ID.match(value):
        raise ValueError(f"Invalid id: {value}")
    return value


class GatewayClient:
    """
    Singleton WebSocket client for OpenClaw Gateway.
    
    Maintains ONE persistent connection that is reused for all requests.
    Auto-reconnects on disconnect.
    """
    
    _instance: Optional['GatewayClient'] = None
    _init_lock: Optional[asyncio.Lock] = None
    
    def __init__(self) -> None:
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.uri = os.getenv("OPENCLAW_GATEWAY_URL", "ws://localhost:18789")
        self.token = os.getenv("OPENCLAW_GATEWAY_TOKEN", "")
        
        self._connected = False
        self._connecting = False
        self._connect_lock = asyncio.Lock()
        
        # Map request id -> queue of response frames
        self._response_queues: dict[str, asyncio.Queue] = {}
        self._event_handlers: dict[str, list] = {}
        self._listen_task: Optional[asyncio.Task] = None
        
        logger.info(f"GatewayClient initialized, uri={self.uri}, token={'set' if self.token else 'none'}")
    
    @classmethod
    async def get_instance(cls) -> 'GatewayClient':
        """Get or create singleton instance."""
        if cls._init_lock is None:
            cls._init_lock = asyncio.Lock()
        
        if cls._instance is None:
            async with cls._init_lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance
    
    def _ws_is_open(self) -> bool:
        """Check if WebSocket is open (compatible with websockets 15+)."""
        if self.ws is None:
            return False
        try:
            return self.ws.state == State.OPEN
        except AttributeError:
            return not getattr(self.ws, 'closed', True)
    
    @property
    def connected(self) -> bool:
        """Check if connected (WebSocket open and handshake done)."""
        return self._connected and self._ws_is_open()
    
    async def connect(self) -> bool:
        """
        Establish connection to Gateway if not already connected.
        Returns True if connected (or already was connected).
        """
        if self.connected:
            return True
        
        if self._connecting:
            for _ in range(50):
                await asyncio.sleep(0.1)
                if self.connected:
                    return True
            return False
        
        async with self._connect_lock:
            if self.connected:
                return True
            
            self._connecting = True
            try:
                return await self._do_connect()
            finally:
                self._connecting = False
    
    async def _do_connect(self) -> bool:
        """Internal: perform the actual connection handshake."""
        try:
            logger.info(f"Connecting to Gateway at {self.uri}...")
            
            if self.ws:
                try:
                    await self.ws.close()
                except Exception as e:
                    logger.debug(f"Error closing old connection: {e}")
                self.ws = None
            
            if self._listen_task and not self._listen_task.done():
                self._listen_task.cancel()
                try:
                    await self._listen_task
                except asyncio.CancelledError:
                    pass
            
            self._connected = False
            
            self.ws = await asyncio.wait_for(
                websockets.connect(self.uri, ping_interval=20, ping_timeout=20),
                timeout=10.0
            )
            
            challenge_raw = await asyncio.wait_for(self.ws.recv(), timeout=5.0)
            challenge = json.loads(challenge_raw)
            
            if challenge.get("type") != "event" or challenge.get("event") != "connect.challenge":
                raise Exception(f"Expected connect.challenge, got: {challenge}")
            
            logger.debug(f"Received challenge: {challenge.get('payload', {}).get('nonce', 'unknown')}")
            
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
                        "platform": "python",
                        "mode": "cli"
                    },
                    "role": "operator",
                    "scopes": ["operator.read", "operator.write", "operator.admin"],
                    "auth": {"token": self.token} if self.token else {},
                    "locale": "en-US",
                    "userAgent": "clawcrew/1.0.0"
                }
            }
            
            await self.ws.send(json.dumps(connect_req))
            
            response_raw = await asyncio.wait_for(self.ws.recv(), timeout=5.0)
            response = json.loads(response_raw)
            
            if not response.get("ok"):
                error = response.get("error", {})
                raise Exception(f"Connect rejected: {error.get('message', error)}")
            
            self._connected = True
            logger.info("Gateway connected successfully!")
            
            self._listen_task = asyncio.create_task(self._listen_loop())
            
            return True
            
        except asyncio.TimeoutError:
            logger.error("Gateway connection timed out")
            return False
        except Exception as e:
            logger.error(f"Gateway connection failed: {e}")
            return False
    
    async def _listen_loop(self) -> None:
        """Background task to receive and route messages."""
        logger.debug("Listener loop started")
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
                                logger.warning(f"Response queue full for request {req_id}")
                    
                    elif msg_type == "event":
                        event_name = msg.get("event", "")
                        payload = msg.get("payload", {})
                        
                        if event_name in self._event_handlers:
                            for handler in self._event_handlers[event_name]:
                                try:
                                    if asyncio.iscoroutinefunction(handler):
                                        asyncio.create_task(handler(payload))
                                    else:
                                        handler(payload)
                                except Exception as e:
                                    logger.error(f"Event handler error for {event_name}: {e}")
                    
                except ConnectionClosed:
                    logger.warning("Gateway connection closed by server")
                    break
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON from Gateway: {e}")
                except Exception as e:
                    logger.error(f"Listener error: {e}")
                    break
        finally:
            self._connected = False
            for req_id, q in list(self._response_queues.items()):
                try:
                    q.put_nowait({
                        "type": "res",
                        "id": req_id,
                        "ok": False,
                        "error": {"code": "DISCONNECTED", "message": "Gateway disconnected"},
                    })
                except asyncio.QueueFull:
                    logger.warning(f"Could not queue disconnection error for request {req_id}")
            self._response_queues.clear()
            logger.info("Listener loop ended")
    
    async def call(
        self,
        method: str,
        params: Optional[dict[str, Any]] = None,
        timeout: float = 30.0,
        *,
        wait_for_final_agent_result: bool = False,
    ) -> Optional[dict[str, Any]]:
        """Make a Gateway API call."""
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

    
    def subscribe(self, event_name: str, handler: Callable) -> None:
        """Subscribe to a Gateway event."""
        if event_name not in self._event_handlers:
            self._event_handlers[event_name] = []
        if handler not in self._event_handlers[event_name]:
            self._event_handlers[event_name].append(handler)
            logger.info(f"Subscribed to event: {event_name}")
    
    def unsubscribe(self, event_name: str, handler: Callable) -> None:
        """Unsubscribe from a Gateway event."""
        if event_name in self._event_handlers:
            try:
                self._event_handlers[event_name].remove(handler)
            except ValueError:
                pass
    
    async def close(self) -> None:
        """Close the connection."""
        if self._listen_task:
            self._listen_task.cancel()
        if self.ws:
            await self.ws.close()
        self._connected = False

    # =========================================================================
    # High-level API methods
    # =========================================================================
    
    async def get_status(self) -> dict[str, Any]:
        """Get OpenClaw status."""
        result = await self.call("status")
        return result or {}
    
    async def get_sessions(self) -> list[dict[str, Any]]:
        """Get list of active sessions."""
        result = await self.call("sessions.list")
        if result and isinstance(result, dict):
            return result.get("sessions", [])
        return []
    
    async def get_session_history(self, session_key: str, limit: int = 50) -> list[dict[str, Any]]:
        """Get message history for a session (reads from file)."""
        from pathlib import Path
        
        try:
            sessions = await self.get_sessions()
            session = next((s for s in sessions if s.get("key") == session_key), None)
            if not session:
                return []
            
            session_id = session.get("sessionId")
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
            
            messages = []
            with open(session_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            messages.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
            
            return messages[-limit:] if limit else messages
            
        except (ValueError, OSError) as e:
            logger.error(f"Error reading session history: {e}")
            return []
    
    async def kill_session(self, session_key: str) -> bool:
        """Kill a session by renaming its file."""
        from pathlib import Path
        from datetime import datetime
        
        try:
            sessions = await self.get_sessions()
            session = next((s for s in sessions if s.get("key") == session_key), None)
            if not session:
                return False
            
            session_id = _safe_id(session.get("sessionId", ""))
            if not session_id:
                return False
            
            agent_id = "main"
            if ":" in session_key:
                parts = session_key.split(":")
                if len(parts) > 1:
                    agent_id = _safe_id(parts[1])
            
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
    
    async def send_chat(
        self,
        message: str,
        agent_id: str = "main",
        session_id: Optional[str] = None,
        timeout: float = 90.0,
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
    
    async def patch_session(self, session_id: str, model: Optional[str] = None) -> bool:
        """Update session configuration."""
        params = {"sessionId": session_id}
        if model:
            params["model"] = model
        result = await self.call("session.status", params)
        return result is not None
    
    async def spawn_session(self, task: str, model: str = "sonnet", label: Optional[str] = None) -> Optional[dict[str, Any]]:
        """Spawn a new sub-agent session."""
        params = {
            "task": task,
            "model": model
        }
        if label:
            params["label"] = label
        result = await self.call("sessions.spawn", params, timeout=120.0)
        return result
    
    async def list_cron_jobs(self, all_jobs: bool = True) -> list[dict[str, Any]]:
        """Get list of cron jobs."""
        params = {"includeDisabled": all_jobs} if all_jobs else {}
        result = await self.call("cron.list", params)
        if result and isinstance(result, dict):
            return result.get("jobs", [])
        return []
    
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


# Convenience function
async def get_gateway() -> GatewayClient:
    """Get the singleton Gateway client."""
    return await GatewayClient.get_instance()
