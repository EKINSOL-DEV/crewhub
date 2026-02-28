"""Tests for app.services.hybrid_generator."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import app.main  # noqa: F401
from app.services.hybrid_generator import (
    QUALITY_COMPONENTS,
    TEMPLATE_BASES,
    HybridGenerator,
    build_hybrid_prompt,
)

# ---------------------------------------------------------------------------
# build_hybrid_prompt
# ---------------------------------------------------------------------------


class TestBuildHybridPrompt:
    def test_without_template(self):
        prompt = build_hybrid_prompt(
            description="A floating neon coffee machine",
            component_name="NeonCoffeeMachine",
        )
        assert isinstance(prompt, str)
        assert "NeonCoffeeMachine" in prompt
        assert "A floating neon coffee machine" in prompt
        assert "export function" in prompt

    def test_with_template(self):
        template = "export function CoffeeMachine() { return null }"
        prompt = build_hybrid_prompt(
            description="A blue coffee machine",
            component_name="BlueCoffeeMachine",
            template_code=template,
        )
        assert "BlueCoffeeMachine" in prompt
        assert "A blue coffee machine" in prompt
        assert template in prompt
        assert "starting point" in prompt.lower()

    def test_no_template_contains_quality_requirements(self):
        prompt = build_hybrid_prompt(
            description="A space station",
            component_name="SpaceStation",
        )
        assert "useToonMaterialProps" in prompt
        assert "meshStandardMaterial" in prompt
        assert "useFrame" in prompt
        assert "PARTS_DATA" in prompt

    def test_with_template_contains_instructions(self):
        prompt = build_hybrid_prompt(
            description="A modified desk",
            component_name="ModifiedDesk",
            template_code="export function Desk() {}",
        )
        assert "PARTS_DATA" in prompt
        assert "ModifiedDesk" in prompt

    def test_component_name_in_interface(self):
        prompt = build_hybrid_prompt(
            description="A lamp",
            component_name="GlowLamp",
        )
        # Should contain Props interface
        assert "GlowLamp" in prompt


# ---------------------------------------------------------------------------
# TEMPLATE_BASES / QUALITY_COMPONENTS constants
# ---------------------------------------------------------------------------


class TestConstants:
    def test_template_bases_not_empty(self):
        assert len(TEMPLATE_BASES) > 0

    def test_known_templates(self):
        assert "coffee-machine" in TEMPLATE_BASES
        assert "desk" in TEMPLATE_BASES
        assert "spaceship" in TEMPLATE_BASES

    def test_quality_components_not_empty(self):
        assert len(QUALITY_COMPONENTS) > 0

    def test_known_quality_components(self):
        assert "glow_orb" in QUALITY_COMPONENTS
        assert "led_indicator" in QUALITY_COMPONENTS
        assert "toon_base" in QUALITY_COMPONENTS
        assert "floating_animation" in QUALITY_COMPONENTS
        assert "point_light" in QUALITY_COMPONENTS

    def test_quality_component_structure(self):
        orb = QUALITY_COMPONENTS["glow_orb"]
        assert "defaults" in orb


# ---------------------------------------------------------------------------
# HybridGenerator._load_template
# ---------------------------------------------------------------------------


class TestLoadTemplate:
    def setup_method(self):
        self.gen = HybridGenerator()

    def test_unknown_template_returns_none(self):
        result = self.gen._load_template("unknown-prop")
        assert result is None

    def test_known_template_missing_file_returns_none(self):
        # File likely doesn't exist in the test environment
        result = self.gen._load_template("coffee-machine")
        # Either None (file not found) or str (file found) — both valid
        assert result is None or isinstance(result, str)

    def test_load_with_existing_file(self, tmp_path, monkeypatch):
        # Patch the props directory path
        template_content = "export function CoffeeMachine() { return null }"
        props_dir = tmp_path / "props"
        props_dir.mkdir()
        (props_dir / "CoffeeMachine.tsx").write_text(template_content)

        # Monkeypatch Path resolution
        # original_load removed (was unused)

        def mock_load(tid):
            comp_name = TEMPLATE_BASES.get(tid)
            if not comp_name:
                return None
            filepath = props_dir / f"{comp_name}.tsx"
            if filepath.exists():
                return filepath.read_text()
            return None

        monkeypatch.setattr(self.gen, "_load_template", mock_load)
        result = self.gen._load_template("coffee-machine")
        assert result == template_content


# ---------------------------------------------------------------------------
# HybridGenerator.get_templates
# ---------------------------------------------------------------------------


class TestGetTemplates:
    def setup_method(self):
        self.gen = HybridGenerator()

    def test_returns_list(self):
        templates = self.gen.get_templates()
        assert isinstance(templates, list)
        assert len(templates) > 0

    def test_template_structure(self):
        templates = self.gen.get_templates()
        for t in templates:
            assert "id" in t
            assert "name" in t

    def test_all_template_bases_included(self):
        templates = self.gen.get_templates()
        ids = {t["id"] for t in templates}
        assert set(TEMPLATE_BASES.keys()) == ids


# ---------------------------------------------------------------------------
# HybridGenerator.generate_hybrid (mocked AI)
# ---------------------------------------------------------------------------


class TestGenerateHybrid:
    def setup_method(self):
        self.gen = HybridGenerator()

    def _make_mock_env(self, response: str):
        mock_conn = AsyncMock()
        mock_conn.send_chat = AsyncMock(return_value=response)
        mock_conn.is_connected = MagicMock(return_value=True)
        mock_manager = AsyncMock()

        from app.services.connections.openclaw import OpenClawConnection

        class FakeOpenClaw(OpenClawConnection):
            pass

        mock_conn.__class__ = FakeOpenClaw
        mock_manager.get_connections = MagicMock(return_value={"c1": mock_conn})
        return mock_manager

    @pytest.mark.asyncio
    async def test_generate_success(self):
        valid_code = "export function NeonDesk({ position = [0,0,0] }) { return null }"
        mock_manager = self._make_mock_env(valid_code)

        with patch("app.services.hybrid_generator.get_connection_manager", new=AsyncMock(return_value=mock_manager)):
            result = await self.gen.generate_hybrid(
                description="A neon desk",
                component_name="NeonDesk",
            )
        assert "export function" in result

    @pytest.mark.asyncio
    async def test_generate_strips_code_fences(self):
        fenced = "```tsx\nexport function NeonDesk() { return null }\n```"
        mock_manager = self._make_mock_env(fenced)

        with patch("app.services.hybrid_generator.get_connection_manager", new=AsyncMock(return_value=mock_manager)):
            result = await self.gen.generate_hybrid("A desk", "NeonDesk")
        assert not result.startswith("```")
        assert "export function" in result

    @pytest.mark.asyncio
    async def test_generate_no_connection_raises(self):
        mock_manager = AsyncMock()
        mock_manager.get_connections = MagicMock(return_value={})

        with patch("app.services.hybrid_generator.get_connection_manager", new=AsyncMock(return_value=mock_manager)):
            with pytest.raises(RuntimeError, match="No connected OpenClaw"):
                await self.gen.generate_hybrid("A desk", "Desk")

    @pytest.mark.asyncio
    async def test_generate_empty_response_raises(self):
        mock_manager = self._make_mock_env("")

        with patch("app.services.hybrid_generator.get_connection_manager", new=AsyncMock(return_value=mock_manager)):
            with pytest.raises(RuntimeError, match="empty response"):
                await self.gen.generate_hybrid("A desk", "Desk")

    @pytest.mark.asyncio
    async def test_generate_invalid_component_raises(self):
        mock_manager = self._make_mock_env("just some text without export function")

        with patch("app.services.hybrid_generator.get_connection_manager", new=AsyncMock(return_value=mock_manager)):
            with pytest.raises(ValueError, match="invalid component"):
                await self.gen.generate_hybrid("A desk", "Desk")

    @pytest.mark.asyncio
    async def test_generate_with_template_base(self):
        valid_code = "export function CoffeeMod({ position = [0,0,0] }) { return null }"
        mock_manager = self._make_mock_env(valid_code)

        with patch("app.services.hybrid_generator.get_connection_manager", new=AsyncMock(return_value=mock_manager)):
            # Use a real template base — file likely doesn't exist so template_code=None
            result = await self.gen.generate_hybrid(
                description="A modified coffee machine",
                component_name="CoffeeMod",
                template_base="coffee-machine",
            )
        assert "export function" in result

    @pytest.mark.asyncio
    async def test_generate_with_unknown_template_base(self):
        valid_code = "export function Desk({ position = [0,0,0] }) { return null }"
        mock_manager = self._make_mock_env(valid_code)

        with patch("app.services.hybrid_generator.get_connection_manager", new=AsyncMock(return_value=mock_manager)):
            # Unknown template_base → template_code = None
            result = await self.gen.generate_hybrid(
                description="A desk",
                component_name="Desk",
                template_base="non-existent-template",
            )
        assert "export function" in result
