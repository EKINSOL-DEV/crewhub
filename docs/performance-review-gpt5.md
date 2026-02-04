# CrewHub – Architectural Performance & Stability Review (GPT-5)

Date: 2026-02-04

Scope requested:
- Custom hooks in `frontend/src/hooks/` (fetch/effects/cleanup/stale closures)
- SSE connection management (esp. `useRooms.ts`, `useProjects.ts`, `useSessionsStream.ts`)
- Data flow into Canvas components (`World3DView.tsx` / `SceneContent`)
- Potential memory leaks (listeners/intervals/subscriptions)
- Browser connection limits & “hanging fetch / endless loading” symptoms

---

## Executive summary (what’s most likely breaking things)

### 1) Too many independent SSE connections + no shared event bus
There are **3 separate `EventSource` connections** created in the frontend:
- `useSessionsStream.ts` → `new EventSource('/api/events?...')`
- `useRooms.ts` → `new EventSource('/api/events?...')`
- `useProjects.ts` → `new EventSource('/api/events?...')`

If the corresponding hooks are mounted in multiple places (2D view + 3D view + panels, or across route changes / HMR), it’s easy to end up with **multiple SSE connections per tab**.

Impact:
- Can hit Chrome’s per-host connection limits (especially in dev with proxying / long-polling / many fetches).
- Causes **duplicate event handling** (same event triggers multiple refreshes).
- Amplifies load: every SSE reconnection triggers `fetchSessions` / `fetchRooms` / `fetchProjects` again.

**This is the #1 architectural risk** tied to “Chrome blijft laden” + “fetch calls hangen”.

### 2) Missing cleanup for `storage` listeners (real memory leak)
Two hooks add `window.addEventListener('storage', ...)` using inline functions and **never remove them**:
- `useGridDebug.ts`
- `useDebugBots.ts`

On unmount/remount (route changes, React StrictMode double-invocation in dev, HMR), these accumulate and can create:
- repeated setState calls
- unexpected rerenders
- sluggishness over time

### 3) Fetch patterns: many calls without AbortController / request cancellation
Most hooks fire `fetch()` inside `useEffect` or `useCallback` without cancellation:
- `useRooms` (3 parallel fetches)
- `useProjects` (list fetch, assign/clear/update/delete)
- `useAgentsRegistry` (polling)
- `useAgentChat` (history load + older messages)
- `useSessionDisplayNames` (bulk fetch)

Impact:
- If user navigates quickly, old requests can resolve late and overwrite state (stale updates).
- Hanging requests keep browser connections occupied.

### 4) A subtle stale-closure / mutation hazard: sorting props in-place
In `useSessionDisplayNames(sessionKeys: string[])`:
```ts
const keysString = sessionKeys.sort().join(",")
```
`Array.sort()` mutates the input array. If the caller reuses that array elsewhere (or memoizes based on order), this can create confusing rerenders and hard-to-track UI behavior.

---

## Findings by requested focus area

## (1) Hook patterns review – anti-patterns & correctness

### `useSessionsStream.ts`
Good:
- Has cleanup for `EventSource`, polling interval, reconnect timeout.
- Uses backoff with max cap.
- Has an `enabled` flag.

Concerns:
- It owns the “primary” `/api/events` connection, but other hooks also create their own connections rather than subscribing to this one.
- `fetchSessions()` has no AbortController; if the component remounts rapidly, a late response can still call `setState` (not catastrophic but contributes to “setState after unmount” risk).

Recommendation:
- Make this **the** global event transport (singleton) and expose a pub/sub API.


### `useRooms.ts`
Issues:
- **Creates its own SSE connection** to `/api/events` and listens to `rooms-refresh`.
- `fetchRooms` performs 3 fetches in parallel; only checks `roomsResponse.ok` strictly; assignment/rules failures are silently ignored (could mask backend errors).
- No AbortController / cancellation.

Recommendation:
- Subscribe to a central SSE manager instead of creating a new `EventSource`.
- Use AbortController in `fetchRooms` and cancel on unmount or refresh.


### `useProjects.ts`
Issues:
- **Creates its own SSE connection** to `/api/events` and listens to `rooms-refresh`.
- `createProject` introduces complex timeout logic that can cause **extra requests** on timeout:
  - POST request aborted after 10s.
  - Immediately calls `fetchProjects()`.
  - Then performs an extra `GET /projects` and searches by name.

Risks:
- If the proxy/server is slow but succeeds, the abort logic can create “request storm” patterns.
- Name-based lookup is not stable (duplicate names).

Recommendation:
- Prefer an idempotency key or server-side response correlation.
- Ensure the backend responds quickly with the created entity and keep client logic simple.


### `useAgentChat.ts`
Issues:
- No AbortController. If `sessionKey` changes while a history request is in-flight, an old response can overwrite messages.
- `initialLoadDone` ref logic prevents double loads, but does not prevent stale completion.

Recommendation:
- Add AbortController per request and abort on session change / unmount.


### `useSessionDisplayNames.ts`
Good:
- Bulk fetch pattern is a real improvement over N-per-session requests.

Issues:
- **Mutates input array** via `sessionKeys.sort()`.
- Global module-level cache and subscriber set is OK, but needs careful cleanup (currently cleanup is OK for subscribers).
- Fetches are not cancellable.

Recommendation:
- Replace with `const keysString = [...sessionKeys].sort().join(',')`.
- Consider `useSyncExternalStore` to formalize subscription.


### `useSettings.ts`
Good:
- Has a TTL cache; reduces repeated traffic.
- Has mountedRef guard.

Concerns:
- Module-level cache is shared across tabs/windows only via reload; not a bug.
- If multiple components call `useSettings`, they each call `fetchSettings()` but TTL prevents repeated API calls.

No critical issues found.


### `useAgentsRegistry.ts`
Good:
- Cleans up interval + event listener.

Concerns:
- Polling every 30s + event-based refresh; ok.
- Uses `sessions.find` and `sessions.filter` per agent each render (O(agents*sessions)). With large session counts, this becomes expensive.

Recommendation:
- Pre-index sessions by key once per render using a Map.


### `useGridDebug.ts` (Memory leak)
Issue:
- Adds `window.addEventListener('storage', (e) => { ... })` but **never removes** that listener.

Recommendation:
- Define the storage handler as a named function and remove it in cleanup.


### `useDebugBots.ts` (Memory leak)
Issue:
- Same pattern: adds `storage` listener with inline callback and doesn’t remove it.

Recommendation:
- Remove both listeners on cleanup.

---

## (2) Connection management – SSE connection count & architecture

### Current situation
Per `grep -R "new EventSource" frontend/src`:
- `useSessionsStream.ts`
- `useRooms.ts`
- `useProjects.ts`

So the design is: **each domain hook creates its own SSE**, even though they all connect to the same endpoint (`/api/events`).

### Why this is dangerous
- Chrome commonly limits concurrent connections per host (esp. HTTP/1.1). Even with HTTP/2, proxies/dev setups can still bottleneck.
- SSE connections are long-lived and occupy a slot.
- When SSE reconnect loops happen, you temporarily run both polling + SSE attempts (`useSessionsStream` does this intentionally). Add the other hooks’ SSE and you can easily create intermittent connection starvation where **fetches “hang”**.

### Recommendation: a single SSE connection manager
Create a single module/service, e.g.:
- `frontend/src/lib/eventsStream.ts` (singleton)
- or React context `EventsStreamProvider`

Responsibilities:
- Own exactly **one** `EventSource`.
- Handle auth token, reconnect/backoff, and lifecycle.
- Provide `subscribe(eventName, handler)` and `unsubscribe`.
- Optionally replay latest payloads / provide derived stores.

Then:
- `useRooms` subscribes to `rooms-refresh` via manager.
- `useProjects` subscribes similarly.
- `useSessionsStream` either becomes a consumer of the manager or the manager becomes the base layer.

---

## (3) Data flow into Canvas components – rerender & prop drilling risks

### `World3DView.tsx` / `SceneContent`
Good:
- Many `useMemo` blocks exist for layout, bounds, session lists.
- Room bounds are memoized.

Architectural concerns:
1) **Hooks inside Canvas tree**
`SceneContent` runs inside `<Canvas>`. It uses `useAgentsRegistry(allSessions)`.
- If the Canvas remounts (route transitions, suspense fallback, error boundary resets), you can recreate polling intervals and listeners.
- This may be fine, but it increases sensitivity to remounts.

2) High-frequency session updates → heavy recomputation
Any SSE update to sessions can cause:
- recompute bot placements
- rebuild Maps/Sets
- rerender many 3D objects

If sessions refresh frequently (or if multiple SSE connections duplicate refresh events), the 3D view can appear “stuck loading” due to constant work.

3) Derived data recomputation across layers
Logic to determine room per session exists in multiple places:
- In `SceneContent` placement
- In the focus handler (`handleFocusAgentRef`)
- In `focusedRoomSessions` calculation

Recommendation:
- Centralize `resolveRoomForSession(session)` into a shared selector function that returns stable results.
- Precompute `sessionKey -> roomId` map once per update (memoized), then reuse.

---

## (4) Potential memory leaks checklist

### Confirmed leaks
- `useGridDebug.ts`: `storage` listener not removed.
- `useDebugBots.ts`: `storage` listener not removed.

### High-risk patterns (not leaks yet, but can become one)
- Multiple `EventSource` connections per domain hook.
- Uncancelled fetch requests completing after unmount / session switch.

### OK patterns observed
- `useAgentsRegistry` removes its interval and listener.
- `useSessionsStream` cleans up interval, timeout, and closes EventSource.

---

## (5) Browser connection limits & “90+ fetches” risk

Even if you do not have 90+ requests, the *pattern* is risky:
- Long-lived SSE connections occupy connection slots.
- Polling fallback in `useSessionsStream` creates steady traffic during reconnect.
- Domain hooks also refresh on events by doing full refetches.

If the app has additional API calls elsewhere (logs, docs, chat history, thumbnails), you can end up with:
- fetches queued behind the connection pool
- dev proxy (Vite) exacerbating latency
- UI showing indefinite spinners

Recommendation:
- Reduce the number of parallel fetches and add timeouts/abort.
- Prefer batched endpoints (you already did for display names).

---

# Prioritized issues & refactor recommendations

## P0 (critical – likely root cause of hangs / endless loading)

### P0.1 – Implement a single SSE connection manager (fan-out)
**Problem:** `useSessionsStream`, `useRooms`, `useProjects` each create their own `EventSource`.

**Fix:** Build `eventsStream` singleton/context:
- `connect()` once
- `subscribe('rooms-refresh', ...)`
- `subscribe('sessions-refresh', ...)`
- auto reconnect/backoff
- expose connection state

**Expected impact:**
- Fewer persistent connections → less connection starvation.
- Fewer duplicate refreshes → fewer rerenders and fetch storms.


### P0.2 – Fix the `storage` listener leaks
**Problem:** `useGridDebug` and `useDebugBots` don’t remove `storage` listeners.

**Fix:** store handler refs and remove in cleanup.

**Expected impact:**
- Stops gradual performance degradation during navigation/HMR.


## P1 (high – correctness & stability)

### P1.1 – Add AbortController to all fetch-in-effect patterns
Targets:
- `useRooms.fetchRooms`
- `useProjects.fetchProjects`, `assignProjectToRoom`, `clearRoomProject`, etc.
- `useAgentChat` history calls
- `useSessionDisplayNames` bulk fetch

Pattern:
- create controller inside effect/callback
- pass `signal`
- abort on cleanup

**Expected impact:**
- Prevent stale updates.
- Avoid “hanging” requests tying up the pool.


### P1.2 – Remove in-place sort mutation in `useSessionDisplayNames`
**Problem:** `sessionKeys.sort()` mutates props.

**Fix:** `const keysString = [...sessionKeys].sort().join(',')`.

**Expected impact:**
- Eliminates subtle rerender/order bugs.


## P2 (medium – performance improvements)

### P2.1 – Pre-index sessions in `useAgentsRegistry`
**Problem:** repeated `find/filter` per agent.

**Fix:** build `Map<sessionKey, CrewSession>` and/or group by parent once.


### P2.2 – Centralize room resolution & memoize `sessionKey -> roomId`
Reduce duplicated logic and repeated calls to `getRoomForSession` and fallbacks.


### P2.3 – Consider moving polling/registry outside Canvas
If Canvas remounts often, keep data hooks at the parent (outside `<Canvas>`) and pass derived data down.


## P3 (low – code health)

### P3.1 – Normalize API access
Some hooks use `api.*` (`useSessionsStream`), others use raw `fetch(API_BASE/...)`.

Recommendation:
- unify into a single API client with:
  - default timeout/abort
  - error normalization
  - optional caching


---

## Concrete “next steps” plan

1) **Build `eventsStream` manager** (singleton) and migrate:
   - `useRooms` → remove `new EventSource`, subscribe to `rooms-refresh`
   - `useProjects` → same
   - optionally `useSessionsStream` becomes `useSessionsStore` that listens to stream.

2) Fix listener cleanup in:
   - `useGridDebug`
   - `useDebugBots`

3) Add AbortControllers + timeouts:
   - Start with `useRooms` + `useAgentChat` (user-visible hangs)
   - Then expand across hooks.

4) Fix `useSessionDisplayNames` sort mutation.

---

## Notes related to reported symptoms

- **“fetch calls hangen”**: consistent with connection pool starvation (multiple SSE + polling + parallel fetches) and lack of timeouts/abort in most hooks.
- **“Chrome blijft laden”**: can happen if UI is constantly rerendering from duplicated refresh events + heavy 3D tree updates.
- **“project assign/create werkt niet”**: `createProject` timeout+retry logic can mask the real underlying server latency / proxy hang and create extra load; `assignProjectToRoom` has no timeout/abort and can stall silently.

