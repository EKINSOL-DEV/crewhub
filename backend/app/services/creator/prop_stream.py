"""Creator Zone — SSE streaming service for AI prop generation.

Encapsulates the async generator that drives the real-time "thinking"
stream shown in the creator UI. No FastAPI / HTTP concerns here beyond
producing SSE-formatted strings.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid as _uuid_mod
from datetime import datetime
from pathlib import Path
from typing import AsyncGenerator

from .prop_generator import (
    add_generation_record,
    extract_parts,
    generate_template_code,
    load_prompt_template,
    parse_ai_parts,
    resolve_model,
    strip_parts_block,
)

logger = logging.getLogger(__name__)


def _sse_event(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


async def stream_prop_generation(
    request,  # starlette.requests.Request — checked only for is_disconnected()
    prompt: str,
    name: str,
    model_key: str,
) -> AsyncGenerator[str, None]:
    """SSE generator that streams real AI thinking process.

    Yields SSE-formatted strings. Caller wraps this in StreamingResponse.
    """
    from ..connections import get_connection_manager, OpenClawConnection  # lazy import

    model_id, model_label = resolve_model(model_key)
    gen_id = str(_uuid_mod.uuid4())[:8]

    tool_calls_collected: list[dict] = []
    corrections_collected: list[str] = []
    diagnostics_collected: list[str] = []

    # ── Find connected OpenClaw connection ────────────────────────
    try:
        manager = await get_connection_manager()
        conn = None
        for c in manager.get_connections().values():
            if isinstance(c, OpenClawConnection) and c.is_connected():
                conn = c
                break
        if not conn:
            yield _sse_event("error", {"message": "No connected OpenClaw connection"})
            return
    except Exception as e:
        yield _sse_event("error", {"message": str(e)})
        return

    # ── Build prompt ──────────────────────────────────────────────
    template = load_prompt_template()
    if not template:
        yield _sse_event("error", {"message": "Prompt template not found"})
        return

    full_prompt = (
        f"{template}\n\n"
        f"Generate a prop for: {prompt}\n"
        f"Component name: `{name}`. Output ONLY the code followed by the PARTS_DATA block."
    )

    yield _sse_event("status", {"message": f'🔍 Analyzing prompt: "{prompt}"...', "phase": "start"})
    yield _sse_event("model", {"model": model_key, "modelLabel": model_label, "modelId": model_id})
    yield _sse_event("full_prompt", {"prompt": full_prompt})

    # ── Send agent request ────────────────────────────────────────
    agent_id = "dev"
    req_id = str(_uuid_mod.uuid4())
    ws_request = {
        "type": "req",
        "id": req_id,
        "method": "agent",
        "params": {
            "message": full_prompt,
            "agentId": agent_id,
            "deliver": False,
            "idempotencyKey": str(_uuid_mod.uuid4()),
        },
    }

    q: asyncio.Queue = asyncio.Queue()
    conn._response_queues[req_id] = q

    logger.info(f"[PropGen:{gen_id}] Sending agent request req_id={req_id} agent={agent_id} model={model_id}")

    try:
        await conn.ws.send(json.dumps(ws_request))
    except Exception as e:
        conn._response_queues.pop(req_id, None)
        logger.error(f"[PropGen:{gen_id}] Failed to send WS request: {e}")
        yield _sse_event("error", {"message": f"Failed to send request: {e}"})
        return

    # ── Wait for accepted response ────────────────────────────────
    session_id = None
    try:
        accepted = await asyncio.wait_for(q.get(), timeout=15.0)
        logger.info(f"[PropGen:{gen_id}] Accepted: ok={accepted.get('ok')}")
        if accepted.get("ok"):
            payload = accepted.get("payload", {})
            if isinstance(payload, dict):
                session_id = payload.get("sessionId") or (
                    payload.get("session", {}).get("sessionId")
                    if isinstance(payload.get("session"), dict)
                    else None
                )
        else:
            error_info = accepted.get("error", {})
            err_msg = (
                error_info.get("message", str(error_info))
                if isinstance(error_info, dict)
                else str(error_info)
            )
            logger.error(f"[PropGen:{gen_id}] Agent rejected: {err_msg}")
            conn._response_queues.pop(req_id, None)
            code = generate_template_code(name, prompt)
            parts = extract_parts(prompt)
            add_generation_record(_template_record(gen_id, prompt, name, model_key, model_label,
                                                   full_prompt, parts, code,
                                                   f"Agent error: {err_msg}"))
            yield _sse_event("error", {"message": f"Agent error: {err_msg}"})
            yield _sse_event("complete", _template_complete(name, code, parts, model_key, model_label, gen_id))
            return
    except asyncio.TimeoutError:
        logger.warning(f"[PropGen:{gen_id}] Timeout waiting for accepted response (15s)")
        conn._response_queues.pop(req_id, None)
        code = generate_template_code(name, prompt)
        parts = extract_parts(prompt)
        add_generation_record(_template_record(gen_id, prompt, name, model_key, model_label,
                                               full_prompt, parts, code, "Agent acceptance timeout",
                                               extra_diags=["Timeout waiting for agent acceptance"]))
        yield _sse_event("error", {"message": "Agent did not respond in time"})
        yield _sse_event("complete", _template_complete(name, code, parts, model_key, model_label, gen_id))
        return

    yield _sse_event("status", {
        "message": f"🧠 AI agent ({model_label}) started thinking...",
        "phase": "thinking",
    })

    # ── Poll transcript ───────────────────────────────────────────
    transcript_path: Path | None = None
    if session_id:
        base = Path.home() / ".openclaw" / "agents" / agent_id / "sessions"
        transcript_path = base / f"{session_id}.jsonl"
        logger.info(f"[PropGen:{gen_id}] Transcript: {transcript_path} exists={transcript_path.exists()}")
    else:
        logger.warning(f"[PropGen:{gen_id}] No session_id — cannot poll transcript")

    lines_read = 0
    final_result = None
    poll_count = 0
    max_polls = 600
    queue_messages_seen = 0

    while poll_count < max_polls:
        if await request.is_disconnected():
            conn._response_queues.pop(req_id, None)
            return

        try:
            final_msg = q.get_nowait()
            queue_messages_seen += 1
            logger.info(
                f"[PropGen:{gen_id}] Queue msg #{queue_messages_seen} at poll {poll_count}: "
                f"ok={final_msg.get('ok')}"
            )
            if final_msg.get("ok"):
                payload = final_msg.get("payload")
                if isinstance(payload, dict) and payload.get("status") == "accepted":
                    continue  # skip duplicate accepted
                final_result = payload
            elif final_msg.get("error"):
                err_msg = str(final_msg.get("error", {}).get("message", "Agent error"))
                logger.error(f"[PropGen:{gen_id}] Agent error: {err_msg}")
                yield _sse_event("error", {"message": err_msg})
                add_generation_record({
                    "id": gen_id, "prompt": prompt, "name": name,
                    "model": model_key, "modelLabel": model_label, "method": "error",
                    "fullPrompt": full_prompt, "toolCalls": tool_calls_collected,
                    "corrections": [], "diagnostics": [], "parts": [], "code": "",
                    "createdAt": datetime.utcnow().isoformat(), "error": err_msg,
                })
                conn._response_queues.pop(req_id, None)
                return
            else:
                logger.warning(f"[PropGen:{gen_id}] Unknown queue msg: {json.dumps(final_msg)[:300]}")
                continue
            break
        except asyncio.QueueEmpty:
            pass

        # Read new transcript lines
        if transcript_path and transcript_path.exists():
            try:
                with open(transcript_path, "r") as f:
                    all_lines = f.readlines()
                new_lines = all_lines[lines_read:]
                lines_read = len(all_lines)

                for line in new_lines:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        role = entry.get("role", "")
                        content = entry.get("content", "")

                        if role == "assistant" and isinstance(content, list):
                            for block in content:
                                if not isinstance(block, dict):
                                    continue
                                bt = block.get("type", "")
                                if bt == "thinking":
                                    for chunk in block.get("thinking", "").split("\n"):
                                        chunk = chunk.strip()
                                        if chunk:
                                            yield _sse_event("thinking", {"text": chunk})
                                elif bt == "text":
                                    text = block.get("text", "")
                                    if text:
                                        yield _sse_event("text", {"text": text[:200]})
                                elif bt == "tool_use":
                                    tool_name = block.get("name", "unknown")
                                    tool_input = block.get("input", {})
                                    tool_calls_collected.append({
                                        "name": tool_name,
                                        "input": str(tool_input)[:500],
                                    })
                                    yield _sse_event("tool", {
                                        "name": tool_name,
                                        "input": str(tool_input)[:200],
                                        "message": f"🔧 Using tool: {tool_name}",
                                    })
                        elif role == "assistant" and isinstance(content, str) and content:
                            yield _sse_event("text", {"text": content[:200]})
                        elif role == "user" and lines_read > 1:
                            if isinstance(content, list):
                                for block in content:
                                    if isinstance(block, dict) and block.get("type") == "tool_result":
                                        yield _sse_event("tool_result", {"message": "📋 Tool result received"})
                    except json.JSONDecodeError:
                        continue
            except (OSError, IOError):
                pass

        await asyncio.sleep(0.2)
        poll_count += 1

    conn._response_queues.pop(req_id, None)
    logger.info(
        f"[PropGen:{gen_id}] Poll loop ended: polls={poll_count} "
        f"queue_msgs={queue_messages_seen} has_result={final_result is not None}"
    )

    # ── Late wait for final response ──────────────────────────────
    if final_result is None:
        logger.info(f"[PropGen:{gen_id}] No result yet, waiting 30s more...")
        try:
            conn._response_queues[req_id] = q
            final_msg = await asyncio.wait_for(q.get(), timeout=30.0)
            if final_msg.get("ok"):
                final_result = final_msg.get("payload")
            conn._response_queues.pop(req_id, None)
        except asyncio.TimeoutError:
            logger.warning(f"[PropGen:{gen_id}] Final 30s wait also timed out")
            conn._response_queues.pop(req_id, None)
        except Exception as e:
            logger.error(f"[PropGen:{gen_id}] Final wait error: {e}")
            conn._response_queues.pop(req_id, None)

    # ── Extract raw text from result ──────────────────────────────
    raw_text: str | None = None
    if final_result:
        agent_result = final_result.get("result") if isinstance(final_result, dict) else None
        if isinstance(agent_result, dict):
            payloads = agent_result.get("payloads")
            if isinstance(payloads, list) and payloads:
                raw_text = payloads[0].get("text")
        if not raw_text:
            for key in ("text", "response", "content", "reply"):
                val = final_result.get(key) if isinstance(final_result, dict) else None
                if isinstance(val, str) and val:
                    raw_text = val
                    break

    logger.info(f"[PropGen:{gen_id}] raw_text: present={bool(raw_text)} len={len(raw_text) if raw_text else 0}")

    # ── Process valid AI output ───────────────────────────────────
    if raw_text:
        raw_text = raw_text.strip()
        raw_text = re.sub(r"^```\w*\n", "", raw_text)
        raw_text = re.sub(r"\n```\s*$", "", raw_text)

        ai_parts = parse_ai_parts(raw_text)
        code = strip_parts_block(raw_text)

        if "export function" in code and ("<mesh" in code or "mesh" in code.lower()):
            from ..prop_post_processor import enhance_generated_prop, validate_prop_quality
            from ..multi_pass_generator import MultiPassGenerator

            # Phase 1: Post-processor
            pp_result = enhance_generated_prop(code)
            code = pp_result.code
            corrections_collected = pp_result.corrections
            diagnostics_collected = []

            if pp_result.corrections:
                diagnostics_collected.append(
                    f"✅ Post-processor applied {len(pp_result.corrections)} fixes"
                )
                for fix in pp_result.corrections:
                    diagnostics_collected.append(f"  → {fix}")
            else:
                diagnostics_collected.append("✅ Post-processing: no corrections needed")

            for warn in pp_result.warnings:
                diagnostics_collected.append(f"⚠️ {warn}")

            diagnostics_collected.append(f"📊 Quality score: {pp_result.quality_score}/100")

            for diag in diagnostics_collected:
                yield _sse_event("correction", {"message": diag})

            # Phase 2: Multi-pass enhancement
            try:
                mp_gen = MultiPassGenerator()
                code, mp_diags = await mp_gen.generate_prop(prompt, code)
                for d in mp_diags:
                    diagnostics_collected.append(d)
                    yield _sse_event("correction", {"message": d})
            except Exception as mp_err:
                logger.warning(f"[PropGen:{gen_id}] Multi-pass error (non-fatal): {mp_err}")
                diagnostics_collected.append("⚠️ Multi-pass enhancement skipped")

            # Re-parse parts from potentially modified code
            ai_parts_new = parse_ai_parts(code)
            if ai_parts_new:
                ai_parts = ai_parts_new
            parts = ai_parts if ai_parts else extract_parts(prompt)

            # Validate final quality
            validation = validate_prop_quality(code)

            add_generation_record({
                "id": gen_id, "prompt": prompt, "name": name,
                "model": model_key, "modelLabel": model_label, "method": "ai",
                "fullPrompt": full_prompt, "toolCalls": tool_calls_collected,
                "corrections": corrections_collected, "diagnostics": diagnostics_collected,
                "parts": parts, "code": code,
                "createdAt": datetime.utcnow().isoformat(), "error": None,
                "qualityScore": pp_result.quality_score, "validation": validation,
            })

            try:
                refinement_options = mp_gen.get_refinement_options(prompt)
            except Exception:
                refinement_options = {}

            yield _sse_event("complete", {
                "name": name, "filename": f"{name}.tsx", "code": code,
                "method": "ai", "parts": parts,
                "model": model_key, "modelLabel": model_label, "generationId": gen_id,
                "qualityScore": pp_result.quality_score, "validation": validation,
                "refinementOptions": refinement_options,
            })
            return

        # AI output invalid → template fallback
        logger.warning(f"AI output invalid for {name}, using template fallback")
        code = generate_template_code(name, prompt)
        parts = extract_parts(prompt)
        add_generation_record(_template_record(
            gen_id, prompt, name, model_key, model_label, full_prompt, parts, code,
            "AI output validation failed",
            extra_diags=["AI output invalid, used template"],
            extra_tool_calls=tool_calls_collected,
        ))
        yield _sse_event("complete", _template_complete(name, code, parts, model_key, model_label, gen_id))
        return

    # No AI result at all → template fallback
    logger.warning(f"No AI result for {name}, using template fallback")
    code = generate_template_code(name, prompt)
    parts = extract_parts(prompt)
    add_generation_record(_template_record(
        gen_id, prompt, name, model_key, model_label, full_prompt, parts, code,
        "No AI response received",
        extra_diags=["No AI result, used template"],
        extra_tool_calls=tool_calls_collected,
    ))
    yield _sse_event("complete", _template_complete(name, code, parts, model_key, model_label, gen_id))


# ─── Private Helpers ─────────────────────────────────────────────


def _template_record(
    gen_id: str,
    prompt: str,
    name: str,
    model_key: str,
    model_label: str,
    full_prompt: str,
    parts: list[dict],
    code: str,
    error: str,
    extra_diags: list[str] | None = None,
    extra_tool_calls: list[dict] | None = None,
) -> dict:
    return {
        "id": gen_id, "prompt": prompt, "name": name,
        "model": model_key, "modelLabel": model_label, "method": "template",
        "fullPrompt": full_prompt,
        "toolCalls": extra_tool_calls or [],
        "corrections": [],
        "diagnostics": extra_diags or [],
        "parts": parts, "code": code,
        "createdAt": datetime.utcnow().isoformat(),
        "error": error,
    }


def _template_complete(
    name: str,
    code: str,
    parts: list[dict],
    model_key: str,
    model_label: str,
    gen_id: str,
) -> dict:
    return {
        "name": name, "filename": f"{name}.tsx", "code": code,
        "method": "template", "parts": parts,
        "model": model_key, "modelLabel": model_label, "generationId": gen_id,
    }
