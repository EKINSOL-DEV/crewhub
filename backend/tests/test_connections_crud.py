"""Tests for connections CRUD endpoints."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_list_connections(client):
    """Test GET /api/connections returns connections list."""
    response = await client.get("/api/connections")
    assert response.status_code == 200
    data = response.json()
    assert "connections" in data
    assert "total" in data
    assert isinstance(data["connections"], list)
    # No default connections are seeded; total may be 0
    assert data["total"] >= 0


@pytest.mark.asyncio
async def test_get_connection(client):
    """Test GET /api/connections/{id} returns a specific connection."""
    # Create a connection first (no default connections are seeded)
    await client.post("/api/connections", json={
        "id": "test-openclaw",
        "name": "Test Gateway",
        "type": "openclaw",
        "enabled": True,
    })
    response = await client.get("/api/connections/test-openclaw")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "test-openclaw"
    assert data["name"] == "Test Gateway"
    assert data["type"] == "openclaw"
    assert data["enabled"] is True


@pytest.mark.asyncio
async def test_get_connection_not_found(client):
    """Test GET /api/connections/{id} returns 404 for missing connection."""
    response = await client.get("/api/connections/nonexistent")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_connection(client):
    """Test POST /api/connections creates a new connection."""
    new_conn = {
        "id": "test-conn",
        "name": "Test Connection",
        "type": "claude_code",
        "config": {"data_dir": "~/.claude"},
        "enabled": False,
    }
    response = await client.post("/api/connections", json=new_conn)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == "test-conn"
    assert data["name"] == "Test Connection"
    assert data["type"] == "claude_code"
    assert data["config"]["data_dir"] == "~/.claude"
    assert data["enabled"] is False


@pytest.mark.asyncio
async def test_create_connection_auto_id(client):
    """Test POST /api/connections auto-generates ID if not provided."""
    response = await client.post("/api/connections", json={
        "name": "Auto ID Connection",
        "type": "codex",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["id"]  # Should have a UUID
    assert len(data["id"]) > 10


@pytest.mark.asyncio
async def test_create_connection_invalid_type(client):
    """Test POST /api/connections rejects invalid type."""
    response = await client.post("/api/connections", json={
        "name": "Invalid Type",
        "type": "invalid_type",
    })
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_create_connection_duplicate_id(client):
    """Test POST /api/connections rejects duplicate ID."""
    # Create a connection first
    await client.post("/api/connections", json={
        "id": "dup-test",
        "name": "Original",
        "type": "openclaw",
    })
    # Try to create with same ID
    response = await client.post("/api/connections", json={
        "id": "dup-test",
        "name": "Duplicate",
        "type": "openclaw",
    })
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_update_connection(client):
    """Test PATCH /api/connections/{id} updates a connection."""
    # Create a disabled connection first
    await client.post("/api/connections", json={
        "id": "update-test",
        "name": "Before Update",
        "type": "codex",
        "enabled": False,
    })

    response = await client.patch("/api/connections/update-test", json={
        "name": "After Update",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "After Update"


@pytest.mark.asyncio
async def test_update_connection_not_found(client):
    """Test PATCH /api/connections/{id} returns 404 for missing."""
    response = await client.patch("/api/connections/nonexistent", json={
        "name": "Test",
    })
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_connection(client):
    """Test DELETE /api/connections/{id} deletes a connection."""
    # Create first
    await client.post("/api/connections", json={
        "id": "to-delete",
        "name": "Delete Me",
        "type": "codex",
        "enabled": False,
    })

    response = await client.delete("/api/connections/to-delete")
    assert response.status_code == 204

    # Verify it's gone
    response = await client.get("/api/connections/to-delete")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_connection_not_found(client):
    """Test DELETE /api/connections/{id} returns 404 for missing."""
    response = await client.delete("/api/connections/nonexistent")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_connection_config_is_dict(client):
    """Test that config is returned as a dict, not a JSON string."""
    # Create a connection with config
    await client.post("/api/connections", json={
        "id": "config-test",
        "name": "Config Test",
        "type": "claude_code",
        "config": {"data_dir": "~/.claude"},
    })
    response = await client.get("/api/connections/config-test")
    data = response.json()
    assert isinstance(data["config"], dict)
