# Claude Code Implementation Research Notes

**Date:** 2026-02-28

## Claude CLI

- **Path:** `/Users/ekinbot/.local/bin/claude`
- **Key flags confirmed:**
  - `--resume <session_id>` — resume conversation by ID
  - `--continue` — continue most recent in current dir
  - `--print` / `-p` — non-interactive output
  - `--output-format stream-json|json|text`
  - `--session-id <uuid>` — use specific session ID
  - `--model <model>` — model alias or full name
  - `--permission-mode` — choices: acceptEdits, bypassPermissions, default, delegate, dontAsk, plan
  - `--append-system-prompt` — append to default system prompt
  - `--max-budget-usd` — spending limit
  - `--allowed-tools` / `--disallowed-tools`
  - `--mcp-config` — MCP server config
  - `--fork-session` — new session ID when resuming
  - `--include-partial-messages` — partial chunks with stream-json
  - `--input-format stream-json` — realtime streaming input

## ~/.claude Directory Structure

```
~/.claude/projects/
  -Users-ekinbot/
  -Users-ekinbot-clawd/
  -Users-ekinbot-ekinapps-flowy-platform/
    a2e0d3af-e56f-40a9-8351-08536730d467.jsonl
```

Project dir naming: path with `/` replaced by `-`, leading `-`.

## Current claude_code.py

Stub implementation (~246 lines). Has correct interface extending `AgentConnection` with:
- `connect()`, `disconnect()`, `get_sessions()`, `get_session_history()`, `get_status()`
- Config: `data_dir`, `cli_path`
- No actual file watching or parsing

## ConnectionManager

- Located at `backend/app/services/connections/connection_manager.py`
- Supports multiple connections via `add_connection()`
- ClaudeCode not currently registered at startup (it's just a stub)

## DB Schema

- Version: **17** (v17: Placed Props / Creator Mode)
- Phase 2 will need v18 for `claude_processes` table

## Key Implementation Decisions

1. **Session discovery:** Scan `~/.claude/projects/{slug}/*.jsonl`
2. **Session ID:** filename without `.jsonl` extension (UUID format)
3. **`--resume`** is the correct flag (not `--continue` which just picks most recent)
4. **`--output-format stream-json`** gives structured streaming output
5. **`--input-format stream-json`** enables bidirectional streaming
