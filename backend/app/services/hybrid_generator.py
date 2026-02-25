"""Hybrid Generator — Combine AI creativity with template quality."""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Component library patterns from showcase props
QUALITY_COMPONENTS = {
    "glow_orb": {
        "pattern": r"<sphere",
        "replacement": """
      <mesh position={[0, {y}, 0]}>
        <sphereGeometry args={[{radius}, 16, 16]} />
        <meshStandardMaterial
          color="{color}" emissive="{color}"
          emissiveIntensity={{{intensity}}}
          transparent opacity={{0.85}} toneMapped={{false}}
        />
      </mesh>""",
        "defaults": {"y": "0.5", "radius": "0.15", "color": "#00ffcc", "intensity": "2"},
    },
    "led_indicator": {
        "pattern": r"indicator|led|light",
        "code": """
      <mesh position={[{x}, {y}, {z}]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial
          color="{color}" emissive="{color}"
          emissiveIntensity={{1.5}} toneMapped={{false}}
        />
      </mesh>""",
        "defaults": {"x": "0", "y": "0.3", "z": "0.1", "color": "#00ff88"},
    },
    "toon_base": {
        "imports": "import { useToonMaterialProps } from '../../utils/toonMaterials'",
        "hook": "const baseToon = useToonMaterialProps('{color}')",
        "material": "<meshToonMaterial {...baseToon} />",
        "defaults": {"color": "#1a1a2e"},
    },
    "floating_animation": {
        "imports": "import { useRef } from 'react'\nimport { useFrame } from '@react-three/fiber'",
        "hook_code": """
  const floatRef = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (floatRef.current) {
      floatRef.current.position.y = {baseY} + Math.sin(t * {speed}) * {amplitude}
      floatRef.current.rotation.y = t * {rotSpeed}
    }
  })""",
        "defaults": {"baseY": "0.5", "speed": "1.5", "amplitude": "0.05", "rotSpeed": "0.3"},
    },
    "point_light": {
        "code": '<pointLight position={{[0, {y}, 0]}} color="{color}" intensity={{{intensity}}} distance={{4}} decay={{2}} />',
        "defaults": {"y": "1.0", "color": "#00ffcc", "intensity": "1.5"},
    },
}

# Template bases from showcase props
TEMPLATE_BASES = {
    "coffee-machine": "CoffeeMachine",
    "spaceship": "Spaceship",
    "desk": "Desk",
    "lamp": "Lamp",
    "monitor": "Monitor",
    "plant": "Plant",
    "water-cooler": "WaterCooler",
    "chair": "Chair",
    "notice-board": "NoticeBoard",
    "bench": "Bench",
}


def build_hybrid_prompt(
    description: str,
    component_name: str,
    template_code: Optional[str] = None,
    template_name: Optional[str] = None,
) -> str:
    """Build the AI prompt for hybrid generation."""

    if template_code:
        return f"""You are creating a new React Three Fiber prop by modifying an existing template.

## Template Code (starting point)
```tsx
{template_code}
```

## New Concept
Create: "{description}"
Component name: `{component_name}`

## Instructions
1. Use the template as your structural starting point
2. Modify geometry, colors, and details to match the new concept
3. Keep the quality patterns: useToonMaterialProps, emissive accents, proper structure
4. Keep animations if they make sense for the new concept
5. Rename the component to `{component_name}`
6. Update the Props interface
7. Add concept-specific details (LEDs, textures, small touches)
8. Include PARTS_DATA block at the end

Output the complete modified component:"""
    else:
        return f"""You are creating a high-quality React Three Fiber prop component.

## Concept
Create: "{description}"
Component name: `{component_name}`

## MANDATORY Quality Requirements (showcase-grade)
1. Use `useToonMaterialProps` for solid surfaces (import from '../../utils/toonMaterials')
2. Use `meshStandardMaterial` with emissive for glowing parts (toneMapped={{false}})
3. Include AT LEAST 6-8 mesh elements for visual depth
4. Use at least 3 different geometry types
5. Add `castShadow` to main meshes
6. Add a `pointLight` for ambient glow
7. Add `useFrame` animation (floating, rotation, or pulsing)
8. Add small detail meshes (LEDs, indicators, decorative elements)
9. Use `transparent` and `opacity` for glass/energy effects
10. Define proper TypeScript Props interface with position and scale

## Component Structure
```tsx
import {{ useRef }} from 'react'
import {{ useFrame }} from '@react-three/fiber'
import {{ useToonMaterialProps }} from '../../utils/toonMaterials'
import * as THREE from 'three'

interface {component_name}Props {{
  position?: [number, number, number]
  scale?: number
}}

export function {component_name}({{ position = [0, 0, 0], scale = 1 }}: {component_name}Props) {{
  // useToonMaterialProps hooks
  // useRef for animated parts
  // useFrame for animation

  return (
    <group position={{position}} scale={{scale}}>
      {{/* Multiple mesh layers with varied geometry */}}
      {{/* Emissive accents */}}
      {{/* Detail elements */}}
      {{/* Point light */}}
    </group>
  )
}}
```

Include PARTS_DATA block at the end.

Output the complete component:"""


class HybridGenerator:
    """Combine AI creativity with template quality."""

    async def generate_hybrid(
        self,
        description: str,
        component_name: str,
        template_base: Optional[str] = None,
    ) -> str:
        """Generate a prop using hybrid approach."""

        template_code = None
        if template_base and template_base in TEMPLATE_BASES:
            template_code = await self._load_template(template_base)

        prompt = build_hybrid_prompt(
            description=description,
            component_name=component_name,
            template_code=template_code,
            template_name=template_base,
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
            raise ValueError("Hybrid generation produced invalid component")

        return raw

    async def _load_template(self, template_id: str) -> Optional[str]:
        """Load a showcase prop as template."""
        comp_name = TEMPLATE_BASES.get(template_id)
        if not comp_name:
            return None

        props_dir = Path(__file__).parent.parent.parent.parent / "frontend" / "src" / "components" / "world3d" / "props"
        filepath = props_dir / f"{comp_name}.tsx"

        if filepath.exists():
            return filepath.read_text()

        return None

    def get_templates(self) -> list[dict]:
        """Return available template bases."""
        return [{"id": tid, "name": name} for tid, name in TEMPLATE_BASES.items()]
