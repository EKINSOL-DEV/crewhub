# CrewHub Standalone Claude Code Integration — Independent Analysis

**Date:** 2026-02-28
**Author:** Opus (subagent analysis)
**Status:** Draft for review

---

## Executive Summary

CrewHub currently depends on OpenClaw as a gateway to monitor and interact with Claude Code agents. The goal is to make CrewHub work standalone — any developer installs it, runs `claude` CLI, and sees their agents in the 3D world.

**The good news:** This is a solved problem. Pixel Agents (a VS Code extension) already does this by watching Claude Code's JSONL transcript files. No gateway, no API, no modifications to Claude Code needed. CrewHub can use the exact same approach.

**The critical insight:** Claude Code already writes everything to disk. The "API" is the filesystem.

---

## 1. Prior Art: Pixel Agents (What's Already Solved)

[Pixel Agents](https://github.com/pablodelucca/pixel-agents) is a VS Code extension that does the 2D version of what CrewHub wants in 3D. Key findings from reading their source:

### Integration Mechanism

**JSONL file watching.** That's it. The entire integration is:

1. Claude Code writes session transcripts to `~/.claude/projects/{project-dir-slug}/{session-id}.jsonl`
2. Pixel Agents uses `fs.watch` + `fs.watchFile` + manual polling (triple fallback) to detect new lines
3. Each JSONL line is parsed for `type: "assistant"` (tool_use blocks), `type: "user"` (tool_result blocks), `type: "system"` (turn_duration), and `type: "progress"` (sub-agent updates)
4. Tool activity maps to character animations (writing → typing, reading → reading, bash → running commands)

### Session Discovery

- `~/.claude/projects/{slug}/sessions-index.json` lists all sessions with metadata (firstPrompt, summary, messageCount, timestamps, model, git branch)
- New JSONL files appearing in the project directory = new sessions
- They poll the directory periodically (`PROJECT_SCAN_INTERVAL_MS`)

### Sub-Agent Detection

- `Task` tool_use blocks spawn sub-agents
- `progress` records with `parentToolUseID` track sub-agent activity
- `tool_result` for a Task tool_use_id = sub-agent completed

### Known Limitations (Their Words)

- **Agent-terminal sync is fragile** — desyncs when terminals open/close rapidly
- **Heuristic-based status detection** — no clear signal for "waiting for input" vs "done"; uses idle timers
- **`turn_duration` system events** are the most reliable end-of-turn signal, but not emitted for text-only turns

### What CrewHub Can Copy Directly

| Pixel Agents Approach | CrewHub Equivalent |
|---|---|
| Watch `~/.claude/projects/*/` JSONL files | Same — Python `watchdog` library or `inotify` |
| Parse JSONL for tool_use/tool_result | Same parsing, different language |
| `sessions-index.json` for session metadata | Same file, same format |
| Triple fallback file watching (watch + watchFile + poll) | `watchdog` + poll fallback |
| Tool name → activity mapping | Tool name → 3D character animation |
| Sub-agent via Task tool tracking | Sub-agent as separate 3D character |

### What Must Be Different

| Pixel Agents | CrewHub |
|---|---|
| VS Code terminal API to spawn `claude` | Must spawn via `subprocess` / PTY |
| VS Code terminal API to send input | Must write to PTY stdin |
| Runs inside VS Code process | Standalone web server + browser |
| Single machine assumed | Could support remote agents |
| No persistent database | SQLite for rooms, agents, history |

**The fundamental difference:** Pixel Agents lives inside VS Code and piggybacks on its terminal management. CrewHub is a standalone web app and must handle process lifecycle itself.

---

## 2. User-Facing Requirements

### Persona: Solo Developer (MacBook)

- `pip install crewhub` or `docker compose up`
- Opens `localhost:8091` in browser
- Sees agents that are already running in terminals
- Can spawn new agents from the UI
- API key: uses their existing `~/.claude` config (Claude Code handles auth)

### Persona: Developer on Linux Server

- Same as above, but accessed via `server-ip:8091`
- May run headless (no browser on server itself)
- SSH tunnel or LAN access
- Multiple projects in different directories

### Persona: Team Setup

- Shared server running CrewHub
- Multiple developers' agents visible
- **Hard problem:** whose `~/.claude` directory? Multiple users?
- MVP: skip this. Single-user only.

### Minimum Requirements for MVP

1. **Passive monitoring** — detect running Claude Code sessions by watching JSONL files
2. **Activity tracking** — show what each agent is doing (reading, writing, running commands, idle, waiting)
3. **Sub-agent visualization** — Task tool spawns visible sub-agent characters
4. **Session history** — read JSONL transcript for chat history
5. **Spawn agent** — start new `claude` process from UI
6. **Send message** — pipe text to running `claude` process stdin

---

## 3. Simplest Possible Architecture (MVP)

### What to Build

```
┌─────────────────────────────────────────────┐
│                  Browser                     │
│          React + Three.js (existing)         │
└──────────────────┬──────────────────────────┘
                   │ HTTP + SSE
┌──────────────────┴──────────────────────────┐
│           CrewHub Backend (FastAPI)           │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │  ClaudeCodeConnection (NEW)             │ │
│  │                                         │ │
│  │  • SessionScanner                       │ │
│  │    - watches ~/.claude/projects/*/      │ │
│  │    - reads sessions-index.json          │ │
│  │    - file watcher on *.jsonl            │ │
│  │                                         │ │
│  │  • TranscriptParser                     │ │
│  │    - parse JSONL lines                  │ │
│  │    - extract tool_use / tool_result     │ │
│  │    - detect turn boundaries             │ │
│  │    - track sub-agents (Task tool)       │ │
│  │                                         │ │
│  │  • ProcessManager (for spawned agents)  │ │
│  │    - subprocess with PTY               │ │
│  │    - stdin/stdout piping                │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  SQLite (existing)                           │
└──────────────────────────────────────────────┘
         │
    watches filesystem
         │
  ~/.claude/projects/{slug}/*.jsonl
```

### What NOT to Build (Over-Engineering Traps)

| Temptation | Why It's Over-Engineering |
|---|---|
| Custom WebSocket protocol between backend and agents | The filesystem IS the protocol. Claude Code already writes JSONL. |
| Agent orchestration layer (heartbeats, cron, routing) | That's OpenClaw. CrewHub is a dashboard, not an orchestrator. |
| Custom session storage format | Just read Claude Code's native JSONL + sessions-index.json |
| Multi-user auth system | MVP is single user. Add auth later if needed. |
| Remote agent support via SSH/tunnel | Way too complex for MVP. Local only. |
| Real-time WebSocket from backend to JSONL files | SSE + polling is simpler and sufficient. File changes are already seconds-granularity. |
| Custom process supervisor (restart policies, health checks) | `claude` CLI is the user's responsibility. CrewHub just watches. |

### The Three Components

#### A. SessionScanner (read-only, ~200 lines)

```python
class SessionScanner:
    """Watch ~/.claude/projects/ for sessions."""

    def __init__(self, claude_dir="~/.claude"):
        self.claude_dir = Path(claude_dir).expanduser()
        self.watchers = {}  # session_id -> file offset

    def scan_projects(self) -> list[SessionInfo]:
        """Read sessions-index.json from all project dirs."""
        # For each ~/.claude/projects/*/sessions-index.json
        # Parse and return SessionInfo list

    def watch_session(self, jsonl_path: Path, callback):
        """Tail a JSONL file, call callback on new lines."""
        # Use watchdog or poll-based approach
```

#### B. TranscriptParser (stateless, ~150 lines)

Port of Pixel Agents' `transcriptParser.ts` to Python:

```python
class TranscriptParser:
    """Parse Claude Code JSONL transcript lines."""

    def parse_line(self, line: str) -> AgentEvent:
        record = json.loads(line)
        if record["type"] == "assistant":
            return self._parse_assistant(record)
        elif record["type"] == "user":
            return self._parse_user(record)
        elif record["type"] == "system" and record.get("subtype") == "turn_duration":
            return TurnComplete()
        elif record["type"] == "progress":
            return self._parse_progress(record)

    def _parse_assistant(self, record) -> AgentEvent:
        # Extract tool_use blocks → ToolStarted events
        # Extract text blocks → TextOutput events

    def _parse_user(self, record) -> AgentEvent:
        # Extract tool_result blocks → ToolCompleted events
        # Plain text → UserMessage events
```

#### C. ProcessManager (for spawning only, ~100 lines)

```python
class ProcessManager:
    """Spawn and manage Claude Code CLI processes."""

    async def spawn(self, project_dir: str, session_id: str = None) -> ManagedProcess:
        """Start a new claude process with PTY."""
        # asyncio.create_subprocess_exec with PTY
        # Or use pty.openpty() for stdin/stdout

    async def send_input(self, process_id: str, text: str):
        """Write to a managed process's stdin."""

    async def kill(self, process_id: str):
        """Kill a managed process."""
```

### Total New Code Estimate

| Component | Lines | Complexity |
|---|---|---|
| SessionScanner | ~200 | Low — file I/O, JSON parsing |
| TranscriptParser | ~150 | Low — direct port from Pixel Agents |
| ProcessManager | ~100 | Medium — PTY handling |
| Wire into existing ConnectionManager | ~50 | Low — follows existing pattern |
| **Total** | **~500** | |

The existing `ClaudeCodeConnection` stub already has the right interface. Fill in the methods.

---

## 4. Risks and Hard Problems

### 4.1 PTY Handling (Medium Risk)

**Problem:** Spawning `claude` and interacting with its stdin/stdout requires a PTY (pseudo-terminal). Claude Code uses interactive terminal features (colors, cursor control, permission prompts).

**Mitigation:**
- For **monitoring only** (MVP): No PTY needed. Just read JSONL files.
- For **spawning agents**: Use `claude --print` mode for non-interactive sessions. This outputs to stdout and exits. No PTY needed.
- For **interactive chat**: Use `claude --print --output-format stream-json` which gives structured streaming output. Still no PTY.
- **The PTY is only needed if you want to replicate the full terminal experience.** You probably don't. The JSONL files capture everything.

**Recommendation:** Don't do PTY. Use `claude --print` for spawned sessions. Read JSONL for monitoring.

### 4.2 Session-to-Activity Mapping (Medium Risk)

**Problem:** Pixel Agents admits this is fragile. Detecting "agent is waiting for input" vs "agent is done" vs "agent is thinking" is heuristic-based.

**Signals available:**
- `turn_duration` system event = definitive turn end (but not for text-only turns)
- No new JSONL data for N seconds = probably idle
- `tool_use` block without matching `tool_result` = tool in progress
- `AskUserQuestion` tool = waiting for user

**Mitigation:** Copy Pixel Agents' heuristics. They work well enough. Accept some status flicker. This is cosmetic, not functional.

### 4.3 Multi-Project Discovery (Low Risk)

**Problem:** A user may have Claude Code sessions in many project directories. Which ones does CrewHub show?

**Solution:**
- Default: show sessions from all `~/.claude/projects/*/`
- Allow filtering by project directory in the UI
- `sessions-index.json` has `projectPath` field — use it

### 4.4 Existing Sessions vs. Spawned Sessions (Low Risk)

**Problem:** Sessions started outside CrewHub (in terminals, VS Code, etc.) should still be visible.

**Solution:** This is the default behavior. JSONL watching is passive — it sees everything regardless of how the session was started.

### 4.5 Claude Code Updates Breaking JSONL Format (Low Risk, High Impact)

**Problem:** Claude Code's JSONL format is undocumented and could change.

**Mitigation:**
- Pixel Agents already depends on this format. If it breaks, they break too. Community pressure keeps it stable.
- Pin to known Claude Code versions in docs
- Parser should be defensive (ignore unknown record types)

### 4.6 Security / API Key Management (Non-Issue for MVP)

CrewHub doesn't need API keys. Claude Code manages its own authentication via `~/.claude`. CrewHub just reads the output files. The only security concern is filesystem permissions on `~/.claude/`, which are user-owned by default.

### 4.7 Concurrent File Access (Low Risk)

**Problem:** Claude Code writes JSONL, CrewHub reads it simultaneously.

**Non-problem:** JSONL is append-only. Reading from a known offset while another process appends is safe on all major filesystems. Pixel Agents does this successfully.

---

## 5. Migration Path: OpenClaw → Standalone

### Phase 1: Passive Monitoring (No OpenClaw Needed)

**What:** Fill in the `ClaudeCodeConnection` stub to watch JSONL files.

- Implement `get_sessions()` → read `sessions-index.json`
- Implement `get_session_history()` → read JSONL file
- Implement real-time updates → file watcher + SSE broadcast
- Activity status → TranscriptParser

**Result:** CrewHub shows existing Claude Code sessions without OpenClaw. Read-only. This is the MVP.

**OpenClaw status:** Still works if configured. Both connections can coexist (ConnectionManager already supports multiple).

### Phase 2: Agent Spawning

**What:** Implement `spawn_session()` using `claude --print` mode.

```bash
claude --print \
  --output-format stream-json \
  --session-id <uuid> \
  --model sonnet \
  "your prompt here"
```

This creates a JSONL file that Phase 1 already watches. The response streams back via stdout.

**Result:** CrewHub can both monitor AND create agents.

### Phase 3: Interactive Chat

**What:** Implement `send_message()` using `claude --print` with `--input-format stream-json`.

Or simpler: each "message" spawns a new `claude --print --continue` call that continues the session.

```bash
echo "your message" | claude --print --continue --session-id <uuid>
```

**Result:** Full chat capability without PTY.

### Phase 4: Remove OpenClaw Dependency (Optional)

**What:** Make OpenClaw connection type optional. Default to Claude Code direct.

- Onboarding flow: "Do you have OpenClaw? [Yes → configure WS URL] [No → use Claude Code directly]"
- Or: auto-detect. If `~/.claude` exists, use it. If OpenClaw WS is reachable, use that too.

### Backward Compatibility

The `ConnectionManager` already supports multiple connection types. Both can coexist:

```python
# User with OpenClaw gets both:
manager.add_connection("openclaw-main", "openclaw", {"url": "ws://..."})
manager.add_connection("local-claude", "claude_code", {"data_dir": "~/.claude"})

# User without OpenClaw gets just:
manager.add_connection("local-claude", "claude_code", {"data_dir": "~/.claude"})
```

Sessions from both sources appear in the same UI. No migration needed.

---

## 6. Open-Source Components to Leverage

| Need | Component | Why |
|---|---|---|
| File watching | `watchdog` (Python) | Cross-platform fs events, mature, well-tested |
| JSONL parsing | stdlib `json` | One line at a time, trivial |
| Process spawning | `asyncio.create_subprocess_exec` | Built into Python, async-native |
| PTY (if ever needed) | `pexpect` or `pty` module | Only if interactive mode is needed (probably not) |
| Session discovery | Direct filesystem reads | `sessions-index.json` is the API |

**NOT needed:**
- supervisord — overkill, CrewHub isn't a process supervisor
- tmux — no terminal multiplexing needed if using `--print` mode
- MCP servers — interesting but orthogonal to monitoring

---

## 7. Where Would Opus Over-Engineer This?

Real talk:

1. **Building a WebSocket relay** between CrewHub and Claude Code. Not needed. The filesystem is the relay.

2. **Designing a plugin architecture** for different agent backends. The `ConnectionManager` already does this. Don't abstract further.

3. **Adding process health monitoring with restart policies.** CrewHub is a dashboard. If an agent dies, show it as dead. Don't auto-restart.

4. **Creating a custom IPC protocol** (Unix sockets, gRPC, etc.). Claude Code doesn't speak any of these. JSONL files are the interface.

5. **Building a "session router"** that decides which connection handles a request. The existing `ConnectionManager.send_message()` already iterates connections. Keep it simple.

6. **Multi-machine agent support.** The moment you add SSH tunnels, remote file watching, or distributed state, complexity explodes 10x. Don't.

---

## 8. Recommended MVP Scope

### Do First (1-2 days of work)

1. **SessionScanner**: Watch `~/.claude/projects/*/sessions-index.json` for session discovery
2. **TranscriptParser**: Port Pixel Agents' JSONL parsing to Python
3. **Wire into ClaudeCodeConnection**: Fill `get_sessions()` and `get_session_history()`
4. **Real-time SSE**: File watcher triggers SSE events to frontend for live activity

### Do Second (1 day)

5. **Activity status mapping**: Tool names → character states (existing frontend probably handles this)
6. **Sub-agent tracking**: Task tool → spawn sub-agent character in 3D world

### Do Third (1 day)

7. **Spawn agent**: `claude --print --session-id <uuid>` from the UI
8. **Send message**: `claude --print --continue` for chat

### Don't Do (Yet)

- PTY management
- Multi-user support
- Remote agents
- Process supervision
- Custom orchestration (that's OpenClaw's job)

### Total Estimated Effort

**3-4 days** for a working standalone mode. The architecture is already there (ConnectionManager, ClaudeCodeConnection stub, frontend). It's filling in ~500 lines of Python and validating the JSONL parsing works.

---

## 9. Key Takeaway

The entire integration boils down to one insight:

> **Claude Code's JSONL transcript files ARE the API.**

Pixel Agents proved this works. CrewHub just needs to do the same thing — read files, parse JSON, update the UI. The fancy 3D visualization is already built. The backend abstraction layer (ConnectionManager) is already built. The missing piece is literally a file watcher and a JSON parser.

Don't overcomplicate it.
