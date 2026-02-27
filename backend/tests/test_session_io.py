from pathlib import Path

import pytest

from app.services.connections._session_io import OPENCLAW_DIR, OpenClawSessionIOMixin, _validate_id
from app.services.connections.base import SessionInfo


class DummySessionIO(OpenClawSessionIOMixin):
    def __init__(self, sessions=None, sessions_raw=None):
        self._sessions = sessions or []
        self._sessions_raw = sessions_raw or []

    async def get_sessions(self):
        return self._sessions

    async def get_sessions_raw(self):
        return self._sessions_raw


def test_validate_id_rejects_unsafe():
    assert _validate_id("abc_123-x") == "abc_123-x"
    with pytest.raises(ValueError):
        _validate_id("../etc")


@pytest.mark.asyncio
async def test_get_session_history_parses_jsonl(monkeypatch, tmp_path):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    base = tmp_path / OPENCLAW_DIR / "agents" / "dev" / "sessions"
    base.mkdir(parents=True)
    (base / "sid1.jsonl").write_text(
        '{"role":"user","content":"hello","timestamp":1}\n'
        '{"role":"assistant","content":[{"type":"text","text":"world"}],"x":1}\n'
        "not-json\n"
    )

    io = DummySessionIO(
        sessions=[SessionInfo(key="agent:dev:main", session_id="sid1", source="o", connection_id="c", agent_id="dev")]
    )

    msgs = await io.get_session_history("agent:dev:main", limit=10)
    assert len(msgs) == 2
    assert msgs[0].role == "user"
    assert msgs[1].content == "world"
    assert msgs[1].metadata["x"] == 1


@pytest.mark.asyncio
async def test_get_session_history_raw_agent_from_key_and_limit(monkeypatch, tmp_path):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    base = tmp_path / OPENCLAW_DIR / "agents" / "dev" / "sessions"
    base.mkdir(parents=True)
    (base / "sid2.jsonl").write_text('{"a":1}\n{"a":2}\n{"a":3}\n')

    io = DummySessionIO(sessions_raw=[{"key": "agent:dev:test", "sessionId": "sid2"}])
    out = await io.get_session_history_raw("agent:dev:test", limit=2)
    assert out == [{"a": 2}, {"a": 3}]


@pytest.mark.asyncio
async def test_get_session_history_handles_invalid_ids(monkeypatch, tmp_path):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    io = DummySessionIO(
        sessions=[SessionInfo(key="k", session_id="../bad", source="o", connection_id="c", agent_id="dev")]
    )
    assert await io.get_session_history("k") == []


@pytest.mark.asyncio
async def test_kill_session_active_file_renamed(monkeypatch, tmp_path):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    base = tmp_path / OPENCLAW_DIR / "agents" / "dev" / "sessions"
    base.mkdir(parents=True)
    f = base / "sid3.jsonl"
    f.write_text("x")

    io = DummySessionIO(
        sessions=[SessionInfo(key="agent:dev:k", session_id="sid3", source="o", connection_id="c", agent_id="dev")]
    )
    ok = await io.kill_session("agent:dev:k")
    assert ok is True
    assert not f.exists()
    assert len(list(base.glob("sid3.jsonl.deleted.*"))) == 1


@pytest.mark.asyncio
async def test_kill_session_not_active_or_in_archive(monkeypatch, tmp_path):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    io = DummySessionIO(sessions=[])
    assert await io.kill_session("missing") is True

    archive = tmp_path / OPENCLAW_DIR / "agents" / "dev" / "archive"
    archive.mkdir(parents=True)
    (archive / "sid4.jsonl").write_text("x")
    io2 = DummySessionIO(
        sessions=[SessionInfo(key="agent:dev:x", session_id="sid4", source="o", connection_id="c", agent_id="dev")]
    )
    assert await io2.kill_session("agent:dev:x") is True


def test_parse_history_message_edge_cases():
    io = DummySessionIO()
    assert io._parse_history_message({"content": "x"}) is None

    msg = io._parse_history_message({"role": "assistant", "content": ["a", {"type": "text", "text": "b"}]})
    assert msg.content == "a\nb"
