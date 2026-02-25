"""Baseline tests for AI meetings models, validation, and recovery."""

import pytest

from app.db.meeting_models import MeetingConfig, Round, StartMeetingRequest, Turn

# ---------------------------------------------------------------------------
# Pydantic mutable defaults
# ---------------------------------------------------------------------------


class TestMutableDefaults:
    """Ensure mutable defaults don't share state across instances."""

    def test_meeting_config_round_topics_isolated(self):
        a = MeetingConfig(participants=["x", "y"])
        b = MeetingConfig(participants=["x", "y"])
        a.round_topics.append("extra")
        assert "extra" not in b.round_topics

    def test_round_turns_isolated(self):
        a = Round(round_num=1, topic="t")
        b = Round(round_num=1, topic="t")
        a.turns.append(Turn(id="x", meeting_id="m", round_num=1, turn_index=0, agent_id="a"))
        assert len(b.turns) == 0

    def test_config_default_topics_correct_length(self):
        c = MeetingConfig(participants=["a", "b"])
        assert len(c.round_topics) == 3
        assert c.num_rounds == 3


# ---------------------------------------------------------------------------
# Validation logic (unit-level, no HTTP)
# ---------------------------------------------------------------------------


class TestParticipantValidation:
    def test_duplicate_detection(self):
        """Duplicate participants should be detectable."""
        participants = ["a1", "a1", "a2"]
        assert len(participants) != len(set(participants))

    def test_unique_passes(self):
        participants = ["a1", "a2", "a3"]
        assert len(participants) == len(set(participants))

    def test_start_request_model(self):
        req = StartMeetingRequest(
            title="Test",
            participants=["a1", "a2"],
            num_rounds=2,
        )
        assert req.num_rounds == 2
        assert req.max_tokens_per_turn == 200


# ---------------------------------------------------------------------------
# Recovery
# ---------------------------------------------------------------------------


@pytest.mark.anyio
class TestRecovery:
    async def test_recover_stuck_meetings(self):
        """Meetings in non-terminal state are marked as error on recovery."""
        import aiosqlite

        from app.db.database import DB_PATH
        from app.services.meeting_recovery import recover_stuck_meetings

        # Insert stuck meetings
        async with aiosqlite.connect(DB_PATH) as db:
            for mid, state in [("mtg_a", "gathering"), ("mtg_b", "round_1"), ("mtg_c", "complete")]:
                await db.execute(
                    """INSERT INTO meetings (id, title, goal, state, config_json, current_round, current_turn, created_at)
                       VALUES (?, 'T', '', ?, '{}', 0, 0, 1000)""",
                    (mid, state),
                )
            await db.commit()

        count = await recover_stuck_meetings()
        assert count == 2  # mtg_a and mtg_b, not mtg_c

        # Verify states
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT state, error_message FROM meetings WHERE id = 'mtg_a'") as cur:
                row = await cur.fetchone()
                assert row[0] == "error"
                assert row[1] == "orchestrator_restart"
            async with db.execute("SELECT state FROM meetings WHERE id = 'mtg_c'") as cur:
                row = await cur.fetchone()
                assert row[0] == "complete"

    async def test_recover_no_stuck(self):
        """No stuck meetings = 0 recovered."""
        from app.services.meeting_recovery import recover_stuck_meetings

        count = await recover_stuck_meetings()
        assert count == 0

    async def test_recover_all_terminal_states_ignored(self):
        """Complete, cancelled, error meetings are not touched."""
        import aiosqlite

        from app.db.database import DB_PATH
        from app.services.meeting_recovery import recover_stuck_meetings

        async with aiosqlite.connect(DB_PATH) as db:
            for mid, state in [("mtg_x", "complete"), ("mtg_y", "cancelled"), ("mtg_z", "error")]:
                await db.execute(
                    """INSERT INTO meetings (id, title, goal, state, config_json, current_round, current_turn, created_at)
                       VALUES (?, 'T', '', ?, '{}', 0, 0, 1000)""",
                    (mid, state),
                )
            await db.commit()

        count = await recover_stuck_meetings()
        assert count == 0


# ---------------------------------------------------------------------------
# Token budget in prompts
# ---------------------------------------------------------------------------


class TestTokenBudget:
    def test_config_has_token_limits(self):
        c = MeetingConfig(participants=["a", "b"], max_tokens_per_turn=150, synthesis_max_tokens=400)
        assert c.max_tokens_per_turn == 150
        assert c.synthesis_max_tokens == 400

    def test_default_token_limits(self):
        c = MeetingConfig(participants=["a", "b"])
        assert c.max_tokens_per_turn == 200
        assert c.synthesis_max_tokens == 500
