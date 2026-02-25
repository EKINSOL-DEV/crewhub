# Code Review: Prop Browser + Creator Mode
**Reviewer:** ekinbot (GPT-5 code review subagent)  
**Date:** 2026-02-24  
**Branch:** develop  
**Commits reviewed:** `b468247` → `0dc4318` (phases 1–7)

---

## TL;DR

The implementation is architecturally solid — good separation of concerns, proper SSE design, clean PropRegistry integration. However, **two blocking bugs** must be fixed before first use, and **four major issues** should follow immediately. The undo/redo 'remove' path is fundamentally broken and will silently orphan props in the DB.

**Verdict: ❌ Not ready to test yet — fix criticals first (est. 30 min)**

---

## Must-Fix List

### 🔴 CRITICAL — Blocking

#### C1: Undo/Redo 'remove' creates new UUID, redo breaks permanently

**File:** `frontend/src/contexts/CreatorModeContext.tsx` → `undo()` / `redo()`  

When undoing a 'remove' action, the code POSTs to `/api/world/props` to re-place the prop. But the backend generates a **fresh UUID** for the re-placed prop. The stored `PlacementAction` snapshot still holds the original `placed_id`. When the user then does Redo (redo-remove), the DELETE call targets the old, non-existent UUID → `404 Not Found`. The re-placed prop is now permanently orphaned in the database with no way to remove it via undo/redo.

**Repro:**
1. Place prop → undo-place → redo-place: ✅ (works, same id from action)
2. Place prop → delete prop → undo-delete → redo-delete: ❌ (404, prop stuck in DB)

**Fix:** After the re-place POST succeeds, update the action in the redo stack to use the new `placed_id` from the response:

```typescript
// In undo(), for action.type === 'remove':
const resp = await fetch(`${API_BASE}/world/props`, { method: 'POST', ... })
if (resp.ok) {
  const freshPlaced = await resp.json()
  // Update the action in the redo stack with the new id:
  setRedoStack(r => [...r, {
    ...action,
    placedId: freshPlaced.id,        // <-- update snapshot id
    snapshot: { ...action.snapshot, id: freshPlaced.id }
  }])
}
```

---

#### C2: PATCH endpoint cannot clear `room_id` to null

**File:** `backend/app/routes/prop_placement.py` → `update_placed_prop()`

The handler only updates `room_id` when `body.room_id is not None`:
```python
if body.room_id is not None:
    updates.append("room_id = ?")
    params.append(body.room_id)
```
If a prop needs to be moved from a specific room back to the world floor (`room_id → null`), the PATCH call with `room_id: null` silently ignores the field. This also means undo of a 'move' where the original `room_id` was `null` cannot restore the null state.

**Fix:** Use a sentinel pattern in the Pydantic model:

```python
from typing import Union
UNSET = object()

class UpdatePropRequest(BaseModel):
    position: Optional[Vec3] = None
    rotation_y: Optional[float] = None
    scale: Optional[float] = Field(default=None, ge=0.1, le=10.0)
    # Use explicit unset sentinel via model_fields_set
    room_id: Optional[str] = None
    clear_room: bool = False  # if True, set room_id = NULL

# In handler:
if body.clear_room:
    updates.append("room_id = ?")
    params.append(None)
elif body.room_id is not None:
    updates.append("room_id = ?")
    params.append(body.room_id)
```

Or alternatively use `model_fields_set` in Pydantic v2 to distinguish "not provided" from "provided as null".

---

### 🟠 MAJOR — Fix Before Testing

#### M1: Wall props float in mid-air when placed via Creator Mode

**File:** `frontend/src/components/world3d/creator/PlacedPropsRenderer.tsx`  
**Affected props:** notice-board, whiteboard, mood-board, presentation-screen, wall-clock, small-screen, gear-mechanism, satellite-dish, signal-waves, status-lights (10 props in propMeta.ts)

`PlacedPropsRenderer` uses `entry.yOffset` for vertical positioning but makes no distinction between `mountType: 'floor'` and `mountType: 'wall'`. Wall props have yOffsets of 1.2–2.2m and require a backing wall surface. When placed via Creator Mode on the open world floor, they render floating at their yOffset height with nothing behind them — visually broken.

**Fix options:**
1. **Short-term:** Remove all wall-mount props from `BUILTIN_PROP_META` in `propMeta.ts`. Filter them out in PropBrowser so only `mountType: 'floor'` props are browsable.
2. **Long-term:** Implement wall-snap logic in `PlacedPropsRenderer` using `room_id` + room geometry to determine wall position and rotation.

**Recommendation:** Option 1 for v0.18, option 2 for a future milestone.

---

#### M2: Silent failure for non-admin users (no UI feedback)

**File:** `frontend/src/components/world3d/World3DView.tsx` → `handlePlaceProp()`

Any user can press [E] to enter Creator Mode and see the ghost. When they click to place, the API returns 401/403 (no manage-scope key), but the UI only does `console.warn('[CreatorMode] Place prop failed:', err.detail)`. The user sees nothing — the prop just doesn't appear. This is deeply confusing for anyone trying to test.

Also, the `apiKey` state in context is never validated against the backend. An expired or wrong key gives silent failure.

**Fix:**
```typescript
// In handlePlaceProp, after `if (!resp.ok)`:
const err = await resp.json().catch(() => ({ detail: 'Unknown error' }))
if (resp.status === 401 || resp.status === 403) {
  // Show toast or alert
  alert(`⛔ Creator Mode requires a manage-scope API key.\n${err.detail}`)
} else {
  console.warn('[CreatorMode] Place prop failed:', err.detail)
}
```

Better: add a toast notification system call here, or validate the API key on Creator Mode entry.

---

#### M3: Redo 'place' loses prop scale

**File:** `frontend/src/contexts/CreatorModeContext.tsx` → `redo()`

The `PlacementAction` type for `'place'` doesn't store `scale`:
```typescript
| { type: 'place'; placedId: string; propId: string; position: Vec3; rotation_y: number; roomId?: string | null }
// ^ no scale field
```

The redo-place body also omits scale:
```typescript
body: JSON.stringify({
  prop_id: action.propId,
  position: action.position,
  rotation_y: action.rotation_y,
  room_id: action.roomId,
  // scale: missing → backend defaults to 1.0
})
```

Currently scale is always 1.0 in the placement UI, so this doesn't break yet. But once scale is exposed in the UI, redo will silently revert scale to 1.0.

**Fix:** Add `scale: number` to the `'place'` action type, capture it in `pushAction`, and include it in redo body.

---

#### M4: PlacementGhost mouse tracking broken when canvas doesn't fill the window

**File:** `frontend/src/components/world3d/creator/PlacementGhost.tsx`

The mousemove listener tries:
```typescript
const canvas = e.target as HTMLElement
const rect = canvas.getBoundingClientRect?.()
```

`e.target` on a `window.addEventListener('mousemove')` is the `window` object, not an HTMLElement. `getBoundingClientRect` won't exist on it, so the code falls back to:
```typescript
const x = (e.clientX / size.width) * 2 - 1
const y = -(e.clientY / size.height) * 2 + 1
```

`size` from `useThree()` is the canvas size in pixels, but `e.clientX/Y` is relative to the viewport origin, not the canvas origin. If the canvas is not at (0,0) — e.g., when side panels are open or when the canvas is inside a tabbed view — the ghost will be offset from the actual cursor position.

**Fix:** Use the canvas DOM element ref to get the correct bounding rect:
```typescript
const { camera, raycaster, size, gl } = useThree()

useEffect(() => {
  const onMouseMove = (e: MouseEvent) => {
    const rect = gl.domElement.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    mouseRef.current.set(x, y)
  }
  window.addEventListener('mousemove', onMouseMove)
  return () => window.removeEventListener('mousemove', onMouseMove)
}, [gl])  // gl.domElement is stable
```

---

### 🟡 MINOR — Should Fix Soon

#### m1: PlacedPropsRenderer: no memoization, full re-render on every SSE event

**File:** `frontend/src/components/world3d/creator/PlacedPropsRenderer.tsx`

`PlacedPropMesh` is not wrapped with `React.memo`. Every SSE `prop_update` event calls `setPlacedProps(prev => [...])` creating a new array reference, causing all `PlacedPropMesh` children to re-render even for unrelated changes.

**Fix:**
```typescript
import { memo } from 'react'

const PlacedPropMesh = memo(function PlacedPropMesh({ placed, cellSize }: ...) {
  ...
}, (prev, next) => 
  prev.placed.id === next.placed.id &&
  prev.placed.position.x === next.placed.position.x &&
  prev.placed.position.z === next.placed.position.z &&
  prev.placed.rotation_y === next.placed.rotation_y &&
  prev.placed.scale === next.placed.scale
)
```

With 50+ props this becomes noticeable (~50 wasted reconciliation calls per SSE event).

---

#### m2: SSE EventSource always open, even when not in Creator Mode

**File:** `frontend/src/contexts/CreatorModeContext.tsx`

The SSE connection to `/api/events` is established immediately on `CreatorModeProvider` mount and stays open indefinitely. Since `CreatorModeProvider` wraps the entire app, this means a permanent extra SSE connection even for users who never use Creator Mode.

The existing SSE connection elsewhere in the app (if any) already handles session data. This creates redundant connections.

**Fix:** Gate the SSE connection on `isCreatorMode`, or use the shared SSE channel the app already uses (forward `prop_update` events through the existing event bus rather than a new EventSource).

---

#### m3: GhostOverlay `scale` prop is immediately voided (dead code)

**File:** `frontend/src/components/world3d/creator/PlacementGhost.tsx`

```typescript
function GhostOverlay({ scale }: { scale: number }) {
  void scale  // ← scale received but immediately discarded
  return (
    <mesh ...>
      <circleGeometry args={[0.6, 16]} />  // always 0.6 radius
    </mesh>
  )
}
```

The overlay circle is always 0.6 units regardless of prop size. A large prop (server rack, meeting table) will have a tiny indicator circle. Visual mismatch.

**Fix:** Use `scale` to size the circle, or remove the unused prop parameter:
```typescript
<circleGeometry args={[Math.max(0.4, scale * 0.8), 16]} />
```

---

#### m4: [B] keyboard shortcut fires even when not in Creator Mode

**File:** `frontend/src/contexts/CreatorModeContext.tsx`

```typescript
if (e.key.toLowerCase() === 'b' && !e.ctrlKey && !e.metaKey) {
  setIsBrowserOpen(prev => !prev)  // no isCreatorMode check
}
```

`isBrowserOpen` state toggles but the browser won't render (render condition: `isBrowserOpen && isCreatorMode`). Harmless but pollutes state. Add `&& isCreatorMode` guard.

---

#### m5: `room_id` always null in placements, room-filtered loads are unused

**File:** `frontend/src/components/world3d/World3DView.tsx` → `handlePlaceProp()`

Every placement sends `room_id: null`. The backend supports room-filtered GET (`?room_id=x`), but the frontend always loads all props. This is fine for now, but when the world has many rooms with many props, this will be wasteful. Document this as a known scaling limitation.

---

## Positive Notes (What Works Well)

- ✅ **Backend auth is solid**: `require_scope("manage")` is applied to all write endpoints. Non-authed GET is intentional and correct (read-only world is public).
- ✅ **DB schema is clean**: `placed_props` table is well-designed. Index on `room_id` for future room-filtered queries.
- ✅ **SSE deduplication**: `if (prev.some(p => p.id === data.placed_id)) return prev` correctly handles SSE reconnect races.
- ✅ **stopPropagation works**: `PlacementClickPlane` correctly calls `e.stopPropagation()` on the ThreeEvent, preventing room fly-to clicks from firing during placement. Verified against R3F event bubbling model.
- ✅ **Drag detection**: The `didDrag` ref pattern in `PlacementClickPlane` correctly prevents placement when the user is orbiting the camera.
- ✅ **PropBrowser is well-isolated**: The draggable panel doesn't use any 3D context; it runs entirely in DOM. Good performance boundary.
- ✅ **BUILTIN_PROP_META aligns with builtinProps.ts**: All 43 entries in propMeta.ts have corresponding PropRegistry registrations. No phantom props in the browser.
- ✅ **Undo stack is capped at 50**: `prev.slice(-49)` prevents memory growth.
- ✅ **undoRef/redoRef pattern**: Smart use of refs for keyboard handler to avoid stale closures.
- ✅ **`placedProps` flows outside Canvas**: Props state managed in `CreatorModeContext`, passed as plain props to `SceneContent`. Correct R3F pattern (hooks can't be called inside Canvas).

---

## Issue Summary Table

| ID | Severity | File | Issue |
|----|----------|------|-------|
| C1 | 🔴 Critical | CreatorModeContext | Undo remove → new UUID, redo-remove 404 |
| C2 | 🔴 Critical | prop_placement.py | PATCH can't clear room_id to null |
| M1 | 🟠 Major | PlacedPropsRenderer | Wall props float in mid-air (10 props) |
| M2 | 🟠 Major | World3DView | Silent failure for non-admin, no user feedback |
| M3 | 🟠 Major | CreatorModeContext | Redo 'place' silently drops scale |
| M4 | 🟠 Major | PlacementGhost | Mouse NDC coords wrong when canvas ≠ viewport |
| m1 | 🟡 Minor | PlacedPropsRenderer | No React.memo, full re-render on SSE |
| m2 | 🟡 Minor | CreatorModeContext | SSE always connected, not gated on mode |
| m3 | 🟡 Minor | PlacementGhost | GhostOverlay scale param is void/dead |
| m4 | 🟡 Minor | CreatorModeContext | [B] key ignores isCreatorMode guard |
| m5 | 🟡 Minor | World3DView | room_id always null, room-filter unused |

---

## Fix Priority Recommendation

**Block 1 (before any testing, ~30–45 min):**
- C1: Fix undo/redo remove ID tracking
- M2: Add error feedback for non-admin placement attempt
- M4: Fix ghost mouse NDC calculation using `gl.domElement`

**Block 2 (before wider testing, ~45–60 min):**
- C2: Fix PATCH room_id null clearing
- M1: Remove wall-mount props from PropBrowser (short-term fix)
- M3: Add scale to PlacementAction 'place' type

**Block 3 (polish sprint):**
- m1: Memo-ize PlacedPropMesh
- m2: Gate SSE on creator mode active
- m3/m4: Minor cleanup

---

*Review complete. Estimated total fix effort: 2–3h for all blocks.*
