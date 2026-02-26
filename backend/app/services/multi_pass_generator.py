"""Multi-pass prop generation system for consistent quality.

Phase 2 of PropMaker Quality Improvements.
Generates base → adds detail components → applies polish → validates.
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

# ── Component Templates ──────────────────────────────────────────

COMPONENT_IMPORTS = {
    "LED": "import { LED } from '../props/components/LED'",
    "SteamParticles": "import { SteamParticles } from '../props/components/SteamParticles'",
    "GlowOrb": "import { GlowOrb } from '../props/components/GlowOrb'",
    "Cable": "import { Cable } from '../props/components/Cable'",
    "DataStream": "import { DataStream } from '../props/components/DataStream'",
    "Screen": "import { Screen } from '../props/components/Screen'",
    "RotatingPart": "import { RotatingPart } from '../props/components/RotatingPart'",
}

# JSX snippets for component injection (inserted before closing </group>)
COMPONENT_JSX = {
    "LED": '      <LED color="{color}" position={{[{pos}]}} pulse />',
    "SteamParticles": "      <SteamParticles position={{[{pos}]}} count={{8}} spread={{0.1}} />",
    "GlowOrb": '      <GlowOrb color="{color}" position={{[{pos}]}} size={{0.15}} />',
    "Screen": '      <Screen position={{[{pos}]}} color="{color}" width={{0.3}} height={{0.2}} />',
    "DataStream": '      <DataStream position={{[{pos}]}} color="{color}" count={{8}} radius={{0.3}} />',
}

# ── Keyword → Component Mapping ─────────────────────────────────

KEYWORD_COMPONENTS: list[tuple[list[str], str, str, str]] = [
    # (keywords, component, default_color, default_position)
    (["coffee", "tea", "hot", "steam", "kettle", "pot", "cook", "boil"], "SteamParticles", "#ffffff", "0, 0.8, 0"),
    (["computer", "screen", "monitor", "tv", "display", "terminal", "laptop"], "Screen", "#00ff88", "0, 0.6, 0.2"),
    (
        ["electronic", "server", "machine", "device", "panel", "control", "dashboard"],
        "LED",
        "#00ff00",
        "0.1, 0.5, 0.15",
    ),
    (["magic", "crystal", "orb", "energy", "power", "portal", "mystical"], "GlowOrb", "#aa44ff", "0, 0.8, 0"),
    (["data", "ai", "brain", "neural", "network", "digital", "cyber", "holo"], "DataStream", "#00ffff", "0, 0.5, 0"),
    (["robot", "mech", "android", "tech", "futuristic", "sci-fi", "space"], "LED", "#00aaff", "-0.1, 0.6, 0.1"),
    (["neon", "sign", "glow", "light", "lamp", "beacon"], "GlowOrb", "#ff4488", "0, 0.7, 0"),
    (["arcade", "gaming", "retro", "pixel", "console"], "Screen", "#ff4444", "0, 0.8, 0.05"),
]

# ── Animation Patterns ───────────────────────────────────────────

ROTATION_SNIPPET = """
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15
    }
  })
"""

FLOAT_SNIPPET = """
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.008
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.05
    }
  })
"""

# ── Code Injection Helpers ──────────────────────────────────────


def _insert_code_after_last_import(code: str, new_block: str) -> str:
    """Insert a block of code after the last import line."""
    lines = code.split("\n")
    last_import_idx = 0
    for i, line in enumerate(lines):
        if line.strip().startswith("import "):
            last_import_idx = i
    lines.insert(last_import_idx + 1, new_block)
    return "\n".join(lines)


def _insert_jsx_before_last_group(code: str, jsx_block: str) -> str:
    """Insert JSX snippet before the last </group> tag in the code."""
    last_group = code.rfind("</group>")
    if last_group != -1:
        return code[:last_group] + jsx_block + "\n    " + code[last_group:]
    return code


def _add_single_component(code: str, comp_name: str) -> tuple[str, bool]:
    """Add a single component import and JSX to the code. Returns (updated_code, was_added)."""
    if comp_name not in COMPONENT_IMPORTS or comp_name not in COMPONENT_JSX:
        return code, False

    color = "#00ffcc"
    pos = "0, 0.5, 0"
    for _, c, cl, p in KEYWORD_COMPONENTS:
        if c == comp_name:
            color = cl
            pos = p
            break

    imp = COMPONENT_IMPORTS[comp_name]
    if imp not in code:
        code = _insert_code_after_last_import(code, imp)

    jsx = COMPONENT_JSX[comp_name].format(color=color, pos=pos)
    last_group = code.rfind("</group>")
    if last_group != -1:
        code = code[:last_group] + f"\n      {{/* User-added {comp_name} */}}\n{jsx}\n    " + code[last_group:]
        return code, True
    return code, False


# ── Main Generator Class ────────────────────────────────────────


class MultiPassGenerator:
    """Multi-pass prop generation for consistent showcase quality."""

    def generate_prop(
        self,
        description: str,
        base_code: str,
        _ai_generate_fn=None,
    ) -> tuple[str, list[str]]:
        """
        Run multi-pass enhancement on generated prop code.

        Args:
            description: User's prop description
            base_code: The AI-generated or template base code
            ai_generate_fn: Optional async function for AI regeneration

        Returns:
            (enhanced_code, diagnostics)
        """
        diagnostics: list[str] = []

        # Pass 1: Base is already provided (from AI or template)
        code = base_code
        diagnostics.append("Pass 1: Base code received")

        # Pass 2: Add detail components based on keywords
        code, added = self._add_details(code, description)
        if added:
            diagnostics.append(f"Pass 2: Added components: {', '.join(added)}")
        else:
            diagnostics.append("Pass 2: No keyword-matched components to add")

        # Pass 3: Apply polish (ensure animation, emissive, colors)
        code, polish_notes = self._apply_polish(code)
        diagnostics.extend(polish_notes)

        # Pass 4: Validate structure
        code, validation_notes = self._validate(code)
        diagnostics.extend(validation_notes)

        return code, diagnostics

    def _add_details(self, code: str, desc: str) -> tuple[str, list[str]]:
        """Add component library parts based on description keywords."""
        lower = desc.lower()
        added: list[str] = []
        imports_to_add: list[str] = []
        jsx_to_add: list[str] = []

        for keywords, component, color, pos in KEYWORD_COMPONENTS:
            if any(kw in lower for kw in keywords) and component not in added:
                added.append(component)
                imports_to_add.append(COMPONENT_IMPORTS[component])
                if component in COMPONENT_JSX:
                    jsx_to_add.append(COMPONENT_JSX[component].format(color=color, pos=pos))
            if len(added) >= 3:
                break

        if not added:
            return code, added

        code = _insert_code_after_last_import(code, "\n".join(imports_to_add))
        if jsx_to_add:
            jsx_block = "\n\n      {/* Auto-added detail components */}\n" + "\n".join(jsx_to_add)
            code = _insert_jsx_before_last_group(code, jsx_block)

        return code, added

    def _apply_polish(self, code: str) -> tuple[str, list[str]]:
        """Ensure prop has animation and emissive elements."""
        notes: list[str] = []

        # Check for useFrame (animation)
        has_animation = "useFrame" in code
        if not has_animation:
            notes.append("Pass 3: No animation found — consider adding useFrame")

        # Check for emissive
        has_emissive = "emissive" in code.lower() or "emissiveIntensity" in code
        if not has_emissive:
            notes.append("Pass 3: No emissive elements — prop may look flat")

        # Ensure flatShading on meshStandardMaterial without it
        # (only for non-emissive, non-transparent materials)
        flat_count = 0
        pattern = r'<meshStandardMaterial\s+color="([^"]+)"\s*/>'

        def add_flat(m):
            nonlocal flat_count
            flat_count += 1
            return f'<meshStandardMaterial color="{m.group(1)}" flatShading />'

        code = re.sub(pattern, add_flat, code)
        if flat_count:
            notes.append(f"Pass 3: Added flatShading to {flat_count} material(s)")

        if not notes:
            notes.append("Pass 3: Polish check passed — animation and emissive present")

        return code, notes

    def _validate(self, code: str) -> tuple[str, list[str]]:
        """Validate prop structure and report issues."""
        notes: list[str] = []

        # Count meshes
        mesh_count = len(re.findall(r"<mesh[\s>]", code))
        if mesh_count < 3:
            notes.append(f"Pass 4: Warning — only {mesh_count} mesh(es), quality may be low")
        elif mesh_count >= 8:
            notes.append(f"Pass 4: ✅ Good complexity ({mesh_count} meshes)")
        else:
            notes.append(f"Pass 4: {mesh_count} meshes — acceptable")

        # Check for export
        if "export function" not in code and "export default" not in code:
            notes.append("Pass 4: Warning — no export found")

        # Check for proper imports
        if "useFrame" in code and "import" in code and "useFrame" not in code.split("return")[0].split("import")[0]:
            pass  # ok
        elif "useFrame" in code and "'@react-three/fiber'" not in code:
            notes.append("Pass 4: Warning — useFrame used but @react-three/fiber not imported")

        if not notes:
            notes.append("Pass 4: Validation passed")

        return code, notes

    def get_refinement_options(self, description: str) -> dict:
        """Return available refinement options for a prop based on its description."""
        lower = description.lower()

        # Determine which components are relevant
        available_components = []
        for keywords, component, color, _ in KEYWORD_COMPONENTS:
            if component not in [c["name"] for c in available_components]:
                relevant = any(kw in lower for kw in keywords)
                available_components.append(
                    {
                        "name": component,
                        "suggested": relevant,
                        "defaultColor": color,
                    }
                )

        # Deduplicate
        seen = set()
        unique = []
        for c in available_components:
            if c["name"] not in seen:
                seen.add(c["name"])
                unique.append(c)

        return {
            "components": unique,
            "materialPresets": [
                {"name": "solid", "label": "Solid", "props": {"flatShading": True}},
                {"name": "metallic", "label": "Metallic", "props": {"metalness": 0.6, "roughness": 0.3}},
                {"name": "glowing", "label": "Glowing", "props": {"emissive": True, "emissiveIntensity": 1.5}},
                {"name": "glass", "label": "Glass", "props": {"transparent": True, "opacity": 0.3}},
            ],
            "animationPresets": [
                {"name": "rotate", "label": "Rotate", "description": "Slow constant rotation"},
                {"name": "pulse", "label": "Pulse", "description": "Pulsing scale animation"},
                {"name": "bob", "label": "Bob", "description": "Gentle up-down floating"},
                {"name": "sway", "label": "Sway", "description": "Side-to-side swaying"},
            ],
            "suggestedColors": [
                "#cc3333",
                "#3366cc",
                "#33aa33",
                "#ccaa33",
                "#aa44ff",
                "#00ffcc",
                "#ff4488",
                "#ffaa33",
            ],
        }

    def apply_refinement(self, code: str, changes: dict) -> tuple[str, list[str]]:
        """
        Apply user refinements to prop code.

        changes can include:
        - addComponents: list of component names
        - colorChanges: dict of old_color -> new_color
        - animation: animation preset name
        - material: material preset name
        """
        diagnostics: list[str] = []

        for old_color, new_color in changes.get("colorChanges", {}).items():
            if old_color in code:
                code = code.replace(old_color, new_color)
                diagnostics.append(f"Changed color {old_color} → {new_color}")

        for comp_name in changes.get("addComponents", []):
            code, was_added = _add_single_component(code, comp_name)
            if was_added:
                diagnostics.append(f"Added {comp_name} component")

        if not diagnostics:
            diagnostics.append("No changes applied")

        return code, diagnostics
