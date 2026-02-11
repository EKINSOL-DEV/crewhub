# 3D World View — Parity Plan with 2D PlaygroundView

*Created: 2026-02-03*

## Goal
Bring the 3D World view to full feature parity with the 2D PlaygroundView for session routing, status detection, parking logic, and interactivity.

---

## Gap Analysis

### What 2D PlaygroundView does (that 3D doesn't):

| Feature | 2D Status | 3D Status | Priority |
|---------|-----------|-----------|----------|
| Token tracking (`isActivelyRunning`) | ✅ Full | ❌ Missing | HIGH |
| Parking lane logic (`shouldBeInParkingLane`) | ✅ Full | ❌ Simplified | HIGH |
| 15-session overflow → parking | ✅ Full | ❌ Missing | HIGH |
| Idle threshold (configurable, 120s default) | ✅ Full | ❌ Missing | HIGH |
| Bot status from token changes (30s window) | ✅ Full | ❌ Time-based only | HIGH |
| Room routing fallback (`getDefaultRoomForSession`) | ✅ Full | ⚠️ Partial | MEDIUM |
| Click bot → LogViewer | ✅ Full | ❌ Missing | HIGH |
| Walking/wandering animation | N/A (2D uses wobble) | ❌ Static positions | HIGH |
| Scale: main=large, subagent=small | ✅ Correct | ❌ Inverted | BUG |
| Session sorting by updatedAt | ✅ Full | ❌ Missing | MEDIUM |
| Status bar (agents/active/parked count) | ✅ Full | ⚠️ Static text | LOW |
| Drag-and-drop rooms | ✅ Full | ❌ Not planned for 3D v1 | LOW |

---

## Implementation Plan (Revised after GPT-5.2 Review)

### Pre-work: Shared Hooks (DO NOT DUPLICATE LOGIC)

**New file: `hooks/useSessionActivity.ts`**
Extract token tracking from PlaygroundView into a reusable hook:
```ts
export function useSessionActivity(sessions: CrewSession[]) {
  // tokenTrackingRef inside hook
  // Returns: isActivelyRunning(sessionKey): boolean
}
```

**New file: `lib/sessionFiltering.ts`**  
Extract the filtering pipeline into a shared util:
```ts
export function splitSessionsForDisplay(
  sessions: CrewSession[],
  isActivelyRunning: (key: string) => boolean,
  idleThreshold: number = 120,
  maxVisible: number = 15,
): {
  visibleSessions: CrewSession[]
  parkingSessions: CrewSession[]
}
```
Then update PlaygroundView to USE these shared utils too.

### Phase A: Session Routing & Parking Parity (Critical)

**Files: `World3DView.tsx`, new shared hooks**

1. **Use shared `useSessionActivity` hook** for token tracking + `isActivelyRunning()`
2. **Use shared `splitSessionsForDisplay()`** for parking logic (shouldBeInParkingLane + 15-cap overflow)
3. **Thread settings through** — Stop `void`-ing `_settings`, use `settings.parkingIdleThreshold`
4. **Fix room routing fallback order** to match 2D exactly:
   - For orphan sessions: `getRoomForSession(...) || getDefaultRoomForSession(...) || rooms[0]?.id`
   - For agents: `agent.default_room_id || getRoomForSession(...)` 
5. **Fix bot status** — Single source of truth using `isActivelyRunning()`:
   ```ts
   function getAccurateBotStatus(session, isActive): BotStatus {
     if (isActive) return 'active'
     const idleSeconds = (Date.now() - session.updatedAt) / 1000
     if (idleSeconds < 120) return 'idle'  
     if (idleSeconds < 600) return 'sleeping'
     return 'offline'
   }
   ```
6. **Fix scale** — Main agents: 1.0, subagents: 0.6 (matching 2D's 120px vs 72px ratio)
7. **Fix session.channel field** — 2D uses `session.lastChannel`, verify 3D uses the correct field
8. **Use `useSessionDisplayNames` hook** + `getSessionDisplayName()` for proper names (not `getBotDisplayName`)
9. **SceneContent should receive pre-filtered lists** — `visibleSessions` + `parkingSessions` (not raw `sessions`)

### Phase C: Interactivity (BEFORE wandering — easier to debug)

**Files: `World3DView.tsx` + `Bot3D.tsx`**

1. **Click bot → LogViewer** — Add onClick handler to Bot3D group
   - Import LogViewer component
   - Track `selectedSession` state
   - On click: set selectedSession and open LogViewer
   - **IMPORTANT:** Use `onPointerDown={e => e.stopPropagation()}` to prevent OrbitControls drag/click conflict
   - Visual feedback: slight scale-up on hover (pointer cursor)

2. **Status bar update** — Show accurate counts matching 2D format:
   `{agents} agents · {visible} active · {parked} parked · Click for details`

### Phase B: Bot Animations (Walking/Wandering) — LAST

**File: `Bot3D.tsx` (extend)**

1. **Wandering system** — Bots slowly walk around within their room bounds
   - Each bot picks a random target position inside room bounds (WITH margin for walls/props)
   - Smoothly lerps toward target (speed based on status: active=faster, idle=slower)
   - When reaching target, pause briefly, pick new target
   - Sleeping bots don't wander (stay still, tilted)
   - Walking animation: slight Y-axis rotation toward movement direction
   - Subtle foot stepping motion (alternating leg bob)

2. **Bot3D props extension** — Add `roomBounds` prop so bot knows its walkable area
   ```ts
   interface Bot3DProps {
     position: [number, number, number]  // initial/spawn position
     roomBounds?: { minX: number; maxX: number; minZ: number; maxZ: number }
     config: BotVariantConfig
     status: BotStatus
     name: string
     scale?: number
     session?: CrewSession  // needed for click handler
     onClick?: (session: CrewSession) => void
   }
   ```

3. **Position ownership** — Store `basePosition` in a ref on mount. Wandering offsets from base.
   If parent re-renders with new position, update base ref (don't snap).

4. **Performance** — Cap at MAX_VISIBLE_BOTS_PER_ROOM (8) per room. Parking bots also capped.
   Consider: one `useFrame` at scene level updating all bot refs (scalable pattern).

---

## Implementation Details

### Token Tracking (from PlaygroundView)
```tsx
// Add to World3DView or a shared hook
const tokenTrackingRef = useRef<Map<string, { previousTokens: number; lastChangeTime: number }>>(new Map())

useEffect(() => {
  const now = Date.now()
  sessions.forEach(session => {
    const currentTokens = session.totalTokens || 0
    const tracked = tokenTrackingRef.current.get(session.key)
    if (!tracked) {
      tokenTrackingRef.current.set(session.key, { 
        previousTokens: currentTokens, 
        lastChangeTime: session.updatedAt 
      })
    } else if (tracked.previousTokens !== currentTokens) {
      tokenTrackingRef.current.set(session.key, { 
        previousTokens: currentTokens, 
        lastChangeTime: now 
      })
    }
  })
  // Cleanup stale keys
  const currentKeys = new Set(sessions.map(s => s.key))
  for (const key of tokenTrackingRef.current.keys()) {
    if (!currentKeys.has(key)) tokenTrackingRef.current.delete(key)
  }
}, [sessions])

const isActivelyRunning = useCallback((sessionKey: string): boolean => {
  const tracked = tokenTrackingRef.current.get(sessionKey)
  if (!tracked) return false
  if (Date.now() - tracked.lastChangeTime < 30000) return true
  const session = sessions.find(s => s.key === sessionKey)
  if (session && (Date.now() - session.updatedAt) < 30000) return true
  return false
}, [sessions])
```

### Parking Logic (matching 2D exactly)
```tsx
const idleThreshold = settings.parkingIdleThreshold ?? 120

// Split sessions into active vs parking (same as 2D)
const activeSessions = sessions.filter(s => 
  !shouldBeInParkingLane(s, isActivelyRunning(s.key), idleThreshold)
)
const parkingSessions = sessions.filter(s => 
  shouldBeInParkingLane(s, isActivelyRunning(s.key), idleThreshold)
)

// Sort + cap active to 15 (overflow → parking)
const sortedActive = [...activeSessions].sort((a, b) => b.updatedAt - a.updatedAt)
const visibleSessions = sortedActive.slice(0, 15)
const overflowSessions = sortedActive.slice(15)
const allParkingSessions = [...overflowSessions, ...parkingSessions]
```

### Bot Status (accurate)
```tsx
function getAccurateBotStatus(session: CrewSession, isActive: boolean): BotStatus {
  if (isActive) return 'active'
  const idleSeconds = (Date.now() - session.updatedAt) / 1000
  if (idleSeconds < 120) return 'idle'
  if (idleSeconds < 600) return 'sleeping'
  return 'offline'
}
```

### Wandering System
```tsx
// In Bot3D — useFrame-based wandering
const wanderState = useRef({
  targetX: position[0],
  targetZ: position[2],
  waitTimer: Math.random() * 3,
  currentX: position[0],
  currentZ: position[2],
})

useFrame((_, delta) => {
  if (status === 'sleeping' || status === 'offline' || !roomBounds) return
  
  const state = wanderState.current
  const speed = status === 'active' ? 1.2 : 0.5
  
  // Move toward target
  const dx = state.targetX - state.currentX
  const dz = state.targetZ - state.currentZ
  const dist = Math.sqrt(dx*dx + dz*dz)
  
  if (dist < 0.1) {
    // Reached target, wait then pick new one
    state.waitTimer -= delta
    if (state.waitTimer <= 0) {
      state.targetX = roomBounds.minX + Math.random() * (roomBounds.maxX - roomBounds.minX)
      state.targetZ = roomBounds.minZ + Math.random() * (roomBounds.maxZ - roomBounds.minZ)
      state.waitTimer = 2 + Math.random() * 4
    }
  } else {
    // Walk toward target
    const step = Math.min(speed * delta, dist)
    state.currentX += (dx / dist) * step
    state.currentZ += (dz / dist) * step
    // Rotate toward movement direction
    groupRef.current.rotation.y = Math.atan2(dx, dz)
  }
  
  groupRef.current.position.x = state.currentX
  groupRef.current.position.z = state.currentZ
})
```

---

## Files to Modify

1. **`World3DView.tsx`** — Major: token tracking, parking logic, session routing parity, click handling, status bar
2. **`Bot3D.tsx`** — Medium: wandering system, click handler, roomBounds prop, scale fix
3. **`utils/botVariants.ts`** — Minor: fix `isSubagent` scale direction

### Phase D: Display Names Parity

**CRITICAL: Reuse existing hooks, don't reinvent!**

The 3D view currently uses `getBotDisplayName()` from `botVariants.ts` which is a simplified fallback. 
The 2D view uses `useSessionDisplayNames` hook + `getSessionDisplayName()` from `minionUtils.ts` which:
1. Fetches custom display names from the API (`/api/display-names/{key}`)
2. Falls back to session.label
3. Falls back to special cases (main agent → "Main Agent")
4. Falls back to `generateFriendlyName()` for subagents

**Implementation:**
1. Import `useSessionDisplayNames` hook in `World3DView.tsx`
2. Call it with all session keys
3. Use `getSessionDisplayName(session, displayNames.get(session.key))` for each bot's name
4. Remove the simplified `getBotDisplayName()` usage from the 3D bot placement logic

**Also reuse from 2D view (DO NOT DUPLICATE):**
- `useAgentsRegistry` — already used ✅
- `useRooms` + `getRoomForSession` — already used ✅
- `shouldBeInParkingLane` — import from minionUtils
- `getSessionDisplayName` — import from minionUtils  
- `getDefaultRoomForSession` — import from roomsConfig
- `isActivelyRunning` logic — extract to shared hook or duplicate carefully

## Files to Import (already exist)
- `shouldBeInParkingLane` from `@/lib/minionUtils`
- `getSessionDisplayName` from `@/lib/minionUtils`
- `getDefaultRoomForSession` from `@/lib/roomsConfig`
- `useSessionDisplayNames` from `@/hooks/useSessionDisplayNames`
- `LogViewer` from `@/components/sessions/LogViewer`

---

## Testing Checklist
- [ ] Active sessions appear in correct rooms (matching 2D)
- [ ] Idle sessions (>120s) move to parking area
- [ ] Sleeping sessions (>5min) in parking with sleeping animation
- [ ] Max 15 active sessions in rooms, overflow goes to parking
- [ ] Token tracking works: bot goes active when tokens change
- [ ] Bots wander inside room bounds (not outside walls)
- [ ] Parking bots wander inside parking bounds
- [ ] Click bot opens LogViewer with correct session
- [ ] Status bar shows accurate counts
- [ ] Main agents are larger scale than subagents
- [ ] Compiles without TypeScript errors
