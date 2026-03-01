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
ProjectContextEvent = _mod.ProjectContextEvent
SummaryEvent = _mod.SummaryEvent
BashProgressEvent = _mod.BashProgressEvent
HookProgressEvent = _mod.HookProgressEvent

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
        events, _ = parser.parse_file(path, offset=offset)
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


def test_parse_summary_event():
    line = json.dumps({"type": "summary", "summary": "Refactored the login module"})
    p = ClaudeTranscriptParser()
    events = p.parse_line(line)
    assert len(events) == 1
    assert isinstance(events[0], SummaryEvent)
    assert events[0].summary == "Refactored the login module"


def test_parse_file_history_no_extra_event():
    """file-history-snapshot should not produce a ProjectContextEvent."""
    line = json.dumps({"type": "file-history-snapshot", "cwd": "/tmp/proj"})
    p = ClaudeTranscriptParser()
    events = p.parse_line(line)
    # cwd dedup: first time seeing this cwd so one ProjectContextEvent is fine,
    # but no *extra* fallthrough event beyond the explicit pass
    ctx_events = [e for e in events if isinstance(e, ProjectContextEvent)]
    # The explicit pass prevents double-emit; only the cwd dedup section may emit
    assert len(ctx_events) <= 1
    # Crucially, no non-ProjectContext events should be produced
    non_ctx = [e for e in events if not isinstance(e, ProjectContextEvent)]
    assert non_ctx == []


def test_parse_bash_progress():
    line = json.dumps(
        {
            "type": "progress",
            "parentToolUseID": "tu_1",
            "data": {"type": "bash_progress", "command": "ls -la", "output": "total 42"},
        }
    )
    p = ClaudeTranscriptParser()
    events = p.parse_line(line)
    assert len(events) == 1
    assert isinstance(events[0], BashProgressEvent)
    assert events[0].command == "ls -la"
    assert events[0].output == "total 42"


def test_parse_hook_progress():
    line = json.dumps(
        {
            "type": "progress",
            "parentToolUseID": "tu_2",
            "data": {"type": "hook_progress", "hookName": "pre-commit"},
        }
    )
    p = ClaudeTranscriptParser()
    events = p.parse_line(line)
    assert len(events) == 1
    assert isinstance(events[0], HookProgressEvent)
    assert events[0].hook_name == "pre-commit"


def test_parse_file_binary_mode():
    """Multi-byte UTF-8 should round-trip correctly via binary read."""
    line = json.dumps({"type": "user", "message": {"content": "caf\u00e9 \u2603"}})
    with tempfile.NamedTemporaryFile(mode="wb", suffix=".jsonl", delete=False) as f:
        f.write((line + "\n").encode("utf-8"))
        path = f.name
    try:
        p = ClaudeTranscriptParser()
        events, _ = p.parse_file(path)
        assert len(events) == 1
        assert isinstance(events[0], UserMessageEvent)
        assert events[0].content == "caf\u00e9 \u2603"
    finally:
        os.unlink(path)


def test_parse_file_returns_consumed_offset():
    """A partial (non-newline-terminated) trailing line must not be consumed."""
    complete_line = json.dumps({"type": "user", "message": {"content": "done"}})
    partial_line = '{"type": "user", "message": {"content": "incompl'
    with tempfile.NamedTemporaryFile(mode="wb", suffix=".jsonl", delete=False) as f:
        f.write((complete_line + "\n").encode("utf-8"))
        expected_offset = f.tell()
        f.write(partial_line.encode("utf-8"))  # no trailing newline
        path = f.name
    try:
        p = ClaudeTranscriptParser()
        events, new_offset = p.parse_file(path)
        assert len(events) == 1
        assert new_offset == expected_offset  # partial line not consumed
    finally:
        os.unlink(path)


def test_project_context_dedup():
    """Two consecutive lines with the same cwd should produce only one ProjectContextEvent."""
    p = ClaudeTranscriptParser()
    line1 = json.dumps({"type": "user", "message": {"content": "hi"}, "cwd": "/tmp/proj"})
    line2 = json.dumps({"type": "user", "message": {"content": "bye"}, "cwd": "/tmp/proj"})
    events1 = p.parse_line(line1)
    events2 = p.parse_line(line2)
    ctx1 = [e for e in events1 if isinstance(e, ProjectContextEvent)]
    ctx2 = [e for e in events2 if isinstance(e, ProjectContextEvent)]
    assert len(ctx1) == 1  # first time: emitted
    assert len(ctx2) == 0  # same cwd: deduplicated
