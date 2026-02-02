"""
SSE (Server-Sent Events) routes and broadcast logic.
Handles real-time updates to connected clients.
"""
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import asyncio
import json
import time

router = APIRouter(tags=["SSE"])

# Shared SSE client pool
_sse_clients: list[asyncio.Queue] = []


async def _sse_generator(queue: asyncio.Queue, request: Request):
    """Yield SSE events from queue until client disconnects."""
    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30)
                yield f"event: {event['type']}\ndata: {json.dumps(event['data'])}\n\n"
            except asyncio.TimeoutError:
                # Send keepalive comment
                yield ": keepalive\n\n"
    finally:
        if queue in _sse_clients:
            _sse_clients.remove(queue)


async def broadcast(event_type: str, data: dict):
    """Push an event to all connected SSE clients."""
    event = {"type": event_type, "data": data}
    
    for q in list(_sse_clients):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            import logging
            logger = logging.getLogger(__name__)
            if q.qsize() >= 95:
                logger.warning(f"SSE client queue nearly full ({q.qsize()}/100), dropping event")


def get_client_count() -> int:
    """Get number of connected SSE clients."""
    return len(_sse_clients)


@router.get("/events")
async def sse_events(request: Request):
    """SSE stream for live updates."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    _sse_clients.append(queue)
    return StreamingResponse(
        _sse_generator(queue, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
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
