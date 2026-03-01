#!/usr/bin/env bash
set -euo pipefail

# ============================================
# CrewHub Start Script (Mac / Linux)
# ============================================
# Starts backend and frontend for local use.
# Uses production ports (8090/5181) by default.
# Usage: ./scripts/start.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Default ports (override with env vars)
BACKEND_PORT="${CREWHUB_PORT:-8090}"
FRONTEND_PORT="${VITE_DEV_PORT:-5181}"

backend_pid=""
frontend_pid=""

cleanup() {
    echo ""
    echo -e "${BLUE}>>>${NC} Shutting down..."
    [[ -n "$backend_pid" ]]  && kill "$backend_pid"  2>/dev/null && wait "$backend_pid" 2>/dev/null
    [[ -n "$frontend_pid" ]] && kill "$frontend_pid" 2>/dev/null && wait "$frontend_pid" 2>/dev/null
    echo -e "${GREEN}Stopped.${NC}"
    exit 0
}

trap cleanup INT TERM

# ------------------------------------------
# Preflight checks
# ------------------------------------------
if [[ ! -d "$PROJECT_ROOT/backend/venv" ]]; then
    echo -e "${RED}Backend venv not found. Run setup first:${NC}"
    echo "  ./scripts/setup.sh"
    exit 1
fi

if [[ ! -d "$PROJECT_ROOT/frontend/node_modules" ]]; then
    echo -e "${RED}Frontend node_modules not found. Run setup first:${NC}"
    echo "  ./scripts/setup.sh"
    exit 1
fi

# ------------------------------------------
# Start backend
# ------------------------------------------
echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD}  CrewHub${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""

(
    cd "$PROJECT_ROOT/backend"
    source venv/bin/activate

    # Set defaults for local run
    export CREWHUB_PORT="$BACKEND_PORT"
    export CREWHUB_DB_PATH="${CREWHUB_DB_PATH:-$(eval echo '~/.crewhub/crewhub.db')}"
    export OPENCLAW_GATEWAY_URL="${OPENCLAW_GATEWAY_URL:-ws://localhost:18789}"

    python -m uvicorn app.main:app --reload --port "$BACKEND_PORT"
) &
backend_pid=$!

# ------------------------------------------
# Start frontend
# ------------------------------------------
(
    cd "$PROJECT_ROOT/frontend"

    # Point Vite proxy at the backend port
    export VITE_API_URL="http://127.0.0.1:$BACKEND_PORT"

    npm run dev -- --port "$FRONTEND_PORT"
) &
frontend_pid=$!

echo ""
echo -e "  ${GREEN}Backend:${NC}  http://localhost:$BACKEND_PORT"
echo -e "  ${GREEN}Frontend:${NC} http://localhost:$FRONTEND_PORT"
echo ""
echo -e "  Press ${BOLD}Ctrl+C${NC} to stop both services."
echo ""

# Wait for either process to exit
wait
