import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

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


async def test_export_and_create_and_list_backups_happy_path(client):
    headers = _admin_headers()

    export_resp = await client.get("/api/backup/export", headers=headers)
    assert export_resp.status_code == 200
    assert "metadata" in export_resp.json()

    create_resp = await client.post("/api/backup/create", headers=headers)
    assert create_resp.status_code == 200
    payload = create_resp.json()
    assert payload["size"] > 0

    list_resp = await client.get("/api/backup/list", headers=headers)
    assert list_resp.status_code == 200
    files = list_resp.json()
    assert any(item["filename"].endswith(".db") for item in files)


async def test_list_backups_filters_extensions(client, monkeypatch, tmp_path):
    from app.routes import backup as backup_routes

    (tmp_path / "a.db").write_text("x")
    (tmp_path / "b.json").write_text("{}")
    (tmp_path / "c.txt").write_text("ignore")
    monkeypatch.setattr(backup_routes, "BACKUP_DIR", tmp_path)

    resp = await client.get("/api/backup/list", headers=_admin_headers())
    assert resp.status_code == 200
    names = [x["filename"] for x in resp.json()]
    assert "a.db" in names and "b.json" in names
    assert "c.txt" not in names


async def test_create_backup_db_missing_returns_404(client, monkeypatch):
    from app.routes import backup as backup_routes

    monkeypatch.setattr(backup_routes, "DB_PATH", Path("/definitely/missing.db"))
    resp = await client.post("/api/backup/create", headers=_admin_headers())
    assert resp.status_code == 404


async def test_create_backup_failure_returns_500(client, monkeypatch):
    from app.routes import backup as backup_routes

    monkeypatch.setattr(backup_routes, "_create_file_backup", lambda: (_ for _ in ()).throw(RuntimeError("boom")))
    resp = await client.post("/api/backup/create", headers=_admin_headers())
    assert resp.status_code == 500
    assert "Backup failed" in resp.json()["detail"]


async def test_export_database_not_found(client, monkeypatch):
    from app.routes import backup as backup_routes

    monkeypatch.setattr(backup_routes, "DB_PATH", Path("/missing/file.db"))
    resp = await client.get("/api/backup/export", headers=_admin_headers())
    assert resp.status_code == 404


async def test_export_database_internal_error(client, monkeypatch):
    from app.routes import backup as backup_routes

    class _Exists:
        def exists(self):
            return True

    monkeypatch.setattr(backup_routes, "DB_PATH", _Exists())

    class BoomCtx:
        async def __aenter__(self):
            raise RuntimeError("db down")

        async def __aexit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr(backup_routes, "get_db", lambda: BoomCtx())

    resp = await client.get("/api/backup/export", headers=_admin_headers())
    assert resp.status_code == 500


async def test_import_database_success_and_schema_guard(client):
    headers = _admin_headers()
    good = {
        "metadata": {"schema_version": 1},
        "data": {
            "schema_version": [{"version": 1, "updated_at": 1}],
            "rooms": [],
            "agents": [],
            "session_room_assignments": [],
            "session_display_names": [],
            "room_assignment_rules": [],
            "settings": [],
            "connections": [],
        },
    }
    files = {"file": ("import.json", json.dumps(good), "application/json")}
    ok = await client.post("/api/backup/import", files=files, headers=headers)
    assert ok.status_code == 200
    assert ok.json()["success"] is True

    bad = {"metadata": {"schema_version": 9999}, "data": {}}
    bad_files = {"file": ("bad.json", json.dumps(bad), "application/json")}
    guard = await client.post("/api/backup/import", files=bad_files, headers=headers)
    assert guard.status_code == 400


async def test_import_database_backup_or_import_failure_paths(client, monkeypatch):
    from app.routes import backup as backup_routes

    headers = _admin_headers()
    payload = {"metadata": {"schema_version": 1}, "data": {}}
    files = {"file": ("import.json", json.dumps(payload), "application/json")}

    monkeypatch.setattr(
        backup_routes,
        "_create_file_backup",
        lambda: (_ for _ in ()).throw(RuntimeError("no backup")),
    )
    resp = await client.post("/api/backup/import", files=files, headers=headers)
    assert resp.status_code == 500
    assert "Failed to create safety backup" in resp.json()["detail"]

    monkeypatch.setattr(backup_routes, "_create_file_backup", lambda: Path("/tmp/fake.db"))
    monkeypatch.setattr(backup_routes, "_import_tables", AsyncMock(side_effect=RuntimeError("broken import")))
    restore_mock = AsyncMock()
    monkeypatch.setattr(backup_routes, "_restore_database_from_backup", restore_mock)
    resp2 = await client.post("/api/backup/import", files=files, headers=headers)
    assert resp2.status_code == 500
    restore_mock.assert_called_once()


async def test_import_helpers_unit_branches(monkeypatch):
    from app.routes import backup as backup_routes

    upload = SimpleNamespace(read=AsyncMock(return_value=b'{"x":1}'))
    parsed = await backup_routes._read_import_payload(upload)
    assert parsed == {"x": 1}

    invalid = SimpleNamespace(read=AsyncMock(return_value=b"not-json"))
    with pytest.raises(HTTPException) as e1:
        await backup_routes._read_import_payload(invalid)
    assert e1.value.status_code == 400

    fail_read = SimpleNamespace(read=AsyncMock(side_effect=RuntimeError("io")))
    with pytest.raises(HTTPException):
        await backup_routes._read_import_payload(fail_read)

    with pytest.raises(HTTPException):
        backup_routes._extract_import_data({"metadata": {}})

    with pytest.raises(HTTPException):
        backup_routes._validate_schema_compatibility({"schema_version": 9999})


async def test_replace_table_data_and_restore_failure(monkeypatch):
    from app.routes import backup as backup_routes

    db = AsyncMock()
    rows = [{"id": 1, "name": "n1"}, {"id": 2, "name": "n2"}]
    count = await backup_routes._replace_table_data(db, "rooms", rows)
    assert count == 2

    zero = await backup_routes._replace_table_data(db, "rooms", [])
    assert zero == 0

    copy2_mock = AsyncMock(side_effect=RuntimeError("restore fail"))
    monkeypatch.setattr(backup_routes.shutil, "copy2", copy2_mock)
    # should not raise
    backup_routes._restore_database_from_backup(Path("/tmp/missing.db"))
