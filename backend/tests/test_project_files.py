from pathlib import Path

import pytest
from fastapi import HTTPException

from app.db.database import get_db
from app.routes import project_files as routes

pytestmark = pytest.mark.anyio


async def _seed_project(project_id: str, folder_path: str):
    async with get_db() as db:
        await db.execute(
            "INSERT INTO projects (id, name, description, folder_path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (project_id, "P", "D", folder_path, "active", 1, 1),
        )
        await db.commit()


def test_helpers_local(tmp_path):
    base = tmp_path / "proj"
    base.mkdir()
    file_md = base / "a.md"
    file_md.write_text("x")

    assert routes._is_safe_path(base, file_md)
    assert routes._get_file_type(file_md) == "document"
    assert routes._is_browsable_entry(file_md)
    assert not routes._is_browsable_entry(base / ".hidden")

    item = routes._build_file_item(file_md, Path("a.md"))
    assert item["name"] == "a.md"
    d = routes._build_dir_item(base, Path("."), [])
    assert d["type"] == "directory"

    decoded = routes._read_text_with_fallback(file_md)
    assert decoded == "x"


async def test_get_project_folder_and_resolve_errors(tmp_path):
    await _seed_project("p1", str(tmp_path))
    got = await routes._get_project_folder("p1")
    assert got == str(tmp_path)

    with pytest.raises(HTTPException):
        await routes._get_project_folder("missing")

    await _seed_project("p2", "")
    with pytest.raises(HTTPException):
        await routes._get_project_folder("p2")

    with pytest.raises(HTTPException):
        routes._resolve_project_folder(str(tmp_path / "missing"))


async def test_list_project_files_success_and_errors(client, tmp_path):
    base = tmp_path / "proj"
    base.mkdir()
    (base / "README.md").write_text("# hi")
    (base / "main.py").write_text("print(1)")
    (base / "node_modules").mkdir()
    (base / "node_modules" / "skip.js").write_text("x")
    (base / "sub").mkdir()
    (base / "sub" / "x.txt").write_text("ok")

    await _seed_project("p-list", str(base))

    ok = await client.get("/api/projects/p-list/files", params={"depth": 2})
    assert ok.status_code == 200
    names = str(ok.json())
    assert "README.md" in names and "node_modules" not in names

    bad_dir = await client.get("/api/projects/p-list/files", params={"path": "main.py"})
    assert bad_dir.status_code == 400

    not_found = await client.get("/api/projects/p-list/files", params={"path": "missing"})
    assert not_found.status_code == 404

    traversal = await client.get("/api/projects/p-list/files", params={"path": "../"})
    assert traversal.status_code == 403


async def test_read_project_file_text_and_errors(client, tmp_path, monkeypatch):
    base = tmp_path / "proj"
    base.mkdir()
    (base / "doc.md").write_text("hello")
    (base / "bin.exe").write_text("x")
    (base / "big.md").write_text("x" * (routes.MAX_FILE_SIZE + 1))
    (base / "adir").mkdir()
    await _seed_project("p-read", str(base))

    ok = await client.get("/api/projects/p-read/files/content", params={"path": "doc.md"})
    assert ok.status_code == 200
    assert ok.json()["content"] == "hello"

    nf = await client.get("/api/projects/p-read/files/content", params={"path": "missing.md"})
    assert nf.status_code == 404

    bad = await client.get("/api/projects/p-read/files/content", params={"path": "adir"})
    assert bad.status_code == 400

    disallowed = await client.get("/api/projects/p-read/files/content", params={"path": "bin.exe"})
    assert disallowed.status_code == 403

    too_big = await client.get("/api/projects/p-read/files/content", params={"path": "big.md"})
    assert too_big.status_code == 413

    trav = await client.get("/api/projects/p-read/files/content", params={"path": "../x.md"})
    assert trav.status_code == 403

    monkeypatch.setattr(
        routes,
        "_read_text_with_fallback",
        lambda _p: (_ for _ in ()).throw(HTTPException(status_code=422, detail="Could not decode file content")),
    )
    undec = await client.get("/api/projects/p-read/files/content", params={"path": "doc.md"})
    assert undec.status_code == 422


async def test_read_and_get_image(client, tmp_path):
    base = tmp_path / "proj"
    base.mkdir()
    png = base / "a.png"
    png.write_bytes(b"\x89PNG\r\n\x1a\n")
    txt = base / "a.txt"
    txt.write_text("x")
    await _seed_project("p-img", str(base))

    read_img = await client.get("/api/projects/p-img/files/content", params={"path": "a.png"})
    assert read_img.status_code == 200
    assert (
        read_img.headers["content-type"].startswith("image/")
        or read_img.headers["content-type"] == "application/octet-stream"
    )

    img = await client.get("/api/projects/p-img/files/image", params={"path": "a.png"})
    assert img.status_code == 200

    not_image = await client.get("/api/projects/p-img/files/image", params={"path": "a.txt"})
    assert not_image.status_code == 400

    missing = await client.get("/api/projects/p-img/files/image", params={"path": "none.png"})
    assert missing.status_code == 404


async def test_discover_project_folders_and_settings(client, tmp_path, monkeypatch):
    projects_base = tmp_path / "Projects"
    projects_base.mkdir()
    p1 = projects_base / "Alpha"
    p1.mkdir()
    (p1 / "README.md").write_text("# a")
    (p1 / "docs").mkdir()
    p2 = projects_base / ".hidden"
    p2.mkdir()

    async with get_db() as db:
        await db.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
            ("projects_base_path", str(projects_base), 1),
        )
        await db.commit()

    resp = await client.get("/api/project-folders/discover")
    assert resp.status_code == 200
    data = resp.json()
    assert data["base_path"] == str(projects_base)
    assert any(f["name"] == "Alpha" for f in data["folders"])
    assert all(not f["name"].startswith(".") for f in data["folders"])

    # fallback default when DB access fails
    monkeypatch.setattr(routes, "get_db", lambda: (_ for _ in ()).throw(RuntimeError("db")))
    base_path = await routes._get_projects_base_path()
    assert base_path == routes.DEFAULT_PROJECTS_BASE_PATH
