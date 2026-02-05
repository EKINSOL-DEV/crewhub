"""SQLite database setup for CrewHub."""
import os
import aiosqlite
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Database path - prefer ~/.crewhub/ for persistent storage
DB_DIR = Path.home() / ".crewhub"
DB_PATH = DB_DIR / "crewhub.db"

# Schema version for migrations
SCHEMA_VERSION = 6  # v6: Added custom_blueprints table for modding


async def init_database():
    """Initialize the CrewHub database with schema.
    
    Creates the database file and tables if they don't exist.
    Safe to call multiple times (idempotent).
    """
    try:
        # Ensure directory exists
        DB_DIR.mkdir(parents=True, exist_ok=True)
        
        # Connect and create tables
        async with aiosqlite.connect(DB_PATH) as db:
            # ========================================
            # ROOMS
            # ========================================
            await db.execute("""
                CREATE TABLE IF NOT EXISTS rooms (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    icon TEXT,
                    color TEXT,
                    sort_order INTEGER DEFAULT 0,
                    default_model TEXT,
                    speed_multiplier REAL DEFAULT 1.0,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            """)
            
            # ========================================
            # PROJECTS
            # ========================================
            await db.execute("""
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    icon TEXT,
                    color TEXT,
                    status TEXT DEFAULT 'active',
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            """)
            
            # ========================================
            # AGENTS (registry)
            # ========================================
            await db.execute("""
                CREATE TABLE IF NOT EXISTS agents (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    icon TEXT,
                    avatar_url TEXT,
                    color TEXT,
                    agent_session_key TEXT UNIQUE,
                    default_model TEXT,
                    default_room_id TEXT,
                    sort_order INTEGER DEFAULT 0,
                    is_pinned BOOLEAN DEFAULT FALSE,
                    auto_spawn BOOLEAN DEFAULT TRUE,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    FOREIGN KEY (default_room_id) REFERENCES rooms(id)
                )
            """)
            
            # ========================================
            # SESSION ROOM ASSIGNMENTS
            # ========================================
            await db.execute("""
                CREATE TABLE IF NOT EXISTS session_room_assignments (
                    session_key TEXT PRIMARY KEY,
                    room_id TEXT NOT NULL,
                    assigned_at INTEGER NOT NULL,
                    FOREIGN KEY (room_id) REFERENCES rooms(id)
                )
            """)
            
            # ========================================
            # SESSION DISPLAY NAMES
            # ========================================
            await db.execute("""
                CREATE TABLE IF NOT EXISTS session_display_names (
                    session_key TEXT PRIMARY KEY,
                    display_name TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            """)
            
            # ========================================
            # ROOM ASSIGNMENT RULES
            # ========================================
            await db.execute("""
                CREATE TABLE IF NOT EXISTS room_assignment_rules (
                    id TEXT PRIMARY KEY,
                    room_id TEXT NOT NULL,
                    rule_type TEXT NOT NULL,
                    rule_value TEXT NOT NULL,
                    priority INTEGER DEFAULT 0,
                    created_at INTEGER NOT NULL,
                    FOREIGN KEY (room_id) REFERENCES rooms(id),
                    UNIQUE(room_id, rule_type, rule_value)
                )
            """)
            
            # ========================================
            # SETTINGS (global key-value)
            # ========================================
            await db.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            """)
            
            # ========================================
            # CONNECTIONS
            # ========================================
            await db.execute("""
                CREATE TABLE IF NOT EXISTS connections (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    config TEXT NOT NULL DEFAULT '{}',
                    enabled BOOLEAN DEFAULT TRUE,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            """)
            
            # ========================================
            # CUSTOM BLUEPRINTS (modding)
            # ========================================
            await db.execute("""
                CREATE TABLE IF NOT EXISTS custom_blueprints (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    room_id TEXT,
                    blueprint_json TEXT NOT NULL,
                    source TEXT NOT NULL DEFAULT 'user',
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    FOREIGN KEY (room_id) REFERENCES rooms(id)
                )
            """)
            
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_custom_blueprints_room_id
                ON custom_blueprints(room_id)
            """)
            
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_custom_blueprints_source
                ON custom_blueprints(source)
            """)
            
            # ========================================
            # SCHEMA VERSION
            # ========================================
            await db.execute("""
                CREATE TABLE IF NOT EXISTS schema_version (
                    version INTEGER PRIMARY KEY,
                    applied_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
                )
            """)
            
            # Create indexes
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_agents_session_key 
                ON agents(agent_session_key)
            """)
            
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_agents_pinned 
                ON agents(is_pinned)
            """)
            
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_room_assignment_rules_priority 
                ON room_assignment_rules(priority DESC)
            """)
            
            # Migration: add unique constraint for existing databases
            # SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so create unique index instead
            await db.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_room_assignment_rules_unique
                ON room_assignment_rules(room_id, rule_type, rule_value)
            """)
            
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_session_room_assignments_room 
                ON session_room_assignments(room_id)
            """)
            
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_connections_type 
                ON connections(type)
            """)
            
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_connections_enabled 
                ON connections(enabled)
            """)
            
            # ========================================
            # MIGRATIONS
            # ========================================
            # v4: Add project_id and is_hq to rooms
            try:
                await db.execute("ALTER TABLE rooms ADD COLUMN project_id TEXT REFERENCES projects(id)")
            except Exception:
                pass  # Column already exists
            
            try:
                await db.execute("ALTER TABLE rooms ADD COLUMN is_hq BOOLEAN DEFAULT 0")
            except Exception:
                pass  # Column already exists
            
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_rooms_project_id 
                ON rooms(project_id)
            """)
            
            # v5: Add folder_path to projects
            try:
                await db.execute("ALTER TABLE projects ADD COLUMN folder_path TEXT")
            except Exception:
                pass  # Column already exists
            
            # Set initial version if not exists
            await db.execute("""
                INSERT OR IGNORE INTO schema_version (version) 
                VALUES (?)
            """, (SCHEMA_VERSION,))
            
            await db.commit()
            
        logger.info(f"Database initialized at {DB_PATH}")
        
        # Seed default data
        await seed_default_data()
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        return False


async def get_db():
    """Get a database connection.
    
    Returns:
        aiosqlite.Connection: Database connection
        
    Note: Caller is responsible for closing the connection.
    """
    try:
        # Ensure database exists
        if not DB_PATH.exists():
            await init_database()
            
        return await aiosqlite.connect(DB_PATH)
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        raise


async def seed_default_data():
    """Seed the database with default rooms and agents.
    
    Safe to call multiple times (uses INSERT OR IGNORE).
    """
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            import time
            now = int(time.time() * 1000)
            
            # Create default rooms
            default_rooms = [
                ('headquarters', 'Headquarters', '🏛️', '#4f46e5', 0, now, now),
                ('marketing-room', 'Marketing', '📢', '#ec4899', 1, now, now),
                ('dev-room', 'Dev Room', '💻', '#10b981', 2, now, now),
                ('creative-room', 'Creative Room', '🎨', '#f59e0b', 3, now, now),
                ('thinking-room', 'Thinking Room', '🧠', '#8b5cf6', 4, now, now),
                ('automation-room', 'Automation Room', '⚙️', '#06b6d4', 5, now, now),
                ('comms-room', 'Comms Room', '📡', '#14b8a6', 6, now, now),
                ('ops-room', 'Ops Room', '🛠️', '#f97316', 7, now, now),
            ]
            
            await db.executemany("""
                INSERT OR IGNORE INTO rooms (id, name, icon, color, sort_order, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, default_rooms)
            
            # Set headquarters as HQ
            await db.execute(
                "UPDATE rooms SET is_hq = 1 WHERE id = 'headquarters'"
            )
            
            # Create default agents
            default_agents = [
                ('main', 'Main', '🤖', '#3b82f6', 'agent:main:main', 'anthropic/claude-sonnet-4-5', 'headquarters', 0, True, True, now, now),
                ('dev', 'Dev', '💻', '#10b981', 'agent:dev:main', None, 'dev-room', 1, False, True, now, now),
                ('flowy', 'Flowy', '🌊', '#8b5cf6', 'agent:flowy:main', None, 'headquarters', 2, False, True, now, now),
                ('creator', 'Creator', '🎨', '#f59e0b', 'agent:creator:main', None, 'creative-room', 3, False, True, now, now),
                ('reviewer', 'Reviewer', '🔍', '#ef4444', 'agent:reviewer:main', None, 'headquarters', 4, False, True, now, now),
            ]
            
            await db.executemany("""
                INSERT OR IGNORE INTO agents (
                    id, name, icon, color, agent_session_key, 
                    default_model, default_room_id, sort_order, 
                    is_pinned, auto_spawn, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, default_agents)
            
            # Create default settings
            default_settings = [
                ('active_agent_id', 'main', now),
                ('layout_mode', 'grid', now),
                ('grid_columns', '4', now),
                ('show_room_labels', 'true', now),
                ('show_room_borders', 'true', now),
                ('unassigned_room_id', 'headquarters', now),
            ]
            
            await db.executemany("""
                INSERT OR IGNORE INTO settings (key, value, updated_at)
                VALUES (?, ?, ?)
            """, default_settings)
            
            # Create default room assignment rules (fixed IDs to prevent duplicates on restart)
            default_rules = [
                # Session type based rules (highest priority)
                ('rule-cron-automation', 'automation-room', 'session_key_contains', ':cron:', 100, now),
                ('rule-subagent-dev', 'dev-room', 'session_key_contains', ':subagent:', 90, now),
                ('rule-spawn-dev', 'dev-room', 'session_key_contains', ':spawn:', 90, now),
                ('rule-main-hq', 'headquarters', 'session_type', 'main', 80, now),
                # Channel based rules
                ('rule-slack-comms', 'comms-room', 'session_key_contains', 'slack', 70, now),
                ('rule-whatsapp-comms', 'comms-room', 'session_key_contains', 'whatsapp', 70, now),
                ('rule-telegram-comms', 'comms-room', 'session_key_contains', 'telegram', 70, now),
                ('rule-discord-comms', 'comms-room', 'session_key_contains', 'discord', 70, now),
                # Model based rules
                ('rule-opus-dev', 'dev-room', 'model', 'opus', 50, now),
                ('rule-gpt5-thinking', 'thinking-room', 'model', 'gpt5', 50, now),
                ('rule-gpt5v2-thinking', 'thinking-room', 'model', 'gpt-5', 50, now),
            ]
            
            await db.executemany("""
                INSERT OR IGNORE INTO room_assignment_rules (id, room_id, rule_type, rule_value, priority, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, default_rules)
            
            # Create default connections
            import json as json_module
            default_connections = [
                (
                    'default-openclaw',
                    'OpenClaw Gateway',
                    'openclaw',
                    json_module.dumps({
                        'url': 'ws://localhost:18789',
                        'auto_reconnect': True,
                        'reconnect_delay': 1.0,
                        'max_reconnect_delay': 60.0,
                    }),
                    True,
                    now,
                    now,
                ),
            ]
            
            await db.executemany("""
                INSERT OR IGNORE INTO connections (id, name, type, config, enabled, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, default_connections)
            
            await db.commit()
            logger.info("Default seed data inserted successfully")
            return True
            
    except Exception as e:
        logger.error(f"Failed to seed default data: {e}")
        return False


async def check_database_health() -> dict:
    """Check database health and statistics."""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            # Get counts
            async with db.execute("SELECT COUNT(*) FROM rooms") as cursor:
                rooms_count = (await cursor.fetchone())[0]
            
            async with db.execute("SELECT COUNT(*) FROM agents") as cursor:
                agents_count = (await cursor.fetchone())[0]
            
            async with db.execute("SELECT COUNT(*) FROM session_room_assignments") as cursor:
                assignments_count = (await cursor.fetchone())[0]
            
            # Get database size
            size = DB_PATH.stat().st_size if DB_PATH.exists() else 0
            
            return {
                "healthy": True,
                "path": str(DB_PATH),
                "rooms_count": rooms_count,
                "agents_count": agents_count,
                "assignments_count": assignments_count,
                "size_bytes": size,
                "size_mb": round(size / (1024 * 1024), 2)
            }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "healthy": False,
            "error": str(e)
        }
