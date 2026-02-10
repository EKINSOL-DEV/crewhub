#!/usr/bin/env bash
# CrewHub Backend Watchdog
# Monitors the backend process, auto-restarts on crash, logs crashes.
# Usage: ./watchdog.sh [start|stop|status]

set -euo pipefail

CREWHUB_DIR="$HOME/ekinapps/crewhub"
BACKEND_DIR="$CREWHUB_DIR/backend"
LOG_DIR="$HOME/.crewhub"
CRASH_LOG="$LOG_DIR/backend-crashes.log"
BACKEND_LOG="$LOG_DIR/backend.log"
PID_FILE="$LOG_DIR/watchdog.pid"
BACKEND_PID_FILE="$LOG_DIR/backend.pid"

HOST="0.0.0.0"
PORT=8091
HEALTH_URL="http://localhost:${PORT}/api/health"

MAX_RESTARTS=10
RESTART_WINDOW=600  # seconds - reset counter after this
BACKOFF_BASE=2
BACKOFF_MAX=120
HEALTH_CHECK_INTERVAL=30
HEALTH_CHECK_TIMEOUT=10

mkdir -p "$LOG_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$BACKEND_LOG"
}

log_crash() {
    local exit_code="$1"
    local pid="$2"
    {
        echo "========================================="
        echo "CRASH DETECTED: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "PID: $pid"
        echo "Exit code: $exit_code"
        echo ""
        echo "--- System Memory ---"
        vm_stat 2>/dev/null | head -10 || true
        echo ""
        echo "--- Process Memory (top 10) ---"
        ps aux --sort=-%mem 2>/dev/null | head -11 || ps aux | sort -k4 -rn | head -11 || true
        echo ""
        echo "--- Last 50 log lines ---"
        tail -50 "$BACKEND_LOG" 2>/dev/null || echo "(no log file)"
        echo "========================================="
        echo ""
    } >> "$CRASH_LOG"
}

start_backend() {
    log "Starting CrewHub backend on ${HOST}:${PORT}..."
    cd "$BACKEND_DIR"
    python3 -m uvicorn app.main:app --host "$HOST" --port "$PORT" >> "$BACKEND_LOG" 2>&1 &
    local pid=$!
    echo "$pid" > "$BACKEND_PID_FILE"
    log "Backend started with PID $pid"
    echo "$pid"
}

check_health() {
    local response
    response=$(curl -s --max-time "$HEALTH_CHECK_TIMEOUT" "$HEALTH_URL" 2>/dev/null) || return 1
    echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['status']=='healthy'" 2>/dev/null || return 1
    return 0
}

stop_backend() {
    if [ -f "$BACKEND_PID_FILE" ]; then
        local pid
        pid=$(cat "$BACKEND_PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            log "Stopping backend (PID $pid)..."
            kill "$pid" 2>/dev/null || true
            sleep 2
            kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
        fi
        rm -f "$BACKEND_PID_FILE"
    fi
    # Also kill any orphaned uvicorn on our port
    lsof -ti:"$PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
}

do_stop() {
    if [ -f "$PID_FILE" ]; then
        local wpid
        wpid=$(cat "$PID_FILE")
        if kill -0 "$wpid" 2>/dev/null; then
            log "Stopping watchdog (PID $wpid)..."
            kill "$wpid" 2>/dev/null || true
        fi
        rm -f "$PID_FILE"
    fi
    stop_backend
    log "Stopped."
}

do_status() {
    local running=false
    if [ -f "$PID_FILE" ]; then
        local wpid
        wpid=$(cat "$PID_FILE")
        if kill -0 "$wpid" 2>/dev/null; then
            echo "Watchdog: running (PID $wpid)"
            running=true
        else
            echo "Watchdog: not running (stale PID file)"
        fi
    else
        echo "Watchdog: not running"
    fi

    if [ -f "$BACKEND_PID_FILE" ]; then
        local bpid
        bpid=$(cat "$BACKEND_PID_FILE")
        if kill -0 "$bpid" 2>/dev/null; then
            echo "Backend: running (PID $bpid)"
            if check_health; then
                echo "Health: OK"
            else
                echo "Health: FAILING"
            fi
        else
            echo "Backend: not running (stale PID file)"
        fi
    else
        echo "Backend: not running"
    fi
}

do_start() {
    # Check if already running
    if [ -f "$PID_FILE" ]; then
        local wpid
        wpid=$(cat "$PID_FILE")
        if kill -0 "$wpid" 2>/dev/null; then
            echo "Watchdog already running (PID $wpid)"
            exit 0
        fi
    fi

    log "Watchdog starting..."
    echo $$ > "$PID_FILE"

    trap 'do_stop; exit 0' SIGTERM SIGINT

    local restart_count=0
    local window_start
    window_start=$(date +%s)

    while true; do
        # Reset restart counter after window
        local now
        now=$(date +%s)
        if (( now - window_start > RESTART_WINDOW )); then
            restart_count=0
            window_start=$now
        fi

        if (( restart_count >= MAX_RESTARTS )); then
            log "ERROR: Max restarts ($MAX_RESTARTS) reached in ${RESTART_WINDOW}s window. Giving up."
            log_crash "MAX_RESTARTS_EXCEEDED" "N/A"
            rm -f "$PID_FILE"
            exit 1
        fi

        # Stop any existing backend
        stop_backend
        sleep 1

        # Start backend
        local backend_pid
        backend_pid=$(start_backend)

        # Wait for backend to be healthy
        local healthy=false
        for i in $(seq 1 12); do
            sleep 5
            if ! kill -0 "$backend_pid" 2>/dev/null; then
                break
            fi
            if check_health; then
                healthy=true
                break
            fi
        done

        if ! $healthy; then
            if kill -0 "$backend_pid" 2>/dev/null; then
                log "WARNING: Backend running but health check failing"
            fi
        else
            log "Backend healthy and ready"
            # Reset counter on successful healthy start
            restart_count=0
            window_start=$(date +%s)
        fi

        # Monitor loop
        while kill -0 "$backend_pid" 2>/dev/null; do
            sleep "$HEALTH_CHECK_INTERVAL"

            if ! kill -0 "$backend_pid" 2>/dev/null; then
                break
            fi

            if ! check_health; then
                log "WARNING: Health check failed, will retry..."
                sleep 10
                if ! check_health; then
                    log "ERROR: Health check failed twice. Restarting backend."
                    log_crash "HEALTH_CHECK_FAILED" "$backend_pid"
                    kill "$backend_pid" 2>/dev/null || true
                    sleep 2
                    break
                fi
            fi
        done

        # Process died
        wait "$backend_pid" 2>/dev/null
        local exit_code=$?
        log "Backend exited with code $exit_code (PID $backend_pid)"
        log_crash "$exit_code" "$backend_pid"

        restart_count=$((restart_count + 1))
        local backoff=$(( BACKOFF_BASE ** restart_count ))
        (( backoff > BACKOFF_MAX )) && backoff=$BACKOFF_MAX
        log "Restart attempt $restart_count/$MAX_RESTARTS in ${backoff}s..."
        sleep "$backoff"
    done
}

case "${1:-start}" in
    start)  do_start ;;
    stop)   do_stop ;;
    status) do_status ;;
    *)      echo "Usage: $0 {start|stop|status}" ;;
esac
