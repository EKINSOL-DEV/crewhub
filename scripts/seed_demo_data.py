#!/usr/bin/env python3
"""
Seed demo data for CrewHub v0.15.0 features.

Creates example data so all new features are immediately testable:
- Tasks with varied statuses, priorities, and history events
- PropMaker generation history
- Demo markdown files for agent file viewer
- Project documents
- AI Meeting history with turns, action items, and output markdown
- Bot/agent room assignments for pathfinding demo

Usage:
    python3 scripts/seed_demo_data.py [--reset]

Options:
    --reset    Remove existing demo data before seeding
"""

import json
import os
import sys
import time
import uuid
import sqlite3
from pathlib import Path

DB_PATH = Path(os.path.expanduser("~/.crewhub/crewhub.db"))
GENERATION_HISTORY_PATH = Path(__file__).parent.parent / "backend" / "data" / "generation_history.json"
DEMO_DOCS_PATH = Path(__file__).parent.parent / "data" / "demo-docs"
MEETING_OUTPUT_PATH = Path(__file__).parent.parent / "data" / "meeting-outputs"

def gen_id():
    return str(uuid.uuid4())

def now_ms():
    return int(time.time() * 1000)

# ─────────────────────────────────────────────────────────────────────
# Tasks
# ─────────────────────────────────────────────────────────────────────

def seed_tasks(db, project_id):
    """Add demo tasks with varied statuses and rich history."""
    cursor = db.cursor()
    
    cursor.execute("SELECT count(*) FROM tasks WHERE title LIKE 'Demo:%'")
    if cursor.fetchone()[0] > 0:
        print("  ⏭  Demo tasks already exist, skipping")
        return
    
    tasks_data = [
        {
            "title": "Demo: Build authentication system",
            "description": "Implement JWT-based auth with login, register, and refresh tokens. Include rate limiting and CSRF protection.",
            "status": "done",
            "priority": "high",
            "assigned_session_key": "agent:dev:main",
            "room_id": "dev-room",
        },
        {
            "title": "Demo: Design landing page mockups",
            "description": "Create 3 variants of the landing page: minimal, feature-rich, and storytelling approach.",
            "status": "in_progress",
            "priority": "medium",
            "assigned_session_key": "agent:main:main",
            "room_id": "creative-room",
        },
        {
            "title": "Demo: Write API documentation",
            "description": "Document all REST endpoints with examples, error codes, and authentication requirements.",
            "status": "review",
            "priority": "medium",
            "assigned_session_key": "agent:dev:main",
            "room_id": "dev-room",
        },
        {
            "title": "Demo: Performance audit for 3D rendering",
            "description": "Profile the 3D scene rendering. Target: 60fps on M1 Mac with 50+ props. Check memory leaks and GPU usage.",
            "status": "todo",
            "priority": "urgent",
            "assigned_session_key": None,
            "room_id": "thinking-room",
        },
        {
            "title": "Demo: Onboarding tutorial flow",
            "description": "Interactive walkthrough for new users: create room, add agent, assign task.",
            "status": "blocked",
            "priority": "low",
            "assigned_session_key": None,
            "room_id": "headquarters",
        },
        {
            "title": "Demo: Set up AI Meeting agenda templates",
            "description": "Create reusable meeting templates for standups, retrospectives, and brainstorming sessions. Integrate with the new AI Meetings feature.",
            "status": "in_progress",
            "priority": "high",
            "assigned_session_key": "agent:main:main",
            "room_id": "headquarters",
        },
        {
            "title": "Demo: Configure bot pathfinding routes",
            "description": "Set up navigation meshes between rooms for bot pathfinding. Test smooth transitions and collision avoidance.",
            "status": "todo",
            "priority": "medium",
            "assigned_session_key": "agent:dev:main",
            "room_id": "dev-room",
        },
    ]
    
    ts = now_ms()
    for i, t in enumerate(tasks_data):
        task_id = gen_id()
        created_at = ts - (len(tasks_data) - i) * 3600000
        
        cursor.execute(
            """INSERT INTO tasks (id, project_id, room_id, title, description, status, priority, 
               assigned_session_key, created_by, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (task_id, project_id, t["room_id"], t["title"], t["description"],
             t["status"], t["priority"], t["assigned_session_key"],
             "agent:dev:main", created_at, created_at)
        )
        
        _add_history(cursor, project_id, task_id, "task_created", created_at, 
                     "agent:dev:main", {"title": t["title"], "status": "todo"})
        
        if t["assigned_session_key"]:
            _add_history(cursor, project_id, task_id, "task_assigned", created_at + 60000,
                         "agent:dev:main", {"assigned_to": t["assigned_session_key"]})
        
        if t["status"] != "todo":
            _add_history(cursor, project_id, task_id, "task_status_changed", created_at + 300000,
                         t["assigned_session_key"] or "agent:dev:main",
                         {"from": "todo", "to": t["status"]})
    
    db.commit()
    print(f"  ✅ Added {len(tasks_data)} demo tasks with history events")


def _add_history(cursor, project_id, task_id, event_type, ts, actor, payload):
    cursor.execute(
        """INSERT INTO project_history (id, project_id, task_id, event_type, actor_session_key, payload_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (gen_id(), project_id, task_id, event_type, actor, json.dumps(payload), ts)
    )

# ─────────────────────────────────────────────────────────────────────
# PropMaker Generation History
# ─────────────────────────────────────────────────────────────────────

def seed_generation_history():
    """Ensure PropMaker has diverse generation history examples."""
    if GENERATION_HISTORY_PATH.exists():
        with open(GENERATION_HISTORY_PATH) as f:
            existing = json.load(f)
        if len(existing) >= 5:
            print(f"  ⏭  Generation history already has {len(existing)} items, skipping")
            return
    else:
        existing = []
    
    demo_entries = [
        {
            "id": "demo-001",
            "prompt": "A medieval treasure chest overflowing with gold coins",
            "name": "MedievalTreasureChest",
            "model": "sonnet-4",
            "modelLabel": "Sonnet 4",
            "method": "ai",
            "status": "success",
            "parts": [
                {"type": "box", "position": [0, 0.15, 0], "args": [0.5, 0.3, 0.35], "color": "#8B6238", "emissive": False},
                {"type": "box", "position": [0, 0.35, 0], "args": [0.52, 0.05, 0.37], "color": "#654321", "emissive": False},
                {"type": "cylinder", "position": [0, 0.4, 0], "args": [0.26, 0.26, 0.15, 12], "color": "#8B6238", "emissive": False},
                {"type": "sphere", "position": [0, 0.42, 0], "args": [0.08, 8, 8], "color": "#FFD700", "emissive": True},
                {"type": "sphere", "position": [-0.1, 0.38, 0.05], "args": [0.05, 8, 8], "color": "#FFD700", "emissive": True},
                {"type": "sphere", "position": [0.12, 0.39, -0.03], "args": [0.06, 8, 8], "color": "#FFD700", "emissive": True},
            ],
            "createdAt": now_ms() - 86400000 * 3,
        },
        {
            "id": "demo-002",
            "prompt": "A futuristic holographic display terminal",
            "name": "HolographicTerminal",
            "model": "opus-4-6",
            "modelLabel": "Opus 4-6",
            "method": "ai",
            "status": "success",
            "parts": [
                {"type": "cylinder", "position": [0, 0.04, 0], "args": [0.25, 0.3, 0.08, 16], "color": "#333333", "emissive": False},
                {"type": "cylinder", "position": [0, 0.35, 0], "args": [0.03, 0.04, 0.55, 8], "color": "#555555", "emissive": False},
                {"type": "box", "position": [0, 0.7, 0], "args": [0.5, 0.35, 0.02], "color": "#1a1a2e", "emissive": False},
                {"type": "box", "position": [0, 0.7, 0.015], "args": [0.46, 0.31, 0.005], "color": "#00FFFF", "emissive": True},
            ],
            "createdAt": now_ms() - 86400000 * 2,
        },
        {
            "id": "demo-003",
            "prompt": "A cute mushroom house with a door and windows",
            "name": "MushroomHouse",
            "model": "sonnet-4",
            "modelLabel": "Sonnet 4",
            "method": "ai",
            "status": "success",
            "parts": [
                {"type": "cylinder", "position": [0, 0.2, 0], "args": [0.18, 0.2, 0.4, 12], "color": "#F5F5DC", "emissive": False},
                {"type": "sphere", "position": [0, 0.55, 0], "args": [0.35, 12, 12], "color": "#CC4444", "emissive": False},
                {"type": "sphere", "position": [-0.15, 0.65, 0.15], "args": [0.06, 8, 8], "color": "#FFFFFF", "emissive": False},
                {"type": "box", "position": [0, 0.1, 0.18], "args": [0.1, 0.16, 0.02], "color": "#654321", "emissive": False},
                {"type": "box", "position": [-0.12, 0.22, 0.19], "args": [0.06, 0.06, 0.01], "color": "#87CEEB", "emissive": False},
            ],
            "createdAt": now_ms() - 86400000,
        },
        {
            "id": "demo-fail-001",
            "prompt": "A working clock with moving hands",
            "name": "WorkingClock",
            "model": "sonnet-4",
            "modelLabel": "Sonnet 4",
            "method": "ai",
            "status": "error",
            "error": "Generation failed: Model attempted to use useFrame animation hook which is not supported in static prop generation.",
            "parts": [],
            "createdAt": now_ms() - 86400000 * 4,
        },
    ]
    
    existing_ids = {e.get("id") for e in existing}
    new_entries = [e for e in demo_entries if e["id"] not in existing_ids]
    
    if not new_entries:
        print("  ⏭  Demo generation history entries already exist")
        return
    
    combined = existing + new_entries
    with open(GENERATION_HISTORY_PATH, 'w') as f:
        json.dump(combined, f, indent=2)
    
    print(f"  ✅ Added {len(new_entries)} demo generation history entries (total: {len(combined)})")

# ─────────────────────────────────────────────────────────────────────
# Demo Markdown Documents
# ─────────────────────────────────────────────────────────────────────

def seed_demo_markdown_docs():
    """Create demo markdown files for the project docs viewer."""
    DEMO_DOCS_PATH.mkdir(parents=True, exist_ok=True)
    
    docs = {
        "README.md": """# CrewHub Demo Project

Welcome to the CrewHub demo! This project showcases v0.15.0 features.

## Features

- **3D World** — Navigate rooms, interact with agents, place props
- **PropMaker** — Generate 3D props with AI from text descriptions
- **Task Management** — Create, assign, and track tasks across rooms
- **AI Meetings** — Run structured multi-agent meetings with agendas
- **Post-Meeting Workflow** — Auto-generate action items and follow-ups
- **Bot Pathfinding** — Agents navigate between rooms with smooth movement
- **Session History** — Browse archived agent conversations with search & filter
- **Markdown Viewer** — Read and edit project documentation

## Quick Start

1. Open the Zen panel and check **Activity** for running tasks
2. Visit the **Creator Room** to try PropMaker
3. Start an **AI Meeting** from the Meetings panel
4. Browse **Sessions** to see conversation history
5. Watch bots **navigate** between rooms in the 3D world

## Architecture

```
frontend/   — React + Three.js (Vite)
backend/    — FastAPI + SQLite
data/       — Database and generated content
```
""",
        "CHANGELOG.md": """# Changelog

## v0.15.0 (Current)

### ✨ New Features
- **AI Meetings** — Structured multi-agent meetings with rounds and turns
- **Post-Meeting Workflow** — Automatic action item extraction and task creation
- **Bot Pathfinding** — Smooth agent navigation between rooms in 3D world
- Meeting output markdown with full transcript and summaries
- Action items with assignees, priorities, and status tracking

### 🐛 Bug Fixes
- Fixed meeting state transitions during error recovery
- Fixed bot position reset on room change
- Fixed markdown viewer scroll position on document switch

### 🔧 Improvements
- Meeting participant selection with agent icons
- Pathfinding collision avoidance between multiple bots
- Enhanced meeting output formatting

## v0.13.0

### ✨ New Features
- Fullscreen detail views for Activity and Sessions
- Fullscreen PropMaker with history tab
- Markdown viewer/editor for agent files and project docs
- Enhanced session detail panel with token usage and metadata

## v0.12.0

### ✨ New Features
- Zen mode with split panels
- Room assignment rules
- Custom blueprints
""",
        "ARCHITECTURE.md": """# CrewHub Architecture

## Overview

CrewHub is a 3D workspace for managing AI agents. It combines a React Three Fiber 3D frontend with a FastAPI backend that communicates with OpenClaw agent instances via WebSocket.

## Data Flow

```
User → 3D UI → React State → API Call → Backend → OpenClaw Gateway → Agent
                                                                      ↓
User ← 3D UI ← SSE Events ← Backend ← WebSocket ← Agent Response ←──┘
```

## Key Components

### Frontend
- **World3D** — Three.js scene with rooms, agents, props
- **Bot3D** — Agent avatars with pathfinding navigation
- **Zen Mode** — 2D panels for task management and sessions
- **PropMaker** — AI-powered 3D prop generation
- **Meetings** — AI meeting interface with round/turn visualization

### Backend
- **Sessions API** — List, view, manage agent sessions
- **Tasks API** — CRUD for tasks with project history
- **Meetings API** — Create, run, and manage AI meetings
- **Creator API** — PropMaker generation and history
- **Agent Files API** — Browse workspace markdown files
- **SSE** — Real-time event streaming to frontend

### Database
- SQLite with versioned schema migrations
- Tables: rooms, agents, tasks, projects, meetings, meeting_turns, meeting_action_items

## AI Meetings Architecture

```
Meeting Start → Gather Participants → Run Rounds
                                         ↓
                              For each participant:
                              Build context → Call AI → Store turn
                                         ↓
                              Extract Action Items → Generate Output MD
                                         ↓
                              Post-Meeting: Create tasks from action items
```
""",
        "guides/getting-started.md": """# Getting Started with CrewHub

## Prerequisites

- Node.js 18+
- Python 3.11+
- OpenClaw CLI installed and configured

## Installation

```bash
git clone https://github.com/ekinsolbot/crewhub.git
cd crewhub
make dev
```

## First Steps

### 1. Create a Room
Click on the empty plot in the 3D world to create your first room.

### 2. Add an Agent
Agents are auto-discovered from OpenClaw connections. Assign one to your room.

### 3. Create a Task
Open Zen panel → Activity → New Task. Describe what you want done.

### 4. Run an AI Meeting
Open Zen panel → Meetings → New Meeting. Select participants and set a goal.

### 5. Try PropMaker
Visit the Creator room. Type "a cozy fireplace" and watch a 3D prop appear!

### 6. Watch Bot Navigation
Assign a bot to a different room and watch it pathfind through the 3D world.
""",
        "guides/ai-meetings.md": """# AI Meetings Guide

## Overview

AI Meetings let you run structured discussions between multiple AI agents. Each meeting has a goal, participants, and runs in rounds where each agent takes turns contributing.

## Creating a Meeting

1. Open the **Meetings** panel in Zen mode
2. Click **New Meeting**
3. Set a **title** and **goal** (what should the meeting accomplish?)
4. Select **participants** (agents assigned to rooms)
5. Configure **rounds** (how many discussion rounds)
6. Click **Start**

## Meeting Flow

1. **Gathering** — Participants are assembled
2. **In Progress** — Agents take turns responding per round
3. **Completing** — Action items are extracted
4. **Completed** — Output markdown is generated

## Post-Meeting Workflow

After a meeting completes:
- **Action items** are extracted from the discussion
- Each action item has an assignee, priority, and description
- Click "Create Task" on any action item to turn it into a tracked task
- The meeting output is saved as a markdown file

## Tips

- Keep goals specific for better discussions
- 2-3 rounds is usually enough for focused topics
- Use different agent personas for diverse perspectives
- Review action items and create tasks for follow-up work
""",
    }
    
    created = 0
    for filename, content in docs.items():
        filepath = DEMO_DOCS_PATH / filename
        filepath.parent.mkdir(parents=True, exist_ok=True)
        if not filepath.exists():
            filepath.write_text(content)
            created += 1
        else:
            # Update existing files with v0.15.0 content
            filepath.write_text(content)
            created += 1
    
    if created:
        print(f"  ✅ Created/updated {created} demo markdown documents in {DEMO_DOCS_PATH}")
    else:
        print(f"  ⏭  Demo documents already exist")

# ─────────────────────────────────────────────────────────────────────
# AI Meetings Demo Data
# ─────────────────────────────────────────────────────────────────────

def seed_meetings(db, project_id):
    """Add demo AI meeting with turns, participants, action items, and output."""
    cursor = db.cursor()
    
    cursor.execute("SELECT count(*) FROM meetings WHERE title LIKE 'Demo:%'")
    if cursor.fetchone()[0] > 0:
        print("  ⏭  Demo meetings already exist, skipping")
        return
    
    ts = now_ms()
    
    # Meeting 1: Completed sprint planning
    meeting1_id = gen_id()
    meeting1_started = ts - 86400000 * 2  # 2 days ago
    meeting1_completed = meeting1_started + 600000  # 10 min later
    
    meeting1_output = """# Sprint Planning - v0.15.0 Features

**Date:** 2 days ago  
**Participants:** Dev, Main, Flowy  
**Goal:** Plan implementation priorities for v0.15.0 release  

## Discussion Summary

### Round 1

**Dev:** The AI Meetings backend is mostly complete. We need to focus on the post-meeting workflow — extracting action items and creating tasks automatically. I estimate 2-3 days for the full pipeline.

**Main:** I agree on prioritizing the post-meeting workflow. For the frontend, the meeting UI needs the turn visualization and the action item review panel. I can work on those in parallel.

**Flowy:** From a UX perspective, the meeting flow should feel natural. I suggest we add a progress indicator showing which round we're on and who's speaking next. Also, the action item extraction should present items for review before creating tasks.

### Round 2

**Dev:** Good point on the review step, Flowy. I'll add a "pending review" state for action items. Main, can you handle the participant selector with agent icons?

**Main:** Yes, I'll build the participant selector. For pathfinding, I think we should use A* on a simple grid rather than a navmesh — it's simpler and our room layout is grid-based anyway.

**Flowy:** A* sounds right. For the meeting output, let's generate clean markdown that can be viewed in our document viewer. I'll write the output template.

## Action Items

1. **[Dev]** Implement post-meeting action item extraction — High Priority
2. **[Main]** Build meeting participant selector UI — Medium Priority
3. **[Main]** Implement A* pathfinding for bot navigation — Medium Priority
4. **[Flowy]** Design meeting output markdown template — Low Priority
5. **[Dev]** Add action item review state before task creation — Medium Priority
"""

    MEETING_OUTPUT_PATH.mkdir(parents=True, exist_ok=True)
    output_path = str(MEETING_OUTPUT_PATH / "demo-sprint-planning.md")
    Path(output_path).write_text(meeting1_output)
    
    cursor.execute(
        """INSERT INTO meetings (id, title, goal, state, room_id, project_id, 
           output_md, output_path, current_round, current_turn,
           started_at, completed_at, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (meeting1_id, "Demo: Sprint Planning - v0.15.0 Features",
         "Plan implementation priorities for v0.15.0 release",
         "completed", "headquarters", project_id,
         meeting1_output, output_path, 2, 6,
         meeting1_started, meeting1_completed, "user", meeting1_started)
    )
    
    # Participants
    participants = [
        ("dev", "Dev", "🤖", "#4CAF50"),
        ("main", "Main", "🧠", "#2196F3"),
        ("flowy", "Flowy", "🎨", "#FF9800"),
    ]
    for i, (aid, name, icon, color) in enumerate(participants):
        cursor.execute(
            """INSERT INTO meeting_participants (meeting_id, agent_id, agent_name, agent_icon, agent_color, sort_order)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (meeting1_id, aid, name, icon, color, i)
        )
    
    # Turns (2 rounds × 3 participants = 6 turns)
    turn_texts = [
        "The AI Meetings backend is mostly complete. We need to focus on the post-meeting workflow — extracting action items and creating tasks automatically. I estimate 2-3 days for the full pipeline.",
        "I agree on prioritizing the post-meeting workflow. For the frontend, the meeting UI needs the turn visualization and the action item review panel. I can work on those in parallel.",
        "From a UX perspective, the meeting flow should feel natural. I suggest we add a progress indicator showing which round we're on and who's speaking next.",
        "Good point on the review step, Flowy. I'll add a \"pending review\" state for action items. Main, can you handle the participant selector with agent icons?",
        "Yes, I'll build the participant selector. For pathfinding, I think we should use A* on a simple grid rather than a navmesh — it's simpler and our room layout is grid-based anyway.",
        "A* sounds right. For the meeting output, let's generate clean markdown that can be viewed in our document viewer. I'll write the output template.",
    ]
    
    for ti, text in enumerate(turn_texts):
        round_num = ti // 3
        turn_in_round = ti % 3
        agent = participants[turn_in_round]
        turn_time = meeting1_started + (ti + 1) * 90000
        
        cursor.execute(
            """INSERT INTO meeting_turns (id, meeting_id, round_num, turn_index, agent_id, agent_name,
               prompt_tokens, response_tokens, response_text, started_at, completed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (gen_id(), meeting1_id, round_num, turn_in_round, agent[0], agent[1],
             850 + ti * 100, 180 + ti * 30, text,
             turn_time, turn_time + 15000)
        )
    
    # Action items
    action_items = [
        ("Implement post-meeting action item extraction", "dev", "high", "completed"),
        ("Build meeting participant selector UI", "main", "medium", "completed"),
        ("Implement A* pathfinding for bot navigation", "main", "medium", "pending"),
        ("Design meeting output markdown template", "flowy", "low", "completed"),
        ("Add action item review state before task creation", "dev", "medium", "pending"),
    ]
    
    for i, (text, assignee, priority, status) in enumerate(action_items):
        cursor.execute(
            """INSERT INTO meeting_action_items (id, meeting_id, text, assignee_agent_id, priority, status, sort_order, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (gen_id(), meeting1_id, text, assignee, priority, status, i, meeting1_completed, meeting1_completed)
        )
    
    # Meeting 2: In-progress brainstorm (shows active state)
    meeting2_id = gen_id()
    meeting2_started = ts - 3600000  # 1 hour ago
    
    cursor.execute(
        """INSERT INTO meetings (id, title, goal, state, room_id, project_id,
           current_round, current_turn, started_at, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (meeting2_id, "Demo: UX Brainstorm - Bot Animations",
         "Brainstorm visual feedback and animations for bot pathfinding",
         "completed", "creative-room", project_id,
         1, 2, meeting2_started, "user", meeting2_started)
    )
    
    for i, (aid, name, icon, color) in enumerate([participants[1], participants[2]]):
        cursor.execute(
            """INSERT INTO meeting_participants (meeting_id, agent_id, agent_name, agent_icon, agent_color, sort_order)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (meeting2_id, aid, name, icon, color, i)
        )
    
    # One turn for meeting 2
    cursor.execute(
        """INSERT INTO meeting_turns (id, meeting_id, round_num, turn_index, agent_id, agent_name,
           prompt_tokens, response_tokens, response_text, started_at, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (gen_id(), meeting2_id, 0, 0, "main", "Main",
         920, 245, "For bot pathfinding animations, I think we need three states: idle (subtle bobbing), walking (smooth glide with slight bounce), and arriving (settling animation). The path should be visualized with a subtle dotted line that fades as the bot moves along it.",
         meeting2_started + 30000, meeting2_started + 45000)
    )
    
    db.commit()
    print(f"  ✅ Added 2 demo meetings with turns, participants, and action items")

# ─────────────────────────────────────────────────────────────────────
# Agent Room Assignments (for pathfinding demo)
# ─────────────────────────────────────────────────────────────────────

def seed_agent_room_assignments(db):
    """Ensure agents have room assignments for pathfinding demo."""
    cursor = db.cursor()
    
    # Check if room_id column exists on agents
    cursor.execute("PRAGMA table_info(agents)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if "room_id" not in columns:
        print("  ⏭  Agents table has no room_id column, skipping room assignments")
        return
    
    assignments = {
        "dev": "dev-room",
        "main": "headquarters",
        "flowy": "creative-room",
        "creator": "creative-room",
        "reviewer": "thinking-room",
    }
    
    updated = 0
    for agent_id, room_id in assignments.items():
        cursor.execute("SELECT room_id FROM agents WHERE id = ?", (agent_id,))
        row = cursor.fetchone()
        if row and not row[0]:
            cursor.execute("UPDATE agents SET room_id = ? WHERE id = ?", (room_id, agent_id))
            updated += 1
    
    db.commit()
    if updated:
        print(f"  ✅ Assigned {updated} agents to rooms for pathfinding demo")
    else:
        print(f"  ⏭  Agent room assignments already set")

# ─────────────────────────────────────────────────────────────────────
# Project docs_path
# ─────────────────────────────────────────────────────────────────────

def set_project_docs_path(db, project_name="CrewHub"):
    """Set docs_path on the CrewHub project if the column exists."""
    cursor = db.cursor()
    
    cursor.execute("PRAGMA table_info(projects)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if "docs_path" not in columns:
        try:
            cursor.execute("ALTER TABLE projects ADD COLUMN docs_path TEXT")
            db.commit()
            print("  ✅ Added docs_path column to projects table")
        except Exception as e:
            print(f"  ⚠️  Could not add docs_path column: {e}")
            return
    
    cursor.execute("SELECT id FROM projects WHERE name = ?", (project_name,))
    row = cursor.fetchone()
    if row:
        cursor.execute("UPDATE projects SET docs_path = ? WHERE id = ?",
                       (str(DEMO_DOCS_PATH), row[0]))
        db.commit()
        print(f"  ✅ Set docs_path for '{project_name}' → {DEMO_DOCS_PATH}")
    else:
        print(f"  ⚠️  Project '{project_name}' not found")

# ─────────────────────────────────────────────────────────────────────
# Reset
# ─────────────────────────────────────────────────────────────────────

def reset_demo_data(db):
    """Remove previously seeded demo data."""
    cursor = db.cursor()
    
    # Remove demo tasks
    cursor.execute("SELECT id FROM tasks WHERE title LIKE 'Demo:%'")
    demo_task_ids = [row[0] for row in cursor.fetchall()]
    for tid in demo_task_ids:
        cursor.execute("DELETE FROM project_history WHERE task_id = ?", (tid,))
        cursor.execute("DELETE FROM tasks WHERE id = ?", (tid,))
    
    # Remove demo meetings
    cursor.execute("SELECT id FROM meetings WHERE title LIKE 'Demo:%'")
    demo_meeting_ids = [row[0] for row in cursor.fetchall()]
    for mid in demo_meeting_ids:
        cursor.execute("DELETE FROM meeting_turns WHERE meeting_id = ?", (mid,))
        cursor.execute("DELETE FROM meeting_action_items WHERE meeting_id = ?", (mid,))
        cursor.execute("DELETE FROM meeting_participants WHERE meeting_id = ?", (mid,))
        cursor.execute("DELETE FROM meetings WHERE id = ?", (mid,))
    
    db.commit()
    
    # Remove demo generation history entries
    if GENERATION_HISTORY_PATH.exists():
        with open(GENERATION_HISTORY_PATH) as f:
            entries = json.load(f)
        filtered = [e for e in entries if not e.get("id", "").startswith("demo-")]
        with open(GENERATION_HISTORY_PATH, 'w') as f:
            json.dump(filtered, f, indent=2)
    
    # Remove demo meeting outputs
    if MEETING_OUTPUT_PATH.exists():
        for f in MEETING_OUTPUT_PATH.glob("demo-*.md"):
            f.unlink()
    
    print(f"  🗑  Removed {len(demo_task_ids)} demo tasks, {len(demo_meeting_ids)} demo meetings")


# ─────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────

def main():
    reset = "--reset" in sys.argv
    
    print("🌱 CrewHub v0.15.0 Demo Data Seeder")
    print(f"   Database: {DB_PATH}")
    print()
    
    if not DB_PATH.exists():
        print("❌ Database not found. Start the backend first to initialize it.")
        sys.exit(1)
    
    db = sqlite3.connect(str(DB_PATH))
    
    if reset:
        print("🗑  Resetting demo data...")
        reset_demo_data(db)
        print()
    
    cursor = db.cursor()
    cursor.execute("SELECT id, name FROM projects LIMIT 1")
    row = cursor.fetchone()
    if not row:
        print("❌ No projects found. Create a project in CrewHub first.")
        db.close()
        sys.exit(1)
    
    project_id, project_name = row
    print(f"📦 Using project: {project_name} ({project_id})")
    print()
    
    print("📋 Tasks & History...")
    seed_tasks(db, project_id)
    
    print("🎨 PropMaker Generation History...")
    seed_generation_history()
    
    print("📝 Demo Markdown Documents...")
    seed_demo_markdown_docs()
    
    print("🤝 AI Meetings...")
    seed_meetings(db, project_id)
    
    print("🤖 Agent Room Assignments...")
    seed_agent_room_assignments(db)
    
    print("🔗 Project docs_path...")
    set_project_docs_path(db, project_name)
    
    db.close()
    
    print()
    print("✅ Done! Demo content is ready for v0.15.0.")
    print()
    print("📖 What to try:")
    print("   • Zen → Activity: See tasks with varied statuses (including new v0.15.0 tasks)")
    print("   • Zen → Meetings: Browse completed sprint planning meeting")
    print("   • Click meeting → See turns, action items, output markdown")
    print("   • Creator Room → PropMaker: Check history tab")
    print("   • File browser: Open project docs (updated for v0.15.0)")
    print("   • 3D World: Watch bots navigate between rooms")


if __name__ == "__main__":
    main()
