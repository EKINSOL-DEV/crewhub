# CrewHub Agent Onboarding — Review (Iteration 1)

## 1. Executive Summary
This masterplan is directionally strong: a **curated discovery manifest + progressive disclosure** is the right mental model for agent onboarding, and most of Phase 1–2 is immediately buildable. The plan still has some critical gaps around **auth/permissions**, **identity semantics**, and **maintenance/token-cost control** (SKILL.md bloat), and it overreaches in a few later-phase features that can be simplified.

## 2. Grade
**B** — Solid architecture and clear phased plan, with a real “agent-first” approach. It loses points for missing security/permission design, unclear source-of-truth for session identity/registration across frameworks, and a tendency to turn documentation into a huge monolith (SKILL.md) that will be expensive to load and keep correct.

## 3. Strengths (keep it)
- **Manifest endpoint as a phrasebook**: `/api/discovery/manifest` is the right “first contact” surface and a strong differentiator vs README-only.
- **Progressive disclosure**: Layers 0–5 is the right framing; most agents only need 0–2.
- **Multiple discovery paths**: env var + config file + port probe is pragmatic and robust.
- **Idempotency emphasis**: Explicitly designing for retries/upserts is correct for agents.
- **Concrete, copy-pastable workflows**: The curl examples and “quick start” are genuinely actionable.
- **Phasing is mostly sane**: Phase 1 (manifest + agent.json) before skill/docs is correct.

## 4. Weaknesses (needs work)
- **Auth/permissions are essentially undefined**:
  - `agent.json` says `auth.required=false` but the plan includes endpoints that are inherently sensitive (`DELETE /api/sessions/{key}`, room/rule management, settings, connections).
  - There’s no story for multi-user machines, least-privilege, or “agent can read but not mutate.”
- **Identity model is muddled across frameworks**:
  - The plan mixes “session key” (OpenClaw-ish) with an “agent registry” but doesn’t define a stable, cross-runtime **agent_id** vs ephemeral **session_id** mapping.
  - “Auto-registration” (Phase 3) depends on agents being able to know their session_key reliably; that’s not universal.
- **SKILL.md is too large / too tempting to bloat**:
  - The proposed SKILL.md contains near full API reference + many recipes. In real agent runs, that will be too big to keep in-context and will cause token waste.
  - You’re duplicating content that OpenAPI already provides.
- **Discovery/manifest generation complexity risk**:
  - “Auto-generate manifest from FastAPI router metadata” sounds nice but is non-trivial to do well (grouping, descriptions, stability, backwards compatibility). Risk: half-implemented and brittle.
- **SSE/event model is underspecified and possibly inefficient**:
  - Appendix says `sessions-refresh` fires every 5 seconds (polling loop). That’s not scalable and is semantically “snapshot polling,” not events.
  - No guidance for reconnect/backoff, event IDs, missed events, or payload size controls.
- **Some endpoints mentioned in SKILL.md aren’t clearly real/consistent**:
  - Example: `GET /api/sessions/{key}/history` is listed, but also “chat history” endpoints exist; the split between “session history” vs “chat history” isn’t clarified.
  - “Chat only works for main sessions” is good, but it’s an implicit rule that should be machine-readable (capability flags).
- **Overreach in later phases vs actual agent needs**:
  - Room-level messaging is useful, but it may duplicate existing chat or external channels and adds storage/moderation/retention concerns.
  - “Community & Distribution” is fine, but “skill auto-update mechanism” can become a time sink.

## 5. Specific Recommendations
1. **Design auth & permission tiers before expanding capabilities** (must-do):
   - Define roles/scopes (e.g., `read_only`, `self_manage` (display name + self room assignment), `admin`).
   - Add token support in `agent.json` (even if optional) and make manifest include `auth: {required, methods, scopes}`.
   - Ensure dangerous endpoints require admin scope by default.

2. **Clarify the identity model explicitly** (must-do):
   - Define:
     - `agent_id` (stable, across restarts; e.g., derived from runtime+machine+config)
     - `session_key` (ephemeral runtime session identifier)
     - mapping endpoints (e.g., `POST /api/agents/self/identify` or `POST /api/sessions/self`)
   - Provide a “who am I?” endpoint so frameworks that don’t know their session_key can still self-identify (e.g., via headers, token subject, or connection metadata).

3. **Shrink SKILL.md into a small, cacheable “MVK + links” doc**:
   - Keep SKILL.md to:
     - discovery steps
     - the 5–8 most common calls
     - 2–3 workflows
     - pointers to `/api/discovery/manifest` and `/api/openapi.json`
   - Move the big endpoint catalog into:
     - OpenAPI examples
     - separate recipe files
     - or a `/api/discovery/recipes` endpoint.

4. **Make the manifest a stable contract (versioned schema)**:
   - Add `manifest_schema_version` (e.g., `1`) and commit to backwards compatibility.
   - Include explicit fields for:
     - `auth`
     - `rate_limits`
     - `self_endpoints` (preferred for agents)
     - `capabilities` with `id`, `since`, `deprecated_since`, `stability` (stable/beta/experimental)

5. **Prefer “self” endpoints to reduce agent footguns**:
   - Instead of requiring agents to interpolate `{session_key}` everywhere, add:
     - `POST /api/sessions/self/display-name`
     - `POST /api/sessions/self/room-assignment`
   - The server can resolve the caller’s session via token/connection mapping.

6. **Fix the SSE model: make it eventful, not polling snapshots**:
   - Add `event_id` and `Last-Event-ID` support.
   - Consider splitting:
     - lightweight “changed” events (`room_updated`, `session_joined`, etc.)
     - and on-demand snapshot endpoints (`GET /api/sessions`).
   - Add payload size controls (e.g., `?compact=1`, `?rooms=...`) and guidance for reconnect/backoff.

7. **Codify idempotency semantics with server support**:
   - For mutating endpoints, support `Idempotency-Key` header (or explicit upsert semantics documented).
   - Ensure “assign room twice is fine” is guaranteed by unique constraints/upserts.

8. **Make discovery work in Docker / remote scenarios**:
   - `localhost:8090` is not always correct for containers or remote dev.
   - In manifest/config, include:
     - `api_url`
     - `reachable_from` hints (host vs container)
     - optional `unix_socket` or `http+unix` guidance if you want to avoid network exposure.

9. **Audit the endpoint list and align terms**:
   - Remove or clearly label “aspirational” endpoints from SKILL.md.
   - Ensure naming consistency: `session_key` vs `key` vs `id`.
   - Add a small glossary to avoid confusion.

10. **Re-evaluate Phase 5 “room messaging” vs existing chat**:
   - If you build it, specify:
     - retention policy
     - moderation/spam controls
     - access control
     - notification semantics
   - Alternative: treat “room messages” as a view over existing chat logs + tags, or integrate with an external chat system.

## 6. Priority Changes (phase reordering)
- **Move “auth/scopes + self endpoints” into Phase 1** (or Phase 1.5). Without this, you’ll ship a manifest that encourages agents to hit powerful endpoints with no security story.
- **Move “SSE reliability improvements (event_id, reconnect)” into Phase 1–2**. Agents that integrate early will rely on it; changing semantics later is painful.
- **Defer “auto-generate manifest from router metadata” (Phase 4)** unless you can do it cleanly. A manually curated manifest is acceptable early; correctness and stability matter more than automation.
- **Defer room-level messaging (Phase 5)** until you have a clear use case that can’t be met with existing chat + assignments.

## 7. Questions for Nicky (needs human decisions)
1. **Security stance:** Should CrewHub be “local-trust” (no auth on localhost) or support real auth even locally? What’s the expected threat model (multi-user machine, shared network, remote access)?
2. **Write permissions for agents:** Should agents be allowed to:
   - only set their own display name/room?
   - create rooms/rules?
   - kill sessions?
   - modify connections/settings?
3. **Source of truth for session identity:** In non-OpenClaw runtimes, how do we reliably map an HTTP caller to a CrewHub session? (token subject, connection id, headers, etc.)
4. **How “universal” must onboarding be?** Is OpenClaw the primary target (80/20), or do you truly need Claude Code + Codex + “raw LLM” parity from day one?
5. **Eventing expectations:** Do we need real-time semantics (true events) or is periodic snapshot refresh acceptable? This drives SSE design and backend cost.
6. **Doc distribution preference:** Do you want the skill to be the main entry point, or should the manifest be the canonical onboarding surface with skills as thin wrappers?
