"""Tests for rooms CRUD endpoints."""

import pytest


@pytest.mark.asyncio
async def test_list_rooms(client):
    """Test GET /api/rooms returns default rooms."""
    response = await client.get("/api/rooms")
    assert response.status_code == 200
    data = response.json()
    assert "rooms" in data
    assert isinstance(data["rooms"], list)
    # Default seed data has 8 rooms
    assert len(data["rooms"]) >= 8


@pytest.mark.asyncio
async def test_list_rooms_sorted_by_order(client):
    """Test that rooms are returned sorted by sort_order."""
    response = await client.get("/api/rooms")
    data = response.json()
    rooms = data["rooms"]
    for i in range(len(rooms) - 1):
        assert rooms[i]["sort_order"] <= rooms[i + 1]["sort_order"]


@pytest.mark.asyncio
async def test_get_room(client):
    """Test GET /api/rooms/{id} returns a specific room."""
    response = await client.get("/api/rooms/headquarters")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "headquarters"
    assert data["name"] == "Headquarters"
    assert data["icon"] == "🏛️"


@pytest.mark.asyncio
async def test_get_room_not_found(client):
    """Test GET /api/rooms/{id} returns 404 for missing room."""
    response = await client.get("/api/rooms/nonexistent-room")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_room(client):
    """Test POST /api/rooms creates a new room."""
    new_room = {
        "id": "test-room",
        "name": "Test Room",
        "icon": "🧪",
        "color": "#ff0000",
        "sort_order": 99,
    }
    response = await client.post("/api/rooms", json=new_room)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "test-room"
    assert data["name"] == "Test Room"
    assert data["icon"] == "🧪"
    assert data["color"] == "#ff0000"
    assert data["sort_order"] == 99
    assert data["created_at"] > 0
    assert data["updated_at"] > 0


@pytest.mark.asyncio
async def test_create_room_duplicate_id(client):
    """Test POST /api/rooms rejects duplicate ID."""
    response = await client.post("/api/rooms", json={
        "id": "headquarters",
        "name": "Duplicate HQ",
    })
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_update_room(client):
    """Test PUT /api/rooms/{id} updates a room."""
    response = await client.put("/api/rooms/headquarters", json={
        "name": "Updated HQ",
        "color": "#123456",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated HQ"
    assert data["color"] == "#123456"


@pytest.mark.asyncio
async def test_update_room_not_found(client):
    """Test PUT /api/rooms/{id} returns 404 for missing room."""
    response = await client.put("/api/rooms/nonexistent", json={
        "name": "Test",
    })
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_room(client):
    """Test DELETE /api/rooms/{id} deletes a room."""
    # Create a room to delete
    await client.post("/api/rooms", json={
        "id": "to-delete",
        "name": "Delete Me",
    })
    response = await client.delete("/api/rooms/to-delete")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

    # Verify it's gone
    response = await client.get("/api/rooms/to-delete")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_room_not_found(client):
    """Test DELETE /api/rooms/{id} returns 404 for missing room."""
    response = await client.delete("/api/rooms/nonexistent")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_room_cascades_assignments(client):
    """Test deleting a room also removes session assignments for that room."""
    # Create a room
    await client.post("/api/rooms", json={
        "id": "cascade-room",
        "name": "Cascade Room",
    })
    # Assign a session to it
    await client.post("/api/session-room-assignments", json={
        "session_key": "agent:main:test",
        "room_id": "cascade-room",
    })
    # Delete the room
    response = await client.delete("/api/rooms/cascade-room")
    assert response.status_code == 200

    # Verify assignment is gone
    response = await client.get("/api/session-room-assignments/agent:main:test")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_set_hq(client):
    """Test PUT /api/rooms/{id}/hq sets a room as HQ."""
    response = await client.put("/api/rooms/dev-room/hq")
    assert response.status_code == 200
    data = response.json()
    assert data["is_hq"] is True

    # Verify old HQ is no longer HQ
    response = await client.get("/api/rooms/headquarters")
    data = response.json()
    assert data["is_hq"] is False


@pytest.mark.asyncio
async def test_set_hq_not_found(client):
    """Test PUT /api/rooms/{id}/hq returns 404 for missing room."""
    response = await client.put("/api/rooms/nonexistent/hq")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_room_project_assignment(client):
    """Test assigning and clearing a project from a room."""
    # Create a project first
    proj_resp = await client.post("/api/projects", json={
        "name": "Test Project",
        "color": "#ff0000",
    })
    project_id = proj_resp.json()["id"]

    # Assign project to room
    response = await client.post("/api/rooms/dev-room/project", json={
        "project_id": project_id,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["project_id"] == project_id
    assert data["project_name"] == "Test Project"

    # Clear project from room
    response = await client.delete("/api/rooms/dev-room/project")
    assert response.status_code == 200
    data = response.json()
    assert data["project_id"] is None


@pytest.mark.asyncio
async def test_room_defaults(client):
    """Test that rooms have correct default values."""
    await client.post("/api/rooms", json={
        "id": "defaults-test",
        "name": "Defaults Room",
    })
    response = await client.get("/api/rooms/defaults-test")
    data = response.json()
    assert data["speed_multiplier"] == 1.0
    assert data["sort_order"] == 0
    assert data["is_hq"] is False
    assert data["project_id"] is None
