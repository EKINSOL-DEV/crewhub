"""Stand-up meetings API routes."""

import logging
import time
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.db.database import get_db
from app.db.models import generate_id
from app.routes.sse import broadcast

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Models ──────────────────────────────────────────────────────


class StandupCreate(BaseModel):
    title: str = "Daily Standup"
    participants: list[str]  # agent IDs


class StandupEntryCreate(BaseModel):
    agent_key: str
    yesterday: str = ""
    today: str = ""
    blockers: str = ""


# ── Routes ──────────────────────────────────────────────────────


@router.post("", responses={400: {"description": "Bad request"}})
async def create_standup(body: StandupCreate):
    """Create a new standup meeting."""
    if not body.participants:
        raise HTTPException(400, "At least one participant required")

    standup_id = generate_id()
    now = int(time.time() * 1000)

    async with get_db() as db:
        await db.execute(
            "INSERT INTO standups (id, title, created_by, created_at) VALUES (?, ?, ?, ?)",
            (standup_id, body.title, "user", now),
        )
        # Store participants as JSON in a simple way - we'll create entries when they submit
        await db.commit()

        await broadcast("standup-created", {"id": standup_id, "title": body.title})

        return {
            "id": standup_id,
            "title": body.title,
            "created_at": now,
            "participants": body.participants,
        }


@router.post("/{standup_id}/entries", responses={404: {"description": "Not found"}})
async def submit_entry(standup_id: str, body: StandupEntryCreate):
    """Submit a standup entry for an agent."""
    async with get_db() as db:
        # Verify standup exists
        async with db.execute("SELECT id FROM standups WHERE id = ?", (standup_id,)) as cur:
            if not await cur.fetchone():
                raise HTTPException(404, "Standup not found")

        entry_id = generate_id()
        now = int(time.time() * 1000)

        # Upsert: delete existing entry for this agent in this standup, then insert
        await db.execute(
            "DELETE FROM standup_entries WHERE standup_id = ? AND agent_key = ?", (standup_id, body.agent_key)
        )
        await db.execute(
            """INSERT INTO standup_entries (id, standup_id, agent_key, yesterday, today, blockers, submitted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (entry_id, standup_id, body.agent_key, body.yesterday, body.today, body.blockers, now),
        )
        await db.commit()

        await broadcast("standup-entry", {"standup_id": standup_id, "agent_key": body.agent_key})

        return {
            "id": entry_id,
            "standup_id": standup_id,
            "agent_key": body.agent_key,
            "submitted_at": now,
        }


@router.get("")
async def list_standups(days: Annotated[int, Query(7, ge=1, le=90)]):
    """List recent standups."""
    cutoff = int((time.time() - days * 86400) * 1000)

    async with get_db() as db:
        db.row_factory = lambda cursor, row: dict(zip([col[0] for col in cursor.description], row))

        async with db.execute(
            """SELECT s.id, s.title, s.created_by, s.created_at,
                      COUNT(e.id) as entry_count
               FROM standups s
               LEFT JOIN standup_entries e ON e.standup_id = s.id
               WHERE s.created_at >= ?
               GROUP BY s.id
               ORDER BY s.created_at DESC""",
            (cutoff,),
        ) as cur:
            rows = await cur.fetchall()

        return {"standups": rows}


@router.get("/{standup_id}", responses={404: {"description": "Not found"}})
async def get_standup(standup_id: str):
    """Get a standup with all entries."""
    async with get_db() as db:
        db.row_factory = lambda cursor, row: dict(zip([col[0] for col in cursor.description], row))

        async with db.execute("SELECT * FROM standups WHERE id = ?", (standup_id,)) as cur:
            standup = await cur.fetchone()

        if not standup:
            raise HTTPException(404, "Standup not found")

        async with db.execute(
            """SELECT e.*, a.name as agent_name, a.icon as agent_icon, a.color as agent_color
               FROM standup_entries e
               LEFT JOIN agents a ON a.id = e.agent_key
               WHERE e.standup_id = ?
               ORDER BY e.submitted_at ASC""",
            (standup_id,),
        ) as cur:
            entries = await cur.fetchall()

        standup["entries"] = entries
        return standup
