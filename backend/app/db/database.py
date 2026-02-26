"""SQLite database setup for CrewHub.

This module is the public entry point for the database layer.
Implementation details live in focused sub-modules:

  app/db/schema.py     — constants (DB_PATH, SCHEMA_VERSION, …)
  app/db/migrations.py — schema creation & incremental migrations
  app/db/seed.py       — default + demo seed data
  app/db/health.py     — health-check utility

All historically-public symbols are re-exported from here so that
existing import paths (``from app.db.database import get_db``) keep
working without any changes across the codebase.
"""

import logging
from contextlib import asynccontextmanager

import aiosqlite

from .health import check_database_health  # noqa: F401
from .migrations import run_migrations

# ── Re-exports (backward-compat) ─────────────────────────────────────────────
from .schema import DB_DIR, DB_PATH, DEMO_MODE, SCHEMA_VERSION  # noqa: F401
from .seed import seed_default_data  # noqa: F401

logger = logging.getLogger(__name__)


# ── Initialisation ────────────────────────────────────────────────────────────


async def init_database() -> bool:
    """Initialise the CrewHub database with schema and seed data.

    Creates the database file and all tables if they don't exist.
    Safe to call multiple times (idempotent).
    """
    try:
        DB_DIR.mkdir(parents=True, exist_ok=True)

        async with aiosqlite.connect(DB_PATH) as db:
            await run_migrations(db)

        logger.info("Database initialised at %s", DB_PATH)

        await seed_default_data()
        return True

    except Exception as e:
        logger.error("Failed to initialise database: %s", e)
        return False


# ── Connection context manager ────────────────────────────────────────────────


@asynccontextmanager
async def get_db():
    """Async context manager for a database connection.

    Automatically sets row_factory to return plain dicts and ensures
    the connection is always closed, eliminating connection leaks.

    Usage::

        async with get_db() as db:
            async with db.execute("SELECT ...") as cursor:
                rows = await cursor.fetchall()
    """
    # Ensure database exists on first use
    if not DB_PATH.exists():
        await init_database()

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = lambda cursor, row: dict(zip([col[0] for col in cursor.description], row, strict=False))
        yield db
