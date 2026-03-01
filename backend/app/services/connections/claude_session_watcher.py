"""Watch ~/.claude/projects/*/ for JSONL session file changes."""

import asyncio
import json
import logging
import os
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from .claude_transcript_parser import (
    AgentActivity,
    AssistantTextEvent,
    ClaudeTranscriptParser,
    ParsedEvent,
    ProjectContextEvent,
    SubAgentProgressEvent,
    ToolResultEvent,
    ToolUseEvent,
    TurnCompleteEvent,
)

logger = logging.getLogger(__name__)

# Timing constants
SESSION_SCAN_INTERVAL_MS = 1000
FILE_POLL_INTERVAL_MS = 1000
PERMISSION_WAIT_TIMEOUT_MS = 7000
TEXT_IDLE_TIMEOUT_MS = 5000


@dataclass
class WatchedSession:
    session_id: str
    jsonl_path: Path
    file_offset: int = 0
    last_activity: AgentActivity = AgentActivity.IDLE
    last_event_time: float = 0.0  # monotonic clock (for internal timeouts)
    last_event_wall_time: float = 0.0  # Unix epoch seconds (for recency filtering)
    last_text_only_time: float = 0.0
    pending_tool_uses: set = field(default_factory=set)
    active_subagents: dict = field(default_factory=dict)
    has_pending_tools: bool = False
    project_name: Optional[str] = None
    is_subagent: bool = False
    project_path: Optional[str] = None


class ClaudeSessionWatcher:
    """
    Watch ~/.claude/projects/*/ for JSONL session file changes.

    Triple-layer file watching:
    1. watchdog (kqueue/inotify) — fast, event-driven
    2. stat()-based polling — reliable fallback
    3. asyncio interval — last resort
    """

    def __init__(
        self,
        claude_dir: Path,
        on_events: Optional[Callable] = None,
        on_activity_change: Optional[Callable] = None,
        on_sessions_changed: Optional[Callable] = None,
    ):
        self.claude_dir = claude_dir
        self.projects_dir = claude_dir / "projects"
        self.on_events = on_events
        self.on_activity_change = on_activity_change
        self.on_sessions_changed = on_sessions_changed
        self._parser = ClaudeTranscriptParser()
        self._watched: dict[str, WatchedSession] = {}
        self._known_jsonl_files: set[str] = set()
        self._running = False
        self._tasks: list[asyncio.Task] = []
        self._fs_observer = None

    async def start(self):
        self._running = True
        self._loop = asyncio.get_running_loop()
        self._try_start_watchdog()
        self._tasks.append(asyncio.create_task(self._poll_files_loop()))
        self._tasks.append(asyncio.create_task(self._scan_sessions_loop()))
        self._tasks.append(asyncio.create_task(self._permission_timeout_loop()))
        self._tasks.append(asyncio.create_task(self._text_idle_timeout_loop()))

    async def stop(self):
        self._running = False
        if self._fs_observer:
            self._fs_observer.stop()
            self._fs_observer = None
        for t in self._tasks:
            t.cancel()
        self._tasks.clear()

    def _try_start_watchdog(self):
        try:
            from watchdog.events import FileSystemEventHandler
            from watchdog.observers import Observer

            watcher = self
            loop = getattr(self, "_loop", None)

            class JsonlHandler(FileSystemEventHandler):
                def on_modified(self, event):
                    if event.src_path.endswith(".jsonl") and loop is not None:
                        try:
                            loop.call_soon_threadsafe(watcher._check_file, Path(event.src_path))
                        except RuntimeError:
                            pass

            self._fs_observer = Observer()
            if self.projects_dir.exists():
                self._fs_observer.schedule(JsonlHandler(), str(self.projects_dir), recursive=True)
                self._fs_observer.start()
                logger.info("Watchdog FS observer started")
        except ImportError:
            logger.info("watchdog not installed, using polling only")
        except Exception as e:
            logger.warning(f"Failed to start watchdog: {e}")

    def discover_project_dirs(self) -> list[Path]:
        if not self.projects_dir.exists():
            return []
        return [d for d in self.projects_dir.iterdir() if d.is_dir()]

    def discover_sessions(self, project_dir: Path) -> list[tuple[str, Path, bool]]:
        """Discover JSONL session files. Supports old (flat) and new (nested UUID dir) formats.

        Returns list of (session_id, jsonl_path, is_subagent) tuples.
        """
        sessions: list[tuple[str, Path, bool]] = []
        try:
            for entry in os.scandir(project_dir):
                if entry.is_file() and entry.name.endswith(".jsonl"):
                    # Old format: <project>/<session-id>.jsonl
                    session_id = entry.name[:-6]
                    sessions.append((session_id, Path(entry.path), False))
                elif entry.is_dir():
                    # New format: <project>/<session-uuid>/
                    session_uuid = entry.name
                    session_dir = Path(entry.path)
                    self._discover_session_dir(session_uuid, session_dir, sessions)
        except OSError:
            pass
        return sessions

    def _discover_session_dir(
        self,
        session_uuid: str,
        session_dir: Path,
        sessions: list[tuple[str, Path, bool]],
    ) -> None:
        """Scan a session UUID directory for JSONL files (direct + subagents/)."""
        try:
            for entry in os.scandir(session_dir):
                if entry.is_file() and entry.name.endswith(".jsonl"):
                    stem = entry.name[:-6]
                    session_id = f"{session_uuid[:8]}-{stem}" if stem != session_uuid else session_uuid
                    sessions.append((session_id, Path(entry.path), False))
                elif entry.is_dir() and entry.name == "subagents":
                    try:
                        for sub_entry in os.scandir(entry.path):
                            if sub_entry.is_file() and sub_entry.name.endswith(".jsonl"):
                                stem = sub_entry.name[:-6]
                                session_id = f"{session_uuid[:8]}-{stem}"
                                sessions.append((session_id, Path(sub_entry.path), True))
                    except OSError:
                        pass
        except OSError:
            pass

    def _peek_last_timestamp(self, path: Path) -> float:
        """Read the last lines of a JSONL file and extract the most recent timestamp.

        Returns the Unix timestamp (float) of the last event, or 0.0 if unreadable.
        Old sessions will have old timestamps, making parking expiry work correctly.

        Uses progressively larger read windows (16KB → 64KB) because Claude Code
        JSONL lines can be very large (tool results often exceed 10KB).
        """
        from datetime import datetime

        try:
            size = path.stat().st_size
            if size == 0:
                return 0.0

            for read_size in (16384, 65536, size):
                read_size = min(read_size, size)
                with open(path, "rb") as f:
                    f.seek(max(0, size - read_size))
                    tail = f.read(read_size).decode("utf-8", errors="ignore")

                for line in reversed(tail.splitlines()):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        record = json.loads(line)
                        ts = record.get("timestamp", "")
                        if ts:
                            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                            return dt.timestamp()
                    except (json.JSONDecodeError, ValueError):
                        continue

                # If we read the whole file already, stop
                if read_size >= size:
                    break
        except OSError:
            pass
        return 0.0

    def watch_session(self, session_id: str, jsonl_path: Path, is_subagent: bool = False):
        if session_id not in self._watched:
            offset = jsonl_path.stat().st_size if jsonl_path.exists() else 0
            wall_time = self._peek_last_timestamp(jsonl_path) if jsonl_path.exists() else 0.0
            self._watched[session_id] = WatchedSession(
                session_id=session_id,
                jsonl_path=jsonl_path,
                file_offset=offset,
                last_event_time=wall_time,
                last_event_wall_time=wall_time,
                is_subagent=is_subagent,
            )

    def unwatch_session(self, session_id: str):
        self._watched.pop(session_id, None)

    def get_watched_sessions(self) -> dict[str, WatchedSession]:
        return dict(self._watched)

    def _check_file(self, path: Path):
        for ws in self._watched.values():
            if ws.jsonl_path == path:
                self._read_new_lines(ws)
                break

    def _read_new_lines(self, ws: WatchedSession):
        if not ws.jsonl_path.exists():
            return
        try:
            size = ws.jsonl_path.stat().st_size
        except OSError:
            return
        if size < ws.file_offset:
            logger.warning(
                "JSONL file truncated for session %s (size=%d < offset=%d), resetting",
                ws.session_id,
                size,
                ws.file_offset,
            )
            ws.file_offset = 0
        if size <= ws.file_offset:
            return
        events, ws.file_offset = self._parser.parse_file(str(ws.jsonl_path), ws.file_offset)
        if events:
            self._update_activity(ws, events)
            if self.on_events:
                self.on_events(ws.session_id, events)

    async def _scan_sessions_loop(self):
        while self._running:
            try:
                # Lazy watchdog start: directory may not have existed at startup
                if self._fs_observer is None and self.projects_dir.exists():
                    self._try_start_watchdog()

                found_new = False
                for project_dir in self.discover_project_dirs():
                    for session_id, jsonl_path, is_subagent in self.discover_sessions(project_dir):
                        path_key = str(jsonl_path)
                        if path_key not in self._known_jsonl_files:
                            self._known_jsonl_files.add(path_key)
                            self.watch_session(session_id, jsonl_path, is_subagent)
                            found_new = True
                if found_new and self.on_sessions_changed:
                    self.on_sessions_changed()

                # Cleanup stale sessions: >24h old with deleted JSONL file
                now = time.time()
                stale_ids = [
                    sid
                    for sid, ws in self._watched.items()
                    if ws.last_event_wall_time > 0
                    and (now - ws.last_event_wall_time) > 86400
                    and not ws.jsonl_path.exists()
                ]
                for sid in stale_ids:
                    logger.info("Removing stale session %s", sid)
                    self._watched.pop(sid, None)
            except Exception as e:
                logger.error(f"Error scanning sessions: {e}")
            await asyncio.sleep(SESSION_SCAN_INTERVAL_MS / 1000.0)

    async def _poll_files_loop(self):
        while self._running:
            try:
                for ws in list(self._watched.values()):
                    self._read_new_lines(ws)
            except Exception as e:
                logger.error(f"Error polling files: {e}")
            await asyncio.sleep(FILE_POLL_INTERVAL_MS / 1000.0)

    async def _permission_timeout_loop(self):
        while self._running:
            now = time.monotonic()
            for ws in self._watched.values():
                if (
                    ws.pending_tool_uses
                    and ws.last_activity == AgentActivity.TOOL_USE
                    and now - ws.last_event_time > PERMISSION_WAIT_TIMEOUT_MS / 1000.0
                ):
                    ws.last_activity = AgentActivity.WAITING_PERMISSION
                    if self.on_activity_change:
                        self.on_activity_change(ws.session_id, AgentActivity.WAITING_PERMISSION)
            await asyncio.sleep(2.0)

    async def _text_idle_timeout_loop(self):
        while self._running:
            now = time.monotonic()
            for ws in self._watched.values():
                if (
                    ws.last_activity == AgentActivity.RESPONDING
                    and not ws.pending_tool_uses
                    and ws.last_text_only_time > 0
                    and now - ws.last_text_only_time > TEXT_IDLE_TIMEOUT_MS / 1000.0
                ):
                    ws.last_activity = AgentActivity.WAITING_INPUT
                    ws.last_text_only_time = 0.0
                    if self.on_activity_change:
                        self.on_activity_change(ws.session_id, AgentActivity.WAITING_INPUT)
            await asyncio.sleep(1.0)

    def _update_activity(self, ws: WatchedSession, events: list[ParsedEvent]):
        old_activity = ws.last_activity
        ws.last_event_time = time.monotonic()
        ws.last_event_wall_time = time.time()
        ws.last_text_only_time = 0.0

        for event in events:
            if isinstance(event, ToolUseEvent):
                ws.pending_tool_uses.add(event.tool_use_id)
                ws.has_pending_tools = True
                ws.last_activity = AgentActivity.TOOL_USE
                if event.is_task_tool:
                    ws.active_subagents[event.tool_use_id] = {
                        "description": event.input_data.get("description", ""),
                    }
            elif isinstance(event, ToolResultEvent):
                ws.pending_tool_uses.discard(event.tool_use_id)
                if event.tool_use_id in ws.active_subagents:
                    del ws.active_subagents[event.tool_use_id]
            elif isinstance(event, TurnCompleteEvent):
                ws.pending_tool_uses.clear()
                ws.has_pending_tools = False
                ws.last_activity = AgentActivity.WAITING_INPUT
            elif isinstance(event, AssistantTextEvent):
                ws.last_activity = AgentActivity.RESPONDING
                if not ws.has_pending_tools:
                    ws.last_text_only_time = time.monotonic()
            elif isinstance(event, ProjectContextEvent):
                ws.project_name = event.project_name
                if event.cwd:
                    ws.project_path = event.cwd
            elif isinstance(event, SubAgentProgressEvent):
                pass

        if ws.last_activity != old_activity and self.on_activity_change:
            self.on_activity_change(ws.session_id, ws.last_activity)
