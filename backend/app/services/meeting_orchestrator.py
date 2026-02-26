"""
MeetingOrchestrator — AI-orchestrated round-robin meeting engine.

Runs as an asyncio.Task. Manages state machine, bot turns, synthesis, and
file output. All SQL lives in meeting_service.py.

Re-exports: start_meeting, cancel_meeting, get_meeting, list_meetings
(unchanged public API for routes).
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from app.db.meeting_models import (
    ROUND_STATES,
    MeetingConfig,
    MeetingState,
    Turn,
)
from app.routes.sse import broadcast
from app.services.connections import get_connection_manager
from app.services.meeting_service import (
    _active_meetings,
    _now_ms,
    cancel_meeting,  # noqa: F401
    db_get_started_at,
    db_load_all_turns,
    db_save_action_items,
    db_save_participants,
    db_save_turn,
    db_set_state,
    db_update_current_turn,
    get_meeting,  # noqa: F401
    list_meetings,  # noqa: F401
    load_document,
    resolve_agent_info,
    # Re-export public API so existing imports keep working
    start_meeting,  # noqa: F401
)

logger = logging.getLogger(__name__)

TURN_TIMEOUT = 30.0
MAX_RETRIES_PER_TURN = 1


class MeetingOrchestrator:
    """Orchestrates a single meeting through all phases."""

    def __init__(
        self,
        meeting_id: str,
        config: MeetingConfig,
        title: str = "",
        goal: str = "",
        room_id: Optional[str] = None,
        project_id: Optional[str] = None,
        parent_meeting_id: Optional[str] = None,
    ):
        self.meeting_id = meeting_id
        self.config = config
        self.title = title
        self.goal = goal
        self.room_id = room_id
        self.project_id = project_id
        self.parent_meeting_id = parent_meeting_id
        self.participants: list[dict] = []
        self._cancelled = False
        self._document_content: Optional[str] = None

    # ── Public API ────────────────────────────────────────────────────────────

    async def run(self):  # NOSONAR: complexity from meeting lifecycle state machine (phases, signals, retries), safe to keep
        """Run the full meeting lifecycle."""
        try:
            self.participants = [await resolve_agent_info(p) for p in self.config.participants]
            if self.config.document_path:
                self._document_content = await load_document(
                    self.config.document_path,
                    self.project_id,
                    self.meeting_id,
                    self.config.document_context,
                )
            if self.parent_meeting_id:
                from app.services.meeting_service import get_meeting as _get

                parent = await _get(self.parent_meeting_id)
                if parent and parent.get("output_md"):
                    self._document_content = f"## Previous Meeting Results\n\n{parent['output_md']}\n\n---\n\n" + (
                        self._document_content or ""
                    )
            await db_save_participants(self.meeting_id, self.participants)
            await db_set_state(self.meeting_id, MeetingState.GATHERING)
            await broadcast(
                "meeting-started",
                {
                    "meeting_id": self.meeting_id,
                    "title": self.title,
                    "state": MeetingState.GATHERING.value,
                    "participants": [p["session_key"] for p in self.participants],
                    "num_rounds": self.config.num_rounds,
                    "total_rounds": self.config.num_rounds,
                },
            )
            await asyncio.sleep(3)
            if self._cancelled:
                return

            for round_num in range(1, self.config.num_rounds + 1):
                if self._cancelled:
                    return
                round_state = ROUND_STATES.get(round_num, MeetingState.ROUND_1)
                round_topic = (
                    self.config.round_topics[round_num - 1]
                    if round_num <= len(self.config.round_topics)
                    else f"Round {round_num}"
                )
                await db_set_state(self.meeting_id, round_state, current_round=round_num)
                prev_state = (
                    ROUND_STATES.get(round_num - 1, MeetingState.GATHERING).value
                    if round_num > 1
                    else MeetingState.GATHERING.value
                )
                await broadcast(
                    "meeting-state",
                    {
                        "meeting_id": self.meeting_id,
                        "state": round_state.value,
                        "previous_state": prev_state,
                        "current_round": round_num,
                        "round_topic": round_topic,
                        "progress_pct": self._calc_progress(round_num, 0),
                    },
                )
                await self._run_round(round_num, round_topic)

            if self._cancelled:
                return

            await db_set_state(self.meeting_id, MeetingState.SYNTHESIZING)
            await broadcast(
                "meeting-synthesis",
                {
                    "meeting_id": self.meeting_id,
                    "state": "synthesizing",
                    "progress_pct": 90,
                },
            )
            output_md = await self._synthesize()
            output_path = self._save_output(output_md)
            await db_save_action_items(self.meeting_id, output_md)
            duration = (_now_ms() - (await db_get_started_at(self.meeting_id))) // 1000
            await db_set_state(
                self.meeting_id,
                MeetingState.COMPLETE,
                output_md=output_md,
                output_path=output_path,
            )
            await broadcast(
                "meeting-complete",
                {
                    "meeting_id": self.meeting_id,
                    "state": "complete",
                    "output_path": output_path,
                    "progress_pct": 100,
                    "duration_seconds": duration,
                },
            )
        except asyncio.CancelledError:
            logger.info(f"Meeting {self.meeting_id} cancelled")
            await db_set_state(self.meeting_id, MeetingState.CANCELLED)
            await broadcast(
                "meeting-cancelled",
                {
                    "meeting_id": self.meeting_id,
                    "state": "cancelled",
                    "cancelled_at": _now_ms(),
                },
            )
            raise
        except Exception as exc:
            logger.error(f"Meeting {self.meeting_id} failed: {exc}", exc_info=True)
            await db_set_state(self.meeting_id, MeetingState.ERROR, error_message=str(exc))
            await broadcast(
                "meeting-error",
                {
                    "meeting_id": self.meeting_id,
                    "state": "error",
                    "error": str(exc),
                },
            )
        finally:
            _active_meetings.pop(self.meeting_id, None)

    def cancel(self):
        self._cancelled = True

    # ── Round-robin engine ────────────────────────────────────────────────────

    async def _run_round(self, round_num: int, round_topic: str):
        """Execute one round — each participant speaks in order."""
        cumulative_context: list[dict] = []
        for i, participant in enumerate(self.participants):
            if self._cancelled:
                return
            turn_id = f"{self.meeting_id}_r{round_num}_t{i}"
            await broadcast(
                "meeting-turn-start",
                {
                    "meeting_id": self.meeting_id,
                    "round": round_num,
                    "agent_id": participant["id"],
                    "agent_name": participant["name"],
                    "turn_index": i,
                    "total_turns": len(self.participants),
                },
            )
            await db_update_current_turn(self.meeting_id, round_num, i)
            prompt = self._build_turn_prompt(
                participant=participant,
                round_num=round_num,
                round_topic=round_topic,
                previous_responses=cumulative_context,
            )
            started_at = _now_ms()
            response = await self._get_bot_response_with_retry(participant, prompt)
            completed_at = _now_ms()
            cumulative_context.append({"bot_name": participant["name"], "response": response})
            await db_save_turn(
                Turn(
                    id=turn_id,
                    meeting_id=self.meeting_id,
                    round_num=round_num,
                    turn_index=i,
                    agent_id=participant["id"],
                    agent_name=participant["name"],
                    response=response,
                    prompt_tokens=max(1, len(prompt) // 4),
                    started_at=started_at,
                    completed_at=completed_at,
                )
            )
            await broadcast(
                "meeting-turn",
                {
                    "meeting_id": self.meeting_id,
                    "round": round_num,
                    "agent_id": participant["id"],
                    "agent_name": participant["name"],
                    "response": response,
                    "turn_index": i,
                    "total_turns": len(self.participants),
                    "progress_pct": self._calc_progress(round_num, i + 1),
                },
            )

    def _build_turn_prompt(
        self,
        participant: dict,
        round_num: int,
        round_topic: str,
        previous_responses: list[dict],
    ) -> str:
        lines = [f"You are {participant['name']} in a meeting."]
        if self.goal:
            lines.append(f"Meeting topic: {self.goal}")
        if self._document_content:
            doc_name = self.config.document_path or "document"
            lines.append(f"\nDocument: {doc_name}")
            if self.config.document_context:
                lines.append(f"\n{self.config.document_context}")
            lines.append(f"\n--- Document Content ---\n{self._document_content}\n---")
        lines.append(f"\nRound {round_num}/{self.config.num_rounds}: {round_topic}")
        if previous_responses:
            lines.append("\nPrevious speakers in this round:")
            for resp in previous_responses:
                lines.append(f"- **{resp['bot_name']}**: {resp['response']}")
            lines.append("\nBuild on what was said. Don't repeat. Add your unique perspective.")
        lines.append(
            f"\nRespond concisely (2-3 sentences max, max ~{self.config.max_tokens_per_turn} tokens)."
            " Be specific and actionable."
        )
        return "\n".join(lines)

    async def _get_bot_response_with_retry(self, participant: dict, prompt: str) -> str:
        for attempt in range(1 + MAX_RETRIES_PER_TURN):
            try:
                response = await self._get_bot_response(participant, prompt)
                if response:
                    return response
            except Exception as exc:
                logger.warning(f"Turn attempt {attempt + 1} failed for {participant['name']}: {exc}")
                if attempt < MAX_RETRIES_PER_TURN:
                    await asyncio.sleep(2)
        return "[no response]"

    async def _get_bot_response(self, participant: dict, prompt: str) -> Optional[str]:
        manager = await get_connection_manager()
        return await manager.send_message(
            session_key=participant["session_key"],
            message=prompt,
            timeout=TURN_TIMEOUT,
        )

    # ── Synthesis ─────────────────────────────────────────────────────────────

    async def _synthesize(self) -> str:
        """Generate structured meeting summary from all turns."""
        all_turns = await db_load_all_turns(self.meeting_id)
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
            turns_fmt = "\n".join(f"- **{t['agent_name']}**: {t['response']}" for t in round_turns)
            rounds_text.append(f"### Round {round_num}: {topic}\n{turns_fmt}")
        all_rounds = "\n\n".join(rounds_text)
        today = datetime.now().strftime("%Y-%m-%d")
        participant_names = ", ".join(p["name"] for p in self.participants)

        synthesis_prompt = (
            f"Synthesize this meeting into a structured summary.\n\n"
            f"Meeting: {self.title}\nGoal: {self.goal}\nDate: {today}\n"
            f"Participants: {participant_names}\n\n{all_rounds}\n\n"
            f"Output format (use these EXACT headers in this order):\n\n"
            f"# Meeting — {today}\n\n## Goal\n{self.goal or self.title}\n\n"
            f"## Participants\n- List each participant by name\n\n"
            f"## Discussion Summary\nKey points organized by theme (not by person)\n\n"
            f"## Action Items\nUse this EXACT format for each action item:\n"
            f"- [ ] @{{agent_name}}: {{action item description}} [priority: high/medium/low]\n\n"
            f"## Decisions\n- Any decisions or agreements reached\n\n"
            f"## Blockers\n- Unresolved blockers that need attention\n\n"
            f"Keep total output under ~{self.config.synthesis_max_tokens} tokens.\n"
            f"Respond ONLY with the markdown. No extra commentary."
        )
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
            except Exception as exc:
                logger.warning(f"Synthesis failed via {participant['name']}: {exc}")
        return (
            f"# Meeting — {today}\n\n## Goal\n{self.goal or self.title}\n\n"
            f"## Participants\n"
            + "\n".join(f"- {p['name']}" for p in self.participants)
            + f"\n\n## Discussion\n\n{all_rounds}\n"
        )

    # ── Output ────────────────────────────────────────────────────────────────

    @staticmethod
    def _slugify(text: str, max_len: int = 40) -> str:
        text = text.lower().strip()
        text = re.sub(r"[^a-z0-9\s-]", "", text)
        text = re.sub(r"[\s-]+", "-", text)
        return text[:max_len].rstrip("-")

    def _save_output(self, output_md: str) -> Optional[str]:
        """Save meeting output markdown to disk."""
        data_path = os.environ.get("PROJECT_DATA_PATH") or str(
            Path.home() / "SynologyDrive" / "ekinbot" / "01-Projects"
        )
        today = datetime.now().strftime("%Y-%m-%d")
        meetings_dir = Path(data_path) / "meetings"
        meetings_dir.mkdir(parents=True, exist_ok=True)
        topic_slug = self._slugify(self.title or self.goal or "meeting")
        if topic_slug in ("team-meeting", "meeting", "daily-standup"):
            topic_slug = self._slugify(self.goal) if self.goal else "meeting"
        if not topic_slug:
            topic_slug = "meeting"
        base_name = f"{today}-{topic_slug}"
        filename = f"{base_name}.md"
        counter = 2
        while (meetings_dir / filename).exists():
            filename = f"{base_name}-{counter}.md"
            counter += 1
        output_path = meetings_dir / filename
        output_path.write_text(output_md, encoding="utf-8")
        logger.info(f"Meeting output saved to {output_path}")
        return str(output_path)

    # ── Progress ──────────────────────────────────────────────────────────────

    def _calc_progress(self, current_round: int, completed_turns_in_round: int) -> int:
        total_turns = self.config.num_rounds * len(self.participants)
        if total_turns == 0:
            return 0
        completed = (current_round - 1) * len(self.participants) + completed_turns_in_round
        return min(int((completed / total_turns) * 90), 90)
