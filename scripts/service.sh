#!/usr/bin/env bash
# CrewHub Service Manager (Mac / Linux)
# Install, uninstall, update, status, and logs for CrewHub as a background service.
# Usage: ./scripts/service.sh {install|uninstall|update|status|logs}

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$HOME/.crewhub"

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
# Platform detection
# ------------------------------------------
detect_platform() {
    case "$(uname -s)" in
        Darwin) echo "macos" ;;
        Linux)  echo "linux" ;;
        *)      error "Unsupported platform: $(uname -s)"; exit 1 ;;
    esac
}

PLATFORM="$(detect_platform)"

# Platform-specific constants
if [[ "$PLATFORM" == "macos" ]]; then
    PLIST_NAME="com.crewhub.backend"
    PLIST_DIR="$HOME/Library/LaunchAgents"
    PLIST_PATH="$PLIST_DIR/$PLIST_NAME.plist"
    LAUNCHD_DOMAIN="gui/$(id -u)"
    LAUNCHD_TARGET="$LAUNCHD_DOMAIN/$PLIST_NAME"
elif [[ "$PLATFORM" == "linux" ]]; then
    SYSTEMD_DIR="$HOME/.config/systemd/user"
    SYSTEMD_UNIT="crewhub.service"
    SYSTEMD_PATH="$SYSTEMD_DIR/$SYSTEMD_UNIT"
fi

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

    if [[ "$PLATFORM" == "linux" ]] && ! command -v systemctl &>/dev/null; then
        error "systemctl not found (systemd required)"
        ok=false
    fi

    if [[ "$ok" != true ]]; then
        exit 1
    fi
}

# ------------------------------------------
# macOS: Generate launchd plist
# ------------------------------------------
generate_plist() {
    local node_dir python_dir env_path bash_path
    node_dir="$(dirname "$(command -v node)")"
    python_dir="$(dirname "$(command -v python3)")"
    env_path="/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:${node_dir}:${python_dir}"
    bash_path="$(command -v bash)"

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
        <string>${bash_path}</string>
        <string>${PROJECT_ROOT}/scripts/watchdog.sh</string>
        <string>start</string>
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
# Linux: Generate systemd user unit
# ------------------------------------------
generate_systemd_unit() {
    local node_dir python_dir env_path
    node_dir="$(dirname "$(command -v node)")"
    python_dir="$(dirname "$(command -v python3)")"
    env_path="/usr/local/bin:/usr/bin:/bin:${node_dir}:${python_dir}"

    mkdir -p "$SYSTEMD_DIR"
    cat > "$SYSTEMD_PATH" <<EOF
[Unit]
Description=CrewHub Background Service
After=network.target

[Service]
Type=simple
WorkingDirectory=${PROJECT_ROOT}
ExecStart=${PROJECT_ROOT}/scripts/watchdog.sh start
ExecStop=${PROJECT_ROOT}/scripts/watchdog.sh stop
Restart=on-failure
RestartSec=10
Environment=PATH=${env_path}
Environment=HOME=${HOME}
Environment=CREWHUB_PORT=${BACKEND_PORT}
Environment=CREWHUB_FRONTEND_PORT=${FRONTEND_PORT}

[Install]
WantedBy=default.target
EOF
}

# ------------------------------------------
# macOS: launchd helpers (modern API)
# ------------------------------------------
launchd_unload() {
    # Try modern API first, fall back to legacy
    launchctl bootout "$LAUNCHD_TARGET" 2>/dev/null || \
        launchctl unload "$PLIST_PATH" 2>/dev/null || true
}

launchd_load() {
    # Try modern API first, fall back to legacy
    if ! launchctl bootstrap "$LAUNCHD_DOMAIN" "$PLIST_PATH" 2>/dev/null; then
        launchctl load "$PLIST_PATH" 2>/dev/null || true
    fi
}

launchd_start() {
    launchctl kickstart -k "$LAUNCHD_TARGET" 2>/dev/null || true
}

# ------------------------------------------
# Start the watchdog directly (works from any context)
# ------------------------------------------
start_watchdog_direct() {
    # Stop any existing watchdog first
    if [[ -x "$SCRIPT_DIR/watchdog.sh" ]]; then
        "$SCRIPT_DIR/watchdog.sh" stop 2>/dev/null || true
    fi
    sleep 1

    # Start in background, detached from terminal
    nohup "$SCRIPT_DIR/watchdog.sh" start >> "$LOG_DIR/backend.log" 2>&1 &
    disown
    sleep 3

    # Verify it started
    if [[ -f "$LOG_DIR/watchdog.pid" ]]; then
        local wpid
        wpid=$(cat "$LOG_DIR/watchdog.pid")
        if kill -0 "$wpid" 2>/dev/null; then
            ok "Watchdog running (PID $wpid)"
            return 0
        fi
    fi
    error "Watchdog failed to start — check $LOG_DIR/backend.log"
    return 1
}

# ------------------------------------------
# Install
# ------------------------------------------
do_install() {
    info "Installing CrewHub as a background service ($PLATFORM)..."
    echo ""

    check_prereqs

    # Build frontend
    info "Building frontend..."
    (cd "$PROJECT_ROOT/frontend" && npm run build) || { error "Frontend build failed"; exit 1; }
    ok "Frontend built"

    # Ensure serve is available
    if [[ ! -x "$PROJECT_ROOT/frontend/node_modules/.bin/serve" ]]; then
        info "Installing serve..."
        (cd "$PROJECT_ROOT/frontend" && npm install --save-dev serve --legacy-peer-deps) || { error "Failed to install serve"; exit 1; }
        ok "serve installed"
    else
        ok "serve already installed"
    fi

    mkdir -p "$LOG_DIR"

    # Start the service now
    info "Starting CrewHub..."
    start_watchdog_direct

    # Register for auto-start on login
    if [[ "$PLATFORM" == "macos" ]]; then
        info "Registering for auto-start on login (launchd)..."
        generate_plist
        launchd_unload
        launchd_load
        # Verify launchd can actually run the script (TCC may block ~/Documents)
        sleep 2
        if launchctl list "$PLIST_NAME" 2>/dev/null | grep -q '"PID"'; then
            ok "Auto-start registered"
        else
            ok "Plist registered (auto-start on login)"
            # Check if the project is in a TCC-protected directory
            case "$PROJECT_ROOT" in
                "$HOME/Documents"*|"$HOME/Desktop"*|"$HOME/Downloads"*)
                    warn "Note: Your project is in a macOS-protected folder ($PROJECT_ROOT)."
                    warn "Auto-start on login may require granting Full Disk Access to /bin/bash"
                    warn "in System Settings > Privacy & Security > Full Disk Access."
                    warn "The service is running now and will survive terminal closes."
                    ;;
            esac
        fi

    elif [[ "$PLATFORM" == "linux" ]]; then
        info "Registering for auto-start on login (systemd)..."
        generate_systemd_unit
        systemctl --user daemon-reload
        systemctl --user enable "$SYSTEMD_UNIT"
        ok "Auto-start registered"
    fi

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

    if [[ "$PLATFORM" == "macos" ]]; then
        if [[ -f "$PLIST_PATH" ]]; then
            launchd_unload
            rm -f "$PLIST_PATH"
            ok "Plist removed"
        else
            warn "Plist not found at $PLIST_PATH (already removed?)"
        fi

    elif [[ "$PLATFORM" == "linux" ]]; then
        if [[ -f "$SYSTEMD_PATH" ]]; then
            systemctl --user stop "$SYSTEMD_UNIT" 2>/dev/null || true
            systemctl --user disable "$SYSTEMD_UNIT" 2>/dev/null || true
            rm -f "$SYSTEMD_PATH"
            systemctl --user daemon-reload
            ok "Systemd unit removed"
        else
            warn "Unit not found at $SYSTEMD_PATH (already removed?)"
        fi
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
    if [[ "$PLATFORM" == "macos" ]]; then
        if [[ -f "$PLIST_PATH" ]]; then
            info "Stopping service..."
            launchd_unload
        fi
    elif [[ "$PLATFORM" == "linux" ]]; then
        if [[ -f "$SYSTEMD_PATH" ]]; then
            info "Stopping service..."
            systemctl --user stop "$SYSTEMD_UNIT" 2>/dev/null || true
        fi
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

    # Start the service
    info "Starting CrewHub..."
    start_watchdog_direct

    # Update auto-start registration
    if [[ "$PLATFORM" == "macos" && -d "$PLIST_DIR" ]]; then
        generate_plist
        launchd_unload
        launchd_load
    elif [[ "$PLATFORM" == "linux" && -d "$SYSTEMD_DIR" ]]; then
        generate_systemd_unit
        systemctl --user daemon-reload
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

    if [[ "$PLATFORM" == "macos" ]]; then
        if launchctl list "$PLIST_NAME" &>/dev/null; then
            ok "launchd: loaded"
        else
            warn "launchd: not loaded"
        fi
    elif [[ "$PLATFORM" == "linux" ]]; then
        local state
        state=$(systemctl --user is-active "$SYSTEMD_UNIT" 2>/dev/null || echo "inactive")
        if [[ "$state" == "active" ]]; then
            ok "systemd: active"
        else
            warn "systemd: $state"
        fi
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
