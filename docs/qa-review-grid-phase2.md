# QA Review — Grid System Phase 2 (Renderer + Pathfinding)
Date: 2026-02-03

Scope: Grid blueprints now drive room prop rendering; bots use A* pathfinding + grid-based interaction points.

---

## 🔴 Critical

### 1) Blueprints overwrite props in the same cell (desk/monitor collisions) → missing furniture + incorrect walkability
**Where:** `frontend/src/lib/grid/blueprints.ts` + `frontend/src/lib/grid/blueprintUtils.ts` + `GridRoomRenderer.tsx`

**Issue:** A `GridCell` only holds a single `propId`/`type`/`walkable`. Many blueprints place multiple props on the **same (x,z)** (e.g. desk then monitor on desk cell). `placeOnGrid()` overwrites the cell fields, so the later placement wins.

**Example:** Headquarters
- `placeOnGrid(grid, 3, 3, 'desk', { span: { w:2, d:2 } })`
- then `placeOnGrid(grid, 3, 3, 'monitor', { type: 'decoration' })`

This causes:
- Desk anchor cell `(3,3)` becomes `monitor` (decoration, walkable) and **desk anchor is lost**.
- The other spanned desk cells have `spanParent: {x:3,z:3}` so the renderer skips them, meaning **the desk never renders at all**.
- Walkability/type is also mutated (desk footprint partially becomes walkable), so bots may path “through” the desk area.

**Why it’s critical:** Visual breakage (missing major props) + navigation breakage (walkability mask wrong) in multiple rooms (any desk/monitor combos, etc.).

**Recommendation:**
- Either support **stacked props per cell** (e.g. `props: Array<{propId,type,rotation,...}>`), or
- Model “monitor-on-desk” as part of the **Desk component** (remove monitor placements), or
- Place decorations in **distinct cells** and keep furniture footprints consistent.

### 2) Pathfinding failure falls back to direct movement (bots can walk through walls/props)
**Where:** `frontend/src/components/world3d/Bot3D.tsx`

**Issue:** If `computePath()` fails (`findPath` returns null or length <= 1), Bot3D falls back to the “No path — direct movement” branch and walks straight toward `state.targetX/Z`.

**Why it’s critical:** Any unreachable target or invalid grid conversion results in bots beelining through obstacles, defeating A*.

**Recommendation:**
- Use `findNearestWalkable()` (already implemented in `pathfinding.ts`) to snap end (and possibly start) to the nearest walkable cell.
- If still no path, pick a new wander target / abort the current anim-target (set `anim.targetX/Z = null` or `anim.resetWanderTarget = true`).

### 3) Target changes don’t reliably recompute paths (can follow stale path)
**Where:** `Bot3D.tsx`

**Issue:** When `anim.targetX/Z` changes, path is only computed if `targetChanged && pathRef.current.length === 0`.

If the bot already has a path and then its target changes (status flip, coffee vs desk, etc.), it can continue following the old path toward the old target.

**Recommendation:**
- When target changes, clear path (`pathRef.current=[]; pathIndexRef.current=0; pathTargetWorld.current=null`) and recompute.

---

## 🟡 Important

### 4) `worldToGrid()` uses `Math.floor`, while blueprint authoring notes use `Math.round` → potential off-by-one / drift
**Where:**
- Blueprint comments: `blueprints.ts` header
- Runtime conversion: `blueprintUtils.ts` `worldToGrid()`

**Issue:** The blueprint translation comments describe `Math.round((world + halfSize)/cellSize)`, but runtime `worldToGrid` uses `Math.floor`.

**Impact:**
- Interactions and movement targets near cell boundaries can resolve to different grid cells than expected during authoring.
- May be subtle, but can create “why is this one cell off?” issues and occasional unreachable end cells.

**Recommendation:**
- Align authoring + runtime conversion (either document floor, or change runtime to round/center-based mapping), and add tests for corners/edges.

### 5) Interaction points: only the first cell is used; blueprint `interactionPoints` field is unused
**Where:** `BotAnimations.tsx` (`getRoomInteractionPoints`) and `blueprints.ts`

**Issue:** `getRoomInteractionPoints()` derives points by scanning the grid (`findInteractionCells`) and then picks `workCells[0]`, `coffeeCells[0]`, `sleepCells[0]`.

**Impact:**
- Rooms with multiple work points (e.g. Dev Room has `work-point-1` + `work-point-2`) will still route bots to a single “first” point → stacking.
- The `interactionPoints` precomputed data in the blueprint objects is currently redundant.

**Recommendation:**
- Choose an interaction cell randomly, or choose the closest to bot position.
- Alternatively, trust `blueprint.interactionPoints` (single source of truth) and keep `findInteractionCells` only for debugging.

### 6) Renderer does a second prop lookup per instance
**Where:** `GridRoomRenderer.tsx`

**Issue:** `getPropComponent` is called once during instance build (only to skip unknowns) and again during render.

**Impact:** Minor CPU overhead; easy win.

**Recommendation:** Store the `Component` in `PropInstance` during memoization and render it directly.

### 7) Blueprint coordinate comments appear inconsistent with z-axis convention
**Where:** `blueprints.ts`

**Issue:** Header states `z=0` north wall, `z=19` south wall. Several comments say “front-right” while placing `z` near 0–2 (which is “north/back” per convention).

**Impact:** Increases risk of future blueprint edits placing props mirrored/flipped.

**Recommendation:** Normalize terminology (“north/south/east/west” or “back/front” consistently) and/or add a simple debug overlay (grid coords) during development.

---

## 🟢 Nice-to-have

### 8) PropRegistry organization
**Where:** `PropRegistry.tsx`

**Notes:** File is large but understandable. Consider:
- Splitting mini-props into separate files/folders (e.g. `grid/props/mini/*`) and exporting a combined registry.
- Typing `rotation` as a union `0|90|180|270` for stronger safety (currently `number`).

### 9) Mesh count / instancing opportunities
**Where:** many prop components in `PropRegistry.tsx`

Several mini-props are many individual meshes (bookshelf books, server rack slots, etc.). This is fine for 1 room, but scale risk if many rooms are visible.

Potential improvements:
- Merge static meshes where feasible.
- Consider instancing repeated small elements.

### 10) Bot3D path caching
**Where:** `Bot3D.tsx`

Pathfinding is not called every frame (good), but you may still compute paths often for idle wandering across many bots.

Potential improvements:
- Cache paths between frequent start/end grid pairs for a short TTL.
- Or reduce wander frequency / distance.

---

## Summary of main risks
- **Visual:** desks/large props missing due to cell overwrites; mispositioned props due to inconsistent coordinate assumptions.
- **Navigation:** walkable mask corruption from overwrites; bots walk through obstacles when no path found; stale path when target changes.

## Suggested smoke tests
1. Render each room type and verify key anchor props appear (desk, table, etc.).
2. Enable a debug view for walkable cells; confirm furniture footprints are non-walkable.
3. Force bot statuses to cycle (active → idle → sleeping) and confirm bots reach desk/coffee/sleep without clipping through furniture.
4. Test unreachable targets (place a fully blocked area) and confirm bots do not beeline through walls.
