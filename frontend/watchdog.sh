#!/bin/sh
# Frontend Watchdog - Auto-restarts Vite dev server on crash
# Logs crashes with timestamps to /app/logs/watchdog.log

set -u

LOG_DIR="/app/logs"
LOG_FILE="${LOG_DIR}/watchdog.log"
CRASH_COUNT=0
MAX_RAPID_CRASHES=10
RAPID_WINDOW=60  # seconds
COOLDOWN=5       # seconds between restarts

mkdir -p "$LOG_DIR"

log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG_FILE"
  return 0
}

log "Watchdog started (PID $$)"

LAST_CRASH_TIME=0

while true; do
  log "Starting Vite dev server (crash count: $CRASH_COUNT)"

  # Run Vite in foreground, capture exit code
  npm run dev -- --host 0.0.0.0 --port 5180 2>&1 | tee -a "${LOG_DIR}/vite.log"
  EXIT_CODE=$?
  NOW=$(date +%s)

  log "Vite exited with code $EXIT_CODE"
  CRASH_COUNT=$((CRASH_COUNT + 1))

  # Check for rapid crash loop
  if [ "$LAST_CRASH_TIME" -gt 0 ]; then
    ELAPSED=$((NOW - LAST_CRASH_TIME))
    if [ "$ELAPSED" -lt "$RAPID_WINDOW" ] && [ "$CRASH_COUNT" -ge "$MAX_RAPID_CRASHES" ]; then
      log "FATAL: $MAX_RAPID_CRASHES crashes in ${ELAPSED}s — stopping to prevent crash loop"
      exit 1
    fi
  fi

  # Reset crash count if stable for a while
  if [ "$LAST_CRASH_TIME" -gt 0 ] && [ $((NOW - LAST_CRASH_TIME)) -gt 300 ]; then
    CRASH_COUNT=1
  fi

  LAST_CRASH_TIME=$NOW

  log "Restarting in ${COOLDOWN}s..."
  sleep "$COOLDOWN"
done
