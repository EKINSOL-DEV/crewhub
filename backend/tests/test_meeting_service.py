"""Tests for app.services.meeting_service."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.db.meeting_models import Meeting, MeetingConfig, MeetingState, Turn
from app.services.meeting_service import (
    DEFAULT_MEETING_TITLE,
    MAX_CONCURRENT_MEETINGS,
    _active_meetings,
    _parse_action_item_line,
    _parse_action_items,
    cancel_meeting,
    db_load_all_turns,
    db_save_action_items,
    db_save_participants,
    db_save_turn,
    db_set_state,
    db_update_current_turn,
    get_meeting,
    list_meetings,
    load_document,
    resolve_agent_info,
    start_meeting,
)

# ── Helpers ──────────────────────────────────────────────────────────────────


def _make_row(data: dict):
    """Create a dict-like row that supports both key and index access."""

    class Row(dict):
        def __getitem__(self, key):
            return super().__getitem__(key)

    return Row(data)


def _make_cursor(rows):
    """Create an async context manager mock that yields a cursor with fetchone/fetchall."""
    cur = AsyncMock()
    if isinstance(rows, list):
        cur.fetchall = AsyncMock(return_value=rows)
        cur.fetchone = AsyncMock(return_value=rows[0] if rows else None)
    else:
        cur.fetchone = AsyncMock(return_value=rows)
        cur.fetchall = AsyncMock(return_value=[rows] if rows else [])
    return cur


def _make_db(execute_side_effects=None):
    """Create a mock DB context manager."""
    db = AsyncMock()
    db.commit = AsyncMock()

    if execute_side_effects:
        cursors = [_make_cursor(r) for r in execute_side_effects]
        # Each db.execute call returns a context manager yielding the cursor
        cms = []
        for c in cursors:
            cm = AsyncMock()
            cm.__aenter__ = AsyncMock(return_value=c)
            cm.__aexit__ = AsyncMock(return_value=False)
            cms.append(cm)
        db.execute = MagicMock(side_effect=cms)
    else:
        db.execute = AsyncMock()

    ctx = AsyncMock()
    ctx.__aenter__ = AsyncMock(return_value=db)
    ctx.__aexit__ = AsyncMock(return_value=False)
    return ctx, db


# ── _parse_action_item_line ──────────────────────────────────────────────────


class TestParseActionItemLine:
    def test_basic_item(self):
        result = _parse_action_item_line("- [ ] Do something")
        assert result is not None
        assert result["text"] == "Do something"
        assert result["assignee"] is None
        assert result["priority"] == "medium"

    def test_checked_item(self):
        result = _parse_action_item_line("- [x] Done thing")
        assert result is not None
        assert result["text"] == "Done thing"

    def test_with_assignee(self):
        result = _parse_action_item_line("- [ ] @alice: Fix the bug")
        assert result["assignee"] == "alice"
        assert result["text"] == "Fix the bug"

    def test_with_priority(self):
        result = _parse_action_item_line("- [ ] Urgent task [priority: high]")
        assert result["priority"] == "high"
        assert "priority" not in result["text"]

    def test_with_assignee_and_priority(self):
        result = _parse_action_item_line("- [ ] @bob: Deploy [priority: low]")
        assert result["assignee"] == "bob"
        assert result["priority"] == "low"
        assert result["text"] == "Deploy"

    def test_non_matching_line(self):
        assert _parse_action_item_line("Just a regular line") is None
        assert _parse_action_item_line("* bullet point") is None


# ── _parse_action_items ──────────────────────────────────────────────────────


class TestParseActionItems:
    def test_extracts_from_section(self):
        md = """## Summary
Some summary text.

## Action Items
- [ ] First task
- [x] Second task
- [ ] @dev: Third task [priority: high]

## Notes
Other stuff.
"""
        items = _parse_action_items(md)
        assert len(items) == 3
        assert items[0]["text"] == "First task"
        assert items[2]["assignee"] == "dev"
        assert items[2]["priority"] == "high"

    def test_next_steps_heading(self):
        md = """## Next Steps
- [ ] Do this
"""
        items = _parse_action_items(md)
        assert len(items) == 1

    def test_no_section(self):
        assert _parse_action_items("## Summary\nNo items here") == []

    def test_empty(self):
        assert _parse_action_items("") == []

    def test_stops_at_next_section(self):
        md = """## Action Items
- [ ] Real item
## Other Section
- [ ] Not an action item
"""
        items = _parse_action_items(md)
        assert len(items) == 1


# ── resolve_agent_info ───────────────────────────────────────────────────────


class TestResolveAgentInfo:
    @pytest.mark.asyncio
    async def test_found_in_db(self):
        row = _make_row(
            {"id": "a1", "name": "Alice", "icon": "🤖", "color": "#fff", "agent_session_key": "agent:a1:main"}
        )
        ctx, db = _make_db([row])
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            result = await resolve_agent_info("a1")
        assert result["name"] == "Alice"
        assert result["session_key"] == "agent:a1:main"

    @pytest.mark.asyncio
    async def test_not_found_fallback(self):
        ctx, db = _make_db([None])
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            result = await resolve_agent_info("agent:bob:main")
        assert result["name"] == "bob"
        assert result["id"] == "agent:bob:main"

    @pytest.mark.asyncio
    async def test_db_error_fallback(self):
        ctx = AsyncMock()
        ctx.__aenter__ = AsyncMock(side_effect=Exception("db down"))
        ctx.__aexit__ = AsyncMock(return_value=False)
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            result = await resolve_agent_info("simple")
        assert result["name"] == "simple"


# ── db_set_state ─────────────────────────────────────────────────────────────


class TestDbSetState:
    @pytest.mark.asyncio
    async def test_basic_state_update(self):
        ctx, db = _make_db()
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            await db_set_state("m1", MeetingState.GATHERING)
        db.execute.assert_called_once()
        sql = db.execute.call_args[0][0]
        assert "state = ?" in sql
        assert "started_at = ?" in sql  # GATHERING sets started_at

    @pytest.mark.asyncio
    async def test_complete_sets_completed_at(self):
        ctx, db = _make_db()
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            await db_set_state("m1", MeetingState.COMPLETE, output_md="# Done")
        sql = db.execute.call_args[0][0]
        assert "completed_at = ?" in sql
        assert "output_md = ?" in sql

    @pytest.mark.asyncio
    async def test_cancelled_sets_cancelled_at(self):
        ctx, db = _make_db()
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            await db_set_state("m1", MeetingState.CANCELLED, error_message="stopped")
        sql = db.execute.call_args[0][0]
        assert "cancelled_at = ?" in sql
        assert "error_message = ?" in sql

    @pytest.mark.asyncio
    async def test_with_round_and_output_path(self):
        ctx, db = _make_db()
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            await db_set_state("m1", MeetingState.ROUND_1, current_round=1, output_path="/tmp/out.md")
        sql = db.execute.call_args[0][0]
        assert "current_round = ?" in sql
        assert "output_path = ?" in sql


# ── db_update_current_turn ───────────────────────────────────────────────────


class TestDbUpdateCurrentTurn:
    @pytest.mark.asyncio
    async def test_updates(self):
        ctx, db = _make_db()
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            await db_update_current_turn("m1", 2, 3)
        db.execute.assert_called_once()
        args = db.execute.call_args[0]
        assert args[1] == (2, 3, "m1")


# ── db_save_participants ─────────────────────────────────────────────────────


class TestDbSaveParticipants:
    @pytest.mark.asyncio
    async def test_saves_multiple(self):
        ctx, db = _make_db()
        participants = [
            {"id": "a1", "name": "Alice", "icon": "🤖", "color": "#f00"},
            {"id": "a2", "name": "Bob"},
        ]
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            await db_save_participants("m1", participants)
        assert db.execute.call_count == 2
        db.commit.assert_called_once()


# ── db_save_turn ─────────────────────────────────────────────────────────────


class TestDbSaveTurn:
    @pytest.mark.asyncio
    async def test_saves_turn(self):
        turn = Turn(
            id="t1", meeting_id="m1", round_num=1, turn_index=0, agent_id="a1", agent_name="Alice", response="Hello"
        )
        ctx, db = _make_db()
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            await db_save_turn(turn)
        db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_estimates_tokens_from_response(self):
        turn = Turn(id="t1", meeting_id="m1", round_num=1, turn_index=0, agent_id="a1", response="A" * 100)
        ctx, db = _make_db()
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            await db_save_turn(turn)
        # response_tokens should be estimated as max(1, len/4) = 25
        params = db.execute.call_args[0][1]
        assert params[8] == 25  # response_tokens position


# ── db_load_all_turns ────────────────────────────────────────────────────────


class TestDbLoadAllTurns:
    @pytest.mark.asyncio
    async def test_loads(self):
        rows = [
            _make_row(
                {"round_num": 1, "turn_index": 0, "agent_id": "a1", "agent_name": "Alice", "response_text": "Hi"}
            ),
        ]
        cur = _make_cursor(rows)
        ctx, db = _make_db()
        cm = AsyncMock()
        cm.__aenter__ = AsyncMock(return_value=cur)
        cm.__aexit__ = AsyncMock(return_value=False)
        db.execute = MagicMock(return_value=cm)
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            result = await db_load_all_turns("m1")
        assert len(result) == 1
        assert result[0]["response"] == "Hi"


# ── db_save_action_items ─────────────────────────────────────────────────────


class TestDbSaveActionItems:
    @pytest.mark.asyncio
    async def test_saves_parsed_items(self):
        md = "## Action Items\n- [ ] Task one\n- [ ] @dev: Task two [priority: high]\n"
        ctx, db = _make_db()
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            await db_save_action_items("m1", md)
        # 1 DELETE + 2 INSERTs
        assert db.execute.call_count == 3

    @pytest.mark.asyncio
    async def test_no_items_noop(self):
        ctx, db = _make_db()
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            await db_save_action_items("m1", "No action items here")
        db.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_db_error_logged(self):
        md = "## Action Items\n- [ ] Task\n"
        ctx = AsyncMock()
        ctx.__aenter__ = AsyncMock(side_effect=Exception("db error"))
        ctx.__aexit__ = AsyncMock(return_value=False)
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            # Should not raise
            await db_save_action_items("m1", md)


# ── start_meeting ────────────────────────────────────────────────────────────


class TestStartMeeting:
    @pytest.mark.asyncio
    async def test_creates_meeting(self):
        config = MeetingConfig(participants=["a1", "a2"])
        ctx, db = _make_db()
        saved = _active_meetings.copy()
        try:
            with (
                patch("app.services.meeting_service.get_db", return_value=ctx),
                patch("app.services.meeting_orchestrator.MeetingOrchestrator") as MockOrch,
            ):
                mock_instance = MockOrch.return_value
                mock_instance.run = AsyncMock()
                result = await start_meeting(config, title="Test", goal="Goal")
            assert isinstance(result, Meeting)
            assert result.title == "Test"
            assert result.state == MeetingState.GATHERING
        finally:
            # Clean up active meetings
            for k in list(_active_meetings.keys()):
                if k not in saved:
                    task = _active_meetings.pop(k)
                    task.cancel()

    @pytest.mark.asyncio
    async def test_max_concurrent_limit(self):
        saved = _active_meetings.copy()
        try:
            for i in range(MAX_CONCURRENT_MEETINGS):
                task = MagicMock()
                _active_meetings[f"fake_{i}"] = task
            config = MeetingConfig(participants=["a1"])
            with pytest.raises(ValueError, match="Maximum"):
                await start_meeting(config)
        finally:
            _active_meetings.clear()
            _active_meetings.update(saved)

    @pytest.mark.asyncio
    async def test_room_already_in_use(self):
        row = _make_row({"id": "existing"})
        cur = _make_cursor(row)
        ctx, db = _make_db()
        cm = AsyncMock()
        cm.__aenter__ = AsyncMock(return_value=cur)
        cm.__aexit__ = AsyncMock(return_value=False)
        db.execute = MagicMock(return_value=cm)
        config = MeetingConfig(participants=["a1"])
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            with pytest.raises(ValueError, match="already in progress"):
                await start_meeting(config, room_id="room1")

    @pytest.mark.asyncio
    async def test_default_title(self):
        config = MeetingConfig(participants=["a1"])
        ctx, db = _make_db()
        saved = _active_meetings.copy()
        try:
            with (
                patch("app.services.meeting_service.get_db", return_value=ctx),
                patch("app.services.meeting_orchestrator.MeetingOrchestrator") as MockOrch,
            ):
                mock_instance = MockOrch.return_value
                mock_instance.run = AsyncMock()
                result = await start_meeting(config)
            assert result.title == DEFAULT_MEETING_TITLE
        finally:
            for k in list(_active_meetings.keys()):
                if k not in saved:
                    task = _active_meetings.pop(k)
                    task.cancel()


# ── cancel_meeting ───────────────────────────────────────────────────────────


class TestCancelMeeting:
    @pytest.mark.asyncio
    async def test_cancel_active_task(self):
        saved = _active_meetings.copy()
        try:
            task = MagicMock()
            task.done.return_value = False
            task.cancel = MagicMock()
            _active_meetings["m1"] = task
            result = await cancel_meeting("m1")
            assert result is True
            task.cancel.assert_called_once()
        finally:
            _active_meetings.clear()
            _active_meetings.update(saved)

    @pytest.mark.asyncio
    async def test_cancel_db_meeting(self):
        row = _make_row({"state": "gathering"})
        cur1 = _make_cursor(row)
        cm1 = AsyncMock()
        cm1.__aenter__ = AsyncMock(return_value=cur1)
        cm1.__aexit__ = AsyncMock(return_value=False)

        ctx, db = _make_db()
        execute_mock = AsyncMock()
        call_count = [0]

        def side_effect(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return cm1
            return execute_mock(*args, **kwargs)

        db.execute = MagicMock(side_effect=side_effect)

        with (
            patch("app.services.meeting_service.get_db", return_value=ctx),
            patch("app.services.meeting_service.broadcast", new_callable=AsyncMock),
        ):
            result = await cancel_meeting("m1")
        assert result is True

    @pytest.mark.asyncio
    async def test_cancel_not_found(self):
        cur = _make_cursor(None)
        cm = AsyncMock()
        cm.__aenter__ = AsyncMock(return_value=cur)
        cm.__aexit__ = AsyncMock(return_value=False)
        ctx, db = _make_db()
        db.execute = MagicMock(return_value=cm)
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            result = await cancel_meeting("nonexistent")
        assert result is False

    @pytest.mark.asyncio
    async def test_cancel_already_complete(self):
        row = _make_row({"state": "complete"})
        cur = _make_cursor(row)
        cm = AsyncMock()
        cm.__aenter__ = AsyncMock(return_value=cur)
        cm.__aexit__ = AsyncMock(return_value=False)
        ctx, db = _make_db()
        db.execute = MagicMock(return_value=cm)
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            result = await cancel_meeting("m1")
        assert result is False


# ── get_meeting ──────────────────────────────────────────────────────────────


class TestGetMeeting:
    @pytest.mark.asyncio
    async def test_not_found(self):
        cur = _make_cursor(None)
        cm = AsyncMock()
        cm.__aenter__ = AsyncMock(return_value=cur)
        cm.__aexit__ = AsyncMock(return_value=False)
        ctx, db = _make_db()
        db.execute = MagicMock(return_value=cm)
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            result = await get_meeting("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_found_with_rounds(self):
        meeting_row = _make_row(
            {
                "id": "m1",
                "title": "Test",
                "goal": "G",
                "state": "complete",
                "room_id": None,
                "project_id": None,
                "config_json": json.dumps({"num_rounds": 2, "round_topics": ["T1", "T2"]}),
                "current_round": 2,
                "current_turn": 0,
                "parent_meeting_id": None,
                "created_at": 1000,
                "started_at": 1000,
                "completed_at": 2000,
                "output_md": "# Out",
                "output_path": None,
                "error_message": None,
            }
        )
        participant_row = _make_row(
            {
                "meeting_id": "m1",
                "agent_id": "a1",
                "agent_name": "Alice",
                "agent_icon": None,
                "agent_color": None,
                "sort_order": 0,
            }
        )
        turn_row = _make_row(
            {
                "round_num": 1,
                "turn_index": 0,
                "agent_id": "a1",
                "agent_name": "Alice",
                "response_text": "Hi",
                "started_at": 1000,
                "completed_at": 1100,
            }
        )

        # 3 execute calls: meeting, participants, turns
        cur1 = _make_cursor(meeting_row)
        cur2 = _make_cursor([participant_row])
        cur3 = _make_cursor([turn_row])

        cms = []
        for c in [cur1, cur2, cur3]:
            cm = AsyncMock()
            cm.__aenter__ = AsyncMock(return_value=c)
            cm.__aexit__ = AsyncMock(return_value=False)
            cms.append(cm)

        ctx, db = _make_db()
        db.execute = MagicMock(side_effect=cms)

        with patch("app.services.meeting_service.get_db", return_value=ctx):
            result = await get_meeting("m1")
        assert result is not None
        assert result["progress_pct"] == 100
        assert len(result["rounds"]) == 2
        assert result["rounds"][0]["turns"][0]["response"] == "Hi"
        assert result["total_rounds"] == 2


# ── list_meetings ────────────────────────────────────────────────────────────


class TestListMeetings:
    @pytest.mark.asyncio
    async def test_empty(self):
        cur_count = _make_cursor(_make_row({"total": 0}))
        cur_rows = _make_cursor([])

        cms = []
        for c in [cur_count, cur_rows]:
            cm = AsyncMock()
            cm.__aenter__ = AsyncMock(return_value=c)
            cm.__aexit__ = AsyncMock(return_value=False)
            cms.append(cm)

        ctx, db = _make_db()
        db.execute = MagicMock(side_effect=cms)

        with patch("app.services.meeting_service.get_db", return_value=ctx):
            result = await list_meetings()
        assert result["total"] == 0
        assert result["meetings"] == []
        assert result["has_more"] is False

    @pytest.mark.asyncio
    async def test_with_filters(self):
        meeting_row = _make_row(
            {
                "id": "m1",
                "title": "Test",
                "goal": "",
                "state": "complete",
                "room_id": "r1",
                "project_id": "p1",
                "config_json": "{}",
                "started_at": 1000,
                "completed_at": 2000,
                "created_at": 1000,
                "output_path": None,
                "parent_meeting_id": None,
            }
        )
        cur_count = _make_cursor(_make_row({"total": 1}))
        cur_rows = _make_cursor([meeting_row])
        cur_parts = _make_cursor([_make_row({"agent_name": "Alice"})])

        cms = []
        for c in [cur_count, cur_rows, cur_parts]:
            cm = AsyncMock()
            cm.__aenter__ = AsyncMock(return_value=c)
            cm.__aexit__ = AsyncMock(return_value=False)
            cms.append(cm)

        ctx, db = _make_db()
        db.execute = MagicMock(side_effect=cms)

        with patch("app.services.meeting_service.get_db", return_value=ctx):
            result = await list_meetings(room_id="r1", project_id="p1", state_filter="complete")
        assert result["total"] == 1
        assert result["meetings"][0]["duration_seconds"] == 1


# ── load_document ────────────────────────────────────────────────────────────


class TestLoadDocument:
    @pytest.mark.asyncio
    async def test_empty_path(self):
        result = await load_document("", None, "m1")
        assert result is None

    @pytest.mark.asyncio
    async def test_path_traversal_rejected(self):
        with patch("app.services.meeting_service._meeting_warn", new_callable=AsyncMock):
            result = await load_document("../../etc/passwd", None, "m1")
        assert result is None

    @pytest.mark.asyncio
    async def test_absolute_path_rejected(self):
        with patch("app.services.meeting_service._meeting_warn", new_callable=AsyncMock):
            result = await load_document("/etc/passwd", None, "m1")
        assert result is None

    @pytest.mark.asyncio
    async def test_no_project_dir(self):
        with (
            patch("app.services.meeting_service._resolve_project_dir", new_callable=AsyncMock, return_value=None),
            patch("app.services.meeting_service._meeting_warn", new_callable=AsyncMock),
        ):
            result = await load_document("doc.md", "p1", "m1")
        assert result is None


# ── db_get_started_at ────────────────────────────────────────────────────────


class TestDbGetStartedAt:
    @pytest.mark.asyncio
    async def test_returns_value(self):
        from app.services.meeting_service import db_get_started_at

        row = _make_row({"started_at": 12345})
        cur = _make_cursor(row)
        cm = AsyncMock()
        cm.__aenter__ = AsyncMock(return_value=cur)
        cm.__aexit__ = AsyncMock(return_value=False)
        ctx, db = _make_db()
        db.execute = MagicMock(return_value=cm)
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            result = await db_get_started_at("m1")
        assert result == 12345

    @pytest.mark.asyncio
    async def test_fallback_when_none(self):
        from app.services.meeting_service import db_get_started_at

        row = _make_row({"started_at": None})
        cur = _make_cursor(row)
        cm = AsyncMock()
        cm.__aenter__ = AsyncMock(return_value=cur)
        cm.__aexit__ = AsyncMock(return_value=False)
        ctx, db = _make_db()
        db.execute = MagicMock(return_value=cm)
        with patch("app.services.meeting_service.get_db", return_value=ctx):
            result = await db_get_started_at("m1")
        assert isinstance(result, int)
        assert result > 0
