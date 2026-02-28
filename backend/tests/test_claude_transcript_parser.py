"""Tests for ClaudeTranscriptParser."""

# Direct file import to avoid circular import through __init__.py
import importlib.util as _ilu
import json
import os
import tempfile

_spec = _ilu.spec_from_file_location(
    "claude_transcript_parser",
    os.path.join(os.path.dirname(__file__), "..", "app", "services", "connections", "claude_transcript_parser.py"),
)
_mod = _ilu.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
ClaudeTranscriptParser = _mod.ClaudeTranscriptParser
AgentActivity = _mod.AgentActivity
AssistantTextEvent = _mod.AssistantTextEvent
ToolUseEvent = _mod.ToolUseEvent
ToolResultEvent = _mod.ToolResultEvent
TurnCompleteEvent = _mod.TurnCompleteEvent
SubAgentProgressEvent = _mod.SubAgentProgressEvent
UserMessageEvent = _mod.UserMessageEvent

parser = ClaudeTranscriptParser()


def test_parse_empty_line():
    assert parser.parse_line("") == []


def test_parse_invalid_json():
    assert parser.parse_line("not json {{{") == []


def test_parse_unknown_type():
    assert parser.parse_line('{"type": "unknown_thing"}') == []


def test_assistant_text_event():
    line = json.dumps(
        {
            "type": "assistant",
            "message": {"model": "claude-sonnet-4-20250514", "content": [{"type": "text", "text": "Hello world"}]},
        }
    )
    events = parser.parse_line(line)
    assert len(events) == 1
    assert isinstance(events[0], AssistantTextEvent)
    assert events[0].text == "Hello world"
    assert events[0].model == "claude-sonnet-4-20250514"


def test_assistant_tool_use_event():
    line = json.dumps(
        {
            "type": "assistant",
            "message": {
                "content": [{"type": "tool_use", "id": "tu_123", "name": "Read", "input": {"path": "/tmp/test.txt"}}]
            },
        }
    )
    events = parser.parse_line(line)
    assert len(events) == 1
    assert isinstance(events[0], ToolUseEvent)
    assert events[0].tool_name == "Read"
    assert events[0].tool_use_id == "tu_123"
    assert events[0].is_task_tool is False


def test_assistant_task_tool():
    line = json.dumps(
        {
            "type": "assistant",
            "message": {
                "content": [
                    {"type": "tool_use", "id": "tu_task", "name": "Task", "input": {"description": "Do something"}}
                ]
            },
        }
    )
    events = parser.parse_line(line)
    assert len(events) == 1
    assert isinstance(events[0], ToolUseEvent)
    assert events[0].is_task_tool is True


def test_assistant_mixed_content():
    line = json.dumps(
        {
            "type": "assistant",
            "message": {
                "content": [
                    {"type": "text", "text": "Let me read that"},
                    {"type": "tool_use", "id": "tu_1", "name": "Read", "input": {}},
                ]
            },
        }
    )
    events = parser.parse_line(line)
    assert len(events) == 2
    assert isinstance(events[0], AssistantTextEvent)
    assert isinstance(events[1], ToolUseEvent)


def test_assistant_string_content():
    line = json.dumps({"type": "assistant", "message": {"content": "Simple string response"}})
    events = parser.parse_line(line)
    assert len(events) == 1
    assert isinstance(events[0], AssistantTextEvent)
    assert events[0].text == "Simple string response"


def test_user_text_message():
    line = json.dumps({"type": "user", "message": {"content": "Fix the bug please"}})
    events = parser.parse_line(line)
    assert len(events) == 1
    assert isinstance(events[0], UserMessageEvent)
    assert events[0].content == "Fix the bug please"


def test_user_tool_result():
    line = json.dumps(
        {
            "type": "user",
            "message": {"content": [{"type": "tool_result", "tool_use_id": "tu_123", "content": "file contents here"}]},
        }
    )
    events = parser.parse_line(line)
    assert len(events) == 1
    assert isinstance(events[0], ToolResultEvent)
    assert events[0].tool_use_id == "tu_123"


def test_user_mixed_content():
    line = json.dumps(
        {
            "type": "user",
            "message": {
                "content": [
                    {"type": "tool_result", "tool_use_id": "tu_1", "content": "ok"},
                    {"type": "text", "text": "Continue please"},
                ]
            },
        }
    )
    events = parser.parse_line(line)
    assert len(events) == 2
    assert isinstance(events[0], ToolResultEvent)
    assert isinstance(events[1], UserMessageEvent)


def test_system_turn_duration():
    line = json.dumps({"type": "system", "subtype": "turn_duration", "durationMs": 5432})
    events = parser.parse_line(line)
    assert len(events) == 1
    assert isinstance(events[0], TurnCompleteEvent)
    assert events[0].duration_ms == 5432


def test_system_unknown_subtype():
    line = json.dumps({"type": "system", "subtype": "something_else"})
    assert parser.parse_line(line) == []


def test_progress_with_nested_assistant():
    line = json.dumps(
        {
            "type": "progress",
            "parentToolUseID": "tu_parent",
            "data": {
                "type": "agent_progress",
                "message": {
                    "type": "assistant",
                    "message": {"content": [{"type": "text", "text": "Sub-agent working"}]},
                },
            },
        }
    )
    events = parser.parse_line(line)
    assert len(events) == 1
    assert isinstance(events[0], SubAgentProgressEvent)
    assert events[0].parent_tool_use_id == "tu_parent"
    assert isinstance(events[0].nested_event, AssistantTextEvent)


def test_progress_without_nested():
    line = json.dumps({"type": "progress", "parentToolUseID": "tu_x", "data": {"type": "other"}})
    events = parser.parse_line(line)
    assert len(events) == 1
    assert isinstance(events[0], SubAgentProgressEvent)
    assert events[0].nested_event is None


def test_parse_file_with_offset():
    lines = [
        json.dumps({"type": "user", "message": {"content": "first"}}),
        json.dumps({"type": "user", "message": {"content": "second"}}),
    ]
    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        f.write(lines[0] + "\n")
        offset = f.tell()
        f.write(lines[1] + "\n")
        path = f.name
    try:
        events = parser.parse_file(path, offset=offset)
        assert len(events) == 1
        assert isinstance(events[0], UserMessageEvent)
        assert events[0].content == "second"
    finally:
        os.unlink(path)


def test_tool_result_content_truncation():
    long_content = "x" * 500
    line = json.dumps(
        {
            "type": "user",
            "message": {"content": [{"type": "tool_result", "tool_use_id": "tu_long", "content": long_content}]},
        }
    )
    events = parser.parse_line(line)
    assert len(events[0].content) == 200
