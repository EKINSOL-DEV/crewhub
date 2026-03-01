"""Database constants and schema version for CrewHub."""

import os
from pathlib import Path

# Demo mode - when true, seeds agents + mock data for showcase
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() == "true"

# Database path - configurable via env var, defaults to ~/.crewhub/crewhub.db
_db_path_env = os.environ.get("CREWHUB_DB_PATH")
if _db_path_env:
    DB_PATH = Path(_db_path_env)
    DB_DIR = DB_PATH.parent
else:
    DB_DIR = Path.home() / ".crewhub"
    DB_PATH = DB_DIR / "crewhub.db"

# Schema version — bump when adding new migrations
SCHEMA_VERSION = 21  # v21: Agent↔Session linking
