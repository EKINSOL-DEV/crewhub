#!/usr/bin/env bash
set -euo pipefail

# ============================================
# CrewHub Start Script (Mac / Linux)
# ============================================
# Starts backend and frontend for local development.
# Usage: ./scripts/start.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

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
echo -e "${BOLD}  CrewHub Development Server${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""

(
    cd "$PROJECT_ROOT/backend"
    source venv/bin/activate

    # Load env vars from .env.development
    if [[ -f .env.development ]]; then
        set -a
        while IFS='=' read -r key value; do
            # Skip comments and empty lines
            [[ -z "$key" || "$key" =~ ^# ]] && continue
            # Expand ~ in values
            value=$(eval echo "$value")
            export "$key=$value"
        done < .env.development
        set +a
    fi

    python -m uvicorn app.main:app --reload --port "${CREWHUB_PORT:-8091}"
) &
backend_pid=$!

# ------------------------------------------
# Start frontend
# ------------------------------------------
(
    cd "$PROJECT_ROOT/frontend"

    # Load env vars from .env.development
    if [[ -f .env.development ]]; then
        set -a
        while IFS='=' read -r key value; do
            [[ -z "$key" || "$key" =~ ^# ]] && continue
            export "$key=$value"
        done < .env.development
        set +a
    fi

    npm run dev -- --port "${VITE_DEV_PORT:-5181}"
) &
frontend_pid=$!

echo ""
echo -e "  ${GREEN}Backend:${NC}  http://localhost:${CREWHUB_PORT:-8091}"
echo -e "  ${GREEN}Frontend:${NC} http://localhost:${VITE_DEV_PORT:-5181}"
echo ""
echo -e "  Press ${BOLD}Ctrl+C${NC} to stop both services."
echo ""

# Wait for either process to exit
wait
