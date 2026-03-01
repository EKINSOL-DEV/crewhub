# Claude Code Gap Analysis -- CrewHub

## STATUS

| Area | Status | Run |
|------|--------|-----|
| A. JSONL parsing completeness | DONE | 2026-03-01 |
| B. Session watcher robustness | TODO | |
| C. Chat (cc_chat.py) | TODO | |
| D. Process manager | TODO | |
| E. Agent settings & persistence | TODO | |
| F. Frontend: onboarding flow | TODO | |
| G. Frontend: chat UI | TODO | |
| H. Frontend: 3D world | TODO | |
| I. Frontend: session filtering & parking | TODO | |
| J. Testing gaps | TODO | |
| K. Docker/deployment | TODO | |
| L. Security & permissions | TODO | |

---

## A. JSONL Parsing Completeness (2026-03-01)

**File:** `backend/app/services/connections/claude_transcript_parser.py`

### Current State

The parser handles these top-level record types:
- `assistant` -- text, thinking, tool_use content blocks
- `user` -- text content and tool_result blocks
- `system` -- only `subtype=turn_duration` and `subtype=init`
- `progress` -- only `data.type=agent_progress` (subagent nesting)

### Gaps Found

**1. Three top-level types are completely ignored (silently dropped):**

- **`summary`** -- Contains session summary text and leafUuid. Example: `{"type": "summary", "summary": "Lightweight LAN Kanban Board...", "leafUuid": "..."}`. This could be used to display a session title/summary in the UI.
- **`file-history-snapshot`** -- Contains file backup metadata (`trackedFileBackups`, `messageId`, `timestamp`). Not critical for display but could enable undo/diff features.
- **`queue-operation`** -- Contains `operation` (e.g., "dequeue"), `timestamp`, `sessionId`. Could be useful for detecting session queue state.

**Impact:** Low for core functionality. The parser returns `[]` for unknown types, so nothing crashes. But `summary` is a missed opportunity for better UX.

**2. Progress data types mismatch with reality:**

The parser's `_parse_progress()` only handles `data.type=agent_progress`. In actual Claude Code v2.1.x JSONL files, the only progress types observed are:
- **`bash_progress`** -- live output from bash tool execution (`output`, `fullOutput`, `elapsedTimeSeconds`, `totalLines`)
- **`hook_progress`** -- hook execution events (`hookEvent`, `hookName`, `command`)

No `agent_progress` events were found in any local JSONL data across all projects. Either:
1. `agent_progress` was a v1.x format that no longer exists, or
2. It only appears when Claude Code uses the `Task` tool (subagent spawning), which may use a different mechanism in v2.x

**Impact:** Medium. `bash_progress` could enable real-time streaming of command output in the UI (showing live terminal output while a tool runs). Currently this data is silently discarded. The `agent_progress` handler may be dead code.

**3. Metadata fields ignored but potentially useful:**

Every JSONL record in v2.x includes these envelope fields that the parser does not extract:
- `uuid` / `parentUuid` -- message graph structure (enables proper tree reconstruction)
- `isSidechain` -- marks sidechain/background reasoning (should possibly be filtered or displayed differently)
- `version` -- Claude Code version string
- `slug` -- human-readable session slug
- `sessionId` -- session UUID
- `toolUseResult` -- present on `user` type records, indicates tool result metadata (92 occurrences in test data)
- `toolUseID` -- tool use ID at envelope level (redundant with content block ID but useful for correlation)
- `thinkingMetadata` -- contains `maxThinkingTokens`
- `isApiErrorMessage` -- boolean flag on error responses
- `error` -- error details on assistant messages

**Impact:** The `uuid`/`parentUuid` fields are important for correctly reconstructing conversation trees, especially with parallel tool use. `isApiErrorMessage` and `error` are important for error display. Currently errors are parsed as normal assistant text.

**4. Tool result content truncation:**

In `_parse_user()`, tool result content is truncated to 200 chars: `content=str(block.get("content", ""))[:200]`. This is fine for activity detection but would be inadequate if the parsed events are ever used for full transcript display.

**5. `cwd` extraction on every line:**

The parser appends a `ProjectContextEvent` for every record that has a `cwd` field (which is every record in v2.x). This means every single parsed line generates a redundant `ProjectContextEvent`. The dedup check `if not any(isinstance(e, ProjectContextEvent) for e in events)` only prevents duplicates within a single line's events, not across lines.

**Impact:** Low (downstream code handles it), but wasteful. Could be deduplicated at the watcher level.

### Recommendations

1. **Add `summary` event type** -- Parse it into a new `SessionSummaryEvent` dataclass. Use it to set session title in WatchedSession. Low effort, nice UX win.

2. **Add `bash_progress` handling** -- Parse into a `BashProgressEvent` with `output`, `elapsedTimeSeconds`. This enables real-time tool output streaming in the chat UI.

3. **Verify `agent_progress` still exists** -- Test with an actual Claude Code session that uses the Task tool. If it no longer fires, remove or update the handler. If it does fire, document when.

4. **Parse `error` and `isApiErrorMessage` fields** -- Add an `ErrorEvent` or flag on `AssistantTextEvent` so the UI can display errors distinctly (red styling, retry button).

5. **Consider extracting `uuid`/`parentUuid`** -- Not urgent, but needed for proper conversation tree rendering if that becomes a feature.

6. **Deduplicate `ProjectContextEvent`** -- Only emit when `cwd` actually changes from the last seen value, not on every line.
