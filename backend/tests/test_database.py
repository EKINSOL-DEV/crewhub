"""Tests for database initialization and operations."""

import pytest

from app.db.database import DB_PATH, check_database_health, get_db, seed_default_data


@pytest.mark.asyncio
async def test_database_exists():
    """Test that database file is created after init."""
    assert DB_PATH.exists()


@pytest.mark.asyncio
async def test_database_health():
    """Test database health check returns expected fields."""
    health = await check_database_health()
    assert health["healthy"] is True
    assert "rooms_count" in health
    assert "agents_count" in health
    assert "assignments_count" in health
    assert health["rooms_count"] >= 4
    assert health["agents_count"] >= 5


@pytest.mark.asyncio
async def test_database_tables_exist():
    """Test that all expected tables exist in the database."""
    expected_tables = [
        "rooms",
        "agents",
        "session_room_assignments",
        "session_display_names",
        "room_assignment_rules",
        "settings",
        "connections",
        "projects",
        "custom_blueprints",
        "schema_version",
    ]
    async with get_db() as db:
        async with db.execute("SELECT name FROM sqlite_master WHERE type='table'") as cursor:
            rows = await cursor.fetchall()
            table_names = {row["name"] for row in rows}

    for table in expected_tables:
        assert table in table_names, f"Table '{table}' not found"


@pytest.mark.asyncio
async def test_get_db_connection():
    """Test that get_db returns a working connection."""
    async with get_db() as db:
        assert db is not None
        async with db.execute("SELECT 1 as one") as cursor:
            row = await cursor.fetchone()
            assert row["one"] == 1


@pytest.mark.asyncio
async def test_seed_data_idempotent():
    """Test that seeding is safe to call multiple times."""
    # Should not raise
    result1 = await seed_default_data()
    result2 = await seed_default_data()
    assert result1 is True
    assert result2 is True


@pytest.mark.asyncio
async def test_rooms_schema():
    """Test rooms table has expected columns."""
    async with get_db() as db:
        async with db.execute("PRAGMA table_info(rooms)") as cursor:
            columns = {row["name"] for row in await cursor.fetchall()}

    expected = {
        "id",
        "name",
        "icon",
        "color",
        "sort_order",
        "default_model",
        "speed_multiplier",
        "created_at",
        "updated_at",
        "project_id",
        "is_hq",
    }
    assert expected.issubset(columns)


@pytest.mark.asyncio
async def test_agents_schema():
    """Test agents table has expected columns."""
    async with get_db() as db:
        async with db.execute("PRAGMA table_info(agents)") as cursor:
            columns = {row["name"] for row in await cursor.fetchall()}

    expected = {
        "id",
        "name",
        "icon",
        "color",
        "agent_session_key",
        "default_model",
        "default_room_id",
        "sort_order",
        "is_pinned",
        "auto_spawn",
        "created_at",
        "updated_at",
    }
    assert expected.issubset(columns)


@pytest.mark.asyncio
async def test_connections_schema():
    """Test connections table has expected columns."""
    async with get_db() as db:
        async with db.execute("PRAGMA table_info(connections)") as cursor:
            columns = {row["name"] for row in await cursor.fetchall()}

    expected = {"id", "name", "type", "config", "enabled", "created_at", "updated_at"}
    assert expected.issubset(columns)
