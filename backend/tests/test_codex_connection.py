"""Tests for app.services.connections.codex — CodexConnection (stub)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import app.main  # noqa: F401
from app.services.connections.base import ConnectionStatus, ConnectionType
from app.services.connections.codex import CodexConnection

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_conn(**overrides) -> CodexConnection:
    cfg = {"data_dir": "~/.codex", "cli_path": "codex", **overrides}
    return CodexConnection(connection_id="codex-1", name="test-codex", config=cfg)


# ---------------------------------------------------------------------------
# __init__
# ---------------------------------------------------------------------------


class TestInit:
    def test_defaults(self):
        conn = CodexConnection(connection_id="c1", name="codex", config={})
        assert conn.data_dir == "~/.codex"
        assert conn.cli_path == "codex"
        assert conn.connection_type == ConnectionType.CODEX
        assert conn.is_connected() is False

    def test_custom_config(self):
        conn = CodexConnection(
            connection_id="c1",
            name="codex",
            config={"data_dir": "/custom/dir", "cli_path": "/usr/bin/codex"},
        )
        assert conn.data_dir == "/custom/dir"
        assert conn.cli_path == "/usr/bin/codex"

    def test_none_config_uses_defaults(self):
        conn = CodexConnection(connection_id="c1", name="codex", config=None)
        assert conn.data_dir == "~/.codex"
        assert conn.cli_path == "codex"

    def test_connection_id_and_name(self):
        conn = _make_conn()
        assert conn.connection_id == "codex-1"
        assert conn.name == "test-codex"

    def test_initial_status_disconnected(self):
        conn = _make_conn()
        assert conn.status == ConnectionStatus.DISCONNECTED


# ---------------------------------------------------------------------------
# connect()
# ---------------------------------------------------------------------------


class TestConnect:
    @pytest.mark.asyncio
    async def test_connect_success(self):
        conn = _make_conn()
        mock_proc = MagicMock()
        mock_proc.returncode = 0
        mock_proc.communicate = AsyncMock(return_value=(b"codex 1.0.0", b""))

        with patch("asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=mock_proc):
            with patch("asyncio.wait_for", new_callable=AsyncMock, return_value=(b"codex 1.0.0", b"")):
                result = await conn.connect()

        assert result is True
        assert conn.status == ConnectionStatus.CONNECTED

    @pytest.mark.asyncio
    async def test_connect_cli_error_returncode(self):
        conn = _make_conn()
        mock_proc = MagicMock()
        mock_proc.returncode = 1
        mock_proc.communicate = AsyncMock(return_value=(b"", b"error: not found"))

        with patch("asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=mock_proc):
            with patch("asyncio.wait_for", new_callable=AsyncMock, return_value=(b"", b"error: not found")):
                result = await conn.connect()

        assert result is False
        assert conn.status == ConnectionStatus.ERROR

    @pytest.mark.asyncio
    async def test_connect_file_not_found(self):
        conn = _make_conn()
        with patch("asyncio.create_subprocess_exec", side_effect=FileNotFoundError):
            result = await conn.connect()

        assert result is False
        assert conn.status == ConnectionStatus.ERROR
        assert "not found" in (conn.error_message or "").lower()

    @pytest.mark.asyncio
    async def test_connect_timeout(self):
        conn = _make_conn()
        with patch("asyncio.create_subprocess_exec", new_callable=AsyncMock):
            with patch("asyncio.wait_for", side_effect=TimeoutError):
                result = await conn.connect()

        assert result is False
        assert conn.status == ConnectionStatus.ERROR
        assert "timed out" in (conn.error_message or "").lower()

    @pytest.mark.asyncio
    async def test_connect_generic_exception(self):
        conn = _make_conn()
        with patch("asyncio.create_subprocess_exec", side_effect=Exception("unexpected error")):
            result = await conn.connect()

        assert result is False
        assert conn.status == ConnectionStatus.ERROR
        assert "unexpected error" in (conn.error_message or "")

    @pytest.mark.asyncio
    async def test_connect_sets_connecting_first(self):
        """Status should pass through CONNECTING before CONNECTED."""
        conn = _make_conn()
        statuses = []
        original_setter = type(conn).status.fset

        def track_status(self, val):
            statuses.append(val)
            original_setter(self, val)

        type(conn).status = property(type(conn).status.fget, track_status)

        mock_proc = MagicMock()
        mock_proc.returncode = 0
        with patch("asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=mock_proc):
            with patch("asyncio.wait_for", new_callable=AsyncMock, return_value=(b"1.0", b"")):
                await conn.connect()

        assert ConnectionStatus.CONNECTING in statuses


# ---------------------------------------------------------------------------
# disconnect()
# ---------------------------------------------------------------------------


class TestDisconnect:
    @pytest.mark.asyncio
    async def test_disconnect_sets_disconnected(self):
        conn = _make_conn()
        conn._status = ConnectionStatus.CONNECTED
        await conn.disconnect()
        assert conn.status == ConnectionStatus.DISCONNECTED

    @pytest.mark.asyncio
    async def test_disconnect_when_already_disconnected(self):
        conn = _make_conn()
        await conn.disconnect()
        assert conn.status == ConnectionStatus.DISCONNECTED


# ---------------------------------------------------------------------------
# get_sessions()
# ---------------------------------------------------------------------------


class TestGetSessions:
    @pytest.mark.asyncio
    async def test_returns_empty_when_not_connected(self):
        conn = _make_conn()
        result = await conn.get_sessions()
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_stub_when_connected(self):
        conn = _make_conn()
        conn._status = ConnectionStatus.CONNECTED
        result = await conn.get_sessions()
        assert result == []


# ---------------------------------------------------------------------------
# get_session_history()
# ---------------------------------------------------------------------------


class TestGetSessionHistory:
    @pytest.mark.asyncio
    async def test_returns_empty_when_not_connected(self):
        conn = _make_conn()
        result = await conn.get_session_history("session-1")
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_stub_when_connected(self):
        conn = _make_conn()
        conn._status = ConnectionStatus.CONNECTED
        result = await conn.get_session_history("session-1", limit=10)
        assert result == []


# ---------------------------------------------------------------------------
# get_status()
# ---------------------------------------------------------------------------


class TestGetStatus:
    @pytest.mark.asyncio
    async def test_get_status_structure(self):
        conn = _make_conn()
        status = await conn.get_status()
        assert status["connection_id"] == "codex-1"
        assert status["name"] == "test-codex"
        assert status["type"] == "codex"
        assert status["implementation"] == "stub"
        assert "note" in status

    @pytest.mark.asyncio
    async def test_get_status_data_dir(self):
        conn = _make_conn(data_dir="/custom/path")
        status = await conn.get_status()
        assert status["data_dir"] == "/custom/path"

    @pytest.mark.asyncio
    async def test_get_status_reflects_status(self):
        conn = _make_conn()
        conn._status = ConnectionStatus.CONNECTED
        status = await conn.get_status()
        assert status["status"] == "connected"


# ---------------------------------------------------------------------------
# send_message()
# ---------------------------------------------------------------------------


class TestSendMessage:
    @pytest.mark.asyncio
    async def test_send_message_raises_not_implemented(self):
        conn = _make_conn()
        conn._status = ConnectionStatus.CONNECTED
        with pytest.raises(NotImplementedError, match="send_message"):
            await conn.send_message("session-1", "hello")


# ---------------------------------------------------------------------------
# kill_session()
# ---------------------------------------------------------------------------


class TestKillSession:
    @pytest.mark.asyncio
    async def test_kill_session_returns_false(self):
        conn = _make_conn()
        result = await conn.kill_session("session-1")
        assert result is False


# ---------------------------------------------------------------------------
# health_check()
# ---------------------------------------------------------------------------


class TestHealthCheck:
    @pytest.mark.asyncio
    async def test_health_check_not_connected(self):
        conn = _make_conn()
        result = await conn.health_check()
        assert result is False

    @pytest.mark.asyncio
    async def test_health_check_connected_and_responsive(self):
        conn = _make_conn()
        conn._status = ConnectionStatus.CONNECTED

        mock_proc = MagicMock()
        mock_proc.returncode = 0
        mock_proc.wait = AsyncMock(return_value=0)

        with patch("asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=mock_proc):
            with patch("asyncio.wait_for", new_callable=AsyncMock, return_value=0):
                result = await conn.health_check()

        assert result is True

    @pytest.mark.asyncio
    async def test_health_check_connected_but_cli_fails(self):
        conn = _make_conn()
        conn._status = ConnectionStatus.CONNECTED

        mock_proc = MagicMock()
        mock_proc.returncode = 1
        mock_proc.wait = AsyncMock(return_value=1)

        with patch("asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=mock_proc):
            with patch("asyncio.wait_for", new_callable=AsyncMock, return_value=1):
                result = await conn.health_check()

        assert result is False

    @pytest.mark.asyncio
    async def test_health_check_exception_returns_false(self):
        conn = _make_conn()
        conn._status = ConnectionStatus.CONNECTED

        with patch("asyncio.create_subprocess_exec", side_effect=Exception("boom")):
            result = await conn.health_check()

        assert result is False

    @pytest.mark.asyncio
    async def test_health_check_timeout_returns_false(self):
        conn = _make_conn()
        conn._status = ConnectionStatus.CONNECTED

        with patch("asyncio.create_subprocess_exec", new_callable=AsyncMock):
            with patch("asyncio.wait_for", side_effect=TimeoutError):
                result = await conn.health_check()

        assert result is False
