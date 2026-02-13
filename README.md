<p align="center">
  <img src="frontend/public/logo.svg" width="120" alt="CrewHub">
</p>

<h1 align="center">CrewHub</h1>

<p align="center">
  <strong>Your AI Team, One Dashboard</strong><br>
  Watch your AI agents collaborate in real-time, navigate a 3D office, and run actual structured meetings.
</p>

<p align="center">
  <a href="https://crewhub.dev"><img src="https://img.shields.io/badge/Website-crewhub.dev-FF6B35?style=flat&logo=safari&logoColor=white" alt="Website"></a>
  <a href="https://demo.crewhub.dev"><img src="https://img.shields.io/badge/Live%20Demo-demo.crewhub.dev-14B8A6?style=flat&logo=rocket&logoColor=white" alt="Demo"></a>
  <img src="https://img.shields.io/badge/version-v0.15.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-green" alt="License">
  <a href="https://discord.gg/Bfupkmvp"><img src="https://img.shields.io/badge/Discord-Join%20Server-5865F2?logo=discord&logoColor=white" alt="Discord"></a>
  <img src="https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white" alt="Docker">
</p>

---

## What is CrewHub?

CrewHub is an **open-source monitoring dashboard** for AI coding agents. It connects to [OpenClaw](https://openclaw.dev), Claude Code, and Codex CLI — giving you live visibility into every agent, session, and task.

But CrewHub isn't just another dashboard. Your agents come alive in a **fully interactive 3D world** where they walk between rooms, gather around meeting tables, and collaborate on structured discussions that produce real results.

> 🎮 **[Try the Live Demo →](https://demo.crewhub.dev)**

---

## ✨ What's New in v0.15.0

### 🤝 AI Meetings: Your Bots Actually Collaborate

Click a meeting table. Pick participants and a topic. Watch your bots **physically walk to the table, form a circle, and have a structured round-robin discussion**.

When the meeting ends, you get:
- ✅ **Structured summaries** organized by theme
- ✅ **Action items** with Execute/Add to Planner buttons
- ✅ **Documented decisions** so nothing gets lost
- ✅ **Follow-up meetings** that carry context forward automatically

This isn't just another chat interface. **It's your agents actually working together as a team.**

### 🗺️ Bot Pathfinding

Bots navigate through doors and hallways properly. No more wall-walking — they understand the space and move like they belong there.

### 🤖 Agent Identity Pattern

Single identity across all surfaces. Your Dev bot in the 3D world is the same Dev in chat, same Dev in tasks. The 3D avatar is a representation, not a different personality.

[Read the full v0.15.0 announcement →](https://crewhub.dev/blog/v0-15-0-released)

---

## 🌟 Core Features

### 🌍 3D World View

Watch your agents roam a toon-shaded campus with procedural rooms, animated bots, and multiple environments (Grass, Island, Sky, Desert).

**Interactions:**
- **3 zoom levels** — Overview → Room focus → Bot close-up
- **Click any bot** to see what they're working on
- **Drag & drop** agents between rooms
- **Activity bubbles** show current tasks in real-time

### 💬 AI Meetings

Run structured round-robin meetings where agents build on each other's contributions. Get organized output with action items that turn into executable tasks.

### 📋 Task Board (HQ)

Kanban-style board with columns: To Do, In Progress, Review, Done, Blocked. Create tasks, assign to agents, execute directly with "Run with Agent."

### 📡 Real-Time Monitoring

- **Cards view** with status filtering (Active, Idle, Working, Meeting, Supervising)
- **Live session tracking** via Server-Sent Events (no polling delays)
- **Fullscreen detail panels** for deep inspection
- **Activity feed** showing what every agent is doing

### 🏠 Rooms & Organization

- **Drag & drop** room assignment for agents
- **Custom display names** and routing rules
- **Meeting tables** in every project room
- **Blueprints** — JSON-defined room layouts you can share

### 🎨 Customization

- **Dark/light theme** with customizable accent colors
- **5 bot personalities** (Worker, Thinker, Cron, Comms, Dev)
- **Persona tuning** — customize agent behavior with presets or fine-tune individual traits
- **Settings backup/restore**

### 🧩 Extensibility

- **Modding support** — add custom props, environments, and blueprints
- **Namespaced IDs** to avoid conflicts
- **Data-driven everything** — no code changes needed for most customizations

> 📖 Full documentation coming soon at **docs.crewhub.dev**

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
- OpenClaw running on the same machine (auto-discovery reads your local config)

### Option 1: Docker (Recommended)

```bash
git clone https://github.com/EKINSOL-DEV/crewhub.git
cd crewhub
make prod-up
```

The dashboard will be available at **http://localhost:8446**. The onboarding wizard will guide you through connecting to your gateway.

### Option 2: Local Development

```bash
git clone https://github.com/EKINSOL-DEV/crewhub.git
cd crewhub
make dev
```

Frontend: http://localhost:5181  
Backend API: http://localhost:8091

### Option 3: Demo Mode (No OpenClaw Needed)

Want to explore CrewHub without setting up OpenClaw? Run in demo mode with simulated agents:

```bash
docker compose -f docker-compose.demo.yml up
```

Open **http://localhost:3000** — you'll see a fully interactive 3D world with mock agents and activity.

> 💡 Or try it online at **[demo.crewhub.dev](https://demo.crewhub.dev)**

---

## ⚙️ Configuration

On first launch, the **onboarding wizard** will auto-detect your OpenClaw installation and configure the connection — including the gateway token. No manual setup needed.

### Docker Network Notes

When running in Docker, OpenClaw must bind to `lan` instead of `loopback`:

1. Edit `~/.openclaw/openclaw.json`:
   ```json
   {
     "gateway": {
       "bind": "lan",
       ...
     }
   }
   ```

2. Restart the gateway:
   ```bash
   openclaw gateway restart
   ```

Set the Gateway URL to reach your host:
- **macOS/Windows**: `ws://host.docker.internal:18789`
- **Linux**: `ws://172.17.0.1:18789` (or your host IP)

---

## 🧑‍💻 Development

### Commands

```bash
# Production (Docker)
make prod-up       # Start production containers
make prod-down     # Stop production
make prod-logs     # View logs
make prod-rebuild  # Rebuild and restart

# Development (Local)
make dev           # Start both backend + frontend
make dev-backend   # Backend only (port 8091)
make dev-frontend  # Frontend only (port 5181)
```

### Production URLs
- Frontend: http://localhost:8446
- Backend API: http://localhost:8090

### Development URLs
- Frontend: http://localhost:5181
- Backend API: http://localhost:8091

### Zen Mode

Access lightweight Zen Mode (no 3D world) via URL parameter:

```
http://localhost:5181?mode=zen
```

Perfect for focused work, lower resource usage, or embedded contexts. Same app, different mode.

### Project Structure

```
crewhub/
├── backend/           # Python FastAPI backend
│   ├── app/
│   │   ├── routes/    # API endpoints
│   │   ├── services/  # Business logic
│   │   └── db/        # Database models
│   └── tests/
├── frontend/          # React + TypeScript frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── hooks/       # React hooks
│   │   ├── lib/         # Utilities
│   │   └── contexts/    # React contexts
│   └── public/
└── docs/              # Documentation & design docs
```

---

## 💬 Community

Join us on **[Discord](https://discord.gg/Bfupkmvp)** — chat with the team, share your setup, and help shape the roadmap.

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

> **Note:** This project uses a Contributor License Agreement (CLA). You'll be asked to sign it when opening your first pull request.

## ⚠️ Security Notice

CrewHub ships with **no authentication** by default and is designed for local/trusted networks. Public or internet-facing deployment requires enabling auth, HTTPS, and firewall rules.

See **[SECURITY.md](SECURITY.md)** for production hardening guidelines.

## 📚 Research Project

This is an **open research project** by [EKINSOL BV](https://ekinsol.be). We're exploring AI-assisted software development and sharing our journey openly — including planning docs, design decisions, and learnings.

**What this means:**
- 🧪 Code and docs evolve rapidly as we experiment
- 📖 We share our process, not just polished results
- 🤝 Feedback and contributions shape the direction

## 📄 License

AGPL-3.0 — see [LICENSE](LICENSE)

CrewHub is licensed under **AGPL-3.0**, which means any modified version that's served over a network must also be open-sourced under the same license.

---

<p align="center">
  <strong>Made by <a href="https://ekinsol.be">EKINSOL</a></strong><br>
  <a href="https://crewhub.dev">Website</a> · <a href="https://demo.crewhub.dev">Demo</a> · <a href="https://discord.gg/Bfupkmvp">Discord</a>
</p>
