# Backend Watchdog

Auto-restart and crash logging for the CrewHub backend (host-based, no Docker).

## Components

1. **Health endpoint** — `GET /api/health` returns status, uptime, memory, CPU
2. **Watchdog script** — `scripts/watchdog.sh` monitors and restarts the backend
3. **launchd plist** — `scripts/com.crewhub.backend.plist` for macOS auto-start

## Quick Start

### Manual (recommended for dev)

```bash
# Start watchdog (runs in foreground, manages backend)
./scripts/watchdog.sh start

# Background it
nohup ./scripts/watchdog.sh start &

# Check status
./scripts/watchdog.sh status

# Stop everything
./scripts/watchdog.sh stop
```

### launchd (auto-start on boot)

```bash
# Install
cp scripts/com.crewhub.backend.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.crewhub.backend.plist

# Uninstall
launchctl unload ~/Library/LaunchAgents/com.crewhub.backend.plist
rm ~/Library/LaunchAgents/com.crewhub.backend.plist
```

## Health Check

```bash
curl http://localhost:8091/api/health
```

Returns:
```json
{
  "status": "healthy",
  "uptime_seconds": 3600.1,
  "uptime_human": "1h 0m",
  "pid": 12345,
  "memory": {"rss_mb": 85.2, "vms_mb": 320.1},
  "cpu_percent": 2.5
}
```

## Crash Logs

Location: `~/.crewhub/backend-crashes.log`

Each entry includes:
- Timestamp and exit code
- System memory snapshot
- Top memory-consuming processes
- Last 50 lines of backend log

## Configuration

Edit variables at the top of `watchdog.sh`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8091 | Backend port |
| `MAX_RESTARTS` | 10 | Max restarts per window |
| `RESTART_WINDOW` | 600 | Window in seconds |
| `BACKOFF_BASE` | 2 | Exponential backoff base |
| `BACKOFF_MAX` | 120 | Max backoff seconds |
| `HEALTH_CHECK_INTERVAL` | 30 | Seconds between checks |

## Troubleshooting

**Watchdog won't start:** Check `~/.crewhub/watchdog.pid` — remove stale PID file.

**Backend keeps crashing:** Check `~/.crewhub/backend-crashes.log` and `~/.crewhub/backend.log`.

**Port in use:** `lsof -i:8091` to find the process, or `./scripts/watchdog.sh stop` cleans up.

**launchd not working:** Check `~/.crewhub/launchd-stderr.log`. Ensure PATH includes python3.

## Dependencies

- `psutil` Python package (added to requirements.txt)
- `curl` (for health checks)
