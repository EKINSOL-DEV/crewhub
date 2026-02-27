import importlib.util
import sys
import types
from pathlib import Path

import pytest


def _load_module(module_name: str, file_path: Path):
    spec = importlib.util.spec_from_file_location(module_name, str(file_path))
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


ROOT = Path(__file__).resolve().parents[1]
CONN_DIR = ROOT / "app" / "services" / "connections"
pkg = types.ModuleType("app.services.connections")
pkg.__path__ = [str(CONN_DIR)]
sys.modules.setdefault("app.services.connections", pkg)

base_mod = _load_module("app.services.connections.base", CONN_DIR / "base.py")
session_mod = _load_module("app.services.connections._session_io", CONN_DIR / "_session_io.py")

OPENCLAW_DIR = session_mod.OPENCLAW_DIR
OpenClawSessionIOMixin = session_mod.OpenClawSessionIOMixin
_validate_id = session_mod._validate_id
SessionInfo = base_mod.SessionInfo


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
    assert msgs[1].content == "world"


@pytest.mark.asyncio
async def test_get_session_history_raw_and_kill(monkeypatch, tmp_path):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    base = tmp_path / OPENCLAW_DIR / "agents" / "dev" / "sessions"
    base.mkdir(parents=True)
    f = base / "sid2.jsonl"
    f.write_text('{"a":1}\n{"a":2}\n')

    io = DummySessionIO(
        sessions=[SessionInfo(key="agent:dev:x", session_id="sid2", source="o", connection_id="c", agent_id="dev")],
        sessions_raw=[{"key": "agent:dev:x", "sessionId": "sid2"}],
    )

    raw = await io.get_session_history_raw("agent:dev:x", limit=1)
    assert raw == [{"a": 2}]

    ok = await io.kill_session("agent:dev:x")
    assert ok is True
    assert not f.exists()


@pytest.mark.asyncio
async def test_history_and_kill_fallback_paths(monkeypatch, tmp_path):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)

    io = DummySessionIO(sessions=[])
    assert await io.get_session_history("missing") == []
    assert await io.get_session_history_raw("missing") == []
    assert await io.kill_session("missing") is True

    archive = tmp_path / OPENCLAW_DIR / "agents" / "dev" / "archive"
    archive.mkdir(parents=True)
    (archive / "sid9.jsonl").write_text("x")
    io2 = DummySessionIO(
        sessions=[SessionInfo(key="agent:dev:arch", session_id="sid9", source="o", connection_id="c", agent_id="dev")]
    )
    assert await io2.kill_session("agent:dev:arch") is True


def test_parse_history_message_edge_cases():
    io = DummySessionIO()
    assert io._parse_history_message({"content": "x"}) is None
    msg = io._parse_history_message({"role": "assistant", "content": ["a", {"type": "text", "text": "b"}]})
    assert msg.content == "a\nb"
