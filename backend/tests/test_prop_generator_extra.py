"""Extra coverage for app.services.creator.prop_generator.

Targets branches not exercised in test_prop_generator.py:
  - load_prompt_template FileNotFoundError path
  - add_generation_record exception/logger path
  - load_saved_props exception path
  - generate_template_code with various shape keywords
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.services.creator.prop_generator import (
    add_generation_record,
    generate_template_code,
    load_prompt_template,
    load_saved_props,
)

# ─── load_prompt_template ─────────────────────────────────────────


class TestLoadPromptTemplate:
    def test_returns_content_when_file_exists(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpl = Path(tmpdir) / "prompt.md"
            tmpl.write_text("Hello template!")
            with patch("app.services.creator.prop_generator.PROMPT_TEMPLATE_PATH", tmpl):
                result = load_prompt_template()
        assert result == "Hello template!"

    def test_returns_empty_string_when_file_missing(self):
        missing = Path("/nonexistent/path/prompt_template.md")
        with patch("app.services.creator.prop_generator.PROMPT_TEMPLATE_PATH", missing):
            result = load_prompt_template()
        assert result == ""

    def test_logs_warning_when_file_missing(self):
        missing = Path("/nonexistent/path/prompt_template.md")
        with patch("app.services.creator.prop_generator.PROMPT_TEMPLATE_PATH", missing):
            with patch("app.services.creator.prop_generator.logger") as mock_logger:
                load_prompt_template()
        mock_logger.warning.assert_called_once()
        assert "not found" in mock_logger.warning.call_args[0][0].lower()


# ─── add_generation_record — exception path ───────────────────────


class TestAddGenerationRecordExceptionPath:
    def test_exception_in_load_is_caught_and_logged(self):
        """If load/save raises, the exception is swallowed and logged."""
        with patch(
            "app.services.creator.prop_generator.load_generation_history",
            side_effect=RuntimeError("disk full"),
        ):
            with patch("app.services.creator.prop_generator.logger") as mock_logger:
                # Should not raise
                add_generation_record({"id": "test", "prompt": "test"})
            mock_logger.error.assert_called_once()
            assert "Failed to save" in mock_logger.error.call_args[0][0]

    def test_exception_in_save_is_caught_and_logged(self):
        """If save_generation_history raises, the error is logged."""
        with patch("app.services.creator.prop_generator.load_generation_history", return_value=[]):
            with patch(
                "app.services.creator.prop_generator.save_generation_history",
                side_effect=OSError("permission denied"),
            ):
                with patch("app.services.creator.prop_generator.logger") as mock_logger:
                    add_generation_record({"id": "x"})
                mock_logger.error.assert_called_once()

    def test_normal_add_does_not_raise(self):
        """Happy path: record added without error."""
        with tempfile.TemporaryDirectory() as tmpdir:
            hist_path = Path(tmpdir) / "history.json"
            with patch("app.services.creator.prop_generator.GENERATION_HISTORY_PATH", hist_path):
                add_generation_record({"id": "rec1", "prompt": "a box"})
                records = []
                import json

                if hist_path.exists():
                    records = json.loads(hist_path.read_text())
        assert any(r["id"] == "rec1" for r in records)


# ─── load_saved_props — exception path ───────────────────────────


class TestLoadSavedPropsExceptionPath:
    def test_exception_reading_file_returns_empty_list(self):
        """If reading the file raises, load_saved_props returns []."""
        mock_path = MagicMock()
        mock_path.exists.return_value = True
        mock_path.read_text.side_effect = OSError("file locked")

        with patch("app.services.creator.prop_generator.SAVED_PROPS_PATH", mock_path):
            result = load_saved_props()
        assert result == []

    def test_invalid_json_returns_empty_list(self):
        """If the file contains invalid JSON, returns []."""
        with tempfile.TemporaryDirectory() as tmpdir:
            bad_file = Path(tmpdir) / "props.json"
            bad_file.write_text("not valid json {{{{")
            with patch("app.services.creator.prop_generator.SAVED_PROPS_PATH", bad_file):
                result = load_saved_props()
        assert result == []


# ─── generate_template_code extra shapes ──────────────────────────


class TestGenerateTemplateCodeExtraShapes:
    """Cover shapes not explicitly tested in test_prop_generator.py."""

    def test_mug_shape(self):
        code = generate_template_code("CoffeeMug", "a coffee mug")
        assert "export function CoffeeMug" in code
        assert "cylinderGeometry" in code  # mug uses cylinder

    def test_robot_shape(self):
        code = generate_template_code("RobotProp", "a small robot")
        assert "export function RobotProp" in code
        # robots use boxes
        assert "boxGeometry" in code

    def test_crystal_shape_has_emissive(self):
        code = generate_template_code("CrystalProp", "a magic crystal gem")
        assert "emissive" in code  # crystals have emissive parts

    def test_prop_uses_toon_material_import(self):
        code = generate_template_code("AnyProp", "something")
        # All shapes should reference toon materials
        assert "toonMaterials" in code or "meshToonMaterial" in code or "meshStandardMaterial" in code

    def test_generated_code_has_valid_structure(self):
        """Code must have export, group and at least one mesh."""
        code = generate_template_code("TestProp", "a random thing")
        assert "export function TestProp" in code
        assert "<group" in code
        assert "<mesh" in code
        assert "</group>" in code
