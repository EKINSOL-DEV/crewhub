# CrewHub Agent Onboarding — Review (Iteration 2)

## 1. Executive Summary
v2 is a meaningful improvement: it directly addresses the biggest architectural gaps from v1 (auth/scopes, identity semantics, SKILL.md bloat, SSE reconnect semantics, phase order). The plan is now **coherent enough to implement** in Phase 1–2 without painting yourself into a corner.

That said, v2 introduces (or makes more visible) a few “final-iteration” problems you should resolve in v3:

- **Spoofing risk in identity**: allowing callers to provide arbitrary `agent_id` (and sometimes `session_key`) without a strong binding rule creates an impersonation/poisoning vector—even in “local-trust” mode.
- **Local-trust key distribution is convenient but too implicit**: writing an admin key into `agent.json` is effectively “no auth” (fine), but it should be framed as *explicit insecure mode* with strong guardrails (file permissions, warnings, easy strict-mode flip).
- **Scopes are good, but “manage” vs “admin” boundaries remain fuzzy** for a local-first tool (e.g., should `manage` include agent registry writes? blueprint writes? notify endpoint?).
- **SSE spec is much better, but the delivery guarantees are still underspecified** (ordering across reconnect, at-least-once vs at-most-once, buffer persistence, snapshot semantics).
- **Tiered docs is workable, but only if you commit to disciplined doc hygiene** (topic versioning/ETag, stable topic list, and ensuring the Tier-1 skill never regrows).

Net: v2 upgrades the plan from “good idea, risky details” to “buildable system design,” but v3 needs to tighten security semantics and operational contracts.

## 2. Grade
**A- (↑ from B)**

Why not A yet: remaining issues are mostly **security/identity binding** and **operational reliability contracts**—the stuff that becomes painful once agents integrate.

## 3. V1 Feedback Checklist (was each item addressed? ✅/⚠️/❌)

1. **Security/auth scopes** — ✅
   - Clear scopes (`read`, `self`, `manage`, `admin`), key management endpoints, and a permission matrix.
   - Adds local-trust vs strict-mode stance.

2. **Identity model (agent_id vs session_key)** — ✅ (with ⚠️ caveats)
   - The two-level identity model is now explicit.
   - `/api/self/*` endpoints reduce the session_key footgun.
   - Caveat: the *binding rules* for who is allowed to claim which `agent_id` / `session_key` need tightening (see weaknesses).

3. **SKILL.md size/token cost** — ✅
   - Tiered docs approach (Tier 1 minimal + Tier 2 on-demand) is the right fix.

4. **SSE reliability** — ✅ (with ⚠️ caveats)
   - Event IDs, `Last-Event-ID`, backoff, buffer, and snapshot fallback are included.
   - Caveat: semantics/guarantees still need final polish (buffer persistence, dedupe, ordering).

5. **Phase reordering** — ✅
   - Auth + self endpoints moved to Phase 1; SSE reliability to Phase 2; manifest auto-gen and room messaging deferred.

## 4. New Strengths

- **“5 calls from zero to visible”** is an excellent north-star and shows up consistently in the flow.
- **Manifest schema versioning** (`manifest_schema_version`) is exactly the right contract boundary.
- **Local-first threat model is articulated** instead of being accidental.
- **Idempotency contract is explicit** and reinforced with optional `Idempotency-Key`.
- **Glossary + consistent terminology** reduced a lot of ambiguity from v1.
- **Docker/reachable_from hints** acknowledges reality (localhost is not universal) without overcomplicating the default.

## 5. Remaining Weaknesses

### 5.1 Identity spoofing / poisoning (needs hard rules)
Right now, `/api/self/identify` allows:
- `agent_id` in request body
- sometimes `session_key` in request body
- fallback headers like `X-Agent-Id`

This is convenient, but it opens the door for:
- one agent claiming another agent’s `agent_id`
- an agent creating many fake agents (“registry poisoning”)
- confusing cross-runtime mappings (two runtimes claim same `agent_id` with conflicting metadata)

Even on a single-user laptop, you will eventually run multiple agents with different trust levels (random npm script agent, untrusted repo agent, etc.). v3 should specify *who can assert what*.

### 5.2 Local-trust mode is effectively “auth off” (fine) but needs explicit guardrails
Writing an `admin` key into `~/.crewhub/agent.json` means any local process can become admin. That can be acceptable for the primary target, but:
- Treat it as **explicit insecure default** (documented as such).
- Require **0600 file permissions** for both `agent.json` and `api-keys.json`.
- Ensure strict mode is easy to enable and clearly explained in onboarding.

### 5.3 Scope boundaries still feel slightly arbitrary
The matrix is good, but in practice:
- `manage` is a big bucket (rooms, rules, agents, assignments, blueprints). For a local-first tool, you might want:
  - `manage_rooms_rules`
  - `manage_agents`
  - `manage_world` (blueprints)
…or at least an explicit statement that 4 scopes are intentionally coarse.

Also: endpoints like `/api/notify` (SSE group) can become a spam vector; it probably belongs behind `manage` or `admin` explicitly.

### 5.4 SSE contract: better mechanics, still missing “what do clients rely on?”
You’ve got event IDs and replay, but v3 should clarify:
- Delivery semantics: **at-least-once** delivery is typical with replay; clients must dedupe by `event_id`.
- Ordering: are event IDs strictly monotonic per server? per room? per stream?
- Buffer: in-memory only or persisted? What happens on server restart?
- Snapshot event: does it reset client state? Should it include a `snapshot_version` / `last_event_id`?

Without these, client implementations will diverge and be fragile.

### 5.5 Tiered docs: workable, but you need hard “anti-regrowth” rules
Tier 1 SKILL.md staying small is a cultural problem as much as a technical one.

v3 should include:
- a hard token/line budget and CI check (e.g., max 120 lines or max 500 tokens)
- doc topic versioning/ETag so agents can cache safely
- a rule that Tier 2 docs must never contain unstable endpoint paths unless marked clearly

### 5.6 Manifest/content duplication risk
You currently have 3 sources of truth:
- manifest (curated)
- extended docs (markdown)
- OpenAPI (generated)

That’s acceptable, but v3 should specify:
- what is canonical for **parameters** (OpenAPI)
- what is canonical for **capability list + scopes** (manifest)
- how to avoid drift (at minimum: a small test that compares manifest endpoints against OpenAPI routes)

### 5.7 “Chat only works for main sessions” is not machine-readable
It appears as a Tip. Agents will miss it.

Make it a manifest flag, e.g.:
- capability `chat` includes `constraints: {main_session_only: true}`

## 6. Specific Recommendations for v3 (FINAL iteration)

1. **Lock down identity claiming rules (must-do).**
   - Define a strict rule set:
     - If API key is bound to an `agent_id`, caller may only operate as that `agent_id`.
     - If key is *not* bound, `/api/self/identify` may create a new `agent_id` only if scope ≥ `manage` (or require explicit allowlist).
     - For OpenClaw-connected sessions, prefer deriving `session_key` from gateway metadata; treat body-provided `session_key` as advisory or reject it.
   - Document “agent_id is a claim” vs “agent_id is server-assigned.” Pick one.

2. **Make strict mode a first-class onboarding story.**
   - In the manifest, include `auth: {mode: local_trust|strict}`.
   - In strict mode: never write `default_key` into `agent.json`; require `CREWHUB_API_KEY`.
   - Add a one-paragraph “When should I enable strict mode?” section.

3. **File permission + storage requirements (hard requirement for v3).**
   - Specify: `~/.crewhub/api-keys.json` and `~/.crewhub/agent.json` must be 0600.
   - Specify behavior if permissions are too broad (warn + optionally refuse in strict mode).

4. **Tighten the SSE spec into a client-contract.**
   - State: delivery is at-least-once; clients dedupe by `event_id`.
   - State ordering guarantees (monotonic sequence per server process).
   - State server-restart behavior: on restart, event buffer is empty → first event after reconnect should be `snapshot`.
   - Add: `snapshot` payload includes `last_event_id` so clients can resume cleanly.

5. **Make constraints machine-readable in the manifest.**
   - Add `constraints` object per capability:
     - chat: `{main_session_only: true}`
     - sse: `{max_connections_per_key: 1, supports_compact: true}`
     - identity: `{supports_unbound_keys: false}` (if you choose to disallow)

6. **Add ETag/version headers for Tier 2 docs + manifest.**
   - Serve `ETag` and/or `Last-Modified` for `/api/discovery/manifest` and `/api/discovery/docs/*`.
   - Agents can use `If-None-Match` to avoid re-downloading.

7. **Enforce the Tier-1 SKILL.md budget with CI.**
   - Add a simple check in repo CI: fail if SKILL.md exceeds X lines / Y tokens.
   - Explicitly list what is allowed in Tier 1 (discovery, auth, 5–8 calls, links).

8. **Add a minimal “safe defaults” key strategy.**
   - Default local-trust key being `admin` is convenient, but consider generating:
     - one `self` key in `agent.json`
     - keep `admin` key only in `api-keys.json`
   - This preserves “it just works” while reducing blast radius for autonomous agents.

9. **Add a drift check between manifest endpoints and OpenAPI routes.**
   - Even a lightweight unit test that ensures every endpoint listed in manifest exists in OpenAPI.

10. **Clarify whether `/api/discovery/manifest` is public forever.**
   - Today it’s public (good for discovery). But if you ever run remotely, manifest can leak capability surface.
   - v3 should decide:
     - either keep it public by design, or
     - allow “public manifest” vs “authenticated manifest” modes.

## 7. Questions for Nicky

1. **Security stance decision:** Are you comfortable with “admin key in agent.json” as the default, or do you want the safer split (`self` in agent.json, `admin` only in api-keys.json)?
2. **Identity authority:** Should agents be allowed to *choose* `agent_id`, or should CrewHub assign it (and agents can only suggest labels/metadata)?
3. **Remote future:** Do you expect remote/network access in the next 6–12 months? If yes, we should avoid any assumptions that manifest/docs are public.
4. **Scope granularity:** Are 4 coarse scopes enough for your real-world use, or do you want to prevent “orchestrator agents” from touching settings/connections but still manage rooms/rules?
5. **SSE expectations:** Do you want SSE to be a reliable integration surface for agents (client libraries, long-running connections), or is it primarily for the UI dashboard?

---

**Killer question (agent POV):** Yes, I would find this useful on first boot—*if* `POST /api/self/identify` works without me knowing fragile session identifiers and if I can set my name/room in 1–3 calls. What would frustrate me is ambiguous identity claiming ("did I just overwrite another agent?") and SSE streams that occasionally miss state without a clearly defined snapshot/dedupe strategy.
