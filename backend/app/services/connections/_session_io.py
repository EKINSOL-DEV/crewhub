"""
Session file I/O mixin for OpenClawConnection.

Handles reading JSONL session history files and killing sessions by
file-rename — extracted from openclaw.py to keep the core class lean.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    pass

from .base import HistoryMessage

OPENCLAW_DIR = ".openclaw"

logger = logging.getLogger(__name__)

# Validation for safe IDs (prevent path traversal)
SAFE_ID = re.compile(r"^[a-zA-Z0-9_-]+$")


def _validate_id(value: str) -> str:
    """Raise ValueError if value contains unsafe characters."""
    if not value or not SAFE_ID.match(value):
        raise ValueError(f"Invalid id: {value}")
    return value


class OpenClawSessionIOMixin:
    """Mixin that provides session file I/O methods."""

    # ------------------------------------------------------------------
    # Public interface (matches AgentConnection)
    # ------------------------------------------------------------------

    async def get_session_history(
        self,
        session_key: str,
        limit: int = 50,
    ) -> list[HistoryMessage]:
        """Read message history for a session from its JSONL file."""
        try:
            sessions = await self.get_sessions()  # type: ignore[attr-defined]
            session = next((s for s in sessions if s.key == session_key), None)
            if not session or not session.session_id:
                return []

            session_id = _validate_id(session.session_id)
            agent_id = _validate_id(session.agent_id)
            base = Path.home() / OPENCLAW_DIR / "agents" / agent_id / "sessions"
            session_file = (base / f"{session_id}.jsonl").resolve()

            if not str(session_file).startswith(str(base.resolve())):
                raise ValueError("Invalid session path")
            if not session_file.exists():
                return []

            messages: list[HistoryMessage] = []
            with open(session_file) as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        msg = self._parse_history_message(json.loads(line))
                        if msg:
                            messages.append(msg)
                    except json.JSONDecodeError:
                        continue

            return messages[-limit:] if limit else messages

        except (ValueError, OSError) as exc:
            logger.error(f"Error reading session history: {exc}")
            return []

    async def get_session_history_raw(
        self,
        session_key: str,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """Return raw JSONL history dicts (legacy format)."""
        try:
            sessions = await self.get_sessions_raw()  # type: ignore[attr-defined]
            session = next((s for s in sessions if s.get("key") == session_key), None)
            if not session:
                return []

            session_id = session.get("sessionId", "")
            if not session_id:
                return []

            session_id = _validate_id(session_id)
            agent_id = "main"
            if ":" in session_key:
                parts = session_key.split(":")
                if len(parts) > 1:
                    agent_id = _validate_id(parts[1])

            base = Path.home() / OPENCLAW_DIR / "agents" / agent_id / "sessions"
            session_file = (base / f"{session_id}.jsonl").resolve()

            if not str(session_file).startswith(str(base.resolve())):
                raise ValueError("Invalid session path")
            if not session_file.exists():
                return []

            messages: list[dict[str, Any]] = []
            with open(session_file) as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            messages.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue

            return messages[-limit:] if limit else messages

        except (ValueError, OSError) as exc:
            logger.error(f"Error reading session history: {exc}")
            return []

    async def kill_session(self, session_key: str) -> bool:
        """
        Kill a session by renaming its JSONL file.

        Multi-strategy (v2026.2.17 compatible):
        1. Not in active sessions → already archived → success.
        2. Rename file in sessions/ → .deleted.<ts>.
        3. Already in archive/ → success.
        """
        try:
            sessions = await self.get_sessions()  # type: ignore[attr-defined]
            session = next((s for s in sessions if s.key == session_key), None)

            if not session:
                logger.info(f"kill_session: {session_key} not in active sessions — already removed/archived")
                return True

            session_id = _validate_id(session.session_id)
            agent_id = _validate_id(session.agent_id)
            base = Path.home() / OPENCLAW_DIR / "agents" / agent_id / "sessions"
            session_file = (base / f"{session_id}.jsonl").resolve()

            if not str(session_file).startswith(str(base.resolve())):
                return False

            if session_file.exists():
                ts = datetime.now(UTC).isoformat().replace(":", "-")
                session_file.rename(session_file.with_suffix(f".jsonl.deleted.{ts}"))
                logger.info(f"kill_session: renamed {session_file.name} → .deleted")
                return True

            # Check archive/
            archive_base = Path.home() / OPENCLAW_DIR / "agents" / agent_id / "archive"
            archive_file = (archive_base / f"{session_id}.jsonl").resolve()
            if archive_base.exists() and str(archive_file).startswith(str(archive_base.resolve())):
                if archive_file.exists():
                    logger.info(f"kill_session: {session_key} already in archive/")
                    return True

            logger.warning(f"kill_session: could not find session file for {session_key}")
            return False

        except (ValueError, OSError) as exc:
            logger.error(f"Error killing session: {exc}")
            return False

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _parse_history_message(self, raw: dict[str, Any]) -> Optional[HistoryMessage]:
        """Parse a raw JSONL entry into a HistoryMessage."""
        try:
            role = raw.get("role", "")
            content = raw.get("content", "")
            if isinstance(content, list):
                parts = []
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        parts.append(block.get("text", ""))
                    elif isinstance(block, str):
                        parts.append(block)
                content = "\n".join(parts)
            if not role:
                return None
            return HistoryMessage(
                role=role,
                content=content,
                timestamp=raw.get("timestamp"),
                metadata={k: v for k, v in raw.items() if k not in {"role", "content", "timestamp"}},
            )
        except Exception as exc:
            logger.error(f"Error parsing history message: {exc}")
            return None
