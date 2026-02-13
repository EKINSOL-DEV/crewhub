# CrewHub Demo Project

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
