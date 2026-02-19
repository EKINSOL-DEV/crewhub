"""Tests for CrewHub context envelope."""
import asyncio
import time
import pytest
import aiosqlite

from app.services.context_envelope import (
    build_crewhub_context,
    format_context_block,
    _compute_hash,
    _canonical_json,
)


@pytest.fixture
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def test_db(tmp_path, monkeypatch):
    """Create an in-memory-like test database."""
    db_path = tmp_path / "test.db"
    monkeypatch.setattr("app.services.context_envelope.DB_PATH", db_path)

    async with aiosqlite.connect(db_path) as db:
        now = int(time.time() * 1000)
        await db.executescript(f"""
            CREATE TABLE rooms (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, is_hq BOOLEAN DEFAULT 0,
                project_id TEXT, created_at INTEGER, updated_at INTEGER
            );
            CREATE TABLE projects (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, folder_path TEXT,
                status TEXT DEFAULT 'active', created_at INTEGER, updated_at INTEGER
            );
            CREATE TABLE agents (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, default_room_id TEXT,
                agent_session_key TEXT, created_at INTEGER, updated_at INTEGER
            );
            CREATE TABLE tasks (
                id TEXT PRIMARY KEY, project_id TEXT, room_id TEXT, title TEXT NOT NULL,
                description TEXT, status TEXT DEFAULT 'todo', priority TEXT DEFAULT 'medium',
                assigned_session_key TEXT, created_by TEXT, created_at INTEGER, updated_at INTEGER
            );
            CREATE TABLE session_display_names (
                session_key TEXT PRIMARY KEY, display_name TEXT NOT NULL, updated_at INTEGER
            );

            INSERT INTO rooms VALUES ('dev-room', 'Dev Room', 0, 'proj-1', {now}, {now});
            INSERT INTO rooms VALUES ('hq', 'Headquarters', 1, NULL, {now}, {now});
            INSERT INTO projects VALUES ('proj-1', 'CrewHub', '/Users/ekinbot/ekinapps/crewhub', 'active', {now}, {now});
            INSERT INTO agents VALUES ('dev', 'Dev', 'dev-room', 'agent:dev:main', {now}, {now});
            INSERT INTO agents VALUES ('main', 'Main', 'hq', 'agent:main:main', {now}, {now});
            INSERT INTO tasks VALUES ('t1', 'proj-1', 'dev-room', 'Fix bug #42', NULL, 'in_progress', 'high', 'agent:dev:main', NULL, {now}, {now});
            INSERT INTO tasks VALUES ('t2', 'proj-1', 'dev-room', 'Add tests', NULL, 'todo', 'medium', NULL, NULL, {now}, {now});
            INSERT INTO tasks VALUES ('t3', 'proj-1', 'dev-room', 'Deploy v2', NULL, 'done', 'low', NULL, NULL, {now}, {now});
            INSERT INTO session_display_names VALUES ('agent:dev:main', 'Dev', {now});
        """)
        await db.commit()

    return db_path


@pytest.mark.asyncio
async def test_internal_context_includes_participants_and_tasks(test_db):
    """Internal privacy should include participants and tasks."""
    envelope = await build_crewhub_context(
        room_id="dev-room",
        channel="crewhub-ui",
    )

    assert envelope is not None
    assert envelope["v"] == 1
    assert envelope["privacy"] == "internal"
    assert envelope["room"]["id"] == "dev-room"
    assert envelope["room"]["name"] == "Dev Room"
    assert len(envelope["projects"]) == 1
    assert envelope["projects"][0]["name"] == "CrewHub"
    assert envelope["projects"][0]["repo"] == "/Users/ekinbot/ekinapps/crewhub"
    assert "participants" in envelope
    assert any(p["handle"] == "Dev" for p in envelope["participants"])
    assert "tasks" in envelope
    # 'done' tasks are excluded
    assert len(envelope["tasks"]) == 2
    assert envelope["context_hash"]
    assert envelope["context_version"] > 0


@pytest.mark.asyncio
async def test_external_privacy_strips_participants_and_tasks(test_db):
    """External channels should strip participants and tasks."""
    for channel in ["whatsapp", "slack", "discord"]:
        envelope = await build_crewhub_context(
            room_id="dev-room",
            channel=channel,
        )
        assert envelope is not None
        assert envelope["privacy"] == "external"
        assert "participants" not in envelope
        assert "tasks" not in envelope
        # Room and projects still present
        assert envelope["room"]["id"] == "dev-room"
        assert len(envelope["projects"]) == 1


@pytest.mark.asyncio
async def test_hash_stable(test_db):
    """Same input should produce same hash."""
    e1 = await build_crewhub_context(room_id="dev-room", channel="crewhub-ui")
    e2 = await build_crewhub_context(room_id="dev-room", channel="crewhub-ui")
    assert e1["context_hash"] == e2["context_hash"]


@pytest.mark.asyncio
async def test_hash_changes_on_different_input(test_db):
    """Different privacy should produce different hash."""
    e_int = await build_crewhub_context(room_id="dev-room", channel="crewhub-ui")
    e_ext = await build_crewhub_context(room_id="dev-room", channel="whatsapp")
    assert e_int["context_hash"] != e_ext["context_hash"]


@pytest.mark.asyncio
async def test_version_bump_on_mutation(test_db):
    """context_version should change when tasks are updated."""
    e1 = await build_crewhub_context(room_id="dev-room", channel="crewhub-ui")

    # Mutate a task
    async with aiosqlite.connect(test_db) as db:
        new_ts = int(time.time() * 1000) + 10000
        await db.execute("UPDATE tasks SET updated_at = ? WHERE id = 't1'", (new_ts,))
        await db.commit()

    e2 = await build_crewhub_context(room_id="dev-room", channel="crewhub-ui")
    assert e2["context_version"] > e1["context_version"]


@pytest.mark.asyncio
async def test_spawned_from_included(test_db):
    """spawned_from param was removed; verify envelope builds without it."""
    envelope = await build_crewhub_context(
        room_id="dev-room",
        channel="crewhub-ui",
    )
    assert envelope is not None


@pytest.mark.asyncio
async def test_room_not_found_returns_none(test_db):
    """Non-existent room should return None."""
    result = await build_crewhub_context(room_id="nonexistent")
    assert result is None


@pytest.mark.asyncio
async def test_room_without_project(test_db):
    """Room without project should have empty projects list."""
    envelope = await build_crewhub_context(room_id="hq", channel="crewhub-ui")
    assert envelope is not None
    assert envelope["projects"] == []
    assert "tasks" not in envelope or envelope.get("tasks") == []


@pytest.mark.asyncio
async def test_format_context_block(test_db):
    """format_context_block should produce a fenced code block."""
    envelope = await build_crewhub_context(room_id="dev-room", channel="crewhub-ui")
    block = format_context_block(envelope)
    assert block.startswith("```crewhub-context\n")
    assert block.endswith("\n```")


@pytest.mark.asyncio
async def test_envelope_under_2kb(test_db):
    """Envelope should be under 2KB."""
    envelope = await build_crewhub_context(room_id="dev-room", channel="crewhub-ui")
    import json
    size = len(json.dumps(envelope, separators=(",", ":")))
    assert size < 2048, f"Envelope is {size} bytes, exceeds 2KB limit"


def test_canonical_json_deterministic():
    """Canonical JSON should be deterministic regardless of key order."""
    a = {"z": 1, "a": 2, "m": [3, 1]}
    b = {"a": 2, "m": [3, 1], "z": 1}
    assert _canonical_json(a) == _canonical_json(b)


def test_compute_hash_excludes_self():
    """Hash computation should exclude the context_hash field."""
    obj = {"a": 1, "b": 2}
    h1 = _compute_hash(obj)
    obj_with_hash = {"a": 1, "b": 2, "context_hash": "whatever"}
    h2 = _compute_hash(obj_with_hash)
    assert h1 == h2
