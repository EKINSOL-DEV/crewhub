"""Prop Quality Scorer — Objective analysis of generated prop code quality."""

from __future__ import annotations

import re
import json
import logging
from dataclasses import dataclass, asdict
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class PropQualityReport:
    composition_score: int  # 0-100 — number of layers/groups
    color_score: int  # 0-100 — palette variety, saturation
    animation_score: int  # 0-100 — has useFrame, rotation, etc.
    detail_score: int  # 0-100 — small touches (LED, particles, emissive)
    style_consistency: int  # 0-100 — uses toon materials, proper structure
    overall: int  # weighted average
    suggestions: list[str]

    def to_dict(self) -> dict:
        return asdict(self)


# Showcase quality benchmarks
SHOWCASE_PATTERNS = {
    "toon_material": re.compile(r"useToonMaterialProps"),
    "emissive": re.compile(r"emissive[=:]"),
    "emissive_intensity": re.compile(r"emissiveIntensity"),
    "use_frame": re.compile(r"useFrame"),
    "math_sin": re.compile(r"Math\.sin"),
    "mesh_count": re.compile(r"<mesh[\s>]"),
    "group_nesting": re.compile(r"<group[\s>]"),
    "cast_shadow": re.compile(r"castShadow"),
    "tone_mapped": re.compile(r"toneMapped"),
    "transparent": re.compile(r"transparent"),
    "geometry_types": re.compile(r"<(box|cylinder|sphere|cone|torus)Geometry"),
    "color_values": re.compile(r"""(?:color|emissive)=["'{]#([0-9a-fA-F]{6})"""),
    "point_light": re.compile(r"<pointLight"),
    "std_material": re.compile(r"meshStandardMaterial"),
    "toon_material_tag": re.compile(r"meshToonMaterial"),
    "interface_def": re.compile(r"interface \w+Props"),
    "export_function": re.compile(r"export function"),
    "position_prop": re.compile(r"position\??\s*:"),
    "scale_prop": re.compile(r"scale\??\s*:"),
    "rotation_ref": re.compile(r"rotation"),
    "useRef": re.compile(r"useRef"),
}


def _count_unique_colors(code: str) -> int:
    colors = set(SHOWCASE_PATTERNS["color_values"].findall(code))
    return len(colors)


def _count_geometry_types(code: str) -> int:
    types = set(SHOWCASE_PATTERNS["geometry_types"].findall(code))
    return len(types)


def _count_meshes(code: str) -> int:
    return len(SHOWCASE_PATTERNS["mesh_count"].findall(code))


class QualityScorer:
    """Analyze prop code quality objectively."""

    def score_prop(self, code: str) -> PropQualityReport:
        suggestions: list[str] = []

        # ── Composition (mesh count, group nesting, geometry variety) ──
        mesh_count = _count_meshes(code)
        geo_types = _count_geometry_types(code)
        group_count = len(SHOWCASE_PATTERNS["group_nesting"].findall(code))

        comp = min(100, int(
            min(mesh_count / 8.0, 1.0) * 40 +      # up to 8 meshes
            min(geo_types / 4.0, 1.0) * 30 +         # variety of shapes
            min(group_count / 3.0, 1.0) * 20 +       # hierarchy
            (10 if SHOWCASE_PATTERNS["cast_shadow"].search(code) else 0)
        ))
        if mesh_count < 4:
            suggestions.append("Add more geometry layers for visual depth")
        if geo_types < 2:
            suggestions.append("Use varied geometry types (sphere, cylinder, torus)")

        # ── Color (palette size, saturation) ──
        unique_colors = _count_unique_colors(code)
        has_emissive = bool(SHOWCASE_PATTERNS["emissive"].search(code))
        has_emissive_intensity = bool(SHOWCASE_PATTERNS["emissive_intensity"].search(code))

        color = min(100, int(
            min(unique_colors / 4.0, 1.0) * 50 +
            (25 if has_emissive else 0) +
            (15 if has_emissive_intensity else 0) +
            (10 if SHOWCASE_PATTERNS["tone_mapped"].search(code) else 0)
        ))
        if unique_colors < 2:
            suggestions.append("Add more color variety to the palette")
        if not has_emissive:
            suggestions.append("Add emissive materials for glow effects")

        # ── Animation (useFrame, rotation, sin waves) ──
        has_frame = bool(SHOWCASE_PATTERNS["use_frame"].search(code))
        has_sin = bool(SHOWCASE_PATTERNS["math_sin"].search(code))
        has_ref = bool(SHOWCASE_PATTERNS["useRef"].search(code))
        has_rotation = bool(SHOWCASE_PATTERNS["rotation_ref"].search(code))

        anim = min(100, int(
            (40 if has_frame else 0) +
            (25 if has_sin else 0) +
            (20 if has_ref else 0) +
            (15 if has_rotation and has_frame else 0)
        ))
        if not has_frame:
            suggestions.append("Add useFrame animation for movement")
        if not has_sin:
            suggestions.append("Use Math.sin for organic floating/pulsing effects")

        # ── Detail (lights, particles, transparency, small touches) ──
        has_light = bool(SHOWCASE_PATTERNS["point_light"].search(code))
        has_transparent = bool(SHOWCASE_PATTERNS["transparent"].search(code))

        detail = min(100, int(
            (25 if has_light else 0) +
            (20 if has_transparent else 0) +
            (20 if has_emissive_intensity else 0) +
            min(mesh_count / 6.0, 1.0) * 20 +
            (15 if SHOWCASE_PATTERNS["tone_mapped"].search(code) else 0)
        ))
        if not has_light:
            suggestions.append("Add a pointLight for ambient glow")
        if not has_transparent:
            suggestions.append("Use transparency for glass/glow effects")

        # ── Style consistency (toon materials, proper structure) ──
        has_toon = bool(SHOWCASE_PATTERNS["toon_material"].search(code))
        has_interface = bool(SHOWCASE_PATTERNS["interface_def"].search(code))
        has_export = bool(SHOWCASE_PATTERNS["export_function"].search(code))
        has_pos_prop = bool(SHOWCASE_PATTERNS["position_prop"].search(code))
        has_scale_prop = bool(SHOWCASE_PATTERNS["scale_prop"].search(code))
        has_both_materials = has_toon and bool(SHOWCASE_PATTERNS["std_material"].search(code))

        style = min(100, int(
            (30 if has_toon else 0) +
            (15 if has_interface else 0) +
            (15 if has_export else 0) +
            (10 if has_pos_prop else 0) +
            (10 if has_scale_prop else 0) +
            (20 if has_both_materials else 0)  # mix of toon + standard = showcase style
        ))
        if not has_toon:
            suggestions.append("Use useToonMaterialProps for consistent style")
        if not has_interface:
            suggestions.append("Define a TypeScript Props interface")

        # ── Overall (weighted) ──
        overall = int(
            comp * 0.25 +
            color * 0.20 +
            anim * 0.20 +
            detail * 0.15 +
            style * 0.20
        )

        return PropQualityReport(
            composition_score=comp,
            color_score=color,
            animation_score=anim,
            detail_score=detail,
            style_consistency=style,
            overall=overall,
            suggestions=suggestions[:5],  # top 5 suggestions
        )

    def score_parts(self, parts: list[dict]) -> PropQualityReport:
        """Score from parts data (no code available)."""
        suggestions: list[str] = []
        mesh_count = len(parts)
        geo_types = set(p.get("type", "") for p in parts)
        colors = set(p.get("color", "") for p in parts)
        has_emissive = any(p.get("emissive", False) for p in parts)

        comp = min(100, int(
            min(mesh_count / 8.0, 1.0) * 60 +
            min(len(geo_types) / 4.0, 1.0) * 40
        ))
        color = min(100, int(
            min(len(colors) / 4.0, 1.0) * 70 +
            (30 if has_emissive else 0)
        ))
        # Parts-only can't measure animation/style
        anim = 0
        detail = min(100, int(
            (30 if has_emissive else 0) +
            min(mesh_count / 6.0, 1.0) * 40
        ))
        style = 30  # neutral — can't assess from parts alone

        if mesh_count < 4:
            suggestions.append("Add more geometry parts")
        if not has_emissive:
            suggestions.append("Add emissive parts for glow")
        suggestions.append("Use AI generation for animations and higher quality")

        overall = int(comp * 0.30 + color * 0.25 + anim * 0.15 + detail * 0.15 + style * 0.15)

        return PropQualityReport(
            composition_score=comp,
            color_score=color,
            animation_score=anim,
            detail_score=detail,
            style_consistency=style,
            overall=overall,
            suggestions=suggestions[:5],
        )
