"""SQLite database setup for CrewHub."""
import os
import aiosqlite
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

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

# Schema version for migrations
SCHEMA_VERSION = 10  # v10: Added agent_personas table


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
            
            # v8: Add bio to agents
            try:
                await db.execute("ALTER TABLE agents ADD COLUMN bio TEXT")
            except Exception:
                pass  # Column already exists
            
            # v8: Seed bios for known agents (only if bio is NULL)
            agent_bios = {
                'main': 'Director of Bots. Keeps the crew running, manages schedules, and always has an answer. Runs on coffee and Sonnet.',
                'dev': 'Senior developer. Lives in the codebase, speaks fluent TypeScript, and ships features at light speed. Powered by Opus.',
                'gamedev': '3D world architect. Builds rooms, animates bots, and makes pixels dance. Three.js whisperer on Opus.',
                'flowy': 'Marketing maestro and product visionary. Turns ideas into campaigns and roadmaps into reality. Creative force on GPT-5.2.',
                'reviewer': 'Code critic and quality guardian. Reviews PRs with surgical precision. Runs on GPT-5.2 and strong opinions.',
                'wtl': 'Waterleau knowledge specialist. Industrial data pipelines, wastewater treatment, and SCADA systems. The domain expert on Sonnet.',
            }
            for agent_id, bio in agent_bios.items():
                await db.execute(
                    "UPDATE agents SET bio = ? WHERE id = ? AND bio IS NULL",
                    (bio, agent_id),
                )
            
            # v7: Add floor_style and wall_style to rooms
            try:
                await db.execute("ALTER TABLE rooms ADD COLUMN floor_style TEXT DEFAULT 'default'")
            except Exception:
                pass  # Column already exists
            
            try:
                await db.execute("ALTER TABLE rooms ADD COLUMN wall_style TEXT DEFAULT 'default'")
            except Exception:
                pass  # Column already exists
            
            # ========================================
            # v9: Tasks and Project History
            # ========================================
            await db.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id),
                    room_id TEXT REFERENCES rooms(id),
                    title TEXT NOT NULL,
                    description TEXT,
                    status TEXT DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'review', 'done', 'blocked')),
                    priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
                    assigned_session_key TEXT,
                    created_by TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            """)
            
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)
            """)
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_tasks_room ON tasks(room_id)
            """)
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)
            """)
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_session_key)
            """)
            
            await db.execute("""
                CREATE TABLE IF NOT EXISTS project_history (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id),
                    task_id TEXT REFERENCES tasks(id),
                    event_type TEXT NOT NULL,
                    actor_session_key TEXT,
                    payload_json TEXT,
                    created_at INTEGER NOT NULL
                )
            """)
            
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_project_history_project ON project_history(project_id)
            """)
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_project_history_task ON project_history(task_id)
            """)
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_project_history_created ON project_history(created_at DESC)
            """)
            
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
    """Seed the database with default rooms and settings.
    
    Safe to call multiple times (uses INSERT OR IGNORE).
    """
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            import time
            now = int(time.time() * 1000)
            
            # Create default rooms (only HQ — onboarding wizard adds more)
            default_rooms = [
                ('headquarters', 'Headquarters', '🏛️', '#4f46e5', 0, now, now),
            ]
            
            await db.executemany("""
                INSERT OR IGNORE INTO rooms (id, name, icon, color, sort_order, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, default_rooms)
            
            # Set headquarters as HQ
            await db.execute(
                "UPDATE rooms SET is_hq = 1 WHERE id = 'headquarters'"
            )
            
            # Demo mode: seed agents + mock data for showcase
            if DEMO_MODE:
                logger.info("🎭 DEMO MODE enabled — seeding agents and mock data")
                await _seed_demo_agents(db, now)
                await _seed_demo_tasks_and_history(db, now)
            
            # Create default settings
            default_settings = [
                ('active_agent_id', '', now),
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
                # Basic rules to get started
                ('rule-main-hq', 'headquarters', 'session_type', 'main', 80, now),
            ]
            
            await db.executemany("""
                INSERT OR IGNORE INTO room_assignment_rules (id, room_id, rule_type, rule_value, priority, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, default_rules)
            
            # No default connections — onboarding wizard handles setup
            await db.commit()
            logger.info("Default seed data inserted successfully")
            return True
            
    except Exception as e:
        logger.error(f"Failed to seed default data: {e}")
        return False


async def _seed_demo_agents(db, now: int):
    """Seed demo agents for showcase mode."""
    import json
    
    default_agents = [
        ('main', 'Director', '🎯', None, '#4f46e5', 'agent:main:main', 'sonnet', 'headquarters', 0, True, True, now, now,
         'Director of Bots. Keeps the crew running, manages schedules, and always has an answer. Runs on coffee and Sonnet.'),
        ('dev', 'Developer', '💻', None, '#10b981', 'agent:dev:dev', 'opus', 'headquarters', 1, True, True, now, now,
         'Senior developer. Lives in the codebase, speaks fluent TypeScript, and ships features at light speed. Powered by Opus.'),
        ('gamedev', 'Game Dev', '🎮', None, '#f59e0b', 'agent:gamedev:gamedev', 'opus', 'headquarters', 2, True, True, now, now,
         '3D world architect. Builds rooms, animates bots, and makes pixels dance. Three.js whisperer on Opus.'),
        ('flowy', 'Flowy', '🎨', None, '#ec4899', 'agent:flowy:flowy', 'gpt-4o', 'headquarters', 3, True, True, now, now,
         'Marketing maestro and product visionary. Turns ideas into campaigns and roadmaps into reality. Creative force on GPT-5.2.'),
        ('reviewer', 'Reviewer', '🔍', None, '#8b5cf6', 'agent:reviewer:reviewer', 'gpt-4o', 'headquarters', 4, True, True, now, now,
         'Code critic and quality guardian. Reviews PRs with surgical precision. Runs on GPT-5.2 and strong opinions.'),
    ]

    await db.executemany("""
        INSERT OR IGNORE INTO agents (id, name, icon, avatar_url, color, agent_session_key, default_model, default_room_id, sort_order, is_pinned, auto_spawn, created_at, updated_at, bio)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, default_agents)

    # Create extra demo rooms
    demo_rooms = [
        ('dev-lab', 'Dev Lab', '🧪', '#10b981', 1, now, now),
        ('design-studio', 'Design Studio', '🎨', '#ec4899', 2, now, now),
        ('war-room', 'War Room', '⚔️', '#ef4444', 3, now, now),
    ]
    await db.executemany("""
        INSERT OR IGNORE INTO rooms (id, name, icon, color, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, demo_rooms)

    # Room assignment rules for demo agents
    demo_rules = [
        ('rule-dev-lab', 'dev-lab', 'session_prefix', 'agent:dev', 70, now),
        ('rule-gamedev-lab', 'dev-lab', 'session_prefix', 'agent:gamedev', 70, now),
        ('rule-flowy-design', 'design-studio', 'session_prefix', 'agent:flowy', 70, now),
        ('rule-reviewer-war', 'war-room', 'session_prefix', 'agent:reviewer', 70, now),
    ]
    await db.executemany("""
        INSERT OR IGNORE INTO room_assignment_rules (id, room_id, rule_type, rule_value, priority, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, demo_rules)


async def _seed_demo_tasks_and_history(db, now: int):
    """Seed mock tasks and activity history for a lively demo."""
    import json
    import uuid

    # Create a demo project
    await db.execute("""
        INSERT OR IGNORE INTO projects (id, name, description, icon, color, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, ('demo-project', 'CrewHub Launch', 'Ship CrewHub v1.0 to the world 🚀', '🚀', '#4f46e5', 'active', now, now))

    # Link HQ room to project
    await db.execute("UPDATE rooms SET project_id = 'demo-project' WHERE id = 'headquarters'")
    await db.execute("UPDATE rooms SET project_id = 'demo-project' WHERE id = 'dev-lab'")
    await db.execute("UPDATE rooms SET project_id = 'demo-project' WHERE id = 'design-studio'")

    # Demo tasks — a mix of statuses
    hour = 3_600_000  # 1 hour in ms
    demo_tasks = [
        ('task-1', 'demo-project', 'headquarters', 'Set up CI/CD pipeline', 'Configure GitHub Actions for auto-deploy on main branch', 'done', 'high', 'agent:dev:dev', 'agent:main:main', now - 48*hour, now - 12*hour),
        ('task-2', 'demo-project', 'dev-lab', 'Implement WebSocket reconnect logic', 'Handle dropped connections gracefully with exponential backoff', 'in_progress', 'high', 'agent:dev:dev', 'agent:main:main', now - 24*hour, now - 2*hour),
        ('task-3', 'demo-project', 'design-studio', 'Design onboarding wizard', 'Create a 3-step wizard for first-time users', 'review', 'medium', 'agent:flowy:flowy', 'agent:main:main', now - 36*hour, now - 4*hour),
        ('task-4', 'demo-project', 'headquarters', 'Write API documentation', 'Document all REST endpoints with examples', 'todo', 'medium', 'agent:dev:dev', 'agent:main:main', now - 6*hour, now - 6*hour),
        ('task-5', 'demo-project', 'war-room', 'Code review: auth module', 'Review the JWT auth implementation for security issues', 'in_progress', 'urgent', 'agent:reviewer:reviewer', 'agent:dev:dev', now - 8*hour, now - 1*hour),
        ('task-6', 'demo-project', 'dev-lab', 'Build 3D room renderer', 'Three.js scene with walls, floor, and agent avatars', 'done', 'high', 'agent:gamedev:gamedev', 'agent:main:main', now - 72*hour, now - 24*hour),
        ('task-7', 'demo-project', 'design-studio', 'Create marketing landing page', 'Hero section, features, pricing, and CTA', 'todo', 'low', 'agent:flowy:flowy', 'agent:main:main', now - 2*hour, now - 2*hour),
        ('task-8', 'demo-project', 'headquarters', 'Plan v1.1 roadmap', 'Gather feature requests and prioritize for next sprint', 'todo', 'medium', None, 'agent:main:main', now - 1*hour, now - 1*hour),
    ]

    await db.executemany("""
        INSERT OR IGNORE INTO tasks (id, project_id, room_id, title, description, status, priority, assigned_session_key, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, demo_tasks)

    # Activity history entries
    demo_history = [
        (str(uuid.uuid4()), 'demo-project', 'task-6', 'task_completed', 'agent:gamedev:gamedev', json.dumps({"title": "Build 3D room renderer", "message": "Three.js scene is live! Walls, floors, and avatars rendering smoothly 🎮"}), now - 24*hour),
        (str(uuid.uuid4()), 'demo-project', 'task-1', 'task_completed', 'agent:dev:dev', json.dumps({"title": "Set up CI/CD pipeline", "message": "GitHub Actions configured. Auto-deploy on push to main ✅"}), now - 12*hour),
        (str(uuid.uuid4()), 'demo-project', 'task-5', 'task_started', 'agent:reviewer:reviewer', json.dumps({"title": "Code review: auth module", "message": "Starting security review of JWT implementation 🔍"}), now - 8*hour),
        (str(uuid.uuid4()), 'demo-project', 'task-3', 'status_changed', 'agent:flowy:flowy', json.dumps({"title": "Design onboarding wizard", "from": "in_progress", "to": "review", "message": "Wizard designs ready for review! 3 steps: Connect → Configure → Launch 🎨"}), now - 4*hour),
        (str(uuid.uuid4()), 'demo-project', 'task-2', 'task_started', 'agent:dev:dev', json.dumps({"title": "Implement WebSocket reconnect logic", "message": "Working on exponential backoff with jitter 🔄"}), now - 2*hour),
        (str(uuid.uuid4()), 'demo-project', None, 'agent_joined', 'agent:main:main', json.dumps({"message": "Director came online and assigned sprint tasks 📋"}), now - 50*hour),
        (str(uuid.uuid4()), 'demo-project', None, 'project_created', 'agent:main:main', json.dumps({"message": "Project 'CrewHub Launch' created. Let's ship it! 🚀"}), now - 72*hour),
    ]

    await db.executemany("""
        INSERT OR IGNORE INTO project_history (id, project_id, task_id, event_type, actor_session_key, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, demo_history)


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
