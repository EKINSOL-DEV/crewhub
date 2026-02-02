# ClawCrew

Multi-agent orchestration platform for OpenClaw.

## Overview

ClawCrew enables teams of AI agents to work together on complex tasks. Spawn, coordinate, and monitor multiple agents from a single dashboard.

## Features

- 🤖 **Agent Management** - Spawn, pause, and terminate agents
- 📊 **Real-time Monitoring** - Watch agent activity live
- 🔗 **Task Orchestration** - Coordinate multi-agent workflows
- 📝 **Conversation History** - Track all agent interactions

## Quick Start

```bash
# Start all services
make up

# Development mode (with hot reload)
make dev

# Stop services
make down
```

## Ports

| Service  | Port |
|----------|------|
| Backend  | 8090 |
| Frontend | 5180 |

## Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

## Stack

- **Backend**: Python + FastAPI
- **Frontend**: React + Vite + TypeScript
- **Database**: SQLite (embedded)

## License

MIT License - see [LICENSE](LICENSE)
