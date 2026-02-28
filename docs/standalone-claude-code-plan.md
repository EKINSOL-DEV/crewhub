> **Updated 2026-02-28:** corrected session discovery, file watching, and turn detection based on Claude Code CLI transcript analysis.

# Native Claude Code Support — Unified Implementation Plan

**Date:** 2026-02-28
**Status:** Ready for implementation
**Source:** Cross-review of technical analysis (Opus) + MVP review (Reviewer)

---

## 1. File List

### New Files

| Path (relative to repo root) | Purpose |
|---|---|
| `backend/app/services/connections/claude_session_watcher.py` | Watch `~/.claude/projects/*/` for JSONL changes |
| `backend/app/services/connections/claude_transcript_parser.py` | Parse JSONL lines into typed events |
| `backend/app/services/connections/claude_process_manager.py` | Spawn/manage `claude` CLI processes (Phase 2) |
| `backend/app/services/cron_scheduler.py` | Local cron replacement (Phase 3) |

### Modified Files

| Path | Changes |
|---|---|
| `backend/app/services/connections/claude_code.py` | Rewrite from stub → full implementation (~246 lines → ~400 lines) |
| `backend/app/routes/chat.py` | Route chat to ClaudeCodeConnection when appropriate |
| `backend/app/services/context_envelope.py` | Support `--append-system-prompt` injection |
| `backend/app/db/migrations/` | Add `claude_processes` and `cron_jobs` tables (Phase 2+) |

### Unchanged (reused as-is)

- `backend/app/services/connections/base.py` — `AgentConnection`, `SessionInfo`, `HistoryMessage`
- `backend/app/services/connections/connection_manager.py` — registers ClaudeCodeConnection
- `backend/app/routes/sse.py` — `broadcast()` function
- `frontend/` — entirely unchanged for Phase 1 (SessionInfo format is connection-agnostic)

---

## 2. Phase 1 — Read-Only Monitoring (MVP)

### Goal
CrewHub discovers and monitors Claude Code sessions without OpenClaw. No spawning, no chat — just watching.

### Constants

```python
# Timing constants for the Claude Code Bridge
SESSION_SCAN_INTERVAL_MS = 1000    # How often to scan for new .jsonl session files
FILE_POLL_INTERVAL_MS = 1000       # stat()-based polling interval for file changes
PERMISSION_WAIT_TIMEOUT_MS = 7000  # Time after tool_use with no result before assuming permission wait
TEXT_IDLE_TIMEOUT_MS = 5000        # Silence after text-only response before marking as waiting
```

### 2.1 ClaudeTranscriptParser (`claude_transcript_parser.py`, ~150 lines)

Stateless parser that reads Claude Code's JSONL transcript format.

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional
import json


class AgentActivity(Enum):
    IDLE = "idle"
    THINKING = "thinking"
    TOOL_USE = "tool_use"
    RESPONDING = "responding"
    WAITING_INPUT = "waiting_input"
    WAITING_PERMISSION = "waiting_permission"


@dataclass
class ParsedEvent:
    """Base for all parsed JSONL events."""
    event_type: str
    timestamp: Optional[int] = None
    raw: dict = field(default_factory=dict)


@dataclass
class AssistantTextEvent(ParsedEvent):
    event_type: str = "assistant_text"
    text: str = ""
    model: Optional[str] = None


@dataclass
class ToolUseEvent(ParsedEvent):
    event_type: str = "tool_use"
    tool_name: str = ""
    tool_use_id: str = ""
    input_data: dict = field(default_factory=dict)
    is_task_tool: bool = False  # True when name == "Task"


@dataclass
class ToolResultEvent(ParsedEvent):
    event_type: str = "tool_result"
    tool_use_id: str = ""
    content: str = ""


@dataclass
class TurnCompleteEvent(ParsedEvent):
    event_type: str = "turn_complete"
    duration_ms: int = 0


@dataclass
class SubAgentProgressEvent(ParsedEvent):
    event_type: str = "subagent_progress"
    parent_tool_use_id: str = ""
    nested_event: Optional[ParsedEvent] = None


@dataclass
class UserMessageEvent(ParsedEvent):
    event_type: str = "user_message"
    content: str = ""


class ClaudeTranscriptParser:
    """Parse Claude Code JSONL transcript lines into typed events."""

    def parse_line(self, line: str) -> list[ParsedEvent]:
        """Parse a single JSONL line. Returns list (assistant msgs yield multiple events)."""
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            return []

        record_type = record.get("type")

        if record_type == "assistant":
            return self._parse_assistant(record)
        elif record_type == "user":
            return self._parse_user(record)
        elif record_type == "system":
            return self._parse_system(record)
        elif record_type == "progress":
            return self._parse_progress(record)
        return []

    def _parse_assistant(self, record: dict) -> list[ParsedEvent]:
        events = []
        message = record.get("message", {})
        model = message.get("model")
        content_blocks = message.get("content", [])
        if isinstance(content_blocks, str):
            content_blocks = [{"type": "text", "text": content_blocks}]

        for block in content_blocks:
            if block.get("type") == "text":
                events.append(AssistantTextEvent(text=block["text"], model=model, raw=record))
            elif block.get("type") == "tool_use":
                events.append(ToolUseEvent(
                    tool_name=block.get("name", ""),
                    tool_use_id=block.get("id", ""),
                    input_data=block.get("input", {}),
                    is_task_tool=block.get("name") == "Task",
                    raw=record,
                ))
        return events

    def _parse_user(self, record: dict) -> list[ParsedEvent]:
        events = []
        message = record.get("message", {})
        content = message.get("content", "")
        if isinstance(content, str):
            return [UserMessageEvent(content=content, raw=record)]
        for block in content:
            if block.get("type") == "tool_result":
                events.append(ToolResultEvent(
                    tool_use_id=block.get("tool_use_id", ""),
                    content=str(block.get("content", ""))[:200],
                    raw=record,
                ))
            elif isinstance(block, dict) and block.get("type") == "text":
                events.append(UserMessageEvent(content=block.get("text", ""), raw=record))
        return events

    def _parse_system(self, record: dict) -> list[ParsedEvent]:
        if record.get("subtype") == "turn_duration":
            return [TurnCompleteEvent(duration_ms=record.get("durationMs", 0), raw=record)]
        return []

    def _parse_progress(self, record: dict) -> list[ParsedEvent]:
        parent_id = record.get("parentToolUseID", "")
        nested = record.get("data", {})
        nested_events = []
        if nested.get("type") == "agent_progress":
            inner_msg = nested.get("message", {})
            if inner_msg.get("type") == "assistant":
                nested_events = self._parse_assistant(inner_msg)
        return [SubAgentProgressEvent(
            parent_tool_use_id=parent_id,
            nested_event=nested_events[0] if nested_events else None,
            raw=record,
        )]

    def parse_file(self, path: str, offset: int = 0) -> list[ParsedEvent]:
        """Parse a JSONL file from byte offset. Returns events."""
        events = []
        with open(path, "r") as f:
            f.seek(offset)
            for line in f:
                line = line.strip()
                if line:
                    events.extend(self.parse_line(line))
        return events
```

**Record types handled:**

| JSONL `type` | Subtype/Signal | Parsed To | Activity State |
|---|---|---|---|
| `user` | plain text content | `UserMessageEvent` | — |
| `user` | `tool_result` blocks | `ToolResultEvent` | — |
| `assistant` | `text` blocks | `AssistantTextEvent` | `responding` |
| `assistant` | `tool_use` blocks | `ToolUseEvent` | `tool_use` |
| `assistant` | `tool_use` name=`Task` | `ToolUseEvent(is_task_tool=True)` | sub-agent spawn |
| `system` | `subtype: turn_duration` | `TurnCompleteEvent` | `idle` / `waiting_input` |
| `progress` | `parentToolUseID` present | `SubAgentProgressEvent` | sub-agent active |

**Turn-end detection:** `turn_duration` is the definitive signal, but only appears in tool-using turns. For text-only assistant responses, use a silence timer: if no new JSONL data arrives within `TEXT_IDLE_TIMEOUT_MS` (5000ms) after a text-only assistant block, mark the agent as `waiting_input`. This is how Claude Code's transcript behaves — text-only turns simply stop writing without an explicit end marker.

**Permission detection heuristic:** If `tool_use` appears but no `tool_result` within `PERMISSION_WAIT_TIMEOUT_MS` (7000ms) and no `progress` events arrive → agent is likely waiting for user permission approval.

### 2.2 ClaudeSessionWatcher (`claude_session_watcher.py`, ~250 lines)

```python
import asyncio
import logging
import os
import time
from pathlib import Path
from typing import Callable, Optional
from dataclasses import dataclass, field

from .claude_transcript_parser import ClaudeTranscriptParser, ParsedEvent, AgentActivity, AssistantTextEvent

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
    file_offset: int = 0  # byte offset for incremental reads
    last_activity: AgentActivity = AgentActivity.IDLE
    last_event_time: float = 0.0  # monotonic time
    last_text_only_time: float = 0.0  # when last text-only response was seen
    pending_tool_uses: set = field(default_factory=set)  # tool_use_ids without results
    active_subagents: dict = field(default_factory=dict)  # parent_tool_use_id -> info
    has_pending_tools: bool = False  # True if last events included tool_use


class ClaudeSessionWatcher:
    """
    Watch ~/.claude/projects/*/ for JSONL session file changes.

    Uses a triple-layer file watching strategy for reliability:
    1. Primary: inotify/kqueue via watchdog (fast, event-driven)
    2. Secondary: stat()-based polling every FILE_POLL_INTERVAL_MS (reliable fallback)
    3. Tertiary: asyncio interval as last resort

    All three layers run simultaneously. Any layer can trigger a read.
    Deduplication happens via the file_offset check — we only read when
    stat.size > offset, so duplicate triggers are harmless.

    Session discovery uses directory scanning: every SESSION_SCAN_INTERVAL_MS,
    scan project directories for new .jsonl files. No index file needed.
    """

    def __init__(
        self,
        claude_dir: Path,
        on_events: Optional[Callable[[str, list[ParsedEvent]], None]] = None,
        on_activity_change: Optional[Callable[[str, AgentActivity], None]] = None,
        on_sessions_changed: Optional[Callable[[], None]] = None,
    ):
        self.claude_dir = claude_dir
        self.projects_dir = claude_dir / "projects"
        self.on_events = on_events
        self.on_activity_change = on_activity_change
        self.on_sessions_changed = on_sessions_changed
        self._parser = ClaudeTranscriptParser()
        self._watched: dict[str, WatchedSession] = {}
        self._known_jsonl_files: set[str] = set()  # tracks discovered .jsonl paths
        self._running = False
        self._tasks: list[asyncio.Task] = []
        self._fs_observer = None  # watchdog Observer (optional)

    async def start(self):
        self._running = True
        # Layer 1: Try watchdog for native FS events (best-effort)
        self._try_start_watchdog()
        # Layer 2: stat()-based polling (reliable cross-platform fallback)
        self._tasks.append(asyncio.create_task(self._poll_files_loop()))
        # Layer 3: asyncio interval fallback
        self._tasks.append(asyncio.create_task(self._async_interval_fallback()))
        # Session discovery via directory scanning
        self._tasks.append(asyncio.create_task(self._scan_sessions_loop()))
        # Heuristic timers
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
        """Attempt to start watchdog for native FS events. Non-fatal if unavailable."""
        try:
            from watchdog.observers import Observer
            from watchdog.events import FileSystemEventHandler

            watcher = self

            class JsonlHandler(FileSystemEventHandler):
                def on_modified(self, event):
                    if event.src_path.endswith('.jsonl'):
                        # Trigger a read — deduplication happens via offset check
                        asyncio.get_event_loop().call_soon_threadsafe(
                            watcher._check_file, Path(event.src_path)
                        )

            self._fs_observer = Observer()
            if self.projects_dir.exists():
                self._fs_observer.schedule(JsonlHandler(), str(self.projects_dir), recursive=True)
                self._fs_observer.start()
                logger.info("Watchdog FS observer started (primary file watching layer)")
        except ImportError:
            logger.info("watchdog not installed, using polling only")
        except Exception as e:
            logger.warning(f"Failed to start watchdog: {e}, falling back to polling")

    def discover_project_dirs(self) -> list[Path]:
        """Find all project directories under ~/.claude/projects/."""
        if not self.projects_dir.exists():
            return []
        return [d for d in self.projects_dir.iterdir() if d.is_dir()]

    def discover_sessions(self, project_dir: Path) -> list[tuple[str, Path]]:
        """Scan a project directory for .jsonl session files.
        Returns list of (session_id, jsonl_path) tuples."""
        sessions = []
        try:
            for entry in os.listdir(project_dir):
                if entry.endswith('.jsonl'):
                    session_id = entry[:-6]  # strip .jsonl extension
                    jsonl_path = project_dir / entry
                    sessions.append((session_id, jsonl_path))
        except OSError:
            pass
        return sessions

    def watch_session(self, session_id: str, jsonl_path: Path):
        """Start watching a JSONL file for new lines."""
        if session_id not in self._watched:
            offset = jsonl_path.stat().st_size if jsonl_path.exists() else 0
            self._watched[session_id] = WatchedSession(
                session_id=session_id,
                jsonl_path=jsonl_path,
                file_offset=offset,
            )

    def unwatch_session(self, session_id: str):
        self._watched.pop(session_id, None)

    def _check_file(self, path: Path):
        """Check a specific file for new data. Called by any watching layer."""
        for ws in self._watched.values():
            if ws.jsonl_path == path:
                self._read_new_lines(ws)
                break

    def _read_new_lines(self, ws: WatchedSession):
        """Read new data from a watched session file if available."""
        if not ws.jsonl_path.exists():
            return
        try:
            size = ws.jsonl_path.stat().st_size
        except OSError:
            return
        if size <= ws.file_offset:
            return
        # New data available
        events = self._parser.parse_file(str(ws.jsonl_path), ws.file_offset)
        ws.file_offset = size
        if events:
            self._update_activity(ws, events)
            if self.on_events:
                self.on_events(ws.session_id, events)

    async def _scan_sessions_loop(self):
        """Scan project directories for new .jsonl files every SESSION_SCAN_INTERVAL_MS."""
        while self._running:
            try:
                found_new = False
                for project_dir in self.discover_project_dirs():
                    for session_id, jsonl_path in self.discover_sessions(project_dir):
                        path_key = str(jsonl_path)
                        if path_key not in self._known_jsonl_files:
                            self._known_jsonl_files.add(path_key)
                            self.watch_session(session_id, jsonl_path)
                            found_new = True
                if found_new and self.on_sessions_changed:
                    self.on_sessions_changed()
            except Exception as e:
                logger.error(f"Error scanning sessions: {e}")
            await asyncio.sleep(SESSION_SCAN_INTERVAL_MS / 1000.0)

    async def _poll_files_loop(self):
        """Layer 2: stat()-based polling every FILE_POLL_INTERVAL_MS."""
        while self._running:
            try:
                for ws in list(self._watched.values()):
                    self._read_new_lines(ws)
            except Exception as e:
                logger.error(f"Error polling files: {e}")
            await asyncio.sleep(FILE_POLL_INTERVAL_MS / 1000.0)

    async def _async_interval_fallback(self):
        """Layer 3: asyncio interval as last-resort fallback."""
        while self._running:
            try:
                for ws in list(self._watched.values()):
                    self._read_new_lines(ws)
            except Exception as e:
                logger.error(f"Error in async fallback: {e}")
            await asyncio.sleep(2.0)  # Slower than Layer 2, acts as safety net

    async def _permission_timeout_loop(self):
        """Detect permission-waiting state via timeout heuristic."""
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
        """Detect idle state after text-only responses (no turn_duration emitted)."""
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
        from .claude_transcript_parser import (
            ToolUseEvent, ToolResultEvent, TurnCompleteEvent,
            SubAgentProgressEvent,
        )

        old_activity = ws.last_activity
        ws.last_event_time = time.monotonic()
        ws.last_text_only_time = 0.0  # Reset on any new data

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
                    # Text-only response — start silence timer
                    ws.last_text_only_time = time.monotonic()
            elif isinstance(event, SubAgentProgressEvent):
                pass  # Activity stays as-is; sub-agent is working

        if ws.last_activity != old_activity and self.on_activity_change:
            self.on_activity_change(ws.session_id, ws.last_activity)
```

### 2.3 ClaudeCodeConnection Rewrite (`claude_code.py`, ~400 lines)

Key method signatures:

```python
class ClaudeCodeConnection(AgentConnection):
    def __init__(self, connection_id: str, name: str, config: dict | None = None):
        # config keys: data_dir (str), cli_path (str), project_dirs (list[str])
        self._watcher: ClaudeSessionWatcher  # initialized in connect()
        self._session_cache: dict[str, SessionInfo]  # session_id -> SessionInfo

    async def connect(self) -> bool:
        """Verify claude CLI exists, start ClaudeSessionWatcher."""

    async def disconnect(self) -> None:
        """Stop watcher."""

    async def get_sessions(self) -> list[SessionInfo]:
        """Scan project dirs for .jsonl files, return SessionInfo list."""

    async def get_session_history(self, session_key: str, limit: int = 50) -> list[HistoryMessage]:
        """Parse JSONL file for session, return HistoryMessage list."""

    async def get_status(self) -> dict[str, Any]:
        """Return connection health + number of watched sessions."""

    # Phase 2 (stub in Phase 1):
    async def send_message(self, session_key: str, message: str, ...) -> str | AsyncIterator:
        """Send message via claude --print --resume."""

    async def kill_session(self, session_key: str) -> bool:
        """Kill a managed claude process."""

    # Internal:
    def _on_activity_change(self, session_id: str, activity: AgentActivity):
        """Callback from watcher → broadcast SSE event."""

    def _on_events(self, session_id: str, events: list[ParsedEvent]):
        """Callback from watcher → broadcast SSE events for tools, sub-agents."""

    def _on_sessions_changed(self):
        """Callback when new session files discovered → re-scan and broadcast."""

    def _find_jsonl(self, session_id: str) -> Path | None:
        """Locate the JSONL file for a session across all project dirs."""

    def _infer_status(self, ws: WatchedSession | None) -> str:
        """Infer session status from watcher state."""

    def _parse_history_from_jsonl(self, path: Path, limit: int) -> list[HistoryMessage]:
        """Read JSONL and produce HistoryMessage list (user/assistant messages only)."""
```

### 2.4 SSE Events Emitted

From `_on_activity_change` and `_on_events`, broadcast via existing `broadcast()`:

| SSE Event | Payload | When |
|---|---|---|
| `session-updated` | `SessionInfo.to_dict()` | Session status/activity changes |
| `session-activity` | `{"sessionId", "activity", "toolName?", "toolInput?"}` | Real-time activity state |
| `subagent-spawned` | `{"sessionId", "taskId", "description"}` | Task tool_use detected |
| `subagent-progress` | `{"sessionId", "taskId", "toolName?"}` | Progress record |
| `subagent-completed` | `{"sessionId", "taskId"}` | Task tool_result received |
| `sessions-changed` | `{}` | New session file discovered (frontend should re-fetch list) |

### 2.5 What Phase 1 Enables

- Session list in frontend populated from local Claude Code
- Activity animations on 3D bots (idle/active/thinking/waiting)
- Chat history viewable from JSONL
- Sub-agent visualization (Task tool → minion bot)
- Works alongside OpenClaw connections (ConnectionManager supports both)

### 2.6 Phase 1 Effort Estimate

| Component | Lines | Days |
|---|---|---|
| `claude_transcript_parser.py` | ~150 | 0.5 |
| `claude_session_watcher.py` | ~250 | 1 |
| `claude_code.py` rewrite | ~400 | 1 |
| Integration testing + edge cases | — | 1 |
| **Total** | **~800** | **3-4 days** |

---

## 3. Phase 2 — Spawning & Interactive Chat

### 3.1 ClaudeProcessManager (`claude_process_manager.py`, ~200 lines)

```python
from dataclasses import dataclass
from typing import AsyncIterator, Optional
import asyncio
import uuid


@dataclass
class AgentConfig:
    model: str = "sonnet"
    system_prompt: Optional[str] = None
    append_system_prompt: Optional[str] = None
    working_dir: Optional[str] = None
    permission_mode: str = "bypassPermissions"
    allowed_tools: Optional[list[str]] = None
    mcp_config: Optional[str] = None
    max_budget_usd: Optional[float] = None
    add_dirs: Optional[list[str]] = None


@dataclass
class ManagedProcess:
    session_id: str
    process: asyncio.subprocess.Process
    config: AgentConfig


class ClaudeProcessManager:
    """Spawn and manage claude CLI processes."""

    def __init__(self, cli_path: str = "claude"):
        self.cli_path = cli_path
        self._processes: dict[str, ManagedProcess] = {}

    async def spawn_task(
        self,
        message: str,
        config: AgentConfig,
        session_id: str | None = None,
    ) -> tuple[str, AsyncIterator[dict]]:
        """
        Spawn claude --print for a one-shot task.
        Returns (session_id, stream of JSON records).
        """
        session_id = session_id or str(uuid.uuid4())
        args = self._build_args(config, session_id)
        args.extend(["-p", message])
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        self._processes[session_id] = ManagedProcess(session_id, proc, config)
        return session_id, self._stream_output(session_id, proc)

    async def send_message(
        self,
        session_id: str,
        message: str,
        config: AgentConfig | None = None,
    ) -> AsyncIterator[dict]:
        """
        Send a message to an existing session via claude --print --resume.
        Spawns a new process that continues the session.
        """
        config = config or AgentConfig()
        args = self._build_args(config, session_id=None)
        args.extend(["--resume", session_id, "-p", message])
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        self._processes[session_id] = ManagedProcess(session_id, proc, config)
        return self._stream_output(session_id, proc)

    async def kill(self, session_id: str) -> bool:
        mp = self._processes.get(session_id)
        if mp and mp.process.returncode is None:
            mp.process.terminate()
            try:
                await asyncio.wait_for(mp.process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                mp.process.kill()
            del self._processes[session_id]
            return True
        return False

    def _build_args(self, config: AgentConfig, session_id: str | None) -> list[str]:
        args = [self.cli_path, "--print", "--output-format", "stream-json"]
        if session_id:
            args.extend(["--session-id", session_id])
        args.extend(["--model", config.model])
        if config.system_prompt:
            args.extend(["--system-prompt", config.system_prompt])
        if config.append_system_prompt:
            args.extend(["--append-system-prompt", config.append_system_prompt])
        if config.permission_mode:
            args.extend(["--permission-mode", config.permission_mode])
        if config.allowed_tools:
            args.extend(["--allowedTools", " ".join(config.allowed_tools)])
        if config.mcp_config:
            args.extend(["--mcp-config", config.mcp_config])
        if config.max_budget_usd:
            args.extend(["--max-budget-usd", str(config.max_budget_usd)])
        if config.working_dir:
            args.extend(["--add-dir", config.working_dir])
        if config.add_dirs:
            for d in config.add_dirs:
                args.extend(["--add-dir", d])
        return args

    async def _stream_output(self, session_id: str, proc) -> AsyncIterator[dict]:
        import json
        async for line in proc.stdout:
            line = line.decode().strip()
            if line:
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    pass
        await proc.wait()
        self._processes.pop(session_id, None)
```

### 3.2 Chat Route Changes (`chat.py`)

The existing streaming chat endpoint needs to:
1. Detect when session belongs to a `ClaudeCodeConnection`
2. Call `process_manager.send_message(session_id, message)` instead of OpenClaw WS
3. Stream `stream-json` records back as SSE chunks

The JSONL file watcher (Phase 1) continues running in parallel — it picks up the same data from the filesystem, keeping activity state accurate.

### 3.3 Context Envelope Integration

Currently `context_envelope.py` builds a system prompt string. For Claude Code:

```python
# In ClaudeCodeConnection.send_message():
envelope = build_context_envelope(agent_config, room_config)
config = AgentConfig(append_system_prompt=envelope)
stream = await self._process_manager.send_message(session_id, message, config)
```

### 3.4 DB Schema (Phase 2)

```sql
CREATE TABLE IF NOT EXISTS claude_processes (
    session_id TEXT PRIMARY KEY,
    pid INTEGER,
    status TEXT DEFAULT 'running',  -- running, stopped, crashed
    model TEXT,
    working_dir TEXT,
    started_at INTEGER,
    stopped_at INTEGER,
    cost_usd REAL DEFAULT 0,
    agent_id TEXT REFERENCES agents(id)
);
```

### 3.5 Phase 2 Effort Estimate

| Component | Days |
|---|---|
| `claude_process_manager.py` | 1.5 |
| `chat.py` changes + streaming | 1 |
| Context envelope adaptation | 0.5 |
| DB migration | 0.5 |
| Testing (spawn, resume, kill) | 1 |
| **Total** | **4-5 days** |

---

## 4. Integration Points

### 4.1 ConnectionManager Registration

No changes needed. The existing pattern works:

```python
# In startup / connection creation:
conn = ClaudeCodeConnection(
    connection_id="local-claude",
    name="Claude Code (local)",
    config={"data_dir": "~/.claude", "cli_path": "claude"},
)
manager.add_connection(conn)
```

Both OpenClaw and ClaudeCode connections can coexist. The frontend receives `SessionInfo` objects with `source: "claude_code"` vs `source: "openclaw"` — it doesn't care.

### 4.2 Session Key Format

`claude:{session_id}` — e.g., `claude:a1b2c3d4-e5f6-...`

This matches the existing `{source}:{id}` convention used by OpenClaw sessions.

### 4.3 Onboarding / Auto-Detection

On startup, `ClaudeCodeConnection.connect()`:
1. Check if `claude` CLI exists (`shutil.which("claude")`)
2. Check if `~/.claude/projects/` exists and has content
3. If both → `ConnectionStatus.CONNECTED`
4. If CLI missing → `ConnectionStatus.ERROR` with message "Claude Code CLI not found"

### 4.4 Frontend Changes (None for Phase 1)

The frontend already handles:
- Session list from any connection type
- Activity state mapping to 3D animations
- Chat history display from `HistoryMessage` format

The only frontend work would be for sub-agent visualization (new SSE events), but the 3D bot spawning may already support dynamic characters.

---

## 5. Claude Code Bridge — Architecture Overview

### Component Mapping

| Component | File | Responsibility |
|---|---|---|
| `ClaudeTranscriptParser` | `claude_transcript_parser.py` | JSONL parsing logic, record type handling |
| `ClaudeSessionWatcher` | `claude_session_watcher.py` | Triple-layer file watching, session discovery via directory scanning |
| `ClaudeSessionWatcher` | (same) | Activity state machine, permission/idle timeout heuristics |
| `ClaudeProcessManager` | `claude_process_manager.py` | CLI process spawning and lifecycle (Phase 2) |
| `ClaudeCodeConnection` | `claude_code.py` | Integration layer connecting all components to CrewHub |

### Key Design Decisions

1. **Triple-layer file watching** — `watchdog` (kqueue/inotify) + `stat()` polling + asyncio interval all run simultaneously. Any layer can trigger reads. Deduplication is automatic via the byte offset check (`stat.size > offset`). This ensures reliability across macOS, Linux, and edge cases where native FS events are delayed or lost.
2. **Session discovery via directory scanning** — scan `~/.claude/projects/{hash}/` for `.jsonl` files every `SESSION_SCAN_INTERVAL_MS`. New files that haven't been seen before are automatically watched. Simple and reliable.
3. **Permission timeout = 7s** after `tool_use` with no `tool_result` or `progress`
4. **Text-only idle timeout = 5s** — `turn_duration` records only appear after tool-using turns. For text-only responses, silence of 5s indicates the turn is complete.
5. **Project dir slug** = `workspace_path.replace(/[^a-zA-Z0-9-]/g, '-')` → match in `~/.claude/projects/`

### What This Does NOT Include

- VS Code integration (we use the standalone CLI)
- Terminal UI rendering (we have React+Three.js)
- Sprite/pixel animations (we have 3D bots)

---

## 6. Risks and Open Questions

### Confirmed Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **macOS kqueue unreliable for some setups** | Medium | Triple-layer watching ensures at least `stat()` polling always works |
| **JSONL format undocumented, could change** | Low-Medium | Defensive parsing (ignore unknown types). Format is stable — widely relied upon by the community. |
| **Permission detection is heuristic** | Low | 7s timeout is well-tested. Good enough. |
| **Process leak if CrewHub crashes** | Medium | Track PIDs in SQLite, cleanup on startup. |
| **`--resume` spawns new process per message** | Low | Acceptable for interactive use. Process exits after response. |

### Open Questions

1. **`--continue` vs `--resume`** — are these the same flag? Need to verify against latest `claude --help`. Both mentioned in docs.

2. **`stream-json` input format exact schema** — the analysis says `{"type":"user","message":"..."}` but this needs verification. If it doesn't work, fall back to `--resume` per-message.

3. **Cost tracking** — `stream-json` result records include `cost_usd`. Should we aggregate per session? Per day? Where to display in UI?

4. **Multi-project room mapping** — should each `~/.claude/projects/{slug}/` map to a CrewHub room automatically? Or let users configure?

5. **Session staleness** — how long to keep watching a session JSONL? We should stop watching sessions with no activity for >1 hour.

---

## 7. Effort Summary

| Phase | Scope | Effort | Dependencies |
|---|---|---|---|
| **Phase 1: Read-only monitoring** | ClaudeSessionWatcher, ClaudeTranscriptParser, ClaudeCodeConnection rewrite | **3-4 days** | None |
| **Phase 2: Spawning & chat** | ClaudeProcessManager, chat route changes, DB migration | **4-5 days** | Phase 1 |
| **Phase 3: Cron & scheduled tasks** | CronScheduler, cron_jobs table, APScheduler | **2-3 days** | Phase 2 |
| **Phase 4: Sub-agent 3D visualization** | Frontend SSE handling, dynamic bot spawning | **2-3 days** | Phase 1 |
| **Total** | | **11-15 days** | |

Phase 1 is the MVP. After Phase 1, CrewHub works standalone for monitoring. Phases 2-4 are independent of each other and can be parallelized.

---

## Quick Start for Implementer

1. Create `backend/app/services/connections/claude_transcript_parser.py` — copy the class from §2.1
2. Create `backend/app/services/connections/claude_session_watcher.py` — copy from §2.2
3. Rewrite `backend/app/services/connections/claude_code.py` using signatures from §2.3
4. Test: start CrewHub, open a `claude` session in terminal, verify sessions appear in UI
5. Verify: activity state changes visible on 3D bot when claude is active vs idle
