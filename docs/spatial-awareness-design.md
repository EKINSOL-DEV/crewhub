# Spatial Awareness Design — Props in Rooms

> **Status:** Design Document (not yet implemented)  
> **Author:** Ekinbot (Claude Opus)  
> **Date:** 2026-02-11  
> **CrewHub Version:** Schema v8, Frontend with PropRegistry + Grid Blueprint system

## 1. Problem Statement

CrewHub bots exist in 3D rooms with props (desks, coffee machines, plants, etc.) but have **zero awareness** of what's in their room. A bot can't say "I'll walk to the coffee machine" because it doesn't know one exists, where it is, or what else is nearby.

**Goal:** A bot can say *"I'm walking to the clock"* and it matches what's actually in the 3D room — token-efficiently.

## 2. Current Architecture Summary

### What exists today

| Layer | Component | Key details |
|-------|-----------|-------------|
| **Database** | `custom_blueprints` table | Stores `blueprint_json` (full grid layout + placements) per room |
| **Database** | `rooms` table | Room metadata (name, project, HQ flag), no prop data |
| **Backend** | `GET /api/blueprints?room_id=X` | Returns full blueprint JSON (can be large) |
| **Backend** | Context Envelope service | Builds ≤2KB JSON for agent preambles (room, project, tasks — **no props**) |
| **Frontend** | `PropRegistry` (modding registry) | Maps `propId` → React component + mount metadata |
| **Frontend** | `builtinProps.ts` | 50+ registered props (floor, wall, composite, interaction-only) |
| **Frontend** | `GridRoomRenderer` | Renders props from blueprint placements on a grid |
| **Grid** | Blueprint JSON | `gridWidth × gridDepth` (typically 20×20), `cellSize: 0.6`, placements array |

### Blueprint placement structure (existing)
```json
{
  "propId": "desk-with-monitor",
  "x": 4, "z": 16,
  "type": null,
  "interactionType": null,
  "span": { "w": 2, "d": 2 }
}
```

### What's missing
- No API to query "what props are in room X?"
- Context envelope has no spatial/prop info
- No human-readable position system
- No skill/tool for bots to query their surroundings
- No way for a bot to "navigate to" a specific prop

---

## 3. Position System Design

### 3.1 Approach: Zone-Based with Grid Coordinates

The grid is typically 20×20. Raw grid coords (x=4, z=16) are meaningless to bots and humans. We need a **dual system**:

1. **Zone labels** — human-readable, for context envelopes and bot speech
2. **Grid coordinates** — precise, for navigation/animation

### 3.2 Zone Map (4×4 zones on a 20×20 grid)

Divide the room into a 4×4 grid of named zones:

```
         NORTH WALL (z=0)
    ┌─────┬─────┬─────┬─────┐
    │ NW  │ N1  │ N2  │ NE  │  z: 0-4
    ├─────┼─────┼─────┼─────┤
    │ W1  │ C1  │ C2  │ E1  │  z: 5-9
    ├─────┼─────┼─────┼─────┤
    │ W2  │ C3  │ C4  │ E2  │  z: 10-14
    ├─────┼─────┼─────┼─────┤
    │ SW  │ S1  │ S2  │ SE  │  z: 15-19
    └─────┴─────┴─────┴─────┘
         SOUTH WALL (z=19, door side typically)
```

**Zone naming rules:**
- Corners: `NW`, `NE`, `SW`, `SE`
- Edges: `N1`, `N2` (north inner), `S1`, `S2` (south inner), `W1`, `W2`, `E1`, `E2`
- Center: `C1`, `C2`, `C3`, `C4`

**Human-readable aliases** (for bot speech):
| Zone | Alias |
|------|-------|
| NW, NE, SW, SE | "northwest corner", "southeast corner" |
| N1, N2 | "north side" |
| S1, S2 | "near the door" (if door is south wall) |
| C1-C4 | "center of the room" |
| W1, W2 | "west side" |
| E1, E2 | "east side" |

### 3.3 Zone Calculation

```python
def grid_to_zone(x: int, z: int, grid_width: int = 20, grid_depth: int = 20) -> str:
    """Convert grid coordinates to zone label."""
    # Normalize to 0-3 range
    col = min(3, int(x / (grid_width / 4)))
    row = min(3, int(z / (grid_depth / 4)))
    
    ZONE_MAP = [
        ["NW", "N1", "N2", "NE"],
        ["W1", "C1", "C2", "E1"],
        ["W2", "C3", "C4", "E2"],
        ["SW", "S1", "S2", "SE"],
    ]
    return ZONE_MAP[row][col]

def zone_to_friendly(zone: str, door_wall: str = "south") -> str:
    """Convert zone label to human-friendly description."""
    FRIENDLY = {
        "NW": "northwest corner", "NE": "northeast corner",
        "SW": "southwest corner", "SE": "southeast corner",
        "N1": "north side", "N2": "north side",
        "S1": "south side", "S2": "south side",
        "W1": "west side", "W2": "west side",
        "E1": "east side", "E2": "east side",
        "C1": "center", "C2": "center", "C3": "center", "C4": "center",
    }
    return FRIENDLY.get(zone, zone)
```

### 3.4 Scalable for non-20×20 grids

The zone system adapts to any `gridWidth × gridDepth` by dividing proportionally. A 10×10 room still gets 4×4 zones, just with smaller cells per zone.

---

## 4. API Endpoint Design

### 4.1 `GET /api/rooms/{room_id}/props`

Returns a compact prop listing for a room, derived from its active blueprint.

**Response format:**
```json
{
  "room_id": "dev-room",
  "room_name": "Dev Room",
  "grid": { "w": 20, "d": 20, "cell_size": 0.6 },
  "doors": [{ "x": 9, "z": 19, "zone": "S1" }],
  "props": [
    {
      "id": "desk-with-monitor",
      "label": "Desk with Monitor",
      "zone": "SW",
      "x": 4, "z": 16,
      "mount": "floor",
      "interaction": null
    },
    {
      "id": "coffee-machine",
      "label": "Coffee Machine",
      "zone": "NE",
      "x": 17, "z": 2,
      "mount": "floor",
      "interaction": "coffee"
    },
    {
      "id": "wall-clock",
      "label": "Wall Clock",
      "zone": "N1",
      "x": 8, "z": 0,
      "mount": "wall",
      "interaction": null
    }
  ],
  "interaction_points": {
    "work": [{ "x": 5, "z": 15, "zone": "SW" }],
    "coffee": [{ "x": 17, "z": 3, "zone": "NE" }],
    "sleep": [{ "x": 2, "z": 2, "zone": "NW" }]
  },
  "summary": "8 props: 3 desks, 2 plants, 1 coffee machine, 1 wall clock, 1 bookshelf"
}
```

**Key design decisions:**
- `label` is auto-generated from propId: `"desk-with-monitor"` → `"Desk with Monitor"`
- `zone` is pre-calculated server-side
- `summary` is a one-line text for compact context injection
- Interaction-only props (work-point, coffee-point, sleep-corner) are in `interaction_points`, not `props`
- Response is typically 500B-2KB depending on prop count

### 4.2 Blueprint Resolution Logic

```python
async def get_active_blueprint(room_id: str) -> dict | None:
    """Get the active blueprint for a room.
    
    Priority:
    1. Custom blueprint linked to room (custom_blueprints.room_id)
    2. Built-in blueprint file matching room_id
    """
    # Check custom blueprint
    db_row = await db.execute(
        "SELECT blueprint_json FROM custom_blueprints WHERE room_id = ? ORDER BY updated_at DESC LIMIT 1",
        (room_id,)
    )
    if db_row:
        return json.loads(db_row["blueprint_json"])
    
    # Fall back to built-in JSON file
    path = f"frontend/src/lib/grid/blueprints/{room_id}.json"
    if os.path.exists(path):
        return json.load(open(path))
    
    return None
```

### 4.3 `GET /api/rooms/{room_id}/props/{prop_id}`

Returns details of a specific prop type in the room (useful for "where is the coffee machine?").

```json
{
  "id": "coffee-machine",
  "label": "Coffee Machine",
  "instances": [
    { "x": 17, "z": 2, "zone": "NE", "zone_friendly": "northeast corner" }
  ],
  "nearest_interaction": { "type": "coffee", "x": 17, "z": 3, "zone": "NE" }
}
```

---

## 5. Context Envelope Integration

### 5.1 Options Analysis

| Approach | What's injected | Token cost | Pros | Cons |
|----------|----------------|------------|------|------|
| **A. Full prop list** | All props with zones | ~150-400 tokens | Complete picture | Wasteful if bot doesn't need spatial info |
| **B. Summary only** | One-line summary string | ~20-30 tokens | Ultra cheap | Bot can't navigate to specific props |
| **C. Summary + skill** | Summary + "use `get_room_layout()` for details" | ~40-50 tokens | Cheap default, detail on demand | Requires tool call round-trip |
| **D. Nothing (skill-only)** | Just skill availability | ~15 tokens | Minimal cost | Bot doesn't know what's available without asking |

### 5.2 Recommendation: **Option C — Summary + Skill**

Add to the existing context envelope:

```json
{
  "room": {
    "id": "dev-room",
    "name": "Dev Room",
    "type": "standard",
    "props_summary": "8 props: 3 desks, 2 plants, coffee machine, wall clock, bookshelf",
    "has_coffee": true,
    "has_work_stations": true
  },
  "skills": ["spatial_awareness"]
}
```

**Token cost:** ~35-45 tokens added to envelope (currently ≤2KB budget).

**Why this works:**
- Bot always knows *what's* in the room (summary) — enough for casual mentions
- Bot can query details on demand via skill (zone, exact position)
- Token cost is near-zero for sessions that don't need spatial navigation
- `has_coffee` / `has_work_stations` booleans enable quick behavioral decisions

### 5.3 Envelope Changes (context_envelope.py)

```python
# In build_crewhub_context(), after room query:

# Fetch prop summary for room
props_data = await get_room_props_summary(room_id)
if props_data:
    room["props_summary"] = props_data["summary"]
    room["has_coffee"] = props_data["has_coffee"]
    room["has_work_stations"] = props_data["has_work_stations"]
```

---

## 6. Skill/Tool Interface Design

### 6.1 CrewHub Spatial Awareness Skill

This skill would be available as an OpenClaw tool/skill that bots can invoke.

**Skill name:** `crewhub_spatial`

**Functions:**

#### `get_room_layout()`
Returns the full prop layout of the bot's current room.

```
→ Request: GET /api/rooms/{room_id}/props
← Response (formatted for bot):

Room: Dev Room (20×20 grid)
Door: south wall (S1)

Props:
  • Desk with Monitor — southwest corner (SW)
  • Desk with Monitor — southwest corner (SW)  
  • Coffee Machine — northeast corner (NE)
  • Wall Clock — north wall (N1)
  • Plant — southeast corner (SE)
  • Bookshelf — west side (W1)

Work stations: SW (×2)
Coffee: NE
Rest: NW
```

**Token cost:** ~80-120 tokens for a typical room (8-15 props).

#### `get_prop_location(prop_name)`
Find a specific prop by name (fuzzy match).

```
→ get_prop_location("clock")
← "Wall Clock is on the north wall (zone N1, grid 8,0)"

→ get_prop_location("coffee")
← "Coffee Machine is in the northeast corner (zone NE, grid 17,2). Nearest coffee interaction point: NE (17,3)"
```

**Token cost:** ~20-30 tokens.

#### `list_nearby_props(zone?)`
List props near the bot's current position or a given zone.

```
→ list_nearby_props("SW")
← "Props in/near SW: Desk with Monitor (SW), Desk with Monitor (SW), Plant (S2). Work station available."
```

**Token cost:** ~30-50 tokens.

#### `navigate_to(target)`
Resolve a navigation target to grid coordinates for the animation system.

```
→ navigate_to("coffee machine")
← { "target": "coffee-machine", "x": 17, "z": 2, "interaction_point": { "x": 17, "z": 3 }, "zone": "NE" }
```

This returns structured data that the frontend animation system can use to path the bot.

**Token cost:** ~25 tokens.

### 6.2 Fuzzy Matching

Prop name resolution should be forgiving:
- "clock" → matches `wall-clock`
- "coffee" → matches `coffee-machine`
- "desk" → matches `desk-with-monitor` (returns all instances)
- "board" → matches `notice-board`, `whiteboard`, `mood-board`

```python
def fuzzy_match_prop(query: str, props: list[dict]) -> list[dict]:
    """Match a query string against prop IDs and labels."""
    q = query.lower().replace(" ", "-")
    results = []
    for p in props:
        pid = p["id"].lower()
        label = p["label"].lower()
        if q in pid or q in label or pid in q:
            results.append(p)
    return results
```

### 6.3 Integration with Bot Movement

The frontend already has bot walking animation. The skill's `navigate_to()` returns grid coords that can be sent via SSE to trigger movement:

```
SSE event: bot-navigate
{
  "session_key": "agent:dev:main",
  "target_x": 17,
  "target_z": 3,
  "target_prop": "coffee-machine",
  "animation": "walk"
}
```

The frontend `Bot3D` component picks this up and animates the walk.

---

## 7. Database Schema

### 7.1 Analysis: New Table vs Extend Existing

**Current state:** Prop placements live inside `custom_blueprints.blueprint_json` (embedded JSON) or in built-in JSON files. There is no normalized prop placement table.

**Options:**

| Option | Description | Effort | Query speed |
|--------|-------------|--------|-------------|
| A. Read from blueprint JSON | Parse existing data, no schema change | Low | Moderate (JSON parse) |
| B. New `room_props` table | Denormalized cache of active placements | Medium | Fast (SQL) |
| C. Materialized view | Auto-sync from blueprint changes | High | Fast |

### 7.2 Recommendation: Option A (Phase 1) → Option B (Phase 2)

**Phase 1: No schema change.** The API endpoint reads from the existing blueprint JSON. This works because:
- Blueprint data is already there
- Rooms typically have <20 props
- JSON parsing is fast for small payloads
- No migration needed

**Phase 2: Add `room_props` cache table** for performance if needed:

```sql
-- Schema v9 migration
CREATE TABLE room_props (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    prop_id TEXT NOT NULL,          -- e.g., 'coffee-machine'
    label TEXT NOT NULL,            -- e.g., 'Coffee Machine'
    x INTEGER NOT NULL,
    z INTEGER NOT NULL,
    zone TEXT NOT NULL,             -- e.g., 'NE'
    mount_type TEXT DEFAULT 'floor', -- 'floor' or 'wall'
    interaction_type TEXT,          -- 'work', 'coffee', 'sleep', or NULL
    span_w INTEGER DEFAULT 1,
    span_d INTEGER DEFAULT 1,
    blueprint_id TEXT,              -- source blueprint
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX idx_room_props_room ON room_props(room_id);
CREATE INDEX idx_room_props_type ON room_props(room_id, interaction_type);
```

**Sync strategy:** Whenever a blueprint is saved/updated (create, move-prop, delete-prop), rebuild the `room_props` rows for that room. This is event-driven, not polled.

```python
async def sync_room_props(room_id: str, blueprint: dict):
    """Rebuild room_props from blueprint placements."""
    await db.execute("DELETE FROM room_props WHERE room_id = ?", (room_id,))
    
    for p in blueprint.get("placements", []):
        if p.get("type") == "interaction":
            continue  # Skip interaction-only markers
        
        zone = grid_to_zone(p["x"], p["z"], blueprint["gridWidth"], blueprint["gridDepth"])
        label = prop_id_to_label(p["propId"])
        
        await db.execute("""
            INSERT INTO room_props (room_id, prop_id, label, x, z, zone, mount_type, 
                                    interaction_type, span_w, span_d, blueprint_id, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (room_id, p["propId"], label, p["x"], p["z"], zone, 
              "wall" if is_wall_prop(p["propId"]) else "floor",
              p.get("interactionType"), 
              p.get("span", {}).get("w", 1), p.get("span", {}).get("d", 1),
              blueprint.get("id"), int(time.time() * 1000)))
    
    await db.commit()
```

---

## 8. Frontend Integration

### 8.1 No PropRegistry Changes Needed

The PropRegistry is a rendering concern — it maps propIds to React components. The spatial awareness system reads from **blueprint data**, not the registry. No registry changes needed.

### 8.2 SSE Events for Real-Time Sync

Existing SSE events already broadcast blueprint changes:
- `blueprint-update` with `action: "prop-moved"` / `"prop-deleted"`

**New SSE events needed:**

```typescript
// When a bot navigates to a prop
type BotNavigateEvent = {
  type: "bot-navigate"
  session_key: string
  target_x: number
  target_z: number
  target_prop?: string    // propId
  target_zone?: string    // zone label
  animation: "walk" | "run"
}

// When room props cache is rebuilt (Phase 2)
type RoomPropsRefreshEvent = {
  type: "room-props-refresh"
  room_id: string
}
```

### 8.3 Bot3D Integration

The `Bot3D` component needs to listen for `bot-navigate` events and animate the bot walking to the target grid position. This likely hooks into the existing `usePropMovement` hook or a new `useBotNavigation` hook.

```typescript
// New hook: useBotNavigation.ts
function useBotNavigation(sessionKey: string) {
  useSSEEvent("bot-navigate", (event) => {
    if (event.session_key === sessionKey) {
      // Convert grid coords to world coords
      const worldX = event.target_x * cellSize
      const worldZ = event.target_z * cellSize
      // Trigger walk animation to (worldX, worldZ)
      startWalkTo(worldX, worldZ)
    }
  })
}
```

---

## 9. Token Cost Analysis

### 9.1 Per-Approach Comparison

Assuming a typical room with **10 props**, measured in GPT-4 tokens (≈ Claude tokens):

| What | Tokens | When |
|------|--------|------|
| **Context envelope (current, no props)** | ~250-400 | Every message |
| **+ props_summary (Option C)** | +35-45 | Every message |
| **get_room_layout() call** | ~100-150 | On demand |
| **get_prop_location("X") call** | ~25-35 | On demand |
| **list_nearby_props() call** | ~40-60 | On demand |
| **navigate_to("X") response** | ~25 | On demand |
| **Full prop list in envelope (Option A)** | +150-400 | Every message |

### 9.2 Cost Scenarios

**Scenario 1: Bot casually mentions room** (most common)
- Cost: +40 tokens (summary in envelope)
- Bot says: "I'm in the Dev Room. There's a coffee machine and a few desks."

**Scenario 2: Bot navigates to a prop**
- Cost: +40 (envelope) + 30 (get_prop_location) + 25 (navigate_to) = **+95 tokens**
- Bot says: "I'll walk over to the coffee machine in the northeast corner."

**Scenario 3: Bot describes its surroundings in detail**
- Cost: +40 (envelope) + 120 (get_room_layout) = **+160 tokens**
- Bot says: "Let me look around. I see two desks in the southwest, a bookshelf on the west wall..."

### 9.3 Annual Token Cost Estimate

Assuming 100 bot messages/day, 10% use spatial features:
- Envelope overhead: 100 × 40 = 4,000 tokens/day
- Spatial queries: 10 × 95 = 950 tokens/day
- **Total: ~5,000 tokens/day ≈ 150K tokens/month** (negligible)

---

## 10. Implementation Plan

### Phase 1: API + Basic Awareness (1-2 days)

**Backend:**
1. Add `GET /api/rooms/{room_id}/props` endpoint
   - Reads from blueprint JSON (custom or built-in)
   - Calculates zones, generates labels and summary
   - Returns compact JSON response
2. Add `grid_to_zone()` and `prop_id_to_label()` utility functions
3. Add `props_summary`, `has_coffee`, `has_work_stations` to context envelope

**Files to create/modify:**
- `backend/app/routes/rooms.py` — add props endpoint
- `backend/app/utils/spatial.py` — new: zone calculation, label generation
- `backend/app/services/context_envelope.py` — add prop summary to envelope

**No frontend changes. No schema changes.**

### Phase 2: Skill + Navigation (2-3 days)

**Backend:**
1. Create `GET /api/rooms/{room_id}/props/{prop_query}` (fuzzy search)
2. Add `POST /api/rooms/{room_id}/navigate` (resolve target → coords, emit SSE)
3. Create `room_props` cache table (schema v9 migration)
4. Add sync hooks to blueprint create/update/delete/move-prop

**Frontend:**
1. Add `useBotNavigation` hook
2. Wire `bot-navigate` SSE event to Bot3D walk animation
3. Add navigation indicator (dotted line or destination marker?)

**Skill (OpenClaw):**
1. Create `crewhub_spatial` skill with `get_room_layout()`, `get_prop_location()`, `navigate_to()`
2. Register skill in bot capabilities

### Phase 3: Polish + Advanced Features (ongoing)

- **Door-relative descriptions:** "near the door", "far from entrance"
- **Bot proximity:** "I'm standing next to the bookshelf"  
- **Prop grouping:** "the desk area" (cluster of desks + chairs)
- **Multi-floor awareness:** If buildings/floors are added later
- **Prop interaction animations:** Bot sits at desk, pours coffee, etc.
- **Voice narration:** Bot TTS describes walking: "Walking to the coffee machine..."

---

## 11. Example Flows

### Flow 1: Bot mentions room casually

```
Context envelope includes:
  props_summary: "8 props: 3 desks, 2 plants, coffee machine, wall clock, bookshelf"

User: "What are you working on?"
Bot: "I'm at my desk in the Dev Room — there's a nice bookshelf nearby and 
      I can see the wall clock says it's almost coffee time!"
```
*No tool calls needed. Summary is enough for flavor text.*

### Flow 2: Bot navigates to a prop

```
User: "Go get some coffee"
Bot thinks: I need to find the coffee machine.

→ get_prop_location("coffee")
← "Coffee Machine is in the northeast corner (NE, grid 17,2). 
    Nearest coffee point: (17,3)"

→ navigate_to("coffee-machine")
← { target_x: 17, target_z: 3, zone: "NE" }

Bot: "On my way to the coffee machine in the northeast corner! ☕"
[Frontend animates bot walking from current position to (17,3)]
```

### Flow 3: Bot describes surroundings

```
User: "Look around and tell me what you see"

→ get_room_layout()
← Room: Dev Room (20×20)
   Door: south wall
   Props:
   • Desk with Monitor — SW
   • Desk with Monitor — SW
   • Coffee Machine — NE
   • Wall Clock — N1
   • Plant — SE
   • Plant — NE
   • Bookshelf — W1
   • Server Rack — NW

Bot: "I'm in the Dev Room. Looking around, I see two desks with monitors 
      in the southwest corner near the door. There's a coffee machine in the 
      far northeast corner, a wall clock on the north wall, and a server rack 
      tucked away in the northwest. A couple of plants brighten up the place, 
      and there's a bookshelf along the west wall."
```

---

## 12. Open Questions

1. **Built-in vs custom blueprint priority:** If a room has both a built-in blueprint file AND a custom blueprint, which takes precedence? → Recommendation: custom always wins (already the case in frontend).

2. **Prop labels:** Should we maintain a label registry (propId → display name) or always auto-generate from ID? → Recommendation: auto-generate with an optional override table later.

3. **Bot position tracking:** Do we need server-side bot position tracking, or is the frontend position sufficient? → Recommendation: Phase 1 is frontend-only. Phase 2 could add server-side position for multi-client sync.

4. **Interaction point proximity:** Should `navigate_to()` target the prop itself or the nearest interaction point? → Recommendation: target the interaction point if one exists (e.g., coffee-point near coffee-machine), otherwise the prop grid cell.

---

## Appendix A: Prop ID → Label Mapping

```python
def prop_id_to_label(prop_id: str) -> str:
    """Convert propId to human-readable label.
    
    'desk-with-monitor' → 'Desk with Monitor'
    'coffee-machine' → 'Coffee Machine'
    'wall-clock' → 'Wall Clock'
    """
    return prop_id.replace("-", " ").title()
```

## Appendix B: Known Prop IDs (from blueprints.py)

**Floor props:** desk, monitor, chair, lamp, plant, coffee-machine, water-cooler, bench, server-rack, desk-lamp, cable-mess, easel, color-palette, bar-chart, megaphone, standing-desk, round-table, bean-bag, bookshelf, conveyor-belt, control-panel, antenna-tower, headset, filing-cabinet, fire-extinguisher, drawing-tablet

**Wall props:** notice-board, whiteboard, mood-board, presentation-screen, wall-clock, small-screen, gear-mechanism, satellite-dish, signal-waves, status-lights

**Composite:** desk-with-monitor, desk-with-dual-monitors, standing-desk-with-monitor, desk-with-monitor-headset, desk-with-monitor-tablet

**Interaction-only:** work-point, work-point-1..4, coffee-point, sleep-corner

## Appendix C: Wall Prop Detection

```python
WALL_PROPS = {
    "notice-board", "whiteboard", "mood-board", "presentation-screen",
    "wall-clock", "small-screen", "gear-mechanism", "satellite-dish",
    "signal-waves", "status-lights", "painting", "clock",
}

def is_wall_prop(prop_id: str) -> bool:
    return prop_id in WALL_PROPS
```
