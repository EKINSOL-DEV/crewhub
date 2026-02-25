"""Tests for agents registry CRUD endpoints."""

import pytest


@pytest.mark.asyncio
async def test_list_agents(client):
    """Test GET /api/agents returns default agents."""
    response = await client.get("/api/agents")
    assert response.status_code == 200
    data = response.json()
    assert "agents" in data
    assert isinstance(data["agents"], list)
    # Default seed data has 5 agents
    assert len(data["agents"]) >= 5


@pytest.mark.asyncio
async def test_list_agents_sorted(client):
    """Test that agents are returned sorted by sort_order."""
    response = await client.get("/api/agents")
    data = response.json()
    agents = data["agents"]
    for i in range(len(agents) - 1):
        assert agents[i]["sort_order"] <= agents[i + 1]["sort_order"]


@pytest.mark.asyncio
async def test_get_agent(client):
    """Test GET /api/agents/{id} returns a specific agent."""
    response = await client.get("/api/agents/main")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "main"
    assert data["name"] == "Main"
    assert data["icon"] == "🤖"
    assert data["color"] == "#3b82f6"
    assert data["agent_session_key"] == "agent:main:main"


@pytest.mark.asyncio
async def test_get_agent_not_found(client):
    """Test GET /api/agents/{id} returns 404 for missing agent."""
    response = await client.get("/api/agents/nonexistent-agent")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_agent(client):
    """Test PUT /api/agents/{id} updates agent fields."""
    response = await client.put(
        "/api/agents/dev",
        json={
            "name": "Dev Updated",
            "color": "#00ff00",
            "is_pinned": True,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "name" in data["updated"]
    assert "color" in data["updated"]
    assert "is_pinned" in data["updated"]

    # Verify the update
    response = await client.get("/api/agents/dev")
    data = response.json()
    assert data["name"] == "Dev Updated"
    assert data["color"] == "#00ff00"
    assert data["is_pinned"] is True


@pytest.mark.asyncio
async def test_update_agent_not_found(client):
    """Test PUT /api/agents/{id} returns 404 for missing agent."""
    response = await client.put(
        "/api/agents/nonexistent",
        json={
            "name": "Test",
        },
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_agent_no_fields(client):
    """Test PUT /api/agents/{id} returns 400 when no fields provided."""
    response = await client.put("/api/agents/main", json={})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_delete_agent(client):
    """Test DELETE /api/agents/{id} removes an agent."""
    response = await client.delete("/api/agents/reviewer")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "deleted"
    assert data["id"] == "reviewer"

    # Verify it's gone
    response = await client.get("/api/agents/reviewer")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_agent_not_found(client):
    """Test DELETE /api/agents/{id} returns 404 for missing agent."""
    response = await client.delete("/api/agents/nonexistent")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_agent_boolean_fields(client):
    """Test that boolean fields (is_pinned, auto_spawn) are returned correctly."""
    response = await client.get("/api/agents/main")
    data = response.json()
    assert isinstance(data["is_pinned"], bool)
    assert isinstance(data["auto_spawn"], bool)


@pytest.mark.asyncio
async def test_agent_default_room(client):
    """Test that agents have default room assignments."""
    response = await client.get("/api/agents/dev")
    data = response.json()
    assert data["default_room_id"] == "dev-room"
