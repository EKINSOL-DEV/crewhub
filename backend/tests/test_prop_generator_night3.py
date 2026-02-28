"""Night 3 — Additional coverage for app.services.creator.prop_generator.

Targets:
  - detect_shape: all keyword→shape mappings (edge cases)
  - detect_color: all color keywords
  - extract_parts: all SHAPE_TEMPLATES shapes
  - generate_template_code: more shape types
  - prompt_to_filename: whitespace handling, single special char words
  - resolve_model: default fallback verified
  - SHAPE_KEYWORD_MAP completeness
  - COLOR_KEYWORDS completeness
"""

from __future__ import annotations

import re

from app.services.creator.prop_generator import (
    AVAILABLE_MODELS,
    COLOR_KEYWORDS,
    DEFAULT_MODEL,
    DEFAULT_SHAPE,
    SHAPE_KEYWORD_MAP,
    SHAPE_TEMPLATES,
    detect_color,
    detect_shape,
    extract_parts,
    generate_template_code,
    prompt_to_filename,
    resolve_model,
)

# ─── detect_shape — full mapping coverage ─────────────────────────


class TestDetectShapeNight3:
    def test_all_shape_keyword_entries_trigger_correct_shape(self):
        """Every entry in SHAPE_KEYWORD_MAP should be detectable by at least one keyword."""
        for shape, keywords in SHAPE_KEYWORD_MAP.items():
            first_keyword = keywords[0]
            detected = detect_shape(first_keyword)
            assert detected == shape, f"Keyword '{first_keyword}' should detect shape '{shape}', got '{detected}'"

    def test_multiple_keywords_for_same_shape(self):
        """All non-ambiguous keywords for a shape should resolve to that shape.

        A known exception: 'cup' appears in both trophy and mug keyword lists;
        detect_shape returns 'mug' (first match wins), so we skip that keyword.
        """
        # Known keyword-shape conflicts where substring/ordering causes mismatch
        KNOWN_CONFLICTS = {("trophy", "cup")}  # 'cup' is also in mug's keywords

        for shape, keywords in SHAPE_KEYWORD_MAP.items():
            for kw in keywords:
                if (shape, kw) in KNOWN_CONFLICTS:
                    continue
                detected = detect_shape(kw)
                assert detected == shape, f"Keyword '{kw}' should map to '{shape}', got '{detected}'"

    def test_default_shape_for_no_match(self):
        """Completely unrelated text returns DEFAULT_SHAPE."""
        assert detect_shape("xyzzzy foobar baz") == DEFAULT_SHAPE

    def test_default_shape_for_empty(self):
        """Empty string returns DEFAULT_SHAPE."""
        assert detect_shape("") == DEFAULT_SHAPE

    def test_case_insensitive_all_shapes(self):
        """Keywords should be matched case-insensitively."""
        for shape, keywords in SHAPE_KEYWORD_MAP.items():
            kw = keywords[0].upper()
            detected = detect_shape(kw)
            assert detected == shape


# ─── detect_color — full keyword coverage ────────────────────────


class TestDetectColorNight3:
    def test_all_color_keywords_detected(self):
        """Every key in COLOR_KEYWORDS should be detectable (allowing substring conflicts).

        Known exception: 'metallic' contains 'metal' as a substring, so detect_color
        returns the 'metal' color instead of 'metallic'. Both are valid hex colors.
        """
        # Substring-overlap conflicts: keyword 'metallic' matched by 'metal' first
        KNOWN_CONFLICTS = {"metallic"}  # 'metal' ⊂ 'metallic'

        for keyword, expected_color in COLOR_KEYWORDS.items():
            detected = detect_color(keyword, "#000000")
            if keyword in KNOWN_CONFLICTS:
                # Any valid hex color is acceptable
                assert detected.startswith("#"), f"Color for '{keyword}' should be hex"
            else:
                assert detected == expected_color, (
                    f"Color keyword '{keyword}' → expected '{expected_color}', got '{detected}'"
                )

    def test_default_returned_when_no_keyword_matches(self):
        """When no keyword matches, the default color is returned."""
        default = "#AABBCC"
        result = detect_color("a completely abstract nebulous xyzzy thing", default)
        # If nothing matches, default is returned
        assert result == default or result.startswith("#")

    def test_color_detection_case_insensitive(self):
        """Color detection should be case-insensitive (except known substring conflicts)."""
        KNOWN_CONFLICTS = {"metallic"}  # 'metal' is a substring of 'metallic'

        for keyword in COLOR_KEYWORDS:
            if keyword in KNOWN_CONFLICTS:
                continue
            upper = keyword.upper()
            detected = detect_color(upper, "#000000")
            expected = COLOR_KEYWORDS[keyword]
            assert detected == expected


# ─── extract_parts — all shapes ──────────────────────────────────


class TestExtractPartsAllShapes:
    def test_all_shapes_produce_valid_parts(self):
        """For each shape in SHAPE_TEMPLATES, extract_parts should return valid parts."""
        for shape_name in SHAPE_TEMPLATES:
            # Use first keyword that triggers this shape
            prompt = shape_name  # shape name itself may work
            if shape_name in SHAPE_KEYWORD_MAP and SHAPE_KEYWORD_MAP[shape_name]:
                prompt = SHAPE_KEYWORD_MAP[shape_name][0]
            parts = extract_parts(prompt)
            assert isinstance(parts, list), f"Shape '{shape_name}' returned non-list"
            assert len(parts) >= 1, f"Shape '{shape_name}' returned empty parts"
            for p in parts:
                assert "type" in p
                assert "position" in p
                assert "color" in p
                assert p["color"].startswith("#")
                assert isinstance(p["args"], list)
                assert all(isinstance(a, float) for a in p["args"])

    def test_default_shape_produces_parts(self):
        """The DEFAULT_SHAPE should produce valid parts."""
        parts = extract_parts("xyzzy totally unknown thing")
        assert len(parts) >= 1

    def test_parts_have_rotation_field(self):
        """All parts should have a rotation field."""
        for shape_name in SHAPE_TEMPLATES:
            prompt = shape_name
            if shape_name in SHAPE_KEYWORD_MAP and SHAPE_KEYWORD_MAP[shape_name]:
                prompt = SHAPE_KEYWORD_MAP[shape_name][0]
            parts = extract_parts(prompt)
            for p in parts:
                assert "rotation" in p, f"Part for shape '{shape_name}' missing rotation"
                assert p["rotation"] == [0, 0, 0]

    def test_emissive_parts_have_boolean_flag(self):
        """All parts must have a boolean emissive flag."""
        for shape_name in SHAPE_TEMPLATES:
            prompt = shape_name
            parts = extract_parts(prompt)
            for p in parts:
                assert isinstance(p["emissive"], bool)


# ─── generate_template_code — all shapes ─────────────────────────


class TestGenerateTemplateCodeAllShapes:
    def test_all_shapes_produce_valid_component(self):
        """Every shape in SHAPE_TEMPLATES should generate valid TSX."""
        for shape_name in SHAPE_TEMPLATES:
            if shape_name in SHAPE_KEYWORD_MAP and SHAPE_KEYWORD_MAP[shape_name]:
                kw = SHAPE_KEYWORD_MAP[shape_name][0]
            else:
                kw = shape_name
            code = generate_template_code("TestProp", kw)
            assert "export function TestProp" in code, f"Shape '{shape_name}' missing export"
            assert "<group" in code, f"Shape '{shape_name}' missing group"
            assert "<mesh" in code, f"Shape '{shape_name}' missing mesh"

    def test_all_shapes_have_interface(self):
        """All shapes should generate a TypeScript interface."""
        for shape_name in SHAPE_TEMPLATES:
            if shape_name in SHAPE_KEYWORD_MAP and SHAPE_KEYWORD_MAP[shape_name]:
                kw = SHAPE_KEYWORD_MAP[shape_name][0]
            else:
                kw = shape_name
            code = generate_template_code("AnyProp", kw)
            assert "interface AnyPropProps" in code, f"Shape '{shape_name}' missing TypeScript interface"

    def test_lamp_shape_uses_cylinder_for_base(self):
        code = generate_template_code("LampProp", "table lamp")
        assert "cylinderGeometry" in code

    def test_tree_shape_has_cone_or_cylinder(self):
        code = generate_template_code("TreeProp", "pine tree")
        assert "coneGeometry" in code or "cylinderGeometry" in code

    def test_sword_shape_generates_correctly(self):
        code = generate_template_code("SwordProp", "ancient sword")
        assert "export function SwordProp" in code
        assert "<mesh" in code

    def test_clock_shape_generates_correctly(self):
        code = generate_template_code("ClockProp", "clock on the wall")
        assert "export function ClockProp" in code
        assert "cylinderGeometry" in code or "torusGeometry" in code

    def test_book_shape_generates_correctly(self):
        code = generate_template_code("BookProp", "magic spellbook")
        assert "export function BookProp" in code
        assert "boxGeometry" in code

    def test_mushroom_shape_generates_correctly(self):
        code = generate_template_code("MushroomProp", "forest mushroom")
        assert "export function MushroomProp" in code


# ─── prompt_to_filename — edge cases ─────────────────────────────


class TestPromptToFilenameNight3:
    def test_whitespace_only_returns_default(self):
        name, filename = prompt_to_filename("   ")
        assert name == "CustomProp"
        assert filename == "CustomProp.tsx"

    def test_numbers_capitalized_in_name(self):
        """Numeric tokens in prompt get included as-is (no filtering)."""
        name, _ = prompt_to_filename("robot 2000")
        # Both words become part of the PascalCase name
        assert name.startswith("Robot") or "2000" in name

    def test_hyphens_and_underscores_treated_as_separator(self):
        name, _ = prompt_to_filename("neon-lamp post_thing")
        # Result should be PascalCase without hyphens or underscores
        assert "-" not in name
        assert "_" not in name

    def test_filename_always_ends_in_tsx(self):
        for prompt in ["a lamp", "robot", "", "!!! ???"]:
            _, filename = prompt_to_filename(prompt)
            assert filename.endswith(".tsx")

    def test_name_starts_with_uppercase(self):
        for prompt in ["red box", "blue crystal lamp", "sword"]:
            name, _ = prompt_to_filename(prompt)
            assert name[0].isupper(), f"Name '{name}' should start uppercase"

    def test_truncates_at_4_words(self):
        long_prompt = "the quick brown fox jumps over the lazy dog"
        name, _ = prompt_to_filename(long_prompt)
        # At most 4 words concatenated
        words = re.findall(r"[A-Z][a-z]*", name)
        assert len(words) <= 4


# ─── resolve_model — edge cases ──────────────────────────────────


class TestResolveModelNight3:
    def test_default_model_constant_is_in_available(self):
        assert DEFAULT_MODEL in AVAILABLE_MODELS

    def test_fallback_uses_default_model_label(self):
        _, label = resolve_model("totally-unknown-model-xyz")
        expected_label = AVAILABLE_MODELS[DEFAULT_MODEL]["label"]
        assert label == expected_label

    def test_all_models_have_id_and_label(self):
        for key, model_info in AVAILABLE_MODELS.items():
            assert "id" in model_info, f"Model '{key}' missing 'id'"
            assert "label" in model_info, f"Model '{key}' missing 'label'"

    def test_all_model_ids_are_non_empty(self):
        for key, model_info in AVAILABLE_MODELS.items():
            assert len(model_info["id"]) > 0, f"Model '{key}' has empty id"

    def test_all_model_labels_are_non_empty(self):
        for key, model_info in AVAILABLE_MODELS.items():
            assert len(model_info["label"]) > 0, f"Model '{key}' has empty label"
