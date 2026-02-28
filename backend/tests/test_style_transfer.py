"""Tests for style_transfer.py — showcase style application service."""

import sys
import types
from unittest.mock import AsyncMock, MagicMock

import pytest

# ─── Pre-stub the connections module to avoid circular imports ────

_mock_conn_module = types.ModuleType("app.services.connections")


class _MockOpenClawConnection:
    def is_connected(self):
        return True


_mock_conn_module.OpenClawConnection = _MockOpenClawConnection  # type: ignore
_mock_conn_module.get_connection_manager = AsyncMock()  # type: ignore
sys.modules.setdefault("app.services.connections", _mock_conn_module)
sys.modules.setdefault("app.services.connections.connection_manager", _mock_conn_module)

from app.services.style_transfer import (  # noqa: E402 — must come after stub
    SHOWCASE_STYLES,
    StyleTransfer,
    build_style_transfer_prompt,
    get_available_styles,
)

# ─── Fixtures ────────────────────────────────────────────────────


SAMPLE_COMPONENT = """\
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

interface MugProps {
  position?: [number, number, number]
  scale?: number
}

export function Mug({ position = [0, 0, 0], scale = 1 }: MugProps) {
  const groupRef = useRef(null)

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.005
    }
  })

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <mesh castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.32, 16]} />
        <meshToonMaterial color="#EEEEEE" />
      </mesh>
      <mesh position={[0.16, 0.18, 0]}>
        <torusGeometry args={[0.06, 0.015, 8, 16]} />
        <meshToonMaterial color="#CCCCCC" />
      </mesh>
    </group>
  )
}
"""


# ─── get_available_styles ─────────────────────────────────────────


class TestGetAvailableStyles:
    def test_returns_list(self):
        styles = get_available_styles()
        assert isinstance(styles, list)
        assert len(styles) > 0

    def test_each_style_has_required_fields(self):
        styles = get_available_styles()
        for s in styles:
            assert "id" in s
            assert "name" in s
            assert "palette" in s

    def test_palette_is_list_of_hex_colors(self):
        styles = get_available_styles()
        for s in styles:
            for color in s["palette"]:
                assert color.startswith("#"), f"Expected hex color, got: {color}"

    def test_ids_are_unique(self):
        styles = get_available_styles()
        ids = [s["id"] for s in styles]
        assert len(ids) == len(set(ids))

    def test_all_showcase_styles_represented(self):
        styles = get_available_styles()
        ids = {s["id"] for s in styles}
        assert ids == set(SHOWCASE_STYLES.keys())

    def test_coffee_machine_style_present(self):
        styles = get_available_styles()
        ids = [s["id"] for s in styles]
        assert "coffee-machine" in ids

    def test_spaceship_style_present(self):
        styles = get_available_styles()
        ids = [s["id"] for s in styles]
        assert "spaceship" in ids


# ─── build_style_transfer_prompt ─────────────────────────────────


class TestBuildStyleTransferPrompt:
    def test_raises_for_unknown_style(self):
        with pytest.raises(ValueError, match="Unknown style source"):
            build_style_transfer_prompt(SAMPLE_COMPONENT, "nonexistent-style", "Mug")

    def test_includes_component_name(self):
        prompt = build_style_transfer_prompt(SAMPLE_COMPONENT, "coffee-machine", "Mug")
        assert "Mug" in prompt

    def test_includes_current_code(self):
        prompt = build_style_transfer_prompt(SAMPLE_COMPONENT, "coffee-machine", "Mug")
        assert "cylinderGeometry" in prompt  # from sample code

    def test_includes_style_name(self):
        prompt = build_style_transfer_prompt(SAMPLE_COMPONENT, "coffee-machine", "Mug")
        assert "Coffee Machine" in prompt

    def test_includes_palette_colors(self):
        prompt = build_style_transfer_prompt(SAMPLE_COMPONENT, "coffee-machine", "Mug")
        coffee_palette = SHOWCASE_STYLES["coffee-machine"]["palette"]
        # At least one color from palette should be in prompt
        assert any(color in prompt for color in coffee_palette)

    def test_includes_animation_style(self):
        prompt = build_style_transfer_prompt(SAMPLE_COMPONENT, "lamp", "Lamp")
        assert SHOWCASE_STYLES["lamp"]["animation_style"] in prompt

    def test_includes_prompt_modifier(self):
        prompt = build_style_transfer_prompt(SAMPLE_COMPONENT, "spaceship", "Ship")
        modifier = SHOWCASE_STYLES["spaceship"]["prompt_modifier"]
        # first ~50 chars of the modifier should be in prompt
        assert modifier[:50] in prompt

    def test_output_directive_present(self):
        prompt = build_style_transfer_prompt(SAMPLE_COMPONENT, "desk", "Desk")
        assert "ONLY the complete" in prompt or "component" in prompt.lower()

    def test_all_styles_buildable(self):
        for style_id in SHOWCASE_STYLES:
            prompt = build_style_transfer_prompt(SAMPLE_COMPONENT, style_id, "TestProp")
            assert len(prompt) > 100


# ─── SHOWCASE_STYLES data integrity ──────────────────────────────


class TestShowcaseStylesData:
    def test_all_required_keys_present(self):
        required = {
            "name",
            "palette",
            "material_mix",
            "detail_density",
            "animation_style",
            "composition",
            "prompt_modifier",
        }
        for style_id, style in SHOWCASE_STYLES.items():
            missing = required - set(style.keys())
            assert not missing, f"Style '{style_id}' missing keys: {missing}"

    def test_palettes_have_at_least_3_colors(self):
        for style_id, style in SHOWCASE_STYLES.items():
            assert len(style["palette"]) >= 3, f"Style '{style_id}' has too few palette colors"

    def test_names_are_non_empty_strings(self):
        for style_id, style in SHOWCASE_STYLES.items():
            assert isinstance(style["name"], str) and style["name"], f"Style '{style_id}' has empty name"

    def test_prompt_modifiers_are_non_empty(self):
        for style_id, style in SHOWCASE_STYLES.items():
            assert len(style["prompt_modifier"]) > 20, f"Style '{style_id}' has trivial prompt_modifier"

    def test_detail_density_values(self):
        valid = {"low", "medium", "high", "low-medium"}
        for style_id, style in SHOWCASE_STYLES.items():
            assert style["detail_density"] in valid, (
                f"Style '{style_id}' has unexpected detail_density: {style['detail_density']}"
            )

    def test_specific_coffee_machine_palette(self):
        palette = SHOWCASE_STYLES["coffee-machine"]["palette"]
        # Should have warm brown/gold tones
        assert any("8B" in c or "DA" in c for c in palette)

    def test_specific_spaceship_has_emissive_mention(self):
        modifier = SHOWCASE_STYLES["spaceship"]["prompt_modifier"]
        assert "emissive" in modifier.lower()

    def test_lamp_animation_mentions_glow(self):
        anim = SHOWCASE_STYLES["lamp"]["animation_style"]
        assert "glow" in anim.lower() or "pulse" in anim.lower()


# ─── StyleTransfer class ──────────────────────────────────────────


class TestStyleTransferInit:
    def test_init_stores_styles(self):
        st = StyleTransfer()
        assert st.styles is SHOWCASE_STYLES

    def test_get_styles_returns_same_as_function(self):
        st = StyleTransfer()
        from_method = st.get_styles()
        from_function = get_available_styles()
        assert from_method == from_function


class TestStyleTransferApplyStyle:
    """Test apply_style by controlling the stub connections module."""

    def setup_method(self):
        self.st = StyleTransfer()
        # Get the stub connections module
        self.conn_mod = sys.modules["app.services.connections"]

    def _make_manager(self, connections: dict):
        manager = MagicMock()  # sync mock so get_connections() returns dict directly
        manager.get_connections.return_value = connections
        return manager

    def _make_conn(self, *, connected: bool, response: str = ""):
        # Use MagicMock so is_connected() returns a plain bool (not a coroutine).
        # send_chat must be awaited in production code, so replace it with AsyncMock.
        conn = MagicMock()
        conn.is_connected.return_value = connected
        conn.send_chat = AsyncMock(return_value=response)
        conn.__class__ = self.conn_mod.OpenClawConnection  # type: ignore
        return conn

    @pytest.mark.asyncio
    async def test_raises_if_no_connection(self):
        manager = self._make_manager({})
        self.conn_mod.get_connection_manager = AsyncMock(return_value=manager)  # type: ignore
        with pytest.raises(RuntimeError, match="No connected OpenClaw"):
            await self.st.apply_style(SAMPLE_COMPONENT, "coffee-machine", "Mug")

    @pytest.mark.asyncio
    async def test_raises_for_empty_ai_response(self):
        conn = self._make_conn(connected=True, response="")
        manager = self._make_manager({"c1": conn})
        self.conn_mod.get_connection_manager = AsyncMock(return_value=manager)  # type: ignore
        with pytest.raises(RuntimeError, match="empty response"):
            await self.st.apply_style(SAMPLE_COMPONENT, "spaceship", "Ship")

    @pytest.mark.asyncio
    async def test_raises_for_invalid_component_response(self):
        conn = self._make_conn(connected=True, response="Here's your styled component!")
        manager = self._make_manager({"c1": conn})
        self.conn_mod.get_connection_manager = AsyncMock(return_value=manager)  # type: ignore
        with pytest.raises(ValueError, match="invalid component"):
            await self.st.apply_style(SAMPLE_COMPONENT, "lamp", "Lamp")

    @pytest.mark.asyncio
    async def test_strips_markdown_fences(self):
        response = "```tsx\nexport function StyledMug() {\n  return <group />\n}\n```"
        conn = self._make_conn(connected=True, response=response)
        manager = self._make_manager({"c1": conn})
        self.conn_mod.get_connection_manager = AsyncMock(return_value=manager)  # type: ignore
        result = await self.st.apply_style(SAMPLE_COMPONENT, "coffee-machine", "Mug")
        assert "```" not in result
        assert "export function" in result

    @pytest.mark.asyncio
    async def test_successful_style_transfer(self):
        response = "export function StyledMug({ position = [0,0,0] }) {\n  return <group />\n}\n"
        conn = self._make_conn(connected=True, response=response)
        manager = self._make_manager({"c1": conn})
        self.conn_mod.get_connection_manager = AsyncMock(return_value=manager)  # type: ignore
        result = await self.st.apply_style(SAMPLE_COMPONENT, "monitor", "StyledMug")
        assert "export function" in result
        assert "StyledMug" in result

    @pytest.mark.asyncio
    async def test_strips_plain_code_fence(self):
        response = "```\nexport function StyledProp() {\n  return <group />\n}\n```"
        conn = self._make_conn(connected=True, response=response)
        manager = self._make_manager({"c1": conn})
        self.conn_mod.get_connection_manager = AsyncMock(return_value=manager)  # type: ignore
        result = await self.st.apply_style(SAMPLE_COMPONENT, "plant", "StyledProp")
        assert "```" not in result

    @pytest.mark.asyncio
    async def test_uses_connected_connection_only(self):
        disconnected = self._make_conn(connected=False)
        connected = self._make_conn(connected=True, response="export function X() { return <group /> }")
        manager = self._make_manager({"disconn": disconnected, "conn": connected})
        self.conn_mod.get_connection_manager = AsyncMock(return_value=manager)  # type: ignore
        result = await self.st.apply_style(SAMPLE_COMPONENT, "desk", "X")
        assert "export function" in result
        disconnected.send_chat.assert_not_called()
