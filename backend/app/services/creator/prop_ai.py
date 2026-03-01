"""Creator Zone — AI generation helper.

Wraps the OpenClaw connection lookup + AI call + post-processing
so the route layer stays thin.  Falls back to Claude Code CLI when
no OpenClaw connection is available.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Optional

from .prop_generator import (
    load_prompt_template,
    parse_ai_parts,
    strip_parts_block,
)

logger = logging.getLogger(__name__)


def _get_process_manager():
    """Get the ClaudeProcessManager singleton."""
    from ..connections.claude_process_manager import ClaudeProcessManager

    if not hasattr(_get_process_manager, "_instance"):
        _get_process_manager._instance = ClaudeProcessManager()
    return _get_process_manager._instance


async def _generate_via_claude_code(full_prompt: str) -> Optional[str]:
    """Run full_prompt through Claude Code CLI and return the raw text result."""
    pm = _get_process_manager()

    # Find a project path from configured CC agents
    project_path: Optional[str] = None
    try:
        from ...db.database import get_db

        async with get_db() as db:
            async with db.execute(
                "SELECT project_path FROM agents WHERE agent_type = 'claude_code' AND project_path IS NOT NULL LIMIT 1",
            ) as cursor:
                row = await cursor.fetchone()
                if row and row["project_path"]:
                    project_path = row["project_path"]
    except Exception:
        pass

    raw_text_parts: list[str] = []
    final_text: Optional[str] = None

    def on_output(process_id: str, line: str) -> None:
        nonlocal final_text
        try:
            data = json.loads(line)
        except (json.JSONDecodeError, ValueError):
            return
        if not isinstance(data, dict):
            return

        event_type = data.get("type", "")
        if event_type == "assistant":
            content = data.get("message", {}).get("content", [])
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        text = block.get("text", "")
                        if text:
                            raw_text_parts.append(text)
            elif isinstance(content, str) and content:
                raw_text_parts.append(content)
        elif event_type == "content_block_delta":
            delta = data.get("delta", {})
            if isinstance(delta, dict) and delta.get("type") == "text_delta":
                text = delta.get("text", "")
                if text:
                    raw_text_parts.append(text)
        elif event_type == "result":
            result_text = data.get("result", "")
            if isinstance(result_text, str) and result_text:
                final_text = result_text

    process_id = await pm.spawn_task(
        message=full_prompt,
        project_path=project_path,
        permission_mode="bypassPermissions",
    )
    pm.set_process_callback(process_id, on_output)

    try:
        # Wait for process to finish
        while True:
            cp = pm.get_process(process_id)
            if cp is None:
                break
            if cp.status in ("completed", "error", "killed"):
                break
            await asyncio.sleep(0.5)
    finally:
        pm.remove_process_callback(process_id)

    return final_text or ("".join(raw_text_parts) if raw_text_parts else None)


async def generate_prop_via_ai(
    prompt: str,
    name: str,
    _model: str,
) -> tuple[Optional[str], list[dict], str]:
    """Try to generate prop code via OpenClaw or Claude Code.

    Returns ``(code_or_None, ai_parts, method)`` where *method* is ``"ai"`` on
    success or ``"template"`` when AI is skipped/fails.
    """
    template = load_prompt_template()
    if not template:
        return None, [], "template"

    full_prompt = (
        f"{template}\n\n"
        f"Generate a prop for: {prompt}\n"
        f"Component name: `{name}`. Output ONLY the code followed by the PARTS_DATA block."
    )

    # --- Try OpenClaw first ---
    try:
        from ..connections import OpenClawConnection, get_connection_manager  # type: ignore

        manager = await get_connection_manager()
        conn = None
        for c in manager.get_connections().values():
            if isinstance(c, OpenClawConnection) and c.is_connected():
                conn = c
                break

        if conn:
            raw = await conn.send_chat(
                message=full_prompt,
                agent_id="dev",
                timeout=120.0,
            )
            if raw:
                return _process_raw_response(raw)
    except Exception as exc:
        logger.warning(f"OpenClaw AI generation error: {exc}")

    # --- Fall back to Claude Code CLI ---
    try:
        raw = await _generate_via_claude_code(full_prompt)
        if raw:
            return _process_raw_response(raw)
    except Exception as exc:
        logger.warning(f"Claude Code AI generation error: {exc}")

    return None, [], "template"


def _process_raw_response(raw: str) -> tuple[Optional[str], list[dict], str]:
    """Clean, parse, and post-process a raw AI response string."""
    raw = raw.strip()
    raw = re.sub(r"^```\w*\n", "", raw)
    raw = re.sub(r"\n```\s*$", "", raw)

    ai_parts = parse_ai_parts(raw)
    code = strip_parts_block(raw)

    if "export function" in code and "<mesh" in code:
        from ..prop_post_processor import enhance_generated_prop  # type: ignore

        pp_result = enhance_generated_prop(code)
        return pp_result.code, ai_parts, "ai"

    return None, [], "template"
