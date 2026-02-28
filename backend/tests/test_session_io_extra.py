"""Additional coverage for app.services.connections._session_io.

Covers error-logging paths, JSON decode errors, path-traversal guard,
and kill_session branches not hit by test_session_io.py.
"""

from __future__ import annotations

import importlib.util
import sys
import types
from pathlib import Path
from unittest.mock import patch

import pytest

# ─── Module bootstrap (mirrors test_session_io.py) ─────────────────

ROOT = Path(__file__).resolve().parents[1]
CONN_DIR = ROOT / "app" / "services" / "connections"
pkg = types.ModuleType("app.services.connections")
pkg.__path__ = [str(CONN_DIR)]
sys.modules.setdefault("app.services.connections", pkg)


def _load_module(module_name: str, file_path: Path):
    spec = importlib.util.spec_from_file_location(module_name, str(file_path))
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


base_mod = _load_module("app.services.connections.base", CONN_DIR / "base.py")
session_mod = _load_module("app.services.connections._session_io", CONN_DIR / "_session_io.py")

OPENCLAW_DIR = session_mod.OPENCLAW_DIR
OpenClawSessionIOMixin = session_mod.OpenClawSessionIOMixin
SessionInfo = base_mod.SessionInfo


class DummyIO(OpenClawSessionIOMixin):
    def __init__(self, sessions=None, sessions_raw=None):
        self._sessions = sessions or []
        self._sessions_raw = sessions_raw or []

    async def get_sessions(self):
        return self._sessions

    async def get_sessions_raw(self):
        return self._sessions_raw


# ─── _parse_history_message edge cases ───────────────────────────


class TestParseHistoryMessageExtra:
    def test_exception_in_parse_returns_none_and_logs(self):
        """When parsing raises unexpectedly, None is returned and error logged."""
        io = DummyIO()

        # Force an exception by passing an object that crashes on access
        class BadDict(dict):
            def get(self, key, default=None):
                if key == "role":
                    raise RuntimeError("broken dict")
                return super().get(key, default)

        bad = BadDict(role="user", content="hi")
        with patch.object(session_mod, "logger") as mock_logger:
            result = io._parse_history_message(bad)
        assert result is None
        mock_logger.error.assert_called_once()
        assert "Error parsing history message" in mock_logger.error.call_args[0][0]

    def test_content_list_only_text_type_joined(self):
        """List content: only 'text' type blocks contribute to content."""
        io = DummyIO()
        raw = {
            "role": "assistant",
            "content": [
                {"type": "text", "text": "Hello"},
                {"type": "image", "url": "http://img"},  # skipped
                {"type": "text", "text": "World"},
                "raw string",  # also included as-is
            ],
        }
        msg = io._parse_history_message(raw)
        assert msg is not None
        assert "Hello" in msg.content
        assert "World" in msg.content

    def test_content_string_is_preserved(self):
        io = DummyIO()
        raw = {"role": "user", "content": "plain text message", "timestamp": 12345}
        msg = io._parse_history_message(raw)
        assert msg is not None
        assert msg.content == "plain text message"
        assert msg.timestamp == 12345

    def test_metadata_populated_from_extra_keys(self):
        io = DummyIO()
        raw = {"role": "user", "content": "hi", "model": "sonnet", "session_id": "abc"}
        msg = io._parse_history_message(raw)
        assert msg is not None
        assert msg.metadata.get("model") == "sonnet"
        assert msg.metadata.get("session_id") == "abc"


# ─── get_session_history error paths ─────────────────────────────


class TestGetSessionHistoryErrors:
    @pytest.mark.asyncio
    async def test_session_not_found_returns_empty(self):
        io = DummyIO(sessions=[])
        result = await io.get_session_history("agent:dev:nosuchsession")
        assert result == []

    @pytest.mark.asyncio
    async def test_invalid_session_id_returns_empty(self, tmp_path, monkeypatch):
        """Session with invalid characters raises ValueError → returns []."""
        monkeypatch.setattr(Path, "home", lambda: tmp_path)
        io = DummyIO(
            sessions=[
                SessionInfo(
                    key="agent:dev:bad",
                    session_id="../../../etc/passwd",  # path traversal attempt
                    source="o",
                    connection_id="c",
                    agent_id="dev",
                )
            ]
        )
        result = await io.get_session_history("agent:dev:bad")
        assert result == []

    @pytest.mark.asyncio
    async def test_nonexistent_file_returns_empty(self, tmp_path, monkeypatch):
        """When the JSONL file doesn't exist yet, return []."""
        monkeypatch.setattr(Path, "home", lambda: tmp_path)
        io = DummyIO(
            sessions=[
                SessionInfo(
                    key="agent:dev:x",
                    session_id="sid-no-file",
                    source="o",
                    connection_id="c",
                    agent_id="dev",
                )
            ]
        )
        result = await io.get_session_history("agent:dev:x")
        assert result == []

    @pytest.mark.asyncio
    async def test_json_decode_error_lines_are_skipped(self, tmp_path, monkeypatch):
        """Lines that are not valid JSON are silently skipped."""
        monkeypatch.setattr(Path, "home", lambda: tmp_path)
        base = tmp_path / OPENCLAW_DIR / "agents" / "main" / "sessions"
        base.mkdir(parents=True)
        (base / "sid-json-error.jsonl").write_text(
            '{"role":"user","content":"hello"}\nnot-valid-json\n{"role":"assistant","content":"world"}\n'
        )
        io = DummyIO(
            sessions=[
                SessionInfo(
                    key="agent:main:x",
                    session_id="sid-json-error",
                    source="o",
                    connection_id="c",
                    agent_id="main",
                )
            ]
        )
        result = await io.get_session_history("agent:main:x")
        assert len(result) == 2
        assert result[0].content == "hello"
        assert result[1].content == "world"

    @pytest.mark.asyncio
    async def test_limit_applied_to_messages(self, tmp_path, monkeypatch):
        """Limit parameter returns only the last N messages."""
        monkeypatch.setattr(Path, "home", lambda: tmp_path)
        base = tmp_path / OPENCLAW_DIR / "agents" / "main" / "sessions"
        base.mkdir(parents=True)
        lines = "\n".join(f'{{"role":"user","content":"msg{i}"}}' for i in range(10)) + "\n"
        (base / "sid-limit.jsonl").write_text(lines)
        io = DummyIO(
            sessions=[
                SessionInfo(
                    key="agent:main:lim",
                    session_id="sid-limit",
                    source="o",
                    connection_id="c",
                    agent_id="main",
                )
            ]
        )
        result = await io.get_session_history("agent:main:lim", limit=3)
        assert len(result) == 3
        assert result[-1].content == "msg9"


# ─── get_session_history_raw error paths ─────────────────────────


class TestGetSessionHistoryRawErrors:
    @pytest.mark.asyncio
    async def test_session_raw_not_found_returns_empty(self):
        io = DummyIO(sessions_raw=[])
        result = await io.get_session_history_raw("nonexistent:key")
        assert result == []

    @pytest.mark.asyncio
    async def test_session_raw_no_session_id_returns_empty(self):
        io = DummyIO(sessions_raw=[{"key": "some:key"}])  # no sessionId
        result = await io.get_session_history_raw("some:key")
        assert result == []

    @pytest.mark.asyncio
    async def test_session_raw_agent_id_parsed_from_key(self, tmp_path, monkeypatch):
        """Agent ID is parsed from key 'agent:AGENTID:rest'."""
        monkeypatch.setattr(Path, "home", lambda: tmp_path)
        base = tmp_path / OPENCLAW_DIR / "agents" / "dev" / "sessions"
        base.mkdir(parents=True)
        (base / "sid-raw.jsonl").write_text('{"msg": "ok"}\n')

        io = DummyIO(sessions_raw=[{"key": "agent:dev:x", "sessionId": "sid-raw"}])
        result = await io.get_session_history_raw("agent:dev:x")
        assert result == [{"msg": "ok"}]


# ─── kill_session edge cases ─────────────────────────────────────


class TestKillSessionExtra:
    @pytest.mark.asyncio
    async def test_kill_session_no_sessions_returns_true(self):
        """No sessions → kill returns True (session doesn't exist = already dead)."""
        io = DummyIO(sessions=[])
        result = await io.kill_session("agent:main:missing")
        assert result is True

    @pytest.mark.asyncio
    async def test_kill_session_file_not_found_returns_false(self, tmp_path, monkeypatch):
        """Session exists in metadata but file is gone → False."""
        monkeypatch.setattr(Path, "home", lambda: tmp_path)
        # Don't create the file - the kill should return False
        io = DummyIO(
            sessions=[
                SessionInfo(
                    key="agent:main:x",
                    session_id="sid-gone",
                    source="o",
                    connection_id="c",
                    agent_id="main",
                )
            ]
        )
        result = await io.kill_session("agent:main:x")
        # When the file doesn't exist and is not in archive either, returns False
        assert result is False

    @pytest.mark.asyncio
    async def test_kill_session_renames_file(self, tmp_path, monkeypatch):
        """Successfully renames file and returns True."""
        monkeypatch.setattr(Path, "home", lambda: tmp_path)
        base = tmp_path / OPENCLAW_DIR / "agents" / "main" / "sessions"
        base.mkdir(parents=True)
        f = base / "sid-kill.jsonl"
        f.write_text("data")

        io = DummyIO(
            sessions=[
                SessionInfo(
                    key="agent:main:x",
                    session_id="sid-kill",
                    source="o",
                    connection_id="c",
                    agent_id="main",
                )
            ]
        )
        result = await io.kill_session("agent:main:x")
        assert result is True
        assert not f.exists()
        # Renamed file should exist somewhere in sessions dir
        deleted_files = list(base.glob("sid-kill.jsonl.deleted.*"))
        assert len(deleted_files) == 1
