#!/usr/bin/env bash
# CrewHub Service Manager (Mac / Linux)
# Install, uninstall, update, status, and logs for CrewHub as a background service.
# Usage: ./scripts/service.sh {install|uninstall|update|status|logs}

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$HOME/.crewhub"
PLIST_NAME="com.crewhub.backend"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$PLIST_DIR/$PLIST_NAME.plist"

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

BACKEND_PORT="${CREWHUB_PORT:-8090}"
FRONTEND_PORT="${CREWHUB_FRONTEND_PORT:-8446}"

info()  { echo -e "${BLUE}>>>${NC} $*"; }
ok()    { echo -e "${GREEN}>>>${NC} $*"; }
warn()  { echo -e "${YELLOW}>>>${NC} $*"; }
error() { echo -e "${RED}>>>${NC} $*"; }

# ------------------------------------------
# Prerequisite checks
# ------------------------------------------
check_prereqs() {
    local ok=true

    if [[ ! -d "$PROJECT_ROOT/backend/venv" ]]; then
        error "Backend venv not found. Run setup first: ./scripts/setup.sh"
        ok=false
    fi

    if [[ ! -d "$PROJECT_ROOT/frontend/node_modules" ]]; then
        error "Frontend node_modules not found. Run setup first: ./scripts/setup.sh"
        ok=false
    fi

    if ! command -v python3 &>/dev/null; then
        error "python3 not found"
        ok=false
    fi

    if ! command -v node &>/dev/null; then
        error "node not found"
        ok=false
    fi

    if [[ "$ok" != true ]]; then
        exit 1
    fi
}

# ------------------------------------------
# Generate launchd plist with correct paths
# ------------------------------------------
generate_plist() {
    # Build PATH: include common locations + wherever node/python live
    local node_dir
    node_dir="$(dirname "$(command -v node)")"
    local python_dir
    python_dir="$(dirname "$(command -v python3)")"
    local env_path="/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:${node_dir}:${python_dir}"

    mkdir -p "$PLIST_DIR"
    cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>exec ${PROJECT_ROOT}/scripts/watchdog.sh start</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <false/>

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/launchd-stdout.log</string>

    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/launchd-stderr.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${env_path}</string>
        <key>HOME</key>
        <string>${HOME}</string>
        <key>CREWHUB_PORT</key>
        <string>${BACKEND_PORT}</string>
        <key>CREWHUB_FRONTEND_PORT</key>
        <string>${FRONTEND_PORT}</string>
    </dict>

    <key>WorkingDirectory</key>
    <string>${PROJECT_ROOT}</string>
</dict>
</plist>
EOF
}

# ------------------------------------------
# Install
# ------------------------------------------
do_install() {
    info "Installing CrewHub as a background service..."
    echo ""

    check_prereqs

    # Build frontend
    info "Building frontend..."
    (cd "$PROJECT_ROOT/frontend" && npm run build) || { error "Frontend build failed"; exit 1; }
    ok "Frontend built"

    # Ensure serve is available
    if ! (cd "$PROJECT_ROOT/frontend" && npx serve --version) &>/dev/null; then
        info "Installing serve..."
        (cd "$PROJECT_ROOT/frontend" && npm install --save-dev serve --legacy-peer-deps) || { error "Failed to install serve"; exit 1; }
        ok "serve installed"
    fi

    mkdir -p "$LOG_DIR"

    # Generate plist
    info "Generating launchd plist..."
    generate_plist
    ok "Plist written to $PLIST_PATH"

    # Load service
    # Unload first if already loaded (ignore errors)
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    launchctl load "$PLIST_PATH"
    ok "Service loaded"

    echo ""
    ok "CrewHub service installed and started!"
    echo ""
    echo -e "  ${GREEN}Backend:${NC}  http://localhost:$BACKEND_PORT"
    echo -e "  ${GREEN}Frontend:${NC} http://localhost:$FRONTEND_PORT"
    echo ""
    echo -e "  The service will start automatically on login."
    echo -e "  Run ${BOLD}./scripts/service.sh status${NC} to check."
    echo ""
}

# ------------------------------------------
# Uninstall
# ------------------------------------------
do_uninstall() {
    info "Uninstalling CrewHub service..."

    # Unload from launchd
    if [[ -f "$PLIST_PATH" ]]; then
        launchctl unload "$PLIST_PATH" 2>/dev/null || true
        rm -f "$PLIST_PATH"
        ok "Plist removed"
    else
        warn "Plist not found at $PLIST_PATH (already removed?)"
    fi

    # Stop running processes via watchdog
    if [[ -x "$SCRIPT_DIR/watchdog.sh" ]]; then
        "$SCRIPT_DIR/watchdog.sh" stop 2>/dev/null || true
    fi

    # Clean up any orphan processes on service ports
    lsof -ti:"$BACKEND_PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
    lsof -ti:"$FRONTEND_PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true

    echo ""
    ok "CrewHub service uninstalled."
    echo ""
}

# ------------------------------------------
# Update
# ------------------------------------------
do_update() {
    info "Updating CrewHub..."
    echo ""

    # Stop the service
    if [[ -f "$PLIST_PATH" ]]; then
        info "Stopping service..."
        launchctl unload "$PLIST_PATH" 2>/dev/null || true
    fi

    # Stop processes
    if [[ -x "$SCRIPT_DIR/watchdog.sh" ]]; then
        "$SCRIPT_DIR/watchdog.sh" stop 2>/dev/null || true
    fi

    # Pull latest code
    info "Pulling latest code..."
    (cd "$PROJECT_ROOT" && git pull) || { error "git pull failed"; exit 1; }
    ok "Code updated"

    # Update backend deps
    info "Updating backend dependencies..."
    (cd "$PROJECT_ROOT/backend" && source venv/bin/activate && pip install -r requirements.txt -q) || { error "pip install failed"; exit 1; }
    ok "Backend dependencies updated"

    # Update frontend deps
    info "Updating frontend dependencies..."
    (cd "$PROJECT_ROOT/frontend" && npm install --legacy-peer-deps) || { error "npm install failed"; exit 1; }
    ok "Frontend dependencies updated"

    # Rebuild frontend
    info "Building frontend..."
    (cd "$PROJECT_ROOT/frontend" && npm run build) || { error "Frontend build failed"; exit 1; }
    ok "Frontend rebuilt"

    # Regenerate plist (paths may have changed) and reload
    if [[ -d "$PLIST_DIR" ]]; then
        info "Reloading service..."
        generate_plist
        launchctl load "$PLIST_PATH"
        ok "Service reloaded"
    else
        warn "No LaunchAgents directory — skipping service reload."
        warn "Run './scripts/service.sh install' to set up the service."
    fi

    echo ""
    ok "Update complete!"
    echo ""
    echo -e "  ${GREEN}Backend:${NC}  http://localhost:$BACKEND_PORT"
    echo -e "  ${GREEN}Frontend:${NC} http://localhost:$FRONTEND_PORT"
    echo ""
}

# ------------------------------------------
# Status
# ------------------------------------------
do_status() {
    echo -e "${BOLD}CrewHub Service Status${NC}"
    echo ""

    # Check launchd
    if launchctl list "$PLIST_NAME" &>/dev/null; then
        ok "launchd: loaded"
    else
        warn "launchd: not loaded"
    fi

    # Delegate to watchdog for process details
    if [[ -x "$SCRIPT_DIR/watchdog.sh" ]]; then
        "$SCRIPT_DIR/watchdog.sh" status
    fi

    echo ""
    echo -e "  ${GREEN}Backend:${NC}  http://localhost:$BACKEND_PORT"
    echo -e "  ${GREEN}Frontend:${NC} http://localhost:$FRONTEND_PORT"
    echo ""
}

# ------------------------------------------
# Logs
# ------------------------------------------
do_logs() {
    local log_file="$LOG_DIR/backend.log"
    if [[ -f "$log_file" ]]; then
        tail -f "$log_file"
    else
        warn "No log file found at $log_file"
        exit 1
    fi
}

# ------------------------------------------
# Main
# ------------------------------------------
case "${1:-}" in
    install)    do_install ;;
    uninstall)  do_uninstall ;;
    update)     do_update ;;
    status)     do_status ;;
    logs)       do_logs ;;
    *)
        echo "Usage: $0 {install|uninstall|update|status|logs}"
        echo ""
        echo "Commands:"
        echo "  install    Build, register, and start CrewHub as a background service"
        echo "  uninstall  Stop and remove the CrewHub service"
        echo "  update     Pull latest code, rebuild, and restart the service"
        echo "  status     Show service and process status"
        echo "  logs       Tail the service log file"
        exit 1
        ;;
esac
