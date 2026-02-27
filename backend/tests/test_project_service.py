import pytest

from app.db.database import get_db
from app.db.models import ProjectCreate, ProjectUpdate
from app.services import project_service


@pytest.fixture(autouse=True)
async def clean_project_tables():
    async with get_db() as db:
        await db.execute("DELETE FROM agents")
        await db.execute("DELETE FROM rooms WHERE id != 'headquarters'")
        await db.execute("UPDATE rooms SET project_id = NULL WHERE id = 'headquarters'")
        await db.execute("DELETE FROM projects")
        await db.execute("DELETE FROM settings")
        await db.commit()


@pytest.mark.asyncio
async def test_get_base_path_default_and_setting():
    async with get_db() as db:
        assert await project_service._get_base_path(db) == project_service.DEFAULT_PROJECTS_BASE_PATH

        await db.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
            ("projects_base_path", "/tmp/work", 1),
        )
        await db.commit()

        assert await project_service._get_base_path(db) == "/tmp/work"


@pytest.mark.asyncio
async def test_create_get_list_project_and_rooms():
    created = await project_service.create_project(
        ProjectCreate(name="My Cool Project!", description="desc", icon="🧪", color="#fff")
    )
    assert created.folder_path.endswith("/My-Cool-Project")
    assert created.rooms == []

    async with get_db() as db:
        await db.execute(
            "INSERT INTO rooms (id, name, icon, color, sort_order, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("room-a", "Room A", "🏠", "#111", 1, created.id, 1, 1),
        )
        await db.commit()

    fetched = await project_service.get_project(created.id)
    assert fetched is not None
    assert fetched.id == created.id
    assert fetched.rooms == ["room-a"]

    listed = await project_service.list_projects()
    assert len(listed) == 1
    assert listed[0].id == created.id


@pytest.mark.asyncio
async def test_create_project_uses_custom_folder_path():
    created = await project_service.create_project(ProjectCreate(name="Custom", folder_path="/custom/path/project"))
    assert created.folder_path == "/custom/path/project"


@pytest.mark.asyncio
async def test_get_projects_overview_counts():
    p = await project_service.create_project(ProjectCreate(name="Overview"))

    async with get_db() as db:
        await db.execute(
            "INSERT INTO rooms (id, name, icon, color, sort_order, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("room-1", "R1", "🏠", "#111", 1, p.id, 1, 1),
        )
        await db.execute(
            "INSERT INTO rooms (id, name, icon, color, sort_order, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("room-2", "R2", "🏠", "#222", 2, p.id, 1, 1),
        )
        await db.execute(
            "INSERT INTO agents (id, name, icon, color, agent_session_key, default_room_id, sort_order, is_pinned, auto_spawn, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("a1", "A1", "🤖", "#aaa", "agent:a1:main", "room-1", 1, 0, 1, 1, 1),
        )
        await db.commit()

    overview = await project_service.get_projects_overview()
    assert len(overview) == 1
    assert overview[0]["room_count"] == 2
    assert overview[0]["agent_count"] == 1


@pytest.mark.asyncio
async def test_update_project_guards_and_not_found():
    assert await project_service.update_project("missing", ProjectUpdate(name="x")) is None

    p = await project_service.create_project(ProjectCreate(name="Guarded"))
    async with get_db() as db:
        await db.execute(
            "INSERT INTO rooms (id, name, icon, color, sort_order, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("room-g", "Guard", "🏠", "#111", 1, p.id, 1, 1),
        )
        await db.commit()

    with pytest.raises(ValueError, match="cannot_archive_with_rooms"):
        await project_service.update_project(p.id, ProjectUpdate(status="archived"))


@pytest.mark.asyncio
async def test_update_project_and_delete_flow():
    p = await project_service.create_project(ProjectCreate(name="To Delete"))

    updated = await project_service.update_project(
        p.id,
        ProjectUpdate(name="Renamed", description="new", status="active", folder_path="/x"),
    )
    assert updated.name == "Renamed"
    assert updated.description == "new"
    assert updated.folder_path == "/x"

    with pytest.raises(ValueError, match="not_archived"):
        await project_service.delete_project(p.id)

    await project_service.update_project(p.id, ProjectUpdate(status="archived"))
    deleted_id = await project_service.delete_project(p.id)
    assert deleted_id == p.id

    assert await project_service.get_project(p.id) is None
    assert await project_service.delete_project("missing") is None
