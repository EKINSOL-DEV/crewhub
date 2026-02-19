"""Tests for settings CRUD endpoints."""

import pytest


@pytest.mark.asyncio
async def test_get_all_settings(client):
    """Test GET /api/settings returns all settings as key-value dict."""
    response = await client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)
    # Default seed settings
    assert "active_agent_id" in data
    assert "layout_mode" in data
    assert data["active_agent_id"] == ""
    assert data["layout_mode"] == "grid"


@pytest.mark.asyncio
async def test_get_setting(client):
    """Test GET /api/settings/{key} returns a specific setting."""
    response = await client.get("/api/settings/active_agent_id")
    assert response.status_code == 200
    data = response.json()
    assert data["key"] == "active_agent_id"
    assert data["value"] == ""
    assert data["updated_at"] > 0


@pytest.mark.asyncio
async def test_get_setting_not_found(client):
    """Test GET /api/settings/{key} returns 404 for missing key."""
    response = await client.get("/api/settings/nonexistent_key")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_setting(client):
    """Test PUT /api/settings/{key} creates or updates a setting."""
    response = await client.put("/api/settings/test_key", json={
        "value": "test_value",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["key"] == "test_key"
    assert data["value"] == "test_value"

    # Verify it persisted
    response = await client.get("/api/settings/test_key")
    assert response.json()["value"] == "test_value"


@pytest.mark.asyncio
async def test_update_setting_upsert(client):
    """Test PUT /api/settings/{key} updates existing setting."""
    # Set initial value
    await client.put("/api/settings/upsert_test", json={"value": "first"})

    # Update
    response = await client.put("/api/settings/upsert_test", json={"value": "second"})
    assert response.status_code == 200
    assert response.json()["value"] == "second"


@pytest.mark.asyncio
async def test_update_settings_batch(client):
    """Test PUT /api/settings/batch updates multiple settings."""
    response = await client.put("/api/settings/batch", json={
        "settings": {
            "batch_key_1": "value_1",
            "batch_key_2": "value_2",
            "batch_key_3": "value_3",
        }
    })
    assert response.status_code == 200
    data = response.json()
    assert data["batch_key_1"] == "value_1"
    assert data["batch_key_2"] == "value_2"
    assert data["batch_key_3"] == "value_3"


@pytest.mark.asyncio
async def test_update_settings_batch_empty(client):
    """Test PUT /api/settings/batch rejects empty settings."""
    response = await client.put("/api/settings/batch", json={
        "settings": {}
    })
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_delete_setting(client):
    """Test DELETE /api/settings/{key} deletes a setting."""
    # Create first
    await client.put("/api/settings/to_delete", json={"value": "bye"})

    response = await client.delete("/api/settings/to_delete")
    assert response.status_code == 204

    # Verify it's gone
    response = await client.get("/api/settings/to_delete")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_setting_not_found(client):
    """Test DELETE /api/settings/{key} returns 404 for missing key."""
    response = await client.delete("/api/settings/nonexistent")
    assert response.status_code == 404
