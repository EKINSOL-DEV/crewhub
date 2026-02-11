# CrewHub 3D World — Architecture Analysis & Modding Foundation

*Version: 1.0 — 2026-02-04*
*Authors: Claude Opus (deep analysis)*
*Purpose: Foundation for modding support, import/export, and extensibility*

---

## Table of Contents

1. [Current Architecture Map](#1-current-architecture-map)
2. [Content Pipeline Analysis](#2-content-pipeline-analysis)
3. [Hardcoded vs Data-Driven Audit](#3-hardcoded-vs-data-driven-audit)
4. [Modding Surface Analysis](#4-modding-surface-analysis)
5. [Import/Export Requirements](#5-importexport-requirements)
6. [Onboarding Flow for Modders](#6-onboarding-flow-for-modders)
7. [Technical Debt & Refactoring Needs](#7-technical-debt--refactoring-needs)
8. [Recommended Architecture](#8-recommended-architecture)

---

## 1. Current Architecture Map

### 1.1 High-Level Data Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND / GATEWAY                                │
│                                                                            │
│  SSE Stream → sessions[] (CrewSession objects with key, status, model...)  │
│  REST API  → rooms[]     (Room objects with id, name, color, icon)         │
│  REST API  → agents[]    (AgentRuntime with color, default_room_id)        │
└────────────┬───────────────────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         REACT HOOKS LAYER                                  │
│                                                                            │
│  useSessionsStream() → live session data (status, activity, timestamps)    │
│  useRooms()          → room list + getRoomForSession() assignment logic    │
│  useAgentsRegistry() → agent runtimes + child sessions (subagents)         │
│  useSessionActivity()→ isActivelyRunning(key) for status classification    │
│  useSessionDisplayNames() → display names from aliases                     │
└────────────┬───────────────────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                      World3DView.tsx (ORCHESTRATOR)                         │
│                      File: frontend/src/components/world3d/World3DView.tsx │
│                                                                            │
│  1. Calculates building layout from rooms (grid positions, parking area)   │
│  2. Classifies sessions into visibleSessions vs parkingSessions            │
│  3. Assigns bots to rooms via getRoomForSession() + agent registry         │
│  4. Wraps everything in <Canvas>, <WorldFocusProvider>, <DragDropProvider> │
│                                                                            │
│  Key functions:                                                            │
│    calculateBuildingLayout() — line ~67: room grid + parking placement     │
│    getAccurateBotStatus()    — line ~99: active/idle/sleeping/offline      │
│    getBotPositionsInRoom()   — line ~124: position array for bot placement │
│    buildBotPlacement()       — line ~199: session → BotPlacement struct    │
└────────────┬───────────────────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        SCENE GRAPH (Three.js)                              │
│                                                                            │
│  <Canvas>                                                                  │
│  ├── <WorldLighting />          — Directional + ambient + hemisphere       │
│  ├── <EnvironmentSwitcher />    — Grass / Island / Floating platform       │
│  ├── <BuildingFloor />          — Main floor plane                         │
│  ├── <BuildingWalls />          — Perimeter walls with entrance gap        │
│  ├── <HallwayFloorLines />      — Visual lines between rooms               │
│  ├── <EntranceLobby />          — Front entrance area                      │
│  ├── <Hallway />                — Connector geometry between rooms          │
│  ├── <ParkingArea3D />          — Break area with bench/coffee/lamp         │
│  ├── <CameraController />       — Orbital camera with focus levels          │
│  ├── <FirstPersonController />  — WASD + pointer lock FP mode              │
│  ├── For each room:                                                        │
│  │   └── <Room3D>                                                          │
│  │       ├── <RoomFloor />                                                 │
│  │       ├── <RoomWalls />                                                 │
│  │       ├── <RoomNameplate />                                             │
│  │       ├── <RoomFocusButton />                                           │
│  │       ├── <RoomDropZone />                                              │
│  │       ├── <GridRoomRenderer />  ← Renders all props from blueprint      │
│  │       └── <GridDebugOverlay />  ← Dev tool: color-coded walkable grid   │
│  │   └── For each bot in room:                                             │
│  │       └── <Bot3D>                                                       │
│  │           ├── <BotBody />       — Head + body + arms + feet             │
│  │           ├── <BotFace />       — Eyes (blinking) + mouth               │
│  │           ├── <BotAccessory />  — Crown/lightbulb/clock/signal/gear     │
│  │           ├── <BotChestDisplay />— Tool/dots/clock/chat/code display    │
│  │           ├── <BotStatusGlow /> — Ground ring (green/yellow/gray)        │
│  │           ├── <BotActivityBubble />— Floating activity text             │
│  │           └── <SleepingZs />    — ZZZ sprite particles                  │
│  └── Parking bots (same Bot3D structure)                                   │
│                                                                            │
│  Outside Canvas:                                                           │
│  ├── <WorldNavigation />       — Back button, first-person toggle          │
│  ├── <BotInfoPanel />          — Slide-in panel when bot focused           │
│  ├── <RoomTabsBar />           — Bottom tabs for room navigation           │
│  ├── <LightingDebugPanel />    — Dev: lighting controls                    │
│  ├── <DebugPanel />            — Dev: debug bot spawning                   │
│  └── <LogViewer />             — Session log viewer (modal)                │
└────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Architecture Boundaries

**Backend → Frontend boundary:** Sessions are live-streamed via SSE. Rooms and agents come from REST. The 3D world is purely frontend — no 3D state is persisted server-side.

**Grid data layer → Renderer boundary:** The grid system (`frontend/src/lib/grid/`) provides the spatial data model. The renderer (`frontend/src/components/world3d/grid/`) consumes it. This separation is clean and well-designed.

**Focus/Navigation state:** The `WorldFocusContext` (`frontend/src/contexts/WorldFocusContext.tsx`) is the central state machine for camera behavior. It has 4 levels: `overview → room → bot → firstperson`. Each level configures camera constraints, bot label visibility, and UI overlays.

### 1.3 File Inventory & Sizes

| Category | Files | Total Lines (approx) | Key Coupling |
|----------|-------|---------------------|--------------|
| **Grid system** | `types.ts`, `blueprints.ts`, `blueprintUtils.ts`, `pathfinding.ts` | ~1,350 | Self-contained module |
| **3D Rendering** | `World3DView.tsx`, `Room3D.tsx`, `GridRoomRenderer.tsx`, `PropRegistry.tsx`, `GridDebugOverlay.tsx` | ~2,500 | Grid system + hooks |
| **Bot system** | `Bot3D.tsx`, `BotBody.tsx`, `BotFace.tsx`, `BotAccessory.tsx`, `BotChestDisplay.tsx`, `BotAnimations.tsx`, `BotActivityBubble.tsx`, `botVariants.ts` | ~1,800 | Grid system + focus context |
| **Environments** | `index.tsx`, `GrassEnvironment.tsx`, `IslandEnvironment.tsx`, `FloatingEnvironment.tsx` | ~450 | Building dimensions only |
| **Camera/Navigation** | `CameraController.tsx`, `FirstPersonController.tsx`, `WorldFocusContext.tsx` | ~550 | Grid system (for FP collision) |

---

## 2. Content Pipeline Analysis

### 2.1 Props: Definition → Grid Placement → 3D Rendering

#### Step 1: Prop Component Definition
**File:** `frontend/src/components/world3d/grid/PropRegistry.tsx`

Each prop is defined as:
1. A **React component** implementing the `PropProps` interface (position, rotation, cellSize, span)
2. A **registry entry** (`PropEntry`) specifying: component reference, mountType (`'floor'` | `'wall'`), yOffset

There are two categories of prop components:
- **Wrapper components** (lines 38-67): Thin wrappers around standalone prop files in `../props/` (Desk, Monitor, Chair, Lamp, Plant, CoffeeMachine, WaterCooler, NoticeBoard, Bench)
- **Inline mini-props** (lines 71-690): Full Three.js geometry defined directly in PropRegistry.tsx (Whiteboard, ServerRack, Easel, BarChart, ConveyorBelt, GearMechanism, etc.)
- **Composite props** (lines 693-752): Combinations like `DeskWithMonitorProp` that compose other props
- **Null props** (line 757): `NullProp` for invisible interaction-only markers

**Current prop count:** 46 entries in the registry (line 763-817):
- 26 floor props
- 10 wall props
- 5 composite props
- 5 interaction-only (null) props

#### Step 2: Grid Placement
**File:** `frontend/src/lib/grid/blueprints.ts`

Props are placed on a 20×20 grid (cellSize=0.6) via imperative `placeOnGrid()` calls:

```typescript
// Example from createHeadquarters(), line 22:
placeOnGrid(grid, 4, 16, 'desk-with-monitor', { span: { w: 2, d: 2 } })
```

The `placeOnGrid()` function (`blueprintUtils.ts`, line 28):
1. Sets cell type (furniture/decoration/interaction)
2. Sets walkability (decorations and interactions are walkable)
3. Records propId on each cell
4. For multi-cell props, sets `spanParent` on non-anchor cells

**Blueprint registration** (`blueprints.ts`, line ~380):
```typescript
export const ROOM_BLUEPRINTS: Record<string, RoomBlueprint> = {
  headquarters: createHeadquarters(),
  'dev-room': createDevRoom(),
  // ... 9 total
}
```

**Room-to-blueprint matching** (`blueprints.ts`, line ~395):
```typescript
export function getBlueprintForRoom(roomName: string): RoomBlueprint {
  const name = roomName.toLowerCase()
  if (name.includes('headquarter')) return ROOM_BLUEPRINTS.headquarters
  // ... fuzzy keyword matching
}
```

#### Step 3: 3D Rendering
**File:** `frontend/src/components/world3d/grid/GridRoomRenderer.tsx`

1. **Instance building** (line 80): Iterates all grid cells, skips empty/wall/door/spanParent cells
2. **Coordinate conversion**: `gridToWorld()` maps grid coords to room-relative world coords
3. **Wall mount handling** (line 16-55): `getWallPlacement()` snaps wall props to nearest wall surface and auto-rotates them to face inward
4. **Floor clamping** (line 58-78): `clampToRoomBounds()` prevents floor props from clipping into walls
5. **Component rendering** (line 110-140): Looks up `PropEntry` from registry, instantiates component with computed position/rotation

**The complete pipeline:**
```
PropRegistry.tsx          blueprints.ts              GridRoomRenderer.tsx
┌──────────────┐    ┌─────────────────────┐    ┌──────────────────────────┐
│ PropEntry {   │    │ placeOnGrid(grid,   │    │ for each cell:           │
│   component,  │◀───│   x, z, propId,     │───▶│   getPropEntry(propId)   │
│   mountType,  │    │   {span, type})     │    │   gridToWorld(x, z)      │
│   yOffset     │    │                     │    │   wall snap / floor clamp│
│ }             │    │ → GridCell with     │    │   <Component pos rot />  │
└──────────────┘    │   propId, walkable   │    └──────────────────────────┘
                    └─────────────────────┘
```

### 2.2 Rooms: Definition → Layout → 3D Scene

#### Room Data (Backend)
Rooms come from the backend as `Room` objects with: `id`, `name`, `color`, `icon`, `sort_order`. There's no spatial data from the backend — all 3D positioning is frontend-only.

#### Building Layout Calculation
**File:** `World3DView.tsx`, `calculateBuildingLayout()` (line 67)

1. Sorts rooms by `sort_order`
2. Arranges in a grid: `MAX_COLS=3`, rows as needed
3. Spacing: `ROOM_SIZE(12) + HALLWAY_WIDTH(4) = 16` units between room centers
4. Calculates building perimeter, parking area position, entrance location
5. Returns `roomPositions[]` with `[x, y, z]` for each room

#### Room Rendering
**File:** `Room3D.tsx`

1. Gets blueprint via `getBlueprintForRoom(room.name)` — fuzzy name matching
2. Renders: RoomFloor, RoomWalls, RoomNameplate, RoomFocusButton, RoomDropZone
3. Delegates prop rendering to `<GridRoomRenderer blueprint={blueprint} />`

### 2.3 Environments: Selection → Rendering

**File:** `frontend/src/components/world3d/environments/index.tsx`

Three environments, selected via localStorage:
1. **Grass** (`GrassEnvironment.tsx`): InstancedMesh tile grid with grass tufts and rocks
2. **Island** (`IslandEnvironment.tsx`): LatheGeometry island with floating debris and distant clouds
3. **Floating** (`FloatingEnvironment.tsx`): Hexagonal platform with sci-fi panel lines, clouds below, energy beam

Each receives `buildingWidth` and `buildingDepth` to size appropriately. Selection persisted in `localStorage` under key `'crewhub-environment'`.

### 2.4 Bot Types: Detection → Config → 3D Character

#### Variant Detection
**File:** `frontend/src/components/world3d/utils/botVariants.ts`

1. `detectBotVariant(sessionKey, label)` (line 68): Scans session key + label for keywords
   - Keywords: `'cron'` → cron, `'dev'` → dev, `'flowy'`/`'comms'` → comms, etc.
   - Fallback: deterministic hash of session key → one of 5 variants
2. `getBotConfigFromSession(sessionKey, label, agentColor)` (line 87): Returns full `BotVariantConfig`
   - Can override color from agent registry

#### The 5 Bot Variants

| Variant | Color | Accessory | Expression | Chest Display |
|---------|-------|-----------|------------|---------------|
| Worker | `#FE9600` | Crown (hat) | Happy | Tool (wrench cross) |
| Thinker | `#1277C3` | Lightbulb antenna | Thoughtful | Three dots |
| Cron | `#82B30E` | Clock antenna | Determined | "12:00" display |
| Comms | `#9370DB` | Signal antenna | Talking | Chat dots (animated) |
| Dev | `#F32A1C` | Gear antenna | Serious | "</> {}" code |

#### Rendering Chain
```
botVariants.ts           Bot3D.tsx                BotBody/Face/Accessory/Chest
┌─────────────┐    ┌──────────────────┐    ┌─────────────────────────────┐
│ BotVariant   │    │ Bot3D receives:  │    │ BotBody: color → toon mat   │
│ Config {     │───▶│  - config        │───▶│ BotFace: expression → mouth │
│  color,      │    │  - status        │    │ BotAccessory: type → hat    │
│  accessory,  │    │  - name, scale   │    │ BotChestDisplay: type → icon│
│  expression, │    │  - roomBounds    │    │ BotStatusGlow: status → ring│
│  chestDisplay│    │  - activity      │    └─────────────────────────────┘
│ }            │    └──────────────────┘
└─────────────┘
```

### 2.5 Bot Animation & Movement Pipeline

**File:** `BotAnimations.tsx` — State machine + interaction points

The animation system has 7 phases (line 9-17):
```
walking-to-desk → working (freeze at desk, head bob, body tilt)
idle-wandering → getting-coffee → idle-wandering (loop)
sleeping-walking → sleeping (crouch, ZZZ, lean)
offline (frozen, 40% opacity)
```

**File:** `Bot3D.tsx` — Movement engine (single consolidated `useFrame`, line 126)

Movement modes:
1. **Animation target mode** (desk/coffee/sleep): Grid-aware direction picking toward target
2. **Random walk mode** (idle): Pick walkable direction, walk N cells, pause, repeat
3. **No-grid mode** (parking): Direct circular wander within radius

Key features:
- Uses `worldToGrid()` + `botWalkableMask` to check walkability (line 148)
- Door cells are blocked for bots (prevents escaping rooms, line 139)
- 8-directional movement with diagonal normalization (line 298)
- Smooth rotation with dead-zone snap (line 303)
- Hard clamp to room bounds as safety net (line 364)
- Global `botPositionRegistry` (module-level Map) for camera follow (line 24)

---

## 3. Hardcoded vs Data-Driven Audit

### 3.1 Already Data-Driven ✅

| Element | How It's Driven | File(s) |
|---------|----------------|---------|
| Room list & properties | Backend REST API | `useRooms()` hook |
| Bot assignment to rooms | Backend agent config + `getRoomForSession()` | Multiple hooks |
| Bot variant detection | Keyword matching on session key/label | `botVariants.ts:68` |
| Room blueprints (prop placement) | `RoomBlueprint` data structures | `blueprints.ts` |
| Prop registry | `PROP_REGISTRY` record | `PropRegistry.tsx:763` |
| Grid walkability | Derived from cell types | `blueprintUtils.ts` |
| Interaction points | Derived from grid cells | `BotAnimations.ts:42` |
| Environment selection | `localStorage` preference | `environments/index.tsx` |
| Bot status classification | Computed from `updatedAt` + thresholds in `SESSION_CONFIG` | `World3DView.tsx:99` |
| Camera constraints | Per-focus-level config | `CameraController.tsx:47` |

### 3.2 Hardcoded — Should Be Configurable 🔴

| Element | What's Hardcoded | File:Line | Impact on Modding |
|---------|-----------------|-----------|-------------------|
| **Grid dimensions** | `GRID_W=20, GRID_D=20, CELL_SIZE=0.6` | `blueprints.ts:12-14` | Cannot create rooms of different sizes |
| **Room size** | `ROOM_SIZE=12` (world units) | `World3DView.tsx:51` | Tightly coupled to grid (20×0.6=12) |
| **Building layout** | `MAX_COLS=3`, `HALLWAY_WIDTH=4`, `GRID_SPACING=16` | `World3DView.tsx:52-54` | Cannot customize building shape |
| **Bot variant keywords** | Hardcoded keyword → variant mapping | `botVariants.ts:52-58` | Cannot add new bot types |
| **Bot variant configs** | 5 fixed variants with colors/accessories | `botVariants.ts:17-50` | Cannot create custom bot skins |
| **Blueprint-to-room matching** | Fuzzy string matching on room name | `blueprints.ts:395` | Fragile, cannot map custom rooms to custom blueprints |
| **5 expression types** | `happy/thoughtful/determined/talking/serious` | `botVariants.ts:4` | Cannot add new expressions |
| **5 accessory types** | `crown/lightbulb/clock/signal/gear` | `botVariants.ts:5` | Cannot add new head accessories |
| **5 chest display types** | `tool/dots/clock-display/chat-dots/code` | `botVariants.ts:6` | Cannot add new chest icons |
| **3 environment types** | `grass/island/floating` | `environments/index.tsx:7` | Cannot add new environments |
| **Prop Y offsets** | Floor: always 0.16, Wall: per-prop in registry | `PropRegistry.tsx:763+` | Minor — already somewhat configurable |
| **Animation phase durations** | In `SESSION_CONFIG` but some also inline | `BotAnimations.tsx`, `Bot3D.tsx` | Cannot customize animation timing |
| **Bot walk speeds** | Inline constants like `SESSION_CONFIG.botWalkSpeedActive` | `BotAnimations.tsx:127+` | Partially configurable via SESSION_CONFIG |
| **FP movement speeds** | `WALK_SPEED=3, RUN_SPEED=6, EYE_HEIGHT=0.7` | `FirstPersonController.tsx:40-42` | Cannot adjust without code change |
| **Room wall height** | Hardcoded in `RoomWalls.tsx` | `RoomWalls.tsx` | Cannot make taller/shorter rooms |

### 3.3 Mixed — Partially Configurable 🟡

| Element | Status | Notes |
|---------|--------|-------|
| **Prop components** | Registry is extensible but components are inline | New props require code in PropRegistry.tsx |
| **Room blueprints** | Data-driven format, but only 9 static ones | Adding one requires TypeScript code in blueprints.ts |
| **Bot colors** | Can be overridden by agent.color from backend | But only if agent has a custom color set |
| **Toon materials** | Centralized in `toonMaterials.ts` | Easy to adjust globally, hard to per-prop |
| **Lighting** | Has a debug panel for adjustment | But no persistence or per-environment config |

---

## 4. Modding Surface Analysis

### 4.1 Custom Props (New Furniture/Decorations)

**Current extension point:** The `PROP_REGISTRY` in `PropRegistry.tsx` (line 763).

**What a "mod" would look like:**
```typescript
// A modder defines a new prop component and registers it:
registerProp('modded-couch', {
  component: MyCouchProp,
  mountType: 'floor',
  yOffset: 0.16,
})
```

**What needs to change:**
1. `PROP_REGISTRY` is a frozen `const` — needs to become a mutable registry with `registerProp()` / `unregisterProp()` APIs
2. Prop components are currently defined inline in the same file — need a plugin loading mechanism
3. No validation that a prop component implements `PropProps` correctly
4. No metadata for modding UX (thumbnail, description, category, author)

**Difficulty: Medium.** The architecture already supports the pattern; it just needs to be opened up.

### 4.2 Custom Room Layouts/Blueprints

**Current extension point:** `ROOM_BLUEPRINTS` record + `getBlueprintForRoom()` in `blueprints.ts`.

**What a "mod" would look like:**
```json
{
  "id": "modded-workshop",
  "name": "Workshop",
  "gridWidth": 20,
  "gridDepth": 20,
  "cellSize": 0.6,
  "props": [
    { "propId": "workbench", "x": 5, "z": 15, "span": { "w": 3, "d": 2 } },
    { "propId": "tool-rack", "x": 18, "z": 10, "type": "decoration" }
  ],
  "doors": [{ "x": 9, "z": 19, "facing": "south" }],
  "interactionPoints": {
    "work": [{ "x": 5, "z": 14 }],
    "coffee": [],
    "sleep": [{ "x": 2, "z": 2 }]
  }
}
```

**What needs to change:**
1. Blueprint creation is imperative TypeScript — needs a JSON-based format
2. `getBlueprintForRoom()` uses fuzzy string matching — needs explicit mapping
3. Grid dimensions are constants — need to be blueprint-level properties (they already are in `RoomBlueprint.gridWidth/gridDepth`)
4. No validation for blueprint correctness (walkable paths exist, doors connect, etc.)
5. Backend room entity needs a `blueprintId` field for explicit mapping

**Difficulty: Medium.** The `RoomBlueprint` type is already well-structured; the main work is serialization and loading.

### 4.3 Custom Environments/Themes

**Current extension point:** `EnvironmentSwitcher` component in `environments/index.tsx`.

**What a "mod" would look like:**
```typescript
registerEnvironment('modded-desert', {
  component: DesertEnvironment,
  label: 'Desert',
  thumbnail: '/mods/desert-thumb.png',
})
```

**What needs to change:**
1. `EnvironmentType` is a string union literal (`'grass' | 'island' | 'floating'`) — needs dynamic registration
2. Each environment receives only `buildingWidth/buildingDepth` — interface is already minimal and clean
3. `getStoredEnvironment()` validates against known types — needs to accept registered types
4. No hot-loading mechanism for new environment components

**Difficulty: Low.** The interface is clean (just `buildingWidth` + `buildingDepth`). Adding new environments is straightforward once the registry is dynamic.

### 4.4 Custom Bot Skins/Accessories

**Current extension points:**
- `BotVariantConfig` type in `botVariants.ts`
- `BotAccessory` component in `BotAccessory.tsx`
- `BotChestDisplay` component in `BotChestDisplay.tsx`
- `BotFace` component in `BotFace.tsx` (expressions)

**What a "mod" would look like:**
```typescript
// Register a new bot variant
registerBotVariant('pirate', {
  color: '#8B4513',
  accessory: 'pirate-hat',     // references registered accessory
  expression: 'happy',
  chestDisplay: 'skull',       // references registered chest display
  icon: '🏴‍☠️',
  label: 'Pirate',
})

// Register a new accessory type
registerAccessory('pirate-hat', PirateHatComponent)

// Register a new chest display type
registerChestDisplay('skull', SkullDisplayComponent)
```

**What needs to change:**
1. `VARIANT_CONFIGS` is a static record of 5 variants — needs dynamic registration
2. `BotAccessoryType` is a string union — needs to be extensible
3. `BotAccessory` uses a switch statement — needs a registry lookup
4. `BotChestDisplay` uses a switch statement — needs a registry lookup
5. `BotFace` has hardcoded expression → pupil offset + mouth shape mappings — needs registry
6. `detectBotVariant()` keyword list is static — needs plugin/override support
7. No mechanism for completely custom bot body shapes (always head + body + arms + feet)

**Difficulty: Medium-High.** Multiple component files need registry patterns. Bot body shape is fundamentally fixed.

### 4.5 Custom Animations

**Current extension point:** `BotAnimations.tsx` state machine.

**What a "mod" would look like:**
```typescript
// Register a new animation phase
registerAnimPhase('dancing', {
  walkSpeed: 0,
  freezeWhenArrived: true,
  bodyTilt: 0,
  headBob: false,
  // Custom per-frame update function:
  onFrame: (anim, delta, clock) => {
    anim.sleepRotZ = Math.sin(clock * 4) * 0.1
    anim.yOffset = Math.abs(Math.sin(clock * 6)) * 0.1
  },
})

// Register transition rule
registerTransition('idle', 'dancing', {
  condition: (status) => status === 'idle' && Math.random() > 0.95,
  duration: 5000,
})
```

**What needs to change:**
1. `BotAnimState` is a string union of 7 phases — needs extensibility
2. `tickAnimState()` uses a switch on phase — needs plugin dispatch
3. `useBotAnimation()` transitions are hardcoded in a useEffect — needs rule-based system
4. Bot3D.tsx's `useFrame` has phase-specific behavior (bouncing, breathing) — needs per-phase callbacks
5. No concept of "animation blending" — transitions are instant

**Difficulty: High.** The animation system is deeply intertwined with Bot3D's useFrame loop. Making it truly modular requires significant refactoring.

### 4.6 Natural Extension Points Summary

| Mod Type | Current Coupling | Extension Difficulty | Users Would Want |
|----------|-----------------|---------------------|-----------------|
| Custom props | Low (registry pattern exists) | ⭐⭐ Medium | ⭐⭐⭐⭐⭐ Very High |
| Custom rooms | Low (data model exists) | ⭐⭐ Medium | ⭐⭐⭐⭐ High |
| Custom environments | Very Low (clean interface) | ⭐ Low | ⭐⭐⭐ Medium |
| Custom bot skins | Medium (multiple files) | ⭐⭐⭐ Medium-High | ⭐⭐⭐⭐ High |
| Custom animations | High (deeply coupled) | ⭐⭐⭐⭐ High | ⭐⭐ Low-Medium |

---

## 5. Import/Export Requirements

### 5.1 Room Blueprint Format (JSON)

```json
{
  "$schema": "https://crewhub.dev/schemas/room-blueprint-v1.json",
  "version": 1,
  "id": "my-custom-room",
  "name": "My Custom Room",
  "gridWidth": 20,
  "gridDepth": 20,
  "cellSize": 0.6,
  "props": [
    {
      "propId": "desk-with-monitor",
      "x": 4,
      "z": 16,
      "type": "furniture",
      "span": { "w": 2, "d": 2 }
    },
    {
      "propId": "plant",
      "x": 18,
      "z": 18,
      "type": "decoration"
    },
    {
      "propId": "whiteboard",
      "x": 10,
      "z": 18,
      "type": "decoration"
    }
  ],
  "interactions": {
    "work": [{ "x": 4, "z": 15 }],
    "coffee": [{ "x": 17, "z": 3 }],
    "sleep": [{ "x": 2, "z": 18 }]
  },
  "doors": [
    { "x": 9, "z": 19, "facing": "south" },
    { "x": 10, "z": 19, "facing": "south" }
  ],
  "walkableCenter": { "x": 10, "z": 10 },
  "metadata": {
    "author": "username",
    "description": "A cozy workshop room",
    "tags": ["workshop", "creative"],
    "thumbnailUrl": null,
    "createdAt": "2026-02-04T16:00:00Z"
  }
}
```

### 5.2 Prop Definition Format (JSON)

```json
{
  "$schema": "https://crewhub.dev/schemas/prop-definition-v1.json",
  "version": 1,
  "id": "my-custom-prop",
  "name": "Custom Workbench",
  "mountType": "floor",
  "yOffset": 0.16,
  "category": "furniture",
  "defaultSpan": { "w": 2, "d": 1 },
  "geometry": {
    "type": "composite",
    "parts": [
      {
        "shape": "box",
        "args": [1.2, 0.06, 0.7],
        "position": [0, 0.75, 0],
        "color": "#8B6B4A",
        "material": "toon"
      },
      {
        "shape": "box",
        "args": [0.06, 0.75, 0.06],
        "position": [-0.55, 0.375, -0.30],
        "color": "#6B4A3A",
        "material": "toon"
      }
    ]
  },
  "metadata": {
    "author": "username",
    "description": "A sturdy workbench",
    "tags": ["workshop", "furniture"]
  }
}
```

**Note:** For v1, prop geometry defined in JSON would be limited to primitive compositions (boxes, cylinders, spheres). For complex props, a GLTF/GLB model path could be specified instead:

```json
{
  "geometry": {
    "type": "model",
    "url": "/mods/props/fancy-desk.glb",
    "scale": [1, 1, 1]
  }
}
```

### 5.3 Environment Definition Format (JSON)

```json
{
  "$schema": "https://crewhub.dev/schemas/environment-v1.json",
  "version": 1,
  "id": "desert",
  "name": "Desert",
  "description": "Sandy desert with cacti",
  "groundColor": "#D2B48C",
  "groundType": "sand",
  "skyGradient": ["#87CEEB", "#FDB813", "#D2B48C"],
  "decorations": [
    {
      "type": "scatter",
      "propId": "cactus",
      "density": 0.3,
      "minDistance": 5,
      "maxDistance": 40
    }
  ],
  "componentUrl": "/mods/environments/desert.js"
}
```

### 5.4 Bot Skin Format (JSON)

```json
{
  "$schema": "https://crewhub.dev/schemas/bot-skin-v1.json",
  "version": 1,
  "id": "pirate",
  "name": "Pirate Bot",
  "variant": {
    "color": "#8B4513",
    "expression": "happy",
    "icon": "🏴‍☠️",
    "label": "Pirate"
  },
  "accessory": {
    "type": "custom",
    "componentUrl": "/mods/accessories/pirate-hat.js"
  },
  "chestDisplay": {
    "type": "emoji",
    "emoji": "☠️"
  },
  "matchKeywords": ["pirate", "arr"],
  "metadata": {
    "author": "username"
  }
}
```

### 5.5 World Export (Complete Snapshot)

```json
{
  "$schema": "https://crewhub.dev/schemas/world-export-v1.json",
  "version": 1,
  "exportedAt": "2026-02-04T16:00:00Z",
  "rooms": [
    {
      "id": "room-1",
      "name": "Dev Room",
      "color": "#F32A1C",
      "icon": "⚙️",
      "blueprintId": "dev-room",
      "sortOrder": 0
    }
  ],
  "blueprints": { /* all custom blueprints */ },
  "customProps": { /* all custom prop definitions */ },
  "environment": "grass",
  "customEnvironments": {},
  "botSkins": { /* custom bot skins */ },
  "settings": {
    "buildingMaxCols": 3,
    "hallwayWidth": 4,
    "roomSize": 12
  }
}
```

---

## 6. Onboarding Flow for Modders

### 6.1 Creating Your First Custom Room (Step-by-Step)

**Goal:** Create a "Library" room with bookshelves, reading nook, and study desks.

#### Step 1: Understand the Grid
The room is a 20×20 grid where each cell is 0.6 world units. The total room is 12×12 units.
- Coordinates: `x=0` is west wall, `x=19` is east wall, `z=0` is north wall, `z=19` is south wall
- Walls occupy the perimeter: `x=0`, `x=19`, `z=0`, `z=19`
- Door is conventionally at `(9,19)` and `(10,19)` (south wall center)
- Interior cells are `x=1..18`, `z=1..18`

#### Step 2: Plan Your Layout (ASCII Art)
```
    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9
  0 # # # # # # # # # # # # # # # # # # # #
  1 # . . . . . . . . . . . . . . . . B B #   B = bookshelf
  2 # . . . . . . . . . . . . . . . . B B #
  3 # . . . . . . . . . . . . . . . . . . #
  4 # . . D D . . . . . . . . . D D . . . #   D = desk
  5 # . . i . . . . . . . . . . i . . . . #   i = work point
  6 # . . . . . . . . . . . . . . . . . . #
  7 # . . . . . . . . . . . . . . . . . . #
  8 # . . . . . . . . . . . . . . . . . . #
  9 # . . . . . . . . . . . . . . . . . . #
 10 # . . . . . b . . . . . . . . . . . . #   b = bean bag
 11 # . . . . . b . . . . . . . . . . . . #
 12 # . . . . . . . . . . . . . . . . . . #
 13 # . . . . . . . . . . . . . . . . . . #
 14 # . . . . . . . . . . . . . . . . . . #
 15 # . . . . . . . . . . . . . . . . . . #
 16 # . L . . . . . . . . . . . . . . . P #   L = lamp, P = plant
 17 # . . . . . . . . . . . . . . . . . . #
 18 # . z . . . . . . . . . . . . . . . . #   z = sleep corner
 19 # # # # # # # # # D D # # # # # # # # #   D = door
```

#### Step 3: Create the Blueprint JSON

```json
{
  "id": "library",
  "name": "Library",
  "gridWidth": 20,
  "gridDepth": 20,
  "cellSize": 0.6,
  "props": [
    { "propId": "bookshelf", "x": 17, "z": 1, "span": { "w": 2, "d": 2 } },
    { "propId": "desk-with-monitor", "x": 3, "z": 4, "span": { "w": 2, "d": 2 } },
    { "propId": "desk-with-monitor", "x": 14, "z": 4, "span": { "w": 2, "d": 2 } },
    { "propId": "bean-bag", "x": 6, "z": 10, "type": "decoration" },
    { "propId": "bean-bag", "x": 6, "z": 11, "type": "decoration" },
    { "propId": "lamp", "x": 2, "z": 16, "type": "decoration" },
    { "propId": "plant", "x": 18, "z": 16, "type": "decoration" }
  ],
  "interactions": {
    "work": [{ "x": 3, "z": 5 }, { "x": 14, "z": 5 }],
    "coffee": [],
    "sleep": [{ "x": 2, "z": 18 }]
  },
  "doors": [
    { "x": 9, "z": 19, "facing": "south" },
    { "x": 10, "z": 19, "facing": "south" }
  ],
  "walkableCenter": { "x": 10, "z": 10 }
}
```

#### Step 4: Register the Blueprint

With the mod system, this would be loaded automatically from a mods directory. Today, it requires adding to `blueprints.ts`:

```typescript
function createLibrary(): RoomBlueprint {
  const grid = createEmptyGrid(20, 20)
  placeOnGrid(grid, 17, 1, 'bookshelf', { span: { w: 2, d: 2 } })
  // ... rest of props
  return { id: 'library', name: 'Library', /* ... */ }
}
```

#### Step 5: Map Room to Blueprint

Add to `getBlueprintForRoom()`:
```typescript
if (name.includes('library')) return ROOM_BLUEPRINTS.library
```

#### Step 6: Test with Debug Panel

Enable the grid debug overlay (`useGridDebug` hook) to visualize:
- 🟢 Green = walkable cells
- 🔴 Red = blocked (furniture)
- 🔵 Blue = interaction points
- 🟡 Yellow = doors

### 6.2 Creating Your First Custom Prop

#### Step 1: Define the Component

```typescript
// MyBookstack.tsx
function BookstackProp({ position, rotation }: PropProps) {
  const bookToon = useToonMaterialProps('#8B4513')
  return (
    <group position={position} rotation={degToEuler(rotation)}>
      {[0, 0.08, 0.16].map((y, i) => (
        <mesh key={i} position={[0, y + 0.02, 0]} castShadow>
          <boxGeometry args={[0.3, 0.05, 0.2]} />
          <meshToonMaterial {...bookToon} />
        </mesh>
      ))}
    </group>
  )
}
```

#### Step 2: Register It

```typescript
// Add to PROP_REGISTRY:
'bookstack': { component: BookstackProp, mountType: 'floor', yOffset: 0.16 }
```

#### Step 3: Use in a Blueprint

```typescript
placeOnGrid(grid, 5, 10, 'bookstack', { type: 'decoration' })
```

---

## 7. Technical Debt & Refactoring Needs

### 7.1 Critical for Modding Support

#### 7.1.1 PropRegistry.tsx is Monolithic (~830 lines)

**Problem:** All 46 prop definitions (components + registry) live in a single file. Adding a new prop means editing this massive file.

**Recommendation:** Split into:
```
grid/props/
├── index.ts              — PropRegistry (mutable Map + register/unregister)
├── types.ts              — PropProps, PropEntry, MountType interfaces
├── wrappers/             — Wrapper components for standalone props
│   ├── DeskProp.ts
│   ├── MonitorProp.ts
│   └── ...
├── mini-props/           — Inline geometry props
│   ├── WhiteboardProp.tsx
│   ├── ServerRackProp.tsx
│   ├── EaselProp.tsx
│   └── ...
├── composites/           — Composite combinations
│   ├── DeskWithMonitorProp.tsx
│   └── ...
└── null.ts               — NullProp for interaction points
```

#### 7.1.2 Blueprints are Imperative TypeScript, Not Declarative Data

**Problem:** Room blueprints are created via function calls (`createHeadquarters()`) with imperative `placeOnGrid()` calls. This makes it impossible to serialize/deserialize blueprints without executing code.

**Recommendation:** Convert to a declarative JSON format with a parser:
```
// Instead of:
function createHeadquarters(): RoomBlueprint {
  const grid = createEmptyGrid(20, 20)
  placeOnGrid(grid, 4, 16, 'desk-with-monitor', { span: { w: 2, d: 2 } })
  ...
}

// Use:
const headquartersBlueprint = loadBlueprint(headquartersJSON)
```

Create a `blueprintLoader.ts` that:
1. Reads JSON blueprint
2. Calls `createEmptyGrid()` + `placeOnGrid()` + `placeDoor()` internally
3. Validates correctness (all interaction points are on walkable cells, doors connect to walls)
4. Returns `RoomBlueprint`

**Estimated effort:** 1-2 days. The existing utility functions already support this — just need the JSON→function call translation layer.

#### 7.1.3 Blueprint-to-Room Matching is Fragile

**Problem:** `getBlueprintForRoom()` (`blueprints.ts:395`) uses fuzzy substring matching on room names:
```typescript
if (name.includes('headquarter')) return ROOM_BLUEPRINTS.headquarters
```

This breaks if a room is named "New Dev Room & Headquarters" (matches both).

**Recommendation:** Use explicit `blueprintId` field on Room objects from the backend, with fuzzy matching only as fallback for rooms without explicit mapping.

#### 7.1.4 No Plugin Loading Infrastructure

**Problem:** There's no mechanism to load custom code (components, configs) at runtime.

**Recommendation:** Create a `ModLoader` system:
```typescript
interface ModManifest {
  id: string
  name: string
  version: string
  props?: PropModDefinition[]
  blueprints?: BlueprintModDefinition[]
  environments?: EnvironmentModDefinition[]
  botSkins?: BotSkinModDefinition[]
}

class ModLoader {
  private mods = new Map<string, LoadedMod>()
  
  async loadMod(manifest: ModManifest): Promise<void> { /* ... */ }
  unloadMod(modId: string): void { /* ... */ }
  getLoadedMods(): LoadedMod[] { /* ... */ }
}
```

### 7.2 Important for Architecture Cleanliness

#### 7.2.1 BotAccessory/BotChestDisplay/BotFace Use Switch Statements

**Files:** `BotAccessory.tsx:15`, `BotChestDisplay.tsx:20`, `BotFace.tsx:84`

Each uses a switch/conditional on the type string. This is the classic anti-pattern for extensibility.

**Recommendation:** Replace with registry lookups:
```typescript
// BotAccessory.tsx
const ACCESSORY_REGISTRY = new Map<string, React.FC<AccessoryProps>>()
ACCESSORY_REGISTRY.set('crown', Crown)
ACCESSORY_REGISTRY.set('lightbulb', LightbulbAntenna)
// ...

export function BotAccessory({ type, color }: BotAccessoryProps) {
  const Component = ACCESSORY_REGISTRY.get(type)
  if (!Component) return null
  return <Component color={color} />
}
```

#### 7.2.2 Environment Types are String Literal Unions

**File:** `environments/index.tsx:7`

```typescript
export type EnvironmentType = 'grass' | 'island' | 'floating'
```

**Recommendation:** Replace with a registry:
```typescript
const ENVIRONMENT_REGISTRY = new Map<string, {
  component: React.FC<EnvironmentProps>,
  label: string,
}>()
```

#### 7.2.3 Bot Position Registry is Module-Level Mutable State

**File:** `Bot3D.tsx:24`

```typescript
export const botPositionRegistry = new Map<string, { x: number; y: number; z: number }>()
```

This works but is fragile. It's a global mutable store outside React's state management.

**Recommendation:** Move to a dedicated `BotPositionStore` with event subscription for camera follow, or integrate into the WorldFocusContext.

#### 7.2.4 Animation State Has No Extension Hooks

**File:** `BotAnimations.tsx`

The `tickAnimState()` function (line 188) uses a switch with 3 hardcoded phase transitions. `useBotAnimation()` (line 102) has a useEffect with 4 hardcoded status handlers.

**Recommendation:** Refactor to a rule-based system:
```typescript
interface AnimTransitionRule {
  fromPhase: string | '*'
  toPhase: string
  condition: (status: BotStatus, anim: AnimState) => boolean
  apply: (anim: AnimState, interactionPoints: RoomInteractionPoints | null) => void
}
```

### 7.3 Nice to Have

| Issue | File | Description |
|-------|------|-------------|
| No TypeScript strict null checks on grid access | `blueprintUtils.ts:57` | `grid[cz][cx]` can be undefined if coords are wrong |
| `ColorPaletteProp` calls `useToonMaterialProps` in a loop | `PropRegistry.tsx:315` | Should use useMemo or pre-create materials |
| `getBotPositionsInRoom()` uses simple grid layout | `World3DView.tsx:124` | Should use grid interaction points for smarter placement |
| `World3DView.tsx` is 400+ lines | `World3DView.tsx` | Could split SceneContent into its own file |
| `useGridDebug` hook referenced but not shown | `Room3D.tsx:8` | Debug toggle mechanism not in analyzed files |

---

## 8. Recommended Architecture

### 8.1 Proposed Plugin/Mod System

```
┌──────────────────────────────────────────────────────────────────┐
│                      MOD SYSTEM ARCHITECTURE                      │
│                                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │ Prop         │  │ Blueprint   │  │ Environment │               │
│  │ Registry     │  │ Registry    │  │ Registry    │               │
│  │              │  │             │  │             │               │
│  │ register()   │  │ register()  │  │ register()  │               │
│  │ unregister() │  │ unregister()│  │ unregister()│               │
│  │ get()        │  │ get()       │  │ get()       │               │
│  │ list()       │  │ list()      │  │ list()      │               │
│  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘               │
│         │                 │                 │                      │
│  ┌──────┴─────────────────┴─────────────────┴──────┐               │
│  │                    ModManager                     │               │
│  │                                                   │               │
│  │  loadMod(manifest) → validates + registers all    │               │
│  │  unloadMod(id)     → cleans up registrations      │               │
│  │  listMods()        → returns loaded mod metadata  │               │
│  │                                                   │               │
│  │  Events: 'mod-loaded', 'mod-unloaded'             │               │
│  └───────────────────┬───────────────────────────────┘               │
│                      │                                               │
│  ┌───────────────────┴───────────────────────────────┐               │
│  │               Bot Customization                    │               │
│  │                                                    │               │
│  │  ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │               │
│  │  │ Variant      │ │ Accessory    │ │ ChestDisp  │ │               │
│  │  │ Registry     │ │ Registry     │ │ Registry   │ │               │
│  │  │              │ │              │ │            │ │               │
│  │  │ 5 built-in   │ │ 5 built-in   │ │ 5 built-in │ │               │
│  │  │ + extensible │ │ + extensible │ │ + extend.  │ │               │
│  │  └──────────────┘ └──────────────┘ └────────────┘ │               │
│  └────────────────────────────────────────────────────┘               │
│                                                                       │
│  ┌────────────────────────────────────────────────────┐               │
│  │             Animation System (future)               │               │
│  │                                                     │               │
│  │  Phase Registry + Transition Rule Registry          │               │
│  │  Built-in 7 phases + extensible                     │               │
│  └─────────────────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 Registry Pattern (Core Interface)

```typescript
// frontend/src/lib/modding/Registry.ts

export interface RegistryEntry<T> {
  id: string
  data: T
  source: 'builtin' | 'mod'
  modId?: string
}

export class Registry<T> {
  private entries = new Map<string, RegistryEntry<T>>()
  private listeners = new Set<() => void>()

  register(id: string, data: T, source: 'builtin' | 'mod' = 'builtin', modId?: string): void {
    this.entries.set(id, { id, data, source, modId })
    this.notify()
  }

  unregister(id: string): boolean {
    const deleted = this.entries.delete(id)
    if (deleted) this.notify()
    return deleted
  }

  get(id: string): T | null {
    return this.entries.get(id)?.data ?? null
  }

  has(id: string): boolean {
    return this.entries.has(id)
  }

  list(): RegistryEntry<T>[] {
    return Array.from(this.entries.values())
  }

  listBySource(source: 'builtin' | 'mod'): RegistryEntry<T>[] {
    return this.list().filter(e => e.source === source)
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.listeners.forEach(l => l())
  }
}
```

### 8.3 Concrete Registry Instances

```typescript
// frontend/src/lib/modding/registries.ts

import { Registry } from './Registry'

// ─── Prop Registry ──────────────────────────────────────────────
export interface PropRegistryEntry {
  component: React.FC<PropProps>
  mountType: MountType
  yOffset: number
  category?: string
  description?: string
  thumbnailUrl?: string
}

export const propRegistry = new Registry<PropRegistryEntry>()

// ─── Blueprint Registry ─────────────────────────────────────────
export interface BlueprintRegistryEntry {
  blueprint: RoomBlueprint
  description?: string
  thumbnailUrl?: string
  tags?: string[]
}

export const blueprintRegistry = new Registry<BlueprintRegistryEntry>()

// ─── Environment Registry ───────────────────────────────────────
export interface EnvironmentRegistryEntry {
  component: React.FC<EnvironmentProps>
  label: string
  description?: string
  thumbnailUrl?: string
}

export const environmentRegistry = new Registry<EnvironmentRegistryEntry>()

// ─── Bot Variant Registry ───────────────────────────────────────
export const botVariantRegistry = new Registry<BotVariantConfig>()

// ─── Accessory Registry ─────────────────────────────────────────
export const accessoryRegistry = new Registry<React.FC<{ color: string }>>()

// ─── Chest Display Registry ─────────────────────────────────────
export const chestDisplayRegistry = new Registry<React.FC<{ color: string }>>()
```

### 8.4 Blueprint Loader (JSON → RoomBlueprint)

```typescript
// frontend/src/lib/modding/blueprintLoader.ts

import { createEmptyGrid, placeOnGrid, placeDoor } from '../grid/blueprintUtils'
import type { RoomBlueprint } from '../grid/types'

interface BlueprintJSON {
  id: string
  name: string
  gridWidth: number
  gridDepth: number
  cellSize: number
  props: Array<{
    propId: string
    x: number
    z: number
    type?: 'furniture' | 'decoration' | 'interaction'
    interactionType?: 'work' | 'coffee' | 'sleep'
    rotation?: 0 | 90 | 180 | 270
    span?: { w: number; d: number }
  }>
  interactions: {
    work: Array<{ x: number; z: number }>
    coffee: Array<{ x: number; z: number }>
    sleep: Array<{ x: number; z: number }>
  }
  doors: Array<{ x: number; z: number; facing: 'north' | 'south' | 'east' | 'west' }>
  walkableCenter: { x: number; z: number }
}

export function loadBlueprintFromJSON(json: BlueprintJSON): RoomBlueprint {
  const grid = createEmptyGrid(json.gridWidth, json.gridDepth)

  // Place all props
  for (const prop of json.props) {
    placeOnGrid(grid, prop.x, prop.z, prop.propId, {
      type: prop.type,
      interactionType: prop.interactionType,
      rotation: prop.rotation,
      span: prop.span,
    })
  }

  // Place interaction points
  for (const wp of json.interactions.work) {
    placeOnGrid(grid, wp.x, wp.z, 'work-point', { type: 'interaction', interactionType: 'work' })
  }
  for (const cp of json.interactions.coffee) {
    placeOnGrid(grid, cp.x, cp.z, 'coffee-point', { type: 'interaction', interactionType: 'coffee' })
  }
  for (const sp of json.interactions.sleep) {
    placeOnGrid(grid, sp.x, sp.z, 'sleep-corner', { type: 'interaction', interactionType: 'sleep' })
  }

  // Place doors
  for (const door of json.doors) {
    placeDoor(grid, door.x, door.z)
  }

  return {
    id: json.id,
    name: json.name,
    gridWidth: json.gridWidth,
    gridDepth: json.gridDepth,
    cellSize: json.cellSize,
    cells: grid,
    doorPositions: json.doors,
    walkableCenter: json.walkableCenter,
    interactionPoints: json.interactions,
  }
}

export function validateBlueprint(bp: RoomBlueprint): string[] {
  const errors: string[] = []

  // Check doors are on walls
  for (const door of bp.doorPositions) {
    const isOnWall = door.x === 0 || door.x === bp.gridWidth - 1 ||
                     door.z === 0 || door.z === bp.gridDepth - 1
    if (!isOnWall) errors.push(`Door at (${door.x},${door.z}) is not on a wall`)
  }

  // Check interaction points are on walkable cells
  for (const [type, points] of Object.entries(bp.interactionPoints)) {
    for (const pt of points) {
      if (!bp.cells[pt.z]?.[pt.x]?.walkable) {
        errors.push(`${type} interaction at (${pt.x},${pt.z}) is not on a walkable cell`)
      }
    }
  }

  // Check walkable center is walkable
  const wc = bp.walkableCenter
  if (!bp.cells[wc.z]?.[wc.x]?.walkable) {
    errors.push(`Walkable center (${wc.x},${wc.z}) is not actually walkable`)
  }

  // Check at least one work interaction exists
  if (bp.interactionPoints.work.length === 0) {
    errors.push('Blueprint has no work interaction points')
  }

  return errors
}
```

### 8.5 Mod Manifest & Loader

```typescript
// frontend/src/lib/modding/ModManager.ts

interface ModManifest {
  id: string
  name: string
  version: string
  author?: string
  description?: string

  // Content definitions (all optional)
  props?: Array<{
    id: string
    componentPath: string      // Relative to mod root
    mountType: 'floor' | 'wall'
    yOffset: number
    category?: string
  }>
  blueprints?: Array<{
    id: string
    dataPath: string           // Path to blueprint JSON
  }>
  environments?: Array<{
    id: string
    label: string
    componentPath: string
  }>
  botSkins?: Array<{
    id: string
    config: BotVariantConfig
    matchKeywords?: string[]
  }>
}

class ModManager {
  private loadedMods = new Map<string, ModManifest>()

  async loadMod(manifest: ModManifest): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = []

    // Load props
    if (manifest.props) {
      for (const prop of manifest.props) {
        try {
          // Dynamic import of prop component
          const module = await import(/* webpackIgnore: true */ prop.componentPath)
          propRegistry.register(prop.id, {
            component: module.default,
            mountType: prop.mountType,
            yOffset: prop.yOffset,
            category: prop.category,
          }, 'mod', manifest.id)
        } catch (e) {
          errors.push(`Failed to load prop ${prop.id}: ${e}`)
        }
      }
    }

    // Load blueprints
    if (manifest.blueprints) {
      for (const bp of manifest.blueprints) {
        try {
          const response = await fetch(bp.dataPath)
          const json = await response.json()
          const blueprint = loadBlueprintFromJSON(json)
          const validationErrors = validateBlueprint(blueprint)
          if (validationErrors.length > 0) {
            errors.push(`Blueprint ${bp.id} validation: ${validationErrors.join(', ')}`)
          }
          blueprintRegistry.register(bp.id, { blueprint }, 'mod', manifest.id)
        } catch (e) {
          errors.push(`Failed to load blueprint ${bp.id}: ${e}`)
        }
      }
    }

    // Load bot skins
    if (manifest.botSkins) {
      for (const skin of manifest.botSkins) {
        botVariantRegistry.register(skin.id, skin.config, 'mod', manifest.id)
      }
    }

    this.loadedMods.set(manifest.id, manifest)
    return { success: errors.length === 0, errors }
  }

  unloadMod(modId: string): void {
    // Remove all entries registered by this mod
    for (const entry of propRegistry.list()) {
      if (entry.modId === modId) propRegistry.unregister(entry.id)
    }
    for (const entry of blueprintRegistry.list()) {
      if (entry.modId === modId) blueprintRegistry.unregister(entry.id)
    }
    for (const entry of environmentRegistry.list()) {
      if (entry.modId === modId) environmentRegistry.unregister(entry.id)
    }
    for (const entry of botVariantRegistry.list()) {
      if (entry.modId === modId) botVariantRegistry.unregister(entry.id)
    }
    this.loadedMods.delete(modId)
  }

  getLoadedMods(): ModManifest[] {
    return Array.from(this.loadedMods.values())
  }
}

export const modManager = new ModManager()
```

### 8.6 Migration Plan (Phased)

#### Phase 1: Registry Refactoring (1-2 days)
- Extract `PROP_REGISTRY` from static object to `Registry<PropEntry>` instance
- Populate built-in props at module load time
- Update `getPropEntry()` / `getPropComponent()` to use registry
- **Zero visual changes. Drop-in replacement.**

#### Phase 2: Blueprint Serialization (1-2 days)
- Create `BlueprintJSON` type and `loadBlueprintFromJSON()` parser
- Convert all 9 existing blueprints to JSON files
- Keep imperative functions as backwards-compatible wrappers
- Add `validateBlueprint()` function
- **Zero visual changes.**

#### Phase 3: Dynamic Registries for Bot Components (1 day)
- Replace switch statements in `BotAccessory`, `BotChestDisplay` with registry lookups
- Move `VARIANT_CONFIGS` to `botVariantRegistry`
- Move `VARIANT_KEYWORDS` detection logic to accept registered overrides
- **Zero visual changes.**

#### Phase 4: Environment Registry (0.5 days)
- Replace `EnvironmentType` union with registry
- Update `EnvironmentSwitcher` to use registry
- **Zero visual changes.**

#### Phase 5: ModManager + Loading Infrastructure (2-3 days)
- Implement `ModManifest` type and `ModManager` class
- Create mod loading UI (settings panel section)
- Implement dynamic import for prop components
- Blueprint validation and error reporting
- **New feature: mod loading from local files / URLs.**

#### Phase 6: Import/Export (1-2 days)
- World export (all rooms, blueprints, settings → JSON)
- Blueprint import (JSON → validate → register)
- Prop pack import (bundled props with thumbnails)

**Total estimated effort: 7-10 days** for full modding foundation.

### 8.7 File Structure (Proposed)

```
frontend/src/lib/
├── modding/
│   ├── Registry.ts              — Generic Registry<T> class
│   ├── registries.ts            — All concrete registry instances
│   ├── ModManager.ts            — Mod loading/unloading
│   ├── blueprintLoader.ts       — JSON → RoomBlueprint parser
│   ├── blueprintValidator.ts    — Blueprint validation rules
│   ├── schemas/                 — JSON Schema definitions
│   │   ├── room-blueprint-v1.json
│   │   ├── prop-definition-v1.json
│   │   ├── bot-skin-v1.json
│   │   └── mod-manifest-v1.json
│   └── types.ts                 — Shared mod types
├── grid/
│   ├── types.ts                 — (existing) Grid data model
│   ├── blueprints/              — (NEW) JSON blueprint files
│   │   ├── headquarters.json
│   │   ├── dev-room.json
│   │   ├── creative-room.json
│   │   ├── marketing-room.json
│   │   ├── thinking-room.json
│   │   ├── automation-room.json
│   │   ├── comms-room.json
│   │   ├── ops-room.json
│   │   └── default.json
│   ├── blueprintIndex.ts        — (REFACTORED) Loads JSON, registers in blueprintRegistry
│   ├── blueprintUtils.ts        — (existing) Grid utilities
│   └── pathfinding.ts           — (existing) A* pathfinding

frontend/src/components/world3d/grid/
├── PropRegistry.ts              — (REFACTORED) Uses propRegistry, split into files
├── props/                       — (NEW) Individual prop component files
│   ├── floor/
│   │   ├── WhiteboardProp.tsx
│   │   ├── ServerRackProp.tsx
│   │   ├── EaselProp.tsx
│   │   └── ...
│   ├── wall/
│   │   ├── SmallScreenProp.tsx
│   │   ├── WallClockProp.tsx
│   │   └── ...
│   └── composites/
│       ├── DeskWithMonitorProp.tsx
│       └── ...
├── GridRoomRenderer.tsx         — (existing, uses propRegistry.get())
└── GridDebugOverlay.tsx         — (existing)
```

---

## Summary

The CrewHub 3D World has a **solid architecture** with clean separation between data (grid system), rendering (Three.js components), and state management (React hooks + contexts). The grid-based room system introduced in the recent refactoring provides an excellent foundation for modding.

**Key strengths:**
- The `RoomBlueprint` / `GridCell` / `PropEntry` data model is already well-designed for serialization
- The rendering pipeline (Grid → Props → Three.js) has clear boundaries
- Environment system has a clean, minimal interface
- Bot variant system already has a config-driven pattern

**Key gaps for modding:**
- All registries are static constants (need dynamic registration)
- Blueprints are imperative code (need JSON serialization)
- Bot components use switch statements (need registry lookups)
- No plugin/mod loading infrastructure exists

**Recommended approach:** Phased migration over ~7-10 days, starting with registry patterns (zero visual changes) and building toward full mod loading. Each phase is independently shippable and backward-compatible.

---

*This document references the existing design docs (`3d-world-design.md`, `grid-system-design.md`, `grid-system-review-gpt5.md`) and should be read alongside them for full context.*
