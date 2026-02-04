# 3D World Debug Editor Panel (Test Bots) — Design

## Goal
Create a **Debug Editor Panel** (floating + draggable like `LightingDebugPanel`) to spawn and control **test bots** in the 3D world **without** creating real agent sessions.

Test bots must:
- Live only in React state (no DB / no API calls)
- Render alongside real bots in `World3DView`
- Have a clear visual indicator (e.g., `🧪` prefix)
- Never affect real session data or routing

---

## 1) Component architecture

### New UI components
1. **`frontend/src/components/world3d/TestBotsDebugPanel.tsx`**
   - Floating panel with drag handle and scrollable content.
   - UI sections:
     - Test Bot Manager
     - Bot Controls
     - Room Controls
     - State Presets
   - Similar structure/pattern to `LightingDebugPanel.tsx`:
     - Local `pos` state for dragging
     - `visible` gate
     - Small internal UI primitives (Slider/Toggle/SectionHeader)

2. **`frontend/src/components/world3d/TestBotRow.tsx`** (optional helper)
   - Renders a single test bot row: name, room, status select, remove button.

### New state + hooks
3. **`frontend/src/hooks/useTestBots.ts`**
   - Source of truth for test bots list and debug control values.
   - Exposes:
     - `testBots: TestBot[]`
     - CRUD actions: `addBot`, `removeBot`, `clearAll`, `bulkAdd(roomId, n)`, `addOnePerRoom(roomIds)`
     - Status actions: `setBotStatus(id, status)`, `setAllStatuses(status)`, `setMixedStatuses()`, etc.
     - Control actions: `setForcePhase(phase | null)`, `setSpeedMultiplier(x)`, `walkBotToRandomPosition(botId | 'all')`

4. **`frontend/src/hooks/useTestBotsPanelVisibility.ts`** (or extend an existing settings store)
   - Mirrors `useLightingPanelVisibility()`:
     - `visible`, `setVisible`
   - Can optionally persist to `localStorage` for dev convenience.

### Context provider (recommended)
5. **`frontend/src/contexts/TestBotsContext.tsx`**
   - A lightweight provider wrapping the parts of the app that need access:
     - `SettingsPanel` (toggle)
     - `World3DView` (render)
     - `TestBotsDebugPanel` (edit)
   - Why context: avoids prop drilling and keeps test bots fully client-side.

**Proposed tree:**
- `SessionsPage` (or whichever component owns settings + sessions)
  - `<TestBotsProvider>`
    - `<SettingsPanel />`
    - `<World3DView />`
    - `<TestBotsDebugPanel />` (can also live inside `World3DView` overlay section)

---

## 2) Data model / state management

### Test bot model
```ts
export type TestBotStatus = 'active' | 'idle' | 'sleeping' | 'offline'

export type ForcedBotPhase =
  | 'walking-to-desk'
  | 'working'
  | 'idle-wandering'
  | 'getting-coffee'
  | 'sleeping-walking'
  | 'sleeping'
  | 'offline'

export interface TestBotConfig {
  // Debug overrides
  forcedPhase?: ForcedBotPhase | null
  speedMultiplier?: number // default 1.0
  // Future: appearance overrides, ring style, variant, etc.
}

export interface TestBot {
  id: string
  name: string
  roomId: string
  status: TestBotStatus
  config: TestBotConfig
}
```

### Where state lives
- Store test bots **only** in React state inside `TestBotsProvider`.
- Do **not** store in DB or in existing session APIs.

### Derived “fake session” objects
`World3DView` currently renders bots by converting `CrewSession` into `BotPlacement` and then into `<Bot3D ... session={bot.session} />`.

To avoid changing `Bot3D`, test bots should be converted into **fake `CrewSession`-like objects** at render time:

- `key`: a unique synthetic key, e.g. `":testbot:" + testBot.id`
- `label`: can carry debug info (e.g. `"test"` or current forced phase) but should not be relied on.
- `updatedAt`: use `Date.now()` minus a small offset; but status should be controlled explicitly, not inferred.

**Important:** `World3DView` currently derives status from `getAccurateBotStatus(session, isActive)`.
For test bots we want **explicit status**. Two clean design options:

1. **Option A (recommended): treat test bots as a parallel placement stream**
   - Keep real session pipeline unchanged.
   - Build `BotPlacement` for test bots separately and merge into `roomBots` map.
   - For these placements:
     - `status` comes from `testBot.status` (no `getAccurateBotStatus`)
     - `isActive` can be `testBot.status === 'active'`
   - This requires small, contained changes in `World3DView` (design only; implementation later).

2. **Option B: hack `updatedAt` and activity detection**
   - Manipulate `updatedAt` so the existing idle/sleeping/offline inference matches.
   - This is fragile and fights the current logic; avoid.

### Mapping test-bot status → activity label
- `active`: activity bubble could show `"🧪 Working"` or current forced phase
- `idle`: `"🧪 Idle"`
- `sleeping`: no activity bubble (already hidden by `Bot3D`)
- `offline`: no activity bubble

### Forced animation phase + speed
`Bot3D` uses `useBotAnimation(status, interactionPoints, roomBounds)` which produces an internal state machine (`animRef.current.phase`, `walkSpeed`, etc.).

To support debug overrides:
- Add an optional **debug override layer** (design-level):
  - `Bot3D` accepts `debug?: { forcedPhase?: BotAnimState | null; speedMultiplier?: number; walkToRandom?: number }`
  - OR keep Bot3D unchanged and drive behavior through status only (limited; cannot force `getting-coffee` etc.).

**Design choice:** Extend `Bot3D` with optional debug overrides, but keep default behavior unchanged for real sessions.

Suggested approach inside `Bot3D` (future implementation):
- If `forcedPhase` is set:
  - Directly set `animRef.current.phase = forcedPhase`
  - Set compatible fields (walkSpeed/freeze/opacity/yOffset/showZzz) to match what `useBotAnimation` would normally do.
- Multiply movement speed by `speedMultiplier` (default 1.0). Note: `World3DView` has `settings.playgroundSpeed` but it’s currently unused in `SceneContent`; this debug speed should be independent and scoped to test bots.

### “Walk to random position” trigger
- `Bot3D` already supports random wandering when `anim.targetX/targetZ = null` and `anim.resetWanderTarget = true`.
- So the panel action can set:
  - `testBot.config.forcedPhase = 'idle-wandering'` (or clear forced)
  - increment a `walkToRandomNonce` in config that Bot3D reads to set `anim.resetWanderTarget = true`.

---

## 3) UI layout (text wireframe)

Panel should mimic `LightingDebugPanel` size (~260px width) and be draggable.

```
┌─────────────────────────────────────────────┐
│ 🧪 Debug Bot Editor                 drag…   │  (header/drag handle)
├─────────────────────────────────────────────┤
│ [Room ▼ Headquarters]                       │
│ [ + Add Test Bot ]   [ Clear All ]          │
│                                             │
│ TEST BOTS                                   │
│ ┌─────────────────────────────────────────┐ │
│ │ 🧪 Bot 1   (Headquarters)  [active ▼]  │ │
│ │                              [Remove] │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ 🧪 Bot 2   (Dev Room)       [sleep ▼]  │ │
│ │                              [Remove] │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ BOT CONTROLS (applies to selected bot/all)   │
│ Target: (• Selected bot) (○ All bots)        │
│ Force Phase: [ idle-wandering ▼ ] (Clear)    │
│ Speed:  [---|------] 1.0x                    │
│ [ Walk to random position ]                  │
│                                             │
│ ROOM CONTROLS                                │
│ [ Add 3 bots ] [ Add 8 bots ]                │
│ [ Add 1 bot to every room ]                  │
│                                             │
│ STATE PRESETS                                │
│ [ All Working ] [ All Sleeping ]             │
│ [ Mixed ] [ Stress Test ]                    │
└─────────────────────────────────────────────┘
```

Notes:
- “Selected bot” can be a simple dropdown `Selected bot: [🧪 Bot 1 ▼]`.
- Status selector per bot must remain per-row.
- Presets operate on the full test-bot list.

---

## 4) Integration points with existing code

### A) Settings toggle
`SettingsPanel.tsx` already has a **Developer** section with:
- Grid Overlay toggle via `useGridDebug()`
- Lighting Editor toggle via `useLightingPanelVisibility()`

Add another toggle:
- `🧪 Debug Bot Editor`
- Hook: `useTestBotsPanelVisibility()`

This keeps parity with existing UX.

### B) Rendering test bots in `World3DView`
`World3DView.tsx` currently renders:
- `SceneContent` → builds `roomBots` and `parkingBots` from `visibleSessions`/`parkingSessions`.

Integration plan:
1. `World3DViewInner` reads `testBots` from `TestBotsContext`.
2. Inside `SceneContent` placement logic, add a new step:
   - For each `testBot`:
     - Determine its room placement using `testBot.roomId`.
     - Create a **fake session** object with `key = ":testbot:" + id`.
     - Create a `BotPlacement` with:
       - `status = testBot.status`
       - `name = "🧪 " + testBot.name` (visual indicator)
       - `scale = 1.0` (or optionally smaller)
       - `config = getBotConfigFromSession(fakeSession.key, fakeSession.label, /* optional color */)`
         - or provide a dedicated test-bot config variant (future).
3. Merge into existing `roomBots` map so they render via the existing `<Bot3D />` pipeline.

### C) Visual indicator
**Minimum (no 3D changes required):**
- Prefix the name: `🧪 Bot 3`
- Optionally set `activity` string to include `🧪`.

**Enhanced (optional future):**
- Add a dashed ring / special glow in `BotStatusGlow` when `session.key` starts with `":testbot:"`.
- This requires small conditional rendering in `Bot3D` or `BotStatusGlow`.

### D) Ensure “test bots do not affect real session data”
- Never include test bots in:
  - `useAgentsRegistry` inputs
  - API calls
  - drag-drop assignment actions (optional: disable drag handle for test bots)

Implementation suggestion:
- For fake sessions, omit `session` prop to `Bot3D` to prevent focus/log flows; OR provide a stub session that is safe.
- If you want focus navigation to work for test bots, provide:
  - `session.key` (synthetic)
  - and ensure `BotInfoPanel` can handle missing fields.

Design choice:
- **Default:** test bots are clickable to focus camera, but their BotInfoPanel should show a simplified debug view (future). For first pass, clicking could be disabled by not passing `session`.

---

## 5) Risks / considerations

1. **Status inference conflict**
   - Current code computes status from `updatedAt` + `isActivelyRunning`.
   - Test bots need explicit status; mixing them into that pipeline without a parallel path will cause confusion.
   - Mitigation: create a separate placement path for test bots (Option A).

2. **Animation override complexity**
   - `useBotAnimation` is status-driven; forcing arbitrary phases requires a new override mechanism.
   - Mitigation: implement an optional debug override interface on `Bot3D` (no behavior change for real bots).

3. **Room bounds + wandering depend on `roomName`**
   - `Bot3D` grid-based pathfinding uses `roomName` to pick blueprint via `getBlueprintForRoom(roomName)`.
   - When placing test bots, ensure you pass both `roomId` and `roomName` (available from `useRooms()` data) so interaction points work.

4. **Max visible bots per room**
   - `SESSION_CONFIG.maxVisibleBotsPerRoom` will cap visible bots.
   - Stress test preset (“max bots in every room”) should consider this to avoid confusion.
   - Mitigation: show an overflow badge already exists (`+N more`). Document it in the panel (small hint).

5. **Click/focus flows assume real `CrewSession`**
   - `BotInfoPanel` expects `CrewSession` and reads logs/messages.
   - Test bots won’t have real logs.
   - Mitigation: either (a) disable click for test bots (no `session` prop), or (b) build a minimal `CrewSession` that keeps the UI safe, or (c) extend BotInfoPanel to handle test bots (future).

6. **Drag-drop to rooms**
   - `Bot3D` shows a drag handle when `session && roomId`.
   - For test bots, dragging could unintentionally interact with real assignment logic.
   - Mitigation: don’t pass `session` for test bots, or add `disableDrag` flag.

7. **Persistence**
   - Requirements say React state only (no DB). That doesn’t forbid localStorage, but be cautious.
   - Recommendation: keep test bots ephemeral by default; optionally add a “Persist between refresh” toggle later.

---

## Summary of proposed deliverables
- `TestBotsDebugPanel.tsx`: UI + controls (LightingDebugPanel-style)
- `TestBotsContext.tsx` + `useTestBots.ts`: in-memory test bot store + actions
- `useTestBotsPanelVisibility.ts`: settings toggle parity with Lighting panel
- Integrate in:
  - `SettingsPanel.tsx`: new developer toggle
  - `World3DView.tsx`: merge test bot placements into rendering

No backend changes, no database changes.
