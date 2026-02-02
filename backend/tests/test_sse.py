"""Tests for SSE endpoints."""

import pytest


@pytest.mark.asyncio
async def test_notify_endpoint(client):
    """Test POST /api/notify broadcasts to clients."""
    response = await client.post(
        "/api/notify",
        json={"type": "test", "data": {"message": "hello"}}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert "clients" in data
    assert isinstance(data["clients"], int)


@pytest.mark.asyncio
async def test_notify_default_type(client):
    """Test POST /api/notify uses default type 'update'."""
    response = await client.post(
        "/api/notify",
        json={}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
