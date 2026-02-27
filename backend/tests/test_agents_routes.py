import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

import app.routes.agents as routes


@pytest.fixture
async def client():
    app = FastAPI()
    app.include_router(routes.router, prefix="/api/agents")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_create_agent_normalizes_id_and_defaults(client):
    r = await client.post("/api/agents", json={"id": "  My Bot  ", "name": "My Bot"})
    assert r.status_code == 200
    assert r.json()["agent_id"] == "my-bot"


@pytest.mark.asyncio
async def test_list_agents_continues_when_sync_fails(client, monkeypatch):
    async def boom():
        raise RuntimeError("sync fail")

    monkeypatch.setattr(routes.agent_svc, "sync_agents_from_gateway", boom)
    r = await client.get("/api/agents")
    assert r.status_code == 200
    assert "agents" in r.json()


@pytest.mark.asyncio
async def test_generate_bio_not_found(client):
    r = await client.post("/api/agents/nope/generate-bio")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_generate_bio_template_main(client, monkeypatch):
    async def soul(_id):
        return "helpful"

    monkeypatch.setattr(routes, "_read_agent_soul", soul)

    async def activity(_id):
        return "user: hi"

    monkeypatch.setattr(routes, "_get_agent_recent_activity", activity)

    r = await client.post("/api/agents/main/generate-bio")
    assert r.status_code == 200
    assert "orchestrator" in r.json()["bio"].lower()


@pytest.mark.asyncio
async def test_generate_bio_personality_hints_for_custom_agent(client, monkeypatch):
    await client.post("/api/agents", json={"id": "helper", "name": "Helper"})

    async def soul(_id):
        return "Very helpful and creative"

    monkeypatch.setattr(routes, "_read_agent_soul", soul)

    async def activity(_id):
        return ""

    monkeypatch.setattr(routes, "_get_agent_recent_activity", activity)

    r = await client.post("/api/agents/helper/generate-bio")
    assert r.status_code == 200
    assert "helpful" in r.json()["bio"].lower()


@pytest.mark.asyncio
async def test_get_recent_activity_handles_content_list_and_filters(monkeypatch):
    class Conn:
        async def get_sessions_raw(self):
            return [{"key": "agent:dev:main"}]

        async def get_session_history_raw(self, _key, limit=20):
            return [
                {"role": "system", "content": "skip"},
                {"role": "user", "content": [{"text": "hello"}]},
                {"role": "assistant", "content": "world"},
            ]

    class Manager:
        def get_default_openclaw(self):
            return Conn()

    async def fake_mgr():
        return Manager()

    monkeypatch.setattr("app.services.connections.get_connection_manager", fake_mgr)

    out = await routes._get_agent_recent_activity("dev")
    assert "user: hello" in out
    assert "assistant: world" in out
