# QA Review — Bot Animations + Overall 3D Performance

Date: 2026-02-03

Files reviewed:
- `frontend/src/components/world3d/BotAnimations.tsx`
- `frontend/src/components/world3d/Bot3D.tsx`
- `frontend/src/components/world3d/World3DView.tsx`

---

## 🔴 Critical

### 1) `SleepingZs` is rendered based on `status === 'sleeping'`, not the animation state
**Where:** `Bot3D.tsx`

- `BotAnimations.useBotAnimation()` has a dedicated `showZzz` flag (only true once the bot is fully “sleeping”, not while walking to the sleep corner).
- `Bot3D` currently renders Zs via:
  ```tsx
  {status === 'sleeping' && <SleepingZs />}
  ```
  This means Zs appear immediately when status flips to sleeping, including during the `sleeping-walking` phase (bot still moving), which likely looks wrong and also adds extra per-frame work while the bot is walking.

**Recommendation:** render based on `animRef.current.showZzz` (or `anim.phase === 'sleeping'`) instead of raw `status`.

---

### 2) Exterior ground creates a very high draw-call baseline (tiles are not instanced)
**Where:** `World3DView.tsx` → `ExteriorGround`

- `gridRange = 20` and `tileSize = 4` produces **(41×41) = 1681** `GrassTile` meshes, each with its own geometry + material.
- Even though positions are memoized, draw calls still scale with mesh count. This can become the dominant cost before bots/rooms are even considered.

**Recommendation:** convert grass tiles and repeated decorations to `InstancedMesh` (or merge geometries). If you need shade variation, store per-instance color via `instanceColor`.

---

## 🟡 Important

### 3) Too many `useFrame` callbacks per bot (scales poorly)
**Where:**
- `BotAnimations.tsx` → `useBotAnimation()` has a `useFrame` for transitions.
- `Bot3D.tsx` has a `useFrame` for movement + applying transforms.
- `BotAnimations.tsx` → `SleepingZs()` has its own `useFrame`.

**Impact estimate (10 bots):**
- Baseline: ~10× `Bot3D.useFrame` = 10 callbacks
- Plus: ~10× `useBotAnimation.useFrame` = 10 callbacks
- Plus: sleeping bots × 1 callback each for Zs

This is not catastrophic at 10 bots, but it’s unnecessary overhead and becomes noticeable as bot count grows.

**Recommendation options:**
- Fold animation state transitions into the existing `Bot3D` `useFrame` (single driver per bot), or
- Keep `useBotAnimation`, but expose a `tick(delta)` function and call it from `Bot3D`’s `useFrame`.

---

### 4) `SleepingZs` uses `<Text />` (Troika) and per-frame material traversal
**Where:** `BotAnimations.tsx` → `SleepingZs`

- Drei `<Text>` is convenient but typically heavier than simple planes/sprites.
- The implementation updates opacity by iterating `ref.children` every frame and casting materials.

**Recommendation:**
- Prefer **sprite/plane with a small “Z” texture** (or a single geometry + instanced material), and animate opacity/scale directly.
- If keeping `<Text>`, keep a direct ref to the text material(s) rather than traversing children each frame.

---

### 5) Potential shared-material side effects when applying opacity
**Where:** `Bot3D.tsx` opacity block

- `groupRef.current.traverse()` mutates `material.transparent` and `material.opacity`.
- If any materials are shared across bots/components (common in optimized component code), fading one bot could unintentionally fade others.

**Recommendation:** ensure bot meshes use per-instance materials (clone) or use a controlled opacity prop at the mesh/material creation layer.

---

### 6) Rapid status changes: state machine is mostly safe, but some transitions can look abrupt mid-walk
**Where:** `BotAnimations.tsx` + `Bot3D.tsx`

What works well:
- On status change, `arrived` is reset to `false` in most branches.
- `resetWanderTarget` is used to avoid “stale wander targets” when switching to wandering modes.

Edge behavior to verify:
- Switching `active → offline` freezes immediately at the current position (intended, but abrupt).
- Switching `sleeping → active` while already “sleeping” resets posture and starts walking; OK.

Possible improvement:
- Add optional “deceleration” or a short easing when status changes from moving → frozen.

---

### 7) Interaction point placement is plausible but coupled to assumed `RoomProps` scale
**Where:** `BotAnimations.tsx` → `getRoomInteractionPoints`

- Uses `s = roomSize / 12`, and offsets like `(-h + 3*s)`.
- `Bot3D` reconstructs a “roomSize” with a `+5` margin to match bounds logic.

**Risk:** if `RoomProps.tsx` furniture layout changes, interaction points drift.

**Recommendation:**
- Centralize these points (or export them) from the same place that defines prop layout.
- At least add a comment linking the exact constants to the prop placement source.

---

## 🟢 Nice-to-have

### 8) `useBotAnimation` signature includes unused `_roomBounds`
**Where:** `BotAnimations.tsx`

- `_roomBounds` is unused. This is fine, but adds noise.

**Recommendation:** remove it, or use it to clamp/validate interaction targets.

---

### 9) `roomBotCounts` is currently dead/placeholder logic
**Where:** `World3DView.tsx` → `roomBotCounts` useMemo

- It returns an empty `Map` and doesn’t actually count bots.

**Recommendation:** either implement counting or remove until needed (reduces cognitive load).

---

### 10) Draw-call estimate / batching opportunities
**Scene estimate for “full scene” (8 rooms, 10+ bots, props):**

- **ExteriorGround:** currently ~1681 meshes + decorations → **~1700–2000 draw calls** (worst case; frustum culling helps but camera can often see many).
- **Rooms/props:** each room’s props are multiple meshes; could easily add **100–300+** draw calls.
- **Bots:** a bot is composed of many primitives (body, face, accessory, glow, chest display). A conservative estimate is **10–25 draw calls per bot** → **100–250** for 10 bots.

**Biggest win:** instancing/merging of repeated environment meshes (grass tiles, repeated props), and reducing per-bot mesh/material count where possible.

---

## Summary

- Animations concept is solid: state machine + jitter offsets + integration with existing wander logic is clean and readable.
- Main correctness issue: ZZZ rendering is tied to `status` rather than animation state.
- Main performance concern: the exterior ground mesh count (and overall draw calls) likely dominates the frame budget before bots even matter.
- Secondary performance concern: multiple `useFrame` loops per bot and use of `<Text>` for ZZZ.
