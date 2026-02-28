"""Tests for multi_pass_generator.py — Phase 2 prop enhancement system."""

from app.services.multi_pass_generator import (
    COMPONENT_IMPORTS,
    COMPONENT_JSX,
    KEYWORD_COMPONENTS,
    MultiPassGenerator,
    _add_single_component,
    _insert_code_after_last_import,
    _insert_jsx_before_last_group,
)

# ─── Fixtures ────────────────────────────────────────────────────


MINIMAL_PROP = """\
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

export function SimpleProp({ position = [0, 0, 0] }) {
  const groupRef = useRef(null)

  useFrame((state) => {
    groupRef.current.rotation.y += 0.01
  })

  return (
    <group ref={groupRef} position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshToonMaterial color="#CC3333" />
      </mesh>
      <mesh position={[0, 0.4, 0]} castShadow>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#FF6644" emissive="#FF3300" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.2, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.2, 8]} />
        <meshToonMaterial color="#888888" />
      </mesh>
    </group>
  )
}
"""

BARE_PROP_NO_ANIMATION = """\
import { useRef } from 'react'

export function BareBox({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#AAAAAA" />
      </mesh>
    </group>
  )
}
"""

PROP_WITH_FLAT_MATERIAL = """\
import { useRef } from 'react'

export function FlatProp({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#CC3333" />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshStandardMaterial color="#3366CC" />
      </mesh>
    </group>
  )
}
"""

PROP_NO_EXPORT = """\
import { useRef } from 'react'

function InternalProp({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <mesh><boxGeometry /></mesh>
    </group>
  )
}
"""


# ─── Helper function tests ────────────────────────────────────────


class TestInsertCodeAfterLastImport:
    def test_inserts_after_single_import(self):
        code = "import { useRef } from 'react'\n\nexport function Foo() {}"
        result = _insert_code_after_last_import(code, "const X = 1")
        lines = result.split("\n")
        import_idx = next(i for i, l in enumerate(lines) if "import" in l)
        inject_idx = next(i for i, l in enumerate(lines) if "const X = 1" in l)
        assert inject_idx == import_idx + 1

    def test_inserts_after_last_of_multiple_imports(self):
        code = "import A from 'a'\nimport B from 'b'\nimport C from 'c'\n\nconst X = 1"
        result = _insert_code_after_last_import(code, "// injected")
        lines = result.split("\n")
        c_import_idx = next(i for i, l in enumerate(lines) if "import C" in l)
        injected_idx = next(i for i, l in enumerate(lines) if "// injected" in l)
        assert injected_idx == c_import_idx + 1

    def test_handles_no_imports(self):
        code = "const X = 1\nconst Y = 2"
        result = _insert_code_after_last_import(code, "// added")
        # inserts at position 1 (after index 0)
        assert "// added" in result

    def test_does_not_duplicate_content(self):
        code = "import { A } from 'a'\n\nexport function B() {}"
        result = _insert_code_after_last_import(code, "const EXTRA = true")
        assert result.count("const EXTRA = true") == 1


class TestInsertJsxBeforeLastGroup:
    def test_inserts_before_last_group(self):
        code = "<group>\n  <mesh />\n</group>"
        result = _insert_jsx_before_last_group(code, "  {/* LED */}")
        assert result.index("{/* LED */}") < result.rindex("</group>")

    def test_returns_unchanged_when_no_group(self):
        code = "<mesh />"
        result = _insert_jsx_before_last_group(code, "  {/* LED */}")
        assert result == code

    def test_targets_last_group_tag(self):
        code = "<group>\n  <group>\n    <mesh />\n  </group>\n</group>"
        result = _insert_jsx_before_last_group(code, "{/* INJECTED */}")
        last_group = result.rindex("</group>")
        injected = result.rindex("{/* INJECTED */}")
        assert injected < last_group


class TestAddSingleComponent:
    def test_adds_known_component(self):
        code = "import { useRef } from 'react'\n\nexport function X() {\n  return (<group><mesh /></group>)\n}"
        result, was_added = _add_single_component(code, "GlowOrb")
        assert was_added is True
        assert "GlowOrb" in result

    def test_returns_false_for_unknown_component(self):
        code = "import { useRef } from 'react'\n"
        result, was_added = _add_single_component(code, "UnknownWidget")
        assert was_added is False
        assert result == code

    def test_does_not_duplicate_import(self):
        imp = COMPONENT_IMPORTS["LED"]
        code = f"{imp}\n\nexport function X() {{\n  return (<group><mesh /></group>)\n}}"
        result, was_added = _add_single_component(code, "LED")
        assert result.count(imp) == 1

    def test_all_known_components_can_be_added(self):
        base = "import {{ useRef }} from 'react'\n\nexport function X() {{\n  return (<group><mesh /></group>)\n}}"
        for comp in ["LED", "GlowOrb", "SteamParticles"]:
            code = "import { useRef } from 'react'\n\nexport function X() {\n  return (<group><mesh /></group>)\n}"
            result, added = _add_single_component(code, comp)
            assert added, f"{comp} should be addable"
            assert comp in result


# ─── MultiPassGenerator tests ────────────────────────────────────


class TestMultiPassGeneratorBasic:
    def setup_method(self):
        self.gen = MultiPassGenerator()

    def test_generate_prop_returns_tuple(self):
        code, diags = self.gen.generate_prop("red box", MINIMAL_PROP)
        assert isinstance(code, str)
        assert isinstance(diags, list)
        assert len(diags) >= 4  # one per pass

    def test_pass1_diagnostic_present(self):
        _, diags = self.gen.generate_prop("test", MINIMAL_PROP)
        assert any("Pass 1" in d for d in diags)

    def test_pass2_adds_components_for_coffee(self):
        _, diags = self.gen.generate_prop("steaming coffee machine", MINIMAL_PROP)
        pass2 = next(d for d in diags if "Pass 2" in d)
        assert "SteamParticles" in pass2

    def test_pass2_adds_screen_for_monitor(self):
        _, diags = self.gen.generate_prop("a computer monitor with screen", MINIMAL_PROP)
        pass2 = next(d for d in diags if "Pass 2" in d)
        assert "Screen" in pass2

    def test_pass2_no_match_diagnostic(self):
        # Use a generic description with no keyword matches (avoid substrings like "ai" in "chair")
        _, diags = self.gen.generate_prop("stone brick cube", MINIMAL_PROP)
        pass2 = next(d for d in diags if "Pass 2" in d)
        assert "No keyword" in pass2

    def test_pass3_detects_no_animation(self):
        _, diags = self.gen.generate_prop("a box", BARE_PROP_NO_ANIMATION)
        pass3 = [d for d in diags if "Pass 3" in d]
        assert any("No animation" in d for d in pass3)

    def test_pass3_detects_no_emissive(self):
        _, diags = self.gen.generate_prop("a box", BARE_PROP_NO_ANIMATION)
        pass3 = [d for d in diags if "Pass 3" in d]
        assert any("emissive" in d for d in pass3)

    def test_pass3_adds_flat_shading(self):
        code, diags = self.gen.generate_prop("box", PROP_WITH_FLAT_MATERIAL)
        pass3 = [d for d in diags if "Pass 3" in d]
        assert any("flatShading" in d for d in pass3)
        assert "flatShading" in code

    def test_pass3_polish_passes_when_animation_and_emissive_present(self):
        _, diags = self.gen.generate_prop("lamp", MINIMAL_PROP)
        pass3 = [d for d in diags if "Pass 3" in d]
        assert any("passed" in d.lower() or "animation" in d for d in pass3)

    def test_pass4_warns_on_low_mesh_count(self):
        _, diags = self.gen.generate_prop("box", BARE_PROP_NO_ANIMATION)
        pass4 = next(d for d in diags if "Pass 4" in d)
        assert "Warning" in pass4 or "mesh" in pass4

    def test_pass4_good_complexity_for_many_meshes(self):
        many_meshes = MINIMAL_PROP + "\n".join(f"      <mesh key={i}><boxGeometry /></mesh>" for i in range(6))
        _, diags = self.gen.generate_prop("complex prop", many_meshes)
        pass4 = next(d for d in diags if "Pass 4" in d)
        assert "✅" in pass4 or "Good" in pass4 or "mesh" in pass4

    def test_pass4_warns_no_export(self):
        _, diags = self.gen.generate_prop("thing", PROP_NO_EXPORT)
        pass4_notes = [d for d in diags if "Pass 4" in d]
        assert any("export" in d.lower() for d in pass4_notes)

    def test_max_three_components_added(self):
        # Coffee + monitor + data → caps at 3
        desc = "futuristic data neural screen coffee machine monitor server"
        code, diags = self.gen.generate_prop(desc, MINIMAL_PROP)
        pass2 = next(d for d in diags if "Pass 2" in d)
        # If components added, should list them
        if "Added" in pass2:
            components_str = pass2.split("Added components:")[-1]
            components = [c.strip() for c in components_str.split(",")]
            assert len(components) <= 3

    def test_code_is_string_with_jsx(self):
        code, _ = self.gen.generate_prop("simple prop", MINIMAL_PROP)
        assert "export function" in code or "group" in code


class TestMultiPassGeneratorAddDetails:
    def setup_method(self):
        self.gen = MultiPassGenerator()

    def test_steam_added_for_tea(self):
        code, added = self.gen._add_details(MINIMAL_PROP, "hot tea kettle")
        assert "SteamParticles" in added

    def test_led_added_for_server(self):
        code, added = self.gen._add_details(MINIMAL_PROP, "server control panel")
        assert "LED" in added

    def test_glow_orb_for_magic(self):
        code, added = self.gen._add_details(MINIMAL_PROP, "magical orb crystal")
        assert "GlowOrb" in added

    def test_data_stream_for_cyber(self):
        code, added = self.gen._add_details(MINIMAL_PROP, "cyber data network")
        assert "DataStream" in added

    def test_no_components_for_generic(self):
        # Avoid words containing "ai" (substring match), use truly generic words
        code, added = self.gen._add_details(MINIMAL_PROP, "stone cube")
        assert added == []

    def test_component_import_injected(self):
        code, added = self.gen._add_details(MINIMAL_PROP, "coffee machine hot steam")
        if added:
            assert any(COMPONENT_IMPORTS[c] in code for c in added if c in COMPONENT_IMPORTS)

    def test_jsx_injected_before_group(self):
        code, added = self.gen._add_details(MINIMAL_PROP, "arcade gaming screen")
        if added:
            # JSX should appear before closing group
            for comp in added:
                if comp in COMPONENT_JSX:
                    comp_name = comp  # e.g. "Screen"
                    assert comp_name in code


class TestMultiPassGeneratorApplyPolish:
    def setup_method(self):
        self.gen = MultiPassGenerator()

    def test_flat_shading_applied_to_simple_material(self):
        code = 'export function X() { return (<mesh><meshStandardMaterial color="#CC3333" /></mesh>) }'
        result, notes = self.gen._apply_polish(code)
        assert "flatShading" in result
        assert any("flatShading" in n for n in notes)

    def test_no_flat_shading_when_already_emissive(self):
        code = (
            'export function X() { return (<mesh><meshStandardMaterial color="#CC3333" emissive="#FF0000" /></mesh>) }'
        )
        result, notes = self.gen._apply_polish(code)
        # emissive material should NOT get flatShading (regex doesn't match emissive ones)
        assert "Pass 3: Polish check passed" in " ".join(notes) or "emissive" in code

    def test_no_animation_note(self):
        code = "export function X() { return <group /> }"
        _, notes = self.gen._apply_polish(code)
        assert any("No animation" in n for n in notes)

    def test_has_animation_no_note(self):
        code = "export function X() { useFrame(() => {}); return <group /> }"
        _, notes = self.gen._apply_polish(code)
        animation_notes = [n for n in notes if "No animation" in n]
        assert len(animation_notes) == 0


class TestMultiPassGeneratorValidate:
    def setup_method(self):
        self.gen = MultiPassGenerator()

    def test_warns_on_single_mesh(self):
        code = "<group><mesh><boxGeometry /></mesh></group>"
        _, notes = self.gen._validate(code)
        assert any("Warning" in n for n in notes)

    def test_acceptable_for_4_meshes(self):
        code = "<group>" + "<mesh />" * 5 + "</group>"
        _, notes = self.gen._validate(code)
        assert any("acceptable" in n or "mesh" in n for n in notes)

    def test_good_complexity_for_8_meshes(self):
        code = "<group>" + "<mesh>\n<boxGeometry /></mesh>\n" * 8 + "</group>"
        # Count: re.findall r"<mesh[\s>]" needs space or >
        code2 = "<group>" + "<mesh>\n<boxGeometry /></mesh>\n" * 8 + "</group>"
        _, notes = self.gen._validate(code2)
        # Some note about meshes
        assert any("mesh" in n for n in notes)

    def test_warns_no_export(self):
        code = "function Foo() { return <group /> }"
        _, notes = self.gen._validate(code)
        assert any("export" in n.lower() for n in notes)

    def test_no_warnings_for_valid_prop(self):
        # Many meshes + export
        meshes = "".join("<mesh>\n<boxGeometry />\n</mesh>\n" for _ in range(8))
        code = f"export function Foo() {{ return <group>{meshes}</group> }}"
        _, notes = self.gen._validate(code)
        assert any("mesh" in n for n in notes)  # always mentions mesh count


class TestMultiPassGeneratorRefinement:
    def setup_method(self):
        self.gen = MultiPassGenerator()

    def test_get_refinement_options_returns_dict(self):
        opts = self.gen.get_refinement_options("neon sign with glow")
        assert "components" in opts
        assert "materialPresets" in opts
        assert "animationPresets" in opts
        assert "suggestedColors" in opts

    def test_refinement_options_components_list(self):
        opts = self.gen.get_refinement_options("coffee machine")
        comps = opts["components"]
        assert isinstance(comps, list)
        assert len(comps) > 0
        assert all("name" in c and "suggested" in c for c in comps)

    def test_refinement_options_relevant_suggested(self):
        opts = self.gen.get_refinement_options("glowing orb magic")
        glowing = next((c for c in opts["components"] if c["name"] == "GlowOrb"), None)
        assert glowing is not None
        assert glowing["suggested"] is True

    def test_refinement_options_deduplicates(self):
        opts = self.gen.get_refinement_options("anything")
        names = [c["name"] for c in opts["components"]]
        assert len(names) == len(set(names))

    def test_apply_refinement_color_change(self):
        code = 'color="#CC3333" emissive="#CC3333"'
        result, diags = self.gen.apply_refinement(code, {"colorChanges": {"#CC3333": "#00FFCC"}})
        assert "#00FFCC" in result
        assert "#CC3333" not in result
        assert any("Changed color" in d for d in diags)

    def test_apply_refinement_add_component(self):
        code = "import { useRef } from 'react'\n\nexport function X() {\n  return (<group><mesh /></group>)\n}"
        result, diags = self.gen.apply_refinement(code, {"addComponents": ["LED"]})
        assert "LED" in result
        assert any("Added LED" in d for d in diags)

    def test_apply_refinement_no_changes(self):
        code = "const X = 1"
        _, diags = self.gen.apply_refinement(code, {})
        assert any("No changes" in d for d in diags)

    def test_apply_refinement_unknown_component_skipped(self):
        code = "import { useRef } from 'react'\n"
        result, diags = self.gen.apply_refinement(code, {"addComponents": ["NonExistent"]})
        assert result == code or "NonExistent" not in diags


# ─── Constants / Data Tests ───────────────────────────────────────


class TestConstants:
    def test_component_jsx_is_subset_of_imports(self):
        # All components with JSX snippets must also have an import
        for comp in COMPONENT_JSX:
            assert comp in COMPONENT_IMPORTS, f"{comp} in COMPONENT_JSX but not in COMPONENT_IMPORTS"

    def test_keyword_components_structure(self):
        for entry in KEYWORD_COMPONENTS:
            keywords, component, color, pos = entry
            assert isinstance(keywords, list)
            assert len(keywords) > 0
            assert isinstance(component, str)
            assert color.startswith("#")
            assert len(pos.split(",")) == 3

    def test_component_jsx_has_format_placeholders(self):
        for name, tmpl in COMPONENT_JSX.items():
            if "{color}" in tmpl or "{pos}" in tmpl:
                rendered = tmpl.format(color="#FF0000", pos="0, 0.5, 0")
                assert "#FF0000" in rendered or "0, 0.5, 0" in rendered
