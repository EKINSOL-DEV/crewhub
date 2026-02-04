"""
API routes for runtime discovery.

Provides endpoints to scan for local agent runtimes
and test connectivity to specific endpoints.
"""

import logging
import time
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from ..services.discovery import get_discovery_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/discovery", tags=["discovery"])


# =============================================================================
# Request / Response Models
# =============================================================================

class ScanRequest(BaseModel):
    """Request body for discovery scan."""
    mode: str = "local"  # "local" or future "lan"


class DiscoveryCandidateResponse(BaseModel):
    """Single discovery candidate."""
    runtime_type: str
    discovery_method: str
    target: dict = {}
    auth: dict = {}
    confidence: str = "low"
    status: str = "not_found"
    evidence: list[str] = []
    metadata: dict = {}


class ScanResponse(BaseModel):
    """Response for discovery scan."""
    candidates: list[DiscoveryCandidateResponse]
    scan_duration_ms: int


class TestConnectionRequest(BaseModel):
    """Request body for testing a specific connection."""
    type: str  # openclaw | claude_code | codex_cli
    url: str
    token: Optional[str] = None


class TestConnectionResponse(BaseModel):
    """Response for connection test."""
    reachable: bool
    sessions: Optional[int] = None
    error: Optional[str] = None


# =============================================================================
# Routes
# =============================================================================

@router.post("/scan", response_model=ScanResponse)
async def scan_for_runtimes(body: ScanRequest):
    """
    Scan for local agent runtimes.
    
    Probes for OpenClaw (WebSocket), Claude Code (CLI),
    and Codex CLI installations.
    """
    valid_modes = {"local"}  # Future: "lan"
    if body.mode not in valid_modes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid scan mode: {body.mode}. Must be one of: {valid_modes}",
        )

    service = get_discovery_service()
    start = time.monotonic()

    try:
        candidates = await service.scan(mode=body.mode)
    except Exception as e:
        logger.error(f"Discovery scan failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scan failed: {str(e)}",
        )

    duration_ms = int((time.monotonic() - start) * 1000)

    return ScanResponse(
        candidates=[
            DiscoveryCandidateResponse(**c.to_dict()) for c in candidates
        ],
        scan_duration_ms=duration_ms,
    )


@router.post("/test", response_model=TestConnectionResponse)
async def test_connection(body: TestConnectionRequest):
    """
    Test connectivity to a specific runtime endpoint.
    
    Currently supports testing OpenClaw WebSocket connections.
    """
    service = get_discovery_service()

    try:
        result = await service.test_connection(
            runtime_type=body.type,
            url=body.url,
            token=body.token,
        )
    except Exception as e:
        logger.error(f"Connection test failed: {e}")
        return TestConnectionResponse(
            reachable=False,
            error=str(e),
        )

    return TestConnectionResponse(
        reachable=result.get("reachable", False),
        sessions=result.get("sessions"),
        error=result.get("error"),
    )
