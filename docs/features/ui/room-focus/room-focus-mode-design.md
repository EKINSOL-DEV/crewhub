# Room Focus Mode — Design Document

*Version: 1.1 — 2026-02-03 (revised after GPT-5.2 review)*
*Status: Design Phase*

## Vision

Add a multi-level zoom/navigation system to the 3D World view, allowing users to seamlessly transition between three levels of detail:

1. **Overview** — Full office building (current isometric view)
2. **Room Focus** — Zoomed into a single room with detailed info
3. **Bot Focus** — Following/inspecting a single bot agent

This creates a natural drill-down flow: **Office → Room → Bot**

---

## Art Direction & UX

### Navigation Flow
```
┌─────────────────────────────────────────┐
│  🏢 OVERVIEW (current view)             │
│  - See all rooms, all bots              │
│  - Click room icon → fly to room        │
│  - Room tabs at bottom for quick switch  │
│                                          │
│  [click room]                            │
│         ↓ smooth camera fly-to           │
│                                          │
│  🔍 ROOM FOCUS                           │
│  - Camera zoomed to single room          │
│  - Bots larger, more detail visible      │
│  - Info panels: tasks, activity, costs   │
│  - Click bot → bot focus                 │
│  - Click "back" or press Escape → overview│
│  - Room tabs still visible for switching │
│                                          │
│  [click bot]                             │
│         ↓ smooth zoom                    │
│                                          │
│  🤖 BOT FOCUS                            │
│  - Camera follows single bot             │
│  - Detailed info sidebar/panel           │
│  - LogViewer integration                 │
│  - Click away or Escape → room focus     │
└─────────────────────────────────────────┘
```

### Camera Behavior

**Overview → Room Focus:**
- Smooth animated transition (lerp over ~800ms, ease-in-out)
- Camera moves to position above the target room
- Camera target (lookAt) moves to room center
- Zoom level: close enough to see individual bots clearly
- OrbitControls constrained to room area (limited pan/zoom range)

**Room Focus → Bot Focus:**
- Subtle zoom closer to the bot
- Camera follows bot as it wanders
- OrbitControls further constrained

**Any level → Overview:**
- Smooth fly-back to default isometric position
- OrbitControls restored to full range

### Camera Positions (approximate)
```
Overview:   position [45, 40, 45],  target [0, 0, 0],         fov 40
Room Focus: position [rx+8, 15, rz+8], target [rx, 0, rz],    fov 35
Bot Focus:  position [bx+4, 8, bz+4],  target [bx, 0.5, bz],  fov 30
```
Where `rx,rz` = room center, `bx,bz` = bot position.

---

## UI Components

### 1. Room Quick-Nav Icons (Overview level)

Small floating icons/buttons above or beside each room in the 3D view:
- 🔍 magnifier icon or the room's own emoji
- Positioned above the room nameplate
- On hover: slight glow/scale-up
- On click: trigger fly-to that room

**Implementation:** `<Html>` overlay per room with a button, or a 3D sprite that's always camera-facing.

### 2. Room Tabs Bar (Bottom of screen — all levels)

Horizontal bar at the bottom of the viewport:
- Shows all rooms as small tab/chips: `[🏠 HQ] [💻 Dev] [📡 Comms] [⏰ Cron] [🅿️ Parking]`
- Current focused room is highlighted
- Click a tab → fly to that room (or back to overview if already focused)
- Shows mini bot count badge per room: `Dev (3)`
- Always visible, even in overview mode

**Implementation:** React overlay (not inside Canvas), positioned absolute bottom.

### 3. Room Detail Panel (Room Focus level)

When in Room Focus, show contextual info:

**Option A: Floating panels in 3D (Html overlays)**
- Small cards next to each bot showing current task
- Room stats panel in corner (total tokens, active count, etc.)

**Option B: Side panel overlay (React, outside Canvas)**  
- Slide-in panel from right side
- Lists all bots in the room with:
  - Name, status indicator
  - Current task / last activity
  - Token usage
  - Click → Bot Focus

**Recommendation:** Start with Option B (simpler, more readable), add Option A later for polish.

### 4. Bot Info Overlay (Bot Focus level)

When focused on a bot:
- Floating card near the bot OR side panel
- Shows:
  - Bot name, type, variant
  - Status (active/idle/sleeping)
  - Current task description
  - Recent messages (last 3-5)
  - Token usage / cost
  - Time since last activity
  - "Open Log" button → full LogViewer

### 5. Back Button / Breadcrumb

- Floating top-left: `← Overview` or `← Dev Room` (contextual)
- Keyboard: Escape always goes up one level
- Double-click empty space: go to overview

---

## State Management

Use **React Context** (or Zustand if it grows) since focus state is needed in both 3D components and 2D overlays.

```ts
type FocusLevel = 'overview' | 'room' | 'bot'

interface WorldFocusState {
  level: FocusLevel
  focusedRoomId: string | null
  focusedBotKey: string | null
  isAnimating: boolean              // true during camera transition
  transitionId: number              // bumped on each nav, for cancellation
}

// Context provides state + actions
interface WorldFocusContextValue {
  state: WorldFocusState
  focusRoom: (roomId: string) => void
  focusBot: (botKey: string, roomId: string) => void
  goBack: () => void                // up one level
  goOverview: () => void            // straight to overview
}
```

### Transitions:
```
overview → room:  setFocusedRoom(roomId) → animate camera → constrain controls
room → bot:       setFocusedBot(botKey) → animate camera → follow mode
room → overview:  clearFocus() → animate camera → restore controls  
bot → room:       clearBot() → animate to room overview
bot → overview:   clearFocus() → animate to overview
room → room:      setFocusedRoom(newId) → animate between rooms
```

---

## Technical Implementation

### Camera Controls (REVISED: Use CameraControls, not OrbitControls)

**Use `CameraControls` from drei** (wrapper around `camera-controls` library) instead of `OrbitControls`.
It has built-in `setLookAt(posX, posY, posZ, targetX, targetY, targetZ, enableTransition)` which handles smooth transitions natively — no manual lerping needed.

```ts
import { CameraControls } from '@react-three/drei'

// Fly to a room:
controls.setLookAt(rx+8, 15, rz+8, rx, 0, rz, true) // true = smooth transition

// Fly back to overview:
controls.setLookAt(45, 40, 45, 0, 0, 0, true)
```

**This eliminates:** manual useFrame lerping, controls.update() calls, enable/disable dance, FOV updateProjectionMatrix.

### CameraControls Constraints per Level

```ts
// Overview
controls.minDistance = 15
controls.maxDistance = 120
controls.minPolarAngle = Math.PI / 6
controls.maxPolarAngle = Math.PI / 3

// Room Focus  
controls.minDistance = 8
controls.maxDistance = 25

// Bot Focus
controls.minDistance = 4
controls.maxDistance = 15
```

### Animation Interruption / Cancellation

- Track a `transitionId` ref (incrementing number)
- Each new navigation bumps the ID; stale animations check and bail
- `CameraControls` handles interruption naturally (new setLookAt cancels previous)
- Debounce room tab clicks (200ms) to prevent spam

### Room Quick-Nav Implementation

```tsx
// Inside Room3D or as a separate component per room
function RoomFocusButton({ room, position, onClick }) {
  return (
    <Html position={[position[0], 3, position[2]]} center>
      <button 
        onClick={() => onClick(room.id)}
        className="room-focus-btn"
      >
        🔍
      </button>
    </Html>
  )
}
```

### Bot Follow Camera (Bot Focus)

```tsx
// In useFrame, when focusedBotKey is set:
useFrame(() => {
  if (focusState.level === 'bot' && focusedBotRef) {
    const botPos = focusedBotRef.position
    // Smoothly follow bot
    controls.target.lerp(new Vector3(botPos.x, 0.5, botPos.z), 0.05)
    camera.position.lerp(
      new Vector3(botPos.x + 4, 8, botPos.z + 4), 
      0.05
    )
  }
})
```

---

## Component Hierarchy Changes

```
<World3DView>
  <Canvas>
    <WorldLighting />
    <SceneContent>
      <Room3D>
        <RoomFocusButton />  ← NEW: clickable icon above room
        <Bot3D>               (existing, with onClick for bot focus)
      </Room3D>
    </SceneContent>
    <CameraController />      ← NEW: manages animations + constraints
  </Canvas>
  
  {/* Overlays (outside Canvas) */}
  <RoomTabsBar />             ← NEW: bottom navigation tabs
  <BackButton />              ← NEW: contextual back navigation
  <RoomDetailPanel />         ← NEW: side panel when room focused
  <BotInfoPanel />            ← NEW: side panel when bot focused  
  <LogViewer />               (existing)
</World3DView>
```

---

## Implementation Phases

### Phase 1: Camera System + Room Focus (core)
- `useCameraAnimation` hook
- `CameraController` component
- Focus state management (WorldFocusState)
- Room focus buttons (3D icons above rooms)
- Smooth fly-to animation
- OrbitControls constraints per level
- Escape key handler
- Back button overlay

### Phase 2: Room Tabs + Detail Panel
- `RoomTabsBar` component (bottom overlay)
- `RoomDetailPanel` component (side panel)
- Bot list with status, tasks, token usage
- Quick-switch between rooms via tabs

### Phase 3: Bot Focus + Follow Camera
- Bot click → zoom to bot
- Camera follow mode
- `BotInfoPanel` component
- Recent messages display
- "Open full log" → LogViewer

### Phase 4: Polish + Extras
- Transition animations fine-tuning
- Mini-map in overview (optional)
- Keyboard shortcuts (1-9 for rooms, Esc for back)
- Room-specific ambient effects when focused
- Performance: reduce detail for unfocused rooms

---

## Performance Considerations

- **LOD (Level of Detail):** When in Room Focus, reduce geometry/detail of other rooms
- **Bot label hiding:** In Overview, only show labels for active bots; in Room Focus show all
- **Html overlay limit:** Max 8-10 Html overlays visible at once (they're expensive)
- **Camera animation:** Use `useFrame` with delta interpolation, not setInterval
- **Disable wandering** for bots in unfocused rooms (when in Room/Bot Focus)

---

## Future Ideas (v2+)
- Room-specific ambient sounds when focused
- Bot speech bubbles showing actual recent messages
- Drag bot between rooms in Room Focus view
- Room decoration customization
- Day/night cycle based on real time
- Visitor bots (external users appearing temporarily)
