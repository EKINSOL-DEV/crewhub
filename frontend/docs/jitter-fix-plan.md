# Bot Jitter Fix Plan — Detailed Code Changes

> **Status:** PLAN ONLY — do not apply yet
> **Date:** 2026-02-04
> **Files involved:**
> - `Bot3D.tsx` — main bot component
> - `BotAnimations.tsx` — animation state machine
> - `World3DView.tsx` — room bounds creation

---

## Fix 1: React Props vs useFrame Conflict (CRITICAL)

**File:** `Bot3D.tsx`
**Problem:** The `<group>` JSX at ~line 280 has declarative `position={[...]}` and `scale={scale}`. On every React re-render, React/R3F reconciles these props and snaps the group transform back to the prop values *before* useFrame runs the next tick. This causes a single-frame visual snap.

**Root cause code (Bot3D.tsx ~line 280-282):**
```tsx
<group
  ref={groupRef}
  position={[position[0], position[1], position[2]]}
  scale={scale}
```

**useFrame** (line ~147) manages `groupRef.current.position` and `groupRef.current.scale` imperatively every frame. The declarative props fight with this.

### Fix

**Remove** `position` and `scale` from the JSX group props. Initialize them only once via the existing `hasInitialized` ref logic (which already handles first-frame snap on line ~152):

```tsx
// OLD (~line 280):
<group
  ref={groupRef}
  position={[position[0], position[1], position[2]]}
  scale={scale}

// NEW:
<group
  ref={groupRef}
```

Then ensure the **initial position and scale** are set once. The existing first-frame block (lines 148-159) already does position. Add scale there:

```tsx
// OLD (~line 148-159):
if (!hasInitialized.current) {
  hasInitialized.current = true
  groupRef.current.position.set(state.currentX, position[1], state.currentZ)
  groupRef.current.rotation.set(0, groupRef.current.rotation.y, 0)
  if (session?.key) {
    botPositionRegistry.set(session.key, {
      x: state.currentX,
      y: position[1],
      z: state.currentZ,
    })
  }
  return
}

// NEW:
if (!hasInitialized.current) {
  hasInitialized.current = true
  groupRef.current.position.set(state.currentX, position[1], state.currentZ)
  groupRef.current.scale.setScalar(scale)
  groupRef.current.rotation.set(0, 0, 0)
  if (session?.key) {
    botPositionRegistry.set(session.key, {
      x: state.currentX,
      y: position[1],
      z: state.currentZ,
    })
  }
  return
}
```

**Risks:**
- If `scale` prop changes dynamically (e.g., bot becomes subagent), the scale wouldn't update from props anymore. However, scale is determined by `isSubagent()` which is fixed per session key, so this is safe.
- The bot won't appear at the correct initial position for the very first render frame (before useFrame fires). This is typically 1 frame and not visible, but if it is, we can use a `ref` callback: `ref={(el) => { if (el) { el.position.set(...); el.scale.setScalar(scale) }; groupRef.current = el }}`.

---

## Fix 2: roomBounds Object Identity → Animation Resets (CRITICAL)

**File:** `World3DView.tsx`
**Problem:** `getRoomBounds(position, ROOM_SIZE)` is called inside the `.map()` render callback (line ~474). It returns a **new object every render**. This new object flows as `roomBounds` prop to `Bot3D`, which uses it in the `interactionPoints` useMemo dependency (Bot3D.tsx line ~134). A new `roomBounds` → new `interactionPoints` → `useBotAnimation`'s useEffect re-fires → resets `phase` and `arrived`. This causes bots to jerk back to walking state on every parent re-render.

**Root cause code (World3DView.tsx ~line 474):**
```tsx
{roomPositions.map(({ room, position }) => {
  // ...
  const bounds = getRoomBounds(position, ROOM_SIZE)  // NEW object every render!
```

### Fix (Two-part)

**Part A: Memoize roomBounds in World3DView.tsx**

Create a stable bounds map using useMemo:

```tsx
// NEW — add after layout useMemo (~line 306), before the roomBots useMemo:
const roomBoundsMap = useMemo(() => {
  if (!layout) return new Map<string, RoomBounds>()
  const map = new Map<string, RoomBounds>()
  for (const { room, position } of layout.roomPositions) {
    map.set(room.id, getRoomBounds(position, ROOM_SIZE))
  }
  return map
}, [layout])

const parkingBoundsStable = useMemo(() => {
  if (!layout) return undefined
  const { parkingArea } = layout
  return getParkingBounds(parkingArea.x, parkingArea.z, parkingArea.width, parkingArea.depth)
}, [layout])
```

Then use them in the render:

```tsx
// OLD (~line 474):
const bounds = getRoomBounds(position, ROOM_SIZE)

// NEW:
const bounds = roomBoundsMap.get(room.id)!
```

And for parking (~line 536):
```tsx
// OLD:
const bounds = getParkingBounds(parkingArea.x, parkingArea.z, parkingArea.width, parkingArea.depth)

// NEW:
const bounds = parkingBoundsStable!
```

**Part B: Stabilize interactionPoints in Bot3D.tsx**

Even with memoized bounds, add a secondary defense — serialize the interaction points dependency:

```tsx
// OLD (Bot3D.tsx ~line 134):
const interactionPoints = useMemo(() => {
  if (!roomName || !roomBounds) return null
  const roomCenterX = (roomBounds.minX + roomBounds.maxX) / 2
  const roomCenterZ = (roomBounds.minZ + roomBounds.maxZ) / 2
  const roomSize = (roomBounds.maxX - roomBounds.minX) + 5
  return getRoomInteractionPoints(roomName, roomSize, [roomCenterX, 0, roomCenterZ])
}, [roomName, roomBounds])

// NEW:
// Stable serialization of roomBounds to prevent unnecessary recalculation
const roomBoundsKey = roomBounds
  ? `${roomBounds.minX},${roomBounds.maxX},${roomBounds.minZ},${roomBounds.maxZ}`
  : ''

const interactionPoints = useMemo(() => {
  if (!roomName || !roomBounds) return null
  const roomCenterX = (roomBounds.minX + roomBounds.maxX) / 2
  const roomCenterZ = (roomBounds.minZ + roomBounds.maxZ) / 2
  const roomSize = (roomBounds.maxX - roomBounds.minX) + 5
  return getRoomInteractionPoints(roomName, roomSize, [roomCenterX, 0, roomCenterZ])
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [roomName, roomBoundsKey])
```

Do the same for `walkableCenter`:
```tsx
const walkableCenter = useMemo(() => {
  if (!roomName || !roomBounds) return null
  const roomCenterX = (roomBounds.minX + roomBounds.maxX) / 2
  const roomCenterZ = (roomBounds.minZ + roomBounds.maxZ) / 2
  const roomSize = (roomBounds.maxX - roomBounds.minX) + 5
  return getWalkableCenter(roomName, roomSize, [roomCenterX, 0, roomCenterZ])
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [roomName, roomBoundsKey])
```

**Risks:**
- Part A depends on `layout` being stable (it is — it's already memoized on `rooms`).
- Part B uses string serialization as dependency — minor perf cost but negligible vs the fix benefit.

---

## Fix 3: Grid Direction Oscillation Near Target (HIGH)

**File:** `Bot3D.tsx`
**Problem:** In the "walking toward animation target" block (~line 224-258), when the bot is close to the target, the dot-product direction picker flips between adjacent grid directions each frame, causing visible zigzag.

**Root cause code (~line 233-249):**
```tsx
// Score each direction by dot product with target direction, pick best walkable
let bestDir: { x: number; z: number } | null = null
let bestScore = -Infinity
for (const d of DIRECTIONS) {
  const nextX = state.currentX + d.x * cellSize
  const nextZ = state.currentZ + d.z * cellSize
  if (!isWalkableAt(nextX, nextZ)) continue
  const score = d.x * ndx + d.z * ndz
  if (score > bestScore) {
    bestScore = score
    bestDir = d
  }
}

if (bestDir) {
  const easedSpeed = speed * Math.min(1, dist / 0.5)
  const step = Math.min(easedSpeed * delta, dist)
  state.currentX += bestDir.x * step
  state.currentZ += bestDir.z * step
}
```

### Fix

When close to target (dist < 0.8), bypass grid-snapped directions and use direct linear interpolation:

```tsx
// NEW (~line 233, replacing the direction-picking + movement block):
if (dist < 0.8) {
  // Close to target — direct linear movement (no grid snapping)
  const easedSpeed = speed * Math.min(1, dist / 0.5)
  const step = Math.min(easedSpeed * delta, dist)
  state.currentX += (dx / dist) * step
  state.currentZ += (dz / dist) * step
} else {
  // Far from target — grid-snapped direction picking
  const cellSize = gridData.blueprint.cellSize
  const ndx = dx / dist
  const ndz = dz / dist

  let bestDir: { x: number; z: number } | null = null
  let bestScore = -Infinity
  for (const d of DIRECTIONS) {
    const nextX = state.currentX + d.x * cellSize
    const nextZ = state.currentZ + d.z * cellSize
    if (!isWalkableAt(nextX, nextZ)) continue
    const score = d.x * ndx + d.z * ndz
    if (score > bestScore) {
      bestScore = score
      bestDir = d
    }
  }

  if (bestDir) {
    const easedSpeed = speed * Math.min(1, dist / 0.5)
    const step = Math.min(easedSpeed * delta, dist)
    state.currentX += bestDir.x * step
    state.currentZ += bestDir.z * step
  }
}
```

Note: need to move `const cellSize = gridData.blueprint.cellSize` before the `if (dist < 0.3)` check since it's used in the `isWalkableAt` helper already — actually, `cellSize` is only used inside the else branch now, so it stays there. The `dx`, `dz`, `dist` are already computed above this block.

**Risks:**
- Direct movement near target could clip through a wall cell if the target itself is near a wall. However, interaction points (desk/coffee/sleep) are always on walkable cells, and 0.8 units is less than one cell size (~1.0), so this is safe.

---

## Fix 4: Stale targetX/Z for Bounce Detection (HIGH)

**File:** `Bot3D.tsx`
**Problem:** `isMoving` is computed from `targetX/Z` distance (~line 166-170), but during random walk mode `targetX/Z` aren't maintained. They stay at the initial/old value, causing the bounce animation to flicker.

**Root cause code (~line 166-170):**
```tsx
const moveDist = Math.sqrt(
  (state.targetX - state.currentX) ** 2 + (state.targetZ - state.currentZ) ** 2
)
const isMoving = moveDist > 0.3
```

### Fix

Track previous position and compute `isMoving` from actual movement delta:

```tsx
// Add to wanderState ref initialization (~line 86, after cellProgress):
prevX: position[0],
prevZ: position[2],
```

Then replace the `isMoving` computation:

```tsx
// OLD (~line 166-170):
const moveDist = Math.sqrt(
  (state.targetX - state.currentX) ** 2 + (state.targetZ - state.currentZ) ** 2
)
const isMoving = moveDist > 0.3

// NEW:
const actualDeltaX = state.currentX - state.prevX
const actualDeltaZ = state.currentZ - state.prevZ
const moveDelta = Math.sqrt(actualDeltaX * actualDeltaX + actualDeltaZ * actualDeltaZ)
const isMoving = moveDelta > 0.001 // moved more than ~0.001 units this frame
```

And at the end of the useFrame (before position registry update, ~line 290), update prevX/Z:

```tsx
// NEW — add right after the hard clamp to room bounds block:
state.prevX = state.currentX
state.prevZ = state.currentZ
```

Also initialize `prevX`/`prevZ` in the session key change useEffect (~line 104):
```tsx
state.prevX = spawnX
state.prevZ = spawnZ
```

**Risks:**
- `moveDelta` is frame-rate dependent. At 60fps with speed 0.5, delta per frame ≈ 0.008, so threshold of 0.001 is fine. At very low FPS (10fps), delta ≈ 0.05 — still fine.
- The first frame after initialization will show `moveDelta = 0` (prev == current), which correctly means "not moving."

---

## Fix 5: Unnormalized Diagonal Directions (MEDIUM)

**File:** `Bot3D.tsx`
**Problem:** `DIRECTIONS` array (~line 23-31) has diagonal entries like `{x:1, z:1}` with magnitude √2 ≈ 1.414, while cardinal entries like `{x:1, z:0}` have magnitude 1. The movement code uses `bestDir.x * step` (line ~249), so diagonals move √2× faster.

**Root cause code (~line 23-31):**
```tsx
const DIRECTIONS = [
  { x: 0, z: -1 },  // N
  { x: 1, z: -1 },  // NE  ← magnitude √2
  { x: 1, z: 0 },   // E
  { x: 1, z: 1 },   // SE  ← magnitude √2
  { x: 0, z: 1 },   // S
  { x: -1, z: 1 },  // SW  ← magnitude √2
  { x: -1, z: 0 },  // W
  { x: -1, z: -1 }, // NW  ← magnitude √2
]
```

### Fix

Normalize diagonal vectors:

```tsx
// NEW:
const INV_SQRT2 = 1 / Math.sqrt(2) // ≈ 0.7071

const DIRECTIONS = [
  { x: 0, z: -1 },             // N
  { x: INV_SQRT2, z: -INV_SQRT2 },  // NE
  { x: 1, z: 0 },              // E
  { x: INV_SQRT2, z: INV_SQRT2 },   // SE
  { x: 0, z: 1 },              // S
  { x: -INV_SQRT2, z: INV_SQRT2 },  // SW
  { x: -1, z: 0 },             // W
  { x: -INV_SQRT2, z: -INV_SQRT2 }, // NW
]
```

**Impact on other code using DIRECTIONS:**

1. **`pickWalkableDir`** (~line 203): Uses `d.x * cellSize` and `d.z * cellSize` to check next cell. With normalized diagonals, the check position would be at 0.707 × cellSize instead of 1 × cellSize. This means diagonal walkability checks would test a point *within* the current cell rather than the next diagonal cell. **This needs adjustment:**

```tsx
// In pickWalkableDir, change:
if (isWalkableAt(state.currentX + d.x * cellSize, state.currentZ + d.z * cellSize)) {

// To:
const checkDist = cellSize // always check one full cell away
const mag = Math.sqrt(d.x * d.x + d.z * d.z)
if (isWalkableAt(state.currentX + (d.x / mag) * checkDist * (1/mag) ... ))
```

Actually, this gets complex. **Better approach:** Keep DIRECTIONS unnormalized for walkability checks (cell-stepping logic), but normalize the *movement vector* when applying the step:

```tsx
// In the random walk movement block (~line 274), change:
state.currentX += state.dirX * step
state.currentZ += state.dirZ * step

// To:
const dirMag = Math.sqrt(state.dirX * state.dirX + state.dirZ * state.dirZ)
if (dirMag > 0) {
  state.currentX += (state.dirX / dirMag) * step
  state.currentZ += (state.dirZ / dirMag) * step
}
```

And in the grid-targeted walking block (~line 249):
```tsx
// OLD:
state.currentX += bestDir.x * step
state.currentZ += bestDir.z * step

// NEW:
const dirMag = Math.sqrt(bestDir.x * bestDir.x + bestDir.z * bestDir.z)
state.currentX += (bestDir.x / dirMag) * step
state.currentZ += (bestDir.z / dirMag) * step
```

This way, DIRECTIONS stay as integers for grid checks but movement is always normalized. Cleaner and no side effects.

**Risks:**
- `cellProgress` accumulation assumes uniform step distance — with normalization this is now consistent across all directions, so `cellProgress` tracking becomes *more* accurate.
- Keep DIRECTIONS as integers (don't normalize the array itself) to avoid breaking walkability checks.

---

## Fix 6: Rotation Lerp Never Settles (MEDIUM)

**File:** `Bot3D.tsx`
**Problem:** Multiple places use `rotation.y += angleDiff * factor` (0.18 or 0.15 or 0.2), which asymptotically approaches the target but never reaches it. Each frame the bot micro-rotates, which can be visible as subtle wobble, especially when idle.

**Locations:**
- Line ~254: `groupRef.current.rotation.y = currentRotY + angleDiff * 0.18` (grid-targeted walking)
- Line ~227 (no-grid direct wander): `groupRef.current.rotation.y = currentRotY + angleDiff * 0.2`
- Line ~270 (random walk waiting): `groupRef.current.rotation.y = currentRotY + angleDiff * 0.15`
- Line ~290 (random walk moving): `groupRef.current.rotation.y = currentRotY + angleDiff * 0.18`

### Fix

Add a dead-zone snap. Apply the same pattern at each location:

```tsx
// OLD (each location):
groupRef.current.rotation.y = currentRotY + angleDiff * 0.18

// NEW (each location — adjust the factor per location):
if (Math.abs(angleDiff) < 0.01) {
  groupRef.current.rotation.y = targetRotY
} else {
  groupRef.current.rotation.y = currentRotY + angleDiff * 0.18
}
```

Apply at all 4 locations with their respective factors (0.2, 0.15, 0.18, 0.18).

**Risks:** None. 0.01 radians ≈ 0.57° — imperceptible, and snapping eliminates the infinite tail.

---

## Fix 7: Bounce Threshold = Arrived Threshold (MEDIUM)

**File:** `Bot3D.tsx`
**Problem:** Both the "has arrived at target" check and the "is moving for bounce animation" check use 0.3 as the threshold. When a bot oscillates near 0.3 distance, `isMoving` and `arrived` flicker, causing the bounce animation to turn on/off rapidly.

**Arrived checks at 0.3:**
- Line ~216: `if (dist < 0.3)` (no-grid arrival)
- Line ~231: `if (dist < 0.3)` (grid-targeted arrival)

**isMoving (bounce) at 0.3:**
- Line ~170: `const isMoving = moveDist > 0.3` (but this will be replaced by Fix 4)

### Fix

Since Fix 4 replaces the bounce threshold with actual movement delta, the overlap is already eliminated for the bounce check. However, the arrival thresholds should still be reviewed:

**Increase arrived threshold slightly for smoother transition:**

```tsx
// OLD (~line 216 and ~line 231):
if (dist < 0.3) {

// NEW:
if (dist < 0.4) {
```

This makes bots "arrive" slightly earlier (0.4 units ≈ less than half a cell), creating a comfortable gap between arrival and any residual movement detection.

**Risks:**
- Bots stop 0.1 units farther from the exact target point. At the visual scale of the scene, this is imperceptible (0.1 world units ≈ ~3 pixels at typical zoom).

---

## Summary of Changes by File

### `World3DView.tsx`
1. **Fix 2A:** Add `roomBoundsMap` and `parkingBoundsStable` useMemos; use stable bounds references in render

### `Bot3D.tsx`
1. **Fix 1:** Remove `position` and `scale` props from `<group>` JSX; add scale initialization in first-frame block
2. **Fix 2B:** Add `roomBoundsKey` string; use as stable dependency for `interactionPoints` and `walkableCenter` useMemos
3. **Fix 3:** Add distance check before grid direction picking; use direct linear movement when dist < 0.8
4. **Fix 4:** Add `prevX`/`prevZ` to wanderState; compute `isMoving` from actual movement delta
5. **Fix 5:** Normalize movement vectors at point of application (don't change DIRECTIONS array)
6. **Fix 6:** Add `Math.abs(angleDiff) < 0.01` dead-zone snap at all 4 rotation lerp sites
7. **Fix 7:** Increase arrival threshold from 0.3 to 0.4

### `BotAnimations.tsx`
- No changes needed (Fix 2 is addressed at the source in World3DView.tsx and Bot3D.tsx dependency stabilization)

---

## Recommended Implementation Order

1. **Fix 2** (roomBounds stability) — eliminates the most disruptive resets
2. **Fix 1** (remove declarative props) — eliminates re-render snap-backs
3. **Fix 4** (isMoving from actual delta) — fixes bounce flicker
4. **Fix 7** (arrival threshold) — widens arrival zone
5. **Fix 3** (direct movement near target) — removes zigzag
6. **Fix 5** (normalize diagonals) — consistent speed
7. **Fix 6** (rotation dead-zone) — polish

Fixes 1+2 together will eliminate ~80% of visible jitter. Fixes 3-7 are polish improvements.
