"""
API routes for managing connections.

Provides CRUD operations for connection configurations stored in the database.
"""

import json
import logging
import time
import uuid
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from ..db.database import get_db
from ..db.models import ConnectionCreate, ConnectionUpdate
from ..services.connections import (
    ConnectionManager,
    get_connection_manager,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/connections", tags=["connections"])


# ============================================================================
# Response Models
# ============================================================================


class ConnectionResponse(BaseModel):
    """Connection with runtime status."""

    id: str
    name: str
    type: str
    config: dict
    enabled: bool
    status: str  # Runtime connection status
    error: Optional[str] = None
    created_at: int
    updated_at: int


class ConnectionListResponse(BaseModel):
    """List of connections."""

    connections: list[ConnectionResponse]
    total: int


class ConnectionHealthResponse(BaseModel):
    """Health status for a connection."""

    id: str
    name: str
    type: str
    status: str
    healthy: bool
    error: Optional[str] = None


# ============================================================================
# Database Operations
# ============================================================================


async def _get_all_connections() -> list[dict[str, Any]]:
    """Get all connections from database."""
    async with get_db() as db:
        async with db.execute("SELECT * FROM connections ORDER BY created_at") as cursor:
            rows = await cursor.fetchall()

    # Parse JSON config
    for row in rows:
        if isinstance(row.get("config"), str):
            try:
                row["config"] = json.loads(row["config"])
            except json.JSONDecodeError:
                row["config"] = {}

    return rows


async def _get_connection_by_id(connection_id: str) -> Optional[dict[str, Any]]:
    """Get a single connection by ID."""
    async with get_db() as db:
        async with db.execute("SELECT * FROM connections WHERE id = ?", (connection_id,)) as cursor:
            row = await cursor.fetchone()

    if row and isinstance(row.get("config"), str):
        try:
            row["config"] = json.loads(row["config"])
        except json.JSONDecodeError:
            row["config"] = {}

    return row


async def _create_connection(data: ConnectionCreate) -> dict[str, Any]:
    """Create a new connection in database."""
    now = int(time.time() * 1000)
    connection_id = data.id or str(uuid.uuid4())

    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO connections (id, name, type, config, enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                connection_id,
                data.name,
                data.type,
                json.dumps(data.config),
                data.enabled,
                now,
                now,
            ),
        )
        await db.commit()

    return {
        "id": connection_id,
        "name": data.name,
        "type": data.type,
        "config": data.config,
        "enabled": data.enabled,
        "created_at": now,
        "updated_at": now,
    }


async def _update_connection(
    connection_id: str,
    data: ConnectionUpdate,
) -> Optional[dict[str, Any]]:
    """Update a connection in database."""
    existing = await _get_connection_by_id(connection_id)
    if not existing:
        return None

    now = int(time.time() * 1000)

    # Build update fields
    updates = {"updated_at": now}
    if data.name is not None:
        updates["name"] = data.name
    if data.config is not None:
        updates["config"] = json.dumps(data.config)
    if data.enabled is not None:
        updates["enabled"] = data.enabled

    set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
    values = list(updates.values()) + [connection_id]

    async with get_db() as db:
        await db.execute(f"UPDATE connections SET {set_clause} WHERE id = ?", values)
        await db.commit()

    return await _get_connection_by_id(connection_id)


async def _delete_connection(connection_id: str) -> bool:
    """Delete a connection from database."""
    async with get_db() as db:
        cursor = await db.execute("DELETE FROM connections WHERE id = ?", (connection_id,))
        await db.commit()
        return cursor.rowcount > 0


# ============================================================================
# Helper Functions
# ============================================================================


def _get_runtime_status(connection_id: str, manager: ConnectionManager) -> tuple[str, Optional[str]]:
    """Get runtime status and error for a connection."""
    conn = manager.get_connection(connection_id)
    if conn:
        return conn.status.value, conn.error_message
    return "not_loaded", None


def _db_to_response(
    db_conn: dict[str, Any],
    manager: ConnectionManager,
) -> ConnectionResponse:
    """Convert database row to response with runtime status."""
    status, error = _get_runtime_status(db_conn["id"], manager)
    return ConnectionResponse(
        id=db_conn["id"],
        name=db_conn["name"],
        type=db_conn["type"],
        config=db_conn["config"],
        enabled=bool(db_conn["enabled"]),
        status=status,
        error=error,
        created_at=db_conn["created_at"],
        updated_at=db_conn["updated_at"],
    )


# ============================================================================
# Routes
# ============================================================================


@router.get("/claude-code/detect")
async def detect_claude_code():
    """Detect if Claude Code CLI is available locally."""
    import os
    import shutil
    from pathlib import Path

    cli_path = shutil.which("claude")
    claude_dir = Path.home() / ".claude"
    projects_dir = claude_dir / "projects"
    projects_exists = projects_dir.exists()
    claude_dir_exists = claude_dir.exists()
    session_count = 0
    if projects_exists:
        for proj in projects_dir.iterdir():
            if proj.is_dir():
                session_count += sum(1 for f in os.listdir(proj) if f.endswith(".jsonl"))
    # Consider Claude Code "found" if either:
    # - the CLI binary is available (native install), OR
    # - ~/.claude directory is mounted/present (Docker with volume mount)
    found = cli_path is not None or claude_dir_exists
    return {
        "found": found,
        "cli_path": cli_path,
        "projects_dir_exists": projects_exists,
        "claude_dir_exists": claude_dir_exists,
        "session_count": session_count,
    }


@router.get("", response_model=ConnectionListResponse)
async def list_connections():
    """
    List all configured connections.

    Returns connections from database with their runtime status.
    """
    manager = await get_connection_manager()
    db_connections = await _get_all_connections()

    connections = [_db_to_response(conn, manager) for conn in db_connections]

    return ConnectionListResponse(
        connections=connections,
        total=len(connections),
    )


@router.get("/{connection_id}", response_model=ConnectionResponse)
async def get_connection(connection_id: str):
    """
    Get a specific connection by ID.
    """
    db_conn = await _get_connection_by_id(connection_id)
    if not db_conn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection not found: {connection_id}",
        )

    manager = await get_connection_manager()
    return _db_to_response(db_conn, manager)


@router.post("", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
async def create_connection(data: ConnectionCreate):
    """
    Create a new connection.

    Valid types: openclaw, claude_code, codex
    """
    # Validate type
    valid_types = {"openclaw", "claude_code", "codex"}
    if data.type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid connection type: {data.type}. Must be one of: {valid_types}",
        )

    # Check for duplicate ID
    if data.id:
        existing = await _get_connection_by_id(data.id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Connection already exists: {data.id}",
            )

    # Create in database
    db_conn = await _create_connection(data)

    # Add to manager if enabled
    manager = await get_connection_manager()
    if data.enabled:
        try:
            await manager.add_connection(
                connection_id=db_conn["id"],
                connection_type=db_conn["type"],
                config=db_conn["config"],
                name=db_conn["name"],
                auto_connect=True,
            )
        except Exception as e:
            logger.error(f"Failed to add connection to manager: {e}")
            # Connection is created in DB but may not be connected

    return _db_to_response(db_conn, manager)


async def _safe_add_connection(manager, db_conn: dict[str, Any], error_prefix: str) -> None:
    """Attempt to add/re-add a connection while logging failures."""
    try:
        await manager.add_connection(
            connection_id=db_conn["id"],
            connection_type=db_conn["type"],
            config=db_conn["config"],
            name=db_conn["name"],
            auto_connect=True,
        )
    except Exception as e:
        logger.error(f"{error_prefix}: {e}")


async def _apply_enabled_state_change(manager, connection_id: str, db_conn: dict[str, Any], enabled: bool) -> None:
    """Handle explicit enabled/disabled updates."""
    existing_conn = manager.get_connection(connection_id)
    if enabled and not existing_conn:
        await _safe_add_connection(manager, db_conn, "Failed to enable connection")
        return
    if not enabled and existing_conn:
        await manager.remove_connection(connection_id)


async def _apply_config_change(manager, connection_id: str, db_conn: dict[str, Any]) -> None:
    """Reconnect a live connection after config updates."""
    existing_conn = manager.get_connection(connection_id)
    if not (existing_conn and existing_conn.is_connected()):
        return
    await manager.remove_connection(connection_id)
    await _safe_add_connection(manager, db_conn, "Failed to reconnect with new config")


async def _apply_connection_state_change(manager, connection_id: str, db_conn: dict, data) -> None:
    """Apply enable/disable or config-change side-effects to the connection manager."""
    if data.enabled is not None:
        await _apply_enabled_state_change(manager, connection_id, db_conn, data.enabled)
        return
    if data.config is not None:
        await _apply_config_change(manager, connection_id, db_conn)


@router.patch("/{connection_id}", response_model=ConnectionResponse)
async def update_connection(connection_id: str, data: ConnectionUpdate):
    """
    Update a connection's configuration.

    Note: Changing config may require reconnection.
    """
    db_conn = await _update_connection(connection_id, data)
    if not db_conn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection not found: {connection_id}",
        )

    manager = await get_connection_manager()

    await _apply_connection_state_change(manager, connection_id, db_conn, data)
    return _db_to_response(db_conn, manager)


@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(connection_id: str):
    """
    Delete a connection.

    Disconnects if currently connected.
    """
    # Remove from manager first
    manager = await get_connection_manager()
    await manager.remove_connection(connection_id)

    # Delete from database
    deleted = await _delete_connection(connection_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection not found: {connection_id}",
        )


@router.post("/{connection_id}/connect")
async def connect_connection(connection_id: str):
    """
    Manually connect a connection.
    """
    db_conn = await _get_connection_by_id(connection_id)
    if not db_conn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection not found: {connection_id}",
        )

    if not db_conn["enabled"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connection is disabled",
        )

    manager = await get_connection_manager()
    conn = manager.get_connection(connection_id)

    # Add if not exists
    if not conn:
        try:
            conn = await manager.add_connection(
                connection_id=db_conn["id"],
                connection_type=db_conn["type"],
                config=db_conn["config"],
                name=db_conn["name"],
                auto_connect=False,
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to initialize connection: {e}",
            )

    # Connect
    success = await conn.connect()

    return {
        "id": connection_id,
        "connected": success,
        "status": conn.status.value,
        "error": conn.error_message,
    }


@router.post("/{connection_id}/disconnect")
async def disconnect_connection(connection_id: str):
    """
    Manually disconnect a connection.
    """
    manager = await get_connection_manager()
    conn = manager.get_connection(connection_id)

    if not conn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection not loaded: {connection_id}",
        )

    await conn.disconnect()

    return {
        "id": connection_id,
        "status": conn.status.value,
    }


@router.get("/{connection_id}/health", response_model=ConnectionHealthResponse)
async def get_connection_health(connection_id: str):
    """
    Get health status for a connection.
    """
    db_conn = await _get_connection_by_id(connection_id)
    if not db_conn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection not found: {connection_id}",
        )

    manager = await get_connection_manager()
    conn = manager.get_connection(connection_id)

    if not conn:
        return ConnectionHealthResponse(
            id=connection_id,
            name=db_conn["name"],
            type=db_conn["type"],
            status="not_loaded",
            healthy=False,
            error="Connection not loaded in manager",
        )

    healthy = await conn.health_check()

    return ConnectionHealthResponse(
        id=connection_id,
        name=db_conn["name"],
        type=db_conn["type"],
        status=conn.status.value,
        healthy=healthy,
        error=conn.error_message,
    )


@router.get("/{connection_id}/device-status")
async def get_connection_device_status(connection_id: str):
    """
    Get device pairing status for an OpenClaw connection.

    Returns the device identity info (ID, name, pairing state) that the
    backend uses for secure gateway auth. Useful for diagnosing auth issues
    and monitoring the pairing state.
    """
    db_conn = await _get_connection_by_id(connection_id)
    if not db_conn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection not found: {connection_id}",
        )

    if db_conn.get("type") != "openclaw":
        return {
            "connection_id": connection_id,
            "supported": False,
            "message": "Device pairing is only available for OpenClaw connections",
        }

    try:
        from ..services.connections.device_identity import DeviceIdentityManager

        identity_manager = DeviceIdentityManager()
        identity = await identity_manager.get_device_identity(connection_id)

        if not identity:
            return {
                "connection_id": connection_id,
                "supported": True,
                "paired": False,
                "device_id": None,
                "device_name": None,
                "message": "No device identity found — will be created on next connect",
            }

        return {
            "connection_id": connection_id,
            "supported": True,
            "paired": identity.device_token is not None,
            "device_id": identity.device_id,
            "device_name": identity.device_name,
            "platform": identity.platform,
            "message": (
                "Device is paired and will use device-token auth"
                if identity.device_token
                else "Device identity exists but not yet paired (token missing)"
            ),
        }

    except Exception as e:
        logger.error(f"Error fetching device status for {connection_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device status: {e}",
        )


@router.post("/{connection_id}/pair")
async def trigger_device_pairing(connection_id: str):
    """
    Trigger a device re-pairing for an OpenClaw connection.

    Clears the stored device token (if any) so the next reconnect will
    perform a fresh pairing flow. Then triggers a reconnect.
    """
    db_conn = await _get_connection_by_id(connection_id)
    if not db_conn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection not found: {connection_id}",
        )

    if db_conn.get("type") != "openclaw":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Device pairing is only available for OpenClaw connections",
        )

    try:
        from ..services.connections.device_identity import DeviceIdentityManager

        identity_manager = DeviceIdentityManager()
        identity = await identity_manager.get_device_identity(connection_id)

        if identity:
            await identity_manager.clear_device_token(identity.device_id)
            logger.info(f"Cleared device token for {connection_id} — re-pairing on reconnect")  # NOSONAR

        # Trigger reconnect so pairing happens immediately
        manager = await get_connection_manager()
        conn = manager.get_connection(connection_id)
        if conn:
            await conn.disconnect()
            import asyncio as _asyncio

            _ = _asyncio.create_task(conn.connect())

        return {
            "connection_id": connection_id,
            "status": "re-pairing triggered",
            "message": (
                "Device token cleared. Backend will re-pair on next connect. Check backend logs for pairing result."
            ),
        }

    except Exception as e:
        logger.error(f"Error triggering re-pairing for {connection_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger re-pairing: {e}",
        )


@router.get("/{connection_id}/sessions")
async def get_connection_sessions(connection_id: str):
    """
    Get sessions from a specific connection.
    """
    manager = await get_connection_manager()
    conn = manager.get_connection(connection_id)

    if not conn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection not loaded: {connection_id}",
        )

    if not conn.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Connection not connected: {connection_id}",
        )

    sessions = await conn.get_sessions()

    return {
        "connection_id": connection_id,
        "sessions": [s.to_dict() for s in sessions],
        "total": len(sessions),
    }
