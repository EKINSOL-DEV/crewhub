# Frontend Watchdog

Auto-restarts the Vite dev server when it crashes. Mirrors the backend watchdog pattern.

## Quick Start (Standalone — Recommended for Dev)

```bash
# Start watchdog (runs Vite in background, monitors it)
./watchdog.sh start

# Check status
./watchdog.sh status

# Stop watchdog + Vite
./watchdog.sh stop
```

## Docker

```bash
# Build and run
docker compose up -d frontend-watchdog

# Or with the main CrewHub compose (uses profile)
docker compose --profile watchdog up -d
```

## Configuration

| Env Variable | Default | Description |
|---|---|---|
| `FRONTEND_PORT` | 5180 | Vite dev server port |
| `HEALTH_CHECK_INTERVAL` | 30 | Seconds between health checks |
| `MAX_RESTARTS` | 10 | Max restarts per window |
| `RESTART_WINDOW` | 3600 | Window in seconds (1 hour) |
| `CREWHUB_DIR` | `~/ekinapps/crewhub` | CrewHub root (standalone) |

## Logs

```bash
# Live frontend log
tail -f ~/.crewhub/frontend.log

# Crash history
cat ~/.crewhub/frontend-crashes.log

# Docker logs
docker logs crewhub-frontend-watchdog -f
```

## How It Works

1. Starts Vite dev server
2. Polls `http://localhost:5180/` every 30s
3. On failure: retries once after 10s, then restarts Vite
4. Exponential backoff between restarts (2s, 4s, 8s... up to 120s)
5. Max 10 restarts per hour — stops if exceeded (prevents restart loops)
6. Logs every crash with system state to `frontend-crashes.log`

## Troubleshooting

**Watchdog reports "Max restarts reached":**
Something is consistently crashing Vite. Check `~/.crewhub/frontend-crashes.log` and fix the underlying issue, then restart the watchdog.

**Port already in use:**
The watchdog kills orphaned processes on the port before starting. If issues persist: `lsof -ti:5180 | xargs kill -9`

**Vite starts but health check fails:**
Vite may take longer to compile. The watchdog waits up to 60s for initial startup. If your project is very large, increase the startup wait in the script.
