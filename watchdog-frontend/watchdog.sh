#!/usr/bin/env bash
# CrewHub Frontend Watchdog
# Monitors the Vite dev server, auto-restarts on crash, logs crashes.
# Usage: ./watchdog.sh [start|stop|status]
#
# Environment variables:
#   FRONTEND_PORT        - Vite dev server port (default: 5180)
#   HEALTH_CHECK_INTERVAL - Seconds between health checks (default: 30)
#   MAX_RESTARTS         - Max restarts per window (default: 10)
#   RESTART_WINDOW       - Window in seconds for max restarts (default: 3600)
#   CREWHUB_DIR          - CrewHub root directory

set -euo pipefail

CREWHUB_DIR="${CREWHUB_DIR:-$HOME/ekinapps/crewhub}"
FRONTEND_DIR="$CREWHUB_DIR/frontend"
LOG_DIR="$HOME/.crewhub"
CRASH_LOG="$LOG_DIR/frontend-crashes.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
PID_FILE="$LOG_DIR/frontend-watchdog.pid"
FRONTEND_PID_FILE="$LOG_DIR/frontend.pid"

PORT="${FRONTEND_PORT:-5180}"
HEALTH_URL="http://localhost:${PORT}/"

MAX_RESTARTS="${MAX_RESTARTS:-10}"
RESTART_WINDOW="${RESTART_WINDOW:-3600}"  # 1 hour
BACKOFF_BASE=2
BACKOFF_MAX=120
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-30}"
HEALTH_CHECK_TIMEOUT=10

mkdir -p "$LOG_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [frontend-watchdog] $*" | tee -a "$FRONTEND_LOG"
    return 0
}

log_crash() {
    local exit_code="$1"
    local pid="$2"
    {
        echo "========================================="
        echo "FRONTEND CRASH: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "PID: $pid"
        echo "Exit code: $exit_code"
        echo ""
        echo "--- System Memory ---"
        vm_stat 2>/dev/null | head -10 || free -h 2>/dev/null || true
        echo ""
        echo "--- Node Processes ---"
        ps aux | grep -i "[n]ode\|[v]ite" | head -10 || true
        echo ""
        echo "--- Last 50 log lines ---"
        tail -50 "$FRONTEND_LOG" 2>/dev/null || echo "(no log file)"
        echo "========================================="
        echo ""
    } >> "$CRASH_LOG"
    return 0
}

start_frontend() {
    log "Starting Vite dev server on port ${PORT}..."
    cd "$FRONTEND_DIR"
    npx vite --port "$PORT" --host >> "$FRONTEND_LOG" 2>&1 &
    local pid=$!
    echo "$pid" > "$FRONTEND_PID_FILE"
    log "Frontend started with PID $pid"
    echo "$pid"
    return 0
}

check_health() {
    curl -s --max-time "$HEALTH_CHECK_TIMEOUT" -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null | grep -q "200" && return 0
    return 1
}

stop_frontend() {
    if [[ -f "$FRONTEND_PID_FILE" ]]; then
        local pid
        pid=$(cat "$FRONTEND_PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            log "Stopping frontend (PID $pid)..."
            kill "$pid" 2>/dev/null || true
            # Wait up to 5s for graceful shutdown
            for i in $(seq 1 10); do
                kill -0 "$pid" 2>/dev/null || break
                sleep 0.5
            done
            kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi
    # Kill any orphaned processes on our port
    lsof -ti:"$PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
    return 0
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
    stop_frontend
    log "Stopped."
    return 0
}

do_status() {
    if [[ -f "$PID_FILE" ]]; then
        local wpid
        wpid=$(cat "$PID_FILE")
        if kill -0 "$wpid" 2>/dev/null; then
            echo "Watchdog: running (PID $wpid)"
        else
            echo "Watchdog: not running (stale PID file)"
        fi
    else
        echo "Watchdog: not running"
    fi

    if [[ -f "$FRONTEND_PID_FILE" ]]; then
        local fpid
        fpid=$(cat "$FRONTEND_PID_FILE")
        if kill -0 "$fpid" 2>/dev/null; then
            echo "Frontend: running (PID $fpid)"
            if check_health; then
                echo "Health: OK"
            else
                echo "Health: FAILING"
            fi
        else
            echo "Frontend: not running (stale PID file)"
        fi
    else
        echo "Frontend: not running"
    fi

    if [[ -f "$CRASH_LOG" ]]; then
        local count
        count=$(grep -c "FRONTEND CRASH:" "$CRASH_LOG" 2>/dev/null || echo 0)
        echo "Total crashes logged: $count"
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

    log "Frontend watchdog starting (port=$PORT, interval=${HEALTH_CHECK_INTERVAL}s, max_restarts=$MAX_RESTARTS/${RESTART_WINDOW}s)..."
    echo $$ > "$PID_FILE"

    trap 'log "Received shutdown signal"; do_stop; exit 0' SIGTERM SIGINT

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

        # Stop any existing frontend
        stop_frontend
        sleep 1

        # Start frontend
        local frontend_pid
        frontend_pid=$(start_frontend)

        # Wait for frontend to be ready (Vite takes a few seconds)
        local healthy=false
        for i in $(seq 1 20); do
            sleep 3
            if ! kill -0 "$frontend_pid" 2>/dev/null; then
                break
            fi
            if check_health; then
                healthy=true
                break
            fi
        done

        if ! $healthy; then
            if kill -0 "$frontend_pid" 2>/dev/null; then
                log "WARNING: Frontend running but health check failing"
            fi
        else
            log "Frontend healthy and ready on port $PORT"
            restart_count=0
            window_start=$(date +%s)
        fi

        # Monitor loop
        while kill -0 "$frontend_pid" 2>/dev/null; do
            sleep "$HEALTH_CHECK_INTERVAL"

            if ! kill -0 "$frontend_pid" 2>/dev/null; then
                break
            fi

            if ! check_health; then
                log "WARNING: Health check failed, will retry in 10s..."
                sleep 10
                if ! check_health; then
                    log "ERROR: Health check failed twice. Restarting frontend."
                    log_crash "HEALTH_CHECK_FAILED" "$frontend_pid"
                    kill "$frontend_pid" 2>/dev/null || true
                    sleep 2
                    break
                fi
            fi
        done

        # Process died
        wait "$frontend_pid" 2>/dev/null
        local exit_code=$?
        log "Frontend exited with code $exit_code (PID $frontend_pid)"
        log_crash "$exit_code" "$frontend_pid"

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
