# CrewHub Performance & Stability Review

**Datum:** 2026-02-04
**Reviewer:** Claude Opus (subagent)
**Status:** ⚠️ KRITIEK - Meerdere ernstige issues gevonden

---

## Executive Summary

Na grondige analyse van de CrewHub frontend codebase zijn **meerdere ernstige performance problemen** geïdentificeerd die direct de stabiliteit van de applicatie beïnvloeden:

1. **Meerdere dubbele SSE EventSource connections** - 3 hooks openen elk hun eigen SSE verbinding
2. **Potentiële infinite re-render loops** door unstable dependencies
3. **Module-level state met race conditions** in display name caching
4. **Fetch calls zonder proper timeout/abort** in kritieke paths
5. **Zware computations in render cycles** zonder adequate memoization

---

## 🔴 CRITICAL Issues

### Issue 1: Meerdere SSE EventSource Connections (CRITICAL)

**Files:**
- `src/hooks/useSessionsStream.ts:72` - SSE voor sessions
- `src/hooks/useRooms.ts:96` - SSE voor rooms-refresh
- `src/hooks/useProjects.ts:60` - SSE voor rooms-refresh (projects)

**Probleem:**
Drie verschillende hooks openen elk hun eigen `EventSource` connection naar `/api/events`. Dit betekent:
- 3 gelijktijdige HTTP connections naar dezelfde endpoint
- Browser connection limit kan bereikt worden (Chrome: 6 per domain)
- Server moet 3x dezelfde events versturen per client
- Memory overhead van 3 event handlers per component tree

```typescript
// useSessionsStream.ts:72
const eventSource = new EventSource(sseUrl)

// useRooms.ts:96
const es = new EventSource(sseUrl)

// useProjects.ts:60
const es = new EventSource(sseUrl)
```

**Root Cause:**
Geen centrale SSE manager. Elke hook beheert z'n eigen connection onafhankelijk.

**Impact:** HOOG
- Chrome kan requests blokkeren/vertragen als connection limit bereikt is
- Dit verklaart waarom fetch calls "hangen" - ze wachten op vrije connections
- Server belasting 3x hoger dan nodig

**Fix:**
```typescript
// Maak centrale SSEManager singleton
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

**Probleem:**
De `handleFocusAgentRef` pattern is correct, maar `isActivelyRunning` wordt steeds opnieuw gecreëerd:

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
`debugBots` is een array die elke render nieuw is (tenzij gememoized). Dit zorgt dat `isActivelyRunning` callback elke render verandert, wat cascade re-renders veroorzaakt.

**Impact:** HOOG
- Alle componenten die `isActivelyRunning` gebruiken re-renderen constant
- Heavy `useMemo` computations (`roomBots`, `botData`) worden elke render opnieuw berekend

**Fix:**
```typescript
// In useDebugBots hook - memoize the array:
const debugBots = useMemo(() => {
  // ... existing logic
  return bots;
}, [/* stable dependencies */]);

// OF in World3DView - stabilize met JSON comparison:
const debugBotsStable = useMemo(() => debugBots, 
  [JSON.stringify(debugBots)]);
```

---

### Issue 3: Module-Level State Race Conditions (CRITICAL)

**File:** `src/hooks/useSessionDisplayNames.ts:4-9`

**Probleem:**
```typescript
const displayNameCache = new Map<string, string | null>()
type Subscriber = () => void
const subscribers = new Set<Subscriber>()

let bulkFetchPromise: Promise<void> | null = null
let bulkFetchDone = false
```

Module-level mutable state zonder synchronization:
1. `bulkFetchPromise` kan overschreven worden als 2 components gelijktijdig renderen
2. `bulkFetchDone` kan true worden voordat alle subscribers notified zijn
3. Race condition: fetch start → component unmount → fetch complete → notify dead subscriber

**Impact:** HOOG
- Display names kunnen missen of incorrect zijn
- Memory leaks door dead subscribers in Set
- Inconsistent state tussen component instances

**Fix:**
```typescript
// Gebruik stabiele singleton met cleanup tracking:
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
- `src/hooks/useRooms.ts:55-57` - Promise.all zonder abort
- `src/hooks/useAgentsRegistry.ts:40` - fetch zonder timeout
- `src/hooks/useSessionDisplayNames.ts:23` - bulk fetch zonder abort

**Probleem:**
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

Als een van deze requests hangt:
- Component unmount → fetch blijft lopen → memory leak
- User navigeert weg → state update op unmounted component
- Browser connection slots blijven bezet

**Opmerking:** `useProjects.ts:81-99` heeft WEL een AbortController - dit is het correcte pattern.

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

**Probleem:**
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

Dependencies analyse:
- `visibleSessions` - array, nieuw elke render tenzij gememoized
- `agentRuntimes` - computed in useAgentsRegistry, niet gememoized
- `getRoomForSession` - useCallback met `sessionAssignments` Map als dep
- `displayNames` - Map, nieuw elke render

**Impact:** MEDIUM-HIGH
- 80+ lijnen computation worden herhaald bij elke re-render
- O(n²) complexity in sommige loops
- Dit veroorzaakt UI lag/jank

**Fix:**
```typescript
// Stabilize alle Map/Array dependencies:
const visibleSessionsStable = useMemo(() => visibleSessions, 
  [sessions.map(s => s.key).join(',')]);

const displayNamesStable = useMemo(() => displayNames,
  [Array.from(displayNames.entries()).join(',')]);
```

---

### Issue 6: localStorage Reads in Render Path

**File:** `src/components/world3d/World3DView.tsx` (via useRooms/useProjects SSE setup)

**Probleem:**
```typescript
// useRooms.ts:93-94, useProjects.ts:55-57
useEffect(() => {
  const token = localStorage.getItem("openclaw_token") || ""  // ⚠️ Sync localStorage read
  const sseUrl = token ? `/api/events?token=${encodeURIComponent(token)}` : "/api/events"
  const es = new EventSource(sseUrl)
```

`localStorage.getItem()` is synchroon en blokkeert de main thread. In elk van de 3 SSE hooks wordt dit uitgevoerd.

**Impact:** LOW-MEDIUM
- Kleine delay per hook op initial mount
- Cumulatief met 3 hooks: merkbare startup lag

**Fix:**
```typescript
// Cache token buiten render cycle:
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

Als `fetchAgents` dependency verandert (nieuwe functie reference), wordt het interval opnieuw aangemaakt. Dit kan tot dubbele polls leiden tijdens de transition.

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
1. `sort()` mutates the original array - dit kan upstream bugs veroorzaken
2. `keysString` wordt elke render opnieuw berekend
3. Effect splits de string weer - dubbel werk

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

Dit pattern forceert een re-render van alle ChatContext consumers wanneer de focus handler verandert, ook al verandert de daadwerkelijke context value niet.

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

1. **SSE Consolidation (CRITICAL)** - Maak single SSE manager, elimineer 2 van de 3 connections
2. **AbortController toevoegen** - Alle fetch calls moeten abortable zijn
3. **Stabilize dependencies** - useMemo voor arrays/Maps die als deps gebruikt worden
4. **Display name service refactor** - Singleton met proper cleanup
5. **localStorage caching** - Token cachen buiten render cycle

---

## 🔍 Verification Steps

Na fixes, verify met:

```bash
# Chrome DevTools → Network tab
# Filter op "events" - zou maar 1 SSE connection moeten zijn

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
