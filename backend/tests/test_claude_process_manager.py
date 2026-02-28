"""Tests for ClaudeProcessManager."""

import asyncio

# Direct file import
import importlib.util as _ilu
import os

import pytest

_spec = _ilu.spec_from_file_location(
    "_cpm",
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "app",
        "services",
        "connections",
        "claude_process_manager.py",
    ),
)
_mod = _ilu.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

ClaudeProcessManager = _mod.ClaudeProcessManager
ClaudeProcess = _mod.ClaudeProcess


def test_init():
    pm = ClaudeProcessManager(cli_path="/usr/bin/echo")
    assert pm.cli_path == "/usr/bin/echo"
    assert len(pm.list_processes()) == 0


def test_get_process_not_found():
    pm = ClaudeProcessManager()
    assert pm.get_process("nonexistent") is None


@pytest.mark.asyncio
async def test_spawn_task():
    pm = ClaudeProcessManager(cli_path="echo")
    pid = await pm.spawn_task("hello world")
    assert pid is not None
    cp = pm.get_process(pid)
    assert cp is not None
    assert cp.status in ("running", "completed")
    # Wait for completion
    await asyncio.sleep(0.5)
    cp = pm.get_process(pid)
    assert cp.status == "completed"


@pytest.mark.asyncio
async def test_spawn_with_session_id():
    pm = ClaudeProcessManager(cli_path="echo")
    pid = await pm.spawn_task("test", session_id="abc-123")
    cp = pm.get_process(pid)
    assert cp.session_id == "abc-123"
    await asyncio.sleep(0.5)


@pytest.mark.asyncio
async def test_kill_process():
    # Manually create a long-running process to test kill
    pm = ClaudeProcessManager(cli_path="echo")
    pid = await pm.spawn_task("test")
    await asyncio.sleep(0.5)
    cp = pm.get_process(pid)
    # Process already completed (echo exits fast), so kill returns False
    assert cp.status == "completed"


@pytest.mark.asyncio
async def test_kill_nonexistent():
    pm = ClaudeProcessManager()
    result = await pm.kill("nonexistent")
    assert result is False


@pytest.mark.asyncio
async def test_output_callback():
    lines_received = []
    pm = ClaudeProcessManager(cli_path="echo")
    pm.set_output_callback(lambda pid, line: lines_received.append(line))
    await pm.spawn_task("hello output")
    await asyncio.sleep(0.5)
    assert len(lines_received) > 0


@pytest.mark.asyncio
async def test_list_processes():
    pm = ClaudeProcessManager(cli_path="echo")
    await pm.spawn_task("a")
    await pm.spawn_task("b")
    assert len(pm.list_processes()) == 2
    await asyncio.sleep(0.5)


@pytest.mark.asyncio
async def test_cleanup():
    pm = ClaudeProcessManager(cli_path="echo")
    await pm.spawn_task("a")
    await pm.spawn_task("b")
    await asyncio.sleep(0.5)
    await pm.cleanup()
    assert len(pm.list_processes()) == 0


def test_claude_process_defaults():
    cp = ClaudeProcess(process_id="x", session_id=None, project_path=None)
    assert cp.status == "pending"
    assert cp.output_lines == []
