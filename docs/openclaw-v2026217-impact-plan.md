# OpenClaw v2026.2.17 Impact Plan — CrewHub

**Datum:** 2026-02-18
**Reviewer:** GPT-5.2 (Reviewer agent)
**Status:** Implementatieplan — 4 iteraties
**Categorie:** Impact analyse + fixes voor twee kritieke OpenClaw gedragswijzigingen

---

## Samenvatting van de wijzigingen

| # | Wijziging | Risico |
|---|-----------|--------|
| 1 | Nested subagent announces → parent session (niet current session) | Premature parking van sub-subagents; misleidende BotActivityBubble bij parent; broken `hasActiveSubagents()` |
| 2 | Gepruned sessies → archief (niet verwijderd) | Ghost sessions in parking lot; `kill_session()` breekt; `sessions.list` bevat mogelijk archived sessies met stale `updatedAt` |

---

## Code-analyse

### Architectuuroverzicht (relevant voor beide issues)

```
OpenClaw Gateway (ws://localhost:18789)
    ↓ WebSocket - sessions.list call elke 5s
backend/app/main.py:poll_sessions_loop()
    ↓ broadcasts sessions-refresh SSE
backend/app/routes/sse.py:broadcast()
    ↓ EventSource SSE stream
frontend/src/lib/sseManager.ts (singleton)
    ↓ pub/sub naar handlers
frontend/src/hooks/useSessionsStream.ts
    ↓ React state update
frontend/src/lib/sessionFiltering.ts:splitSessionsForDisplay()
    ↓
3D World + Parking Area + BotActivityBubble
```

**Kritiek punt:** Er zijn GEEN push-events van OpenClaw naar CrewHub voor session lifecycle. De backend leest passief `sessions.list` via polling. Er is geen `session-removed` broadcast in de backend ondanks dat het frontend er wel naar luistert.

---

## Issue 1: Nested announce → parent session

### Betrokken bestanden en functies

#### `frontend/src/hooks/useSessionActivity.ts`
```typescript
// Regel 15-23: token tracking
const currentTokens = session.totalTokens || 0
const tracked = tracking.get(session.key)
if (!tracked) {
  tracking.set(session.key, { previousTokens: currentTokens, lastChangeTime: session.updatedAt })
} else if (tracked.previousTokens !== currentTokens) {
  tracking.set(session.key, { previousTokens: currentTokens, lastChangeTime: now })
}

// Regel 27-34: isActivelyRunning()
if (Date.now() - tracked.lastChangeTime < SESSION_CONFIG.tokenChangeThresholdMs) return true  // 30s
if (session && (Date.now() - session.updatedAt) < SESSION_CONFIG.updatedAtActiveMs) return true  // 30s
```

**Probleem:** `session.updatedAt` van de sub-subagent wordt NIET gebumpt door zijn eigen announce result (dit gaat naar de parent session). Gevolg: `updatedAt` stagnates → `isActivelyRunning(sub-subagent-key)` wordt `false` binnen 30s na voltooiing, ook al was het net actief.

#### `frontend/src/lib/minionUtils.ts`

**`getSessionStatus()` (regel 21-30):**
```typescript
const timeSinceUpdate = Date.now() - session.updatedAt
if (timeSinceUpdate < SESSION_CONFIG.statusActiveThresholdMs) return "active"   // 5min
if (hasActiveSubagents(session, allSessions)) return "supervising"
if (timeSinceUpdate < SESSION_CONFIG.statusSleepingThresholdMs) return "idle"  // 30min
return "sleeping"
```

**`hasActiveSubagents()` (regel 34-56):**
```typescript
// Controleert: is er een child session met updatedAt < 5min?
const childAge = now - s.updatedAt
return childAge < SESSION_CONFIG.statusActiveThresholdMs  // 5min
```

**Probleem A:** Sub-subagent's `updatedAt` wordt niet gebumpt → `childAge` groeit te snel → parent krijgt GEEN "supervising" status terwijl zijn kind net bezig was.

**Probleem B (BotActivityBubble):** De parent session's announce-routing zorgt dat zijn `updatedAt` recent is (< 5min). `getSessionStatus()` → "active". Maar in `getCurrentActivity()` leest `parseRecentActivities()` de laatste berichten van de parent's transcript. Die laatste berichten zijn nu het announce-result van de sub-subagent (in de parent's transcript gerouted). De bubble laat dus de tekst van de subagent zien als "parent activity" — misleidend.

**`shouldBeInParkingLane()` (regel 159-175):**
```typescript
if (/^agent:[a-zA-Z0-9_-]+:main$/.test(session.key)) return false  // main agents nooit parken
const idleSeconds = getIdleTimeSeconds(session)  // gebruikt session.updatedAt
const status = getSessionStatus(session, allSessions)
if (status === "supervising") return false
if (status === "sleeping") return true
if (isActivelyRunning) return false
return idleSeconds > idleThresholdSeconds  // 120s default
```

**Probleem:** Sub-subagent session heeft stale `updatedAt` (announce ging naar parent) → `idleSeconds > 120` te snel → sessie wordt geparkeerd na 2 minuten ook al was het net klaar met werken.

#### `frontend/src/lib/sessionFiltering.ts`
```typescript
// parkingExpiryMs = 30min
const allParking = [...overflowSessions, ...parkingSessions]
  .filter(s => (now - s.updatedAt) < parkingExpiryMs)
```

**Probleem:** Eenmaal in parking lot, verdwijnt een sub-subagent session na `now - s.updatedAt >= 30min`. Maar als de `updatedAt` niet meer bijgewerkt wordt (announce routing), is het telklok gestart op het moment vóór het laatste werk. Het session kan dus eerder verdwijnen dan verwacht.

### Wat er PRECIES misgaat (timeline)

```
T=0:00   Sub-subagent start (updatedAt = T0)
T=0:30   Sub-subagent werkt (updatedAt = T30)
T=1:00   Sub-subagent's result announce → gaat naar PARENT session
         Parent.updatedAt = T60 ← parent krijgt bump
         Sub-subagent.updatedAt blijft T30 ← niet gebumpt!
T=2:30   isActivelyRunning(sub-subagent) = false (> 30s sinds lastChangeTime)
         idleSeconds(sub-subagent) = 120s → shouldBeInParkingLane() = true → PARKED!
         hasActiveSubagents(parent) = false (childAge = 90s < 5min? Wacht... ja nog geen issue)

Maar:
T=6:01   hasActiveSubagents(parent) = false (childAge = 331s > 300s statusActiveThresholdMs)
         Parent toont "idle" terwijl het eigenlijk had moeten supervisen tot einde van work

T=31:30  Sub-subagent verdwijnt uit parking lot (parkingExpiryMs = 30min vanaf T30, niet T0)
         → vroeger weg dan verwacht

Parallel:
T=1:00   Parent.messages bevat nu het announce-result van sub-subagent
         BotActivityBubble(parent) toont: "Task completed: fix-3d-view"
         ← tekst van subagent result, niet van parent's eigen werk
```

---

## Issue 2: Sessies → archief bij pruning

### Betrokken bestanden en functies

#### `backend/app/main.py` — `poll_sessions_loop()`
```python
async def poll_sessions_loop():
    while True:
        try:
            sessions_data = await manager.get_all_sessions()
            if sessions_data:
                await broadcast(
                    "sessions-refresh",
                    {"sessions": [s.to_dict() for s in sessions_data]},
                )
        except Exception as e:
            logger.debug(f"Polling error: {e}")
        await asyncio.sleep(5)  # Poll elke 5s
```

**Probleem A:** Als OpenClaw archived sessions INCLUSIEF in `sessions.list` teruggeeft (met `status: "archived"`), worden ze meegenomen in de broadcast. Geen filtering op `status`.

**Probleem B:** Er is geen vergelijking met de vorige poll — als een session verdwijnt, wordt er GEEN `session-removed` SSE event gegenereerd. Er wordt alleen `sessions-refresh` gezonden. De frontend moet zelf uitrekenen welke sessions weg zijn.

**Probleem C:** Geen state-tracking tussen polls. Als een session in de ene poll aanwezig is en in de volgende niet, is er GEEN expliciete notificatie. De frontend fingerprint-check regelt dit correct via `computeSessionsFingerprint()` — maar alleen als de sessions daadwerkelijk verdwijnen uit het response.

#### `backend/app/services/connections/openclaw.py` — `kill_session()`
```python
async def kill_session(self, session_key: str) -> bool:
    # ...
    base = Path.home() / ".openclaw" / "agents" / agent_id / "sessions"
    session_file = (base / f"{session_id}.jsonl").resolve()

    if session_file.exists():
        ts = datetime.utcnow().isoformat().replace(':', '-')
        session_file.rename(session_file.with_suffix(f".jsonl.deleted.{ts}"))
        return True
    return False
```

**Probleem:** Dit werkt door het sessiebestand te hernoemen met `.deleted.` suffix in de `sessions/` folder. Als OpenClaw v2026.2.17 bestanden VERPLAATST naar een `archive/` folder (in plaats van hernoemen in-place), dan:
1. `session_file.exists()` → False (bestand is weg uit sessions folder)
2. `return False` — `kill_session` "mislukt" ook al is de session al gearchiveerd
3. Backend geeft HTTP 500 terug voor een eigenlijk succesvol kill-commando

#### `frontend/src/hooks/useSessionsStream.ts` — `handleSessionRemoved()`
```typescript
const handleSessionRemoved = (event: MessageEvent) => {
  try {
    const { key } = JSON.parse(event.data)
    setState(prev => {
      if (!prev.sessions.some(s => s.key === key)) return prev
      const newSessions = prev.sessions.filter(s => s.key !== key)
      // ...
      return { ...prev, sessions: newSessions }
    })
  } catch (error) {
    console.error("Failed to parse session-removed event:", error)
  }
}

const unsubscribeRemoved = sseManager.subscribe("session-removed", handleSessionRemoved)
```

**Probleem:** De backend broadcast NOOIT een `session-removed` event. Deze handler bestaat maar wordt nooit getriggerd. Ghost sessions worden enkel opgeruimd als ze uit `sessions-refresh` verdwijnen OF na `parkingExpiryMs`.

#### `frontend/src/lib/minionUtils.ts` — `shouldBeInParkingLane()`

De frontend controleert NERGENS de `session.status` veld dat van OpenClaw komt. Als OpenClaw `status: "archived"` meestuurt, wordt het genegeerd door de frontend. De session zal gewoon in de parking lot blijven tot `parkingExpiryMs` verloopt (30 minuten).

#### `backend/app/services/history.py` — archief scanning

```python
base = Path.home() / ".openclaw" / "agents"
# Scant alleen ~/.openclaw/agents/{agent_id}/sessions/
# Herkent .jsonl.deleted.* als "deleted" status
```

**Probleem:** Als OpenClaw archived sessies VERPLAATST naar bijv. `~/.openclaw/agents/{agent_id}/archive/` of `~/.openclaw/archive/`, dan vind `get_archived_sessions()` ze niet meer in de history view.

### Wat er PRECIES misgaat (ghost session scenario)

```
T=0:00   Session "agent:dev:subagent:abc" actief
T=0:30   Sessie verdwijnt in parking lot (idle > 2min)
         updatedAt = T-30min (al lang inactief)
T=1:00   OpenClaw pruning maintenance → sessie → archief
         Scenario A (best case): OpenClaw verwijdert uit sessions.list
           → volgende 5s poll bevat sessie niet → fingerprint verandert → frontend update ✓
           → in parking lot: na 30min (vanaf updatedAt) → verdwijnt ook ✓

         Scenario B (probleem): OpenClaw houdt sessie in sessions.list met status:"archived"
           → sessions-refresh bevat sessie nog steeds → fingerprint NIET veranderd
           → frontend: sessie zit in parking lot, blijft staan tot parkingExpiryMs
           → GHOST SESSION: zichtbaar in parking lot voor maximaal 30min na updatedAt

         Scenario C (edge case): sessions.list bevat sessie NIET maar kill_session() aanroep mislukt
           → HTTP 500 voor wat eigenlijk een succesvolle archive was
           → UI toont foutmelding, maar sessie verdwijnt toch bij volgende poll

T=30:30  (Scenario B) Session verdwijnt EINDELIJK uit parking lot → parkingExpiryMs overschreden
         Ghost was 30min aanwezig
```

---

## Iteratie 1: Diagnostiek (Geen productierisico — alleen logging)

### Doel
Diagnostiek toevoegen om beide issues te reproduceren en bevestigen met log output.

### Bestand 1: `backend/app/main.py`

**Wat toevoegen:**
- Track vorige poll resultaten, log welke sessies verschijnen/verdwijnen
- Log `status` field van elke sessie
- Log wanneer een session `updatedAt` meerdere polls lang niet verandert

```python
# Bovenaan poll_sessions_loop(), voeg toe:
_prev_session_keys: set[str] = set()
_prev_session_updatedAt: dict[str, int] = {}
_stale_count: dict[str, int] = {}

async def poll_sessions_loop():
    global _prev_session_keys, _prev_session_updatedAt, _stale_count
    manager = await get_connection_manager()
    while True:
        try:
            sessions_data = await manager.get_all_sessions()
            if sessions_data:
                current_keys = {s.key for s in sessions_data}
                current_dicts = [s.to_dict() for s in sessions_data]

                # Detecteer verdwenen sessies
                removed_keys = _prev_session_keys - current_keys
                added_keys = current_keys - _prev_session_keys
                if removed_keys:
                    logger.info(f"[DIAG] Sessions REMOVED from list: {removed_keys}")
                if added_keys:
                    logger.info(f"[DIAG] Sessions ADDED to list: {added_keys}")

                # Detecteer archived/non-active statuses
                for s in current_dicts:
                    status = s.get("status", "active")
                    if status not in ("active", ""):
                        logger.warning(f"[DIAG] Session {s.get('key')} has non-active status: {status!r}")

                # Detecteer stale updatedAt (geen beweging over meerdere polls)
                for s in current_dicts:
                    key = s.get("key")
                    updated_at = s.get("updatedAt", 0)
                    prev_updated_at = _prev_session_updatedAt.get(key, updated_at)
                    if updated_at == prev_updated_at:
                        _stale_count[key] = _stale_count.get(key, 0) + 1
                        if _stale_count[key] == 6:  # ~30s
                            logger.info(f"[DIAG] Session {key} updatedAt stale for 30s (status={s.get('status')})")
                    else:
                        _stale_count.pop(key, None)
                    _prev_session_updatedAt[key] = updated_at

                _prev_session_keys = current_keys

                await broadcast(
                    "sessions-refresh",
                    {"sessions": current_dicts},
                )
        except Exception as e:
            logger.debug(f"Polling error: {e}")
        await asyncio.sleep(5)
```

### Bestand 2: `frontend/src/lib/minionUtils.ts`

**Wat toevoegen:** debug logging in `hasActiveSubagents()` en `shouldBeInParkingLane()`:

```typescript
// In hasActiveSubagents(), voor de return:
if (process.env.NODE_ENV === 'development') {
  const activeChildren = allSessions.filter(s => {
    const childParts = s.key.split(":")
    const childAge = now - s.updatedAt
    return childParts[1] === agentId
      && (childParts[2]?.includes("subagent") || childParts[2]?.includes("spawn"))
  })
  if (activeChildren.length > 0) {
    activeChildren.forEach(child => {
      const childAge = now - child.updatedAt
      console.debug(`[DIAG] hasActiveSubagents: child ${child.key} age=${Math.round(childAge/1000)}s, threshold=${SESSION_CONFIG.statusActiveThresholdMs/1000}s, active=${childAge < SESSION_CONFIG.statusActiveThresholdMs}`)
    })
  }
}
```

```typescript
// In shouldBeInParkingLane(), voor de return statements:
if (process.env.NODE_ENV === 'development' && session.key.includes(':subagent:')) {
  console.debug(`[DIAG] shouldBeInParkingLane(${session.key}): idleSeconds=${idleSeconds}, status=${status}, isActivelyRunning=${isActivelyRunning}`)
}
```

### Bestand 3: `frontend/src/hooks/useSessionsStream.ts`

**Wat toevoegen:** log wanneer `session-removed` getriggerd wordt (om te testen of het ooit happens):

```typescript
const handleSessionRemoved = (event: MessageEvent) => {
  try {
    const { key } = JSON.parse(event.data)
    console.log(`[DIAG] session-removed event received for key: ${key}`)  // ADD THIS
    // ... rest of handler
  }
}
```

### Hoe testen
1. Start backend met `LOG_LEVEL=DEBUG`
2. Laat een sub-subagent (depth 2) werk doen in OpenClaw v2026.2.17
3. Monitor backend logs voor `[DIAG]` prefixes
4. Controleer: wordt de sub-subagent's `updatedAt` gebumpt? Krijgt de parent een `updatedAt` bump?
5. Wacht tot maintenance pruning triggert; controleer logs voor `Sessions REMOVED` of `non-active status`

---

## Iteratie 2: Fix voor Issue 1 (Parking lot + Announce routing)

### Strategie

Het kernprobleem is dat sub-subagents' `updatedAt` niet meer gebumpt wordt door hun eigen result announce. De fix moet:
1. Voorkomen dat sub-subagent sessies te vroeg in parking komen door `updatedAt` stagnatie
2. Voorkomen dat parent sessies misleidende activiteittekst tonen in BotActivityBubble

### Bestand 1: `frontend/src/lib/minionUtils.ts`

#### Fix A: `shouldBeInParkingLane()` — parent-session proxy

**Toevoegen:** een extra check op de parent session's `updatedAt` als proxy voor "kind was recent actief".

```typescript
export function shouldBeInParkingLane(
  session: MinionSession,
  isActivelyRunning?: boolean,
  idleThresholdSeconds: number = DEFAULT_PARKING_IDLE_THRESHOLD,
  allSessions?: MinionSession[]
): boolean {
  // Fixed agents (agent:*:main) always stay in their room
  if (/^agent:[a-zA-Z0-9_-]+:main$/.test(session.key)) return false

  const idleSeconds = getIdleTimeSeconds(session)
  const status = getSessionStatus(session, allSessions)

  // Supervising sessions should NOT be parked
  if (status === "supervising") return false
  if (status === "sleeping") return true
  if (isActivelyRunning) return false

  // NEW: OpenClaw v2026.2.17 — nested announce routing compensation
  // Sub-subagent sessions don't get their updatedAt bumped by their own result announce
  // (the announce is routed to the parent session instead).
  // If this is a subagent/spawn session, check whether its "grandparent" main session
  // recently received an update (proxy for: parent received the announce routing).
  // This prevents premature parking within the announce-routing propagation window.
  if (allSessions && (session.key.includes(':subagent:') || session.key.includes(':spawn:'))) {
    const keyParts = session.key.split(':')
    const agentId = keyParts[1]
    const ANNOUNCE_ROUTING_GRACE_MS = SESSION_CONFIG.parkingIdleThresholdS * 1000 * 2  // 2x parking threshold

    const parentMainSession = allSessions.find(s => s.key === `agent:${agentId}:main`)
    if (parentMainSession) {
      const parentAge = Date.now() - parentMainSession.updatedAt
      if (parentAge < ANNOUNCE_ROUTING_GRACE_MS) {
        // Parent recently updated — likely received routed announce from this subagent
        // or its parent. Don't park yet.
        return false
      }
    }

    // Also check parent subagent (one level up) — for depth-2 sub-subagents
    // Pattern: if our parent subagent session recently updated, hold off parking
    const parentSubagentSessions = allSessions.filter(s => {
      const sParts = s.key.split(':')
      return sParts[1] === agentId &&
             (sParts[2]?.includes('subagent') || sParts[2]?.includes('spawn')) &&
             s.key !== session.key &&
             (Date.now() - s.updatedAt) < ANNOUNCE_ROUTING_GRACE_MS
    })
    if (parentSubagentSessions.length > 0) {
      return false  // A sibling/parent subagent recently updated — be conservative
    }
  }

  return idleSeconds > idleThresholdSeconds
}
```

#### Fix B: `hasActiveSubagents()` — parent-session updatedAt als secondary signal

```typescript
export function hasActiveSubagents(session: MinionSession, allSessions: MinionSession[]): boolean {
  const key = session.key || ""
  const parts = key.split(":")
  if (parts.length < 3) return false
  const agentId = parts[1]
  const sessionType = parts[2]
  if (sessionType !== "main" && sessionType !== "cron") return false

  const now = Date.now()

  // Primary check: child session's updatedAt within threshold (original logic)
  const hasRecentChild = allSessions.some(s => {
    if (s.key === key) return false
    const childParts = s.key.split(":")
    if (childParts.length < 3) return false
    if (childParts[1] !== agentId) return false
    if (!childParts[2]?.includes("subagent") && !childParts[2]?.includes("spawn")) return false
    const childAge = now - s.updatedAt
    return childAge < SESSION_CONFIG.statusActiveThresholdMs
  })

  if (hasRecentChild) return true

  // Secondary check (v2026.2.17 compensation):
  // This session's own updatedAt recently bumped AND it has child sessions of any age.
  // Rationale: announce routing from sub-subagents bumps THIS session's updatedAt.
  // If we recently got a bump AND we have children → we're still supervising.
  const SUPERVISING_GRACE_MS = 60_000  // 1 minute grace window
  const thisSessionAge = now - (session.updatedAt || 0)
  if (thisSessionAge < SUPERVISING_GRACE_MS) {
    const hasAnyChild = allSessions.some(s => {
      if (s.key === key) return false
      const childParts = s.key.split(":")
      return childParts.length >= 3 &&
             childParts[1] === agentId &&
             (childParts[2]?.includes("subagent") || childParts[2]?.includes("spawn"))
    })
    if (hasAnyChild) return true
  }

  return false
}
```

#### Fix C: `getCurrentActivity()` — filter misleidende announce-routing berichten

**In `parseRecentActivities()`**, voeg een filter toe om "routing" berichten te herkennen en overslaan bij het bepalen van de parent's activiteittekst:

```typescript
export function parseRecentActivities(session: MinionSession, limit = 5): ActivityEvent[] {
  if (!session.messages || session.messages.length === 0) return []
  const activities: ActivityEvent[] = []
  const recentMessages = session.messages.slice(-limit * 2).reverse()

  for (const msg of recentMessages) {
    if (activities.length >= limit) break
    const timestamp = msg.timestamp || session.updatedAt

    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (activities.length >= limit) break
        if (block.type === "text" && block.text && block.text.trim()) {
          const text = block.text.trim()
          if (text === "NO_REPLY" || text === "HEARTBEAT_OK") continue

          // NEW: skip routed announce messages from sub-subagents
          // These are injected into the parent session by OpenClaw's announce routing.
          // Heuristic: if role is "user" and text starts with typical announce patterns,
          // skip to avoid showing sub-subagent results as parent activity.
          if (msg.role === "user" && _isLikelyAnnounceRouting(text)) continue

          activities.push({ /* ... same as before ... */ })
        }
        // ... rest of block handling
      }
    }
  }
  return activities
}

/**
 * Heuristic to detect announce-routing messages injected into parent sessions.
 * These are typically user-role messages with structured completion summaries.
 * Adjust patterns as OpenClaw's announce format becomes clearer.
 */
function _isLikelyAnnounceRouting(text: string): boolean {
  // Common patterns in subagent completion announces:
  return (
    text.startsWith('[Subagent result]') ||
    text.startsWith('[Agent completed]') ||
    text.startsWith('[announce]') ||
    /^(Subagent|Sub-agent)\s+\w+\s+(completed|finished|done)/i.test(text)
  )
}
```

**Noot:** De exacte patronen voor announce routing zijn nog onbekend. Dit is een conservatieve eerste implementatie. Verfijnen na observatie met diagnostiek uit Iteratie 1.

### Bestand 2: `frontend/src/lib/sessionFiltering.ts`

Pas `splitSessionsForDisplay()` aan zodat het `allSessions` doorgeeft aan `shouldBeInParkingLane()`:

```typescript
export function splitSessionsForDisplay(
  sessions: CrewSession[],
  isActivelyRunning: (key: string) => boolean,
  idleThreshold: number = SESSION_CONFIG.parkingIdleThresholdS,
  maxVisible: number = SESSION_CONFIG.parkingMaxVisible,
  parkingExpiryMs: number = SESSION_CONFIG.parkingExpiryMs,
): { visibleSessions: CrewSession[]; parkingSessions: CrewSession[] } {
  // Pass sessions as allSessions to enable parent-proxy check (Issue 1 fix)
  const activeSessions = sessions.filter(
    s => !shouldBeInParkingLane(s, isActivelyRunning(s.key), idleThreshold, sessions),
  )
  const parkingSessions = sessions.filter(
    s => shouldBeInParkingLane(s, isActivelyRunning(s.key), idleThreshold, sessions),
  )
  // ... rest unchanged
}
```

### Hoe testen

1. Spawn een sub-subagent via een subagent (depth 2)
2. Wacht tot het result announce terugkomt
3. Controleer in 3D World:
   - Sub-subagent: parkeert pas na > 4min idle (2x threshold), niet na 2min
   - Parent (main agent): toont "supervising" status als subagent recent actief was
   - Parent bot bubble: toont NIET de tekst van het subagent announce result
4. Controleer met DevTools → `[DIAG]` logs

---

## Iteratie 3: Fix voor Issue 2 (Ghost-session preventie)

### Strategie

1. Backend: filter archived/non-active sessies vóór broadcast
2. Backend: houd vorige poll bij en emit `session-removed` voor verdwenen sessies
3. Backend: fix `kill_session()` voor nieuwe archief-locaties
4. Frontend: voeg status-filter toe als safeguard

### Bestand 1: `backend/app/main.py`

**Vervang `poll_sessions_loop()` volledig:**

```python
# Boven de functie, module-level state:
_poll_prev_session_keys: set[str] = set()

# Non-active statuses die gefilterd moeten worden
_INACTIVE_STATUSES = frozenset({"archived", "pruned", "completed", "deleted", "ended"})

async def poll_sessions_loop():
    """Background task that polls all connections for sessions and broadcasts to SSE clients."""
    global _poll_prev_session_keys
    manager = await get_connection_manager()

    while True:
        try:
            sessions_data = await manager.get_all_sessions()
            if sessions_data:
                raw_dicts = [s.to_dict() for s in sessions_data]

                # Issue 2 fix: Filter out archived/pruned sessions
                # OpenClaw v2026.2.17 may include archived sessions in sessions.list
                # with status != "active". We don't want to display ghost sessions.
                active_dicts = [
                    s for s in raw_dicts
                    if s.get("status", "active") not in _INACTIVE_STATUSES
                ]

                current_keys = {s.get("key") for s in active_dicts if s.get("key")}

                # Detect removed sessions and emit session-removed events
                removed_keys = _poll_prev_session_keys - current_keys
                for removed_key in removed_keys:
                    logger.info(f"Session removed from active list: {removed_key}")
                    await broadcast("session-removed", {"key": removed_key})

                _poll_prev_session_keys = current_keys

                await broadcast(
                    "sessions-refresh",
                    {"sessions": active_dicts},
                )
        except Exception as e:
            logger.debug(f"Polling error: {e}")
        await asyncio.sleep(5)
```

**Wat dit doet:**
1. Filtert sessions met `status: "archived"` (of andere non-active statuses) vóór broadcast
2. Detecteert sessies die tussen polls verdwijnen uit de active list
3. Emits `session-removed` events — deze worden nu eindelijk gebruikt door de frontend

### Bestand 2: `backend/app/services/connections/openclaw.py`

**Fix `kill_session()`** om robuster te zijn met nieuwe archief-locaties:

```python
async def kill_session(self, session_key: str) -> bool:
    """Kill a session.

    Tries multiple strategies in order:
    1. OpenClaw API kill/archive call (preferred — API-stable)
    2. Direct file rename in sessions/ folder (legacy, may fail after v2026.2.17)
    3. Check if session is already gone/archived (treat as success)
    """
    from datetime import datetime

    try:
        sessions = await self.get_sessions()
        session = next((s for s in sessions if s.key == session_key), None)

        # Strategy 1: If session is not in active list, it may already be archived.
        # Treat as success — the session is gone from the active view.
        if not session:
            logger.info(f"kill_session: {session_key} not in active sessions — already removed/archived")
            return True

        session_id = _safe_id(session.session_id)
        if not session_id:
            return False

        agent_id = _safe_id(session.agent_id)

        # Strategy 2: Direct file manipulation (legacy approach)
        # This works when sessions are in ~/.openclaw/agents/{agent_id}/sessions/
        base = Path.home() / ".openclaw" / "agents" / agent_id / "sessions"
        session_file = (base / f"{session_id}.jsonl").resolve()

        if not str(session_file).startswith(str(base.resolve())):
            return False

        if session_file.exists():
            ts = datetime.utcnow().isoformat().replace(':', '-')
            session_file.rename(session_file.with_suffix(f".jsonl.deleted.{ts}"))
            logger.info(f"kill_session: renamed {session_file.name} → .deleted")
            return True

        # Strategy 3: File not in sessions/ folder — check archive folder
        # OpenClaw v2026.2.17 may have moved it to archive/ already
        archive_base = Path.home() / ".openclaw" / "agents" / agent_id / "archive"
        archive_file = (archive_base / f"{session_id}.jsonl").resolve()
        if archive_base.exists() and str(archive_file).startswith(str(archive_base.resolve())):
            if archive_file.exists():
                logger.info(f"kill_session: {session_key} already in archive — treating as success")
                return True

        logger.warning(f"kill_session: could not find session file for {session_key}")
        return False

    except (ValueError, OSError) as e:
        logger.error(f"Error killing session: {e}")
        return False
```

### Bestand 3: `frontend/src/lib/minionUtils.ts`

**Voeg status-check toe aan `shouldBeInParkingLane()`** als safeguard voor frontend-side ghost session preventie:

```typescript
export function shouldBeInParkingLane(
  session: MinionSession,
  isActivelyRunning?: boolean,
  idleThresholdSeconds: number = DEFAULT_PARKING_IDLE_THRESHOLD,
  allSessions?: MinionSession[]
): boolean {
  // Fixed agents (agent:*:main) always stay in their room
  if (/^agent:[a-zA-Z0-9_-]+:main$/.test(session.key)) return false

  // NEW Issue 2 safeguard: sessions with non-active status from OpenClaw
  // should be treated as sleeping (headed for parking lot expiry)
  // Note: The backend should filter these before broadcast, but this is a defensive check.
  const rawStatus = (session as any).status as string | undefined
  if (rawStatus && !['active', 'idle', ''].includes(rawStatus)) {
    return true  // archived/pruned/completed → park immediately
  }

  // ... rest of function unchanged (Issue 1 fixes from Iteratie 2 included)
}
```

**Voeg ook toe aan `frontend/src/lib/sessionFiltering.ts`:**

```typescript
// In splitSessionsForDisplay, vóór de shouldBeInParkingLane filtering:
// Hard-filter sessions with explicitly non-active status
const ACTIVE_STATUSES = new Set(['active', 'idle', '', undefined])
const filteredSessions = sessions.filter(s => {
  const rawStatus = (s as any).status
  return !rawStatus || ACTIVE_STATUSES.has(rawStatus)
})

// Dan: gebruik filteredSessions in plaats van sessions voor de rest van de functie
```

### Bestand 4: `backend/app/services/history.py`

**Voeg archive folder support toe** in `get_archived_sessions()`:

```python
# In de for loop die agent_dirs opbouwt, voeg archive folder toe:
for agent_path in OPENCLAW_BASE.iterdir():
    if agent_path.is_dir():
        # Original sessions folder
        sessions_path = agent_path / "sessions"
        if sessions_path.exists():
            agent_dirs.append(sessions_path)

        # NEW: v2026.2.17 archive folder support
        archive_path = agent_path / "archive"
        if archive_path.exists():
            agent_dirs.append(archive_path)
```

**En in `_parse_session_file()`**, herken nieuwe archive path:

```python
# Na de huidige .deleted. check:
elif ".deleted." in file_path.name:
    session_id = session_id.split(".deleted.")[0]
    status = "deleted"
elif "archive" in str(file_path.parent.name):
    # v2026.2.17: sessions in archive/ folder
    status = "archived"
elif file_path.suffix == ".jsonl":
    status = "archived"
else:
    status = "unknown"
```

### Hoe testen

1. Laat OpenClaw maintenance pruning uitvoeren (of simuleer door handmatig een sessie te archiveren)
2. Controleer backend logs: `Session removed from active list: agent:...`
3. Controleer frontend: ghost session verdwijnt direct (session-removed event) i.p.v. na 30min
4. Test `kill_session()` via de "Kill" knop in CrewHub UI — verwacht: geen HTTP 500 meer voor al-gearchiveerde sessies
5. Controleer History view: gearchiveerde sessies uit archive/ folder zijn nu zichtbaar

---

## Iteratie 4: Tests + Validatie

### Handmatige integratietests

#### Test 1: Subagent announce routing (Issue 1)

**Setup:** Spawn een subagent die zelf een sub-subagent spawnt.
```
agent:main:main → spawnt → agent:main:subagent:AAA → spawnt → agent:main:subagent:BBB
```

**Checklist:**
- [ ] Sub-subagent BBB werkt → 3D World toont het actief
- [ ] BBB kondigt resultaat aan → parent AAA.updatedAt wordt gebumpt (controleer via [DIAG] logs)
- [ ] BBB.updatedAt wordt NIET gebumpt (controleer via [DIAG] stale-logging)
- [ ] BBB parkeert NIET binnen 2 minuten (grace window actief via Fix A)
- [ ] main agent (agent:main:main) toont "supervising" status (Fix B secondary check)
- [ ] main agent's BotActivityBubble toont NIET de tekst van BBB's resultaat (Fix C)
- [ ] Na 4 minuten totale inactiviteit: BBB parkeert wel (grace window expired)

#### Test 2: Ghost session preventie (Issue 2)

**Setup:** Laat OpenClaw een sessie archiveren via maintenance pruning.

**Checklist:**
- [ ] Backend log: `Session removed from active list: agent:...`
- [ ] SSE broadcast: `session-removed` event verzonden
- [ ] Frontend: sessie verdwijnt binnen 5s (bij volgende poll) + direct via session-removed event
- [ ] Sessie verschijnt NIET meer in 3D World of parking lot
- [ ] Sessie verschijnt WEL in History view (HistoryView.tsx)
- [ ] `kill_session()` op een al-gearchiveerde sessie: geeft HTTP 200 (not 500)

#### Test 3: Status-filter safeguard

**Setup:** Mock een sessions-refresh response met een sessie met `status: "archived"`.

```bash
# Test via /api/notify endpoint:
curl -X POST http://localhost:8091/api/notify \
  -H "Content-Type: application/json" \
  -d '{"type":"sessions-refresh","data":{"sessions":[{"key":"agent:test:subagent:ghost","status":"archived","updatedAt":1000000,"totalTokens":0}]}}'
```

**Checklist:**
- [ ] Frontend: sessie verschijnt NIET in 3D World of parking lot
- [ ] Backend (volgende poll): filtert de archived sessie uit de broadcast
- [ ] Backend: emits `session-removed` voor de archived sessie

### Unit Tests (optioneel maar aanbevolen)

#### `frontend/src/lib/minionUtils.test.ts` (nieuw bestand)

```typescript
describe('shouldBeInParkingLane - v2026.2.17 fixes', () => {
  test('subagent does not park if parent main recently updated', () => {
    const now = Date.now()
    const sessions = [
      { key: 'agent:dev:main', updatedAt: now - 30_000 },  // 30s ago
      { key: 'agent:dev:subagent:abc', updatedAt: now - 150_000 },  // 2.5min ago
    ]
    const subagent = sessions[1]
    // idleSeconds = 150, threshold = 120 → would normally park
    // But parent.updatedAt = 30s ago < grace window → should NOT park
    expect(shouldBeInParkingLane(subagent, false, 120, sessions)).toBe(false)
  })

  test('subagent parks normally when parent is also idle', () => {
    const now = Date.now()
    const sessions = [
      { key: 'agent:dev:main', updatedAt: now - 600_000 },  // 10min ago
      { key: 'agent:dev:subagent:abc', updatedAt: now - 300_000 },  // 5min ago
    ]
    const subagent = sessions[1]
    expect(shouldBeInParkingLane(subagent, false, 120, sessions)).toBe(true)
  })

  test('archived session is immediately parked', () => {
    const session = { key: 'agent:dev:subagent:abc', status: 'archived', updatedAt: Date.now() - 1000 }
    expect(shouldBeInParkingLane(session as any, false, 120, [])).toBe(true)
  })
})

describe('hasActiveSubagents - v2026.2.17 secondary check', () => {
  test('parent returns supervising when it recently got an announce-routed update', () => {
    const now = Date.now()
    const parent = { key: 'agent:dev:main', updatedAt: now - 10_000 }  // recently bumped by routing
    const child = { key: 'agent:dev:subagent:abc', updatedAt: now - 400_000 }  // 6.5min ago — stale
    const sessions = [parent, child]
    // Old logic: childAge > 5min → returns false (broken)
    // New logic: parent recently updated + has child → returns true (fixed)
    expect(hasActiveSubagents(parent, sessions)).toBe(true)
  })
})
```

#### `backend/test_poll_loop.py` (nieuw bestand)

```python
import asyncio
import pytest
from unittest.mock import AsyncMock, patch

async def test_session_removed_broadcast():
    """Test that session-removed events are emitted when sessions disappear."""
    # ...
    # Mock: first poll has session A, second poll doesn't
    # Assert: session-removed broadcasted for session A between polls
    pass

async def test_archived_sessions_filtered():
    """Test that sessions with status='archived' are filtered out."""
    # Mock sessions.list returning an archived session
    # Assert: sessions-refresh broadcast does NOT include the archived session
    pass
```

### Validatie checklist na implementatie

- [ ] Alle `[DIAG]` logs kunnen worden verwijderd uit productie (of achter feature flag)
- [ ] `SESSION_CONFIG.parkingIdleThresholdS * 2` grace window is config-wijzigbaar
- [ ] Backend `_INACTIVE_STATUSES` set is volledig (vraag OpenClaw docs voor alle mogelijke statuses)
- [ ] Archive folder pad (`archive/`) is correct voor OpenClaw v2026.2.17 (verifeer via filesystem na pruning)
- [ ] Performance: `shouldBeInParkingLane()` met parent-lookup is nog steeds O(n) max — acceptabel

---

## Risicomatrix

| Fix | Risk | Mitigatie |
|-----|------|-----------|
| Grace window in `shouldBeInParkingLane()` | Subagents parken te laat als ze echt klaar zijn | Grace window = 2x threshold (240s) — conservatief maar beperkt |
| `hasActiveSubagents()` secondary check | Parent toont "supervising" te lang | 60s grace window — kort genoeg |
| `_isLikelyAnnounceRouting()` heuristic | False positives: echte berichten gefilterd | Conservatieve patterns; verwijder als announce format duidelijk is |
| `_INACTIVE_STATUSES` backend filter | Nieuwe OpenClaw statuses missen | Log unrecognized statuses; uitbreiden na observatie |
| Archive folder support in history.py | Verkeerde folder gescand | Alleen als folder `archive` heet — specifiek genoeg |

---

## Bestandsoverzicht

| Bestand | Issue | Iteratie | Type wijziging |
|---------|-------|----------|----------------|
| `backend/app/main.py` | 1+2 | 1+3 | Diagnostiek + poll state tracking + filtered broadcast + session-removed events |
| `frontend/src/lib/minionUtils.ts` | 1+2 | 2+3 | `shouldBeInParkingLane()` parent-proxy; `hasActiveSubagents()` secondary check; `parseRecentActivities()` filter |
| `frontend/src/lib/sessionFiltering.ts` | 1+2 | 2+3 | `allSessions` doorgeven aan parking check; status hard-filter |
| `backend/app/services/connections/openclaw.py` | 2 | 3 | `kill_session()` multi-strategy + archive folder support |
| `backend/app/services/history.py` | 2 | 3 | Archive folder scanning; archive status herkenning |
| `frontend/src/hooks/useSessionsStream.ts` | 2 | 1 | Diagnostiek logging voor session-removed events |
| `frontend/src/lib/minionUtils.test.ts` | 1+2 | 4 | Nieuwe unit tests |

---

## Open vragen (verificeren na OpenClaw v2026.2.17 in productie)

1. **Welk pad gebruikt OpenClaw voor archived sessions?** → controleer `~/.openclaw/agents/{agent_id}/archive/` vs andere locaties
2. **Wat is de exacte `status` waarde voor archived sessions in sessions.list?** → `"archived"`, `"pruned"`, iets anders?
3. **Wat is het exacte format van announce-routing berichten in de parent's transcript?** → nodig voor `_isLikelyAnnounceRouting()` verfijning
4. **Bumpt OpenClaw de sub-subagent's `updatedAt` helemaal niet, of bumpt het zowel parent als subagent?** → als beide gebumpt worden, zijn Issue 1 fixes niet nodig

*Antwoorden op deze vragen bepalen of de fixes uit Iteratie 2 en 3 in hun huidige vorm correct zijn, of verder verfijnd moeten worden.*

---

*Plan opgesteld door Reviewer (GPT-5.2) subagent — 2026-02-18*
*Codebase versie: gecheckt op datum van analyse*
