# Zone Room Architecture (Shared Room Infrastructure)

## Goal

Make non-campus zones (starting with **Creator Center**) use the same room construction pipeline as Main Campus:

- Same room shell primitives (floor, walls, lighting pattern, props)
- Same prop/blueprint registry pipeline
- Zone-specific content (like **PropMaker machine**) as regular props inside a room
- Future-proof for multiple rooms per zone and per-zone theming

---

## Current State (Summary)

- **Main Campus** uses `Room3D` + shared room primitives (`RoomFloor`, `RoomWalls`, `GridRoomRenderer`, etc.) and registry-based blueprints/props.
- **Creator Center** currently uses `CreatorCenterView.tsx` with a custom hardcoded scene.
- `PropMakerRoom.tsx` manually builds walls/floor and places `PropMakerMachine` directly, bypassing campus room pipeline.

Result: duplicated environment logic + harder reuse.

---

## Architecture Decisions

## 1) Existing `Room` vs new `ZoneRoom`?

**Decision:** Reuse existing room infrastructure, but split into a shared core + thin wrappers.

- Keep **one canonical room shell** implementation.
- Extract a presentational core from `Room3D` (no campus-only interaction assumptions).
- Build wrappers:
  - `CampusRoom3D` (current behavior: focus, task walls, drag-drop, room HUD hooks)
  - `ZoneRoom3D` (zone-safe behavior: optional interactions, zone-local overlays)

This avoids a completely separate `ZoneRoom` fork while preventing `Room3D` from becoming a monolith.

---

## 2) Zone-specific props in registry?

**Decision:** Register zone props in the same `propRegistry`, namespaced per zone.

Suggested IDs:
- `zone-creator:prop-maker-machine`
- `zone-creator:prop-showcase`
- future: `zone-academy:lesson-podium`, etc.

Rules:
- `source: 'builtin'` for built-in zone props.
- Keep mount metadata (`mountType`, `yOffset`) exactly like other props.
- Zone props are rendered by `GridRoomRenderer` from blueprints/configs, not hardcoded in scene components.

This makes PropMaker a first-class room prop, same as desk/lamp.

---

## 3) Zone room layout config?

**Decision:** Yes, each zone gets typed room layout config, same concept as campus room assignment.

Use TS config (preferred over raw JSON for now) with optional JSON export later.

```ts
// frontend/src/lib/zones/roomConfigs/types.ts
export interface ZoneRoomConfig {
  id: string
  name: string
  icon: string
  size: number
  themeId: string
  blueprintId: string // e.g. "zone-creator:main-room"
  spawnPoint: [number, number, number]
}

export interface ZoneLayoutConfig {
  zoneId: string
  defaultRoomId: string
  rooms: ZoneRoomConfig[]
}
```

Example:

```ts
// frontend/src/lib/zones/roomConfigs/creatorCenter.ts
export const CREATOR_CENTER_LAYOUT: ZoneLayoutConfig = {
  zoneId: 'creator-center',
  defaultRoomId: 'creator-main-room',
  rooms: [
    {
      id: 'creator-main-room',
      name: 'Prop Lab',
      icon: '🧪',
      size: 12,
      themeId: 'creator-neon',
      blueprintId: 'zone-creator:main-room',
      spawnPoint: [0, 0, 6],
    },
  ],
}
```

---

## 4) Campus ↔ zone transition model?

**Decision:** Teleport to a room-level spawn target.

Add target-aware zone switching:

```ts
type ZoneDestination = {
  zoneId: string
  roomId?: string
  spawnPointId?: string
}
```

Flow:
1. User switches zone.
2. Resolve destination room (explicit roomId or zone defaultRoomId).
3. Resolve spawn point (named spawn or room default).
4. Persist in `zonePersistence` (`activeZoneId`, `lastRoomId`, `lastPosition`).
5. Camera spawns at destination.

This works for current single-room zones and scales to multi-room zones.

---

## 5) One room per zone or multiple?

**Decision:** Support **multiple rooms in architecture**, ship Creator with one room initially.

Why:
- No rewrite when Creator grows (Prop Lab, Asset Vault, Streaming Studio).
- Same navigation pattern as campus room tabs can be reused for zone rooms.

MVP scope remains small (one room), but model is future-proof.

---

## Component Hierarchy

```text
ZoneRenderer
  └─ ZoneWorldView (generic for non-campus room-based zones)
      └─ ZoneRoomScene
          ├─ SharedRoomShell (floor, walls, nameplate, optional door frame)
          ├─ GridRoomRenderer (blueprint placements)
          │   └─ PropRegistry components (builtin + zone-specific)
          ├─ ZoneThemeLighting (theme-driven light preset)
          └─ ZoneOverlays (optional UI)
```

Campus path remains:

```text
World3DView
  └─ CampusRoom3D
      └─ SharedRoomShell + campus-only systems (focus, drag/drop, task wall, etc.)
```

---

## Code Reuse Strategy

## A) Extract shared room shell

From `Room3D`, extract a reusable core component:

- `RoomFloor`
- `RoomWalls`
- `RoomNameplate` (optional)
- `GridRoomRenderer`

Proposed new component:

- `frontend/src/components/world3d/rooms/SharedRoomShell.tsx`

Inputs:
- `size`, `color`, `wallStyle`, `floorStyle`
- `blueprintId` (or resolved blueprint object)
- optional interactions (`hoverable`, `clickable`, handlers)
- optional add-ons (`children`)

## B) Keep wrappers thin

- `CampusRoom3D` composes `SharedRoomShell` + existing campus behaviors.
- `ZoneRoom3D` composes `SharedRoomShell` + zone theme + minimal interactions.

## C) Remove manual room geometry from Creator

- Deprecate hardcoded floor/walls in `PropMakerRoom.tsx`.
- Replace with blueprint-driven room using `ZoneRoom3D`.

---

## Zone Room Config + Blueprint Model

## Proposed files

- `frontend/src/lib/zones/roomConfigs/types.ts`
- `frontend/src/lib/zones/roomConfigs/index.ts`
- `frontend/src/lib/zones/roomConfigs/creatorCenter.ts`
- `frontend/src/lib/grid/blueprints/zones/creator-main-room.json`

Blueprint example content:
- `builtin:desk-with-monitor-tablet`
- `zone-creator:prop-maker-machine` (center)
- `zone-creator:prop-showcase` (ring/side stations)
- wall displays, lights, etc.

Use existing `blueprintRegistry` and loader path; only add zone blueprint registration entries.

---

## Prop Registry Integration

## Registration

- Add `frontend/src/components/world3d/grid/props/zoneCreatorProps.ts`
- Register with `propRegistry.register(..., 'builtin')`

Example:

```ts
propRegistry.register('zone-creator:prop-maker-machine', {
  component: PropMakerMachineProp,
  mountType: 'floor',
  yOffset: 0.16,
}, 'builtin')
```

## Rendering

No special renderer path needed:
- `GridRoomRenderer` already resolves prop by id via registry.
- Zone props render like any other props.

## Persistence

Generated custom props continue through existing `custom:*` flow.
If needed later, `modId` can be zone-scoped (e.g. `creator-zone`) for bulk cleanup.

---

## Theme System Design

Keep **structure constant**, vary visual theme via token sets.

```ts
export interface RoomThemeTokens {
  id: string
  floorColor: string
  wallColor: string
  trimColor?: string
  ambientLight?: { intensity: number; color: string }
  hemiLight?: { sky: string; ground: string; intensity: number }
  dirLight?: { intensity: number; color: string }
  environmentId?: string
}
```

Suggested location:
- `frontend/src/components/world3d/rooms/themes/`

Examples:
- `campus-classic`
- `creator-neon`
- `academy-soft`
- `game-arcade`

`ZoneRoom3D` applies theme tokens to `SharedRoomShell` and lighting. Blueprint/layout remain unchanged.

---

## Navigation & UX

- Zone switch enters `defaultRoomId` for that zone.
- If zone has >1 room, show a room tab bar (same pattern as `RoomTabsBar`, zone-scoped variant).
- Preserve last room/position per zone in persistence for return continuity.
- Teleporters/portals later can call `switchZone({ zoneId, roomId, spawnPointId })`.

---

## Migration Plan (Creator Zone)

## Phase 1 — Infrastructure extraction
1. Extract `SharedRoomShell` from `Room3D`.
2. Refactor campus `Room3D` to use shared shell (no behavior change).

## Phase 2 — Zone room plumbing
3. Add zone room config types + creator layout config.
4. Add zone blueprint (`zone-creator:main-room`) and register it.
5. Add zone prop registrations for PropMaker machine/showcase.

## Phase 3 — Creator integration
6. Replace `CreatorCenterView` hardcoded scene with `ZoneWorldView` + `ZoneRoom3D`.
7. Remove manual room geometry from `PropMakerRoom`; keep machine/showcase logic in prop components.
8. Verify PropMaker save flow (`/api/creator/save-prop`) still works.

## Phase 4 — Navigation + persistence
9. Extend `ZoneContext.switchZone` to accept destination payload.
10. Persist per-zone room/position.

## Phase 5 — Cleanup
11. Delete/retire obsolete Creator-only room shell code.
12. Add tests for zone room config resolution + registry presence.

---

## Risks / Notes

- `Room3D` currently includes campus-specific interactions; extraction must avoid regressions.
- Blueprint IDs and prop IDs must remain namespaced to prevent collisions.
- Keep Creator MVP simple: one room first, multi-room support behind config.

---

## Outcome

After this refactor, Creator Center (and future zones) will use the **same room construction pipeline** as Main Campus:

- same shell
- same prop registry
- same blueprint/layout flow
- zone-specific identity through themes + props, not duplicate scene code
