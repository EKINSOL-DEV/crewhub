"""Seed data functions for CrewHub database."""
import logging

import aiosqlite

from .schema import DB_PATH, DEMO_MODE

logger = logging.getLogger(__name__)


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
                await _seed_demo_threads(db, now)

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


async def _seed_demo_threads(db, now: int):
    """Seed demo thread/chat data so mobile views look populated."""
    import uuid

    hour = 3_600_000
    min_ = 60_000

    # ── Thread 1: Direct — user ↔ Developer ──────────────────────────────────
    t1_created = now - 3 * hour
    t1_last    = now - 30 * min_

    await db.execute("""
        INSERT OR IGNORE INTO threads
            (id, kind, title, title_auto, created_by, created_at, updated_at, last_message_at, settings_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, ('thread-dev-direct', 'direct', 'Developer', None, 'user',
          t1_created, now, t1_last, '{}'))

    await db.execute("""
        INSERT OR IGNORE INTO thread_participants
            (id, thread_id, agent_id, agent_name, agent_icon, agent_color, role, is_active, joined_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, ('tp-dev-direct-dev', 'thread-dev-direct',
          'dev', 'Developer', '💻', '#10b981', 'owner', 1, t1_created))

    t1_messages = [
        (now - 3*hour,            'user',      None,  'You',       "Hey, how's the WebSocket reconnect logic coming along?"),
        (now - 2*hour - 40*min_,  'assistant', 'dev', 'Developer', "Good progress! Implemented exponential backoff with jitter. Base delay 1s, max 30s. Should handle flaky connections gracefully 🔄"),
        (now - 2*hour,            'user',      None,  'You',       "Nice. What about the edge case where the server restarts mid-session?"),
        (now - 1*hour - 30*min_,  'assistant', 'dev', 'Developer', "Covered — I'm using a sequence token so the client knows if it missed events. If gap is too large, it does a full re-sync instead of replaying. Tests passing ✅"),
        (now - 1*hour,            'user',      None,  'You',       "Perfect. Can you start on the auth module next?"),
        (now - 30*min_,           'assistant', 'dev', 'Developer', "On it. I'll start with the device keypair approach — Ed25519, same as OpenClaw uses. Should have a draft by end of day 💻"),
    ]
    for ts, role, agent_id, agent_name, content in t1_messages:
        await db.execute("""
            INSERT OR IGNORE INTO thread_messages
                (id, thread_id, role, content, agent_id, agent_name, routing_mode, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (str(uuid.uuid4()), 'thread-dev-direct',
              role, content, agent_id, agent_name, 'broadcast', ts))

    await db.execute(
        "UPDATE threads SET last_message_at = ? WHERE id = 'thread-dev-direct'",
        (t1_last,))

    # ── Thread 2: Direct — user ↔ Flowy ──────────────────────────────────────
    t2_created = now - 5 * hour
    t2_last    = now - 2 * hour

    await db.execute("""
        INSERT OR IGNORE INTO threads
            (id, kind, title, title_auto, created_by, created_at, updated_at, last_message_at, settings_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, ('thread-flowy-direct', 'direct', 'Flowy', None, 'user',
          t2_created, now, t2_last, '{}'))

    await db.execute("""
        INSERT OR IGNORE INTO thread_participants
            (id, thread_id, agent_id, agent_name, agent_icon, agent_color, role, is_active, joined_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, ('tp-flowy-direct-flowy', 'thread-flowy-direct',
          'flowy', 'Flowy', '🎨', '#ec4899', 'owner', 1, t2_created))

    t2_messages = [
        (now - 5*hour,            'user',      None,    'You',   "Can you review the landing page copy?"),
        (now - 4*hour - 30*min_,  'assistant', 'flowy', 'Flowy', "Just went through it! Hero headline is strong but the feature section feels a bit technical. Let me rewrite it for a broader audience 🎨"),
        (now - 4*hour,            'user',      None,    'You',   "What's your suggested headline for the features section?"),
        (now - 3*hour - 30*min_,  'assistant', 'flowy', 'Flowy', "How about: *'Your agents, alive'* — then subhead: 'Watch your AI team collaborate in real-time from a living 3D world.' Short, visual, memorable."),
        (now - 3*hour,            'user',      None,    'You',   "Love it. What about the CTA?"),
        (now - 2*hour,            'assistant', 'flowy', 'Flowy', "Changed 'Get Started' to 'Meet Your Crew' — more on-brand and intriguing. Also added a secondary CTA: 'Watch a demo' → links to demo.crewhub.dev 🚀"),
    ]
    for ts, role, agent_id, agent_name, content in t2_messages:
        await db.execute("""
            INSERT OR IGNORE INTO thread_messages
                (id, thread_id, role, content, agent_id, agent_name, routing_mode, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (str(uuid.uuid4()), 'thread-flowy-direct',
              role, content, agent_id, agent_name, 'broadcast', ts))

    await db.execute(
        "UPDATE threads SET last_message_at = ? WHERE id = 'thread-flowy-direct'",
        (t2_last,))

    # ── Thread 3: Direct — user ↔ Reviewer ───────────────────────────────────
    t3_created = now - 2 * hour
    t3_last    = now - 45 * min_

    await db.execute("""
        INSERT OR IGNORE INTO threads
            (id, kind, title, title_auto, created_by, created_at, updated_at, last_message_at, settings_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, ('thread-reviewer-direct', 'direct', 'Reviewer', None, 'user',
          t3_created, now, t3_last, '{}'))

    await db.execute("""
        INSERT OR IGNORE INTO thread_participants
            (id, thread_id, agent_id, agent_name, agent_icon, agent_color, role, is_active, joined_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, ('tp-reviewer-direct-reviewer', 'thread-reviewer-direct',
          'reviewer', 'Reviewer', '🔍', '#8b5cf6', 'owner', 1, t3_created))

    t3_messages = [
        (now - 2*hour,            'user',      None,       'You',      "Did you finish the auth module review?"),
        (now - 1*hour - 40*min_,  'assistant', 'reviewer', 'Reviewer', "Done. Found 2 issues: (1) token expiry not validated on reconnect — easy fix. (2) Device ID stored in localStorage which is XSS-vulnerable — should move to sessionStorage or httpOnly cookie 🔍"),
        (now - 1*hour - 15*min_,  'user',      None,       'You',      "Good catches. Anything else?"),
        (now - 1*hour,            'assistant', 'reviewer', 'Reviewer', "Code structure is clean. The Ed25519 keypair approach is solid. One suggestion: add a `lastSeen` timestamp to device records for audit purposes."),
        (now - 50*min_,           'user',      None,       'You',      "Makes sense, I'll pass that to Dev."),
        (now - 45*min_,           'assistant', 'reviewer', 'Reviewer', "Already added it to the review comments on the PR. Dev has been notified ✅"),
    ]
    for ts, role, agent_id, agent_name, content in t3_messages:
        await db.execute("""
            INSERT OR IGNORE INTO thread_messages
                (id, thread_id, role, content, agent_id, agent_name, routing_mode, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (str(uuid.uuid4()), 'thread-reviewer-direct',
              role, content, agent_id, agent_name, 'broadcast', ts))

    await db.execute(
        "UPDATE threads SET last_message_at = ? WHERE id = 'thread-reviewer-direct'",
        (t3_last,))

    # ── Thread 4: Group — Team Standup ───────────────────────────────────────
    t4_created = now - 6 * hour
    t4_last    = now - 4 * hour

    await db.execute("""
        INSERT OR IGNORE INTO threads
            (id, kind, title, title_auto, created_by, created_at, updated_at, last_message_at, settings_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, ('thread-standup-group', 'group', 'Team Standup', None, 'user',
          t4_created, now, t4_last, '{}'))

    standup_participants = [
        ('tp-standup-main',     'main',     'Director', '🎯', '#4f46e5', 'owner'),
        ('tp-standup-dev',      'dev',      'Developer','💻', '#10b981', 'member'),
        ('tp-standup-flowy',    'flowy',    'Flowy',    '🎨', '#ec4899', 'member'),
        ('tp-standup-reviewer', 'reviewer', 'Reviewer', '🔍', '#8b5cf6', 'member'),
    ]
    for pid, agent_id, agent_name, agent_icon, agent_color, role in standup_participants:
        await db.execute("""
            INSERT OR IGNORE INTO thread_participants
                (id, thread_id, agent_id, agent_name, agent_icon, agent_color, role, is_active, joined_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (pid, 'thread-standup-group',
              agent_id, agent_name, agent_icon, agent_color, role, 1, t4_created))

    t4_messages = [
        (now - 6*hour,            'user',      None,       'You',       "Morning everyone! Quick standup — what's everyone working on today?"),
        (now - 6*hour + 10*min_,  'assistant', 'main',     'Director',  "Director here. Coordinating the v1.0 release checklist. Reviewing the roadmap items and making sure we're on track 🎯"),
        (now - 6*hour + 20*min_,  'assistant', 'dev',      'Developer', "Finishing up the WebSocket reconnect logic, then moving to auth module. Should have both done by EOD 💻"),
        (now - 6*hour + 30*min_,  'assistant', 'flowy',    'Flowy',     "Landing page copy rewrite + finishing the onboarding wizard designs. Almost ready for review 🎨"),
        (now - 6*hour + 40*min_,  'assistant', 'reviewer', 'Reviewer',  "Wrapping up the auth review. Found some good stuff. Will post the summary in #dev 🔍"),
        (now - 5*hour - 20*min_,  'user',      None,       'You',       "Great! Any blockers?"),
        (now - 5*hour,            'assistant', 'dev',      'Developer', "No blockers. The backoff algorithm was the tricky part, that's done now."),
        (now - 4*hour - 40*min_,  'assistant', 'flowy',    'Flowy',     "Need final approval on the color palette for onboarding. Can someone take a look at the Figma link I shared yesterday?"),
        (now - 4*hour - 20*min_,  'assistant', 'main',     'Director',  "I'll review it after standup. Anything else before we wrap?"),
        (now - 4*hour,            'user',      None,       'You',       "That's it! Let's ship it 🚀"),
    ]
    for ts, role, agent_id, agent_name, content in t4_messages:
        await db.execute("""
            INSERT OR IGNORE INTO thread_messages
                (id, thread_id, role, content, agent_id, agent_name, routing_mode, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (str(uuid.uuid4()), 'thread-standup-group',
              role, content, agent_id, agent_name, 'broadcast', ts))

    await db.execute(
        "UPDATE threads SET last_message_at = ? WHERE id = 'thread-standup-group'",
        (t4_last,))
