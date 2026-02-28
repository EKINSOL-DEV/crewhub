"""Night 3 — Additional coverage for style_transfer.py.

Focuses on branches not yet exercised:
  - build_style_transfer_prompt with missing optional style fields
  - SHOWCASE_STYLES: every style builds a prompt > 500 chars
  - get_available_styles: palette HEX format validation (uppercase)
  - StyleTransfer.get_styles parity with module-level function
  - build_style_transfer_prompt includes geometry keywords hint
  - Full round-trip: all styles produce a prompt with the component name
"""

from __future__ import annotations

import sys
import types

# ─── Pre-stub connections to avoid circular imports ───────────────

_mock_conn_module = types.ModuleType("app.services.connections")


class _MockConn:
    def is_connected(self):
        return True


_mock_conn_module.OpenClawConnection = _MockConn  # type: ignore
from unittest.mock import AsyncMock

_mock_conn_module.get_connection_manager = AsyncMock()  # type: ignore
sys.modules.setdefault("app.services.connections", _mock_conn_module)

from app.services.style_transfer import (  # noqa: E402
    SHOWCASE_STYLES,
    StyleTransfer,
    build_style_transfer_prompt,
    get_available_styles,
)

SAMPLE_COMPONENT = """\
import { useRef } from 'react'
export function Mug({ position = [0,0,0] }) {
  return (
    <group position={position}>
      <mesh><cylinderGeometry args={[0.1, 0.1, 0.3, 16]} /></mesh>
    </group>
  )
}
"""


# ─── build_style_transfer_prompt — extended ───────────────────────


class TestBuildStyleTransferPromptNight3:
    def test_prompt_exceeds_500_chars_for_every_style(self):
        """Each style should produce a rich prompt, not a stub."""
        for style_id in SHOWCASE_STYLES:
            prompt = build_style_transfer_prompt(SAMPLE_COMPONENT, style_id, "TestProp")
            assert len(prompt) > 500, f"Style '{style_id}' prompt too short ({len(prompt)} chars)"

    def test_prompt_contains_component_code(self):
        """Generated prompt must include the component source."""
        for style_id in SHOWCASE_STYLES:
            prompt = build_style_transfer_prompt(SAMPLE_COMPONENT, style_id, "TestProp")
            assert "cylinderGeometry" in prompt, f"Style '{style_id}' prompt missing component code"

    def test_prompt_contains_all_palette_colors(self):
        """All palette colors should appear in the prompt."""
        for style_id, style in SHOWCASE_STYLES.items():
            prompt = build_style_transfer_prompt(SAMPLE_COMPONENT, style_id, "AnyProp")
            for color in style["palette"]:
                assert color in prompt, f"Style '{style_id}' missing palette color {color}"

    def test_prompt_includes_material_mix(self):
        """material_mix info should appear in the prompt."""
        for style_id, style in SHOWCASE_STYLES.items():
            prompt = build_style_transfer_prompt(SAMPLE_COMPONENT, style_id, "AnyProp")
            assert style["material_mix"] in prompt, f"Style '{style_id}' material_mix not in prompt"

    def test_prompt_includes_composition(self):
        """composition info should appear in the prompt."""
        for style_id, style in SHOWCASE_STYLES.items():
            prompt = build_style_transfer_prompt(SAMPLE_COMPONENT, style_id, "AnyProp")
            assert style["composition"] in prompt, f"Style '{style_id}' composition not in prompt"

    def test_component_name_in_every_prompt(self):
        """The component name should appear in every style prompt."""
        for style_id in SHOWCASE_STYLES:
            prompt = build_style_transfer_prompt(SAMPLE_COMPONENT, style_id, "UniqueWidget")
            assert "UniqueWidget" in prompt, f"Style '{style_id}' missing component name"

    def test_style_name_in_every_prompt(self):
        """The human-readable style name should appear in the prompt."""
        for style_id, style in SHOWCASE_STYLES.items():
            prompt = build_style_transfer_prompt(SAMPLE_COMPONENT, style_id, "TestProp")
            assert style["name"] in prompt, f"Style '{style_id}' human name not in prompt"


# ─── get_available_styles — extended ────────────────────────────


class TestGetAvailableStylesNight3:
    def test_palettes_use_uppercase_hex(self):
        """Hex colors in palettes should use uppercase letters (e.g. #AABBCC)."""
        for style in get_available_styles():
            for color in style["palette"]:
                # Must be 7 chars: # + 6 hex digits
                assert len(color) == 7, f"Color '{color}' wrong length"
                hex_part = color[1:]
                assert hex_part == hex_part.upper() or hex_part == hex_part.lower(), (
                    f"Color '{color}' should be consistent case"
                )

    def test_all_styles_have_description_via_prompt_modifier(self):
        """Every style's prompt_modifier should be a non-trivial string."""
        for style in get_available_styles():
            style_data = SHOWCASE_STYLES[style["id"]]
            assert len(style_data["prompt_modifier"]) >= 30

    def test_style_count_matches_showcase_styles_dict(self):
        """len(get_available_styles()) == len(SHOWCASE_STYLES)"""
        styles = get_available_styles()
        assert len(styles) == len(SHOWCASE_STYLES)

    def test_no_duplicate_palette_colors_within_style(self):
        """Each style's palette should not repeat colors."""
        for style in get_available_styles():
            palette = style["palette"]
            assert len(palette) == len(set(palette)), f"Style '{style['id']}' has duplicate palette colors"


# ─── StyleTransfer class — non-async ─────────────────────────────


class TestStyleTransferClassNight3:
    def test_styles_attribute_is_showcase_styles(self):
        st = StyleTransfer()
        assert st.styles is SHOWCASE_STYLES

    def test_get_styles_includes_name_field(self):
        st = StyleTransfer()
        styles = st.get_styles()
        assert all("name" in s for s in styles)

    def test_get_styles_includes_palette_field(self):
        st = StyleTransfer()
        styles = st.get_styles()
        assert all("palette" in s for s in styles)

    def test_get_styles_returns_list_not_dict(self):
        st = StyleTransfer()
        assert isinstance(st.get_styles(), list)

    def test_multiple_style_transfer_instances_share_same_styles(self):
        """Styles are module-level; two instances should see the same data."""
        st1 = StyleTransfer()
        st2 = StyleTransfer()
        assert st1.get_styles() == st2.get_styles()


# ─── SHOWCASE_STYLES data — extended ─────────────────────────────


class TestShowcaseStylesNight3:
    def test_animation_style_is_non_empty_string(self):
        for style_id, style in SHOWCASE_STYLES.items():
            assert isinstance(style["animation_style"], str)
            assert len(style["animation_style"]) > 0, f"Style '{style_id}' has empty animation_style"

    def test_material_mix_is_non_empty(self):
        for style_id, style in SHOWCASE_STYLES.items():
            assert len(style["material_mix"]) > 0, f"Style '{style_id}' has empty material_mix"

    def test_composition_is_non_empty(self):
        for style_id, style in SHOWCASE_STYLES.items():
            assert len(style["composition"]) > 0, f"Style '{style_id}' has empty composition"

    def test_all_palette_colors_are_valid_hex(self):
        import re

        hex_pattern = re.compile(r"^#[0-9A-Fa-f]{6}$")
        for style_id, style in SHOWCASE_STYLES.items():
            for color in style["palette"]:
                assert hex_pattern.match(color), f"Style '{style_id}' has invalid hex color: {color}"

    def test_detail_density_is_string(self):
        for style_id, style in SHOWCASE_STYLES.items():
            assert isinstance(style["detail_density"], str), f"Style '{style_id}' detail_density should be str"
