"""Style Transfer — Apply showcase prop styles to generated props."""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

# Showcase prop style profiles extracted from analysis
SHOWCASE_STYLES = {
    "coffee-machine": {
        "name": "Coffee Machine",
        "palette": ["#8B4513", "#DAA520", "#2F1810", "#D2691E", "#FF6B35"],
        "material_mix": "heavy toon + emissive indicators",
        "detail_density": "high",
        "animation_style": "subtle steam, indicator blinks",
        "composition": "layered mechanical parts, buttons, gauges",
        "prompt_modifier": (
            "Use warm brown/copper/gold palette. Add small LED indicators with emissive materials. "
            "Include mechanical details like buttons, gauges, vents. Use cylindrical and box geometry. "
            "Add subtle steam or heat effects with transparent materials."
        ),
    },
    "spaceship": {
        "name": "Spaceship",
        "palette": ["#333344", "#4466CC", "#00FFCC", "#FF4444", "#AABBCC"],
        "material_mix": "toon hull + bright emissive accents",
        "detail_density": "high",
        "animation_style": "engine glow pulse, hovering",
        "composition": "streamlined body with wing details and engine parts",
        "prompt_modifier": (
            "Use sleek metallic grey/blue palette with bright cyan/red accent lights. "
            "Add emissive engine parts with pulsing glow (toneMapped={false}). "
            "Use cone and cylinder geometry for aerodynamic shapes. Add useFrame for hovering animation."
        ),
    },
    "desk": {
        "name": "Desk",
        "palette": ["#5C4033", "#8B6914", "#A0724A", "#3C2415", "#888888"],
        "material_mix": "mostly toon, wood tones",
        "detail_density": "medium",
        "animation_style": "none — static furniture",
        "composition": "flat surfaces with supporting legs and drawer details",
        "prompt_modifier": (
            "Use natural wood brown palette. Keep it solid and grounded. "
            "Add small detail elements like drawer handles or surface items. "
            "Use box geometry primarily. No animation needed for furniture."
        ),
    },
    "lamp": {
        "name": "Lamp",
        "palette": ["#FFDD44", "#777777", "#EEEEEE", "#FFB347", "#333333"],
        "material_mix": "toon base + bright emissive bulb",
        "detail_density": "medium",
        "animation_style": "gentle glow pulse",
        "composition": "base + stem + light source",
        "prompt_modifier": (
            "Use a warm yellow/gold glow for the light source with emissive material. "
            "Add a pointLight near the light source. Use toneMapped={false} for bloom. "
            "Add subtle pulse animation with useFrame and Math.sin for emissiveIntensity."
        ),
    },
    "monitor": {
        "name": "Monitor",
        "palette": ["#1a1a2e", "#16213e", "#00FFCC", "#e94560", "#333333"],
        "material_mix": "dark toon body + emissive screen",
        "detail_density": "medium",
        "animation_style": "screen flicker or glow",
        "composition": "flat screen with stand and indicator lights",
        "prompt_modifier": (
            "Use dark body colors with bright screen using emissive material. "
            "Add small indicator LEDs on the bezel. Use box geometry for the screen panel. "
            "Add a subtle screen glow with pointLight."
        ),
    },
    "plant": {
        "name": "Plant",
        "palette": ["#228B22", "#2E8B57", "#8B4513", "#90EE90", "#654321"],
        "material_mix": "toon greens + brown pot",
        "detail_density": "medium",
        "animation_style": "gentle sway",
        "composition": "pot base + stem + leaf clusters",
        "prompt_modifier": (
            "Use various green shades for foliage with brown for pot/stem. "
            "Use sphere geometry for leaf clusters, cylinder for stem and pot. "
            "Add gentle swaying animation with useFrame and Math.sin on rotation."
        ),
    },
    "water-cooler": {
        "name": "Water Cooler",
        "palette": ["#CCCCCC", "#4488CC", "#EEEEEE", "#333333", "#88CCFF"],
        "material_mix": "toon body + transparent water",
        "detail_density": "high",
        "animation_style": "water bubble effect",
        "composition": "tall body with water tank, tap, cup holder",
        "prompt_modifier": (
            "Use clean grey/white/blue palette. Add transparent material for water tank. "
            "Include small detail elements like buttons, drip tray, cup holder. "
            "Add subtle bubble animation in the water area."
        ),
    },
    "chair": {
        "name": "Chair",
        "palette": ["#6688AA", "#555555", "#444444", "#778899", "#333333"],
        "material_mix": "toon materials, muted tones",
        "detail_density": "low-medium",
        "animation_style": "none — static",
        "composition": "seat + backrest + legs",
        "prompt_modifier": (
            "Use muted blue-grey palette. Focus on clean geometry with box shapes. "
            "Add subtle material variation between seat and frame. Keep it simple and solid."
        ),
    },
    "notice-board": {
        "name": "Notice Board",
        "palette": ["#8B6914", "#FFFFF0", "#FF6B6B", "#4ECDC4", "#FFE66D"],
        "material_mix": "toon board + colorful note accents",
        "detail_density": "high",
        "animation_style": "none or subtle pin glow",
        "composition": "flat board with multiple small note/pin elements",
        "prompt_modifier": (
            "Use a cork/wood colored base with colorful small elements attached. "
            "Add multiple small box meshes as notes/cards in bright colors. "
            "Add small sphere meshes as pins with emissive glow."
        ),
    },
    "bench": {
        "name": "Bench",
        "palette": ["#8B6914", "#A0724A", "#555555", "#3C2415", "#777777"],
        "material_mix": "toon wood + metal",
        "detail_density": "low",
        "animation_style": "none — static",
        "composition": "seat planks + supporting structure",
        "prompt_modifier": (
            "Use natural wood tones with metal grey accents. "
            "Keep geometry simple with box shapes for planks. Add minimal details."
        ),
    },
}


def get_available_styles() -> list[dict]:
    """Return list of available style sources."""
    return [{"id": sid, "name": s["name"], "palette": s["palette"]} for sid, s in SHOWCASE_STYLES.items()]


def build_style_transfer_prompt(
    generated_code: str,
    style_source: str,
    component_name: str,
) -> str:
    """Build prompt for style transfer."""
    style = SHOWCASE_STYLES.get(style_source)
    if not style:
        raise ValueError(f"Unknown style source: {style_source}")

    return f"""You are applying a visual style to an existing React Three Fiber prop component.

## Current Code
```tsx
{generated_code}
```

## Target Style: {style["name"]}
- **Color Palette:** {", ".join(style["palette"])}
- **Material Approach:** {style["material_mix"]}
- **Detail Level:** {style["detail_density"]}
- **Animation:** {style["animation_style"]}
- **Composition Notes:** {style["composition"]}

## Style Application Guide
{style["prompt_modifier"]}

## Rules
1. Keep the same concept/shape — only change the STYLE
2. Replace colors with the target palette
3. Adjust material choices to match the style
4. Add/modify animations to match the style's animation approach
5. Adjust detail density to match
6. Keep the same component name: `{component_name}`
7. Keep proper imports and Props interface
8. Output ONLY the complete updated component code
9. Include PARTS_DATA block at the end

Output the styled component:"""


class StyleTransfer:
    """Apply showcase prop styles to generated props."""

    def __init__(self):
        self.styles = SHOWCASE_STYLES

    def get_styles(self) -> list[dict]:
        return get_available_styles()

    async def apply_style(
        self,
        generated_code: str,
        style_source: str,
        component_name: str,
    ) -> str:
        """Apply showcase style to generated prop via AI."""
        prompt = build_style_transfer_prompt(
            generated_code=generated_code,
            style_source=style_source,
            component_name=component_name,
        )

        from .connections import OpenClawConnection, get_connection_manager

        manager = await get_connection_manager()
        conn = None
        for c in manager.get_connections().values():
            if isinstance(c, OpenClawConnection) and c.is_connected():
                conn = c
                break

        if not conn:
            raise RuntimeError("No connected OpenClaw connection")

        raw = await conn.send_chat(
            message=prompt,
            agent_id="dev",
            timeout=120.0,
        )

        if not raw:
            raise RuntimeError("AI returned empty response")

        raw = raw.strip()
        raw = re.sub(r"^```\w*\n", "", raw)
        raw = re.sub(r"\n```\s*$", "", raw)

        if "export function" not in raw:
            raise ValueError("Style transfer produced invalid component")

        return raw
