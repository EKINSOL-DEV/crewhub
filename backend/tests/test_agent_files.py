from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

import app.routes.agent_files as routes
from app.db.database import get_db


@pytest.fixture
async def client():
    app = FastAPI()
    app.include_router(routes.router, prefix="/api/agents")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_get_agent_workspace_from_settings():
    async with get_db() as db:
        await db.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
            ("agent_workspaces", '{"dev": "/tmp/custom-workspace"}', 1),
        )
        await db.commit()

    resolved = await routes._get_agent_workspace("dev")
    assert str(resolved) == str(Path("/tmp/custom-workspace").resolve())


@pytest.mark.asyncio
async def test_get_agent_workspace_default_and_404():
    assert isinstance(await routes._get_agent_workspace("main"), Path)
    with pytest.raises(HTTPException):
        await routes._get_agent_workspace("missing-agent")


@pytest.mark.asyncio
async def test_list_read_save_agent_files_flow(client, monkeypatch, tmp_path):
    (tmp_path / "memory").mkdir()
    f = tmp_path / "memory" / "2026-02-27.md"
    f.write_text("hello\nworld")

    async def fake_ws(_agent_id):
        return tmp_path

    monkeypatch.setattr(routes, "_get_agent_workspace", fake_ws)

    listed = await client.get("/api/agents/dev/files", params={"path": "memory", "depth": 2})
    assert listed.status_code == 200

    read = await client.get("/api/agents/dev/files/memory/2026-02-27.md")
    assert read.status_code == 200

    expected = datetime.fromtimestamp(f.stat().st_mtime, tz=UTC).isoformat()
    save = await client.put(
        "/api/agents/dev/files/memory/2026-02-27.md", json={"content": "updated", "expected_modified": expected}
    )
    assert save.status_code == 200
    assert f.with_suffix(".md.bak").exists()


@pytest.mark.asyncio
async def test_save_agent_file_conflict_and_missing_content(client, monkeypatch, tmp_path):
    (tmp_path / "a.md").write_text("x")

    async def fake_ws(_agent_id):
        return tmp_path

    monkeypatch.setattr(routes, "_get_agent_workspace", fake_ws)

    assert (await client.put("/api/agents/dev/files/a.md", json={})).status_code == 400
    assert (
        await client.put(
            "/api/agents/dev/files/a.md",
            json={"content": "new", "expected_modified": "2000-01-01T00:00:00+00:00"},
        )
    ).status_code == 409


@pytest.mark.asyncio
async def test_list_and_read_validation_errors(client, monkeypatch, tmp_path):
    async def fake_ws(_agent_id):
        return tmp_path

    monkeypatch.setattr(routes, "_get_agent_workspace", fake_ws)

    assert (await client.get("/api/agents/dev/files", params={"path": "../etc"})).status_code == 400
    assert (await client.get("/api/agents/dev/files", params={"path": "missing"})).status_code == 404
    assert (await client.get("/api/agents/dev/files/../bad.md")).status_code in (400, 404)
