"""Tests for app.services.prop_iterator."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import app.main  # noqa: F401
from app.services.prop_iterator import (
    IterationHistory,
    IterationRecord,
    PropIterator,
    build_iteration_prompt,
    detect_feedback_type,
)

# ---------------------------------------------------------------------------
# detect_feedback_type
# ---------------------------------------------------------------------------


class TestDetectFeedbackType:
    def test_color_feedback(self):
        assert detect_feedback_type("make it more colorful") == "color"
        assert detect_feedback_type("change color to blue") == "color"
        assert detect_feedback_type("make it brighter") == "color"
        assert detect_feedback_type("darker tones please") == "color"
        assert detect_feedback_type("neon green look") == "color"
        assert detect_feedback_type("pastel palette") == "color"
        assert detect_feedback_type("warm colors") == "color"
        assert detect_feedback_type("cool colors") == "color"
        assert detect_feedback_type("monochrome style") == "color"
        assert detect_feedback_type("use red instead of blue") == "color"

    def test_size_feedback(self):
        assert detect_feedback_type("make it taller") == "size"
        assert detect_feedback_type("shorter please") == "size"
        assert detect_feedback_type("make it bigger") == "size"
        assert detect_feedback_type("smaller scale") == "size"
        assert detect_feedback_type("wider base") == "size"
        assert detect_feedback_type("thinner legs") == "size"
        assert detect_feedback_type("scale up") == "size"
        assert detect_feedback_type("enlarge the head") == "size"
        assert detect_feedback_type("shrink it") == "size"
        assert detect_feedback_type("more compact") == "size"

    def test_detail_feedback(self):
        assert detect_feedback_type("add blue lights") == "detail"
        assert detect_feedback_type("add steam effect") == "detail"
        assert detect_feedback_type("add glow effect") == "detail"
        assert detect_feedback_type("add led indicators") == "detail"
        assert detect_feedback_type("more detail please") == "detail"
        assert detect_feedback_type("add texture") == "detail"
        assert detect_feedback_type("add a button") == "detail"
        assert detect_feedback_type("add a screen") == "detail"

    def test_animation_feedback(self):
        assert detect_feedback_type("spin faster") == "animation"
        assert detect_feedback_type("spin slower please") == "animation"
        assert detect_feedback_type("stop spinning") == "animation"
        assert detect_feedback_type("add pulsing effect") == "animation"
        assert detect_feedback_type("make it float") == "animation"
        assert detect_feedback_type("add bobbing motion") == "animation"
        assert detect_feedback_type("make it move") == "animation"
        assert detect_feedback_type("animate it") == "animation"
        assert detect_feedback_type("add rotation") == "animation"
        assert detect_feedback_type("oscillate gently") == "animation"

    def test_style_feedback(self):
        assert detect_feedback_type("more futuristic") == "style"
        assert detect_feedback_type("more rustic feel") == "style"
        assert detect_feedback_type("simpler design") == "style"
        assert detect_feedback_type("steampunk style") == "style"
        assert detect_feedback_type("cyberpunk aesthetic") == "style"
        assert detect_feedback_type("organic shapes") == "style"
        assert detect_feedback_type("mechanical look") == "style"
        assert detect_feedback_type("retro design") == "style"
        assert detect_feedback_type("modern minimal") == "style"
        assert detect_feedback_type("ornate details") == "style"

    def test_general_feedback(self):
        assert detect_feedback_type("looks good, just fix the proportions") == "general"
        assert detect_feedback_type("the overall shape is wrong") == "general"
        assert detect_feedback_type("random text here") == "general"

    def test_case_insensitive(self):
        assert detect_feedback_type("MAKE IT BRIGHTER") == "color"
        assert detect_feedback_type("SPIN FASTER") == "animation"

    def test_empty_feedback(self):
        assert detect_feedback_type("") == "general"


# ---------------------------------------------------------------------------
# build_iteration_prompt
# ---------------------------------------------------------------------------


class TestBuildIterationPrompt:
    def test_returns_string(self):
        prompt = build_iteration_prompt(
            original_code="export function Test() {}",
            feedback="make it blue",
            component_name="Test",
            feedback_type="color",
        )
        assert isinstance(prompt, str)
        assert len(prompt) > 50

    def test_contains_original_code(self):
        code = "export function MyProp() { return null }"
        prompt = build_iteration_prompt(code, "bigger", "MyProp", "size")
        assert code in prompt

    def test_contains_feedback(self):
        feedback = "add glowing LEDs"
        prompt = build_iteration_prompt("export function P() {}", feedback, "P", "detail")
        assert feedback in prompt

    def test_contains_component_name(self):
        prompt = build_iteration_prompt("export function Desk() {}", "blue color", "Desk", "color")
        assert "Desk" in prompt

    def test_contains_feedback_type_guidance(self):
        prompt = build_iteration_prompt("export function P() {}", "blue", "P", "color")
        # Color type guidance contains color-specific instructions
        assert "color" in prompt.lower()

    def test_all_feedback_types_produce_prompt(self):
        for ftype in ["color", "size", "detail", "animation", "style", "general"]:
            prompt = build_iteration_prompt("code", "feedback", "Comp", ftype)
            assert isinstance(prompt, str)
            assert len(prompt) > 10

    def test_unknown_feedback_type_uses_general(self):
        prompt = build_iteration_prompt("code", "feedback", "Comp", "unknown_type")
        assert isinstance(prompt, str)
        assert "Apply the feedback" in prompt

    def test_contains_rules(self):
        prompt = build_iteration_prompt("code", "feedback", "Comp", "color")
        assert "Rules" in prompt or "Output ONLY" in prompt

    def test_contains_parts_data_instruction(self):
        prompt = build_iteration_prompt("code", "feedback", "Comp", "style")
        assert "PARTS_DATA" in prompt


# ---------------------------------------------------------------------------
# IterationRecord and IterationHistory
# ---------------------------------------------------------------------------


class TestIterationRecord:
    def test_creation(self):
        record = IterationRecord(
            version=1,
            feedback="make it blue",
            quality_score=75,
            code="export function P() {}",
        )
        assert record.version == 1
        assert record.feedback == "make it blue"
        assert record.quality_score == 75

    def test_default_timestamp(self):
        record = IterationRecord(version=1, feedback="x", quality_score=0, code="")
        assert record.timestamp == ""


class TestIterationHistory:
    def test_creation(self):
        history = IterationHistory(prop_id="prop-1")
        assert history.prop_id == "prop-1"
        assert history.iterations == []

    def test_to_dict(self):
        history = IterationHistory(
            prop_id="prop-1",
            iterations=[
                IterationRecord(version=1, feedback="blue", quality_score=60, code="code1"),
            ],
        )
        d = history.to_dict()
        assert d["prop_id"] == "prop-1"
        assert len(d["iterations"]) == 1
        assert d["iterations"][0]["version"] == 1

    def test_add_iterations(self):
        history = IterationHistory(prop_id="prop-1")
        history.iterations.append(IterationRecord(version=1, feedback="bigger", quality_score=50, code="v1"))
        history.iterations.append(IterationRecord(version=2, feedback="bluer", quality_score=65, code="v2"))
        assert len(history.iterations) == 2
        assert history.iterations[-1].version == 2


# ---------------------------------------------------------------------------
# PropIterator.iterate_prop (mocked AI)
# ---------------------------------------------------------------------------


class TestPropIterator:
    def setup_method(self):
        self.iterator = PropIterator()

    @pytest.mark.asyncio
    async def test_iterate_prop_success(self):
        valid_response = """export function UpdatedDesk({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <mesh><boxGeometry /><meshStandardMaterial color="#0000ff" /></mesh>
    </group>
  )
}"""
        mock_conn = AsyncMock()
        mock_conn.send_chat = AsyncMock(return_value=valid_response)
        mock_conn.is_connected = MagicMock(return_value=True)

        mock_manager = AsyncMock()
        mock_manager.get_connections = MagicMock(return_value={"c1": mock_conn})

        with patch("app.services.prop_iterator.get_connection_manager", new=AsyncMock(return_value=mock_manager)):
            from app.services.connections.openclaw import OpenClawConnection

            with patch.object(OpenClawConnection, "__instancecheck__", return_value=True):
                # Directly mock the connection check
                mock_conn.__class__ = type(
                    "MockOpenClaw", (), {"is_connected": lambda self: True, "send_chat": mock_conn.send_chat}
                )
                code, ftype = await self.iterator.iterate_prop(
                    original_code="export function Desk() {}",
                    feedback="make it blue",
                    component_name="Desk",
                )
                assert "export function" in code
                assert ftype == "color"

    @pytest.mark.asyncio
    async def test_iterate_prop_no_connection_raises(self):
        mock_manager = AsyncMock()
        mock_manager.get_connections = MagicMock(return_value={})

        with patch("app.services.prop_iterator.get_connection_manager", new=AsyncMock(return_value=mock_manager)):
            with pytest.raises(RuntimeError, match="No connected OpenClaw"):
                await self.iterator.iterate_prop(
                    original_code="export function Desk() {}",
                    feedback="make it blue",
                    component_name="Desk",
                )

    @pytest.mark.asyncio
    async def test_iterate_prop_empty_response_raises(self):
        mock_conn = AsyncMock()
        mock_conn.send_chat = AsyncMock(return_value="")
        mock_conn.is_connected = MagicMock(return_value=True)
        mock_manager = AsyncMock()

        from app.services.connections.openclaw import OpenClawConnection

        # Make the connection look like an OpenClawConnection
        class FakeOpenClaw(OpenClawConnection):
            pass

        mock_conn.__class__ = FakeOpenClaw

        mock_manager.get_connections = MagicMock(return_value={"c1": mock_conn})

        with patch("app.services.prop_iterator.get_connection_manager", new=AsyncMock(return_value=mock_manager)):
            with pytest.raises(RuntimeError, match="empty response"):
                await self.iterator.iterate_prop(
                    original_code="export function Desk() {}",
                    feedback="make it blue",
                    component_name="Desk",
                )

    @pytest.mark.asyncio
    async def test_iterate_prop_invalid_component_raises(self):
        mock_conn = AsyncMock()
        mock_conn.send_chat = AsyncMock(return_value="just some text without export function")
        mock_conn.is_connected = MagicMock(return_value=True)
        mock_manager = AsyncMock()

        from app.services.connections.openclaw import OpenClawConnection

        class FakeOpenClaw(OpenClawConnection):
            pass

        mock_conn.__class__ = FakeOpenClaw

        mock_manager.get_connections = MagicMock(return_value={"c1": mock_conn})

        with patch("app.services.prop_iterator.get_connection_manager", new=AsyncMock(return_value=mock_manager)):
            with pytest.raises(ValueError, match="valid component"):
                await self.iterator.iterate_prop(
                    original_code="export function Desk() {}",
                    feedback="make it blue",
                    component_name="Desk",
                )

    @pytest.mark.asyncio
    async def test_iterate_prop_strips_code_fences(self):
        raw_with_fences = "```tsx\nexport function Desk() { return null }\n```"
        mock_conn = AsyncMock()
        mock_conn.send_chat = AsyncMock(return_value=raw_with_fences)
        mock_conn.is_connected = MagicMock(return_value=True)
        mock_manager = AsyncMock()

        from app.services.connections.openclaw import OpenClawConnection

        class FakeOpenClaw(OpenClawConnection):
            pass

        mock_conn.__class__ = FakeOpenClaw

        mock_manager.get_connections = MagicMock(return_value={"c1": mock_conn})

        with patch("app.services.prop_iterator.get_connection_manager", new=AsyncMock(return_value=mock_manager)):
            code, _ = await self.iterator.iterate_prop(
                original_code="export function Desk() {}",
                feedback="bigger",
                component_name="Desk",
            )
        assert not code.startswith("```")
        assert "export function" in code

    @pytest.mark.asyncio
    async def test_iterate_prop_correct_feedback_type(self):
        mock_conn = AsyncMock()
        mock_conn.send_chat = AsyncMock(return_value="export function P() { return null }")
        mock_conn.is_connected = MagicMock(return_value=True)
        mock_manager = AsyncMock()

        from app.services.connections.openclaw import OpenClawConnection

        class FakeOpenClaw(OpenClawConnection):
            pass

        mock_conn.__class__ = FakeOpenClaw

        mock_manager.get_connections = MagicMock(return_value={"c1": mock_conn})

        with patch("app.services.prop_iterator.get_connection_manager", new=AsyncMock(return_value=mock_manager)):
            _, ftype = await self.iterator.iterate_prop(
                original_code="export function P() {}",
                feedback="spin faster",
                component_name="P",
            )
        assert ftype == "animation"
