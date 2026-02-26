"""Service layer for meeting database operations.

All SQL for meetings lives here. The MeetingOrchestrator calls these helpers
to keep orchestration logic free of raw DB access.
Routes call start_meeting / cancel_meeting / get_meeting / list_meetings.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
import uuid
from typing import Any, Optional

from app.db.database import get_db
from app.db.meeting_models import (
    Meeting,
    MeetingConfig,
    MeetingState,
    Turn,
)
from app.routes.sse import broadcast

DEFAULT_MEETING_TITLE = "Team Meeting"

logger = logging.getLogger(__name__)

MAX_CONCURRENT_MEETINGS = 3

# Active orchestrators (meeting_id -> asyncio.Task) — shared with orchestrator module
_active_meetings: dict[str, asyncio.Task[None]] = {}


# ─────────────────────────────────────────────────────────────────────────────
# Time / ID helpers
# ─────────────────────────────────────────────────────────────────────────────


def _now_ms() -> int:
    return int(time.time() * 1000)


def _generate_id() -> str:
    return f"mtg_{uuid.uuid4().hex[:8]}"


# ─────────────────────────────────────────────────────────────────────────────
# Agent lookup
# ─────────────────────────────────────────────────────────────────────────────


async def resolve_agent_info(agent_id: str) -> dict:
    """Look up agent name/icon/color from DB. Falls back gracefully."""
    try:
        async with get_db() as db:
            async with db.execute(
                "SELECT id, name, icon, color, agent_session_key FROM agents WHERE id = ? OR agent_session_key = ?",
                (agent_id, agent_id),
            ) as cur:
                row = await cur.fetchone()
                if row:
                    return {
                        "id": row["id"],
                        "name": row["name"] or row["id"],
                        "icon": row["icon"],
                        "color": row["color"],
                        "session_key": row["agent_session_key"] or f"agent:{row['id']}:main",
                    }
    except Exception as exc:
        logger.warning(f"Could not resolve agent {agent_id}: {exc}")
    parts = agent_id.split(":")
    name = parts[1] if len(parts) > 1 else agent_id
    return {"id": agent_id, "name": name, "icon": None, "color": None, "session_key": agent_id}


# ─────────────────────────────────────────────────────────────────────────────
# DB write helpers (called by MeetingOrchestrator)
# ─────────────────────────────────────────────────────────────────────────────


async def db_set_state(
    meeting_id: str,
    state: MeetingState,
    current_round: Optional[int] = None,
    output_md: Optional[str] = None,
    output_path: Optional[str] = None,
    error_message: Optional[str] = None,
) -> None:
    """Update meeting state and optional fields in DB."""
    now = _now_ms()
    async with get_db() as db:
        updates = ["state = ?"]
        params: list = [state.value]
        if current_round is not None:
            updates += ["current_round = ?"]
            params.append(current_round)
        if output_md is not None:
            updates += ["output_md = ?"]
            params.append(output_md)
        if output_path is not None:
            updates += ["output_path = ?"]
            params.append(output_path)
        if error_message is not None:
            updates += ["error_message = ?"]
            params.append(error_message)
        if state == MeetingState.COMPLETE:
            updates += ["completed_at = ?"]
            params.append(now)
        if state == MeetingState.CANCELLED:
            updates += ["cancelled_at = ?"]
            params.append(now)
        if state == MeetingState.GATHERING:
            updates += ["started_at = ?"]
            params.append(now)
        params.append(meeting_id)
        await db.execute(f"UPDATE meetings SET {', '.join(updates)} WHERE id = ?", params)
        await db.commit()


async def db_update_current_turn(meeting_id: str, round_num: int, turn_index: int) -> None:
    async with get_db() as db:
        await db.execute(
            "UPDATE meetings SET current_round = ?, current_turn = ? WHERE id = ?",
            (round_num, turn_index, meeting_id),
        )
        await db.commit()


async def db_save_participants(meeting_id: str, participants: list[dict]) -> None:
    async with get_db() as db:
        for i, p in enumerate(participants):
            await db.execute(
                "INSERT OR REPLACE INTO meeting_participants "
                "(meeting_id, agent_id, agent_name, agent_icon, agent_color, sort_order) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (meeting_id, p["id"], p["name"], p.get("icon"), p.get("color"), i),
            )
        await db.commit()


async def db_save_turn(turn: Turn) -> None:
    response_tokens = turn.response_tokens
    if response_tokens is None and turn.response:
        response_tokens = max(1, len(turn.response) // 4)
    async with get_db() as db:
        await db.execute(
            """INSERT OR REPLACE INTO meeting_turns
               (id, meeting_id, round_num, turn_index, agent_id, agent_name,
                response_text, prompt_tokens, response_tokens, started_at, completed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                turn.id,
                turn.meeting_id,
                turn.round_num,
                turn.turn_index,
                turn.agent_id,
                turn.agent_name,
                turn.response,
                turn.prompt_tokens,
                response_tokens,
                turn.started_at,
                turn.completed_at,
            ),
        )
        await db.commit()


async def db_load_all_turns(meeting_id: str) -> list[dict]:
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM meeting_turns WHERE meeting_id = ? ORDER BY round_num, turn_index",
            (meeting_id,),
        ) as cur:
            rows = await cur.fetchall()
            return [
                {
                    "round_num": r["round_num"],
                    "turn_index": r["turn_index"],
                    "agent_id": r["agent_id"],
                    "agent_name": r["agent_name"],
                    "response": r["response_text"],
                }
                for r in rows
            ]


async def db_get_started_at(meeting_id: str) -> int:
    async with get_db() as db:
        async with db.execute("SELECT started_at FROM meetings WHERE id = ?", (meeting_id,)) as cur:
            row = await cur.fetchone()
            return row["started_at"] if row and row["started_at"] else _now_ms()


async def db_save_action_items(
    meeting_id: str, output_md: str
) -> None:  # NOSONAR: complexity from markdown parsing state machine (section detection, list parsing), safe to keep
    """Parse action items from synthesis markdown and persist to DB."""
    lines = output_md.split("\n")
    in_section = False
    items = []
    for line in lines:
        stripped = line.strip()
        if re.match(r"^##\s+(Action Items|Next Steps)", stripped, re.IGNORECASE):
            in_section = True
            continue
        if in_section and stripped.startswith("## "):
            break
        if not in_section:
            continue
        m = re.match(r"^- \[[ xX]\]\s*(.*)", stripped)
        if not m:
            continue
        text = m.group(1)
        assignee = None
        am = re.match(r"@(\S+?):\s*(.*)", text)
        if am:
            assignee, text = am.group(1), am.group(2)
        priority = "medium"
        pm = re.search(r"\[priority:\s*(high|medium|low)\]\s*$", text)
        if pm:
            priority = pm.group(1)
            text = text[: pm.start()].strip()
        items.append({"id": f"ai_{uuid.uuid4().hex[:8]}", "text": text, "assignee": assignee, "priority": priority})
    if not items:
        return
    now = _now_ms()
    try:
        async with get_db() as db:
            await db.execute("DELETE FROM meeting_action_items WHERE meeting_id = ?", (meeting_id,))
            for i, item in enumerate(items):
                await db.execute(
                    """INSERT INTO meeting_action_items
                       (id, meeting_id, text, assignee_agent_id, priority, status,
                        sort_order, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)""",
                    (item["id"], meeting_id, item["text"], item["assignee"], item["priority"], i, now, now),
                )
            await db.commit()
        logger.info(f"Saved {len(items)} action items for meeting {meeting_id}")
    except Exception as exc:
        logger.error(f"Failed to save action items for {meeting_id}: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────


async def start_meeting(
    config: MeetingConfig,
    title: str = "",
    goal: str = "",
    room_id: Optional[str] = None,
    project_id: Optional[str] = None,
    parent_meeting_id: Optional[str] = None,
) -> Meeting:
    """Create a meeting record and launch the orchestrator as a background task."""
    from app.services.meeting_orchestrator import MeetingOrchestrator

    if len(_active_meetings) >= MAX_CONCURRENT_MEETINGS:
        raise ValueError(f"Maximum {MAX_CONCURRENT_MEETINGS} concurrent meetings allowed")

    if room_id:
        async with get_db() as db:
            async with db.execute(
                "SELECT id FROM meetings WHERE room_id = ? AND state NOT IN ('complete', 'cancelled', 'error')",
                (room_id,),
            ) as cur:
                if await cur.fetchone():
                    raise ValueError(f"A meeting is already in progress in room {room_id}")

    meeting_id = _generate_id()
    now = _now_ms()
    async with get_db() as db:
        await db.execute(
            """INSERT INTO meetings
               (id, title, goal, state, room_id, project_id, config_json,
                current_round, current_turn, parent_meeting_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)""",
            (
                meeting_id,
                title or DEFAULT_MEETING_TITLE,
                goal,
                MeetingState.GATHERING.value,
                room_id,
                project_id,
                config.model_dump_json(),
                parent_meeting_id,
                now,
            ),
        )
        await db.commit()

    orchestrator = MeetingOrchestrator(
        meeting_id=meeting_id,
        config=config,
        title=title or DEFAULT_MEETING_TITLE,
        goal=goal,
        room_id=room_id,
        project_id=project_id,
        parent_meeting_id=parent_meeting_id,
    )
    task = asyncio.create_task(orchestrator.run())
    _active_meetings[meeting_id] = task

    return Meeting(
        id=meeting_id,
        title=title or DEFAULT_MEETING_TITLE,
        goal=goal,
        state=MeetingState.GATHERING,
        room_id=room_id,
        project_id=project_id,
        config=config,
        created_at=now,
    )


async def cancel_meeting(meeting_id: str) -> bool:
    """Cancel a running meeting."""
    task = _active_meetings.get(meeting_id)
    if task and not task.done():
        task.cancel()
        return True
    async with get_db() as db:
        async with db.execute("SELECT state FROM meetings WHERE id = ?", (meeting_id,)) as cur:
            row = await cur.fetchone()
            if not row:
                return False
            if row["state"] in (MeetingState.COMPLETE.value, MeetingState.CANCELLED.value):
                return False
        await db.execute(
            "UPDATE meetings SET state = ?, cancelled_at = ? WHERE id = ?",
            (MeetingState.CANCELLED.value, _now_ms(), meeting_id),
        )
        await db.commit()
    await broadcast(
        "meeting-cancelled",
        {
            "meeting_id": meeting_id,
            "state": "cancelled",
            "cancelled_at": _now_ms(),
        },
    )
    return True


async def get_meeting(meeting_id: str) -> Optional[dict]:
    """Load a meeting from DB with participants, turns, and computed fields."""
    async with get_db() as db:
        async with db.execute("SELECT * FROM meetings WHERE id = ?", (meeting_id,)) as cur:
            row = await cur.fetchone()
            if not row:
                return None
        meeting = dict(row)

        async with db.execute(
            "SELECT * FROM meeting_participants WHERE meeting_id = ? ORDER BY sort_order",
            (meeting_id,),
        ) as cur:
            meeting["participants"] = [dict(r) for r in await cur.fetchall()]

        async with db.execute(
            "SELECT * FROM meeting_turns WHERE meeting_id = ? ORDER BY round_num, turn_index",
            (meeting_id,),
        ) as cur:
            turns = [dict(r) for r in await cur.fetchall()]

    config = json.loads(meeting.get("config_json") or "{}")
    num_rounds = config.get("num_rounds", 3)
    round_topics = config.get("round_topics", [])
    current_round = meeting.get("current_round", 0)
    state = meeting.get("state", "")

    rounds = []
    for rn in range(1, num_rounds + 1):
        round_turns = [t for t in turns if t["round_num"] == rn]
        topic = round_topics[rn - 1] if rn <= len(round_topics) else f"Round {rn}"
        if rn < current_round or state in ("complete", "synthesizing"):
            status = "complete"
        elif rn == current_round and state.startswith("round_"):
            status = "in_progress"
        else:
            status = "pending"
        rounds.append(
            {
                "round_num": rn,
                "topic": topic,
                "status": status,
                "turns": [
                    {
                        "agent_id": t["agent_id"],
                        "agent_name": t["agent_name"],
                        "response": t["response_text"],
                        "started_at": t["started_at"],
                        "completed_at": t["completed_at"],
                    }
                    for t in round_turns
                ],
            }
        )

    total_turns = num_rounds * len(meeting["participants"])
    completed_turns = len(turns)
    if state == "complete":
        progress_pct = 100
    elif state == "synthesizing":
        progress_pct = 90
    elif total_turns > 0:
        progress_pct = min(int((completed_turns / total_turns) * 90), 90)
    else:
        progress_pct = 0

    meeting.update(
        {
            "rounds": rounds,
            "config": config,
            "progress_pct": progress_pct,
            "total_rounds": num_rounds,
            "total_participants": len(meeting["participants"]),
        }
    )
    return meeting


async def list_meetings(
    days: int = 30,
    room_id: Optional[str] = None,
    project_id: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    state_filter: Optional[str] = None,
) -> dict[str, Any]:
    """List recent meetings with pagination. Returns {meetings, total, has_more}."""
    cutoff = _now_ms() - (days * 86400 * 1000)
    where = "WHERE created_at > ?"
    params: list = [cutoff]
    if room_id:
        where += " AND room_id = ?"
        params.append(room_id)
    if project_id:
        where += " AND project_id = ?"
        params.append(project_id)
    if state_filter:
        where += " AND state = ?"
        params.append(state_filter)

    async with get_db() as db:
        async with db.execute(f"SELECT COUNT(*) AS total FROM meetings {where}", params) as cur:
            total = (await cur.fetchone())["total"]
        async with db.execute(
            f"SELECT * FROM meetings {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            params + [limit, offset],
        ) as cur:
            rows = await cur.fetchall()

        results = []
        for row in rows:
            m = dict(row)
            async with db.execute(
                "SELECT agent_name FROM meeting_participants WHERE meeting_id = ? ORDER BY sort_order",
                (m["id"],),
            ) as cur2:
                participant_names = [r["agent_name"] for r in await cur2.fetchall()]
            config = json.loads(m.get("config_json") or "{}")
            duration = None
            if m.get("started_at") and m.get("completed_at"):
                duration = (m["completed_at"] - m["started_at"]) // 1000
            results.append(
                {
                    "id": m["id"],
                    "title": m["title"],
                    "goal": m.get("goal", ""),
                    "state": m["state"],
                    "participant_count": len(participant_names),
                    "participant_names": participant_names,
                    "num_rounds": config.get("num_rounds", 3),
                    "room_id": m.get("room_id"),
                    "project_id": m.get("project_id"),
                    "output_path": m.get("output_path"),
                    "parent_meeting_id": m.get("parent_meeting_id"),
                    "duration_seconds": duration,
                    "created_at": m["created_at"],
                    "completed_at": m.get("completed_at"),
                }
            )

    return {"meetings": results, "total": total, "has_more": (offset + limit) < total}


async def load_document(  # NOSONAR: complexity from path resolution with multiple fallback strategies and error recovery, safe to keep
    document_path: str,
    project_id: Optional[str],
    meeting_id: str,
    _document_context: Optional[str] = None,
) -> Optional[str]:
    """
    Load a document from the project folder for meeting context.
    Returns None and emits an SSE warning if the document cannot be loaded.
    """
    import os
    from pathlib import Path

    if not document_path:
        return None
    if ".." in document_path or document_path.startswith("/"):
        logger.warning(f"Rejected document path (traversal attempt): {document_path}")
        await broadcast(
            "meeting-warning",
            {
                "meeting_id": meeting_id,
                "message": f"Invalid document path: {document_path}",
                "severity": "warning",
            },
        )
        return None

    project_dir = None
    if project_id:
        try:
            async with get_db() as db:
                async with db.execute("SELECT folder_path, name FROM projects WHERE id = ?", (project_id,)) as cur:
                    row = await cur.fetchone()
                    if row and row["folder_path"]:
                        expanded = Path(os.path.expanduser(row["folder_path"]))
                        if expanded.exists():
                            project_dir = expanded
                    if not project_dir and row:
                        slug = re.sub(r"[^a-zA-Z0-9]+", "-", row["name"]).strip("-")
                        candidate = Path.home() / "SynologyDrive" / "ekinbot" / "01-Projects" / slug
                        if candidate.exists():
                            project_dir = candidate
        except Exception as exc:
            logger.warning(f"Could not resolve project folder: {exc}")

    async def _warn(msg: str) -> None:
        await broadcast(
            "meeting-warning",
            {
                "meeting_id": meeting_id,
                "message": msg,
                "severity": "warning",
            },
        )

    if not project_dir:
        await _warn(f"Project folder not found for document: {document_path}")
        return None

    ALLOWED_ROOTS = [
        Path.home() / "SynologyDrive" / "ekinbot" / "01-Projects",
        Path.home() / "Projects",
    ]
    resolved_base = project_dir.resolve()
    if not any(resolved_base.is_relative_to(r) for r in ALLOWED_ROOTS if r.exists()):
        await _warn("Project folder outside allowed roots")
        return None

    full_path = (project_dir / document_path).resolve()
    if not full_path.is_relative_to(resolved_base):
        await _warn("Document path escapes project directory")
        return None
    if not full_path.exists():
        await _warn(f"Document not found: {document_path}")
        return None
    try:
        size = await asyncio.to_thread(lambda: full_path.stat().st_size)
    except OSError:
        await _warn(f"Could not access document: {document_path}")
        return None
    if size > 1_000_000:
        await _warn(f"Document too large (>{size // 1024}KB): {document_path}")
        return None
    try:
        content = await asyncio.to_thread(full_path.read_text, "utf-8")
        max_chars = 12000
        if len(content) > max_chars:
            content = content[:max_chars] + "\n\n[... document truncated for token budget ...]"
        return content
    except Exception:
        await _warn(f"Failed to read document: {document_path}")
        return None
