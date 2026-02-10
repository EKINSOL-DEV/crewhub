# Architecture Review: Node-Based / Flow-Based Status & Timing Logic in CrewHub

Date: 2026-02-03

## Executive summary (brutally honest)
A Node-RED/n8n-style **visual node editor** for CrewHub’s session status/timing logic is **almost certainly over-engineering** for your scale (5–10 agents, small team) and for the type of logic you have (time thresholds + a few heuristics). You’d be trading a modest amount of code duplication for a large permanent surface area: graph execution semantics, versioning, validation, debugging, UI editor, persistence, migrations, testing story, and performance concerns.

There *is* a sweet spot: **centralize the logic into a single “policy pipeline” module** built from **pure functions + a config object**, backed by tests, and optionally expressed as a small **declarative rules DSL** (JSON/YAML). If you want “node-based”, make it *headless* first (no visual editor): a simple DAG of named steps that composes functions and exposes knobs.

## What the current code is actually doing (from the files)
The current “status/timing” behavior is split across several places with overlapping thresholds:

### `minionUtils.ts`
- `getSessionStatus(session)`
  - `active` if updated < 5 min
  - `idle` if updated < 30 min
  - else `sleeping`
- `getCurrentActivity(session)`
  - Uses recent message/tool/thinking blocks (filters NO_REPLY/HEARTBEAT_OK).
  - If no recent activities, falls back to status + additional thresholds:
    - if active and updated < 30s → “Working...”
    - if active but older → “Ready and listening”
    - idle → “Waiting for tasks”
    - sleeping → “Sleeping 💤”
- `shouldBeInParkingLane(session, isActivelyRunning?, idleThresholdSeconds=120)`
  - Fixed agents (`agent:*:main`) never park.
  - Sleeping always parks.
  - If actively running, don’t park.
  - Else park if idleSeconds > idleThresholdSeconds (default 120s)

### `sessionFiltering.ts`
- `splitSessionsForDisplay(...)`
  - partitions by `shouldBeInParkingLane`
  - sorts active by `updatedAt`, caps visible at `maxVisible` (default 15)
  - overflow goes to parking
  - parked sessions with `now - updatedAt > parkingExpiryMs` are hidden (default 30 min)

### `useSessionActivity.ts`
- Tracks token changes per session key to infer “actively running”.
- `isActivelyRunning` returns true when:
  - tokens changed in last 30s, OR
  - session updated in last 30s (for tool work that doesn’t generate tokens)

### Implication
You already have a *pipeline*, just implicit and duplicated:

- Inputs: `session.updatedAt`, `messages`, `usage/tokens`, `key` patterns
- Derived signals: `isActivelyRunning`, `sessionStatus`, `currentActivity`
- Decisions: parking vs room placement, hiding after expiry, labeling

The pain isn’t that the logic is “impossible”; it’s that **thresholds and semantics are scattered**, and “what counts as active” isn’t defined in one place.

## 1) Is a node-based system appropriate for CrewHub’s scale?
Mostly no.

A node-based system makes sense when:
- there are many stakeholders configuring logic (ops, PMs, customers)
- rules change frequently and need safe non-code iteration
- flows are numerous and different per environment/customer
- there’s a need for audit trails, versioning, rollbacks, branching

CrewHub (5–10 agents, small team) is closer to:
- a single set of heuristics evolving slowly
- a tight dev loop where code changes are cheap
- high value on debuggability and consistency

The overhead of building and maintaining a node editor dwarfs the current benefit.

## 2) What problem does it actually solve?
**What it *would* solve**
- Central place to change thresholds
- Ability to tweak behavior without redeploy (if you store config remotely)
- Potentially allow “policy profiles” (e.g., different parking behavior per team)

**What it *doesn’t* automatically solve**
- Consistency: you still need strict semantics and tests
- Debugging: graph-based systems can be *harder* to debug because behavior is emergent
- Product value: users generally don’t want to “program their status colors”

Right now, the actual pain points seem solvable with:
- one module owning the policy
- configuration-driven thresholds
- tests + fixtures to prevent regressions

## 3) Complexity budget: visual editors are huge
Node-based systems are not “a refactor”; they’re a product:

**Minimum requirements you inherit**
- Graph model + execution engine (DAG vs cycles, evaluation order)
- Runtime errors and partial evaluation behavior
- Type system (or runtime validation) for node I/O
- Persisted definitions + migrations
- UI editor: drag/drop, pan/zoom, connect ports, configure nodes
- Debug tools: step-through, inspect intermediate values, replay
- Versioning + change history + rollback
- Security: if definitions can be edited, you’ve created a programmable surface

Even an MVP can easily become a multi-month distraction.

## 4) Simpler alternatives (recommended path)

### A) Config-driven policy module (best ROI)
Create a single module (e.g. `sessionPolicy.ts`) that exposes:
- `deriveSessionSignals(session, now, activityTracker)`
- `decidePlacement(session, signals, config)`
- `formatDisplay(session, signals)`

Move every threshold into a typed config:
```ts
export const defaultPolicy = {
  status: {
    activeMs: 5 * 60_000,
    idleMs: 30 * 60_000,
  },
  activity: {
    recentToolThinkingMs: 10_000,
    workingMs: 30_000,
    activelyRunningMs: 30_000,
  },
  parking: {
    idleSeconds: 120,
    expiryMs: 30 * 60_000,
    maxVisible: 15,
    neverParkKeyRegex: '^agent:[\\w-]+:main$',
  },
} as const
```
Benefits:
- Stops the “threshold whack-a-mole” problem immediately
- Easy to review diffs (“we changed active threshold from 5 to 3 minutes”)
- Easy to test

Make all functions **pure** where possible by threading `now` and not calling `Date.now()` inside (or do it in a thin wrapper). That makes deterministic tests and avoids subtle per-render drift.

### B) “Rule engine lite” (only if you need more than thresholds)
If you start having many conditional branches (“if agent type is X and room is Y and last tool is Z...”), consider a small rules approach:
- JSON array of rules
- first-match-wins
- conditions are a limited set (comparisons, regex, time windows)

Keep it constrained; don’t accidentally implement a programming language.

### C) State machine (XState) for lifecycle semantics (situational)
If you have real lifecycle complexity (transitions, hysteresis, debounce, events), a state machine can help.

Right now the logic is mostly “derived from timestamps”, not event-driven. XState could be overkill unless you want:
- explicit transitions with guards
- “active → idle” only after sustained inactivity
- separate “sleeping” vs “offline” with reconnect events

### D) Better organization only (minimum change)
If you truly want minimal work:
- leave logic as-is but move thresholds/constants to one file
- ensure `World3DView.tsx` doesn’t redefine similar thresholds

This is the least disruptive, but you’ll still have semantic drift risk.

## 5) If node-based: what’s the MVP that’s not insane?
If you insist on “node-based”, do **headless, code-first, no visual editor**.

### MVP concept: a named-step pipeline (DAG-ish) with config
- Define a fixed pipeline of steps (not arbitrary graphs):
  1. compute base times (idleSeconds, timeSinceUpdate)
  2. compute activity signals (activeRunning)
  3. compute status (active/idle/sleeping/offline)
  4. decide placement (room vs parking vs hidden)
  5. compute display strings/indicators

- Allow configuration of thresholds and maybe step enable/disable.

This gives you most of the benefit (centralization + configurability) without building Node-RED.

### Slightly more flexible MVP: declarative rules as “nodes”
Represent each step as:
```json
{ "id": "status", "type": "thresholdStatus", "input": "timeSinceUpdateMs", "params": {"activeMs": 300000, "idleMs": 1800000} }
```
But still **no visual editor**. A JSON editor + validation is enough.

Only build a visual UI if you have strong evidence:
- multiple non-dev users changing this weekly
- lots of different profiles
- significant misconfiguration costs justified by UI guardrails

## 6) What would users actually configure?
Be realistic about who the “user” is.

**Likely internal-only knobs** (useful):
- thresholds (active/idle/sleeping)
- parking idle threshold
- parking expiry
- max visible sessions
- “never park these session key patterns”

**Potentially useful but risky knobs**:
- defining what counts as activity (token deltas vs updatedAt vs message types)
- custom “status mapping” per agent type

**Probably not worth exposing**:
- display name logic
- icon selection
- “current activity” heuristics

If you expose too many knobs, you get inconsistent UX and hard-to-debug behavior.

## 7) Performance concerns (browser on every SSE update)
The current approach is fine for 5–10 sessions, but node-based graphs can accidentally become expensive.

Key performance points:
- Avoid repeated `.find()` per session in `isActivelyRunning` (currently it does a find inside the callback; at 10 sessions it’s fine, but it’s still O(n^2) worst-case). Consider indexing by key once per update.
- Prefer pure derivation: compute all derived signals in a single pass and reuse them.
- Avoid calling `Date.now()` in multiple modules leading to jitter; capture `now` once per render/update.

A visual node graph engine adds overhead:
- allocations per node
- dynamic dispatch
- debugging metadata

It’s not catastrophic at this scale, but it’s needless complexity in hot paths.

## Recommendation

### Strong recommendation: do *not* build a Node-RED/n8n-style editor.
It’s not aligned with CrewHub’s current needs and will consume a lot of engineering effort for minimal product value.

### Do this instead (pragmatic “sweet spot”):
1. **Create a single Session Policy module** (frontend) that owns:
   - status derivation
   - activity detection integration (token tracking)
   - placement decisions (visible/parking/hidden)
2. **Move all thresholds to a typed config** with sensible defaults.
3. **Add tests with fixtures** (sessions at specific timestamps) to lock semantics.
4. **Optionally load config from server** so thresholds can be tuned without redeploy.
5. Later (only if needed): introduce a constrained declarative rules list for routing/parking.

### Where node-based could still make sense
If you have a roadmap where CrewHub becomes a platform with:
- many teams
- per-team behavior
- frequent policy tuning
- “automation-like” flows (room routing, alerts, auto-parking rules, notifications)

…then a node-based approach could be justified, but I’d still start from a headless rules engine and add a visual editor only after proven demand.

## Concrete next steps (low-risk)
- Create `frontend/src/lib/sessionPolicy.ts`:
  - `deriveSignals(session, now, activityState)`
  - `decideDisplayBucket(session, signals, config)`
  - `formatActivity(session, signals, config)`
- Replace scattered calls in 2D/3D views with policy output.
- Ensure backend `assignments.py` routing rules are either:
  - mirrored by a shared config schema, or
  - treated as authoritative and the frontend only renders results.

If you want one sentence: **centralize and parameterize first; don’t build a visual programming product unless you’re sure you need to.**
