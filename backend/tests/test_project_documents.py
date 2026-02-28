"""Tests for app.routes.project_documents."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

pytestmark = pytest.mark.anyio


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def project_id(client):
    """Create a test project and return its ID."""
    # Insert directly via DB to avoid dependency on other routes
    import time
    import uuid

    from app.db.database import get_db

    pid = str(uuid.uuid4())
    now = int(time.time())
    async with get_db() as db:
        await db.execute(
            """INSERT INTO projects (id, name, description, icon, color, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (pid, "TestProject", "Test", "📁", "#ff0000", "active", now, now),
        )
        await db.commit()
    return pid


@pytest.fixture
def docs_dir(tmp_path):
    """Create a temporary documents directory."""
    docs = tmp_path / "docs"
    docs.mkdir()
    return docs


# ---------------------------------------------------------------------------
# _get_project_docs_path helper
# ---------------------------------------------------------------------------


class TestGetProjectDocsPath:
    @pytest.mark.asyncio
    async def test_project_not_found(self, client):
        from fastapi import HTTPException

        from app.routes.project_documents import _get_project_docs_path

        with pytest.raises(HTTPException) as exc_info:
            await _get_project_docs_path("nonexistent-id")
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_default_path_without_docs_path(self, project_id, tmp_path):
        """When no docs_path set, uses PROJECT_DATA_PATH / project_name."""
        from app.config import settings
        from app.routes.project_documents import _get_project_docs_path

        with patch.object(settings, "project_data_path", str(tmp_path)):
            docs_dir_path, project_name = await _get_project_docs_path(project_id)

        assert project_name == "TestProject"
        assert str(tmp_path) in str(docs_dir_path)

    @pytest.mark.asyncio
    async def test_explicit_docs_path(self, project_id, tmp_path):
        """When docs_path is explicitly set, use it."""
        from app.db.database import get_db
        from app.routes.project_documents import _get_project_docs_path

        custom_path = str(tmp_path / "custom-docs")
        async with get_db() as db:
            await db.execute(
                "UPDATE projects SET docs_path = ? WHERE id = ?",
                (custom_path, project_id),
            )
            await db.commit()

        docs_dir_path, project_name = await _get_project_docs_path(project_id)
        assert str(docs_dir_path) == str(Path(custom_path).resolve())


# ---------------------------------------------------------------------------
# GET /{project_id}/documents
# ---------------------------------------------------------------------------


async def test_list_documents_missing_dir(client, project_id, tmp_path):
    """Returns empty list when directory doesn't exist."""
    from app.config import settings

    with patch.object(settings, "project_data_path", str(tmp_path / "nonexistent")):
        resp = await client.get(f"/api/projects/{project_id}/documents")

    assert resp.status_code == 200
    body = resp.json()
    assert body["project_id"] == project_id
    assert body["files"] == []


async def test_list_documents_with_files(client, project_id, tmp_path):
    """Returns files when directory exists."""
    from app.config import settings

    # Create doc directory
    docs = tmp_path / "TestProject"
    docs.mkdir()
    (docs / "README.md").write_text("# Hello")
    (docs / "notes.txt").write_text("Notes here")

    with patch.object(settings, "project_data_path", str(tmp_path)):
        resp = await client.get(f"/api/projects/{project_id}/documents")

    assert resp.status_code == 200
    body = resp.json()
    assert body["project_id"] == project_id
    file_names = {f["name"] for f in body["files"]}
    assert "README.md" in file_names


async def test_list_documents_with_subpath(client, project_id, tmp_path):
    """Can list a subdirectory."""
    from app.config import settings

    docs = tmp_path / "TestProject"
    docs.mkdir()
    subdir = docs / "subfolder"
    subdir.mkdir()
    (subdir / "file.md").write_text("content")

    with patch.object(settings, "project_data_path", str(tmp_path)):
        resp = await client.get(f"/api/projects/{project_id}/documents", params={"path": "subfolder"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["files"] is not None


async def test_list_documents_nonexistent_subpath(client, project_id, tmp_path):
    """Returns empty list when subdirectory doesn't exist."""
    from app.config import settings

    docs = tmp_path / "TestProject"
    docs.mkdir()

    with patch.object(settings, "project_data_path", str(tmp_path)):
        resp = await client.get(f"/api/projects/{project_id}/documents", params={"path": "nonexistent-subdir"})

    assert resp.status_code == 200
    assert resp.json()["files"] == []


async def test_list_documents_path_traversal_rejected(client, project_id):
    resp = await client.get(f"/api/projects/{project_id}/documents", params={"path": "../../../etc/passwd"})
    assert resp.status_code == 400


async def test_list_documents_project_not_found(client):
    resp = await client.get("/api/projects/nonexistent-id/documents")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /{project_id}/documents/{file_path}
# ---------------------------------------------------------------------------


async def test_read_document_success(client, project_id, tmp_path):
    from app.config import settings

    docs = tmp_path / "TestProject"
    docs.mkdir()
    (docs / "README.md").write_text("# Hello World\nThis is a test doc.")

    with patch.object(settings, "project_data_path", str(tmp_path)):
        resp = await client.get(f"/api/projects/{project_id}/documents/README.md")

    assert resp.status_code == 200
    body = resp.json()
    assert "Hello World" in body.get("content", "") or "Hello World" in str(body)


async def test_read_document_path_traversal_rejected(client, project_id):
    resp = await client.get(f"/api/projects/{project_id}/documents/../../../etc/passwd")
    assert resp.status_code in (400, 403, 404)


async def test_read_document_project_not_found(client):
    resp = await client.get("/api/projects/nonexistent-id/documents/README.md")
    assert resp.status_code == 404


async def test_read_document_unsupported_extension(client, project_id, tmp_path):
    from app.config import settings

    docs = tmp_path / "TestProject"
    docs.mkdir()
    (docs / "script.py").write_text("print('hello')")

    with patch.object(settings, "project_data_path", str(tmp_path)):
        resp = await client.get(f"/api/projects/{project_id}/documents/script.py")

    assert resp.status_code in (403, 404, 400)


async def test_read_document_file_not_found(client, project_id, tmp_path):
    from app.config import settings

    docs = tmp_path / "TestProject"
    docs.mkdir()

    with patch.object(settings, "project_data_path", str(tmp_path)):
        resp = await client.get(f"/api/projects/{project_id}/documents/nonexistent.md")

    assert resp.status_code in (404, 400)


async def test_read_document_outside_project_rejected(client, project_id, tmp_path):
    from app.config import settings

    docs = tmp_path / "TestProject"
    docs.mkdir()

    with patch.object(settings, "project_data_path", str(tmp_path)):
        resp = await client.get(f"/api/projects/{project_id}/documents/subdir/../../README.md")

    assert resp.status_code in (400, 403, 404)


# ---------------------------------------------------------------------------
# PUT /{project_id}/documents/{file_path}
# ---------------------------------------------------------------------------


async def test_save_document_success(client, project_id, tmp_path):
    from app.config import settings

    docs = tmp_path / "TestProject"
    docs.mkdir()
    # Create the file first so we can save it
    (docs / "README.md").write_text("original content")

    with patch.object(settings, "project_data_path", str(tmp_path)):
        resp = await client.put(
            f"/api/projects/{project_id}/documents/README.md",
            json={"content": "# Updated Content\nNew text here."},
        )

    assert resp.status_code == 200
    # Verify the file was updated
    assert (docs / "README.md").read_text() == "# Updated Content\nNew text here."


async def test_save_document_missing_content(client, project_id, tmp_path):
    from app.config import settings

    docs = tmp_path / "TestProject"
    docs.mkdir()
    (docs / "README.md").write_text("original")

    with patch.object(settings, "project_data_path", str(tmp_path)):
        resp = await client.put(
            f"/api/projects/{project_id}/documents/README.md",
            json={},
        )

    assert resp.status_code == 400


async def test_save_document_path_traversal_rejected(client, project_id):
    resp = await client.put(
        f"/api/projects/{project_id}/documents/../../../etc/passwd",
        json={"content": "hacked"},
    )
    assert resp.status_code == 400


async def test_save_document_project_not_found(client):
    resp = await client.put(
        "/api/projects/nonexistent-id/documents/README.md",
        json={"content": "content"},
    )
    assert resp.status_code == 404


async def test_save_document_creates_backup(client, project_id, tmp_path):
    """Saving a document should create a .bak backup."""
    from app.config import settings

    docs = tmp_path / "TestProject"
    docs.mkdir()
    (docs / "notes.md").write_text("original notes")

    with patch.object(settings, "project_data_path", str(tmp_path)):
        resp = await client.put(
            f"/api/projects/{project_id}/documents/notes.md",
            json={"content": "updated notes"},
        )

    assert resp.status_code == 200
    assert (docs / "notes.md.bak").exists()
    assert (docs / "notes.md.bak").read_text() == "original notes"


async def test_save_document_write_failure(client, project_id, tmp_path):
    from app.config import settings

    docs = tmp_path / "TestProject"
    docs.mkdir()
    (docs / "README.md").write_text("original")

    def fail_write(*args, **kwargs):
        raise OSError("disk full")

    with patch.object(settings, "project_data_path", str(tmp_path)):
        with patch("pathlib.Path.write_text", side_effect=fail_write):
            resp = await client.put(
                f"/api/projects/{project_id}/documents/README.md",
                json={"content": "new content"},
            )

    assert resp.status_code == 500
