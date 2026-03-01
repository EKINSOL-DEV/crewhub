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
  <img src="https://img.shields.io/badge/version-v0.19.5-blue" alt="Version">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-green" alt="License">
  <a href="https://discord.gg/Bfupkmvp"><img src="https://img.shields.io/badge/Discord-Join%20Server-5865F2?logo=discord&logoColor=white" alt="Discord"></a>
  <img src="https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/mobile-iOS%20%7C%20Android%20%7C%20iPad-34D399?style=flat&logo=apple&logoColor=white" alt="Mobile">
</p>

---

> ⚠️ **Security Notice:** CrewHub ships with **no authentication** by default and is designed for local/trusted networks. Public or internet-facing deployment requires enabling auth, HTTPS, and firewall rules. See **[SECURITY.md](SECURITY.md)** for details.

---

## What is CrewHub?

CrewHub is an **open-source monitoring dashboard** for AI coding agents. It connects to [OpenClaw](https://openclaw.dev), Claude Code, and Codex CLI — giving you live visibility into every agent, session, and task.

But CrewHub isn't just another dashboard. Your agents come alive in a **fully interactive 3D world** where they walk between rooms, gather around meeting tables, and collaborate on structured discussions that produce real results.

> 🎮 **[Try the Live Demo →](https://demo.crewhub.dev)**

---

## 🆕 What's New in v0.19.5

- **Subagent responses surfaced** — When a Claude Code agent spawns a helper, its output now appears in chat, clearly labeled.
- **Human-readable tool activity** — 3D bots, chat headers, and zen mode now show what the agent is actually doing ("Reading config.py", "Running: npm test") instead of a generic "Using tools..." message.
- **Interleaved tool calls in chat** — Tool chips and text appear in the correct order during streaming and in history, not grouped above a text blob.
- **Smarter pathfinding** — Agents use A-star patrol waypoints, bot-to-bot soft repulsion, and grid-aware spawning. No more clustering near walls or stacking on the same tile.
- **Activity status persists across reloads** — Sessions render with their last known activity detail instantly on page load, before the first SSE update.
- **CC agents in any room** — Claude Code agents can now be assigned to any room. Offline CC agents are visible in their room. Subagent room inheritance fixed.
- **Pin multiple agents to the top bar** — Previously only one agent could be pinned at a time.
- **Agent creation in Room panel** — New "+" button in the Room panel creates agents pre-filled with that room.

---

## What's New in v0.19.0

- **Native Claude Code support** — Connect CrewHub directly to Claude Code sessions without OpenClaw. Watches `~/.claude/projects/*/` JSONL files in real-time.
- **New onboarding wizard** — Choose your connection mode: OpenClaw, Claude Code, or both.
- **Source badges** — Color-coded indicators on session cards and 3D bots showing which agent type is running.
- **Auto-detection** — CrewHub detects your Claude installation automatically at startup.

---

## 📰 Latest Updates

Stay up to date with what's new in CrewHub on the blog:

> 📖 **[crewhub.dev/blog →](https://crewhub.dev/blog)**

---

## 🌟 Core Features

### 🌍 3D World View

Watch your agents roam a toon-shaded campus with procedural rooms, animated bots, and multiple environments (Grass, Island, Sky, Desert).

**Interactions:**
- **3 zoom levels** — Overview → Room focus → Bot close-up
- **Click any bot** to see what they're working on
- **Drag & drop** agents between rooms
- **Activity bubbles** show current tasks in real-time

### 📱 Mobile UI

Full mobile experience on iOS, Android, and iPad:
- Responsive layout across all panels
- Floating mini 3D viewport on small screens
- Hamburger menu with access to Docs Panel and navigation
- Touch-friendly chat with file/image upload
- No zoom-in on iOS keyboard (font-size fix)

### 💬 Group Chat

Send messages to multiple agents at once. All agents in a session can respond in context — great for team coordination, quick reviews, or broadcasting a question to everyone.

### 💬 AI Meetings

Run structured round-robin meetings where agents build on each other's contributions. Get organized output with action items that turn into executable tasks.

**When a meeting ends:**
- ✅ **Structured summaries** organized by theme
- ✅ **Action items** with Execute/Add to Planner buttons
- ✅ **Documented decisions** so nothing gets lost
- ✅ **Follow-up meetings** carry context forward automatically

### 🏢 HQ Task Board

Redesigned Kanban board with columns: To Do, In Progress, Review, Done, Blocked. Create tasks, assign to agents, execute directly with "Run with Agent."

### 📄 Docs Panel

Browse your documentation from inside CrewHub. Full folder tree, last-modified dates, fullscreen markdown viewer with auto-generated table of contents. Available in Zen Mode sidebar and mobile menu.

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
| Auth | Ed25519 device identity (OpenClaw v2 protocol) |
| Deployment | Docker, Docker Compose |

---

## 🚀 Quick Start

### Option 1: Claude Code (Recommended)

The fastest way to get started. Requires Python 3.11+, Node.js 18+, and the [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code).

#### Mac / Linux

```bash
git clone https://github.com/EKINSOL-DEV/crewhub.git
cd crewhub
./scripts/setup.sh   # One-time: checks prereqs, creates venv, installs deps
./scripts/start.sh   # Start CrewHub
```

#### Windows (PowerShell)

```powershell
git clone https://github.com/EKINSOL-DEV/crewhub.git
cd crewhub
.\scripts\setup.ps1   # One-time: checks prereqs, creates venv, installs deps
.\scripts\start.ps1   # Start CrewHub
```

Open **http://localhost:5181** — the onboarding wizard will detect your Claude Code installation automatically.

> **Why local?** Full Claude Code support (chat, prop generation, interactive sessions) requires the `claude` CLI on your host machine. Docker mode only supports read-only session monitoring.

### Option 2: Docker (OpenClaw / Monitoring Only)

Best for OpenClaw users or read-only Claude Code session monitoring.

```bash
git clone https://github.com/EKINSOL-DEV/crewhub.git
cd crewhub
make prod-up
```

The dashboard will be available at **http://localhost:8446**. The onboarding wizard will guide you through connecting to your gateway.

> **Note:** Docker mode cannot run the Claude CLI, so interactive features (sending messages, generating props) are not available. For full Claude Code support, use Option 1.

### Option 3: Local Development (Make)

If you prefer `make` and have already set up your environment manually:

```bash
git clone https://github.com/EKINSOL-DEV/crewhub.git
cd crewhub
make setup   # Same as ./scripts/setup.sh
make dev     # Start both backend + frontend
```

Frontend: http://localhost:5181
Backend API: http://localhost:8091

### Option 4: Demo Mode (No Setup Needed)

Want to explore CrewHub without any setup? Run in demo mode with simulated agents:

```bash
docker compose -f docker-compose.demo.yml up
```

Open **http://localhost:3000** — you'll see a fully interactive 3D world with mock agents and activity.

> 💡 Or try it online at **[demo.crewhub.dev](https://demo.crewhub.dev)**

### Run as a Background Service (Optional)

Install CrewHub as a service that starts automatically on login, survives terminal closes, and auto-restarts on crashes:

#### Mac / Linux

```bash
./scripts/service.sh install    # Install and start
./scripts/service.sh status     # Check status
./scripts/service.sh update     # Pull updates and restart
./scripts/service.sh uninstall  # Remove service
./scripts/service.sh logs       # Tail the log file
```

Uses launchd (macOS) or systemd (Linux) for auto-start on login.

#### Windows (PowerShell)

```powershell
.\scripts\service.ps1 install
.\scripts\service.ps1 status
.\scripts\service.ps1 update
.\scripts\service.ps1 uninstall
.\scripts\service.ps1 logs
```

Backend: http://localhost:8090 | Frontend: http://localhost:8446

---

## 🧙 Onboarding

On first launch, the **OpenClawWizard** walks you through setup:

1. **Gateway URL** — enter where your OpenClaw gateway is running (default: `ws://localhost:18789`). When running in Docker, use `ws://host.docker.internal:18789` on macOS/Windows or `ws://172.17.0.1:18789` on Linux.
2. **Gateway token** — find this in `~/.openclaw/openclaw.json` under `gateway.auth.token`
3. **Test connection** — the wizard verifies the connection before saving
4. **Done** — CrewHub pairs itself as a registered device automatically

No need to touch the OpenClaw config beyond this.

---

## 🔐 Security & Device Auth

CrewHub v0.16.0 uses **proper device authentication** with the OpenClaw gateway:

- The backend generates an **Ed25519 keypair** on first run and registers itself as a device
- Authentication uses a **device token** (not the shared gateway token) for all ongoing connections
- The device identity is stored in SQLite and reused across restarts
- This follows the same auth protocol as any other OpenClaw client (Claude Code, the CLI, etc.)

**If you're upgrading from an older version** and have these flags in `~/.openclaw/openclaw.json`:

```json
"controlUi": {
  "allowInsecureAuth": true,
  "dangerouslyDisableDeviceAuth": true
}
```

You can safely remove them. CrewHub no longer needs them. After removing, restart the gateway:

```bash
openclaw gateway restart
```

CrewHub will re-pair automatically on next connect.

---

## ⚙️ Configuration

### Docker Network Notes

When running in Docker, OpenClaw must bind to `lan` instead of `loopback`:

1. Edit `~/.openclaw/openclaw.json`:
   ```json
   {
     "gateway": {
       "bind": "lan"
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

Perfect for focused work, lower resource usage, or embedded contexts. Same app, different mode. The Docs Panel is available in Zen Mode from the sidebar.

### Project Structure

```
crewhub/
├── backend/           # Python FastAPI backend
│   ├── app/
│   │   ├── routes/    # API endpoints
│   │   ├── services/  # Business logic
│   │   │   └── connections/  # OpenClaw connection + device identity
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

## 📚 Research Project

This is an **open research project** by [EKINSOL BV](https://ekinsol.be). We're exploring AI-assisted software development and sharing our journey openly — including planning docs, design decisions, and learnings.

**What this means:**
- 🧪 Code and docs evolve rapidly as we experiment
- 📖 We share our process, not just polished results
- 🤝 Feedback and contributions shape the direction

## 📄 License

AGPL-3.0 — see [LICENSE](LICENSE)

CrewHub is licensed under **AGPL-3.0**, which means any modified version that's served over a network must also be open-sourced under the same license.

### Using with Claude Code (without OpenClaw)

CrewHub works as a full-featured dashboard for Claude Code sessions — no OpenClaw gateway required.

**What you get:**
- **Live session monitoring** — see all active Claude Code sessions in real-time
- **Interactive chat** — send messages to Claude Code sessions directly from CrewHub
- **Prop generation** — generate 3D props for your agents using Claude Code
- **3D world view** — watch your Claude Code agents in the interactive 3D office

**Setup (recommended):**
```bash
./scripts/setup.sh   # Checks prereqs + installs everything
./scripts/start.sh   # Starts CrewHub
```

The backend auto-detects the Claude CLI and watches `~/.claude/projects/` for active sessions.

**Docker users (monitoring only):**
Docker mode supports read-only session monitoring but cannot run the Claude CLI for interactive features. Mount your Claude data directory:
```yaml
volumes:
  - ${HOME}/.claude:/root/.claude:ro
```

For full interactive Claude Code support, use the local setup scripts instead of Docker.

---

<p align="center">
  <strong>Made by <a href="https://ekinsol.be">EKINSOL</a></strong><br>
  <a href="https://crewhub.dev">Website</a> · <a href="https://demo.crewhub.dev">Demo</a> · <a href="https://discord.gg/Bfupkmvp">Discord</a>
</p>
