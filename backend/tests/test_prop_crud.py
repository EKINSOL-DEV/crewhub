"""Tests for app.services.creator.prop_crud — prop CRUD helpers.

Covers apply_color_changes_to_parts, persist_refined_prop,
find_prop_usage_in_blueprints, and cascade_delete_prop_from_blueprints.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

from app.services.creator.prop_crud import (
    apply_color_changes_to_parts,
    cascade_delete_prop_from_blueprints,
    find_prop_usage_in_blueprints,
    persist_refined_prop,
)

# ─── apply_color_changes_to_parts ────────────────────────────────


class TestApplyColorChangesToParts:
    def _make_parts(self):
        return [
            {"type": "box", "color": "#FF0000", "emissive": False},
            {"type": "sphere", "color": "#0000FF", "emissive": True},
            {"type": "cylinder", "color": "#00FF00", "emissive": False},
        ]

    def test_empty_color_changes_returns_original(self):
        parts = self._make_parts()
        result = apply_color_changes_to_parts(parts, {})
        assert result is parts  # same reference, not a copy

    def test_none_color_changes_returns_original(self):
        parts = self._make_parts()
        result = apply_color_changes_to_parts(parts, None)
        assert result is parts

    def test_empty_parts_returns_empty(self):
        result = apply_color_changes_to_parts([], {"#FF0000": "#00FF00"})
        assert result == []

    def test_single_color_change(self):
        parts = self._make_parts()
        result = apply_color_changes_to_parts(parts, {"#FF0000": "#FFFFFF"})
        assert result[0]["color"] == "#FFFFFF"
        assert result[1]["color"] == "#0000FF"  # unchanged
        assert result[2]["color"] == "#00FF00"  # unchanged

    def test_multiple_color_changes(self):
        parts = self._make_parts()
        result = apply_color_changes_to_parts(
            parts,
            {
                "#FF0000": "#111111",
                "#0000FF": "#222222",
            },
        )
        assert result[0]["color"] == "#111111"
        assert result[1]["color"] == "#222222"
        assert result[2]["color"] == "#00FF00"  # no match, unchanged

    def test_returns_new_list_not_original(self):
        parts = self._make_parts()
        result = apply_color_changes_to_parts(parts, {"#FF0000": "#000000"})
        assert result is not parts  # new list

    def test_original_parts_not_mutated(self):
        parts = self._make_parts()
        original_color = parts[0]["color"]
        apply_color_changes_to_parts(parts, {"#FF0000": "#000000"})
        assert parts[0]["color"] == original_color  # original untouched

    def test_case_insensitive_color_matching(self):
        parts = [{"color": "#ff0000", "type": "box"}]
        result = apply_color_changes_to_parts(parts, {"#FF0000": "#AABBCC"})
        assert result[0]["color"] == "#AABBCC"

    def test_no_matching_color_unchanged(self):
        parts = self._make_parts()
        result = apply_color_changes_to_parts(parts, {"#FFFFFF": "#000000"})
        assert result[0]["color"] == "#FF0000"
        assert result[1]["color"] == "#0000FF"
        assert result[2]["color"] == "#00FF00"

    def test_preserves_other_part_fields(self):
        parts = [{"type": "box", "color": "#FF0000", "position": [1, 2, 3], "emissive": True}]
        result = apply_color_changes_to_parts(parts, {"#FF0000": "#00FF00"})
        assert result[0]["type"] == "box"
        assert result[0]["position"] == [1, 2, 3]
        assert result[0]["emissive"] is True

    def test_part_without_color_key_untouched(self):
        parts = [{"type": "box"}]  # no 'color' key
        result = apply_color_changes_to_parts(parts, {"#FF0000": "#FFFFFF"})
        assert "color" not in result[0]

    def test_first_matching_mapping_wins(self):
        """Only first match in color_changes should apply per part."""
        parts = [{"color": "#FF0000", "type": "box"}]
        # Both mappings could match — only first match applies
        changes = {"#FF0000": "#AAAAAA", "#ff0000": "#BBBBBB"}
        result = apply_color_changes_to_parts(parts, changes)
        # First matching key applies
        assert result[0]["color"] in ("#AAAAAA", "#BBBBBB")


# ─── persist_refined_prop ────────────────────────────────────────


class TestPersistRefinedProp:
    """persist_refined_prop uses lazy imports from .prop_generator — patch there."""

    def test_updates_matching_record(self):
        history = [
            {"id": "prop-1", "code": "old code", "parts": []},
            {"id": "prop-2", "code": "other code", "parts": []},
        ]
        new_parts = [{"type": "box", "color": "#FF0000"}]

        with patch("app.services.creator.prop_generator.load_generation_history", return_value=history):
            with patch("app.services.creator.prop_generator.save_generation_history") as mock_save:
                persist_refined_prop("prop-1", "new code", new_parts)

        call_args = mock_save.call_args[0][0]
        prop1 = next(r for r in call_args if r["id"] == "prop-1")
        assert prop1["code"] == "new code"
        assert prop1["parts"] == new_parts

    def test_leaves_non_matching_records_unchanged(self):
        history = [
            {"id": "prop-1", "code": "code1", "parts": []},
            {"id": "prop-2", "code": "code2", "parts": []},
        ]

        with patch("app.services.creator.prop_generator.load_generation_history", return_value=history):
            with patch("app.services.creator.prop_generator.save_generation_history") as mock_save:
                persist_refined_prop("prop-1", "updated", [])

        call_args = mock_save.call_args[0][0]
        prop2 = next(r for r in call_args if r["id"] == "prop-2")
        assert prop2["code"] == "code2"

    def test_no_match_still_saves(self):
        history = [{"id": "other", "code": "code", "parts": []}]

        with patch("app.services.creator.prop_generator.load_generation_history", return_value=history):
            with patch("app.services.creator.prop_generator.save_generation_history") as mock_save:
                persist_refined_prop("nonexistent", "new code", [])

        # save was still called (with unchanged history)
        mock_save.assert_called_once_with(history)

    def test_empty_history(self):
        with patch("app.services.creator.prop_generator.load_generation_history", return_value=[]):
            with patch("app.services.creator.prop_generator.save_generation_history") as mock_save:
                persist_refined_prop("any-id", "code", [])
        mock_save.assert_called_once_with([])


# ─── find_prop_usage_in_blueprints ───────────────────────────────


class TestFindPropUsageInBlueprints:
    """find_prop_usage_in_blueprints lazy-imports get_db — patch at app.db.database."""

    def _mock_db(self, rows):
        mock_db = AsyncMock()
        mock_cursor = AsyncMock()
        mock_cursor.fetchall.return_value = rows
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)
        return mock_db

    @pytest.mark.asyncio
    async def test_no_blueprints_returns_empty(self):
        mock_db = self._mock_db([])
        with patch("app.db.database.get_db", return_value=mock_db):
            result = await find_prop_usage_in_blueprints("MyProp")
        assert result == []

    @pytest.mark.asyncio
    async def test_blueprint_with_matching_prop(self):
        bp_json = {
            "placements": [
                {"propId": "MyProp", "x": 0},
                {"propId": "MyProp", "x": 1},
            ]
        }
        rows = [{"id": "bp-1", "name": "My Room", "room_id": "room-1", "blueprint_json": json.dumps(bp_json)}]
        mock_db = self._mock_db(rows)

        with patch("app.db.database.get_db", return_value=mock_db):
            result = await find_prop_usage_in_blueprints("MyProp")

        assert len(result) == 1
        assert result[0]["blueprintId"] == "bp-1"
        assert result[0]["blueprintName"] == "My Room"
        assert result[0]["roomId"] == "room-1"
        assert result[0]["instanceCount"] == 2

    @pytest.mark.asyncio
    async def test_blueprint_without_matching_prop(self):
        bp_json = {"placements": [{"propId": "OtherProp"}]}
        rows = [{"id": "bp-1", "name": "Other Room", "room_id": "room-1", "blueprint_json": json.dumps(bp_json)}]
        mock_db = self._mock_db(rows)

        with patch("app.db.database.get_db", return_value=mock_db):
            result = await find_prop_usage_in_blueprints("MyProp")

        assert result == []

    @pytest.mark.asyncio
    async def test_blueprint_json_as_dict(self):
        """Blueprint JSON already parsed as dict (not string)."""
        bp_json = {"placements": [{"propId": "MyProp"}]}
        rows = [{"id": "bp-1", "name": "Room", "room_id": "r1", "blueprint_json": bp_json}]
        mock_db = self._mock_db(rows)

        with patch("app.db.database.get_db", return_value=mock_db):
            result = await find_prop_usage_in_blueprints("MyProp")

        assert len(result) == 1
        assert result[0]["instanceCount"] == 1

    @pytest.mark.asyncio
    async def test_blueprint_with_no_placements(self):
        bp_json = {"placements": []}
        rows = [{"id": "bp-1", "name": "Empty Room", "room_id": "r1", "blueprint_json": json.dumps(bp_json)}]
        mock_db = self._mock_db(rows)

        with patch("app.db.database.get_db", return_value=mock_db):
            result = await find_prop_usage_in_blueprints("MyProp")

        assert result == []

    @pytest.mark.asyncio
    async def test_multiple_blueprints_some_matching(self):
        bp1_json = {"placements": [{"propId": "MyProp"}]}
        bp2_json = {"placements": [{"propId": "OtherProp"}]}
        rows = [
            {"id": "bp-1", "name": "Room1", "room_id": "r1", "blueprint_json": json.dumps(bp1_json)},
            {"id": "bp-2", "name": "Room2", "room_id": "r2", "blueprint_json": json.dumps(bp2_json)},
        ]
        mock_db = self._mock_db(rows)

        with patch("app.db.database.get_db", return_value=mock_db):
            result = await find_prop_usage_in_blueprints("MyProp")

        assert len(result) == 1
        assert result[0]["blueprintId"] == "bp-1"

    @pytest.mark.asyncio
    async def test_db_exception_returns_empty(self):
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=RuntimeError("DB error"))
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("app.db.database.get_db", return_value=mock_db):
            result = await find_prop_usage_in_blueprints("MyProp")

        assert result == []

    @pytest.mark.asyncio
    async def test_blueprint_json_missing_placements_key(self):
        bp_json = {}  # no 'placements' key
        rows = [{"id": "bp-1", "name": "Room", "room_id": "r1", "blueprint_json": json.dumps(bp_json)}]
        mock_db = self._mock_db(rows)

        with patch("app.db.database.get_db", return_value=mock_db):
            result = await find_prop_usage_in_blueprints("MyProp")

        assert result == []


# ─── cascade_delete_prop_from_blueprints ─────────────────────────


class TestCascadeDeletePropFromBlueprints:
    """cascade_delete lazy-imports get_db — patch at app.db.database."""

    def _mock_db_with_rows(self, rows_by_blueprint_id: dict):
        """rows_by_blueprint_id: {bp_id: row_or_None}"""
        execute_calls = []

        async def mock_execute(sql, params=None):
            cursor = AsyncMock()
            if "SELECT" in sql and params:
                bp_id = params[0]
                cursor.fetchone.return_value = rows_by_blueprint_id.get(bp_id)
            execute_calls.append((sql, params))
            return cursor

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=mock_execute)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)
        return mock_db, execute_calls

    @pytest.mark.asyncio
    async def test_no_placements_no_changes(self):
        mock_db, _ = self._mock_db_with_rows({})
        with patch("app.db.database.get_db", return_value=mock_db):
            rooms, total = await cascade_delete_prop_from_blueprints([], "MyProp")
        assert rooms == []
        assert total == 0

    @pytest.mark.asyncio
    async def test_deletes_placements_from_blueprint(self):
        bp_json = {
            "placements": [
                {"propId": "MyProp", "x": 0},
                {"propId": "OtherProp", "x": 1},
                {"propId": "MyProp", "x": 2},
            ]
        }
        row = {"id": "bp-1", "blueprint_json": json.dumps(bp_json)}
        placements = [{"blueprintId": "bp-1", "blueprintName": "Test Room"}]
        mock_db, _ = self._mock_db_with_rows({"bp-1": row})

        with patch("app.db.database.get_db", return_value=mock_db):
            rooms, total = await cascade_delete_prop_from_blueprints(placements, "MyProp")

        assert total == 2
        assert "Test Room" in rooms

    @pytest.mark.asyncio
    async def test_blueprint_not_found_skipped(self):
        placements = [{"blueprintId": "nonexistent", "blueprintName": "Ghost Room"}]
        mock_db, _ = self._mock_db_with_rows({"nonexistent": None})

        with patch("app.db.database.get_db", return_value=mock_db):
            rooms, total = await cascade_delete_prop_from_blueprints(placements, "MyProp")

        assert rooms == []
        assert total == 0

    @pytest.mark.asyncio
    async def test_multiple_blueprints_deleted(self):
        bp1_json = {"placements": [{"propId": "MyProp"}, {"propId": "Other"}]}
        bp2_json = {"placements": [{"propId": "MyProp"}, {"propId": "MyProp"}]}

        placements = [
            {"blueprintId": "bp-1", "blueprintName": "Room 1"},
            {"blueprintId": "bp-2", "blueprintName": "Room 2"},
        ]
        rows = {
            "bp-1": {"id": "bp-1", "blueprint_json": json.dumps(bp1_json)},
            "bp-2": {"id": "bp-2", "blueprint_json": json.dumps(bp2_json)},
        }
        mock_db, _ = self._mock_db_with_rows(rows)

        with patch("app.db.database.get_db", return_value=mock_db):
            rooms, total = await cascade_delete_prop_from_blueprints(placements, "MyProp")

        assert total == 3  # 1 from bp-1 + 2 from bp-2
        assert "Room 1" in rooms
        assert "Room 2" in rooms

    @pytest.mark.asyncio
    async def test_commit_is_called(self):
        mock_db = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)
        mock_db.commit = AsyncMock()

        with patch("app.db.database.get_db", return_value=mock_db):
            await cascade_delete_prop_from_blueprints([], "MyProp")

        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_blueprint_json_already_dict(self):
        """Blueprint JSON stored as dict (not string)."""
        bp_json = {"placements": [{"propId": "MyProp"}]}
        row = {"id": "bp-1", "blueprint_json": bp_json}  # dict, not string
        placements = [{"blueprintId": "bp-1", "blueprintName": "Dict Room"}]
        mock_db, _ = self._mock_db_with_rows({"bp-1": row})

        with patch("app.db.database.get_db", return_value=mock_db):
            rooms, total = await cascade_delete_prop_from_blueprints(placements, "MyProp")

        assert total == 1
        assert "Dict Room" in rooms

    @pytest.mark.asyncio
    async def test_uses_blueprintid_as_fallback_for_room_name(self):
        """Uses blueprintId if blueprintName is missing in placement dict."""
        bp_json = {"placements": [{"propId": "MyProp"}]}
        row = {"id": "bp-1", "blueprint_json": json.dumps(bp_json)}
        placements = [{"blueprintId": "bp-1"}]  # no 'blueprintName' key
        mock_db, _ = self._mock_db_with_rows({"bp-1": row})

        with patch("app.db.database.get_db", return_value=mock_db):
            rooms, total = await cascade_delete_prop_from_blueprints(placements, "MyProp")

        assert total == 1
        assert "bp-1" in rooms
