# Bot Jitter Analysis — Iteration 1

**Date:** 2026-02-04  
**Analyst:** Opus sub-agent  
**Status:** Investigation only (no code changes)

---

## Summary

Six potential jitter sources identified across `Bot3D.tsx` and `BotAnimations.tsx`. The top two are highly likely to cause the visible shaking, the remaining four are contributing factors.

---

## 🔴 Issue #1 — CRITICAL: `interactionPoints` Reference Instability Causes Animation State Resets

**Likelihood: CRITICAL — most likely primary jitter cause**

### The Problem

The `useBotAnimation` hook reacts to `[status, interactionPoints]`:

```tsx
// BotAnimations.tsx — useBotAnimation
useEffect(() => {
  const s = stateRef.current
  // Resets arrived, phase, target, walkSpeed, etc.
  switch (status) {
    case 'active': {
      s.phase = 'walking-to-desk'
      s.arrived = false      // ← RESETS every time this fires
      s.targetX = interactionPoints.deskPosition[0] + j.x
      s.targetZ = interactionPoints.deskPosition[2] + j.z
      // ...
    }
  }
}, [status, interactionPoints])  // ← depends on interactionPoints OBJECT REFERENCE
```

In `Bot3D.tsx`, `interactionPoints` is memoized on `[roomName, roomBounds]`:

```tsx
// Bot3D.tsx
const interactionPoints = useMemo(() => {
  if (!roomName || !roomBounds) return null
  // ...
  return getRoomInteractionPoints(roomName, roomSize, [roomCenterX, 0, roomCenterZ])
}, [roomName, roomBounds])  // ← roomBounds is an OBJECT prop
```

**`roomBounds` is an object prop.** If the parent component creates `roomBounds` inline or recalculates it on each render, React's `useMemo` dependency check uses `Object.is()` — a new object reference (even with identical values) will cause recalculation. This produces a **new `interactionPoints` object**, which triggers the animation `useEffect`, which **resets `arrived = false`** and sets `phase = 'walking-to-desk'`.

### The Jitter Loop

Every parent re-render:
1. New `roomBounds` ref → new `interactionPoints` ref → useEffect fires
2. `arrived` reset to `false`, `phase` set to `walking-to-desk`
3. Next frame: bot is already at desk, `dist < 0.3` → `arrived = true`
4. `tickAnimState` transitions to `working` (sets `bodyTilt = 0.12`)
5. Parent re-renders again → goto 1

This creates a **1-2 frame oscillation** between `walking-to-desk` (bodyTilt=0, headBob=false) and `working` (bodyTilt=0.12, headBob=true), causing:
- Visible body tilt flicker (0 ↔ 0.12 radians)
- Head bob enabling/disabling
- Potential vertical bounce toggle (different bounceY logic per phase)

### Also Affects `walkableCenter`

The same pattern applies to `walkableCenter`:

```tsx
const walkableCenter = useMemo(() => {
  if (!roomName || !roomBounds) return null
  // ...
}, [roomName, roomBounds])  // ← same roomBounds dependency
```

While `walkableCenter` isn't in a useEffect dependency, it's used in the render-time movement logic for parking bots.

---

## 🟠 Issue #2 — HIGH: Grid Direction Oscillation Near Target

**Likelihood: HIGH — causes visible rotation/position jitter when approaching desk**

### The Problem

When walking toward an animation target (desk/coffee/sleep), the code picks the best walkable direction by dot product:

```tsx
// Bot3D.tsx — walking toward animation target
let bestDir: { x: number; z: number } | null = null
let bestScore = -Infinity
for (const d of DIRECTIONS) {
  const nextX = state.currentX + d.x * cellSize
  const nextZ = state.currentZ + d.z * cellSize
  if (!isWalkableAt(nextX, nextZ)) continue
  const score = d.x * ndx + d.z * ndz  // dot product with target direction
  if (score > bestScore) {
    bestScore = score
    bestDir = d
  }
}
```

When the bot is **close to the target** (but not yet within 0.3 threshold), tiny position changes between frames can change which direction has the highest dot product. For example, at a position slightly NE of the target, one frame might pick SW direction, the next frame (after moving slightly) might pick S or W. 

The movement then applies:

```tsx
state.currentX += bestDir.x * step
state.currentZ += bestDir.z * step
```

**Each frame, the chosen direction can flip**, causing the bot to zigzag/oscillate on its final approach. The rotation lerp amplifies this because `atan2(dx, dz)` changes with direction flips:

```tsx
const targetRotY = Math.atan2(dx, dz)
groupRef.current.rotation.y = currentRotY + angleDiff * 0.18
```

### Why It's Visible

The bot wobbles side-to-side and rotates jerkily in the last ~1 unit before reaching the desk. This is especially noticeable because it's the moment the user is watching (the bot "arriving" at its workstation).

---

## 🟠 Issue #3 — HIGH: Diagonal Movement Speed Inconsistency

**Likelihood: HIGH — causes speed pulsing/jerking during movement**

### The Problem

The 8 movement directions include diagonals:

```tsx
const DIRECTIONS = [
  { x: 0, z: -1 },   // N — magnitude 1.0
  { x: 1, z: -1 },   // NE — magnitude √2 ≈ 1.41
  { x: 1, z: 0 },    // E — magnitude 1.0
  { x: 1, z: 1 },    // SE — magnitude √2 ≈ 1.41
  // ...
]
```

These directions are **not normalized**. When used as movement vectors:

```tsx
// Grid-based animation target walking:
state.currentX += bestDir.x * step   // bestDir.x = 1
state.currentZ += bestDir.z * step   // bestDir.z = 1
// Actual distance moved = step * √2 ≈ 1.41 * step

// Compare to cardinal:
state.currentX += bestDir.x * step   // bestDir.x = 1
state.currentZ += bestDir.z * step   // bestDir.z = 0
// Actual distance moved = step * 1.0
```

The bot moves **41% faster diagonally** than cardinally. When the pathfinding switches between diagonal and cardinal directions (which it does frequently near the target per Issue #2), the speed visibly pulses. This contributes to the jittery appearance.

The same issue exists in the random walk code:

```tsx
// Random walk:
state.currentX += state.dirX * step
state.currentZ += state.dirZ * step
```

---

## 🟡 Issue #4 — MEDIUM: Vertical Bounce Threshold Flicker

**Likelihood: MEDIUM — causes brief vertical popping near arrival**

### The Problem

The vertical bounce is gated on an `isMoving` check:

```tsx
const moveDist = Math.sqrt(
  (state.targetX - state.currentX) ** 2 + (state.targetZ - state.currentZ) ** 2
)
const isMoving = moveDist > 0.3

// ...
case 'walking-to-desk':
  bounceY = isMoving ? Math.sin(t * 4) * 0.03 : 0
  break
case 'idle-wandering':
  bounceY = isMoving ? Math.sin(t * 3) * 0.02 : 0
  break
```

When the bot approaches its target and `moveDist` hovers around 0.3 (the same threshold used for `arrived`), the bounce toggles on/off:
- Frame N: `moveDist = 0.31` → `bounceY = sin(t*4) * 0.03` (could be up to ±0.03 units)
- Frame N+1: `moveDist = 0.29` → `bounceY = 0`

This causes a **vertical pop** of up to 0.03 units (about 3% of bot height). Combined with Issue #2 (direction oscillation can make `moveDist` fluctuate), this can be amplified.

### Why It Matters

The `isMoving` threshold (0.3) and the `arrived` threshold (0.3) are **the same value**. This means the bounce and the arrival check trigger at exactly the same distance, creating a zone where the bot simultaneously:
- Toggles bounce on/off
- Might set `arrived = true`
- Gets its movement frozen

All in the same 1-2 frame window, amplifying the visual pop.

---

## 🟡 Issue #5 — MEDIUM: Rotation Lerp Never Fully Settles

**Likelihood: MEDIUM — causes perpetual micro-rotation**

### The Problem

All rotation smoothing uses a constant-factor lerp:

```tsx
// Multiple locations in Bot3D.tsx:
groupRef.current.rotation.y = currentRotY + angleDiff * 0.18
// or
groupRef.current.rotation.y = currentRotY + angleDiff * 0.2
// or
groupRef.current.rotation.y = currentRotY + angleDiff * 0.15
```

This is `lerp(current, target, 0.18)` — it **asymptotically approaches** the target but mathematically never reaches it. After convergence, floating-point precision means `angleDiff` is some tiny number like `1.2e-7`, and the rotation keeps updating by `1.2e-7 * 0.18 ≈ 2.16e-8` every frame.

While individually invisible, this continuous rotation update means:
1. Three.js marks the object's matrix as dirty every frame
2. Combined with other micro-movements, the cumulative effect can be visible
3. It prevents any "fully settled" state — the bot is always in motion

### No Dead Zone

There's no `if (Math.abs(angleDiff) < threshold) return` guard to stop updating rotation when it's "close enough."

---

## 🟢 Issue #6 — LOW: No Position Snap on Arrival

**Likelihood: LOW — minor but contributes to imprecision**

### The Problem

When a bot arrives at its target (`dist < 0.3`), the position is NOT snapped to the exact target:

```tsx
// Animation target arrival (grid-based):
if (dist < 0.3) {
  anim.arrived = true
  if (anim.freezeWhenArrived) {
    groupRef.current.position.x = state.currentX   // ← NOT targetX
    groupRef.current.position.z = state.currentZ   // ← NOT targetZ
    return
  }
}
```

The bot freezes at whatever position it happened to be when `dist` dropped below 0.3. This means:
- The bot can be up to 0.3 units away from the actual desk/coffee/sleep position
- Different bots stop at different offsets, making them look imprecisely placed
- If combined with Issue #1 (state reset), the bot re-walks from its imprecise position to the target, potentially stopping at a *different* imprecise position each time

---

## Summary Table

| # | Issue | Severity | Visible Effect |
|---|-------|----------|---------------|
| 1 | `interactionPoints` ref instability → state reset loop | 🔴 CRITICAL | Body tilt flicker, phase oscillation, overall shaking |
| 2 | Grid direction oscillation near target | 🟠 HIGH | Zigzag/wobble on final approach to desk |
| 3 | Unnormalized diagonal directions | 🟠 HIGH | Speed pulsing when switching cardinal↔diagonal |
| 4 | Vertical bounce threshold flicker | 🟡 MEDIUM | Vertical pop near arrival point |
| 5 | Rotation lerp never settles | 🟡 MEDIUM | Perpetual micro-rotation, never fully still |
| 6 | No position snap on arrival | 🟢 LOW | Imprecise stopping, drift on state reset |

---

## Recommended Fix Priority

1. **Fix Issue #1** first — stabilize `roomBounds`/`interactionPoints` references (memoize properly in parent, or use value-based comparison in useMemo/useEffect). This alone may eliminate most visible jitter.
2. **Fix Issues #2 + #3** together — normalize direction vectors AND add a "direct walk" mode for the last ~1 unit (skip grid pathfinding when close to target).
3. **Fix Issue #4** — add hysteresis to `isMoving` check (separate start/stop thresholds, e.g. start bounce at 0.5, stop at 0.15).
4. **Fix Issue #5** — add dead-zone to rotation lerp (`if (|angleDiff| < 0.001) snap to target`).
5. **Fix Issue #6** — snap `currentX/Z = targetX/Z` on arrival.

---

## Files to Check (Not Yet Read)

To confirm Issue #1, the parent component that creates `roomBounds` should be inspected. This is likely `World3DView.tsx` or similar — check whether `roomBounds` is memoized or created inline.
