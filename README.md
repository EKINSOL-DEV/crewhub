<p align="center">
  <img src="frontend/public/logo.svg" width="120" alt="CrewHub">
</p>

<h1 align="center">CrewHub</h1>

<p align="center">
  <strong>Your AI crew, one dashboard.</strong><br>
  Real-time monitoring, room management, and visual playground for AI agent sessions.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-v0.7.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-green" alt="License">
  <a href="https://discord.gg/Bfupkmvp"><img src="https://img.shields.io/badge/Discord-Join%20Server-5865F2?logo=discord&logoColor=white" alt="Discord"></a>
  <img src="https://img.shields.io/badge/react-19-61dafb" alt="React">
  <img src="https://img.shields.io/badge/fastapi-0.100+-009688" alt="FastAPI">
  <img src="https://img.shields.io/badge/docker-ready-2496ED" alt="Docker">
</p>

---

## ✨ Features

- 🔴 **Real-time Monitoring** — Live session updates via Server-Sent Events (SSE)
- ⚡ **Centralized SSE** — Single connection manager with fan-out
- 🏠 **Rooms System** — Organize agents into workspaces with drag & drop
- 🏠 **Room Context** — Deduplicated data fetching
- 🃏 **Cards View** — Filter agents by status: Active, Idle, Working, Error, and more
- 📜 **Log Viewer** — Search, browse, and export chat history
- 🔗 **Connections Manager** — Configure OpenClaw, Claude Code, and Codex integrations
- 🎨 **Agent Design Lab** — 5 custom bot SVGs with unique personalities
- 🌐 **3D Bot Playground** — Three.js isometric view of your agent fleet
- 🔍 **Click-to-Detail Panels** — Inspect any agent's info, stats, and activity
- 🏷️ **Custom Display Names** — Name your agents and set room routing rules
- ⏰ **Cron Jobs View** — Monitor scheduled and recurring agent tasks
- 📊 **Session History** — Full archive with search and filtering
- 🌙 **Dark/Light Theme** — Plus customizable accent colors
- 🗺️ **Grid System** — 20×20 grid per room with blueprints, prop registry, and debug overlay
- 🤖 **Smart Bot Movement** — Natural random walk with obstacle avoidance
- 🎥 **Camera Orbit** — Rotate around focused bot in zoom level 3
- 💬 **Planner-style Chat** — Draggable/resizable chat windows with minimize bar
- ⚙️ **Settings Consolidation** — All thresholds configurable via Settings UI
- 🔄 **Live Room Refresh** — New rooms appear instantly without page reload
- 🧩 **Modding Foundation** — Registry\<T\> pattern, namespaced IDs, batch registration
- 📐 **JSON Blueprints** — Data-driven room layouts with Zod validation
- 🌍 **Data-driven Environments** — 3 themes, registry-based, extensible
- 📥 **Blueprint Import/Export API** — Full CRUD with validation
- 📚 **Documentation Site** — Starlight/Astro docs at [docs.crewhub.dev](https://docs.crewhub.dev)
- 🔒 **AGPL-3.0 License**
- 🔢 **Version Display** — Always know what you're running (v0.7.0)

## 📸 Screenshots

> _Screenshots coming soon — the dashboard looks better than we can describe._

<!--
<p align="center">
  <img src="docs/screenshots/dashboard.png" width="800" alt="CrewHub Dashboard">
  <img src="docs/screenshots/rooms.png" width="800" alt="Rooms View">
  <img src="docs/screenshots/playground.png" width="800" alt="3D Playground">
</p>
-->

## 🤖 Agent Types

CrewHub ships with 5 distinct bot personalities, each with a custom SVG design:

| Bot | Color | Role |
|-----|-------|------|
| 🔧 **Worker Bot** | 🟠 Orange | General task execution |
| 🧠 **Thinker Bot** | 🔵 Blue | Deep analysis & reasoning |
| ⏰ **Cron Bot** | 🟢 Green | Scheduled & recurring tasks |
| 💬 **Comms Bot** | 🟣 Purple | Communication & coordination |
| 💻 **Dev Bot** | 🔴 Red | Software development & coding |

Design your agents in the **Agent Design Lab** and watch them come alive in the **3D Bot Playground**.

## 🆕 What's New in v0.7.0

- 🏠 **Room floor & wall textures** — 6 floor styles + 4 wall styles with procedural GLSL shaders
- 🏜️ **Desert environment** — New theme with sand dunes, cacti, rocks, and tumbleweeds
- 🤖 **Agent bios** — Bio field for agents with pre-filled descriptions (schema v8)
- 🎯 **Agent Top Bar** — Boss button + pinned agent + agent picker dropdown
- 🚶 **Wandering bots** — Sleeping agents walk around campus between rooms
- 💬 **Activity bubbles** — Humanized task summaries from session labels above bots
- 🖱️ **Drag & drop in 3D** — Drag bots between rooms with status indicator
- 💻 **Working bots carry laptops** — Animated laptop with typing micro-pauses
- 🧪 **Comprehensive test suite** — 138 backend + 133 frontend + 7 E2E tests
- 🐛 **Many Bug Fixes** — Double render, camera, wandering bounds, and more

## 🔗 Compatibility

Works with:
- **[OpenClaw](https://openclaw.dev)** — Personal AI assistant platform
- **Claude Code** — Anthropic's CLI coding agent
- **ChatGPT Codex CLI** — OpenAI's coding agent

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, TypeScript, Tailwind CSS, Three.js |
| Backend | FastAPI (Python), SQLite |
| Real-time | Server-Sent Events (SSE) |
| Deployment | Docker, Docker Compose |

## 🚀 Quick Start

### Prerequisites

- [Docker](https://docker.com) and Docker Compose (recommended)
- OR Node.js 18+ and Python 3.11+
- Access to an OpenClaw Gateway

### Option 1: Docker (Recommended)

```bash
git clone https://github.com/ekinsolbot/crewhub.git
cd crewhub

cp .env.example .env
# Edit .env with your Gateway URL and token (see Configuration below)

make up
```

The dashboard will be available at **http://localhost:5180**

### Option 2: Local Development

```bash
git clone https://github.com/ekinsolbot/crewhub.git
cd crewhub
cp .env.example .env

make dev
```

## ⚙️ Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Required: OpenClaw Gateway connection
OPENCLAW_GATEWAY_URL=ws://localhost:18789
OPENCLAW_GATEWAY_TOKEN=your_token_here  # Get from: openclaw gateway token

# Optional: Backend settings
BACKEND_PORT=8090
DEBUG=false

# Optional: Frontend API URL
VITE_API_URL=http://localhost:8090
```

### Getting Your Gateway Token

```bash
openclaw gateway token
```

### Docker Network Notes

When running in Docker, use these Gateway URLs:
- **macOS/Windows**: `ws://host.docker.internal:18789`
- **Linux**: `ws://172.17.0.1:18789` (or your host IP)

## 🌐 Ports

| Service  | Port | Description |
|----------|------|-------------|
| Frontend | 5180 | React dashboard UI |
| Backend  | 8090 | FastAPI server |

## 🧑‍💻 Development

```bash
make dev      # Start backend + frontend with hot-reload
make build    # Build Docker images
make up       # Start with Docker Compose
make down     # Stop all services
make logs     # View container logs
make test     # Run tests
```

### Project Structure

```
crewhub/
├── backend/           # Python FastAPI backend
│   ├── app/
│   │   ├── routes/    # API endpoints
│   │   ├── services/  # Business logic
│   │   └── config.py  # Settings
│   └── tests/
├── frontend/          # React + TypeScript frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── hooks/       # React hooks
│   │   └── lib/         # Utilities
│   └── public/          # Static assets & logo
└── docker-compose.yml
```

## 🎯 CrewBar

CrewHub includes **CrewBar**, a reusable floating chat component for AI agents. It provides draggable, resizable chat windows with status indicators — embeddable in any React app. See the `frontend/src/components/crewbar/` directory for details.

## 🧩 Modding

CrewHub v0.6.0 introduced a **modding foundation** designed for extensibility:

- **Registry\<T\> pattern** — A generic, type-safe registry for props, environments, blueprints, and more
- **Namespaced IDs** — All content uses `namespace:name` IDs (e.g. `core:desk`, `forest:tree`) to avoid conflicts
- **Batch registration** — Register multiple items at once via `registerAll()`
- **JSON Blueprints** — Room layouts are defined as JSON with Zod schema validation, making them easy to create, share, and import
- **Data-driven Environments** — Themes (default, forest, neon) are registry entries, not hardcoded — add your own by registering new environment configs

This foundation makes it possible to extend CrewHub with custom props, room layouts, and visual themes without modifying core code.

## 💬 Community

Join the CrewHub community on **[Discord](https://discord.gg/Bfupkmvp)** — chat with the team, get early access, and help shape the roadmap.

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

AGPL-3.0 — see [LICENSE](LICENSE)

---

<p align="center"><strong>Made with 🦀 by the OpenClaw community</strong></p>
