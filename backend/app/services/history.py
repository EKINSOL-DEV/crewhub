"""Session history service.

Reads archived/completed session data from OpenClaw session files.
Provides filtering, statistics, and management of historical sessions.
"""

import json
import logging
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Dict, Optional

DELETED_MARKER = ".deleted."

logger = logging.getLogger(__name__)

# Base path for OpenClaw sessions
OPENCLAW_BASE = Path.home() / ".openclaw" / "agents"

# Validation for safe IDs (prevent path traversal)
SAFE_ID = re.compile(r"^[a-zA-Z0-9_-]+$")


def _safe_id(value: str) -> str:
    """Validate ID contains only safe characters."""
    if not value or not SAFE_ID.match(value):
        raise ValueError(f"Invalid id: {value}")
    return value


def _parse_session_file(file_path: Path) -> Optional[Dict[str, Any]]:
    """Parse a session JSONL file and extract metadata.

    Returns session info with:
    - session_key, session_id, agent_id
    - started_at, ended_at (timestamps)
    - message_count
    - model
    - status (archived, completed, deleted)
    - summary (last assistant message or label)
    """
    try:
        messages = []
        with open(file_path) as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        messages.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue

        if not messages:
            return None

        # Extract agent_id from path
        # parent might be sessions/ or archive/ — agent_id is one level up
        parent_name = file_path.parent.name
        if parent_name in ("sessions", "archive"):
            agent_id = file_path.parent.parent.name
        else:
            agent_id = parent_name  # legacy: sessions/ folder named after agent
        session_id = file_path.stem

        # Handle deleted sessions (filename may have .deleted.timestamp suffix)
        if DELETED_MARKER in file_path.name:
            session_id = session_id.split(DELETED_MARKER)[0]
            status = "deleted"
        elif parent_name == "archive":
            # v2026.2.17: sessions moved to archive/ folder by OpenClaw maintenance
            status = "archived"
        elif file_path.suffix == ".jsonl":
            status = "archived"
        else:
            status = "unknown"

        # Build session key
        session_key = f"agent:{agent_id}:{session_id}"

        # Find timestamps from messages
        started_at = None
        ended_at = None
        model = None
        label = None
        last_assistant_text = None
        channel = None

        for msg in messages:
            # Get timestamp
            ts = msg.get("ts") or msg.get("timestamp")
            if ts:
                if started_at is None or ts < started_at:
                    started_at = ts
                if ended_at is None or ts > ended_at:
                    ended_at = ts

            # Get model from first assistant turn
            if msg.get("role") == "assistant" and not model:
                model = msg.get("model")

            # Get last assistant text for summary
            if msg.get("role") == "assistant":
                text = msg.get("text") or msg.get("content")
                if isinstance(text, str) and text:
                    last_assistant_text = text[:200]  # Truncate

            # Get label if present
            if "label" in msg:
                label = msg.get("label")

            # Get channel
            if "channel" in msg and not channel:
                channel = msg.get("channel")

        # Build summary
        summary = label or last_assistant_text or ""
        if len(summary) > 100:
            summary = summary[:100] + "..."

        # Determine minion type from session structure
        minion_type = "main"
        if "subagent" in session_id.lower():
            minion_type = "subagent"
        elif "cron" in session_id.lower():
            minion_type = "cron"
        elif agent_id != "main":
            minion_type = agent_id

        return {
            "session_key": session_key,
            "session_id": session_id,
            "agent_id": agent_id,
            "display_name": label or session_id,
            "minion_type": minion_type,
            "model": model,
            "channel": channel,
            "started_at": started_at,
            "ended_at": ended_at,
            "message_count": len(messages),
            "status": status,
            "summary": summary,
            "file_path": str(file_path),
        }

    except Exception as e:
        logger.error(f"Error parsing session file {file_path}: {e}")
        return None


def get_archived_sessions(
    limit: int = 50,
    offset: int = 0,
    agent_id: Optional[str] = None,
    type_filter: Optional[str] = None,
    date_from: Optional[int] = None,
    date_to: Optional[int] = None,
    search: Optional[str] = None,
    include_deleted: bool = False,
) -> Dict[str, Any]:
    """Get archived sessions from filesystem.

    Args:
        limit: Maximum number of results
        offset: Pagination offset
        agent_id: Filter by agent ID (main, dev, etc.)
        type_filter: Filter by minion type
        date_from: Start timestamp (ms)
        date_to: End timestamp (ms)
        search: Search in display_name or summary
        include_deleted: Include deleted sessions

    Returns:
        dict: {sessions: [...], total: count}
    """
    sessions = []

    try:
        if not OPENCLAW_BASE.exists():
            return {"sessions": [], "total": 0, "limit": limit, "offset": offset}

        # Collect all agent directories (sessions/ and archive/ folders)
        agent_dirs = []
        if agent_id:
            try:
                safe_agent = _safe_id(agent_id)
                agent_path = OPENCLAW_BASE / safe_agent
                sessions_path = agent_path / "sessions"
                if sessions_path.exists():
                    agent_dirs.append(sessions_path)
                # v2026.2.17: also scan archive/ folder
                archive_path = agent_path / "archive"
                if archive_path.exists():
                    agent_dirs.append(archive_path)
            except ValueError:
                pass
        else:
            for agent_path in OPENCLAW_BASE.iterdir():
                if agent_path.is_dir():
                    sessions_path = agent_path / "sessions"
                    if sessions_path.exists():
                        agent_dirs.append(sessions_path)
                    # v2026.2.17: also scan archive/ folder
                    archive_path = agent_path / "archive"
                    if archive_path.exists():
                        agent_dirs.append(archive_path)

        # Collect all session files
        for sessions_dir in agent_dirs:
            for file_path in sessions_dir.iterdir():
                if not file_path.is_file():
                    continue

                # Filter by extension
                if not include_deleted and DELETED_MARKER in file_path.name:
                    continue

                if not file_path.name.endswith(".jsonl") and DELETED_MARKER not in file_path.name:
                    continue

                session = _parse_session_file(file_path)
                if session:
                    sessions.append(session)

        # Apply filters
        filtered = []
        for session in sessions:
            # Type filter
            if type_filter and session.get("minion_type") != type_filter:
                continue

            # Date filters
            if date_from and (session.get("ended_at") or 0) < date_from:
                continue
            if date_to and (session.get("ended_at") or 0) > date_to:
                continue

            # Search filter
            if search:
                search_lower = search.lower()
                display = (session.get("display_name") or "").lower()
                summary = (session.get("summary") or "").lower()
                if search_lower not in display and search_lower not in summary:
                    continue

            filtered.append(session)

        # Sort by ended_at descending (most recent first)
        filtered.sort(key=lambda s: s.get("ended_at") or 0, reverse=True)

        # Pagination
        total = len(filtered)
        paginated = filtered[offset : offset + limit]

        return {
            "sessions": paginated,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    except Exception as e:
        logger.error(f"Error getting archived sessions: {e}")
        return {"sessions": [], "total": 0, "limit": limit, "offset": offset, "error": str(e)}


def get_session_detail(session_key: str) -> Optional[Dict[str, Any]]:
    """Get detailed information for a specific archived session.

    Args:
        session_key: Session key (e.g., agent:main:abc123)

    Returns:
        dict or None: Session details with full message history
    """
    try:
        # Parse session key
        parts = session_key.split(":")
        if len(parts) < 3:
            return None

        agent_id = _safe_id(parts[1])
        session_id = _safe_id(parts[2])

        base = OPENCLAW_BASE / agent_id / "sessions"
        session_file = (base / f"{session_id}.jsonl").resolve()

        # Security check
        if not str(session_file).startswith(str(base.resolve())):
            return None

        # Try normal file first, then deleted, then archive folder
        if not session_file.exists():
            # Look for deleted files in sessions/
            for f in base.iterdir():
                if f.name.startswith(f"{session_id}.jsonl.deleted."):
                    session_file = f
                    break

        # v2026.2.17: check archive/ folder if not found in sessions/
        if not session_file.exists():
            archive_base = OPENCLAW_BASE / agent_id / "archive"
            if archive_base.exists():
                archive_file = (archive_base / f"{session_id}.jsonl").resolve()
                if str(archive_file).startswith(str(archive_base.resolve())) and archive_file.exists():
                    session_file = archive_file

        if not session_file.exists():
            return None

        session = _parse_session_file(session_file)
        if not session:
            return None

        # Add full message history
        messages = []
        with open(session_file) as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        messages.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue

        session["messages"] = messages
        return session

    except (ValueError, OSError) as e:
        logger.error(
            f"Error getting session detail {session_key}: {e}"
        )  # NOSONAR: session_key is internal system identifier; e is system exception, needed for diagnostics
        return None


def delete_session(session_key: str) -> bool:
    """Mark a session as deleted by renaming the file.

    Args:
        session_key: Session key to delete

    Returns:
        bool: Success status
    """
    try:
        # Parse session key
        parts = session_key.split(":")
        if len(parts) < 3:
            return False

        agent_id = _safe_id(parts[1])
        session_id = _safe_id(parts[2])

        base = OPENCLAW_BASE / agent_id / "sessions"
        session_file = (base / f"{session_id}.jsonl").resolve()

        # Security check
        if not str(session_file).startswith(str(base.resolve())):
            return False

        if session_file.exists():
            ts = datetime.now(UTC).isoformat().replace(":", "-")
            session_file.rename(session_file.with_suffix(f".jsonl.deleted.{ts}"))
            logger.info(
                f"Deleted session: {session_key}"
            )  # NOSONAR: session_key is internal system identifier, not user input
            return True

        return False

    except (ValueError, OSError) as e:
        logger.error(f"Error deleting session {session_key}: {e}")
        return False


def get_statistics() -> Dict[str, Any]:
    """Get statistics about archived sessions.

    Returns:
        dict: Statistics about stored sessions
    """
    try:
        sessions_result = get_archived_sessions(limit=10000)
        sessions = sessions_result.get("sessions", [])

        # Count by type
        by_type: Dict[str, int] = {}
        total_messages = 0

        for session in sessions:
            minion_type = session.get("minion_type", "unknown")
            by_type[minion_type] = by_type.get(minion_type, 0) + 1
            total_messages += session.get("message_count", 0)

        return {
            "total_sessions": len(sessions),
            "by_type": by_type,
            "total_messages": total_messages,
        }

    except Exception as e:
        logger.error(f"Error getting statistics: {e}")
        return {"total_sessions": 0, "by_type": {}, "error": str(e)}
