"""Tests for context routes (session context, prompt, envelope)."""

from unittest.mock import AsyncMock, patch

import pytest

pytestmark = pytest.mark.asyncio

NOW = 1700000000000


# ── Helper: seed DB ─────────────────────────────────────────────


async def _seed_room_and_project(client):
    """Seed a room, project, and session assignment via direct DB access."""
    from app.db.database import get_db

    async with get_db() as db:
        await db.execute(
            "INSERT OR IGNORE INTO projects (id, name, description, folder_path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("proj-1", "TestProject", "A test project", "/tmp/proj", "active", NOW, NOW),
        )
        await db.execute(
            "INSERT OR IGNORE INTO rooms (id, name, is_hq, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("room-1", "TestRoom", 0, "proj-1", NOW, NOW),
        )
        await db.execute(
            "INSERT OR IGNORE INTO session_room_assignments (session_key, room_id, assigned_at) VALUES (?, ?, ?)",
            ("agent:test", "room-1", NOW),
        )
        # Add some tasks
        for i, status in enumerate(["todo", "in_progress", "blocked", "done"]):
            await db.execute(
                "INSERT OR IGNORE INTO tasks (id, title, status, priority, project_id, assigned_session_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (f"test-task-{i}", f"Task {i}", status, "medium", "proj-1", "agent:test", NOW, NOW),
            )
        # Add history
        await db.execute(
            "INSERT OR IGNORE INTO project_history (id, project_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)",
            ("hist-1", "proj-1", "task_created", '{"task_id":"task-0"}', 1700000000),
        )
        await db.execute(
            "INSERT OR IGNORE INTO project_history (id, project_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)",
            ("hist-2", "proj-1", "note", "invalid json{", 1700000001),
        )
        await db.commit()


# ── GET /{session_key}/context ───────────────────────────────────


class TestGetSessionContext:
    async def test_no_room_assignment(self, client):
        resp = await client.get("/api/sessions/unknown-session/context")
        assert resp.status_code == 200
        data = resp.json()
        assert data["room"] is None
        assert data["project"] is None

    async def test_with_room_and_project(self, client):
        await _seed_room_and_project(client)
        resp = await client.get("/api/sessions/agent:test/context")
        assert resp.status_code == 200
        data = resp.json()
        assert data["room"]["id"] == "room-1"
        assert data["room"]["name"] == "TestRoom"
        assert data["project"]["id"] == "proj-1"
        assert data["project"]["name"] == "TestProject"
        assert data["tasks"]["todo_count"] == 1
        assert data["tasks"]["done_count"] == 1
        assert len(data["tasks"]["in_progress"]) >= 1
        assert len(data["tasks"]["blocked"]) >= 1
        # History with valid and invalid JSON
        assert len(data["recent_history"]) == 2
        assert data["recent_history"][0]["event_type"] in ("task_created", "note")

    async def test_room_without_project(self, client):
        from app.db.database import get_db

        async with get_db() as db:
            await db.execute(
                "INSERT OR IGNORE INTO rooms (id, name, is_hq, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                ("room-noproj", "EmptyRoom", 1, None, NOW, NOW),
            )
            await db.execute(
                "INSERT OR IGNORE INTO session_room_assignments (session_key, room_id, assigned_at) VALUES (?, ?, ?)",
                ("agent:empty", "room-noproj", NOW),
            )
            await db.commit()

        resp = await client.get("/api/sessions/agent:empty/context")
        assert resp.status_code == 200
        data = resp.json()
        assert data["room"]["id"] == "room-noproj"
        assert data["room"]["is_hq"] is True
        assert data["project"] is None

    async def test_agent_default_room_fallback(self, client):
        from app.db.database import get_db

        async with get_db() as db:
            await db.execute(
                "INSERT OR IGNORE INTO rooms (id, name, is_hq, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                ("room-def", "DefaultRoom", 0, None, NOW, NOW),
            )
            await db.execute(
                "INSERT OR IGNORE INTO agents (id, agent_session_key, default_room_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                ("agent-1", "agent:fallback", "room-def", "TestAgent", NOW, NOW),
            )
            await db.commit()

        resp = await client.get("/api/sessions/agent:fallback/context")
        assert resp.status_code == 200
        data = resp.json()
        assert data["room"]["id"] == "room-def"

    async def test_db_error(self, client):
        with patch("app.routes.context.get_db", side_effect=RuntimeError("db broken")):
            resp = await client.get("/api/sessions/agent:test/context")
        assert resp.status_code == 500

    async def test_nonexistent_room_id(self, client):
        """Session assigned to a room that doesn't exist in rooms table."""
        from app.db.database import get_db

        async with get_db() as db:
            await db.execute(
                "INSERT OR IGNORE INTO session_room_assignments (session_key, room_id, assigned_at) VALUES (?, ?, ?)",
                ("agent:ghost", "room-deleted", NOW),
            )
            await db.commit()

        resp = await client.get("/api/sessions/agent:ghost/context")
        assert resp.status_code == 200
        data = resp.json()
        assert data["room"] is None


# ── GET /{session_key}/context/prompt ────────────────────────────


class TestGetSessionContextPrompt:
    async def test_empty_prompt(self, client):
        resp = await client.get("/api/sessions/unknown/context/prompt")
        assert resp.status_code == 200
        assert resp.json()["prompt"] == ""

    async def test_prompt_with_project(self, client):
        await _seed_room_and_project(client)
        resp = await client.get("/api/sessions/agent:test/context/prompt")
        assert resp.status_code == 200
        prompt = resp.json()["prompt"]
        assert "TestRoom" in prompt
        assert "TestProject" in prompt
        assert "A test project" in prompt
        assert "/tmp/proj" in prompt
        assert "Tasks" in prompt

    async def test_prompt_hq_room(self, client):
        from app.db.database import get_db

        async with get_db() as db:
            await db.execute(
                "INSERT OR IGNORE INTO rooms (id, name, is_hq, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                ("room-hq", "HQ Room", 1, None, NOW, NOW),
            )
            await db.execute(
                "INSERT OR IGNORE INTO session_room_assignments (session_key, room_id, assigned_at) VALUES (?, ?, ?)",
                ("agent:hq", "room-hq", NOW),
            )
            await db.commit()

        resp = await client.get("/api/sessions/agent:hq/context/prompt")
        assert resp.status_code == 200
        prompt = resp.json()["prompt"]
        assert "(HQ)" in prompt


# ── GET /{session_key}/context/envelope ──────────────────────────


class TestGetContextEnvelope:
    async def test_no_room(self, client):
        resp = await client.get("/api/sessions/unknown/context/envelope")
        assert resp.status_code == 200
        data = resp.json()
        assert data["envelope"] is None
        assert data["block"] == ""

    async def test_with_envelope(self, client):
        await _seed_room_and_project(client)
        mock_envelope = {"room": "room-1", "project": "proj-1"}
        with patch(
            "app.routes.context.build_crewhub_context",
            new_callable=AsyncMock,
            return_value=mock_envelope,
        ):
            with patch(
                "app.routes.context.format_context_block",
                return_value="```json\n{}\n```",
            ):
                resp = await client.get("/api/sessions/agent:test/context/envelope?channel=whatsapp")
        assert resp.status_code == 200
        data = resp.json()
        assert data["envelope"] == mock_envelope
        assert "```" in data["block"]

    async def test_envelope_none(self, client):
        await _seed_room_and_project(client)
        with patch(
            "app.routes.context.build_crewhub_context",
            new_callable=AsyncMock,
            return_value=None,
        ):
            resp = await client.get("/api/sessions/agent:test/context/envelope")
        assert resp.status_code == 200
        assert resp.json()["envelope"] is None

    async def test_envelope_db_error(self, client):
        with patch("app.routes.context.get_db", side_effect=RuntimeError("fail")):
            resp = await client.get("/api/sessions/agent:test/context/envelope")
        assert resp.status_code == 500


# ── GET /rooms/{room_id}/context-envelope ────────────────────────


class TestGetRoomContextEnvelope:
    async def test_room_envelope_success(self, client):
        mock_envelope = {"room": "r1"}
        with patch(
            "app.routes.context.build_crewhub_context",
            new_callable=AsyncMock,
            return_value=mock_envelope,
        ):
            with patch(
                "app.routes.context.format_context_block",
                return_value="block",
            ):
                resp = await client.get("/api/sessions/rooms/room-1/context-envelope?channel=slack&session_key=s1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["envelope"] == mock_envelope

    async def test_room_envelope_not_found(self, client):
        with patch(
            "app.routes.context.build_crewhub_context",
            new_callable=AsyncMock,
            return_value=None,
        ):
            resp = await client.get("/api/sessions/rooms/nonexistent/context-envelope")
        assert resp.status_code == 404
