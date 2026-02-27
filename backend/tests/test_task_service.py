import pytest

from app.db.database import get_db
from app.db.models import ProjectCreate
from app.db.task_models import TaskCreate, TaskUpdate
from app.services import project_service, task_service


@pytest.fixture(autouse=True)
async def clean_task_related_tables():
    async with get_db() as db:
        await db.execute("DELETE FROM project_history")
        await db.execute("DELETE FROM tasks")
        await db.execute("DELETE FROM session_display_names")
        await db.execute("DELETE FROM projects")
        await db.execute("DELETE FROM rooms WHERE id != 'headquarters'")
        await db.commit()


@pytest.mark.asyncio
async def test_get_display_name_fallback_and_lookup():
    async with get_db() as db:
        assert await task_service.get_display_name(db, None) is None
        assert await task_service.get_display_name(db, "agent:dev:main") == "Dev"

        await db.execute(
            "INSERT INTO session_display_names (session_key, display_name, updated_at) VALUES (?, ?, ?)",
            ("agent:dev:main", "Developer Custom", 1),
        )
        await db.commit()

        assert await task_service.get_display_name(db, "agent:dev:main") == "Developer Custom"


@pytest.mark.asyncio
async def test_create_get_and_delete_task_happy_path():
    project = await project_service.create_project(ProjectCreate(name="Task Project"))

    created = await task_service.create_task(
        TaskCreate(
            project_id=project.id,
            room_id="headquarters",
            title="Ship tests",
            description="Write service tests",
            status="todo",
            priority="high",
            assigned_session_key="agent:dev:main",
        )
    )

    assert created.title == "Ship tests"
    assert created.assigned_display_name == "Dev"

    fetched = await task_service.get_task(created.id)
    assert fetched is not None
    assert fetched.id == created.id
    assert fetched.priority == "high"

    async with get_db() as db:
        async with db.execute("SELECT event_type FROM project_history WHERE task_id = ?", (created.id,)) as cur:
            rows = await cur.fetchall()
    assert [r["event_type"] for r in rows] == ["task_created"]

    deleted = await task_service.delete_task(created.id)
    assert deleted == {
        "task_id": created.id,
        "project_id": project.id,
        "room_id": "headquarters",
    }

    assert await task_service.get_task(created.id) is None


@pytest.mark.asyncio
async def test_create_task_validations():
    with pytest.raises(ValueError, match="project_not_found"):
        await task_service.create_task(TaskCreate(project_id="missing", title="x", status="todo", priority="low"))

    project = await project_service.create_project(ProjectCreate(name="Task Project"))
    with pytest.raises(ValueError, match="room_not_found"):
        await task_service.create_task(
            TaskCreate(
                project_id=project.id,
                room_id="missing-room",
                title="x",
                status="todo",
                priority="low",
            )
        )


@pytest.mark.asyncio
async def test_list_tasks_filters_order_and_total():
    project = await project_service.create_project(ProjectCreate(name="Task Project"))

    t1 = await task_service.create_task(
        TaskCreate(project_id=project.id, title="todo", status="todo", priority="medium")
    )
    t2 = await task_service.create_task(
        TaskCreate(project_id=project.id, title="blocked", status="blocked", priority="medium")
    )
    t3 = await task_service.create_task(
        TaskCreate(project_id=project.id, title="review", status="review", priority="medium")
    )

    all_items = await task_service.list_tasks(project_id=project.id)
    assert all_items.total == 3
    assert [t.id for t in all_items.tasks] == [t2.id, t1.id, t3.id]

    filtered = await task_service.list_tasks(project_id=project.id, status="todo,review")
    assert filtered.total == 2
    assert {t.id for t in filtered.tasks} == {t1.id, t3.id}


@pytest.mark.asyncio
async def test_update_task_empty_changes_and_status_event():
    project = await project_service.create_project(ProjectCreate(name="Task Project"))
    created = await task_service.create_task(
        TaskCreate(project_id=project.id, title="to-update", status="todo", priority="low")
    )

    untouched, changes = await task_service.update_task(created.id, TaskUpdate())
    assert untouched is not None
    assert changes == {}

    updated, changes = await task_service.update_task(
        created.id, TaskUpdate(status="in_progress", assigned_session_key="agent:dev:main")
    )
    assert updated.status == "in_progress"
    assert "status" in changes

    async with get_db() as db:
        async with db.execute(
            "SELECT event_type FROM project_history WHERE task_id = ? ORDER BY created_at DESC LIMIT 1",
            (created.id,),
        ) as cur:
            row = await cur.fetchone()
    assert row["event_type"] == "task_status_changed"


@pytest.mark.asyncio
async def test_update_task_assignment_event_and_missing_task():
    project = await project_service.create_project(ProjectCreate(name="Task Project"))
    created = await task_service.create_task(
        TaskCreate(project_id=project.id, title="to-assign", status="todo", priority="low")
    )

    _, changes = await task_service.update_task(created.id, TaskUpdate(assigned_session_key="agent:reviewer:main"))
    assert "assigned_session_key" in changes

    async with get_db() as db:
        async with db.execute(
            "SELECT event_type FROM project_history WHERE task_id = ? ORDER BY created_at DESC LIMIT 1",
            (created.id,),
        ) as cur:
            row = await cur.fetchone()
    assert row["event_type"] == "task_assigned"

    missing, missing_changes = await task_service.update_task("missing", TaskUpdate(title="x"))
    assert missing is None and missing_changes is None


@pytest.mark.asyncio
async def test_set_task_running_and_row_helpers():
    project = await project_service.create_project(ProjectCreate(name="Task Project"))
    created = await task_service.create_task(
        TaskCreate(project_id=project.id, title="dispatch", status="todo", priority="urgent")
    )

    await task_service.set_task_running(
        task_id=created.id,
        project_id=project.id,
        agent_id="dev",
        agent_name="Dev",
        session_key="agent:dev:main",
        prompt_preview="p" * 500,
    )

    row = await task_service.get_task_row(created.id)
    assert row["status"] == "in_progress"

    async with get_db() as db:
        async with db.execute(
            "SELECT payload_json, event_type FROM project_history WHERE task_id = ? ORDER BY created_at DESC LIMIT 1",
            (created.id,),
        ) as cur:
            history = await cur.fetchone()
    assert history["event_type"] == "task_sent_to_agent"
    assert '"prompt_preview": "' in history["payload_json"]
    assert len(history["payload_json"]) < 500

    agent = await task_service.get_agent_row("dev")
    assert agent is not None
    assert agent["id"] == "dev"

    assert await task_service.get_agent_row("nope") is None
