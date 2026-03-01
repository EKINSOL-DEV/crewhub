"""Tests for cc_chat streaming helpers."""

import asyncio
import json
import time
from dataclasses import dataclass
from typing import Optional
from unittest.mock import patch

import pytest

from app.services.cc_chat import (
    STREAM_TOTAL_TIMEOUT,
    _agent_sessions,
    _make_output_parser,
    _stream_process,
    stream_cc_discovered_response,
    stream_cc_response,
)
import app.services.cc_chat as _mod


# ── Fake process for mocking ─────────────────────────────────────


@dataclass
class FakeProcess:
    process_id: str = "proc-1"
    session_id: Optional[str] = None
    project_path: Optional[str] = None
    status: str = "running"
    result_session_id: Optional[str] = None


class FakePM:
    """Minimal mock of ClaudeProcessManager."""

    def __init__(self):
        self._process = FakeProcess()
        self._callback = None
        self.killed = False

    async def spawn_task(self, **kwargs):
        return self._process.process_id

    def set_process_callback(self, pid, cb):
        self._callback = cb

    def remove_process_callback(self, pid):
        self._callback = None

    def get_process(self, pid):
        return self._process

    async def kill(self, pid):
        self.killed = True
        self._process.status = "killed"
        return True


# ── Tests ────────────────────────────────────────────────────────


def test_output_parser_handles_text_delta():
    """_make_output_parser extracts text from content_block_delta events."""
    queue = asyncio.Queue()
    parser = _make_output_parser(queue)
    line = json.dumps({
        "type": "content_block_delta",
        "delta": {"type": "text_delta", "text": "hello"},
    })
    parser("proc-1", line)
    assert queue.get_nowait() == "hello"


def test_output_parser_handles_assistant():
    """_make_output_parser extracts text from assistant events."""
    queue = asyncio.Queue()
    parser = _make_output_parser(queue)
    line = json.dumps({
        "type": "assistant",
        "message": {"content": [{"type": "text", "text": "world"}]},
    })
    parser("proc-1", line)
    assert queue.get_nowait() == "world"


def test_output_parser_handles_error_events():
    """Error type events push error text to the queue."""
    queue = asyncio.Queue()
    parser = _make_output_parser(queue)

    # dict-style error
    line = json.dumps({"type": "error", "error": {"message": "something broke"}})
    parser("proc-1", line)
    assert queue.get_nowait() == "[Error: something broke]"

    # string-style error
    line2 = json.dumps({"type": "error", "error": "plain text error"})
    parser("proc-1", line2)
    assert queue.get_nowait() == "[Error: plain text error]"


def test_output_parser_handles_result_is_error():
    """Result events with is_error=true surface the error."""
    queue = asyncio.Queue()
    parser = _make_output_parser(queue, agent_id="a1")
    line = json.dumps({
        "type": "result",
        "is_error": True,
        "error": "process crashed",
        "session_id": "s1",
    })
    parser("proc-1", line)
    assert queue.get_nowait() == "[Error: process crashed]"
    # session_id should still be captured
    assert _agent_sessions.get("a1") == "s1"


def test_output_parser_captures_session_id():
    """Result type updates _agent_sessions when agent_id is provided."""
    queue = asyncio.Queue()
    # Clear any previous state
    _agent_sessions.pop("agent-42", None)

    parser = _make_output_parser(queue, agent_id="agent-42")
    line = json.dumps({"type": "result", "session_id": "sess-abc"})
    parser("proc-1", line)

    assert _agent_sessions["agent-42"] == "sess-abc"
    assert queue.empty()  # no error text pushed for a normal result


def test_output_parser_ignores_invalid_json():
    """Invalid JSON lines are silently ignored."""
    queue = asyncio.Queue()
    parser = _make_output_parser(queue)
    parser("proc-1", "not json at all")
    assert queue.empty()


@pytest.mark.asyncio
async def test_stream_yields_text():
    """_stream_process yields text chunks from the queue."""
    pm = FakePM()
    queue = asyncio.Queue()
    queue.put_nowait("chunk1")
    queue.put_nowait("chunk2")
    # Mark process as completed so the loop exits after draining
    pm._process.status = "completed"

    chunks = []
    async for chunk in _stream_process(pm, "proc-1", queue):
        chunks.append(chunk)

    assert chunks == ["chunk1", "chunk2"]


@pytest.mark.asyncio
async def test_stream_timeout():
    """Verify timeout error after STREAM_TOTAL_TIMEOUT limit."""
    pm = FakePM()
    queue = asyncio.Queue()

    # Patch time.monotonic so the loop immediately exceeds the timeout
    call_count = 0

    def fake_monotonic():
        nonlocal call_count
        call_count += 1
        if call_count <= 1:
            return 0.0  # start_time
        return STREAM_TOTAL_TIMEOUT + 1  # second call -> expired

    chunks = []
    with patch.object(_mod.time, "monotonic", side_effect=fake_monotonic):
        async for chunk in _stream_process(pm, "proc-1", queue):
            chunks.append(chunk)

    assert any("timeout" in c.lower() for c in chunks)


@pytest.mark.asyncio
async def test_stream_kills_process_on_disconnect():
    """Verify kill is called in finally when process is still running."""
    pm = FakePM()
    queue = asyncio.Queue()
    # Simulate disconnect: process stays "running", but we break out
    pm._process.status = "completed"

    # Override get_process so it returns "running" during finally
    original_get = pm.get_process
    call_idx = 0

    def patched_get(pid):
        nonlocal call_idx
        call_idx += 1
        proc = original_get(pid)
        # After the loop exits (completed), make finally see "running"
        if call_idx > 1:
            proc.status = "running"
        return proc

    pm.get_process = patched_get

    chunks = []
    async for chunk in _stream_process(pm, "proc-1", queue):
        chunks.append(chunk)

    assert pm.killed


@pytest.mark.asyncio
async def test_stream_no_project_path_error():
    """stream_cc_response yields error when no project_path configured."""
    async def fake_get_agent_config(agent_id):
        return {"project_path": None, "permission_mode": "default", "default_model": None}

    with patch.object(_mod, "get_agent_config", side_effect=fake_get_agent_config):
        chunks = []
        async for chunk in stream_cc_response("agent-1", "hello"):
            chunks.append(chunk)

    assert chunks == ["[Error: No project_path configured for this agent]"]


@pytest.mark.asyncio
async def test_discovered_response_wrapper():
    """stream_cc_discovered_response works as a thin wrapper."""
    pm = FakePM()

    async def mock_stream(pm_arg, pid, queue):
        yield "discovered-chunk"

    with patch.object(_mod, "_get_process_manager", return_value=pm), \
         patch.object(_mod, "_stream_process", side_effect=mock_stream):
        chunks = []
        async for chunk in stream_cc_discovered_response("sess-1", "/tmp/proj", "hi"):
            chunks.append(chunk)

    assert chunks == ["discovered-chunk"]
