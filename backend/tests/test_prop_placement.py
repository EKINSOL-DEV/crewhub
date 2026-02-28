"""Tests for app.routes.prop_placement."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
async def _init_keys():
    from app.auth import init_api_keys

    await init_api_keys()


def _admin_headers() -> dict[str, str]:
    import app.db.database as db_mod

    with open(db_mod.DB_DIR / "api-keys.json") as f:
        admin_key = json.load(f)["keys"][0]["key"]
    return {"X-API-Key": admin_key}


# ---------------------------------------------------------------------------
# _row_to_response helper
# ---------------------------------------------------------------------------


class TestRowToResponse:
    def test_converts_row(self):
        from app.routes.prop_placement import _row_to_response

        row = {
            "id": "prop-1",
            "prop_id": "builtin:desk",
            "position_x": 1.0,
            "position_y": 2.0,
            "position_z": 3.0,
            "rotation_y": 45.0,
            "scale": 1.5,
            "room_id": "room-1",
            "placed_by": "admin",
            "placed_at": 1700000000.0,
            "metadata": None,
        }
        result = _row_to_response(row)
        assert result.id == "prop-1"
        assert result.prop_id == "builtin:desk"
        assert result.position.x == 1.0
        assert result.rotation_y == 45.0
        assert result.scale == 1.5
        assert result.metadata is None

    def test_converts_json_metadata(self):
        from app.routes.prop_placement import _row_to_response

        row = {
            "id": "p1",
            "prop_id": "builtin:chair",
            "position_x": 0.0,
            "position_y": 0.0,
            "position_z": 0.0,
            "rotation_y": 0.0,
            "scale": 1.0,
            "room_id": None,
            "placed_by": None,
            "placed_at": 1700000000.0,
            "metadata": '{"color": "blue", "variant": 2}',
        }
        result = _row_to_response(row)
        assert result.metadata == {"color": "blue", "variant": 2}

    def test_handles_invalid_json_metadata(self):
        from app.routes.prop_placement import _row_to_response

        row = {
            "id": "p1",
            "prop_id": "builtin:lamp",
            "position_x": 0.0,
            "position_y": 0.0,
            "position_z": 0.0,
            "rotation_y": 0.0,
            "scale": 1.0,
            "room_id": None,
            "placed_by": None,
            "placed_at": 1700000000.0,
            "metadata": "invalid json {{{",
        }
        result = _row_to_response(row)
        assert result.metadata is None


class TestToBroadcastData:
    def test_structure(self):
        from app.routes.prop_placement import _row_to_response, _to_broadcast_data

        row = {
            "id": "prop-1",
            "prop_id": "builtin:desk",
            "position_x": 1.0,
            "position_y": 2.0,
            "position_z": 3.0,
            "rotation_y": 0.0,
            "scale": 1.0,
            "room_id": None,
            "placed_by": "admin",
            "placed_at": 1700000000.0,
            "metadata": None,
        }
        placed = _row_to_response(row)
        data = _to_broadcast_data(placed, "place")
        assert data["action"] == "place"
        assert data["placed_id"] == "prop-1"
        assert data["prop_id"] == "builtin:desk"
        assert data["position"] == {"x": 1.0, "y": 2.0, "z": 3.0}


# ---------------------------------------------------------------------------
# GET /api/world/props
# ---------------------------------------------------------------------------


async def test_list_placed_props_empty(client):
    resp = await client.get("/api/world/props")
    assert resp.status_code == 200
    body = resp.json()
    assert body["props"] == []
    assert body["count"] == 0


async def test_list_placed_props_returns_all(client):
    headers = _admin_headers()

    # Place two props
    await client.post(
        "/api/world/props",
        json={"prop_id": "builtin:desk", "position": {"x": 0, "y": 0, "z": 0}},
        headers=headers,
    )
    await client.post(
        "/api/world/props",
        json={"prop_id": "builtin:chair", "position": {"x": 2, "y": 0, "z": 0}},
        headers=headers,
    )

    resp = await client.get("/api/world/props")
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 2
    prop_ids = {p["prop_id"] for p in body["props"]}
    assert "builtin:desk" in prop_ids
    assert "builtin:chair" in prop_ids


async def test_list_placed_props_filter_by_room(client):
    headers = _admin_headers()

    await client.post(
        "/api/world/props",
        json={"prop_id": "builtin:desk", "room_id": "room-1"},
        headers=headers,
    )
    await client.post(
        "/api/world/props",
        json={"prop_id": "builtin:lamp", "room_id": "room-2"},
        headers=headers,
    )

    resp = await client.get("/api/world/props", params={"room_id": "room-1"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 1
    assert body["props"][0]["prop_id"] == "builtin:desk"


async def test_list_placed_props_filter_nonexistent_room(client):
    resp = await client.get("/api/world/props", params={"room_id": "nonexistent"})
    assert resp.status_code == 200
    assert resp.json()["count"] == 0


# ---------------------------------------------------------------------------
# POST /api/world/props
# ---------------------------------------------------------------------------


async def test_place_prop_success(client):
    headers = _admin_headers()
    with patch("app.routes.prop_placement.broadcast", new=AsyncMock()):
        resp = await client.post(
            "/api/world/props",
            json={
                "prop_id": "builtin:desk",
                "position": {"x": 1.0, "y": 0.0, "z": 2.0},
                "rotation_y": 45.0,
                "scale": 1.5,
                "room_id": "room-1",
            },
            headers=headers,
        )
    assert resp.status_code == 201
    body = resp.json()
    assert body["prop_id"] == "builtin:desk"
    assert body["position"]["x"] == 1.0
    assert body["rotation_y"] == 45.0
    assert body["scale"] == 1.5
    assert "id" in body


async def test_place_prop_requires_auth(client):
    resp = await client.post(
        "/api/world/props",
        json={"prop_id": "builtin:desk"},
    )
    assert resp.status_code in (401, 403)


async def test_place_prop_with_metadata(client):
    headers = _admin_headers()
    with patch("app.routes.prop_placement.broadcast", new=AsyncMock()):
        resp = await client.post(
            "/api/world/props",
            json={"prop_id": "builtin:desk", "metadata": {"color": "red"}},
            headers=headers,
        )
    assert resp.status_code == 201
    body = resp.json()
    assert body["metadata"] == {"color": "red"}


async def test_place_prop_defaults(client):
    headers = _admin_headers()
    with patch("app.routes.prop_placement.broadcast", new=AsyncMock()):
        resp = await client.post(
            "/api/world/props",
            json={"prop_id": "builtin:lamp"},
            headers=headers,
        )
    assert resp.status_code == 201
    body = resp.json()
    assert body["scale"] == 1.0
    assert body["rotation_y"] == 0.0
    assert body["position"]["x"] == 0.0


async def test_place_prop_invalid_scale(client):
    headers = _admin_headers()
    resp = await client.post(
        "/api/world/props",
        json={"prop_id": "builtin:lamp", "scale": 0.0},  # Below min 0.1
        headers=headers,
    )
    assert resp.status_code == 422


async def test_place_prop_scale_too_large(client):
    headers = _admin_headers()
    resp = await client.post(
        "/api/world/props",
        json={"prop_id": "builtin:lamp", "scale": 99.0},  # Above max 10.0
        headers=headers,
    )
    assert resp.status_code == 422


async def test_place_prop_broadcasts_event(client):
    headers = _admin_headers()
    broadcast_mock = AsyncMock()
    with patch("app.routes.prop_placement.broadcast", new=broadcast_mock):
        await client.post(
            "/api/world/props",
            json={"prop_id": "builtin:desk"},
            headers=headers,
        )
    broadcast_mock.assert_called_once()
    args = broadcast_mock.call_args[0]
    assert args[0] == "prop_update"
    assert args[1]["action"] == "place"


# ---------------------------------------------------------------------------
# PATCH /api/world/props/{placed_id}
# ---------------------------------------------------------------------------


async def _place_a_prop(client, headers, prop_id="builtin:desk"):
    """Helper to place a prop and return its ID."""
    with patch("app.routes.prop_placement.broadcast", new=AsyncMock()):
        resp = await client.post(
            "/api/world/props",
            json={"prop_id": prop_id},
            headers=headers,
        )
    return resp.json()["id"]


async def test_update_placed_prop_position(client):
    headers = _admin_headers()
    placed_id = await _place_a_prop(client, headers)

    with patch("app.routes.prop_placement.broadcast", new=AsyncMock()):
        resp = await client.patch(
            f"/api/world/props/{placed_id}",
            json={"position": {"x": 5.0, "y": 1.0, "z": -3.0}},
            headers=headers,
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["position"]["x"] == 5.0
    assert body["position"]["y"] == 1.0
    assert body["position"]["z"] == -3.0


async def test_update_placed_prop_rotation(client):
    headers = _admin_headers()
    placed_id = await _place_a_prop(client, headers)

    with patch("app.routes.prop_placement.broadcast", new=AsyncMock()):
        resp = await client.patch(
            f"/api/world/props/{placed_id}",
            json={"rotation_y": 90.0},
            headers=headers,
        )
    assert resp.status_code == 200
    assert resp.json()["rotation_y"] == 90.0


async def test_update_placed_prop_scale(client):
    headers = _admin_headers()
    placed_id = await _place_a_prop(client, headers)

    with patch("app.routes.prop_placement.broadcast", new=AsyncMock()):
        resp = await client.patch(
            f"/api/world/props/{placed_id}",
            json={"scale": 2.5},
            headers=headers,
        )
    assert resp.status_code == 200
    assert resp.json()["scale"] == 2.5


async def test_update_placed_prop_room_id(client):
    headers = _admin_headers()
    placed_id = await _place_a_prop(client, headers)

    with patch("app.routes.prop_placement.broadcast", new=AsyncMock()):
        resp = await client.patch(
            f"/api/world/props/{placed_id}",
            json={"room_id": "room-A"},
            headers=headers,
        )
    assert resp.status_code == 200
    assert resp.json()["room_id"] == "room-A"


async def test_update_placed_prop_clear_room(client):
    headers = _admin_headers()
    with patch("app.routes.prop_placement.broadcast", new=AsyncMock()):
        resp = await client.post(
            "/api/world/props",
            json={"prop_id": "builtin:desk", "room_id": "room-X"},
            headers=headers,
        )
    placed_id = resp.json()["id"]

    with patch("app.routes.prop_placement.broadcast", new=AsyncMock()):
        resp = await client.patch(
            f"/api/world/props/{placed_id}",
            json={"clear_room": True},
            headers=headers,
        )
    assert resp.status_code == 200
    assert resp.json()["room_id"] is None


async def test_update_placed_prop_no_changes_returns_current(client):
    """PATCH with empty body returns current row unchanged."""
    headers = _admin_headers()
    placed_id = await _place_a_prop(client, headers)

    with patch("app.routes.prop_placement.broadcast", new=AsyncMock()):
        resp = await client.patch(
            f"/api/world/props/{placed_id}",
            json={},
            headers=headers,
        )
    assert resp.status_code == 200


async def test_update_placed_prop_not_found(client):
    headers = _admin_headers()
    with patch("app.routes.prop_placement.broadcast", new=AsyncMock()):
        resp = await client.patch(
            "/api/world/props/nonexistent-id",
            json={"scale": 2.0},
            headers=headers,
        )
    assert resp.status_code == 404


async def test_update_placed_prop_requires_auth(client):
    resp = await client.patch(
        "/api/world/props/some-id",
        json={"scale": 2.0},
    )
    assert resp.status_code in (401, 403)


async def test_update_placed_prop_broadcasts_event(client):
    headers = _admin_headers()
    placed_id = await _place_a_prop(client, headers)

    broadcast_mock = AsyncMock()
    with patch("app.routes.prop_placement.broadcast", new=broadcast_mock):
        await client.patch(
            f"/api/world/props/{placed_id}",
            json={"rotation_y": 180.0},
            headers=headers,
        )
    broadcast_mock.assert_called_once()
    args = broadcast_mock.call_args[0]
    assert args[1]["action"] == "move"


# ---------------------------------------------------------------------------
# DELETE /api/world/props/{placed_id}
# ---------------------------------------------------------------------------


async def test_delete_placed_prop_success(client):
    headers = _admin_headers()
    placed_id = await _place_a_prop(client, headers)

    with patch("app.routes.prop_placement.broadcast", new=AsyncMock()):
        resp = await client.delete(
            f"/api/world/props/{placed_id}",
            headers=headers,
        )
    assert resp.status_code == 204

    # Verify prop is gone
    list_resp = await client.get("/api/world/props")
    assert all(p["id"] != placed_id for p in list_resp.json()["props"])


async def test_delete_placed_prop_not_found(client):
    headers = _admin_headers()
    with patch("app.routes.prop_placement.broadcast", new=AsyncMock()):
        resp = await client.delete(
            "/api/world/props/nonexistent-id",
            headers=headers,
        )
    assert resp.status_code == 404


async def test_delete_placed_prop_requires_auth(client):
    resp = await client.delete("/api/world/props/some-id")
    assert resp.status_code in (401, 403)


async def test_delete_placed_prop_broadcasts_remove(client):
    headers = _admin_headers()
    placed_id = await _place_a_prop(client, headers)

    broadcast_mock = AsyncMock()
    with patch("app.routes.prop_placement.broadcast", new=broadcast_mock):
        await client.delete(
            f"/api/world/props/{placed_id}",
            headers=headers,
        )
    broadcast_mock.assert_called_once()
    args = broadcast_mock.call_args[0]
    assert args[1]["action"] == "remove"
    assert args[1]["placed_id"] == placed_id
