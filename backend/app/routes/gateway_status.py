"""
Gateway status endpoint.
Quick check for Gateway connection status.
"""
from fastapi import APIRouter

from ..services.gateway import get_gateway

router = APIRouter(tags=["Gateway"])


@router.get("/status")
async def gateway_status():
    """Get Gateway connection status."""
    gateway = await get_gateway()
    
    return {
        "connected": gateway.connected,
        "uri": gateway.uri,
    }


@router.get("/full-status")
async def gateway_full_status():
    """Get full Gateway status including OpenClaw info."""
    gateway = await get_gateway()
    status = await gateway.get_status()
    
    return {
        "connected": gateway.connected,
        "uri": gateway.uri,
        "openclaw": status,
    }
