# Fullscreen Markdown Bug Review (Alternative Angle)

## Executive Summary

My hypothesis: the fullscreen markdown overlay is fighting **global 3D input systems** (especially `PointerLockControls` and `CameraControls`) rather than simple DOM bubbling/z-index.

This means the overlay can look visually correct but still be effectively non-interactive because input is captured at a lower level than React `onClick`/`stopPropagation`.

---

## 1) Root Cause Hypothesis (Different Angle)

### Primary hypothesis: **Pointer Lock + global camera input capture**

In `World3DView`:
- `CameraController` uses `@react-three/drei` `CameraControls` (from `camera-controls`), which manages native pointer/mouse/wheel input.
- `FirstPersonController` uses `PointerLockControls` and explicitly enters pointer lock in first-person mode.

Key details from code:
- `FirstPersonController` keeps lock state and only exits on unlock/ESC.
- `FullscreenOverlay` currently tries to block input by:
  - `onPointerDown/Up/Move/Wheel` + `stopPropagation`
  - disabling `canvas.style.pointerEvents = 'none'`

Why this likely fails:
1. `PointerLockControls` routes mouse movement independent of normal hit-testing.
2. `camera-controls` may have global/native listeners that do not care about React synthetic propagation.
3. If pointer lock is active, disabling canvas pointer events does **not** reliably restore normal overlay interaction.

So the bug is architectural: the overlay is modal in UI, but the 3D input stack is still “live”.

---

## 2) Architecture Assessment

### Is portal approach correct?
**Yes, mostly.** `createPortal(..., document.body)` is a valid modal pattern.

But portal alone is insufficient when background systems use:
- native/global listeners
- pointer lock
- non-React input pipelines

### Fundamental design flaw
There is no centralized **"modal/input lock" contract** between:
- markdown fullscreen UI
- world 3D camera + first-person controllers

Current approach is defensive CSS/event blocking. It should be explicit state-driven control.

---

## 3) R3F / drei-specific notes

- R3F pointer events are delegated via an event manager; not identical to normal DOM bubbling.
- `@react-three/drei` controls (`CameraControls`, `PointerLockControls`, `OrbitControls`) manage their own native listeners.
- `stopPropagation()` in React handlers on an overlay does not guarantee blocking those control systems.

Conclusion: This should be solved by **disabling controls at source**, not trying to intercept after the fact.

---

## 4) CSS/DOM Layer Analysis

I don’t think this is primarily a stacking-context issue:
- Overlay uses `position: fixed; inset: 0; zIndex: 9999` and is portaled to `body`.
- That should visually and interaction-wise top DOM content in normal conditions.

Could still have minor stacking noise (e.g., transformed ancestors), but portal to body avoids most of it.

This matches observed failures: both propagation fix and canvas pointer-events fix failed, suggesting issue is beyond normal DOM layering.

---

## 5) React lifecycle angle

`useEffect` timing in `FullscreenOverlay` (for canvas pointer-events) is likely not the core issue.

Even if converted to `useLayoutEffect`, pointer lock/global listeners can still win.

So lifecycle race is secondary; architecture/state wiring is primary.

---

## 6) Why previous attempts failed

### Attempt 1: stopPropagation on overlay
Failed because it only affects React/DOM bubbling. It does not reliably block native/global 3D control handlers and pointer-lock behavior.

### Attempt 2: disable canvas pointer-events
Failed because:
- `PointerLockControls` can continue owning mouse input while locked.
- Camera/keyboard handlers may be attached globally (`window`/`document`).
- Canvas hit-testing is not the only input channel.

---

## 7) Recommended Solution

## A) Introduce global UI modal lock (single source of truth)

Create state like `isUIModalOpen` (Context or Zustand). Any fullscreen/document modal sets this.

When `isUIModalOpen === true`:
1. Disable `CameraControls` (`enabled = false`).
2. Disable/exit `PointerLockControls` immediately.
3. Suppress movement key handlers in first-person/camera controllers.
4. Optionally set `inert` on world container for strict background non-interaction.

### Example (concept)

```tsx
// uiInteractionStore.ts (Zustand or Context)
export const useUIInteractionStore = create(set => ({
  isUIModalOpen: false,
  setUIModalOpen: (open: boolean) => set({ isUIModalOpen: open }),
}))
```

```tsx
// FullscreenOverlay.tsx
const setUIModalOpen = useUIInteractionStore(s => s.setUIModalOpen)
useEffect(() => {
  setUIModalOpen(open)
  return () => setUIModalOpen(false)
}, [open, setUIModalOpen])
```

```tsx
// CameraController.tsx
const isUIModalOpen = useUIInteractionStore(s => s.isUIModalOpen)
useEffect(() => {
  const controls = controlsRef.current
  if (!controls) return
  if (isUIModalOpen) controls.enabled = false
  else controls.enabled = !isDragging && !isInteractingWithUI
}, [isUIModalOpen, isDragging, isInteractingWithUI])
```

```tsx
// FirstPersonController.tsx
const isUIModalOpen = useUIInteractionStore(s => s.isUIModalOpen)

useEffect(() => {
  if (!controlsRef.current) return
  if (isUIModalOpen) {
    controlsRef.current.unlock() // critical
    // optional: exit first person mode too
    exitFirstPerson()
  }
}, [isUIModalOpen, exitFirstPerson])
```

## B) Make modal ownership explicit in World3DView

Instead of overlay trying to discover and patch canvases (`querySelectorAll('canvas')`), pass a prop/context signal from owning feature and let `World3DView` gate controls.

This removes cross-component DOM mutation and hidden coupling.

## C) Optional hardening

- Add dedicated `#overlay-root` sibling of app root and portal there.
- Add `inert` to world container while modal open:

```tsx
<div ref={worldRef} inert={isUIModalOpen ? '' : undefined} aria-hidden={isUIModalOpen}>
  <World3DView ... />
</div>
```

---

## 8) Alternative approaches not yet tried

1. **Control-level toggle only**
   - Skip CSS hacks entirely.
   - Toggle `enabled` on camera controls + unlock pointer lock.

2. **Focus mode contract via WorldFocusContext**
   - Add `level: 'ui-modal'` that disables all world interaction systems.

3. **Global event shield at capture phase**
   - Temporary capture listeners on `window` when modal opens (fallback only).
   - Less clean than state-driven control disable.

4. **Zustand interaction bus**
   - Cleaner if multiple modals/panels need to freeze 3D world.

---

## 9) Concrete implementation plan (minimal risk)

1. Add `isUIModalOpen` global state.
2. Set/unset it from `FullscreenOverlay` open state.
3. In `CameraController`, include this flag in `enabled` calculation.
4. In `FirstPersonController`, unlock + exit first-person when modal opens.
5. Remove `querySelectorAll('canvas')` pointer-events mutation from `FullscreenOverlay`.
6. Keep portal; keep high z-index.

This should resolve root conflict instead of patching symptoms.

---

## Final verdict

The issue is likely not a simple overlay DOM bug but an **input architecture bug**: fullscreen UI is modal visually, but 3D controls remain active underneath at native/global level. A centralized interaction-lock design should fix this robustly.
