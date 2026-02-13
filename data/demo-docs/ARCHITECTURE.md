# CrewHub Architecture

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
