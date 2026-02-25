"""Tests for the connection abstraction base classes."""

from unittest.mock import MagicMock

import pytest

# Import through main app to resolve circular imports
import app.main  # noqa: F401
from app.services.connections.base import (
    AgentConnection,
    ConnectionStatus,
    ConnectionType,
    HistoryMessage,
    SessionInfo,
)


class ConcreteConnection(AgentConnection):
    """Concrete implementation of AgentConnection for testing."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._connect_success = True

    async def connect(self) -> bool:
        if self._connect_success:
            self.status = ConnectionStatus.CONNECTED
            return True
        self._set_error("Failed")
        return False

    async def disconnect(self) -> None:
        self.status = ConnectionStatus.DISCONNECTED

    async def get_sessions(self) -> list:
        return []

    async def get_session_history(self, session_key: str, limit: int = 50) -> list:
        return []

    async def get_status(self) -> dict:
        return {"status": self.status.value}


class TestConnectionStatus:
    """Test ConnectionStatus enum."""

    def test_all_statuses_exist(self):
        assert ConnectionStatus.DISCONNECTED.value == "disconnected"
        assert ConnectionStatus.CONNECTING.value == "connecting"
        assert ConnectionStatus.CONNECTED.value == "connected"
        assert ConnectionStatus.RECONNECTING.value == "reconnecting"
        assert ConnectionStatus.ERROR.value == "error"


class TestConnectionType:
    """Test ConnectionType enum."""

    def test_all_types_exist(self):
        assert ConnectionType.OPENCLAW.value == "openclaw"
        assert ConnectionType.CLAUDE_CODE.value == "claude_code"
        assert ConnectionType.CODEX.value == "codex"


class TestSessionInfo:
    """Test SessionInfo dataclass."""

    def test_basic_session_info(self):
        session = SessionInfo(
            key="agent:main:main",
            session_id="sess-123",
            source="openclaw",
            connection_id="conn-1",
            agent_id="main",
            channel="whatsapp",
            label="Test Session",
            model="claude-sonnet-4",
            status="active",
        )
        assert session.key == "agent:main:main"
        assert session.source == "openclaw"
        assert session.status == "active"

    def test_session_info_to_dict(self):
        session = SessionInfo(
            key="agent:dev:main",
            session_id="sess-456",
            source="openclaw",
            connection_id="conn-1",
            metadata={"extra": "data"},
        )
        d = session.to_dict()
        assert d["key"] == "agent:dev:main"
        assert d["sessionId"] == "sess-456"
        assert d["source"] == "openclaw"
        assert d["connectionId"] == "conn-1"
        # Metadata is flattened
        assert d["extra"] == "data"

    def test_session_info_defaults(self):
        session = SessionInfo(
            key="test",
            session_id="s1",
            source="test",
            connection_id="c1",
        )
        assert session.agent_id == "main"
        assert session.status == "unknown"
        assert session.metadata == {}

    def test_session_info_standard_fields_override_metadata(self):
        """Standard fields take precedence over metadata keys."""
        session = SessionInfo(
            key="agent:main:main",
            session_id="sess-1",
            source="openclaw",
            connection_id="c1",
            status="active",
            metadata={"status": "overridden", "custom_field": "value"},
        )
        d = session.to_dict()
        assert d["status"] == "active"  # Standard wins
        assert d["custom_field"] == "value"


class TestHistoryMessage:
    """Test HistoryMessage dataclass."""

    def test_basic_message(self):
        msg = HistoryMessage(
            role="user",
            content="Hello world",
            timestamp=1234567890000,
        )
        assert msg.role == "user"
        assert msg.content == "Hello world"

    def test_message_to_dict(self):
        msg = HistoryMessage(
            role="assistant",
            content="Hi there!",
            metadata={"model": "sonnet"},
        )
        d = msg.to_dict()
        assert d["role"] == "assistant"
        assert d["content"] == "Hi there!"
        assert d["metadata"]["model"] == "sonnet"


class TestAgentConnection:
    """Test AgentConnection base class behavior."""

    def _make_connection(self, **kwargs):
        defaults = {
            "connection_id": "test-1",
            "name": "Test Connection",
            "connection_type": ConnectionType.OPENCLAW,
            "config": {},
        }
        defaults.update(kwargs)
        return ConcreteConnection(**defaults)

    def test_initial_status_is_disconnected(self):
        conn = self._make_connection()
        assert conn.status == ConnectionStatus.DISCONNECTED
        assert conn.is_connected() is False

    @pytest.mark.asyncio
    async def test_connect_sets_connected(self):
        conn = self._make_connection()
        result = await conn.connect()
        assert result is True
        assert conn.status == ConnectionStatus.CONNECTED
        assert conn.is_connected() is True

    @pytest.mark.asyncio
    async def test_disconnect_sets_disconnected(self):
        conn = self._make_connection()
        await conn.connect()
        await conn.disconnect()
        assert conn.status == ConnectionStatus.DISCONNECTED

    @pytest.mark.asyncio
    async def test_connect_failure_sets_error(self):
        conn = self._make_connection()
        conn._connect_success = False
        result = await conn.connect()
        assert result is False
        assert conn.status == ConnectionStatus.ERROR
        assert conn.error_message == "Failed"

    @pytest.mark.asyncio
    async def test_default_health_check(self):
        conn = self._make_connection()
        assert await conn.health_check() is False

        await conn.connect()
        assert await conn.health_check() is True

    @pytest.mark.asyncio
    async def test_send_message_not_implemented(self):
        conn = self._make_connection()
        with pytest.raises(NotImplementedError):
            await conn.send_message("key", "msg")

    @pytest.mark.asyncio
    async def test_kill_session_not_implemented(self):
        conn = self._make_connection()
        with pytest.raises(NotImplementedError):
            await conn.kill_session("key")

    def test_status_change_callback(self):
        conn = self._make_connection()
        callback = MagicMock()
        conn.on_status_change(callback)

        conn.status = ConnectionStatus.CONNECTED
        callback.assert_called_once_with(conn, ConnectionStatus.CONNECTED)

    def test_status_change_callback_not_called_on_same_status(self):
        conn = self._make_connection()
        callback = MagicMock()
        conn.on_status_change(callback)

        # Set same status - no callback
        conn.status = ConnectionStatus.DISCONNECTED
        callback.assert_not_called()

    def test_session_update_callback(self):
        conn = self._make_connection()
        callback = MagicMock()
        conn.on_session_update(callback)

        session = SessionInfo(
            key="test",
            session_id="s1",
            source="test",
            connection_id="c1",
        )
        conn._notify_session_update(session)
        callback.assert_called_once_with(session)

    def test_unregister_callbacks(self):
        conn = self._make_connection()
        cb1 = MagicMock()
        cb2 = MagicMock()

        conn.on_session_update(cb1)
        conn.on_status_change(cb2)
        assert cb1 in conn._session_callbacks
        assert cb2 in conn._status_callbacks

        conn.off_session_update(cb1)
        conn.off_status_change(cb2)
        assert cb1 not in conn._session_callbacks
        assert cb2 not in conn._status_callbacks

    def test_repr(self):
        conn = self._make_connection()
        r = repr(conn)
        assert "ConcreteConnection" in r
        assert "test-1" in r
        assert "disconnected" in r
