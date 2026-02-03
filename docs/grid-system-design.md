# Grid-Based Room & Building System — Design Document

*Version: 1.0 — 2026-02-03*
*Status: Proposal / Analysis*
*Author: Ekinbot (automated analysis)*

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Grid System Architecture](#2-grid-system-architecture)
3. [Bot Pathfinding on Grid](#3-bot-pathfinding-on-grid)
4. [Room Templates / Blueprints](#4-room-templates--blueprints)
5. [Data Model](#5-data-model)
6. [Rendering Pipeline](#6-rendering-pipeline)
7. [Migration Path](#7-migration-path)
8. [Comparison: Current vs Grid](#8-comparison-current-vs-grid)
9. [Risks & Considerations](#9-risks--considerations)

---

## 1. Current State Analysis

### 1.1 How Rooms Are Built

Rooms are rendered by `Room3D.tsx`, which composes four sub-components:

```
<Room3D room={room} position={position} size={12}>
  <RoomFloor />      — flat tiled plane
  <RoomWalls />      — perimeter box meshes with accent strip
  <RoomNameplate />  — floating HTML label
  <RoomProps />      — hardcoded furniture per room type
</Room3D>
```

**Room size** is fixed at `ROOM_SIZE = 12` world units. The building layout (`World3DView.tsx`) places rooms in a grid with `GRID_SPACING = 16` (room 12 + hallway 4), capped at `MAX_COLS = 3`.

**Walls** are generated manually in `RoomWalls.tsx`. Four wall segments (back, left, right, front-split) are created as `boxGeometry` meshes at hardcoded positions. The front wall has a 3-unit gap for the "door." Each wall has an accent-colored strip on top and spherical caps at corners/gap edges. Wall thickness, height, and gap width are all constants — changing room shape means editing `RoomWalls.tsx` directly.

### 1.2 How Props Are Placed

`RoomProps.tsx` is the largest file in the system (~900 lines). It contains:

- **8 room-type components** (`HeadquartersProps`, `DevRoomProps`, `CreativeRoomProps`, etc.)
- **~25 mini-prop components** (`Whiteboard`, `ServerRack`, `Easel`, `Bookshelf`, `ConveyorBelt`, etc.)
- Each room type function places props at **hardcoded positions** using a scale factor:

```tsx
const s = roomSize / 12  // scale factor
const h = size / 2       // half-size

// Example from DevRoomProps:
<Desk position={[-h + 2.5 * s, Y, h - 2.5 * s]} rotation={[0, Math.PI / 6, 0]} />
<Monitor position={[-h + 2.3 * s, Y + 0.78, h - 2.4 * s]} rotation={[0, Math.PI / 6, 0]} />
<Chair position={[-h + 3.2 * s, Y, h - 3.5 * s]} rotation={[0, Math.PI + Math.PI / 6, 0]} />
```

Props use **arbitrary rotation values** (e.g., `Math.PI / 6`, `-Math.PI / 4`) and **Y offsets** for stacking (monitor on desk = `Y + 0.78`). There is no spatial awareness — props don't know about each other's positions.

### 1.3 How Bots Navigate

Bot movement is handled in `Bot3D.tsx` and `BotAnimations.tsx`:

1. **Room bounds** are calculated as a shrunk rectangle (`margin = 2.5` from each wall):
   ```tsx
   function getRoomBounds(roomPos, roomSize): RoomBounds {
     return {
       minX: roomPos[0] - roomSize / 2 + 2.5,
       maxX: roomPos[0] + roomSize / 2 - 2.5,
       minZ: roomPos[2] - roomSize / 2 + 2.5,
       maxZ: roomPos[2] + roomSize / 2 - 2.5,
     }
   }
   ```

2. **Walkable zone** is a circular area in the room center (per `getWalkableCenter()`):
   - Default radius: `roomSize * 0.17` (≈2 units in a 12-unit room)
   - Some rooms have tighter zones (thinking/ops: `radius * 0.55`, automation: `radius * 0.7`)

3. **Wandering** = pick a random point within the walkable circle, lerp toward it at 0.3 speed, wait 3–6 seconds, repeat.

4. **Interaction points** (desk, coffee, sleep corner) are hardcoded per room type in `getRoomInteractionPoints()`. Active bots walk to desk, idle bots 50% chance to get coffee (only headquarters has coffee), sleeping bots walk to a corner.

5. **No pathfinding** — bots move in straight lines. No obstacle avoidance. Multiple bots use random jitter (`±0.4 units`) to avoid stacking on the same furniture.

### 1.4 Pain Points

| Problem | Details |
|---------|---------|
| **Furniture clipping** | Bots walk through desks, server racks, and walls. The walkable circle is a rough approximation that doesn't account for furniture footprints. |
| **Bot stacking** | Multiple bots targeting the same desk/coffee position pile on top of each other. Jitter offsets (±0.4) are too small. |
| **Non-modular rooms** | Adding a new room type requires writing a new function with ~20 lines of hardcoded positions. Changing furniture layout = code change. |
| **Interaction point limitations** | Only 3 interaction points per room (desk, coffee, sleep). Only headquarters has coffee. No "sit in chair" or "check whiteboard" interactions. |
| **Wall rigidity** | Walls are fixed perimeter boxes. Cannot have internal walls, L-shaped rooms, or variable door positions. |
| **No collision data** | The renderer has zero knowledge of which world-space areas are occupied by furniture. Bots and props exist in separate coordinate systems. |
| **Scaling pain** | Adding props to a room requires trial-and-error positioning. The `s = roomSize / 12` scale factor helps but doesn't prevent overlaps. |
| **Maintenance burden** | `RoomProps.tsx` is 900+ lines of handcrafted positions. `BotAnimations.tsx` duplicates room-type logic to compute interaction points. Any layout change requires editing both files. |

---

## 2. Grid System Architecture

### 2.1 Room Grid (Micro Grid)

Each room is subdivided into an **NxM grid** of cells. This is the fundamental building block.

**Recommended cell size: `0.6 × 0.6` world units**

Rationale:
- Room size = 12 units → 20×20 grid = 400 cells per room
- A desk (currently ~1.4 × 0.7 units) fits in a 3×2 cell span (1.8 × 1.2 units with padding)
- Fine enough for meaningful pathfinding, coarse enough to keep things simple
- Props snap to cell boundaries; bots walk cell-to-cell

Alternative: `0.5 units/cell` → 24×24 = 576 cells (more granular but more data). `1.0 units/cell` → 12×12 = 144 cells (simpler but too coarse for small props like lamps).

**Cell types:**

| Type | Walkable | Description |
|------|----------|-------------|
| `empty` | ✅ | Open floor — bots can walk here |
| `wall` | ❌ | Perimeter or internal wall |
| `door` | ✅ | Passage between room and hallway |
| `furniture` | ❌ | Solid prop (desk, server rack, filing cabinet) |
| `decoration` | ✅ | Visual-only prop that bots walk over/past (cable mess, floor lamp base) |
| `interaction` | ❌* | Furniture with an interaction point (desk+chair, coffee machine). *The interaction cell itself is blocked; an adjacent cell is the "use" position. |

**Multi-cell props** span across grid cells. The "anchor" cell (top-left) holds the prop definition; spanned cells reference the anchor:

```
Grid view of a 3×2 desk:
[D1][D·][D·]    D1 = anchor cell (propId: 'desk', span: {w:3, d:2})
[D·][D·][D·]    D· = continuation cell (references anchor)
```

**Walkable mask** is derived automatically: any cell with `walkable: true` is passable. This mask is the input for pathfinding.

### 2.2 Building Grid (Macro Grid)

The building layout uses a **higher-level grid** where each cell represents an entire room or hallway segment.

Current layout constants (unchanged):
```
ROOM_SIZE = 12 units
HALLWAY_WIDTH = 4 units
GRID_SPACING = 16 units (12 + 4)
MAX_COLS = 3
```

**Building super-cells:**

| Super-cell type | Size | Description |
|-----------------|------|-------------|
| `room` | 12×12 units | Contains a room micro-grid (20×20 cells at 0.6/cell) |
| `hallway-h` | 4×12 units | Horizontal hallway between rooms |
| `hallway-v` | 12×4 units | Vertical hallway between rooms |
| `junction` | 4×4 units | Intersection of two hallways |
| `parking` | 9×12+ units | Break area (special room type) |
| `entrance` | 5×4 units | Lobby/entrance zone |

**Automatic wall generation:** Walls are placed wherever a room's edge borders a hallway or the building exterior. Doors are placed where a room connects to a hallway — one door per hallway-facing wall.

**Building macro-grid example** (3-column, 3-row layout):

```
┌──────────┬────┬──────────┬────┬──────────┬────┬─────────┐
│          │    │          │    │          │    │         │
│  Room 0  │ HH │  Room 1  │ HH │  Room 2  │ HH │ Parking │
│  (HQ)    │    │  (Dev)   │    │ (Create) │    │  Area   │
│          │    │          │    │          │    │         │
├──────────┼────┼──────────┼────┼──────────┼────┤         │
│   HV     │ JN │   HV     │ JN │   HV     │ JN │         │
├──────────┼────┼──────────┼────┼──────────┼────┤         │
│          │    │          │    │          │    │         │
│  Room 3  │ HH │  Room 4  │ HH │  Room 5  │ HH │         │
│ (Market) │    │ (Think)  │    │ (Auto)   │    │         │
│          │    │          │    │          │    │         │
├──────────┼────┼──────────┼────┼──────────┼────┼─────────┤
│   HV     │ JN │   HV     │ JN │   HV     │ JN │         │
├──────────┼────┼──────────┼────┼──────────┼────┤         │
│          │    │          │    │          │    │         │
│  Room 6  │ HH │  Room 7  │ HH │  (empty) │    │         │
│  (Comms) │    │  (Ops)   │    │          │    │         │
│          │    │          │    │          │    │         │
└──────────┴────┴──────────┴────┴──────────┴────┴─────────┘

HH = horizontal hallway    HV = vertical hallway    JN = junction
```

### 2.3 Wall Generation from Grid

Walls are derived from **grid boundaries** rather than manually placed:

**Rule 1 — Room perimeter:** For every cell at the edge of a room grid, if the adjacent cell outside the room is not a door, place a wall segment on that edge.

**Rule 2 — Door placement:** For each wall of a room that faces a hallway, place a door at the center cell(s). Door width = 2 cells (1.2 units) — enough for one bot to pass.

**Rule 3 — Building exterior:** For every hallway/junction cell at the building perimeter, place an exterior wall.

**Wall mesh generation:** Instead of 4 large box meshes, generate wall segments from edge data:

```tsx
// Pseudocode
for each cell in roomGrid:
  for each edge (north, south, east, west):
    if neighbor is out-of-bounds or non-walkable exterior:
      if cell is not a door:
        addWallSegment(cell.position, edge.direction, wallHeight)
```

This automatically handles:
- Standard rectangular rooms (same as now)
- Internal wall segments (future: L-shaped rooms, dividers)
- Variable door positions (not always center-front)
- Multiple doors per room

---

## 3. Bot Pathfinding on Grid

### 3.1 Algorithm: A* on 2D Grid

Grid-based pathfinding replaces the current "pick random point, lerp in a straight line" approach.

**A\* implementation** (simple, well-understood, optimal for small grids):

```tsx
function findPath(
  grid: GridCell[][],
  start: {x: number, z: number},
  goal: {x: number, z: number},
): {x: number, z: number}[] | null {
  // Standard A* with Manhattan distance heuristic
  // Returns array of cell coordinates from start to goal
  // Returns null if no path exists
  // Grid size: 20×20 = 400 cells — A* completes in <1ms
}
```

**Movement directions:** 8-directional (cardinal + diagonal). Diagonal moves cost √2 ≈ 1.414 vs 1.0 for cardinal. Diagonal moves are blocked if either adjacent cardinal cell is non-walkable (prevents corner-cutting through furniture).

### 3.2 Bot Movement Along Path

Once a path is computed:

1. Bot receives a `path: {x, z}[]` — list of cell coordinates
2. Each frame, bot lerps toward the next cell center
3. When within 0.1 units of cell center, advance to next cell
4. Smooth turning: lerp rotation toward next cell direction (already implemented)
5. **Path recomputation:** only when target changes (status transition), not every frame

**Speed by status:**

| Status | Walk speed | Behavior |
|--------|-----------|----------|
| Active | 1.2 u/s | Walk to assigned desk, then stop |
| Idle | 0.3–0.6 u/s | Wander to random walkable cell, or visit coffee/interaction |
| Sleeping | 0.4 u/s | Walk to sleep corner, then stop |
| Offline | 0 | Frozen in place |

### 3.3 Interaction Targets as Grid Cells

Instead of hardcoded world-space coordinates, interaction points are **specific cells** in the blueprint:

```
Desk interaction:  The cell adjacent to the desk marked as 'interaction' (type: 'work')
Coffee interaction: The cell in front of the coffee machine (type: 'coffee')
Sleep corner:      Any 'empty' cell in a room corner (type: 'rest')
```

Bots pathfind **to the interaction cell** (not the furniture cell itself). The interaction cell is the "stand here to use" position — like how you stand in front of a desk, not on top of it.

### 3.4 Collision Avoidance

**Simple reservation system:**
- Each bot "reserves" its current cell and target cell
- When picking a wander target, exclude reserved cells
- When multiple bots want the same interaction point, queue them or assign alternative points
- No need for dynamic obstacle avoidance — grid prevents walking through furniture

**Multiple desk positions:** Blueprints should define multiple `interaction:work` cells per room so multiple bots can "work" simultaneously without stacking.

### 3.5 Natural Movement (Anti-Robotic)

Pure grid movement looks robotic. Mitigations:

1. **Position jitter:** Bot visual position = cell center + small random offset (±0.1 units). Different per bot, consistent per cell.
2. **Smooth interpolation:** Use eased lerp (ease-in-out) between cells, not linear.
3. **Speed variation:** ±10% random speed multiplier per bot.
4. **Path smoothing:** Skip waypoints where 3+ consecutive cells are in a straight line — just lerp to the endpoint of the straight segment.
5. **Idle micro-movements:** When stopped at a desk, gentle random sway (already implemented as bobbing).
6. **Occasional diagonal preference:** For wandering, sometimes pick diagonal-adjacent cells to create curved-looking paths.

---

## 4. Room Templates / Blueprints

### 4.1 Blueprint Concept

Each room type has a predefined **blueprint** — a 2D array defining cell contents. Blueprints replace the hardcoded position functions in `RoomProps.tsx`.

Grid size: **20×20 cells** (12 units ÷ 0.6 units/cell)

**Legend for blueprints below:**

| Symbol | Meaning | Cell Type |
|--------|---------|-----------|
| `██` | Wall | `wall` |
| `🚪` | Door | `door` |
| `··` | Empty (walkable) | `empty` |
| `🖥️` | Desk + Monitor | `furniture` (propId: `desk-monitor`) |
| `💺` | Chair (interaction: work) | `interaction` (interactionType: `work`) |
| `☕` | Coffee machine | `furniture` (propId: `coffee-machine`) |
| `☕·` | Coffee use point | `interaction` (interactionType: `coffee`) |
| `📋` | Whiteboard / Notice board | `decoration` (propId: `whiteboard`) |
| `🪴` | Plant | `decoration` (propId: `plant`) |
| `💡` | Lamp | `decoration` (propId: `lamp`) |
| `🖲️` | Server rack | `furniture` (propId: `server-rack`) |
| `🎨` | Easel | `furniture` (propId: `easel`) |
| `📊` | Presentation screen | `decoration` (propId: `screen`) |
| `📺` | Small screen | `decoration` (propId: `small-screen`) |
| `🛋️` | Bean bag | `furniture` (propId: `bean-bag`) |
| `📚` | Bookshelf | `furniture` (propId: `bookshelf`) |
| `⚙️` | Gear mechanism | `decoration` (propId: `gear`) |
| `🎛️` | Control panel | `furniture` (propId: `control-panel`) |
| `📡` | Satellite dish | `decoration` (propId: `satellite`) |
| `🗄️` | Filing cabinet | `furniture` (propId: `filing-cabinet`) |
| `🧯` | Fire extinguisher | `decoration` (propId: `extinguisher`) |
| `🎧` | Headset | `decoration` (propId: `headset`) |
| `🔔` | Antenna tower | `decoration` (propId: `antenna`) |
| `⏰` | Wall clock | `decoration` (propId: `clock`) |
| `🥤` | Water cooler | `furniture` (propId: `water-cooler`) |
| `💤` | Sleep zone | `interaction` (interactionType: `rest`) |
| `~~` | Cable mess | `decoration` (propId: `cables`) |

> **Note:** Blueprints below use a simplified **10×10 view** for readability (each cell shown = 2×2 actual grid cells). Actual implementation uses 20×20 cells at 0.6 units each.

### 4.2 Headquarters Blueprint

```
 ┌────────────────────────────────────────────┐
 │ ██  ██  ██  ██  ██  🚪  🚪  ██  ██  ██  │  N
 │ ██  🖥️  🖥️  ··  ··  ··  ··  ··  🪴  ██  │  ↑
 │ ██  💺  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  🥤  ··  ··  ··  ··  ··  ☕  ☕· ██  │
 │ ██  ··  ··  ··  ··  ··  📋  📋  ··  ██  │
 │ ██  💤  ··  ··  ··  ··  ··  ··  💤  ██  │
 │ ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  │  S
 └────────────────────────────────────────────┘
   W                                       E
```

- Desk + monitor at top-left wall, chair facing it
- Coffee machine bottom-right, water cooler bottom-left
- Notice board on east wall
- Plant in NE corner, sleep zones in SW/SE corners
- Large open center for wandering

### 4.3 Dev Room Blueprint

```
 ┌────────────────────────────────────────────┐
 │ ██  ██  ██  ██  🚪  🚪  ██  ██  ██  ██  │
 │ ██  🖥️  🖥️  ··  ··  ··  🖥️  🖥️  🖲️  ██  │
 │ ██  💺  ··  ··  ··  ··  💺  ··  🖲️  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  ··  ~~  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  💡  ··  ··  ··  ··  ··  📋  📋  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  💤  ··  ··  ··  ··  ··  ··  💤  ██  │
 │ ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  │
 └────────────────────────────────────────────┘
```

- Two desk+monitor stations (left and right of back wall)
- Server racks in NE corner (2 cells tall)
- Whiteboard on east wall
- Cable mess on floor (decoration, walkable)
- Desk lamp near left workstation

### 4.4 Creative Room Blueprint

```
 ┌────────────────────────────────────────────┐
 │ ██  ██  ██  ██  🚪  🚪  ██  ██  ██  ██  │
 │ ██  🪴  ··  ··  ··  ··  🖥️  🖥️  ··  ██  │
 │ ██  ··  ··  ··  ··  ··  💺  ··  ··  ██  │
 │ ██  🎨  🎨  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  🪴  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  ··  ··  ··  ··  📋  📋  📋  ··  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  💤  ··  ··  ··  ··  ··  ··  💤  ██  │
 │ ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  │
 └────────────────────────────────────────────┘
```

- Easel (2-cell) on west wall
- Desk + monitor + drawing tablet on NE area
- Mood board on south wall (3-cell wide)
- Plants in NW and E corners

### 4.5 Marketing Room Blueprint

```
 ┌────────────────────────────────────────────┐
 │ ██  ██  ██  ██  🚪  🚪  ██  ██  ██  ██  │
 │ ██  🖥️  🖥️  ··  ··  ··  ··  ··  🪴  ██  │
 │ ██  💺  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  ··  ··  ··  ··  ··  📊  📊  ··  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  📋  📋  📋  ··  ··  ··  💺  ··  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  💤  ··  ··  ··  ··  ··  ··  💤  ██  │
 │ ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  │
 └────────────────────────────────────────────┘
```

- Standing desk + monitor at NW (standing desk variant)
- Presentation screen on east wall (2-cell)
- Bar chart prop center-right
- Guest chair on south side

### 4.6 Thinking Room Blueprint

```
 ┌────────────────────────────────────────────┐
 │ ██  ██  ██  ██  🚪  🚪  ██  ██  ██  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  📚  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  📚  ██  │
 │ ██  📋  📋  ··  🛋️  ··  ··  ··  ··  ██  │
 │ ██  ··  ··  🛋️  🍽️  🍽️  ··  ··  ··  ██  │
 │ ██  ··  ··  ··  🍽️  🍽️  🛋️  ··  ··  ██  │
 │ ██  💡  ··  ··  ··  🛋️  ··  ··  ··  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  💤  ··  ··  ··  ··  ··  ··  💤  ██  │
 │ ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  │
 └────────────────────────────────────────────┘
```

*🍽️ = round table (4-cell, furniture)*

- Central round table (2×2 cells)
- 4 bean bags around the table (interaction: think)
- Bookshelf on east wall
- Whiteboard on west wall
- Lamp in SW area

### 4.7 Automation Room Blueprint

```
 ┌────────────────────────────────────────────┐
 │ ██  ██  ██  ██  🚪  🚪  ██  ██  ██  ██  │
 │ ██  📺  ··  ··  ⏰  ··  ··  📺  ··  ██  │
 │ ██  📺  ··  ··  ··  ··  ··  📺  ··  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  ⚙️  ██  │
 │ ██  ··  🔲  🔲  🔲  🔲  ··  ··  ⚙️  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  🎛️  🎛️  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  💺  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  💤  ··  ··  ··  ··  ··  ··  💤  ██  │
 │ ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  │
 └────────────────────────────────────────────┘
```

*🔲 = conveyor belt segment (furniture, 4-cell wide)*

- Wall clock (decoration, on back wall)
- 4 small dashboard screens (2 left, 2 right of back wall)
- Conveyor belt through center (4-cell, furniture)
- Gear mechanism on east wall
- Control panel at SW with interaction chair

### 4.8 Comms Room Blueprint

```
 ┌────────────────────────────────────────────┐
 │ ██  ██  ██  ██  🚪  🚪  ██  ██  ██  ██  │
 │ ██  🔔  ··  ··  ··  ··  ··  ··  📡  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  📺  ··  ··  ··  ··  📺  ··  ··  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  📺  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  ··  ··  ··  ··  🖥️  🖥️  🎧  ··  ██  │
 │ ██  ··  ··  ··  ··  💺  ··  ··  ··  ██  │
 │ ██  💤  ··  ··  ··  ··  ··  ··  💤  ██  │
 │ ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  │
 └────────────────────────────────────────────┘
```

- Antenna tower in NW corner (tall decoration)
- Satellite dish in NE corner
- 3 small screens on west wall
- Desk + monitor + headset in south area
- Signal wave effects at antenna (animated decoration)

### 4.9 Ops Room Blueprint

```
 ┌────────────────────────────────────────────┐
 │ ██  ██  ██  ██  🚪  🚪  ██  ██  ██  ██  │
 │ ██  🗄️  ··  📺  📺  📺  ··  ··  ··  ██  │
 │ ██  🗄️  ··  📺  ··  📺  ··  ··  ··  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  🚦  ██  │
 │ ██  ··  💺  🍽️  🍽️  ··  ··  ··  🚦  ██  │
 │ ██  ··  ··  🍽️  🍽️  💺  ··  ··  ··  ██  │
 │ ██  ··  ··  ··  ··  ··  ··  ··  ··  ██  │
 │ ██  💺  ··  ··  ··  ··  ··  🧯  ··  ██  │
 │ ██  💤  ··  ··  ··  ··  ··  ··  💤  ██  │
 │ ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  │
 └────────────────────────────────────────────┘
```

*🚦 = status lights (decoration)*

- Central round table (command table, 2×2)
- 5 wall screens (command center display)
- 3 chairs around the table (interaction: work)
- Filing cabinets NW
- Status lights on east wall
- Fire extinguisher near entrance

### 4.10 Future Customization

Should templates be user-configurable? **Yes, eventually (Phase 5).**

A grid editor would let users:
1. View room blueprint as a 2D grid
2. Drag-and-drop props onto cells
3. Mark cells as walkable/blocked
4. Save custom blueprints per team/instance

This is a natural extension of the grid system but not required for the initial implementation. The data model should support it from the start.

---

## 5. Data Model

### 5.1 Core Types

```typescript
// ─── Cell Types ─────────────────────────────────────────────────

type CellType = 'empty' | 'wall' | 'door' | 'furniture' | 'decoration' | 'interaction'

type InteractionType = 'work' | 'coffee' | 'rest' | 'think' | 'observe'

type Rotation = 0 | 90 | 180 | 270

interface GridCell {
  type: CellType
  walkable: boolean               // derived from type, but explicit for fast lookups

  // Prop rendering
  propId?: string                 // e.g., 'desk', 'server-rack', 'coffee-machine'
  rotation?: Rotation             // orientation of the prop (clockwise from north)

  // Multi-cell props
  span?: {
    width: number                 // cells wide (x-axis)
    depth: number                 // cells deep (z-axis)
  }
  anchorRef?: {                   // for continuation cells: reference to anchor
    x: number
    z: number
  }

  // Interaction
  interactionType?: InteractionType
  interactionFacing?: Rotation    // which direction the bot faces when interacting

  // Metadata
  label?: string                  // human-readable label for editor UI
}
```

### 5.2 Room Blueprint

```typescript
interface DoorPosition {
  /** Cell coordinates within the room grid */
  x: number
  z: number
  /** Which wall this door is on */
  facing: 'north' | 'south' | 'east' | 'west'
  /** Width in cells (typically 2) */
  width: number
}

interface RoomBlueprint {
  /** Blueprint identifier (e.g., 'headquarters', 'dev-room') */
  id: string
  /** Human-readable name */
  name: string
  /** Display icon */
  icon?: string

  /** Grid dimensions in cells */
  gridWidth: number               // typically 20
  gridDepth: number               // typically 20

  /** World units per cell */
  cellSize: number                // 0.6

  /** 2D array of cells [z][x] (row-major, z=0 is north/back wall) */
  cells: GridCell[][]

  /** Door positions (derived from cells but stored for quick lookup) */
  doors: DoorPosition[]

  /** Pre-computed walkable cell list for pathfinding */
  walkableCells?: { x: number; z: number }[]

  /** Pre-computed interaction points by type */
  interactionPoints?: {
    type: InteractionType
    cells: { x: number; z: number; facing: Rotation }[]
  }[]
}
```

### 5.3 Building Layout

```typescript
interface RoomPlacement {
  /** Reference to blueprint */
  blueprintId: string
  /** Position in building grid (macro cell coordinates) */
  gridX: number
  gridZ: number
  /** Associated room data (from useRooms) */
  roomId: string
}

interface HallwaySegment {
  /** Start and end in building grid coordinates */
  from: { x: number; z: number }
  to: { x: number; z: number }
  /** Orientation */
  direction: 'horizontal' | 'vertical'
  /** Width in world units */
  width: number
}

interface BuildingLayout {
  /** Building grid dimensions (in macro cells) */
  gridWidth: number
  gridDepth: number

  /** Room placements */
  rooms: RoomPlacement[]

  /** Hallway connections */
  hallways: HallwaySegment[]

  /** Parking area */
  parking?: {
    gridX: number
    gridZ: number
    width: number                 // world units
    depth: number                 // world units
  }

  /** Entrance position */
  entrance?: {
    x: number                     // world units
    z: number
    width: number
  }
}
```

### 5.4 Pathfinding State

```typescript
interface PathfindingGrid {
  /** Flat walkability map: true = walkable */
  walkable: boolean[][]           // [z][x]
  width: number
  height: number
}

interface BotPath {
  /** Sequence of cell coordinates */
  waypoints: { x: number; z: number }[]
  /** Current index in the waypoint list */
  currentIndex: number
  /** Whether the bot has reached the final waypoint */
  completed: boolean
}

interface CellReservation {
  /** Bot session key */
  botKey: string
  /** Cell position */
  x: number
  z: number
  /** Reservation type */
  type: 'current' | 'target'
}
```

### 5.5 Helper: Blueprint to Walkable Grid

```typescript
function blueprintToWalkableGrid(blueprint: RoomBlueprint): boolean[][] {
  return blueprint.cells.map(row =>
    row.map(cell => cell.walkable)
  )
}

function getInteractionCells(
  blueprint: RoomBlueprint,
  type: InteractionType,
): { x: number; z: number; facing: Rotation }[] {
  const results: { x: number; z: number; facing: Rotation }[] = []
  for (let z = 0; z < blueprint.gridDepth; z++) {
    for (let x = 0; x < blueprint.gridWidth; x++) {
      const cell = blueprint.cells[z][x]
      if (cell.type === 'interaction' && cell.interactionType === type) {
        results.push({ x, z, facing: cell.interactionFacing ?? 0 })
      }
    }
  }
  return results
}
```

---

## 6. Rendering Pipeline

### 6.1 Blueprint → Three.js Meshes

The rendering pipeline transforms a `RoomBlueprint` into a React Three Fiber scene:

```
RoomBlueprint (data)
    ↓
GridCellRenderer (iterates cells)
    ↓
PropRegistry.get(propId) → React component
    ↓
Three.js mesh at (cellX * cellSize, 0, cellZ * cellSize)
```

**New component: `GridRoomRenderer`**

```tsx
interface GridRoomRendererProps {
  blueprint: RoomBlueprint
  roomPosition: [number, number, number]  // world-space offset
  roomColor: string                       // accent color
}

function GridRoomRenderer({ blueprint, roomPosition, roomColor }: GridRoomRendererProps) {
  const { cellSize, gridWidth, gridDepth, cells } = blueprint
  const roomWidth = gridWidth * cellSize
  const roomDepth = gridDepth * cellSize

  return (
    <group position={roomPosition}>
      {/* Floor */}
      <RoomFloor color={roomColor} size={roomWidth} />

      {/* Walls — generated from grid edges */}
      <GridWalls cells={cells} cellSize={cellSize} roomColor={roomColor} />

      {/* Props — one per anchor cell */}
      {cells.flatMap((row, z) =>
        row.map((cell, x) => {
          if (!cell.propId || cell.anchorRef) return null  // skip empty & continuation cells
          const worldX = (x - gridWidth / 2 + 0.5) * cellSize
          const worldZ = (z - gridDepth / 2 + 0.5) * cellSize
          const rotation = ((cell.rotation ?? 0) * Math.PI) / 180
          return (
            <PropRenderer
              key={`${x}-${z}`}
              propId={cell.propId}
              position={[worldX, 0.16, worldZ]}
              rotation={[0, rotation, 0]}
              cellSize={cellSize}
              span={cell.span}
            />
          )
        })
      )}
    </group>
  )
}
```

### 6.2 Prop Registry

A registry maps `propId` strings to React components:

```tsx
const PROP_REGISTRY: Record<string, React.FC<PropRendererProps>> = {
  'desk':            DeskProp,
  'desk-monitor':    DeskWithMonitorProp,
  'standing-desk':   StandingDeskProp,
  'chair':           ChairProp,
  'server-rack':     ServerRackProp,
  'coffee-machine':  CoffeeMachineProp,
  'water-cooler':    WaterCoolerProp,
  'whiteboard':      WhiteboardProp,
  'notice-board':    NoticeBoardProp,
  'plant':           PlantProp,
  'lamp':            LampProp,
  'easel':           EaselProp,
  'bookshelf':       BookshelfProp,
  'bean-bag':        BeanBagProp,
  'round-table':     RoundTableProp,
  'small-screen':    SmallScreenProp,
  'conveyor-belt':   ConveyorBeltProp,
  'gear':            GearMechanismProp,
  'control-panel':   ControlPanelProp,
  'satellite':       SatelliteDishProp,
  'antenna':         AntennaTowerProp,
  'headset':         HeadsetProp,
  'filing-cabinet':  FilingCabinetProp,
  'extinguisher':    FireExtinguisherProp,
  'clock':           WallClockProp,
  'status-lights':   StatusLightsProp,
  'cables':          CableMessProp,
  'bar-chart':       BarChartProp,
  'mood-board':      MoodBoardProp,
  'presentation':    PresentationScreenProp,
  'megaphone':       MegaphoneProp,
  'drawing-tablet':  DrawingTabletProp,
  'color-palette':   ColorPaletteProp,
  'desk-lamp':       DeskLampProp,
}
```

Existing prop components from `RoomProps.tsx` can be reused directly — they just need to accept grid-based positioning instead of hardcoded coordinates.

### 6.3 Wall Generation from Grid Edges

```tsx
function GridWalls({ cells, cellSize, roomColor }: GridWallsProps) {
  const wallSegments = useMemo(() => {
    const segments: WallSegmentData[] = []

    for (let z = 0; z < cells.length; z++) {
      for (let x = 0; x < cells[z].length; x++) {
        const cell = cells[z][x]
        if (cell.type !== 'wall') continue

        // Check each edge: if the neighbor is walkable, this is a visible wall face
        // Merge adjacent wall cells into longer segments for fewer draw calls
        // ...
      }
    }

    return mergeAdjacentWallSegments(segments)
  }, [cells, cellSize])

  return (
    <>
      {wallSegments.map(seg => (
        <WallMesh key={seg.key} {...seg} accentColor={roomColor} />
      ))}
    </>
  )
}
```

**Wall merging:** Adjacent wall cells on the same edge are merged into a single long box mesh. A 20-cell wall becomes 1 mesh instead of 20, dramatically reducing draw calls.

### 6.4 Instancing Opportunities

Many props repeat across rooms. Use `InstancedMesh` for:

| Prop | Instances | Savings |
|------|-----------|---------|
| Desk | ~8-10 across all rooms | 8 draw calls → 1 |
| Chair | ~10-12 | 10 → 1 |
| Small screen | ~8-10 | 8 → 1 |
| Plant | ~5-6 | 5 → 1 |
| Wall segments | ~40-60 | 40 → 1 (per wall type) |

**Implementation:** Group all instances of the same `propId` across all rooms into a single `InstancedMesh`. Each instance gets a unique transform matrix:

```tsx
function InstancedProps({ allRoomBlueprints }: { allRoomBlueprints: RoomBlueprint[] }) {
  // Collect all instances per propId
  const instances = useMemo(() => {
    const map = new Map<string, THREE.Matrix4[]>()
    for (const bp of allRoomBlueprints) {
      for (let z = 0; z < bp.gridDepth; z++) {
        for (let x = 0; x < bp.gridWidth; x++) {
          const cell = bp.cells[z][x]
          if (!cell.propId || cell.anchorRef) continue
          const matrix = new THREE.Matrix4()
          // ... compute world position from room position + cell position
          const list = map.get(cell.propId) || []
          list.push(matrix)
          map.set(cell.propId, list)
        }
      }
    }
    return map
  }, [allRoomBlueprints])

  return (
    <>
      {Array.from(instances.entries()).map(([propId, matrices]) => (
        <InstancedProp key={propId} propId={propId} matrices={matrices} />
      ))}
    </>
  )
}
```

### 6.5 Performance Considerations

| Aspect | Current | Grid-Based | Impact |
|--------|---------|------------|--------|
| **Mesh count** | ~200-300 individual meshes | ~50-80 (instanced + merged walls) | 3-4x fewer draw calls |
| **Pathfinding** | None (random point) | A* on 400-cell grid | <1ms per path, negligible |
| **Memory** | Prop components hold refs | 8 rooms × 400 cells × ~20 bytes = ~64KB | Negligible |
| **Grid data** | N/A | Serializable JSON blueprints (~2KB each) | Trivial |
| **Culling** | Per-mesh frustum culling | Per-room group culling (skip entire room if off-screen) | Better |

---

## 7. Migration Path

### Phase 1: Data Model + Blueprints (Data Only)

**Effort: ~2-3 days**
**Risk: None (no rendering changes)**

- Define TypeScript interfaces (`GridCell`, `RoomBlueprint`, `BuildingLayout`)
- Create blueprint data files for all 8 room types
- Write helper functions: `blueprintToWalkableGrid()`, `getInteractionCells()`
- Write A* pathfinding module (pure function, no React dependency)
- Write unit tests for pathfinding and blueprint validation
- **No UI changes** — existing rendering continues to work

**Files created:**
```
src/components/world3d/grid/
├── types.ts              — GridCell, RoomBlueprint, BuildingLayout
├── blueprints/
│   ├── headquarters.ts
│   ├── dev-room.ts
│   ├── creative-room.ts
│   ├── marketing-room.ts
│   ├── thinking-room.ts
│   ├── automation-room.ts
│   ├── comms-room.ts
│   └── ops-room.ts
├── pathfinding.ts        — A* implementation
├── gridUtils.ts          — walkable mask, cell queries
└── __tests__/
    ├── pathfinding.test.ts
    └── blueprints.test.ts
```

### Phase 2: Grid-Based Prop Renderer

**Effort: ~3-4 days**
**Risk: Medium (visual changes, but room-by-room rollout possible)**

- Create `GridRoomRenderer` component
- Create `PropRegistry` mapping `propId → React component`
- Refactor existing prop components to accept grid-based positioning
- Add feature flag: `useGridRenderer` (per room or global)
- Replace `RoomProps.tsx` hardcoded functions with `GridRoomRenderer`
- Visual regression testing: compare grid-rendered rooms vs current

**Files modified:**
```
src/components/world3d/
├── Room3D.tsx            — conditionally use GridRoomRenderer
├── RoomProps.tsx          — keep as fallback, mark deprecated
└── grid/
    ├── GridRoomRenderer.tsx
    └── PropRegistry.ts
```

### Phase 3: Grid-Based Bot Pathfinding

**Effort: ~2-3 days**
**Risk: Medium (behavior change, but gradual rollout)**

- Replace `wanderState` random-point logic with A* pathfinding
- Replace `getRoomInteractionPoints()` with grid cell lookups
- Replace `getWalkableCenter()` with grid-derived walkable mask
- Bots pathfind to interaction cells instead of hardcoded positions
- Add cell reservation system for collision avoidance
- Feature flag: `useGridPathfinding`

**Files modified:**
```
src/components/world3d/
├── Bot3D.tsx              — use path waypoints instead of random targets
├── BotAnimations.tsx      — read interaction points from blueprint
└── grid/
    ├── pathfinding.ts     — integrate with bot movement
    └── botMovement.ts     — path following, reservation system
```

### Phase 4: Grid-Based Wall Generation

**Effort: ~2 days**
**Risk: Low (walls look the same, just generated differently)**

- Create `GridWalls` component that reads cell data
- Merge adjacent wall cells into long segments
- Generate door openings from `door` cells
- Replace `RoomWalls.tsx` static wall placement
- Verify accent strips and cap spheres still look correct

**Files modified:**
```
src/components/world3d/
├── RoomWalls.tsx          — keep as fallback
└── grid/
    └── GridWalls.tsx      — wall generation from grid edges
```

### Phase 5: Visual Grid Editor (Future)

**Effort: ~5-7 days**
**Risk: Low (additive feature)**

- 2D grid editor component (HTML canvas or SVG overlay)
- Drag-and-drop props from a palette onto grid cells
- Real-time 3D preview
- Save/load custom blueprints
- Per-team room customization (stored in backend)
- Undo/redo support

This phase is optional and depends on user demand for room customization.

---

## 8. Comparison: Current vs Grid

| Aspect | Current System | Grid-Based System |
|--------|---------------|-------------------|
| **Prop placement** | Hardcoded xyz coordinates in code (`[-h + 2.5 * s, Y, h - 2.5 * s]`) | Cell-snapped: `cells[2][3] = { propId: 'desk' }` |
| **Adding a new room** | Write ~30 lines of position math per room type | Define a 20×20 cell array (data, not code) |
| **Moving furniture** | Change coordinate values, rebuild, visually verify | Change cell in blueprint array |
| **Bot navigation** | Random point in circular zone, straight-line lerp | A* pathfinding on walkable grid |
| **Collision avoidance** | None — bots clip through furniture | Impossible — non-walkable cells block paths |
| **Bot stacking** | ±0.4 unit jitter (bots overlap at interaction points) | Cell reservation system (max 1 bot per cell) |
| **Interaction points** | 3 hardcoded points per room (desk, coffee, sleep) | Arbitrary number of typed cells per room |
| **Wall generation** | 4 manual box meshes per room | Auto-generated from grid boundary cells |
| **Door placement** | Fixed 3-unit gap at front wall center | Configurable door cells on any wall |
| **Room shapes** | Rectangular only (12×12) | Any shape expressible in a grid (L-shapes, irregular) |
| **Maintenance** | Edit `RoomProps.tsx` (900+ lines) + `BotAnimations.tsx` | Edit blueprint data files |
| **Rendering perf** | ~200-300 individual meshes | ~50-80 with instancing + wall merging |
| **Customization** | Code change required | Blueprint data change (future: visual editor) |
| **Data format** | Embedded in React components | Serializable JSON (exportable, version-controllable) |

---

## 9. Risks & Considerations

### 9.1 Cell Size Granularity

**Risk:** Too large → rooms look blocky, props don't fit well. Too small → excessive grid complexity.

| Cell Size | Grid Dims | Cells/Room | Fit Quality | Complexity |
|-----------|-----------|------------|-------------|------------|
| 1.0 | 12×12 | 144 | Poor — desk wider than 1 cell | Very low |
| 0.6 | 20×20 | 400 | Good — desk = 3×2 cells, fine control | Low |
| 0.5 | 24×24 | 576 | Great — very precise | Medium |
| 0.3 | 40×40 | 1600 | Overkill | High |

**Recommendation:** Start with **0.6 units/cell**. If props need finer positioning, can migrate to 0.5 without changing the architecture.

### 9.2 Non-Rectangular Props

Some props don't fit neatly into rectangular cell spans:
- **Round table** (circular) → approximate as 2×2 square
- **Easel** (triangular footprint) → 2×1 with padding
- **Cable mess** (irregular floor scatter) → 2×2 walkable decoration

**Mitigation:** Props render at any size/shape — the grid only constrains their *footprint* for walkability. Visual overhang beyond cell boundaries is fine.

### 9.3 Diagonal Movement Looks Robotic

Grid-locked movement with only cardinal/diagonal directions can look mechanical.

**Mitigations (see §3.5):**
- Eased interpolation between cell centers
- Position jitter (±0.1 units)
- Speed variation (±10%)
- Path smoothing for straight segments
- These combined make movement look natural in testing of similar systems

### 9.4 Memory Impact

- 8 rooms × 400 cells × ~32 bytes/cell ≈ **100 KB** (negligible)
- Pathfinding state: A* open/closed sets ≈ 400 entries max ≈ **10 KB** per active path search
- Reservation map: ~30 bots × 2 reservations ≈ **240 bytes**
- **Total: well under 1 MB**

### 9.5 Migration Effort Estimates

| Phase | Effort | Dependencies | Risk |
|-------|--------|-------------|------|
| Phase 1: Data model + blueprints | 2-3 days | None | None |
| Phase 2: Grid prop renderer | 3-4 days | Phase 1 | Medium |
| Phase 3: Bot pathfinding | 2-3 days | Phase 1 | Medium |
| Phase 4: Wall generation | 2 days | Phase 1 | Low |
| Phase 5: Visual editor | 5-7 days | Phases 1-4 | Low |
| **Total (Phases 1-4)** | **9-12 days** | | |

Phases 2, 3, and 4 can be done in parallel after Phase 1. Feature flags allow gradual rollout.

### 9.6 Backward Compatibility

- Current `RoomProps.tsx` and `RoomWalls.tsx` remain as fallbacks
- Feature flag toggles between old and new rendering
- No backend changes required (grid data is client-side only in Phases 1-4)
- Blueprint data can be loaded from JSON files or inlined constants

### 9.7 Cross-Room Pathfinding (Future)

The current proposal handles pathfinding **within a single room**. Cross-room movement (bot walking through hallway to another room) requires:
- A building-level walkable grid (hallways + room doors)
- Multi-segment paths: room A → door → hallway → door → room B
- This is not needed for current bot behavior (bots teleport between rooms on reassignment)
- Can be added later by connecting room grids via door cells to hallway grids

### 9.8 Props with Vertical Dimension

Some props are wall-mounted (whiteboard, wall clock, screens) rather than floor-placed:
- These occupy a cell for walkability purposes but render at wall height
- Grid cell can include a `mountHeight` or `wallMounted: boolean` flag
- Or: wall-mounted props are treated as `decoration` (walkable) since they don't block floor movement

---

## Appendix A: A* Pathfinding Reference Implementation

```typescript
interface PathNode {
  x: number
  z: number
  g: number      // cost from start
  h: number      // heuristic to goal
  f: number      // g + h
  parent: PathNode | null
}

const DIRECTIONS = [
  { dx: 0, dz: -1, cost: 1 },     // north
  { dx: 0, dz: 1, cost: 1 },      // south
  { dx: -1, dz: 0, cost: 1 },     // west
  { dx: 1, dz: 0, cost: 1 },      // east
  { dx: -1, dz: -1, cost: 1.414 }, // NW
  { dx: 1, dz: -1, cost: 1.414 },  // NE
  { dx: -1, dz: 1, cost: 1.414 },  // SW
  { dx: 1, dz: 1, cost: 1.414 },   // SE
]

export function findPath(
  walkable: boolean[][],
  start: { x: number; z: number },
  goal: { x: number; z: number },
  reserved?: Set<string>,         // "x,z" keys of reserved cells
): { x: number; z: number }[] | null {
  const height = walkable.length
  const width = walkable[0].length

  if (!walkable[start.z]?.[start.x] || !walkable[goal.z]?.[goal.x]) return null

  const key = (x: number, z: number) => `${x},${z}`

  const openSet = new Map<string, PathNode>()
  const closedSet = new Set<string>()

  const startNode: PathNode = {
    x: start.x, z: start.z,
    g: 0,
    h: Math.abs(goal.x - start.x) + Math.abs(goal.z - start.z),
    f: 0,
    parent: null,
  }
  startNode.f = startNode.g + startNode.h
  openSet.set(key(start.x, start.z), startNode)

  while (openSet.size > 0) {
    // Find node with lowest f
    let current: PathNode | null = null
    for (const node of openSet.values()) {
      if (!current || node.f < current.f) current = node
    }
    if (!current) break

    if (current.x === goal.x && current.z === goal.z) {
      // Reconstruct path
      const path: { x: number; z: number }[] = []
      let node: PathNode | null = current
      while (node) {
        path.unshift({ x: node.x, z: node.z })
        node = node.parent
      }
      return path
    }

    const currentKey = key(current.x, current.z)
    openSet.delete(currentKey)
    closedSet.add(currentKey)

    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.dx
      const nz = current.z + dir.dz
      const nKey = key(nx, nz)

      if (nx < 0 || nx >= width || nz < 0 || nz >= height) continue
      if (!walkable[nz][nx]) continue
      if (closedSet.has(nKey)) continue
      if (reserved?.has(nKey)) continue

      // Prevent diagonal corner-cutting
      if (dir.dx !== 0 && dir.dz !== 0) {
        if (!walkable[current.z][current.x + dir.dx] ||
            !walkable[current.z + dir.dz][current.x]) continue
      }

      const g = current.g + dir.cost
      const existing = openSet.get(nKey)
      if (existing && g >= existing.g) continue

      const h = Math.abs(goal.x - nx) + Math.abs(goal.z - nz)
      const node: PathNode = { x: nx, z: nz, g, h, f: g + h, parent: current }
      openSet.set(nKey, node)
    }
  }

  return null // no path found
}
```

---

## Appendix B: Blueprint Data Format (JSON Example)

```json
{
  "id": "dev-room",
  "name": "Dev Room",
  "icon": "🔧",
  "gridWidth": 10,
  "gridDepth": 10,
  "cellSize": 1.2,
  "cells": [
    [
      {"type":"wall","walkable":false},
      {"type":"wall","walkable":false},
      {"type":"wall","walkable":false},
      {"type":"wall","walkable":false},
      {"type":"door","walkable":true},
      {"type":"door","walkable":true},
      {"type":"wall","walkable":false},
      {"type":"wall","walkable":false},
      {"type":"wall","walkable":false},
      {"type":"wall","walkable":false}
    ],
    "... (remaining rows)"
  ],
  "doors": [
    {"x": 4, "z": 0, "facing": "north", "width": 2}
  ]
}
```

Blueprints can be stored as:
- **TypeScript constants** (Phases 1-4): imported directly, type-safe
- **JSON files** (Phase 5): loaded at runtime for user-customizable rooms
- **Database records** (future): per-team custom blueprints stored in backend

---

*This document serves as a reference for implementing the grid-based system. Each phase can be implemented and tested independently. The architecture is designed to coexist with the current system during migration.*
