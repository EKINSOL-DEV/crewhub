"""Tests for app.services.creator.prop_ai — AI generation helper.

Covers generate_prop_via_ai with various connection states,
template load failures, AI response edge cases, and error paths.
"""

from __future__ import annotations

import sys
import types
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# We import lazily because prop_ai has lazy imports itself
import app.main  # noqa: F401

# ─── Helpers ──────────────────────────────────────────────────────


def _patch_connections(connected_conn=None, manager=None):
    """Patch the lazy app.services.connections import in prop_ai."""
    fake_mod = types.ModuleType("app.services.connections")

    class FakeOpenClawConnection:
        pass

    if connected_conn is not None:
        connected_conn.__class__ = FakeOpenClawConnection

    if manager is None:
        manager = MagicMock()
        if connected_conn is not None:
            manager.get_connections.return_value = {"conn-1": connected_conn}
        else:
            manager.get_connections.return_value = {}

    fake_mod.OpenClawConnection = FakeOpenClawConnection
    fake_mod.get_connection_manager = AsyncMock(return_value=manager)

    return patch.dict(sys.modules, {"app.services.connections": fake_mod})


# ─── generate_prop_via_ai ─────────────────────────────────────────


class TestGeneratePropViaAi:
    """Tests for the generate_prop_via_ai function."""

    async def _call(self, prompt="a red box", name="RedBox", model="sonnet-4-5", **ctx_patches):
        from app.services.creator.prop_ai import generate_prop_via_ai

        return await generate_prop_via_ai(prompt, name, model)

    @pytest.mark.asyncio
    async def test_no_template_returns_template_method(self):
        """When no prompt template found, fall back to template method."""
        with patch("app.services.creator.prop_ai.load_prompt_template", return_value=""):
            code, parts, method = await self._call()
        assert code is None
        assert parts == []
        assert method == "template"

    @pytest.mark.asyncio
    async def test_none_template_returns_template_method(self):
        """load_prompt_template returning falsy value → template fallback."""
        with patch("app.services.creator.prop_ai.load_prompt_template", return_value=None):
            code, parts, method = await self._call()
        assert method == "template"
        assert code is None

    @pytest.mark.asyncio
    async def test_no_connection_returns_template_method(self):
        """When no connected OpenClaw connection exists, return template."""
        with patch("app.services.creator.prop_ai.load_prompt_template", return_value="TEMPLATE"):
            with _patch_connections(connected_conn=None):
                code, parts, method = await self._call()
        assert method == "template"
        assert code is None

    @pytest.mark.asyncio
    async def test_disconnected_connection_skipped(self):
        """Connections that are not connected are skipped."""
        disconnected_conn = MagicMock()
        disconnected_conn.is_connected.return_value = False

        with patch("app.services.creator.prop_ai.load_prompt_template", return_value="TEMPLATE"):
            with _patch_connections(connected_conn=disconnected_conn):
                code, parts, method = await self._call()
        assert method == "template"

    @pytest.mark.asyncio
    async def test_ai_returns_none_response(self):
        """If connection.send_chat returns None, fall back to template."""
        conn = MagicMock()
        conn.is_connected.return_value = True
        conn.send_chat = AsyncMock(return_value=None)

        with patch("app.services.creator.prop_ai.load_prompt_template", return_value="TEMPLATE"):
            with _patch_connections(connected_conn=conn):
                code, parts, method = await self._call()
        assert method == "template"
        assert code is None

    @pytest.mark.asyncio
    async def test_ai_returns_empty_string(self):
        """Empty string from AI → template fallback."""
        conn = MagicMock()
        conn.is_connected.return_value = True
        conn.send_chat = AsyncMock(return_value="")

        with patch("app.services.creator.prop_ai.load_prompt_template", return_value="TEMPLATE"):
            with _patch_connections(connected_conn=conn):
                code, parts, method = await self._call()
        assert method == "template"

    @pytest.mark.asyncio
    async def test_ai_returns_invalid_code(self):
        """AI returns code that is not a valid mesh component → template fallback."""
        conn = MagicMock()
        conn.is_connected.return_value = True
        conn.send_chat = AsyncMock(return_value="not a valid react component")

        with patch("app.services.creator.prop_ai.load_prompt_template", return_value="TEMPLATE"):
            with _patch_connections(connected_conn=conn):
                code, parts, method = await self._call()
        assert method == "template"
        assert code is None

    @pytest.mark.asyncio
    async def test_ai_success_returns_ai_method(self):
        """Valid mesh component from AI → method='ai', code returned."""
        raw_code = "export function RedBox() { return <group><mesh><boxGeometry /></mesh></group> }"
        conn = MagicMock()
        conn.is_connected.return_value = True
        conn.send_chat = AsyncMock(return_value=raw_code)

        pp_result = MagicMock()
        pp_result.code = raw_code

        # enhance_generated_prop is lazily imported from app.services.prop_post_processor
        with patch("app.services.creator.prop_ai.load_prompt_template", return_value="TEMPLATE"):
            with patch("app.services.creator.prop_ai.parse_ai_parts", return_value=[{"type": "box"}]):
                with patch("app.services.creator.prop_ai.strip_parts_block", return_value=raw_code):
                    with _patch_connections(connected_conn=conn):
                        with patch(
                            "app.services.prop_post_processor.enhance_generated_prop",
                            return_value=pp_result,
                        ):
                            code, parts, method = await self._call()

        assert method == "ai"

    @pytest.mark.asyncio
    async def test_ai_success_strips_code_fences(self):
        """Markdown code fences are stripped before validation."""
        raw = "```tsx\nexport function X() { return <group><mesh /></group> }\n```"
        cleaned = "export function X() { return <group><mesh /></group> }"
        conn = MagicMock()
        conn.is_connected.return_value = True
        conn.send_chat = AsyncMock(return_value=raw)

        pp_result = MagicMock()
        pp_result.code = cleaned

        with patch("app.services.creator.prop_ai.load_prompt_template", return_value="TEMPLATE"):
            with patch("app.services.creator.prop_ai.parse_ai_parts", return_value=[]):
                with patch("app.services.creator.prop_ai.strip_parts_block", return_value=cleaned):
                    with _patch_connections(connected_conn=conn):
                        with patch(
                            "app.services.prop_post_processor.enhance_generated_prop",
                            return_value=pp_result,
                        ):
                            code, parts, method = await self._call()

        assert method == "ai"

    @pytest.mark.asyncio
    async def test_ai_exception_returns_template(self):
        """Exception during AI call → template fallback (no crash)."""
        conn = MagicMock()
        conn.is_connected.return_value = True
        conn.send_chat = AsyncMock(side_effect=ConnectionError("WebSocket closed"))

        with patch("app.services.creator.prop_ai.load_prompt_template", return_value="TEMPLATE"):
            with _patch_connections(connected_conn=conn):
                code, parts, method = await self._call()

        assert method == "template"
        assert code is None

    @pytest.mark.asyncio
    async def test_prompt_contains_prop_name_and_prompt(self):
        """The AI prompt sent to the connection includes the prop name and description."""
        conn = MagicMock()
        conn.is_connected.return_value = True
        captured_message = []

        async def capture_send_chat(message, agent_id, timeout):
            captured_message.append(message)
            return None

        conn.send_chat = capture_send_chat

        with patch("app.services.creator.prop_ai.load_prompt_template", return_value="MY_TEMPLATE"):
            with _patch_connections(connected_conn=conn):
                await self._call(prompt="a glowing orb", name="GlowOrb")

        assert captured_message, "send_chat was not called"
        msg = captured_message[0]
        assert "GlowOrb" in msg
        assert "a glowing orb" in msg
        assert "MY_TEMPLATE" in msg

    @pytest.mark.asyncio
    async def test_parse_ai_parts_called_with_raw(self):
        """parse_ai_parts is called with the cleaned AI text."""
        raw = "export function Foo() { return <group><mesh /></group> }"
        conn = MagicMock()
        conn.is_connected.return_value = True
        conn.send_chat = AsyncMock(return_value=raw)

        parse_calls = []

        def capture_parse(text):
            parse_calls.append(text)
            return None

        pp_result = MagicMock()
        pp_result.code = raw

        with patch("app.services.creator.prop_ai.load_prompt_template", return_value="T"):
            with patch("app.services.creator.prop_ai.parse_ai_parts", side_effect=capture_parse):
                with patch("app.services.creator.prop_ai.strip_parts_block", return_value=raw):
                    with _patch_connections(connected_conn=conn):
                        with patch(
                            "app.services.prop_post_processor.enhance_generated_prop",
                            return_value=pp_result,
                        ):
                            await self._call()

        assert parse_calls, "parse_ai_parts was not called"

    @pytest.mark.asyncio
    async def test_ai_parts_returned_on_success(self):
        """AI-parsed parts are returned when generation succeeds."""
        raw = "export function X() { return <group><mesh /></group> }"
        conn = MagicMock()
        conn.is_connected.return_value = True
        conn.send_chat = AsyncMock(return_value=raw)

        ai_parts = [{"type": "box", "color": "#ff0000"}]
        pp_result = MagicMock()
        pp_result.code = raw

        with patch("app.services.creator.prop_ai.load_prompt_template", return_value="T"):
            with patch("app.services.creator.prop_ai.parse_ai_parts", return_value=ai_parts):
                with patch("app.services.creator.prop_ai.strip_parts_block", return_value=raw):
                    with _patch_connections(connected_conn=conn):
                        with patch(
                            "app.services.prop_post_processor.enhance_generated_prop",
                            return_value=pp_result,
                        ):
                            code, parts, method = await self._call()

        assert parts == ai_parts
        assert method == "ai"

    @pytest.mark.asyncio
    async def test_timeout_returns_template(self):
        """Timeout during AI call → template fallback."""
        conn = MagicMock()
        conn.is_connected.return_value = True
        conn.send_chat = AsyncMock(side_effect=TimeoutError())

        with patch("app.services.creator.prop_ai.load_prompt_template", return_value="TEMPLATE"):
            with _patch_connections(connected_conn=conn):
                code, parts, method = await self._call()

        assert method == "template"
        assert code is None
