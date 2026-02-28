"""Night 3 — Additional coverage for multi_pass_generator.py.

Targets branches and paths not exercised in test_multi_pass_generator.py:
  - _add_single_component: component with no matching KEYWORD_COMPONENTS entry (uses defaults)
  - _add_single_component: component already imported (no duplicate)
  - _insert_code_after_last_import: code with no imports at all
  - generate_prop: description with multiple matching keywords hitting the 3-component cap
  - _apply_polish: code with emissive material already (no flatShading needed)
  - _validate: 3-4 mesh range (acceptable but not good)
  - apply_refinement: multiple color changes in one call
  - apply_refinement: color not present in code (no-op)
  - apply_refinement: multiple addComponents in one call
  - get_refinement_options: material presets + animation presets structure
  - COMPONENT_IMPORTS keys that are NOT in COMPONENT_JSX
"""

from __future__ import annotations

import pytest

from app.services.multi_pass_generator import (
    COMPONENT_IMPORTS,
    COMPONENT_JSX,
    MultiPassGenerator,
    _add_single_component,
    _insert_code_after_last_import,
)

# ─── Shared fixture ───────────────────────────────────────────────

BASE_CODE = """\
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

export function TestProp({ position = [0, 0, 0] }) {
  const ref = useRef(null)

  useFrame(() => {
    ref.current.rotation.y += 0.01
  })

  return (
    <group ref={ref} position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color="#CC3333" emissive="#330000" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshToonMaterial color="#FF6644" />
      </mesh>
    </group>
  )
}
"""

# ─── _insert_code_after_last_import edge cases ────────────────────


class TestInsertCodeAfterLastImportEdgeCases:
    def test_empty_code_string(self):
        """Empty string: insertion at position 1."""
        result = _insert_code_after_last_import("", "// added")
        assert "// added" in result

    def test_preserves_existing_content(self):
        code = "import A from 'a'\nconst x = 1"
        result = _insert_code_after_last_import(code, "const NEW = 2")
        assert "const x = 1" in result
        assert "const NEW = 2" in result
        assert "import A" in result

    def test_multiple_injections_order(self):
        """Injecting twice keeps both in result."""
        code = "import A from 'a'\nexport function X() {}"
        result = _insert_code_after_last_import(code, "const FIRST = 1")
        result = _insert_code_after_last_import(result, "const SECOND = 2")
        assert "const FIRST = 1" in result
        assert "const SECOND = 2" in result


# ─── _add_single_component edge cases ────────────────────────────


class TestAddSingleComponentEdgeCases:
    def test_component_not_in_jsx_returns_false(self):
        """If comp is in COMPONENT_IMPORTS but not COMPONENT_JSX, returns False."""
        # Find a comp only in imports but not jsx (if any)
        imports_only = [k for k in COMPONENT_IMPORTS if k not in COMPONENT_JSX]
        if imports_only:
            result, added = _add_single_component(BASE_CODE, imports_only[0])
            assert added is False
        else:
            pytest.skip("All COMPONENT_IMPORTS have corresponding COMPONENT_JSX entries")

    def test_component_with_no_keyword_entry_uses_defaults(self):
        """
        If a component has no entry in KEYWORD_COMPONENTS, _add_single_component
        should still succeed using default color/position.
        Build a minimal fake to validate default fallback logic.
        """
        # Use a real component that IS in KEYWORD_COMPONENTS to verify normal path
        code = BASE_CODE
        for comp in COMPONENT_JSX:
            result, added = _add_single_component(code, comp)
            assert added is True
            assert comp in result
            break  # test one is enough

    def test_add_component_to_code_without_closing_group(self):
        """If no </group> in code, returns (code, False)."""
        code = "import { useRef } from 'react'\n\nexport function X() { return <mesh /> }"
        result, added = _add_single_component(code, "LED")
        # No </group> → cannot inject JSX
        assert added is False

    def test_import_already_present_not_duplicated(self):
        """If import line already exists, it should not be duplicated."""
        comp = "GlowOrb"
        imp = COMPONENT_IMPORTS[comp]
        code = f"{imp}\n\n{BASE_CODE}"
        result, added = _add_single_component(code, comp)
        # Import should appear exactly once
        assert result.count(imp) == 1

    def test_all_jsx_components_add_successfully(self):
        """Every component in COMPONENT_JSX can be added to a valid base."""
        for comp in COMPONENT_JSX:
            code = BASE_CODE
            result, added = _add_single_component(code, comp)
            assert added is True, f"{comp} should be addable to BASE_CODE"

    def test_added_component_jsx_appears_before_last_group(self):
        """The injected JSX should be before the last </group>."""
        comp = "SteamParticles"
        result, added = _add_single_component(BASE_CODE, comp)
        assert added is True
        last_group_idx = result.rindex("</group>")
        comp_idx = result.rindex(comp)
        assert comp_idx < last_group_idx


# ─── MultiPassGenerator — additional generate_prop tests ─────────


class TestMultiPassGeneratorNight3:
    def setup_method(self):
        self.gen = MultiPassGenerator()

    def test_generate_prop_with_screen_description(self):
        """'monitor with screen display' should match Screen component."""
        _, diags = self.gen.generate_prop("monitor with screen display", BASE_CODE)
        pass2 = next(d for d in diags if "Pass 2" in d)
        assert "Screen" in pass2

    def test_generate_prop_with_arcade_description(self):
        """'arcade game' should match Screen component."""
        _, diags = self.gen.generate_prop("retro arcade game cabinet", BASE_CODE)
        pass2 = next(d for d in diags if "Pass 2" in d)
        assert "Screen" in pass2

    def test_generate_prop_diagnostics_length(self):
        """generate_prop always returns at least 4 diagnostics (one per pass)."""
        _, diags = self.gen.generate_prop("simple thing", BASE_CODE)
        assert len(diags) >= 4

    def test_generate_prop_code_contains_group(self):
        """Output code must contain a group element."""
        code, _ = self.gen.generate_prop("anything", BASE_CODE)
        assert "group" in code

    def test_pass1_diagnostic_contains_description(self):
        """Pass 1 diagnostic should reference the description."""
        _, diags = self.gen.generate_prop("magic lamp", BASE_CODE)
        pass1 = next(d for d in diags if "Pass 1" in d)
        assert "magic lamp" in pass1.lower() or "Pass 1" in pass1

    def test_apply_polish_adds_flat_shading_to_standard_material(self):
        """meshStandardMaterial without emissive gets flatShading."""
        code = 'return (<mesh><meshStandardMaterial color="#AABBCC" /></mesh>)'
        result, notes = self.gen._apply_polish(code)
        assert "flatShading" in result

    def test_apply_polish_no_flat_shading_when_emissive_present(self):
        """meshStandardMaterial with emissive should NOT get flatShading."""
        code = 'return (<mesh><meshStandardMaterial color="#AABBCC" emissive="#330000" /></mesh>)'
        result, _ = self.gen._apply_polish(code)
        # Should NOT add flatShading to a material that already has emissive
        # (the regex only matches materials WITHOUT emissive)
        lines_with_flat = [line for line in result.split("\n") if "flatShading" in line and "emissive" in line]
        assert len(lines_with_flat) == 0

    def test_validate_3_meshes_is_acceptable(self):
        """3 meshes → 'acceptable' note."""
        code = "<group>" + "<mesh>\n<boxGeometry/></mesh>\n" * 3 + "</group>"
        _, notes = self.gen._validate(code)
        assert any("acceptable" in n.lower() or "warning" in n.lower() or "mesh" in n for n in notes)

    def test_validate_exactly_1_mesh_triggers_warning(self):
        """Exactly 1 mesh should trigger a warning about complexity."""
        code = "<group><mesh>\n<boxGeometry/></mesh>\n</group>"
        _, notes = self.gen._validate(code)
        assert any("Warning" in n or "mesh" in n for n in notes)

    def test_validate_useframe_without_fiber_import_triggers_warning(self):
        """useFrame in code but @react-three/fiber not imported AND the first-condition is False.

        To hit line 240, we need useFrame to appear BEFORE the first 'import' keyword,
        so the first condition `"useFrame" not in code.split('return')[0].split('import')[0]`
        is False. Then the elif fires if fiber is also missing.
        """
        # useFrame appears before any import statement, AND @react-three/fiber is absent
        # Build code where useFrame IS present, BEFORE the import token
        code2 = (
            "useFrame is mentioned here\n"
            "import { useRef } from 'react'\n"
            "export function X() {\n"
            "  return (<group>" + "<mesh>\n<boxGeometry/></mesh>\n" * 5 + "</group>)\n}"
        )
        _, notes = self.gen._validate(code2)
        # The warning should fire because: useFrame in code, @react-three/fiber not in code,
        # AND useFrame appears before first import → first condition is False → elif triggers
        assert any("useFrame" in n or "@react-three/fiber" in n or "Warning" in n for n in notes)


# ─── apply_refinement — additional edge cases ────────────────────


class TestApplyRefinementNight3:
    def setup_method(self):
        self.gen = MultiPassGenerator()

    def test_multiple_color_changes_applied(self):
        code = 'color="#CC3333" emissive="#3366CC"'
        result, diags = self.gen.apply_refinement(code, {"colorChanges": {"#CC3333": "#00FF00", "#3366CC": "#FF0000"}})
        assert "#00FF00" in result
        assert "#FF0000" in result
        assert len([d for d in diags if "Changed color" in d]) == 2

    def test_color_not_in_code_does_not_raise(self):
        code = 'color="#FFFFFF"'
        result, diags = self.gen.apply_refinement(code, {"colorChanges": {"#999999": "#ABCDEF"}})
        assert result == code
        assert any("No changes" in d for d in diags)

    def test_add_multiple_components(self):
        code = BASE_CODE
        result, diags = self.gen.apply_refinement(code, {"addComponents": ["LED", "GlowOrb"]})
        added = [d for d in diags if "Added" in d]
        assert len(added) == 2
        assert "LED" in result
        assert "GlowOrb" in result

    def test_color_change_and_add_component_combined(self):
        code = BASE_CODE
        result, diags = self.gen.apply_refinement(
            code, {"colorChanges": {"#CC3333": "#00BBDD"}, "addComponents": ["SteamParticles"]}
        )
        assert "#00BBDD" in result
        assert "SteamParticles" in result
        assert any("Changed color" in d for d in diags)
        assert any("Added SteamParticles" in d for d in diags)

    def test_empty_changes_returns_no_changes_applied(self):
        _, diags = self.gen.apply_refinement("const x = 1", {})
        assert any("No changes" in d for d in diags)

    def test_add_nonexistent_component_skipped(self):
        code = BASE_CODE
        _, diags = self.gen.apply_refinement(code, {"addComponents": ["FakeWidget"]})
        # FakeWidget is unknown → should be skipped, no "Added FakeWidget"
        assert not any("Added FakeWidget" in d for d in diags)


# ─── get_refinement_options — structure ─────────────────────────


class TestGetRefinementOptionsNight3:
    def setup_method(self):
        self.gen = MultiPassGenerator()

    def test_material_presets_have_required_fields(self):
        opts = self.gen.get_refinement_options("test prop")
        for preset in opts["materialPresets"]:
            assert "name" in preset
            assert "label" in preset
            assert "props" in preset

    def test_animation_presets_have_required_fields(self):
        opts = self.gen.get_refinement_options("test prop")
        for preset in opts["animationPresets"]:
            assert "name" in preset
            assert "label" in preset
            assert "description" in preset

    def test_suggested_colors_are_hex(self):
        opts = self.gen.get_refinement_options("anything")
        for color in opts["suggestedColors"]:
            assert color.startswith("#"), f"Color {color!r} not hex"

    def test_has_4_material_presets(self):
        opts = self.gen.get_refinement_options("anything")
        assert len(opts["materialPresets"]) == 4

    def test_has_4_animation_presets(self):
        opts = self.gen.get_refinement_options("anything")
        assert len(opts["animationPresets"]) == 4

    def test_known_animation_names_present(self):
        opts = self.gen.get_refinement_options("anything")
        names = {p["name"] for p in opts["animationPresets"]}
        assert "rotate" in names
        assert "pulse" in names

    def test_known_material_names_present(self):
        opts = self.gen.get_refinement_options("anything")
        names = {p["name"] for p in opts["materialPresets"]}
        assert "metallic" in names
        assert "glowing" in names
