"""Tests for OpenClawExtendedMixin."""

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.connections._extended_api import (
    OpenClawExtendedMixin,
    _extract_payload_text,
    _extract_text,
)

# ── Helper: fake connection with mixin ────────────────────────────────


class FakeConnection(OpenClawExtendedMixin):
    """Minimal fake that satisfies the mixin's self.call / self.get_sessions etc."""

    def __init__(self):
        self.call = AsyncMock()
        self.get_sessions = AsyncMock(return_value=[])
        self.subscribe = MagicMock()
        self.unsubscribe = MagicMock()
        self._stream_queues: dict = {}


@pytest.fixture
def conn():
    return FakeConnection()


# ── _extract_text / _extract_payload_text ─────────────────────────────


class TestExtractText:
    def test_none_input(self):
        assert _extract_text(None) is None
        assert _extract_text("string") is None

    def test_payload_text(self):
        result = {"result": {"payloads": [{"text": "hello"}]}}
        assert _extract_text(result) == "hello"

    def test_fallback_keys(self):
        assert _extract_text({"text": "a"}) == "a"
        assert _extract_text({"response": "b"}) == "b"
        assert _extract_text({"content": "c"}) == "c"
        assert _extract_text({"reply": "d"}) == "d"

    def test_empty_payloads(self):
        assert _extract_payload_text({"result": {"payloads": []}}) is None
        assert _extract_payload_text({"result": "not a dict"}) is None
        assert _extract_payload_text({"result": {"payloads": ["not dict"]}}) is None

    def test_no_text_in_payload(self):
        assert _extract_payload_text({"result": {"payloads": [{"other": 1}]}}) is None

    def test_non_string_text(self):
        assert _extract_payload_text({"result": {"payloads": [{"text": 123}]}}) is None

    def test_empty_dict(self):
        assert _extract_text({}) is None


# ── send_message ──────────────────────────────────────────────────────


class TestSendMessage:
    @pytest.mark.asyncio
    async def test_send_message_basic(self, conn):
        conn.call.return_value = {"text": "response"}
        result = await conn.send_message("agent:main:main", "hello")
        assert result == "response"
        conn.call.assert_called_once()
        args = conn.call.call_args
        assert args[0][0] == "agent"

    @pytest.mark.asyncio
    async def test_send_message_with_session(self, conn):
        session = MagicMock()
        session.key = "agent:bot1:main"
        session.session_id = "sess-123"
        conn.get_sessions.return_value = [session]
        conn.call.return_value = {"text": "ok"}
        result = await conn.send_message("agent:bot1:main", "hi")
        assert result == "ok"
        params = conn.call.call_args[0][1]
        assert params["sessionId"] == "sess-123"

    @pytest.mark.asyncio
    async def test_send_message_no_colon(self, conn):
        conn.call.return_value = {"text": "ok"}
        await conn.send_message("simple_key", "msg")
        params = conn.call.call_args[0][1]
        assert params["agentId"] == "main"


# ── send_chat ─────────────────────────────────────────────────────────


class TestSendChat:
    @pytest.mark.asyncio
    async def test_send_chat_basic(self, conn):
        conn.call.return_value = {"text": "reply"}
        result = await conn.send_chat("question")
        assert result == "reply"

    @pytest.mark.asyncio
    async def test_send_chat_with_model(self, conn):
        conn.call.return_value = {"text": "reply"}
        await conn.send_chat("q", model="gpt-4")
        params = conn.call.call_args[0][1]
        assert params["model"] == "gpt-4"

    @pytest.mark.asyncio
    async def test_send_chat_with_session_id(self, conn):
        conn.call.return_value = {"text": "reply"}
        await conn.send_chat("q", session_id="s1")
        params = conn.call.call_args[0][1]
        assert params["sessionId"] == "s1"


# ── patch_session ─────────────────────────────────────────────────────


class TestPatchSession:
    @pytest.mark.asyncio
    async def test_patch_success(self, conn):
        conn.call.return_value = {"ok": True}
        assert await conn.patch_session("s1", model="gpt-4") is True

    @pytest.mark.asyncio
    async def test_patch_failure(self, conn):
        conn.call.return_value = None
        assert await conn.patch_session("s1") is False


# ── get_sessions_raw ──────────────────────────────────────────────────


class TestGetSessionsRaw:
    @pytest.mark.asyncio
    async def test_returns_sessions(self, conn):
        conn.call.return_value = {"sessions": [{"id": "1"}]}
        result = await conn.get_sessions_raw()
        assert result == [{"id": "1"}]

    @pytest.mark.asyncio
    async def test_returns_empty(self, conn):
        conn.call.return_value = None
        assert await conn.get_sessions_raw() == []

    @pytest.mark.asyncio
    async def test_non_dict_result(self, conn):
        conn.call.return_value = "string"
        assert await conn.get_sessions_raw() == []


# ── Cron management ──────────────────────────────────────────────────


class TestCronJobs:
    @pytest.mark.asyncio
    async def test_list_cron_jobs(self, conn):
        conn.call.return_value = {"jobs": [{"id": "j1"}]}
        result = await conn.list_cron_jobs()
        assert result == [{"id": "j1"}]

    @pytest.mark.asyncio
    async def test_list_cron_jobs_empty(self, conn):
        conn.call.return_value = None
        assert await conn.list_cron_jobs() == []

    @pytest.mark.asyncio
    async def test_list_cron_not_all(self, conn):
        conn.call.return_value = {"jobs": []}
        await conn.list_cron_jobs(all_jobs=False)
        params = conn.call.call_args[0][1] if len(conn.call.call_args[0]) > 1 else {}
        # all_jobs=False should not pass includeDisabled
        assert "includeDisabled" not in params

    @pytest.mark.asyncio
    async def test_create_cron_job(self, conn):
        conn.call.return_value = {"id": "j1"}
        result = await conn.create_cron_job({"cron": "* * * * *"}, {"msg": "hi"}, name="test")
        assert result == {"id": "j1"}

    @pytest.mark.asyncio
    async def test_update_cron_job(self, conn):
        conn.call.return_value = {"ok": True}
        result = await conn.update_cron_job("j1", {"enabled": False})
        assert result is not None

    @pytest.mark.asyncio
    async def test_delete_cron_job(self, conn):
        conn.call.return_value = {"ok": True}
        assert await conn.delete_cron_job("j1") is True

    @pytest.mark.asyncio
    async def test_delete_cron_job_fail(self, conn):
        conn.call.return_value = None
        assert await conn.delete_cron_job("j1") is False

    @pytest.mark.asyncio
    async def test_enable_cron_job(self, conn):
        conn.call.return_value = {"ok": True}
        assert await conn.enable_cron_job("j1") is True

    @pytest.mark.asyncio
    async def test_disable_cron_job(self, conn):
        conn.call.return_value = {"ok": True}
        assert await conn.disable_cron_job("j1") is True

    @pytest.mark.asyncio
    async def test_run_cron_job(self, conn):
        conn.call.return_value = {"ok": True}
        assert await conn.run_cron_job("j1", force=True) is True

    @pytest.mark.asyncio
    async def test_run_cron_job_fail(self, conn):
        conn.call.return_value = None
        assert await conn.run_cron_job("j1") is False


# ── System queries ────────────────────────────────────────────────────


class TestSystemQueries:
    @pytest.mark.asyncio
    async def test_get_presence(self, conn):
        conn.call.return_value = {"clients": []}
        result = await conn.get_presence()
        assert result == {"clients": []}

    @pytest.mark.asyncio
    async def test_get_presence_none(self, conn):
        conn.call.return_value = None
        assert await conn.get_presence() == {}

    @pytest.mark.asyncio
    async def test_list_nodes_first_method(self, conn):
        conn.call.return_value = {"nodes": [{"id": "n1"}]}
        result = await conn.list_nodes()
        assert result == [{"id": "n1"}]

    @pytest.mark.asyncio
    async def test_list_nodes_fallback(self, conn):
        conn.call.side_effect = [None, None, {"nodes": [{"id": "n2"}]}]
        result = await conn.list_nodes()
        assert result == [{"id": "n2"}]

    @pytest.mark.asyncio
    async def test_list_nodes_empty(self, conn):
        conn.call.return_value = None
        result = await conn.list_nodes()
        assert result == []


# ── send_chat_streaming ──────────────────────────────────────────────


class TestSendChatStreaming:
    @pytest.mark.asyncio
    async def test_streaming_basic(self, conn):
        async def fake_call(*a, **kw):
            return {"text": "done"}

        conn.call = AsyncMock(side_effect=fake_call)

        # Simulate delta + done events via subscribe callback
        chunks = []

        def capture_subscribe(event, callback):
            # Fire events in background
            async def fire():
                await asyncio.sleep(0.05)
                callback(
                    {
                        "sessionKey": "agent:main:main",
                        "state": "delta",
                        "message": {"content": [{"text": "Hello"}]},
                    }
                )
                await asyncio.sleep(0.02)
                callback(
                    {
                        "sessionKey": "agent:main:main",
                        "state": "delta",
                        "message": {"content": [{"text": "Hello world"}]},
                    }
                )
                await asyncio.sleep(0.02)
                callback(
                    {
                        "sessionKey": "agent:main:main",
                        "state": "final",
                    }
                )

            asyncio.get_event_loop().create_task(fire())

        conn.subscribe = capture_subscribe

        async for chunk in conn.send_chat_streaming("hi", timeout=5.0):
            chunks.append(chunk)

        assert len(chunks) >= 1

    @pytest.mark.asyncio
    async def test_streaming_error(self, conn):
        async def fake_call(*a, **kw):
            return {"text": "done"}

        conn.call = AsyncMock(side_effect=fake_call)
        chunks = []

        def capture_subscribe(event, callback):
            async def fire():
                await asyncio.sleep(0.05)
                callback(
                    {
                        "sessionKey": "agent:main:main",
                        "state": "error",
                    }
                )

            asyncio.get_event_loop().create_task(fire())

        conn.subscribe = capture_subscribe

        async for chunk in conn.send_chat_streaming("hi", timeout=5.0):
            chunks.append(chunk)

        assert len(chunks) == 0
