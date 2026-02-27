import json
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.auth import APIKeyInfo, init_api_keys
from app.db.database import DB_DIR, get_db
from app.routes import self_routes as routes

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
async def _init_keys():
    await init_api_keys()


def _self_headers() -> dict[str, str]:
    with open(DB_DIR / "api-keys.json") as f:
        key = json.load(f)["keys"][1]["key"]
    return {"X-API-Key": key}


async def test_helper_resolvers_and_metadata_direct():
    key = APIKeyInfo(key_id="k1", name="k1", scopes=["self"])

    async with get_db() as db:
        await db.execute(
            "INSERT INTO agents (id, name, icon, color, default_room_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("agent:dev", "Dev", "🤖", "#fff", "room-a", 1, 1),
        )
        await db.execute(
            "INSERT INTO agent_identities (agent_id, session_key, api_key_id, runtime, bound_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("agent:dev", "agent:dev:main", "k1", "codex", 1, 2),
        )
        await db.execute(
            "INSERT INTO session_display_names (session_key, display_name, updated_at) VALUES (?, ?, ?)",
            ("agent:dev:main", "Dev Main", 1),
        )
        await db.execute(
            "INSERT INTO session_room_assignments (session_key, room_id, assigned_at) VALUES (?, ?, ?)",
            ("agent:dev:main", "room-a", 1),
        )
        await db.commit()

    assert await routes._resolve_agent_id(key) == "agent:dev"
    assert await routes._resolve_session_key(key, "agent:dev") == "agent:dev:main"
    md = await routes._get_agent_metadata("agent:dev")
    assert md["default_room_id"] == "room-a"
    assert await routes._get_display_name("agent:dev:main") == "Dev Main"
    assert await routes._get_room_id("agent:dev:main") == "room-a"
    assert await routes._get_agent_metadata("missing") == {}


async def test_validate_identify_access():
    routes._validate_identify_access(APIKeyInfo(key_id="k", name="k", scopes=["self"], agent_id="a1"), "a1")
    with pytest.raises(HTTPException) as e:
        routes._validate_identify_access(APIKeyInfo(key_id="k", name="k", scopes=["self"], agent_id="a1"), "a2")
    assert e.value.status_code == 403


async def test_create_or_update_identity_direct_branches(monkeypatch):
    now = 123
    body = routes.IdentifyRequest(agent_id="agent:new", runtime="codex", session_key="agent:new:main")
    key = APIKeyInfo(key_id="k-manage", name="k-manage", scopes=["self", "manage"])

    monkeypatch.setattr(routes, "check_identity_creation_rate", lambda _k: False)
    with pytest.raises(HTTPException) as e:
        await routes._create_or_update_identity(body, key, now)
    assert e.value.status_code == 429

    monkeypatch.setattr(routes, "check_identity_creation_rate", lambda _k: True)
    monkeypatch.setattr(routes, "record_identity_creation", lambda *_args, **_kw: None)
    created = await routes._create_or_update_identity(body, key, now)
    assert created is True

    # Existing agent, key without manage trying to claim identity owned by another key
    async with get_db() as db:
        await db.execute(
            "INSERT INTO agents (id, name, icon, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("agent:owned", "Owned", "🤖", "#fff", 1, 1),
        )
        await db.execute(
            "INSERT INTO agent_identities (agent_id, session_key, api_key_id, runtime, bound_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("agent:owned", "agent:owned:main", "owner-key", "codex", 1, 1),
        )
        await db.commit()

    no_manage = APIKeyInfo(key_id="not-owner", name="not-owner", scopes=["self"])
    with pytest.raises(HTTPException) as e2:
        await routes._create_or_update_identity(
            routes.IdentifyRequest(agent_id="agent:owned", runtime="codex", session_key="agent:owned:main"),
            no_manage,
            now,
        )
    assert e2.value.status_code == 403


async def test_identify_and_get_self_flow(client):
    headers = _self_headers()

    resp = await client.post(
        "/api/self/identify",
        headers=headers,
        json={"agent_id": "agent:dev", "runtime": "codex", "session_key": "agent:dev:main"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["agent_id"] == "agent:dev"

    me = await client.get("/api/self", headers=headers)
    assert me.status_code == 200
    assert me.json()["agent_id"] == "agent:dev"


async def test_get_self_no_identity(client):
    headers = _self_headers()
    me = await client.get("/api/self", headers=headers)
    assert me.status_code == 200
    assert me.json()["agent_id"] is None


async def test_set_display_name_and_room_and_heartbeat(client, monkeypatch):
    headers = _self_headers()
    await client.post(
        "/api/self/identify",
        headers=headers,
        json={"agent_id": "agent:dev", "runtime": "codex", "session_key": "agent:dev:main"},
    )

    dn = await client.post("/api/self/display-name", headers=headers, json={"display_name": "DevX"})
    assert dn.status_code == 200
    assert dn.json()["display_name"] == "DevX"

    async with get_db() as db:
        await db.execute(
            "INSERT INTO rooms (id, name, is_hq, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("room-1", "Room 1", 0, None, 1, 1),
        )
        await db.commit()

    bcast = AsyncMock()
    monkeypatch.setattr(routes, "broadcast", bcast)
    room = await client.post("/api/self/room", headers=headers, json={"room_id": "room-1"})
    assert room.status_code == 200
    bcast.assert_awaited_once()

    hb = await client.post("/api/self/heartbeat", headers=headers, json={"status": "ok"})
    assert hb.status_code == 200


async def test_self_error_paths(client):
    headers = _self_headers()

    dn = await client.post("/api/self/display-name", headers=headers, json={"display_name": "X"})
    assert dn.status_code == 400

    rm = await client.post("/api/self/room", headers=headers, json={"room_id": "x"})
    assert rm.status_code == 400

    hb = await client.post("/api/self/heartbeat", headers=headers, json={})
    assert hb.status_code == 400

    await client.post("/api/self/identify", headers=headers, json={"agent_id": "agent:no-session", "runtime": "codex"})
    dn2 = await client.post("/api/self/display-name", headers=headers, json={"display_name": "X"})
    assert dn2.status_code == 400
    rm2 = await client.post("/api/self/room", headers=headers, json={"room_id": "x"})
    assert rm2.status_code == 400


async def test_room_not_found_and_bound_access_forbidden(client):
    headers = _self_headers()
    await client.post(
        "/api/self/identify",
        headers=headers,
        json={"agent_id": "agent:dev", "runtime": "codex", "session_key": "agent:dev:main"},
    )
    rm_nf = await client.post("/api/self/room", headers=headers, json={"room_id": "missing"})
    assert rm_nf.status_code == 404

    # Use direct function check for forbidden bound mismatch
    with pytest.raises(HTTPException):
        routes._validate_identify_access(
            APIKeyInfo(key_id="k", name="k", scopes=["self"], agent_id="agent:a"), "agent:b"
        )
