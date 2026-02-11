# CrewHub connection/SSE architecture review (why “No agents or sessions” can appear)

Date: 2026-02-03

This review focuses on the path **OpenClaw Gateway → CrewHub backend → SSE → CrewHub frontend** and why the UI can show **“No agents or sessions”** even when agents are active.

---

## High-level architecture

```mermaid
flowchart LR
  OC[OpenClaw Gateway
WebSocket :18789] <-- ws connect/challenge --> B1[Backend: GatewayClient
(app/services/gateway.py)]
  OC <-- ws connect/challenge --> B2[Backend: ConnectionManager
(OpenClawConnection)
(app/services/connections/*)]

  B1 -->|HTTP GET /api/sessions| FE1[Frontend
useSessionsStream.ts]
  B1 -->|poll every 5s| P[poll_sessions_loop()
(app/main.py)]
  P -->|broadcast(type="sessions")| SSE[(SSE clients pool)
(app/routes/sse.py)]
  SSE -->|GET /api/events| FE1

  FE1 -->|onopen fetchSessions()| B1
  FE1 -->|poll fallback when SSE errors| B1

  subgraph UI
    PV[PlaygroundView.tsx]
  end
  FE1 --> PV
```

### Key components / files

- **Backend SSE transport:** `backend/app/routes/sse.py`
  - Keeps an in-memory list of per-client `asyncio.Queue`s.
  - `broadcast(event_type, data)` pushes `{type, data}` to all queues.
  - SSE output uses `event: <type>` and `data: <json>`.

- **Backend Gateway connection used by `/api/sessions`:** `backend/app/services/gateway.py` (`GatewayClient`)
  - Singleton WebSocket client.
  - Connects on-demand from each API call and from the polling loop.
  - Has a listener task (`_listen_loop`) that flips `_connected=False` on disconnect.
  - **No explicit reconnect loop**; reconnect happens only when a future `call()` triggers `connect()`.

- **Backend polling:** `backend/app/main.py`
  - Starts `poll_sessions_loop()` which calls `gateway.get_sessions()` every 5 seconds.
  - If it gets sessions, it broadcasts to SSE.

- **Frontend streaming hook:** `frontend/src/hooks/useSessionsStream.ts`
  - Opens `EventSource('/api/events')`.
  - On open: fetches initial sessions via HTTP `api.getSessions()`.
  - Listens to SSE events named: `sessions-refresh`, `session-created`, `session-updated`, `session-removed`.
  - If SSE errors: falls back to polling and schedules SSE reconnect.

- **Frontend empty state:** `frontend/src/components/sessions/PlaygroundView.tsx`
  - Shows “No agents or sessions” when `agentRuntimes.length === 0 && visibleSessions.length === 0`.

---

## Primary root cause (high confidence): SSE event type mismatch

### What backend emits
`poll_sessions_loop()` broadcasts:

```py
await broadcast("sessions", {"sessions": sessions_data})
```

Because `routes/sse.py` formats this as:

```text
event: sessions
data: {"sessions": [...]}
```

### What frontend listens for
The frontend **does not subscribe to** an event named `sessions`.
It subscribes to:

- `sessions-refresh`
- `session-created`
- `session-updated`
- `session-removed`

So **even if the backend keeps broadcasting**, the frontend never consumes the payload.

### Why this can lead to “No agents or sessions” while sessions are active
A common failure sequence:

1. Frontend opens SSE successfully → `onopen` fires → frontend calls `fetchSessions()` once.
2. At that moment, backend `GET /api/sessions` returns `[]` due to a transient Gateway issue (wrong URL, gateway restarting, connect timeout, etc.).
3. Frontend is now “connected via SSE” and **stops polling**.
4. Backend later reconnects to Gateway and begins polling successfully, broadcasting **`event: sessions`**.
5. Frontend ignores `sessions` events → the UI remains with `sessions=[]` indefinitely → PlaygroundView shows **“No agents or sessions”**.

This explains the reported symptom: agents were active (Gateway had sessions), but the dashboard stayed empty.

---

## Answers to the specific questions

### 1) How does the backend maintain its connection to the OpenClaw gateway?

There are **two** separate mechanisms in the backend:

1) **`GatewayClient`** (`app/services/gateway.py`):
- A singleton WebSocket client.
- It connects lazily on-demand when `call()` is used (e.g., `/api/sessions` or poll loop).
- It runs a `_listen_loop()` task while the socket is open.

2) **`ConnectionManager` / `OpenClawConnection`** (`app/services/connections/*`):
- A separate multi-connection abstraction.
- It has explicit auto-reconnect with exponential backoff.
- It is started in `main.py` and loads enabled connections from DB.

**Important:** `/api/sessions` and the sessions SSE polling loop currently use **`GatewayClient`**, not the `ConnectionManager`.

### 2) What happens if that connection drops? Does it auto-reconnect?

- For **`GatewayClient`**: 
  - When the socket drops, `_listen_loop()` ends and sets `_connected = False`.
  - There is **no background reconnect loop**.
  - Reconnect only happens when the next `call()` happens (e.g., the poll loop 5s later).

- For **`OpenClawConnection`** (ConnectionManager):
  - It **does auto-reconnect** (`_schedule_reconnect`) with exponential backoff.

### 3) Is there a race condition where the frontend SSE connects but the backend hasn’t fetched sessions yet?

Yes, but it’s primarily a **data availability race** combined with the event mismatch:

- Frontend: SSE `onopen` immediately triggers `fetchSessions()`.
- If that HTTP fetch occurs while Gateway is unavailable, the result is `sessions=[]`.
- After Gateway becomes available again, the backend’s poll loop produces updates, but **with the wrong event name**.

So the race is: **“first fetch happens during gateway downtime”**.

### 4) Could “No agents or sessions” be caused by a temporary empty state during reconnection?

Yes, in multiple ways:

- If `/api/sessions` returns `[]` during gateway downtime, UI becomes empty.
- Because the UI stops polling when SSE is open, it may **never recover** without a manual refresh.
- Additionally, backend `poll_sessions_loop()` only broadcasts when `sessions_data` is truthy:
  - `if sessions_data:` skips broadcasting empty list.
  - This prevents the frontend from ever being told “sessions are empty now” (less critical) but more importantly it’s inconsistent and can hide state transitions.

### 5) Is the frontend correctly handling SSE disconnects and reconnects?

Partially.

Good:
- On SSE errors it switches to polling and retries SSE with exponential backoff.

Not sufficient for this bug:
- If SSE stays connected but the **backend→gateway** link is broken/recovering, the browser will not see an SSE error.
- Therefore the frontend will keep `connectionMethod="sse"`, stop polling, and rely on SSE events.
- Because the event names don’t match, it can remain stale forever.

### 6) Any single points of failure in the data pipeline?

Yes:

1) **Event name contract mismatch** between backend broadcast and frontend listeners.
2) **In-memory SSE client pool** (`_sse_clients`) is per-process:
   - If the backend runs with **multiple workers/processes**, the polling loop in worker B will not broadcast to SSE clients connected to worker A.
3) **Backend uses two gateway connection stacks** (GatewayClient vs ConnectionManager) creating inconsistent behavior:
   - One has auto-reconnect/backoff and event handling; the other is a simple singleton used for sessions.
4) **Environment sensitivity:** `OPENCLAW_GATEWAY_URL=ws://host.docker.internal:18789`
   - Works inside Docker, often fails on host-run deployments (where `host.docker.internal` may not resolve as expected).
   - A failing gateway URL results in `/api/sessions` returning `[]`.

---

## Identified failure modes (with symptoms)

1) **SSE event mismatch (backend `sessions` vs frontend `sessions-refresh`)**
- Symptom: UI initially loads empty and never updates while SSE looks “connected”.
- Trigger: any transient `/api/sessions` empty result, followed by recovery.

2) **Multiple backend workers / processes**
- Symptom: SSE connects but receives no updates; polling loop runs but broadcasts to a different process’s `_sse_clients`.
- Trigger: running uvicorn/gunicorn with `--workers > 1`, or behind a process manager.

3) **Gateway URL/token misconfiguration**
- Symptom: `/api/sessions` returns `[]` (or errors), UI empty.
- Trigger: running backend on host while env points at `host.docker.internal`, wrong port, wrong token.

4) **Backend polling does not broadcast empty lists**
- Symptom: clients can retain stale sessions list (not the main reported issue, but causes confusing UI on shutdown).

5) **Frontend relies on SSE for freshness but doesn’t handle “backend is alive, upstream is dead”**
- Symptom: “connected” indicator might stay green while upstream is broken; sessions stale.

---

## Recommended fixes (prioritized)

### P0 — Fix the event contract mismatch
Pick one of these and make it consistent end-to-end:

- **Option A (smallest change):** change backend broadcast type to `sessions-refresh`.
  - In `poll_sessions_loop()`:
    - `await broadcast("sessions-refresh", {"sessions": sessions_data})`

- **Option B:** add a listener for `sessions` on the frontend.
  - In `useSessionsStream.ts`, add:
    - `eventSource.addEventListener("sessions", ...)`

Option A is cleaner because the frontend already expects `sessions-refresh`.

### P0 — Ensure the UI can recover if the upstream gateway goes down while SSE stays up
Even with event names fixed, consider one of:

- Keep **low-frequency polling** even when SSE is connected (e.g. every 30–60s) as a safety net.
- Or have backend send periodic “upstream status” events and have frontend trigger `fetchSessions()` when status flips from disconnected → connected.

### P1 — Avoid per-process SSE state (if running multiple workers)
If you ever run multiple uvicorn/gunicorn workers, the in-memory `_sse_clients` approach breaks.

Fix options:
- Run with **1 worker** for SSE.
- Or move SSE broadcasting to a shared broker (Redis pub/sub) and have each worker subscribe.
- Or use WebSockets with a shared pub/sub backend.

### P1 — Unify gateway connection stack
Right now the app has:
- `GatewayClient` used by sessions routes + poll loop
- `ConnectionManager` used for DB-driven connections

Recommended:
- Make `/api/sessions` and the polling/SSE update path use **ConnectionManager.get_all_sessions()** (and thus OpenClawConnection’s reconnect/backoff).
- This removes duplicated logic and makes behavior consistent.

### P2 — Broadcast empty lists (and include connection metadata)
Change:

```py
if sessions_data:
    await broadcast(...)
```

to always broadcast:

```py
await broadcast("sessions-refresh", {"sessions": sessions_data, "ts": time.time()})
```

Also consider including `gateway_connected` so UI can show “Gateway disconnected” rather than “No agents”.

### P2 — Configuration hardening
- Use different env values for Docker vs host-run.
- Validate gateway connectivity at startup and log loudly.

---

## Concrete timing/race issues to watch

1) **First load during gateway downtime**
- Frontend fetch returns `[]`.
- SSE stays connected.
- Without correctly handled session events (or fallback polling), UI stays empty.

2) **Backend upstream reconnect without SSE disconnect**
- Exactly the reported class of issue: transport path is healthy (SSE), upstream is not.

3) **Multi-worker split brain (if enabled)**
- Browser connects to worker A.
- Poll loop in worker B broadcasts to its own memory.
- Browser gets no updates.

---

## Summary

The most likely direct reason for the observed “No agents or sessions” while sessions were active is:

- **Backend broadcasts SSE event type `sessions`, but frontend only listens for `sessions-refresh` and other names.**

This becomes user-visible specifically when the initial HTTP fetch returns an empty list (due to any transient gateway issue) and the frontend then relies on SSE events that never match.
