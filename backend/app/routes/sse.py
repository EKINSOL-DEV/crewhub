"""
SSE (Server-Sent Events) routes and broadcast logic.
Handles real-time updates to connected clients.
"""

import asyncio
import json
import logging
import time
from typing import Optional

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

# Shared SSE client pool
_sse_clients: list[asyncio.Queue] = []

# Queue size with extra headroom — real cleanup is done via stale-client removal
_QUEUE_MAXSIZE = 200


async def _sse_generator(queue: asyncio.Queue, request: Request):
    """Yield SSE events from queue until client disconnects."""
    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                # Use shorter timeout so we check is_disconnected more frequently
                event = await asyncio.wait_for(queue.get(), timeout=15)
                yield f"event: {event['type']}\ndata: {json.dumps(event['data'])}\n\n"
            except TimeoutError:
                # Send keepalive comment to detect broken pipe early
                yield ": keepalive\n\n"
    finally:
        if queue in _sse_clients:
            _sse_clients.remove(queue)
        logger.debug(f"SSE client disconnected. Active clients: {len(_sse_clients)}")


async def broadcast(event_type: str, data: dict):
    """Push an event to all connected SSE clients.

    Stale clients (full queue = not consuming) are removed immediately so
    they don't accumulate and cause repeated drop warnings.
    """
    event = {"type": event_type, "data": data}
    dead_clients: list[asyncio.Queue] = []

    for q in list(_sse_clients):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            logger.warning(
                f"SSE client queue full ({q.qsize()}/{q.maxsize}), "
                f"removing stale client — active before cleanup: {len(_sse_clients)}"
            )
            dead_clients.append(q)

    # Evict stale clients that are no longer consuming events
    for q in dead_clients:
        if q in _sse_clients:
            _sse_clients.remove(q)

    if dead_clients:
        logger.info(f"Removed {len(dead_clients)} stale SSE client(s). Active clients remaining: {len(_sse_clients)}")


def get_client_count() -> int:
    """Get number of connected SSE clients."""
    return len(_sse_clients)


@router.get("/events")
async def sse_events(request: Request):
    """SSE stream for live updates."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=_QUEUE_MAXSIZE)
    _sse_clients.append(queue)
    logger.debug(f"SSE client connected. Active clients: {len(_sse_clients)}")
    return StreamingResponse(
        _sse_generator(queue, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
        },
    )


class NotifyPayload(BaseModel):
    type: str = "update"
    data: Optional[dict] = None


@router.post("/notify")
async def notify_clients(payload: NotifyPayload):
    """Trigger a live refresh for all connected clients."""
    await broadcast(payload.type, payload.data or {"ts": time.time()})
    return {"ok": True, "clients": get_client_count()}
