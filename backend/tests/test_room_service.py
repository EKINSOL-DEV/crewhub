import pytest
from fastapi import HTTPException

from app.db.database import get_db
from app.db.models import ProjectCreate, RoomCreate, RoomUpdate
from app.services import project_service, room_service


@pytest.fixture(autouse=True)
async def clean_room_tables():
    async with get_db() as db:
        await db.execute("DELETE FROM session_room_assignments")
        await db.execute("DELETE FROM room_assignment_rules")
        await db.execute("DELETE FROM rooms WHERE id != 'headquarters'")
        await db.execute("UPDATE rooms SET is_hq = 1, project_id = NULL WHERE id = 'headquarters'")
        await db.execute("DELETE FROM projects")
        await db.commit()


@pytest.mark.asyncio
async def test_row_to_room_defaults():
    row = {
        "id": "r1",
        "name": "R1",
        "created_at": 1,
        "updated_at": 2,
    }
    room = room_service._row_to_room(row)
    assert room.sort_order == 0
    assert room.speed_multiplier == 1.0
    assert room.floor_style == "default"
    assert room.wall_style == "default"
    assert room.is_hq is False


@pytest.mark.asyncio
async def test_create_get_list_update_room_happy_path():
    created = await room_service.create_room(RoomCreate(id="lab", name="Lab", icon="🧪", color="#123", sort_order=5))
    assert created.id == "lab"

    listed = await room_service.list_rooms()
    assert any(r.id == "lab" for r in listed)

    fetched = await room_service.get_room("lab")
    assert fetched.name == "Lab"

    updated = await room_service.update_room("lab", RoomUpdate(name="Lab 2", speed_multiplier=1.5, wall_style="brick"))
    assert updated.name == "Lab 2"
    assert updated.speed_multiplier == 1.5
    assert updated.wall_style == "brick"


@pytest.mark.asyncio
async def test_room_not_found_and_duplicate_errors():
    with pytest.raises(HTTPException) as e1:
        await room_service.get_room("missing")
    assert e1.value.status_code == 404

    await room_service.create_room(RoomCreate(id="dup", name="Dup"))
    with pytest.raises(HTTPException) as e2:
        await room_service.create_room(RoomCreate(id="dup", name="Dup again"))
    assert e2.value.status_code == 400

    with pytest.raises(HTTPException) as e3:
        await room_service.update_room("missing", RoomUpdate(name="x"))
    assert e3.value.status_code == 404


@pytest.mark.asyncio
async def test_assign_and_clear_project_from_room():
    await room_service.create_room(RoomCreate(id="proj-room", name="PR"))
    p = await project_service.create_project(ProjectCreate(name="Proj"))

    assigned = await room_service.assign_project_to_room("proj-room", p.id)
    assert assigned.project_id == p.id
    assert assigned.project_name == "Proj"

    cleared = await room_service.clear_project_from_room("proj-room")
    assert cleared.project_id is None

    with pytest.raises(HTTPException) as e1:
        await room_service.assign_project_to_room("missing", p.id)
    assert e1.value.status_code == 404

    with pytest.raises(HTTPException) as e2:
        await room_service.assign_project_to_room("proj-room", "missing-project")
    assert e2.value.status_code == 404

    with pytest.raises(HTTPException) as e3:
        await room_service.clear_project_from_room("missing")
    assert e3.value.status_code == 404


@pytest.mark.asyncio
async def test_set_room_as_hq_and_reorder_rooms():
    await room_service.create_room(RoomCreate(id="r-a", name="A"))
    await room_service.create_room(RoomCreate(id="r-b", name="B"))

    hq = await room_service.set_room_as_hq("r-a")
    assert hq.is_hq is True

    all_rooms = await room_service.list_rooms()
    hq_count = sum(1 for r in all_rooms if r.is_hq)
    assert hq_count == 1

    result = await room_service.reorder_rooms(["r-b", "r-a"])
    assert result["success"] is True

    all_rooms = await room_service.list_rooms()
    by_id = {r.id: r for r in all_rooms}
    assert by_id["r-b"].sort_order == 0
    assert by_id["r-a"].sort_order == 1

    with pytest.raises(HTTPException) as e:
        await room_service.set_room_as_hq("missing")
    assert e.value.status_code == 404


@pytest.mark.asyncio
async def test_delete_room_guards_and_cascade_cleanup():
    await room_service.create_room(RoomCreate(id="del-room", name="Delete me"))

    async with get_db() as db:
        await db.execute(
            "INSERT INTO session_room_assignments (session_key, room_id, assigned_at) VALUES (?, ?, ?)",
            ("agent:x:main", "del-room", 1),
        )
        await db.execute(
            "INSERT INTO room_assignment_rules (id, room_id, rule_type, rule_value, priority, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("rule-del", "del-room", "session_type", "dev", 10, 1),
        )
        await db.commit()

    result = await room_service.delete_room("del-room")
    assert result == {"success": True, "deleted": "del-room"}

    async with get_db() as db:
        async with db.execute("SELECT COUNT(*) AS c FROM session_room_assignments WHERE room_id = 'del-room'") as cur:
            c1 = await cur.fetchone()
        async with db.execute("SELECT COUNT(*) AS c FROM room_assignment_rules WHERE room_id = 'del-room'") as cur:
            c2 = await cur.fetchone()
    assert c1["c"] == 0
    assert c2["c"] == 0

    with pytest.raises(HTTPException) as e1:
        await room_service.delete_room("headquarters")
    assert e1.value.status_code == 403

    with pytest.raises(HTTPException) as e2:
        await room_service.delete_room("missing")
    assert e2.value.status_code == 404
