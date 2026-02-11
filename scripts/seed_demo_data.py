#!/usr/bin/env python3
"""
Seed demo data for CrewHub v0.13.0 features.

Creates example data so all new features are immediately testable:
- Tasks with varied statuses, priorities, and history events
- PropMaker generation history (already populated if you've used it)
- Demo markdown files for agent file viewer
- Project documents

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

DB_PATH = Path(__file__).parent.parent / "data" / "crewhub.db"
GENERATION_HISTORY_PATH = Path(__file__).parent.parent / "backend" / "data" / "generation_history.json"
DEMO_DOCS_PATH = Path(__file__).parent.parent / "data" / "demo-docs"

def gen_id():
    return str(uuid.uuid4())

def now_ms():
    return int(time.time() * 1000)

def seed_tasks(db, project_id):
    """Add demo tasks with varied statuses and rich history."""
    cursor = db.cursor()
    
    # Check if demo tasks already exist
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
            "description": "Create 3 variants of the landing page: minimal, feature-rich, and storytelling. Use Figma or code-first approach.",
            "status": "in_progress",
            "priority": "medium",
            "assigned_session_key": "agent:main:main",
            "room_id": "creative-room",
        },
        {
            "title": "Demo: Write API documentation",
            "description": "Document all REST endpoints with examples, error codes, and authentication requirements. Use OpenAPI spec format.",
            "status": "review",
            "priority": "medium",
            "assigned_session_key": "agent:dev:main",
            "room_id": "dev-room",
        },
        {
            "title": "Demo: Performance audit",
            "description": "Profile the 3D scene rendering. Target: 60fps on M1 Mac with 50+ props. Check memory leaks, GPU usage, and bundle size.",
            "status": "todo",
            "priority": "urgent",
            "assigned_session_key": None,
            "room_id": "thinking-room",
        },
        {
            "title": "Demo: Onboarding tutorial flow",
            "description": "Interactive walkthrough for new users: create first room, add agent, assign task, see it execute. Should take <5 minutes.",
            "status": "blocked",
            "priority": "low",
            "assigned_session_key": None,
            "room_id": "headquarters",
        },
    ]
    
    ts = now_ms()
    for i, t in enumerate(tasks_data):
        task_id = gen_id()
        created_at = ts - (len(tasks_data) - i) * 3600000  # stagger by 1h each
        
        cursor.execute(
            """INSERT INTO tasks (id, project_id, room_id, title, description, status, priority, 
               assigned_session_key, created_by, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (task_id, project_id, t["room_id"], t["title"], t["description"],
             t["status"], t["priority"], t["assigned_session_key"],
             "agent:dev:main", created_at, created_at)
        )
        
        # Add history events
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
    
    # Only add if we need more examples
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
                {"type": "box", "position": [0, 0.02, 0.18], "args": [0.08, 0.04, 0.02], "color": "#B8860B", "emissive": False},
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
                {"type": "sphere", "position": [0, 0.9, 0.02], "args": [0.02, 8, 8], "color": "#39FF14", "emissive": True},
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
                {"type": "sphere", "position": [0.1, 0.7, -0.1], "args": [0.04, 8, 8], "color": "#FFFFFF", "emissive": False},
                {"type": "box", "position": [0, 0.1, 0.18], "args": [0.1, 0.16, 0.02], "color": "#654321", "emissive": False},
                {"type": "box", "position": [-0.12, 0.22, 0.19], "args": [0.06, 0.06, 0.01], "color": "#87CEEB", "emissive": False},
                {"type": "sphere", "position": [0, 0.05, 0.19], "args": [0.015, 6, 6], "color": "#FFD700", "emissive": True},
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
            "error": "Generation failed: Model attempted to use useFrame animation hook which is not supported in static prop generation. Props must be static geometry only.",
            "parts": [],
            "createdAt": now_ms() - 86400000 * 4,
        },
    ]
    
    # Don't duplicate
    existing_ids = {e.get("id") for e in existing}
    new_entries = [e for e in demo_entries if e["id"] not in existing_ids]
    
    if not new_entries:
        print("  ⏭  Demo generation history entries already exist")
        return
    
    combined = existing + new_entries
    with open(GENERATION_HISTORY_PATH, 'w') as f:
        json.dump(combined, f, indent=2)
    
    print(f"  ✅ Added {len(new_entries)} demo generation history entries (total: {len(combined)})")


def seed_demo_markdown_docs():
    """Create demo markdown files for the project docs viewer."""
    DEMO_DOCS_PATH.mkdir(parents=True, exist_ok=True)
    
    docs = {
        "README.md": """# CrewHub Demo Project

Welcome to the CrewHub demo! This project showcases the v0.13.0 features.

## Features

- **3D World** — Navigate rooms, interact with agents, place props
- **PropMaker** — Generate 3D props with AI from text descriptions
- **Task Management** — Create, assign, and track tasks across rooms
- **Session History** — Browse archived agent conversations with search & filter
- **Markdown Viewer** — Read and edit project documentation

## Quick Start

1. Open the Zen panel and check **Activity** for running tasks
2. Visit the **Creator Room** to try PropMaker
3. Browse **Sessions** to see conversation history
4. Open any `.md` file in the file browser to test the editor

## Architecture

```
frontend/   — React + Three.js (Vite)
backend/    — FastAPI + SQLite
data/       — Database and generated content
```
""",
        "CHANGELOG.md": """# Changelog

## v0.13.0 (Upcoming)

### ✨ New Features
- Fullscreen detail views for Activity and Sessions
- Fullscreen PropMaker with history tab
- Markdown viewer/editor for agent files and project docs
- Enhanced session detail panel with token usage and metadata
- Activity detail panel with rich event history

### 🐛 Bug Fixes
- Fixed session sort order in history view
- Fixed PropMaker preview not loading for some geometry types
- Fixed markdown editor save not persisting changes

### 🔧 Improvements
- Added search/filter to fullscreen session view
- Auto-scroll toggle in session history
- Better token usage formatting (K/M suffixes)

## v0.12.0

### ✨ New Features
- Zen mode with split panels
- Room assignment rules
- Custom blueprints

## v0.11.0

### ✨ New Features
- Session history browser
- Agent file viewer
- Project documents API
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
- **Zen Mode** — 2D panels for task management and sessions
- **PropMaker** — AI-powered 3D prop generation
- **CrewBar** — Navigation and quick actions

### Backend
- **Sessions API** — List, view, manage agent sessions
- **Tasks API** — CRUD for tasks with project history
- **History API** — Archived session browser with search
- **Creator API** — PropMaker generation and history
- **Agent Files API** — Browse workspace markdown files
- **SSE** — Real-time event streaming to frontend

### Database
- SQLite with versioned schema migrations
- Tables: rooms, agents, tasks, projects, project_history, settings, connections

## Security Model
- Local-first: runs on your machine
- No cloud dependency (except AI model APIs)
- Agent workspaces are sandboxed per-agent
""",
        "guides/getting-started.md": """# Getting Started with CrewHub

## Prerequisites

- Node.js 18+
- Python 3.11+
- OpenClaw CLI installed and configured

## Installation

```bash
# Clone the repo
git clone https://github.com/ekinsolbot/crewhub.git
cd crewhub

# Start everything
make dev
```

## First Steps

### 1. Create a Room
Click on the empty plot in the 3D world to create your first room. Give it a name and pick a theme.

### 2. Add an Agent
Agents are automatically discovered from your OpenClaw connections. Assign one to your room.

### 3. Create a Task
Open the Zen panel → Activity tab → New Task. Describe what you want done.

### 4. Watch It Work
The agent picks up the task and starts working. Watch the session history in real-time.

### 5. Try PropMaker
Visit the Creator room. Type a description like "a cozy fireplace" and watch a 3D prop appear!

## Tips

- Use **fullscreen mode** (⤢ icon) on any detail panel for a better view
- **Search** sessions with the filter bar in fullscreen
- **Sort** messages oldest-first or newest-first
- Check **token usage** in session details to monitor costs
""",
    }
    
    created = 0
    for filename, content in docs.items():
        filepath = DEMO_DOCS_PATH / filename
        filepath.parent.mkdir(parents=True, exist_ok=True)
        if not filepath.exists():
            filepath.write_text(content)
            created += 1
    
    if created:
        print(f"  ✅ Created {created} demo markdown documents in {DEMO_DOCS_PATH}")
    else:
        print(f"  ⏭  Demo documents already exist")


def set_project_docs_path(db, project_name="CrewHub"):
    """Set docs_path on the CrewHub project if the column exists."""
    cursor = db.cursor()
    
    # Check if docs_path column exists
    cursor.execute("PRAGMA table_info(projects)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if "docs_path" not in columns:
        # Add it (schema migration v11)
        try:
            cursor.execute("ALTER TABLE projects ADD COLUMN docs_path TEXT")
            db.commit()
            print("  ✅ Added docs_path column to projects table")
        except Exception as e:
            print(f"  ⚠️  Could not add docs_path column: {e}")
            return
    
    # Set docs_path for CrewHub project
    cursor.execute("SELECT id FROM projects WHERE name = ?", (project_name,))
    row = cursor.fetchone()
    if row:
        cursor.execute("UPDATE projects SET docs_path = ? WHERE id = ?",
                       (str(DEMO_DOCS_PATH), row[0]))
        db.commit()
        print(f"  ✅ Set docs_path for '{project_name}' → {DEMO_DOCS_PATH}")
    else:
        print(f"  ⚠️  Project '{project_name}' not found")


def reset_demo_data(db):
    """Remove previously seeded demo data."""
    cursor = db.cursor()
    
    # Remove demo tasks and their history
    cursor.execute("SELECT id FROM tasks WHERE title LIKE 'Demo:%'")
    demo_task_ids = [row[0] for row in cursor.fetchall()]
    
    for tid in demo_task_ids:
        cursor.execute("DELETE FROM project_history WHERE task_id = ?", (tid,))
        cursor.execute("DELETE FROM tasks WHERE id = ?", (tid,))
    
    db.commit()
    
    # Remove demo generation history entries
    if GENERATION_HISTORY_PATH.exists():
        with open(GENERATION_HISTORY_PATH) as f:
            entries = json.load(f)
        filtered = [e for e in entries if not e.get("id", "").startswith("demo-")]
        with open(GENERATION_HISTORY_PATH, 'w') as f:
            json.dump(filtered, f, indent=2)
    
    print(f"  🗑  Removed {len(demo_task_ids)} demo tasks and associated history")


def main():
    reset = "--reset" in sys.argv
    
    print("🌱 CrewHub v0.13.0 Demo Data Seeder")
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
    
    # Get default project
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
    
    # Seed each category
    print("📋 Tasks & History...")
    seed_tasks(db, project_id)
    
    print("🎨 PropMaker Generation History...")
    seed_generation_history()
    
    print("📝 Demo Markdown Documents...")
    seed_demo_markdown_docs()
    
    print("🔗 Project docs_path...")
    set_project_docs_path(db, project_name)
    
    db.close()
    
    print()
    print("✅ Done! Demo content is ready.")
    print()
    print("📖 What to try:")
    print("   • Zen → Activity panel: See tasks with varied statuses")
    print("   • Click a task → Fullscreen: Rich history with events")  
    print("   • Zen → Sessions panel: Browse archived conversations")
    print("   • Click a session → Fullscreen: Search, sort, scroll")
    print("   • Creator Room → PropMaker: Check history tab (3+ items)")
    print("   • File browser: Open agent .md files or project docs")
    print("   • Markdown editor: Edit and save demo documents")


if __name__ == "__main__":
    main()
