from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.routes import cron as routes

pytestmark = pytest.mark.anyio


def test_schedule_and_payload_validators():
    with pytest.raises(ValidationError):
        routes.ScheduleConfig(kind="at")
    with pytest.raises(ValidationError):
        routes.ScheduleConfig(kind="every", everyMs=0)
    with pytest.raises(ValidationError):
        routes.ScheduleConfig(kind="cron")

    assert routes.ScheduleConfig(kind="at", atMs=1).atMs == 1
    assert routes.ScheduleConfig(kind="every", everyMs=1000).everyMs == 1000
    assert routes.ScheduleConfig(kind="cron", expr="* * * * *").expr == "* * * * *"

    with pytest.raises(ValidationError):
        routes.PayloadConfig(kind="systemEvent")
    with pytest.raises(ValidationError):
        routes.PayloadConfig(kind="agentTurn")
    assert routes.PayloadConfig(kind="systemEvent", text="x").text == "x"
    assert routes.PayloadConfig(kind="agentTurn", message="m").message == "m"


async def test_get_openclaw_503(monkeypatch):
    class M:
        def get_default_openclaw(self):
            return None

    monkeypatch.setattr(routes, "get_connection_manager", AsyncMock(return_value=M()))
    with pytest.raises(HTTPException) as e:
        await routes._get_openclaw()
    assert e.value.status_code == 503


async def test_cron_endpoints_success(client, monkeypatch):
    conn = AsyncMock()
    conn.list_cron_jobs.return_value = [{"id": "j1"}]
    conn.create_cron_job.return_value = {"id": "j1"}
    conn.update_cron_job.return_value = {"id": "j1", "enabled": False}
    conn.delete_cron_job.return_value = True
    conn.enable_cron_job.return_value = True
    conn.disable_cron_job.return_value = True
    conn.run_cron_job.return_value = True

    class M:
        def get_default_openclaw(self):
            return conn

    monkeypatch.setattr(routes, "get_connection_manager", AsyncMock(return_value=M()))

    jobs = await client.get("/api/cron/jobs")
    assert jobs.status_code == 200

    create_payload = {
        "schedule": {"kind": "every", "everyMs": 60000},
        "payload": {"kind": "agentTurn", "message": "hello", "model": "x"},
        "sessionTarget": "main",
        "name": "n",
        "enabled": True,
    }
    created = await client.post("/api/cron/jobs", json=create_payload)
    assert created.status_code == 200

    got = await client.get("/api/cron/jobs/j1")
    assert got.status_code == 200

    patch_payload = {
        "schedule": {"kind": "cron", "expr": "*/5 * * * *"},
        "payload": {"kind": "systemEvent", "text": "run"},
        "sessionTarget": "isolated",
        "name": "renamed",
        "enabled": False,
    }
    upd = await client.patch("/api/cron/jobs/j1", json=patch_payload)
    assert upd.status_code == 200

    assert (await client.delete("/api/cron/jobs/j1")).status_code == 200
    assert (await client.post("/api/cron/jobs/j1/enable")).status_code == 200
    assert (await client.post("/api/cron/jobs/j1/disable")).status_code == 200
    assert (await client.post("/api/cron/jobs/j1/run", params={"force": False})).status_code == 200


async def test_cron_endpoint_failures(client, monkeypatch):
    conn = AsyncMock()
    conn.list_cron_jobs.return_value = [{"id": "other"}]
    conn.create_cron_job.return_value = None
    conn.update_cron_job.return_value = None
    conn.delete_cron_job.return_value = False
    conn.enable_cron_job.return_value = False
    conn.disable_cron_job.return_value = False
    conn.run_cron_job.return_value = False

    class M:
        def get_default_openclaw(self):
            return conn

    monkeypatch.setattr(routes, "get_connection_manager", AsyncMock(return_value=M()))

    nf = await client.get("/api/cron/jobs/missing")
    assert nf.status_code == 404

    create_payload = {
        "schedule": {"kind": "at", "atMs": 123},
        "payload": {"kind": "systemEvent", "text": "t"},
    }
    assert (await client.post("/api/cron/jobs", json=create_payload)).status_code == 500

    assert (await client.patch("/api/cron/jobs/j1", json={"name": "x"})).status_code == 500
    assert (await client.delete("/api/cron/jobs/j1")).status_code == 500
    assert (await client.post("/api/cron/jobs/j1/enable")).status_code == 500
    assert (await client.post("/api/cron/jobs/j1/disable")).status_code == 500
    assert (await client.post("/api/cron/jobs/j1/run")).status_code == 500
