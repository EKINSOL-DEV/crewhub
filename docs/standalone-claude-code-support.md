# Standalone Claude Code Support for CrewHub

**Design Document — February 2026**
**Status:** Proposal

---

## Executive Summary

CrewHub currently depends on OpenClaw Gateway for all agent interaction — spawning sessions, reading history, sending messages, managing cron jobs. This document analyzes what's needed to make CrewHub a standalone application that runs Claude Code (`claude` CLI) directly, with no OpenClaw dependency.

The key insight from analyzing the [Pixel Agents](https://github.com/pablodelucca/pixel-agents) VS Code extension is that **Claude Code's JSONL session files are the primary integration point**. No API, no socket, no gateway needed — just file watching. CrewHub can do the same, and go much further.

---

## Round 1 — Gap Analysis: What OpenClaw Provides

### What CrewHub Currently Gets From OpenClaw

| Capability | OpenClaw Method | Used By |
|---|---|---|
| **Session listing** | `sessions.list` via WS | `OpenClawConnection.get_sessions()` → ConnectionManager → SSE to frontend |
| **Session history** | JSONL file reading | `_session_io.py` reads `~/.openclaw/sessions/` JSONL files |
| **Send message to agent** | `agent` via WS (req/res) | `send_chat()`, `send_chat_streaming()` in `_extended_api.py` |
| **Kill session** | `session.kill` via WS | `kill_session()` in `_session_io.py` |
| **Real-time events** | WS event subscription | `session.*` events, `chat` events for streaming |
| **Cron jobs** | `cron.*` via WS | `list_cron_jobs()`, `create_cron_job()`, etc. |
| **Agent spawning** | Implicit (OpenClaw manages agent lifecycle) | Not directly called, but OpenClaw starts/restarts agents |
| **Model switching** | `session.status` via WS | `patch_session()` |
| **Node management** | `nodes-status` via WS | `list_nodes()` |
| **System presence** | `system-presence` via WS | `get_presence()` |
| **Heartbeats** | OpenClaw internal scheduler | Periodic agent wake-ups |

### What CrewHub Must Replace

**Critical (MVP):**
1. Session discovery and listing
2. Session history reading
3. Sending messages to agents (interactive chat)
4. Agent spawning (starting new `claude` processes)
5. Real-time activity tracking (what is the agent doing right now?)
6. Session kill/stop

**Important (Phase 2):**
7. Cron/scheduled tasks
8. Model switching mid-session
9. Heartbeat/keep-alive system
10. Sub-agent visualization

**Nice-to-have (Phase 3):**
11. Multi-node support
12. System prompt injection (context envelopes)
13. MCP server configuration per agent

---

## Round 2 — Architecture: Standalone Agent Runner

### Claude Code Data Model

Claude Code stores all session data in `~/.claude/`:

```
~/.claude/
├── projects/
│   └── -Users-ekinbot-clawd/          # One dir per workspace (path with - replacing /)
│       ├── sessions-index.json         # Session index with metadata
│       ├── {uuid}.jsonl                # Per-session transcript (append-only)
│       └── ...
├── history.jsonl                       # Global input history
├── statsig/                            # Analytics
└── settings.json                       # User settings
```

**sessions-index.json** contains:
```json
{
  "version": 1,
  "entries": [{
    "sessionId": "uuid",
    "fullPath": "/path/to/{uuid}.jsonl",
    "fileMtime": 1769359185786,
    "firstPrompt": "...",
    "summary": "...",
    "messageCount": 4,
    "created": "2026-01-25T16:29:15.183Z",
    "modified": "2026-01-25T16:29:55.779Z",
    "gitBranch": "main",
    "projectPath": "/Users/ekinbot/clawd",
    "isSidechain": false
  }]
}
```

**JSONL transcript lines** have these types:
- `type: "user"` — user messages (content is string or array of blocks)
- `type: "assistant"` — assistant responses (content array with text/tool_use/thinking blocks)
- `type: "system"` — system events (subtype: `turn_duration`, etc.)
- `type: "progress"` — sub-agent progress (nested tool activity from Task tool)
- `type: "queue-operation"` — internal scheduling

### Proposed Architecture

```
┌─────────────────────────────────────────────────┐
│                  CrewHub Backend                  │
│                  (FastAPI + SQLite)               │
│                                                   │
│  ┌───────────────┐  ┌──────────────────────────┐ │
│  │ Connection     │  │ ClaudeCodeConnection     │ │
│  │ Manager        │──│ (REPLACES OpenClaw)      │ │
│  │ (existing)     │  │                          │ │
│  └───────────────┘  │ ┌──────────────────────┐ │ │
│                      │ │ SessionFileWatcher   │ │ │
│                      │ │ - watches ~/.claude  │ │ │
│                      │ │ - parses JSONL       │ │ │
│                      │ │ - emits events       │ │ │
│                      │ └──────────────────────┘ │ │
│                      │ ┌──────────────────────┐ │ │
│                      │ │ ProcessManager       │ │ │
│                      │ │ - spawns `claude`    │ │ │
│                      │ │ - PTY management     │ │ │
│                      │ │ - stdin/stdout pipe  │ │ │
│                      │ └──────────────────────┘ │ │
│                      │ ┌──────────────────────┐ │ │
│                      │ │ CronScheduler        │ │ │
│                      │ │ - APScheduler        │ │ │
│                      │ │ - triggers agents    │ │ │
│                      │ └──────────────────────┘ │ │
│                      └──────────────────────────┘ │
│                                                   │
│  ┌───────────────────────────────────────────┐   │
│  │ SSE Broadcast (existing)                   │   │
│  │ - session-updated, activity, tool events   │   │
│  └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
         │ SSE                          │ HTTP/REST
         ▼                              ▼
┌─────────────────────────────────────────────────┐
│               CrewHub Frontend                    │
│          (React + Three.js — unchanged)           │
└─────────────────────────────────────────────────┘
```

### Key Components

#### 1. SessionFileWatcher

The core of standalone mode. Inspired by Pixel Agents' `fileWatcher.ts` + `transcriptParser.ts`.

**Responsibilities:**
- Watch `~/.claude/projects/*/sessions-index.json` for session discovery
- Watch active `{uuid}.jsonl` files for real-time transcript changes
- Parse JSONL lines into structured events
- Emit activity states: `idle`, `thinking`, `tool_use`, `waiting_input`, `waiting_permission`

**Implementation approach (from Pixel Agents):**
```python
# Triple-layered file watching (Pixel Agents learned this the hard way on macOS):
# 1. asyncio file watcher (inotify on Linux, kqueue on macOS)
# 2. watchdog library as secondary
# 3. Stat-based polling as fallback (every 500ms)
```

**Activity detection from JSONL (derived from Pixel Agents' transcriptParser.ts):**

| JSONL Record | Detected Activity |
|---|---|
| `type: "assistant"` with `tool_use` blocks | Agent is executing tools (active) |
| `type: "assistant"` with only `text` blocks | Agent is responding (typing) |
| `type: "user"` with `tool_result` blocks | Tool completed, agent processing |
| `type: "system", subtype: "turn_duration"` | Turn ended → agent waiting for input |
| `type: "progress"` with `parentToolUseID` | Sub-agent activity |
| No new data for >5s after tool_use | Likely waiting for permission |

**Permission detection** (Pixel Agents' key insight): If a tool_use block appears but no tool_result follows within ~8 seconds, and no `bash_progress`/`mcp_progress` events arrive, the agent is probably waiting for user permission approval. This is critical for the speech bubble / attention indicator feature.

#### 2. ProcessManager

Manages `claude` CLI processes.

**Two modes of interaction with Claude Code:**

**Mode A: `--print` mode (non-interactive, for tasks/cron)**
```bash
claude --print \
  --model sonnet \
  --output-format stream-json \
  --dangerously-skip-permissions \
  --session-id <uuid> \
  --system-prompt "..." \
  "Your task message here"
```
- Best for: fire-and-forget tasks, cron jobs, automated workflows
- Output is structured JSON, easy to parse
- No PTY needed
- `--output-format stream-json` gives real-time streaming chunks

**Mode B: `--input-format stream-json` (bidirectional streaming)**
```bash
claude --print \
  --input-format stream-json \
  --output-format stream-json \
  --session-id <uuid>
```
- Best for: interactive chat sessions from CrewHub UI
- Can send multiple messages on stdin as JSON
- Gets structured streaming output
- Supports `--resume` to continue existing sessions

**Mode C: PTY-based interactive (full terminal)**
```python
import asyncio
import pty, os

master_fd, slave_fd = pty.openpty()
proc = await asyncio.create_subprocess_exec(
    "claude", "--session-id", session_id,
    stdin=slave_fd, stdout=slave_fd, stderr=slave_fd,
)
# Read/write via master_fd
```
- Best for: full terminal experience, permission prompts
- Most complex but most capable
- CrewHub could embed a terminal view (xterm.js) for this

**Recommended approach:** Use Mode A/B for programmatic interaction (chat API, cron), and let the JSONL file watcher handle activity tracking regardless of mode. This decouples monitoring from interaction.

#### 3. CronScheduler

Replace OpenClaw's cron system with a local scheduler.

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

class CronScheduler:
    def __init__(self, process_manager: ProcessManager):
        self.scheduler = AsyncIOScheduler()
        self.process_manager = process_manager

    async def add_job(self, schedule: dict, message: str, agent_config: dict):
        """Schedule a recurring claude invocation."""
        self.scheduler.add_job(
            self._run_agent_task,
            CronTrigger(**schedule),
            args=[message, agent_config],
        )

    async def _run_agent_task(self, message: str, config: dict):
        """Spawn a claude --print process for the scheduled task."""
        await self.process_manager.run_task(message, **config)
```

Store cron jobs in SQLite (new `cron_jobs` table) instead of relying on OpenClaw.

---

## Round 3 — Claude Code CLI Integration Details

### stream-json Output Format

When using `--output-format stream-json`, Claude Code emits newline-delimited JSON:

```json
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Let me"}]},"session_id":"..."}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Let me check"}]},"session_id":"..."}
{"type":"tool_use","tool":{"name":"Read","input":{"file_path":"..."}}}
{"type":"tool_result","tool_use_id":"...","content":"..."}
{"type":"result","message":{"role":"assistant","content":[...]},"session_id":"...","cost_usd":0.05}
```

This is directly parseable — no WebSocket gateway needed.

### stream-json Input Format

With `--input-format stream-json`, you send messages as:

```json
{"type":"user","message":"Hello, do this task"}
```

This enables multi-turn conversation over a single process.

### Key CLI Flags for CrewHub Integration

| Flag | Purpose |
|---|---|
| `--print` | Non-interactive mode (exit after response) |
| `--session-id <uuid>` | Use specific session ID (CrewHub controls session identity) |
| `--resume <uuid>` | Resume an existing session |
| `--model <model>` | Set model (sonnet, opus, etc.) |
| `--system-prompt <prompt>` | Override system prompt |
| `--append-system-prompt <prompt>` | Add to default system prompt (better for context injection) |
| `--output-format stream-json` | Structured streaming output |
| `--input-format stream-json` | Structured streaming input |
| `--permission-mode bypassPermissions` | Skip permission prompts (for automated tasks) |
| `--dangerously-skip-permissions` | Full permission bypass (sandboxed environments) |
| `--allowedTools "Bash Edit Read Write"` | Restrict available tools |
| `--mcp-config <file>` | Add MCP servers |
| `--max-budget-usd <amount>` | Cost cap per invocation |
| `--add-dir <dirs>` | Grant access to additional directories |
| `--no-session-persistence` | Don't save session to disk (ephemeral tasks) |

### JSONL Session File Format (Deep Dive)

Each line is a JSON object. Key record types:

**User message:**
```json
{
  "type": "user",
  "message": {"role": "user", "content": "..."},
  "parentUuid": null,
  "sessionId": "uuid",
  "cwd": "/path/to/project",
  "version": "2.1.19"
}
```

**Assistant message (with tool calls):**
```json
{
  "type": "assistant",
  "message": {
    "role": "assistant",
    "model": "claude-sonnet-4-20250514",
    "content": [
      {"type": "thinking", "thinking": "..."},
      {"type": "text", "text": "I'll read the file..."},
      {"type": "tool_use", "id": "toolu_xxx", "name": "Read", "input": {"file_path": "foo.py"}}
    ]
  },
  "parentUuid": "prev-uuid"
}
```

**Tool result (in next user message):**
```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {"type": "tool_result", "tool_use_id": "toolu_xxx", "content": "file contents..."}
    ]
  }
}
```

**System events:**
```json
{"type": "system", "subtype": "turn_duration", "durationMs": 12345}
```

**Sub-agent progress (Task tool):**
```json
{
  "type": "progress",
  "parentToolUseID": "toolu_task_xxx",
  "data": {
    "type": "agent_progress",
    "message": {
      "type": "assistant",
      "message": {"role": "assistant", "content": [...]}
    }
  }
}
```

---

## Round 4 — Implementation Roadmap

### Phase 1: Read-Only Monitoring (MVP — ~2-3 weeks)

**Goal:** CrewHub can discover and monitor Claude Code sessions without OpenClaw.

**New/modified files:**

| File | Action |
|---|---|
| `backend/app/services/connections/claude_code.py` | **Rewrite** — implement full `AgentConnection` interface |
| `backend/app/services/connections/file_watcher.py` | **New** — JSONL file watcher with triple-layer reliability |
| `backend/app/services/connections/transcript_parser.py` | **New** — Parse JSONL records into activity events |

**Implementation:**

```python
# claude_code.py — core changes

class ClaudeCodeConnection(AgentConnection):
    def __init__(self, connection_id, name, config):
        super().__init__(...)
        self.claude_dir = Path(config.get("data_dir", "~/.claude")).expanduser()
        self.project_dirs = config.get("project_dirs", [])  # auto-discover if empty
        self._file_watcher = SessionFileWatcher(self.claude_dir)
        self._file_watcher.on_activity(self._handle_activity)

    async def connect(self) -> bool:
        # 1. Verify claude CLI exists
        # 2. Scan ~/.claude/projects/ for project dirs
        # 3. Start file watchers on sessions-index.json files
        # 4. Start watching active JSONL files
        await self._file_watcher.start()
        self.status = ConnectionStatus.CONNECTED
        return True

    async def get_sessions(self) -> list[SessionInfo]:
        sessions = []
        for project_dir in self._discover_project_dirs():
            index = project_dir / "sessions-index.json"
            if index.exists():
                data = json.loads(index.read_text())
                for entry in data.get("entries", []):
                    sessions.append(SessionInfo(
                        key=f"claude:{entry['sessionId']}",
                        session_id=entry["sessionId"],
                        source="claude_code",
                        connection_id=self.connection_id,
                        label=entry.get("summary", entry.get("firstPrompt", "")[:50]),
                        status=self._infer_status(entry),
                        created_at=self._parse_ts(entry.get("created")),
                        last_activity=entry.get("fileMtime"),
                        metadata={
                            "projectPath": entry.get("projectPath"),
                            "gitBranch": entry.get("gitBranch"),
                            "messageCount": entry.get("messageCount"),
                        },
                    ))
        return sessions

    async def get_session_history(self, session_key, limit=50) -> list[HistoryMessage]:
        session_id = session_key.split(":")[-1]
        jsonl_path = self._find_jsonl(session_id)
        if not jsonl_path:
            return []
        return parse_jsonl_history(jsonl_path, limit)
```

**What this enables in the frontend:**
- Session list populates from local Claude Code sessions
- Session cards show activity status (idle/active/waiting)
- Chat history loads from JSONL files
- 3D bots animate based on real-time activity

### Phase 2: Interactive Chat (~2 weeks)

**Goal:** Send messages to Claude Code agents from CrewHub UI.

**New files:**

| File | Action |
|---|---|
| `backend/app/services/connections/process_manager.py` | **New** — spawn and manage `claude` processes |

**Two strategies for sending messages:**

**Strategy A: New process per message (simpler, recommended for start)**
```python
async def send_message(self, session_key, message, timeout=120):
    session_id = session_key.split(":")[-1]
    proc = await asyncio.create_subprocess_exec(
        self.cli_path,
        "--print",
        "--resume", session_id,
        "--output-format", "stream-json",
        "--permission-mode", "bypassPermissions",
        "-p", message,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    # Read stream-json output, yield chunks, collect final response
    result_text = ""
    async for line in proc.stdout:
        record = json.loads(line)
        if record.get("type") == "result":
            # Extract final text
            content = record["message"]["content"]
            result_text = "".join(
                b["text"] for b in content if b.get("type") == "text"
            )
    return result_text
```

**Strategy B: Long-lived process with stream-json I/O (for persistent sessions)**
```python
async def start_interactive_session(self, session_id, system_prompt=None):
    args = [
        self.cli_path, "--print",
        "--input-format", "stream-json",
        "--output-format", "stream-json",
        "--session-id", session_id,
    ]
    if system_prompt:
        args.extend(["--append-system-prompt", system_prompt])

    self._proc = await asyncio.create_subprocess_exec(
        *args,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
    )
    # Background reader task for stdout
    asyncio.create_task(self._read_output_loop())

async def send(self, message: str):
    payload = json.dumps({"type": "user", "message": message}) + "\n"
    self._proc.stdin.write(payload.encode())
    await self._proc.stdin.drain()
```

**Modified files:**
- `backend/app/routes/chat.py` — route to ClaudeCodeConnection instead of OpenClaw
- `backend/app/services/context_envelope.py` — works via `--append-system-prompt` instead of inline

### Phase 3: Agent Spawning & Lifecycle (~1-2 weeks)

**Goal:** CrewHub can create new agents, not just monitor existing ones.

```python
class ProcessManager:
    async def spawn_agent(self, config: AgentConfig) -> str:
        """Spawn a new claude process and return its session_id."""
        session_id = str(uuid.uuid4())
        args = [
            self.cli_path, "--print",
            "--session-id", session_id,
            "--output-format", "stream-json",
            "--model", config.model or "sonnet",
        ]
        if config.system_prompt:
            args.extend(["--system-prompt", config.system_prompt])
        if config.allowed_tools:
            args.extend(["--allowedTools", *config.allowed_tools])
        if config.permission_mode:
            args.extend(["--permission-mode", config.permission_mode])
        if config.working_dir:
            args.extend(["--add-dir", config.working_dir])
        if config.mcp_config:
            args.extend(["--mcp-config", config.mcp_config])
        if config.max_budget:
            args.extend(["--max-budget-usd", str(config.max_budget)])

        proc = await asyncio.create_subprocess_exec(
            *args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=config.working_dir,
        )
        self._processes[session_id] = proc
        return session_id

    async def kill_agent(self, session_id: str) -> bool:
        proc = self._processes.get(session_id)
        if proc and proc.returncode is None:
            proc.terminate()
            await asyncio.wait_for(proc.wait(), timeout=5.0)
            return True
        return False
```

### Phase 4: Cron & Heartbeats (~1 week)

**New file:** `backend/app/services/cron_scheduler.py`

```python
# Store in SQLite
class CronJob(BaseModel):
    id: str
    name: str
    schedule: str  # cron expression
    message: str
    agent_config: dict  # model, system_prompt, working_dir, etc.
    enabled: bool = True
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
```

**New DB table:**
```sql
CREATE TABLE cron_jobs (
    id TEXT PRIMARY KEY,
    name TEXT,
    schedule TEXT NOT NULL,
    message TEXT NOT NULL,
    agent_config TEXT,  -- JSON
    enabled INTEGER DEFAULT 1,
    last_run INTEGER,
    next_run INTEGER,
    created_at INTEGER DEFAULT (unixepoch() * 1000)
);
```

### Phase 5: Sub-agent Visualization (~1 week)

Pixel Agents solved this elegantly. When Claude Code uses the `Task` tool, it spawns a sub-agent. The JSONL file contains `progress` records with `parentToolUseID`. CrewHub already has the 3D world with multiple bot characters — this maps naturally:

- Parent agent's Task tool_use → spawn a "minion" bot in the 3D world
- Progress records → update minion activity state
- Task tool_result → minion completes and despawns

**Event flow:**
```
JSONL: assistant message with tool_use name="Task" id="toolu_123"
  → SSE: { event: "subagent-spawned", parentId: "agent-1", taskId: "toolu_123", description: "..." }
  → Frontend: spawn new bot character linked to parent

JSONL: progress record with parentToolUseID="toolu_123"
  → SSE: { event: "subagent-activity", taskId: "toolu_123", tool: "Read", file: "main.py" }
  → Frontend: animate minion bot

JSONL: user message with tool_result for tool_use_id="toolu_123"
  → SSE: { event: "subagent-completed", taskId: "toolu_123" }
  → Frontend: minion walks away / despawns
```

---

## Hardest Parts (Risk Assessment)

### 1. Permission Handling (Hard)
Claude Code in default mode asks for permission before executing tools. In `--print` mode with `--permission-mode bypassPermissions`, this is skipped. But for interactive sessions where users want control, CrewHub would need to:
- Detect permission prompts (via JSONL watching + timeout heuristic, like Pixel Agents)
- Surface them in the UI (speech bubbles, notifications)
- Relay user approval back to the CLI process (only possible in PTY/interactive mode)

**Mitigation:** For Phase 1-2, use `--permission-mode bypassPermissions` for CrewHub-spawned agents. Add interactive permission handling in a later phase via PTY + xterm.js embedded terminal.

### 2. Session Continuity (Medium)
`claude --resume <sessionId>` resumes a session but spawns a new process. The JSONL file continues appending to the same file. This means:
- CrewHub can resume any session from history ✓
- But each "send message" might spawn a new process
- Need to manage process lifecycle carefully (don't leak processes)

### 3. Real-time Streaming (Medium)
The current frontend (`useStreamingChat.ts`) expects SSE chunks from the backend. With Claude Code:
- `--output-format stream-json` gives us streaming chunks
- Backend reads stdout line by line, re-emits as SSE
- Need to handle process crashes, timeouts, buffering

### 4. Multi-project Discovery (Easy)
Claude Code organizes sessions by project directory. CrewHub should:
- Scan all `~/.claude/projects/*/sessions-index.json`
- Map project paths to CrewHub rooms (already have room concept)
- Auto-discover new projects when Claude Code is used in new directories

---

## What Can Be Reused

| Existing Component | Reuse Strategy |
|---|---|
| `ConnectionManager` | 100% reused — just register ClaudeCodeConnection instead of OpenClawConnection |
| `AgentConnection` base class | 100% reused — ClaudeCodeConnection already extends it |
| SSE broadcast system | 100% reused — just emit events from file watcher |
| `chat.py` routes | ~80% reused — swap OpenClaw calls for ClaudeCode calls |
| Frontend session components | ~95% reused — SessionInfo format is connection-agnostic |
| 3D world / bot animations | 100% reused — just needs activity state from new source |
| `context_envelope.py` | Adapt — inject via `--append-system-prompt` flag |
| `history.py` / session history | Rewrite — read JSONL directly instead of via WS |
| Cron routes (`cron.py`) | Adapt — point to local CronScheduler |

---

## Comparison with Pixel Agents

| Aspect | Pixel Agents | CrewHub Standalone |
|---|---|---|
| **Platform** | VS Code extension | Standalone web app (any computer) |
| **Session discovery** | Watches project dir for new JSONL files | Same + reads sessions-index.json |
| **Activity tracking** | JSONL file watching + transcript parsing | Same approach, ported to Python/asyncio |
| **Agent spawning** | Creates VS Code terminal, sends `claude --session-id` | Subprocess with `--print --output-format stream-json` |
| **Chat interaction** | Via VS Code terminal (user types directly) | Via HTTP API → stdin pipe to claude process |
| **Sub-agents** | Parses `progress` records with `parentToolUseID` | Same — maps to 3D minion bots |
| **Permission detection** | Timeout heuristic (~8s after tool_use, no result) | Same heuristic |
| **Visualization** | 2D pixel art characters | 3D animated bots in virtual office |
| **Multi-agent** | One character per terminal | Multiple agents in rooms, with roles |
| **Persistence** | VS Code workspace state | SQLite database |

**Key learnings from Pixel Agents to adopt:**
1. **Triple-layer file watching** (fs.watch + fs.watchFile + polling) — macOS is unreliable with just one method
2. **Permission timer heuristic** — if tool_use has no result after N seconds and no progress events, agent needs permission
3. **`turn_duration` as definitive turn end** — most reliable signal that agent is done and waiting
4. **`progress` records for sub-agent tracking** — parentToolUseID links sub-agent activity to parent Task tool
5. **Project dir path derivation** — `workspace_path.replace(/[^a-zA-Z0-9-]/g, '-')` → directory name under `~/.claude/projects/`

---

## Database Schema Changes

```sql
-- New table for locally-managed Claude Code processes
CREATE TABLE IF NOT EXISTS claude_processes (
    session_id TEXT PRIMARY KEY,
    pid INTEGER,
    status TEXT DEFAULT 'running',  -- running, stopped, crashed
    model TEXT,
    working_dir TEXT,
    system_prompt TEXT,
    started_at INTEGER,
    stopped_at INTEGER,
    agent_id TEXT REFERENCES agents(id)
);

-- New table for standalone cron jobs
CREATE TABLE IF NOT EXISTS cron_jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    schedule TEXT NOT NULL,
    message TEXT NOT NULL,
    agent_config TEXT,  -- JSON blob
    enabled INTEGER DEFAULT 1,
    last_run INTEGER,
    last_result TEXT,
    created_at INTEGER DEFAULT (unixepoch() * 1000)
);
```

---

## Minimal Viable Implementation (Quickstart)

If we want the fastest path to "CrewHub works without OpenClaw":

1. **Rewrite `claude_code.py`** (~200 lines) — implement `get_sessions()` by reading `sessions-index.json`, implement `get_session_history()` by parsing JSONL files
2. **Add `file_watcher.py`** (~150 lines) — watch JSONL files, emit activity events via SSE
3. **Add `transcript_parser.py`** (~100 lines) — port Pixel Agents' `transcriptParser.ts` to Python
4. **Modify `chat.py`** (~50 lines changed) — use `claude --print --resume` for sending messages
5. **Update onboarding** — detect `claude` CLI, skip OpenClaw setup if not available

**Total: ~500 lines of new Python code for read-only monitoring + basic chat.**

The `ConnectionManager` architecture already supports multiple connection types. A user could run both OpenClaw and standalone Claude Code simultaneously — the frontend doesn't care where sessions come from.

---

## Open Questions

1. **Authentication:** Claude Code uses Anthropic API keys or `claude login`. Should CrewHub manage keys, or just use whatever `claude` is configured with?
   - **Recommendation:** Let Claude Code handle auth. CrewHub just invokes the CLI.

2. **Multi-user:** If CrewHub is shared (e.g., team dashboard), how to handle multiple Claude Code installations?
   - **Recommendation:** Phase 1 is single-user. Multi-user via SSH-based remote connections later.

3. **Cost tracking:** OpenClaw tracks API costs. Claude Code exposes cost in `stream-json` `result` records.
   - **Recommendation:** Parse `cost_usd` from result records, store in SQLite.

4. **Settings sync:** CrewHub has agent configs (persona, room, etc.). How to inject into Claude Code?
   - **Recommendation:** Use `--append-system-prompt` for persona/context injection. Use `--settings` flag for Claude Code settings.
