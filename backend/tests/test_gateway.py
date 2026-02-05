"""Tests for gateway status endpoints."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.connections.base import ConnectionStatus


@pytest.mark.asyncio
async def test_gateway_status(client):
    """Test GET /api/gateway/status returns connection status."""
    mock_conn = MagicMock()
    mock_conn.is_connected.return_value = True
    mock_conn.uri = "ws://127.0.0.1:18789"
    mock_conn.status = ConnectionStatus.CONNECTED

    mock_mgr = MagicMock()
    mock_mgr.get_default_openclaw.return_value = mock_conn

    with patch('app.routes.gateway_status.get_connection_manager', new_callable=AsyncMock, return_value=mock_mgr):
        response = await client.get("/api/gateway/status")
        assert response.status_code == 200
        data = response.json()
        assert "connected" in data


@pytest.mark.asyncio
async def test_gateway_status_no_connection(client):
    """Test GET /api/gateway/status when no connection exists."""
    mock_mgr = MagicMock()
    mock_mgr.get_default_openclaw.return_value = None

    with patch('app.routes.gateway_status.get_connection_manager', new_callable=AsyncMock, return_value=mock_mgr):
        response = await client.get("/api/gateway/status")
        assert response.status_code == 200
        data = response.json()
        assert data["connected"] is False
