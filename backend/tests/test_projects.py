"""Tests for projects CRUD endpoints."""

import pytest


@pytest.mark.asyncio
async def test_list_projects(client):
    """Test GET /api/projects returns projects list."""
    response = await client.get("/api/projects")
    assert response.status_code == 200
    data = response.json()
    assert "projects" in data
    assert isinstance(data["projects"], list)


@pytest.mark.asyncio
async def test_create_project(client):
    """Test POST /api/projects creates a new project."""
    new_project = {
        "name": "Test Project",
        "description": "A test project",
        "icon": "🧪",
        "color": "#ff0000",
    }
    response = await client.post("/api/projects", json=new_project)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Project"
    assert data["description"] == "A test project"
    assert data["icon"] == "🧪"
    assert data["color"] == "#ff0000"
    assert data["status"] == "active"
    assert data["id"]  # UUID generated
    assert data["created_at"] > 0
    assert data["rooms"] == []


@pytest.mark.asyncio
async def test_create_project_auto_folder_path(client):
    """Test that folder_path is auto-generated from name if not provided."""
    response = await client.post("/api/projects", json={
        "name": "My Cool Project",
    })
    data = response.json()
    assert data["folder_path"] is not None
    assert "My-Cool-Project" in data["folder_path"]


@pytest.mark.asyncio
async def test_create_project_custom_folder_path(client):
    """Test that custom folder_path is preserved."""
    response = await client.post("/api/projects", json={
        "name": "Custom Path Project",
        "folder_path": "/custom/path/here",
    })
    data = response.json()
    assert data["folder_path"] == "/custom/path/here"


@pytest.mark.asyncio
async def test_get_project(client):
    """Test GET /api/projects/{id} returns a specific project."""
    # Create first
    create_resp = await client.post("/api/projects", json={
        "name": "Get Test Project",
    })
    project_id = create_resp.json()["id"]

    response = await client.get(f"/api/projects/{project_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == project_id
    assert data["name"] == "Get Test Project"


@pytest.mark.asyncio
async def test_get_project_not_found(client):
    """Test GET /api/projects/{id} returns 404 for missing project."""
    response = await client.get("/api/projects/nonexistent-id")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_project(client):
    """Test PUT /api/projects/{id} updates a project."""
    create_resp = await client.post("/api/projects", json={
        "name": "Update Test",
    })
    project_id = create_resp.json()["id"]

    response = await client.put(f"/api/projects/{project_id}", json={
        "name": "Updated Name",
        "description": "Updated description",
        "color": "#00ff00",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["description"] == "Updated description"
    assert data["color"] == "#00ff00"


@pytest.mark.asyncio
async def test_update_project_not_found(client):
    """Test PUT /api/projects/{id} returns 404 for missing project."""
    response = await client.put("/api/projects/nonexistent", json={
        "name": "Test",
    })
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_project_must_be_archived(client):
    """Test that only archived projects can be deleted."""
    create_resp = await client.post("/api/projects", json={
        "name": "Active Project",
    })
    project_id = create_resp.json()["id"]

    # Try deleting active project - should fail
    response = await client.delete(f"/api/projects/{project_id}")
    assert response.status_code == 400
    assert "archived" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_delete_archived_project(client):
    """Test deleting an archived project succeeds."""
    create_resp = await client.post("/api/projects", json={
        "name": "To Archive",
    })
    project_id = create_resp.json()["id"]

    # Archive it first
    await client.put(f"/api/projects/{project_id}", json={
        "status": "archived",
    })

    # Now delete
    response = await client.delete(f"/api/projects/{project_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

    # Verify gone
    response = await client.get(f"/api/projects/{project_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_cannot_archive_project_with_rooms(client):
    """Test that project with assigned rooms cannot be archived."""
    # Create project
    create_resp = await client.post("/api/projects", json={
        "name": "Busy Project",
    })
    project_id = create_resp.json()["id"]

    # Assign it to a room
    await client.post("/api/rooms/dev-room/project", json={
        "project_id": project_id,
    })

    # Try to archive - should fail
    response = await client.put(f"/api/projects/{project_id}", json={
        "status": "archived",
    })
    assert response.status_code == 400
    assert "assigned" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_delete_project_not_found(client):
    """Test DELETE /api/projects/{id} returns 404 for missing project."""
    response = await client.delete("/api/projects/nonexistent")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_project_with_rooms(client):
    """Test that project response includes assigned room IDs."""
    # Create project
    create_resp = await client.post("/api/projects", json={
        "name": "Room Project",
    })
    project_id = create_resp.json()["id"]

    # Assign to a room
    await client.post("/api/rooms/dev-room/project", json={
        "project_id": project_id,
    })

    # Get project and verify rooms
    response = await client.get(f"/api/projects/{project_id}")
    data = response.json()
    assert "dev-room" in data["rooms"]


@pytest.mark.asyncio
async def test_projects_overview(client):
    """Test GET /api/projects/overview returns enriched data."""
    # Create a project
    await client.post("/api/projects", json={
        "name": "Overview Project",
    })

    response = await client.get("/api/projects/overview")
    assert response.status_code == 200
    data = response.json()
    assert "projects" in data
    for project in data["projects"]:
        assert "room_count" in project
        assert "agent_count" in project
