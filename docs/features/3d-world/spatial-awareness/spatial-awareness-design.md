# Spatial Awareness Design — Props in Rooms

*Version: 1.0 — 2026-02-10*
*Status: DRAFT*

---

## 1. Problem Statement

CrewHub bots live in 3D rooms with props (desks, clocks, server racks, etc.) placed on a 20×20 grid. Today, bots have **zero awareness** of what's physically in their room. A bot can't say "I'll walk to the server rack" because it doesn't know a server rack exists, let alone where it is.

**Goal:** Enable bots to perceive and navigate to props in their room, token-efficiently. A bot should be able to say *"I'm walking to the clock on the east wall"* and have it match the actual 3D world.

---

## 2. Current State

### What Exists

| Component | Status | Location |
|-----------|--------|----------|
| Props in rooms | ✅ Frontend-only via JSON blueprints | `frontend/src/lib/grid/blueprints/*.json` |
| PropRegistry | ✅ Dynamic Registry\<PropEntry\> | `frontend/src/lib/modding/registries.ts` |
| Blueprint loader | ✅ JSON → RoomBlueprint with placements | `frontend/src/lib/grid/blueprintLoader.ts` |
| Context envelope | ✅ Room + project + tasks injected into bot preamble | `backend/app/services/context_envelope.py` |
| SSE events | ✅ Centralized sseManager for real-time sync | `backend/app/routes/sse.py` |
| Rooms API | ✅ CRUD + assignments | `backend/app/routes/rooms.py` |
| Blueprints API | ✅ Custom blueprint CRUD | `backend/app/routes/blueprints.py` |

### The Gap

Props are **frontend-only data**. The backend doesn't know what props are in a room. The context envelope has no spatial information. There's no API to query "what's in this room?"

Blueprint JSON lives in the frontend bundle (`blueprints/dev-room.json` etc.) and in the `custom_blueprints` DB table for user-created layouts. The backend blueprints API already stores full blueprint JSON including placements. Built-in blueprints are not in the DB.

---

## 3. Position System

### Option Analysis

| System | Example | Pros | Cons |
|--------|---------|------|------|
| **Grid coords** (raw) | `(2, 8)` | Precise, matches data | Meaningless to LLM |
| **Zone-based** | `"west-wall"`, `"center"`, `"NE-corner"` | Natural language, tiny tokens | Lossy, multiple props per zone |
| **Relative** | `"near the door"`, `"next to desk"` | Most natural | Ambiguous, complex to compute |
| **Grid + Zone hybrid** | Zone label derived from grid coords | Best of both | Slight complexity |

### ✅ Recommendation: Zone-Based with Grid Backing

Divide the 20×20 grid into named zones. Each prop gets a zone label derived from its grid position. The LLM sees zones; the frontend resolves zones back to grid coords for animation.

**Zone Map (5×5 zones on a 20×20 grid, 4 cells per zone):**

```
        NORTH
  ┌────┬────┬────┬────┬────┐
  │NW  │N   │N   │N   │NE  │
  │corn│west│cent│east│corn│
  ├────┼────┼────┼────┼────┤
  │W   │    │    │    │E   │
  │nort│ NW │ N  │ NE │nort│
  ├────┼────┼────┼────┼────┤
  │W   │    │    │    │E   │
  │cent│ W  │CTR │ E  │cent│
  ├────┼────┼────┼────┼────┤
  │W   │    │    │    │E   │
  │sout│ SW │ S  │ SE │sout│
  ├────┼────┼────┼────┼────┤
  │SW  │S   │S   │S   │SE  │
  │corn│west│cent│east│corn│
  └────┴────┴────┴────┴────┘
        SOUTH (door)
```

**Simplified to 9 practical zones:**

| Zone ID | Grid X range | Grid Z range | Natural name |
|---------|-------------|-------------|--------------|
| `nw` | 0-6 | 0-6 | "northwest corner" |
| `n` | 7-12 | 0-6 | "north wall" |
| `ne` | 13-19 | 0-6 | "northeast corner" |
| `w` | 0-6 | 7-12 | "west wall" |
| `center` | 7-12 | 7-12 | "center" |
| `e` | 13-19 | 7-12 | "east wall" |
| `sw` | 0-6 | 13-19 | "southwest corner" |
| `s` | 7-12 | 13-19 | "south wall (near door)" |
| `se` | 13-19 | 13-19 | "southeast corner" |

**Zone derivation function:**

```python
def grid_to_zone(x: int, z: int, width: int = 20, depth: int = 20) -> str:
    col = "w" if x < width / 3 else ("e" if x >= 2 * width / 3 else "")
    row = "n" if z < depth / 3 else ("s" if z >= 2 * depth / 3 else "")
    zone = row + col
    return zone if zone else "center"
```

**Example output for dev-room:**
```
standing-desk @ (2,8) → "w" (west wall)
standing-desk @ (17,10) → "e" (east wall)
server-rack @ (17,18) → "se" (southeast corner)
```

---

## 4. API Endpoint Design

### `GET /api/rooms/{room_id}/props`

Returns a compact list of props in the room with zone-based positions.

**Response:**
```json
{
  "room_id": "abc-123",
  "room_name": "Dev Room",
  "blueprint_id": "dev-room",
  "prop_count": 4,
  "props": [
    { "id": "standing-desk", "zone": "w", "grid": [2, 8] },
    { "id": "standing-desk", "zone": "e", "grid": [17, 10] },
    { "id": "server-rack", "zone": "se", "grid": [17, 18] },
    { "id": "whiteboard", "zone": "n", "grid": [10, 1] }
  ]
}
```

**Token cost:** ~80-120 tokens for a typical room (4-8 props).

**Implementation:** Resolve blueprint for room (DB custom blueprint or built-in fallback), extract placements, compute zones, filter out interaction-only markers (`work-point-*`).

### `GET /api/rooms/{room_id}/layout`

Returns a one-line natural language summary for context injection.

**Response:**
```json
{
  "room_id": "abc-123",
  "summary": "Dev Room: 2 standing-desks (w, e walls), server-rack (SE corner), whiteboard (N wall). Door: south."
}
```

**Token cost:** ~30-40 tokens. Ideal for envelope injection.

---

## 5. Context Envelope Integration

### Option Comparison

| Option | What's in envelope | Token cost | Latency | Bot capability |
|--------|-------------------|------------|---------|---------------|
| **A: Full prop list** | All props with zones in envelope | ~80-120 tokens/room | None (pre-built) | Full spatial awareness always |
| **B: Summary line** | One-line layout summary | ~30-40 tokens/room | None (pre-built) | Knows what's there, approximate locations |
| **C: Prop count + skill** | `"props": 4` + skill to query | ~5 tokens | On-demand API call | Awareness on request only |

### ✅ Recommendation: Option B (Summary Line)

**Why B wins:**
- **30-40 tokens** is negligible in a context envelope already containing room/project/tasks (~200-400 tokens)
- Bot always knows the room layout without extra API calls
- Natural language is what the LLM works best with
- No skill/tool call overhead for simple spatial references
- The summary is deterministic and cacheable (changes only when blueprint changes)

**Envelope addition:**
```python
# In build_crewhub_context():
envelope["room"]["layout"] = "2 standing-desks (w, e walls), server-rack (SE corner), whiteboard (N wall). Door: south."
```

**When to use C instead:** If rooms grow beyond ~15 props, or if the envelope is being aggressively trimmed for cost. In practice, rooms have 4-8 props, so B is fine.

**Option A is overkill:** Structured JSON prop lists waste tokens on formatting. The LLM doesn't need `{"id": "standing-desk", "zone": "w"}` — it needs *"standing desk on the west wall"*.

---

## 6. Skill/Tool Interface

For bots that need precise spatial actions (navigate to a prop, check distances), provide a CrewHub spatial skill.

### Skill Spec: `crewhub_spatial`

```yaml
name: crewhub_spatial
description: Query and interact with props in your CrewHub room
functions:
  get_room_layout:
    description: "Get a natural language description of all props in your room"
    parameters: {}
    returns: "string — e.g. 'Dev Room: 2 standing-desks (w, e walls), server-rack (SE corner)'"
    
  get_prop_location:
    description: "Find where a specific prop is in your room"
    parameters:
      prop_name: "string — prop name or partial match (e.g. 'desk', 'server')"
    returns: "string — e.g. 'standing-desk is on the west wall (grid 2,8)' or 'not found'"
    
  list_nearby_props:
    description: "List props near a zone or position"
    parameters:
      zone: "string — zone name: nw, n, ne, w, center, e, sw, s, se"
    returns: "string[] — props in or adjacent to that zone"
    
  navigate_to:
    description: "Walk your bot to a prop or zone. Triggers movement animation in the 3D world."
    parameters:
      target: "string — prop name or zone (e.g. 'server-rack', 'center', 'door')"
    returns: "string — 'Moving to server-rack (SE corner)' or 'Target not found'"
```

### Implementation

Each function calls `GET /api/rooms/{room_id}/props` or `/layout` under the hood. The `navigate_to` function additionally:

1. Resolves target to grid coordinates
2. Posts a `bot_move` SSE event: `{ "session_key": "...", "target": [17, 18], "prop": "server-rack" }`
3. Frontend receives event, triggers pathfinding + walk animation
4. Returns confirmation to bot

### Token Cost Per Skill Call

| Function | API calls | Response tokens | Total |
|----------|-----------|----------------|-------|
| `get_room_layout` | 1 (cached) | ~30-40 | ~50 |
| `get_prop_location` | 1 (cached) | ~15-20 | ~35 |
| `list_nearby_props` | 1 (cached) | ~20-30 | ~45 |
| `navigate_to` | 1 + 1 SSE | ~10-15 | ~30 |

All responses are designed to be ≤50 tokens. The skill caches the room layout and only re-fetches on blueprint change (SSE `blueprint_updated` event).

---

## 7. Database Schema

### Current State
- `rooms` table: id, name, is_hq, project_id, floor_style, wall_style...
- `custom_blueprints` table: stores full blueprint JSON for user-created layouts
- Rooms have an implicit blueprint via fuzzy name matching or `blueprint_id` field
- Built-in blueprints are frontend-only JSON files

### What Needs to Change

**Option 1: Sync built-in blueprints to DB at startup** ✅ Recommended
- On backend start, load all built-in blueprint JSONs, insert/update in `blueprints` table
- All blueprint data accessible via one DB query
- Backend can derive room props without frontend

**Option 2: Backend reads frontend JSON files directly**
- Fragile path coupling, not suitable for production

### Schema Addition

```sql
-- Add blueprint_id to rooms (if not already present)
ALTER TABLE rooms ADD COLUMN blueprint_id TEXT;

-- Ensure blueprints table has placements data
-- (custom_blueprints already stores full JSON including placements)
-- Built-in blueprints need to be seeded into this table.

-- Spatial cache table (optional, for performance)
CREATE TABLE room_prop_cache (
    room_id TEXT PRIMARY KEY,
    blueprint_id TEXT NOT NULL,
    props_json TEXT NOT NULL,       -- compact JSON: [{"id":"desk","zone":"w","grid":[2,8]}, ...]
    summary TEXT NOT NULL,          -- natural language summary
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);
```

**The cache table** avoids recomputing zone labels on every request. It's invalidated when:
- Room's `blueprint_id` changes
- Blueprint placements are edited
- SSE `blueprint_updated` event fires

### Migration: Schema v9

```python
async def migrate_v9(db):
    """Add spatial awareness support."""
    # Add blueprint_id to rooms if not exists
    await db.execute("""
        ALTER TABLE rooms ADD COLUMN blueprint_id TEXT
    """)
    # Create prop cache table
    await db.execute("""
        CREATE TABLE IF NOT EXISTS room_prop_cache (
            room_id TEXT PRIMARY KEY,
            blueprint_id TEXT NOT NULL,
            props_json TEXT NOT NULL,
            summary TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
        )
    """)
    # Seed built-in blueprints (loaded from embedded JSON)
    for bp in BUILTIN_BLUEPRINTS:
        await db.execute("""
            INSERT OR IGNORE INTO custom_blueprints (id, name, json_data, is_builtin, created_at, updated_at)
            VALUES (?, ?, ?, 1, ?, ?)
        """, (bp['id'], bp['name'], json.dumps(bp), int(time.time()), int(time.time())))
```

---

## 8. Frontend Integration

### Bot Movement via SSE

When a bot calls `navigate_to("server-rack")`:

1. **Backend** resolves prop → grid coords `(17, 18)`
2. **Backend** broadcasts SSE event:
   ```json
   {
     "type": "bot_navigate",
     "data": {
       "session_key": "session-abc",
       "room_id": "room-123",
       "target_grid": [17, 18],
       "target_prop": "server-rack",
       "target_zone": "se"
     }
   }
   ```
3. **Frontend** receives event in `Bot3D` component
4. **Pathfinding** (`pathfinding.ts`) calculates path from bot's current position to target
5. **Animation** plays walk cycle along path
6. Bot arrives at interaction point adjacent to prop

### PropRegistry — No Changes Needed

The existing `propRegistry` (Registry\<PropEntry\>) already handles prop lookup by ID. No modifications needed for spatial awareness — it's purely a backend + context concern.

### Blueprint Change Detection

When a room's blueprint changes (user edits layout in editor):
1. Frontend saves via `PUT /api/blueprints/{id}`
2. Backend invalidates `room_prop_cache` for affected rooms
3. Backend broadcasts `blueprint_updated` SSE event
4. Context envelope picks up new layout summary on next build

---

## 9. Token Cost Analysis

### Per-Request Costs

| Scenario | Tokens | When |
|----------|--------|------|
| Envelope with layout summary (Option B) | +30-40 | Every bot message |
| Envelope without spatial info | +0 | Current state |
| Skill: `get_room_layout()` | ~50 | On-demand |
| Skill: `navigate_to("desk")` | ~30 | On-demand |
| Full prop list API call | ~80-120 | On-demand |

### Annual Cost Impact (Option B envelope)

Assumptions: 1000 bot messages/day, ~35 tokens per layout summary, $3/M input tokens (Sonnet-class).

```
35 tokens × 1000 msgs × 365 days = 12.8M tokens/year
12.8M × $3/M = $38.40/year
```

**Negligible.** Even at 10x volume, it's under $400/year.

### Comparison: Option A vs B vs C

| | Option A (full list) | Option B (summary) | Option C (skill-only) |
|---|---|---|---|
| Tokens per message | +80-120 | +30-40 | +0 (envelope), +50 per query |
| Annual cost (1K msgs/day) | ~$100 | ~$38 | ~$0-$50 (depends on usage) |
| Always-on awareness | ✅ | ✅ | ❌ |
| Precise coordinates | ✅ | ❌ (zones only) | ✅ (via skill) |
| Extra API calls | 0 | 0 | 1+ per spatial query |

---

## 10. Implementation Plan

### Phase 1: Backend Foundation (2-3 days)

**Goal:** Backend knows about props in rooms, can serve spatial data.

- [ ] Add `blueprint_id` column to `rooms` table (migration v9)
- [ ] Seed built-in blueprints into DB on startup (embed JSON files in backend)
- [ ] Create `room_prop_cache` table
- [ ] Implement zone derivation: `grid_to_zone(x, z)` utility
- [ ] Implement `GET /api/rooms/{room_id}/props` endpoint
- [ ] Implement `GET /api/rooms/{room_id}/layout` endpoint (summary string)
- [ ] Add layout summary generation: placements → natural language
- [ ] Cache invalidation on blueprint change

### Phase 2: Context Envelope Integration (1 day)

**Goal:** Every bot message includes room layout awareness.

- [ ] Add `room.layout` field to context envelope builder
- [ ] Query `room_prop_cache` (or compute on-the-fly) in `build_crewhub_context()`
- [ ] Test with real bot sessions — verify layout appears in preamble
- [ ] Verify hash-based change detection still works (layout changes → new hash → re-inject)

### Phase 3: Spatial Skill + Navigation (2-3 days)

**Goal:** Bots can query and navigate to props via skill/tool calls.

- [ ] Define `crewhub_spatial` skill spec (OpenClaw skill format)
- [ ] Implement skill handler: `get_room_layout`, `get_prop_location`, `list_nearby_props`
- [ ] Implement `navigate_to` with SSE `bot_navigate` event
- [ ] Frontend: handle `bot_navigate` SSE event in Bot3D
- [ ] Frontend: pathfinding from current position to target grid cell
- [ ] Frontend: walk animation to destination
- [ ] Test end-to-end: bot says "walk to server rack" → 3D bot walks there

### Phase 4: Polish & Edge Cases (1-2 days)

**Goal:** Handle edge cases, optimize, document.

- [ ] Handle rooms with no blueprint (empty layout summary)
- [ ] Handle duplicate prop names (e.g., 2 desks → "desk-1 (west)", "desk-2 (east)")
- [ ] Add prop-to-prop proximity queries ("what's near the desk?")
- [ ] Rate-limit spatial skill calls (prevent token waste from chatty bots)
- [ ] Document spatial skill in bot onboarding / persona templates
- [ ] Add spatial awareness to default persona prompt: *"You can see the props in your room..."*

---

## 11. Example Flow

### Bot receives message with envelope:

```
[CrewHub Context]
Room: Dev Room (standard)
Project: CrewHub (repo: ~/ekinapps/crewhub)
Layout: 2 standing-desks (W, E walls), server-rack (SE corner), whiteboard (N wall). Door: south.
Tasks: 3 assigned, 1 in progress
```

### Bot decides to check servers:

> **Bot:** "Let me check the server rack. 🚶"
> *Bot calls `navigate_to("server-rack")`*
> *Response: "Moving to server-rack (SE corner)"*
> *3D world: bot walks from center to SE corner, stops at server rack*
> **Bot:** "I'm at the server rack in the southeast corner. Everything looks good."

### Bot asks about room layout:

> **User:** "What's in your room?"
> **Bot:** "I'm in the Dev Room! I've got two standing desks — one on the west wall and one on the east wall. There's a server rack in the southeast corner and a whiteboard on the north wall. The door is to the south."

*(No skill call needed — the bot already knows from the envelope.)*

---

## 12. Open Questions

- [ ] Should bots auto-navigate when they "mention" a prop, or only via explicit skill call?
- [ ] Should the layout summary include interaction points (work spots, coffee spots)?
- [ ] Should we support custom zone names per room ("Bob's desk corner")?
- [ ] Multi-floor support — is Z-axis (height) ever relevant?

---

## Appendix: Built-in Blueprint Prop Counts

| Blueprint | Props | Typical summary tokens |
|-----------|-------|----------------------|
| headquarters | ~8 | ~45 |
| dev-room | 4 | ~30 |
| creative-room | ~6 | ~35 |
| marketing-room | ~5 | ~32 |
| thinking-room | ~4 | ~28 |
| automation-room | ~5 | ~32 |
| comms-room | ~6 | ~35 |
| ops-room | ~5 | ~32 |
| default | ~3 | ~25 |

Average: ~5 props/room, ~33 tokens per summary.
