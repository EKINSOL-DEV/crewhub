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
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Optional

import aiofiles

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


def _get_process_manager():
    """Get the ClaudeProcessManager singleton (same pattern as cc_chat.py)."""
    from ..connections.claude_process_manager import ClaudeProcessManager

    if not hasattr(_get_process_manager, "_instance"):
        _get_process_manager._instance = ClaudeProcessManager()
    return _get_process_manager._instance


def _sse_event(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


def _find_connected_openclaw(manager) -> Optional[Any]:
    """Return the first connected OpenClawConnection from the manager, or None."""
    from ..connections import OpenClawConnection

    for c in manager.get_connections().values():
        if isinstance(c, OpenClawConnection) and c.is_connected():
            return c
    return None


def _assistant_block_events(block: dict) -> list:
    bt = block.get("type", "")
    if bt == "thinking":
        return [
            ("thinking", {"text": chunk.strip()}) for chunk in block.get("thinking", "").split("\n") if chunk.strip()
        ]
    if bt == "text" and block.get("text", ""):
        return [("text", {"text": block.get("text", "")[:200]})]
    if bt == "tool_use":
        tool_name = block.get("name", "unknown")
        tool_input = block.get("input", {})
        return [("tool", {"name": tool_name, "input": str(tool_input)[:200], "message": f"🔧 Using tool: {tool_name}"})]
    return []


def _extract_transcript_events(entry: dict) -> list:
    """Parse a JSONL transcript entry and return a list of (event_type, data) tuples."""
    role = entry.get("role", "")
    content = entry.get("content", "")
    if role == "assistant" and isinstance(content, list):
        events: list = []
        for block in content:
            if isinstance(block, dict):
                events.extend(_assistant_block_events(block))
        return events
    if role == "assistant" and isinstance(content, str) and content:
        return [("text", {"text": content[:200]})]
    if role == "user" and isinstance(content, list):
        return [
            ("tool_result", {"message": "📋 Tool result received"})
            for block in content
            if isinstance(block, dict) and block.get("type") == "tool_result"
        ]
    return []


def _extract_final_raw_text(final_result: Any) -> Optional[str]:
    """Extract the raw text string from an agent final-result payload."""
    if not final_result:
        return None
    agent_result = final_result.get("result") if isinstance(final_result, dict) else None
    if isinstance(agent_result, dict):
        payloads = agent_result.get("payloads")
        if isinstance(payloads, list) and payloads:
            text = payloads[0].get("text")
            if text:
                return text
    for key in ("text", "response", "content", "reply"):
        val = final_result.get(key) if isinstance(final_result, dict) else None
        if isinstance(val, str) and val:
            return val
    return None


def _prepare_template_fallback(
    gen_id: str,
    prompt: str,
    name: str,
    model_key: str,
    model_label: str,
    full_prompt: str,
    error: str,
    *,
    extra_diags: list[str] | None = None,
    tool_calls: list[dict] | None = None,
) -> tuple[str, list[dict], dict]:
    code = generate_template_code(name, prompt)
    parts = extract_parts(prompt)
    record = _template_record(
        gen_id,
        prompt,
        name,
        model_key,
        model_label,
        full_prompt,
        parts,
        code,
        error,
        extra_diags=extra_diags,
        extra_tool_calls=tool_calls,
    )
    return code, parts, record


@dataclass
class _AcceptanceOutcome:
    session_id: str | None = None
    error_message: str | None = None
    timeout: bool = False


@dataclass
class _PollOutcome:
    final_result: Any = None
    disconnected: bool = False
    error_message: str | None = None
    poll_count: int = 0
    queue_messages_seen: int = 0


def _build_full_prompt(template: str, prompt: str, name: str) -> str:
    return (
        f"{template}\n\n"
        f"Generate a prop for: {prompt}\n"
        f"Component name: `{name}`. Output ONLY the code followed by the PARTS_DATA block."
    )


def _create_agent_request(full_prompt: str, agent_id: str) -> tuple[str, dict]:
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
    return req_id, ws_request


def _extract_session_id(payload: dict) -> str | None:
    if not isinstance(payload, dict):
        return None
    session = payload.get("session")
    if isinstance(session, dict) and session.get("sessionId"):
        return session.get("sessionId")
    return payload.get("sessionId")


async def _wait_for_accepted_response(q: asyncio.Queue, gen_id: str) -> _AcceptanceOutcome:
    try:
        accepted = await asyncio.wait_for(q.get(), timeout=15.0)
    except TimeoutError:
        logger.warning(f"[PropGen:{gen_id}] Timeout waiting for accepted response (15s)")
        return _AcceptanceOutcome(timeout=True, error_message="Agent acceptance timeout")

    logger.info(f"[PropGen:{gen_id}] Accepted: ok={accepted.get('ok')}")
    if accepted.get("ok"):
        payload = accepted.get("payload", {})
        return _AcceptanceOutcome(session_id=_extract_session_id(payload))

    error_info = accepted.get("error", {})
    err_msg = error_info.get("message", str(error_info)) if isinstance(error_info, dict) else str(error_info)
    logger.error(f"[PropGen:{gen_id}] Agent rejected: {err_msg}")
    return _AcceptanceOutcome(error_message=f"Agent error: {err_msg}")


def _error_record(
    gen_id: str,
    prompt: str,
    name: str,
    model_key: str,
    model_label: str,
    full_prompt: str,
    tool_calls_collected: list[dict],
    err_msg: str,
) -> dict:
    return {
        "id": gen_id,
        "prompt": prompt,
        "name": name,
        "model": model_key,
        "modelLabel": model_label,
        "method": "error",
        "fullPrompt": full_prompt,
        "toolCalls": tool_calls_collected,
        "corrections": [],
        "diagnostics": [],
        "parts": [],
        "code": "",
        "createdAt": datetime.now(UTC).isoformat(),
        "error": err_msg,
    }


def _build_transcript_path(agent_id: str, session_id: str | None, gen_id: str) -> Path | None:
    if not session_id:
        logger.warning(f"[PropGen:{gen_id}] No session_id — cannot poll transcript")
        return None
    base = Path.home() / ".openclaw" / "agents" / agent_id / "sessions"
    transcript_path = base / f"{session_id}.jsonl"
    logger.info(f"[PropGen:{gen_id}] Transcript: {transcript_path} exists={transcript_path.exists()}")
    return transcript_path


def _normalize_ai_raw_text(raw_text: str) -> str:
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```\w*\n", "", cleaned)
    cleaned = re.sub(r"\n```\s*$", "", cleaned)
    return cleaned


def _is_mesh_component_code(code: str) -> bool:
    return "export function" in code and ("<mesh" in code or "mesh" in code.lower())


def _post_processor_diagnostics(pp_result: Any) -> list[str]:
    diagnostics: list[str] = []
    if pp_result.corrections:
        diagnostics.append(f"✅ Post-processor applied {len(pp_result.corrections)} fixes")
        diagnostics.extend(f"  → {fix}" for fix in pp_result.corrections)
    else:
        diagnostics.append("✅ Post-processing: no corrections needed")
    diagnostics.extend(f"⚠️ {warn}" for warn in pp_result.warnings)
    diagnostics.append(f"📊 Quality score: {pp_result.quality_score}/100")
    return diagnostics


def _ai_success_record(
    gen_id: str,
    prompt: str,
    name: str,
    model_key: str,
    model_label: str,
    full_prompt: str,
    tool_calls_collected: list[dict],
    corrections_collected: list[str],
    diagnostics_collected: list[str],
    parts: list[dict],
    code: str,
    quality_score: int,
    validation: dict,
) -> dict:
    return {
        "id": gen_id,
        "prompt": prompt,
        "name": name,
        "model": model_key,
        "modelLabel": model_label,
        "method": "ai",
        "fullPrompt": full_prompt,
        "toolCalls": tool_calls_collected,
        "corrections": corrections_collected,
        "diagnostics": diagnostics_collected,
        "parts": parts,
        "code": code,
        "createdAt": datetime.now(UTC).isoformat(),
        "error": None,
        "qualityScore": quality_score,
        "validation": validation,
    }


async def _emit_new_transcript_events(
    transcript_path: Path | None,
    lines_read: int,
    tool_calls_collected: list[dict],
) -> tuple[int, list[str]]:
    if not transcript_path or not transcript_path.exists():
        return lines_read, []

    try:
        async with aiofiles.open(transcript_path) as f:
            all_lines = await f.readlines()
    except OSError:
        return lines_read, []

    events: list[str] = []
    new_lines = all_lines[lines_read:]
    updated_lines_read = len(all_lines)

    for raw_line in new_lines:
        line = raw_line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue

        for evt_type, evt_data in _extract_transcript_events(entry):
            if evt_type == "tool" and "name" in evt_data:
                tool_calls_collected.append({"name": evt_data["name"], "input": evt_data.get("input", "")[:500]})
            events.append(_sse_event(evt_type, evt_data))

    return updated_lines_read, events


def _poll_queue_message(
    q: asyncio.Queue, gen_id: str, poll_count: int, queue_messages_seen: int
) -> tuple[dict | None, int]:
    try:
        final_msg = q.get_nowait()
    except asyncio.QueueEmpty:
        return None, queue_messages_seen

    queue_messages_seen += 1
    logger.info(f"[PropGen:{gen_id}] Queue msg #{queue_messages_seen} at poll {poll_count}: ok={final_msg.get('ok')}")

    if final_msg.get("ok"):
        payload = final_msg.get("payload")
        if isinstance(payload, dict) and payload.get("status") == "accepted":
            return {"kind": "accepted"}, queue_messages_seen
        return {"kind": "final", "payload": payload}, queue_messages_seen

    if final_msg.get("error"):
        err_msg = str(final_msg.get("error", {}).get("message", "Agent error"))
        logger.error(f"[PropGen:{gen_id}] Agent error: {err_msg}")
        return {"kind": "error", "message": err_msg}, queue_messages_seen

    logger.warning(f"[PropGen:{gen_id}] Unknown queue msg: {json.dumps(final_msg)[:300]}")
    return {"kind": "unknown"}, queue_messages_seen


async def _poll_for_final_result(
    request,
    conn,
    req_id: str,
    q: asyncio.Queue,
    transcript_path: Path | None,
    tool_calls_collected: list[dict],
    gen_id: str,
) -> tuple[_PollOutcome, list[str]]:
    lines_read = 0
    poll_count = 0
    max_polls = 600
    queue_messages_seen = 0
    final_result = None
    streamed_events: list[str] = []

    while poll_count < max_polls:
        if await request.is_disconnected():
            conn._response_queues.pop(req_id, None)
            return _PollOutcome(
                disconnected=True, poll_count=poll_count, queue_messages_seen=queue_messages_seen
            ), streamed_events

        queue_result, queue_messages_seen = _poll_queue_message(q, gen_id, poll_count, queue_messages_seen)
        if queue_result:
            kind = queue_result.get("kind")
            if kind == "final":
                final_result = queue_result.get("payload")
            elif kind == "error":
                conn._response_queues.pop(req_id, None)
                return (
                    _PollOutcome(
                        error_message=queue_result.get("message", "Agent error"),
                        poll_count=poll_count,
                        queue_messages_seen=queue_messages_seen,
                    ),
                    streamed_events,
                )

        if final_result is not None:
            break

        lines_read, events = await _emit_new_transcript_events(transcript_path, lines_read, tool_calls_collected)
        streamed_events.extend(events)

        await asyncio.sleep(0.2)
        poll_count += 1

    conn._response_queues.pop(req_id, None)
    logger.info(
        f"[PropGen:{gen_id}] Poll loop ended: polls={poll_count} "
        f"queue_msgs={queue_messages_seen} has_result={final_result is not None}"
    )
    return (
        _PollOutcome(
            final_result=final_result,
            poll_count=poll_count,
            queue_messages_seen=queue_messages_seen,
        ),
        streamed_events,
    )


async def _late_wait_for_result(conn, req_id: str, q: asyncio.Queue, gen_id: str) -> Any:
    logger.info(f"[PropGen:{gen_id}] No result yet, waiting 30s more...")
    try:
        conn._response_queues[req_id] = q
        final_msg = await asyncio.wait_for(q.get(), timeout=30.0)
        return final_msg.get("payload") if final_msg.get("ok") else None
    except TimeoutError:
        logger.warning(f"[PropGen:{gen_id}] Final 30s wait also timed out")
        return None
    except Exception as e:
        logger.error(f"[PropGen:{gen_id}] Final wait error: {e}")
        return None
    finally:
        conn._response_queues.pop(req_id, None)


async def _find_cc_project_path() -> Optional[str]:
    """Find a suitable project_path for Claude Code from configured agents, or use cwd."""
    try:
        from ...db.database import get_db

        async with get_db() as db:
            async with db.execute(
                "SELECT project_path FROM agents WHERE agent_type = 'claude_code' AND project_path IS NOT NULL LIMIT 1",
            ) as cursor:
                row = await cursor.fetchone()
                if row and row["project_path"]:
                    return row["project_path"]
    except Exception:
        pass
    return None


async def _stream_via_claude_code(
    request,
    prompt: str,
    name: str,
    model_key: str,
    full_prompt: str,
    gen_id: str,
) -> AsyncGenerator[str, None]:
    """SSE generator that uses Claude Code CLI to generate a prop.

    Mirrors the OpenClaw streaming flow but spawns a `claude --print` subprocess
    via ClaudeProcessManager and parses the JSONL output for thinking/tool/text events.
    """
    from ..multi_pass_generator import MultiPassGenerator
    from ..prop_post_processor import enhance_generated_prop, validate_prop_quality

    _, model_label = resolve_model(model_key)
    pm = _get_process_manager()
    project_path = await _find_cc_project_path()

    # Queue receives (event_type, data_dict) tuples; None signals completion
    queue: asyncio.Queue[Optional[tuple[str, dict]]] = asyncio.Queue()
    raw_text_parts: list[str] = []
    tool_calls_collected: list[dict] = []
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
                    if not isinstance(block, dict):
                        continue
                    bt = block.get("type", "")
                    if bt == "thinking":
                        text = block.get("thinking", "")
                        if text:
                            for chunk in text.split("\n"):
                                chunk = chunk.strip()
                                if chunk:
                                    queue.put_nowait(("thinking", {"text": chunk}))
                    elif bt == "text":
                        text = block.get("text", "")
                        if text:
                            raw_text_parts.append(text)
                            queue.put_nowait(("text", {"text": text[:200]}))
                    elif bt == "tool_use":
                        tool_name = block.get("name", "unknown")
                        tool_input = block.get("input", {})
                        tool_calls_collected.append(
                            {"name": tool_name, "input": str(tool_input)[:500]}
                        )
                        queue.put_nowait((
                            "tool",
                            {
                                "name": tool_name,
                                "input": str(tool_input)[:200],
                                "message": f"🔧 Using tool: {tool_name}",
                            },
                        ))
            elif isinstance(content, str) and content:
                raw_text_parts.append(content)
                queue.put_nowait(("text", {"text": content[:200]}))

        elif event_type == "content_block_delta":
            delta = data.get("delta", {})
            if isinstance(delta, dict) and delta.get("type") == "text_delta":
                text = delta.get("text", "")
                if text:
                    raw_text_parts.append(text)

        elif event_type == "user":
            content = data.get("message", {}).get("content", [])
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "tool_result":
                        queue.put_nowait(("tool_result", {"message": "📋 Tool result received"}))

        elif event_type == "result":
            result_text = data.get("result", "")
            if isinstance(result_text, str) and result_text:
                final_text = result_text

    yield _sse_event("status", {"message": f"🤖 Spawning Claude Code for: \"{prompt}\"...", "phase": "start"})
    model_id, _ = resolve_model(model_key)
    yield _sse_event("model", {"model": model_key, "modelLabel": model_label, "modelId": model_id})
    yield _sse_event("full_prompt", {"prompt": full_prompt})

    # Map app model keys to CLI-friendly aliases (e.g. "opus", "sonnet")
    _CLI_MODEL_ALIAS: dict[str, str] = {
        "opus-4-6": "opus",
        "sonnet-4-5": "sonnet",
        "sonnet-4-6": "sonnet",
    }
    cli_model = _CLI_MODEL_ALIAS.get(model_key)

    try:
        process_id = await pm.spawn_task(
            message=full_prompt,
            project_path=project_path,
            model=cli_model,
            permission_mode="bypassPermissions",
        )
    except Exception as e:
        logger.error(f"[PropGen:{gen_id}] Failed to spawn Claude Code: {e}")
        yield _sse_event("error", {"message": f"Failed to spawn Claude Code: {e}"})
        return

    pm.set_process_callback(process_id, on_output)
    yield _sse_event("status", {"message": f"🧠 Claude Code ({model_label}) is thinking...", "phase": "thinking"})

    poll_count = 0
    try:
        # Poll queue for streaming events until process completes
        while True:
            poll_count += 1

            if await request.is_disconnected():
                logger.warning(f"[PropGen:{gen_id}] Client disconnected at poll {poll_count}")
                await pm.kill(process_id)
                return

            try:
                event = await asyncio.wait_for(queue.get(), timeout=1.0)
                if event is not None:
                    evt_type, evt_data = event
                    yield _sse_event(evt_type, evt_data)
            except TimeoutError:
                pass

            cp = pm.get_process(process_id)
            if cp is None:
                logger.info(f"[PropGen:{gen_id}] Process gone at poll {poll_count}")
                break
            if cp.status in ("completed", "error", "killed") and queue.empty():
                logger.info(f"[PropGen:{gen_id}] Process {cp.status} at poll {poll_count}")
                # Drain remaining
                while not queue.empty():
                    event = queue.get_nowait()
                    if event is not None:
                        evt_type, evt_data = event
                        yield _sse_event(evt_type, evt_data)
                break

    finally:
        logger.info(f"[PropGen:{gen_id}] Stream loop ended after {poll_count} polls")
        pm.remove_process_callback(process_id)

    # Assemble the raw text from all collected parts
    raw_text = final_text or "".join(raw_text_parts)
    if not raw_text:
        logger.warning(f"[PropGen:{gen_id}] No text output from Claude Code")
        code = generate_template_code(name, prompt)
        parts = extract_parts(prompt)
        record = _template_record(
            gen_id, prompt, name, model_key, model_label, full_prompt,
            parts, code, "No AI response from Claude Code",
            extra_diags=["No CC result, used template"],
        )
        add_generation_record(record)
        yield _sse_event("complete", _template_complete(name, code, parts, model_key, model_label, gen_id))
        return

    # Post-process the raw AI output
    cleaned_text = _normalize_ai_raw_text(raw_text)
    ai_parts = parse_ai_parts(cleaned_text)
    code = strip_parts_block(cleaned_text)

    if not _is_mesh_component_code(code):
        logger.warning(f"[PropGen:{gen_id}] CC output invalid for {name}, using template fallback")
        code = generate_template_code(name, prompt)
        parts = extract_parts(prompt)
        record = _template_record(
            gen_id, prompt, name, model_key, model_label, full_prompt,
            parts, code, "AI output validation failed",
            extra_diags=["CC output invalid, used template"],
            extra_tool_calls=tool_calls_collected,
        )
        add_generation_record(record)
        yield _sse_event("complete", _template_complete(name, code, parts, model_key, model_label, gen_id))
        return

    # Enhance and validate
    pp_result = enhance_generated_prop(code)
    code = pp_result.code
    corrections_collected = pp_result.corrections
    diagnostics_collected = _post_processor_diagnostics(pp_result)
    for diag in diagnostics_collected:
        yield _sse_event("correction", {"message": diag})

    mp_gen: MultiPassGenerator | None = None
    try:
        mp_gen = MultiPassGenerator()
        code, mp_diags = mp_gen.generate_prop(prompt, code)
        for diag in mp_diags:
            diagnostics_collected.append(diag)
            yield _sse_event("correction", {"message": diag})
    except Exception as mp_err:
        logger.warning(f"[PropGen:{gen_id}] Multi-pass error (non-fatal): {mp_err}")
        diagnostics_collected.append("⚠️ Multi-pass enhancement skipped")

    ai_parts_new = parse_ai_parts(code)
    if ai_parts_new:
        ai_parts = ai_parts_new
    parts = ai_parts if ai_parts else extract_parts(prompt)
    validation = validate_prop_quality(code)

    add_generation_record(
        _ai_success_record(
            gen_id, prompt, name, model_key, model_label, full_prompt,
            tool_calls_collected, corrections_collected, diagnostics_collected,
            parts, code, pp_result.quality_score, validation,
        )
    )

    refinement_options = {}
    if mp_gen is not None:
        try:
            refinement_options = mp_gen.get_refinement_options(prompt)
        except Exception:
            refinement_options = {}

    yield _sse_event(
        "complete",
        {
            "name": name,
            "filename": f"{name}.tsx",
            "code": code,
            "method": "ai",
            "parts": parts,
            "model": model_key,
            "modelLabel": model_label,
            "generationId": gen_id,
            "qualityScore": pp_result.quality_score,
            "validation": validation,
            "refinementOptions": refinement_options,
        },
    )


async def stream_prop_generation(  # noqa: C901  # NOSONAR
    request,  # starlette.requests.Request — checked only for is_disconnected()
    prompt: str,
    name: str,
    model_key: str,
) -> AsyncGenerator[str, None]:
    """SSE generator that streams real AI thinking process.

    Yields SSE-formatted strings. Caller wraps this in StreamingResponse.
    """
    from ..connections import get_connection_manager  # lazy import

    model_id, model_label = resolve_model(model_key)
    gen_id = str(_uuid_mod.uuid4())[:8]
    tool_calls_collected: list[dict] = []
    corrections_collected: list[str] = []
    diagnostics_collected: list[str] = []

    template = load_prompt_template()
    if not template:
        yield _sse_event("error", {"message": "Prompt template not found"})
        return

    full_prompt = _build_full_prompt(template, prompt, name)

    try:
        manager = await get_connection_manager()
        conn = _find_connected_openclaw(manager)
    except Exception:
        conn = None

    if not conn:
        # Fall back to Claude Code CLI
        async for event in _stream_via_claude_code(request, prompt, name, model_key, full_prompt, gen_id):
            yield event
        return
    yield _sse_event("status", {"message": f'🔍 Analyzing prompt: "{prompt}"...', "phase": "start"})
    yield _sse_event("model", {"model": model_key, "modelLabel": model_label, "modelId": model_id})
    yield _sse_event("full_prompt", {"prompt": full_prompt})

    agent_id = "dev"
    req_id, ws_request = _create_agent_request(full_prompt, agent_id)
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

    acceptance = await _wait_for_accepted_response(q, gen_id)
    if acceptance.error_message:
        conn._response_queues.pop(req_id, None)
        code, parts, record = _prepare_template_fallback(
            gen_id,
            prompt,
            name,
            model_key,
            model_label,
            full_prompt,
            acceptance.error_message,
        )
        add_generation_record(record)
        yield _sse_event("error", {"message": acceptance.error_message})
        yield _sse_event("complete", _template_complete(name, code, parts, model_key, model_label, gen_id))
        return

    yield _sse_event("status", {"message": f"🧠 AI agent ({model_label}) started thinking...", "phase": "thinking"})

    transcript_path = _build_transcript_path(agent_id, acceptance.session_id, gen_id)
    poll_outcome, transcript_events = await _poll_for_final_result(
        request,
        conn,
        req_id,
        q,
        transcript_path,
        tool_calls_collected,
        gen_id,
    )
    for event in transcript_events:
        yield event

    if poll_outcome.disconnected:
        return

    if poll_outcome.error_message:
        err_msg = poll_outcome.error_message
        yield _sse_event("error", {"message": err_msg})
        add_generation_record(
            _error_record(
                gen_id,
                prompt,
                name,
                model_key,
                model_label,
                full_prompt,
                tool_calls_collected,
                err_msg,
            )
        )
        return

    final_result = poll_outcome.final_result
    if final_result is None:
        final_result = await _late_wait_for_result(conn, req_id, q, gen_id)

    raw_text = _extract_final_raw_text(final_result)
    logger.info(f"[PropGen:{gen_id}] raw_text: present={bool(raw_text)} len={len(raw_text) if raw_text else 0}")

    if raw_text:
        cleaned_text = _normalize_ai_raw_text(raw_text)
        ai_parts = parse_ai_parts(cleaned_text)
        code = strip_parts_block(cleaned_text)

        if _is_mesh_component_code(code):
            from ..multi_pass_generator import MultiPassGenerator
            from ..prop_post_processor import enhance_generated_prop, validate_prop_quality

            pp_result = enhance_generated_prop(code)
            code = pp_result.code
            corrections_collected = pp_result.corrections
            diagnostics_collected = _post_processor_diagnostics(pp_result)
            for diag in diagnostics_collected:
                yield _sse_event("correction", {"message": diag})

            mp_gen: MultiPassGenerator | None = None
            try:
                mp_gen = MultiPassGenerator()
                code, mp_diags = mp_gen.generate_prop(prompt, code)
                for diag in mp_diags:
                    diagnostics_collected.append(diag)
                    yield _sse_event("correction", {"message": diag})
            except Exception as mp_err:
                logger.warning(f"[PropGen:{gen_id}] Multi-pass error (non-fatal): {mp_err}")
                diagnostics_collected.append("⚠️ Multi-pass enhancement skipped")

            ai_parts_new = parse_ai_parts(code)
            if ai_parts_new:
                ai_parts = ai_parts_new
            parts = ai_parts if ai_parts else extract_parts(prompt)
            validation = validate_prop_quality(code)

            add_generation_record(
                _ai_success_record(
                    gen_id,
                    prompt,
                    name,
                    model_key,
                    model_label,
                    full_prompt,
                    tool_calls_collected,
                    corrections_collected,
                    diagnostics_collected,
                    parts,
                    code,
                    pp_result.quality_score,
                    validation,
                )
            )

            refinement_options = {}
            if mp_gen is not None:
                try:
                    refinement_options = mp_gen.get_refinement_options(prompt)
                except Exception:
                    refinement_options = {}

            yield _sse_event(
                "complete",
                {
                    "name": name,
                    "filename": f"{name}.tsx",
                    "code": code,
                    "method": "ai",
                    "parts": parts,
                    "model": model_key,
                    "modelLabel": model_label,
                    "generationId": gen_id,
                    "qualityScore": pp_result.quality_score,
                    "validation": validation,
                    "refinementOptions": refinement_options,
                },
            )
            return

        logger.warning(f"AI output invalid for {name}, using template fallback")
        code, parts, record = _prepare_template_fallback(
            gen_id,
            prompt,
            name,
            model_key,
            model_label,
            full_prompt,
            "AI output validation failed",
            extra_diags=["AI output invalid, used template"],
            tool_calls=tool_calls_collected,
        )
        add_generation_record(record)
        yield _sse_event("complete", _template_complete(name, code, parts, model_key, model_label, gen_id))
        return

    logger.warning(f"No AI result for {name}, using template fallback")
    code, parts, record = _prepare_template_fallback(
        gen_id,
        prompt,
        name,
        model_key,
        model_label,
        full_prompt,
        "No AI response received",
        extra_diags=["No AI result, used template"],
        tool_calls=tool_calls_collected,
    )
    add_generation_record(record)
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
        "id": gen_id,
        "prompt": prompt,
        "name": name,
        "model": model_key,
        "modelLabel": model_label,
        "method": "template",
        "fullPrompt": full_prompt,
        "toolCalls": extra_tool_calls or [],
        "corrections": [],
        "diagnostics": extra_diags or [],
        "parts": parts,
        "code": code,
        "createdAt": datetime.now(UTC).isoformat(),
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
        "name": name,
        "filename": f"{name}.tsx",
        "code": code,
        "method": "template",
        "parts": parts,
        "model": model_key,
        "modelLabel": model_label,
        "generationId": gen_id,
    }
