# CrewHub Performance & Stability Review

**Date:** 2026-02-04
**Reviewer:** Claude Opus (subagent)
**Status:** ⚠️ CRITICAL - Multiple serious issues found

---

## Executive Summary

After thorough analysis of the CrewHub frontend codebase, **multiple serious performance issues** have been identified that directly affect the stability of the application:

1. **Multiple duplicate SSE EventSource connections** - 3 hooks each open their own SSE connection
2. **Potential infinite re-render loops** due to unstable dependencies
3. **Module-level state with race conditions** in display name caching
4. **Fetch calls without proper timeout/abort** in critical paths
5. **Heavy computations in render cycles** without adequate memoization

---

## 🔴 CRITICAL Issues

### Issue 1: Multiple SSE EventSource Connections (CRITICAL)

**Files:**
- `src/hooks/useSessionsStream.ts:72` - SSE for sessions
- `src/hooks/useRooms.ts:96` - SSE for rooms-refresh
- `src/hooks/useProjects.ts:60` - SSE for rooms-refresh (projects)

**Problem:**
Three different hooks each open their own `EventSource` connection to `/api/events`. This means:
- 3 simultaneous HTTP connections to the same endpoint
- Browser connection limit can be reached (Chrome: 6 per domain)
- Server must send the same events 3x per client
- Memory overhead of 3 event handlers per component tree

```typescript
// useSessionsStream.ts:72
const eventSource = new EventSource(sseUrl)

// useRooms.ts:96
const es = new EventSource(sseUrl)

// useProjects.ts:60
const es = new EventSource(sseUrl)
```

**Root Cause:**
No central SSE manager. Each hook manages its own connection independently.

**Impact:** HIGH
- Chrome can block/delay requests if connection limit is reached
- This explains why fetch calls "hang" - they're waiting for free connections
- Server load 3x higher than necessary

**Fix:**
```typescript
// Create central SSEManager singleton
// src/lib/sseManager.ts
class SSEManager {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect(url: string) {
    if (this.eventSource) return;
    this.eventSource = new EventSource(url);
    // Route events to registered listeners
  }

  subscribe(event: string, callback: (data: any) => void) {
    // Register callback
  }

  unsubscribe(event: string, callback: (data: any) => void) {
    // Unregister callback
  }
}

export const sseManager = new SSEManager();
```

---

### Issue 2: useCallback Dependencies in World3DView Causing Re-renders (CRITICAL)

**File:** `src/components/world3d/World3DView.tsx:406-416`

**Problem:**
The `handleFocusAgentRef` pattern is correct, but `isActivelyRunning` is recreated every time:

```typescript
// World3DView.tsx:387-393
const isActivelyRunning = useCallback((key: string): boolean => {
  if (isDebugSession(key)) {
    const botId = key.replace('debug:', '')
    const bot = debugBots.find(b => b.id === botId)
    return bot?.status === 'active'
  }
  return isRealActivelyRunning(key)
}, [isRealActivelyRunning, debugBots]) // ⚠️ debugBots is new array every render
```

**Root Cause:**
`debugBots` is an array that is new every render (unless memoized). This causes the `isActivelyRunning` callback to change every render, which causes cascade re-renders.

**Impact:** HIGH
- All components using `isActivelyRunning` re-render constantly
- Heavy `useMemo` computations (`roomBots`, `botData`) are recalculated every render

**Fix:**
```typescript
// In useDebugBots hook - memoize the array:
const debugBots = useMemo(() => {
  // ... existing logic
  return bots;
}, [/* stable dependencies */]);

// OR in World3DView - stabilize with JSON comparison:
const debugBotsStable = useMemo(() => debugBots,
  [JSON.stringify(debugBots)]);
```

---

### Issue 3: Module-Level State Race Conditions (CRITICAL)

**File:** `src/hooks/useSessionDisplayNames.ts:4-9`

**Problem:**
```typescript
const displayNameCache = new Map<string, string | null>()
type Subscriber = () => void
const subscribers = new Set<Subscriber>()

let bulkFetchPromise: Promise<void> | null = null
let bulkFetchDone = false
```

Module-level mutable state without synchronization:
1. `bulkFetchPromise` can be overwritten if 2 components render simultaneously
2. `bulkFetchDone` can become true before all subscribers are notified
3. Race condition: fetch starts → component unmounts → fetch completes → notify dead subscriber

**Impact:** HIGH
- Display names can be missing or incorrect
- Memory leaks from dead subscribers in Set
- Inconsistent state between component instances

**Fix:**
```typescript
// Use stable singleton with cleanup tracking:
class DisplayNameService {
  private cache = new Map<string, string | null>();
  private subscribers = new Map<number, Subscriber>();
  private nextSubscriberId = 0;
  private fetchPromise: Promise<void> | null = null;
  private fetchDone = false;

  subscribe(callback: Subscriber): () => void {
    const id = this.nextSubscriberId++;
    this.subscribers.set(id, callback);
    return () => this.subscribers.delete(id);
  }

  // ... rest of implementation
}

export const displayNameService = new DisplayNameService();
```

---

## 🟠 HIGH Priority Issues

### Issue 4: Missing AbortController in Critical Fetch Calls

**Files:**
- `src/hooks/useRooms.ts:55-57` - Promise.all without abort
- `src/hooks/useAgentsRegistry.ts:40` - fetch without timeout
- `src/hooks/useSessionDisplayNames.ts:23` - bulk fetch without abort

**Problem:**
```typescript
// useRooms.ts:52-58
const fetchRooms = useCallback(async () => {
  try {
    const [roomsResponse, assignmentsResponse, rulesResponse] = await Promise.all([
      fetch(`${API_BASE}/rooms`),           // ⚠️ No abort
      fetch(`${API_BASE}/session-room-assignments`), // ⚠️ No abort
      fetch(`${API_BASE}/room-assignment-rules`),    // ⚠️ No abort
    ])
```

If one of these requests hangs:
- Component unmount → fetch keeps running → memory leak
- User navigates away → state update on unmounted component
- Browser connection slots remain occupied

**Note:** `useProjects.ts:81-99` DOES have an AbortController - this is the correct pattern.

**Fix:**
```typescript
const fetchRooms = useCallback(async () => {
  const controller = new AbortController();
  const signal = controller.signal;

  try {
    const [roomsResponse, ...] = await Promise.all([
      fetch(`${API_BASE}/rooms`, { signal }),
      fetch(`${API_BASE}/session-room-assignments`, { signal }),
      fetch(`${API_BASE}/room-assignment-rules`, { signal }),
    ]);
    // ...
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return;
    // handle real error
  }

  return () => controller.abort();
}, []);
```

---

### Issue 5: Heavy useMemo Computations Without Stable Dependencies

**File:** `src/components/world3d/World3DView.tsx:278-358` (SceneContent roomBots computation)

**Problem:**
```typescript
const { roomBots, parkingBots } = useMemo(() => {
  const roomBots = new Map<string, BotPlacement[]>()
  // ... 80+ lines of computation

  for (const runtime of agentRuntimes) {
    // ... complex placement logic
  }

  return { roomBots, parkingBots }
}, [visibleSessions, parkingSessions, rooms, agentRuntimes, getRoomForSession, isActivelyRunning, displayNames, debugRoomMap])
```

Dependencies analysis:
- `visibleSessions` - array, new every render unless memoized
- `agentRuntimes` - computed in useAgentsRegistry, not memoized
- `getRoomForSession` - useCallback with `sessionAssignments` Map as dep
- `displayNames` - Map, new every render

**Impact:** MEDIUM-HIGH
- 80+ lines of computation are repeated on every re-render
- O(n²) complexity in some loops
- This causes UI lag/jank

**Fix:**
```typescript
// Stabilize all Map/Array dependencies:
const visibleSessionsStable = useMemo(() => visibleSessions,
  [sessions.map(s => s.key).join(',')]);

const displayNamesStable = useMemo(() => displayNames,
  [Array.from(displayNames.entries()).join(',')]);
```

---

### Issue 6: localStorage Reads in Render Path

**File:** `src/components/world3d/World3DView.tsx` (via useRooms/useProjects SSE setup)

**Problem:**
```typescript
// useRooms.ts:93-94, useProjects.ts:55-57
useEffect(() => {
  const token = localStorage.getItem("openclaw_token") || ""  // ⚠️ Sync localStorage read
  const sseUrl = token ? `/api/events?token=${encodeURIComponent(token)}` : "/api/events"
  const es = new EventSource(sseUrl)
```

`localStorage.getItem()` is synchronous and blocks the main thread. This is executed in each of the 3 SSE hooks.

**Impact:** LOW-MEDIUM
- Small delay per hook on initial mount
- Cumulative with 3 hooks: noticeable startup lag

**Fix:**
```typescript
// Cache token outside render cycle:
const getAuthToken = (() => {
  let cached: string | null = null;
  return () => {
    if (cached === null) {
      cached = localStorage.getItem("openclaw_token") || "";
    }
    return cached;
  };
})();
```

---

## 🟡 MEDIUM Priority Issues

### Issue 7: Polling Interval Without Cleanup Verification

**File:** `src/hooks/useAgentsRegistry.ts:48-51`

```typescript
useEffect(() => {
  fetchAgents()
  const pollInterval = setInterval(fetchAgents, 30000)  // Polls every 30s
  const handleAgentsUpdated = () => fetchAgents()
  window.addEventListener("agents-updated", handleAgentsUpdated)
  return () => {
    clearInterval(pollInterval)
    window.removeEventListener("agents-updated", handleAgentsUpdated)
  }
}, [fetchAgents])  // ⚠️ fetchAgents changes → interval recreated
```

If `fetchAgents` dependency changes (new function reference), the interval is recreated. This can lead to double polls during the transition.

---

### Issue 8: useSessionDisplayNames Unnecessary Re-computations

**File:** `src/hooks/useSessionDisplayNames.ts:67-90`

```typescript
export function useSessionDisplayNames(sessionKeys: string[]) {
  const keysString = sessionKeys.sort().join(",")  // ⚠️ sort() mutates, join creates new string

  useEffect(() => {
    const keys = keysString.split(",").filter(Boolean)  // ⚠️ Creates new array every effect run
    // ...
  }, [keysString])
```

**Issues:**
1. `sort()` mutates the original array - this can cause upstream bugs
2. `keysString` is recalculated every render
3. Effect splits the string again - double work

**Fix:**
```typescript
const keysStable = useMemo(() => [...sessionKeys].sort().join(","), [sessionKeys]);
```

---

### Issue 9: Ref Pattern Issues in ChatContext

**File:** `src/contexts/ChatContext.tsx:114-115`

```typescript
const focusHandlerRef = useRef<((sessionKey: string) => void) | null>(null)
const [, setFocusHandlerVersion] = useState(0)

const setFocusHandler = useCallback((handler: ((sessionKey: string) => void) | null) => {
  focusHandlerRef.current = handler
  setFocusHandlerVersion(v => v + 1)  // ⚠️ Forces re-render just to update ref
}, [])
```

This pattern forces a re-render of all ChatContext consumers when the focus handler changes, even though the actual context value doesn't change.

---

## 📊 Summary Table

| Issue | Priority | File | Line | Est. Impact |
|-------|----------|------|------|-------------|
| Multiple SSE connections | 🔴 CRITICAL | useSessionsStream, useRooms, useProjects | 72, 96, 60 | Connection blocking |
| Unstable callback deps | 🔴 CRITICAL | World3DView.tsx | 387-393 | Cascade re-renders |
| Module-level race conditions | 🔴 CRITICAL | useSessionDisplayNames.ts | 4-9 | Data inconsistency |
| Missing AbortController | 🟠 HIGH | useRooms.ts | 55-57 | Memory leaks |
| Heavy useMemo deps | 🟠 HIGH | World3DView.tsx | 278-358 | UI jank |
| localStorage in render | 🟠 HIGH | useRooms, useProjects | 93, 55 | Startup lag |
| Polling without stable deps | 🟡 MEDIUM | useAgentsRegistry.ts | 48-51 | Double polls |
| Array mutation in hook | 🟡 MEDIUM | useSessionDisplayNames.ts | 67 | Upstream bugs |
| Ref force re-render | 🟡 MEDIUM | ChatContext.tsx | 114-115 | Unnecessary renders |

---

## 🛠️ Recommended Fix Order

1. **SSE Consolidation (CRITICAL)** - Create single SSE manager, eliminate 2 of the 3 connections
2. **Add AbortController** - All fetch calls must be abortable
3. **Stabilize dependencies** - useMemo for arrays/Maps used as deps
4. **Display name service refactor** - Singleton with proper cleanup
5. **localStorage caching** - Cache token outside render cycle

---

## 🔍 Verification Steps

After fixes, verify with:

```bash
# Chrome DevTools → Network tab
# Filter on "events" - should only be 1 SSE connection

# React DevTools Profiler
# Check for components rendering >2x per user action

# Memory tab
# Snapshot before/after navigation - check for leaks
```

---

## Appendix: Files Reviewed

- `src/hooks/useProjects.ts` ✓
- `src/hooks/useRooms.ts` ✓
- `src/hooks/useSessionDisplayNames.ts` ✓
- `src/hooks/useSessionsStream.ts` ✓
- `src/hooks/useAgentChat.ts` ✓
- `src/hooks/useAgentsRegistry.ts` ✓
- `src/hooks/useSessionActivity.ts` ✓
- `src/App.tsx` ✓
- `src/components/world3d/World3DView.tsx` ✓
- `src/components/world3d/RoomInfoPanel.tsx` ✓
- `src/components/world3d/BotInfoPanel.tsx` ✓
- `src/components/world3d/ProjectPicker.tsx` ✓
- `src/contexts/ChatContext.tsx` ✓
- `src/contexts/WorldFocusContext.tsx` ✓
- `src/lib/api.ts` ✓
- `src/lib/sessionConfig.ts` ✓
