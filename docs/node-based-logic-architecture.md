# Architecture Analysis: Node-Based Status/Timing Logic for CrewHub

**Date:** 2026-02-03  
**Author:** Architecture Analysis (Opus)  
**Status:** Proposal / Analysis

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Pain Points](#2-pain-points)
3. [Node-Based Approach](#3-node-based-approach)
4. [Alternative Approaches](#4-alternative-approaches)
5. [Recommendation](#5-recommendation)
6. [Implementation Plan](#6-implementation-plan)
7. [Risks & Trade-offs](#7-risks--trade-offs)

---

## 1. Current State Analysis

### 1.1 Overview of All Timing/Status/Routing Logic

CrewHub has **six distinct logic domains** spread across **seven files** in both frontend and backend. Here's the complete map:

### 1.2 Logic Domain: Bot Status

**Where:** Two different implementations with different thresholds.

| Location | Function | Thresholds | States |
|----------|----------|-----------|--------|
| `minionUtils.ts` | `getSessionStatus()` | 5min, 30min | active → idle → sleeping |
| `World3DView.tsx` | `getAccurateBotStatus()` | 120s, 1800s (30min) | active → idle → sleeping → offline |

**Data flow:**
```
session.updatedAt → time delta → threshold comparison → status string
isActivelyRunning (from token tracking) → overrides to "active" (3D only)
```

**Key discrepancy:** `getSessionStatus()` uses 5-minute and 30-minute thresholds, while `getAccurateBotStatus()` uses 2-minute and 30-minute thresholds plus an "offline" state. The 3D view also factors in `isActivelyRunning` from token tracking, which the utility version does not.

### 1.3 Logic Domain: Token-Based Activity Detection

**Where:** `useSessionActivity.ts`

**Mechanism:**
```
session.totalTokens → compare with previous snapshot → if changed within 30s → "actively running"
session.updatedAt → if within 30s → also "actively running" (catches tool work)
```

**Consumers:** `splitSessionsForDisplay()`, `getAccurateBotStatus()`, `getActivityText()`

This is the only real-time activity signal and it feeds into both parking and status decisions.

### 1.4 Logic Domain: Parking Logic

**Where:** `minionUtils.ts` → `shouldBeInParkingLane()`

**Rules (evaluated in order):**
1. If session key matches `agent:*:main` → **never park** (fixed agents)
2. If status is "sleeping" (>30min idle) → **park**
3. If `isActivelyRunning` is true → **don't park**
4. If idle seconds > threshold (default 120s) → **park**

**Configurable:** `idleThresholdSeconds` parameter (default: `DEFAULT_PARKING_IDLE_THRESHOLD = 120`)

### 1.5 Logic Domain: Session Filtering / Visibility

**Where:** `sessionFiltering.ts` → `splitSessionsForDisplay()`

**Pipeline:**
```
All sessions
  ├── shouldBeInParkingLane() = false → Active sessions
  │     ├── Sort by updatedAt desc
  │     ├── Take first maxVisible (15) → visibleSessions
  │     └── Overflow → parkingSessions
  └── shouldBeInParkingLane() = true → parkingSessions
        └── Filter: hide if inactive > parkingExpiryMs (30 min)
```

**Parameters:**
- `idleThreshold`: 120s (when to park)
- `maxVisible`: 15 (cap visible sessions)
- `parkingExpiryMs`: 30 * 60 * 1000 (hide parked after 30min)

### 1.6 Logic Domain: Activity Detection / Bubble Text

**Where:** Two implementations.

| Location | Function | Purpose |
|----------|----------|---------|
| `minionUtils.ts` | `getCurrentActivity()` | General-purpose activity text |
| `World3DView.tsx` | `getActivityText()` | 3D bubble text |

**`getCurrentActivity()` logic:**
```
Parse recent messages → extract latest activity
  If no activities:
    active + <30s idle → "Working..."
    active + >30s → "Ready and listening"
    idle → "Waiting for tasks"
    sleeping → "Sleeping 💤"
  If has activity:
    <10s ago + tool_call → "Working on {tool}..."
    <10s ago + thinking → "Thinking..."
    <10s ago + message → "Active now"
    else → activity text (truncated to 80 chars)
```

**`getActivityText()` logic:**
```
If isActive:
  session.label exists → show label
  Has recent tool_call → "🔧 {toolName}"
  Has thinking block → "💭 Thinking..."
  fallback → "Working..."
If not active:
  → "💤 Idle"
```

### 1.7 Logic Domain: Display Name Resolution

**Where:** `useSessionDisplayNames.ts` (API cache layer) + `minionUtils.ts` → `getSessionDisplayName()`

**Priority chain:**
```
1. Custom name (from display names API / database)
2. session.label (e.g. "crewhub-fix-3d-view")
3. Special case: "agent:main:main" → "Main Agent"
4. Cron pattern → "Cron Worker {id}"
5. Subagent/spawn → generateFriendlyName(key) (from friendlyNames.ts)
6. Last resort → last segment of session key
```

### 1.8 Logic Domain: Room Routing

**Where:** Backend (`routes/rules.py`, `routes/assignments.py`) + Frontend (`useRoomAssignmentRules.ts`)

**Two-layer system:**

**Layer 1: Assignment Rules** (pattern-based, auto-routing)
- Stored in `room_assignment_rules` table
- Types: `keyword`, `model`, `label_pattern`, `session_type`, `session_key_contains`
- Priority-ordered, first match wins
- Evaluated in frontend via `getRoomFromRules()`

**Layer 2: Manual Assignments** (explicit overrides)
- Stored in `session_room_assignments` table
- Direct session_key → room_id mapping
- CRUD via backend API

**Implicit routing** (not in rules system):
- Fixed agents (`agent:*:main`) implied to stay in their room
- Parking is a separate concept from room assignment

### 1.9 Data Flow Diagram

```
                    ┌─────────────────────┐
                    │   OpenClaw Gateway   │
                    │  (session data feed) │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │    CrewSession[]     │
                    │ key, updatedAt,      │
                    │ totalTokens, label,  │
                    │ messages[], model    │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼──────┐  ┌─────▼──────┐  ┌──────▼────────┐
    │ Token Tracking │  │  Status    │  │ Room Rules    │
    │ (useSession    │  │ Detection  │  │ (useRoom      │
    │  Activity)     │  │ (minionU.) │  │  Assignment   │
    │                │  │ (World3D)  │  │  Rules)       │
    │ → isActive     │  │ → status   │  │ → room_id     │
    └───────┬────────┘  └─────┬──────┘  └──────┬────────┘
            │                 │                │
            ▼                 ▼                ▼
    ┌───────────────────────────────────────────────┐
    │              splitSessionsForDisplay()         │
    │   → visibleSessions (in rooms)                │
    │   → parkingSessions (parking lane / hidden)   │
    └───────────────────────┬───────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
    ┌─────────▼──────┐ ┌───▼───────┐ ┌───▼──────────┐
    │ Display Name   │ │ Activity  │ │ Bot Visual   │
    │ Resolution     │ │ Text      │ │ Appearance   │
    │ → label        │ │ → bubble  │ │ → color,     │
    │                │ │           │ │   opacity,   │
    │                │ │           │ │   animation  │
    └────────────────┘ └───────────┘ └──────────────┘
```

### 1.10 Complete Threshold/Constant Reference

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| Active threshold (status) | 5 min | `minionUtils.ts` | `getSessionStatus` |
| Active threshold (3D) | 120s | `World3DView.tsx` | `getAccurateBotStatus` |
| Idle → Sleeping | 30 min | Both | Status transition |
| Sleeping → Offline | 30 min | `World3DView.tsx` only | 3D-specific state |
| Token change window | 30s | `useSessionActivity.ts` | `isActivelyRunning` |
| UpdatedAt freshness | 30s | `useSessionActivity.ts` | `isActivelyRunning` fallback |
| Parking idle threshold | 120s | `minionUtils.ts` | `shouldBeInParkingLane` |
| Parking expiry | 30 min | `sessionFiltering.ts` | Hide from parking lane |
| Max visible sessions | 15 | `sessionFiltering.ts` | Overflow → parking |
| Working text threshold | 30s | `minionUtils.ts` | "Working..." vs "Ready" |
| Activity text threshold | 10s | `minionUtils.ts` | Recent activity display |
| Idle opacity ramp | 60-300s | `minionUtils.ts` | `getIdleOpacity` fade |
| Fixed agent pattern | `agent:*:main` | `minionUtils.ts` | Never park |

---

## 2. Pain Points

### 2.1 Duplicated Logic with Divergent Behavior

The most significant problem: **status determination exists in two places with different thresholds and states.** `getSessionStatus()` considers anything under 5 minutes "active," while `getAccurateBotStatus()` uses 120 seconds. The 3D version has an "offline" state that doesn't exist in the utility version. This isn't just duplication — it's divergence that leads to inconsistent user experience between views.

### 2.2 Hardcoded Thresholds

Every threshold is a magic number in source code:
- 120 seconds for parking is reasonable for fast-spawning subagents but too aggressive for long-running main agents
- 30 minutes for parking expiry hides sessions that might still be relevant
- The 30-second token tracking window works but can't be tuned without code changes
- The idle opacity ramp (60s-300s) is completely arbitrary and non-configurable

There's no way for a user to say "I want my parking threshold to be 5 minutes" without editing TypeScript.

### 2.3 Frontend-Heavy Logic

Almost all decision-making happens in the frontend. This means:
- Every connected client independently computes the same logic
- No way to trigger backend actions based on state transitions (e.g., "when a bot goes offline, clean up its resources")
- Status is ephemeral — refresh the page and all activity tracking resets
- Token tracking (`useSessionActivity`) resets on component mount, losing history

### 2.4 Activity Detection is Fragile

`isActivelyRunning()` depends on polling frequency. If the frontend polls every 5 seconds but a session generates tokens in a 2-second burst, the 30-second window might catch it — or might not, depending on timing. There's no server-sent event or WebSocket push for token changes.

### 2.5 Two Status Systems, Poorly Named

- `getSessionStatus()` returns `"active" | "idle" | "sleeping"` — used for list views
- `getAccurateBotStatus()` returns `"active" | "idle" | "sleeping" | "offline"` (typed as `BotStatus`) — used for 3D

The names suggest the 3D version is "more accurate" (it's literally called that), implying the other is inaccurate. In reality, they serve different contexts but their relationship is unclear.

### 2.6 Room Routing is Disconnected from Status

Room assignment rules and parking logic are independent systems:
- A session can be assigned to Room A via rules, but parking logic might move it to the parking lane
- There's no rule type like "if idle > X seconds, move to Room B"
- Room rules don't consider status at all — they're purely based on session metadata (key, label, model)

### 2.7 No Event-Driven State Transitions

Everything is poll-based. There's no concept of "session X just transitioned from active to idle" as a discrete event. This means:
- No notifications when status changes
- No ability to trigger actions on transitions
- No audit trail of state changes

---

## 3. Node-Based Approach

### 3.1 What Would This Look Like?

A node-based system would model CrewHub's logic as a directed acyclic graph (DAG) where each node transforms or evaluates data:

```
┌────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  SessionInput  │────▶│ TokenTracker │────▶│  StatusResolver  │
│                │     │              │     │                  │
│ key, updatedAt │     │ isActive:    │     │ status:          │
│ totalTokens    │     │ boolean      │     │ active/idle/     │
│ label, model   │     │              │     │ sleeping/offline │
│ messages[]     │     │ Config:      │     │                  │
│                │     │ window: 30s  │     │ Config:          │
│                │     │              │     │ idleThreshold    │
│                │     │              │     │ sleepThreshold   │
└────────────────┘     └──────────────┘     └────────┬────────┘
                                                      │
                              ┌────────────────────────┤
                              │                        │
                    ┌─────────▼──────┐      ┌──────────▼───────┐
                    │  ParkingNode   │      │  ActivityNode    │
                    │                │      │                  │
                    │ shouldPark:    │      │ activityText:    │
                    │ boolean        │      │ string           │
                    │                │      │                  │
                    │ Config:        │      │ Config:          │
                    │ idleThreshold  │      │ recentWindow     │
                    │ fixedPatterns  │      │ workingText      │
                    │                │      │ idleText         │
                    └───────┬────────┘      └──────────────────┘
                            │
                  ┌─────────▼──────────┐
                  │  VisibilityNode    │
                  │                    │
                  │ visible: boolean   │
                  │ lane: room/parking │
                  │                    │
                  │ Config:            │
                  │ maxVisible: 15     │
                  │ expiryMs: 30min    │
                  └───────┬────────────┘
                          │
              ┌───────────┤
              │           │
    ┌─────────▼──────┐  ┌─▼────────────────┐
    │  RoomRouter    │  │ DisplayNameNode  │
    │                │  │                  │
    │ room_id:       │  │ displayName:     │
    │ string         │  │ string           │
    │                │  │                  │
    │ Config:        │  │ Config:          │
    │ rules[]        │  │ priorityChain[]  │
    │ fallback       │  │                  │
    └────────────────┘  └──────────────────┘
```

### 3.2 Node Definitions

#### SessionInputNode
- **Type:** Source
- **Output:** Raw session data
- **Config:** None (data source)

#### TokenTrackerNode
- **Type:** Transform
- **Input:** Session data (totalTokens, updatedAt)
- **Output:** `{ isActivelyRunning: boolean }`
- **Config:** `{ tokenChangeWindow: number, updatedAtWindow: number }`

#### StatusResolverNode
- **Type:** Transform
- **Input:** Session data + isActivelyRunning
- **Output:** `{ status: 'active' | 'idle' | 'sleeping' | 'offline' }`
- **Config:** `{ idleThresholdMs: number, sleepThresholdMs: number, offlineThresholdMs: number }`
- **Replaces:** Both `getSessionStatus()` and `getAccurateBotStatus()`

#### ParkingNode
- **Type:** Decision
- **Input:** Session data + status + isActivelyRunning
- **Output:** `{ shouldPark: boolean }`
- **Config:** `{ idleThresholdSeconds: number, fixedAgentPatterns: string[] }`

#### VisibilityNode
- **Type:** Aggregator
- **Input:** All sessions with parking decisions
- **Output:** `{ visibleSessions[], parkingSessions[] }`
- **Config:** `{ maxVisible: number, parkingExpiryMs: number }`

#### ActivityTextNode
- **Type:** Transform
- **Input:** Session data + status + isActivelyRunning
- **Output:** `{ activityText: string }`
- **Config:** `{ activeTexts: Record, idleTexts: Record, recentWindowMs: number }`

#### DisplayNameNode
- **Type:** Transform
- **Input:** Session data + custom names
- **Output:** `{ displayName: string }`
- **Config:** `{ priorityChain: string[], friendlyNameGenerator: string }`

#### RoomRouterNode
- **Type:** Decision
- **Input:** Session data + metadata
- **Output:** `{ roomId: string | null }`
- **Config:** `{ rules: RoomRule[], fallbackRoomId: string }`

### 3.3 Visual Editor UI

A visual editor would look something like n8n's canvas:
- Nodes as draggable boxes on a canvas
- Connections as lines between output ports and input ports
- Click a node to open its configuration panel (thresholds, patterns, text templates)
- Real-time preview showing how current sessions flow through the pipeline

However, **this is where the analysis gets honest**: building a visual flow editor is a massive UI effort. n8n is a 100+ person project. Node-RED's editor alone is thousands of lines. For CrewHub's needs, a visual editor would be massive overkill.

### 3.4 Where Would It Run?

**Option A: Frontend only** (current approach, but structured)
- Each node is a pure function
- Graph is evaluated on every render/poll cycle
- Config stored in backend, graph definition in code
- ⚠️ Still has the problem of frontend-only state

**Option B: Backend only**
- Backend evaluates the graph on session data changes
- Pushes computed state to frontend via WebSocket
- Frontend becomes a pure renderer
- ⚠️ Adds latency, requires persistent backend state

**Option C: Shared/Hybrid**
- Status determination and room routing in backend (authoritative)
- Activity text and display names in frontend (presentation layer)
- Token tracking needs to be in backend if we want persistence
- ✅ Best separation of concerns but most complex

---

## 4. Alternative Approaches

### 4.1 Simple Config File (YAML/JSON)

```yaml
# crewhub-config.yaml
status:
  thresholds:
    idle_seconds: 120
    sleeping_seconds: 1800
    offline_seconds: 3600

parking:
  idle_threshold_seconds: 120
  expiry_minutes: 30
  max_visible: 15
  fixed_patterns:
    - "^agent:[a-zA-Z0-9_-]+:main$"

activity:
  token_change_window_seconds: 30
  recent_activity_window_seconds: 10
  texts:
    working: "Working..."
    ready: "Ready and listening"
    waiting: "Waiting for tasks"
    sleeping: "Sleeping 💤"

display_names:
  priority:
    - custom_name
    - label
    - special_cases
    - friendly_name
    - key_fallback

opacity:
  ramp:
    - { seconds: 60, opacity: 1.0 }
    - { seconds: 120, opacity: 0.8 }
    - { seconds: 180, opacity: 0.6 }
    - { seconds: 240, opacity: 0.4 }
    - { seconds: 300, opacity: 0.2 }
```

**Pros:**
- Dead simple to implement (load config, replace magic numbers)
- Easy to understand and modify
- No new abstractions or dependencies
- Can be stored in database for runtime editing
- UI: simple settings page with form fields

**Cons:**
- Can't express conditional logic (e.g., "different thresholds for subagents vs main agents")
- No flow visualization
- Doesn't solve the duplication problem (still need to consolidate functions)

**Effort:** 1-2 days

### 4.2 Rule Engine (json-rules-engine)

```json
{
  "rules": [
    {
      "conditions": {
        "all": [
          { "fact": "idleSeconds", "operator": "greaterThan", "value": 120 },
          { "fact": "isFixedAgent", "operator": "equal", "value": false },
          { "fact": "isActivelyRunning", "operator": "equal", "value": false }
        ]
      },
      "event": { "type": "park", "params": { "lane": "parking" } }
    }
  ]
}
```

**Pros:**
- Handles conditional logic well
- Rules can be stored in database and edited at runtime
- json-rules-engine is well-maintained (~3.5k GitHub stars)
- Can express complex conditions without code changes

**Cons:**
- Rules get verbose for simple threshold comparisons
- Performance overhead for rule evaluation (minor at this scale)
- Learning curve for rule syntax
- Still need to wire rules into existing React components
- Overkill for "is this number bigger than 120?"

**Effort:** 3-5 days

### 4.3 State Machine (XState)

```typescript
const botStatusMachine = createMachine({
  id: 'botStatus',
  initial: 'active',
  states: {
    active: {
      after: { 120000: 'idle' },
      on: { TOKEN_CHANGE: 'active' }
    },
    idle: {
      after: { 1680000: 'sleeping' },  // 30min - 2min
      on: { TOKEN_CHANGE: 'active' }
    },
    sleeping: {
      after: { 1800000: 'offline' },
      on: { TOKEN_CHANGE: 'active' }
    },
    offline: {
      on: { TOKEN_CHANGE: 'active' }
    }
  }
});
```

**Pros:**
- Perfect model for status transitions (it IS a state machine)
- XState has excellent visualization tools (Stately.ai)
- Handles transitions, guards, and side effects cleanly
- Can trigger actions on transitions (notifications, cleanup)
- Well-tested library with React integration
- Enables event-driven architecture (solves pain point 2.7)

**Cons:**
- Adds a significant dependency
- Not all CrewHub logic is state-machine-shaped (display names, room routing are not)
- State machines per session means N machines running concurrently
- XState v5 has a learning curve
- Session data comes from polling, not real events — need to synthesize events

**Effort:** 5-8 days

### 4.4 Current Approach, Better Organized

Consolidate without new abstractions:

```
frontend/src/lib/
  sessionLogic/
    status.ts          ← ONE status function, unified thresholds
    parking.ts         ← parking decision logic
    activity.ts        ← activity text generation
    displayName.ts     ← display name resolution (move from hook)
    visibility.ts      ← session filtering
    config.ts          ← ALL thresholds/constants in one place
    index.ts           ← re-exports
```

**What this fixes:**
- Single source of truth for status (eliminate `getAccurateBotStatus` vs `getSessionStatus`)
- All thresholds in `config.ts` (still hardcoded but findable)
- Clear module boundaries
- No new dependencies

**What this doesn't fix:**
- Still not configurable without code changes
- Still frontend-only
- Still poll-based with no event transitions

**Effort:** 0.5-1 day

---

## 5. Recommendation

### The honest assessment

CrewHub manages **5-10 agents**. It's a personal/small-team tool. Let's be real about what matters:

| Criterion | Node-Based | Config File | Rule Engine | State Machine | Reorganize |
|-----------|-----------|-------------|-------------|---------------|------------|
| Solves duplication | ✅ | ✅ | ✅ | ✅ | ✅ |
| Configurable thresholds | ✅ | ✅ | ✅ | ✅ | ❌ |
| Conditional logic | ✅ | ❌ | ✅ | ✅ | ❌ |
| Visual editing | ✅ | ⚠️ simple form | ❌ | ✅ (Stately) | ❌ |
| Event-driven transitions | ✅ | ❌ | ❌ | ✅ | ❌ |
| Implementation effort | 🔴 weeks | 🟢 1-2 days | 🟡 3-5 days | 🟡 5-8 days | 🟢 0.5-1 day |
| Maintenance burden | 🔴 high | 🟢 low | 🟡 medium | 🟡 medium | 🟢 low |
| Appropriate for scale | ❌ | ✅ | ⚠️ | ⚠️ | ✅ |

### Recommended: Phased Approach (Config File + Reorganize → Optional State Machine)

**Phase 1 (do now):** Reorganize + Config File
- Consolidate all logic into `sessionLogic/` module
- Extract ALL thresholds into a single config object
- Store config in database with a simple settings UI page
- Unify `getSessionStatus` and `getAccurateBotStatus` into one function
- **This solves 80% of the pain with 10% of the effort**

**Phase 2 (do if needed):** State Machine for Status
- If you find yourself wanting event-driven transitions (notifications, auto-cleanup, status change history), add XState for the bot status domain ONLY
- Keep everything else as config + functions
- **Don't do this unless you have a concrete use case that requires it**

**Phase 3 (probably never):** Node-Based Visual Editor
- Only build this if CrewHub grows to serve multiple teams with different workflows
- At 5-10 agents with one admin, a settings page is better than a flow editor
- **If you ever need this, consider embedding an existing solution (like n8n) rather than building one**

### Why NOT node-based (right now)?

1. **Audience mismatch:** Node-based systems shine when non-technical users need to configure complex workflows. CrewHub's admin is a developer. A config file or settings page is faster to use than a visual editor.

2. **Complexity doesn't warrant it:** The logic graph has ~7 nodes with mostly linear flow. There's one branch (parking vs visible) and one parallel path (display name). This is not a complex enough graph to justify visual editing.

3. **Build cost vs value:** A proper node editor (drag-and-drop, connection validation, real-time preview, save/load, undo/redo) is easily 2-4 weeks of development. For the ability to change "120" to "180"? That's a settings page.

4. **Maintenance cost:** A custom node system needs its own testing, documentation, and onboarding. Every new logic domain needs a new node type. This is permanent overhead.

5. **The configs are simple:** Most of what's hardcoded is numeric thresholds and string patterns. A flat config object handles this perfectly. The conditional logic (fixed agent patterns, rule matching) is already well-structured in the room assignment rules system.

---

## 6. Implementation Plan

### Phase 1: Consolidate + Config (Recommended)

**Step 1: Create unified config** (2 hours)

```typescript
// frontend/src/lib/sessionLogic/config.ts

export interface CrewHubSessionConfig {
  status: {
    activeThresholdMs: number    // default: 120_000 (2 min)
    sleepThresholdMs: number     // default: 1_800_000 (30 min)
    offlineThresholdMs: number   // default: 3_600_000 (1 hour)
  }
  parking: {
    idleThresholdSeconds: number // default: 120
    expiryMs: number             // default: 1_800_000 (30 min)
    maxVisible: number           // default: 15
    fixedAgentPatterns: string[] // default: ["^agent:[a-zA-Z0-9_-]+:main$"]
  }
  activity: {
    tokenChangeWindowMs: number  // default: 30_000
    updatedAtWindowMs: number    // default: 30_000
    recentWindowMs: number       // default: 10_000
  }
  opacity: {
    ramp: Array<{ seconds: number; opacity: number }>
  }
}

export const DEFAULT_CONFIG: CrewHubSessionConfig = {
  // ... defaults matching current behavior
}
```

**Step 2: Consolidate logic modules** (4 hours)

Create `frontend/src/lib/sessionLogic/`:
- `config.ts` — Config type + defaults
- `status.ts` — Single `getStatus()` replacing both versions
- `parking.ts` — `shouldPark()` consuming config
- `activity.ts` — `getActivityText()` unified
- `visibility.ts` — `splitSessions()` consuming config
- `displayName.ts` — `getDisplayName()` consolidated
- `index.ts` — Public API

**Step 3: Backend config endpoint** (2 hours)

```python
# GET /api/config → returns config
# PUT /api/config → updates config
# Stored in SQLite settings table
```

**Step 4: Settings UI** (4 hours)

Simple form page in CrewHub settings:
- Slider/number inputs for thresholds
- Pattern list editor for fixed agents
- Preview showing "with these settings, here's how your current sessions would be classified"

**Step 5: Wire up + remove old code** (2 hours)

Replace all direct references to old functions. Delete duplicates.

**Total: ~2 days of focused work**

### Phase 2: State Machine (If Needed)

Only pursue if you need:
- Status change notifications ("Bot X went offline")
- Transition-triggered actions
- Status history/audit trail

**Steps:**
1. Install XState v5
2. Create `botStatusMachine` with configurable thresholds from Phase 1 config
3. Create `useSessionStateMachine` hook that manages per-session machine instances
4. Feed poll results as events into machines
5. Subscribe to transitions for side effects

**Estimated: 5-8 days**

---

## 7. Risks & Trade-offs

### Phase 1 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Changing thresholds breaks existing behavior | Medium | Low | Keep defaults identical to current values |
| Config migration (if schema changes) | Low | Low | Version the config schema |
| Settings UI adds maintenance surface | Low | Low | Keep it simple — no visual preview in v1 |
| Consolidation introduces bugs | Medium | Medium | Test with current sessions before deploying |

### Phase 2 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| XState adds bundle size (~15KB gzipped) | Certain | Low | Acceptable for the functionality |
| Memory overhead for N state machines | Low | Low | At 5-10 sessions, negligible |
| Synthesized events from polling may miss transitions | Medium | Medium | Use short poll intervals or WebSocket |
| Team unfamiliar with XState concepts | Medium | Medium | Good docs, keep machines simple |

### Node-Based Risks (if pursued)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Massive scope creep building editor UI | High | High | Use existing library (reactflow) |
| Over-engineering for the scale | High | High | Don't build it |
| Performance overhead of graph evaluation | Low | Low | DAG with 7 nodes is fast |
| Serialization complexity | Medium | Medium | Use a schema like n8n's workflow JSON |
| Testing graph configurations | Medium | High | Need graph simulation/testing tools |

### The Meta-Risk: Premature Abstraction

The biggest risk is spending a week building infrastructure for flexibility you don't need. CrewHub has **one admin** who can edit TypeScript. The current system works — it's just messy. Clean it up, make the thresholds configurable, and move on. If three months from now you're constantly editing thresholds, then invest in better tooling.

---

## Summary

| Approach | Verdict |
|----------|---------|
| **Node-based flow system** | ❌ Over-engineered for CrewHub's scale. Cool idea, wrong context. |
| **Config file + consolidation** | ✅ **Recommended.** Solves real problems with minimal effort. |
| **Rule engine** | ⚠️ Viable but adds dependency for simple threshold logic. |
| **State machine (XState)** | ⚠️ Great fit for status transitions only. Consider for Phase 2. |
| **Just reorganize** | ✅ Minimum viable improvement. Do this at least. |

**Bottom line:** Consolidate the scattered logic into one module, extract thresholds into a config object, add a simple settings page. That's the 80/20 solution. Save the visual flow editor for when you have 50+ agents and a team that needs self-service configuration.
