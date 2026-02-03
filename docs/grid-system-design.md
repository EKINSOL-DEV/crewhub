# Grid-Based Room & Building System — Design Document

*Version: 1.0 — 2026-02-03*
*Authors: Claude Opus (architecture), with GPT-5.2 review incorporated*
*Status: Proposal / RFC*

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Grid Architecture](#2-grid-architecture)
3. [Bot Pathfinding](#3-bot-pathfinding)
4. [Room Blueprints](#4-room-blueprints)
5. [Data Model](#5-data-model)
6. [Rendering Pipeline](#6-rendering-pipeline)
7. [Migration Path](#7-migration-path)
8. [Current vs Grid Comparison](#8-current-vs-grid-comparison)
9. [Risks & Considerations](#9-risks--considerations)
10. [GPT-5.2 Feedback & Hybrid Recommendation](#10-gpt-52-feedback--hybrid-recommendation)

---

## 1. Current State Analysis

### How It Works Now

#### Room Rendering (`Room3D.tsx`)
Each room is a self-contained `<group>` at a given world position with a fixed `size` (default 12 units). The room composes:
- `<RoomFloor />` — toon-shaded floor tiles
- `<RoomWalls />` — low perimeter walls with a door opening
- `<RoomNameplate />` — floating sign above room
- `<RoomProps />` — room-specific furniture

Rooms are placed in a grid layout by `World3DView` with fixed spacing. There is no concept of hallways, corridors, or shared walls between rooms.

#### Prop Placement (`RoomProps.tsx`)
Props are placed with **hardcoded absolute positions** calculated from `roomSize` and a scale factor `s = roomSize / 12`. Each room type has a dedicated React component (e.g., `DevRoomProps`, `HeadquartersProps`) that manually positions every piece of furniture:

```tsx
// Example from DevRoomProps — every position is a manual calculation
<Desk position={[-h + 2.5 * s, Y, h - 2.5 * s]} rotation={[0, Math.PI / 6, 0]} />
<Monitor position={[-h + 2.3 * s, Y + 0.78, h - 2.4 * s]} rotation={[0, Math.PI / 6, 0]} />
<Chair position={[-h + 3.2 * s, Y, h - 3.5 * s]} rotation={[0, Math.PI + Math.PI / 6, 0]} />
```

There are **~30+ unique mini-prop components** (Whiteboard, ServerRack, Easel, ConveyorBelt, GearMechanism, etc.) all defined inline in `RoomProps.tsx` — a 900+ line file. Props have no concept of their own footprint, bounding box, or occupied floor area.

#### Bot Wandering (`Bot3D.tsx`)
Bots maintain a `wanderState` ref with `currentX/Z` and `targetX/Z`. Movement works as follows:
1. **Active bots** walk to their desk's `interactionPoints.deskPosition` and freeze there (working animation).
2. **Idle bots** either walk to the coffee machine (50% chance if available) or wander randomly within a circular "walkable center" zone.
3. **Sleeping bots** walk to a corner (`sleepCorner`) and play sleep animation.
4. **Offline bots** freeze in place and fade to 40% opacity.

Random wandering picks a point within a circular safe zone (`WalkableCenter`) defined per room type in `BotAnimations.tsx`.

#### Bot Animations (`BotAnimations.tsx`)
The animation state machine has phases: `walking-to-desk`, `working`, `idle-wandering`, `getting-coffee`, `sleeping-walking`, `sleeping`, `offline`. Transitions are driven by `status` changes and the `arrived` flag (set when bot is within 0.3 units of target).

Interaction points are defined per room type as hardcoded offsets:
```tsx
// Each room type maps to specific furniture positions
case 'headquarters':
  return {
    deskPosition: [rx + (-h + 3 * s), 0, rz + (h - 3 * s)],
    coffeePosition: [rx + (h - 1.5 * s), 0, rz + (-h + 2.5 * s)],
    sleepCorner: [rx + (h - 2 * s), 0, rz + (h - 2 * s)],
  }
```

### Pain Points

| Problem | Severity | Root Cause |
|---------|----------|------------|
| **Bots walk through furniture** | High | No collision detection; walkable zone is a simple circle that doesn't account for prop footprints |
| **Props clip into each other** | Medium | Positions are hardcoded magic numbers; no overlap validation |
| **Interaction points don't match props** | Medium | `BotAnimations.tsx` duplicates position logic from `RoomProps.tsx`; they can drift apart |
| **Adding new room types is tedious** | Medium | Must manually calculate every position; no reusable templates or snapping |
| **Walkable zones are inaccurate** | Medium | Circular zones per room type are manually tuned; don't adapt to prop changes |
| **No concept of room boundaries for navigation** | Low | Bots can only wander within their room; no inter-room movement |
| **Single Y-plane assumed** | Low | Everything at `Y = 0.16`; no multi-level support |
| **Prop jitter for multiple bots** | Low | Bots add random jitter `(Math.random() - 0.5) * 0.8` to avoid stacking on same desk; sometimes places them inside furniture |
| **900+ line RoomProps.tsx** | Low | Every prop component is defined inline; no separation of prop definition from layout |

### Key Metrics (Current)
- **Room types:** 8 (headquarters, dev, creative, marketing, thinking, automation, comms, ops) + default
- **Unique prop types:** ~30 (Desk, Monitor, Chair, Lamp, Plant, ServerRack, Whiteboard, Easel, ConveyorBelt, etc.)
- **Interaction points per room:** 3 (desk, coffee, sleep corner)
- **Bot count per room:** typically 1-5
- **Room size:** fixed 12×12 units

---

## 2. Grid Architecture

### 2.1 Room Grid (Interior)

Each room's interior is divided into an NxN grid of cells. Given the current room size of 12 units:

**Cell size: 0.5 units** (recommended — see §9 for trade-off analysis)

This yields a **24×24 grid per room** (576 cells). At 0.5 units per cell:
- A chair occupies ~1×1 cells (0.5×0.5 real units)
- A desk occupies ~3×2 cells (1.5×1.0 real units)
- A round table occupies ~4×4 cells (2.0×2.0 real units)
- Walkable paths need ~2 cells width (1.0 real unit) for comfortable bot passage

#### Cell Types

```typescript
enum CellType {
  EMPTY = 0,         // Walkable floor
  BLOCKED = 1,       // Occupied by furniture (non-walkable)
  PROP_ANCHOR = 2,   // Origin cell of a multi-cell prop
  INTERACTION = 3,   // Where a bot stands to use a prop (walkable + semantic)
  WALL = 4,          // Perimeter wall cell
  DOOR = 5,          // Entrance/exit opening
  RESERVED = 6,      // Clearance zone (walkable but not for prop placement)
}
```

#### Prop Snapping

Props snap to grid cells based on their **footprint** — a rectangular region of cells they occupy:

```
Desk (3×2 footprint, facing south):
  ┌─┬─┬─┐
  │B│B│B│  B = BLOCKED
  │B│A│B│  A = PROP_ANCHOR (origin, where the desk "is")
  └─┴─┴─┘
  │I│ │I│  I = INTERACTION (chairs go here)
```

Props define:
- `footprint: [width, depth]` in cells
- `anchorOffset: [x, z]` — which cell in the footprint is the "origin"
- `interactionCells: Array<{dx, dz, facing}>` — relative cells where bots stand to use it
- `clearanceCells: Array<{dx, dz}>` — cells that should stay empty but aren't blocked

### 2.2 Building Grid (Room Placement)

At the building level, rooms are placed on a **coarser grid**:

**Building cell size: 1 room unit** (each cell can hold a room section or hallway)

```
Building Layout (example):
  ┌────────┬────────┬────────┐
  │  Dev   │Hallway │Creative│
  │  Room  │        │ Room   │
  ├────────┼────────┼────────┤
  │Hallway │ Lobby  │Hallway │
  │        │        │        │
  ├────────┼────────┼────────┤
  │  Ops   │Hallway │ Comms  │
  │  Room  │        │  Room  │
  └────────┴────────┴────────┘
```

Room sizes can vary (small: 8×8, medium: 12×12, large: 16×16). The building grid handles:
- Room placement and sizing
- Hallway generation between adjacent rooms
- Shared wall detection (rooms sharing an edge → single wall)
- Door placement (aligned with hallway connections)

### 2.3 Wall Auto-Generation

Walls are generated from grid edges rather than being manually placed:

**Rules:**
1. Every room-edge cell on the boundary gets a `WALL` cell type
2. Where two rooms are adjacent, the shared edge gets a single wall (not double)
3. Doors are placed where a room edge meets a hallway
4. Internal walls (subdivisions) can be defined in blueprints as `WALL` cells mid-room

**Algorithm:**
```
For each room:
  1. Mark perimeter cells as WALL
  2. For each adjacent room/hallway:
     a. Find shared edge cells
     b. Remove WALL from 2-3 consecutive cells → DOOR
     c. If adjacent to hallway: align door with hallway center
  3. Generate wall meshes from contiguous WALL cell runs
     (merge consecutive cells into single wall segments for rendering efficiency)
```

Wall meshes are generated as **merged box geometries** — one mesh per continuous wall segment rather than per-cell, for performance.

---

## 3. Bot Pathfinding

### 3.1 Approach: Hybrid Waypoint + Grid Fallback

Given GPT-5.2's valid critique (see §10) and our actual bot count (1-5 per room), we recommend a **hybrid approach**:

**Primary: Semantic waypoint graph** (lightweight, covers 90% of movement)
**Fallback: Grid-based A*** (for edge cases and future extensibility)

#### Waypoint Graph (Primary)

Each room blueprint defines semantic waypoints derived from its grid:

```typescript
interface RoomWaypoint {
  id: string               // e.g., 'desk-1', 'coffee', 'door', 'center'
  position: [number, number, number]  // world-space
  type: 'desk' | 'coffee' | 'sleep' | 'door' | 'social' | 'wander'
  connectedTo: string[]    // IDs of reachable waypoints
  capacity: number         // max bots at this waypoint (1 for desk, 3 for social)
}
```

Waypoints are **auto-generated from the grid blueprint**:
1. Every `INTERACTION` cell becomes a waypoint
2. Room center becomes a `wander` waypoint
3. Door cells become `door` waypoints
4. Clear floor areas get 2-3 `wander` waypoints
5. Edges between waypoints are validated: the grid path between them must be clear of `BLOCKED` cells

Bots navigate by:
1. Pick target waypoint (desk when active, coffee when idle, corner when sleeping)
2. Walk along waypoint edges
3. Smooth interpolation with Catmull-Rom spline through waypoint positions

#### Grid A* (Fallback)

When the waypoint graph doesn't have a direct path (e.g., dynamic obstacles, edge cases), fall back to A* on the room grid:

```typescript
function findPath(
  grid: GridCell[][],
  start: GridCoord,
  end: GridCoord
): GridCoord[] {
  // Standard A* with 8-directional movement
  // Heuristic: octile distance (allows diagonal movement)
  // Cost: 1.0 for cardinal, 1.414 for diagonal
  // Blocked cells: BLOCKED, WALL, PROP_ANCHOR
  // Walkable: EMPTY, INTERACTION, RESERVED, DOOR
}
```

**When to recompute paths:**
- Bot status changes (active → idle → sleeping)
- Bot arrives at waypoint and needs next segment
- Every 5 seconds as a stuck-detection fallback
- Never per-frame

### 3.2 Smooth Interpolation

Raw grid/waypoint paths produce angular movement. We smooth via:

1. **Path simplification:** Remove intermediate waypoints that have line-of-sight to the next (raycast on grid)
2. **Catmull-Rom spline:** Fit a smooth curve through remaining waypoints
3. **Speed easing:** Slow down approaching targets, speed up mid-path
4. **Rotation lerp:** Current system's `angleDiff * 0.1` approach works well — keep it

### 3.3 Interaction Targets as Grid Cells

Each prop's `interactionCells` map directly to world positions where bots stand:

```
Desk blueprint:
  ┌─┬─┬─┐
  │ │D│ │  D = desk surface
  │ │D│ │
  └─┴─┴─┘
    │I│    I = interaction cell (bot faces desk, plays typing animation)
```

The interaction cell knows:
- `facing: number` — rotation the bot should have when interacting
- `animation: BotAnimState` — which animation to play (working, getting-coffee, etc.)
- `propId: string` — which prop this interaction belongs to

This replaces the current manual `getRoomInteractionPoints()` function entirely — interaction points are derived from the blueprint data.

### 3.4 Bot-Bot Avoidance

With only 1-5 bots per room, heavy avoidance isn't needed:

1. **Waypoint capacity:** If a desk waypoint is at capacity, idle bots pick another
2. **Jitter on arrival:** Small random offset (±0.2 units) from exact waypoint position
3. **Simple separation:** If two bots are within 0.5 units, apply gentle repulsion force

---

## 4. Room Blueprints

### 4.1 Blueprint Concept

Each room type has a **blueprint** — a data-driven template that defines:
- Grid dimensions
- Cell map (which cells are blocked, walkable, interaction points)
- Prop list with grid positions
- Waypoints (auto-generated or manually placed)
- Wall openings / door positions

### 4.2 ASCII Art Layouts

#### Dev Room (24×24 grid, 0.5u cells, 12×12 real units)

```
Legend: . = empty/walkable  # = wall  D = door  
        d = desk  m = monitor  c = chair  s = server rack
        w = whiteboard (wall-mounted)  L = lamp  C = cables
        i = interaction point

  ########################
  #d d m . . . . . d d m#
  #d d . . . . . . d d .#
  #. i . . . . . . . i .#
  #c . . . . . . . . . c#
  #. . . . . . . . . . .#
  #. . . . . . . . . . .#
  #. . . C . . . . . . .#
  #. . . . . . . . . . .#
  #. . . . . . . . . . .#
  #. . . . . . . . . . .#
  #L . . . . . . . . . s#
  #. . . . . . . . . . s#
  ## ## ## #DD# ## ## ## #
        wwwwwwww
  (whiteboard on back wall, not shown in grid)
```

#### Headquarters (24×24)

```
  ########################
  #. . . . . . . . . . .#
  #. . . . N . . . . . .#    N = notice board (wall)
  #. d d m . . . . . . .#
  #. d d . . . . . . . .#
  #. . i . . . . . . . .#
  #. c . . . . . . . . .#
  #. . . . . . . . . . .#
  #. . . . . . . . . . .#
  #W . . . . . . . . . K#    W = water cooler, K = coffee machine
  #. . . . . . . . . . .#
  #. . . . . . . P . . .#    P = plant
  ## ## ## #DD# ## ## ## #
```

#### Thinking Room (24×24)

```
  ########################
  #. . . . . . . . . . .#
  #. . . . . . . . . . .#
  #. . . . . . . . . . B#    B = bookshelf
  #. . . . . . . . . . B#
  #. b . . . . . . . . .#    b = bean bag
  #. . . .T T . . . b .#    T = round table
  #. . . .T T . . . . .#
  #. b . . . . . . . . .#
  #. . . . . . b . . . .#
  #L . . . . . . . . . .#    L = lamp
  #. . . . . . . . . . .#
  ## ## ## #DD# ## ## ## #
  wwwwww (whiteboard on left wall)
```

#### Automation Room (24×24)

```
  ########################
  #. . . . . CK. . . . .#    CK = wall clock
  #S . . . . . . . . . S#    S = small screen (wall)
  #S . . . . . . . . . S#
  #. . . . . . . . . . .#
  #. . . . . . . . . . .#
  #. .CCCCCCCCCCCC. . . .#    C = conveyor belt
  #. . . . . . . . . . .#
  #. . . . . . . . . G .#    G = gear mechanism (wall)
  #P . . . . . . . . . .#    P = control panel
  #P i . . . . . . . . .#
  #. . . . . . . . . . .#
  ## ## ## #DD# ## ## ## #
```

### 4.3 Blueprint Data Model

```typescript
interface RoomBlueprint {
  id: string                          // 'dev', 'headquarters', etc.
  name: string                        // Display name
  gridWidth: number                   // Cells wide (24 for 12-unit room)
  gridHeight: number                  // Cells deep (24)
  cellSize: number                    // World units per cell (0.5)
  
  // Cell map — flattened row-major array
  cells: CellType[]                   // length = gridWidth * gridHeight
  
  // Props placed in this blueprint
  props: BlueprintProp[]
  
  // Auto-generated or manually-defined waypoints
  waypoints: RoomWaypoint[]
  
  // Door positions (relative to room grid)
  doors: DoorDefinition[]
  
  // Wall-mounted decorations (not on grid, attached to walls)
  wallDecor: WallDecoration[]
  
  // Metadata
  defaultSize: number                 // Real-world units (12)
  minBots: number                     // Minimum bots before room feels empty
  maxBots: number                     // Maximum comfortable bot count
  tags: string[]                      // ['office', 'tech', 'creative']
}

interface BlueprintProp {
  type: string                        // 'desk', 'monitor', 'chair', 'server-rack', etc.
  gridX: number                       // Cell X position (anchor cell)
  gridZ: number                       // Cell Z position (anchor cell)
  rotation: 0 | 90 | 180 | 270       // Snap rotation in degrees
  variant?: string                    // Optional variant (e.g., 'standing' for desk)
}

interface DoorDefinition {
  edge: 'north' | 'south' | 'east' | 'west'
  startCell: number                   // Start cell index along that edge
  width: number                       // Door width in cells (typically 2-3)
}

interface WallDecoration {
  type: string                        // 'whiteboard', 'clock', 'screen', 'notice-board'
  wall: 'north' | 'south' | 'east' | 'west'
  positionAlongWall: number           // 0.0 - 1.0 (fraction along wall length)
  height: number                      // Height on wall (world units)
}
```

---

## 5. Data Model

### 5.1 Core Interfaces

```typescript
// ─── Grid Cell ──────────────────────────────────────────────────

enum CellType {
  EMPTY = 0,
  BLOCKED = 1,
  PROP_ANCHOR = 2,
  INTERACTION = 3,
  WALL = 4,
  DOOR = 5,
  RESERVED = 6,
}

interface GridCell {
  type: CellType
  propId?: string           // If BLOCKED/PROP_ANCHOR: which prop occupies this cell
  interactionMeta?: {       // If INTERACTION: metadata for bot behavior
    propId: string          // Which prop this interacts with
    facing: number          // Radians — direction bot should face
    animation: string       // Animation to play ('working', 'coffee', 'sleeping')
    capacity: number        // Max simultaneous bots (usually 1)
  }
}

// ─── Prop Definition (registry) ─────────────────────────────────

interface PropDefinition {
  type: string                            // 'desk', 'monitor', etc.
  displayName: string
  footprint: [number, number]             // [width, depth] in cells
  anchorOffset: [number, number]          // Which cell is the "origin" [x, z]
  interactionCells: InteractionCell[]     // Relative interaction positions
  clearanceCells: [number, number][]      // Cells that should stay empty nearby
  category: 'furniture' | 'tech' | 'decor' | 'utility'
  wallMounted: boolean                    // If true, must be placed against a wall
  stackable: boolean                      // Can another prop be placed on top (e.g., monitor on desk)
  yOffset: number                         // Base Y position (0.16 for floor items)
  component: string                       // React component name to render
}

interface InteractionCell {
  dx: number                // Offset from anchor in cells
  dz: number
  facing: number            // Radians
  animation: string         // Animation state for bot
  capacity: number          // Max bots at this point
}

// ─── Room Blueprint ─────────────────────────────────────────────

// (See §4.3 above for full interface)

// ─── Building Layout ────────────────────────────────────────────

interface BuildingLayout {
  id: string
  name: string
  
  // Building grid (coarse — room-level placement)
  gridWidth: number         // Building grid columns
  gridHeight: number        // Building grid rows
  cellSize: number          // World units per building cell (e.g., 14 = room + padding)
  
  // Room placements
  rooms: RoomPlacement[]
  
  // Hallway segments
  hallways: HallwaySegment[]
  
  // Shared facilities
  sharedAreas: SharedArea[]
}

interface RoomPlacement {
  roomId: string            // Links to Room entity
  blueprintId: string       // Which blueprint to use
  gridX: number             // Building grid X
  gridZ: number             // Building grid Z
  spanX: number             // How many building cells wide (1 = standard, 2 = large room)
  spanZ: number             // How many building cells deep
  rotation: 0 | 90 | 180 | 270
}

interface HallwaySegment {
  fromCell: [number, number]   // Building grid coords
  toCell: [number, number]     // Building grid coords
  width: number                // Hallway width in room-grid cells
}

interface SharedArea {
  type: 'lobby' | 'parking' | 'break-room' | 'garden'
  gridX: number
  gridZ: number
  spanX: number
  spanZ: number
  blueprintId: string
}
```

### 5.2 Prop Registry

A centralized registry maps prop types to their definitions:

```typescript
const PROP_REGISTRY: Record<string, PropDefinition> = {
  'desk': {
    type: 'desk',
    displayName: 'Office Desk',
    footprint: [3, 2],       // 1.5 × 1.0 real units
    anchorOffset: [1, 1],
    interactionCells: [
      { dx: 0, dz: 2, facing: 0, animation: 'working', capacity: 1 },
    ],
    clearanceCells: [[0, 2], [1, 2], [2, 2]],  // Space in front for chair
    category: 'furniture',
    wallMounted: false,
    stackable: true,
    yOffset: 0.16,
    component: 'Desk',
  },
  'chair': {
    type: 'chair',
    displayName: 'Office Chair',
    footprint: [1, 1],
    anchorOffset: [0, 0],
    interactionCells: [],     // Chair is part of desk interaction
    clearanceCells: [],
    category: 'furniture',
    wallMounted: false,
    stackable: false,
    yOffset: 0.16,
    component: 'Chair',
  },
  'server-rack': {
    type: 'server-rack',
    displayName: 'Server Rack',
    footprint: [2, 1],
    anchorOffset: [0, 0],
    interactionCells: [
      { dx: 0, dz: 1, facing: 0, animation: 'working', capacity: 1 },
    ],
    clearanceCells: [[0, 1], [1, 1]],
    category: 'tech',
    wallMounted: false,
    stackable: false,
    yOffset: 0.16,
    component: 'ServerRack',
  },
  'coffee-machine': {
    type: 'coffee-machine',
    displayName: 'Coffee Machine',
    footprint: [1, 1],
    anchorOffset: [0, 0],
    interactionCells: [
      { dx: 0, dz: 1, facing: 0, animation: 'getting-coffee', capacity: 2 },
    ],
    clearanceCells: [[0, 1]],
    category: 'utility',
    wallMounted: false,
    stackable: false,
    yOffset: 0.16,
    component: 'CoffeeMachine',
  },
  'round-table': {
    type: 'round-table',
    displayName: 'Round Table',
    footprint: [4, 4],
    anchorOffset: [2, 2],
    interactionCells: [
      { dx: -1, dz: 3, facing: 0, animation: 'working', capacity: 1 },
      { dx: 3, dz: 1, facing: -Math.PI / 2, animation: 'working', capacity: 1 },
      { dx: 1, dz: -1, facing: Math.PI, animation: 'working', capacity: 1 },
    ],
    clearanceCells: [],
    category: 'furniture',
    wallMounted: false,
    stackable: false,
    yOffset: 0.16,
    component: 'RoundTable',
  },
  // ... more props
}
```

### 5.3 Runtime State

```typescript
interface RuntimeRoomState {
  roomId: string
  blueprint: RoomBlueprint
  
  // Live grid state (cells may change if props are moved at runtime)
  grid: GridCell[][]
  
  // Waypoint graph (generated from blueprint)
  waypoints: Map<string, RoomWaypoint>
  
  // Current bot assignments
  botAssignments: Map<string, {
    waypointId: string      // Which waypoint/interaction point the bot is using
    position: [number, number, number]  // Current world position
    targetWaypointId: string | null     // Where they're heading
  }>
}
```

---

## 6. Rendering Pipeline

### 6.1 Grid → Three.js Meshes

The rendering pipeline transforms grid data into Three.js scene objects:

```
Blueprint JSON
     ↓
[GridParser] → GridCell[][] (2D array)
     ↓
[PropPlacer] → For each BlueprintProp:
     │           1. Look up PropDefinition in registry
     │           2. Convert grid coords → world coords:
     │              worldX = (gridX - gridWidth/2) * cellSize
     │              worldZ = (gridZ - gridHeight/2) * cellSize
     │           3. Apply rotation
     │           4. Render component at world position
     ↓
[WallGenerator] → Scan grid edges:
     │             1. Collect contiguous WALL cells into segments
     │             2. Merge segments into single box meshes
     │             3. Cut openings at DOOR cells
     ↓
[WaypointGenerator] → From INTERACTION + EMPTY cells:
     │                  1. Create waypoint nodes
     │                  2. Validate edges (line-of-sight on grid)
     │                  3. Store as graph for pathfinding
     ↓
[React Three Fiber Scene]
     ├── <RoomFloor /> — unchanged
     ├── <GeneratedWalls /> — from WallGenerator
     ├── <Props /> — from PropPlacer (existing prop components)
     └── <Bot3D /> — uses waypoint graph for navigation
```

### 6.2 Key Rendering Component

```tsx
function GridRoom({ blueprint, roomPosition }: { blueprint: RoomBlueprint; roomPosition: [number, number, number] }) {
  const { props, walls, waypoints } = useMemo(() => {
    const grid = parseBlueprint(blueprint)
    const props = placeProps(blueprint, grid)
    const walls = generateWalls(grid, blueprint)
    const waypoints = generateWaypoints(grid, blueprint)
    return { props, walls, waypoints }
  }, [blueprint])

  return (
    <group position={roomPosition}>
      <RoomFloor color={roomColor} size={blueprint.defaultSize} />
      
      {/* Generated walls from grid edges */}
      {walls.map((segment, i) => (
        <WallSegment key={i} {...segment} />
      ))}
      
      {/* Props from blueprint */}
      {props.map((prop, i) => {
        const Component = PROP_COMPONENTS[prop.type]
        return (
          <Component
            key={i}
            position={prop.worldPosition}
            rotation={prop.worldRotation}
          />
        )
      })}
    </group>
  )
}
```

### 6.3 Performance Considerations

#### Instancing
Props that appear many times across rooms (desks, chairs, monitors) should use `InstancedMesh`:

```tsx
// Instead of 20 separate <Desk /> components:
<instancedMesh args={[deskGeometry, deskMaterial, 20]}>
  {deskPositions.map((pos, i) => (
    <DeskInstance key={i} position={pos} index={i} />
  ))}
</instancedMesh>
```

**Expected savings:** With ~8 rooms × ~5 desks = 40 desk instances, instancing reduces draw calls from 40 to 1 for desk bodies.

#### Geometry Merging for Walls
Wall segments per room are merged into a single `BufferGeometry` using `BufferGeometryUtils.mergeGeometries()`:

```typescript
// Merge all wall segments for a room into one mesh
const wallGeometries = wallSegments.map(s => createWallBox(s))
const mergedWalls = BufferGeometryUtils.mergeGeometries(wallGeometries)
// Single draw call for all walls in a room
```

#### Grid Debug Overlay (Development Only)
An optional debug overlay renders the grid as a wireframe:

```tsx
{__DEV__ && showGridDebug && (
  <GridDebugOverlay
    grid={grid}
    cellSize={blueprint.cellSize}
    position={roomPosition}
  />
)}
```

This helps during blueprint authoring but is stripped in production.

#### Performance Budget

| Metric | Current | With Grid | Target |
|--------|---------|-----------|--------|
| Draw calls per room | ~30-50 (individual props) | ~10-15 (instanced + merged) | <20 |
| Geometry count | ~200 meshes/room | ~50 meshes/room (instanced) | <100 |
| Grid computation | N/A | Once on load + on layout change | <5ms |
| Pathfinding (A*) | N/A | On-demand, cached | <1ms per path |
| Memory per room | ~2MB | ~2.5MB (+grid data ~50KB) | <3MB |

---

## 7. Migration Path

### Phase 0: Data-Driven Prop Placement (1 week)
**Goal:** Extract hardcoded positions into data; no grid yet.

1. Create `room-layouts.json` with current positions extracted from `RoomProps.tsx`
2. Refactor `RoomProps.tsx` to read from data instead of hardcoded JSX
3. Unify `getRoomInteractionPoints()` to read from same data source
4. **Result:** Same visual output, but layout is data-driven and easier to modify

```typescript
// Before (hardcoded):
<Desk position={[-h + 2.5 * s, Y, h - 2.5 * s]} />

// After (data-driven):
{layout.props.map(prop => (
  <PropRenderer key={prop.id} type={prop.type} position={prop.position} rotation={prop.rotation} />
))}
```

### Phase 1: Prop Footprints + Collision Volumes (1 week)
**Goal:** Stop bots walking through furniture.

1. Define `PropDefinition` with footprints for each prop type
2. Generate blocked rectangles from prop positions + footprints
3. Replace circular `WalkableCenter` with polygon-based walkable area
4. Bot movement checks against blocked rectangles before moving
5. **Result:** Bots avoid furniture; still using waypoint-style navigation

### Phase 2: Grid Data Model + Waypoint Generation (1-2 weeks)
**Goal:** Full grid representation; auto-generated waypoints.

1. Implement `GridCell[][]` data model
2. Convert existing room layouts to grid blueprints
3. Auto-generate `RoomWaypoint` graphs from grid data
4. Replace manual `getRoomInteractionPoints()` with grid-derived points
5. Implement waypoint-based navigation (replaces random wandering)
6. **Result:** Bots navigate semantically; interaction points match props perfectly

### Phase 3: Wall Generation from Grid (1 week)
**Goal:** Walls derived from data, not hardcoded.

1. Implement wall auto-generation from grid boundaries
2. Replace `RoomWalls` component with `GridWalls` component
3. Support shared walls between adjacent rooms
4. Auto-place doors based on building layout
5. **Result:** Walls are consistent and data-driven

### Phase 4: Building Layout + Hallways (1-2 weeks)
**Goal:** Multi-room building with corridors.

1. Implement `BuildingLayout` data model
2. Generate hallway segments between rooms
3. Inter-room pathfinding (bot can walk between rooms via hallways)
4. Camera improvements for building-level navigation
5. **Result:** Cohesive building rather than isolated rooms

### Phase 5: Blueprint Editor (2-4 weeks, optional)
**Goal:** Visual tool for creating/editing room layouts.

1. In-app grid overlay with click-to-place props
2. Prop palette, rotation, deletion
3. Footprint validation (prevent overlaps)
4. Waypoint preview
5. Save/load blueprints
6. **Result:** Non-developers can create room layouts

### Timeline Summary

| Phase | Duration | Value Delivered | Risk |
|-------|----------|-----------------|------|
| Phase 0 | 1 week | Data-driven layouts, easier iteration | Very low |
| Phase 1 | 1 week | No more furniture clipping | Low |
| Phase 2 | 1-2 weeks | Smart navigation, proper interaction points | Medium |
| Phase 3 | 1 week | Auto-generated walls | Low |
| Phase 4 | 1-2 weeks | Connected building | Medium |
| Phase 5 | 2-4 weeks | Visual editor | High (scope) |

**Recommended MVP:** Phases 0-2 (3-4 weeks). This fixes all stated pain points without the full scope of a building editor.

---

## 8. Current vs Grid Comparison

| Aspect | Current System | Grid-Based System |
|--------|---------------|-------------------|
| **Prop placement** | Hardcoded positions in TSX, magic-number math | Data-driven from grid blueprints, snap-to-cell |
| **Adding a room type** | Write a new `*Props` component with manual positions (~50-100 lines) | Create a JSON blueprint with grid coordinates |
| **Collision handling** | None — bots walk through everything | Grid cells marked BLOCKED; bots can't enter |
| **Walkable areas** | Manually-tuned circular zones per room type | Derived automatically from non-blocked cells |
| **Interaction points** | Duplicated in `BotAnimations.tsx`, can drift from actual prop positions | Part of prop definition; always match prop location |
| **Bot navigation** | Random wandering within circle + direct walk-to-target | Waypoint graph with A* fallback; smooth paths around furniture |
| **Walls** | Fixed perimeter with hardcoded door opening | Auto-generated from grid boundaries; shared walls supported |
| **Room sizing** | Fixed 12×12; scale factor adjusts props but doesn't validate | Variable room sizes with validated layouts |
| **Multi-room connection** | Rooms are isolated islands with spacing | Hallway system connects rooms; bots can move between rooms |
| **Performance** | 30-50 draw calls per room (individual props) | 10-15 draw calls per room (instanced + merged) |
| **Props file size** | 900+ lines in single file (`RoomProps.tsx`) | ~50 lines per blueprint JSON + shared prop definitions |
| **Bot jitter** | Random ±0.4 unit offset; sometimes inside furniture | Capacity-aware waypoints; guaranteed clear positions |
| **Room editing** | Edit code, rebuild, check visually | Edit JSON/grid data (or future visual editor) |
| **Extensibility** | Hard to add rooms or change layouts without code | New room = new blueprint JSON; props are reusable |
| **Maintenance burden** | Two places to update (props + interaction points) | Single source of truth (blueprint) |

---

## 9. Risks & Considerations

### 9.1 Scope Risk — The Biggest Danger

A full grid system (grid + pathfinding + walls + building layout + editor) is effectively a **systems rewrite**. The migration path in §7 is designed to mitigate this by delivering value incrementally, but there's a real risk of "almost done" features dragging on.

**Mitigation:**
- Hard stop-point after Phase 2. Evaluate whether Phase 3+ is needed.
- Each phase must be independently shippable.
- No "big bang" migration — old and new systems coexist during transition.

### 9.2 Cell Size Trade-offs

| Cell Size | Grid per 12u Room | Pros | Cons |
|-----------|-------------------|------|------|
| **1.0 unit** | 12×12 (144 cells) | Simple blueprints, fast pathfinding | Too coarse — chairs can't be placed accurately; looks "board-gamey" |
| **0.5 unit** | 24×24 (576 cells) | Good balance; most props fit integer footprints | Moderate blueprint complexity |
| **0.25 unit** | 48×48 (2304 cells) | High fidelity; smooth prop placement | Blueprint authoring is tedious; 4× more data; pathfinding graph is large |

**Recommendation: 0.5 units.** This is the standard "half-meter" grid used by Prison Architect and similar games. It's granular enough for chairs (1×1 cell) and desks (3×2 cells) while keeping blueprints manageable.

### 9.3 Blueprint Authoring Cost

Without a visual editor, creating blueprints means manually specifying grid coordinates. For 8 room types, this is ~2-4 hours of work per room type.

**Mitigation:**
- Phase 0 auto-generates initial blueprints from existing hardcoded positions
- A simple script can convert `[x, y, z]` world positions to grid coordinates
- ASCII art previews in the design doc serve as visual guides

### 9.4 Migration Effort vs. Value

Honest assessment: Phases 0-1 deliver 80% of the collision-fixing value with 20% of the effort. The full grid system is a strategic investment that pays off if:
- More room types are planned
- User-editable layouts become a feature
- Inter-room navigation is desired
- The 3D world becomes a core product differentiator

If CrewHub's 3D world remains a fun visualization rather than a core product surface, the lightweight approach (Phase 0-1 only) may be the right call.

### 9.5 Visual Regression Risk

Grid snapping can make layouts feel more "mechanical" than hand-tuned positions. Organic touches (slight rotations, offset props) add visual charm.

**Mitigation:**
- Allow props to have per-instance visual offsets (±0.1 units) that don't affect grid occupancy
- Support non-grid-snapped decorative props (plants, cable messes) that don't block movement
- Use the `decorOnly` flag for props that add character without affecting navigation

### 9.6 Three.js Performance

The grid system itself adds minimal overhead (grid data is small, computed once). The rendering improvements (instancing, wall merging) should actually improve performance. The A* pathfinding on a 24×24 grid is negligible (< 0.1ms per path computation).

---

## 10. GPT-5.2 Feedback & Hybrid Recommendation

### Summary of GPT-5.2's Position

GPT-5.2's review (see `grid-system-review-gpt5.md`) makes several strong arguments:

1. **A grid is a product-level commitment, not a collision fix.** If the goal is just "stop bots walking through desks," simpler solutions exist.

2. **Waypoint graphs solve 90% of navigation issues** with far less implementation cost. With only 1-5 bots per room, heavy pathfinding infrastructure is overkill.

3. **A visual editor is a hidden cost.** Without one, blueprint authoring is tedious. With one, you're building a game editor — months of work.

4. **Incremental migration is key.** Don't rewrite everything; fix the actual pain points first.

5. **Cell size of 0.5 is the sweet spot** if you do go grid. (We agree.)

6. **Start with JSON blueprints in-repo,** not a database. (We agree.)

### Where We Agree with GPT-5.2

- **Waypoint graphs are the right primary navigation system** for CrewHub's current scale. A* on a grid is a fallback, not the main path.
- **Phase 0 (data-driven layouts) should come first.** This alone fixes the code maintenance burden.
- **No visual editor in the near term.** JSON + helper scripts are sufficient.
- **The lightweight approach covers most pain points.** Phases 0-1 fix 80% of issues.

### Where We Respectfully Disagree

1. **Grid as data model has value even without user editing.** The grid isn't just for pathfinding — it's a **validation layer**. With a grid, you can programmatically verify that no two props overlap, that every interaction point is accessible, and that walkable areas are truly walkable. This catches bugs that manual authoring misses.

2. **Waypoints alone don't prevent prop clipping.** GPT-5.2's waypoint approach solves navigation but doesn't address the root cause of prop overlap. A grid with footprints does.

3. **The cost is manageable with the phased approach.** Phases 0-2 are 3-4 weeks total. This is not a "months-long rewrite" — it's a focused refactoring that happens to introduce grid coordinates as the underlying representation.

### Hybrid Recommendation

**We recommend the Waypoint-First Hybrid approach:**

```
┌─────────────────────────────────────────────────────┐
│                 HYBRID ARCHITECTURE                  │
│                                                      │
│  Data Layer:     Grid cells (validation + footprints)│
│  Navigation:     Waypoint graph (primary)            │
│  Fallback:       A* on grid (edge cases only)        │
│  Rendering:      Unchanged prop components           │
│  Authoring:      JSON blueprints → grid → waypoints  │
│                                                      │
│  Grid exists as data model, NOT as visible artifact  │
│  Bots navigate via waypoints, NOT cell-by-cell       │
└─────────────────────────────────────────────────────┘
```

The grid serves as an **internal validation and spatial indexing layer** while waypoints handle the actual bot movement. This gives us:

- ✅ Prop overlap detection (grid footprints)
- ✅ Walkable area derivation (non-blocked cells → walkable polygon)
- ✅ Smooth, natural-looking bot movement (waypoints + splines)
- ✅ Validated interaction points (grid ensures they're accessible)
- ✅ Future extensibility (full A* pathfinding is there if needed)
- ✅ Reasonable implementation cost (3-4 weeks for Phases 0-2)
- ❌ No visual editor required (JSON + validation scripts)
- ❌ No user-facing grid visible at runtime

### Decision Matrix

| Approach | Fixes Clipping | Fixes Navigation | Authoring Cost | Implementation | Future-Proof |
|----------|---------------|-----------------|----------------|----------------|-------------|
| **Status quo** | ❌ | ❌ | Low (just edit code) | 0 weeks | ❌ |
| **GPT-5.2: Waypoints only** | ❌ Partial | ✅ | Medium | 1-2 weeks | ⚠️ Limited |
| **Full grid (Prison Architect)** | ✅ | ✅ | High | 6-8 weeks | ✅ |
| **Hybrid (recommended)** | ✅ | ✅ | Medium | 3-4 weeks | ✅ |

### Final Verdict

**Start with Phase 0 (data-driven layouts) immediately.** It's low-risk, high-value, and unblocks everything else.

Then proceed to Phase 1 (collision volumes) and Phase 2 (grid + waypoints) to fully resolve the pain points.

Evaluate Phase 3+ only after Phase 2 ships and we see whether building-level features (hallways, inter-room movement) are worth the investment.

---

## Appendix A: File Structure

```
frontend/src/components/world3d/
├── grid/
│   ├── GridTypes.ts              // CellType, GridCell, PropDefinition interfaces
│   ├── PropRegistry.ts           // PROP_REGISTRY constant
│   ├── BlueprintParser.ts        // Parse blueprint JSON → GridCell[][]
│   ├── WaypointGenerator.ts      // Grid → RoomWaypoint graph
│   ├── WallGenerator.ts          // Grid edges → wall segment meshes
│   ├── PathFinder.ts             // A* on grid (fallback)
│   └── GridDebugOverlay.tsx      // Dev-only grid visualization
├── blueprints/
│   ├── headquarters.json
│   ├── dev.json
│   ├── creative.json
│   ├── marketing.json
│   ├── thinking.json
│   ├── automation.json
│   ├── comms.json
│   ├── ops.json
│   └── default.json
├── GridRoom.tsx                  // New room renderer using blueprints
└── ... (existing files)
```

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| **Cell** | A single unit in the grid (0.5 × 0.5 world units) |
| **Footprint** | The set of cells a prop occupies |
| **Anchor** | The origin cell of a multi-cell prop |
| **Interaction cell** | A cell where a bot stands to use a prop |
| **Waypoint** | A navigation node; bots move between waypoints |
| **Blueprint** | A room layout template (JSON) with grid data, props, and waypoints |
| **Building layout** | The arrangement of rooms, hallways, and shared areas |
| **Walkable center** | The circular safe zone where bots can wander freely (current system) |
| **Walkable polygon** | The non-blocked area derived from grid data (proposed system) |

---

*This document was written alongside the existing `3d-world-design.md` (original vision) and `grid-system-review-gpt5.md` (GPT-5.2's critique). All three should be read together for full context.*
