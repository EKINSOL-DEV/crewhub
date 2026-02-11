# CrewHub Demo Project

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
