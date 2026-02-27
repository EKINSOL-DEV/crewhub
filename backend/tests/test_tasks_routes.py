from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.routes import tasks as routes

pytestmark = pytest.mark.anyio


@pytest.fixture
def sample_task():
    return {
        "id": "t1",
        "project_id": "p1",
        "room_id": "r1",
        "title": "Task title",
        "description": "desc",
        "status": "todo",
        "priority": "medium",
        "assigned_session_key": None,
        "assigned_display_name": None,
        "created_by": None,
        "created_at": 1,
        "updated_at": 1,
    }


async def test_room_project_and_global_list_tasks(client, monkeypatch, sample_task):
    monkeypatch.setattr(routes.task_service, "list_tasks", AsyncMock(return_value={"tasks": [sample_task], "total": 1}))

    resp_room = await client.get("/api/tasks/rooms/r1/tasks", params={"status": "todo", "limit": 10, "offset": 0})
    assert resp_room.status_code == 200
    assert resp_room.json()["total"] == 1

    resp_project = await client.get("/api/tasks/projects/p1/tasks")
    assert resp_project.status_code == 200

    resp_global = await client.get("/api/tasks", params={"project_id": "p1", "assigned_session_key": "agent:x"})
    assert resp_global.status_code == 200


async def test_list_routes_return_500_on_failure(client, monkeypatch):
    monkeypatch.setattr(routes.task_service, "list_tasks", AsyncMock(side_effect=RuntimeError("boom")))
    for path in ["/api/tasks/rooms/r1/tasks", "/api/tasks/projects/p1/tasks", "/api/tasks"]:
        resp = await client.get(path)
        assert resp.status_code == 500
        assert "boom" in resp.json()["detail"]


async def test_get_task_ok_404_500(client, monkeypatch, sample_task):
    monkeypatch.setattr(routes.task_service, "get_task", AsyncMock(return_value=sample_task))
    ok = await client.get("/api/tasks/t1")
    assert ok.status_code == 200

    monkeypatch.setattr(routes.task_service, "get_task", AsyncMock(return_value=None))
    nf = await client.get("/api/tasks/missing")
    assert nf.status_code == 404

    monkeypatch.setattr(routes.task_service, "get_task", AsyncMock(side_effect=RuntimeError("db down")))
    err = await client.get("/api/tasks/t1")
    assert err.status_code == 500


async def test_create_task_success_and_error_mapping(client, monkeypatch, sample_task):
    monkeypatch.setattr(routes.task_service, "create_task", AsyncMock(return_value=sample_task))
    bcast = AsyncMock()
    monkeypatch.setattr(routes, "broadcast", bcast)

    payload = {"project_id": "p1", "room_id": "r1", "title": "Task title"}
    ok = await client.post("/api/tasks", json=payload)
    assert ok.status_code == 200
    bcast.assert_awaited_once()

    monkeypatch.setattr(routes.task_service, "create_task", AsyncMock(side_effect=ValueError("project_not_found")))
    pnf = await client.post("/api/tasks", json=payload)
    assert pnf.status_code == 404

    monkeypatch.setattr(routes.task_service, "create_task", AsyncMock(side_effect=ValueError("room_not_found")))
    rnf = await client.post("/api/tasks", json=payload)
    assert rnf.status_code == 404

    monkeypatch.setattr(routes.task_service, "create_task", AsyncMock(side_effect=ValueError("bad input")))
    bad = await client.post("/api/tasks", json=payload)
    assert bad.status_code == 400

    monkeypatch.setattr(routes.task_service, "create_task", AsyncMock(side_effect=RuntimeError("oops")))
    err = await client.post("/api/tasks", json=payload)
    assert err.status_code == 500


async def test_update_and_delete_task_paths(client, monkeypatch, sample_task):
    monkeypatch.setattr(
        routes.task_service,
        "update_task",
        AsyncMock(return_value=(sample_task, {"status": {"old": "todo", "new": "done"}})),
    )
    monkeypatch.setattr(routes, "broadcast", AsyncMock())

    ok = await client.patch("/api/tasks/t1", json={"status": "done"})
    assert ok.status_code == 200

    monkeypatch.setattr(routes.task_service, "update_task", AsyncMock(return_value=(None, {})))
    nf = await client.patch("/api/tasks/missing", json={"status": "done"})
    assert nf.status_code == 404

    monkeypatch.setattr(routes.task_service, "update_task", AsyncMock(side_effect=RuntimeError("upd")))
    err = await client.patch("/api/tasks/t1", json={"status": "done"})
    assert err.status_code == 500

    monkeypatch.setattr(
        routes.task_service,
        "delete_task",
        AsyncMock(return_value={"task_id": "t1", "project_id": "p1", "room_id": "r1"}),
    )
    monkeypatch.setattr(routes, "broadcast", AsyncMock())
    del_ok = await client.delete("/api/tasks/t1")
    assert del_ok.status_code == 200

    monkeypatch.setattr(routes.task_service, "delete_task", AsyncMock(return_value=None))
    del_nf = await client.delete("/api/tasks/missing")
    assert del_nf.status_code == 404

    monkeypatch.setattr(routes.task_service, "delete_task", AsyncMock(side_effect=RuntimeError("del")))
    del_err = await client.delete("/api/tasks/t1")
    assert del_err.status_code == 500


async def test_build_task_context_prompt_and_run_task(client, monkeypatch):
    # prompt helper: with context
    monkeypatch.setattr("app.services.context_envelope.build_crewhub_context", AsyncMock(return_value={"room": "r1"}))
    monkeypatch.setattr("app.services.context_envelope.format_context_block", lambda _e: "CTX")
    prompt = await routes._build_task_context_prompt(
        {"title": "Do thing", "description": "Body", "room_id": "r1"},
        {"agent_session_key": "agent:dev:main"},
        routes.RunRequest(agent_id="a1", extra_instructions="Extra"),
    )
    assert "CTX" in prompt and "Do thing" in prompt and "Extra" in prompt

    # run endpoint success with send_message
    task = {"id": "t1", "project_id": "p1", "room_id": "r1", "status": "todo", "title": "Do"}
    agent = {"id": "a1", "name": "Dev", "default_room_id": "r1", "agent_session_key": "agent:dev:main"}
    monkeypatch.setattr(routes.task_service, "get_task_row", AsyncMock(return_value=task))
    monkeypatch.setattr(routes.task_service, "get_agent_row", AsyncMock(return_value=agent))
    monkeypatch.setattr(routes.task_service, "set_task_running", AsyncMock())
    monkeypatch.setattr(routes, "broadcast", AsyncMock())

    class Conn:
        async def send_message(self, **kwargs):
            return {"ok": True, **kwargs}

    class Manager:
        def get_default_openclaw(self):
            return Conn()

    monkeypatch.setattr(routes, "get_connection_manager", AsyncMock(return_value=Manager()))

    ok = await client.post("/api/tasks/t1/run", json={"agent_id": "a1", "extra_instructions": "Now"})
    assert ok.status_code == 200
    assert ok.json()["session_key"] == "agent:dev:main"


async def test_run_task_not_found_agent_not_found_and_no_conn(client, monkeypatch):
    monkeypatch.setattr(routes.task_service, "get_task_row", AsyncMock(return_value=None))
    nf = await client.post("/api/tasks/t404/run", json={"agent_id": "a1"})
    assert nf.status_code == 404

    monkeypatch.setattr(
        routes.task_service,
        "get_task_row",
        AsyncMock(return_value={"id": "t1", "project_id": "p1", "room_id": None, "status": "todo", "title": "x"}),
    )
    monkeypatch.setattr(routes.task_service, "get_agent_row", AsyncMock(return_value=None))
    anf = await client.post("/api/tasks/t1/run", json={"agent_id": "missing"})
    assert anf.status_code == 404

    class NoConnManager:
        def get_default_openclaw(self):
            return None

    monkeypatch.setattr(
        routes.task_service,
        "get_agent_row",
        AsyncMock(return_value={"id": "a1", "name": "Dev", "default_room_id": None}),
    )
    monkeypatch.setattr(routes.task_service, "set_task_running", AsyncMock())
    monkeypatch.setattr(routes, "get_connection_manager", AsyncMock(return_value=NoConnManager()))
    monkeypatch.setattr(routes, "broadcast", AsyncMock())
    ok_no_conn = await client.post("/api/tasks/t1/run", json={"agent_id": "a1"})
    assert ok_no_conn.status_code == 200

    monkeypatch.setattr(routes.task_service, "set_task_running", AsyncMock(side_effect=RuntimeError("set failed")))
    err = await client.post("/api/tasks/t1/run", json={"agent_id": "a1"})
    assert err.status_code == 500


async def test_not_found_helper():
    with pytest.raises(HTTPException) as exc:
        await routes._not_found("X")
    assert exc.value.status_code == 404
