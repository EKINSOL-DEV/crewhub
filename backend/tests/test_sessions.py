"""Tests for sessions endpoints."""

import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_list_sessions(client):
    """Test GET /api/sessions returns session list."""
    # Mock the gateway to avoid real connection
    with patch('app.routes.sessions.get_gateway') as mock_get_gateway:
        mock_gateway = AsyncMock()
        mock_gateway.get_sessions.return_value = [
            {"key": "agent:main:main", "sessionId": "test-123"}
        ]
        mock_get_gateway.return_value = mock_gateway
        
        response = await client.get("/api/sessions")
        assert response.status_code == 200
        data = response.json()
        assert "sessions" in data
        assert isinstance(data["sessions"], list)


@pytest.mark.asyncio
async def test_spawn_session_validation(client):
    """Test POST /api/sessions/spawn requires task field."""
    # Empty body should fail validation
    response = await client.post(
        "/api/sessions/spawn",
        json={}
    )
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_session_history(client):
    """Test GET /api/sessions/{key}/history returns history."""
    with patch('app.routes.sessions.get_gateway') as mock_get_gateway:
        mock_gateway = AsyncMock()
        mock_gateway.get_session_history.return_value = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"}
        ]
        mock_get_gateway.return_value = mock_gateway
        
        response = await client.get("/api/sessions/agent:main:main/history")
        assert response.status_code == 200
        data = response.json()
        assert "history" in data
        assert "count" in data
        assert data["count"] == 2


@pytest.mark.asyncio
async def test_spawn_session_success(client):
    """Test POST /api/sessions/spawn creates a new session."""
    with patch('app.routes.sessions.get_gateway') as mock_get_gateway:
        mock_gateway = AsyncMock()
        mock_gateway.spawn_session.return_value = {
            "sessionId": "new-session-123",
            "key": "agent:main:subagent:new-session-123"
        }
        mock_get_gateway.return_value = mock_gateway
        
        response = await client.post(
            "/api/sessions/spawn",
            json={"task": "Test task", "model": "sonnet"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "sessionId" in data


@pytest.mark.asyncio
async def test_kill_session_success(client):
    """Test DELETE /api/sessions/{key} kills a session."""
    with patch('app.routes.sessions.get_gateway') as mock_get_gateway:
        mock_gateway = AsyncMock()
        mock_gateway.kill_session.return_value = True
        mock_get_gateway.return_value = mock_gateway
        
        response = await client.delete("/api/sessions/agent:main:test")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
