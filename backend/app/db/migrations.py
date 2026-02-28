"""Schema creation and migrations for CrewHub database."""

import logging

from .schema import SCHEMA_VERSION

logger = logging.getLogger(__name__)


async def run_migrations(db) -> None:
    """Apply all schema creation and incremental migrations.

    Uses CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS for
    idempotent base schema creation, and try/except ALTER TABLE blocks
    for column additions on existing databases.

    Always commits at the end.
    """
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

    # Core indexes
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

    # SQLite doesn't support ALTER TABLE ADD CONSTRAINT; use unique index instead
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
    # v4: Add project_id and is_hq to rooms
    # ========================================
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

    # ========================================
    # v5: Add folder_path to projects
    # ========================================
    try:
        await db.execute("ALTER TABLE projects ADD COLUMN folder_path TEXT")
    except Exception:
        pass  # Column already exists

    # ========================================
    # v7: Add floor_style and wall_style to rooms
    # ========================================
    try:
        await db.execute("ALTER TABLE rooms ADD COLUMN floor_style TEXT DEFAULT 'default'")
    except Exception:
        pass  # Column already exists

    try:
        await db.execute("ALTER TABLE rooms ADD COLUMN wall_style TEXT DEFAULT 'default'")
    except Exception:
        pass  # Column already exists

    # ========================================
    # v8: Add bio to agents + seed known bios
    # ========================================
    try:
        await db.execute("ALTER TABLE agents ADD COLUMN bio TEXT")
    except Exception:
        pass  # Column already exists

    agent_bios = {
        "main": "Director of Bots. Keeps the crew running, manages schedules, and always has an answer. Runs on coffee and Sonnet.",
        "dev": "Senior developer. Lives in the codebase, speaks fluent TypeScript, and ships features at light speed. Powered by Opus.",
        "gamedev": "3D world architect. Builds rooms, animates bots, and makes pixels dance. Three.js whisperer on Opus.",
        "flowy": "Marketing maestro and product visionary. Turns ideas into campaigns and roadmaps into reality. Creative force on GPT-5.2.",
        "reviewer": "Code critic and quality guardian. Reviews PRs with surgical precision. Runs on GPT-5.2 and strong opinions.",
    }
    for agent_id, bio in agent_bios.items():
        await db.execute(
            "UPDATE agents SET bio = ? WHERE id = ? AND bio IS NULL",
            (bio, agent_id),
        )

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

    # ========================================
    # v10: Agent Personas
    # ========================================
    await db.execute("""
        CREATE TABLE IF NOT EXISTS agent_personas (
            agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
            preset TEXT,
            start_behavior INTEGER NOT NULL DEFAULT 1,
            checkin_frequency INTEGER NOT NULL DEFAULT 4,
            response_detail INTEGER NOT NULL DEFAULT 2,
            approach_style INTEGER NOT NULL DEFAULT 3,
            custom_instructions TEXT DEFAULT '',
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
        )
    """)

    # ========================================
    # v11: Add docs_path to projects
    # ========================================
    try:
        await db.execute("ALTER TABLE projects ADD COLUMN docs_path TEXT")
    except Exception:
        pass  # Column already exists

    # ========================================
    # v12: Stand-up Meetings
    # ========================================
    await db.execute("""
        CREATE TABLE IF NOT EXISTS standups (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'Daily Standup',
            created_by TEXT,
            created_at INTEGER NOT NULL
        )
    """)

    await db.execute("""
        CREATE TABLE IF NOT EXISTS standup_entries (
            id TEXT PRIMARY KEY,
            standup_id TEXT NOT NULL REFERENCES standups(id) ON DELETE CASCADE,
            agent_key TEXT NOT NULL,
            yesterday TEXT DEFAULT '',
            today TEXT DEFAULT '',
            blockers TEXT DEFAULT '',
            submitted_at INTEGER NOT NULL
        )
    """)

    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_standup_entries_standup
        ON standup_entries(standup_id)
    """)

    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_standups_created
        ON standups(created_at DESC)
    """)

    # ========================================
    # v13: Agent Identity Pattern
    # ========================================
    try:
        await db.execute("ALTER TABLE agent_personas ADD COLUMN identity_anchor TEXT DEFAULT ''")
    except Exception:
        pass  # Column already exists

    try:
        await db.execute("ALTER TABLE agent_personas ADD COLUMN surface_rules TEXT DEFAULT ''")
    except Exception:
        pass  # Column already exists

    try:
        await db.execute("ALTER TABLE agent_personas ADD COLUMN identity_locked BOOLEAN DEFAULT FALSE")
    except Exception:
        pass  # Column already exists

    await db.execute("""
        CREATE TABLE IF NOT EXISTS agent_surfaces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
            surface TEXT NOT NULL,
            format_rules TEXT DEFAULT '',
            enabled BOOLEAN DEFAULT TRUE,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
            UNIQUE(agent_id, surface)
        )
    """)

    # ========================================
    # v14: AI-Orchestrated Meetings
    # ========================================
    await db.execute("""
        CREATE TABLE IF NOT EXISTS meetings (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'Daily Standup',
            goal TEXT NOT NULL DEFAULT '',
            state TEXT NOT NULL DEFAULT 'gathering',
            room_id TEXT,
            project_id TEXT,
            config_json TEXT,
            output_md TEXT,
            output_path TEXT,
            current_round INTEGER DEFAULT 0,
            current_turn INTEGER DEFAULT 0,
            started_at INTEGER,
            completed_at INTEGER,
            cancelled_at INTEGER,
            error_message TEXT,
            created_by TEXT DEFAULT 'user',
            created_at INTEGER NOT NULL,
            FOREIGN KEY (room_id) REFERENCES rooms(id),
            FOREIGN KEY (project_id) REFERENCES projects(id)
        )
    """)

    await db.execute("""
        CREATE TABLE IF NOT EXISTS meeting_participants (
            meeting_id TEXT NOT NULL,
            agent_id TEXT NOT NULL,
            agent_name TEXT DEFAULT '',
            agent_icon TEXT,
            agent_color TEXT,
            sort_order INTEGER DEFAULT 0,
            PRIMARY KEY (meeting_id, agent_id),
            FOREIGN KEY (meeting_id) REFERENCES meetings(id)
        )
    """)

    await db.execute("""
        CREATE TABLE IF NOT EXISTS meeting_turns (
            id TEXT PRIMARY KEY,
            meeting_id TEXT NOT NULL,
            round_num INTEGER NOT NULL,
            turn_index INTEGER NOT NULL,
            agent_id TEXT NOT NULL,
            agent_name TEXT,
            prompt_tokens INTEGER,
            response_tokens INTEGER,
            response_text TEXT,
            started_at INTEGER,
            completed_at INTEGER,
            FOREIGN KEY (meeting_id) REFERENCES meetings(id)
        )
    """)

    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_meetings_state ON meetings(state)
    """)
    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_meetings_created ON meetings(created_at DESC)
    """)
    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_meeting_turns_meeting ON meeting_turns(meeting_id)
    """)

    # ========================================
    # v15: Post-Meeting Workflow
    # ========================================
    try:
        await db.execute("ALTER TABLE meetings ADD COLUMN parent_meeting_id TEXT")
    except Exception:
        pass  # Column already exists

    await db.execute("""
        CREATE TABLE IF NOT EXISTS meeting_action_items (
            id TEXT PRIMARY KEY,
            meeting_id TEXT NOT NULL,
            text TEXT NOT NULL,
            assignee_agent_id TEXT,
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'pending',
            planner_task_id TEXT,
            execution_session_id TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (meeting_id) REFERENCES meetings(id)
        )
    """)

    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting
        ON meeting_action_items(meeting_id)
    """)

    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_meetings_room
        ON meetings(room_id, created_at DESC)
    """)
    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_meetings_project
        ON meetings(project_id, created_at DESC)
    """)

    # ========================================
    # v16: Group Chat Threads
    # ========================================
    await db.execute("""
        CREATE TABLE IF NOT EXISTS threads (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL DEFAULT 'group' CHECK(kind IN ('direct', 'group')),
            title TEXT,
            title_auto TEXT,
            created_by TEXT NOT NULL DEFAULT 'user',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            archived_at INTEGER,
            last_message_at INTEGER,
            settings_json TEXT NOT NULL DEFAULT '{}'
        )
    """)

    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_threads_kind ON threads(kind)
    """)
    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_threads_archived ON threads(archived_at)
    """)
    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_threads_last_message ON threads(last_message_at DESC)
    """)

    await db.execute("""
        CREATE TABLE IF NOT EXISTS thread_participants (
            id TEXT PRIMARY KEY,
            thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
            agent_id TEXT NOT NULL,
            agent_name TEXT NOT NULL DEFAULT '',
            agent_icon TEXT,
            agent_color TEXT,
            role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner', 'member')),
            is_active INTEGER NOT NULL DEFAULT 1,
            joined_at INTEGER NOT NULL,
            left_at INTEGER,
            UNIQUE(thread_id, agent_id)
        )
    """)

    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_thread_participants_thread
        ON thread_participants(thread_id)
    """)
    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_thread_participants_agent
        ON thread_participants(agent_id)
    """)

    await db.execute("""
        CREATE TABLE IF NOT EXISTS thread_messages (
            id TEXT PRIMARY KEY,
            thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
            role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
            content TEXT NOT NULL DEFAULT '',
            agent_id TEXT,
            agent_name TEXT,
            routing_mode TEXT DEFAULT 'broadcast',
            target_agent_ids_json TEXT,
            created_at INTEGER NOT NULL
        )
    """)

    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_thread_messages_thread
        ON thread_messages(thread_id, created_at)
    """)

    # ========================================
    # v17: Placed Props (Creator Mode)
    # ========================================
    await db.execute("""
        CREATE TABLE IF NOT EXISTS placed_props (
            id TEXT PRIMARY KEY,
            prop_id TEXT NOT NULL,
            position_x REAL NOT NULL DEFAULT 0,
            position_y REAL NOT NULL DEFAULT 0,
            position_z REAL NOT NULL DEFAULT 0,
            rotation_y REAL NOT NULL DEFAULT 0,
            scale REAL NOT NULL DEFAULT 1.0,
            room_id TEXT,
            placed_by TEXT,
            placed_at REAL NOT NULL,
            metadata TEXT
        )
    """)

    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_placed_props_room
        ON placed_props(room_id)
    """)

    # ========================================
    # v18: Claude Processes
    # ========================================
    await db.execute("""
        CREATE TABLE IF NOT EXISTS claude_processes (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            project_path TEXT,
            model TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            started_at REAL,
            finished_at REAL,
            message TEXT,
            output TEXT,
            metadata TEXT
        )
    """)

    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_claude_processes_status
        ON claude_processes(status)
    """)

    # ========================================
    # v19: Project Agents (agent templates per room)
    # ========================================
    await db.execute("""
        CREATE TABLE IF NOT EXISTS project_agents (
            id TEXT PRIMARY KEY,
            room_id TEXT NOT NULL,
            name TEXT NOT NULL,
            cwd TEXT NOT NULL,
            startup_prompt TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
        )
    """)

    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_project_agents_room
        ON project_agents(room_id)
    """)

    # Advance schema version
    await db.execute(
        """
        INSERT OR REPLACE INTO schema_version (version)
        VALUES (?)
    """,
        (SCHEMA_VERSION,),
    )

    await db.commit()
    logger.debug("Schema migrations applied (version %d)", SCHEMA_VERSION)
