"""Additional coverage tests for app.services.connections.base.

Targets the callback error-handling branches and _notify helpers.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import app.main  # noqa: F401
from app.services.connections.base import (
    AgentConnection,
    ConnectionStatus,
    ConnectionType,
    SessionInfo,
)


class ConcreteConnection(AgentConnection):
    """Concrete subclass for testing the abstract base."""

    async def connect(self) -> bool:
        self.status = ConnectionStatus.CONNECTED
        return True

    async def disconnect(self) -> None:
        self.status = ConnectionStatus.DISCONNECTED

    async def get_sessions(self) -> list:
        return []

    async def get_session_history(self, session_key: str, limit: int = 50) -> list:
        return []

    async def get_status(self) -> dict:
        return {"status": self.status.value}


def _make_conn(**kwargs) -> ConcreteConnection:
    defaults = dict(
        connection_id="test-1",
        name="Test",
        connection_type=ConnectionType.OPENCLAW,
        config={},
    )
    defaults.update(kwargs)
    return ConcreteConnection(**defaults)


# ─── Callback error isolation ─────────────────────────────────────


class TestCallbackErrorIsolation:
    """Verify that a crashing callback doesn't propagate and logs the error."""

    def test_session_update_callback_exception_is_logged(self):
        """A session-update callback that raises should log the error."""
        conn = _make_conn()

        def crashing_cb(session):
            raise RuntimeError("boom")

        conn.on_session_update(crashing_cb)
        session = SessionInfo(key="k", session_id="s", source="src", connection_id="c")

        with patch("app.services.connections.base.logger") as mock_logger:
            # Should NOT raise even though callback raises
            conn._notify_session_update(session)
            mock_logger.error.assert_called_once()
            assert "Session callback error" in mock_logger.error.call_args[0][0]

    def test_status_change_callback_exception_is_logged(self):
        """A status-change callback that raises should log the error."""
        conn = _make_conn()

        def crashing_cb(connection, status):
            raise ValueError("oops")

        conn.on_status_change(crashing_cb)

        with patch("app.services.connections.base.logger") as mock_logger:
            conn.status = ConnectionStatus.CONNECTED  # triggers callback
            mock_logger.error.assert_called_once()
            assert "Status callback error" in mock_logger.error.call_args[0][0]

    def test_session_update_bad_callback_does_not_block_good_one(self):
        """Good callback still runs after a bad one crashes."""
        conn = _make_conn()
        good_cb = MagicMock()

        def bad_cb(session):
            raise RuntimeError("bad")

        conn.on_session_update(bad_cb)
        conn.on_session_update(good_cb)
        session = SessionInfo(key="k", session_id="s", source="src", connection_id="c")

        with patch("app.services.connections.base.logger"):
            conn._notify_session_update(session)

        good_cb.assert_called_once_with(session)

    def test_status_change_bad_callback_does_not_block_good_one(self):
        """Good status callback still fires after a crashing one."""
        conn = _make_conn()
        good_cb = MagicMock()

        def bad_cb(connection, status):
            raise RuntimeError("fail")

        conn.on_status_change(bad_cb)
        conn.on_status_change(good_cb)

        with patch("app.services.connections.base.logger"):
            conn.status = ConnectionStatus.CONNECTED

        good_cb.assert_called_once_with(conn, ConnectionStatus.CONNECTED)


# ─── _notify_status_change internal ─────────────────────────────


class TestNotifyStatusChange:
    def test_called_on_status_change(self):
        conn = _make_conn()
        cb = MagicMock()
        conn.on_status_change(cb)

        conn.status = ConnectionStatus.ERROR
        cb.assert_called_once_with(conn, ConnectionStatus.ERROR)

    def test_not_called_when_status_unchanged(self):
        """Callback not fired when status doesn't actually change."""
        conn = _make_conn()
        cb = MagicMock()
        conn.on_status_change(cb)
        conn.status = ConnectionStatus.DISCONNECTED  # same as default
        cb.assert_not_called()

    def test_multiple_callbacks_all_called(self):
        conn = _make_conn()
        cb1, cb2, cb3 = MagicMock(), MagicMock(), MagicMock()
        for cb in (cb1, cb2, cb3):
            conn.on_status_change(cb)

        conn.status = ConnectionStatus.CONNECTED
        for cb in (cb1, cb2, cb3):
            cb.assert_called_once()


# ─── _notify_session_update internal ────────────────────────────


class TestNotifySessionUpdate:
    def test_multiple_session_callbacks_all_called(self):
        conn = _make_conn()
        cb1, cb2 = MagicMock(), MagicMock()
        conn.on_session_update(cb1)
        conn.on_session_update(cb2)

        session = SessionInfo(key="k", session_id="s1", source="src", connection_id="c")
        conn._notify_session_update(session)

        cb1.assert_called_once_with(session)
        cb2.assert_called_once_with(session)

    def test_no_callbacks_no_error(self):
        conn = _make_conn()
        session = SessionInfo(key="k", session_id="s", source="src", connection_id="c")
        conn._notify_session_update(session)  # should not raise


# ─── _set_error ───────────────────────────────────────────────────


class TestSetError:
    def test_set_error_updates_message_and_status(self):
        conn = _make_conn()
        conn._set_error("something went wrong")
        assert conn.error_message == "something went wrong"
        assert conn.status == ConnectionStatus.ERROR

    def test_set_error_overwrites_previous_message(self):
        conn = _make_conn()
        conn._set_error("first error")
        conn._set_error("second error")
        assert conn.error_message == "second error"


# ─── error_message property ──────────────────────────────────────


class TestErrorMessageProperty:
    def test_initial_error_message_is_none(self):
        conn = _make_conn()
        assert conn.error_message is None

    def test_error_message_after_set_error(self):
        conn = _make_conn()
        conn._set_error("test error")
        assert conn.error_message == "test error"
