"""
ChatGPT Codex CLI connection implementation (stub).

Connects to OpenAI's Codex CLI for session monitoring and interaction.
This is a stub implementation - to be completed when Codex CLI
provides an API for external session management.
"""

import asyncio
import logging
from typing import Any, Optional

from .base import (
    AgentConnection,
    ConnectionStatus,
    ConnectionType,
    HistoryMessage,
    SessionInfo,
)

logger = logging.getLogger(__name__)


class CodexConnection(AgentConnection):
    """
    Connection to ChatGPT Codex CLI.

    STUB IMPLEMENTATION

    Codex CLI currently runs as a standalone terminal application.
    This stub provides the interface for when Codex exposes
    session management APIs.

    Potential implementation approaches:
    1. File-based: Read session files from Codex data directory
    2. Socket: Connect to a local socket if Codex exposes one
    3. CLI wrapper: Execute `codex` commands and parse output

    Config options:
        data_dir: Path to Codex data directory
        cli_path: Path to codex executable (default: codex)
    """

    def __init__(
        self,
        connection_id: str,
        name: str,
        config: Optional[dict[str, Any]] = None,
    ) -> None:
        """
        Initialize Codex connection.

        Args:
            connection_id: Unique identifier for this connection
            name: Human-readable name
            config: Configuration dictionary
        """
        config = config or {}
        super().__init__(
            connection_id=connection_id,
            name=name,
            connection_type=ConnectionType.CODEX,
            config=config,
        )

        self.data_dir = config.get("data_dir", "~/.codex")
        self.cli_path = config.get("cli_path", "codex")

        logger.info(f"CodexConnection initialized (STUB): data_dir={self.data_dir}, cli_path={self.cli_path}")

    # =========================================================================
    # Connection lifecycle
    # =========================================================================

    async def connect(self) -> bool:
        """
        Establish connection to Codex CLI.

        STUB: Currently checks if codex CLI is available.

        Returns:
            True if connection successful, False otherwise.
        """
        self.status = ConnectionStatus.CONNECTING

        try:
            # Check if codex CLI exists
            proc = await asyncio.create_subprocess_exec(
                self.cli_path,
                "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(),
                timeout=5.0,
            )

            if proc.returncode == 0:
                version = stdout.decode().strip()
                logger.info(f"Codex CLI found: {version}")
                self.status = ConnectionStatus.CONNECTED
                return True
            else:
                self._set_error(f"Codex CLI returned error: {stderr.decode()}")
                return False

        except FileNotFoundError:
            self._set_error(f"Codex CLI not found at: {self.cli_path}")
            return False
        except TimeoutError:
            self._set_error("Codex CLI check timed out")
            return False
        except Exception as e:
            self._set_error(str(e))
            return False

    async def disconnect(self) -> None:
        """
        Close the connection.

        STUB: No persistent connection to close.
        """
        self.status = ConnectionStatus.DISCONNECTED
        logger.info(f"CodexConnection {self.name} disconnected")

    # =========================================================================
    # Session management (STUB)
    # =========================================================================

    async def get_sessions(self) -> list[SessionInfo]:
        """
        Get list of active Codex sessions.

        STUB: Returns empty list.

        TODO: Implement by:
        - Reading session files from data_dir
        - Parsing active terminal sessions
        - Querying codex CLI if API becomes available

        Returns:
            List of SessionInfo objects.
        """
        if not self.is_connected():
            return []

        # STUB: No session discovery implemented yet
        logger.debug("CodexConnection.get_sessions() - STUB returning empty list")
        return []

    async def get_session_history(
        self,
        session_key: str,
        limit: int = 50,
    ) -> list[HistoryMessage]:
        """
        Get message history for a Codex session.

        STUB: Returns empty list.

        TODO: Implement by reading session history files.

        Args:
            session_key: Session identifier
            limit: Maximum messages to return

        Returns:
            List of HistoryMessage objects.
        """
        if not self.is_connected():
            return []

        # STUB: No history reading implemented yet
        logger.debug(f"CodexConnection.get_session_history({session_key}) - STUB returning empty list")
        return []

    async def get_status(self) -> dict[str, Any]:
        """
        Get Codex connection status.

        Returns:
            Status dictionary.
        """
        return {
            "connection_id": self.connection_id,
            "name": self.name,
            "type": self.connection_type.value,
            "status": self._status.value,
            "data_dir": self.data_dir,
            "cli_path": self.cli_path,
            "implementation": "stub",
            "note": "Codex CLI integration not yet implemented",
        }

    async def send_message(
        self,
        session_key: str,
        message: str,
        timeout: float = 90.0,
    ) -> Optional[str]:
        """
        Send a message to a Codex session.

        STUB: Not implemented.

        TODO: Implement via stdin/stdout piping to codex CLI.

        Raises:
            NotImplementedError: Always (stub implementation)
        """
        raise NotImplementedError("CodexConnection.send_message() not yet implemented")

    async def kill_session(self, session_key: str) -> bool:
        """
        Kill a Codex session.

        STUB: Not implemented.

        Returns:
            False always (stub).
        """
        logger.warning(f"CodexConnection.kill_session({session_key}) - STUB returning False")
        return False

    async def health_check(self) -> bool:
        """
        Check if Codex CLI is responsive.

        Returns:
            True if CLI responds, False otherwise.
        """
        if not self.is_connected():
            return False

        try:
            proc = await asyncio.create_subprocess_exec(
                self.cli_path,
                "--version",
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await asyncio.wait_for(proc.wait(), timeout=5.0)
            return proc.returncode == 0
        except Exception:
            return False
