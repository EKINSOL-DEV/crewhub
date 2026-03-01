#!/usr/bin/env bash
set -euo pipefail

# ============================================
# CrewHub Setup Script (Mac / Linux)
# ============================================
# One-command setup: ./scripts/setup.sh
# Checks prerequisites, creates venv, installs dependencies.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

passed=()
warnings=()
failed=()

print_header() {
    echo ""
    echo -e "${BOLD}============================================${NC}"
    echo -e "${BOLD}  CrewHub Setup${NC}"
    echo -e "${BOLD}============================================${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}>>>${NC} $1"
}

print_ok() {
    echo -e "  ${GREEN}✓${NC} $1"
    passed+=("$1")
}

print_warn() {
    echo -e "  ${YELLOW}!${NC} $1"
    warnings+=("$1")
}

print_fail() {
    echo -e "  ${RED}✗${NC} $1"
    failed+=("$1")
}

# ------------------------------------------
# Check Python 3.11+
# ------------------------------------------
check_python() {
    print_step "Checking Python..."

    local python_cmd=""
    if command -v python3 &>/dev/null; then
        python_cmd="python3"
    elif command -v python &>/dev/null; then
        python_cmd="python"
    fi

    if [[ -z "$python_cmd" ]]; then
        print_fail "Python 3.11+ is required but not found."
        echo "       Install it:"
        echo "         Mac:    brew install python@3.11"
        echo "         Ubuntu: sudo apt install python3.11 python3.11-venv"
        return 1
    fi

    local version
    version=$($python_cmd -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    local major minor
    major=$(echo "$version" | cut -d. -f1)
    minor=$(echo "$version" | cut -d. -f2)

    if [[ "$major" -lt 3 ]] || { [[ "$major" -eq 3 ]] && [[ "$minor" -lt 11 ]]; }; then
        print_fail "Python $version found, but 3.11+ is required."
        echo "       Install a newer version:"
        echo "         Mac:    brew install python@3.11"
        echo "         Ubuntu: sudo apt install python3.11 python3.11-venv"
        return 1
    fi

    PYTHON_CMD="$python_cmd"
    print_ok "Python $version"
    return 0
}

# ------------------------------------------
# Check Node.js 18+
# ------------------------------------------
check_node() {
    print_step "Checking Node.js..."

    if ! command -v node &>/dev/null; then
        print_fail "Node.js 18+ is required but not found."
        echo "       Install it:"
        echo "         Mac:    brew install node"
        echo "         Or use: https://nodejs.org"
        return 1
    fi

    local version
    version=$(node --version | sed 's/^v//')
    local major
    major=$(echo "$version" | cut -d. -f1)

    if [[ "$major" -lt 18 ]]; then
        print_fail "Node.js $version found, but 18+ is required."
        echo "       Update it:"
        echo "         Mac:    brew upgrade node"
        echo "         Or use: https://nodejs.org"
        return 1
    fi

    print_ok "Node.js $version"
    return 0
}

# ------------------------------------------
# Check npm
# ------------------------------------------
check_npm() {
    print_step "Checking npm..."

    if ! command -v npm &>/dev/null; then
        print_fail "npm is required but not found (should come with Node.js)."
        return 1
    fi

    local version
    version=$(npm --version)
    print_ok "npm $version"
    return 0
}

# ------------------------------------------
# Check Claude Code CLI (optional)
# ------------------------------------------
check_claude() {
    print_step "Checking Claude Code CLI..."

    if ! command -v claude &>/dev/null; then
        print_warn "Claude Code CLI not found (optional)."
        echo "       Install it for full Claude Code support:"
        echo "         npm install -g @anthropic-ai/claude-code"
        echo "       CrewHub will still work for OpenClaw monitoring without it."
        return 0
    fi

    local version
    version=$(claude --version 2>/dev/null || echo "unknown")
    print_ok "Claude Code CLI $version"
    return 0
}

# ------------------------------------------
# Setup Python venv + backend deps
# ------------------------------------------
setup_backend() {
    print_step "Setting up backend..."

    local venv_path="$PROJECT_ROOT/backend/venv"

    if [[ ! -d "$venv_path" ]]; then
        echo "       Creating Python virtual environment..."
        $PYTHON_CMD -m venv "$venv_path"
        print_ok "Created venv at backend/venv"
    else
        print_ok "venv already exists at backend/venv"
    fi

    echo "       Installing Python dependencies..."
    "$venv_path/bin/pip" install --quiet --upgrade pip
    "$venv_path/bin/pip" install --quiet -r "$PROJECT_ROOT/backend/requirements.txt"
    print_ok "Backend dependencies installed"

    # Copy .env.development if it doesn't exist
    if [[ ! -f "$PROJECT_ROOT/backend/.env.development" ]]; then
        if [[ -f "$PROJECT_ROOT/backend/.env.example" ]]; then
            cp "$PROJECT_ROOT/backend/.env.example" "$PROJECT_ROOT/backend/.env.development"
            print_ok "Created backend/.env.development from .env.example"
        fi
    else
        print_ok "backend/.env.development already exists"
    fi
}

# ------------------------------------------
# Setup frontend deps
# ------------------------------------------
setup_frontend() {
    print_step "Setting up frontend..."

    echo "       Installing npm dependencies (this may take a minute)..."
    cd "$PROJECT_ROOT/frontend"
    npm install --legacy-peer-deps --silent 2>&1 | tail -1
    cd "$PROJECT_ROOT"
    print_ok "Frontend dependencies installed"

    # Copy .env.development if it doesn't exist
    if [[ ! -f "$PROJECT_ROOT/frontend/.env.development" ]]; then
        echo "       Creating frontend/.env.development..."
        cat > "$PROJECT_ROOT/frontend/.env.development" <<'ENVEOF'
# Development environment - Vite dev server
VITE_API_URL=http://127.0.0.1:8091
ENVEOF
        print_ok "Created frontend/.env.development"
    else
        print_ok "frontend/.env.development already exists"
    fi
}

# ------------------------------------------
# Print summary
# ------------------------------------------
print_summary() {
    echo ""
    echo -e "${BOLD}============================================${NC}"
    echo -e "${BOLD}  Setup Summary${NC}"
    echo -e "${BOLD}============================================${NC}"

    if [[ ${#passed[@]} -gt 0 ]]; then
        echo ""
        echo -e "${GREEN}Passed:${NC}"
        for item in "${passed[@]}"; do
            echo -e "  ${GREEN}✓${NC} $item"
        done
    fi

    if [[ ${#warnings[@]} -gt 0 ]]; then
        echo ""
        echo -e "${YELLOW}Warnings:${NC}"
        for item in "${warnings[@]}"; do
            echo -e "  ${YELLOW}!${NC} $item"
        done
    fi

    if [[ ${#failed[@]} -gt 0 ]]; then
        echo ""
        echo -e "${RED}Failed:${NC}"
        for item in "${failed[@]}"; do
            echo -e "  ${RED}✗${NC} $item"
        done
        echo ""
        echo -e "${RED}Please fix the issues above and re-run ./scripts/setup.sh${NC}"
        exit 1
    fi

    echo ""
    echo -e "${GREEN}${BOLD}Setup complete!${NC}"
    echo ""
    echo "  Start CrewHub:"
    echo "    ./scripts/start.sh"
    echo ""
    echo "  Or use Make:"
    echo "    make dev"
    echo ""
}

# ------------------------------------------
# Main
# ------------------------------------------
main() {
    print_header

    PYTHON_CMD="python3"
    local prereqs_ok=true

    check_python || prereqs_ok=false
    check_node   || prereqs_ok=false
    check_npm    || prereqs_ok=false
    check_claude

    if [[ "$prereqs_ok" != true ]]; then
        echo ""
        echo -e "${RED}Prerequisites missing. Please install them and re-run this script.${NC}"
        exit 1
    fi

    echo ""
    setup_backend
    setup_frontend

    print_summary
}

main "$@"
