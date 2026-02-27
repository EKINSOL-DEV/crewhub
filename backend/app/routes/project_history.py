"""Project History API routes."""

import json
import logging
from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Query

from app.db.database import get_db
from app.db.task_models import HistoryEventResponse, HistoryListResponse

logger = logging.getLogger(__name__)
router = APIRouter()


async def _get_display_name(db, session_key: Optional[str]) -> Optional[str]:
    """Get display name for a session key."""
    if not session_key:
        return None

    async with db.execute(
        "SELECT display_name FROM session_display_names WHERE session_key = ?", (session_key,)
    ) as cursor:
        row = await cursor.fetchone()
        if row:
            return row[0] if isinstance(row, tuple) else row["display_name"]

    # Fallback: extract name from session key (agent:dev:main -> dev)
    parts = session_key.split(":")
    if len(parts) >= 2:
        return parts[1].capitalize()
    return session_key


def _row_to_event(row: dict, display_name: Optional[str] = None) -> HistoryEventResponse:
    """Convert database row to HistoryEventResponse."""
    payload = None
    if row.get("payload_json"):
        try:
            payload = json.loads(row["payload_json"])
        except json.JSONDecodeError:
            payload = None

    return HistoryEventResponse(
        id=row["id"],
        project_id=row["project_id"],
        task_id=row.get("task_id"),
        event_type=row["event_type"],
        actor_session_key=row.get("actor_session_key"),
        actor_display_name=display_name,
        payload=payload,
        created_at=row["created_at"],
    )


@router.get(
    "/{project_id}/history",
    response_model=HistoryListResponse,
    responses={404: {"description": "Not found"}, 500: {"description": "Internal server error"}},
)
async def get_project_history(
    project_id: str,
    event_type: Annotated[Optional[str], Query(description="Filter by event type")] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    """Get project activity history."""
    try:
        async with get_db() as db:
            # Verify project exists
            async with db.execute("SELECT id FROM projects WHERE id = ?", (project_id,)) as cursor:
                if not await cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Project not found")

            # Build query
            query = "SELECT * FROM project_history WHERE project_id = ?"
            params = [project_id]

            if event_type:
                query += " AND event_type = ?"
                params.append(event_type)

            # Get total count
            count_query = query.replace("SELECT *", "SELECT COUNT(*) as cnt")
            async with db.execute(count_query, params) as cursor:
                result = await cursor.fetchone()
                total = result["cnt"] if isinstance(result, dict) else result[0]

            # Add ordering and pagination
            query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])

            async with db.execute(query, params) as cursor:
                rows = await cursor.fetchall()

            # Get display names
            events = []
            for row in rows:
                display_name = await _get_display_name(db, row.get("actor_session_key"))
                events.append(_row_to_event(row, display_name))

            return HistoryListResponse(events=events, total=total)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get project history for {project_id}: {e}")  # NOSONAR
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{project_id}/history/task/{task_id}",
    response_model=HistoryListResponse,
    responses={500: {"description": "Internal server error"}},
)
async def get_task_history(
    project_id: str,
    task_id: str,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
):
    """Get history for a specific task."""
    try:
        async with get_db() as db:
            # Build query
            query = (
                "SELECT * FROM project_history WHERE project_id = ? AND task_id = ? ORDER BY created_at DESC LIMIT ?"
            )
            params = [project_id, task_id, limit]

            async with db.execute(query, params) as cursor:
                rows = await cursor.fetchall()

            # Get display names
            events = []
            for row in rows:
                display_name = await _get_display_name(db, row.get("actor_session_key"))
                events.append(_row_to_event(row, display_name))

            return HistoryListResponse(events=events, total=len(events))
    except Exception as e:
        logger.error(f"Failed to get task history for {task_id}: {e}")  # NOSONAR
        raise HTTPException(status_code=500, detail=str(e))
