import pytest


@pytest.mark.asyncio
async def test_discovery_docs_topic_success(client):
    response = await client.get("/api/discovery/docs/auth")
    assert response.status_code == 200

    data = response.json()
    assert data["topic"] == "auth"
    assert data["content_type"] == "text/markdown"
    assert "X-API-Key" in data["content"]
    assert response.headers.get("ETag")


@pytest.mark.asyncio
async def test_discovery_docs_etag_304(client):
    first = await client.get("/api/discovery/docs/rooms")
    assert first.status_code == 200
    etag = first.headers.get("ETag")
    assert etag

    second = await client.get("/api/discovery/docs/rooms", headers={"If-None-Match": etag})
    assert second.status_code == 304


@pytest.mark.asyncio
async def test_discovery_docs_unknown_topic(client):
    response = await client.get("/api/discovery/docs/unknown-topic")
    assert response.status_code == 404
    detail = response.json()["detail"]
    assert detail["error"] == "unknown_topic"
    assert "available_topics" in detail
