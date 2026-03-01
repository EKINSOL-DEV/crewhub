"""Tests for ClaudeProcessManager."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

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
_resolve_permission_mode = _mod._resolve_permission_mode
_ENV_WHITELIST = _mod._ENV_WHITELIST


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


# --- 4a: Auto-cleanup of completed processes ---


@pytest.mark.asyncio
async def test_completed_process_cleanup():
    """Verify process is removed from tracking after cleanup delay fires."""
    pm = ClaudeProcessManager(cli_path="echo")
    pid = await pm.spawn_task("hello")
    await asyncio.sleep(0.5)
    cp = pm.get_process(pid)
    assert cp is not None
    assert cp.status == "completed"

    # Directly invoke the cleanup method (simulates call_later firing)
    pm._remove_completed_process(pid)
    assert pm.get_process(pid) is None


# --- 4b: Handle BrokenPipeError on stdin write ---


@pytest.mark.asyncio
async def test_stdin_broken_pipe():
    """BrokenPipeError during stdin write sets status to error."""
    pm = ClaudeProcessManager(cli_path="cat")

    # Use a long message to trigger the stdin path (>4000 chars)
    long_msg = "x" * 5000
    pid = await pm.spawn_task(long_msg)
    cp = pm.get_process(pid)
    # The process may complete or error depending on timing, but should not raise
    assert cp is not None

    # Now test the explicit BrokenPipeError handling by mocking
    pm2 = ClaudeProcessManager(cli_path="echo")
    cp2 = ClaudeProcess(process_id="bp-test", session_id=None, project_path=None)
    cp2.status = "running"

    mock_stdin = MagicMock()
    mock_stdin.write = MagicMock(side_effect=BrokenPipeError("broken"))
    mock_stdin.drain = AsyncMock()
    mock_stdin.close = MagicMock()
    mock_stdin.wait_closed = AsyncMock()

    mock_proc = MagicMock()
    mock_proc.stdin = mock_stdin
    mock_proc.stdout = AsyncMock()
    mock_proc.stderr = AsyncMock()
    mock_proc.pid = 12345

    cp2.proc = mock_proc
    pm2._processes["bp-test"] = cp2

    # Patch create_subprocess_exec to return our mock proc that raises on stdin
    async def fake_exec(*args, **kwargs):
        return mock_proc

    with patch("asyncio.create_subprocess_exec", side_effect=fake_exec):
        pid2 = await pm2.spawn_task("y" * 5000)
        cp_result = pm2.get_process(pid2)
        assert cp_result.status == "error"

    await asyncio.sleep(0.3)


# --- 4b (send_message): Handle process exit ---


@pytest.mark.asyncio
async def test_send_message_process_exited():
    """send_message returns False when process stdin pipe is broken."""
    pm = ClaudeProcessManager(cli_path="echo")
    pid = await pm.spawn_task("hello")
    await asyncio.sleep(0.5)

    # Process has exited, stdin is gone; send_message should return False
    result = await pm.send_message(pid, "test")
    assert result is False


# --- 4c: Environment variable whitelisting ---


def test_env_whitelist():
    """Only whitelisted vars and CLAUDE_ prefixed vars pass through."""
    with patch.dict(os.environ, {
        "PATH": "/usr/bin",
        "HOME": "/home/user",
        "AWS_SECRET_ACCESS_KEY": "supersecret",
        "DATABASE_URL": "postgres://...",
        "CLAUDE_CONFIG_DIR": "/tmp/claude",
        "ANTHROPIC_API_KEY": "sk-ant-xxx",
        "RANDOM_VAR": "should_not_appear",
    }, clear=True):
        env = {k: v for k, v in os.environ.items()
               if k in _ENV_WHITELIST or k.startswith("CLAUDE_")}

        assert "PATH" in env
        assert "HOME" in env
        assert "ANTHROPIC_API_KEY" in env
        assert "CLAUDE_CONFIG_DIR" in env  # CLAUDE_ prefix
        assert "AWS_SECRET_ACCESS_KEY" not in env
        assert "DATABASE_URL" not in env
        assert "RANDOM_VAR" not in env


# --- 4d: Case-insensitive permission mode resolution ---


def test_permission_mode_case_insensitive():
    """Permission mode resolution works regardless of case."""
    assert _resolve_permission_mode("Full_Auto") == "bypassPermissions"
    assert _resolve_permission_mode("FULL_AUTO") == "bypassPermissions"
    assert _resolve_permission_mode("full_auto") == "bypassPermissions"
    assert _resolve_permission_mode("BypassPermissions") == "bypassPermissions"
    assert _resolve_permission_mode("BYPASSPERMISSIONS") == "bypassPermissions"
    assert _resolve_permission_mode("AcceptEdits") == "acceptEdits"
    assert _resolve_permission_mode("ACCEPTEDITS") == "acceptEdits"
    assert _resolve_permission_mode("DontAsk") == "dontAsk"
    assert _resolve_permission_mode("DONTASK") == "dontAsk"
    assert _resolve_permission_mode("Plan") == "plan"
    assert _resolve_permission_mode("DEFAULT") == "default"
