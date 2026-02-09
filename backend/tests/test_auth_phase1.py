"""
Integration tests for Phase 1: Auth + Identity + Self endpoints.

Run with: python3 -m pytest tests/test_auth_phase1.py -v
"""

import json
import os
import tempfile
import pytest
import pytest_asyncio
from pathlib import Path

# Set test DB to temp dir before importing app
_test_dir = tempfile.mkdtemp(prefix="crewhub_test_")
TEST_DB = os.path.join(_test_dir, "crewhub.db")
os.environ["CREWHUB_DB_PATH"] = TEST_DB

from httpx import ASGITransport, AsyncClient
from app.main import app
from app.auth import init_api_keys, generate_api_key, hash_key
from app.db.database import init_database, DB_DIR


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """Init DB and API keys before each test."""
    # Remove old DB
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)
    await init_database()
    await init_api_keys()
    yield
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)


def _get_keys():
    """Read keys from generated files."""
    agent_json = DB_DIR / "agent.json"
    api_keys_json = DB_DIR / "api-keys.json"
    with open(agent_json) as f:
        self_key = json.load(f)["auth"]["default_key"]
    with open(api_keys_json) as f:
        admin_key = json.load(f)["keys"][0]["key"]
    return self_key, admin_key


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ── Public endpoints ──────────────────────────────────────────────────

@pytest.mark.anyio
async def test_health_public(client):
    r = await client.get("/health")
    assert r.status_code == 200


@pytest.mark.anyio
async def test_root_public(client):
    r = await client.get("/")
    assert r.status_code == 200


# ── Auth enforcement ──────────────────────────────────────────────────

@pytest.mark.anyio
async def test_self_requires_auth(client):
    r = await client.get("/api/self")
    assert r.status_code == 401


@pytest.mark.anyio
async def test_invalid_key_returns_401(client):
    r = await client.get("/api/self", headers={"X-API-Key": "chk_fake_invalid"})
    assert r.status_code == 401


# ── Self endpoints ────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_identify_existing_agent(client):
    self_key, _ = _get_keys()
    r = await client.post(
        "/api/self/identify",
        headers={"X-API-Key": self_key},
        json={"agent_id": "dev", "session_key": "agent:dev:main", "runtime": "openclaw"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["agent_id"] == "dev"
    assert data["session_key"] == "agent:dev:main"
    assert data["created"] is False


@pytest.mark.anyio
async def test_identify_idempotent(client):
    self_key, _ = _get_keys()
    body = {"agent_id": "dev", "session_key": "agent:dev:main"}
    r1 = await client.post("/api/self/identify", headers={"X-API-Key": self_key}, json=body)
    r2 = await client.post("/api/self/identify", headers={"X-API-Key": self_key}, json=body)
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["agent_id"] == r2.json()["agent_id"]


@pytest.mark.anyio
async def test_identify_new_agent_self_key_forbidden(client):
    self_key, _ = _get_keys()
    r = await client.post(
        "/api/self/identify",
        headers={"X-API-Key": self_key},
        json={"agent_id": "totally-new-agent", "session_key": "t:1"},
    )
    assert r.status_code == 403


@pytest.mark.anyio
async def test_identify_new_agent_admin_key(client):
    _, admin_key = _get_keys()
    r = await client.post(
        "/api/self/identify",
        headers={"X-API-Key": admin_key},
        json={"agent_id": "new-test-agent", "session_key": "test:new:1", "runtime": "test"},
    )
    assert r.status_code == 200
    assert r.json()["created"] is True


@pytest.mark.anyio
async def test_get_self_after_identify(client):
    self_key, _ = _get_keys()
    await client.post(
        "/api/self/identify",
        headers={"X-API-Key": self_key},
        json={"agent_id": "dev", "session_key": "agent:dev:main"},
    )
    r = await client.get("/api/self", headers={"X-API-Key": self_key})
    assert r.status_code == 200
    assert r.json()["agent_id"] == "dev"


@pytest.mark.anyio
async def test_set_display_name(client):
    self_key, _ = _get_keys()
    await client.post(
        "/api/self/identify",
        headers={"X-API-Key": self_key},
        json={"agent_id": "dev", "session_key": "agent:dev:main"},
    )
    r = await client.post(
        "/api/self/display-name",
        headers={"X-API-Key": self_key},
        json={"display_name": "Test Name"},
    )
    assert r.status_code == 200
    assert r.json()["display_name"] == "Test Name"


@pytest.mark.anyio
async def test_set_room(client):
    self_key, _ = _get_keys()
    await client.post(
        "/api/self/identify",
        headers={"X-API-Key": self_key},
        json={"agent_id": "dev", "session_key": "agent:dev:main"},
    )
    r = await client.post(
        "/api/self/room",
        headers={"X-API-Key": self_key},
        json={"room_id": "dev-room"},
    )
    assert r.status_code == 200
    assert r.json()["room_id"] == "dev-room"


@pytest.mark.anyio
async def test_set_room_invalid(client):
    self_key, _ = _get_keys()
    await client.post(
        "/api/self/identify",
        headers={"X-API-Key": self_key},
        json={"agent_id": "dev", "session_key": "agent:dev:main"},
    )
    r = await client.post(
        "/api/self/room",
        headers={"X-API-Key": self_key},
        json={"room_id": "nonexistent"},
    )
    assert r.status_code == 404


@pytest.mark.anyio
async def test_heartbeat(client):
    self_key, _ = _get_keys()
    await client.post(
        "/api/self/identify",
        headers={"X-API-Key": self_key},
        json={"agent_id": "dev", "session_key": "agent:dev:main"},
    )
    r = await client.post(
        "/api/self/heartbeat",
        headers={"X-API-Key": self_key},
        json={"status": "working"},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True


@pytest.mark.anyio
async def test_display_name_before_identify(client):
    self_key, _ = _get_keys()
    r = await client.post(
        "/api/self/display-name",
        headers={"X-API-Key": self_key},
        json={"display_name": "Test"},
    )
    assert r.status_code == 400


# ── Auth key management ───────────────────────────────────────────────

@pytest.mark.anyio
async def test_list_keys_admin(client):
    _, admin_key = _get_keys()
    r = await client.get("/api/auth/keys", headers={"X-API-Key": admin_key})
    assert r.status_code == 200
    assert len(r.json()["keys"]) >= 2


@pytest.mark.anyio
async def test_list_keys_self_forbidden(client):
    self_key, _ = _get_keys()
    r = await client.get("/api/auth/keys", headers={"X-API-Key": self_key})
    assert r.status_code == 403


@pytest.mark.anyio
async def test_create_key(client):
    _, admin_key = _get_keys()
    r = await client.post(
        "/api/auth/keys",
        headers={"X-API-Key": admin_key},
        json={"name": "Test Key", "scopes": ["read"]},
    )
    assert r.status_code == 200
    assert r.json()["key"].startswith("chk_read_")


@pytest.mark.anyio
async def test_create_bound_key(client):
    _, admin_key = _get_keys()
    r = await client.post(
        "/api/auth/keys",
        headers={"X-API-Key": admin_key},
        json={"name": "Bound", "scopes": ["read", "self"], "agent_id": "dev"},
    )
    assert r.status_code == 200
    assert r.json()["agent_id"] == "dev"


@pytest.mark.anyio
async def test_revoke_key(client):
    _, admin_key = _get_keys()
    r = await client.post(
        "/api/auth/keys",
        headers={"X-API-Key": admin_key},
        json={"name": "To Revoke", "scopes": ["read"]},
    )
    key_id = r.json()["id"]
    raw_key = r.json()["key"]

    r = await client.delete(f"/api/auth/keys/{key_id}", headers={"X-API-Key": admin_key})
    assert r.status_code == 200

    r = await client.get("/api/self", headers={"X-API-Key": raw_key})
    assert r.status_code == 401


@pytest.mark.anyio
async def test_key_self_info(client):
    self_key, _ = _get_keys()
    r = await client.get("/api/auth/keys/self", headers={"X-API-Key": self_key})
    assert r.status_code == 200
    assert "self" in r.json()["scopes"]


@pytest.mark.anyio
async def test_bound_key_locks_identity(client):
    _, admin_key = _get_keys()
    r = await client.post(
        "/api/auth/keys",
        headers={"X-API-Key": admin_key},
        json={"name": "Bound to dev", "scopes": ["read", "self"], "agent_id": "dev"},
    )
    bound_key = r.json()["key"]

    # OK: identify as bound agent
    r = await client.post(
        "/api/self/identify",
        headers={"X-API-Key": bound_key},
        json={"agent_id": "dev", "session_key": "agent:dev:test"},
    )
    assert r.status_code == 200

    # Forbidden: different agent
    r = await client.post(
        "/api/self/identify",
        headers={"X-API-Key": bound_key},
        json={"agent_id": "main", "session_key": "agent:main:test"},
    )
    assert r.status_code == 403


@pytest.mark.anyio
async def test_scope_invalid(client):
    _, admin_key = _get_keys()
    r = await client.post(
        "/api/auth/keys",
        headers={"X-API-Key": admin_key},
        json={"name": "Bad", "scopes": ["superadmin"]},
    )
    assert r.status_code == 400
