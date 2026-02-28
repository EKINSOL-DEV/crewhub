"""Tests for app.services.prop_quality_scorer."""

from __future__ import annotations

import app.main  # noqa: F401
from app.services.prop_quality_scorer import (
    PropQualityReport,
    QualityScorer,
    _count_geometry_types,
    _count_meshes,
    _count_unique_colors,
    _score_animation,
    _score_color,
    _score_composition,
    _score_detail,
    _score_style,
)

# ---------------------------------------------------------------------------
# Fixtures / helper code snippets
# ---------------------------------------------------------------------------

MINIMAL_CODE = """
export function TestProp({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ff0000" />
      </mesh>
    </group>
  )
}
"""

SHOWCASE_CODE = """
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useToonMaterialProps } from '../../utils/toonMaterials'
import * as THREE from 'three'

interface ShowcasePropProps {
  position?: [number, number, number]
  scale?: number
}

export function ShowcaseProp({ position = [0, 0, 0], scale = 1 }: ShowcasePropProps) {
  const ref = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.2
    }
  })

  return (
    <group position={position} scale={scale}>
      <mesh castShadow>
        <boxGeometry args={[0.8, 1.2, 0.8]} />
        <meshStandardMaterial color="#1a1a2e" emissive="#0044cc" emissiveIntensity={0.5}
          flatShading toneMapped={false} />
      </mesh>
      <mesh castShadow position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.1, 16]} />
        <meshStandardMaterial color="#2266ff" emissive="#2266ff" emissiveIntensity={1.5}
          toneMapped={false} transparent opacity={0.9} />
      </mesh>
      <mesh castShadow position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={2}
          toneMapped={false} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0.3, 0.2, 0.4]}>
        <torusGeometry args={[0.05, 0.02, 8, 16]} />
        <meshStandardMaterial color="#ff4444" emissive="#ff4444" emissiveIntensity={1.2}
          toneMapped={false} />
      </mesh>
      <mesh position={[-0.2, 0.4, 0.4]}>
        <coneGeometry args={[0.03, 0.06, 6]} />
        <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={1}
          toneMapped={false} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.6, 0.1, 0.6]} />
        <meshStandardMaterial color="#333333" flatShading />
      </mesh>
      <mesh position={[0.1, 0.5, 0.3]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88"
          emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      <mesh position={[-0.1, 0.5, 0.3]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#ff8800" emissive="#ff8800"
          emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 1.5, 0]} color="#00ffcc" intensity={1.5} distance={4} decay={2} />
    </group>
  )
}
"""

TOON_CODE = """
import { useToonMaterialProps } from '../../utils/toonMaterials'

export function ToonProp({ position = [0, 0, 0], scale = 1 }) {
  const baseToon = useToonMaterialProps('#1a1a2e')

  return (
    <group position={position} scale={scale}>
      <mesh castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshToonMaterial {...baseToon} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff4400" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}
"""


# ---------------------------------------------------------------------------
# Helper function tests
# ---------------------------------------------------------------------------


class TestCountHelpers:
    def test_count_meshes_minimal(self):
        assert _count_meshes(MINIMAL_CODE) == 1

    def test_count_meshes_showcase(self):
        count = _count_meshes(SHOWCASE_CODE)
        assert count >= 8

    def test_count_meshes_empty(self):
        assert _count_meshes("") == 0

    def test_count_unique_colors_minimal(self):
        # One color: #ff0000
        assert _count_unique_colors(MINIMAL_CODE) == 1

    def test_count_unique_colors_showcase(self):
        colors = _count_unique_colors(SHOWCASE_CODE)
        assert colors >= 4

    def test_count_unique_colors_none(self):
        assert _count_unique_colors("no colors here") == 0

    def test_count_geometry_types_minimal(self):
        # Only box
        assert _count_geometry_types(MINIMAL_CODE) == 1

    def test_count_geometry_types_showcase(self):
        geo = _count_geometry_types(SHOWCASE_CODE)
        assert geo >= 4  # box, cylinder, sphere, torus, cone

    def test_count_geometry_types_none(self):
        assert _count_geometry_types("no geometry") == 0


# ---------------------------------------------------------------------------
# Sub-scorer tests
# ---------------------------------------------------------------------------


class TestScoreComposition:
    def test_minimal_code_low_score(self):
        score, suggestions = _score_composition(MINIMAL_CODE, 1, 1)
        assert score < 50
        assert len(suggestions) > 0

    def test_showcase_code_high_score(self):
        mesh_c = _count_meshes(SHOWCASE_CODE)
        geo_c = _count_geometry_types(SHOWCASE_CODE)
        score, suggestions = _score_composition(SHOWCASE_CODE, mesh_c, geo_c)
        assert score >= 60

    def test_cast_shadow_adds_points(self):
        code_with = "<mesh castShadow>" + "<mesh>" * 6 + "<boxGeometry>" * 3
        code_without = "<mesh>" * 6 + "<boxGeometry>" * 3
        score_with, _ = _score_composition(code_with, 7, 3)
        score_without, _ = _score_composition(code_without, 7, 3)
        assert score_with > score_without

    def test_returns_suggestions_for_few_meshes(self):
        _, suggestions = _score_composition("", 1, 1)
        assert any("geometry" in s.lower() or "depth" in s.lower() for s in suggestions)


class TestScoreColor:
    def test_minimal_code(self):
        score, suggestions, has_emissive, has_ei = _score_color(MINIMAL_CODE)
        assert score >= 0
        assert not has_emissive
        assert not has_ei
        assert len(suggestions) > 0

    def test_showcase_code(self):
        score, suggestions, has_emissive, has_ei = _score_color(SHOWCASE_CODE)
        assert score > 50
        assert has_emissive
        assert has_ei

    def test_tone_mapped_adds_points(self):
        code = """color="#ff0000" emissive="#00ff00" emissiveIntensity={1} toneMapped={false}"""
        score_tm, _, _, _ = _score_color(code)
        code_no_tm = """color="#ff0000" emissive="#00ff00" emissiveIntensity={1}"""
        score_no_tm, _, _, _ = _score_color(code_no_tm)
        assert score_tm > score_no_tm


class TestScoreAnimation:
    def test_no_animation(self):
        score, suggestions = _score_animation(MINIMAL_CODE)
        assert score == 0
        assert len(suggestions) > 0

    def test_full_animation(self):
        score, suggestions = _score_animation(SHOWCASE_CODE)
        assert score >= 40

    def test_sin_without_frame(self):
        code = "Math.sin(t) useRef"
        score, _ = _score_animation(code)
        # sin=25 and ref=20 but no useFrame → 45, no rotation bonus
        assert 0 < score < 100
        # should be less than full animation score
        full_score, _ = _score_animation(code + " useFrame(() => {}) rotation.y = 1")
        assert score < full_score

    def test_full_score_requires_frame_and_rotation(self):
        code = "useFrame(() => { }) Math.sin(t) useRef rotation.y = 1"
        score, _ = _score_animation(code)
        assert score == 100  # all 4 components


class TestScoreDetail:
    def test_no_detail(self):
        score, suggestions = _score_detail(MINIMAL_CODE, 1, False)
        assert score <= 20
        assert len(suggestions) >= 1

    def test_with_light_and_transparent(self):
        code = "<pointLight position={[0, 1, 0]} /> transparent opacity={0.8} toneMapped"
        score, _ = _score_detail(code, 6, True)
        assert score >= 60

    def test_emissive_intensity_adds_points(self):
        score_with_ei, _ = _score_detail(MINIMAL_CODE, 1, True)
        score_no_ei, _ = _score_detail(MINIMAL_CODE, 1, False)
        assert score_with_ei > score_no_ei


class TestScoreStyle:
    def test_minimal_code(self):
        score, suggestions = _score_style(MINIMAL_CODE)
        # No toon, no interface → low score
        assert score <= 30
        assert len(suggestions) > 0

    def test_showcase_code(self):
        score, suggestions = _score_style(SHOWCASE_CODE)
        assert score >= 50  # has interface, export, toon

    def test_toon_code(self):
        score, suggestions = _score_style(TOON_CODE)
        assert score >= 30

    def test_all_style_features(self):
        code = """
        useToonMaterialProps meshStandardMaterial
        interface TestProps
        export function TestProp
        position?: [number, number, number]
        scale?: number
        """
        score, _ = _score_style(code)
        assert score == 100


# ---------------------------------------------------------------------------
# QualityScorer integration tests
# ---------------------------------------------------------------------------


class TestQualityScorer:
    def setup_method(self):
        self.scorer = QualityScorer()

    def test_score_minimal_prop(self):
        report = self.scorer.score_prop(MINIMAL_CODE)
        assert isinstance(report, PropQualityReport)
        assert 0 <= report.overall <= 100
        assert report.composition_score >= 0
        assert report.color_score >= 0
        assert report.animation_score == 0  # no animation
        assert len(report.suggestions) <= 5

    def test_score_showcase_prop(self):
        report = self.scorer.score_prop(SHOWCASE_CODE)
        assert report.overall >= 50
        assert report.composition_score >= 60
        assert report.color_score >= 50
        assert report.animation_score >= 40

    def test_score_empty_code(self):
        report = self.scorer.score_prop("")
        assert report.overall == 0
        assert len(report.suggestions) <= 5

    def test_to_dict(self):
        report = self.scorer.score_prop(MINIMAL_CODE)
        d = report.to_dict()
        assert "overall" in d
        assert "suggestions" in d
        assert "composition_score" in d

    def test_suggestions_capped_at_5(self):
        # Empty code should produce many suggestions but capped at 5
        report = self.scorer.score_prop("")
        assert len(report.suggestions) <= 5

    def test_overall_is_weighted_average(self):
        report = self.scorer.score_prop(SHOWCASE_CODE)
        expected = int(
            report.composition_score * 0.25
            + report.color_score * 0.20
            + report.animation_score * 0.20
            + report.detail_score * 0.15
            + report.style_consistency * 0.20
        )
        assert report.overall == expected


class TestQualityScorerParts:
    def setup_method(self):
        self.scorer = QualityScorer()

    def test_score_empty_parts(self):
        report = self.scorer.score_parts([])
        assert report.overall >= 0
        assert report.animation_score == 0
        assert report.style_consistency == 30  # neutral

    def test_score_rich_parts(self):
        parts = [
            {"type": "box", "color": "#ff0000", "emissive": True},
            {"type": "sphere", "color": "#00ff00"},
            {"type": "cylinder", "color": "#0000ff"},
            {"type": "torus", "color": "#ffff00"},
            {"type": "cone", "color": "#ff00ff"},
            {"type": "box", "color": "#00ffff"},
            {"type": "sphere", "color": "#888888"},
            {"type": "box", "color": "#444444"},
        ]
        report = self.scorer.score_parts(parts)
        assert report.overall >= 30
        assert report.animation_score == 0  # can't measure from parts

    def test_score_parts_suggestions_include_ai(self):
        report = self.scorer.score_parts([])
        assert any("AI" in s for s in report.suggestions)

    def test_score_parts_no_emissive(self):
        parts = [{"type": "box", "color": "#ff0000"}, {"type": "sphere", "color": "#00ff00"}]
        report = self.scorer.score_parts(parts)
        assert any("emissive" in s.lower() for s in report.suggestions)

    def test_score_parts_capped_at_100(self):
        # 20 identical parts with emissive
        parts = [{"type": "box", "color": f"#{i:06x}", "emissive": True} for i in range(20)]
        report = self.scorer.score_parts(parts)
        assert report.composition_score <= 100
        assert report.color_score <= 100
