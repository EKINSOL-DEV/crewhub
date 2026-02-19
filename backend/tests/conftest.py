"""Pytest configuration and fixtures for CrewHub backend tests."""

import os
import asyncio
import tempfile
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import AsyncClient, ASGITransport


# Use a temporary database for tests
_test_db_dir = tempfile.mkdtemp(prefix="crewhub_test_")
_test_db_path = Path(_test_db_dir) / "test_crewhub.db"

# Patch DB_PATH before importing app modules
os.environ["CREWHUB_TEST_DB"] = str(_test_db_path)


@pytest.fixture(autouse=True)
async def _setup_test_db():
    """Use a fresh temporary database for each test."""
    import app.db.database as db_mod

    original_path = db_mod.DB_PATH
    original_dir = db_mod.DB_DIR

    # Create a unique temp db for this test
    test_dir = Path(tempfile.mkdtemp(prefix="crewhub_test_"))
    test_path = test_dir / "test.db"
    db_mod.DB_PATH = test_path
    db_mod.DB_DIR = test_dir

    # Initialize schema
    await db_mod.init_database()

    yield

    # Cleanup
    if test_path.exists():
        test_path.unlink()
    if test_dir.exists():
        import shutil
        shutil.rmtree(test_dir, ignore_errors=True)

    db_mod.DB_PATH = original_path
    db_mod.DB_DIR = original_dir


@pytest.fixture
async def client():
    """Async HTTP client for testing FastAPI app."""
    # Reset the ConnectionManager singleton so each test gets a fresh one
    from app.services.connections.connection_manager import ConnectionManager
    ConnectionManager._instance = None
    ConnectionManager._init_lock = None

    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def db():
    """Get a database connection for direct DB operations in tests."""
    from app.db.database import get_db
    connection = await get_db()
    try:
        yield connection
    finally:
        await connection.close()


@pytest.fixture
def mock_connection_manager():
    """Create a mock ConnectionManager for testing."""
    from app.services.connections.base import ConnectionStatus

    manager = AsyncMock()
    manager.get_connection.return_value = None
    manager.get_connections.return_value = {}
    manager.list_connections.return_value = []
    manager.get_default_openclaw.return_value = None
    manager.get_all_sessions.return_value = []
    return manager
