"""Tests for room assignment rules CRUD endpoints."""

import pytest


@pytest.mark.asyncio
async def test_list_rules(client):
    """Test GET /api/room-assignment-rules returns default rules."""
    response = await client.get("/api/room-assignment-rules")
    assert response.status_code == 200
    data = response.json()
    assert "rules" in data
    assert isinstance(data["rules"], list)
    # Default seed data has several rules
    assert len(data["rules"]) >= 5


@pytest.mark.asyncio
async def test_list_rules_sorted_by_priority(client):
    """Test that rules are returned sorted by priority descending."""
    response = await client.get("/api/room-assignment-rules")
    data = response.json()
    rules = data["rules"]
    for i in range(len(rules) - 1):
        assert rules[i]["priority"] >= rules[i + 1]["priority"]


@pytest.mark.asyncio
async def test_get_rule(client):
    """Test GET /api/room-assignment-rules/{id} returns a specific rule."""
    # Get a known default rule
    response = await client.get("/api/room-assignment-rules/rule-main-hq")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "rule-main-hq"
    assert data["room_id"] == "headquarters"
    assert data["rule_type"] == "session_type"
    assert data["rule_value"] == "main"
    assert data["priority"] == 80


@pytest.mark.asyncio
async def test_get_rule_not_found(client):
    """Test GET /api/room-assignment-rules/{id} returns 404 for missing."""
    response = await client.get("/api/room-assignment-rules/nonexistent-rule")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_rule(client):
    """Test POST /api/room-assignment-rules creates a new rule."""
    new_rule = {
        "room_id": "dev-lab",
        "rule_type": "keyword",
        "rule_value": "bugfix",
        "priority": 75,
    }
    response = await client.post("/api/room-assignment-rules", json=new_rule)
    assert response.status_code == 200
    data = response.json()
    assert data["room_id"] == "dev-lab"
    assert data["rule_type"] == "keyword"
    assert data["rule_value"] == "bugfix"
    assert data["priority"] == 75
    assert data["id"]  # UUID generated
    assert data["created_at"] > 0


@pytest.mark.asyncio
async def test_create_rule_invalid_room(client):
    """Test POST /api/room-assignment-rules rejects invalid room_id."""
    response = await client.post("/api/room-assignment-rules", json={
        "room_id": "nonexistent-room",
        "rule_type": "keyword",
        "rule_value": "test",
    })
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_update_rule(client):
    """Test PUT /api/room-assignment-rules/{id} updates a rule."""
    response = await client.put("/api/room-assignment-rules/rule-main-hq", json={
        "priority": 200,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["priority"] == 200


@pytest.mark.asyncio
async def test_update_rule_not_found(client):
    """Test PUT /api/room-assignment-rules/{id} returns 404 for missing."""
    response = await client.put("/api/room-assignment-rules/nonexistent", json={
        "priority": 50,
    })
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_rule(client):
    """Test DELETE /api/room-assignment-rules/{id} deletes a rule."""
    # Create a rule to delete
    response = await client.post("/api/room-assignment-rules", json={
        "room_id": "dev-lab",
        "rule_type": "keyword",
        "rule_value": "to-delete",
    })
    rule_id = response.json()["id"]

    response = await client.delete(f"/api/room-assignment-rules/{rule_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

    # Verify it's gone
    response = await client.get(f"/api/room-assignment-rules/{rule_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_rule_not_found(client):
    """Test DELETE /api/room-assignment-rules/{id} returns 404 for missing."""
    response = await client.delete("/api/room-assignment-rules/nonexistent")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_rules_for_room(client):
    """Test GET /api/room-assignment-rules/room/{id} returns rules for a room."""
    response = await client.get("/api/room-assignment-rules/room/dev-lab")
    assert response.status_code == 200
    data = response.json()
    assert "rules" in data
    for rule in data["rules"]:
        assert rule["room_id"] == "dev-lab"


@pytest.mark.asyncio
async def test_default_rules_coverage(client):
    """Test that default rules cover key session types."""
    response = await client.get("/api/room-assignment-rules")
    rules = response.json()["rules"]

    rule_values = {r["rule_value"] for r in rules}
    # Key routing rules should exist
    assert "main" in rule_values
    assert "agent:dev" in rule_values
    assert "agent:gamedev" in rule_values
