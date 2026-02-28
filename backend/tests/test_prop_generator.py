"""Tests for backend/app/services/creator/prop_generator.py."""

import json
import re
import tempfile
from pathlib import Path
from unittest.mock import patch

from app.services.creator.prop_generator import (
    AVAILABLE_MODELS,
    COLOR_KEYWORDS,
    DEFAULT_MODEL,
    DEFAULT_SHAPE,
    SHAPE_KEYWORD_MAP,
    SHAPE_TEMPLATES,
    add_generation_record,
    detect_color,
    detect_shape,
    extract_parts,
    generate_template_code,
    load_generation_history,
    load_saved_props,
    parse_ai_parts,
    prompt_to_filename,
    resolve_model,
    save_generation_history,
    save_props_to_disk,
    strip_parts_block,
)

# ─── resolve_model ────────────────────────────────────────────────


class TestResolveModel:
    def test_known_model_returns_correct_id(self):
        model_id, label = resolve_model("sonnet-4-5")
        assert model_id == AVAILABLE_MODELS["sonnet-4-5"]["id"]
        assert "Sonnet" in label

    def test_unknown_model_falls_back_to_default(self):
        model_id, label = resolve_model("nonexistent-model")
        default = AVAILABLE_MODELS[DEFAULT_MODEL]
        assert model_id == default["id"]

    def test_all_available_models_resolve(self):
        for key in AVAILABLE_MODELS:
            model_id, label = resolve_model(key)
            assert model_id == AVAILABLE_MODELS[key]["id"]
            assert label == AVAILABLE_MODELS[key]["label"]

    def test_opus_model_is_available(self):
        assert "opus-4-6" in AVAILABLE_MODELS

    def test_gpt_model_is_available(self):
        assert "gpt-5-2" in AVAILABLE_MODELS

    def test_default_model_is_valid(self):
        assert DEFAULT_MODEL in AVAILABLE_MODELS


# ─── prompt_to_filename ───────────────────────────────────────────


class TestPromptToFilename:
    def test_simple_prompt(self):
        name, filename = prompt_to_filename("red coffee mug")
        assert filename == f"{name}.tsx"
        assert name[0].isupper()

    def test_pascal_case_output(self):
        name, _ = prompt_to_filename("blue neon lamp post")
        # Each word should be capitalized
        assert name == "BlueNeonLampPost"

    def test_strips_special_chars(self):
        name, _ = prompt_to_filename("magic! orb (glowing)")
        assert "!" not in name
        assert "(" not in name

    def test_max_4_words(self):
        name, _ = prompt_to_filename("one two three four five six")
        # Only first 4 words
        assert name == "OneTwoThreeFour"

    def test_empty_prompt_returns_default(self):
        name, filename = prompt_to_filename("")
        assert name == "CustomProp"
        assert filename == "CustomProp.tsx"

    def test_single_word(self):
        name, _ = prompt_to_filename("sword")
        assert name == "Sword"

    def test_special_chars_only(self):
        name, _ = prompt_to_filename("!!! ??? ---")
        assert name == "CustomProp"


# ─── detect_shape ─────────────────────────────────────────────────


class TestDetectShape:
    def test_coffee_keywords(self):
        assert detect_shape("a coffee mug on the desk") == "mug"

    def test_sword_keyword(self):
        assert detect_shape("an ancient sword") == "sword"

    def test_tree_keyword(self):
        assert detect_shape("pine tree in the forest") == "tree"

    def test_robot_keyword(self):
        assert detect_shape("a small mech robot") == "robot"

    def test_mushroom_keyword(self):
        assert detect_shape("glowing mushroom") == "mushroom"

    def test_barrel_keyword(self):
        assert detect_shape("old oak barrel") == "barrel"

    def test_lamp_keyword(self):
        assert detect_shape("table lamp glowing warm") == "lamp"

    def test_unknown_defaults_to_box(self):
        assert detect_shape("some random xyzzy thing") == DEFAULT_SHAPE
        assert DEFAULT_SHAPE == "box"

    def test_crystal_keyword(self):
        assert detect_shape("magic crystal gem") == "crystal"

    def test_clock_keyword(self):
        assert detect_shape("antique clock on the wall") == "clock"

    def test_book_keyword(self):
        assert detect_shape("magic spellbook grimoire") == "book"

    def test_case_insensitive(self):
        assert detect_shape("ROBOT") == "robot"

    def test_all_shapes_have_keywords(self):
        for shape in SHAPE_TEMPLATES:
            if shape in SHAPE_KEYWORD_MAP:
                # At least one keyword should trigger this shape
                keyword = SHAPE_KEYWORD_MAP[shape][0]
                detected = detect_shape(keyword)
                assert detected == shape, f"Shape '{shape}' not detected by keyword '{keyword}'"


# ─── detect_color ─────────────────────────────────────────────────


class TestDetectColor:
    def test_red_detected(self):
        color = detect_color("a red barrel", "#000000")
        assert color == COLOR_KEYWORDS["red"]

    def test_blue_detected(self):
        color = detect_color("blue crystal lamp", "#FFFFFF")
        assert color == COLOR_KEYWORDS["blue"]

    def test_wood_detected(self):
        color = detect_color("wooden chair", "#000000")
        assert color == COLOR_KEYWORDS["wood"]

    def test_metal_detected(self):
        color = detect_color("metallic robot", "#000000")
        assert color in (COLOR_KEYWORDS["metal"], COLOR_KEYWORDS["metallic"])

    def test_default_returned_when_no_match(self):
        color = detect_color("a strange glowy thingy", "#AABB00")
        # 'glowing' might match
        assert color.startswith("#")

    def test_neon_detected(self):
        color = detect_color("neon sign", "#000000")
        assert color == COLOR_KEYWORDS["neon"]

    def test_gold_detected(self):
        color = detect_color("golden trophy", "#000000")
        assert color == COLOR_KEYWORDS["gold"]

    def test_case_insensitive(self):
        color = detect_color("RED mushroom", "#000000")
        assert color == COLOR_KEYWORDS["red"]


# ─── extract_parts ────────────────────────────────────────────────


class TestExtractParts:
    def test_returns_list_of_dicts(self):
        parts = extract_parts("a wooden barrel")
        assert isinstance(parts, list)
        assert len(parts) > 0

    def test_part_has_required_fields(self):
        parts = extract_parts("a simple box")
        for p in parts:
            assert "type" in p
            assert "position" in p
            assert "rotation" in p
            assert "args" in p
            assert "color" in p
            assert "emissive" in p

    def test_colors_are_hex(self):
        parts = extract_parts("a sword")
        for p in parts:
            assert p["color"].startswith("#"), f"Expected hex color, got: {p['color']}"

    def test_rotation_is_zero(self):
        parts = extract_parts("a clock")
        for p in parts:
            assert p["rotation"] == [0, 0, 0]

    def test_emissive_flag_is_bool(self):
        parts = extract_parts("a glowing crystal")
        for p in parts:
            assert isinstance(p["emissive"], bool)

    def test_args_are_floats(self):
        parts = extract_parts("a mug")
        for p in parts:
            assert all(isinstance(a, float) for a in p["args"])

    def test_color_detection_applied(self):
        parts_red = extract_parts("red barrel")
        parts_blue = extract_parts("blue barrel")
        # Main color should differ
        red_main = next(p["color"] for p in parts_red if not p["emissive"])
        blue_main = next(p["color"] for p in parts_blue if not p["emissive"])
        assert red_main != blue_main

    def test_emissive_parts_have_emissive_flag(self):
        # Crystal has emissive parts
        parts = extract_parts("crystal")
        emissive_parts = [p for p in parts if p["emissive"]]
        # Crystal template has emissive role parts
        assert len(emissive_parts) >= 1


# ─── generate_template_code ───────────────────────────────────────


class TestGenerateTemplateCode:
    def test_returns_string(self):
        code = generate_template_code("TestProp", "a red barrel")
        assert isinstance(code, str)

    def test_contains_export(self):
        code = generate_template_code("MyProp", "a simple box")
        assert "export function MyProp" in code

    def test_contains_props_interface(self):
        code = generate_template_code("MyProp", "a box")
        assert "interface MyPropProps" in code

    def test_contains_position_param(self):
        code = generate_template_code("MyProp", "a lamp")
        assert "position" in code

    def test_contains_scale_param(self):
        code = generate_template_code("MyProp", "a mug")
        assert "scale" in code

    def test_uses_toon_material_import(self):
        code = generate_template_code("MyProp", "a sword")
        assert "useToonMaterialProps" in code or "toonMaterials" in code

    def test_emissive_material_for_emissive_parts(self):
        # Crystal has emissive parts in template
        code = generate_template_code("Crystal", "crystal")
        assert "meshStandardMaterial" in code
        assert "emissive" in code

    def test_mesh_elements_present(self):
        code = generate_template_code("TreeProp", "tree")
        mesh_count = len(re.findall(r"<mesh", code))
        assert mesh_count >= 2

    def test_contains_group_element(self):
        code = generate_template_code("GroupProp", "a box")
        assert "<group" in code

    def test_geometry_type_matches_shape(self):
        code = generate_template_code("BarrelProp", "a barrel")
        assert "cylinderGeometry" in code

    def test_box_shape_uses_box_geometry(self):
        code = generate_template_code("BoxProp", "a simple box")
        assert "boxGeometry" in code


# ─── parse_ai_parts ───────────────────────────────────────────────


class TestParseAiParts:
    def _make_parts_block(self, parts_json: str) -> str:
        return f"some code...\n/* PARTS_DATA\n{parts_json}\nPARTS_DATA */\nmore code"

    def test_parses_valid_parts(self):
        parts_json = json.dumps(
            [{"type": "box", "position": [0, 0.2, 0], "args": [0.4, 0.4, 0.4], "color": "#CC3333", "emissive": False}]
        )
        raw = self._make_parts_block(parts_json)
        parts = parse_ai_parts(raw)
        assert parts is not None
        assert len(parts) == 1
        assert parts[0]["type"] == "box"

    def test_adds_rotation_if_missing(self):
        parts_json = json.dumps(
            [{"type": "sphere", "position": [0, 0.5, 0], "args": [0.2, 8, 8], "color": "#3366CC", "emissive": False}]
        )
        raw = self._make_parts_block(parts_json)
        parts = parse_ai_parts(raw)
        assert parts is not None
        assert parts[0]["rotation"] == [0, 0, 0]

    def test_returns_none_when_no_block(self):
        raw = "export function Foo() { return <group /> }"
        result = parse_ai_parts(raw)
        assert result is None

    def test_returns_none_for_invalid_json(self):
        raw = "/* PARTS_DATA\nnot-json\nPARTS_DATA */"
        result = parse_ai_parts(raw)
        assert result is None

    def test_returns_none_for_empty_list(self):
        raw = self._make_parts_block("[]")
        result = parse_ai_parts(raw)
        assert result is None

    def test_returns_none_for_non_list(self):
        raw = self._make_parts_block('{"type": "box"}')
        result = parse_ai_parts(raw)
        assert result is None

    def test_preserves_existing_rotation(self):
        parts_json = json.dumps(
            [
                {
                    "type": "box",
                    "position": [0, 0.2, 0],
                    "rotation": [0, 1.57, 0],
                    "args": [0.3, 0.3, 0.3],
                    "color": "#FF0000",
                    "emissive": False,
                }
            ]
        )
        raw = self._make_parts_block(parts_json)
        parts = parse_ai_parts(raw)
        assert parts[0]["rotation"] == [0, 1.57, 0]

    def test_multiple_parts_parsed(self):
        parts_data = [
            {"type": "box", "position": [0, 0.1, 0], "args": [0.3, 0.3, 0.3], "color": "#CC3333", "emissive": False},
            {"type": "sphere", "position": [0, 0.5, 0], "args": [0.15, 8, 8], "color": "#FF0000", "emissive": True},
        ]
        raw = self._make_parts_block(json.dumps(parts_data))
        parts = parse_ai_parts(raw)
        assert parts is not None
        assert len(parts) == 2


# ─── strip_parts_block ────────────────────────────────────────────


class TestStripPartsBlock:
    def test_removes_parts_block(self):
        raw = "export function Foo() {}\n/* PARTS_DATA\n[]\nPARTS_DATA */"
        result = strip_parts_block(raw)
        assert "PARTS_DATA" not in result
        assert "export function Foo" in result

    def test_no_block_unchanged(self):
        raw = "export function Foo() { return <group /> }"
        result = strip_parts_block(raw)
        assert result == raw.strip()

    def test_strips_multiline_block(self):
        raw = (
            'import { useRef } from \'react\'\nexport function X() {}\n/* PARTS_DATA\n[{"type": "box"}]\nPARTS_DATA */'
        )
        result = strip_parts_block(raw)
        assert "PARTS_DATA" not in result
        assert "export function X" in result


# ─── Storage helpers ──────────────────────────────────────────────


class TestStorageHelpers:
    def test_load_generation_history_empty_when_missing(self):
        with patch("app.services.creator.prop_generator.GENERATION_HISTORY_PATH") as mock_path:
            mock_path.exists.return_value = False
            result = load_generation_history()
            assert result == []

    def test_save_and_load_generation_history(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir) / "history.json"
            records = [{"id": "1", "prompt": "test", "model": "sonnet-4-5"}]
            with patch("app.services.creator.prop_generator.GENERATION_HISTORY_PATH", tmp_path):
                save_generation_history(records)
                loaded = load_generation_history()
                assert loaded == records

    def test_add_generation_record_prepends(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir) / "history.json"
            with patch("app.services.creator.prop_generator.GENERATION_HISTORY_PATH", tmp_path):
                save_generation_history([{"id": "old"}])
                add_generation_record({"id": "new"})
                history = load_generation_history()
                assert history[0]["id"] == "new"
                assert history[1]["id"] == "old"

    def test_add_generation_record_caps_at_100(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir) / "history.json"
            with patch("app.services.creator.prop_generator.GENERATION_HISTORY_PATH", tmp_path):
                initial = [{"id": str(i)} for i in range(100)]
                save_generation_history(initial)
                add_generation_record({"id": "new"})
                history = load_generation_history()
                assert len(history) == 100
                assert history[0]["id"] == "new"

    def test_load_generation_history_handles_invalid_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir) / "history.json"
            tmp_path.write_text("not valid json")
            with patch("app.services.creator.prop_generator.GENERATION_HISTORY_PATH", tmp_path):
                result = load_generation_history()
                assert result == []

    def test_load_saved_props_empty_when_missing(self):
        with patch("app.services.creator.prop_generator.SAVED_PROPS_PATH") as mock_path:
            mock_path.exists.return_value = False
            result = load_saved_props()
            assert result == []

    def test_save_and_load_saved_props(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir) / "saved_props.json"
            props = [{"id": "prop1", "name": "Test Prop", "code": "export function X() {}"}]
            with patch("app.services.creator.prop_generator.SAVED_PROPS_PATH", tmp_path):
                save_props_to_disk(props)
                loaded = load_saved_props()
                assert loaded == props

    def test_save_props_creates_parent_dirs(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir) / "nested" / "dir" / "props.json"
            with patch("app.services.creator.prop_generator.SAVED_PROPS_PATH", tmp_path):
                save_props_to_disk([{"id": "1"}])
                assert tmp_path.exists()


# ─── Data integrity tests ────────────────────────────────────────


class TestShapeTemplates:
    def test_all_shapes_have_required_fields(self):
        for shape_name, shape in SHAPE_TEMPLATES.items():
            assert "parts" in shape, f"Shape '{shape_name}' missing 'parts'"
            assert "main_color" in shape, f"Shape '{shape_name}' missing 'main_color'"
            assert "accent_color" in shape, f"Shape '{shape_name}' missing 'accent_color'"

    def test_all_parts_have_4_elements(self):
        for shape_name, shape in SHAPE_TEMPLATES.items():
            for i, part in enumerate(shape["parts"]):
                assert len(part) == 4, f"Shape '{shape_name}' part {i} should have 4 elements, got {len(part)}"

    def test_geo_types_are_valid(self):
        valid_types = {"box", "cylinder", "sphere", "cone", "torus"}
        for shape_name, shape in SHAPE_TEMPLATES.items():
            for geo_type, _, _, _ in shape["parts"]:
                assert geo_type in valid_types, f"Shape '{shape_name}' has unknown geo type: {geo_type}"

    def test_color_roles_are_valid(self):
        valid_roles = {"main", "accent", "emissive"}
        for shape_name, shape in SHAPE_TEMPLATES.items():
            for _, _, _, color_role in shape["parts"]:
                assert color_role in valid_roles, f"Shape '{shape_name}' has unknown color role: {color_role}"

    def test_main_colors_are_hex(self):
        for shape_name, shape in SHAPE_TEMPLATES.items():
            assert shape["main_color"].startswith("#"), (
                f"Shape '{shape_name}' main_color not hex: {shape['main_color']}"
            )
            assert shape["accent_color"].startswith("#"), (
                f"Shape '{shape_name}' accent_color not hex: {shape['accent_color']}"
            )

    def test_all_shapes_have_at_least_2_parts(self):
        for shape_name, shape in SHAPE_TEMPLATES.items():
            assert len(shape["parts"]) >= 2, f"Shape '{shape_name}' has only {len(shape['parts'])} part(s)"


class TestColorKeywords:
    def test_all_colors_are_hex(self):
        for kw, color in COLOR_KEYWORDS.items():
            assert color.startswith("#"), f"Color keyword '{kw}' is not hex: {color}"

    def test_basic_colors_present(self):
        for basic in ["red", "blue", "green", "yellow"]:
            assert basic in COLOR_KEYWORDS

    def test_material_keywords_present(self):
        for mat in ["wood", "metal", "neon"]:
            assert mat in COLOR_KEYWORDS
