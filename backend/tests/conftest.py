"""Pytest configuration and fixtures for CrewHub backend tests."""

import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

# Use a temporary database for tests
_test_db_dir = tempfile.mkdtemp(prefix="crewhub_test_")
_test_db_path = Path(_test_db_dir) / "test_crewhub.db"

# Patch DB_PATH before importing app modules
os.environ["CREWHUB_TEST_DB"] = str(_test_db_path)
os.environ["DEMO_MODE"] = "true"


@pytest.fixture(autouse=True)
async def _setup_test_db():
    """Use a fresh temporary database for each test."""
    import sys

    import app.db.database as db_mod

    original_path = db_mod.DB_PATH
    original_dir = db_mod.DB_DIR

    # Create a unique temp db for this test
    test_dir = Path(tempfile.mkdtemp(prefix="crewhub_test_"))
    test_path = test_dir / "test.db"

    def _patch_all(path, dir_path):
        """Patch DB_PATH in db module and all modules that imported it."""
        db_mod.DB_PATH = path
        db_mod.DB_DIR = dir_path
        for mod in sys.modules.values():
            if mod and mod is not db_mod and hasattr(mod, "DB_PATH"):
                mod.DB_PATH = path
                if hasattr(mod, "DB_DIR"):
                    mod.DB_DIR = dir_path

    _patch_all(test_path, test_dir)

    # Initialize schema
    await db_mod.init_database()

    yield

    # Cleanup
    if test_path.exists():
        test_path.unlink()
    if test_dir.exists():
        import shutil

        shutil.rmtree(test_dir, ignore_errors=True)

    _patch_all(original_path, original_dir)


@pytest.fixture
async def client():
    """Async HTTP client for testing FastAPI app."""
    import sys

    import app.db.database as db_mod

    # Import app first to avoid circular imports, then reset ConnectionManager
    from app.main import app
    from app.services.connections.connection_manager import ConnectionManager

    ConnectionManager._instance = None
    ConnectionManager._init_lock = None

    # Re-patch DB_PATH in any newly-imported modules (routes loaded by app)
    for mod in sys.modules.values():
        if mod and mod is not db_mod and hasattr(mod, "DB_PATH"):
            mod.DB_PATH = db_mod.DB_PATH
            if hasattr(mod, "DB_DIR"):
                mod.DB_DIR = db_mod.DB_DIR

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

    manager = AsyncMock()
    manager.get_connection.return_value = None
    manager.get_connections.return_value = {}
    manager.list_connections.return_value = []
    manager.get_default_openclaw.return_value = None
    manager.get_all_sessions.return_value = []
    return manager
