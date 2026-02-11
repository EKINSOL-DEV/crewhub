"""Health check endpoints."""

import os
import time
import psutil
from fastapi import APIRouter

router = APIRouter()

_start_time = time.time()


@router.get("/health")
async def health_check():
    """Health check endpoint with uptime and memory usage."""
    process = psutil.Process(os.getpid())
    mem = process.memory_info()
    uptime_seconds = time.time() - _start_time

    return {
        "status": "healthy",
        "uptime_seconds": round(uptime_seconds, 1),
        "uptime_human": _format_uptime(uptime_seconds),
        "pid": os.getpid(),
        "memory": {
            "rss_mb": round(mem.rss / 1024 / 1024, 1),
            "vms_mb": round(mem.vms / 1024 / 1024, 1),
        },
        "cpu_percent": process.cpu_percent(interval=0),
    }


@router.get("/api/health")
async def api_health_check():
    """Health check at /api/health path (used by watchdog)."""
    return await health_check()


@router.get("/ready")
async def readiness_check():
    """Readiness check endpoint."""
    return {"status": "ready"}


def _format_uptime(seconds: float) -> str:
    days = int(seconds // 86400)
    hours = int((seconds % 86400) // 3600)
    minutes = int((seconds % 3600) // 60)
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    parts.append(f"{minutes}m")
    return " ".join(parts)
