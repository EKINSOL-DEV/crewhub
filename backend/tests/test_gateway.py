"""Tests for gateway endpoints."""

import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_gateway_status(client):
    """Test GET /api/gateway/status returns connection status."""
    with patch('app.routes.gateway_status.get_gateway') as mock_get_gateway:
        mock_gateway = AsyncMock()
        mock_gateway.connected = True
        mock_gateway.uri = "ws://127.0.0.1:18789"
        mock_get_gateway.return_value = mock_gateway
        
        response = await client.get("/api/gateway/status")
        assert response.status_code == 200
        data = response.json()
        assert "connected" in data
        assert "uri" in data
        assert data["connected"] is True
        assert data["uri"] == "ws://127.0.0.1:18789"


@pytest.mark.asyncio
async def test_gateway_status_disconnected(client):
    """Test GET /api/gateway/status when disconnected."""
    with patch('app.routes.gateway_status.get_gateway') as mock_get_gateway:
        mock_gateway = AsyncMock()
        mock_gateway.connected = False
        mock_gateway.uri = "ws://127.0.0.1:18789"
        mock_get_gateway.return_value = mock_gateway
        
        response = await client.get("/api/gateway/status")
        assert response.status_code == 200
        data = response.json()
        assert data["connected"] is False


@pytest.mark.asyncio
async def test_gateway_full_status(client):
    """Test GET /api/gateway/full-status returns extended info."""
    with patch('app.routes.gateway_status.get_gateway') as mock_get_gateway:
        mock_gateway = AsyncMock()
        mock_gateway.connected = True
        mock_gateway.uri = "ws://127.0.0.1:18789"
        mock_gateway.get_status.return_value = {
            "version": "1.0.0",
            "uptime": 12345
        }
        mock_get_gateway.return_value = mock_gateway
        
        response = await client.get("/api/gateway/full-status")
        assert response.status_code == 200
        data = response.json()
        assert "connected" in data
        assert "uri" in data
        assert "openclaw" in data
        assert data["openclaw"]["version"] == "1.0.0"
