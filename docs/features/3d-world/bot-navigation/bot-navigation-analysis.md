# Bot Navigation to Props via Voice Commands — Technical Analysis

*Version: 1.0 — 2026-02-11*
*Feature: v0.18.0*
*Status: ANALYSIS*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current System Audit](#2-current-system-audit)
3. [Architecture Design](#3-architecture-design)
4. [Natural Language Prop Resolution](#4-natural-language-prop-resolution)
5. [Navigation System Design](#5-navigation-system-design)
6. [Animation State Machine Extension](#6-animation-state-machine-extension)
7. [Backend API Design](#7-backend-api-design)
8. [Frontend Implementation](#8-frontend-implementation)
9. [Integration with Spatial Awareness](#9-integration-with-spatial-awareness)
10. [Technical Challenges & Solutions](#10-technical-challenges--solutions)
11. [User Experience Design](#11-user-experience-design)
12. [Phased Rollout Plan](#12-phased-rollout-plan)
13. [Testing Strategy](#13-testing-strategy)
14. [Risk Assessment](#14-risk-assessment)
15. [Appendix: API Reference Draft](#appendix-api-reference-draft)

---

## 1. Executive Summary

**Feature:** Allow users to instruct bots to walk to specific props in their 3D room via natural language commands (e.g., "walk to the server rack", "go check the whiteboard").

**Why it matters:** This bridges the gap between the 3D visual world and bot intelligence. Bots currently wander aimlessly or follow hardcoded animation patterns. With prop navigation, bots become spatially-aware agents that respond to commands by physically moving in the 3D world — making the experience feel alive and interactive.

**Key insight from codebase analysis:** The foundation is remarkably solid. We already have:
- ✅ A* pathfinding on the 20×20 grid (`pathfinding.ts`)
- ✅ Grid-based walkable masks with obstacle avoidance
- ✅ Bot movement system with grid-aware direction picking (`Bot3D.tsx`)
- ✅ Interaction point targeting (coffee, sleep) with arrival detection
- ✅ Spatial awareness design with zone-based prop identification (v0.14.0 design)
- ✅ Blueprint JSON format with prop placements and IDs
- ✅ Context envelope injection for bot awareness

**Estimated effort:** 8-12 days across 4 phases.

---

## 2. Current System Audit

### 2.1 What Already Exists

| Component | Status | File | Relevance |
|-----------|--------|------|-----------|
| A* pathfinding | ✅ Complete | `lib/grid/pathfinding.ts` | **Direct reuse** — 8-directional, diagonal-safe, octile heuristic |
| Walkable mask generation | ✅ Complete | `lib/grid/blueprintUtils.ts` | Bot-specific mask (doors blocked) already in Bot3D |
| Bot movement engine | ✅ Complete | `Bot3D.tsx` useFrame loop | Grid-aware wandering with cell-by-cell movement |
| Animation state machine | ✅ Complete | `BotAnimations.tsx` | Phases: idle-wandering, getting-coffee, sleeping-walking, sleeping, offline |
| Interaction point targeting | ✅ Complete | `BotAnimations.tsx` | Coffee machine & sleep corner targeting with arrival detection |
| Prop registry | ✅ Complete | `PropRegistry.tsx` | 46 props with IDs, mount types, categories |
| Blueprint JSON format | ✅ Complete | `lib/grid/blueprints/*.json` | Prop placements with IDs, positions, spans |
| Spatial awareness design | ✅ Designed | `docs/features/3d-world/spatial-awareness/` | Zone-based positions, context envelope integration |
| Context envelope | ✅ Complete | `backend/services/context_envelope.py` | Room/project/task injection into bot preamble |
| SSE event system | ✅ Complete | `backend/routes/sse.py` | Real-time frontend updates |
| Chat API | ✅ Complete | `backend/routes/chat.py` | Message send/receive for agents |

### 2.2 Key Code Patterns to Extend

**Bot3D.tsx movement engine (line ~230):**
The current system uses `wanderState` ref with `targetX`/`targetZ` and cell-by-cell movement. Bots pick a direction, walk N cells, pause, repeat. For targeting (coffee/sleep), the `AnimState` provides `targetX`/`targetZ` and the movement engine walks toward it using grid-aware direction selection.

**Critical pattern — how coffee machine targeting works today:**
```
1. Status changes to 'idle'
2. useBotAnimation() sets anim.phase = 'getting-coffee'
3. anim.targetX/targetZ = coffee machine world position
4. anim.freezeWhenArrived = true
5. Bot3D useFrame loop walks toward target using grid-aware movement
6. When distance < threshold → anim.arrived = true
7. tickAnimState() detects arrival, runs coffee timer
8. After timer → transitions to 'idle-wandering'
```

This is **exactly the pattern we need** for prop navigation. The new feature extends this existing mechanism with:
- External trigger (user command via chat) instead of automatic status-based trigger
- Prop name resolution instead of hardcoded interaction point
- New animation phase for the walk + arrival behavior

### 2.3 Gaps to Fill

| Gap | Description | Effort |
|-----|-------------|--------|
| Prop name → grid position | No lookup from prop name to grid coordinates | Low — data exists in blueprints |
| Navigation command parsing | No way to detect "walk to X" in chat messages | Medium — backend NLP or keyword match |
| SSE navigation event | No `bot_navigate` event type | Low — add to existing SSE system |
| Navigation animation phase | No `navigating-to-prop` phase in state machine | Medium — extend BotAnimations |
| Arrival behavior | No "arrived at prop" behavior | Low — similar to coffee arrival |
| Backend prop lookup | Backend can't query room props yet | Medium — depends on spatial awareness impl |

---

## 3. Architecture Design

### 3.1 High-Level Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                         NAVIGATION FLOW                               │
│                                                                       │
│  User: "Walk to the server rack"                                      │
│    │                                                                  │
│    ▼                                                                  │
│  ┌─────────────────────────────────┐                                  │
│  │ 1. Chat Message Processing     │                                   │
│  │    Backend receives message     │                                   │
│  │    Agent processes via LLM      │                                   │
│  │    LLM decides to navigate      │                                   │
│  └──────────────┬──────────────────┘                                  │
│                 │                                                      │
│                 ▼                                                      │
│  ┌─────────────────────────────────┐                                  │
│  │ 2. Skill/Tool Call              │                                   │
│  │    navigate_to("server rack")   │                                   │
│  │    or auto-detected from text   │                                   │
│  └──────────────┬──────────────────┘                                  │
│                 │                                                      │
│                 ▼                                                      │
│  ┌─────────────────────────────────┐                                  │
│  │ 3. Prop Resolution (Backend)   │                                   │
│  │    "server rack" → server-rack │                                   │
│  │    server-rack @ grid (17,14)  │                                   │
│  │    Room: Dev Room              │                                   │
│  └──────────────┬──────────────────┘                                  │
│                 │                                                      │
│                 ▼                                                      │
│  ┌─────────────────────────────────┐                                  │
│  │ 4. Navigation Target Calc      │                                   │
│  │    Find walkable cell adjacent  │                                   │
│  │    to prop (not ON prop)        │                                   │
│  │    Target: grid (16, 14)        │                                   │
│  └──────────────┬──────────────────┘                                  │
│                 │                                                      │
│                 ▼                                                      │
│  ┌─────────────────────────────────┐                                  │
│  │ 5. SSE Event Broadcast         │                                   │
│  │    bot_navigate {               │                                   │
│  │      sessionKey, roomId,        │                                   │
│  │      targetGrid: [16, 14],      │                                   │
│  │      propId: "server-rack",     │                                   │
│  │      propName: "server rack"    │                                   │
│  │    }                            │                                   │
│  └──────────────┬──────────────────┘                                  │
│                 │                                                      │
│                 ▼                                                      │
│  ┌─────────────────────────────────┐                                  │
│  │ 6. Frontend Animation          │                                   │
│  │    Bot3D receives SSE event     │                                   │
│  │    Sets navigating-to-prop      │                                   │
│  │    A* pathfinding to target     │                                   │
│  │    Walk animation along path    │                                   │
│  │    Arrive → face prop           │                                   │
│  └─────────────────────────────────┘                                  │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Architecture Decision: Where Does Pathfinding Run?

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A: Frontend only** | Backend sends target grid coords, frontend pathfinds + animates | ✅ No backend perf cost, ✅ smooth animations, ✅ reuses existing A* | ❌ Backend can't validate path exists |
| **B: Backend pathfinds, frontend animates** | Backend computes full path, sends waypoints, frontend lerps | ✅ Validated paths, ✅ "path not found" error upfront | ❌ Backend needs grid data, ❌ more data in SSE |
| **C: Hybrid** | Backend validates target reachability, frontend pathfinds | ✅ Best of both | ❌ Slight complexity |

**✅ Recommendation: Option A (Frontend only)**

**Why:**
1. Frontend already has A* pathfinding (`findPath`) and walkable masks — no duplication needed
2. Bot3D already does grid-aware movement toward targets — the mechanism is proven
3. Backend doesn't have grid data yet (spatial awareness v0.14.0 stores prop positions, not full walkable grids)
4. SSE payload stays tiny (just target coords, not full path)
5. If pathfinding fails on frontend, bot stays put and we can show an error indicator

The backend's role is limited to: resolve prop name → grid position → find nearest walkable cell adjacent to prop → broadcast SSE event.

### 3.3 Component Responsibilities

```
BACKEND                              FRONTEND
┌──────────────────────┐             ┌──────────────────────────────┐
│ PropLookupService    │             │ NavigationController         │
│  - fuzzy name match  │             │  - Receives SSE event        │
│  - room-scoped query │  ──SSE──▶  │  - Resolves to world coords  │
│  - walkable neighbor │             │  - Triggers animation phase  │
│                      │             │                              │
│ NavigationEndpoint   │             │ Bot3D (extended)             │
│  - POST /navigate    │             │  - A* pathfinding            │
│  - validate + resolve│             │  - Path-following movement   │
│  - broadcast SSE     │             │  - Arrival detection         │
│                      │             │  - Face-prop on arrival      │
│ ContextEnvelope      │             │                              │
│  - room.layout       │             │ BotAnimations (extended)     │
│  - enables LLM       │             │  - 'navigating-to-prop'      │
│    awareness          │             │  - 'arrived-at-prop'         │
└──────────────────────┘             └──────────────────────────────┘
```

---

## 4. Natural Language Prop Resolution

### 4.1 The Challenge

Users will say things like:
- "Walk to the server rack" → `server-rack`
- "Go check the whiteboard" → `whiteboard`
- "Head to my desk" → `standing-desk-with-monitor` (which one?)
- "Go to the coffee machine" → `coffee-machine`
- "Walk over to that thing in the corner" → ???

### 4.2 Resolution Strategy: Two-Layer Approach

**Layer 1: LLM-Powered (via context envelope)**
The bot already receives the room layout summary in its context envelope (spatial awareness v0.14.0):
```
Layout: 2 standing-desks (W, E walls), server-rack (SE corner), whiteboard (N wall). Door: south.
```
The LLM can naturally extract the prop name and call `navigate_to("server-rack")`.

**Layer 2: Fuzzy Backend Matching (for the skill call)**
When the bot calls `navigate_to("server rack")`, the backend needs to match the free-text input to a propId in the blueprint.

### 4.3 Prop Name Matching Algorithm

```python
def resolve_prop(query: str, room_props: list[dict]) -> dict | None:
    """
    Resolve a natural language prop name to a specific prop placement.
    
    Strategy:
    1. Exact propId match (e.g., "server-rack" → server-rack)
    2. Normalized match (strip hyphens, lowercase)
    3. Partial/substring match (e.g., "server" → server-rack)
    4. Word overlap scoring (e.g., "standing desk" → standing-desk-with-monitor)
    5. Zone-qualified match (e.g., "desk on the west wall" → standing-desk @ zone W)
    
    Returns best match or None.
    """
    query_normalized = query.lower().strip()
    query_words = set(re.split(r'[\s\-_]+', query_normalized))
    
    candidates = []
    for prop in room_props:
        prop_id = prop['propId']
        prop_words = set(re.split(r'[\s\-_]+', prop_id.lower()))
        
        # Exact match
        if query_normalized == prop_id.lower():
            return prop  # Perfect match, return immediately
        
        # Normalized match (remove hyphens, underscores)
        if query_normalized.replace(' ', '-') == prop_id.lower():
            return prop
        
        # Word overlap score
        overlap = len(query_words & prop_words)
        if overlap > 0:
            # Score: overlap count / max(query words, prop words) for precision
            score = overlap / max(len(query_words), len(prop_words))
            candidates.append((score, prop))
    
    # Return highest scoring candidate above threshold
    if candidates:
        candidates.sort(key=lambda x: x[0], reverse=True)
        best_score, best_prop = candidates[0]
        if best_score >= 0.3:  # At least 30% word overlap
            return best_prop
    
    return None
```

### 4.4 Ambiguity Resolution

When multiple props match (e.g., 2 "standing-desk-with-monitor"):

**Strategy 1: Zone qualification**
If the query includes directional words ("west", "left", "far", "near"), use zone to disambiguate:
- "desk on the west wall" → standing-desk @ zone W
- "the other desk" → standing-desk @ zone E (the one NOT closest to bot)

**Strategy 2: Nearest prop**
Default: pick the closest matching prop to the bot's current position.

**Strategy 3: Indexed naming**
In the layout summary, duplicate props get indices: "standing-desk-1 (W wall), standing-desk-2 (E wall)". The LLM can reference these.

### 4.5 Special Targets

Beyond props, support navigation to:
- **"door"** → door position (allow bot to stand near door)
- **"center"** → walkable center of room
- **"corner"** → nearest room corner (NW, NE, SW, SE)
- **Zone names** → "go to the north wall area"

---

## 5. Navigation System Design

### 5.1 Path-Following vs Direct Walk

**Current system (Bot3D):** Picks a cardinal/diagonal direction toward target, walks cell-by-cell, re-evaluates direction each cell. This is "greedy" pathfinding — works for short distances in open areas but gets stuck on obstacles.

**New system needed:** Full A* path → follow waypoints sequentially. This ensures bots navigate around furniture correctly.

### 5.2 Navigation Controller (Frontend)

```typescript
// lib/navigation/NavigationController.ts

export interface NavigationRequest {
  sessionKey: string
  roomId: string
  targetGrid: { x: number; z: number }
  propId?: string
  propName?: string
}

export interface NavigationState {
  status: 'idle' | 'pathfinding' | 'walking' | 'arrived' | 'failed'
  path: PathNode[] | null          // A* computed path
  currentPathIndex: number          // Which waypoint we're at
  targetPropId: string | null
  targetPropName: string | null
  arrivalTime: number | null        // When bot arrived (for idle-at-prop timer)
}

/**
 * Compute navigation path and return waypoints in world coordinates.
 */
export function computeNavigationPath(
  blueprint: RoomBlueprint,
  botGridPos: { x: number; z: number },
  targetGrid: { x: number; z: number },
): PathNode[] | null {
  const walkableMask = getWalkableMask(blueprint.cells)
  
  // Make door cells non-walkable for bots
  const botMask = blueprint.cells.map(row =>
    row.map(cell => cell.walkable && cell.type !== 'door')
  )
  
  return findPath(botMask, botGridPos, targetGrid)
}
```

### 5.3 Path-Following in Bot3D useFrame

The key change to Bot3D: when a navigation request is active, instead of random wandering or greedy target-seeking, follow the A* path waypoint by waypoint.

```typescript
// In Bot3D useFrame loop — new navigation mode:

if (anim.phase === 'navigating-to-prop' && navState.path) {
  const path = navState.path
  const idx = navState.currentPathIndex
  
  if (idx >= path.length) {
    // Arrived at final waypoint
    anim.arrived = true
    navState.status = 'arrived'
    return
  }
  
  // Current waypoint in world coords
  const waypoint = gridToWorld(path[idx].x, path[idx].z, cellSize, gridWidth, gridDepth)
  const wpWorldX = roomCenterX + waypoint[0]
  const wpWorldZ = roomCenterZ + waypoint[2]
  
  // Move toward waypoint
  const dx = wpWorldX - state.currentX
  const dz = wpWorldZ - state.currentZ
  const dist = Math.sqrt(dx * dx + dz * dz)
  
  if (dist < 0.05) {
    // Reached waypoint, advance to next
    navState.currentPathIndex++
    state.currentX = wpWorldX
    state.currentZ = wpWorldZ
  } else {
    // Move toward waypoint
    const speed = anim.walkSpeed * delta
    const step = Math.min(speed, dist)
    state.currentX += (dx / dist) * step
    state.currentZ += (dz / dist) * step
    
    // Rotate to face movement direction
    const targetAngle = Math.atan2(dx, dz)
    // Smooth rotation...
  }
}
```

### 5.4 Finding Walkable Cell Adjacent to Prop

Props occupy grid cells that are **not walkable**. The bot needs to navigate to a walkable cell **adjacent** to the prop, then face toward it.

```typescript
/**
 * Find the best walkable cell adjacent to a prop placement.
 * Prefers cells that face the "front" of the prop (interaction side).
 */
export function findPropApproachCell(
  blueprint: RoomBlueprint,
  propPlacement: PropPlacement,
): PathNode | null {
  const { x, z, span } = propPlacement
  const w = span?.w ?? 1
  const d = span?.d ?? 1
  const botMask = blueprint.cells.map(row =>
    row.map(cell => cell.walkable && cell.type !== 'door')
  )
  
  // Collect all walkable cells adjacent to the prop's footprint
  const candidates: PathNode[] = []
  for (let px = x; px < x + w; px++) {
    for (let pz = z; pz < z + d; pz++) {
      // Check 4 cardinal neighbors
      for (const [dx, dz] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const nx = px + dx
        const nz = pz + dz
        if (nx >= 0 && nx < blueprint.gridWidth && nz >= 0 && nz < blueprint.gridDepth) {
          if (botMask[nz][nx]) {
            candidates.push({ x: nx, z: nz })
          }
        }
      }
    }
  }
  
  if (candidates.length === 0) return null
  
  // Prefer cells that are toward the room center (more accessible)
  const cx = blueprint.walkableCenter.x
  const cz = blueprint.walkableCenter.z
  candidates.sort((a, b) => {
    const distA = Math.abs(a.x - cx) + Math.abs(a.z - cz)
    const distB = Math.abs(b.x - cx) + Math.abs(b.z - cz)
    return distA - distB
  })
  
  return candidates[0]
}
```

---

## 6. Animation State Machine Extension

### 6.1 New Animation Phases

```typescript
export type BotAnimState =
  | 'idle-wandering'
  | 'getting-coffee'
  | 'sleeping-walking'
  | 'sleeping'
  | 'offline'
  // New navigation phases:
  | 'navigating-to-prop'     // Walking along A* path to a prop
  | 'arrived-at-prop'        // Standing at prop, facing it
```

### 6.2 AnimState Extensions

```typescript
export interface AnimState {
  // ... existing fields ...
  
  // Navigation state
  isNavigating: boolean               // true when following a navigation command
  navigationPath: PathNode[] | null   // A* path waypoints (grid coords)
  navigationPathIndex: number          // Current waypoint index
  navigationPropId: string | null      // Target prop ID
  navigationPropName: string | null    // Display name for activity bubble
  navigationArrivalTimer: number       // Seconds to idle at prop before resuming normal behavior
  navigationFaceDirection: number      // Angle to face when arrived (toward prop)
}
```

### 6.3 Phase Transition Rules

```
┌────────────────┐     navigate_to()      ┌─────────────────────┐
│ idle-wandering │ ──────────────────────▶ │ navigating-to-prop  │
│ getting-coffee │                         │                     │
│ sleeping       │                         │ - Follow A* path    │
└────────────────┘                         │ - Walk animation    │
                                           │ - Purpose glow      │
                                           └──────────┬──────────┘
                                                      │ arrived
                                                      ▼
                                           ┌─────────────────────┐
                                           │ arrived-at-prop     │
                                           │                     │
                                           │ - Face prop         │
                                           │ - Idle animation    │
                                           │ - Activity bubble:  │
                                           │   "At server rack"  │
                                           │ - Timer: 5-15s      │
                                           └──────────┬──────────┘
                                                      │ timer expires
                                                      ▼
                                           ┌─────────────────────┐
                                           │ idle-wandering      │
                                           │ (resume normal)     │
                                           └─────────────────────┘
```

### 6.4 Navigation Can Be Interrupted

If a new navigation command arrives while navigating:
- Cancel current path
- Start new navigation immediately

If bot status changes (e.g., goes offline):
- Cancel navigation
- Apply normal status-based behavior

### 6.5 Visual Feedback During Navigation

- **Walk speed:** Slightly faster than idle wander (purposeful walk) — 0.7 vs 0.5
- **Activity bubble:** "🚶 Walking to server rack..."
- **Optional destination marker:** Subtle glow/ring at target position (can be Phase 2)
- **Arrival behavior:** Bot turns to face the prop, brief "looking at it" pose

---

## 7. Backend API Design

### 7.1 Navigation Endpoint

```
POST /api/rooms/{room_id}/navigate
```

**Request:**
```json
{
  "session_key": "agent:dev:main",
  "target": "server rack",
  "target_type": "prop"           // "prop" | "zone" | "position"
}
```

**Response (success):**
```json
{
  "status": "navigating",
  "resolved_prop": {
    "propId": "server-rack",
    "displayName": "server rack",
    "grid": [17, 14],
    "zone": "se",
    "approach_cell": [16, 14]
  },
  "message": "Walking to server rack in the southeast corner."
}
```

**Response (prop not found):**
```json
{
  "status": "error",
  "error": "prop_not_found",
  "message": "I can't find a 'coffee table' in this room. Available props: standing-desk (×2), server-rack, whiteboard.",
  "available_props": ["standing-desk", "server-rack", "whiteboard"]
}
```

**Response (ambiguous):**
```json
{
  "status": "error",
  "error": "ambiguous_prop",
  "message": "There are 2 standing desks. Did you mean the one on the west wall or the east wall?",
  "matches": [
    { "propId": "standing-desk-with-monitor", "zone": "w", "grid": [2, 8] },
    { "propId": "standing-desk-with-monitor", "zone": "e", "grid": [16, 5] }
  ]
}
```

### 7.2 SSE Navigation Event

When navigation is resolved, backend broadcasts:

```json
{
  "type": "bot_navigate",
  "data": {
    "session_key": "agent:dev:main",
    "room_id": "room-abc",
    "target_grid": { "x": 16, "z": 14 },
    "prop_id": "server-rack",
    "prop_name": "server rack",
    "zone": "se"
  }
}
```

### 7.3 Navigation Cancel Event

```json
{
  "type": "bot_navigate_cancel",
  "data": {
    "session_key": "agent:dev:main",
    "room_id": "room-abc"
  }
}
```

### 7.4 Backend Implementation

```python
# backend/app/routes/navigation.py

@router.post("/api/rooms/{room_id}/navigate")
async def navigate_bot(room_id: str, request: NavigateRequest):
    """Navigate a bot to a prop or location in its room."""
    
    # 1. Get room + blueprint data
    room = await get_room(room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    
    blueprint_data = await get_room_blueprint(room_id)
    if not blueprint_data:
        raise HTTPException(404, "No blueprint data for room")
    
    props = blueprint_data.get("placements", [])
    
    # 2. Resolve target
    if request.target_type == "prop":
        match = resolve_prop(request.target, props)
        if not match:
            available = list(set(p["propId"] for p in props if not p["propId"].startswith("work-point")))
            return NavigateResponse(
                status="error",
                error="prop_not_found",
                message=f"Can't find '{request.target}'. Available: {', '.join(available)}",
                available_props=available,
            )
        
        # 3. Find approach cell (walkable cell adjacent to prop)
        approach = find_approach_cell(blueprint_data, match)
        if not approach:
            return NavigateResponse(
                status="error",
                error="unreachable",
                message=f"Can't reach {match['propId']} — no walkable space nearby.",
            )
        
        # 4. Broadcast SSE event
        await sse_manager.broadcast({
            "type": "bot_navigate",
            "data": {
                "session_key": request.session_key,
                "room_id": room_id,
                "target_grid": {"x": approach["x"], "z": approach["z"]},
                "prop_id": match["propId"],
                "prop_name": request.target,
                "zone": grid_to_zone(match["x"], match["z"]),
            }
        })
        
        return NavigateResponse(
            status="navigating",
            resolved_prop=match,
            message=f"Walking to {match['propId']}.",
        )
```

### 7.5 Integration with Spatial Awareness (v0.14.0)

This feature **depends on** the spatial awareness backend work from v0.14.0:
- `GET /api/rooms/{room_id}/props` — needed for prop resolution
- Blueprint data in backend DB — needed for approach cell calculation
- Context envelope layout summary — needed for LLM awareness

**If v0.14.0 is not yet implemented:** We can bootstrap by having the frontend send prop data along with navigation requests (frontend already has full blueprint data). The backend simply forwards the resolution to SSE. This avoids blocking on v0.14.0.

---

## 8. Frontend Implementation

### 8.1 Navigation Event Handler

```typescript
// hooks/useNavigationEvents.ts

export function useNavigationEvents() {
  const navigationStore = useRef(new Map<string, NavigationState>())
  
  useEffect(() => {
    const handler = (event: SSEEvent) => {
      if (event.type === 'bot_navigate') {
        const { session_key, target_grid, prop_id, prop_name } = event.data
        navigationStore.current.set(session_key, {
          status: 'pending',
          targetGrid: target_grid,
          propId: prop_id,
          propName: prop_name,
          path: null,
          currentPathIndex: 0,
          arrivalTime: null,
        })
      }
      if (event.type === 'bot_navigate_cancel') {
        navigationStore.current.delete(event.data.session_key)
      }
    }
    
    sseManager.on('bot_navigate', handler)
    sseManager.on('bot_navigate_cancel', handler)
    return () => {
      sseManager.off('bot_navigate', handler)
      sseManager.off('bot_navigate_cancel', handler)
    }
  }, [])
  
  return navigationStore
}
```

### 8.2 Bot3D Integration

The Bot3D component needs to:
1. Check if there's a pending navigation request for this bot
2. Compute A* path from current position to target
3. Enter `navigating-to-prop` animation phase
4. Follow path waypoint by waypoint
5. Detect arrival and enter `arrived-at-prop` phase

Key changes to `Bot3D.tsx`:

```typescript
// Inside Bot3D component:

// Access navigation store
const navigationStore = useNavigationStore()

// In useFrame:
const navRequest = navigationStore.get(session?.key)
if (navRequest && navRequest.status === 'pending') {
  // Compute path
  const botGrid = worldToGrid(
    state.currentX - roomCenterX,
    state.currentZ - roomCenterZ,
    cellSize, gridWidth, gridDepth,
  )
  const path = findPath(gridData.botWalkableMask, botGrid, navRequest.targetGrid)
  
  if (path) {
    navRequest.path = path
    navRequest.currentPathIndex = 1  // Skip first node (current position)
    navRequest.status = 'walking'
    
    // Trigger animation phase change
    anim.phase = 'navigating-to-prop'
    anim.isNavigating = true
    anim.walkSpeed = 0.7  // Purposeful walk
    anim.freezeWhenArrived = true
    anim.arrived = false
  } else {
    navRequest.status = 'failed'
    // Show error indicator?
  }
}

// Path following (when navigating):
if (anim.phase === 'navigating-to-prop' && navRequest?.path) {
  // [Path following code from Section 5.3]
}
```

### 8.3 Activity Bubble Integration

The `BotActivityBubble` component already shows floating text above bots. During navigation:

```typescript
// In Bot3D, derive activity text:
const getActivity = () => {
  if (anim.phase === 'navigating-to-prop') {
    return `🚶 Walking to ${navRequest?.propName || 'prop'}...`
  }
  if (anim.phase === 'arrived-at-prop') {
    return `📍 At ${navRequest?.propName || 'prop'}`
  }
  return activity // original activity
}
```

### 8.4 Destination Marker (Optional, Phase 2)

A subtle visual indicator at the target position:

```typescript
function DestinationMarker({ position, visible }: { position: [number, number, number]; visible: boolean }) {
  const ringRef = useRef<THREE.Mesh>(null)
  
  useFrame(({ clock }) => {
    if (!ringRef.current || !visible) return
    ringRef.current.rotation.y = clock.getElapsedTime()
    ringRef.current.material.opacity = 0.3 + Math.sin(clock.getElapsedTime() * 2) * 0.15
  })
  
  if (!visible) return null
  
  return (
    <mesh ref={ringRef} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.2, 0.3, 16]} />
      <meshBasicMaterial color="#4CAF50" transparent opacity={0.4} side={THREE.DoubleSide} />
    </mesh>
  )
}
```

---

## 9. Integration with Spatial Awareness

### 9.1 Dependency on v0.14.0

The spatial awareness design (already documented) provides:

1. **Context envelope layout summary** — Bots know what's in their room via natural language
2. **`GET /api/rooms/{room_id}/props`** — Prop list with zones and grid positions
3. **Zone-based positioning** — Natural language-friendly prop locations

**For navigation, we specifically need:**
- Prop ID → grid coordinates mapping (from blueprint placements)
- Zone labels for human-readable directions
- Layout summary in context envelope (so LLM can decide to navigate)

### 9.2 Skill Integration

The spatial awareness design already spec'd a `navigate_to` function in the `crewhub_spatial` skill. We implement this exactly:

```yaml
navigate_to:
  description: "Walk your bot to a prop or zone. Triggers movement animation in the 3D world."
  parameters:
    target: "string — prop name or zone (e.g. 'server-rack', 'center', 'door')"
  returns: "string — 'Moving to server-rack (SE corner)' or 'Target not found'"
```

The skill handler calls `POST /api/rooms/{room_id}/navigate` and returns the result to the LLM.

### 9.3 Auto-Navigation (Future Enhancement)

In Phase 4, bots could auto-navigate when they "mention" a prop:
- Bot says "Let me check the server rack" → auto-trigger navigation
- Requires NLP detection in the response text
- Should be toggleable (might be annoying if too aggressive)

---

## 10. Technical Challenges & Solutions

### 10.1 Multi-Word Prop Names

**Problem:** "coffee machine" vs "machine" vs "coffee". Users use partial names.

**Solution:** Word overlap scoring (Section 4.3). "coffee" matches "coffee-machine" with score 0.5 (1/2 words). "machine" also matches with 0.5. Ties broken by: (1) longer match preferred, (2) exact word boundary match preferred, (3) nearest prop to bot.

### 10.2 Ambiguous Matches (Multiple Props of Same Type)

**Problem:** "Walk to the desk" when there are 2 desks.

**Solutions (priority order):**
1. **Zone qualification in query:** "desk on the west wall" → resolve via zone
2. **Nearest-first default:** Pick the desk closest to bot's current position
3. **Ask for clarification:** Return ambiguous error with options (backend response)
4. **Indexed naming in layout summary:** "desk-1 (W), desk-2 (E)" in context envelope

### 10.3 Pathfinding Around Obstacles

**Problem:** Props block cells, creating narrow passages.

**Solution:** Already solved! The A* implementation in `pathfinding.ts`:
- Uses 8-directional movement with proper diagonal blocking
- Checks both adjacent cardinal cells for diagonal moves (prevents corner-cutting)
- Walkable mask already correctly marks furniture cells as non-walkable
- `findNearestWalkable()` handles cases where target itself isn't walkable

### 10.4 Animation Timing and Smoothness

**Problem:** Bot needs to walk along an arbitrary path smoothly, not just toward a fixed direction.

**Solution:** Waypoint-by-waypoint following with:
- Smooth position interpolation (lerp at walk speed)
- Smooth rotation (slerp toward next waypoint direction)
- Walk bounce animation tied to movement (existing pattern in Bot3D)
- Dead-zone snap for rotation (prevent jitter on small adjustments)

### 10.5 Cancel/Interrupt Navigation Mid-Walk

**Problem:** User sends new command while bot is walking.

**Solution:**
- New navigation command → immediately cancel current, start new
- Status change (offline, sleeping) → cancel navigation, apply status behavior
- User clicks bot (focus) → no cancel (viewing only)
- `bot_navigate_cancel` SSE event for explicit cancellation

**Implementation:** Check at start of each useFrame iteration:
```typescript
// Cancel checks
if (anim.isNavigating) {
  if (statusChanged || newNavRequest || cancelEvent) {
    anim.isNavigating = false
    anim.phase = getPhaseForStatus(status) // Return to normal
    navStore.delete(session.key)
  }
}
```

### 10.6 What Happens When Bot Arrives?

**Phase 1 (MVP):** Bot arrives, faces prop, shows activity bubble "At {prop}", stays for 5-15s, then resumes normal behavior (idle wander / coffee / etc based on status).

**Phase 4 (Future):** Arrival can trigger interactions:
- Server rack → "checking logs" animation (lean forward, head bob)
- Whiteboard → "writing" animation (arm movement)
- Coffee machine → "getting coffee" (reuse existing coffee behavior)
- Desk → "working" (sit down, typing)

### 10.7 Multiple Bots Navigating Simultaneously

**Problem:** Two bots might navigate to the same prop.

**Solution:**
- Each bot finds its own path independently (A* runs per-bot on frontend)
- Approach cell can accommodate multiple bots (each picks a different adjacent cell)
- If same cell: slight random jitter offset (existing pattern in BotAnimations `jitter` ref)
- Bots don't block each other's pathfinding (they're not obstacles in the walkable mask)

### 10.8 Prop Doesn't Exist / Was Removed

**Problem:** Bot navigates to a prop that was removed from blueprint.

**Solution:** Backend validates prop exists in current blueprint before broadcasting SSE. If prop removed mid-navigation, frontend detects invalid path (target cell may now be walkable or different) and cancels gracefully.

---

## 11. User Experience Design

### 11.1 Command Syntax

**Supported via LLM (freeform):**
- "Walk to the server rack"
- "Go check the whiteboard"
- "Head over to the desk on the east wall"
- "Can you go to the coffee machine?"
- "Move to the center of the room"

**Supported via direct skill call (structured):**
- `navigate_to("server-rack")`
- `navigate_to("center")`
- `navigate_to("door")`

**The LLM handles the translation.** Users never need to know propIds. The context envelope gives the LLM enough information to map natural language to prop names.

### 11.2 Visual Feedback Timeline

```
T=0s    User: "Walk to the server rack"
T=0.5s  Bot response: "On my way! 🚶"
T=0.5s  Activity bubble: "🚶 Walking to server rack..."
T=0.5s  Bot starts walking (purposeful speed, slight bounce)
T=3-5s  Bot arrives at server rack
T=3-5s  Bot turns to face the rack
T=3-5s  Activity bubble: "📍 At server rack"
T=3-5s  Bot response: "I'm at the server rack in the southeast corner."
T=8-20s Bot resumes normal behavior
```

### 11.3 Error Handling UX

| Scenario | Bot Response | Visual |
|----------|-------------|--------|
| Prop not found | "I can't find a 'bookshelf' in this room. I have: 2 desks, a server rack, and a whiteboard." | No movement |
| Ambiguous | "There are 2 desks — one on the west wall and one on the east wall. Which one?" | No movement |
| Can't reach | "I can't reach the {prop} — the path is blocked." | Brief confused animation? |
| Already there | "I'm already at the server rack!" | No movement, face prop |

### 11.4 Demo Examples (for tutorials/onboarding)

```
💬 Try saying to your bot:
  • "Walk to the whiteboard"
  • "Go check the server rack"
  • "Head to the coffee machine"
  • "Move to the center of the room"
  • "Go to the desk on the west wall"
```

---

## 12. Phased Rollout Plan

### Phase 1: MVP — Straight-Line Navigation (3-4 days)

**Scope:** Bot walks to a prop in the same room via A* pathfinding, triggered by SSE event.

**Tasks:**
| # | Task | Est | File(s) |
|---|------|-----|---------|
| 1.1 | Add `navigating-to-prop` and `arrived-at-prop` to BotAnimState | 0.5d | `BotAnimations.tsx` |
| 1.2 | Extend AnimState with navigation fields | 0.5d | `BotAnimations.tsx` |
| 1.3 | Navigation event handler (SSE listener) | 0.5d | New: `hooks/useNavigationEvents.ts` |
| 1.4 | Path computation + waypoint following in Bot3D | 1d | `Bot3D.tsx` |
| 1.5 | Backend navigation endpoint (prop resolution + SSE broadcast) | 1d | New: `backend/routes/navigation.py` |
| 1.6 | Activity bubble integration | 0.25d | `Bot3D.tsx` |
| 1.7 | Testing + edge cases | 0.5d | — |

**Depends on:** Spatial awareness backend (v0.14.0) for prop lookup. Can be bootstrapped without it if frontend sends prop data in SSE.

**Definition of Done:** User can say "walk to the server rack" in chat, bot computes A* path, walks along it, arrives, faces prop, shows activity bubble, resumes normal behavior after timer.

### Phase 2: Polish & Obstacle Handling (2-3 days)

**Scope:** Better pathfinding visuals, destination markers, cancel/interrupt, multi-bot navigation.

**Tasks:**
| # | Task | Est |
|---|------|-----|
| 2.1 | Destination marker (glowing ring at target) | 0.5d |
| 2.2 | Cancel/interrupt navigation (status change, new command) | 0.5d |
| 2.3 | Multi-bot navigation (jitter offsets, approach cell variety) | 0.5d |
| 2.4 | Smooth rotation during path following (face direction of travel) | 0.5d |
| 2.5 | Error feedback ("can't find prop" visual indicator) | 0.5d |
| 2.6 | Path visualization (optional debug: show A* path as line) | 0.5d |

### Phase 3: Cross-Room Navigation (2-3 days)

**Scope:** Bot can navigate to a prop in a different room (walks out door, through hallway, into other room).

**Tasks:**
| # | Task | Est |
|---|------|-----|
| 3.1 | Cross-room path planning (room A door → hallway → room B door → prop) | 1d |
| 3.2 | Room transition animation (exit door, walk hallway, enter door) | 1d |
| 3.3 | Backend: resolve prop in different room, validate bot can move | 0.5d |
| 3.4 | Update room assignment on arrival | 0.5d |

**Note:** This is significantly more complex because:
- Hallways are not on the grid (separate world space)
- Bot needs to transition between two different room grids
- Room assignment in backend needs to update
- Camera may need to follow bot across rooms

### Phase 4: Interaction on Arrival (1-2 days)

**Scope:** When bot arrives at a prop, trigger a contextual interaction.

**Tasks:**
| # | Task | Est |
|---|------|-----|
| 4.1 | Define interaction types per prop category | 0.5d |
| 4.2 | Interaction animations (inspect, use, read, work) | 1d |
| 4.3 | Auto-navigation from chat context (detect prop mentions) | 0.5d |

**Prop → Interaction mapping:**
| Prop Category | Arrival Interaction |
|--------------|-------------------|
| Desk/workstation | Sit down, start typing |
| Server rack | Lean forward, inspect |
| Whiteboard | Face it, point at it |
| Coffee machine | Get coffee (reuse existing) |
| Plant/decoration | Look at it briefly |
| Bookshelf | Reach for a book |

---

## 13. Testing Strategy

### 13.1 Unit Tests

| Test | Description |
|------|-------------|
| `resolve_prop()` matches | Exact, partial, fuzzy, zone-qualified prop name matching |
| `resolve_prop()` edge cases | Empty query, no props, all props same name |
| `findPropApproachCell()` | Finds walkable cell adjacent to prop, handles surrounded props |
| `findPath()` with prop targets | Path exists around furniture to approach cell |
| Animation state transitions | navigate → walking → arrived → idle correctly |

### 13.2 Integration Tests

| Test | Description |
|------|-------------|
| End-to-end navigation | Chat message → backend → SSE → frontend → animation |
| Cancel mid-walk | Send new command during navigation → cancels + starts new |
| Status change during nav | Bot goes offline during walk → stops, goes offline |
| Multiple bots navigating | Two bots walk to same prop → both arrive at different positions |

### 13.3 Visual/Manual Tests

| Test | What to Check |
|------|--------------|
| Walk animation smoothness | No teleporting, smooth rotation, proper bounce |
| Path correctness | Bot doesn't walk through furniture |
| Arrival behavior | Bot faces prop, activity bubble shows, timer works |
| Various prop types | Test with furniture (large span), decorations (small), wall-mounted |
| Empty room | Navigate in room with no/few props |
| Bot already at prop | "Already there" response, no movement |

### 13.4 Performance Tests

| Test | Target |
|------|--------|
| A* pathfinding time | < 1ms for 20×20 grid (currently well within) |
| Path following (useFrame overhead) | < 0.1ms per frame per navigating bot |
| Max simultaneous navigations | 10+ bots navigating without frame drops |
| SSE latency | Navigate command → bot starts moving < 200ms |

---

## 14. Risk Assessment

### 14.1 Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Spatial awareness (v0.14.0) not ready | Medium | High | Bootstrap: frontend sends prop data in SSE event, bypassing backend prop lookup |
| Path looks unnatural (too robotic) | Medium | Medium | Add path smoothing (Catmull-Rom spline), slight randomized offset from exact cell centers |
| LLM doesn't reliably detect navigation intent | Low | Medium | Fallback: explicit `/navigate` command in chat; layout summary in envelope helps LLM |
| Performance with many navigating bots | Low | Low | A* on 20×20 grid is trivial; limit to 1 path per bot, cache paths |
| Cross-room navigation too complex for Phase 3 | High | Medium | Keep Phase 3 as separate feature, not blocking Phase 1-2 value |
| User confusion about available props | Medium | Low | Good error messages with available prop list; layout summary already in bot context |
| Animation conflicts with existing movement | Medium | Medium | Navigation overrides all other movement; clean cancel on status change |

### 14.2 Dependencies

```
v0.14.0 Spatial Awareness ──▶ v0.18.0 Bot Navigation
(backend prop data)            (navigation commands)

Specifically needed from v0.14.0:
├── Blueprint data in backend DB (for prop resolution)
├── GET /api/rooms/{room_id}/props endpoint
├── Context envelope layout summary
└── Zone derivation utility (grid_to_zone)

Can proceed WITHOUT v0.14.0 by:
├── Frontend-side prop resolution (blueprint data already in frontend)
├── SSE event triggered directly from frontend (skip backend resolution)
└── Hardcode a few test scenarios
```

### 14.3 Open Questions

1. **Should navigation be automatic or explicit?** MVP: explicit (user says "walk to X"). Future: auto-navigate when bot mentions a prop in its response.

2. **Should bots remember their last navigation target?** After arriving and idling, should they return to their previous position or just resume random wandering? → Resume wandering (simpler, more natural).

3. **Should there be a maximum navigation distance?** In Phase 1 (same room), the 20×20 grid is small enough that any path is fine. Phase 3 (cross-room) may need limits.

4. **Should other users see the navigation?** Yes — SSE events are broadcast to all connected clients, so everyone sees the bot walking.

5. **Sound effects?** Footstep sounds during navigation walk? → Phase 4, optional, under sound settings toggle.

---

## Appendix: API Reference Draft

### Navigation Skill (OpenClaw Skill Format)

```yaml
name: crewhub_navigation
version: "1.0"
description: Navigate your bot to props and locations in your CrewHub room.

functions:
  navigate_to:
    description: |
      Walk to a prop or location in your room. The bot will pathfind around
      obstacles and walk to the target. Returns immediately; the walk animation
      plays asynchronously.
    parameters:
      target:
        type: string
        required: true
        description: |
          What to walk to. Can be:
          - A prop name: "server rack", "whiteboard", "desk"
          - A zone: "center", "north wall", "southeast corner"
          - Special: "door"
          If multiple props match, the nearest one is chosen.
          Include direction for disambiguation: "desk on the west wall"
    returns:
      type: string
      description: |
        Success: "Walking to server-rack (SE corner)"
        Error: "Can't find 'bookshelf'. Available: desk, server-rack, whiteboard"
    examples:
      - input: { target: "server rack" }
        output: "Walking to server-rack (SE corner)"
      - input: { target: "desk on the west wall" }
        output: "Walking to standing-desk (W wall)"
      - input: { target: "center" }
        output: "Walking to room center"
      - input: { target: "bookshelf" }
        output: "Can't find 'bookshelf' in this room. Available props: standing-desk (×2), server-rack."

  stop_navigation:
    description: Stop walking and stay where you are.
    parameters: {}
    returns:
      type: string
      description: "Stopped" or "Not currently navigating"

  get_location:
    description: Get your current location in the room (zone and nearby props).
    parameters: {}
    returns:
      type: string
      description: "You're near the center, closest to the whiteboard (N wall)."
```

### SSE Event Types

```typescript
// New SSE event types for navigation

interface BotNavigateEvent {
  type: 'bot_navigate'
  data: {
    session_key: string
    room_id: string
    target_grid: { x: number; z: number }   // Walkable approach cell
    prop_id: string | null                    // null for zone/position targets
    prop_name: string                         // Human-readable target name
    zone: string                              // Zone of target (w, ne, center, etc.)
  }
}

interface BotNavigateCancelEvent {
  type: 'bot_navigate_cancel'
  data: {
    session_key: string
    room_id: string
    reason?: string                           // 'user_cancel' | 'status_change' | 'new_navigation'
  }
}

interface BotNavigateArrivedEvent {
  type: 'bot_navigate_arrived'
  data: {
    session_key: string
    room_id: string
    prop_id: string | null
    prop_name: string
  }
}
```

### Database Changes (if v0.14.0 spatial awareness not yet done)

Minimal bootstrap — no new tables needed for Phase 1 if we:
1. Read built-in blueprint JSONs directly in backend (ship them as embedded data)
2. Custom blueprints are already in `custom_blueprints` table

If v0.14.0 IS done, we get `room_prop_cache` table for free and just query it.

---

*End of analysis. This document should be reviewed alongside the spatial awareness design (`spatial-awareness-design.md`) and 3D world architecture analysis (`3d-world-architecture-analysis.md`).*
