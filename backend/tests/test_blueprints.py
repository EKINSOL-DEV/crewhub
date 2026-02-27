"""Tests for blueprint routes."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio


def _valid_blueprint(name="Test BP", grid_w=10, grid_d=10, bp_id=None):
    """Return a valid blueprint JSON dict."""
    bp = {
        "name": name,
        "gridWidth": grid_w,
        "gridDepth": grid_d,
        "walkableCenter": {"x": 5, "z": 5},
        "placements": [
            {"propId": "desk-with-monitor", "x": 2, "z": 2},
        ],
        "doors": [{"x": 0, "z": 3}],
        "doorPositions": [{"x": 0, "z": 3}],
    }
    if bp_id:
        bp["id"] = bp_id
    return bp


def _create_body(name="Test BP", blueprint=None, source="user", room_id=None):
    body = {"name": name, "blueprint": blueprint or _valid_blueprint(), "source": source}
    if room_id:
        body["room_id"] = room_id
    return body


# ── CRUD ────────────────────────────────────────────────────────


async def test_list_blueprints_empty(client: AsyncClient):
    resp = await client.get("/api/blueprints")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_and_get_blueprint(client: AsyncClient):
    body = _create_body()
    resp = await client.post("/api/blueprints", json=body)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test BP"
    assert data["source"] == "user"
    bp_id = data["id"]

    # GET single
    resp = await client.get(f"/api/blueprints/{bp_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == bp_id


async def test_create_blueprint_with_room_id(client: AsyncClient):
    body = _create_body(room_id="room-1")
    resp = await client.post("/api/blueprints", json=body)
    assert resp.status_code == 201
    assert resp.json()["room_id"] == "room-1"


async def test_create_duplicate_id(client: AsyncClient):
    bp = _valid_blueprint(bp_id="dup-id")
    body = _create_body(blueprint=bp)
    resp = await client.post("/api/blueprints", json=body)
    assert resp.status_code == 201

    resp = await client.post("/api/blueprints", json=body)
    assert resp.status_code == 409


async def test_create_invalid_blueprint(client: AsyncClient):
    bp = _valid_blueprint()
    bp["gridWidth"] = 1  # too small
    body = _create_body(blueprint=bp)
    resp = await client.post("/api/blueprints", json=body)
    assert resp.status_code == 422


async def test_get_blueprint_not_found(client: AsyncClient):
    resp = await client.get("/api/blueprints/nonexistent")
    assert resp.status_code == 404


async def test_list_blueprints_filter_source(client: AsyncClient):
    await client.post("/api/blueprints", json=_create_body(name="A", source="user"))
    resp = await client.get("/api/blueprints?source=user")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

    resp = await client.get("/api/blueprints?source=mod")
    assert resp.status_code == 200
    assert len(resp.json()) == 0


async def test_list_blueprints_filter_room_id(client: AsyncClient):
    await client.post("/api/blueprints", json=_create_body(room_id="r1"))
    resp = await client.get("/api/blueprints?room_id=r1")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


async def test_update_blueprint(client: AsyncClient):
    resp = await client.post("/api/blueprints", json=_create_body())
    bp_id = resp.json()["id"]

    resp = await client.put(f"/api/blueprints/{bp_id}", json={"name": "Updated"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated"


async def test_update_blueprint_with_new_blueprint_json(client: AsyncClient):
    resp = await client.post("/api/blueprints", json=_create_body())
    bp_id = resp.json()["id"]

    new_bp = _valid_blueprint(name="V2", grid_w=12, grid_d=12)
    resp = await client.put(f"/api/blueprints/{bp_id}", json={"blueprint": new_bp})
    assert resp.status_code == 200
    assert resp.json()["blueprint"]["gridWidth"] == 12


async def test_update_blueprint_invalid(client: AsyncClient):
    resp = await client.post("/api/blueprints", json=_create_body())
    bp_id = resp.json()["id"]

    bad_bp = _valid_blueprint()
    bad_bp["gridWidth"] = 999
    resp = await client.put(f"/api/blueprints/{bp_id}", json={"blueprint": bad_bp})
    assert resp.status_code == 422


async def test_update_blueprint_not_found(client: AsyncClient):
    resp = await client.put("/api/blueprints/nope", json={"name": "X"})
    assert resp.status_code == 404


async def test_delete_blueprint(client: AsyncClient):
    resp = await client.post("/api/blueprints", json=_create_body())
    bp_id = resp.json()["id"]

    resp = await client.delete(f"/api/blueprints/{bp_id}")
    assert resp.status_code == 204

    resp = await client.get(f"/api/blueprints/{bp_id}")
    assert resp.status_code == 404


async def test_delete_blueprint_not_found(client: AsyncClient):
    resp = await client.delete("/api/blueprints/nonexistent")
    assert resp.status_code == 404


# ── Export ──────────────────────────────────────────────────────


async def test_export_blueprint(client: AsyncClient):
    resp = await client.post("/api/blueprints", json=_create_body(name="Export Me"))
    bp_id = resp.json()["id"]

    resp = await client.get(f"/api/blueprints/export/{bp_id}")
    assert resp.status_code == 200
    assert "attachment" in resp.headers.get("content-disposition", "")
    assert resp.headers["content-type"] == "application/json"
    data = resp.json()
    assert "name" in data  # blueprint JSON inner name


async def test_export_blueprint_not_found(client: AsyncClient):
    resp = await client.get("/api/blueprints/export/nonexistent")
    assert resp.status_code == 404


async def test_export_blueprint_sanitized_name(client: AsyncClient):
    resp = await client.post("/api/blueprints", json=_create_body(name="My <Special> BP!"))
    bp_id = resp.json()["id"]

    resp = await client.get(f"/api/blueprints/export/{bp_id}")
    assert resp.status_code == 200
    cd = resp.headers["content-disposition"]
    # Should not contain special chars
    assert "<" not in cd and ">" not in cd


# ── Import ──────────────────────────────────────────────────────


async def test_import_blueprint(client: AsyncClient):
    bp = _valid_blueprint(name="Imported")
    resp = await client.post("/api/blueprints/import", json=bp)
    assert resp.status_code == 201
    assert resp.json()["source"] == "import"
    assert resp.json()["name"] == "Imported"


async def test_import_blueprint_collision_gets_new_id(client: AsyncClient):
    bp = _valid_blueprint(name="First", bp_id="collision-id")
    resp = await client.post("/api/blueprints/import", json=bp)
    assert resp.status_code == 201
    first_id = resp.json()["id"]

    # Import again with same id — should get a new id
    resp = await client.post("/api/blueprints/import", json=bp)
    assert resp.status_code == 201
    assert resp.json()["id"] != first_id


async def test_import_invalid_blueprint(client: AsyncClient):
    bp = _valid_blueprint()
    bp["doors"] = []
    bp["doorPositions"] = []  # no doors = invalid
    resp = await client.post("/api/blueprints/import", json=bp)
    assert resp.status_code == 422


# ── Move/Delete Prop ────────────────────────────────────────────


async def test_move_prop(client: AsyncClient):
    resp = await client.post("/api/blueprints", json=_create_body())
    bp_id = resp.json()["id"]

    with patch("app.routes.blueprints.broadcast", new_callable=AsyncMock):
        resp = await client.patch(
            f"/api/blueprints/{bp_id}/move-prop",
            json={"propId": "desk-with-monitor", "fromX": 2, "fromZ": 2, "toX": 4, "toZ": 4},
        )
    assert resp.status_code == 200
    assert resp.json()["success"] is True


async def test_move_prop_with_rotation_and_span(client: AsyncClient):
    resp = await client.post("/api/blueprints", json=_create_body())
    bp_id = resp.json()["id"]

    with patch("app.routes.blueprints.broadcast", new_callable=AsyncMock):
        resp = await client.patch(
            f"/api/blueprints/{bp_id}/move-prop",
            json={
                "propId": "desk-with-monitor",
                "fromX": 2,
                "fromZ": 2,
                "toX": 3,
                "toZ": 3,
                "rotation": 90,
                "span": {"w": 1, "d": 2},
            },
        )
    assert resp.status_code == 200


async def test_move_prop_not_found(client: AsyncClient):
    resp = await client.post("/api/blueprints", json=_create_body())
    bp_id = resp.json()["id"]

    with patch("app.routes.blueprints.broadcast", new_callable=AsyncMock):
        resp = await client.patch(
            f"/api/blueprints/{bp_id}/move-prop",
            json={"propId": "nonexistent", "fromX": 0, "fromZ": 0, "toX": 1, "toZ": 1},
        )
    assert resp.status_code == 404


async def test_move_prop_out_of_bounds(client: AsyncClient):
    resp = await client.post("/api/blueprints", json=_create_body())
    bp_id = resp.json()["id"]

    with patch("app.routes.blueprints.broadcast", new_callable=AsyncMock):
        resp = await client.patch(
            f"/api/blueprints/{bp_id}/move-prop",
            json={"propId": "desk-with-monitor", "fromX": 2, "fromZ": 2, "toX": 99, "toZ": 99},
        )
    assert resp.status_code == 400


async def test_move_prop_blueprint_not_found(client: AsyncClient):
    with patch("app.routes.blueprints.broadcast", new_callable=AsyncMock):
        resp = await client.patch(
            "/api/blueprints/nonexistent/move-prop",
            json={"propId": "desk-with-monitor", "fromX": 0, "fromZ": 0, "toX": 1, "toZ": 1},
        )
    assert resp.status_code == 404


async def test_delete_prop(client: AsyncClient):
    resp = await client.post("/api/blueprints", json=_create_body())
    bp_id = resp.json()["id"]

    with patch("app.routes.blueprints.broadcast", new_callable=AsyncMock):
        resp = await client.request(
            "DELETE",
            f"/api/blueprints/{bp_id}/delete-prop",
            json={"propId": "desk-with-monitor", "x": 2, "z": 2},
        )
    assert resp.status_code == 200
    assert resp.json()["success"] is True


async def test_delete_prop_not_found(client: AsyncClient):
    resp = await client.post("/api/blueprints", json=_create_body())
    bp_id = resp.json()["id"]

    with patch("app.routes.blueprints.broadcast", new_callable=AsyncMock):
        resp = await client.request(
            "DELETE",
            f"/api/blueprints/{bp_id}/delete-prop",
            json={"propId": "nonexistent", "x": 0, "z": 0},
        )
    assert resp.status_code == 404


async def test_move_prop_overlap(client: AsyncClient):
    """Two props, moving one on top of the other should fail with 409."""
    bp = _valid_blueprint()
    bp["placements"] = [
        {"propId": "desk-with-monitor", "x": 2, "z": 2},
        {"propId": "chair", "x": 4, "z": 4},
    ]
    body = _create_body(blueprint=bp)
    resp = await client.post("/api/blueprints", json=body)
    bp_id = resp.json()["id"]

    with patch("app.routes.blueprints.broadcast", new_callable=AsyncMock):
        resp = await client.patch(
            f"/api/blueprints/{bp_id}/move-prop",
            json={"propId": "desk-with-monitor", "fromX": 2, "fromZ": 2, "toX": 4, "toZ": 4},
        )
    assert resp.status_code == 409


# ── Validation unit tests ──────────────────────────────────────


def test_validate_blueprint_no_doors():
    from app.db.models import BlueprintJson
    from app.routes.blueprints import validate_blueprint

    bp = BlueprintJson(
        name="No doors",
        gridWidth=10,
        gridDepth=10,
        walkableCenter={"x": 5, "z": 5},
        placements=[],
        doors=[],
        doorPositions=[],
    )
    errors, _ = validate_blueprint(bp)
    assert any("door" in e.lower() for e in errors)


def test_validate_blueprint_walkable_center_out_of_bounds():
    from app.db.models import BlueprintJson
    from app.routes.blueprints import validate_blueprint

    bp = BlueprintJson(
        name="Bad center",
        gridWidth=10,
        gridDepth=10,
        walkableCenter={"x": 99, "z": 5},
        placements=[],
        doors=[{"x": 0, "z": 0}],
        doorPositions=[],
    )
    errors, _ = validate_blueprint(bp)
    assert any("walkableCenter" in e for e in errors)


def test_validate_blueprint_door_not_on_edge():
    from app.db.models import BlueprintJson
    from app.routes.blueprints import validate_blueprint

    bp = BlueprintJson(
        name="Interior door",
        gridWidth=10,
        gridDepth=10,
        walkableCenter={"x": 5, "z": 5},
        placements=[],
        doors=[{"x": 5, "z": 5}],
        doorPositions=[],
    )
    errors, _ = validate_blueprint(bp)
    assert any("wall edge" in e for e in errors)


def test_validate_blueprint_unknown_prop_warning():
    from app.db.models import BlueprintJson
    from app.routes.blueprints import validate_blueprint

    bp = BlueprintJson(
        name="Unknown prop",
        gridWidth=10,
        gridDepth=10,
        walkableCenter={"x": 5, "z": 5},
        placements=[{"propId": "alien-artifact", "x": 1, "z": 1}],
        doors=[{"x": 0, "z": 0}],
        doorPositions=[],
    )
    errors, warnings = validate_blueprint(bp)
    assert len(errors) == 0
    assert any("Unknown propId" in w for w in warnings)


def test_validate_blueprint_invalid_interaction_type():
    from app.db.models import BlueprintJson
    from app.routes.blueprints import validate_blueprint

    bp = BlueprintJson(
        name="Bad interaction",
        gridWidth=10,
        gridDepth=10,
        walkableCenter={"x": 5, "z": 5},
        placements=[{"propId": "desk-with-monitor", "x": 1, "z": 1, "interactionType": "dance"}],
        doors=[{"x": 0, "z": 0}],
        doorPositions=[],
    )
    errors, _ = validate_blueprint(bp)
    assert any("interactionType" in e for e in errors)


def test_validate_placement_out_of_bounds():
    from app.db.models import BlueprintJson
    from app.routes.blueprints import validate_blueprint

    bp = BlueprintJson(
        name="OOB",
        gridWidth=10,
        gridDepth=10,
        walkableCenter={"x": 5, "z": 5},
        placements=[{"propId": "desk-with-monitor", "x": 99, "z": 99}],
        doors=[{"x": 0, "z": 0}],
        doorPositions=[],
    )
    errors, _ = validate_blueprint(bp)
    assert any("out of grid bounds" in e for e in errors)


def test_validate_span_exceeds_grid():
    from app.db.models import BlueprintJson
    from app.routes.blueprints import validate_blueprint

    bp = BlueprintJson(
        name="Span OOB",
        gridWidth=10,
        gridDepth=10,
        walkableCenter={"x": 5, "z": 5},
        placements=[{"propId": "desk-with-monitor", "x": 8, "z": 8, "span": {"w": 5, "d": 5}}],
        doors=[{"x": 0, "z": 0}],
        doorPositions=[],
    )
    errors, _ = validate_blueprint(bp)
    assert any("span exceeds" in e for e in errors)


def test_validate_placement_overlap():
    from app.db.models import BlueprintJson
    from app.routes.blueprints import validate_blueprint

    bp = BlueprintJson(
        name="Overlap",
        gridWidth=10,
        gridDepth=10,
        walkableCenter={"x": 5, "z": 5},
        placements=[
            {"propId": "desk-with-monitor", "x": 1, "z": 1},
            {"propId": "chair", "x": 1, "z": 1},
        ],
        doors=[{"x": 0, "z": 0}],
        doorPositions=[],
    )
    errors, _ = validate_blueprint(bp)
    assert any("overlaps" in e for e in errors)


def test_validate_doors_doorpositions_mismatch_warning():
    from app.db.models import BlueprintJson
    from app.routes.blueprints import validate_blueprint

    bp = BlueprintJson(
        name="Mismatch",
        gridWidth=10,
        gridDepth=10,
        walkableCenter={"x": 5, "z": 5},
        placements=[],
        doors=[{"x": 0, "z": 0}],
        doorPositions=[{"x": 0, "z": 0}, {"x": 9, "z": 0}],
    )
    errors, warnings = validate_blueprint(bp)
    assert any("different counts" in w for w in warnings)
