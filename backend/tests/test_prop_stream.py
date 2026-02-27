"""Tests for app.services.creator.prop_stream module."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.creator.prop_stream import (
    _AcceptanceOutcome,
    _ai_success_record,
    _assistant_block_events,
    _build_full_prompt,
    _build_transcript_path,
    _create_agent_request,
    _emit_new_transcript_events,
    _error_record,
    _extract_final_raw_text,
    _extract_session_id,
    _extract_transcript_events,
    _find_connected_openclaw,
    _is_mesh_component_code,
    _late_wait_for_result,
    _normalize_ai_raw_text,
    _poll_for_final_result,
    _poll_queue_message,
    _PollOutcome,
    _post_processor_diagnostics,
    _prepare_template_fallback,
    _sse_event,
    _template_complete,
    _template_record,
    _wait_for_accepted_response,
    stream_prop_generation,
)

# ─── _sse_event ──────────────────────────────────────────────────


class TestSseEvent:
    def test_basic(self):
        result = _sse_event("status", {"message": "hello"})
        assert result.startswith("event: status\n")
        assert '"message": "hello"' in result
        assert result.endswith("\n\n")

    def test_empty_data(self):
        result = _sse_event("ping", {})
        assert "event: ping\ndata: {}\n\n" == result


# ─── _assistant_block_events ─────────────────────────────────────


class TestAssistantBlockEvents:
    def test_thinking_block(self):
        block = {"type": "thinking", "thinking": "line1\nline2\n\nline3"}
        events = _assistant_block_events(block)
        assert len(events) == 3
        assert all(e[0] == "thinking" for e in events)

    def test_thinking_empty(self):
        assert _assistant_block_events({"type": "thinking", "thinking": ""}) == []

    def test_text_block(self):
        block = {"type": "text", "text": "hello world"}
        events = _assistant_block_events(block)
        assert len(events) == 1
        assert events[0] == ("text", {"text": "hello world"})

    def test_text_block_truncates(self):
        block = {"type": "text", "text": "x" * 300}
        events = _assistant_block_events(block)
        assert len(events[0][1]["text"]) == 200

    def test_text_empty(self):
        assert _assistant_block_events({"type": "text", "text": ""}) == []

    def test_tool_use_block(self):
        block = {"type": "tool_use", "name": "read_file", "input": {"path": "/tmp"}}
        events = _assistant_block_events(block)
        assert len(events) == 1
        assert events[0][0] == "tool"
        assert events[0][1]["name"] == "read_file"

    def test_unknown_type(self):
        assert _assistant_block_events({"type": "image"}) == []

    def test_missing_type(self):
        assert _assistant_block_events({}) == []


# ─── _extract_transcript_events ──────────────────────────────────


class TestExtractTranscriptEvents:
    def test_assistant_list_content(self):
        entry = {"role": "assistant", "content": [{"type": "text", "text": "hi"}]}
        events = _extract_transcript_events(entry)
        assert len(events) == 1

    def test_assistant_string_content(self):
        entry = {"role": "assistant", "content": "hello"}
        events = _extract_transcript_events(entry)
        assert events == [("text", {"text": "hello"})]

    def test_assistant_empty_string(self):
        assert _extract_transcript_events({"role": "assistant", "content": ""}) == []

    def test_user_tool_result(self):
        entry = {"role": "user", "content": [{"type": "tool_result"}]}
        events = _extract_transcript_events(entry)
        assert len(events) == 1
        assert events[0][0] == "tool_result"

    def test_user_non_tool_result(self):
        entry = {"role": "user", "content": [{"type": "text"}]}
        assert _extract_transcript_events(entry) == []

    def test_unknown_role(self):
        assert _extract_transcript_events({"role": "system", "content": "x"}) == []

    def test_empty_entry(self):
        assert _extract_transcript_events({}) == []


# ─── _extract_final_raw_text ─────────────────────────────────────


class TestExtractFinalRawText:
    def test_none(self):
        assert _extract_final_raw_text(None) is None

    def test_nested_result_payloads(self):
        data = {"result": {"payloads": [{"text": "code here"}]}}
        assert _extract_final_raw_text(data) == "code here"

    def test_empty_payloads(self):
        data = {"result": {"payloads": []}}
        assert _extract_final_raw_text(data) is None

    def test_fallback_keys(self):
        for key in ("text", "response", "content", "reply"):
            assert _extract_final_raw_text({key: "val"}) == "val"

    def test_fallback_priority(self):
        assert _extract_final_raw_text({"text": "first", "response": "second"}) == "first"

    def test_non_dict(self):
        assert _extract_final_raw_text("string") is None

    def test_result_not_dict(self):
        data = {"result": "just a string", "text": "fallback"}
        assert _extract_final_raw_text(data) == "fallback"


# ─── _build_full_prompt ──────────────────────────────────────────


class TestBuildFullPrompt:
    def test_contains_all_parts(self):
        result = _build_full_prompt("TEMPLATE", "a car", "MyCar")
        assert "TEMPLATE" in result
        assert "a car" in result
        assert "MyCar" in result
        assert "PARTS_DATA" in result


# ─── _create_agent_request ───────────────────────────────────────


class TestCreateAgentRequest:
    def test_returns_id_and_request(self):
        req_id, ws_req = _create_agent_request("prompt text", "dev")
        assert isinstance(req_id, str) and len(req_id) == 36  # UUID
        assert ws_req["type"] == "req"
        assert ws_req["id"] == req_id
        assert ws_req["params"]["message"] == "prompt text"
        assert ws_req["params"]["agentId"] == "dev"


# ─── _extract_session_id ─────────────────────────────────────────


class TestExtractSessionId:
    def test_from_session_dict(self):
        assert _extract_session_id({"session": {"sessionId": "abc"}}) == "abc"

    def test_from_top_level(self):
        assert _extract_session_id({"sessionId": "xyz"}) == "xyz"

    def test_none_input(self):
        assert _extract_session_id(None) is None

    def test_not_dict(self):
        assert _extract_session_id("string") is None

    def test_empty_session(self):
        assert _extract_session_id({"session": {}}) is None


# ─── _normalize_ai_raw_text ─────────────────────────────────────


class TestNormalizeAiRawText:
    def test_strips_code_fences(self):
        text = "```tsx\nconst x = 1;\n```"
        assert _normalize_ai_raw_text(text) == "const x = 1;"

    def test_plain_text(self):
        assert _normalize_ai_raw_text("  hello  ") == "hello"

    def test_only_opening_fence(self):
        text = "```js\ncode"
        assert _normalize_ai_raw_text(text) == "code"


# ─── _is_mesh_component_code ────────────────────────────────────


class TestIsMeshComponentCode:
    def test_valid(self):
        assert _is_mesh_component_code("export function Foo() { return <mesh /> }")

    def test_missing_export(self):
        assert not _is_mesh_component_code("function Foo() { return <mesh /> }")

    def test_missing_mesh(self):
        assert not _is_mesh_component_code("export function Foo() { return <div /> }")

    def test_mesh_lowercase(self):
        assert _is_mesh_component_code("export function Foo() { return <Mesh /> }")


# ─── _post_processor_diagnostics ────────────────────────────────


class TestPostProcessorDiagnostics:
    def test_with_corrections(self):
        pp = MagicMock()
        pp.corrections = ["fix1", "fix2"]
        pp.warnings = ["warn1"]
        pp.quality_score = 85
        diags = _post_processor_diagnostics(pp)
        assert any("2 fixes" in d for d in diags)
        assert any("fix1" in d for d in diags)
        assert any("warn1" in d for d in diags)
        assert any("85/100" in d for d in diags)

    def test_no_corrections(self):
        pp = MagicMock()
        pp.corrections = []
        pp.warnings = []
        pp.quality_score = 100
        diags = _post_processor_diagnostics(pp)
        assert any("no corrections" in d for d in diags)


# ─── _error_record ──────────────────────────────────────────────


class TestErrorRecord:
    def test_fields(self):
        rec = _error_record("id1", "prompt", "Name", "gpt4", "GPT-4", "full", [{"name": "t"}], "oops")
        assert rec["id"] == "id1"
        assert rec["method"] == "error"
        assert rec["error"] == "oops"
        assert rec["code"] == ""


# ─── _template_record ───────────────────────────────────────────


class TestTemplateRecord:
    def test_basic(self):
        rec = _template_record("id", "p", "n", "mk", "ml", "fp", [], "code", "err")
        assert rec["method"] == "template"
        assert rec["error"] == "err"

    def test_extra_fields(self):
        rec = _template_record(
            "id", "p", "n", "mk", "ml", "fp", [], "c", "e", extra_diags=["d1"], extra_tool_calls=[{"name": "t"}]
        )
        assert rec["diagnostics"] == ["d1"]
        assert len(rec["toolCalls"]) == 1


# ─── _template_complete ─────────────────────────────────────────


class TestTemplateComplete:
    def test_fields(self):
        result = _template_complete("Foo", "code", [{"name": "x"}], "mk", "ml", "gid")
        assert result["filename"] == "Foo.tsx"
        assert result["method"] == "template"


# ─── _ai_success_record ─────────────────────────────────────────


class TestAiSuccessRecord:
    def test_fields(self):
        rec = _ai_success_record("id", "p", "n", "mk", "ml", "fp", [], [], [], [], "code", 90, {"ok": True})
        assert rec["method"] == "ai"
        assert rec["qualityScore"] == 90
        assert rec["error"] is None


# ─── _find_connected_openclaw ────────────────────────────────────


class TestFindConnectedOpenclaw:
    def _call_with_mock_import(self, connections_dict, oc_instances):
        """Call _find_connected_openclaw with mocked OpenClawConnection import."""
        import sys
        import types

        # Create a fake module for the lazy import
        fake_mod = types.ModuleType("app.services.connections")

        class FakeOC:
            pass

        # Mark certain mocks as instances of FakeOC
        for obj in oc_instances:
            obj.__class__ = FakeOC

        fake_mod.OpenClawConnection = FakeOC
        manager = MagicMock()
        manager.get_connections.return_value = connections_dict

        with patch.dict(sys.modules, {"app.services.connections": fake_mod}):
            # Need to reimport the function to pick up the patched module
            # Instead, just patch at the point of import inside the function
            return _find_connected_openclaw(manager)

    def test_found(self):
        mock_conn = MagicMock()
        mock_conn.is_connected.return_value = True
        result = self._call_with_mock_import({"a": mock_conn}, [mock_conn])
        assert result is mock_conn

    def test_not_connected(self):
        mock_conn = MagicMock()
        mock_conn.is_connected.return_value = False
        result = self._call_with_mock_import({"a": mock_conn}, [mock_conn])
        assert result is None

    def test_none_when_empty(self):
        result = self._call_with_mock_import({}, [])
        assert result is None


# ─── _build_transcript_path ─────────────────────────────────────


class TestBuildTranscriptPath:
    def test_with_session_id(self):
        path = _build_transcript_path("dev", "sess123", "gen1")
        assert isinstance(path, Path)
        assert "sess123.jsonl" in str(path)

    def test_no_session_id(self):
        assert _build_transcript_path("dev", None, "gen1") is None


# ─── _poll_queue_message ────────────────────────────────────────


class TestPollQueueMessage:
    def test_empty_queue(self):
        q = asyncio.Queue()
        result, seen = _poll_queue_message(q, "g1", 0, 0)
        assert result is None
        assert seen == 0

    def test_final_ok(self):
        q = asyncio.Queue()
        q.put_nowait({"ok": True, "payload": {"status": "done"}})
        result, seen = _poll_queue_message(q, "g1", 1, 0)
        assert result["kind"] == "final"
        assert seen == 1

    def test_accepted(self):
        q = asyncio.Queue()
        q.put_nowait({"ok": True, "payload": {"status": "accepted"}})
        result, seen = _poll_queue_message(q, "g1", 1, 0)
        assert result["kind"] == "accepted"

    def test_error(self):
        q = asyncio.Queue()
        q.put_nowait({"ok": False, "error": {"message": "bad"}})
        result, seen = _poll_queue_message(q, "g1", 1, 0)
        assert result["kind"] == "error"

    def test_unknown(self):
        q = asyncio.Queue()
        q.put_nowait({"ok": False})
        result, seen = _poll_queue_message(q, "g1", 1, 0)
        assert result["kind"] == "unknown"


# ─── _prepare_template_fallback ──────────────────────────────────


class TestPrepareTemplateFallback:
    @patch("app.services.creator.prop_stream.generate_template_code", return_value="// code")
    @patch("app.services.creator.prop_stream.extract_parts", return_value=[{"name": "color"}])
    def test_returns_tuple(self, mock_parts, mock_code):
        code, parts, record = _prepare_template_fallback("g1", "a ball", "Ball", "mk", "ml", "fp", "some error")
        assert code == "// code"
        assert parts == [{"name": "color"}]
        assert record["method"] == "template"


# ─── _emit_new_transcript_events ─────────────────────────────────


@pytest.mark.asyncio
class TestEmitNewTranscriptEvents:
    async def test_no_path(self):
        lines, events = await _emit_new_transcript_events(None, 0, [])
        assert lines == 0 and events == []

    async def test_nonexistent_path(self, tmp_path):
        p = tmp_path / "nope.jsonl"
        lines, events = await _emit_new_transcript_events(p, 0, [])
        assert lines == 0

    async def test_reads_new_lines(self, tmp_path):
        p = tmp_path / "t.jsonl"
        entry = {"role": "assistant", "content": "hello"}
        p.write_text(json.dumps(entry) + "\n")
        tool_calls = []
        lines, events = await _emit_new_transcript_events(p, 0, tool_calls)
        assert lines == 1
        assert len(events) == 1
        assert "hello" in events[0]

    async def test_skips_already_read(self, tmp_path):
        p = tmp_path / "t.jsonl"
        entry = {"role": "assistant", "content": "hello"}
        p.write_text(json.dumps(entry) + "\n")
        lines, events = await _emit_new_transcript_events(p, 1, [])
        assert lines == 1
        assert events == []

    async def test_collects_tool_calls(self, tmp_path):
        p = tmp_path / "t.jsonl"
        entry = {"role": "assistant", "content": [{"type": "tool_use", "name": "read", "input": {}}]}
        p.write_text(json.dumps(entry) + "\n")
        tool_calls = []
        await _emit_new_transcript_events(p, 0, tool_calls)
        assert len(tool_calls) == 1
        assert tool_calls[0]["name"] == "read"


# ─── _wait_for_accepted_response ─────────────────────────────────


@pytest.mark.asyncio
class TestWaitForAcceptedResponse:
    async def test_accepted_ok(self):
        q = asyncio.Queue()
        q.put_nowait({"ok": True, "payload": {"sessionId": "s1"}})
        outcome = await _wait_for_accepted_response(q, "g1")
        assert outcome.session_id == "s1"
        assert outcome.error_message is None

    async def test_rejected(self):
        q = asyncio.Queue()
        q.put_nowait({"ok": False, "error": {"message": "nope"}})
        outcome = await _wait_for_accepted_response(q, "g1")
        assert "nope" in outcome.error_message

    async def test_timeout(self):
        q = asyncio.Queue()
        with patch("app.services.creator.prop_stream.asyncio.wait_for", side_effect=TimeoutError):
            outcome = await _wait_for_accepted_response(q, "g1")
        assert outcome.timeout is True


# ─── Dataclasses ─────────────────────────────────────────────────


class TestDataclasses:
    def test_acceptance_defaults(self):
        o = _AcceptanceOutcome()
        assert o.session_id is None and not o.timeout

    def test_poll_defaults(self):
        o = _PollOutcome()
        assert o.final_result is None and o.poll_count == 0


# ─── _poll_for_final_result ──────────────────────────────────────


@pytest.mark.asyncio
class TestPollForFinalResult:
    async def test_disconnected(self):
        request = AsyncMock()
        request.is_disconnected.return_value = True
        conn = MagicMock()
        conn._response_queues = {"req1": None}
        q = asyncio.Queue()
        outcome, events = await _poll_for_final_result(request, conn, "req1", q, None, [], "g1")
        assert outcome.disconnected is True

    async def test_gets_final_result(self):
        request = AsyncMock()
        request.is_disconnected.return_value = False
        conn = MagicMock()
        conn._response_queues = {"req1": None}
        q = asyncio.Queue()
        q.put_nowait({"ok": True, "payload": {"text": "done"}})
        outcome, events = await _poll_for_final_result(request, conn, "req1", q, None, [], "g1")
        assert outcome.final_result == {"text": "done"}
        assert not outcome.disconnected

    async def test_error_in_queue(self):
        request = AsyncMock()
        request.is_disconnected.return_value = False
        conn = MagicMock()
        conn._response_queues = {"req1": None}
        q = asyncio.Queue()
        q.put_nowait({"ok": False, "error": {"message": "fail"}})
        outcome, events = await _poll_for_final_result(request, conn, "req1", q, None, [], "g1")
        assert outcome.error_message == "fail"

    async def test_streams_transcript_events(self, tmp_path):
        request = AsyncMock()
        call_count = 0

        async def disconnect_after_two():
            nonlocal call_count
            call_count += 1
            return call_count > 2

        request.is_disconnected = disconnect_after_two
        conn = MagicMock()
        conn._response_queues = {"req1": None}
        q = asyncio.Queue()
        # Write transcript
        p = tmp_path / "t.jsonl"
        p.write_text(json.dumps({"role": "assistant", "content": "hi"}) + "\n")
        outcome, events = await _poll_for_final_result(request, conn, "req1", q, p, [], "g1")
        assert outcome.disconnected is True
        assert len(events) >= 1


# ─── _late_wait_for_result ───────────────────────────────────────


@pytest.mark.asyncio
class TestLateWaitForResult:
    async def test_gets_result(self):
        conn = MagicMock()
        conn._response_queues = {}
        q = asyncio.Queue()
        q.put_nowait({"ok": True, "payload": {"text": "late"}})
        result = await _late_wait_for_result(conn, "req1", q, "g1")
        assert result == {"text": "late"}
        assert "req1" not in conn._response_queues

    async def test_error_returns_none(self):
        conn = MagicMock()
        conn._response_queues = {}
        q = asyncio.Queue()
        q.put_nowait({"ok": False, "error": "bad"})
        result = await _late_wait_for_result(conn, "req1", q, "g1")
        assert result is None

    async def test_timeout_returns_none(self):
        conn = MagicMock()
        conn._response_queues = {}
        q = asyncio.Queue()
        with patch("app.services.creator.prop_stream.asyncio.wait_for", side_effect=TimeoutError):
            result = await _late_wait_for_result(conn, "req1", q, "g1")
        assert result is None

    async def test_exception_returns_none(self):
        conn = MagicMock()
        conn._response_queues = {}
        q = asyncio.Queue()
        with patch("app.services.creator.prop_stream.asyncio.wait_for", side_effect=RuntimeError("boom")):
            result = await _late_wait_for_result(conn, "req1", q, "g1")
        assert result is None


# ─── stream_prop_generation ──────────────────────────────────────


@pytest.mark.asyncio
class TestStreamPropGeneration:
    """Tests for stream_prop_generation async generator.

    The function uses lazy imports for get_connection_manager, so we mock
    the entire connections module via sys.modules and patch helpers.
    """

    async def _collect(self, gen):
        events = []
        async for e in gen:
            events.append(e)
        return events

    def _patch_connections(self, get_mgr_return=None, get_mgr_side_effect=None):
        """Create a context manager that patches the lazy connections import."""
        import sys
        import types

        fake_mod = types.ModuleType("app.services.connections")
        mgr_mock = AsyncMock()
        if get_mgr_side_effect:
            mgr_mock.side_effect = get_mgr_side_effect
        elif get_mgr_return is not None:
            mgr_mock.return_value = get_mgr_return
        fake_mod.get_connection_manager = mgr_mock
        fake_mod.OpenClawConnection = type("OpenClawConnection", (), {})
        return patch.dict(sys.modules, {"..connections": fake_mod, "app.services.connections": fake_mod})

    @patch("app.services.creator.prop_stream.resolve_model", return_value=("model-id", "Model Label"))
    async def test_no_connection(self, mock_resolve):
        manager = MagicMock()
        with self._patch_connections(get_mgr_return=manager):
            with patch("app.services.creator.prop_stream._find_connected_openclaw", return_value=None):
                request = AsyncMock()
                events = await self._collect(stream_prop_generation(request, "a ball", "Ball", "gpt4"))
        assert any("No connected" in e for e in events)

    @patch("app.services.creator.prop_stream.resolve_model", return_value=("model-id", "Model Label"))
    async def test_manager_exception(self, mock_resolve):
        with self._patch_connections(get_mgr_side_effect=RuntimeError("no manager")):
            request = AsyncMock()
            events = await self._collect(stream_prop_generation(request, "a ball", "Ball", "gpt4"))
        assert any("no manager" in e for e in events)

    @patch("app.services.creator.prop_stream.resolve_model", return_value=("model-id", "Model Label"))
    @patch("app.services.creator.prop_stream.load_prompt_template", return_value=None)
    async def test_no_template(self, mock_tmpl, mock_resolve):
        conn = MagicMock()
        manager = MagicMock()
        with self._patch_connections(get_mgr_return=manager):
            with patch("app.services.creator.prop_stream._find_connected_openclaw", return_value=conn):
                request = AsyncMock()
                events = await self._collect(stream_prop_generation(request, "a ball", "Ball", "gpt4"))
        assert any("template not found" in e.lower() for e in events)

    @patch("app.services.creator.prop_stream.resolve_model", return_value=("model-id", "Model Label"))
    @patch("app.services.creator.prop_stream.load_prompt_template", return_value="TEMPLATE")
    async def test_ws_send_failure(self, mock_tmpl, mock_resolve):
        conn = MagicMock()
        conn._response_queues = {}
        conn.ws = AsyncMock()
        conn.ws.send = AsyncMock(side_effect=ConnectionError("ws dead"))
        manager = MagicMock()
        with self._patch_connections(get_mgr_return=manager):
            with patch("app.services.creator.prop_stream._find_connected_openclaw", return_value=conn):
                request = AsyncMock()
                events = await self._collect(stream_prop_generation(request, "a ball", "Ball", "gpt4"))
        assert any("Failed to send" in e for e in events)

    @patch("app.services.creator.prop_stream.resolve_model", return_value=("mid", "ML"))
    @patch("app.services.creator.prop_stream.load_prompt_template", return_value="TPL")
    @patch("app.services.creator.prop_stream.add_generation_record")
    @patch("app.services.creator.prop_stream.generate_template_code", return_value="// code")
    @patch("app.services.creator.prop_stream.extract_parts", return_value=[])
    async def test_acceptance_error_uses_fallback(self, mock_ep, mock_gtc, mock_agr, mock_tmpl, mock_resolve):
        conn = MagicMock()
        conn._response_queues = {}
        conn.ws = AsyncMock()
        conn.ws.send = AsyncMock()
        manager = MagicMock()

        with self._patch_connections(get_mgr_return=manager):
            with patch("app.services.creator.prop_stream._find_connected_openclaw", return_value=conn):
                with patch(
                    "app.services.creator.prop_stream._wait_for_accepted_response",
                    new_callable=AsyncMock,
                    return_value=_AcceptanceOutcome(error_message="rejected"),
                ):
                    request = AsyncMock()
                    events = await self._collect(stream_prop_generation(request, "ball", "Ball", "gpt4"))

        assert any("rejected" in e for e in events)
        assert any("complete" in e for e in events)
        mock_agr.assert_called_once()

    @patch("app.services.creator.prop_stream.resolve_model", return_value=("mid", "ML"))
    @patch("app.services.creator.prop_stream.load_prompt_template", return_value="TPL")
    @patch("app.services.creator.prop_stream.add_generation_record")
    @patch("app.services.creator.prop_stream.generate_template_code", return_value="// code")
    @patch("app.services.creator.prop_stream.extract_parts", return_value=[])
    async def test_poll_error(self, mock_ep, mock_gtc, mock_agr, mock_tmpl, mock_resolve):
        conn = MagicMock()
        conn._response_queues = {}
        conn.ws = AsyncMock()
        conn.ws.send = AsyncMock()
        manager = MagicMock()

        with self._patch_connections(get_mgr_return=manager):
            with patch("app.services.creator.prop_stream._find_connected_openclaw", return_value=conn):
                with patch(
                    "app.services.creator.prop_stream._wait_for_accepted_response",
                    new_callable=AsyncMock,
                    return_value=_AcceptanceOutcome(session_id="s1"),
                ):
                    with patch(
                        "app.services.creator.prop_stream._poll_for_final_result",
                        new_callable=AsyncMock,
                        return_value=(_PollOutcome(error_message="agent died"), []),
                    ):
                        request = AsyncMock()
                        events = await self._collect(stream_prop_generation(request, "ball", "Ball", "gpt4"))

        assert any("agent died" in e for e in events)
        mock_agr.assert_called_once()

    @patch("app.services.creator.prop_stream.resolve_model", return_value=("mid", "ML"))
    @patch("app.services.creator.prop_stream.load_prompt_template", return_value="TPL")
    async def test_poll_disconnect(self, mock_tmpl, mock_resolve):
        conn = MagicMock()
        conn._response_queues = {}
        conn.ws = AsyncMock()
        conn.ws.send = AsyncMock()
        manager = MagicMock()

        with self._patch_connections(get_mgr_return=manager):
            with patch("app.services.creator.prop_stream._find_connected_openclaw", return_value=conn):
                with patch(
                    "app.services.creator.prop_stream._wait_for_accepted_response",
                    new_callable=AsyncMock,
                    return_value=_AcceptanceOutcome(session_id="s1"),
                ):
                    with patch(
                        "app.services.creator.prop_stream._poll_for_final_result",
                        new_callable=AsyncMock,
                        return_value=(_PollOutcome(disconnected=True), []),
                    ):
                        request = AsyncMock()
                        events = await self._collect(stream_prop_generation(request, "ball", "Ball", "gpt4"))

        # Disconnect returns early - only status/model/full_prompt events
        assert not any('"error"' in e and '"message"' in e for e in events if "event: error" in e)

    @patch("app.services.creator.prop_stream.resolve_model", return_value=("mid", "ML"))
    @patch("app.services.creator.prop_stream.load_prompt_template", return_value="TPL")
    @patch("app.services.creator.prop_stream.add_generation_record")
    @patch("app.services.creator.prop_stream.generate_template_code", return_value="// code")
    @patch("app.services.creator.prop_stream.extract_parts", return_value=[])
    async def test_no_raw_text_uses_fallback(self, mock_ep, mock_gtc, mock_agr, mock_tmpl, mock_resolve):
        """When AI returns no text, template fallback is used."""
        conn = MagicMock()
        conn._response_queues = {}
        conn.ws = AsyncMock()
        conn.ws.send = AsyncMock()
        manager = MagicMock()

        with self._patch_connections(get_mgr_return=manager):
            with patch("app.services.creator.prop_stream._find_connected_openclaw", return_value=conn):
                with patch(
                    "app.services.creator.prop_stream._wait_for_accepted_response",
                    new_callable=AsyncMock,
                    return_value=_AcceptanceOutcome(session_id="s1"),
                ):
                    with patch(
                        "app.services.creator.prop_stream._poll_for_final_result",
                        new_callable=AsyncMock,
                        return_value=(_PollOutcome(final_result={"result": {}}), []),
                    ):
                        with patch(
                            "app.services.creator.prop_stream._late_wait_for_result",
                            new_callable=AsyncMock,
                            return_value=None,
                        ):
                            request = AsyncMock()
                            events = await self._collect(stream_prop_generation(request, "ball", "Ball", "gpt4"))

        assert any("template" in e for e in events)

    @patch("app.services.creator.prop_stream.resolve_model", return_value=("mid", "ML"))
    @patch("app.services.creator.prop_stream.load_prompt_template", return_value="TPL")
    @patch("app.services.creator.prop_stream.add_generation_record")
    @patch("app.services.creator.prop_stream.generate_template_code", return_value="// code")
    @patch("app.services.creator.prop_stream.extract_parts", return_value=[])
    @patch("app.services.creator.prop_stream.strip_parts_block", return_value="function foo() {}")
    @patch("app.services.creator.prop_stream.parse_ai_parts", return_value=[])
    async def test_invalid_mesh_code_uses_fallback(
        self, mock_parse, mock_strip, mock_ep, mock_gtc, mock_agr, mock_tmpl, mock_resolve
    ):
        """When AI returns code that's not a mesh component, template fallback is used."""
        conn = MagicMock()
        conn._response_queues = {}
        conn.ws = AsyncMock()
        conn.ws.send = AsyncMock()
        manager = MagicMock()

        raw_text = "function foo() {}"
        final_result = {"result": {"payloads": [{"text": raw_text}]}}

        with self._patch_connections(get_mgr_return=manager):
            with patch("app.services.creator.prop_stream._find_connected_openclaw", return_value=conn):
                with patch(
                    "app.services.creator.prop_stream._wait_for_accepted_response",
                    new_callable=AsyncMock,
                    return_value=_AcceptanceOutcome(session_id="s1"),
                ):
                    with patch(
                        "app.services.creator.prop_stream._poll_for_final_result",
                        new_callable=AsyncMock,
                        return_value=(_PollOutcome(final_result=final_result), []),
                    ):
                        request = AsyncMock()
                        events = await self._collect(stream_prop_generation(request, "ball", "Ball", "gpt4"))

        assert any("template" in e for e in events)

    @patch("app.services.creator.prop_stream.resolve_model", return_value=("mid", "ML"))
    @patch("app.services.creator.prop_stream.load_prompt_template", return_value="TPL")
    @patch("app.services.creator.prop_stream.add_generation_record")
    @patch(
        "app.services.creator.prop_stream.strip_parts_block", return_value="export function Ball() { return <mesh /> }"
    )
    @patch("app.services.creator.prop_stream.parse_ai_parts", return_value=[{"name": "color"}])
    async def test_valid_mesh_code_success(self, mock_parse, mock_strip, mock_agr, mock_tmpl, mock_resolve):
        """When AI returns valid mesh code, it goes through post-processing."""
        conn = MagicMock()
        conn._response_queues = {}
        conn.ws = AsyncMock()
        conn.ws.send = AsyncMock()
        manager = MagicMock()

        raw_text = "export function Ball() { return <mesh /> }"
        final_result = {"result": {"payloads": [{"text": raw_text}]}}

        pp_result = MagicMock()
        pp_result.code = raw_text
        pp_result.corrections = []
        pp_result.warnings = []
        pp_result.quality_score = 95

        validation = {"valid": True}

        with self._patch_connections(get_mgr_return=manager):
            with patch("app.services.creator.prop_stream._find_connected_openclaw", return_value=conn):
                with patch(
                    "app.services.creator.prop_stream._wait_for_accepted_response",
                    new_callable=AsyncMock,
                    return_value=_AcceptanceOutcome(session_id="s1"),
                ):
                    with patch(
                        "app.services.creator.prop_stream._poll_for_final_result",
                        new_callable=AsyncMock,
                        return_value=(_PollOutcome(final_result=final_result), []),
                    ):
                        with patch(
                            "app.services.creator.prop_stream.enhance_generated_prop",
                            create=True,
                            return_value=pp_result,
                        ):
                            with patch(
                                "app.services.creator.prop_stream.validate_prop_quality",
                                create=True,
                                return_value=validation,
                            ):
                                mp_gen = MagicMock()
                                mp_gen.generate_prop.return_value = (raw_text, ["multi-pass fix"])
                                mp_gen.get_refinement_options.return_value = {"opt": 1}
                                with patch(
                                    "app.services.creator.prop_stream.MultiPassGenerator",
                                    create=True,
                                    return_value=mp_gen,
                                ):
                                    request = AsyncMock()
                                    events = await self._collect(
                                        stream_prop_generation(request, "ball", "Ball", "gpt4")
                                    )

        assert any('"method": "ai"' in e for e in events)
        assert any("complete" in e for e in events)

    @patch("app.services.creator.prop_stream.resolve_model", return_value=("mid", "ML"))
    @patch("app.services.creator.prop_stream.load_prompt_template", return_value="TPL")
    @patch("app.services.creator.prop_stream.add_generation_record")
    @patch(
        "app.services.creator.prop_stream.strip_parts_block", return_value="export function Ball() { return <mesh /> }"
    )
    @patch("app.services.creator.prop_stream.parse_ai_parts", return_value=[{"name": "color"}])
    async def test_multi_pass_error_non_fatal(self, mock_parse, mock_strip, mock_agr, mock_tmpl, mock_resolve):
        """Multi-pass generator error is non-fatal; generation still completes."""
        conn = MagicMock()
        conn._response_queues = {}
        conn.ws = AsyncMock()
        conn.ws.send = AsyncMock()
        manager = MagicMock()

        raw_text = "export function Ball() { return <mesh /> }"
        final_result = {"result": {"payloads": [{"text": raw_text}]}}

        pp_result = MagicMock()
        pp_result.code = raw_text
        pp_result.corrections = ["fix1"]
        pp_result.warnings = ["warn1"]
        pp_result.quality_score = 80

        validation = {"valid": True}

        with self._patch_connections(get_mgr_return=manager):
            with patch("app.services.creator.prop_stream._find_connected_openclaw", return_value=conn):
                with patch(
                    "app.services.creator.prop_stream._wait_for_accepted_response",
                    new_callable=AsyncMock,
                    return_value=_AcceptanceOutcome(session_id="s1"),
                ):
                    with patch(
                        "app.services.creator.prop_stream._poll_for_final_result",
                        new_callable=AsyncMock,
                        return_value=(_PollOutcome(final_result=final_result), []),
                    ):
                        with patch(
                            "app.services.creator.prop_stream.enhance_generated_prop",
                            create=True,
                            return_value=pp_result,
                        ):
                            with patch(
                                "app.services.creator.prop_stream.validate_prop_quality",
                                create=True,
                                return_value=validation,
                            ):
                                with patch(
                                    "app.services.creator.prop_stream.MultiPassGenerator",
                                    create=True,
                                    side_effect=RuntimeError("mp fail"),
                                ):
                                    request = AsyncMock()
                                    events = await self._collect(
                                        stream_prop_generation(request, "ball", "Ball", "gpt4")
                                    )

        assert any("complete" in e for e in events)
        assert any('"method": "ai"' in e for e in events)
