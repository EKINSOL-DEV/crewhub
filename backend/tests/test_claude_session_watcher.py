"""Tests for ClaudeSessionWatcher."""

# Direct file imports to avoid circular import through __init__.py
import importlib.util as _ilu
import json
import os
import sys
from pathlib import Path

import pytest

_parser_path = os.path.join(
    os.path.dirname(__file__),
    "..",
    "app",
    "services",
    "connections",
    "claude_transcript_parser.py",
)
_watcher_path = os.path.join(
    os.path.dirname(__file__),
    "..",
    "app",
    "services",
    "connections",
    "claude_session_watcher.py",
)

# Load parser
_spec_p = _ilu.spec_from_file_location("_ctp", _parser_path)
_mod_p = _ilu.module_from_spec(_spec_p)
_spec_p.loader.exec_module(_mod_p)

# Patch sys.modules so watcher's relative import works
sys.modules["app.services.connections.claude_transcript_parser"] = _mod_p

# Load watcher - need to handle relative import
_spec_w = _ilu.spec_from_file_location("_csw", _watcher_path)
_mod_w = _ilu.module_from_spec(_spec_w)
# Set package so relative imports resolve
_mod_w.__package__ = "app.services.connections"
_spec_w.loader.exec_module(_mod_w)

ClaudeSessionWatcher = _mod_w.ClaudeSessionWatcher
WatchedSession = _mod_w.WatchedSession
AgentActivity = _mod_p.AgentActivity


@pytest.fixture
def claude_dir(tmp_path):
    projects = tmp_path / "projects"
    projects.mkdir()
    return tmp_path


@pytest.fixture
def watcher(claude_dir):
    return ClaudeSessionWatcher(claude_dir=claude_dir)


def _write_jsonl(path: Path, records: list[dict]):
    with open(path, "w") as f:
        for r in records:
            f.write(json.dumps(r) + "\n")


def test_discover_project_dirs_empty(watcher, claude_dir):
    assert watcher.discover_project_dirs() == []


def test_discover_project_dirs(watcher, claude_dir):
    (claude_dir / "projects" / "proj1").mkdir()
    (claude_dir / "projects" / "proj2").mkdir()
    dirs = watcher.discover_project_dirs()
    assert len(dirs) == 2


def test_discover_sessions(watcher, claude_dir):
    proj = claude_dir / "projects" / "proj1"
    proj.mkdir()
    _write_jsonl(proj / "session1.jsonl", [{"type": "user", "message": {"content": "hi"}}])
    _write_jsonl(proj / "session2.jsonl", [{"type": "user", "message": {"content": "yo"}}])
    sessions = watcher.discover_sessions(proj)
    assert len(sessions) == 2
    ids = {s[0] for s in sessions}
    assert "session1" in ids
    assert "session2" in ids


def test_watch_session(watcher, claude_dir):
    proj = claude_dir / "projects" / "proj1"
    proj.mkdir()
    path = proj / "test.jsonl"
    _write_jsonl(path, [{"type": "user", "message": {"content": "hi"}}])
    watcher.watch_session("test", path)
    assert "test" in watcher.get_watched_sessions()


def test_unwatch_session(watcher, claude_dir):
    proj = claude_dir / "projects" / "proj1"
    proj.mkdir()
    path = proj / "test.jsonl"
    _write_jsonl(path, [])
    watcher.watch_session("test", path)
    watcher.unwatch_session("test")
    assert "test" not in watcher.get_watched_sessions()


def test_read_new_lines(watcher, claude_dir):
    proj = claude_dir / "projects" / "proj1"
    proj.mkdir()
    path = proj / "test.jsonl"
    path.write_text("")

    events_received = []
    watcher.on_events = lambda sid, evts: events_received.extend(evts)
    watcher.watch_session("test", path)

    # Write new data
    with open(path, "a") as f:
        f.write(json.dumps({"type": "user", "message": {"content": "hello"}}) + "\n")

    ws = watcher.get_watched_sessions()["test"]
    watcher._read_new_lines(ws)
    assert len(events_received) == 1


def test_activity_update_tool_use(watcher, claude_dir):
    proj = claude_dir / "projects" / "proj1"
    proj.mkdir()
    path = proj / "test.jsonl"
    path.write_text("")

    activity_changes = []
    watcher.on_activity_change = lambda sid, act: activity_changes.append((sid, act))
    watcher.watch_session("test", path)

    with open(path, "a") as f:
        f.write(
            json.dumps(
                {
                    "type": "assistant",
                    "message": {"content": [{"type": "tool_use", "id": "tu1", "name": "Read", "input": {}}]},
                }
            )
            + "\n"
        )

    ws = watcher.get_watched_sessions()["test"]
    watcher._read_new_lines(ws)
    assert ws.last_activity == AgentActivity.TOOL_USE


def test_activity_update_turn_complete(watcher, claude_dir):
    proj = claude_dir / "projects" / "proj1"
    proj.mkdir()
    path = proj / "test.jsonl"
    path.write_text("")
    watcher.watch_session("test", path)

    with open(path, "a") as f:
        f.write(json.dumps({"type": "system", "subtype": "turn_duration", "durationMs": 1000}) + "\n")

    ws = watcher.get_watched_sessions()["test"]
    watcher._read_new_lines(ws)
    assert ws.last_activity == AgentActivity.WAITING_INPUT


def test_no_read_when_no_new_data(watcher, claude_dir):
    proj = claude_dir / "projects" / "proj1"
    proj.mkdir()
    path = proj / "test.jsonl"
    _write_jsonl(path, [{"type": "user", "message": {"content": "hi"}}])

    events_received = []
    watcher.on_events = lambda sid, evts: events_received.extend(evts)
    watcher.watch_session("test", path)

    ws = watcher.get_watched_sessions()["test"]
    watcher._read_new_lines(ws)
    assert len(events_received) == 0  # offset already at end


def test_watched_session_defaults():
    ws = WatchedSession(session_id="x", jsonl_path=Path("/tmp/x.jsonl"))
    assert ws.last_activity == AgentActivity.IDLE
    assert ws.file_offset == 0
    assert len(ws.pending_tool_uses) == 0
