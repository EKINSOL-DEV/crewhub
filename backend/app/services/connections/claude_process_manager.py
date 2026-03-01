"""
ClaudeProcessManager — spawn and manage Claude Code CLI subprocesses.

Phase 2: enables sending messages to Claude Code sessions via subprocess.
"""

import asyncio
import json
import logging
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# Map user-friendly permission mode names to valid Claude CLI values.
# CLI accepts: acceptEdits, bypassPermissions, default, dontAsk, plan
_PERMISSION_MODE_MAP: dict[str, str] = {
    "full-auto": "bypassPermissions",
    "full_auto": "bypassPermissions",
    "auto": "bypassPermissions",
    "accept-edits": "acceptEdits",
    "accept_edits": "acceptEdits",
    "dont-ask": "dontAsk",
    "dont_ask": "dontAsk",
    "bypass": "bypassPermissions",
    "bypass-permissions": "bypassPermissions",
    "bypass_permissions": "bypassPermissions",
}

_VALID_PERMISSION_MODES = {"acceptEdits", "bypassPermissions", "default", "dontAsk", "plan"}


def _resolve_permission_mode(mode: str) -> str:
    """Resolve a permission mode string to a valid Claude CLI value."""
    if mode in _VALID_PERMISSION_MODES:
        return mode
    resolved = _PERMISSION_MODE_MAP.get(mode)
    if resolved:
        return resolved
    logger.warning("Unknown permission mode '%s', falling back to 'default'", mode)
    return "default"


@dataclass
class ClaudeProcess:
    """Represents a running Claude Code CLI subprocess."""

    process_id: str
    session_id: Optional[str]
    project_path: Optional[str]
    proc: Optional[asyncio.subprocess.Process] = None
    started_at: float = 0.0
    status: str = "pending"  # pending, running, completed, error, killed
    output_lines: list[str] = field(default_factory=list)
    model: Optional[str] = None
    result_session_id: Optional[str] = None  # captured from "result" JSONL event


class ClaudeProcessManager:
    """
    Manage Claude Code CLI subprocesses.

    Spawns `claude` processes with --output-format stream-json,
    captures output, and routes it back through SSE.
    """

    def __init__(self, cli_path: str = "claude"):
        self.cli_path = cli_path
        self._processes: dict[str, ClaudeProcess] = {}
        self._on_output: Optional[Callable] = None
        self._process_callbacks: dict[str, Callable] = {}  # per-process output routing

    def set_output_callback(self, callback: Callable) -> None:
        self._on_output = callback

    def set_process_callback(self, process_id: str, callback: Callable) -> None:
        """Set a per-process output callback. Takes priority over global callback."""
        self._process_callbacks[process_id] = callback

    def remove_process_callback(self, process_id: str) -> None:
        self._process_callbacks.pop(process_id, None)

    async def spawn_task(
        self,
        message: str,
        session_id: Optional[str] = None,
        project_path: Optional[str] = None,
        model: Optional[str] = None,
        permission_mode: str = "default",
    ) -> str:
        """Spawn a new Claude Code CLI process.

        Returns:
            process_id for tracking.
        """
        process_id = str(uuid.uuid4())

        cmd = [self.cli_path, "--output-format", "stream-json", "--verbose"]

        if session_id:
            cmd.extend(["--resume", session_id])

        if model:
            cmd.extend(["--model", model])

        resolved_mode = _resolve_permission_mode(permission_mode)
        if resolved_mode != "default":
            cmd.extend(["--permission-mode", resolved_mode])

        cmd.extend(["--print", message])

        cp = ClaudeProcess(
            process_id=process_id,
            session_id=session_id,
            project_path=project_path,
            model=model,
        )
        self._processes[process_id] = cp

        try:
            import os
            import time

            cp.started_at = time.time()
            cp.status = "running"

            # Strip env vars that prevent nested Claude Code sessions
            env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=project_path,
                env=env,
            )
            cp.proc = proc

            # Start output streaming task
            asyncio.create_task(self._stream_output(process_id))

            logger.info("Spawned Claude process %s (session=%s)", process_id, session_id)
            return process_id

        except Exception as e:
            cp.status = "error"
            logger.error("Failed to spawn Claude process: %s", e)
            raise

    async def send_message(
        self,
        process_id: str,
        message: str,
    ) -> bool:
        """Send a message to a running process's stdin (stream-json input)."""
        cp = self._processes.get(process_id)
        if not cp or not cp.proc or cp.proc.stdin is None:
            return False

        try:
            payload = json.dumps({"type": "user", "content": message}) + "\n"
            cp.proc.stdin.write(payload.encode())
            await cp.proc.stdin.drain()
            return True
        except Exception as e:
            logger.error("Failed to send message to %s: %s", process_id, e)
            return False

    async def kill(self, process_id: str) -> bool:
        """Kill a running Claude process."""
        cp = self._processes.get(process_id)
        if not cp or not cp.proc:
            return False

        try:
            cp.proc.terminate()
            try:
                await asyncio.wait_for(cp.proc.wait(), timeout=5.0)
            except TimeoutError:
                cp.proc.kill()
            cp.status = "killed"
            logger.info("Killed Claude process %s", process_id)
            return True
        except Exception as e:
            logger.error("Failed to kill %s: %s", process_id, e)
            return False

    def get_process(self, process_id: str) -> Optional[ClaudeProcess]:
        return self._processes.get(process_id)

    def list_processes(self) -> list[ClaudeProcess]:
        return list(self._processes.values())

    async def _stream_output(self, process_id: str) -> None:
        """Read stdout from process and route events."""
        cp = self._processes.get(process_id)
        if not cp or not cp.proc or not cp.proc.stdout:
            return

        try:
            async for line_bytes in cp.proc.stdout:
                line = line_bytes.decode("utf-8", errors="replace").strip()
                if not line:
                    continue

                cp.output_lines.append(line)

                # Try to extract session_id from "result" JSONL events
                try:
                    parsed = json.loads(line)
                    if isinstance(parsed, dict) and parsed.get("type") == "result":
                        sid = parsed.get("session_id")
                        if sid:
                            cp.result_session_id = sid
                except (json.JSONDecodeError, KeyError):
                    pass

                # Per-process callback takes priority over global
                callback = self._process_callbacks.get(process_id) or self._on_output
                if callback:
                    try:
                        callback(process_id, line)
                    except Exception:
                        pass

            # Process finished
            returncode = await cp.proc.wait()
            cp.status = "completed" if returncode == 0 else "error"

            # Log stderr on failure for debugging
            if returncode != 0 and cp.proc.stderr:
                stderr_bytes = await cp.proc.stderr.read()
                stderr_text = stderr_bytes.decode("utf-8", errors="replace").strip()
                if stderr_text:
                    logger.error(
                        "Claude process %s stderr: %s", process_id, stderr_text[:500]
                    )

            logger.info(
                "Claude process %s finished with code %d",
                process_id,
                returncode,
            )

            # Clean up per-process callback
            self._process_callbacks.pop(process_id, None)

        except Exception as e:
            cp.status = "error"
            self._process_callbacks.pop(process_id, None)
            logger.error("Error streaming output from %s: %s", process_id, e)

    async def cleanup(self) -> None:
        """Kill all running processes."""
        for pid in list(self._processes):
            await self.kill(pid)
        self._processes.clear()
