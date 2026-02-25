"""Creator Zone — AI generation helper.

Wraps the OpenClaw connection lookup + AI call + post-processing
so the route layer stays thin.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

from .prop_generator import (
    load_prompt_template,
    parse_ai_parts,
    strip_parts_block,
)

logger = logging.getLogger(__name__)


async def generate_prop_via_ai(
    prompt: str,
    name: str,
    model: str,
) -> tuple[Optional[str], list[dict], str]:
    """Try to generate prop code via the OpenClaw AI connection.

    Returns ``(code_or_None, ai_parts, method)`` where *method* is ``"ai"`` on
    success or ``"template"`` when the AI call is skipped/fails.
    """
    template = load_prompt_template()
    if not template:
        return None, [], "template"

    full_prompt = (
        f"{template}\n\n"
        f"Generate a prop for: {prompt}\n"
        f"Component name: `{name}`. Output ONLY the code followed by the PARTS_DATA block."
    )

    try:
        from ..connections import OpenClawConnection, get_connection_manager  # type: ignore

        manager = await get_connection_manager()
        conn = None
        for c in manager.get_connections().values():
            if isinstance(c, OpenClawConnection) and c.is_connected():
                conn = c
                break

        if not conn:
            return None, [], "template"

        raw = await conn.send_chat(
            message=full_prompt,
            agent_id="dev",
            timeout=120.0,
        )
        if not raw:
            return None, [], "template"

        raw = raw.strip()
        raw = re.sub(r"^```\w*\n", "", raw)
        raw = re.sub(r"\n```\s*$", "", raw)

        ai_parts = parse_ai_parts(raw)
        code = strip_parts_block(raw)

        if "export function" in code and "<mesh" in code:
            from ..prop_post_processor import enhance_generated_prop  # type: ignore

            pp_result = enhance_generated_prop(code)
            return pp_result.code, ai_parts, "ai"

    except Exception as exc:
        logger.warning(f"AI generation error: {exc}")

    return None, [], "template"
