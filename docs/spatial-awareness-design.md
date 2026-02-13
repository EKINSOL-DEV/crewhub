# Spatial Awareness System — Design Document

*Version: 1.0 — 2026-02-13*
*Status: Draft*

## Goal

Bots should be aware of props in their room and navigate to them. When a bot says "I'm walking to the clock," it should match what's actually rendered in the 3D room. Must be **token-efficient** — no massive prop dumps every turn.

---

## 1. Position System

CrewHub already uses a **grid-based** coordinate system via blueprints:
- `gridWidth × gridDepth` cells, each `cellSize` (0.6) units
- Props placed at `(x, z)` grid coordinates with optional `span: {w, d}`
- Interaction points grouped by type (`work`, `coffee`, `sleep`)
- Doors at grid positions with facing direction

**We keep this grid system.** For bot-facing output, we add **semantic labels**:

```
Grid position (3, 5) → "near the entrance"
Grid position (7, 2) → "back-right corner"
```

### Zone Naming (automatic)

Divide room grid into 9 named zones based on position relative to door/center:

```
┌──────────┬──────────┬──────────┐
│ back-left│  back    │back-right│
├──────────┼──────────┼──────────┤
│   left   │  center  │  right   │
├──────────┼──────────┼──────────┤
│front-left│  front   │front-right│
└──────────┴──────────┴──────────┘
        (door = front)
```

Bot sees: `desk @ center, clock @ back-right` — human-readable, token-cheap.

---

## 2. Database Changes

**No new tables needed.** Blueprints already store prop placements in the `custom_blueprints` table as JSON:

```python
# Existing BlueprintPlacement
class BlueprintPlacement(BaseModel):
    propId: str      # "builtin:desk"
    x: int           # grid x
    z: int           # grid z
    type: Optional[str]
    interactionType: Optional[str]
    span: Optional[BlueprintPlacementSpan]
```

**Additions** — extend `BlueprintPlacement` with optional bot-facing metadata:

```python
class BlueprintPlacement(BaseModel):
    # ... existing fields ...
    label: Optional[str] = None      # Human-readable name override ("Ekin's desk")
    interactable: bool = True        # Can bots interact with this?
```

The label field lets room creators give props friendly names. Without it, we derive names from `propId` (e.g., `"builtin:desk"` → `"desk"`).

---

## 3. API Endpoint Design

### `GET /api/rooms/{room_id}/spatial`

Returns a compact spatial summary for bot consumption.

**Response:**

```json
{
  "room_id": "dev-room",
  "grid": [10, 8],
  "props": [
    {"id": "desk", "at": [3, 4], "zone": "center"},
    {"id": "whiteboard", "at": [1, 7], "zone": "back-left"},
    {"id": "clock", "at": [9, 7], "zone": "back-right", "mount": "wall"},
    {"id": "coffee_machine", "at": [0, 0], "zone": "front-left"}
  ],
  "doors": [{"at": [5, 0], "facing": "south"}],
  "agents": [
    {"name": "Worker", "at": [3, 4], "status": "active"}
  ]
}
```

**~120 tokens** for a typical room with 8 props + 2 agents. Extremely compact:
- Short keys (`at` not `position`, `id` not `propId`)
- Zone names instead of raw coords where possible
- No component/rendering data

### `GET /api/rooms/{room_id}/spatial?prop=clock`

Returns info for a single prop (for on-demand queries):

```json
{"id": "clock", "at": [9, 7], "zone": "back-right", "mount": "wall"}
```

**~20 tokens.**

---

## 4. Context Envelope Integration

Three strategies, ranked by token efficiency:

### Strategy A: On-Demand Query (Recommended)

Bot gets **no spatial data** in the context envelope by default. Instead, it gets a **tool/skill** it can call when needed.

**Context envelope addition** (~15 tokens):
```
Room: dev-room (10×8 grid, 8 props). Use get_room_layout() for details.
```

**Token cost per turn:** 15 tokens baseline. ~120 tokens only when bot actually queries.

### Strategy B: Compact Summary in Envelope

Include a one-line summary:
```
Props: desk(center), whiteboard(back-left), clock(back-right), coffee(front-left)
```

**~40 tokens.** Good for bots that frequently reference props.

### Strategy C: Full Layout (Not Recommended)

Full prop list with coordinates in every envelope. **~120+ tokens per turn**, wasteful for bots that rarely interact with props.

### Recommendation

**Use Strategy A (on-demand) as default**, with Strategy B as opt-in per room/agent config. Add a `spatial_context` setting:

```python
class RoomUpdate(BaseModel):
    # ... existing ...
    spatial_context: Optional[str] = "minimal"  # "minimal" | "summary" | "full"
```

---

## 5. Skill/Tool Interface

Three tools exposed to bots via the context envelope:

### `get_room_layout()`

Returns full spatial summary (same as API endpoint). Bot calls this when it needs to understand the room.

```python
# Returns:
{
  "grid": [10, 8],
  "props": [{"id": "desk", "at": [3, 4], "zone": "center"}, ...],
  "doors": [...],
  "agents": [...]
}
```

**Cost:** ~120 tokens per call.

### `get_prop_location(name: str)`

Find a specific prop by fuzzy name match.

```python
get_prop_location("clock")
# → {"id": "clock", "at": [9, 7], "zone": "back-right", "mount": "wall"}

get_prop_location("desk")
# → {"id": "desk", "at": [3, 4], "zone": "center", "label": "Ekin's desk"}
```

**Cost:** ~20 tokens per call.

### `list_nearby_props(radius: int = 2)`

Props within N grid cells of the bot's current position.

```python
list_nearby_props(radius=2)
# → [{"id": "desk", "at": [3, 4], "dist": 0}, {"id": "lamp", "at": [4, 4], "dist": 1}]
```

**Cost:** ~15-50 tokens depending on density.

### `navigate_to(target: str)`

Bot declares intent to move to a prop/zone. Backend resolves target to grid position, frontend animates.

```python
navigate_to("clock")
# → {"ok": true, "from": [3, 4], "to": [9, 7], "path_length": 7}
```

**Cost:** ~25 tokens. Also triggers SSE event for frontend animation.

---

## 6. Frontend Integration

### SSE Events

New event type for bot movement:

```typescript
// SSE event
{
  type: "bot_move",
  data: {
    session_key: "agent:dev:main",
    room_id: "dev-room",
    from: [3, 4],
    to: [9, 7],
    target_prop: "clock"  // optional
  }
}
```

Frontend receives this → animates bot walking along path → updates bot position.

### PropRegistry — No Changes Needed

PropRegistry stays render-focused. Spatial data lives in blueprints (backend). The frontend already reads blueprint placements to render props — same data feeds the spatial API.

### Real-time Sync

When a room's blueprint is edited (props added/moved/removed):
1. Backend saves updated blueprint
2. SSE broadcasts `blueprint_updated` event
3. Frontend re-renders room
4. Any bot querying spatial data gets fresh layout

Already works this way for rendering — spatial API just reads the same data.

---

## 7. Token Cost Analysis

| Approach | Tokens/Turn | Tokens if Bot Queries | Notes |
|----------|-------------|----------------------|-------|
| No spatial (current) | 0 | N/A | Bot is blind |
| **Minimal + on-demand (A)** | **~15** | **~135** | Recommended |
| Summary in envelope (B) | ~40 | ~160 | Good for prop-heavy bots |
| Full layout every turn (C) | ~120 | ~120 | Wasteful |
| Single prop query | ~15 | ~35 | Cheapest targeted query |

**Typical bot turn:** Most turns, bots don't need spatial info → **15 tokens overhead** with Strategy A. When they do interact (~20% of turns), it costs ~135 tokens total. 

**Comparison with naive approach:** Dumping all prop data with coordinates, types, and metadata every turn would cost **300-500 tokens**. Our approach saves **~85% of tokens** on average.

---

## 8. Implementation Plan

### Phase 1: Spatial API (Backend) — 1 day

- [ ] Add `GET /api/rooms/{room_id}/spatial` endpoint
- [ ] Read blueprint placements, compute zones from grid positions
- [ ] Add optional `?prop=name` filter
- [ ] Add `label` field to `BlueprintPlacement` model
- [ ] Zone calculation utility (grid position → zone name)

### Phase 2: Bot Tools (Backend) — 1 day

- [ ] Implement `get_room_layout()` skill handler
- [ ] Implement `get_prop_location(name)` with fuzzy matching
- [ ] Implement `list_nearby_props(radius)` 
- [ ] Implement `navigate_to(target)` — resolve target, emit SSE event
- [ ] Track bot grid positions in memory (session → position map)

### Phase 3: Context Envelope (Backend) — 0.5 day

- [ ] Add `spatial_context` setting to Room model
- [ ] Inject minimal spatial line into context envelope
- [ ] Register spatial tools in bot tool list

### Phase 4: Frontend Animation (Frontend) — 1 day

- [ ] Handle `bot_move` SSE events
- [ ] Animate bot movement along grid path (A* or simple line)
- [ ] Show bot "walking to X" indicator
- [ ] Update bot position state after movement completes

### Phase 5: Polish — 0.5 day

- [ ] Fuzzy prop name matching (clock, Clock, wall clock → same prop)
- [ ] Bot arrival animations (interact with prop)
- [ ] Room editor: add label field to prop placement UI

**Total estimate: ~4 days**

---

## Appendix: Example Bot Interaction

```
[Context envelope]
Room: dev-room (10×8, 8 props). Spatial tools available.

[Bot thinking]
"I want to check the whiteboard for today's tasks."

[Bot calls]
navigate_to("whiteboard")
→ {"ok": true, "from": [3, 4], "to": [1, 7], "path_length": 5}

[SSE → Frontend]
Bot animates walking from desk to whiteboard.

[Bot says]
"Walking over to the whiteboard to check today's tasks..."
```

The user sees the bot physically move to the whiteboard in 3D. The bot's statement matches reality. ✨
