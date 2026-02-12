# Spatial Awareness Design — Props in Rooms

> CrewHub bots become aware of props in their 3D rooms so they can navigate to them and reference them naturally.

**Status:** Design  
**Date:** 2026-02-12  
**Author:** Ekinbot (subagent)

---

## 1. Current State

Blueprints already store prop placements as grid coordinates in `custom_blueprints.blueprint_json`:

```json
{
  "gridWidth": 20, "gridDepth": 20, "cellSize": 0.6,
  "placements": [
    { "propId": "desk-with-monitor", "x": 4, "z": 16, "span": {"w":2,"d":2} },
    { "propId": "plant", "x": 18, "z": 18 }
  ],
  "doors": [{ "x": 9, "z": 19, "facing": "south" }],
  "walkableCenter": { "x": 10, "z": 10 }
}
```

The context envelope (`build_crewhub_context`) already injects room/project/participant info into agent prompts but has **no spatial/prop data**.

---

## 2. API Endpoint

### `GET /api/rooms/{room_id}/props`

Returns the prop layout for a room. Sources data from:
1. `custom_blueprints` table (if room has a custom blueprint)
2. Default blueprint registry (frontend-side, mirrored to backend)

**Response (compact format — default):**

```json
{
  "room_id": "dev-room",
  "grid": [20, 20, 0.6],
  "props": [
    ["desk-with-monitor", 4, 16, "work"],
    ["plant", 18, 18, "deco"],
    ["sleep-corner", 2, 2, "sleep"],
    ["coffee-machine", 15, 3, "coffee"]
  ],
  "doors": [[9, 19, "S"], [10, 19, "S"]],
  "center": [10, 10]
}
```

Each prop is `[propId, x, z, zone]` — **~30 tokens per prop** vs ~80 for a full object.

**Query params:**
- `?format=compact` (default) — array-of-arrays as above
- `?format=full` — full JSON objects with span, interactionType, etc.
- `?format=natural` — natural language summary (see §4)

**Implementation:** ~40 lines in `routes/rooms.py`. Read blueprint JSON, reshape.

### `GET /api/rooms/{room_id}/props/{prop_id}`

Single prop lookup. Returns position + nearest interaction point.

```json
{
  "propId": "coffee-machine",
  "x": 15, "z": 3,
  "zone": "coffee",
  "nearby": ["water-cooler", "bench"]
}
```

---

## 3. Context Envelope Integration

Three token-budget strategies, selectable per room/agent config:

### Option A: Inline Summary (recommended default)
Add a `layout` field to the context envelope:

```json
{
  "room": { "id": "dev-room", "name": "Dev Room", "type": "standard" },
  "layout": "20x20 grid. Props: desk-with-monitor(4,16) plant(18,18) sleep-corner(2,2) coffee-machine(15,3). Doors: S(9-10,19). Center(10,10)."
}
```

**Cost:** ~40-60 tokens. Always available, no round-trip.

### Option B: On-Demand (tool call)
No layout in envelope. Agent calls `get_room_layout()` skill when needed.

**Cost:** 0 tokens baseline + ~50 tokens per call. Better for agents that rarely reference props.

### Option C: Hybrid (recommended for phase 2)
Envelope includes prop *names only* (no coordinates). Agent queries positions on demand:

```json
{ "layout": { "props": ["desk","plant","coffee-machine","sleep-corner"], "size": "20x20" } }
```

**Cost:** ~15 tokens baseline + ~20 per position lookup.

### Recommendation
**Phase 1:** Option A (inline summary). Simple, always works, ~50 tokens is negligible.  
**Phase 2:** Option C for rooms with >10 props.

---

## 4. Natural Language Spatial Index

### Zone-Based (primary)
Divide the grid into a 3×3 named zone grid:

```
 NW  |  N   |  NE
-----|------|-----
  W  | center|  E
-----|------|-----
 SW  |  S   |  SE
```

Map grid coords → zone: `x < grid/3 → W column`, etc.

**Example output:**
```
Room: Dev Room (20×20 grid)
NW: sleep-corner
N: desk-with-monitor
NE: plant
S: doors
SW: coffee-machine
Center: (open space)
```

~35 tokens. Agents can say "I'm in the northwest corner near the sleep area" or "walking south to the coffee machine."

### Relative Descriptions
For `get_prop_location(name)` responses, include relative info:

```
"The coffee machine is in the SW corner, near the water cooler. About 12 cells from the desk."
```

### Grid-to-Zone Mapping Function

```python
def grid_to_zone(x: int, z: int, w: int, d: int) -> str:
    col = "W" if x < w/3 else ("E" if x > 2*w/3 else "")
    row = "S" if z < d/3 else ("N" if z > 2*d/3 else "")
    return row + col or "center"
```

---

## 5. Skill/Tool Interface

Three skills for the agent tool registry:

### `get_room_layout()`
Returns full room prop layout in natural language.

```
Room: Dev Room (20×20, cell=0.6m)
Props by zone:
  NW: sleep-corner
  N: desk-with-monitor (2×2)
  NE: plant
  SW: coffee-machine
Doors: south wall (9-10)
```

### `get_prop_location(name: str)`
Fuzzy-match prop name, return position + zone + nearby props.

```
desk-with-monitor: grid(4,16), zone N, near: plant(5 cells), work-point(adjacent)
```

Fuzzy matching: lowercase, strip hyphens, partial match. "desk" → "desk-with-monitor".

### `list_nearby_props(x: int, z: int, radius: int = 3)`
Props within radius of a grid point. Useful for "what's around me?"

```
Near (10,10): nothing within 3 cells. Nearest: desk-with-monitor (7 cells NW)
```

### Implementation
These map to the `/api/rooms/{room_id}/props` endpoint variants. The agent's OpenClaw skill definition:

```yaml
name: crewhub_room_layout
description: Get prop layout of current CrewHub room
parameters: {}
endpoint: GET /api/rooms/{context.room_id}/props?format=natural
```

---

## 6. Frontend Integration

### Current State
- Props defined in `PropRegistry.ts` / `PropRegistry.tsx` (frontend only)
- Blueprint JSON stored in `custom_blueprints` table with `room_id` FK
- No dedicated `room_props` table (placements are embedded in blueprint JSON)

### Approach: Use Blueprint JSON (no new table)
The blueprint JSON already contains all placement data. **No schema change needed.**

For rooms without custom blueprints, the backend needs access to default blueprints. Options:
1. **Export defaults to DB at startup** — backend seeds `custom_blueprints` for built-in room types
2. **Hardcode defaults in backend** — simple Python dict of default layouts

**Recommendation:** Option 1 — frontend sends default blueprint to backend on room creation.

### SSE Sync
When a blueprint is updated (via Creator Center or API), broadcast:
```
event: room-layout-changed
data: { "room_id": "dev-room" }
```

Agents with active context envelopes for that room get refreshed layout on next envelope build.

### PropRegistry ↔ Backend Sync
The frontend `PropRegistry` defines available prop *types* (meshes, sizes). The backend only needs prop *placements* (which props are where). These are already in blueprint JSON.

No additional sync mechanism needed — blueprints are the single source of truth.

---

## 7. Token Cost Analysis

| Approach | Tokens/query | Always-on cost | Round-trips |
|----------|-------------|----------------|-------------|
| **A: Inline summary** | 0 (included) | ~50 tokens | 0 |
| **B: On-demand tool** | ~50 | 0 | 1 |
| **C: Hybrid names+lookup** | ~20/lookup | ~15 | 0-N |
| **Natural language zone** | ~35 | ~35 | 0 |
| **Full JSON compact** | ~80 | ~80 | 0 |
| **Full JSON verbose** | ~200 | ~200 | 0 |

**For a room with 6 props:**
- Option A: 50 tokens per message (always) = ~2,500 tokens over 50-message session
- Option B: 50 tokens × maybe 3 lookups = 150 tokens per session
- Option C: 15 + (20 × 3 lookups) = 75 tokens per session

**Verdict:** At 50 tokens, Option A is negligible overhead and eliminates latency. Use it.

---

## 8. Bot Navigation Flow

```
1. Bot receives context envelope with layout summary
2. Bot decides to interact: "I'll go check the coffee machine"
3. Bot calls get_prop_location("coffee machine") → gets grid(15,3)
4. Frontend receives bot action via SSE: { action: "move_to", target: "coffee-machine", grid: [15,3] }
5. 3D avatar pathfinds to (15,3) and plays interaction animation
6. Bot says: "Getting some coffee ☕ — anyone want some?"
```

For the "I'm walking to the clock" goal:
- If "clock" exists in the blueprint → fuzzy match succeeds → avatar walks there
- If "clock" doesn't exist → skill returns "No prop matching 'clock' found. Available: desk, plant, coffee-machine..." → bot self-corrects

---

## 9. Phased Implementation Plan

### Phase 1: Read-Only Prop Awareness (1-2 days)
- [ ] Add `GET /api/rooms/{room_id}/props` endpoint (read from `custom_blueprints`)
- [ ] Add `grid_to_zone()` helper + natural language formatter
- [ ] Add `layout` field to context envelope (Option A)
- [ ] Default blueprint seeding for rooms without custom blueprints

### Phase 2: Agent Skills (1 day)
- [ ] Register `get_room_layout` / `get_prop_location` / `list_nearby_props` as OpenClaw skills
- [ ] Add fuzzy prop name matching
- [ ] Add `?format=natural` query param

### Phase 3: Frontend Bot Actions (2-3 days)
- [ ] SSE event for `bot-action: move_to` with grid target
- [ ] Avatar pathfinding to arbitrary grid cell
- [ ] Interaction animations at prop locations
- [ ] `room-layout-changed` SSE broadcast on blueprint update

### Phase 4: Rich Spatial Queries (nice-to-have)
- [ ] `list_nearby_props` with distance calculations
- [ ] Relative directions ("the plant is 3 meters east of the desk")
- [ ] Prop interaction history ("last visited the coffee machine 10 min ago")
- [ ] Hybrid token strategy (Option C) for large rooms

---

## 10. Technical Notes

- **Grid → World coords:** `worldX = gridX * cellSize`, `worldZ = gridZ * cellSize` (cellSize default 0.6)
- **Fuzzy matching:** Use simple substring + Levenshtein for prop name resolution
- **No new DB tables needed** — blueprint JSON is the source of truth
- **Context envelope budget:** Target ≤2KB total. Layout adds ~200 bytes, well within budget.
- **Blueprint fallback:** Rooms without custom blueprints get a minimal default layout (just walkable center + doors)
