"""Tests for the ConnectionManager service."""

from unittest.mock import MagicMock

import pytest

# Import through main app to resolve circular imports
import app.main  # noqa: F401
from app.services.connections.base import (
    AgentConnection,
    ConnectionStatus,
    ConnectionType,
)
from app.services.connections.connection_manager import ConnectionManager


class MockConnection(AgentConnection):
    """Mock connection for testing."""

    def __init__(self, connection_id="mock-1", name="Mock Connection", config=None):
        super().__init__(
            connection_id=connection_id,
            name=name,
            connection_type=ConnectionType.OPENCLAW,
            config=config or {},
        )
        self._connect_result = True
        self._sessions = []
        self._history = []

    async def connect(self) -> bool:
        if self._connect_result:
            self.status = ConnectionStatus.CONNECTED
        else:
            self._set_error("Connection failed")
        return self._connect_result

    async def disconnect(self) -> None:
        self.status = ConnectionStatus.DISCONNECTED

    async def get_sessions(self) -> list:
        return self._sessions

    async def get_session_history(self, session_key: str, limit: int = 50) -> list:
        return self._history

    async def get_status(self) -> dict:
        return {"status": self.status.value}

    async def health_check(self) -> bool:
        return self.is_connected()


@pytest.fixture
def manager():
    """Create a fresh ConnectionManager (not singleton)."""
    return ConnectionManager()


@pytest.fixture
def mock_conn():
    """Create a mock connection."""
    return MockConnection()


@pytest.mark.asyncio
async def test_add_connection(manager):
    """Test adding a connection to the manager."""
    conn = await manager.add_connection(
        connection_id="test-1",
        connection_type="openclaw",
        config={"url": "ws://localhost:18789"},
        name="Test Connection",
    )
    assert conn is not None
    assert manager.get_connection("test-1") is not None


@pytest.mark.asyncio
async def test_add_duplicate_connection(manager):
    """Test that adding a duplicate connection raises ValueError."""
    await manager.add_connection(
        connection_id="dup-1",
        connection_type="openclaw",
        config={},
    )
    with pytest.raises(ValueError, match="already exists"):
        await manager.add_connection(
            connection_id="dup-1",
            connection_type="openclaw",
            config={},
        )


@pytest.mark.asyncio
async def test_remove_connection(manager):
    """Test removing a connection."""
    await manager.add_connection(
        connection_id="remove-1",
        connection_type="codex",
        config={},
    )
    result = await manager.remove_connection("remove-1")
    assert result is True
    assert manager.get_connection("remove-1") is None


@pytest.mark.asyncio
async def test_remove_nonexistent_connection(manager):
    """Test removing a non-existent connection returns False."""
    result = await manager.remove_connection("nonexistent")
    assert result is False


@pytest.mark.asyncio
async def test_list_connections(manager):
    """Test listing all connections."""
    await manager.add_connection("c1", "openclaw", {}, name="Conn 1")
    await manager.add_connection("c2", "codex", {}, name="Conn 2")

    connections = manager.list_connections()
    assert len(connections) == 2
    ids = {c["id"] for c in connections}
    assert "c1" in ids
    assert "c2" in ids


@pytest.mark.asyncio
async def test_get_all_sessions(manager):
    """Test aggregating sessions from all connected sources."""
    sessions = await manager.get_all_sessions()
    assert sessions == []  # No connected sources


@pytest.mark.asyncio
async def test_connection_types(manager):
    """Test that all connection types can be created."""
    for conn_type in ["openclaw", "claude_code", "codex"]:
        conn = await manager.add_connection(
            connection_id=f"type-{conn_type}",
            connection_type=conn_type,
            config={},
        )
        assert conn is not None


@pytest.mark.asyncio
async def test_invalid_connection_type(manager):
    """Test that invalid connection type raises ValueError."""
    with pytest.raises(ValueError, match="Unknown connection type"):
        await manager.add_connection(
            connection_id="invalid",
            connection_type="invalid_type",
            config={},
        )


@pytest.mark.asyncio
async def test_session_callbacks(manager):
    """Test session update callback registration."""
    callback = MagicMock()
    manager.on_session_update(callback)
    assert callback in manager._session_callbacks

    manager.off_session_update(callback)
    assert callback not in manager._session_callbacks


@pytest.mark.asyncio
async def test_status_callbacks(manager):
    """Test connection status change callback registration."""
    callback = MagicMock()
    manager.on_connection_status_change(callback)
    assert callback in manager._status_callbacks

    manager.off_connection_status_change(callback)
    assert callback not in manager._status_callbacks


@pytest.mark.asyncio
async def test_get_default_openclaw_none(manager):
    """Test get_default_openclaw returns None when no OpenClaw connections exist."""
    result = manager.get_default_openclaw()
    assert result is None


@pytest.mark.asyncio
async def test_kill_session_no_connections(manager):
    """Test kill_session returns False when no connections exist."""
    result = await manager.kill_session("some-key")
    assert result is False


@pytest.mark.asyncio
async def test_send_message_no_connections(manager):
    """Test send_message returns None when no connections exist."""
    result = await manager.send_message("some-key", "hello")
    assert result is None


@pytest.mark.asyncio
async def test_get_connections_dict(manager):
    """Test get_connections returns a dict copy."""
    await manager.add_connection("gc1", "openclaw", {})
    conns = manager.get_connections()
    assert isinstance(conns, dict)
    assert "gc1" in conns


@pytest.mark.asyncio
async def test_connect_all(manager):
    """Test connect_all attempts to connect all connections."""
    await manager.add_connection("ca1", "codex", {})
    await manager.add_connection("ca2", "codex", {})
    results = await manager.connect_all()
    assert isinstance(results, dict)
    assert "ca1" in results
    assert "ca2" in results


@pytest.mark.asyncio
async def test_disconnect_all(manager):
    """Test disconnect_all disconnects all connections."""
    await manager.add_connection("da1", "codex", {})
    await manager.disconnect_all()
    # Should not raise


@pytest.mark.asyncio
async def test_reconnect_nonexistent(manager):
    """Test reconnect for non-existent connection returns False."""
    result = await manager.reconnect("nonexistent")
    assert result is False
