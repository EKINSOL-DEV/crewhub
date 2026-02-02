# 🚀 CrewHub

Real-time dashboard for monitoring your AI agent sessions.

## Features

- 🔴 **Live Updates** - Real-time session monitoring via SSE
- 🏠 **Rooms** - Organize agents in workspaces (Dev Room, Creative Corner, etc.)
- 📊 **Stats** - Track tokens, costs, runtime per session
- 📜 **Log Viewer** - Browse chat history
- 🎨 **Playground View** - Visual grid layout with drag & drop
- 🌙 **Dark/Light Mode** - Clean, modern UI

## Compatibility

Works with:
- **OpenClaw** - Personal AI assistant platform
- **Claude Code** - Anthropic's CLI coding agent
- Other AI agent platforms (coming soon)

## Quick Start

```bash
# Clone the repo
git clone https://github.com/ekinsolbot/crewhub.git
cd crewhub

# Configure
cp .env.example .env
# Edit .env with your Gateway URL and token

# Development mode
make dev

# Or with Docker
make up
```

## Ports

| Service  | Port |
|----------|------|
| Backend  | 8090 |
| Frontend | 5180 |

## Environment Variables

```bash
OPENCLAW_GATEWAY_URL=ws://localhost:18789
OPENCLAW_GATEWAY_TOKEN=your_token_here
```

## Tech Stack

- **Backend**: Python 3.11+ / FastAPI
- **Frontend**: React 18 / Vite / TypeScript / Tailwind CSS

## Development

```bash
make dev      # Start backend + frontend (hot reload)
make build    # Build Docker images
make up       # Docker compose up
make down     # Stop services
make logs     # View logs
```

## License

MIT License - see [LICENSE](LICENSE)

---

**Website:** [crewhub.dev](https://crewhub.dev)
