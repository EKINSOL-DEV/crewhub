"""
MeetingOrchestrator — AI-orchestrated round-robin meeting engine.

Runs as an asyncio.Task. Manages state machine, bot turns, synthesis, and output.
"""

import asyncio
import json
import logging
import os
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import aiosqlite

from app.db.database import DB_PATH
from app.db.meeting_models import (
    Meeting,
    MeetingConfig,
    MeetingState,
    MeetingParticipant,
    Turn,
    ROUND_STATES,
)
from app.routes.sse import broadcast
from app.services.connections import get_connection_manager

logger = logging.getLogger(__name__)

# Constraints
TURN_TIMEOUT = 30.0  # seconds per turn
GATEWAY_RECONNECT_TIMEOUT = 60.0  # seconds
MAX_RETRIES_PER_TURN = 1
MAX_CONCURRENT_MEETINGS = 3

# Active orchestrators (meeting_id -> task)
_active_meetings: dict[str, asyncio.Task] = {}


def _now_ms() -> int:
    return int(time.time() * 1000)


def _generate_id() -> str:
    return f"mtg_{uuid.uuid4().hex[:8]}"


async def _resolve_agent_info(agent_id: str) -> dict:
    """Look up agent name/icon/color from DB. Falls back to agent_id."""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
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
    except Exception as e:
        logger.warning(f"Could not resolve agent {agent_id}: {e}")
    # Fallback: treat as session key
    parts = agent_id.split(":")
    name = parts[1] if len(parts) > 1 else agent_id
    return {"id": agent_id, "name": name, "icon": None, "color": None, "session_key": agent_id}


class MeetingOrchestrator:
    """Orchestrates a single meeting through all phases."""

    def __init__(self, meeting_id: str, config: MeetingConfig, title: str = "", goal: str = "",
                 room_id: Optional[str] = None, project_id: Optional[str] = None):
        self.meeting_id = meeting_id
        self.config = config
        self.title = title
        self.goal = goal
        self.room_id = room_id
        self.project_id = project_id
        self.participants: list[dict] = []  # resolved agent info dicts
        self._cancelled = False

    # =========================================================================
    # Public API
    # =========================================================================

    async def run(self):
        """Main entry point — runs the full meeting lifecycle."""
        try:
            # Resolve participants
            self.participants = [await _resolve_agent_info(p) for p in self.config.participants]

            # Save participants to DB
            await self._save_participants()

            # Transition: GATHERING
            await self._set_state(MeetingState.GATHERING)
            await broadcast("meeting-started", {
                "meeting_id": self.meeting_id,
                "title": self.title,
                "state": MeetingState.GATHERING.value,
                "participants": [p["session_key"] for p in self.participants],
            })

            # Brief gathering pause (frontend animation time)
            await asyncio.sleep(3)

            if self._cancelled:
                return

            # Run rounds
            for round_num in range(1, self.config.num_rounds + 1):
                if self._cancelled:
                    return

                round_state = ROUND_STATES.get(round_num, MeetingState.ROUND_1)
                round_topic = (
                    self.config.round_topics[round_num - 1]
                    if round_num <= len(self.config.round_topics)
                    else f"Round {round_num}"
                )

                await self._set_state(round_state, current_round=round_num)
                await broadcast("meeting-state", {
                    "meeting_id": self.meeting_id,
                    "state": round_state.value,
                    "previous_state": ROUND_STATES.get(round_num - 1, MeetingState.GATHERING).value if round_num > 1 else MeetingState.GATHERING.value,
                    "current_round": round_num,
                    "round_topic": round_topic,
                    "progress_pct": self._calc_progress(round_num, 0),
                })

                await self._run_round(round_num, round_topic)

            if self._cancelled:
                return

            # Synthesis
            await self._set_state(MeetingState.SYNTHESIZING)
            await broadcast("meeting-synthesis", {
                "meeting_id": self.meeting_id,
                "state": "synthesizing",
                "progress_pct": 90,
            })

            output_md = await self._synthesize()

            # Save output
            output_path = await self._save_output(output_md)

            # Complete
            duration = (_now_ms() - (await self._get_started_at())) // 1000
            await self._set_state(MeetingState.COMPLETE, output_md=output_md, output_path=output_path)
            await broadcast("meeting-complete", {
                "meeting_id": self.meeting_id,
                "state": "complete",
                "output_path": output_path,
                "progress_pct": 100,
                "duration_seconds": duration,
            })

        except asyncio.CancelledError:
            logger.info(f"Meeting {self.meeting_id} cancelled via task cancellation")
            await self._set_state(MeetingState.CANCELLED)
        except Exception as e:
            logger.error(f"Meeting {self.meeting_id} failed: {e}", exc_info=True)
            await self._set_state(MeetingState.ERROR, error_message=str(e))
            await broadcast("meeting-error", {
                "meeting_id": self.meeting_id,
                "state": "error",
                "error": str(e),
            })
        finally:
            _active_meetings.pop(self.meeting_id, None)

    def cancel(self):
        self._cancelled = True

    # =========================================================================
    # Round-Robin Engine
    # =========================================================================

    async def _run_round(self, round_num: int, round_topic: str):
        """Execute one round — each participant speaks in order with cumulative context."""
        cumulative_context: list[dict] = []

        for i, participant in enumerate(self.participants):
            if self._cancelled:
                return

            turn_id = f"{self.meeting_id}_r{round_num}_t{i}"

            # Broadcast turn start
            await broadcast("meeting-turn-start", {
                "meeting_id": self.meeting_id,
                "round": round_num,
                "agent_id": participant["id"],
                "agent_name": participant["name"],
                "turn_index": i,
                "total_turns": len(self.participants),
            })

            await self._update_current_turn(round_num, i)

            # Build prompt
            prompt = self._build_turn_prompt(
                participant=participant,
                round_num=round_num,
                round_topic=round_topic,
                previous_responses=cumulative_context,
            )

            # Get response with retry
            started_at = _now_ms()
            response = await self._get_bot_response_with_retry(
                participant=participant,
                prompt=prompt,
            )
            completed_at = _now_ms()

            cumulative_context.append({
                "bot_name": participant["name"],
                "response": response,
            })

            # Save turn
            await self._save_turn(Turn(
                id=turn_id,
                meeting_id=self.meeting_id,
                round_num=round_num,
                turn_index=i,
                agent_id=participant["id"],
                agent_name=participant["name"],
                response=response,
                started_at=started_at,
                completed_at=completed_at,
            ))

            # Broadcast turn complete
            progress = self._calc_progress(round_num, i + 1)
            await broadcast("meeting-turn", {
                "meeting_id": self.meeting_id,
                "round": round_num,
                "agent_id": participant["id"],
                "agent_name": participant["name"],
                "response": response,
                "turn_index": i,
                "total_turns": len(self.participants),
                "progress_pct": progress,
            })

    def _build_turn_prompt(self, participant: dict, round_num: int, round_topic: str,
                           previous_responses: list[dict]) -> str:
        lines = [
            f"You are {participant['name']} in a stand-up meeting.",
        ]
        if self.goal:
            lines.append(f"Meeting topic: {self.goal}")
        lines.append(f"\nRound {round_num}/{self.config.num_rounds}: {round_topic}")

        if previous_responses:
            lines.append("\nPrevious speakers in this round:")
            for resp in previous_responses:
                lines.append(f"- **{resp['bot_name']}**: {resp['response']}")
            lines.append("\nBuild on what was said. Don't repeat. Add your unique perspective.")

        lines.append("\nRespond concisely (2-3 sentences max). Be specific and actionable.")
        return "\n".join(lines)

    async def _get_bot_response_with_retry(self, participant: dict, prompt: str) -> str:
        """Get a response from a bot with one retry on failure."""
        for attempt in range(1 + MAX_RETRIES_PER_TURN):
            try:
                response = await self._get_bot_response(participant, prompt)
                if response:
                    return response
            except Exception as e:
                logger.warning(
                    f"Turn attempt {attempt + 1} failed for {participant['name']}: {e}"
                )
                if attempt < MAX_RETRIES_PER_TURN:
                    await asyncio.sleep(2)

        return "[no response]"

    async def _get_bot_response(self, participant: dict, prompt: str) -> Optional[str]:
        """Send prompt to a bot via ConnectionManager and return the response."""
        manager = await get_connection_manager()
        session_key = participant["session_key"]

        response = await manager.send_message(
            session_key=session_key,
            message=prompt,
            timeout=TURN_TIMEOUT,
        )
        return response

    # =========================================================================
    # Synthesis
    # =========================================================================

    async def _synthesize(self) -> str:
        """Generate structured meeting summary from all turns."""
        all_turns = await self._load_all_turns()

        # Build turn text grouped by round
        rounds_text = []
        for round_num in range(1, self.config.num_rounds + 1):
            topic = (
                self.config.round_topics[round_num - 1]
                if round_num <= len(self.config.round_topics)
                else f"Round {round_num}"
            )
            round_turns = [t for t in all_turns if t["round_num"] == round_num]
            if not round_turns:
                continue
            turns_formatted = "\n".join(
                f"- **{t['agent_name']}**: {t['response']}" for t in round_turns
            )
            rounds_text.append(f"### Round {round_num}: {topic}\n{turns_formatted}")

        all_rounds = "\n\n".join(rounds_text)
        today = datetime.now().strftime("%Y-%m-%d")
        participant_names = ", ".join(p["name"] for p in self.participants)

        synthesis_prompt = f"""Synthesize this stand-up meeting into a structured summary.

Meeting: {self.title}
Goal: {self.goal}
Date: {today}
Participants: {participant_names}

{all_rounds}

Output format (Markdown):
# Stand-Up Meeting — {today}

## Goal
{self.goal or self.title}

## Participants
- List each with their name

## Discussion Summary
Key points organized by theme (not by person)

## Action Items
- [ ] Specific, assigned action items extracted from discussion

## Decisions
- Any decisions or agreements reached

## Blockers
- Unresolved blockers that need attention

Respond ONLY with the markdown. No extra commentary."""

        # Use first participant (or any available) to generate synthesis
        for participant in self.participants:
            try:
                manager = await get_connection_manager()
                response = await manager.send_message(
                    session_key=participant["session_key"],
                    message=synthesis_prompt,
                    timeout=60.0,
                )
                if response:
                    return response
            except Exception as e:
                logger.warning(f"Synthesis failed via {participant['name']}: {e}")

        # Fallback: build a basic summary ourselves
        return f"# Stand-Up Meeting — {today}\n\n## Goal\n{self.goal or self.title}\n\n## Participants\n" + \
               "\n".join(f"- {p['name']}" for p in self.participants) + \
               f"\n\n## Discussion\n\n{all_rounds}\n"

    # =========================================================================
    # Output
    # =========================================================================

    async def _save_output(self, output_md: str) -> Optional[str]:
        """Save meeting output to Synology Drive."""
        data_path = os.environ.get("PROJECT_DATA_PATH", "")
        if not data_path:
            # Fallback to home SynologyDrive
            data_path = str(Path.home() / "SynologyDrive" / "ekinbot" / "01-Projects")

        today = datetime.now().strftime("%Y-%m-%d")
        meetings_dir = Path(data_path) / "meetings"
        meetings_dir.mkdir(parents=True, exist_ok=True)

        # Find unique filename
        base_name = f"{today}-standup"
        filename = f"{base_name}.md"
        counter = 2
        while (meetings_dir / filename).exists():
            filename = f"{base_name}-{counter}.md"
            counter += 1

        output_path = meetings_dir / filename
        output_path.write_text(output_md, encoding="utf-8")
        logger.info(f"Meeting output saved to {output_path}")
        return str(output_path)

    # =========================================================================
    # Database Operations
    # =========================================================================

    async def _set_state(self, state: MeetingState, current_round: Optional[int] = None,
                         output_md: Optional[str] = None, output_path: Optional[str] = None,
                         error_message: Optional[str] = None):
        """Update meeting state in DB."""
        now = _now_ms()
        async with aiosqlite.connect(DB_PATH) as db:
            updates = ["state = ?"]
            params: list = [state.value]

            if current_round is not None:
                updates.append("current_round = ?")
                params.append(current_round)
            if output_md is not None:
                updates.append("output_md = ?")
                params.append(output_md)
            if output_path is not None:
                updates.append("output_path = ?")
                params.append(output_path)
            if error_message is not None:
                updates.append("error_message = ?")
                params.append(error_message)
            if state == MeetingState.COMPLETE:
                updates.append("completed_at = ?")
                params.append(now)
            if state == MeetingState.CANCELLED:
                updates.append("cancelled_at = ?")
                params.append(now)
            if state == MeetingState.GATHERING:
                updates.append("started_at = ?")
                params.append(now)

            params.append(self.meeting_id)
            await db.execute(
                f"UPDATE meetings SET {', '.join(updates)} WHERE id = ?",
                params,
            )
            await db.commit()

    async def _update_current_turn(self, round_num: int, turn_index: int):
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "UPDATE meetings SET current_round = ?, current_turn = ? WHERE id = ?",
                (round_num, turn_index, self.meeting_id),
            )
            await db.commit()

    async def _save_participants(self):
        async with aiosqlite.connect(DB_PATH) as db:
            for i, p in enumerate(self.participants):
                await db.execute(
                    "INSERT OR REPLACE INTO meeting_participants (meeting_id, agent_id, agent_name, agent_icon, agent_color, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
                    (self.meeting_id, p["id"], p["name"], p.get("icon"), p.get("color"), i),
                )
            await db.commit()

    async def _save_turn(self, turn: Turn):
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                """INSERT OR REPLACE INTO meeting_turns 
                   (id, meeting_id, round_num, turn_index, agent_id, agent_name, response_text, started_at, completed_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (turn.id, turn.meeting_id, turn.round_num, turn.turn_index,
                 turn.agent_id, turn.agent_name, turn.response, turn.started_at, turn.completed_at),
            )
            await db.commit()

    async def _load_all_turns(self) -> list[dict]:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM meeting_turns WHERE meeting_id = ? ORDER BY round_num, turn_index",
                (self.meeting_id,),
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

    async def _get_started_at(self) -> int:
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute(
                "SELECT started_at FROM meetings WHERE id = ?", (self.meeting_id,)
            ) as cur:
                row = await cur.fetchone()
                return row[0] if row and row[0] else _now_ms()

    # =========================================================================
    # Progress
    # =========================================================================

    def _calc_progress(self, current_round: int, completed_turns_in_round: int) -> int:
        """Calculate progress percentage (0-90 for rounds, 90-100 for synthesis)."""
        total_turns = self.config.num_rounds * len(self.participants)
        if total_turns == 0:
            return 0
        completed = (current_round - 1) * len(self.participants) + completed_turns_in_round
        return min(int((completed / total_turns) * 90), 90)


# =============================================================================
# Module-level helpers
# =============================================================================


async def start_meeting(config: MeetingConfig, title: str = "", goal: str = "",
                        room_id: Optional[str] = None, project_id: Optional[str] = None) -> Meeting:
    """Create a meeting record and launch the orchestrator as a background task."""
    # Check concurrency
    active_count = len(_active_meetings)
    if active_count >= MAX_CONCURRENT_MEETINGS:
        raise ValueError(f"Maximum {MAX_CONCURRENT_MEETINGS} concurrent meetings allowed")

    # Check room conflict
    if room_id:
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute(
                "SELECT id FROM meetings WHERE room_id = ? AND state NOT IN ('complete', 'cancelled', 'error')",
                (room_id,),
            ) as cur:
                if await cur.fetchone():
                    raise ValueError(f"A meeting is already in progress in room {room_id}")

    meeting_id = _generate_id()
    now = _now_ms()

    # Create DB record
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO meetings (id, title, goal, state, room_id, project_id, config_json, current_round, current_turn, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)""",
            (meeting_id, title or "Daily Standup", goal, MeetingState.GATHERING.value,
             room_id, project_id, config.model_dump_json(), now),
        )
        await db.commit()

    # Create and launch orchestrator
    orchestrator = MeetingOrchestrator(
        meeting_id=meeting_id,
        config=config,
        title=title or "Daily Standup",
        goal=goal,
        room_id=room_id,
        project_id=project_id,
    )
    task = asyncio.create_task(orchestrator.run())
    _active_meetings[meeting_id] = task

    # Return meeting object
    return Meeting(
        id=meeting_id,
        title=title or "Daily Standup",
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

    # Update DB directly if task is gone
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT state FROM meetings WHERE id = ?", (meeting_id,)
        ) as cur:
            row = await cur.fetchone()
            if not row:
                return False
            if row[0] in (MeetingState.COMPLETE.value, MeetingState.CANCELLED.value):
                return False

        await db.execute(
            "UPDATE meetings SET state = ?, cancelled_at = ? WHERE id = ?",
            (MeetingState.CANCELLED.value, _now_ms(), meeting_id),
        )
        await db.commit()

    await broadcast("meeting-cancelled", {
        "meeting_id": meeting_id,
        "state": "cancelled",
        "cancelled_at": _now_ms(),
    })
    return True


async def get_meeting(meeting_id: str) -> Optional[dict]:
    """Load a meeting from DB with participants and turns."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        async with db.execute("SELECT * FROM meetings WHERE id = ?", (meeting_id,)) as cur:
            row = await cur.fetchone()
            if not row:
                return None

        meeting = dict(row)

        # Load participants
        async with db.execute(
            "SELECT * FROM meeting_participants WHERE meeting_id = ? ORDER BY sort_order",
            (meeting_id,),
        ) as cur:
            meeting["participants"] = [dict(r) for r in await cur.fetchall()]

        # Load turns grouped by round
        async with db.execute(
            "SELECT * FROM meeting_turns WHERE meeting_id = ? ORDER BY round_num, turn_index",
            (meeting_id,),
        ) as cur:
            turns = [dict(r) for r in await cur.fetchall()]

        # Parse config
        config = json.loads(meeting.get("config_json") or "{}")
        num_rounds = config.get("num_rounds", 3)
        round_topics = config.get("round_topics", [])

        # Build rounds structure
        rounds = []
        for rn in range(1, num_rounds + 1):
            round_turns = [t for t in turns if t["round_num"] == rn]
            topic = round_topics[rn - 1] if rn <= len(round_topics) else f"Round {rn}"

            # Determine round status
            current_round = meeting.get("current_round", 0)
            state = meeting.get("state", "")
            if rn < current_round or state in ("complete", "synthesizing"):
                status = "complete"
            elif rn == current_round and state.startswith("round_"):
                status = "in_progress"
            else:
                status = "pending"

            rounds.append({
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
            })

        # Calculate progress
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

        meeting["rounds"] = rounds
        meeting["config"] = config
        meeting["progress_pct"] = progress_pct
        meeting["total_rounds"] = num_rounds
        meeting["total_participants"] = len(meeting["participants"])

        return meeting


async def list_meetings(days: int = 30, room_id: Optional[str] = None,
                        project_id: Optional[str] = None, limit: int = 20) -> list[dict]:
    """List recent meetings."""
    cutoff = _now_ms() - (days * 86400 * 1000)

    query = "SELECT * FROM meetings WHERE created_at > ?"
    params: list = [cutoff]

    if room_id:
        query += " AND room_id = ?"
        params.append(room_id)
    if project_id:
        query += " AND project_id = ?"
        params.append(project_id)

    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(query, params) as cur:
            rows = await cur.fetchall()

        results = []
        for row in rows:
            m = dict(row)
            # Get participant count
            async with db.execute(
                "SELECT COUNT(*) FROM meeting_participants WHERE meeting_id = ?",
                (m["id"],),
            ) as cur2:
                m["participant_count"] = (await cur2.fetchone())[0]
            results.append({
                "id": m["id"],
                "title": m["title"],
                "state": m["state"],
                "participant_count": m["participant_count"],
                "room_id": m.get("room_id"),
                "project_id": m.get("project_id"),
                "output_path": m.get("output_path"),
                "created_at": m["created_at"],
                "completed_at": m.get("completed_at"),
            })

        return results
