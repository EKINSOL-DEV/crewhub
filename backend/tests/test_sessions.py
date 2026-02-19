"""Tests for sessions endpoints."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock


# Defer imports to avoid triggering circular imports at collection time.
# SessionInfo is imported inside tests that need it.


@pytest.mark.asyncio
async def test_list_sessions(client):
    """Test GET /api/sessions returns session list."""
    from app.services.connections.base import SessionInfo
    with patch('app.routes.sessions.get_connection_manager') as mock_get_mgr:
        mock_mgr = AsyncMock()
        mock_mgr.get_all_sessions.return_value = [
            SessionInfo(
                key="agent:main:main",
                session_id="test-123",
                source="openclaw",
                connection_id="default",
                status="active",
            )
        ]
        mock_get_mgr.return_value = mock_mgr

        response = await client.get("/api/sessions")
        assert response.status_code == 200
        data = response.json()
        assert "sessions" in data
        assert isinstance(data["sessions"], list)


@pytest.mark.asyncio
async def test_spawn_session_validation(client):
    """Test POST /api/sessions/spawn — route not yet implemented."""
    response = await client.post("/api/sessions/spawn", json={})
    assert response.status_code == 405  # Route does not exist yet
