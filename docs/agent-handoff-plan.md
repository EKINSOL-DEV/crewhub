# Agent Handoff - Implementation Plan

> **Version:** v0.20.0
> **Branch:** `feature/agent-handoff`
> **Date:** 2026-03-08
> **Status:** Implemented

---

## 1. Feature Overview

### What is Agent Handoff?

Agent Handoff replaces Zen Mode as CrewHub's primary way to interact with agents outside the dashboard. Instead of building a custom tmux-inspired UI (Zen Mode), CrewHub becomes the **orchestration and monitoring layer** that hands off to native tools when deeper interaction is needed.

**Rationale:** Claude Desktop now has Claude Code built-in, Codex has its own UI, and terminals are the natural home for CLI agents. A custom "Zen Mode" duplicates what these tools already do better. CrewHub should focus on what it does best: monitoring, orchestrating, and providing context.

### What replaces Zen Mode (UI-wise)

| Zen Mode Feature | Replacement |
|---|---|
| Full-screen agent view | "Continue in..." handoff buttons on session cards/detail panels |
| Chat panel | Hand off to Claude CLI (`--resume`) in terminal |
| Session list | Stays in main CrewHub dashboard (already exists) |
| Activity panel | Stays in main CrewHub dashboard |
| Keyboard shortcuts | Removed (native tools have their own) |
| Themes (Tokyo Night, etc.) | Removed |
| Layout presets | Removed |
| Command palette | Simplified, stays in main dashboard if useful |

### Supported Handoff Targets (priority order)

1. **Continue in Terminal** (Claude CLI `--resume`) - Primary target
2. **Continue in VS Code Terminal** - Secondary target
3. **Copy Command to Clipboard** - Universal fallback
4. **Open in Codex** (OpenAI) - Future/when installed

### UX Flow

1. User sees an agent session in CrewHub (session card, detail panel, or activity view)
2. User clicks **"Continue in..."** dropdown button
3. Dropdown shows available targets (auto-detected based on what's installed)
4. User selects target (e.g., "Terminal (iTerm2)")
5. CrewHub:
   - Constructs the appropriate CLI command
   - Executes handoff (opens terminal with command, or copies to clipboard)
   - Shows brief success toast notification
   - Session continues to be monitored in CrewHub (JSONL watcher keeps running)

---

## 2. Handoff Targets (Research-Based)

### 2.1 Continue in Terminal (Claude CLI) - PRIMARY

**Technical mechanism:** Execute `claude --resume <session-id>` in the user's terminal via AppleScript.

**Claude CLI session resumption:**
- `claude --resume <session-id>` - Resume a specific session by UUID
- `claude --resume` (no ID) - Opens interactive picker for recent sessions
- `claude --continue` or `claude -c` - Continue the most recent session in current directory
- `claude --fork-session` - When resuming, create a new session ID (preserves original)
- Sessions stored at: `~/.claude/projects/<encoded-path>/<session-id>.jsonl`
- Session index at: `~/.claude/projects/<encoded-path>/sessions-index.json`

**What session context is passed:**
- Session ID (UUID) from CrewHub's session tracking
- For Claude Code sessions (`claude:*` keys): extract session ID directly
- For CC-type agents (`cc:*` keys): look up mapped session ID from `_agent_sessions`
- Project path (determines which `~/.claude/projects/` directory to use)

**Important caveat:** When resuming with `--resume`, Claude Code creates a **new session ID** (see anthropics/claude-code#12235). The original JSONL file is read for context but new messages go to a new file. CrewHub's watcher will pick up the new session automatically.

**macOS implementation - iTerm2 (detected on this machine):**

```python
import subprocess

def handoff_to_iterm(command: str, working_dir: str = None) -> bool:
    """Open iTerm2 with a command via AppleScript."""
    cd_part = f'cd {working_dir} && ' if working_dir else ''
    script = f'''
    tell application "iTerm"
        activate
        set newWindow to (create window with default profile)
        tell current session of newWindow
            write text "{cd_part}{command}"
        end tell
    end tell
    '''
    result = subprocess.run(
        ['osascript', '-e', script],
        capture_output=True, text=True, timeout=10
    )
    return result.returncode == 0
```

**macOS implementation - Terminal.app (fallback):**

```python
def handoff_to_terminal(command: str, working_dir: str = None) -> bool:
    """Open Terminal.app with a command via AppleScript."""
    cd_part = f'cd {working_dir} && ' if working_dir else ''
    script = f'''
    tell application "Terminal"
        activate
        do script "{cd_part}{command}"
    end tell
    '''
    result = subprocess.run(
        ['osascript', '-e', script],
        capture_output=True, text=True, timeout=10
    )
    return result.returncode == 0
```

**Detecting installed terminal:**

```python
import os

def detect_terminal() -> str:
    """Detect which terminal app is available (preference order)."""
    terminals = [
        ("/Applications/iTerm.app", "iterm"),
        ("/Applications/Warp.app", "warp"),
        ("/System/Applications/Utilities/Terminal.app", "terminal"),
        ("/Applications/Utilities/Terminal.app", "terminal"),
    ]
    for path, name in terminals:
        if os.path.exists(path):
            return name
    return "terminal"  # fallback
```

**Limitations:**
- macOS only (AppleScript)
- Requires terminal app to be installed
- `--resume` creates a new session ID (original session becomes "historical")
- Session must exist as a JSONL file on disk (OpenClaw sessions can't be resumed this way)

### 2.2 Continue in VS Code Terminal - SECONDARY

**Technical mechanism:** Open VS Code with a new terminal running the resume command.

```python
def handoff_to_vscode(command: str, working_dir: str = None) -> bool:
    """Open VS Code integrated terminal with a command."""
    import subprocess

    args = ['code']
    if working_dir:
        args.extend(['--folder-uri', f'file://{working_dir}'])

    # Open VS Code first
    subprocess.run(args, capture_output=True, timeout=10)

    # Then use AppleScript to type in terminal
    # VS Code doesn't have a direct "run command in terminal" CLI flag,
    # so we use the integrated terminal via its command palette
    script = f'''
    tell application "Visual Studio Code"
        activate
    end tell
    delay 0.5
    tell application "System Events"
        -- Open terminal: Ctrl+`
        keystroke "`" using control down
        delay 0.3
        -- Type the command
        keystroke "{command}"
        keystroke return
    end tell
    '''
    result = subprocess.run(
        ['osascript', '-e', script],
        capture_output=True, text=True, timeout=15
    )
    return result.returncode == 0
```

**Limitations:**
- Relies on VS Code being installed (`code` CLI in PATH - confirmed on this machine)
- AppleScript System Events requires accessibility permissions
- Less reliable than direct terminal handoff

### 2.3 Copy Command to Clipboard - UNIVERSAL FALLBACK

**Technical mechanism:** Copy the ready-to-paste command to the system clipboard.

```python
def handoff_to_clipboard(command: str) -> bool:
    """Copy the resume command to clipboard."""
    import subprocess
    result = subprocess.run(
        ['pbcopy'],
        input=command.encode(),
        capture_output=True, timeout=5
    )
    return result.returncode == 0
```

**Frontend alternative (no backend needed):**

```typescript
async function copyHandoffCommand(command: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(command)
    return true
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = command
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    return true
  }
}
```

**What gets copied:**
- For Claude sessions: `cd /path/to/project && claude --resume <session-id>`
- For OpenClaw sessions: `cd /path/to/project && claude --resume` (opens picker)

### 2.4 Open in Codex (OpenAI) - FUTURE

**Status:** Codex CLI (`@openai/codex`) is **not installed** on this machine. Research indicates:

- Install: `npm i -g @openai/codex` or `brew install codex`
- Session resume: `codex resume <session-id>` or `codex resume --last`
- Experimental: `-c experimental_resume="/path/to/session.jsonl"` for specific sessions
- Sessions stored at: `~/.codex/sessions/YYYY/MM/DD/*.jsonl`

**Technical mechanism (when available):**

```python
def handoff_to_codex(session_id: str = None, working_dir: str = None) -> bool:
    """Hand off to Codex CLI in terminal."""
    if session_id:
        command = f'codex resume {session_id}'
    else:
        command = 'codex resume --last'
    return handoff_to_terminal(command, working_dir)
```

**Limitations:**
- Not installed on this machine
- Session format differs from Claude Code
- Can only resume Codex sessions, not Claude sessions
- Deferred to future version

### 2.5 Claude Desktop - NOT VIABLE (Currently)

**Research findings:**
- Claude Desktop is **not installed** on this machine
- No known `claude://` protocol handler exists
- Claude Desktop does not expose CLI or deep link APIs for opening specific conversations
- No documented way to pass a session/conversation ID to Claude Desktop
- Even if installed, there's no mechanism to transfer a Claude Code CLI session into Claude Desktop

**Verdict:** Not a viable handoff target. Skip entirely.

---

## 3. Zen Mode Deprecation Plan

### Components to Remove (35+ files)

**Core Zen Mode files:**
- `frontend/src/components/zen/ZenMode.tsx` (main component)
- `frontend/src/components/zen/ZenMode.css`
- `frontend/src/components/zen/ZenTopBar.tsx`
- `frontend/src/components/zen/ZenStatusBar.tsx`
- `frontend/src/components/zen/ZenTabBar.tsx`
- `frontend/src/components/zen/ZenPanel.tsx`
- `frontend/src/components/zen/ZenPanelContainer.tsx`
- `frontend/src/components/zen/ZenErrorBoundary.tsx`
- `frontend/src/components/zen/ZenEmptyPanel.tsx`
- `frontend/src/components/zen/ZenTooltip.tsx`
- `frontend/src/components/zen/ZenContextMenu.tsx`

**Panel components:**
- `frontend/src/components/zen/ZenChatPanel.tsx`
- `frontend/src/components/zen/ZenSessionsPanel.tsx`
- `frontend/src/components/zen/ZenSessionDetailPanel.tsx`
- `frontend/src/components/zen/ZenActivityPanel.tsx`
- `frontend/src/components/zen/ZenActivityDetailPanel.tsx`
- `frontend/src/components/zen/ZenRoomsPanel.tsx`
- `frontend/src/components/zen/ZenTasksPanel.tsx`
- `frontend/src/components/zen/ZenKanbanPanel.tsx`
- `frontend/src/components/zen/ZenCronPanel.tsx`
- `frontend/src/components/zen/ZenLogsPanel.tsx`
- `frontend/src/components/zen/ZenDocsPanel.tsx`
- `frontend/src/components/zen/ZenDocumentsPanel.tsx`
- `frontend/src/components/zen/ZenBrowserPanel.tsx`
- `frontend/src/components/zen/ProjectsPanel.tsx`
- `frontend/src/components/zen/ProjectAgentsPanel.tsx`
- `frontend/src/components/zen/ProjectOverviewTab.tsx`
- `frontend/src/components/zen/ProjectFilterSelect.tsx`
- `frontend/src/components/zen/ProjectManagerModal.tsx`

**Feature components:**
- `frontend/src/components/zen/ZenCommandPalette.tsx`
- `frontend/src/components/zen/ZenKeyboardHelp.tsx`
- `frontend/src/components/zen/ZenThemePicker.tsx`
- `frontend/src/components/zen/ZenLayoutManager.tsx`
- `frontend/src/components/zen/ZenSessionManager.tsx` (ZenAgentPicker)
- `frontend/src/components/zen/ImageDropZone.tsx`

**Hooks:**
- `frontend/src/components/zen/hooks/useZenMode.tsx`
- `frontend/src/components/zen/hooks/useZenLayout.tsx` (if exists)
- `frontend/src/components/zen/hooks/useZenKeyboard.tsx` (if exists)
- `frontend/src/components/zen/hooks/useZenTheme.tsx` (if exists)

**Supporting directories:**
- `frontend/src/components/zen/themes/` (entire directory)
- `frontend/src/components/zen/types/` (entire directory)
- `frontend/src/components/zen/utils/` (entire directory)
- `frontend/src/components/zen/registry/`
- `frontend/src/components/zen/PixelAvatar/`
- `frontend/src/components/zen/index.ts`

**Tests:**
- `frontend/src/test/zen/ZenMode.test.tsx`
- `frontend/src/test/hooks/useZenMode.test.tsx`

**App.tsx changes:**
- Remove ZenMode imports
- Remove `useZenMode()` hook usage
- Remove Ctrl+Shift+Z keyboard shortcut
- Remove `isZenModeUrl()` helper
- Remove `openZenWindow()` helper
- Remove zen mode conditional rendering block
- Remove auto-launch zen mode logic
- Remove `ZenModeProvider` wrapper

### What to Keep/Repurpose

- `DetailPanelShell.tsx` - Generic UI component, useful for session detail views. Move to `components/shared/`.
- `FullscreenDetailView.tsx` - Can stay in shared components.
- `SessionHistoryView` (already in `components/shared/`) - Keep as-is.

### Migration for Existing Users

- **v0.20.0:** Zen Mode is **deprecated**. Show a deprecation banner if `?mode=zen` is used or `crewhub-zen-auto-launch` localStorage is set. Banner explains the new "Continue in..." feature and links to docs.
- **v0.20.0:** Remove the `crewhub-zen-auto-launch` localStorage flag.
- **v0.21.0:** Fully remove all Zen Mode code and components.

### Versioning

| Version | Action |
|---|---|
| v0.20.0 | Zen Mode deprecated, handoff feature added, deprecation banner shown |
| v0.21.0 | Zen Mode code fully removed |

---

## 4. Technical Architecture

### Overview

Handoff requires both **frontend** and **backend** components:

- **Frontend:** UI buttons, target detection, clipboard fallback
- **Backend:** AppleScript execution (terminal handoff), session ID resolution

### Backend: New Handoff Endpoint

**File:** `backend/app/routes/sessions.py` (extend existing)

```
POST /api/sessions/{session_key}/handoff
```

**Request body:**
```json
{
  "target": "iterm" | "terminal" | "vscode" | "clipboard",
  "working_dir": "/optional/override/path"
}
```

**Response:**
```json
{
  "success": true,
  "target": "iterm",
  "command": "cd /Users/ekinbot/clawd && claude --resume abc-123-def",
  "message": "Opened in iTerm2"
}
```

**Error response:**
```json
{
  "success": false,
  "error": "Session not found",
  "fallback_command": "claude --resume"
}
```

### Backend: Handoff Service

**File:** `backend/app/services/handoff.py` (new)

```python
"""
Agent Handoff Service
Constructs CLI commands and executes handoff to external tools.
"""

import os
import subprocess
import logging
from typing import Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class HandoffResult:
    success: bool
    target: str
    command: str
    message: str
    error: Optional[str] = None


class HandoffService:
    """Handles agent session handoff to external tools."""

    def detect_available_targets(self) -> list[dict]:
        """Detect which handoff targets are available on this machine."""
        targets = []

        # Terminal detection
        terminal = self._detect_terminal()
        targets.append({
            "id": terminal,
            "label": self._terminal_label(terminal),
            "icon": "terminal",
            "available": True,
        })

        # VS Code
        if self._has_vscode():
            targets.append({
                "id": "vscode",
                "label": "VS Code Terminal",
                "icon": "code",
                "available": True,
            })

        # Clipboard (always available)
        targets.append({
            "id": "clipboard",
            "label": "Copy Command",
            "icon": "clipboard",
            "available": True,
        })

        return targets

    def build_command(
        self,
        session_id: str,
        project_path: Optional[str] = None,
        source: Optional[str] = None,
    ) -> str:
        """Build the CLI command for resuming a session."""
        parts = []
        if project_path:
            parts.append(f'cd {project_path}')

        if source == 'claude_code':
            parts.append(f'claude --resume {session_id}')
        else:
            # OpenClaw sessions can't be directly resumed in Claude CLI
            # Offer to start a new session in the project directory
            parts.append('claude')

        return ' && '.join(parts)

    def execute_handoff(
        self,
        command: str,
        target: str,
        working_dir: Optional[str] = None,
    ) -> HandoffResult:
        """Execute the handoff to the specified target."""
        try:
            if target in ('iterm', 'terminal', 'warp'):
                return self._handoff_terminal(command, target, working_dir)
            elif target == 'vscode':
                return self._handoff_vscode(command, working_dir)
            elif target == 'clipboard':
                return self._handoff_clipboard(command)
            else:
                return HandoffResult(
                    success=False, target=target, command=command,
                    message="", error=f"Unknown target: {target}"
                )
        except Exception as e:
            logger.error("Handoff failed: %s", e)
            return HandoffResult(
                success=False, target=target, command=command,
                message="", error=str(e)
            )

    # ... (terminal/vscode/clipboard implementations as shown in section 2)
```

### Backend: Available Targets Endpoint

```
GET /api/handoff/targets
```

**Response:**
```json
{
  "targets": [
    {"id": "iterm", "label": "iTerm2", "icon": "terminal", "available": true},
    {"id": "vscode", "label": "VS Code Terminal", "icon": "code", "available": true},
    {"id": "clipboard", "label": "Copy Command", "icon": "clipboard", "available": true}
  ]
}
```

This endpoint is called once on frontend load and cached.

### Security Considerations

- **Localhost only:** CrewHub backend already runs on `localhost:8091`, no external access
- **Session validation:** Verify session exists before handoff (check JSONL file or session index)
- **Command injection prevention:** Session IDs are UUIDs, sanitize project paths
- **AppleScript sandboxing:** `osascript` runs in user context, no elevated privileges needed
- **No secrets in commands:** The `claude --resume` command doesn't contain API keys

### Frontend Architecture

**New files:**
- `frontend/src/components/sessions/HandoffButton.tsx` - Reusable handoff dropdown button
- `frontend/src/hooks/useHandoffTargets.ts` - Hook to fetch/cache available targets
- `frontend/src/lib/handoff.ts` - Handoff API client functions

**Modified files:**
- `frontend/src/components/sessions/SessionCard.tsx` - Add handoff button
- `frontend/src/components/zen/ZenSessionDetailPanel.tsx` - Add handoff button (pre-deprecation)
- `frontend/src/App.tsx` - Remove Zen Mode, add deprecation banner

---

## 5. UI Design

### HandoffButton Component

**Location:** Appears in:
1. **Session card** - Small icon button in the card's action area
2. **Session detail panel** - Prominent button in the header

**Design:**

```
┌─────────────────────────────────┐
│  Session: dev (opus)     [▶ ▾]  │  ← "Continue in..." dropdown
│  Model: claude-opus-4            │
│  Status: active                  │
│  ...                             │
└─────────────────────────────────┘

Dropdown menu:
┌──────────────────────────┐
│ ▶  Continue in iTerm2    │  ← Primary action
│ ▶  Continue in VS Code   │
│ ─────────────────────────│
│ 📋 Copy command          │  ← Always available
└──────────────────────────┘
```

**Button states:**
- **Default:** Play icon (▶) with small dropdown arrow
- **Loading:** Spinner while AppleScript executes (typically < 1 second)
- **Success:** Brief green checkmark + toast "Opened in iTerm2"
- **Error:** Red X + toast with error message and clipboard fallback

**Target not installed:**
- Targets auto-detected, unavailable ones hidden from dropdown
- If no terminal is detected, only "Copy command" is shown
- If handoff fails, auto-fallback to clipboard with toast explaining

**Keyboard shortcut:**
- `Ctrl+Enter` or `Cmd+Enter` on a selected session card triggers default (first available) handoff target

### Session Types and Handoff Availability

| Session Type | Key Pattern | Handoff Available | Command |
|---|---|---|---|
| Claude Code | `claude:<uuid>` | Yes | `claude --resume <uuid>` |
| CC Agent | `cc:<agent-id>` | Yes (resolves to Claude session) | `claude --resume <resolved-uuid>` |
| OpenClaw | `agent:*` | Limited | `claude` (new session in project dir) |

For OpenClaw sessions, the handoff button could say "Open Claude in project" instead of "Continue session."

---

## 6. Implementation Steps

### Phase 1: Backend Handoff Service (2-3 hours)

**Task 1.1: Create handoff service** (~1 hour)
- Create `backend/app/services/handoff.py`
- Implement `HandoffService` class with:
  - `detect_available_targets()` - Detect terminals, VS Code
  - `build_command()` - Construct resume commands
  - `execute_handoff()` - Run AppleScript for terminal handoff
  - `_handoff_clipboard()` - pbcopy fallback
- Unit tests for command building and target detection

**Task 1.2: Create handoff API routes** (~1 hour)
- Add endpoints to `backend/app/routes/sessions.py`:
  - `GET /api/handoff/targets` - Available targets
  - `POST /api/sessions/{session_key}/handoff` - Execute handoff
- Session ID resolution logic (claude:*, cc:*, agent:*)
- Input validation and error handling

**Task 1.3: Test handoff end-to-end** (~30 min)
- Manual test: call handoff API, verify terminal opens
- Test clipboard fallback
- Test with non-existent session (error handling)

### Phase 2: Frontend HandoffButton Component (2-3 hours)

**Task 2.1: Create handoff hooks and API client** (~30 min)
- `frontend/src/hooks/useHandoffTargets.ts` - Fetch and cache targets
- `frontend/src/lib/handoff.ts` - API client for handoff endpoints

**Task 2.2: Create HandoffButton component** (~1 hour)
- `frontend/src/components/sessions/HandoffButton.tsx`
- Dropdown with detected targets
- Loading/success/error states
- Toast notifications
- Clipboard fallback on error

**Task 2.3: Integrate HandoffButton into SessionCard** (~30 min)
- Add button to session card actions area
- Only show for sessions with valid handoff capability
- Keyboard shortcut (Cmd+Enter)

**Task 2.4: Integrate HandoffButton into session detail views** (~30 min)
- Add to `ZenSessionDetailPanel.tsx` (while Zen Mode still exists)
- Add to any other session detail view in the main dashboard

### Phase 3: Zen Mode Deprecation (1-2 hours)

**Task 3.1: Add deprecation banner to Zen Mode** (~30 min)
- Show banner when Zen Mode is activated
- "Zen Mode is deprecated in v0.20.0. Use 'Continue in...' to interact with agents in their native tools."
- Link to handoff button / docs

**Task 3.2: Remove auto-launch and keyboard shortcut** (~30 min)
- Remove `crewhub-zen-auto-launch` localStorage handling
- Remove Ctrl+Shift+Z toggle in App.tsx
- Keep Zen Mode accessible via `?mode=zen` URL for transition period

**Task 3.3: Update navigation** (~30 min)
- Remove Zen Mode entry from any navigation menus
- Update any references/links to Zen Mode

### Phase 4: Polish and Testing (1-2 hours)

**Task 4.1: End-to-end testing** (~1 hour)
- Test all handoff targets (iTerm2, Terminal.app, VS Code, clipboard)
- Test with different session types (claude:*, cc:*, agent:*)
- Test error scenarios (app not installed, session not found)
- Test on fresh CrewHub start (no cached targets)

**Task 4.2: Documentation** (~30 min)
- Update README with handoff feature
- Add to CHANGELOG under v0.20.0
- Update features matrix if it exists

---

## 7. v0.20.0 Scope

### In Scope (v0.20.0)

1. **Agent Handoff feature:**
   - Backend handoff service and API endpoints
   - HandoffButton component with dropdown
   - Terminal handoff (iTerm2, Terminal.app)
   - VS Code terminal handoff
   - Copy command to clipboard (fallback)
   - Auto-detection of available targets

2. **Zen Mode deprecation:**
   - Deprecation banner in Zen Mode
   - Remove auto-launch and keyboard shortcut
   - Remove from navigation

3. **Claude Code improvements:**
   - Better session ID resolution for handoff
   - Project path detection for working directory

### Deferred to v0.21.0

1. **Full Zen Mode removal:**
   - Delete all 35+ Zen Mode component files
   - Remove all Zen Mode tests
   - Clean up any remaining references
   - Remove `ZenModeProvider` from App.tsx

2. **Codex CLI support:**
   - Install detection for `@openai/codex`
   - Session resume command building
   - Only when Codex is installed and tested

3. **Advanced handoff features:**
   - Warp terminal support
   - Custom terminal command templates (user configurable)
   - Handoff history/audit log
   - "Open in..." from activity notifications

### Estimated Total Effort

| Phase | Hours |
|---|---|
| Phase 1: Backend | 2-3 |
| Phase 2: Frontend | 2-3 |
| Phase 3: Deprecation | 1-2 |
| Phase 4: Polish | 1-2 |
| **Total** | **6-10 hours** |

---

## Appendix A: Key File Locations

| What | Where |
|---|---|
| Backend routes | `backend/app/routes/sessions.py` |
| Backend services | `backend/app/services/` |
| Frontend session components | `frontend/src/components/sessions/` |
| Frontend Zen Mode (to deprecate) | `frontend/src/components/zen/` |
| Claude sessions | `~/.claude/projects/*/` |
| Session index | `~/.claude/projects/*/sessions-index.json` |
| CrewHub database | `~/.crewhub/crewhub.db` |
| CC chat service | `backend/app/services/cc_chat.py` |
| Claude Code connection | `backend/app/services/connections/claude_code.py` |
| Process manager | `backend/app/services/connections/claude_process_manager.py` |

## Appendix B: Claude CLI Session Resume Reference

```bash
# Resume specific session
claude --resume <session-uuid>

# Resume with interactive picker
claude --resume

# Continue most recent session in current directory
claude --continue
# or
claude -c

# Resume but create new session ID (preserve original)
claude --resume <session-uuid> --fork-session

# Resume with specific model
claude --resume <session-uuid> --model opus

# Resume with specific project directory
cd /path/to/project && claude --resume <session-uuid>
```

## Appendix C: Session Key Resolution

```
Session Key              → Claude Session ID    → Command
─────────────────────────────────────────────────────────────
claude:<uuid>            → <uuid>               → claude --resume <uuid>
cc:<agent-id>            → lookup in DB/memory   → claude --resume <resolved-uuid>
agent:main:main          → N/A (OpenClaw)        → claude (new session)
agent:dev:subagent:...   → N/A (OpenClaw)        → claude (new session)
```
