# Frontend Watchdog

**Version**: v0.14.0
**Date**: 2026-02-12
**Status**: Implemented

## Problem

The Vite dev server crashes intermittently (SIGKILL during HMR), requiring manual restart. On 2026-02-11 it crashed 4 times in a single day, disrupting development.

## Solution

A lightweight shell-based watchdog (`watchdog.sh`) wraps the Vite process and automatically restarts it on crash.

### How It Works

1. `watchdog.sh` runs as the container's main process (PID 1)
2. It starts `npm run dev` in the foreground
3. When Vite exits (crash/SIGKILL), the watchdog:
   - Logs the exit code and timestamp to `/app/logs/watchdog.log`
   - Waits 5 seconds (cooldown)
   - Restarts Vite automatically
4. **Crash loop protection**: If 10+ crashes happen within 60 seconds, the watchdog stops to prevent infinite loops

### Log Files

- `/app/logs/watchdog.log` — Watchdog events (starts, crashes, restarts)
- `/app/logs/vite.log` — Vite stdout/stderr

## Usage

### Docker Dev Mode (recommended for unattended)

```bash
docker compose --profile dev up frontend-dev
```

Logs persist in a Docker volume (`frontend-dev-logs`).

### Standalone (without Docker)

```bash
cd frontend
./watchdog.sh
```

### Host Dev Mode (current setup on Mac mini)

For the current Mac mini dev setup (no Docker), you can run the watchdog directly:

```bash
cd ~/ekinapps/crewhub/frontend
./watchdog.sh
```

Or continue using `npm run dev` directly if you prefer manual restarts.

## Configuration

Environment variables in `watchdog.sh`:

| Variable | Default | Description |
|----------|---------|-------------|
| `COOLDOWN` | 5 | Seconds between restart attempts |
| `MAX_RAPID_CRASHES` | 10 | Max crashes before stopping |
| `RAPID_WINDOW` | 60 | Seconds window for rapid crash detection |

## Files

- `frontend/watchdog.sh` — Watchdog script
- `frontend/Dockerfile` — Dev Dockerfile (uses watchdog as CMD)
- `frontend/Dockerfile.prod` — Production Dockerfile (unchanged, uses nginx)
- `docker-compose.yml` — Added `frontend-dev` service with dev profile

## Architecture

```
Container (frontend-dev)
├── watchdog.sh (PID 1)
│   └── npm run dev (Vite)
│       └── Auto-restart on exit
└── /app/logs/
    ├── watchdog.log
    └── vite.log
```

Production (`frontend` service) is unaffected — it uses nginx to serve static builds.
