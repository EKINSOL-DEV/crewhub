"""
Claude Code CLI connection — watches local ~/.claude sessions.

Reads JSONL transcript files, tracks activity, broadcasts SSE events.
"""

import asyncio
import logging
import os
import shutil
import time
from pathlib import Path
from typing import Any, Optional

from .base import (
    AgentConnection,
    ConnectionStatus,
    ConnectionType,
    HistoryMessage,
    SessionInfo,
)
from .claude_session_watcher import ClaudeSessionWatcher, _humanize_tool
from .claude_transcript_parser import (
    AgentActivity,
    AssistantTextEvent,
    ClaudeTranscriptParser,
    ParsedEvent,
    ProjectContextEvent,
    SubAgentProgressEvent,
    ThinkingEvent,
    ToolResultEvent,
    ToolUseEvent,
    UserMessageEvent,
)

logger = logging.getLogger(__name__)


def _extract_timestamp(ev: ParsedEvent) -> Optional[int]:
    """Extract timestamp (epoch ms) from a ParsedEvent's raw dict.

    The raw dict stores ``"timestamp"`` as either an ISO-8601 string or a
    numeric epoch value (seconds or milliseconds).  Returns epoch ms or None.
    """
    ts = ev.raw.get("timestamp")
    if ts is None:
        return None
    if isinstance(ts, str):
        try:
            from datetime import datetime

            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            return int(dt.timestamp() * 1000)
        except (ValueError, TypeError):
            return None
    if isinstance(ts, (int, float)):
        # If the value looks like seconds (< 1e12), convert to ms
        if ts < 1e12:
            return int(ts * 1000)
        return int(ts)
    return None


class ClaudeCodeConnection(AgentConnection):
    """
    Connection to Claude Code CLI.

    Discovers and monitors local Claude Code sessions by watching
    ~/.claude/projects/*/*.jsonl transcript files.

    Config:
        data_dir:  Path to Claude data dir (default: ~/.claude)
        cli_path:  Path to claude executable (default: auto-detect)
    """

    def __init__(
        self,
        connection_id: str,
        name: str,
        config: Optional[dict[str, Any]] = None,
    ) -> None:
        config = config or {}
        super().__init__(
            connection_id=connection_id,
            name=name,
            connection_type=ConnectionType.CLAUDE_CODE,
            config=config,
        )

        self.data_dir = Path(os.path.expanduser(config.get("data_dir", "~/.claude")))
        self.cli_path: Optional[str] = config.get("cli_path", shutil.which("claude"))
        self._parser = ClaudeTranscriptParser()
        self._watcher: Optional[ClaudeSessionWatcher] = None

        logger.info(
            "ClaudeCodeConnection init: data_dir=%s cli_path=%s",
            self.data_dir,
            self.cli_path,
        )

    # ── Connection lifecycle ─────────────────────────────────────

    async def connect(self) -> bool:
        """Start watching Claude Code sessions."""
        self.status = ConnectionStatus.CONNECTING

        # CLI is optional — only needed for spawning new sessions, not for file watching
        if not self.cli_path:
            logger.warning("Claude CLI not found in PATH — watch-only mode (cannot start new sessions)")

        if not self.data_dir.exists():
            self._set_error(f"Claude data dir not found: {self.data_dir}")
            return False

        try:
            self._watcher = ClaudeSessionWatcher(
                claude_dir=self.data_dir,
                on_events=self._on_events,
                on_activity_change=self._on_activity_change,
                on_sessions_changed=self._on_sessions_changed,
            )
            await self._watcher.start()
            self.status = ConnectionStatus.CONNECTED
            logger.info("ClaudeCodeConnection connected, watching %s", self.data_dir)
            return True
        except Exception as e:
            self._set_error(str(e))
            return False

    async def disconnect(self) -> None:
        """Stop the session watcher."""
        if self._watcher:
            await self._watcher.stop()
            self._watcher = None
        self.status = ConnectionStatus.DISCONNECTED
        logger.info("ClaudeCodeConnection disconnected")

    # ── Sessions ─────────────────────────────────────────────────

    # Only show sessions active within this window
    SESSION_RECENCY_SECONDS = 30 * 60  # 30 minutes

    async def get_sessions(self) -> list[SessionInfo]:
        """Return discovered Claude Code sessions active within the last 30 minutes.

        Sessions claimed by a fixed CC agent are emitted under the agent's
        session key instead of the standalone ``claude:<uuid>`` key, so the
        frontend shows a single entry with live activity.
        """
        if not self.is_connected() or not self._watcher:
            return []

        sessions = []
        now = time.time()
        now_ms = int(now * 1000)
        cutoff = now - self.SESSION_RECENCY_SECONDS

        # Build a map of session_id → agent info for claimed sessions
        claimed = await self._get_agent_session_map()

        for sid, ws in self._watcher.get_watched_sessions().items():
            # Skip sessions with no activity in the recency window
            if ws.last_event_wall_time and ws.last_event_wall_time < cutoff:
                continue

            last_ms = int(ws.last_event_wall_time * 1000) if ws.last_event_wall_time else now_ms

            agent_info = claimed.get(sid)
            if agent_info:
                # Emit as agent session (absorbs the discovered session)
                sessions.append(
                    SessionInfo(
                        key=agent_info["agent_session_key"],
                        session_id=sid,
                        source="claude_code",
                        connection_id=self.connection_id,
                        agent_id=agent_info["agent_id"],
                        channel="cli",
                        label=agent_info["agent_name"],
                        status=ws.last_activity.value,
                        last_activity=last_ms,
                        metadata={
                            "updatedAt": last_ms,
                            "kind": "subagent" if ws.is_subagent else "session",
                            "projectPath": ws.project_path,
                        },
                    )
                )
            else:
                # Normal discovered session (not claimed by any agent)
                sessions.append(
                    SessionInfo(
                        key=f"claude:{sid}",
                        session_id=sid,
                        source="claude_code",
                        connection_id=self.connection_id,
                        agent_id="main",
                        channel="cli",
                        label=(f"{ws.project_name} ({sid[:6]})" if ws.project_name else f"Claude Code {sid[:8]}"),
                        status=ws.last_activity.value,
                        last_activity=last_ms,
                        metadata={
                            "updatedAt": last_ms,
                            "kind": "subagent" if ws.is_subagent else "session",
                            "projectPath": ws.project_path,
                        },
                    )
                )
        return sessions

    async def _get_agent_session_map(self) -> dict:
        """Return {session_id: {agent_session_key, agent_name, agent_id}} for claimed sessions."""
        try:
            from ...db.database import get_db

            async with get_db() as db:
                async with db.execute(
                    "SELECT id, agent_session_key, current_session_id, name "
                    "FROM agents WHERE source = 'claude_code' AND current_session_id IS NOT NULL"
                ) as cursor:
                    rows = await cursor.fetchall()
            return {
                row["current_session_id"]: {
                    "agent_session_key": row["agent_session_key"],
                    "agent_name": row["name"],
                    "agent_id": row["id"],
                }
                for row in rows
            }
        except Exception as exc:
            logger.debug("Failed to load agent session map: %s", exc)
            return {}

    async def get_session_history(
        self,
        session_key: str,
        limit: int = 50,
    ) -> list[HistoryMessage]:
        """Parse JSONL transcript into history messages."""
        if not self.is_connected() or not self._watcher:
            return []

        # Strip claude: or cc: prefix and resolve to real session_id
        if session_key.startswith("cc:"):
            # Agent session key — look up the real session_id
            from ...services.cc_chat import _agent_sessions

            agent_id = session_key.removeprefix("cc:")
            sid = _agent_sessions.get(agent_id)
            if not sid:
                return []
        else:
            sid = session_key.removeprefix("claude:")
        ws = self._watcher.get_watched_sessions().get(sid)
        if not ws or not ws.jsonl_path.exists():
            return []

        events, _ = self._parser.parse_file(str(ws.jsonl_path))
        messages: list[HistoryMessage] = []
        for ev in events:
            ts = _extract_timestamp(ev)

            if isinstance(ev, AssistantTextEvent):
                messages.append(
                    HistoryMessage(
                        role="assistant",
                        content=ev.text,
                        timestamp=ts,
                        metadata={"model": ev.model} if ev.model else {},
                    )
                )
            elif isinstance(ev, UserMessageEvent):
                messages.append(HistoryMessage(role="user", content=ev.content, timestamp=ts))
            elif isinstance(ev, ThinkingEvent):
                messages.append(
                    HistoryMessage(
                        role="assistant",
                        content="",
                        timestamp=ts,
                        metadata={"type": "thinking", "thinking": ev.thinking},
                    )
                )
            elif isinstance(ev, ToolUseEvent):
                messages.append(
                    HistoryMessage(
                        role="assistant",
                        content=f"[Tool: {ev.tool_name}]",
                        timestamp=ts,
                        metadata={
                            "type": "tool_use",
                            "tool_name": ev.tool_name,
                            "tool_use_id": ev.tool_use_id,
                            "input_data": ev.input_data,
                        },
                    )
                )
            elif isinstance(ev, ToolResultEvent):
                messages.append(
                    HistoryMessage(
                        role="tool",
                        content=ev.content,
                        timestamp=ts,
                        metadata={
                            "type": "tool_result",
                            "tool_use_id": ev.tool_use_id,
                        },
                    )
                )
            elif isinstance(ev, SubAgentProgressEvent):
                if ev.nested_event and isinstance(ev.nested_event, AssistantTextEvent):
                    messages.append(
                        HistoryMessage(
                            role="assistant",
                            content=ev.nested_event.text,
                            timestamp=ts,
                            metadata={
                                "type": "subagent",
                                "parent_tool_use_id": ev.parent_tool_use_id,
                            },
                        )
                    )

        return messages[-limit:]

    async def get_status(self) -> dict[str, Any]:
        """Return connection health info."""
        watched = {}
        if self._watcher:
            watched = {sid: ws.last_activity.value for sid, ws in self._watcher.get_watched_sessions().items()}
        return {
            "connection_id": self.connection_id,
            "name": self.name,
            "type": self.connection_type.value,
            "status": self._status.value,
            "data_dir": str(self.data_dir),
            "cli_path": self.cli_path,
            "sessions": watched,
        }

    async def send_message(
        self,
        session_key: str,
        message: str,
        timeout: float = 90.0,
    ) -> Optional[str]:
        """Send a message to a Claude Code session."""
        from ...services.cc_chat import send_cc_blocking, send_cc_discovered_blocking

        try:
            if session_key.startswith("cc:"):
                agent_id = session_key.removeprefix("cc:")
                return await asyncio.wait_for(
                    send_cc_blocking(agent_id, message),
                    timeout=timeout,
                )
            elif session_key.startswith("claude:"):
                session_id = session_key.removeprefix("claude:")
                ws = (
                    self._watcher.get_watched_sessions().get(session_id)
                    if self._watcher
                    else None
                )
                if not ws or not ws.project_path:
                    logger.warning("Cannot resolve project_path for session %s", session_id)
                    return None
                return await asyncio.wait_for(
                    send_cc_discovered_blocking(session_id, ws.project_path, message),
                    timeout=timeout,
                )
            else:
                return None
        except asyncio.TimeoutError:
            logger.warning("send_message timed out for %s (%.0fs)", session_key, timeout)
            return None
        except Exception as exc:
            logger.error("send_message failed for %s: %s", session_key, exc)
            return None

    async def kill_session(self, session_key: str) -> bool:
        """Kill a Claude Code session (Phase 2)."""
        logger.warning("kill_session not yet implemented for Claude Code")
        return False

    async def health_check(self) -> bool:
        """Check if watcher is running and CLI is available."""
        if not self.is_connected():
            return False
        return self.data_dir.exists()

    # ── Watcher callbacks ────────────────────────────────────────

    def _on_events(self, session_id: str, events: list[ParsedEvent]) -> None:
        """New events from a session transcript."""
        try:
            from ...routes.sse import broadcast

            # Check if this session is claimed by an agent
            from ...services.cc_chat import _agent_sessions

            agent_key = None
            for aid, sid in _agent_sessions.items():
                if sid == session_id:
                    agent_key = f"cc:{aid}"
                    break

            session_key = agent_key or f"claude:{session_id}"

            for ev in events[-5:]:  # Limit broadcast volume
                event_data = {
                    "sessionKey": session_key,
                    "eventType": ev.event_type,
                    "source": "claude_code",
                }
                if isinstance(ev, ToolUseEvent):
                    event_data["toolName"] = ev.tool_name
                    event_data["detail"] = _humanize_tool(ev.tool_name, ev.input_data)
                asyncio.get_event_loop().create_task(
                    broadcast("session-event", event_data)
                )
                # Auto room assignment on project context
                if isinstance(ev, ProjectContextEvent) and ev.project_name:
                    # Only auto-assign once per session (avoid firing on every JSONL line in v2.x)
                    ws = self._watcher.get_watched_sessions().get(session_id) if self._watcher else None
                    if ws and not ws.project_name:
                        asyncio.get_event_loop().create_task(self._auto_assign_room(session_id, ev.project_name))
        except Exception:
            pass

    async def _auto_assign_room(self, session_id: str, project_name: str) -> None:
        """Try to auto-assign session to a room based on project name."""
        try:
            from ...services.room_service import get_or_create_project_rule

            room_id = await get_or_create_project_rule(project_name)
            if room_id:
                import time

                from ...db.database import get_db

                session_key = f"claude:{session_id}"
                async with get_db() as db:
                    now = int(time.time() * 1000)
                    await db.execute(
                        """INSERT INTO session_room_assignments (session_key, room_id, assigned_at)
                           VALUES (?, ?, ?)
                           ON CONFLICT(session_key) DO UPDATE SET room_id = excluded.room_id, assigned_at = excluded.assigned_at""",
                        (session_key, room_id, now),
                    )
                    await db.commit()

                from ...routes.sse import broadcast

                await broadcast(
                    "rooms-refresh",
                    {
                        "action": "assignment_changed",
                        "session_key": session_key,
                        "room_id": room_id,
                    },
                )
                logger.info("Auto-assigned session %s to room %s", session_id, room_id)
        except Exception as e:
            logger.debug("Auto room assignment failed for %s: %s", session_id, e)

    def _on_activity_change(self, session_id: str, activity: AgentActivity) -> None:
        """Activity state changed for a session."""
        try:
            from ...routes.sse import broadcast

            sessions = list(self._watcher.get_watched_sessions().values()) if self._watcher else []
            ws = next((s for s in sessions if s.session_id == session_id), None)
            if ws:
                # Check if this session is claimed by an agent (in-memory fast path)
                from ...services.cc_chat import _agent_sessions

                agent_key = None
                for aid, sid in _agent_sessions.items():
                    if sid == session_id:
                        agent_key = f"cc:{aid}"
                        break

                session_key = agent_key or f"claude:{session_id}"

                si = SessionInfo(
                    key=session_key,
                    session_id=session_id,
                    source="claude_code",
                    connection_id=self.connection_id,
                    status=activity.value,
                )
                self._notify_session_update(si)
                payload = {
                    "sessionKey": session_key,
                    "status": activity.value,
                    "source": "claude_code",
                }
                if ws and ws.project_name:
                    payload["project_name"] = ws.project_name
                if ws and ws.activity_detail:
                    payload["activity_detail"] = ws.activity_detail
                if ws and ws.activity_tool_name:
                    payload["activity_tool_name"] = ws.activity_tool_name
                asyncio.get_event_loop().create_task(broadcast("session-updated", payload))
        except Exception:
            pass

    def _on_sessions_changed(self) -> None:
        """New sessions discovered or removed."""
        try:
            from ...routes.sse import broadcast

            asyncio.get_event_loop().create_task(broadcast("sessions-changed", {"source": "claude_code"}))
        except Exception:
            pass
