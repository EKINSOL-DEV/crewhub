<p align="center">
  <img src="frontend/public/logo.svg" width="120" alt="CrewHub">
</p>

<h1 align="center">CrewHub</h1>

<p align="center">
  <strong>Your AI crew, one dashboard.</strong><br>
  A real-time monitoring dashboard and interactive 3D world for your AI agent sessions.
</p>

<p align="center">
  <a href="https://crewhub.dev"><img src="https://img.shields.io/badge/Website-crewhub.dev-FF6B35?style=flat&logo=safari&logoColor=white" alt="Website"></a>
  <a href="https://docs.crewhub.dev"><img src="https://img.shields.io/badge/Docs-docs.crewhub.dev-4A90D9?style=flat&logo=readthedocs&logoColor=white" alt="Docs"></a>
  <img src="https://img.shields.io/badge/version-v0.7.1-blue" alt="Version">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-green" alt="License">
  <a href="https://discord.gg/Bfupkmvp"><img src="https://img.shields.io/badge/Discord-Join%20Server-5865F2?logo=discord&logoColor=white" alt="Discord"></a>
  <img src="https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white" alt="Docker">
</p>

---

## What is CrewHub?

CrewHub is an open-source dashboard for monitoring and managing AI coding agents. It connects to [OpenClaw](https://openclaw.dev), Claude Code, and Codex CLI — giving you a live overview of every session, room, and agent in one place. Its standout feature is a fully interactive **3D world** where your agents come alive as animated characters.

> 🎮 **Demo Mode coming soon**

---

## 🌍 3D World View — The Hero Feature

<p align="center">
  <em>Watch your agents roam a toon-shaded campus, carry laptops while coding, and wander between rooms when idle.</em>
</p>

CrewHub's 3D World turns your agent fleet into a living, breathing campus:

- **Toon-shaded rooms** on a 20×20 grid with floor & wall textures
- **3 zoom levels** — Overview → Room focus → Bot close-up with camera orbit
- **4 environments** — Grass, Island, Sky, and Desert — each with unique props and atmosphere
- **Animated bots** — Working agents type on laptops; idle agents wander the campus
- **Drag & drop in 3D** — Move bots between rooms with visual status indicators
- **Activity bubbles** — See what each agent is doing at a glance
- **Blueprints** — JSON-defined room layouts you can create, share, and import

---

## ✨ Features

### 📡 Monitoring
- **Real-time updates** via Server-Sent Events (SSE) — no polling, no delays
- **Cards view** with status filtering (Active, Idle, Working, Error, and more)
- **Session history** with full search and filtering
- **Cron jobs view** for scheduled and recurring agent tasks
- **Log viewer** with search, browse, and export

### 🏠 Rooms & Organization
- **Room management** with drag & drop agent assignment
- **Custom display names** and room routing rules
- **Live room refresh** — new rooms appear instantly, no reload needed
- **Connections manager** for OpenClaw, Claude Code, and Codex integrations

### 💬 Chat & Interaction
- **Planner-style chat windows** — draggable, resizable, and minimizable
- **Click-to-detail panels** — inspect any agent's info, stats, and activity
- **Agent bios** with pre-filled personality descriptions
- **Agent Top Bar** with boss button, pinned agent, and agent picker

### 🎨 Customization
- **Dark/light theme** with customizable accent colors
- **5 bot personalities** — Worker 🟠, Thinker 🔵, Cron 🟢, Comms 🟣, Dev 🔴
- **Settings UI** with backup & restore
- **Onboarding wizard** with auto-discovery _(in testing)_

### 🧩 Extensibility _(in testing)_
- **Modding support** — add custom props, environments, blueprints, and room layouts
- **Namespaced IDs** (`core:desk`, `desert:cactus`) to avoid conflicts
- **JSON blueprints** with schema validation for shareable room designs
- **Data-driven environments** — register your own themes without modifying core code

> 📖 Deep-dive into architecture and modding at **[docs.crewhub.dev](https://docs.crewhub.dev)**

---

## 🔗 Compatibility

Works with:
- **[OpenClaw](https://openclaw.dev)** — Personal AI assistant platform
- **Claude Code** — Anthropic's CLI coding agent
- **ChatGPT Codex CLI** — OpenAI's coding agent

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS, Three.js |
| Backend | FastAPI (Python), SQLite |
| Real-time | Server-Sent Events (SSE) |
| Deployment | Docker, Docker Compose |

---

## 🚀 Quick Start

### Prerequisites

- [Docker](https://docker.com) and Docker Compose (recommended)
- OR Node.js 18+ and Python 3.11+
- Access to an OpenClaw Gateway

### Option 1: Docker (Recommended)

```bash
git clone https://github.com/EKINSOL-DEV/crewhub.git
cd crewhub
make up
```

The dashboard will be available at **http://localhost:5180**. The onboarding wizard will guide you through connecting to your gateway.

### Option 2: Local Development

```bash
git clone https://github.com/EKINSOL-DEV/crewhub.git
cd crewhub
make dev
```

## ⚙️ Configuration

Copy `.env.example` to `.env`:

```bash
# Optional: Override default Gateway URL (default: ws://localhost:18789)
OPENCLAW_GATEWAY_URL=ws://localhost:18789

# Optional: Backend settings
BACKEND_PORT=8090
DEBUG=false
```

On first launch, the **onboarding wizard** will auto-detect your OpenClaw installation and configure the connection — including the gateway token. No manual token setup needed.

### Docker Network Notes

When running in Docker, set the Gateway URL to reach your host:
- **macOS/Windows**: `ws://host.docker.internal:18789`
- **Linux**: `ws://172.17.0.1:18789` (or your host IP)

## 🌐 Ports

| Service  | Port | Description |
|----------|------|-------------|
| Frontend | 5180 | React dashboard UI |
| Backend  | 8090 | FastAPI server |

---

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

---

## 💬 Community

Join us on **[Discord](https://discord.gg/Bfupkmvp)** — chat with the team, get early access, and help shape the roadmap.

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

> **Note:** This project uses a Contributor License Agreement (CLA). You'll be asked to sign it when opening your first pull request.

CrewHub is licensed under **AGPL-3.0**, which means any modified version that's served over a network must also be open-sourced under the same license. Keep this in mind when building on top of CrewHub.

## 📄 License

AGPL-3.0 — see [LICENSE](LICENSE)

---

<p align="center"><strong>Made by <a href="https://ekinsol.be">EKINSOL</a></strong></p>
