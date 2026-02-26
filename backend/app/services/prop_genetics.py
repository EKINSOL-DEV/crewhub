"""Prop Genetics — Crossbreed traits from multiple props."""

from __future__ import annotations

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)


def _resolve_trait_instruction(trait: str, parent_a_name: str, parent_b_name: str) -> Optional[str]:
    """Convert a single crossbreed trait string to a specific instruction line."""
    t = trait.lower()
    source = parent_a_name if "a" in t else parent_b_name
    if "color" in t or "palette" in t:
        return f"- Take COLOR PALETTE from {source}"
    if "animation" in t or "movement" in t:
        return f"- Take ANIMATIONS from {source}"
    if "structure" in t or "shape" in t:
        return f"- Take STRUCTURE/SHAPE from {source}"
    if "material" in t:
        return f"- Take MATERIALS from {source}"
    if "detail" in t:
        return f"- Take DETAILS from {source}"
    return None


def build_crossbreed_prompt(
    parent_a_code: str,
    parent_b_code: str,
    parent_a_name: str,
    parent_b_name: str,
    component_name: str,
    traits: list[str],
) -> str:
    """Build AI prompt for genetic crossbreeding."""
    trait_instructions = [
        inst
        for trait in traits
        for inst in [_resolve_trait_instruction(trait, parent_a_name, parent_b_name)]
        if inst is not None
    ]

    if not trait_instructions:
        trait_instructions = [
            f"- Take STRUCTURE from {parent_a_name}",
            f"- Take COLOR PALETTE & EFFECTS from {parent_b_name}",
            "- Combine animations from both",
            "- Merge detail elements creatively",
        ]

    traits_text = "\n".join(trait_instructions)

    return f"""You are creating a HYBRID prop by combining traits from two parent props.

## Parent A: {parent_a_name}
```tsx
{parent_a_code}
```

## Parent B: {parent_b_name}
```tsx
{parent_b_code}
```

## Crossbreeding Instructions
{traits_text}

## New Component Name: `{component_name}`

## Rules
1. Create a coherent visual combination — not just random mixing
2. The result should look intentional and interesting
3. Keep useToonMaterialProps for solid surfaces
4. Keep meshStandardMaterial with emissive for glow effects
5. Maintain proper TypeScript Props interface
6. Include useFrame animations if either parent has them
7. The offspring should be recognizably influenced by BOTH parents
8. Include PARTS_DATA block at the end
9. At least 6 mesh elements for quality

Think creatively! If combining a Coffee Machine + AI Brain, imagine a coffee machine
with brain-like pulsing glow, neural pathway patterns in the steam, etc.

Output the complete hybrid component:"""


class PropGenetics:
    """Combine traits from multiple props."""

    async def crossbreed(
        self,
        parent_a_code: str,
        parent_b_code: str,
        parent_a_name: str,
        parent_b_name: str,
        component_name: str,
        traits: Optional[list[str]] = None,
    ) -> str:
        """Combine features from two props via AI."""
        prompt = build_crossbreed_prompt(
            parent_a_code=parent_a_code,
            parent_b_code=parent_b_code,
            parent_a_name=parent_a_name,
            parent_b_name=parent_b_name,
            component_name=component_name,
            traits=traits or [],
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
            raise ValueError("Crossbreeding produced invalid component")

        return raw
