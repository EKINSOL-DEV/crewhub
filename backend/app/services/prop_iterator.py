"""Prop Iterator — Refine props with natural language feedback via AI."""

from __future__ import annotations

import logging
import re
from dataclasses import asdict, dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class IterationRecord:
    version: int
    feedback: str
    quality_score: int
    code: str
    timestamp: str = ""


@dataclass
class IterationHistory:
    prop_id: str
    iterations: list[IterationRecord] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


# Feedback type detection
FEEDBACK_PATTERNS = {
    "color": [
        r"more colorful",
        r"less colorful",
        r"use (\w+) instead of (\w+)",
        r"make it (\w+)",
        r"change color",
        r"brighter",
        r"darker",
        r"neon",
        r"pastel",
        r"warm",
        r"cool colors",
        r"monochrome",
    ],
    "size": [
        r"taller",
        r"shorter",
        r"bigger",
        r"smaller",
        r"wider",
        r"thinner",
        r"scale (up|down)",
        r"enlarge",
        r"shrink",
        r"compact",
    ],
    "detail": [
        r"add (\w+) lights?",
        r"add steam",
        r"add particles",
        r"add glow",
        r"add led",
        r"more detail",
        r"add texture",
        r"add pattern",
        r"add indicator",
        r"add button",
        r"add screen",
    ],
    "animation": [
        r"spin faster",
        r"spin slower",
        r"stop spinning",
        r"add pulsing",
        r"floating",
        r"bobbing",
        r"make it move",
        r"animate",
        r"add rotation",
        r"oscillat",
        r"wave",
    ],
    "style": [
        r"more futuristic",
        r"more rustic",
        r"simpler",
        r"more complex",
        r"steampunk",
        r"cyberpunk",
        r"organic",
        r"mechanical",
        r"retro",
        r"modern",
        r"minimal",
        r"ornate",
    ],
}


def detect_feedback_type(feedback: str) -> str:
    """Detect what kind of feedback this is."""
    lower = feedback.lower()
    for ftype, patterns in FEEDBACK_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, lower):
                return ftype
    return "general"


def build_iteration_prompt(
    original_code: str,
    feedback: str,
    component_name: str,
    feedback_type: str,
) -> str:
    """Build the AI prompt for iterating on a prop."""

    type_guidance = {
        "color": (
            "Focus on color changes. Modify color values in useToonMaterialProps() calls, "
            "meshStandardMaterial color/emissive props. Preserve structure and animations."
        ),
        "size": (
            "Focus on size/scale changes. Modify geometry args (width, height, radius), "
            "position values to adjust proportions. Keep colors and animations."
        ),
        "detail": (
            "Focus on adding detail elements. Add new <mesh> elements for LEDs, indicators, "
            "small decorative parts. Add emissive materials for lights. Keep existing structure."
        ),
        "animation": (
            "Focus on animation changes. Modify or add useFrame() hooks, adjust rotation speeds, "
            "add Math.sin oscillations, floating effects. Keep visual design."
        ),
        "style": (
            "Focus on style transformation. Adjust material types, color palettes, geometry choices "
            "to match the requested style. May restructure parts but keep the same concept."
        ),
        "general": (
            "Apply the feedback while preserving the overall structure. Make targeted changes "
            "based on what the user wants."
        ),
    }

    return f"""You are refining an existing React Three Fiber prop component.

## Current Code
```tsx
{original_code}
```

## User Feedback
"{feedback}"

## Feedback Type: {feedback_type}
{type_guidance.get(feedback_type, type_guidance["general"])}

## Rules
1. Output ONLY the complete updated component code
2. Keep the same component name: `{component_name}`
3. Keep the same Props interface pattern
4. Keep `useToonMaterialProps` for toon materials
5. Keep `meshStandardMaterial` for emissive/glow effects
6. Preserve the import statements
7. Make TARGETED changes based on the feedback — don't rewrite everything
8. The component must be a valid React Three Fiber component
9. Include the PARTS_DATA block at the end

Output the complete updated code:"""


class PropIterator:
    """Iterate on props using natural language feedback."""

    async def iterate_prop(
        self,
        original_code: str,
        feedback: str,
        component_name: str,
        context: Optional[dict] = None,
    ) -> tuple[str, str]:
        """
        Apply user feedback to improve a prop.

        Returns (improved_code, feedback_type).
        Uses AI via OpenClaw connection.
        """
        feedback_type = detect_feedback_type(feedback)
        prompt = build_iteration_prompt(
            original_code=original_code,
            feedback=feedback,
            component_name=component_name,
            feedback_type=feedback_type,
        )

        # Send to AI via OpenClaw
        from .connections import OpenClawConnection, get_connection_manager

        manager = await get_connection_manager()
        conn = None
        for c in manager.get_connections().values():
            if isinstance(c, OpenClawConnection) and c.is_connected():
                conn = c
                break

        if not conn:
            raise RuntimeError("No connected OpenClaw connection for AI iteration")

        raw = await conn.send_chat(
            message=prompt,
            agent_id="dev",
            timeout=120.0,
        )

        if not raw:
            raise RuntimeError("AI returned empty response")

        # Clean up response
        raw = raw.strip()
        raw = re.sub(r"^```\w*\n", "", raw)
        raw = re.sub(r"\n```\s*$", "", raw)

        # Validate
        if "export function" not in raw:
            raise ValueError("AI response doesn't contain a valid component")

        return raw, feedback_type
