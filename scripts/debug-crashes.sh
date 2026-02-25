#!/bin/bash
# CrewHub Crash Diagnostics Monitor
# Captures system state to help diagnose SIGKILL crashes
# Usage: ./scripts/debug-crashes.sh
# Logs to: ~/ekinapps/crewhub/crash-diagnostics/

set -euo pipefail

LOGDIR="$HOME/ekinapps/crewhub/crash-diagnostics"
mkdir -p "$LOGDIR"
LOGFILE="$LOGDIR/monitor-$(date +%Y%m%d-%H%M%S).log"
INTERVAL=10  # seconds between checks

echo "🔍 CrewHub Crash Diagnostics Monitor"
echo "📁 Logging to: $LOGFILE"
echo "⏱  Checking every ${INTERVAL}s"
echo "Press Ctrl+C to stop"
echo ""

# Track PIDs
get_vite_pid() { pgrep -f "vite.*5180" 2>/dev/null | head -1; }
get_uvicorn_pid() { pgrep -f "uvicorn.*8091" 2>/dev/null | head -1; }

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOGFILE"
}

snapshot() {
    local ts=$(date '+%H:%M:%S')
    local vite_pid=$(get_vite_pid)
    local uvicorn_pid=$(get_uvicorn_pid)

    # Memory pressure
    local mem_level=$(/usr/sbin/sysctl -n kern.memorystatus_level 2>/dev/null || echo "?")

    # Process memory (RSS in KB)
    local vite_rss=0 uvicorn_rss=0
    if [[ -n "$vite_pid" ]]; then
        vite_rss=$(ps -o rss= -p "$vite_pid" 2>/dev/null || echo 0)
    fi
    if [[ -n "$uvicorn_pid" ]]; then
        uvicorn_rss=$(ps -o rss= -p "$uvicorn_pid" 2>/dev/null || echo 0)
    fi

    # Convert to MB
    local vite_mb=$((vite_rss / 1024))
    local uvicorn_mb=$((uvicorn_rss / 1024))

    # Swap
    local swap_used=$(/usr/sbin/sysctl -n vm.swapusage 2>/dev/null | grep -o 'used = [0-9.]*M' | grep -o '[0-9.]*' || echo "?")

    echo "$ts | mem_free=${mem_level}% | vite=${vite_mb}MB (pid:${vite_pid:-DEAD}) | uvicorn=${uvicorn_mb}MB (pid:${uvicorn_pid:-DEAD}) | swap=${swap_used}MB" >> "$LOGFILE"

    # Alert on high memory usage
    if [[ "$vite_mb" -gt 400 ]]; then
        log "⚠️  ALERT: Vite memory high: ${vite_mb}MB"
    fi

    # Alert on low system memory
    if [[ "$mem_level" != "?" ]] && [[ "$mem_level" -lt 30 ]]; then
        log "🚨 CRITICAL: System memory free only ${mem_level}%!"
        # Capture full snapshot
        log "--- FULL SNAPSHOT ---"
        ps aux -m | head -30 >> "$LOGFILE"
        log "--- END SNAPSHOT ---"
    fi

    # Detect crashes (PID changed or disappeared)
    if [[ -z "$vite_pid" ]]; then
        log "💀 Vite NOT RUNNING!"
    fi
    if [[ -z "$uvicorn_pid" ]]; then
        log "💀 uvicorn NOT RUNNING!"
    fi
}

# Initial state
log "=== Monitor started ==="
log "System: $(uname -a)"
log "RAM: $(/usr/sbin/sysctl -n hw.memsize 2>/dev/null | awk '{printf "%.0f GB", $1/1024/1024/1024}')"
log "Initial memory free: $(/usr/sbin/sysctl -n kern.memorystatus_level 2>/dev/null)%"
log ""

PREV_VITE_PID=$(get_vite_pid)
PREV_UVICORN_PID=$(get_uvicorn_pid)

while true; do
    snapshot

    # Detect PID changes (crash + restart)
    CUR_VITE_PID=$(get_vite_pid)
    CUR_UVICORN_PID=$(get_uvicorn_pid)

    if [[ -n "$PREV_VITE_PID" ]] && [[ "$CUR_VITE_PID" != "$PREV_VITE_PID" ]]; then
        log "🔄 Vite PID changed: $PREV_VITE_PID → ${CUR_VITE_PID:-DEAD} (CRASH DETECTED)"
    fi
    if [[ -n "$PREV_UVICORN_PID" ]] && [[ "$CUR_UVICORN_PID" != "$PREV_UVICORN_PID" ]]; then
        log "🔄 uvicorn PID changed: $PREV_UVICORN_PID → ${CUR_UVICORN_PID:-DEAD} (CRASH DETECTED)"
    fi

    PREV_VITE_PID=$CUR_VITE_PID
    PREV_UVICORN_PID=$CUR_UVICORN_PID

    sleep "$INTERVAL"
done
