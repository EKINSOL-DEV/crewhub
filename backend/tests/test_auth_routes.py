import json

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

import app.routes.auth_routes as routes
from app.auth import init_api_keys
from app.db.database import DB_DIR, get_db


@pytest.fixture
async def client():
    await init_api_keys()
    app = FastAPI()
    app.include_router(routes.router)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://127.0.0.1") as ac:
        yield ac


def _admin_key_from_file():
    return json.loads((DB_DIR / "api-keys.json").read_text())["keys"][0]["key"]


@pytest.mark.asyncio
async def test_create_key_validation_and_env_fallback(client):
    admin_key = _admin_key_from_file()
    assert (
        await client.post("/api/auth/keys", headers={"X-API-Key": admin_key}, json={"name": "bad", "scopes": ["nope"]})
    ).status_code == 400
    assert (
        await client.post("/api/auth/keys", headers={"X-API-Key": admin_key}, json={"name": "empty", "scopes": []})
    ).status_code == 400

    created = await client.post(
        "/api/auth/keys",
        headers={"X-API-Key": admin_key},
        json={"name": "ok", "scopes": ["read"], "env": "unknown", "expires_in_days": 1},
    )
    assert created.status_code == 200
    assert created.json()["key"].startswith("ch_live_")


@pytest.mark.asyncio
async def test_list_keys_include_revoked_and_expired_flag(client):
    admin_key = _admin_key_from_file()
    async with get_db() as db:
        await db.execute(
            "INSERT INTO api_keys (id, key_hash, key_prefix, name, scopes, agent_id, revoked, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("key_expired", "h1", "pref", "Expired", '["read"]', None, 0, 1, 2),
        )
        await db.execute(
            "INSERT INTO api_keys (id, key_hash, key_prefix, name, scopes, agent_id, revoked, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("key_revoked", "h2", "pref", "Revoked", '["read"]', None, 1, 1, None),
        )
        await db.commit()

    visible = await client.get("/api/auth/keys", headers={"X-API-Key": admin_key})
    assert visible.status_code == 200
    ids = {k["id"] for k in visible.json()["keys"]}
    assert "key_expired" in ids and "key_revoked" not in ids

    all_keys = await client.get("/api/auth/keys", headers={"X-API-Key": admin_key}, params={"include_revoked": True})
    assert all_keys.status_code == 200
    assert "key_revoked" in {k["id"] for k in all_keys.json()["keys"]}


@pytest.mark.asyncio
async def test_revoke_self_and_not_found(client):
    class Key:
        key_id = "key_current"

    with pytest.raises(HTTPException):
        await routes.revoke_key("key_current", Key())
    with pytest.raises(HTTPException):
        await routes.revoke_key("missing", Key())


@pytest.mark.asyncio
async def test_audit_log_endpoints(client):
    admin_key = _admin_key_from_file()
    async with get_db() as db:
        await db.execute(
            "INSERT INTO api_keys (id, key_hash, key_prefix, name, scopes, agent_id, revoked, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("key_audit", "ha", "pref", "Audit", '["read"]', None, 0, 1, None),
        )
        await db.execute(
            "INSERT INTO api_key_audit_log (key_id, endpoint, method, status_code, ip_addr, used_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("key_audit", "/x", "GET", 200, "127.0.0.1", 100),
        )
        await db.commit()

    assert (await client.get("/api/auth/keys/key_audit/audit", headers={"X-API-Key": admin_key})).status_code == 200
    assert (await client.get("/api/auth/keys/missing/audit", headers={"X-API-Key": admin_key})).status_code == 404
    assert (await client.delete("/api/auth/keys/key_audit/audit", headers={"X-API-Key": admin_key})).status_code == 200


@pytest.mark.asyncio
async def test_cleanup_and_local_bootstrap(client, monkeypatch, tmp_path):
    admin_key = _admin_key_from_file()
    assert (await client.post("/api/auth/keys/cleanup", headers={"X-API-Key": admin_key})).status_code == 200

    key_file = tmp_path / "api-keys.json"
    key_file.write_text(json.dumps({"keys": [{"key": "k1", "scopes": ["read"]}, {"key": "k2", "scopes": ["manage"]}]}))
    monkeypatch.setattr("os.path.expanduser", lambda _p: str(key_file))

    ok = await client.get("/api/auth/local-bootstrap")
    assert ok.status_code == 200
    assert ok.json()["key"] == "k2"
