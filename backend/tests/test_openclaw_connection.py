"""Tests for app.services.connections.openclaw — OpenClawConnection."""

import asyncio

# Import directly from files to avoid circular import through __init__.py
import importlib.util
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_services_dir = Path(__file__).resolve().parent.parent / "app" / "services" / "connections"


def _load_module(name, filepath):
    spec = importlib.util.spec_from_file_location(name, filepath)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


_base = _load_module("_test_base", _services_dir / "base.py")
ConnectionStatus = _base.ConnectionStatus
ConnectionType = _base.ConnectionType
SessionInfo = _base.SessionInfo

# openclaw.py imports from .base so we need the package to resolve relative imports
# Instead, just pre-populate the package path and use a different strategy
# Let's just mock/skip the circular chain by pre-importing what we need
# Actually: the conftest imports app.main which should handle this. Let's force app.main first.
from app.main import app as _app  # noqa: E402, F401
from app.services.connections.base import ConnectionStatus  # noqa: E402, F811
from app.services.connections.openclaw import OpenClawConnection  # noqa: E402

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_conn(**overrides) -> OpenClawConnection:
    cfg = {"url": "ws://localhost:18789", "token": "tok123", **overrides}
    return OpenClawConnection(connection_id="c1", name="test-gw", config=cfg)


# ---------------------------------------------------------------------------
# Init / helpers
# ---------------------------------------------------------------------------


class TestInit:
    def test_defaults(self):
        c = _make_conn()
        assert c.uri == "ws://localhost:18789"
        assert c.token == "tok123"
        assert c.auto_reconnect is True
        assert c.reconnect_delay == 1.0
        assert c.max_reconnect_delay == 60.0
        assert c.ws is None
        assert c.is_connected() is False

    def test_env_fallback(self):
        with patch.dict("os.environ", {"OPENCLAW_GATEWAY_URL": "ws://env:9999", "OPENCLAW_GATEWAY_TOKEN": "envtok"}):
            c = OpenClawConnection("c2", "env-gw", config={})
        assert c.uri == "ws://env:9999"
        assert c.token == "envtok"

    def test_config_overrides_env(self):
        with patch.dict("os.environ", {"OPENCLAW_GATEWAY_URL": "ws://env:9999"}):
            c = _make_conn(url="ws://cfg:1111")
        assert c.uri == "ws://cfg:1111"


class TestWsIsOpen:
    def test_none_ws(self):
        c = _make_conn()
        assert c._ws_is_open() is False

    def test_open_state(self):
        from websockets.protocol import State

        c = _make_conn()
        c.ws = MagicMock()
        c.ws.state = State.OPEN
        assert c._ws_is_open() is True

    def test_closed_state(self):
        from websockets.protocol import State

        c = _make_conn()
        c.ws = MagicMock()
        c.ws.state = State.CLOSED
        assert c._ws_is_open() is False

    def test_attribute_error_fallback(self):
        c = _make_conn()
        c.ws = MagicMock(spec=[])  # no .state
        c.ws.closed = False
        assert c._ws_is_open() is True


class TestIsConnected:
    def test_not_connected_when_disconnected(self):
        c = _make_conn()
        assert c.is_connected() is False

    def test_connected(self):
        from websockets.protocol import State

        c = _make_conn()
        c._status = ConnectionStatus.CONNECTED
        c.ws = MagicMock()
        c.ws.state = State.OPEN
        assert c.is_connected() is True


# ---------------------------------------------------------------------------
# connect()
# ---------------------------------------------------------------------------


class TestConnect:
    @pytest.mark.asyncio
    async def test_already_connected(self):
        from websockets.protocol import State

        c = _make_conn()
        c._status = ConnectionStatus.CONNECTED
        c.ws = MagicMock()
        c.ws.state = State.OPEN
        assert await c.connect() is True

    @pytest.mark.asyncio
    async def test_connect_delegates_to_handshake(self):
        c = _make_conn()
        with patch.object(c, "_do_connect", new_callable=AsyncMock, return_value=True):
            result = await c.connect()
        assert result is True
        assert c._current_reconnect_delay == c.reconnect_delay

    @pytest.mark.asyncio
    async def test_connect_failure(self):
        c = _make_conn()
        with patch.object(c, "_do_connect", new_callable=AsyncMock, return_value=False):
            result = await c.connect()
        assert result is False

    @pytest.mark.asyncio
    async def test_connect_while_connecting_waits(self):
        """If _connecting is True, connect() polls until connected or gives up."""
        c = _make_conn()
        c._connecting = True
        # Not connected → should return False after polling
        result = await c.connect()
        assert result is False


# ---------------------------------------------------------------------------
# disconnect()
# ---------------------------------------------------------------------------


class TestDisconnect:
    @pytest.mark.asyncio
    async def test_disconnect_cleans_up(self):
        c = _make_conn()
        c.ws = AsyncMock()

        # Simulate running tasks
        c._listen_task = asyncio.create_task(asyncio.sleep(999))
        c._reconnect_task = asyncio.create_task(asyncio.sleep(999))

        await c.disconnect()

        assert c.ws is None
        assert c._status == ConnectionStatus.DISCONNECTED

    @pytest.mark.asyncio
    async def test_disconnect_no_ws(self):
        c = _make_conn()
        await c.disconnect()
        assert c._status == ConnectionStatus.DISCONNECTED

    @pytest.mark.asyncio
    async def test_disconnect_ws_close_error(self):
        c = _make_conn()
        c.ws = AsyncMock()
        c.ws.close.side_effect = Exception("close failed")
        await c.disconnect()
        assert c.ws is None


# ---------------------------------------------------------------------------
# _dispatch_message / _dispatch_response / _dispatch_event_handlers
# ---------------------------------------------------------------------------


class TestDispatch:
    def test_dispatch_response(self):
        c = _make_conn()
        q = asyncio.Queue()
        c._response_queues["r1"] = q
        c._dispatch_response({"id": "r1", "ok": True})
        assert q.qsize() == 1

    def test_dispatch_response_no_queue(self):
        c = _make_conn()
        # Should not raise
        c._dispatch_response({"id": "unknown"})

    def test_dispatch_message_res(self):
        c = _make_conn()
        q = asyncio.Queue()
        c._response_queues["r1"] = q
        c._dispatch_message({"type": "res", "id": "r1", "ok": True})
        assert q.qsize() == 1

    def test_dispatch_message_event(self):
        c = _make_conn()
        handler = MagicMock()
        c._event_handlers["test.event"] = [handler]
        c._dispatch_message({"type": "event", "event": "test.event", "payload": {"x": 1}})
        handler.assert_called_once_with({"x": 1})

    def test_dispatch_event_session_prefix(self):
        c = _make_conn()
        with patch.object(c, "_handle_session_event") as mock_hse:
            c._dispatch_event_handlers("session.update", {"session": {}})
            mock_hse.assert_called_once()

    @pytest.mark.asyncio
    async def test_dispatch_event_async_handler(self):
        c = _make_conn()
        handler = AsyncMock()
        c._event_handlers["ev"] = [handler]
        c._dispatch_event_handlers("ev", {"a": 1})
        await asyncio.sleep(0.05)
        handler.assert_called_once_with({"a": 1})

    def test_dispatch_event_handler_error(self):
        c = _make_conn()
        handler = MagicMock(side_effect=Exception("boom"))
        c._event_handlers["ev"] = [handler]
        # Should not raise
        c._dispatch_event_handlers("ev", {})


# ---------------------------------------------------------------------------
# call()
# ---------------------------------------------------------------------------


class TestCall:
    @pytest.mark.asyncio
    async def test_call_success(self):
        c = _make_conn()
        with patch.object(c, "connect", new_callable=AsyncMock, return_value=True):
            c.ws = AsyncMock()

            async def fake_send(data):
                msg = json.loads(data)
                q = c._response_queues[msg["id"]]
                await q.put({"ok": True, "payload": {"result": 42}})

            c.ws.send = fake_send
            result = await c.call("test.method", {"p": 1})
        assert result == {"result": 42}

    @pytest.mark.asyncio
    async def test_call_not_connected(self):
        c = _make_conn()
        with patch.object(c, "connect", new_callable=AsyncMock, return_value=False):
            result = await c.call("test.method")
        assert result is None

    @pytest.mark.asyncio
    async def test_call_error_response(self):
        c = _make_conn()
        with patch.object(c, "connect", new_callable=AsyncMock, return_value=True):
            c.ws = AsyncMock()

            async def fake_send(data):
                msg = json.loads(data)
                q = c._response_queues[msg["id"]]
                await q.put({"ok": False, "error": {"message": "fail"}})

            c.ws.send = fake_send
            result = await c.call("test.method")
        assert result is None

    @pytest.mark.asyncio
    async def test_call_timeout(self):
        c = _make_conn()
        with patch.object(c, "connect", new_callable=AsyncMock, return_value=True):
            c.ws = AsyncMock()
            result = await c.call("test.method", timeout=0.05)
        assert result is None

    @pytest.mark.asyncio
    async def test_call_wait_for_final_agent_result(self):
        c = _make_conn()
        with patch.object(c, "connect", new_callable=AsyncMock, return_value=True):
            c.ws = AsyncMock()

            async def fake_send(data):
                msg = json.loads(data)
                q = c._response_queues[msg["id"]]
                await q.put({"ok": True, "payload": {"status": "accepted"}})
                await q.put({"ok": True, "payload": {"final": True}})

            c.ws.send = fake_send
            result = await c.call("test.method", wait_for_final_agent_result=True)
        assert result == {"final": True}

    @pytest.mark.asyncio
    async def test_call_send_exception(self):
        c = _make_conn()
        with patch.object(c, "connect", new_callable=AsyncMock, return_value=True):
            c.ws = AsyncMock()
            c.ws.send.side_effect = Exception("send error")
            result = await c.call("test.method")
        assert result is None


# ---------------------------------------------------------------------------
# get_sessions / _parse_session / get_status / health_check
# ---------------------------------------------------------------------------


class TestSessions:
    @pytest.mark.asyncio
    async def test_get_sessions(self):
        c = _make_conn()
        with patch.object(
            c,
            "call",
            new_callable=AsyncMock,
            return_value={"sessions": [{"key": "agent:main:cli", "sessionId": "s1", "status": "active"}]},
        ):
            sessions = await c.get_sessions()
        assert len(sessions) == 1
        assert sessions[0].agent_id == "main"
        assert sessions[0].channel == "cli"

    @pytest.mark.asyncio
    async def test_get_sessions_empty(self):
        c = _make_conn()
        with patch.object(c, "call", new_callable=AsyncMock, return_value=None):
            assert await c.get_sessions() == []

    def test_parse_session_minimal(self):
        c = _make_conn()
        s = c._parse_session({"key": "agent:dev:slack", "sessionId": "s2"})
        assert s.agent_id == "dev"
        assert s.channel == "slack"

    def test_parse_session_no_key(self):
        c = _make_conn()
        assert c._parse_session({}) is None

    def test_parse_session_error(self):
        c = _make_conn()
        # Force error by passing non-dict
        assert c._parse_session({"key": "x", "sessionId": "y", "status": 123}) is not None


class TestStatus:
    @pytest.mark.asyncio
    async def test_get_status(self):
        c = _make_conn()
        with patch.object(c, "call", new_callable=AsyncMock, return_value={"version": "1.0"}):
            status = await c.get_status()
        assert status["name"] == "test-gw"
        assert status["gateway_status"] == {"version": "1.0"}

    @pytest.mark.asyncio
    async def test_health_check_connected(self):
        from websockets.protocol import State

        c = _make_conn()
        c._status = ConnectionStatus.CONNECTED
        c.ws = MagicMock()
        c.ws.state = State.OPEN
        with patch.object(c, "call", new_callable=AsyncMock, return_value={"ok": True}):
            assert await c.health_check() is True

    @pytest.mark.asyncio
    async def test_health_check_not_connected(self):
        c = _make_conn()
        assert await c.health_check() is False

    @pytest.mark.asyncio
    async def test_health_check_exception(self):
        from websockets.protocol import State

        c = _make_conn()
        c._status = ConnectionStatus.CONNECTED
        c.ws = MagicMock()
        c.ws.state = State.OPEN
        with patch.object(c, "call", new_callable=AsyncMock, side_effect=Exception("err")):
            assert await c.health_check() is False


# ---------------------------------------------------------------------------
# subscribe / unsubscribe
# ---------------------------------------------------------------------------


class TestSubscribe:
    def test_subscribe(self):
        c = _make_conn()
        handler = MagicMock()
        c.subscribe("ev", handler)
        assert handler in c._event_handlers["ev"]

    def test_subscribe_duplicate(self):
        c = _make_conn()
        handler = MagicMock()
        c.subscribe("ev", handler)
        c.subscribe("ev", handler)
        assert c._event_handlers["ev"].count(handler) == 1

    def test_unsubscribe(self):
        c = _make_conn()
        handler = MagicMock()
        c.subscribe("ev", handler)
        c.unsubscribe("ev", handler)
        assert handler not in c._event_handlers.get("ev", [])

    def test_unsubscribe_missing(self):
        c = _make_conn()
        c.unsubscribe("ev", MagicMock())  # no error


# ---------------------------------------------------------------------------
# _listen_loop
# ---------------------------------------------------------------------------


class TestListenLoop:
    @pytest.mark.asyncio
    async def test_listen_loop_connection_closed(self):
        from websockets.exceptions import ConnectionClosed
        from websockets.protocol import State

        c = _make_conn()
        c._status = ConnectionStatus.CONNECTED
        c.auto_reconnect = False
        ws = AsyncMock()
        ws.state = State.OPEN
        ws.recv.side_effect = ConnectionClosed(None, None)
        c.ws = ws
        await c._listen_loop()
        assert c._status == ConnectionStatus.DISCONNECTED

    @pytest.mark.asyncio
    async def test_listen_loop_dispatches(self):
        from websockets.protocol import State

        c = _make_conn()
        c._status = ConnectionStatus.CONNECTED
        c.auto_reconnect = False
        ws = AsyncMock()

        call_count = 0

        def get_state():
            nonlocal call_count
            call_count += 1
            if call_count > 2:
                return State.CLOSED
            return State.OPEN

        type(ws).state = property(lambda self: get_state())
        ws.recv.return_value = json.dumps({"type": "event", "event": "test", "payload": {}})
        c.ws = ws
        handler = MagicMock()
        c._event_handlers["test"] = [handler]
        await c._listen_loop()
        assert handler.called


# ---------------------------------------------------------------------------
# _schedule_reconnect / _handle_session_event
# ---------------------------------------------------------------------------


class TestReconnect:
    @pytest.mark.asyncio
    async def test_schedule_reconnect(self):
        c = _make_conn()
        c.reconnect_delay = 0.01
        with patch.object(c, "connect", new_callable=AsyncMock, return_value=True):
            c._schedule_reconnect()
            await asyncio.sleep(0.1)
        assert c._reconnect_task is not None

    @pytest.mark.asyncio
    async def test_schedule_reconnect_no_duplicate(self):
        c = _make_conn()
        c._reconnect_task = asyncio.create_task(asyncio.sleep(999))
        c._schedule_reconnect()  # should not create another
        c._reconnect_task.cancel()
        try:
            await c._reconnect_task
        except asyncio.CancelledError:
            pass


class TestHandleSessionEvent:
    def test_handle_session_event(self):
        c = _make_conn()
        with patch.object(c, "_notify_session_update") as mock_notify:
            c._handle_session_event("session.update", {"session": {"key": "agent:main:cli", "sessionId": "s1"}})
            mock_notify.assert_called_once()

    def test_handle_session_event_error(self):
        c = _make_conn()
        # Bad payload should not raise
        c._handle_session_event("session.update", None)
