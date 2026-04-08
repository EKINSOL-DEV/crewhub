# CrewHub v0.21.0: 20 New Claude Code Features

> **Date:** 2026-04-08
> **Author:** CrewHub Team
> **Version:** v0.21.0

CrewHub's Claude Code integration just got a massive upgrade. Version 0.21.0 ships 20 new features spanning monitoring, interaction, multi-agent orchestration, UX polish, and extensibility. Here's everything that's new.

---

## Monitoring & Observability

### 1. Live Terminal Output Streaming

**The problem:** When Claude Code runs a bash command (building, testing, installing dependencies), users only saw "Running command" with zero visibility into what's actually happening.

**The fix:** CrewHub now parses `bash_progress` events from Claude Code's JSONL transcripts and streams the live output directly into the dashboard. The chat UI shows scrolling terminal output within tool call bubbles, and the 3D world activity bubbles display the last line of output.

**Files changed:** `claude_transcript_parser.py`, `claude_session_watcher.py`, `claude_code.py`

---

### 2. Session Titles from Summary Events

**The problem:** Sessions were identified by project name + truncated UUID (e.g., "crewhub (a2e0d3)"), making it hard to tell what each session was doing.

**The fix:** Claude Code emits `summary` events containing human-readable descriptions. CrewHub now captures these and displays them as session titles. Your session list now shows "Refactoring auth middleware" instead of "crewhub (a2e0d3)".

**Files changed:** `claude_transcript_parser.py`, `claude_session_watcher.py`, `claude_code.py`

---

### 3. Error Event Extraction & Red Alerts

**The problem:** API errors (rate limits, context overflow, server errors) appeared as normal assistant text. Users couldn't distinguish errors from regular responses.

**The fix:** A new `ErrorEvent` type detects `isApiErrorMessage` and `error` fields from Claude Code's JSONL records. Errors now appear with distinct styling, error counts show on session cards, and the 3D bot displays a red warning halo.

**Files changed:** `claude_transcript_parser.py`, `claude_session_watcher.py`, `claude_code.py`, `BotStatusGlow.tsx`, `botConstants.ts`

---

### 4. Conversation Tree View

**The problem:** Complex agent sessions with parallel tool calls produce non-linear conversations. Scrolling through a flat chat log makes it hard to trace cause and effect.

**The fix:** A new collapsible tree panel sits alongside the chat window, showing user messages as parent nodes with assistant responses and tool calls as children. Click any node to jump to that point in the chat.

**Files created:** `ConversationTreePanel.tsx`
**Files changed:** `AgentChatWindow.tsx`

---

### 5. Token & Cost Tracking

**The problem:** Teams running multiple agents had no idea how much each session was spending on API calls.

**The fix:** A new `TokenUsageEvent` parses `result` events from JSONL transcripts, extracting `input_tokens`, `output_tokens`, and cache token counts. Token usage is accumulated per session and exposed in session metadata. Session cards can now show cost badges.

**Files changed:** `claude_transcript_parser.py`, `claude_session_watcher.py`, `claude_code.py`

---

### 6. Hook Execution Visibility

**The problem:** When pre-commit hooks or custom hooks were running, agents appeared "stuck" with no explanation.

**The fix:** `hook_progress` events are now surfaced via SSE broadcast. Activity bubbles show "Running hook: pre-commit" with the hook name, and the agent top bar displays hook execution status.

**Files changed:** `claude_session_watcher.py`, `claude_code.py`

---

## Interaction & Control

### 7. Session Kill / Abort

**The problem:** There was no way to stop a runaway agent from the dashboard. The `kill_session` method was literally a stub that logged "not yet implemented."

**The fix:** A real implementation that handles both CrewHub-managed processes (via SIGTERM through `ClaudeProcessManager`) and discovered sessions (via process matching). A new `POST /api/chat/{key}/kill` endpoint exposes this to the frontend.

**Files changed:** `claude_code.py`, `chat.py`

---

### 8. In-Dashboard Permission Approval

**The problem:** Permission prompts were a top friction point. Users saw "waiting for permission" but had to switch to the terminal to approve tool calls.

**The fix:** A new `PermissionPromptPanel` component renders directly in the chat when an agent enters `WAITING_PERMISSION` state. For CrewHub-managed sessions, Approve/Deny buttons send responses via the bidirectional stream-json protocol. For discovered sessions, a one-click "Open in Terminal" handoff button is shown instead.

**Files created:** `PermissionPromptPanel.tsx`
**Files changed:** `AgentChatWindow.tsx`

---

### 9. Prompt Templates & Quick Actions

**The problem:** Many interactions with Claude Code are repetitive. Users retyped the same instructions over and over.

**The fix:** A new prompt template system with full CRUD API. Templates support variable substitution (`{{project}}`, `{{branch}}`, `{{file}}`) and can be scoped per-project. Built-in starter templates included: "Run tests and fix failures", "Review changes on current branch", "Explain this file."

**Files created:** `templates.py` (route), `prompt_templates` table
**Files changed:** `migrations.py`, `main.py`

---

### 10. System Prompt Configuration

**The problem:** System prompts shape agent behavior, but configuring them required editing CLI flags or CLAUDE.md files.

**The fix:** A new `system_prompt` field on agents, configurable from the dashboard. When CrewHub spawns a Claude process, it passes the text via `--append-system-prompt`. Set persistent behavioral guidelines like "Always run tests before committing" from one central place.

**Files changed:** `migrations.py`, `agents.py`, `cc_chat.py`, `claude_process_manager.py`

---

## Multi-Agent Orchestration

### 11. Agent Pipeline / Workflow Chains

**The problem:** Real development workflows are multi-step (write -> review -> test). Each agent was isolated with no way to chain outputs.

**The fix:** A full pipeline system with CRUD, execution tracking, and run history. Define ordered steps with agent assignments and prompt templates. Start a pipeline run and track progress across steps. Foundation for CI-like automation with AI agents.

**Files created:** `pipelines.py` (route), `pipelines` and `pipeline_runs` tables
**Files changed:** `migrations.py`, `main.py`

---

### 12. Cross-Agent File Conflict Detection

**The problem:** Multiple agents editing the same codebase can silently overwrite each other's work.

**The fix:** An in-memory `ConflictDetector` service tracks file paths from `Edit` and `Write` tool_use events. When two agents modify the same file within a 5-minute window, a `file-conflict` SSE event is broadcast. A new `/api/conflicts` endpoint exposes conflict data.

**Files created:** `conflict_detector.py`, `conflicts.py` (route)
**Files changed:** `claude_code.py`, `main.py`

---

### 13. Agent Cloning / Session Forking

**The problem:** When one agent discovers a problem requiring two approaches, there was no way to fork the work without manually setting up a second agent.

**The fix:** A `POST /{agent_id}/clone` endpoint copies an agent's configuration (project path, permissions, model, system prompt, room assignment) to a new agent with an auto-generated name. The clone appears in the same room, ready to work on an alternative approach.

**Files changed:** `agents.py`

---

### 14. Coordinated Task Assignment

**The problem:** Task board items and agent execution were completely disconnected. Users manually copied task descriptions into chat.

**The fix:** A `POST /api/tasks/{task_id}/assign` endpoint assigns a task to an agent session, automatically sends the task title and description as a prompt, and updates the task status to "in_progress."

**Files changed:** `tasks.py`

---

## UX & Polish

### 15. Interleaved Content Blocks

**The problem:** When an agent responded with `text -> tool -> text -> tool`, the UI showed all tools first, then all text -- losing the narrative flow.

**The fix:** Already implemented in the streaming hook and chat bubble. Both `ZenMessageContent` and `InlineMessageContent` now check for `contentSegments` and render them in order, preserving the original interleaving of text, tool calls, and thinking blocks.

**Status:** Was already implemented -- verified and confirmed working.

---

### 16. Session Timeline / Playback

**The problem:** Reviewing what an agent did required scrolling through long chat logs with no way to navigate quickly.

**The fix:** A horizontal timeline bar shows events as colored dots (blue=user, green=assistant, amber=tool, purple=thinking, red=error). Hover for tooltips, click to jump to any event. Toggleable via a chart icon in the chat header.

**Files created:** `SessionTimeline.tsx`
**Files changed:** `AgentChatWindow.tsx`

---

### 17. Richer 3D Agent Health Indicators

**The problem:** The 3D office metaphor was under-utilized. All agents looked similar regardless of state.

**The fix:** Two new status types with distinct animations:
- **Error state:** Red warning halo with fast pulse (impossible to miss)
- **Waiting permission:** Yellow slow blink (needs attention but not urgent)
- **Active state:** Faster pulse than before for more energetic feel

The `BotStatus` type now includes `error` and `waiting_permission` across all components (BotStatusGlow, BotBody, BotFace, BotInfoPanel).

**Files changed:** `botConstants.ts`, `BotStatusGlow.tsx`, `botActivity.ts`, `BotBody.tsx`, `BotFace.tsx`, `BotInfoPanel.tsx`

---

### 18. Smart Notification Rules

**The problem:** Notification fatigue. Users either got notified about everything or nothing.

**The fix:** A configurable rule system with 5 rule types: `on_error`, `on_completion`, `on_idle`, `on_permission_wait`, `on_specific_tool`. Rules can be scoped per-agent, per-project, or global. Full CRUD API with enable/disable toggle.

**Files created:** `notifications.py` (route), `notification_rules` table
**Files changed:** `migrations.py`, `main.py`

---

## Integration & Extensibility

### 19. Git Activity Timeline

**The problem:** Git operations (commits, pushes, branch switches) were buried in bash command output, invisible at a glance.

**The fix:** The session watcher now detects git commands in `Bash` tool_use events via pattern matching. Tracks commit count, push count, and last git action per session. This data is included in session metadata, enabling first-class git activity display in the UI.

**Files changed:** `claude_session_watcher.py`, `claude_code.py`

---

### 20. MCP Server Connection Monitoring

**The problem:** MCP is increasingly central to Claude Code workflows, but there was no visibility into which servers agents use or whether they're failing.

**The fix:** Tool_use events with `mcp__` prefixed names are detected and grouped by server. Per-session tracking of call count, error count, and last-used timestamp. Exposed in session metadata for display in agent info panels.

**Files changed:** `claude_session_watcher.py`, `claude_code.py`

---

## By the Numbers

| Category | Features | Complexity |
|----------|----------|------------|
| Monitoring & Observability | 6 | 2S + 3M + 1L |
| Interaction & Control | 4 | 1S + 2M + 1L |
| Multi-Agent Orchestration | 4 | 2M + 2L |
| UX & Polish | 4 | 1S + 2M + 1L |
| Integration & Extensibility | 2 | 2M |
| **Total** | **20** | **4S + 9M + 5L** |

### New Files Created
- `ConversationTreePanel.tsx` -- Chat tree view component
- `SessionTimeline.tsx` -- Horizontal event timeline
- `PermissionPromptPanel.tsx` -- Permission approval UI
- `conflict_detector.py` -- Cross-agent file conflict tracking
- `conflicts.py` -- Conflict detection API routes
- `templates.py` -- Prompt template CRUD routes
- `pipelines.py` -- Agent pipeline routes
- `notifications.py` -- Notification rules routes

### New Database Tables
- `prompt_templates` -- Reusable prompt templates with variables
- `pipelines` -- Pipeline definitions with ordered steps
- `pipeline_runs` -- Pipeline execution history
- `notification_rules` -- Configurable notification rules per agent/project

### New API Endpoints
- `POST /api/chat/{key}/kill` -- Kill a running session
- `POST /api/agents/{id}/clone` -- Clone an agent
- `POST /api/tasks/{id}/assign` -- Assign task to agent
- `GET/POST/PUT/DELETE /api/templates` -- Template CRUD
- `GET/POST/PUT/DELETE /api/pipelines` -- Pipeline CRUD
- `POST /api/pipelines/{id}/run` -- Start pipeline
- `GET /api/conflicts` -- View file conflicts
- `GET/POST/PUT/DELETE /api/notifications/rules` -- Notification rules

---

## What's Next

These 20 features lay the foundation for CrewHub to become the definitive orchestration layer for AI coding agents. Next up:

- **Pipeline orchestration engine** -- Full async execution of pipeline steps with output routing
- **Frontend UI for all new APIs** -- Templates picker, pipeline builder, notification settings panel, cost dashboard
- **Conversation tree with uuid/parentUuid** -- True branching tree using Claude Code's message graph metadata
- **Real-time bash output in chat** -- Terminal-style streaming output component

---

*Built with Claude Code. Monitored with CrewHub.*
