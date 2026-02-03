# QA Review — Room Props + Drag-and-Drop (3D World)

Scope reviewed:
- `RoomProps.tsx` (room-specific props)
- `Room3D.tsx` (RoomProps integration + room drop zone)
- `DragDropContext.tsx` (drag state + API assignment)
- `Bot3D.tsx` (drag handle)
- `World3DView.tsx` (DragDropProvider wrapping)


## 🔴 Critical

### 1) Drag/drop has no user-visible failure handling (silent failure)
**Where:** `DragDropContext.tsx` (`dropOnRoom`)

**Issue:** On non-2xx responses or network failures, the app only `console.error(...)` and ends drag. From a user’s POV, the bot “snaps back” (after refresh) or appears unchanged with no explanation.

**Fix:**
- Surface an error toast/banner (e.g. “Couldn’t move bot. Please retry.”).
- Consider optimistic UI with rollback:
  - Temporarily update assignment locally (or invalidate query cache), and rollback on failure.
- Return a boolean / result object from `dropOnRoom` so callers (RoomDropZone) can show feedback.

### 2) `RoomDropZone` uses pixel sizing inside a 3D scene → inconsistent drop target area
**Where:** `Room3D.tsx` (`RoomDropZone`)

**Issue:** Drop zone size is defined as `width: ${size * 14}px` and `height: ${size * 14}px` on an `<Html>` overlay. This is screen-pixel based, not world-unit based. Depending on camera zoom/FOV and device DPR, the drop target may be too big/small and not match the room footprint.

**Fix:** Prefer a real 3D plane mesh as the drop target:
- Add a transparent `mesh` (plane) over the room floor sized in world units (`roomSize`), and use pointer/raycast events for hover + click/drop.
- If sticking with `<Html>`, set a `distanceFactor` and compute sizes based on world units, or derive from projection to screen (more complex).

### 3) Drag handle discoverability + interaction conflicts with camera controls
**Where:** `Bot3D.tsx` (drag handle), `World3DView.tsx` (Canvas controls hint)

**Issue:** The handle is hover-only and very small (`✋`). Many users won’t discover it. Also, “Drag: Rotate” camera interaction may conflict with dragging bots; accidental camera movement during drag is likely.

**Fix:**
- Make the drag affordance visible more often:
  - Always show when room is focused, or show on bot focus/select.
  - Add a subtle tooltip/hint (“Drag bots to move rooms”) when first entering 3D view.
- Disable camera controls while `drag.isDragging === true`.
  - (Likely in `CameraController` / OrbitControls layer) conditionally set `enabled={false}`.


## 🟡 Important

### 4) DragDropContext causes broad re-renders during drag
**Where:** `DragDropContext.tsx`, consumers in `Room3D.tsx` and potentially elsewhere

**Issue:** `drag` state updates via `setDrag` and is provided as a single context value. Any component calling `useDragDrop()` will re-render whenever drag state changes (start/end/possibly future hover state).

**Fix options:**
- Split context into two: `DragStateContext` + `DragActionsContext`.
- Or store drag state in a ref + external store (e.g. Zustand) if performance becomes an issue.
- Keep context value stable with `useMemo` and avoid recreating callbacks unnecessarily.

### 5) RoomProps.tsx has multiple independent `useFrame` loops (always running)
**Where:** `RoomProps.tsx` (`ServerLED`, `WallClock`, `GearMechanism`, `SignalWaves`, `SleepingZs` in `Bot3D.tsx`)

**Issue:** Each animated sub-prop registers its own `useFrame`. Because all rooms are rendered in the scene, these frames run continuously even when off-screen or when user is focused elsewhere.

**Fix:**
- Consolidate animations:
  - One `useFrame` per *room* (or per prop cluster) that updates refs for LEDs/gears/waves.
- Gate animations based on focus/visibility:
  - If you have a focus state (`WorldFocusContext`), stop/slow room-prop animations when not focused.

### 6) `ServerLED` uses `Math.random()` inside `useFrame` (per-frame randomness)
**Where:** `RoomProps.tsx` (`ServerLED`)

**Issue:** `Math.random()` in the frame loop makes blink frequency jitter frame-to-frame and adds unnecessary CPU overhead.

**Fix:**
- Precompute a stable blink speed/phase in a `useRef` on mount:
  - `const speed = useRef(2 + Math.random() * 0.5)`
  - Use that constant in `useFrame`.

### 7) Potential cursor UX bug: hover cursor only when `onClick` is provided
**Where:** `Bot3D.tsx`

**Issue:** The bot is clickable for focus (`focusBot`) even if `onClick` is undefined, but the cursor changes to pointer only when `session && onClick`.

**Fix:**
- Set cursor to pointer whenever the bot is interactive (e.g. `session && roomId`).

### 8) No prevention of dragging “fixed”/non-movable agents
**Where:** `Bot3D.tsx` (drag handle always shown if `session && roomId`)

**Issue:** If some bots/agents should not be moved (e.g. system bots, pinned agents), there is no guard.

**Fix:**
- Add a `canDrag` boolean to `Bot3D` props (derived from session metadata/role).
- Hide/disable the drag handle and show a tooltip explaining why.

### 9) Room type detection by substring is brittle
**Where:** `RoomProps.tsx` (`getRoomType`)

**Issue:** Room type is inferred from `room.name` substrings. Renaming rooms or localization will break prop selection.

**Fix:**
- Prefer a stable `room.type`/`room.key` field from backend, or map by `room.id`.


## 🟢 Nice-to-have

### 10) RoomProps.tsx (1260 lines) should be split for maintainability
**Where:** `RoomProps.tsx`

**Issue:** Large monolithic file makes review and iteration harder.

**Fix:**
- Split by room type: `RoomProps/HeadquartersProps.tsx`, `RoomProps/DevRoomProps.tsx`, etc.
- Extract shared mini-props into `RoomProps/shared/*.tsx`.

### 11) Reduce draw calls / lights for props
**Where:** `RoomProps.tsx` (various props), also imported props like `Lamp`

**Issue:** Some props include `pointLight` and multiple meshes. With many rooms + bots, GPU/CPU could become a bottleneck on low-end devices.

**Fix:**
- Prefer emissive materials instead of real lights where possible.
- Reuse geometries/materials via memoization where beneficial.
- Consider `InstancedMesh` for repeated small items (books, status lights, etc.) if counts grow.

### 12) Drop-zone messaging and affordance
**Where:** `Room3D.tsx` (`RoomDropZone`)

**Suggestion:** Provide clearer feedback:
- Show the target room name while hovering (e.g. “Move to Marketing”).
- Visually indicate the source room is not a valid drop target (currently subtle).


## Quick sanity checks to run (QA steps)
- Drag a bot while rotating the camera → verify camera doesn’t fight the drag (or disable controls during drag).
- Drag-drop rapidly between multiple rooms → verify assignment refresh is consistent and no stale room state.
- Simulate network error (offline devtools) → verify user sees an error and drag state resets cleanly.
- Test zoom levels (very close / very far) → ensure drop target area is still usable.
