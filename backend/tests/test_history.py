"""Tests for app.services.history."""

import json
from unittest.mock import patch

import pytest

from app.services.history import (
    _collect_agent_dirs,
    _determine_minion_type,
    _extract_message_stats,
    _extract_path_metadata,
    _find_session_file,
    _is_session_file_candidate,
    _matches_session_filters,
    _parse_session_file,
    _read_jsonl_messages,
    _safe_id,
    _update_time_bounds,
    delete_session,
    get_archived_sessions,
    get_session_detail,
    get_statistics,
)

# ── _safe_id ─────────────────────────────────────────────────────────────────


class TestSafeId:
    def test_valid(self):
        assert _safe_id("main") == "main"
        assert _safe_id("abc-123_XYZ") == "abc-123_XYZ"

    def test_invalid(self):
        with pytest.raises(ValueError):
            _safe_id("")
        with pytest.raises(ValueError):
            _safe_id("../hack")
        with pytest.raises(ValueError):
            _safe_id("a b c")


# ── _read_jsonl_messages ─────────────────────────────────────────────────────


class TestReadJsonlMessages:
    def test_reads_valid(self, tmp_path):
        f = tmp_path / "test.jsonl"
        f.write_text('{"role":"user","text":"hi"}\n{"role":"assistant","text":"hello"}\n')
        msgs = _read_jsonl_messages(f)
        assert len(msgs) == 2
        assert msgs[0]["role"] == "user"

    def test_skips_invalid_json(self, tmp_path):
        f = tmp_path / "test.jsonl"
        f.write_text('{"valid":true}\nnot json\n{"also":true}\n')
        msgs = _read_jsonl_messages(f)
        assert len(msgs) == 2

    def test_skips_empty_lines(self, tmp_path):
        f = tmp_path / "test.jsonl"
        f.write_text('\n{"a":1}\n\n')
        assert len(_read_jsonl_messages(f)) == 1


# ── _extract_path_metadata ──────────────────────────────────────────────────


class TestExtractPathMetadata:
    def test_sessions_dir(self, tmp_path):
        p = tmp_path / "main" / "sessions" / "abc123.jsonl"
        agent_id, session_id, status = _extract_path_metadata(p)
        assert agent_id == "main"
        assert session_id == "abc123"
        assert status == "archived"

    def test_archive_dir(self, tmp_path):
        p = tmp_path / "dev" / "archive" / "sess1.jsonl"
        agent_id, session_id, status = _extract_path_metadata(p)
        assert agent_id == "dev"
        assert session_id == "sess1"
        assert status == "archived"

    def test_deleted_marker(self, tmp_path):
        p = tmp_path / "main" / "sessions" / "abc123.jsonl.deleted.2026-01-01"
        agent_id, session_id, status = _extract_path_metadata(p)
        # stem is "abc123.jsonl.deleted", split on DELETED_MARKER gives "abc123.jsonl"
        # then the code splits on DELETED_MARKER in the name
        assert "abc123" in session_id
        assert status == "deleted"


# ── _update_time_bounds ──────────────────────────────────────────────────────


class TestUpdateTimeBounds:
    def test_initial(self):
        s, e = _update_time_bounds({"ts": 100}, None, None)
        assert s == 100 and e == 100

    def test_updates_bounds(self):
        s, e = _update_time_bounds({"ts": 50}, 100, 200)
        assert s == 50 and e == 200
        s, e = _update_time_bounds({"ts": 300}, 100, 200)
        assert s == 100 and e == 300

    def test_no_timestamp(self):
        s, e = _update_time_bounds({}, 10, 20)
        assert s == 10 and e == 20

    def test_timestamp_key(self):
        s, e = _update_time_bounds({"timestamp": 42}, None, None)
        assert s == 42


# ── _extract_message_stats ───────────────────────────────────────────────────


class TestExtractMessageStats:
    def test_basic(self):
        messages = [
            {"role": "user", "ts": 100, "channel": "whatsapp"},
            {"role": "assistant", "ts": 200, "model": "claude", "text": "Hello there"},
        ]
        stats = _extract_message_stats(messages)
        assert stats["started_at"] == 100
        assert stats["ended_at"] == 200
        assert stats["model"] == "claude"
        assert stats["last_assistant_text"] == "Hello there"
        assert stats["channel"] == "whatsapp"

    def test_uses_content_fallback(self):
        messages = [{"role": "assistant", "content": "fallback text", "ts": 1}]
        stats = _extract_message_stats(messages)
        assert stats["last_assistant_text"] == "fallback text"

    def test_label_tracking(self):
        messages = [{"label": "my-label", "ts": 1}, {"ts": 2}]
        stats = _extract_message_stats(messages)
        assert stats["label"] == "my-label"

    def test_empty(self):
        stats = _extract_message_stats([])
        assert stats["started_at"] is None
        assert stats["model"] is None

    def test_truncates_long_text(self):
        messages = [{"role": "assistant", "text": "x" * 500, "ts": 1}]
        stats = _extract_message_stats(messages)
        assert len(stats["last_assistant_text"]) == 200


# ── _determine_minion_type ───────────────────────────────────────────────────


class TestDetermineMinionType:
    def test_subagent(self):
        assert _determine_minion_type("subagent-abc123", "main") == "subagent"

    def test_cron(self):
        assert _determine_minion_type("cron-daily", "main") == "cron"

    def test_non_main_agent(self):
        assert _determine_minion_type("sess1", "dev") == "dev"

    def test_main(self):
        assert _determine_minion_type("regular-session", "main") == "main"


# ── _is_session_file_candidate ───────────────────────────────────────────────


class TestIsSessionFileCandidate:
    def test_jsonl_file(self, tmp_path):
        f = tmp_path / "test.jsonl"
        f.touch()
        assert _is_session_file_candidate(f, False) is True

    def test_deleted_excluded(self, tmp_path):
        f = tmp_path / "test.jsonl.deleted.2026"
        f.touch()
        assert _is_session_file_candidate(f, False) is False
        assert _is_session_file_candidate(f, True) is True

    def test_directory_excluded(self, tmp_path):
        d = tmp_path / "subdir.jsonl"
        d.mkdir()
        assert _is_session_file_candidate(d, False) is False

    def test_non_jsonl(self, tmp_path):
        f = tmp_path / "test.txt"
        f.touch()
        assert _is_session_file_candidate(f, False) is False


# ── _parse_session_file ─────────────────────────────────────────────────────


class TestParseSessionFile:
    def test_valid_file(self, tmp_path):
        sessions = tmp_path / "main" / "sessions"
        sessions.mkdir(parents=True)
        f = sessions / "sess1.jsonl"
        f.write_text(
            '{"role":"user","ts":100,"text":"hi"}\n{"role":"assistant","ts":200,"text":"hello","model":"claude"}\n'
        )
        result = _parse_session_file(f)
        assert result is not None
        assert result["session_id"] == "sess1"
        assert result["agent_id"] == "main"
        assert result["message_count"] == 2
        assert result["model"] == "claude"

    def test_empty_file(self, tmp_path):
        f = tmp_path / "empty.jsonl"
        f.write_text("")
        assert _parse_session_file(f) is None

    def test_with_label(self, tmp_path):
        sessions = tmp_path / "dev" / "sessions"
        sessions.mkdir(parents=True)
        f = sessions / "s1.jsonl"
        f.write_text('{"label":"my-task","ts":1}\n')
        result = _parse_session_file(f)
        assert result["display_name"] == "my-task"
        assert result["summary"] == "my-task"

    def test_long_summary_truncated(self, tmp_path):
        sessions = tmp_path / "main" / "sessions"
        sessions.mkdir(parents=True)
        f = sessions / "s1.jsonl"
        f.write_text(json.dumps({"role": "assistant", "text": "x" * 300, "ts": 1}) + "\n")
        result = _parse_session_file(f)
        assert len(result["summary"]) <= 103  # 100 + "..."


# ── _collect_agent_dirs ──────────────────────────────────────────────────────


class TestCollectAgentDirs:
    def test_specific_agent(self, tmp_path):
        (tmp_path / "main" / "sessions").mkdir(parents=True)
        (tmp_path / "main" / "archive").mkdir(parents=True)
        with patch("app.services.history.OPENCLAW_BASE", tmp_path):
            dirs = _collect_agent_dirs("main")
        assert len(dirs) == 2

    def test_invalid_agent_id(self):
        dirs = _collect_agent_dirs("../hack")
        assert dirs == []

    def test_all_agents(self, tmp_path):
        (tmp_path / "main" / "sessions").mkdir(parents=True)
        (tmp_path / "dev" / "archive").mkdir(parents=True)
        with patch("app.services.history.OPENCLAW_BASE", tmp_path):
            dirs = _collect_agent_dirs(None)
        assert len(dirs) == 2


# ── _matches_session_filters ────────────────────────────────────────────────


class TestMatchesSessionFilters:
    def test_no_filters(self):
        assert _matches_session_filters({"minion_type": "main"}, None, None, None, None) is True

    def test_type_filter(self):
        s = {"minion_type": "subagent"}
        assert _matches_session_filters(s, "subagent", None, None, None) is True
        assert _matches_session_filters(s, "main", None, None, None) is False

    def test_date_range(self):
        s = {"ended_at": 500}
        assert _matches_session_filters(s, None, 100, 1000, None) is True
        assert _matches_session_filters(s, None, 600, None, None) is False
        assert _matches_session_filters(s, None, None, 400, None) is False

    def test_search(self):
        s = {"display_name": "My Task", "summary": "Does something"}
        assert _matches_session_filters(s, None, None, None, "task") is True
        assert _matches_session_filters(s, None, None, None, "something") is True
        assert _matches_session_filters(s, None, None, None, "xyz") is False

    def test_date_with_zero_ended_at(self):
        s = {"ended_at": 0}
        assert _matches_session_filters(s, None, 100, None, None) is False


# ── get_archived_sessions ───────────────────────────────────────────────────


class TestGetArchivedSessions:
    def test_no_base(self, tmp_path):
        with patch("app.services.history.OPENCLAW_BASE", tmp_path / "nonexistent"):
            result = get_archived_sessions()
        assert result["total"] == 0

    def test_with_sessions(self, tmp_path):
        sessions = tmp_path / "main" / "sessions"
        sessions.mkdir(parents=True)
        (sessions / "s1.jsonl").write_text('{"ts":200,"role":"user"}\n')
        (sessions / "s2.jsonl").write_text('{"ts":100,"role":"user"}\n')
        with patch("app.services.history.OPENCLAW_BASE", tmp_path):
            result = get_archived_sessions()
        assert result["total"] == 2
        # Sorted by ended_at desc
        assert result["sessions"][0]["ended_at"] == 200

    def test_pagination(self, tmp_path):
        sessions = tmp_path / "main" / "sessions"
        sessions.mkdir(parents=True)
        for i in range(5):
            (sessions / f"s{i}.jsonl").write_text(f'{{"ts":{i},"role":"user"}}\n')
        with patch("app.services.history.OPENCLAW_BASE", tmp_path):
            result = get_archived_sessions(limit=2, offset=0)
        assert len(result["sessions"]) == 2
        assert result["total"] == 5

    def test_search_filter(self, tmp_path):
        sessions = tmp_path / "main" / "sessions"
        sessions.mkdir(parents=True)
        (sessions / "s1.jsonl").write_text('{"ts":1,"label":"deploy-fix"}\n')
        (sessions / "s2.jsonl").write_text('{"ts":1,"label":"other-task"}\n')
        with patch("app.services.history.OPENCLAW_BASE", tmp_path):
            result = get_archived_sessions(search="deploy")
        assert result["total"] == 1


# ── get_session_detail ───────────────────────────────────────────────────────


class TestGetSessionDetail:
    def test_valid(self, tmp_path):
        sessions = tmp_path / "main" / "sessions"
        sessions.mkdir(parents=True)
        (sessions / "abc.jsonl").write_text('{"role":"user","ts":1,"text":"hi"}\n')
        with patch("app.services.history.OPENCLAW_BASE", tmp_path):
            result = get_session_detail("agent:main:abc")
        assert result is not None
        assert len(result["messages"]) == 1

    def test_invalid_key(self):
        assert get_session_detail("bad") is None

    def test_not_found(self, tmp_path):
        (tmp_path / "main" / "sessions").mkdir(parents=True)
        with patch("app.services.history.OPENCLAW_BASE", tmp_path):
            assert get_session_detail("agent:main:nonexistent") is None

    def test_invalid_id_chars(self):
        assert get_session_detail("agent:../hack:sess") is None


# ── _find_session_file ───────────────────────────────────────────────────────


class TestFindSessionFile:
    def test_in_sessions(self, tmp_path):
        sessions = tmp_path / "main" / "sessions"
        sessions.mkdir(parents=True)
        f = sessions / "s1.jsonl"
        f.touch()
        with patch("app.services.history.OPENCLAW_BASE", tmp_path):
            assert _find_session_file("main", "s1") == f

    def test_in_archive(self, tmp_path):
        archive = tmp_path / "main" / "archive"
        archive.mkdir(parents=True)
        f = archive / "s1.jsonl"
        f.touch()
        (tmp_path / "main" / "sessions").mkdir(parents=True)
        with patch("app.services.history.OPENCLAW_BASE", tmp_path):
            assert _find_session_file("main", "s1") == f

    def test_deleted_variant(self, tmp_path):
        sessions = tmp_path / "main" / "sessions"
        sessions.mkdir(parents=True)
        f = sessions / "s1.jsonl.deleted.2026-01-01"
        f.touch()
        with patch("app.services.history.OPENCLAW_BASE", tmp_path):
            result = _find_session_file("main", "s1")
        assert result == f

    def test_not_found(self, tmp_path):
        (tmp_path / "main" / "sessions").mkdir(parents=True)
        with patch("app.services.history.OPENCLAW_BASE", tmp_path):
            assert _find_session_file("main", "nope") is None


# ── delete_session ───────────────────────────────────────────────────────────


class TestDeleteSession:
    def test_success(self, tmp_path):
        sessions = tmp_path / "main" / "sessions"
        sessions.mkdir(parents=True)
        f = sessions / "s1.jsonl"
        f.write_text('{"ts":1}\n')
        with patch("app.services.history.OPENCLAW_BASE", tmp_path):
            result = delete_session("agent:main:s1")
        assert result is True
        assert not f.exists()
        # Should have renamed file
        deleted_files = list(sessions.glob("s1.jsonl.deleted.*"))
        assert len(deleted_files) == 1

    def test_not_found(self, tmp_path):
        (tmp_path / "main" / "sessions").mkdir(parents=True)
        with patch("app.services.history.OPENCLAW_BASE", tmp_path):
            assert delete_session("agent:main:nope") is False

    def test_invalid_key(self):
        assert delete_session("bad") is False

    def test_invalid_id(self):
        assert delete_session("agent:../hack:s1") is False


# ── get_statistics ───────────────────────────────────────────────────────────


class TestGetStatistics:
    def test_basic(self, tmp_path):
        sessions = tmp_path / "main" / "sessions"
        sessions.mkdir(parents=True)
        (sessions / "s1.jsonl").write_text('{"ts":1,"role":"user"}\n{"ts":2,"role":"assistant"}\n')
        (sessions / "s2.jsonl").write_text('{"ts":1,"role":"user"}\n')
        with patch("app.services.history.OPENCLAW_BASE", tmp_path):
            stats = get_statistics()
        assert stats["total_sessions"] == 2
        assert stats["total_messages"] == 3
        assert "main" in stats["by_type"]

    def test_empty(self, tmp_path):
        with patch("app.services.history.OPENCLAW_BASE", tmp_path / "nonexistent"):
            stats = get_statistics()
        assert stats["total_sessions"] == 0
