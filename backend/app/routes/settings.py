"""
API routes for application settings.

Provides CRUD endpoints for the key-value settings table.
Supports migrating settings from frontend localStorage to the database.
"""

import logging
import time
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from ..db.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/settings", tags=["settings"])


# =============================================================================
# Request / Response Models
# =============================================================================

class SettingValue(BaseModel):
    """Request body for updating a single setting."""
    value: str


class BatchSettingsUpdate(BaseModel):
    """Request body for batch-updating settings."""
    settings: dict[str, str]


class SettingResponse(BaseModel):
    """Single setting response."""
    key: str
    value: str
    updated_at: int


# =============================================================================
# Routes
# =============================================================================

@router.get("")
async def get_all_settings() -> dict[str, str]:
    """
    Get all settings as a key-value dictionary.
    
    Returns a flat dict of {key: value} for easy frontend consumption.
    """
    db = await get_db()
    try:
        db.row_factory = lambda cursor, row: dict(
            zip([col[0] for col in cursor.description], row)
        )
        async with db.execute("SELECT key, value FROM settings") as cursor:
            rows = await cursor.fetchall()
    finally:
        await db.close()

    return {row["key"]: row["value"] for row in rows}


@router.get("/{key}", response_model=SettingResponse)
async def get_setting(key: str):
    """
    Get a single setting by key.
    
    Returns 404 if the key doesn't exist.
    """
    db = await get_db()
    try:
        db.row_factory = lambda cursor, row: dict(
            zip([col[0] for col in cursor.description], row)
        )
        async with db.execute(
            "SELECT key, value, updated_at FROM settings WHERE key = ?",
            (key,),
        ) as cursor:
            row = await cursor.fetchone()
    finally:
        await db.close()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Setting not found: {key}",
        )

    return SettingResponse(**row)


@router.put("/batch")
async def update_settings_batch(body: BatchSettingsUpdate) -> dict[str, str]:
    """
    Update multiple settings at once.
    
    Creates settings that don't exist, updates those that do.
    Returns the full settings dict after update.
    """
    if not body.settings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No settings provided",
        )

    now = int(time.time() * 1000)
    db = await get_db()
    try:
        for key, value in body.settings.items():
            await db.execute(
                """
                INSERT INTO settings (key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
                """,
                (key, value, now, value, now),
            )
        await db.commit()
    finally:
        await db.close()

    logger.info(f"Batch updated {len(body.settings)} settings")
    # Return all settings after update
    return await get_all_settings()


@router.put("/{key}", response_model=SettingResponse)
async def update_setting(key: str, body: SettingValue):
    """
    Create or update a single setting.
    
    Uses upsert semantics (creates if missing, updates if exists).
    """
    now = int(time.time() * 1000)
    db = await get_db()
    try:
        await db.execute(
            """
            INSERT INTO settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
            """,
            (key, body.value, now, body.value, now),
        )
        await db.commit()
    finally:
        await db.close()

    logger.info(f"Setting updated: {key}")
    return SettingResponse(key=key, value=body.value, updated_at=now)


@router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_setting(key: str):
    """
    Delete a setting by key.
    
    Returns 404 if the key doesn't exist.
    """
    db = await get_db()
    try:
        cursor = await db.execute(
            "DELETE FROM settings WHERE key = ?",
            (key,),
        )
        await db.commit()
        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Setting not found: {key}",
            )
    finally:
        await db.close()

    logger.info(f"Setting deleted: {key}")
