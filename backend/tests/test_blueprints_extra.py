from unittest.mock import AsyncMock, patch

import pytest

pytestmark = pytest.mark.anyio


async def test_export_blueprint_empty_safe_name_defaults(client):
    body = {
        "name": "___ !!!",
        "source": "user",
        "blueprint": {
            "name": "BP",
            "gridWidth": 10,
            "gridDepth": 10,
            "walkableCenter": {"x": 5, "z": 5},
            "placements": [],
            "doors": [{"x": 0, "z": 1}],
            "doorPositions": [{"x": 0, "z": 1}],
        },
    }
    created = await client.post("/api/blueprints", json=body)
    bp_id = created.json()["id"]

    exported = await client.get(f"/api/blueprints/export/{bp_id}")
    assert exported.status_code == 200
    assert 'filename="blueprint.json"' in exported.headers["content-disposition"]


async def test_load_blueprint_from_file_and_move_delete(client, tmp_path, monkeypatch):
    from app.routes import blueprints as bp

    bp_dir = tmp_path / "blueprints"
    bp_dir.mkdir(parents=True)
    (bp_dir / "builtin1.json").write_text(
        '{"name":"B1","gridWidth":8,"gridDepth":8,"walkableCenter":{"x":1,"z":1},"placements":[{"propId":"chair","x":1,"z":1}],"doors":[{"x":0,"z":0}],"doorPositions":[]}'
    )
    monkeypatch.setattr(bp, "_BLUEPRINT_DIR", str(bp_dir))

    with patch("app.routes.blueprints.broadcast", new_callable=AsyncMock):
        moved = await client.patch(
            "/api/blueprints/builtin1/move-prop",
            json={"propId": "chair", "fromX": 1, "fromZ": 1, "toX": 2, "toZ": 2},
        )
        assert moved.status_code == 200

        deleted = await client.request(
            "DELETE", "/api/blueprints/builtin1/delete-prop", json={"propId": "chair", "x": 2, "z": 2}
        )
        assert deleted.status_code == 200


async def test_move_prop_invalid_blueprint_id_path_traversal_blocked(client):
    with patch("app.routes.blueprints.broadcast", new_callable=AsyncMock):
        r = await client.patch(
            "/api/blueprints/../../etc/passwd/move-prop",
            json={"propId": "chair", "fromX": 1, "fromZ": 1, "toX": 2, "toZ": 2},
        )
    # route path normalize can produce 404 or invalid-id 400 depending server/path parsing
    assert r.status_code in (400, 404)


def test_overlap_ignores_interaction_props():
    from app.routes.blueprints import _check_overlap

    placements = [
        {"type": "interaction", "propId": "work-point", "x": 2, "z": 2},
        {"type": "prop", "propId": "chair", "x": 4, "z": 4},
    ]
    _check_overlap(placements, 2, 2, 1, 1)


async def test_update_blueprint_no_blueprint_payload_keeps_json(client):
    create = await client.post(
        "/api/blueprints",
        json={
            "name": "Original",
            "source": "user",
            "blueprint": {
                "name": "N",
                "gridWidth": 10,
                "gridDepth": 10,
                "walkableCenter": {"x": 5, "z": 5},
                "placements": [],
                "doors": [{"x": 0, "z": 0}],
                "doorPositions": [],
            },
        },
    )
    bp_id = create.json()["id"]
    updated = await client.put(f"/api/blueprints/{bp_id}", json={"name": "Only Name"})
    assert updated.status_code == 200
    assert updated.json()["name"] == "Only Name"
    assert updated.json()["blueprint"]["id"] == bp_id
