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
