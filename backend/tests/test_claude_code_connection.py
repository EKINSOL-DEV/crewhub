"""Tests for app.services.connections.claude_code — ClaudeCodeConnection (stub)."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import app.main  # noqa: F401
from app.services.connections.base import ConnectionStatus, ConnectionType
from app.services.connections.claude_code import ClaudeCodeConnection

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_conn(**overrides) -> ClaudeCodeConnection:
    cfg = {"data_dir": "~/.claude", "cli_path": "claude", **overrides}
    return ClaudeCodeConnection(connection_id="claude-1", name="test-claude", config=cfg)


# ---------------------------------------------------------------------------
# __init__
# ---------------------------------------------------------------------------


class TestInit:
    def test_defaults(self):
        conn = ClaudeCodeConnection(connection_id="c1", name="claude", config={})
        assert conn.data_dir == "~/.claude"
        assert conn.cli_path == "claude"
        assert conn.connection_type == ConnectionType.CLAUDE_CODE
        assert conn.is_connected() is False

    def test_custom_config(self):
        conn = ClaudeCodeConnection(
            connection_id="c1",
            name="claude",
            config={"data_dir": "/custom/.claude", "cli_path": "/usr/local/bin/claude"},
        )
        assert conn.data_dir == "/custom/.claude"
        assert conn.cli_path == "/usr/local/bin/claude"

    def test_none_config_uses_defaults(self):
        conn = ClaudeCodeConnection(connection_id="c1", name="claude", config=None)
        assert conn.data_dir == "~/.claude"
        assert conn.cli_path == "claude"

    def test_connection_id_and_name(self):
        conn = _make_conn()
        assert conn.connection_id == "claude-1"
        assert conn.name == "test-claude"

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

        with patch("asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=mock_proc):
            with patch("asyncio.wait_for", new_callable=AsyncMock, return_value=(b"claude 1.0.0", b"")):
                result = await conn.connect()

        assert result is True
        assert conn.status == ConnectionStatus.CONNECTED

    @pytest.mark.asyncio
    async def test_connect_cli_error_returncode(self):
        conn = _make_conn()
        mock_proc = MagicMock()
        mock_proc.returncode = 1

        with patch("asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=mock_proc):
            with patch("asyncio.wait_for", new_callable=AsyncMock, return_value=(b"", b"error: unknown")):
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
        with patch("asyncio.create_subprocess_exec", side_effect=RuntimeError("connection error")):
            result = await conn.connect()

        assert result is False
        assert conn.status == ConnectionStatus.ERROR

    @pytest.mark.asyncio
    async def test_connect_sets_connecting_first(self):
        """Status transitions through CONNECTING before CONNECTED."""
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
        assert ConnectionStatus.CONNECTED in statuses

    @pytest.mark.asyncio
    async def test_connect_uses_custom_cli_path(self):
        conn = ClaudeCodeConnection("c1", "c", config={"cli_path": "/usr/local/bin/claude"})
        captured_args = []

        async def fake_create_subprocess_exec(*args, **kwargs):
            captured_args.extend(args)
            mock_proc = MagicMock()
            mock_proc.returncode = 0
            return mock_proc

        with patch("asyncio.create_subprocess_exec", side_effect=fake_create_subprocess_exec):
            with patch("asyncio.wait_for", new_callable=AsyncMock, return_value=(b"1.0", b"")):
                await conn.connect()

        assert "/usr/local/bin/claude" in captured_args


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

    @pytest.mark.asyncio
    async def test_disconnect_idempotent(self):
        conn = _make_conn()
        await conn.disconnect()
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
        result = await conn.get_session_history("session-1", limit=20)
        assert result == []

    @pytest.mark.asyncio
    async def test_different_session_keys(self):
        conn = _make_conn()
        conn._status = ConnectionStatus.CONNECTED
        for key in ["session-abc", "agent:main:cli", "123"]:
            result = await conn.get_session_history(key)
            assert result == []


# ---------------------------------------------------------------------------
# get_status()
# ---------------------------------------------------------------------------


class TestGetStatus:
    @pytest.mark.asyncio
    async def test_get_status_structure(self):
        conn = _make_conn()
        status = await conn.get_status()
        assert status["connection_id"] == "claude-1"
        assert status["name"] == "test-claude"
        assert status["type"] == "claude_code"
        assert status["implementation"] == "stub"
        assert "note" in status

    @pytest.mark.asyncio
    async def test_get_status_data_dir(self):
        conn = _make_conn(data_dir="/custom/claude")
        status = await conn.get_status()
        assert status["data_dir"] == "/custom/claude"

    @pytest.mark.asyncio
    async def test_get_status_cli_path(self):
        conn = _make_conn(cli_path="/usr/local/bin/claude")
        status = await conn.get_status()
        assert status["cli_path"] == "/usr/local/bin/claude"

    @pytest.mark.asyncio
    async def test_get_status_reflects_connection_status(self):
        conn = _make_conn()
        conn._status = ConnectionStatus.CONNECTED
        status = await conn.get_status()
        assert status["status"] == "connected"

    @pytest.mark.asyncio
    async def test_get_status_when_error(self):
        conn = _make_conn()
        conn._set_error("CLI not found")
        status = await conn.get_status()
        assert status["status"] == "error"


# ---------------------------------------------------------------------------
# send_message()
# ---------------------------------------------------------------------------


class TestSendMessage:
    @pytest.mark.asyncio
    async def test_send_message_raises_not_implemented(self):
        conn = _make_conn()
        with pytest.raises(NotImplementedError, match="send_message"):
            await conn.send_message("session-1", "hello world")

    @pytest.mark.asyncio
    async def test_send_message_raises_regardless_of_connection(self):
        conn = _make_conn()
        conn._status = ConnectionStatus.CONNECTED
        with pytest.raises(NotImplementedError):
            await conn.send_message("session-1", "hi", timeout=5.0)


# ---------------------------------------------------------------------------
# kill_session()
# ---------------------------------------------------------------------------


class TestKillSession:
    @pytest.mark.asyncio
    async def test_kill_session_returns_false(self):
        conn = _make_conn()
        result = await conn.kill_session("session-1")
        assert result is False

    @pytest.mark.asyncio
    async def test_kill_session_returns_false_when_connected(self):
        conn = _make_conn()
        conn._status = ConnectionStatus.CONNECTED
        result = await conn.kill_session("any-session")
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
    async def test_health_check_connected_responsive(self):
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
    async def test_health_check_connected_cli_fails(self):
        conn = _make_conn()
        conn._status = ConnectionStatus.CONNECTED

        mock_proc = MagicMock()
        mock_proc.returncode = 127

        with patch("asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=mock_proc):
            with patch("asyncio.wait_for", new_callable=AsyncMock, return_value=127):
                result = await conn.health_check()

        assert result is False

    @pytest.mark.asyncio
    async def test_health_check_exception_returns_false(self):
        conn = _make_conn()
        conn._status = ConnectionStatus.CONNECTED

        with patch("asyncio.create_subprocess_exec", side_effect=Exception("proc error")):
            result = await conn.health_check()

        assert result is False

    @pytest.mark.asyncio
    async def test_health_check_timeout_returns_false(self):
        conn = _make_conn()
        conn._status = ConnectionStatus.CONNECTED

        with patch("asyncio.create_subprocess_exec", new_callable=AsyncMock):
            with patch("asyncio.wait_for", side_effect=asyncio.TimeoutError):
                result = await conn.health_check()

        assert result is False
