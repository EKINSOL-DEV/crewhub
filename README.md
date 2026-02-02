# 🦀 CrewHub

Real-time dashboard for monitoring your AI agent sessions.

![CrewHub Dashboard](https://via.placeholder.com/800x400?text=CrewHub+Dashboard)

## ✨ Features

- 🔴 **Live Updates** - Real-time session monitoring via Server-Sent Events
- 🏠 **Rooms** - Organize agents in workspaces (Dev Room, Creative Corner, etc.)
- 📊 **Stats** - Track tokens, costs, and runtime per session
- 📜 **Log Viewer** - Browse and search chat history with export to JSON
- 🎨 **Playground View** - Visual grid layout with drag & drop
- 🌙 **Dark/Light Mode** - Clean, modern UI with theme toggle
- 🏷️ **Custom Labels** - Name your agents for easy identification

## 🔗 Compatibility

Works with:
- **[OpenClaw](https://openclaw.dev)** - Personal AI assistant platform
- **Claude Code** - Anthropic's CLI coding agent
- Other AI agent platforms (coming soon)

## 🚀 Quick Start

### Prerequisites

- [Docker](https://docker.com) and Docker Compose (recommended)
- OR Node.js 18+ and Python 3.11+
- Access to an OpenClaw Gateway

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/ekinsolbot/crewhub.git
cd crewhub

# Configure environment
cp .env.example .env
# Edit .env with your Gateway URL and token (see Configuration below)

# Start with Docker
make up

# View logs
make logs
```

The dashboard will be available at **http://localhost:5180**

### Option 2: Local Development

```bash
# Clone and configure
git clone https://github.com/ekinsolbot/crewhub.git
cd crewhub
cp .env.example .env

# Start both backend and frontend with hot-reload
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
# Generate a new token
openclaw gateway token

# Or check existing configuration
cat ~/.openclaw/config.yaml
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

## 🛠️ Development

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
│   └── tests/         # Backend tests
├── frontend/          # React + TypeScript frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── hooks/       # React hooks
│   │   └── lib/         # Utilities
│   └── tests/           # Frontend tests
└── docker-compose.yml
```

## 🧪 Running Tests

```bash
# Backend tests
cd backend && pytest

# Frontend tests
cd frontend && npm test
```

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE)

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for release notes.

---

**Made with 🦀 by the OpenClaw community**
