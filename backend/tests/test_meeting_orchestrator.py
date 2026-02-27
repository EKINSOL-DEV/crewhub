"""Tests for MeetingOrchestrator."""

import os
from unittest.mock import AsyncMock, patch

import pytest

from app.db.meeting_models import MeetingConfig, MeetingState
from app.services.meeting_orchestrator import MeetingOrchestrator


@pytest.fixture
def config():
    return MeetingConfig(
        participants=["agent:bot1:main", "agent:bot2:main"],
        num_rounds=2,
        round_topics=["Topic A", "Topic B"],
        max_tokens_per_turn=100,
        synthesis_max_tokens=300,
    )


@pytest.fixture
def orchestrator(config):
    return MeetingOrchestrator(
        meeting_id="m-test-123",
        config=config,
        title="Test Meeting",
        goal="Discuss testing",
        room_id="room-1",
        project_id="proj-1",
    )


# ── _build_turn_prompt ────────────────────────────────────────────────


class TestBuildTurnPrompt:
    def test_basic_prompt(self, orchestrator):
        participant = {"name": "Bot1", "id": "bot1", "session_key": "agent:bot1:main"}
        prompt = orchestrator._build_turn_prompt(participant, 1, "Topic A", [])
        assert "You are Bot1" in prompt
        assert "Discuss testing" in prompt
        assert "Topic A" in prompt

    def test_prompt_with_previous_responses(self, orchestrator):
        participant = {"name": "Bot2", "id": "bot2", "session_key": "agent:bot2:main"}
        prev = [{"bot_name": "Bot1", "response": "I think we should test more."}]
        prompt = orchestrator._build_turn_prompt(participant, 1, "Topic A", prev)
        assert "Bot1" in prompt
        assert "I think we should test more." in prompt
        assert "Build on what was said" in prompt

    def test_prompt_with_document(self, orchestrator):
        orchestrator._document_content = "Some document text"
        orchestrator.config.document_path = "design.md"
        participant = {"name": "Bot1", "id": "bot1", "session_key": "agent:bot1:main"}
        prompt = orchestrator._build_turn_prompt(participant, 1, "Topic A", [])
        assert "design.md" in prompt
        assert "Some document text" in prompt

    def test_prompt_with_document_context(self, orchestrator):
        orchestrator._document_content = "Doc content"
        orchestrator.config.document_path = "spec.md"
        orchestrator.config.document_context = "Review this spec carefully"
        participant = {"name": "Bot1", "id": "bot1", "session_key": "agent:bot1:main"}
        prompt = orchestrator._build_turn_prompt(participant, 1, "Topic A", [])
        assert "Review this spec carefully" in prompt


# ── _calc_progress ────────────────────────────────────────────────────


class TestCalcProgress:
    def test_zero_participants(self, config):
        config.participants = []
        orch = MeetingOrchestrator("m1", config)
        orch.participants = []
        assert orch._calc_progress(1, 0) == 0

    def test_progress_calculation(self, orchestrator):
        orchestrator.participants = [{"name": "A"}, {"name": "B"}]
        # 2 rounds, 2 participants = 4 total turns
        # After round 1, turn 1: (0*2+1)/4 * 90 = 22
        assert orchestrator._calc_progress(1, 1) == 22
        # After round 1, turn 2: (0*2+2)/4 * 90 = 45
        assert orchestrator._calc_progress(1, 2) == 45

    def test_progress_capped_at_90(self, orchestrator):
        orchestrator.participants = [{"name": "A"}]
        # 2 rounds, 1 participant = 2 total, round 2 turn 1 done = 2/2*90 = 90
        assert orchestrator._calc_progress(2, 1) == 90


# ── _slugify ──────────────────────────────────────────────────────────


class TestSlugify:
    def test_basic(self):
        assert MeetingOrchestrator._slugify("Hello World") == "hello-world"

    def test_special_chars(self):
        assert MeetingOrchestrator._slugify("Test! @#$% Meeting") == "test-meeting"

    def test_max_length(self):
        result = MeetingOrchestrator._slugify("a" * 100, max_len=10)
        assert len(result) <= 10

    def test_trailing_dash(self):
        result = MeetingOrchestrator._slugify("abc---", max_len=5)
        assert not result.endswith("-")


# ── _save_output ──────────────────────────────────────────────────────


class TestSaveOutput:
    def test_save_creates_file(self, orchestrator, tmp_path):
        with patch.dict(os.environ, {"PROJECT_DATA_PATH": str(tmp_path)}):
            path = orchestrator._save_output("# Meeting output")
            assert path is not None
            assert "test-meeting" in path or "discuss-testing" in path
            with open(path) as f:
                assert f.read() == "# Meeting output"

    def test_save_dedup_filename(self, orchestrator, tmp_path):
        with patch.dict(os.environ, {"PROJECT_DATA_PATH": str(tmp_path)}):
            p1 = orchestrator._save_output("first")
            p2 = orchestrator._save_output("second")
            assert p1 != p2
            assert "-2" in p2

    def test_save_generic_title_uses_goal(self, tmp_path):
        config = MeetingConfig(participants=["a"])
        orch = MeetingOrchestrator("m1", config, title="team-meeting", goal="plan sprint")
        with patch.dict(os.environ, {"PROJECT_DATA_PATH": str(tmp_path)}):
            path = orch._save_output("content")
            assert "plan-sprint" in path


# ── cancel ────────────────────────────────────────────────────────────


class TestCancel:
    def test_cancel_sets_flag(self, orchestrator):
        assert not orchestrator._cancelled
        orchestrator.cancel()
        assert orchestrator._cancelled


# ── _get_bot_response_with_retry ──────────────────────────────────────


class TestGetBotResponse:
    @pytest.mark.asyncio
    async def test_success(self, orchestrator):
        mock_mgr = AsyncMock()
        mock_mgr.send_message.return_value = "Hello!"
        with patch("app.services.meeting_orchestrator.get_connection_manager", return_value=mock_mgr):
            result = await orchestrator._get_bot_response_with_retry(
                {"name": "Bot1", "session_key": "agent:bot1:main"}, "prompt"
            )
            assert result == "Hello!"

    @pytest.mark.asyncio
    async def test_retry_on_failure(self, orchestrator):
        mock_mgr = AsyncMock()
        mock_mgr.send_message.side_effect = [Exception("fail"), "recovered"]
        with patch("app.services.meeting_orchestrator.get_connection_manager", return_value=mock_mgr):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                result = await orchestrator._get_bot_response_with_retry(
                    {"name": "Bot1", "session_key": "agent:bot1:main"}, "prompt"
                )
                assert result == "recovered"

    @pytest.mark.asyncio
    async def test_all_retries_fail(self, orchestrator):
        mock_mgr = AsyncMock()
        mock_mgr.send_message.side_effect = Exception("fail")
        with patch("app.services.meeting_orchestrator.get_connection_manager", return_value=mock_mgr):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                result = await orchestrator._get_bot_response_with_retry(
                    {"name": "Bot1", "session_key": "agent:bot1:main"}, "prompt"
                )
                assert result == "[no response]"


# ── _prepare_meeting ──────────────────────────────────────────────────


class TestPrepareMeeting:
    @pytest.mark.asyncio
    async def test_prepare(self, orchestrator):
        participant_info = {"id": "bot1", "name": "Bot1", "session_key": "agent:bot1:main"}
        with (
            patch(
                "app.services.meeting_orchestrator.resolve_agent_info",
                new_callable=AsyncMock,
                return_value=participant_info,
            ),
            patch("app.services.meeting_orchestrator.db_save_participants", new_callable=AsyncMock),
            patch("app.services.meeting_orchestrator.db_set_state", new_callable=AsyncMock),
            patch("app.services.meeting_orchestrator.broadcast", new_callable=AsyncMock),
        ):
            await orchestrator._prepare_meeting()
            assert len(orchestrator.participants) == 2

    @pytest.mark.asyncio
    async def test_prepare_with_document(self, orchestrator):
        orchestrator.config.document_path = "test.md"
        participant_info = {"id": "bot1", "name": "Bot1", "session_key": "agent:bot1:main"}
        with (
            patch(
                "app.services.meeting_orchestrator.resolve_agent_info",
                new_callable=AsyncMock,
                return_value=participant_info,
            ),
            patch(
                "app.services.meeting_orchestrator.load_document", new_callable=AsyncMock, return_value="doc content"
            ),
            patch("app.services.meeting_orchestrator.db_save_participants", new_callable=AsyncMock),
            patch("app.services.meeting_orchestrator.db_set_state", new_callable=AsyncMock),
            patch("app.services.meeting_orchestrator.broadcast", new_callable=AsyncMock),
        ):
            await orchestrator._prepare_meeting()
            assert orchestrator._document_content == "doc content"

    @pytest.mark.asyncio
    async def test_prepare_with_parent_meeting(self, orchestrator):
        orchestrator.parent_meeting_id = "parent-123"
        participant_info = {"id": "bot1", "name": "Bot1", "session_key": "agent:bot1:main"}
        parent_data = {"output_md": "Previous results here"}
        with (
            patch(
                "app.services.meeting_orchestrator.resolve_agent_info",
                new_callable=AsyncMock,
                return_value=participant_info,
            ),
            patch("app.services.meeting_orchestrator.db_save_participants", new_callable=AsyncMock),
            patch("app.services.meeting_orchestrator.db_set_state", new_callable=AsyncMock),
            patch("app.services.meeting_orchestrator.broadcast", new_callable=AsyncMock),
            patch("app.services.meeting_service.get_meeting", new_callable=AsyncMock, return_value=parent_data),
        ):
            await orchestrator._prepare_meeting()
            assert "Previous results here" in (orchestrator._document_content or "")


# ── _synthesize ───────────────────────────────────────────────────────


class TestSynthesize:
    @pytest.mark.asyncio
    async def test_synthesize_success(self, orchestrator):
        orchestrator.participants = [
            {"id": "bot1", "name": "Bot1", "session_key": "agent:bot1:main"},
        ]
        mock_mgr = AsyncMock()
        mock_mgr.send_message.return_value = "# Summary\nGreat meeting"
        turns = [{"round_num": 1, "agent_name": "Bot1", "response": "I said things"}]
        with (
            patch("app.services.meeting_orchestrator.db_load_all_turns", new_callable=AsyncMock, return_value=turns),
            patch("app.services.meeting_orchestrator.get_connection_manager", return_value=mock_mgr),
        ):
            result = await orchestrator._synthesize()
            assert result == "# Summary\nGreat meeting"

    @pytest.mark.asyncio
    async def test_synthesize_fallback(self, orchestrator):
        orchestrator.participants = [
            {"id": "bot1", "name": "Bot1", "session_key": "agent:bot1:main"},
        ]
        mock_mgr = AsyncMock()
        mock_mgr.send_message.side_effect = Exception("fail")
        with (
            patch("app.services.meeting_orchestrator.db_load_all_turns", new_callable=AsyncMock, return_value=[]),
            patch("app.services.meeting_orchestrator.get_connection_manager", return_value=mock_mgr),
        ):
            result = await orchestrator._synthesize()
            assert "# Meeting" in result
            assert "Bot1" in result


# ── run ───────────────────────────────────────────────────────────────


class TestRun:
    @pytest.mark.asyncio
    async def test_run_cancelled(self, orchestrator):
        orchestrator._cancelled = True
        with (
            patch.object(orchestrator, "_prepare_meeting", new_callable=AsyncMock),
            patch("asyncio.sleep", new_callable=AsyncMock),
            patch("app.services.meeting_orchestrator._active_meetings", {}),
        ):
            await orchestrator.run()
            # Should return early after prepare + sleep

    @pytest.mark.asyncio
    async def test_run_exception(self, orchestrator):
        with (
            patch.object(orchestrator, "_prepare_meeting", new_callable=AsyncMock, side_effect=RuntimeError("boom")),
            patch("app.services.meeting_orchestrator.db_set_state", new_callable=AsyncMock) as mock_state,
            patch("app.services.meeting_orchestrator.broadcast", new_callable=AsyncMock),
            patch("app.services.meeting_orchestrator._active_meetings", {}),
        ):
            await orchestrator.run()
            mock_state.assert_called_with("m-test-123", MeetingState.ERROR, error_message="boom")

    @pytest.mark.asyncio
    async def test_run_full_success(self, orchestrator):
        with (
            patch.object(orchestrator, "_prepare_meeting", new_callable=AsyncMock),
            patch.object(orchestrator, "_run_all_rounds", new_callable=AsyncMock),
            patch.object(orchestrator, "_finalize_meeting", new_callable=AsyncMock),
            patch("asyncio.sleep", new_callable=AsyncMock),
            patch("app.services.meeting_orchestrator._active_meetings", {}),
        ):
            await orchestrator.run()


# ── _finalize_meeting ─────────────────────────────────────────────────


class TestFinalizeMeeting:
    @pytest.mark.asyncio
    async def test_finalize(self, orchestrator, tmp_path):
        orchestrator.participants = [{"id": "bot1", "name": "Bot1", "session_key": "agent:bot1:main"}]
        with (
            patch("app.services.meeting_orchestrator.db_set_state", new_callable=AsyncMock),
            patch("app.services.meeting_orchestrator.broadcast", new_callable=AsyncMock),
            patch("app.services.meeting_orchestrator.db_save_action_items", new_callable=AsyncMock),
            patch("app.services.meeting_orchestrator.db_get_started_at", new_callable=AsyncMock, return_value=1000),
            patch("app.services.meeting_orchestrator._now_ms", return_value=5000),
            patch.object(orchestrator, "_synthesize", new_callable=AsyncMock, return_value="# Output"),
            patch.object(orchestrator, "_save_output", return_value="/tmp/output.md"),
        ):
            await orchestrator._finalize_meeting()


# ── _run_round ────────────────────────────────────────────────────────


class TestRunRound:
    @pytest.mark.asyncio
    async def test_run_round(self, orchestrator):
        orchestrator.participants = [
            {"id": "bot1", "name": "Bot1", "session_key": "agent:bot1:main"},
        ]
        with (
            patch("app.services.meeting_orchestrator.broadcast", new_callable=AsyncMock),
            patch("app.services.meeting_orchestrator.db_update_current_turn", new_callable=AsyncMock),
            patch("app.services.meeting_orchestrator.db_save_turn", new_callable=AsyncMock),
            patch("app.services.meeting_orchestrator._now_ms", return_value=1000),
            patch.object(orchestrator, "_get_bot_response_with_retry", new_callable=AsyncMock, return_value="response"),
        ):
            await orchestrator._run_round(1, "Topic A")

    @pytest.mark.asyncio
    async def test_run_round_cancelled(self, orchestrator):
        orchestrator.participants = [{"id": "bot1", "name": "Bot1", "session_key": "agent:bot1:main"}]
        orchestrator._cancelled = True
        await orchestrator._run_round(1, "Topic A")
