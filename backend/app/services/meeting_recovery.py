"""Recovery logic for meetings stuck in non-terminal states after restart."""

import logging
import time

from app.db.database import get_db
from app.db.meeting_models import MeetingState
from app.routes.sse import broadcast

logger = logging.getLogger(__name__)

TERMINAL_STATES = (
    MeetingState.COMPLETE.value,
    MeetingState.CANCELLED.value,
    MeetingState.ERROR.value,
)


async def recover_stuck_meetings() -> int:
    """Mark non-terminal meetings as error on startup. Returns count recovered."""
    now_ms = int(time.time() * 1000)
    recovered = 0

    async with get_db() as db:
        async with db.execute(
            "SELECT id, state, title FROM meetings WHERE state NOT IN (?, ?, ?)",
            TERMINAL_STATES,
        ) as cur:
            rows = await cur.fetchall()

        for row in rows:
            meeting_id = row["id"]
            old_state = row["state"]
            logger.warning(
                f"Recovering stuck meeting {meeting_id} (was {old_state})"
            )
            await db.execute(
                "UPDATE meetings SET state = ?, error_message = ? WHERE id = ?",
                (MeetingState.ERROR.value, "orchestrator_restart", meeting_id),
            )
            recovered += 1

            # Notify frontend
            try:
                await broadcast("meeting-error", {
                    "meeting_id": meeting_id,
                    "state": "error",
                    "error": "orchestrator_restart",
                    "previous_state": old_state,
                })
            except Exception:
                pass  # SSE may not have clients yet at startup

        if recovered:
            await db.commit()

    return recovered
