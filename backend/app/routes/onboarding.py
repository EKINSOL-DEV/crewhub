"""
API routes for onboarding status.

Provides an endpoint to check whether onboarding has been completed
and whether the system has active connections.
"""

import json
import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from ..db.database import get_db
from ..services.connections import get_connection_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/onboarding", tags=["onboarding"])


# =============================================================================
# Response Models
# =============================================================================

class OnboardingStatusResponse(BaseModel):
    """Onboarding completion status."""
    completed: bool
    connections_count: int
    has_active_connection: bool


# =============================================================================
# Routes
# =============================================================================

@router.get("/status", response_model=OnboardingStatusResponse)
async def get_onboarding_status():
    """
    Check onboarding completion status.
    
    Onboarding is considered complete if:
    - The 'onboardingCompleted' setting is 'true', OR
    - There is at least one active (connected) connection.
    """
    # Check setting
    completed_setting = False
    db = await get_db()
    try:
        db.row_factory = lambda cursor, row: dict(
            zip([col[0] for col in cursor.description], row)
        )
        async with db.execute(
            "SELECT value FROM settings WHERE key = 'onboardingCompleted'"
        ) as cursor:
            row = await cursor.fetchone()
            if row and row["value"].lower() in ("true", "1", "yes"):
                completed_setting = True
    finally:
        await db.close()

    # Check connections
    connections_count = 0
    has_active = False

    db = await get_db()
    try:
        async with db.execute(
            "SELECT COUNT(*) FROM connections WHERE enabled = 1"
        ) as cursor:
            row = await cursor.fetchone()
            connections_count = row[0] if row else 0
    finally:
        await db.close()

    # Check runtime connection status
    manager = await get_connection_manager()
    for conn_id, conn in manager._connections.items():
        if conn.is_connected():
            has_active = True
            break

    return OnboardingStatusResponse(
        completed=completed_setting or has_active,
        connections_count=connections_count,
        has_active_connection=has_active,
    )
