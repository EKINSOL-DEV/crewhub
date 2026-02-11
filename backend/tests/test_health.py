"""Tests for health endpoints."""

import pytest


@pytest.mark.asyncio
async def test_health_check(client):
    """Test /health endpoint returns healthy status."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_readiness_check(client):
    """Test /ready endpoint returns ready status."""
    response = await client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"


@pytest.mark.asyncio
async def test_root_endpoint(client):
    """Test root endpoint returns API info."""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "CrewHub API"
    # Version is read dynamically from version.json
    assert "version" in data
    assert data["status"] == "running"
