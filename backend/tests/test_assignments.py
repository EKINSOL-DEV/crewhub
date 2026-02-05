"""Tests for session room assignments CRUD endpoints."""

import pytest


@pytest.mark.asyncio
async def test_list_assignments(client):
    """Test GET /api/session-room-assignments returns assignments list."""
    response = await client.get("/api/session-room-assignments")
    assert response.status_code == 200
    data = response.json()
    assert "assignments" in data
    assert isinstance(data["assignments"], list)


@pytest.mark.asyncio
async def test_create_assignment(client):
    """Test POST /api/session-room-assignments creates an assignment."""
    response = await client.post("/api/session-room-assignments", json={
        "session_key": "agent:main:subagent:test123",
        "room_id": "dev-room",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["session_key"] == "agent:main:subagent:test123"
    assert data["room_id"] == "dev-room"
    assert data["assigned_at"] > 0


@pytest.mark.asyncio
async def test_create_assignment_upsert(client):
    """Test POST /api/session-room-assignments upserts on duplicate key."""
    # Create initial assignment
    await client.post("/api/session-room-assignments", json={
        "session_key": "agent:main:upsert-test",
        "room_id": "dev-room",
    })

    # Update to different room
    response = await client.post("/api/session-room-assignments", json={
        "session_key": "agent:main:upsert-test",
        "room_id": "thinking-room",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["room_id"] == "thinking-room"


@pytest.mark.asyncio
async def test_create_assignment_invalid_room(client):
    """Test POST /api/session-room-assignments rejects invalid room_id."""
    response = await client.post("/api/session-room-assignments", json={
        "session_key": "agent:main:test",
        "room_id": "nonexistent-room",
    })
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_get_assignment(client):
    """Test GET /api/session-room-assignments/{key} returns specific assignment."""
    # Create first
    await client.post("/api/session-room-assignments", json={
        "session_key": "agent:dev:main",
        "room_id": "dev-room",
    })

    response = await client.get("/api/session-room-assignments/agent:dev:main")
    assert response.status_code == 200
    data = response.json()
    assert data["session_key"] == "agent:dev:main"
    assert data["room_id"] == "dev-room"


@pytest.mark.asyncio
async def test_get_assignment_not_found(client):
    """Test GET /api/session-room-assignments/{key} returns 404 for missing."""
    response = await client.get("/api/session-room-assignments/nonexistent:key")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_assignment(client):
    """Test DELETE /api/session-room-assignments/{key} removes assignment."""
    # Create first
    await client.post("/api/session-room-assignments", json={
        "session_key": "agent:main:to-delete",
        "room_id": "dev-room",
    })

    response = await client.delete("/api/session-room-assignments/agent:main:to-delete")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

    # Verify it's gone
    response = await client.get("/api/session-room-assignments/agent:main:to-delete")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_assignment_not_found(client):
    """Test DELETE /api/session-room-assignments/{key} returns 404 for missing."""
    response = await client.delete("/api/session-room-assignments/nonexistent")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_assignments_for_room(client):
    """Test GET /api/session-room-assignments/room/{id} returns room's assignments."""
    # Create some assignments
    await client.post("/api/session-room-assignments", json={
        "session_key": "agent:main:room-test-1",
        "room_id": "dev-room",
    })
    await client.post("/api/session-room-assignments", json={
        "session_key": "agent:main:room-test-2",
        "room_id": "dev-room",
    })
    await client.post("/api/session-room-assignments", json={
        "session_key": "agent:main:room-test-3",
        "room_id": "thinking-room",
    })

    response = await client.get("/api/session-room-assignments/room/dev-room")
    assert response.status_code == 200
    data = response.json()
    assert len(data["assignments"]) >= 2
    for a in data["assignments"]:
        assert a["room_id"] == "dev-room"


@pytest.mark.asyncio
async def test_batch_assign(client):
    """Test POST /api/session-room-assignments/batch creates multiple assignments."""
    assignments = [
        {"session_key": "agent:batch:1", "room_id": "dev-room"},
        {"session_key": "agent:batch:2", "room_id": "dev-room"},
        {"session_key": "agent:batch:3", "room_id": "thinking-room"},
    ]
    response = await client.post("/api/session-room-assignments/batch", json=assignments)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["count"] == 3


@pytest.mark.asyncio
async def test_batch_assign_skips_invalid_rooms(client):
    """Test batch assign skips entries with invalid room IDs."""
    assignments = [
        {"session_key": "agent:batch-skip:1", "room_id": "dev-room"},
        {"session_key": "agent:batch-skip:2", "room_id": "nonexistent-room"},
    ]
    response = await client.post("/api/session-room-assignments/batch", json=assignments)
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 1
