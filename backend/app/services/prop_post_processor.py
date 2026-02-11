"""Post-processor for AI-generated prop code.

Ensures quality standards: meshStandardMaterial, flatShading, animation, emissive.
Runs in < 100ms on typical prop code.
"""

from __future__ import annotations

import re
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class PostProcessResult:
    code: str
    corrections: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    quality_score: int = 0  # 0-100


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

    # 1. Replace meshToonMaterial with meshStandardMaterial + flatShading
    toon_count = len(re.findall(r'meshToonMaterial', enhanced))
    if toon_count > 0:
        # Remove toonMaterials import
        enhanced = re.sub(
            r"import\s*\{[^}]*useToonMaterialProps[^}]*\}\s*from\s*['\"][^'\"]*toonMaterials['\"].*?\n",
            '',
            enhanced
        )
        result.corrections.append(f"Removed toonMaterials import")

        # Remove useToonMaterialProps hook calls and collect color mappings
        color_map: dict[str, str] = {}
        for m in re.finditer(r'const\s+(\w+)\s*=\s*useToonMaterialProps\([\'"]([^"\']+)[\'"]\)', enhanced):
            var_name, color = m.group(1), m.group(2)
            color_map[var_name] = color
        
        # Remove the hook lines
        enhanced = re.sub(r'\s*const\s+\w+\s*=\s*useToonMaterialProps\([^)]+\).*?\n', '\n', enhanced)

        # Replace <meshToonMaterial {...varName} /> with <meshStandardMaterial color="X" flatShading />
        for var_name, color in color_map.items():
            pattern = rf'<meshToonMaterial\s+\{{\.\.\.{var_name}\}}\s*/>'
            replacement = f'<meshStandardMaterial color="{color}" flatShading />'
            enhanced = re.sub(pattern, replacement, enhanced)

        # Replace any remaining meshToonMaterial tags (with inline props)
        enhanced = re.sub(
            r'<meshToonMaterial\s+([^/]*?)\s*/>',
            r'<meshStandardMaterial \1 flatShading />',
            enhanced
        )

        result.corrections.append(f"Replaced {toon_count} meshToonMaterial → meshStandardMaterial + flatShading")

    # 2. Add flatShading to meshStandardMaterial where missing (but not on emissive/transparent)
    def _add_flat_shading(match: re.Match) -> str:
        tag = match.group(0)
        # Skip if already has flatShading, or if it's emissive/transparent
        if 'flatShading' in tag or 'emissive=' in tag or 'transparent' in tag or 'opacity=' in tag or 'wireframe' in tag or 'metalness=' in tag:
            return tag
        # Add flatShading before the closing />
        return tag.replace('/>', 'flatShading />')

    before = enhanced
    enhanced = re.sub(r'<meshStandardMaterial\s+[^>]*?/>', _add_flat_shading, enhanced)
    if enhanced != before:
        result.corrections.append("Added flatShading to meshStandardMaterial where missing")

    # 3. Ensure useFrame import and animation
    has_use_frame_call = bool(re.search(r'useFrame\s*\(', enhanced))
    if not has_use_frame_call:
        # Add useFrame import
        fiber_import = re.search(r"import\s*\{([^}]*)\}\s*from\s*['\"]@react-three/fiber['\"]", enhanced)
        if fiber_import:
            if 'useFrame' not in fiber_import.group(1):
                enhanced = enhanced.replace(
                    fiber_import.group(0),
                    f"import {{ {fiber_import.group(1).strip()}, useFrame }} from '@react-three/fiber'"
                )
        else:
            # No fiber import at all — add one after last import line
            last_import = None
            for m in re.finditer(r'^import\s+.*$', enhanced, re.MULTILINE):
                last_import = m
            if last_import:
                pos = last_import.end()
                enhanced = enhanced[:pos] + "\nimport { useFrame } from '@react-three/fiber';" + enhanced[pos:]
            else:
                enhanced = "import { useFrame } from '@react-three/fiber';\n" + enhanced

        # Add animation code — inject after groupRef declaration or before return
        ref_match = re.search(r'(const\s+groupRef\s*=\s*useRef[^;]*;)', enhanced)
        if ref_match:
            inject_after = ref_match.end()
            animation_code = """

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
    }
  });"""
            enhanced = enhanced[:inject_after] + animation_code + enhanced[inject_after:]
            result.corrections.append("Added gentle sway animation (useFrame)")
        else:
            # No groupRef — try to inject before return with a new ref
            return_match = re.search(r'(\n\s*return\s*\()', enhanced)
            if return_match:
                inject_pos = return_match.start()
                animation_code = """\n  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
    }
  });
"""
                enhanced = enhanced[:inject_pos] + animation_code + enhanced[inject_pos:]
                result.corrections.append("Added groupRef and gentle sway animation")
            else:
                result.warnings.append("Could not inject animation — no return statement found")

    # 4. Ensure useRef import
    if 'useRef' in enhanced and "import" in enhanced:
        if not re.search(r"import\s*\{[^}]*useRef[^}]*\}\s*from\s*['\"]react['\"]", enhanced):
            # Add useRef to react import
            react_import = re.search(r"import\s*\{([^}]*)\}\s*from\s*['\"]react['\"]", enhanced)
            if react_import:
                imports = react_import.group(1).strip()
                if 'useRef' not in imports:
                    enhanced = enhanced.replace(
                        react_import.group(0),
                        f"import {{ {imports}, useRef }} from 'react'"
                    )
                    result.corrections.append("Added useRef to react imports")
            elif "from 'react'" not in enhanced and 'from "react"' not in enhanced:
                enhanced = f"import {{ useRef }} from 'react';\n{enhanced}"
                result.corrections.append("Added useRef import")

    # 5. Ensure THREE import if useRef<THREE.Group> is used
    if 'THREE.Group' in enhanced and "import * as THREE" not in enhanced:
        enhanced = f"import * as THREE from 'three';\n{enhanced}"
        result.corrections.append("Added THREE import")

    # 6. Check for emissive elements
    has_emissive = 'emissive=' in enhanced or 'emissiveIntensity' in enhanced
    if not has_emissive:
        result.warnings.append("No emissive elements — prop may look flat. Consider regenerating.")

    # 7. Count meshes for quality score
    mesh_count = len(re.findall(r'<mesh\b', enhanced))
    has_animation = 'useFrame' in enhanced
    has_multiple_colors = len(set(re.findall(r'color="(#[0-9a-fA-F]{6})"', enhanced))) >= 3
    has_flat_shading = 'flatShading' in enhanced

    # Quality score
    score = 0
    score += min(30, mesh_count * 3)  # Up to 30 for mesh count (10+ meshes = max)
    score += 20 if has_animation else 0
    score += 15 if has_emissive else 0
    score += 15 if has_multiple_colors else 0
    score += 10 if has_flat_shading else 0
    score += 10 if mesh_count >= 8 else 0
    result.quality_score = min(100, score)

    if mesh_count < 5:
        result.warnings.append(f"Only {mesh_count} meshes — prop may lack detail")

    # 8. Clean up any double-blank lines
    enhanced = re.sub(r'\n{3,}', '\n\n', enhanced)

    result.code = enhanced
    return result


def validate_prop_quality(code: str) -> dict:
    """Quick validation check for prop quality metrics."""
    mesh_count = len(re.findall(r'<mesh\b', code))
    has_animation = 'useFrame' in code
    has_emissive = 'emissive=' in code
    has_flat_shading = 'flatShading' in code
    has_standard_material = 'meshStandardMaterial' in code
    has_toon_material = 'meshToonMaterial' in code
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
