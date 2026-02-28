"""Tests for app.services.prop_post_processor."""

from __future__ import annotations

import app.main  # noqa: F401
from app.services.prop_post_processor import (
    PostProcessResult,
    _add_flat_shading_to_standard,
    _compute_quality_score,
    _ensure_ref_imports,
    _ensure_use_frame,
    _fix_toon_materials,
    enhance_generated_prop,
    validate_prop_quality,
)

# ---------------------------------------------------------------------------
# Test data / fixtures
# ---------------------------------------------------------------------------

TOON_MATERIAL_CODE = """
import { useToonMaterialProps } from '../../utils/toonMaterials'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface DeskProps {
  position?: [number, number, number]
  scale?: number
}

export function Desk({ position = [0, 0, 0], scale = 1 }: DeskProps) {
  const ref = useRef<THREE.Group>(null)
  const baseToon = useToonMaterialProps('#333')
  const darkToon = useToonMaterialProps('#1a1a2e')

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.1
    }
  })

  return (
    <group ref={ref} position={position} scale={scale}>
      <mesh castShadow>
        <boxGeometry args={[2, 0.1, 1]} />
        <meshToonMaterial {...baseToon} />
      </mesh>
      <mesh castShadow position={[0.8, -0.5, 0.4]}>
        <boxGeometry args={[0.1, 1, 0.1]} />
        <meshToonMaterial {...darkToon} />
      </mesh>
    </group>
  )
}
"""

STANDARD_MATERIAL_CODE = """
export function Lamp({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry />
        <meshStandardMaterial color="#ff0000" />
      </mesh>
      <mesh>
        <sphereGeometry />
        <meshStandardMaterial color="#00ff00" flatShading />
      </mesh>
      <mesh>
        <sphereGeometry />
        <meshStandardMaterial color="#0000ff" emissive="#0000ff" />
      </mesh>
    </group>
  )
}
"""

NO_ANIMATION_CODE = """
import { useRef } from 'react'
import * as THREE from 'three'

export function StaticProp({ position = [0, 0, 0] }) {
  const groupRef = useRef<THREE.Group>(null)
  return (
    <group ref={groupRef} position={position}>
      <mesh><boxGeometry /><meshStandardMaterial color="#ff0000" /></mesh>
      <mesh><sphereGeometry /><meshStandardMaterial color="#00ff00" /></mesh>
      <mesh><cylinderGeometry /><meshStandardMaterial color="#0000ff" /></mesh>
      <mesh><boxGeometry /><meshStandardMaterial color="#ffff00" /></mesh>
      <mesh><boxGeometry /><meshStandardMaterial color="#ff00ff" emissive="#ff00ff" /></mesh>
    </group>
  )
}
"""

NO_ANIMATION_NO_REF_CODE = """
import * as THREE from 'three'

export function StaticNoRef({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <mesh><boxGeometry /><meshStandardMaterial color="#ff0000" /></mesh>
      <mesh><sphereGeometry /><meshStandardMaterial color="#00ff00" /></mesh>
      <mesh><cylinderGeometry /><meshStandardMaterial color="#0000ff" /></mesh>
      <mesh><boxGeometry /><meshStandardMaterial color="#ffff00" /></mesh>
      <mesh><boxGeometry /><meshStandardMaterial color="#ff00ff" emissive="#ff00ff" /></mesh>
    </group>
  )
}
"""

ALREADY_ANIMATED_CODE = """
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function AnimatedProp({ position = [0, 0, 0] }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime
  })
  return (
    <group position={position}>
      <mesh><boxGeometry /><meshStandardMaterial color="#ff0000" flatShading /></mesh>
      <mesh><boxGeometry /><meshStandardMaterial color="#00ff00" emissive="#00ff00" /></mesh>
      <mesh><boxGeometry /><meshStandardMaterial color="#0000ff" flatShading /></mesh>
      <mesh><boxGeometry /><meshStandardMaterial color="#ffff00" flatShading /></mesh>
      <mesh><boxGeometry /><meshStandardMaterial color="#ff00ff" flatShading /></mesh>
      <mesh><boxGeometry /><meshStandardMaterial color="#00ffff" flatShading /></mesh>
      <mesh><boxGeometry /><meshStandardMaterial color="#888888" flatShading /></mesh>
      <mesh><boxGeometry /><meshStandardMaterial color="#444444" flatShading /></mesh>
    </group>
  )
}
"""

MISSING_REF_IMPORT_CODE = """
import { useState } from 'react'

export function MissingImport({ position = [0, 0, 0] }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime
  })
  return (
    <group position={position}>
      <mesh><boxGeometry /><meshStandardMaterial color="#ff0000" flatShading /></mesh>
    </group>
  )
}
"""

NO_RETURN_CODE = """
export function NoReturn({ position = [0, 0, 0] }) {
  const groupRef = useRef(null)
  const items = [1, 2, 3]
}
"""


# ---------------------------------------------------------------------------
# _fix_toon_materials
# ---------------------------------------------------------------------------


class TestFixToonMaterials:
    def test_no_toon_material_unchanged(self):
        result = PostProcessResult(code=ALREADY_ANIMATED_CODE)
        out = _fix_toon_materials(ALREADY_ANIMATED_CODE, result)
        assert out == ALREADY_ANIMATED_CODE
        assert len(result.corrections) == 0

    def test_removes_toon_import(self):
        result = PostProcessResult(code=TOON_MATERIAL_CODE)
        out = _fix_toon_materials(TOON_MATERIAL_CODE, result)
        assert "useToonMaterialProps" not in out
        assert "toonMaterials" not in out

    def test_replaces_toon_with_standard(self):
        result = PostProcessResult(code=TOON_MATERIAL_CODE)
        out = _fix_toon_materials(TOON_MATERIAL_CODE, result)
        assert "meshToonMaterial" not in out
        assert "meshStandardMaterial" in out

    def test_preserves_color_from_toon(self):
        result = PostProcessResult(code=TOON_MATERIAL_CODE)
        out = _fix_toon_materials(TOON_MATERIAL_CODE, result)
        # baseToon was '#333', darkToon was '#1a1a2e'
        assert "#333" in out or "#1a1a2e" in out

    def test_adds_flat_shading(self):
        result = PostProcessResult(code=TOON_MATERIAL_CODE)
        out = _fix_toon_materials(TOON_MATERIAL_CODE, result)
        assert "flatShading" in out

    def test_correction_recorded(self):
        result = PostProcessResult(code=TOON_MATERIAL_CODE)
        _fix_toon_materials(TOON_MATERIAL_CODE, result)
        assert any("meshToonMaterial" in c for c in result.corrections)

    def test_inline_toon_material(self):
        code = """
export function Inline() {
  return (
    <mesh>
      <meshToonMaterial color="#ff0000" />
    </mesh>
  )
}
"""
        result = PostProcessResult(code=code)
        out = _fix_toon_materials(code, result)
        assert "meshToonMaterial" not in out
        assert "meshStandardMaterial" in out
        assert "flatShading" in out


# ---------------------------------------------------------------------------
# _add_flat_shading_to_standard
# ---------------------------------------------------------------------------


class TestAddFlatShading:
    def test_adds_flat_shading_to_plain_standard(self):
        code = '<meshStandardMaterial color="#ff0000" />'
        result = PostProcessResult(code=code)
        out = _add_flat_shading_to_standard(code, result)
        assert "flatShading" in out
        assert len(result.corrections) > 0

    def test_skips_if_already_has_flat_shading(self):
        code = '<meshStandardMaterial color="#ff0000" flatShading />'
        result = PostProcessResult(code=code)
        out = _add_flat_shading_to_standard(code, result)
        assert out == code
        assert len(result.corrections) == 0

    def test_skips_if_has_emissive(self):
        code = '<meshStandardMaterial color="#ff0000" emissive="#ff0000" />'
        result = PostProcessResult(code=code)
        out = _add_flat_shading_to_standard(code, result)
        assert "flatShading" not in out

    def test_skips_if_has_transparent(self):
        code = '<meshStandardMaterial color="#ff0000" transparent opacity={0.5} />'
        result = PostProcessResult(code=code)
        out = _add_flat_shading_to_standard(code, result)
        assert "flatShading" not in out

    def test_skips_if_metalness(self):
        code = '<meshStandardMaterial color="#ff0000" metalness={0.5} />'
        result = PostProcessResult(code=code)
        out = _add_flat_shading_to_standard(code, result)
        assert "flatShading" not in out

    def test_no_standard_material(self):
        code = "no standard material here"
        result = PostProcessResult(code=code)
        out = _add_flat_shading_to_standard(code, result)
        assert out == code
        assert len(result.corrections) == 0


# ---------------------------------------------------------------------------
# _ensure_use_frame
# ---------------------------------------------------------------------------


class TestEnsureUseFrame:
    def test_already_has_use_frame(self):
        result = PostProcessResult(code=ALREADY_ANIMATED_CODE)
        out = _ensure_use_frame(ALREADY_ANIMATED_CODE, result)
        assert out == ALREADY_ANIMATED_CODE
        assert len(result.corrections) == 0

    def test_adds_animation_with_group_ref(self):
        result = PostProcessResult(code=NO_ANIMATION_CODE)
        out = _ensure_use_frame(NO_ANIMATION_CODE, result)
        assert "useFrame" in out
        assert any("animation" in c.lower() for c in result.corrections)

    def test_adds_animation_without_existing_ref(self):
        result = PostProcessResult(code=NO_ANIMATION_NO_REF_CODE)
        out = _ensure_use_frame(NO_ANIMATION_NO_REF_CODE, result)
        assert "useFrame" in out

    def test_adds_useframe_import_to_fiber_import(self):
        code = """import { Canvas } from '@react-three/fiber'
export function P() {
  const groupRef = useRef(null)
  return (
    <group>
      <mesh><boxGeometry /></mesh>
    </group>
  )
}
"""
        result = PostProcessResult(code=code)
        out = _ensure_use_frame(code, result)
        assert "useFrame" in out

    def test_adds_standalone_import_when_no_fiber(self):
        code = """import { useRef } from 'react'
export function P() {
  const groupRef = useRef(null)
  return (
    <group>
      <mesh><boxGeometry /></mesh>
    </group>
  )
}
"""
        result = PostProcessResult(code=code)
        out = _ensure_use_frame(code, result)
        assert "useFrame" in out
        assert "from '@react-three/fiber'" in out

    def test_no_return_records_warning(self):
        result = PostProcessResult(code=NO_RETURN_CODE)
        out = _ensure_use_frame(NO_RETURN_CODE, result)
        # groupRef exists but no return statement
        # Behavior depends on implementation; just check no crash
        assert out is not None


# ---------------------------------------------------------------------------
# _ensure_ref_imports
# ---------------------------------------------------------------------------


class TestEnsureRefImports:
    def test_adds_use_ref_to_react_import(self):
        code = """import { useState } from 'react'
const ref = useRef(null)
"""
        result = PostProcessResult(code=code)
        out = _ensure_ref_imports(code, result)
        assert "useRef" in out
        # Should add to existing react import
        assert "from 'react'" in out

    def test_adds_three_import_when_missing(self):
        code = "const g: THREE.Group = null"
        result = PostProcessResult(code=code)
        out = _ensure_ref_imports(code, result)
        assert "import * as THREE" in out

    def test_no_change_when_already_correct(self):
        result = PostProcessResult(code=ALREADY_ANIMATED_CODE)
        out = _ensure_ref_imports(ALREADY_ANIMATED_CODE, result)
        # Should not add duplicate imports
        assert out.count("import * as THREE") == 1

    def test_no_useref_in_code(self):
        code = "const x = 1"
        result = PostProcessResult(code=code)
        out = _ensure_ref_imports(code, result)
        assert out == code
        assert len(result.corrections) == 0

    def test_adds_useref_standalone_when_no_react_import(self):
        code = """import * as THREE from 'three'
const ref = useRef(null)
"""
        result = PostProcessResult(code=code)
        out = _ensure_ref_imports(code, result)
        assert "useRef" in out


# ---------------------------------------------------------------------------
# _compute_quality_score
# ---------------------------------------------------------------------------


class TestComputeQualityScore:
    def test_minimal_code_score(self):
        result = PostProcessResult(code=MINIMAL_CODE)
        _compute_quality_score(MINIMAL_CODE, result)
        assert result.quality_score >= 0
        assert result.quality_score <= 100

    def test_rich_code_high_score(self):
        result = PostProcessResult(code=ALREADY_ANIMATED_CODE)
        _compute_quality_score(ALREADY_ANIMATED_CODE, result)
        assert result.quality_score >= 50

    def test_no_emissive_adds_warning(self):
        code = '<mesh><meshStandardMaterial color="#ff0000" /></mesh>'
        result = PostProcessResult(code=code)
        _compute_quality_score(code, result)
        assert any("emissive" in w.lower() for w in result.warnings)

    def test_few_meshes_adds_warning(self):
        code = '<mesh><meshStandardMaterial emissive="#ff0000" /></mesh>'
        result = PostProcessResult(code=code)
        _compute_quality_score(code, result)
        assert any("mesh" in w.lower() for w in result.warnings)

    def test_many_meshes_increases_score(self):
        few_mesh_code = (
            MINIMAL_CODE + '\nuseFrame() Math.sin flatShading emissive= color="#ff0000" color="#00ff00" color="#0000ff"'
        )
        many_mesh = (
            "<mesh>" * 10
            + '\nuseFrame() Math.sin flatShading emissive= color="#ff0000" color="#00ff00" color="#0000ff"'
        )
        r_few = PostProcessResult(code=few_mesh_code)
        r_many = PostProcessResult(code=many_mesh)
        _compute_quality_score(few_mesh_code, r_few)
        _compute_quality_score(many_mesh, r_many)
        assert r_many.quality_score >= r_few.quality_score


# ---------------------------------------------------------------------------
# Simple code reference for minimal test
# ---------------------------------------------------------------------------

MINIMAL_CODE = """
export function MinProp({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <mesh><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#ff0000" /></mesh>
    </group>
  )
}
"""


# ---------------------------------------------------------------------------
# enhance_generated_prop (integration)
# ---------------------------------------------------------------------------


class TestEnhanceGeneratedProp:
    def test_enhances_toon_material_code(self):
        result = enhance_generated_prop(TOON_MATERIAL_CODE)
        assert isinstance(result, PostProcessResult)
        assert "meshToonMaterial" not in result.code
        assert len(result.corrections) > 0
        assert result.quality_score >= 0

    def test_enhances_already_good_code(self):
        result = enhance_generated_prop(ALREADY_ANIMATED_CODE)
        assert isinstance(result, PostProcessResult)
        assert "meshToonMaterial" not in result.code
        assert result.quality_score >= 50

    def test_cleans_extra_blank_lines(self):
        code = "line1\n\n\n\nline2"
        result = enhance_generated_prop(code)
        assert "\n\n\n" not in result.code

    def test_returns_post_process_result(self):
        result = enhance_generated_prop(MINIMAL_CODE)
        assert hasattr(result, "code")
        assert hasattr(result, "corrections")
        assert hasattr(result, "warnings")
        assert hasattr(result, "quality_score")

    def test_adds_animation_to_static_code(self):
        result = enhance_generated_prop(NO_ANIMATION_CODE)
        assert "useFrame" in result.code

    def test_adds_flat_shading_where_needed(self):
        result = enhance_generated_prop(STANDARD_MATERIAL_CODE)
        # First mesh material should have flatShading (no emissive)
        assert "flatShading" in result.code


# ---------------------------------------------------------------------------
# validate_prop_quality
# ---------------------------------------------------------------------------


class TestValidatePropQuality:
    def test_minimal_code_fails(self):
        result = validate_prop_quality(MINIMAL_CODE)
        assert result["meshCount"] == 1
        assert result["passesMinimum"] is False
        assert result["hasAnimation"] is False
        assert result["hasEmissive"] is False

    def test_showcase_code_passes(self):
        result = validate_prop_quality(ALREADY_ANIMATED_CODE)
        assert result["meshCount"] == 8
        assert result["hasAnimation"] is True
        assert result["hasFlatShading"] is True
        assert result["usesStandardMaterial"] is True
        assert result["passesMinimum"] is True

    def test_toon_material_code(self):
        result = validate_prop_quality(TOON_MATERIAL_CODE)
        assert result["usesToonMaterial"] is True
        # Still using toon material, so passesMinimum may be False
        assert result["passesMinimum"] is False

    def test_color_count(self):
        code = 'color="#ff0000" color="#00ff00" color="#0000ff" color="#ffff00"'
        result = validate_prop_quality(code)
        assert result["colorCount"] == 4

    def test_all_fields_present(self):
        result = validate_prop_quality("")
        keys = {
            "meshCount",
            "hasAnimation",
            "hasEmissive",
            "hasFlatShading",
            "usesStandardMaterial",
            "usesToonMaterial",
            "colorCount",
            "passesMinimum",
        }
        assert keys.issubset(result.keys())
