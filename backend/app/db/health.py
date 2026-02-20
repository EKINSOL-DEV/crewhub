"""Database health check utilities for CrewHub."""
import logging

import aiosqlite

from .schema import DB_PATH

logger = logging.getLogger(__name__)


async def check_database_health() -> dict:
    """Check database health and return statistics."""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT COUNT(*) FROM rooms") as cursor:
                rooms_count = (await cursor.fetchone())[0]

            async with db.execute("SELECT COUNT(*) FROM agents") as cursor:
                agents_count = (await cursor.fetchone())[0]

            async with db.execute("SELECT COUNT(*) FROM session_room_assignments") as cursor:
                assignments_count = (await cursor.fetchone())[0]

            size = DB_PATH.stat().st_size if DB_PATH.exists() else 0

            return {
                "healthy": True,
                "path": str(DB_PATH),
                "rooms_count": rooms_count,
                "agents_count": agents_count,
                "assignments_count": assignments_count,
                "size_bytes": size,
                "size_mb": round(size / (1024 * 1024), 2),
            }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "healthy": False,
            "error": str(e),
        }
