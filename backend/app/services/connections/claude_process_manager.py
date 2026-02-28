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

    def set_output_callback(self, callback: Callable) -> None:
        self._on_output = callback

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

        cmd = [self.cli_path, "--output-format", "stream-json"]

        if session_id:
            cmd.extend(["--resume", session_id])

        if model:
            cmd.extend(["--model", model])

        if permission_mode != "default":
            cmd.extend(["--permission-mode", permission_mode])

        cmd.extend(["--print", message])

        cp = ClaudeProcess(
            process_id=process_id,
            session_id=session_id,
            project_path=project_path,
            model=model,
        )
        self._processes[process_id] = cp

        try:
            import time

            cp.started_at = time.time()
            cp.status = "running"

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=project_path,
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

                if self._on_output:
                    try:
                        self._on_output(process_id, line)
                    except Exception:
                        pass

            # Process finished
            returncode = await cp.proc.wait()
            cp.status = "completed" if returncode == 0 else "error"
            logger.info(
                "Claude process %s finished with code %d",
                process_id,
                returncode,
            )

        except Exception as e:
            cp.status = "error"
            logger.error("Error streaming output from %s: %s", process_id, e)

    async def cleanup(self) -> None:
        """Kill all running processes."""
        for pid in list(self._processes):
            await self.kill(pid)
        self._processes.clear()
