"""
Gateway status endpoint.
Quick check for Gateway connection status via ConnectionManager.
"""

from fastapi import APIRouter

from ..services.connections import get_connection_manager

router = APIRouter()


@router.get("/status")
async def gateway_status():
    """Get Gateway connection status."""
    manager = await get_connection_manager()
    conn = manager.get_default_openclaw()

    if not conn:
        return {"connected": False, "uri": None}

    return {
        "connected": conn.is_connected(),
        "uri": conn.uri,
    }


@router.get("/full-status")
async def gateway_full_status():
    """Get full Gateway status including OpenClaw info."""
    manager = await get_connection_manager()
    conn = manager.get_default_openclaw()

    if not conn:
        return {"connected": False, "uri": None, "openclaw": {}}

    status = await conn.get_status()

    return {
        "connected": conn.is_connected(),
        "uri": conn.uri,
        "openclaw": status,
    }
