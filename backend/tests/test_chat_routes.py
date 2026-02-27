"""Tests for chat routes (app.routes.chat)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.routes.chat import (
    CREWHUB_MSG_SEP,
    _build_history_message,
    _extract_content_parts,
    _get_agent_id,
    _last_send,
    _last_stream,
    _normalize_timestamp,
    _skip_user_message,
    _strip_context_envelope,
    _validate_session_key,
)


def _mock_manager_with_conn(mock_conn):
    """Create mock for get_connection_manager. get_default_openclaw is sync (not awaited in routes)."""
    mock_manager = MagicMock()
    mock_manager.get_default_openclaw.return_value = mock_conn

    async def fake_get_manager():
        return mock_manager

    return fake_get_manager, mock_manager


def _mock_manager_no_conn():
    """Create mock for get_connection_manager with no connection."""
    mock_manager = MagicMock()
    mock_manager.get_default_openclaw.return_value = None

    async def fake_get_manager():
        return mock_manager

    return fake_get_manager, mock_manager


# ── Helper unit tests ───────────────────────────────────────────


class TestValidateSessionKey:
    def test_valid_key(self):
        _validate_session_key("agent:main:main")
        _validate_session_key("agent:dev:main")
        _validate_session_key("agent:flowy:main")

    def test_invalid_key_raises(self):
        with pytest.raises(HTTPException) as exc:
            _validate_session_key("agent:main:subagent:abc")
        assert exc.value.status_code == 403

    def test_random_string_raises(self):
        with pytest.raises(HTTPException):
            _validate_session_key("not-a-session")

    def test_empty_raises(self):
        with pytest.raises(HTTPException):
            _validate_session_key("")


class TestGetAgentId:
    def test_normal(self):
        assert _get_agent_id("agent:main:main") == "main"
        assert _get_agent_id("agent:dev:main") == "dev"

    def test_no_colon(self):
        assert _get_agent_id("nocolon") == "main"


class TestNormalizeTimestamp:
    def test_int_millis(self):
        assert _normalize_timestamp(1700000000000) == 1700000000000

    def test_int_seconds(self):
        assert _normalize_timestamp(1700000000) == 1700000000000

    def test_float_seconds(self):
        assert _normalize_timestamp(1700000000.5) == 1700000000500

    def test_iso_string(self):
        ts = _normalize_timestamp("2024-01-01T00:00:00Z")
        assert ts > 0

    def test_bad_string(self):
        assert _normalize_timestamp("not-a-date") == 0

    def test_none(self):
        assert _normalize_timestamp(None) == 0


class TestExtractContentParts:
    def test_string_content(self):
        parts, tools, thinking = _extract_content_parts("hello", False)
        assert parts == ["hello"]
        assert tools == []

    def test_list_text_blocks(self):
        content = [{"type": "text", "text": "hi"}, {"type": "text", "text": "there"}]
        parts, tools, thinking = _extract_content_parts(content, False)
        assert parts == ["hi", "there"]

    def test_tool_use_block(self):
        content = [{"type": "tool_use", "name": "read", "input": {"path": "/tmp"}}]
        parts, tools, thinking = _extract_content_parts(content, False)
        assert len(tools) == 1
        assert tools[0]["name"] == "read"
        assert tools[0]["status"] == "called"
        assert "input" not in tools[0]  # raw=False

    def test_tool_use_raw(self):
        content = [{"type": "tool_use", "name": "read", "input": {"path": "/tmp"}}]
        parts, tools, thinking = _extract_content_parts(content, True)
        assert tools[0]["input"] == {"path": "/tmp"}

    def test_tool_result_block(self):
        content = [{"type": "tool_result", "name": "read", "content": "data", "isError": False}]
        _, tools, _ = _extract_content_parts(content, False)
        assert tools[0]["status"] == "done"

    def test_tool_result_error(self):
        content = [{"type": "tool_result", "name": "read", "content": "err", "isError": True}]
        _, tools, _ = _extract_content_parts(content, False)
        assert tools[0]["status"] == "error"

    def test_tool_result_raw_truncates(self):
        content = [{"type": "tool_result", "name": "x", "content": "a" * 600}]
        _, tools, _ = _extract_content_parts(content, True)
        assert tools[0]["result"].endswith("...")

    def test_thinking_blocks(self):
        content = [{"type": "thinking", "thinking": "let me think"}]
        _, _, thinking = _extract_content_parts(content, False)
        assert thinking == ["let me think"]

    def test_string_in_list(self):
        parts, _, _ = _extract_content_parts(["hello"], False)
        assert parts == ["hello"]

    def test_non_list_non_string(self):
        parts, tools, thinking = _extract_content_parts(123, False)
        assert parts == []

    def test_non_dict_in_list(self):
        parts, _, _ = _extract_content_parts([42], False)
        assert parts == []


class TestStripContextEnvelope:
    def test_with_separator(self):
        content = "```crewhub-context\nstuff\n```" + CREWHUB_MSG_SEP + "Hello!"
        assert _strip_context_envelope(content) == "Hello!"

    def test_heuristic_strip(self):
        content = "```crewhub-context\nstuff\n```\n\nHello world"
        result = _strip_context_envelope(content)
        assert result == "Hello world"

    def test_plain_message(self):
        assert _strip_context_envelope("just a message") == "just a message"

    def test_only_context(self):
        content = "```crewhub-context\nstuff\n```"
        result = _strip_context_envelope(content)
        # All segments stripped, returns empty
        assert result == ""


class TestSkipUserMessage:
    def test_system_message(self):
        assert _skip_user_message("[System Message] foo") is True

    def test_heartbeat(self):
        assert _skip_user_message("[HEARTBEAT] check") is True
        assert _skip_user_message("HEARTBEAT_OK") is True

    def test_subagent_delivery(self):
        assert _skip_user_message("A completed subagent task is ready for user delivery") is True

    def test_normal_message(self):
        assert _skip_user_message("Hey, how are you?") is False

    def test_code_block_with_metadata(self):
        assert _skip_user_message("```json\nmessage_id: 123\n```") is True

    def test_code_block_without_metadata(self):
        assert _skip_user_message("```python\nprint('hi')\n```") is False


class TestBuildHistoryMessage:
    def test_basic_assistant(self):
        entry = {
            "message": {"role": "assistant", "content": "Hello!"},
            "timestamp": 1700000000000,
        }
        msg = _build_history_message(0, entry, False)
        assert msg is not None
        assert msg["role"] == "assistant"
        assert msg["content"] == "Hello!"
        assert msg["id"] == "msg-0"

    def test_user_with_context_stripped(self):
        entry = {
            "message": {
                "role": "user",
                "content": "```crewhub-context\nctx\n```" + CREWHUB_MSG_SEP + "Real msg",
            },
            "timestamp": 1700000000000,
        }
        msg = _build_history_message(1, entry, False)
        assert msg["content"] == "Real msg"

    def test_skipped_user_message(self):
        entry = {
            "message": {"role": "user", "content": "[System Message] internal"},
            "timestamp": 1700000000000,
        }
        assert _build_history_message(0, entry, False) is None

    def test_unknown_role_returns_none(self):
        entry = {"message": {"role": "tool", "content": "result"}, "timestamp": 0}
        assert _build_history_message(0, entry, False) is None

    def test_empty_content_no_tools(self):
        entry = {"message": {"role": "assistant", "content": ""}, "timestamp": 0}
        assert _build_history_message(0, entry, False) is None

    def test_tools_only_message(self):
        entry = {
            "message": {
                "role": "assistant",
                "content": [{"type": "tool_use", "name": "exec", "input": {}}],
            },
            "timestamp": 1700000000000,
        }
        msg = _build_history_message(0, entry, False)
        assert msg is not None
        assert len(msg["tools"]) == 1

    def test_usage_tokens(self):
        entry = {
            "message": {"role": "assistant", "content": "hi"},
            "usage": {"totalTokens": 42},
            "timestamp": 0,
        }
        msg = _build_history_message(0, entry, False)
        assert msg["tokens"] == 42

    def test_thinking_in_raw(self):
        entry = {
            "message": {
                "role": "assistant",
                "content": [
                    {"type": "thinking", "thinking": "hmm"},
                    {"type": "text", "text": "answer"},
                ],
            },
            "timestamp": 0,
        }
        msg = _build_history_message(0, entry, True)
        assert msg["thinking"] == ["hmm"]

    def test_no_message_dict(self):
        entry = {"message": "not a dict", "role": "assistant", "content": "hi", "timestamp": 0}
        # message is not a dict, so msg={}, role comes from entry
        msg = _build_history_message(0, entry, False)
        # content comes from entry-level
        assert msg is not None


# ── Route integration tests ─────────────────────────────────────


@pytest.fixture(autouse=True)
def _clear_rate_limits():
    """Clear rate limit state between tests."""
    _last_send.clear()
    _last_stream.clear()
    yield
    _last_send.clear()
    _last_stream.clear()


class TestChatInfoEndpoint:
    @pytest.mark.anyio
    async def test_info_valid_session(self, client):
        resp = await client.get("/api/chat/agent:main:main/info")
        assert resp.status_code == 200
        data = resp.json()
        assert data["canChat"] is True
        assert data["agentId"] == "main"
        assert data["agentName"] == "Assistent"

    @pytest.mark.anyio
    async def test_info_invalid_session(self, client):
        resp = await client.get("/api/chat/random-key/info")
        assert resp.status_code == 200
        data = resp.json()
        assert data["canChat"] is False


class TestChatHistoryEndpoint:
    @pytest.mark.anyio
    async def test_history_forbidden(self, client):
        resp = await client.get("/api/chat/bad-key/history")
        assert resp.status_code == 403

    @pytest.mark.anyio
    async def test_history_no_connection(self, client):
        resp = await client.get("/api/chat/agent:main:main/history")
        assert resp.status_code == 200
        data = resp.json()
        assert data["messages"] == []
        assert data["hasMore"] is False

    @pytest.mark.anyio
    async def test_history_with_mock_connection(self, client):
        mock_conn = AsyncMock()
        mock_conn.get_session_history_raw.return_value = [
            {"message": {"role": "user", "content": "Hi"}, "timestamp": 1000},
            {"message": {"role": "assistant", "content": "Hello!"}, "timestamp": 2000},
        ]
        get_mgr, _ = _mock_manager_with_conn(mock_conn)

        with patch("app.routes.chat.get_connection_manager", side_effect=get_mgr):
            resp = await client.get("/api/chat/agent:main:main/history")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["messages"]) == 2

    @pytest.mark.anyio
    async def test_history_before_filter(self, client):
        mock_conn = AsyncMock()
        mock_conn.get_session_history_raw.return_value = [
            {"message": {"role": "user", "content": "Old"}, "timestamp": 1000},
            {"message": {"role": "assistant", "content": "New"}, "timestamp": 5000},
        ]
        get_mgr, _ = _mock_manager_with_conn(mock_conn)

        with patch("app.routes.chat.get_connection_manager", side_effect=get_mgr):
            # timestamps 1000 and 5000 are < 1e12 so get *1000 → 1000000 and 5000000
            resp = await client.get("/api/chat/agent:main:main/history?before=3000000")
        data = resp.json()
        assert len(data["messages"]) == 1
        assert data["messages"][0]["content"] == "Old"


class TestSendMessageEndpoint:
    @pytest.mark.anyio
    async def test_send_forbidden(self, client):
        resp = await client.post("/api/chat/bad-key/send", json={"message": "hi"})
        assert resp.status_code == 403

    @pytest.mark.anyio
    async def test_send_empty_message(self, client):
        resp = await client.post("/api/chat/agent:main:main/send", json={"message": "   "})
        assert resp.status_code == 400

    @pytest.mark.anyio
    async def test_send_no_connection(self, client):
        resp = await client.post("/api/chat/agent:main:main/send", json={"message": "hello"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert "No OpenClaw connection" in data["error"]

    @pytest.mark.anyio
    async def test_send_success(self, client):
        mock_conn = AsyncMock()
        mock_conn.send_chat.return_value = "I'm good!"
        get_mgr, _ = _mock_manager_with_conn(mock_conn)

        with (
            patch("app.routes.chat.get_connection_manager", side_effect=get_mgr),
            patch("app.routes.sse.broadcast", new_callable=AsyncMock),
        ):
            resp = await client.post("/api/chat/agent:main:main/send", json={"message": "hello"})
        data = resp.json()
        assert data["success"] is True
        assert data["response"] == "I'm good!"

    @pytest.mark.anyio
    async def test_send_no_response(self, client):
        mock_conn = AsyncMock()
        mock_conn.send_chat.return_value = None
        get_mgr, _ = _mock_manager_with_conn(mock_conn)

        with patch("app.routes.chat.get_connection_manager", side_effect=get_mgr):
            resp = await client.post("/api/chat/agent:main:main/send", json={"message": "hello"})
        data = resp.json()
        assert data["success"] is False

    @pytest.mark.anyio
    async def test_send_exception(self, client):
        mock_conn = AsyncMock()
        mock_conn.send_chat.side_effect = Exception("timeout")
        get_mgr, _ = _mock_manager_with_conn(mock_conn)

        with patch("app.routes.chat.get_connection_manager", side_effect=get_mgr):
            resp = await client.post("/api/chat/agent:main:main/send", json={"message": "hello"})
        data = resp.json()
        assert data["success"] is False
        assert "timeout" in data["error"]

    @pytest.mark.anyio
    async def test_send_rate_limit(self, client):
        mock_conn = AsyncMock()
        mock_conn.send_chat.return_value = "ok"
        get_mgr, _ = _mock_manager_with_conn(mock_conn)

        with (
            patch("app.routes.chat.get_connection_manager", side_effect=get_mgr),
            patch("app.routes.sse.broadcast", new_callable=AsyncMock),
        ):
            resp1 = await client.post("/api/chat/agent:main:main/send", json={"message": "first"})
            assert resp1.status_code == 200
            resp2 = await client.post("/api/chat/agent:main:main/send", json={"message": "second"})
            assert resp2.status_code == 429

    @pytest.mark.anyio
    async def test_send_truncates_long_message(self, client):
        mock_conn = AsyncMock()
        mock_conn.send_chat.return_value = "ok"
        get_mgr, _ = _mock_manager_with_conn(mock_conn)

        with (
            patch("app.routes.chat.get_connection_manager", side_effect=get_mgr),
            patch("app.routes.sse.broadcast", new_callable=AsyncMock),
        ):
            long_msg = "x" * 6000
            resp = await client.post("/api/chat/agent:main:main/send", json={"message": long_msg})
        assert resp.status_code == 200
        # Verify send_chat was called - the message body is truncated to 5000 chars
        # but context envelope may be prepended, so just check the x's are ≤5000
        call_args = mock_conn.send_chat.call_args
        sent_msg = call_args.kwargs.get("message", "")
        x_count = sent_msg.count("x")
        assert x_count <= 5010  # truncated from 6000, minor variance from null-byte strip

    @pytest.mark.anyio
    async def test_send_with_context_envelope(self, client):
        mock_conn = AsyncMock()
        mock_conn.send_chat.return_value = "ok"
        get_mgr, _ = _mock_manager_with_conn(mock_conn)

        with (
            patch("app.routes.chat.get_connection_manager", side_effect=get_mgr),
            patch("app.routes.sse.broadcast", new_callable=AsyncMock),
            patch(
                "app.services.context_envelope.build_crewhub_context",
                new_callable=AsyncMock,
                return_value={"key": "val"},
            ),
            patch("app.services.context_envelope.format_context_block", return_value="CTX"),
        ):
            resp = await client.post(
                "/api/chat/agent:main:main/send",
                json={"message": "hello", "room_id": "room-1"},
            )
        assert resp.status_code == 200


class TestStreamEndpoint:
    @pytest.mark.anyio
    async def test_stream_forbidden(self, client):
        resp = await client.post("/api/chat/bad-key/stream", json={"message": "hi"})
        assert resp.status_code == 403

    @pytest.mark.anyio
    async def test_stream_empty_message(self, client):
        resp = await client.post("/api/chat/agent:main:main/stream", json={"message": "   "})
        assert resp.status_code == 400

    @pytest.mark.anyio
    async def test_stream_no_connection(self, client):
        resp = await client.post("/api/chat/agent:main:main/stream", json={"message": "hello"})
        assert resp.status_code == 503

    @pytest.mark.anyio
    async def test_stream_success(self, client):
        async def fake_stream(msg, agent_id):
            yield "chunk1"
            yield "chunk2"

        mock_conn = AsyncMock()
        mock_conn.send_chat_streaming = fake_stream
        get_mgr, _ = _mock_manager_with_conn(mock_conn)

        with (
            patch("app.routes.chat.get_connection_manager", side_effect=get_mgr),
            patch("app.routes.sse.broadcast", new_callable=AsyncMock),
        ):
            resp = await client.post("/api/chat/agent:main:main/stream", json={"message": "hello"})
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers["content-type"]
        body = resp.text
        assert "event: start" in body
        assert "event: delta" in body
        assert "event: done" in body

    @pytest.mark.anyio
    async def test_stream_rate_limit(self, client):
        async def fake_stream(msg, agent_id):
            yield "chunk"

        mock_conn = AsyncMock()
        mock_conn.send_chat_streaming = fake_stream
        get_mgr, _ = _mock_manager_with_conn(mock_conn)

        with (
            patch("app.routes.chat.get_connection_manager", side_effect=get_mgr),
            patch("app.routes.sse.broadcast", new_callable=AsyncMock),
        ):
            resp1 = await client.post("/api/chat/agent:main:main/stream", json={"message": "first"})
            assert resp1.status_code == 200
            resp2 = await client.post("/api/chat/agent:main:main/stream", json={"message": "second"})
            assert resp2.status_code == 429
