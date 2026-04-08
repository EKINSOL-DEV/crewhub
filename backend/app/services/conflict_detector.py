"""Track file edits across agents and detect conflicts."""
import logging
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

CONFLICT_WINDOW_SECONDS = 300  # 5 minutes

@dataclass
class FileEdit:
    file_path: str
    session_key: str
    timestamp: float

class ConflictDetector:
    """Tracks file edits and detects when multiple agents edit the same file."""

    def __init__(self):
        self._edits: dict[str, list[FileEdit]] = {}  # file_path -> list of recent edits

    def record_edit(self, file_path: str, session_key: str) -> list[str]:
        """Record a file edit and return conflicting session keys (if any)."""
        now = time.time()
        cutoff = now - CONFLICT_WINDOW_SECONDS

        if file_path not in self._edits:
            self._edits[file_path] = []

        # Clean old entries
        self._edits[file_path] = [e for e in self._edits[file_path] if e.timestamp > cutoff]

        # Check for conflicts (other sessions editing same file)
        conflicts = [
            e.session_key for e in self._edits[file_path]
            if e.session_key != session_key
        ]

        # Record this edit
        self._edits[file_path].append(FileEdit(
            file_path=file_path,
            session_key=session_key,
            timestamp=now,
        ))

        if conflicts:
            logger.warning(
                "File conflict detected: %s edited by %s and %s",
                file_path, session_key, conflicts,
            )

        return list(set(conflicts))

    def get_recent_edits(self, session_key: str | None = None) -> dict[str, list[dict]]:
        """Get recent file edits, optionally filtered by session."""
        now = time.time()
        cutoff = now - CONFLICT_WINDOW_SECONDS
        result = {}
        for fp, edits in self._edits.items():
            recent = [
                {"session_key": e.session_key, "timestamp": e.timestamp}
                for e in edits
                if e.timestamp > cutoff and (session_key is None or e.session_key == session_key)
            ]
            if recent:
                result[fp] = recent
        return result

# Singleton
_detector = ConflictDetector()

def get_conflict_detector() -> ConflictDetector:
    return _detector
