"""
API routes for runtime discovery.

Provides endpoints to scan for local agent runtimes
and test connectivity to specific endpoints.
"""

import hashlib
import logging
import time
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel

from ..services.discovery import get_discovery_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/discovery", tags=["discovery"])

DOCS_BY_TOPIC: dict[str, str] = {
    "auth": """# Auth

CrewHub API uses `X-API-Key` for all agent calls.

## Required headers
- `X-API-Key: <key>`
- `Content-Type: application/json` for write operations

## Scope model (planned)
- `discovery.read`: manifest + docs endpoints
- `self.write`: identify agent, update display name, set room
- `chat.write`: send messages and task updates
- `modding.write`: import/export blueprints and room config

## Safety rules
- Never log full API keys.
- Use dedicated keys per agent identity.
- Rotate keys when leaked or copied into logs.
""",
    "rooms": """# Rooms

Rooms are lightweight collaboration spaces.

## Core endpoints
- `GET /api/rooms` list rooms
- `GET /api/rooms/{id}` room details
- `POST /api/rooms` create room
- `PATCH /api/rooms/{id}` update room/project linkage

## Agent expectations
- Keep one primary room per task context.
- Use assignment rules for deterministic routing.
- Treat HQ as coordination room, not a work queue.
""",
    "chat": """# Chat

Chat routes deliver agent↔human messages in CrewHub.

## Common flow
1. Read room/session context.
2. Send message with explicit session key and room id.
3. Persist/stream updates to UI and logs.

## Reliability tips
- Include idempotency key when retries are possible.
- Prefer short structured payloads over large blobs.
- Return actionable errors (what failed + how to recover).
""",
    "modding": """# Modding

Modding covers blueprint import/export and world customization.

## Core endpoints
- `GET /api/blueprints` list
- `POST /api/blueprints/import` import package
- `POST /api/blueprints/export` export package

## Guardrails
- Validate schema before import.
- Reject files over configured size limits.
- Keep backups before destructive edits.
""",
    "sse": """# SSE

Server-Sent Events powers live state updates.

## Endpoint
- `GET /api/events`

## Event contract
- Each event should include stable `event` type and JSON `data`.
- Clients must reconnect with exponential backoff + jitter.
- Clients should dedupe by `event_id` when available.

## Reconnect strategy
- On disconnect: backoff (1s → 60s max), then reconnect.
- On reconnect: pass `Last-Event-ID` when supported.
- On buffer miss: request a full snapshot and rebuild local state.
""",
}


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

@router.get("/manifest")
async def get_manifest():
    """
    Return the CrewHub capabilities manifest.

    Agents use this as the bootstrap entry-point to discover
    available API surfaces and versions.
    """
    return {
        "name": "CrewHub",
        "version": "0.1.0",
        "capabilities": {
            "auth": {"scopes": ["read", "self", "manage", "admin"]},
            "discovery": {"scan": True, "test": True, "docs": True},
            "self": {"identify": True, "display_name": True, "room": True, "heartbeat": True},
            "chat": {"send": True, "sse": True},
            "rooms": {"list": True, "create": True, "assign": True},
        },
        "docs_topics": sorted(DOCS_BY_TOPIC.keys()),
        "endpoints": {
            "self_identify": "POST /api/self/identify",
            "self_info": "GET /api/self",
            "discovery_scan": "POST /api/discovery/scan",
            "discovery_docs": "GET /api/discovery/docs/{topic}",
            "discovery_manifest": "GET /api/discovery/manifest",
        },
    }


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


@router.get("/docs/{topic}")
async def get_extended_docs(topic: str, request: Request, response: Response):
    """Return extended discovery docs for a topic with ETag support."""
    key = topic.lower()
    content = DOCS_BY_TOPIC.get(key)
    if content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "unknown_topic",
                "message": f"Unknown docs topic '{topic}'",
                "available_topics": sorted(DOCS_BY_TOPIC.keys()),
            },
        )

    etag = hashlib.sha256(content.encode("utf-8")).hexdigest()
    if request.headers.get("if-none-match") == etag:
        response.status_code = status.HTTP_304_NOT_MODIFIED
        response.headers["ETag"] = etag
        return None

    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "public, max-age=300"
    return {
        "topic": key,
        "content_type": "text/markdown",
        "content": content,
    }
