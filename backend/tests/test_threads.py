"""Tests for thread (group chat) routes."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio


async def _seed_agents(count=3):
    """Insert test agents and return their IDs."""
    import time

    from app.db.database import get_db

    ids = []
    now = int(time.time() * 1000)
    async with get_db() as db:
        for i in range(count):
            aid = f"agent-{i}"
            await db.execute(
                "INSERT OR IGNORE INTO agents (id, name, icon, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (aid, f"Agent {i}", f"icon-{i}", f"#{i:06d}", now, now),
            )
            ids.append(aid)
        await db.commit()
    return ids


async def _create_thread(client, agent_ids, title=None, kind="group"):
    body = {"participant_agent_ids": agent_ids, "kind": kind}
    if title:
        body["title"] = title
    resp = await client.post("/api/threads", json=body)
    return resp


# ── Thread CRUD ─────────────────────────────────────────────────


async def test_create_thread(client: AsyncClient):
    ids = await _seed_agents(2)
    resp = await _create_thread(client, ids)
    assert resp.status_code == 200
    data = resp.json()
    assert data["participant_count"] == 2
    assert len(data["participants"]) == 2


async def test_create_thread_with_title(client: AsyncClient):
    ids = await _seed_agents(2)
    resp = await _create_thread(client, ids, title="My Group")
    data = resp.json()
    assert data["title"] == "My Group"


async def test_create_thread_too_few_agents(client: AsyncClient):
    ids = await _seed_agents(1)
    resp = await _create_thread(client, ids)
    assert resp.status_code == 400


async def test_create_thread_too_many_agents(client: AsyncClient):
    ids = await _seed_agents(6)
    resp = await _create_thread(client, ids)
    assert resp.status_code == 400


async def test_create_thread_missing_agents(client: AsyncClient):
    resp = await _create_thread(client, ["nonexistent-1", "nonexistent-2"])
    assert resp.status_code == 404


async def test_create_thread_dedup_ids(client: AsyncClient):
    ids = await _seed_agents(2)
    # Duplicate agent ids
    resp = await _create_thread(client, ids + [ids[0]])
    assert resp.status_code == 200
    assert resp.json()["participant_count"] == 2


async def test_list_threads_returns_ok(client: AsyncClient):
    resp = await client.get("/api/threads")
    assert resp.status_code == 200
    assert "threads" in resp.json()


async def test_list_threads_with_created(client: AsyncClient):
    ids = await _seed_agents(2)
    await _create_thread(client, ids)
    resp = await client.get("/api/threads")
    assert resp.status_code == 200
    assert len(resp.json()["threads"]) >= 1


async def test_list_threads_filter_kind(client: AsyncClient):
    ids = await _seed_agents(2)
    await _create_thread(client, ids, kind="group")
    resp = await client.get("/api/threads?kind=group")
    assert len(resp.json()["threads"]) >= 1


async def test_list_threads_archived_filter(client: AsyncClient):
    ids = await _seed_agents(2)
    resp = await _create_thread(client, ids)
    tid = resp.json()["id"]

    # Archive it
    await client.patch(f"/api/threads/{tid}", json={"archived": True})

    # In archived list
    resp = await client.get("/api/threads?archived=true")
    assert len(resp.json()["threads"]) >= 1


async def test_get_thread(client: AsyncClient):
    ids = await _seed_agents(2)
    resp = await _create_thread(client, ids)
    tid = resp.json()["id"]

    resp = await client.get(f"/api/threads/{tid}")
    assert resp.status_code == 200
    assert resp.json()["id"] == tid


async def test_get_thread_not_found(client: AsyncClient):
    resp = await client.get("/api/threads/nonexistent")
    assert resp.status_code == 404


async def test_update_thread_title(client: AsyncClient):
    ids = await _seed_agents(2)
    resp = await _create_thread(client, ids)
    tid = resp.json()["id"]

    resp = await client.patch(f"/api/threads/{tid}", json={"title": "Renamed"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Renamed"


async def test_update_thread_archive(client: AsyncClient):
    ids = await _seed_agents(2)
    resp = await _create_thread(client, ids)
    tid = resp.json()["id"]

    resp = await client.patch(f"/api/threads/{tid}", json={"archived": True})
    assert resp.status_code == 200
    assert resp.json()["archived_at"] is not None

    # Unarchive
    resp = await client.patch(f"/api/threads/{tid}", json={"archived": False})
    assert resp.json()["archived_at"] is None


async def test_update_thread_not_found(client: AsyncClient):
    resp = await client.patch("/api/threads/nonexistent", json={"title": "X"})
    assert resp.status_code == 404


# ── Participants ────────────────────────────────────────────────


async def test_add_participant(client: AsyncClient):
    ids = await _seed_agents(3)
    resp = await _create_thread(client, ids[:2])
    tid = resp.json()["id"]

    resp = await client.post(f"/api/threads/{tid}/participants", json={"agent_ids": [ids[2]]})
    assert resp.status_code == 200
    assert resp.json()["participant_count"] == 3


async def test_add_participant_exceeds_max(client: AsyncClient):
    ids = await _seed_agents(6)
    resp = await _create_thread(client, ids[:5])
    tid = resp.json()["id"]

    resp = await client.post(f"/api/threads/{tid}/participants", json={"agent_ids": [ids[5]]})
    assert resp.status_code == 400


async def test_add_participant_thread_not_found(client: AsyncClient):
    ids = await _seed_agents(1)
    resp = await client.post("/api/threads/nonexistent/participants", json={"agent_ids": ids})
    assert resp.status_code == 404


async def test_add_participant_already_active(client: AsyncClient):
    """Adding an already-active participant should be a no-op."""
    ids = await _seed_agents(2)
    resp = await _create_thread(client, ids)
    tid = resp.json()["id"]

    resp = await client.post(f"/api/threads/{tid}/participants", json={"agent_ids": [ids[0]]})
    assert resp.status_code == 200
    assert resp.json()["participant_count"] == 2  # unchanged


async def test_remove_participant(client: AsyncClient):
    ids = await _seed_agents(3)
    resp = await _create_thread(client, ids)
    tid = resp.json()["id"]

    resp = await client.delete(f"/api/threads/{tid}/participants/{ids[2]}")
    assert resp.status_code == 200
    assert resp.json()["participant_count"] == 2


async def test_remove_participant_not_found(client: AsyncClient):
    resp = await client.delete("/api/threads/nonexistent/participants/agent-0")
    assert resp.status_code == 404


async def test_reactivate_participant(client: AsyncClient):
    """Remove then re-add should reactivate."""
    ids = await _seed_agents(3)
    resp = await _create_thread(client, ids)
    tid = resp.json()["id"]

    # Remove
    await client.delete(f"/api/threads/{tid}/participants/{ids[2]}")
    # Re-add
    resp = await client.post(f"/api/threads/{tid}/participants", json={"agent_ids": [ids[2]]})
    assert resp.status_code == 200
    assert resp.json()["participant_count"] == 3


# ── Messages ────────────────────────────────────────────────────


async def test_get_messages_empty(client: AsyncClient):
    ids = await _seed_agents(2)
    resp = await _create_thread(client, ids)
    tid = resp.json()["id"]

    resp = await client.get(f"/api/threads/{tid}/messages")
    assert resp.status_code == 200
    # System message from creation
    assert len(resp.json()["messages"]) >= 1


async def test_get_messages_thread_not_found(client: AsyncClient):
    resp = await client.get("/api/threads/nonexistent/messages")
    assert resp.status_code == 404


async def test_get_messages_pagination(client: AsyncClient):
    ids = await _seed_agents(2)
    resp = await _create_thread(client, ids)
    tid = resp.json()["id"]

    resp = await client.get(f"/api/threads/{tid}/messages?limit=1")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["messages"]) <= 1


async def test_get_messages_before_filter(client: AsyncClient):
    ids = await _seed_agents(2)
    resp = await _create_thread(client, ids)
    tid = resp.json()["id"]

    resp = await client.get(f"/api/threads/{tid}/messages?before=1")
    assert resp.status_code == 200
    assert len(resp.json()["messages"]) == 0


async def test_send_message(client: AsyncClient):
    ids = await _seed_agents(2)
    resp = await _create_thread(client, ids)
    tid = resp.json()["id"]

    with patch("app.routes.threads.get_connection_manager") as mock_gcm:
        mock_mgr = AsyncMock()
        mock_mgr.get_default_openclaw.return_value = None
        mock_gcm.return_value = mock_mgr

        resp = await client.post(
            f"/api/threads/{tid}/messages",
            json={"content": "Hello group!"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["user_message"]["content"] == "Hello group!"


async def test_send_message_empty(client: AsyncClient):
    ids = await _seed_agents(2)
    resp = await _create_thread(client, ids)
    tid = resp.json()["id"]

    resp = await client.post(f"/api/threads/{tid}/messages", json={"content": "   "})
    assert resp.status_code == 400


async def test_send_message_thread_not_found(client: AsyncClient):
    resp = await client.post("/api/threads/nonexistent/messages", json={"content": "Hello"})
    assert resp.status_code == 404


async def test_send_message_archived_thread(client: AsyncClient):
    ids = await _seed_agents(2)
    resp = await _create_thread(client, ids)
    tid = resp.json()["id"]

    await client.patch(f"/api/threads/{tid}", json={"archived": True})

    with patch("app.routes.threads.get_connection_manager") as mock_gcm:
        mock_mgr = AsyncMock()
        mock_gcm.return_value = mock_mgr
        resp = await client.post(f"/api/threads/{tid}/messages", json={"content": "Hello"})
    assert resp.status_code == 400


async def test_send_message_targeted(client: AsyncClient):
    ids = await _seed_agents(2)
    resp = await _create_thread(client, ids)
    tid = resp.json()["id"]

    with patch("app.routes.threads.get_connection_manager") as mock_gcm:
        mock_mgr = AsyncMock()
        mock_mgr.get_default_openclaw.return_value = None
        mock_gcm.return_value = mock_mgr

        resp = await client.post(
            f"/api/threads/{tid}/messages",
            json={"content": "Hey you", "routing_mode": "targeted", "target_agent_ids": [ids[0]]},
        )
    assert resp.status_code == 200
    assert ids[0] in resp.json()["routed_to"]


async def test_send_message_with_connection(client: AsyncClient):
    """Test message routing when a connection is available."""
    ids = await _seed_agents(2)
    resp = await _create_thread(client, ids)
    tid = resp.json()["id"]

    from unittest.mock import MagicMock

    mock_conn = MagicMock()
    mock_conn.send_chat = AsyncMock(return_value="I'm agent response")
    mock_mgr = MagicMock()
    mock_mgr.get_default_openclaw.return_value = mock_conn

    async def fake_get_cm():
        return mock_mgr

    with patch("app.routes.threads.get_connection_manager", side_effect=fake_get_cm):
        resp = await client.post(
            f"/api/threads/{tid}/messages",
            json={"content": "Hello agents"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["responses"]) == 2


async def test_send_message_agent_failure(client: AsyncClient):
    """Test graceful handling when agent fails to respond."""
    ids = await _seed_agents(2)
    resp = await _create_thread(client, ids)
    tid = resp.json()["id"]

    with patch("app.routes.threads.get_connection_manager") as mock_gcm:
        mock_conn = AsyncMock()
        mock_conn.send_chat = AsyncMock(side_effect=Exception("Agent down"))
        mock_mgr = AsyncMock()
        mock_mgr.get_default_openclaw.return_value = mock_conn
        mock_gcm.return_value = mock_mgr

        resp = await client.post(
            f"/api/threads/{tid}/messages",
            json={"content": "Hello"},
        )
    assert resp.status_code == 200
    assert len(resp.json()["responses"]) == 0


async def test_send_message_no_active_participants(client: AsyncClient):
    """Thread with all participants removed should fail."""
    ids = await _seed_agents(2)
    resp = await _create_thread(client, ids)
    tid = resp.json()["id"]

    # Remove all participants
    for aid in ids:
        await client.delete(f"/api/threads/{tid}/participants/{aid}")

    with patch("app.routes.threads.get_connection_manager") as mock_gcm:
        mock_mgr = AsyncMock()
        mock_gcm.return_value = mock_mgr
        resp = await client.post(f"/api/threads/{tid}/messages", json={"content": "Hello"})
    assert resp.status_code == 400


# ── Helper functions ────────────────────────────────────────────


def test_generate_auto_title():
    from app.routes.threads import _generate_auto_title

    assert _generate_auto_title([]) == "Empty group"
    assert _generate_auto_title(["Alice"]) == "Alice"
    assert _generate_auto_title(["Alice", "Bob"]) == "Alice, Bob"
    assert _generate_auto_title(["A", "B", "C"]) == "A, B, C"
    assert "4 agents" in _generate_auto_title(["A", "B", "C", "D"])


async def test_send_message_targeted_no_valid_targets(client: AsyncClient):
    """Targeted mode with nonexistent agent ids → no valid targets."""
    ids = await _seed_agents(2)
    resp = await _create_thread(client, ids)
    tid = resp.json()["id"]

    with patch("app.routes.threads.get_connection_manager") as mock_gcm:
        mock_mgr = AsyncMock()
        mock_gcm.return_value = mock_mgr
        resp = await client.post(
            f"/api/threads/{tid}/messages",
            json={"content": "Hello", "routing_mode": "targeted", "target_agent_ids": ["nonexistent"]},
        )
    assert resp.status_code == 400
