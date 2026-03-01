"""Parse Claude Code JSONL transcript lines into typed events."""

import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


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
class ThinkingEvent(ParsedEvent):
    event_type: str = "thinking"
    thinking: str = ""


@dataclass
class ToolUseEvent(ParsedEvent):
    event_type: str = "tool_use"
    tool_name: str = ""
    tool_use_id: str = ""
    input_data: dict = field(default_factory=dict)
    is_task_tool: bool = False


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


@dataclass
class ProjectContextEvent(ParsedEvent):
    event_type: str = "project_context"
    cwd: str = ""
    project_name: str = ""


@dataclass
class SummaryEvent(ParsedEvent):
    event_type: str = "summary"
    summary: str = ""


@dataclass
class BashProgressEvent(ParsedEvent):
    event_type: str = "bash_progress"
    command: str = ""
    output: str = ""


@dataclass
class HookProgressEvent(ParsedEvent):
    event_type: str = "hook_progress"
    hook_name: str = ""


def project_name_from_cwd(cwd: str) -> str:
    """Extract project name from a working directory path.

    Example: '/Users/nicky/ekinapps/crewhub' -> 'crewhub'
    """
    if not cwd:
        return ""
    # Strip trailing slashes and get basename
    return cwd.rstrip("/").rsplit("/", 1)[-1] or ""


class ClaudeTranscriptParser:
    """Parse Claude Code JSONL transcript lines into typed events."""

    def __init__(self) -> None:
        self._last_cwd: str = ""

    def parse_line(self, line: str) -> list[ParsedEvent]:
        """Parse a single JSONL line. Returns list of events."""
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            return []

        events = []

        record_type = record.get("type")
        if record_type == "assistant":
            events.extend(self._parse_assistant(record))
        elif record_type == "user":
            events.extend(self._parse_user(record))
        elif record_type == "system":
            events.extend(self._parse_system(record))
        elif record_type == "progress":
            events.extend(self._parse_progress(record))
        elif record_type == "summary":
            events.extend(self._parse_summary(record))
        elif record_type in ("file-history-snapshot", "queue-operation"):
            pass

        # Claude Code v2.x embeds cwd on every line rather than a system/init event
        if not any(isinstance(e, ProjectContextEvent) for e in events):
            cwd = record.get("cwd", "")
            if cwd and cwd != self._last_cwd:
                self._last_cwd = cwd
                events.append(
                    ProjectContextEvent(
                        cwd=cwd,
                        project_name=project_name_from_cwd(cwd),
                        raw=record,
                    )
                )

        return events

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
            elif block.get("type") == "thinking":
                events.append(ThinkingEvent(thinking=block.get("thinking", ""), raw=record))
            elif block.get("type") == "tool_use":
                events.append(
                    ToolUseEvent(
                        tool_name=block.get("name", ""),
                        tool_use_id=block.get("id", ""),
                        input_data=block.get("input", {}),
                        is_task_tool=block.get("name") == "Task",
                        raw=record,
                    )
                )
        return events

    def _parse_user(self, record: dict) -> list[ParsedEvent]:
        events = []
        message = record.get("message", {})
        content = message.get("content", "")
        if isinstance(content, str):
            return [UserMessageEvent(content=content, raw=record)]
        for block in content:
            if block.get("type") == "tool_result":
                events.append(
                    ToolResultEvent(
                        tool_use_id=block.get("tool_use_id", ""),
                        content=str(block.get("content", ""))[:200],
                        raw=record,
                    )
                )
            elif isinstance(block, dict) and block.get("type") == "text":
                events.append(UserMessageEvent(content=block.get("text", ""), raw=record))
        return events

    def _parse_system(self, record: dict) -> list[ParsedEvent]:
        subtype = record.get("subtype")
        if subtype == "turn_duration":
            return [TurnCompleteEvent(duration_ms=record.get("durationMs", 0), raw=record)]
        if subtype == "init":
            cwd = record.get("cwd", "")
            if cwd:
                return [
                    ProjectContextEvent(
                        cwd=cwd,
                        project_name=project_name_from_cwd(cwd),
                        raw=record,
                    )
                ]
        return []

    def _parse_summary(self, record: dict) -> list[ParsedEvent]:
        return [SummaryEvent(summary=record.get("summary", ""), raw=record)]

    def _parse_progress(self, record: dict) -> list[ParsedEvent]:
        parent_id = record.get("parentToolUseID", "")
        nested = record.get("data", {})
        nested_type = nested.get("type", "")

        if nested_type == "bash_progress":
            return [
                BashProgressEvent(
                    command=nested.get("command", ""),
                    output=nested.get("output", ""),
                    raw=record,
                )
            ]
        if nested_type == "hook_progress":
            return [
                HookProgressEvent(
                    hook_name=nested.get("hookName", ""),
                    raw=record,
                )
            ]

        nested_events = []
        if nested_type == "agent_progress":
            inner_msg = nested.get("message", {})
            if inner_msg.get("type") == "assistant":
                nested_events = self._parse_assistant(inner_msg)
        return [
            SubAgentProgressEvent(
                parent_tool_use_id=parent_id,
                nested_event=nested_events[0] if nested_events else None,
                raw=record,
            )
        ]

    def parse_file(self, path: str, offset: int = 0) -> tuple[list[ParsedEvent], int]:
        """Parse a JSONL file from byte offset.

        Returns (events, new_byte_offset). Only complete lines (terminated
        by ``\\n``) are consumed so a partial trailing line is left for the
        next call.
        """
        events: list[ParsedEvent] = []
        with open(path, "rb") as f:
            f.seek(offset)
            raw = f.read()
        if not raw:
            return [], offset
        # Only consume up to the last complete line
        last_nl = raw.rfind(b"\n")
        if last_nl == -1:
            return [], offset  # no complete line yet
        consumed = raw[: last_nl + 1]
        new_offset = offset + len(consumed)
        text = consumed.decode("utf-8", errors="replace")
        for line in text.splitlines():
            line = line.strip()
            if line:
                events.extend(self.parse_line(line))
        return events, new_offset
