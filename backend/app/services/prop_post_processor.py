"""Post-processor for AI-generated prop code.

Ensures quality standards: meshStandardMaterial, flatShading, animation, emissive.
Runs in < 100ms on typical prop code.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

EMISSIVE_ATTR = "emissive="

logger = logging.getLogger(__name__)


@dataclass
class PostProcessResult:
    code: str
    corrections: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    quality_score: int = 0  # 0-100


def _fix_toon_materials(code: str, result: PostProcessResult) -> str:
    """Replace meshToonMaterial with meshStandardMaterial + flatShading."""
    toon_count = len(re.findall(r"meshToonMaterial", code))
    if toon_count == 0:
        return code

    code = re.sub(r"import\s*\{[^}]*useToonMaterialProps[^}]*\}\s*from\s*['\"][^'\"]*toonMaterials['\"].*?\n", "", code)
    result.corrections.append("Removed toonMaterials import")

    color_map: dict[str, str] = {}
    for m in re.finditer(r'const\s+(\w+)\s*=\s*useToonMaterialProps\([\'"]([^"\']+)[\'"]\)', code):
        color_map[m.group(1)] = m.group(2)

    code = re.sub(r"\s*const\s+\w+\s*=\s*useToonMaterialProps\([^)]+\).*?\n", "\n", code)

    for var_name, color in color_map.items():
        pattern = rf"<meshToonMaterial\s+\{{\.\.\.{var_name}\}}\s*/>"
        code = re.sub(pattern, f'<meshStandardMaterial color="{color}" flatShading />', code)

    code = re.sub(r"<meshToonMaterial\s+([^/]*?)\s*/>", r"<meshStandardMaterial \1 flatShading />", code)
    result.corrections.append(f"Replaced {toon_count} meshToonMaterial → meshStandardMaterial + flatShading")
    return code


def _add_flat_shading_to_standard(code: str, result: PostProcessResult) -> str:
    """Add flatShading to meshStandardMaterial tags that are missing it."""

    def _add_flat(match: re.Match) -> str:
        tag = match.group(0)
        if (
            "flatShading" in tag
            or EMISSIVE_ATTR in tag
            or "transparent" in tag
            or "opacity=" in tag
            or "wireframe" in tag
            or "metalness=" in tag
        ):
            return tag
        return tag.replace("/>", "flatShading />")

    before = code
    code = re.sub(r"<meshStandardMaterial\s+[^>]*?/>", _add_flat, code)
    if code != before:
        result.corrections.append("Added flatShading to meshStandardMaterial where missing")
    return code


def _ensure_use_frame(code: str, result: PostProcessResult) -> str:
    """Ensure useFrame import and animation code are present."""
    if bool(re.search(r"useFrame\s*\(", code)):
        return code

    fiber_import = re.search(r"import\s*\{([^}]*)\}\s*from\s*['\"]@react-three/fiber['\"]", code)
    if fiber_import:
        if "useFrame" not in fiber_import.group(1):
            code = code.replace(
                fiber_import.group(0),
                f"import {{ {fiber_import.group(1).strip()}, useFrame }} from '@react-three/fiber'",
            )
    else:
        last_import = None
        for m in re.finditer(r"^import\s+.*$", code, re.MULTILINE):
            last_import = m
        if last_import:
            pos = last_import.end()
            code = code[:pos] + "\nimport { useFrame } from '@react-three/fiber';" + code[pos:]
        else:
            code = "import { useFrame } from '@react-three/fiber';\n" + code

    ref_match = re.search(r"(const\s+groupRef\s*=\s*useRef[^;]*;)", code)
    if ref_match:
        inject_after = ref_match.end()
        animation_code = """

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
    }
  });"""
        code = code[:inject_after] + animation_code + code[inject_after:]
        result.corrections.append("Added gentle sway animation (useFrame)")
    else:
        return_match = re.search(r"(\n\s*return\s*\()", code)
        if return_match:
            inject_pos = return_match.start()
            animation_code = """\n  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
    }
  });
"""
            code = code[:inject_pos] + animation_code + code[inject_pos:]
            result.corrections.append("Added groupRef and gentle sway animation")
        else:
            result.warnings.append("Could not inject animation — no return statement found")
    return code


def _ensure_ref_imports(code: str, result: PostProcessResult) -> str:
    """Ensure useRef and THREE imports are present when needed."""
    if "useRef" in code and "import" in code:
        if not re.search(r"import\s*\{[^}]*useRef[^}]*\}\s*from\s*['\"]react['\"]", code):
            react_import = re.search(r"import\s*\{([^}]*)\}\s*from\s*['\"]react['\"]", code)
            if react_import:
                imports = react_import.group(1).strip()
                if "useRef" not in imports:
                    code = code.replace(react_import.group(0), f"import {{ {imports}, useRef }} from 'react'")
                    result.corrections.append("Added useRef to react imports")
            elif "from 'react'" not in code and 'from "react"' not in code:
                code = f"import {{ useRef }} from 'react';\n{code}"
                result.corrections.append("Added useRef import")

    if "THREE.Group" in code and "import * as THREE" not in code:
        code = f"import * as THREE from 'three';\n{code}"
        result.corrections.append("Added THREE import")
    return code


def _compute_quality_score(code: str, result: PostProcessResult) -> None:
    """Compute quality score and append warnings to result."""
    has_emissive = EMISSIVE_ATTR in code or "emissiveIntensity" in code
    if not has_emissive:
        result.warnings.append("No emissive elements — prop may look flat. Consider regenerating.")

    mesh_count = len(re.findall(r"<mesh\b", code))
    has_animation = "useFrame" in code
    has_multiple_colors = len(set(re.findall(r'color="(#[0-9a-fA-F]{6})"', code))) >= 3
    has_flat_shading = "flatShading" in code

    score = min(30, mesh_count * 3)
    score += 20 if has_animation else 0
    score += 15 if has_emissive else 0
    score += 15 if has_multiple_colors else 0
    score += 10 if has_flat_shading else 0
    score += 10 if mesh_count >= 8 else 0
    result.quality_score = min(100, score)

    if mesh_count < 5:
        result.warnings.append(f"Only {mesh_count} meshes — prop may lack detail")


def enhance_generated_prop(code: str) -> PostProcessResult:
    """Post-process AI-generated prop code for quality improvements.

    Fixes:
    - Replace meshToonMaterial with meshStandardMaterial + flatShading
    - Remove useToonMaterialProps imports and usage
    - Add flatShading to meshStandardMaterial where missing
    - Ensure useFrame animation exists
    - Ensure emissive elements exist
    - Fix missing imports

    Returns PostProcessResult with enhanced code and metadata.
    """
    result = PostProcessResult(code=code)
    enhanced = code

    enhanced = _fix_toon_materials(enhanced, result)
    enhanced = _add_flat_shading_to_standard(enhanced, result)
    enhanced = _ensure_use_frame(enhanced, result)
    enhanced = _ensure_ref_imports(enhanced, result)
    _compute_quality_score(enhanced, result)

    # Clean up any double-blank lines
    enhanced = re.sub(r"\n{3,}", "\n\n", enhanced)

    result.code = enhanced
    return result


def validate_prop_quality(code: str) -> dict:
    """Quick validation check for prop quality metrics."""
    mesh_count = len(re.findall(r"<mesh\b", code))
    has_animation = "useFrame" in code
    has_emissive = EMISSIVE_ATTR in code
    has_flat_shading = "flatShading" in code
    has_standard_material = "meshStandardMaterial" in code
    has_toon_material = "meshToonMaterial" in code
    color_count = len(set(re.findall(r'color="(#[0-9a-fA-F]{6})"', code)))

    return {
        "meshCount": mesh_count,
        "hasAnimation": has_animation,
        "hasEmissive": has_emissive,
        "hasFlatShading": has_flat_shading,
        "usesStandardMaterial": has_standard_material,
        "usesToonMaterial": has_toon_material,
        "colorCount": color_count,
        "passesMinimum": (
            mesh_count >= 5
            and has_animation
            and has_emissive
            and has_flat_shading
            and has_standard_material
            and not has_toon_material
        ),
    }
