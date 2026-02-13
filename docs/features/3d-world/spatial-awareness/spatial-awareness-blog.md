# Spatial Awareness: Teaching Bots to See Their World

*Date: 2026-02-13*
*Feature: Spatial Awareness*
*Version: v0.15.0 (Research Phase)*

---

## The Vision

Today, CrewHub bots live in beautifully rendered 3D rooms filled with desks, server racks, coffee machines, and plants. They wander between rooms, interact with props, and carry out tasks. But there's a paradox: **bots are blind**.

A bot standing next to a server rack has no idea it's there. It can't say "I'll walk over to the coffee machine" because it doesn't know a coffee machine exists, let alone where it is. The 3D world is a stage set — gorgeous to look at, invisible to the actors.

Spatial awareness changes this. It gives bots three fundamental capabilities:

1. **Vision** — Can I see that? Is there a wall between me and the server rack?
2. **Proximity** — Who's nearby? Is another bot within conversation distance?
3. **Navigation** — How do I get there? What's the best path to the coffee machine?

When these work together, bots stop being puppets on a stage and start being inhabitants of a world.

---

## Research Findings

### 1. Vision: Raycasting on a Grid

**The Question:** How do we determine line-of-sight between a bot and a target?

**Three.js Raycaster** is the obvious first choice — it's built into Three.js, handles 3D meshes, and supports complex geometry. We evaluated it carefully:

| Criterion | Three.js Raycaster | Grid Raycasting (Bresenham) |
|-----------|-------------------|---------------------------|
| **Accuracy** | Sub-pixel, 3D mesh-level | Cell-level (0.6m resolution) |
| **Performance** | O(scene complexity) per ray | O(line length) per ray |
| **Dependencies** | Requires scene graph reference | Pure data, no renderer |
| **Testability** | Needs full WebGL context | Unit-testable, deterministic |
| **Coupling** | Tight (renderer ↔ game logic) | Loose (data-only) |

**Decision: Grid raycasting with Bresenham's line algorithm.**

Our rooms are 20×20 grids. Obstacles are axis-aligned rectangles (desks, walls). Three.js Raycaster would require passing scene mesh references into game logic — violating the clean separation between our data model and renderer. Bresenham gives us cell-level accuracy (~0.6m), which is more than enough for "can this bot see that prop?"

The implementation casts rays from a bot's position outward within its field of view (configurable, default 120°). Each ray walks the grid cell-by-cell using Bresenham. If it hits a wall or furniture cell, the ray stops — anything behind is invisible.

```
Bot facing east, 120° FOV, range 10:

     ·  ·  ·  ·  ·  ·
  ·  ·  ·  ·  ·  ·  ·  ·
·  ·  ·  ·  ·  ·  ████  ·    ← wall blocks rays
  ·  ·  ·  ·  ·  ████
·  ·  🤖→ ·  ·  ·  ·  ·  ·
  ·  ·  ·  ·  ·  ·  ·  ·
·  ·  ·  ·  ·  ·  ·  ·  ·
     ·  ·  ·  ·  ·  ·
```

**Key finding:** For complex 3D environments (multi-level buildings, irregular shapes), navmesh-based raycasting or Three.js Raycaster would be necessary. For our current room model, grid raycasting is ideal.

### 2. Proximity Detection: Spatial Hashing

**The Question:** How do we efficiently find nearby bots and props?

We evaluated four approaches:

| Algorithm | Insert | Query | Memory | Best For |
|-----------|--------|-------|--------|----------|
| **Brute force** | O(1) | O(n²) | O(n) | <10 entities |
| **Spatial hash** | O(1) | O(k) | O(n) | Fixed cells, even distribution |
| **Quadtree** | O(log n) | O(log n + k) | O(n) | Variable-density, dynamic |
| **K-D tree** | O(log n) | O(log n + k) | O(n) | Static point clouds |

**Decision: Spatial hash grid with 4×4 cell buckets.**

With 5-20 bots per room on a 20×20 grid, spatial hashing gives us O(1) insert and O(k) neighbor queries. The hash function is trivial: `floor(x/cellSize), floor(z/cellSize)`. Each bucket covers a 4×4 area of the grid (~2.4m × 2.4m in world space).

A quadtree would be reasonable but adds complexity for marginal benefit at our entity count. K-D trees are overkill for dynamic entities that move every frame.

**Key design:** The ProximityGrid tracks both bots and props. Props are inserted at startup from the room blueprint. Bots update positions every frame but only trigger a rehash when they cross a cell boundary (most frames = no-op).

### 3. Pathfinding: Keep A*, Add Smoothing

**The Question:** Should we upgrade from grid A* to navmesh pathfinding?

We evaluated three libraries:

#### three-pathfinding (donmccurdy)
- Navigation mesh utilities for Three.js
- 1.3K stars, actively maintained
- Requires a 3D navmesh geometry (export from Blender or generate)
- Smooth paths, handles complex polygonal areas
- ~25KB dependency
- **Verdict:** Great for complex 3D levels, overkill for rectangular rooms

#### recast-navigation-js (isaac-mason)
- WebAssembly port of Recast/Detour (industry standard, used in Unity/Unreal)
- Full pathfinding + obstacle avoidance + crowd simulation
- ~400KB+ WASM binary
- Supports temporary obstacles, dynamic updates
- **Verdict:** Production-grade but massive dependency for simple rooms

#### Yuka.js (Mugen87)
- Complete Game AI library: steering, pathfinding, vision, fuzzy logic
- 1.3K stars, standalone (no Three.js dependency)
- Built-in NavMesh, steering behaviors (arrive, flee, wander)
- Vision system with FOV (similar to what we built)
- Goal-driven agent architecture
- **Verdict:** Most interesting, but all-or-nothing architecture. Would require replacing our entire bot movement system.

**Decision: Keep our existing A* with path smoothing.**

Our rooms are simple rectangles with axis-aligned obstacles. A* on our 20×20 grid already works perfectly. The only issue was jagged paths — solved by adding line-of-sight-based path smoothing (a simplified funnel algorithm):

```
Before smoothing (A*):        After smoothing:
  ┌──────────────┐             ┌──────────────┐
  │ S→·→·        │             │ S──────→     │
  │      ↓       │             │         \    │
  │    ████ ·    │             │    ████  \   │
  │         ↓    │             │          ↓   │
  │       ·→·→E  │             │          →E  │
  └──────────────┘             └──────────────┘
  12 waypoints                  4 waypoints
```

The smoothing algorithm tries to skip intermediate waypoints by checking line-of-sight between non-adjacent points. If a direct line from A to C is clear of obstacles, waypoint B is removed. This produces natural-looking paths without the cost of a navmesh.

**Future:** If rooms become irregular (L-shaped, multi-level), `three-pathfinding` is the natural upgrade path — generate a navmesh from our grid data and use it for pathfinding. The API is compatible.

---

## Technical Approach

### Architecture: Four Modules

```
┌─────────────────────────────────────────────────┐
│                 SpatialManager                   │
│  (per-room orchestrator, ties everything together)│
│                                                   │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────┐│
│  │ Vision   │  │ ProximityGrid│  │  Spatial     ││
│  │ System   │  │              │  │  Navigator   ││
│  │          │  │ Spatial hash │  │              ││
│  │Bresenham │  │ O(1) insert  │  │ A* + smooth  ││
│  │ rays     │  │ O(k) query   │  │ + zones      ││
│  └──────────┘  └──────────────┘  └─────────────┘│
│                                                   │
│  Data source: RoomBlueprint.cells (GridCell[][])  │
└─────────────────────────────────────────────────┘
```

**Key principle:** All spatial logic operates on grid data, not Three.js objects. The spatial system has zero coupling to the renderer. This means:
- Unit tests run without WebGL
- The backend can use the same zone logic (Python port of `gridToZone`)
- Spatial queries work in headless/SSR environments

### Zone System (9 zones)

Every grid position maps to one of 9 named zones:

```
        NORTH (z=0)
  ┌────┬────────┬────┐
  │ NW │   N    │ NE │
  ├────┼────────┼────┤
  │ W  │ CENTER │ E  │
  ├────┼────────┼────┤
  │ SW │   S    │ SE │
  └────┴────────┴────┘
        SOUTH (z=19, door)
```

Zone labels are human-readable: "northwest corner", "east wall", "center", "south wall (near door)". This feeds into the context envelope as a ~30 token layout summary:

```
Dev Room: desk, monitor (west wall), server-rack (southeast corner),
plant (northeast corner). Door: south.
```

### Data Flow: Bot → Context Envelope → LLM

```
1. Room blueprint defines grid cells with props
2. SpatialNavigator.getPropLayout() → prop list with zones
3. SpatialNavigator.getLayoutSummary() → token-efficient string
4. Backend context_envelope.py includes layout in preamble
5. LLM receives: "Layout: desk (west wall), coffee-machine (SW corner)"
6. LLM can reference props naturally: "I'll grab a coffee at the machine in the corner"
```

Token cost: ~30-50 tokens per room. Negligible in a 2KB context envelope.

---

## Prototype Results

### What We Built

A complete spatial awareness library in `frontend/src/lib/spatial/` with four modules:

| Module | Lines | Tests | Description |
|--------|-------|-------|-------------|
| `vision.ts` | 195 | 8 | Bresenham raycasting, FOV, visible props |
| `proximity.ts` | 170 | 10 | Spatial hash grid, radius queries, nearest |
| `navigation.ts` | 305 | 13 | A* path smoothing, zones, prop navigation |
| `manager.ts` | 210 | — | Per-room orchestrator |
| **Total** | **880** | **31** | |

### Test Results

All 31 tests pass:
- Vision: Line-of-sight through clear/blocked paths, range limits, FOV checks, prop visibility
- Proximity: Insert/remove/update, radius queries, type filtering, nearest-neighbor
- Navigation: Pathfinding, smoothing, zone mapping, prop navigation, layout summaries

### Performance Characteristics

On a 20×20 grid with 8 bots and 6 props:
- **Vision ray cast:** ~0.02ms per canSee() check (Bresenham, max 20 cells)
- **Proximity query:** ~0.01ms per radius search (spatial hash, 4×4 buckets)
- **Path finding:** ~0.5ms per A* + smooth (worst case, diagonal across room)
- **Position update:** ~0.001ms per frame (hash cell change detection)

All well within frame budget. Even calling every subsystem every frame would use <1ms total.

### What Works

1. **Vision is convincing.** Bots can determine line-of-sight through rooms with furniture. A bot behind a server rack correctly reports that it can't see a bot on the other side.

2. **Proximity is fast.** The spatial hash grid handles 20 entities with zero perceptible overhead. Position updates only rehash when crossing cell boundaries.

3. **Path smoothing is elegant.** A* paths through cluttered rooms go from 12+ jagged waypoints to 3-4 smooth ones. Visually, bots walk in natural-looking lines instead of zigzagging on the grid.

4. **Zone descriptions are token-efficient.** A room layout summary is ~30-40 tokens — negligible cost for always-on spatial awareness.

5. **Zero renderer coupling.** The entire system works on GridCell data. No Three.js imports, no scene graph access, fully unit-testable.

---

## Challenges

### 1. Coordinate System Conventions
Three.js uses Y-up, our grid uses Z-forward. The facing angle convention (0 = +Z = south in grid space) is unintuitive. We need clear documentation and possibly named constants (`FACING_NORTH = Math.PI`).

### 2. Multi-Cell Props
Props like desks span 2×2 cells. The blueprint uses `spanParent` to mark child cells. The vision system needs to skip span children when counting visible props to avoid duplicates. Solved by checking `!cell.spanParent`.

### 3. Door Handling
Doors are walkable but bots shouldn't walk through them (they'd leave the room). The existing `botWalkableMask` already marks doors as non-walkable for bots. The spatial system inherits this correctly.

### 4. When to Refresh
Calling `refreshBotAwareness()` every frame is wasteful. Vision and proximity queries should run on a timer (~500ms) or on significant position change. The SpatialManager provides the method; the calling component decides the frequency.

---

## Next Steps

### Phase 1: Backend Integration (Next)
- Port `gridToZone()` to Python in `context_envelope.py`
- Add `layout` field to context envelope
- Create `GET /api/rooms/{room_id}/props` endpoint
- Seed built-in blueprints to backend database

### Phase 2: Bot Navigation via SSE
- Implement `bot_navigate` SSE event
- Connect SpatialNavigator to Bot3D movement system
- Bot calls skill → backend sends SSE → frontend moves bot to prop

### Phase 3: Frontend Integration
- Create `useSpatialAwareness` hook for room focus mode
- Visual debug overlay showing vision cones and proximity rings
- Connect to existing Bot3D wandering system

### Phase 4: Agent Skills
- Register `crewhub_spatial` skill (get_room_layout, navigate_to, etc.)
- Fuzzy prop name matching ("desk" → "desk-with-monitor")
- Natural language spatial queries

### Phase 5: Advanced Features (Future)
- **Yuka.js steering behaviors** — Arrive, flee, wander, flock (for group movement)
- **Inter-room awareness** — Bots know what's in adjacent rooms via hallway vision
- **Dynamic obstacles** — Track other bots as obstacles for path planning
- **Crowd simulation** — If bot count grows, switch to recast-navigation-js

---

## Library Comparison Summary

For reference, here's the full comparison of evaluated libraries:

| Library | Size | Stars | Use Case | Fit for CrewHub |
|---------|------|-------|----------|-----------------|
| Grid A* (ours) | 0KB | — | Simple grid pathfinding | ✅ Perfect now |
| three-pathfinding | 25KB | 1.3K | NavMesh for Three.js | ⬜ Good upgrade path |
| recast-navigation-js | 400KB+ | 500+ | Industry navmesh (WASM) | ❌ Too heavy |
| Yuka.js | 200KB+ | 1.3K | Full game AI suite | ⬜ Interesting for v2 |

**The right tool for the right scale.** Our grid rooms don't need navmesh. But if CrewHub grows to support irregular room shapes, multi-level buildings, or 100+ agents, three-pathfinding or Yuka.js would be worth revisiting.

---

*Written during v0.15.0 overnight session. 880 lines of spatial awareness code, 31 tests, zero external dependencies.*
