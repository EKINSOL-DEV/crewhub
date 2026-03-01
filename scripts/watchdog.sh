#!/usr/bin/env bash
# CrewHub Watchdog
# Monitors backend and frontend processes, auto-restarts on crash, logs crashes.
# Usage: ./watchdog.sh [start|stop|status]

set -euo pipefail

# Derive paths from script location (no hardcoded paths)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CREWHUB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$CREWHUB_DIR/backend"
FRONTEND_DIR="$CREWHUB_DIR/frontend"
LOG_DIR="$HOME/.crewhub"
CRASH_LOG="$LOG_DIR/backend-crashes.log"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
PID_FILE="$LOG_DIR/watchdog.pid"
BACKEND_PID_FILE="$LOG_DIR/backend.pid"
FRONTEND_PID_FILE="$LOG_DIR/frontend.pid"

HOST="0.0.0.0"
PORT="${CREWHUB_PORT:-8090}"
FRONTEND_PORT="${CREWHUB_FRONTEND_PORT:-8446}"
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
    return 0
}

log_crash() {
    local exit_code="$1"
    local pid="$2"
    local process_name="${3:-backend}"
    {
        echo "========================================="
        echo "CRASH DETECTED ($process_name): $(date '+%Y-%m-%d %H:%M:%S')"
        echo "PID: $pid"
        echo "Exit code: $exit_code"
        echo ""
        echo "--- System Memory ---"
        vm_stat 2>/dev/null | head -10 || free -h 2>/dev/null || true
        echo ""
        echo "--- Process Memory (top 10) ---"
        ps aux --sort=-%mem 2>/dev/null | head -11 || ps aux | sort -k4 -rn | head -11 || true
        echo ""
        echo "--- Last 50 log lines ---"
        tail -50 "$BACKEND_LOG" 2>/dev/null || echo "(no log file)"
        echo "========================================="
        echo ""
    } >> "$CRASH_LOG"
    return 0
}

ensure_frontend_built() {
    if [[ ! -d "$FRONTEND_DIR/dist" ]]; then
        log "Frontend not built — running npm run build..."
        (cd "$FRONTEND_DIR" && npm run build) >> "$BACKEND_LOG" 2>&1
        if [[ ! -d "$FRONTEND_DIR/dist" ]]; then
            log "ERROR: Frontend build failed"
            return 1
        fi
        log "Frontend build complete"
    fi
    return 0
}

start_backend() {
    log "Starting CrewHub backend on ${HOST}:${PORT}..."
    cd "$BACKEND_DIR"
    source venv/bin/activate
    export CREWHUB_PORT="$PORT"
    export CREWHUB_DB_PATH="${CREWHUB_DB_PATH:-$HOME/.crewhub/crewhub.db}"
    export OPENCLAW_GATEWAY_URL="${OPENCLAW_GATEWAY_URL:-ws://localhost:18789}"
    python3 -m uvicorn app.main:app --host "$HOST" --port "$PORT" >> "$BACKEND_LOG" 2>&1 &
    local pid=$!
    echo "$pid" > "$BACKEND_PID_FILE"
    log "Backend started with PID $pid"
    echo "$pid"
    return 0
}

start_frontend() {
    ensure_frontend_built || return 1
    log "Starting CrewHub frontend on port ${FRONTEND_PORT}..."
    cd "$FRONTEND_DIR"
    npx serve dist -l "$FRONTEND_PORT" -s >> "$FRONTEND_LOG" 2>&1 &
    local pid=$!
    echo "$pid" > "$FRONTEND_PID_FILE"
    log "Frontend started with PID $pid (port $FRONTEND_PORT)"
    echo "$pid"
    return 0
}

check_health() {
    local response
    response=$(curl -s --max-time "$HEALTH_CHECK_TIMEOUT" "$HEALTH_URL" 2>/dev/null) || return 1
    echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['status']=='healthy'" 2>/dev/null || return 1
    return 0
}

stop_process() {
    local pid_file="$1"
    local name="$2"
    local port="${3:-}"
    if [[ -f "$pid_file" ]]; then
        local pid
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            log "Stopping $name (PID $pid)..."
            kill "$pid" 2>/dev/null || true
            sleep 2
            kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
        fi
        rm -f "$pid_file"
    fi
    # Kill any orphaned processes on the port
    if [[ -n "$port" ]]; then
        lsof -ti:"$port" 2>/dev/null | xargs kill -9 2>/dev/null || true
    fi
    return 0
}

stop_backend() {
    stop_process "$BACKEND_PID_FILE" "backend" "$PORT"
}

stop_frontend() {
    stop_process "$FRONTEND_PID_FILE" "frontend" "$FRONTEND_PORT"
}

do_stop() {
    if [[ -f "$PID_FILE" ]]; then
        local wpid
        wpid=$(cat "$PID_FILE")
        if kill -0 "$wpid" 2>/dev/null; then
            log "Stopping watchdog (PID $wpid)..."
            kill "$wpid" 2>/dev/null || true
        fi
        rm -f "$PID_FILE"
    fi
    stop_backend
    stop_frontend
    log "Stopped."
    return 0
}

do_status() {
    local running=false
    if [[ -f "$PID_FILE" ]]; then
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

    if [[ -f "$BACKEND_PID_FILE" ]]; then
        local bpid
        bpid=$(cat "$BACKEND_PID_FILE")
        if kill -0 "$bpid" 2>/dev/null; then
            echo "Backend: running (PID $bpid) on port $PORT"
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

    if [[ -f "$FRONTEND_PID_FILE" ]]; then
        local fpid
        fpid=$(cat "$FRONTEND_PID_FILE")
        if kill -0 "$fpid" 2>/dev/null; then
            echo "Frontend: running (PID $fpid) on port $FRONTEND_PORT"
        else
            echo "Frontend: not running (stale PID file)"
        fi
    else
        echo "Frontend: not running"
    fi
    return 0
}

do_start() {
    # Check if already running
    if [[ -f "$PID_FILE" ]]; then
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

    # Start frontend (static server — doesn't need watchdog-level monitoring)
    stop_frontend
    local frontend_pid
    frontend_pid=$(start_frontend) || log "WARNING: Frontend failed to start"

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

        # Restart frontend if it died
        if [[ -f "$FRONTEND_PID_FILE" ]]; then
            local fpid
            fpid=$(cat "$FRONTEND_PID_FILE")
            if ! kill -0 "$fpid" 2>/dev/null; then
                log "Frontend died — restarting..."
                frontend_pid=$(start_frontend) || log "WARNING: Frontend restart failed"
            fi
        fi

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

    return 0
}

case "${1:-start}" in
    start)  do_start ;;
    stop)   do_stop ;;
    status) do_status ;;
    *)      echo "Usage: $0 {start|stop|status}" >&2 ;;
esac
