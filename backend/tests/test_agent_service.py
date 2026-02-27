import sys
import types
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.db.database import get_db
from app.services import agent_service


@pytest.fixture(autouse=True)
async def clean_agents_tables():
    async with get_db() as db:
        await db.execute("DELETE FROM session_display_names")
        await db.execute("DELETE FROM agents")
        await db.commit()


@pytest.mark.asyncio
async def test_build_agent_dict_maps_flags():
    row = {
        "id": "a1",
        "name": "Agent",
        "icon": "🤖",
        "avatar_url": None,
        "color": "#000",
        "agent_session_key": "agent:a1:main",
        "default_model": "sonnet",
        "default_room_id": "headquarters",
        "sort_order": 2,
        "is_pinned": 1,
        "auto_spawn": 0,
        "bio": "bio",
        "created_at": 1,
        "updated_at": 2,
    }
    built = agent_service._build_agent_dict(row, "Display", True)
    assert built["is_pinned"] is True
    assert built["auto_spawn"] is False
    assert built["display_name"] == "Display"
    assert built["is_stale"] is True


@pytest.mark.asyncio
async def test_create_get_list_update_delete_agent():
    created = await agent_service.create_agent("alpha", "Alpha")
    assert created == {"success": True, "agent_id": "alpha"}

    async with get_db() as db:
        await db.execute(
            "INSERT INTO session_display_names (session_key, display_name, updated_at) VALUES (?, ?, ?)",
            ("agent:alpha:main", "Alpha Display", 1),
        )
        await db.commit()

    one = await agent_service.get_agent("alpha", gateway_ids={"alpha"}, gateway_reachable=True)
    assert one["display_name"] == "Alpha Display"
    assert one["is_stale"] is False

    listed = await agent_service.list_agents(gateway_ids=set(), gateway_reachable=True)
    assert len(listed) == 1
    assert listed[0]["is_stale"] is True

    updated = await agent_service.update_agent("alpha", {"name": "Alpha 2", "is_pinned": True})
    assert updated["success"] is True
    assert set(updated["updated"]) == {"name", "is_pinned"}

    deleted = await agent_service.delete_agent("alpha")
    assert deleted == {"status": "deleted", "id": "alpha"}


@pytest.mark.asyncio
async def test_create_agent_duplicate_and_default_bio():
    await agent_service.create_agent("dup", "Dup")
    with pytest.raises(HTTPException) as e:
        await agent_service.create_agent("dup", "Dup")
    assert e.value.status_code == 409


@pytest.mark.asyncio
async def test_get_update_delete_not_found_and_empty_update():
    with pytest.raises(HTTPException) as e1:
        await agent_service.get_agent("missing", gateway_ids=set(), gateway_reachable=False)
    assert e1.value.status_code == 404

    with pytest.raises(HTTPException) as e2:
        await agent_service.update_agent("missing", {"name": "x"})
    assert e2.value.status_code == 404

    with pytest.raises(HTTPException) as e3:
        await agent_service.update_agent("missing", {})
    assert e3.value.status_code == 400

    with pytest.raises(HTTPException) as e4:
        await agent_service.delete_agent("missing")
    assert e4.value.status_code == 404


@pytest.mark.asyncio
async def test_get_gateway_agent_ids_success_and_failures(monkeypatch):
    conn = AsyncMock()
    conn.call.return_value = {"heartbeat": {"agents": [{"agentId": "main"}, {"agentId": "dev"}, {"agentId": None}]}}

    class Manager:
        def __init__(self, c):
            self._conn = c

        def get_default_openclaw(self):
            return self._conn

    manager = Manager(conn)

    async def fake_get_connection_manager():
        return manager

    fake_module = types.SimpleNamespace(get_connection_manager=fake_get_connection_manager)
    monkeypatch.setitem(sys.modules, "app.services.connections", fake_module)

    ids = await agent_service.get_gateway_agent_ids()
    assert ids == {"main", "dev"}

    manager._conn = None
    assert await agent_service.get_gateway_agent_ids() == set()

    async def boom_get_connection_manager():
        raise RuntimeError("boom")

    monkeypatch.setitem(
        sys.modules,
        "app.services.connections",
        types.SimpleNamespace(get_connection_manager=boom_get_connection_manager),
    )
    assert await agent_service.get_gateway_agent_ids() == set()


@pytest.mark.asyncio
async def test_sync_agents_from_gateway(monkeypatch):
    conn = AsyncMock()
    conn.call.return_value = {"heartbeat": {"agents": [{"agentId": "main"}, {"agentId": "custom"}, {"oops": 1}]}}

    class Manager:
        def __init__(self, c):
            self._conn = c

        def get_default_openclaw(self):
            return self._conn

    manager = Manager(conn)

    async def fake_get_connection_manager():
        return manager

    monkeypatch.setitem(
        sys.modules,
        "app.services.connections",
        types.SimpleNamespace(get_connection_manager=fake_get_connection_manager),
    )

    upserted = await agent_service.sync_agents_from_gateway()
    assert upserted >= 1

    agents = await agent_service.list_agents(gateway_ids={"main", "custom"}, gateway_reachable=True)
    ids = {a["id"] for a in agents}
    assert {"main", "custom"}.issubset(ids)

    # no status
    conn.call.return_value = None
    assert await agent_service.sync_agents_from_gateway() == 0

    # exception path
    async def boom_get_connection_manager():
        raise RuntimeError("boom")

    monkeypatch.setitem(
        sys.modules,
        "app.services.connections",
        types.SimpleNamespace(get_connection_manager=boom_get_connection_manager),
    )
    assert await agent_service.sync_agents_from_gateway() == 0
