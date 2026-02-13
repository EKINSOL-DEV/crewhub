# AI Meetings Backend Review

## Summary
**Good** — Phase 1 is functional and the core flow works end-to-end (real run succeeded, SSE updates, persistence, synthesis, output export). Architecture is sensible and follows the design direction, but there are a few **important gaps to address before frontend-heavy rollout** (especially restart recovery, token-budget enforcement, and missing automated tests).

## Strengths
- Clear orchestration flow in `MeetingOrchestrator` with understandable lifecycle phases.
- Round-robin sequencing is straightforward and deterministic.
- Good baseline state transitions (`gathering` → `round_n` → `synthesizing` → `complete/error/cancelled`).
- SSE integration is clean and emits useful UX events (`meeting-started`, turn start/complete, synthesis, completion, error).
- DB schema is practical for Phase 1 (`meetings`, `meeting_participants`, `meeting_turns`) and indexed for core lookups.
- API surface is minimal and usable (`start`, `status`, `cancel`, `list`, `output`).
- SQL is parameterized throughout (good SQL-injection posture).

## Issues Found
### Critical
- **No state recovery/resume after backend restart.**
  - Running meetings are only tracked in `_active_meetings` (in-memory). On process restart/crash, meeting rows remain non-terminal but no task is resumed.
  - Impact: stuck meetings and ambiguous UX/state for clients.

### Medium Priority
- **Token budget is configured but not enforced.**
  - `max_tokens_per_turn` and `synthesis_max_tokens` exist in models but are not applied in `send_message` calls or prompt truncation logic.
  - This conflicts with the ~3500–4000 token budget target and can cause runaway context growth.

- **Mutable default values in Pydantic models.**
  - `MeetingConfig.round_topics`, `Round.turns` use mutable defaults (`[]` / list literal).
  - Risk: shared mutable state bugs. Use `Field(default_factory=...)`.

- **No automated tests for meetings/orchestrator/routes.**
  - Existing backend tests don’t cover new meetings logic (happy path, retry, timeout, cancel, synthesis fallback, recovery).
  - Manual validation is good but insufficient for regression safety.

- **Participant uniqueness not validated.**
  - Duplicate participants can be sent; turn loop will run duplicates, but `meeting_participants` table PK `(meeting_id, agent_id)` collapses duplicates.
  - Result: data inconsistency between runtime behavior and stored participant list.

- **`cancel` API response may return stale `cancelled_at`.**
  - Endpoint returns `meeting.get("cancelled_at")` from pre-cancel snapshot, typically `null`.
  - Small API correctness issue.

- **Some resilience constants/paths are unused or incomplete.**
  - `GATEWAY_RECONNECT_TIMEOUT` declared but not implemented.
  - Retry logic is fixed 1 retry + static delay; no error-type-aware strategy.

### Low Priority / Nice-to-have
- `list_meetings` does N+1 query for participant counts; could be replaced with JOIN + GROUP BY.
- `_save_output` performs synchronous file I/O inside async path (`write_text`), acceptable now but can block event loop under load.
- `meeting_turns` has `prompt_tokens/response_tokens` columns but values are never populated (missed observability).
- Broad exception swallowing in migration `ALTER TABLE` blocks is pragmatic but hides non-column-related failures.

## Recommendations
1. **Add restart recovery on startup**
   - On app startup, query meetings in non-terminal states and either:
     - mark as `error` with reason `"orchestrator_restart"`, or
     - resume from persisted state (preferred in Phase 2).
   - Emit SSE event so frontend can reflect recovery outcome.

2. **Enforce token and context budgets explicitly**
   - Truncate/summarize cumulative context per turn.
   - Pass token caps through connection layer where supported.
   - Track actual usage in `meeting_turns.prompt_tokens/response_tokens`.

3. **Fix Pydantic mutable defaults**
   - Replace list literals with `Field(default_factory=...)` for all list fields.

4. **Add validation hardening on start endpoint**
   - Enforce unique participants.
   - Optional: enforce `round_topics` non-empty strings and max length constraints.

5. **Improve cancellation/consistency details**
   - Return fresh `cancelled_at` from DB after cancel.
   - Consider setting `current_turn` to 0 or sentinel on completion/cancel for cleaner UI semantics.

6. **Add focused test suite for meetings**
   - Unit tests: state machine transitions, round-robin order, retry/timeout behavior.
   - Integration tests: `/start`, `/status`, `/cancel`, `/output`, SSE event sequence.
   - Failure tests: gateway unavailable, no bot responses, synthesis fallback path.

7. **Small performance polish**
   - Optimize `list_meetings` query to avoid N+1 participant count lookups.
   - Move output file writes to threadpool (`asyncio.to_thread`) if meeting throughput increases.

## Conclusion
The implementation is **close and usable**, and the core design is strong for Phase 1. I’d consider it **ready for limited frontend integration** after fixing the medium-priority items (especially recovery, token enforcement, and baseline test coverage). No fundamental architecture rewrite is needed — this is an iteration-hardening pass, not a rebuild.
