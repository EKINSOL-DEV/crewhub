# Code Review Feedback — OpenClaw v2026.2.17 Fixes
## CrewHub commit `9668c14` — branch `develop`

**Reviewer:** GPT-5.2 (Reviewer agent)  
**Datum:** 2026-02-18  
**Op basis van plan:** `docs/openclaw-v2026217-impact-plan.md`  
**Bestanden gereviewed:** 8 bestanden, +1217 / -33 regels

---

## TL;DR Eindoordeel

> **⚠️ Bijna klaar voor merge — 1 kritiek issue moet eerst gefixed worden.**  
> De implementatie dekt ~90% van het plan correct en voegt waardevolle defensieve lagen toe.  
> Er is echter een kleine memory leak in de poll loop die voor productie gefixed moet worden.  
> Iteratie 2-problemen (overly broad sibling check, heuristic patterns) zijn acceptabel voor iteratie 1.

---

## Plan vs Implementatie Coverage

| Iteratie | Wat gepland | Status |
|----------|-------------|--------|
| **Iteratie 1** — Diagnostiek | DIAG logs backend + frontend | ✅ Volledig geïmplementeerd |
| **Iteratie 2** — Issue 1 fixes | `shouldBeInParkingLane` grace window, `hasActiveSubagents` secondary check, `_isLikelyAnnounceRouting` filter, `allSessions` doorgeven | ✅ Volledig geïmplementeerd |
| **Iteratie 3** — Issue 2 fixes | Status filtering, `session-removed` events, `kill_session` multi-strategy, `history.py` archive support | ✅ Volledig geïmplementeerd |
| **Iteratie 4** — Tests | Unit tests voor `shouldBeInParkingLane` en `hasActiveSubagents` | ❌ Niet geïmplementeerd |

---

## Issues gevonden

### 🔴 KRITIEK — Fix vóór merge

#### 1. Memory leak in `_poll_stale_count` en `_poll_prev_updatedAt`

**Locatie:** `backend/app/main.py`, `poll_sessions_loop()`

**Probleem:** Wanneer een sessie verdwijnt uit `active_dicts`, wordt het key correct gedetecteerd als "removed" en `session-removed` gebroadcast. Maar de twee tracking dicts worden NIET opgeruimd:

```python
for removed_key in removed_keys:
    logger.info(f"[POLL] Session removed from active list: {removed_key}")
    await broadcast("session-removed", {"key": removed_key})
    # ← ONTBREEKT: cleanup van _poll_stale_count en _poll_prev_updatedAt
```

`_poll_stale_count.pop(key, None)` wordt alleen aangeroepen als `updated_at != prev_updated_at` voor keys die nog in `active_dicts` zitten. Verwijderde keys worden nooit gecleanup.

Over tijd (bij een long-running instantie met veel subagent turnover) groeien beide dicts onbeperkt. Niet acuut, maar wel een productierisico.

**Fix (2 regels):**
```python
for removed_key in removed_keys:
    logger.info(f"[POLL] Session removed from active list: {removed_key}")
    await broadcast("session-removed", {"key": removed_key})
    _poll_stale_count.pop(removed_key, None)       # ← toevoegen
    _poll_prev_updatedAt.pop(removed_key, None)    # ← toevoegen
```

---

### 🟡 MEDIUM — Aanbevolen voor iteratie 2

#### 2. Sibling subagent check te breed

**Locatie:** `frontend/src/lib/minionUtils.ts`, `shouldBeInParkingLane()`, regel ~395-410

**Probleem:** De `recentSiblingOrParent` check voorkomt parking van een subagent als ENIGE andere sibling subagent onlangs geüpdatet is — ook al zijn die siblings volledig ongerelateeerd aan de te parken sessie:

```typescript
// Als agent:dev:subagent:AAA actief is,
// wordt agent:dev:subagent:BBB (al lang klaar) ook NIET geparkeerd
const recentSiblingOrParent = allSessions.some(s => {
  if (s.key === session.key) return false
  const sParts = s.key.split(":")
  return sParts[1] === agentId &&
    (sParts[2]?.includes("subagent") || sParts[2]?.includes("spawn")) &&
    (Date.now() - s.updatedAt) < ANNOUNCE_ROUTING_GRACE_MS
})
```

**Impact:** In een drukke setup met meerdere concurrent subagents per agent, worden idle subagents 4 minuten te lang in het hoofdscherm gehouden. Dit kan visueel rommelig worden.

**Suggestie:** De parent-main check is waarschijnlijk voldoende zonder de sibling check. De sibling check toevoegen als tweede vangnet is overcorrectief. Overweeg de sibling check te verwijderen en alleen op de parent main session te vertrouwen:

```typescript
// Alleen parent main check (geen sibling check) — minder false positives
if (parentMainSession) {
  const parentAge = Date.now() - parentMainSession.updatedAt
  if (parentAge < ANNOUNCE_ROUTING_GRACE_MS) {
    return false
  }
}
// Geen recentSiblingOrParent check meer
```

#### 3. `_isLikelyAnnounceRouting()` heuristic waarschijnlijk dode code

**Locatie:** `frontend/src/lib/minionUtils.ts`, functie `_isLikelyAnnounceRouting()`

**Probleem:** De patronen zijn geraden zonder kennis van het exacte OpenClaw announce format:
```typescript
return (
  text.startsWith("[Subagent result]") ||
  text.startsWith("[Agent completed]") ||
  text.startsWith("[announce]") ||
  /^(Subagent|Sub-agent)\s+\S+\s+(completed|finished|done)/i.test(text)
)
```

Als het echte format niet overeenkomt (bijv. als het `[subagent:announce]` of `Result from subagent` is), filtert deze functie nooit iets. Omgekeerd, als een gebruiker toevallig een bericht stuurt dat begint met `[Subagent result]`, wordt dat gefilterd uit de activiteitsweergave — false positive.

**Advies:** De functie is conservatief genoeg om nu te mergen (weinig kans op schadelijke false positives). Maar **valideer actief** met echte announce-routing berichten zodra ze optreden. Voeg een `console.warn` toe als een patroon matcht, zodat het in dev snel opvalt:

```typescript
function _isLikelyAnnounceRouting(text: string): boolean {
  const matched = (
    text.startsWith("[Subagent result]") ||
    text.startsWith("[Agent completed]") ||
    text.startsWith("[announce]") ||
    /^(Subagent|Sub-agent)\s+\S+\s+(completed|finished|done)/i.test(text)
  )
  if (matched && import.meta.env.DEV) {
    console.warn("[DIAG] _isLikelyAnnounceRouting matched:", text.slice(0, 80))
  }
  return matched
}
```

#### 4. `hasActiveSubagents()` secondary check — false positive scenario

**Locatie:** `frontend/src/lib/minionUtils.ts`, `hasActiveSubagents()`

**Probleem:** De secondary check keert `true` terug als:
1. Parent session's `updatedAt` < 60s geleden, EN
2. Er zijn ENIGE child sessions (ook als die al lang klaar zijn)

```typescript
const SUPERVISING_GRACE_MS = 60_000
const thisSessionAge = now - (session.updatedAt || 0)
if (thisSessionAge < SUPERVISING_GRACE_MS) {
  const hasAnyChild = allSessions.some(s => ...)  // geen updatedAt check
  if (hasAnyChild) return true
}
```

Als een parent agent een heartbeat ontvangt (updatedAt recent) terwijl hij nog oude, afgeronde subagent-sessies heeft (die nog niet uit parking zijn verdwenen), zal hij foutief "supervising" tonen.

**Impact:** Kortstondig (max 60s), maar visueel misleidend. 60s window is acceptabel voor V1.

**Suggestie voor V2:** Combineer een minimum childAge check:
```typescript
const hasAnyChild = allSessions.some(s => {
  if (s.key === key) return false
  const childParts = s.key.split(":")
  if (!childParts.length >= 3 || childParts[1] !== agentId) return false
  if (!childParts[2]?.includes("subagent") && !childParts[2]?.includes("spawn")) return false
  // Child moet ook relatief recent zijn geweest (bijv. < 10min)
  const childAge = now - s.updatedAt
  return childAge < SESSION_CONFIG.statusActiveThresholdMs * 2  // < 10min
})
```

#### 5. Grace window van 240s kan te lang zijn bij veel parallelle subagents

**Locatie:** `frontend/src/lib/minionUtils.ts`, `shouldBeInParkingLane()`

```typescript
const ANNOUNCE_ROUTING_GRACE_MS = SESSION_CONFIG.parkingIdleThresholdS * 1000 * 2  // = 240s
```

**Impact:** In een setup met 5+ parallelle subagents die snel achter elkaar klaar komen, worden afgeronde subagents tot 4 minuten in het hoofdscherm gehouden (als parent main onlangs geüpdated is). Dit kan het hoofdscherm onnodig vol maken.

**Overweging:** 240s (2× threshold) is de veiligste keuze maar mogelijk overcorrectief. 180s (1.5× threshold) zou ook verdedigbaar zijn. Dit is echter een tuning-vraag die beter beantwoord kan worden na echte observatie in productie. Voor nu is 240s conservatief maar acceptabel.

**Suggestie:** Maak de grace multiplier een aparte config waarde:
```typescript
// In sessionConfig.ts:
announceRoutingGraceMultiplier: 2,  // × parkingIdleThresholdS
```

---

### 🟢 MINOR — Nice-to-have

#### 6. `console.log` in productie (niet `console.debug`)

**Locatie:** `frontend/src/hooks/useSessionsStream.ts`

```typescript
// PROBLEEM: console.log verschijnt altijd, ook in productie!
console.log(`[DIAG] session-removed event received for key: ${key}`)
```

Alle andere DIAG logs in `minionUtils.ts` gebruiken correct `console.debug` achter een `import.meta.env.DEV` guard. Deze enige `console.log` wordt gefilterd in dev-tools maar NIET weggecompileerd in productie.

**Fix:**
```typescript
if (import.meta.env.DEV) {
  console.debug(`[DIAG] session-removed event received for key: ${key}`)
}
```

#### 7. `_INACTIVE_STATUSES` is mogelijk onvolledig

**Locatie:** `backend/app/main.py`

```python
_INACTIVE_STATUSES = frozenset({"archived", "pruned", "completed", "deleted", "ended"})
```

OpenClaw v2026.2.17 kan mogelijk ook `"killed"`, `"failed"`, `"error"`, `"cancelled"`, `"stopped"` retourneren. De `[DIAG]` warning log vangt onbekende statussen op, maar filtert ze NIET. Als OpenClaw bijv. `"killed"` terugstuurt, zou zo'n sessie alsnog in de frontend-broadcast terechtkomen.

**Advies:** Na observatie in productie met de DIAG logs, uitbreiden naar:
```python
_INACTIVE_STATUSES = frozenset({
    "archived", "pruned", "completed", "deleted", "ended",
    "killed", "failed", "error", "cancelled", "stopped",
})
```

#### 8. `shouldBeInParkingLane` dubbel aangeroepen per sessie

**Locatie:** `frontend/src/lib/sessionFiltering.ts`

```typescript
const visibleFilter = activeSessions.filter(
  s => !shouldBeInParkingLane(s, isActivelyRunning(s.key), idleThreshold, activeSessions),
)
const parkingFilter = activeSessions.filter(
  s => shouldBeInParkingLane(s, isActivelyRunning(s.key), idleThreshold, activeSessions),
)
```

De functie wordt 2× aangeroepen per sessie per render cycle. Elke aanroep doet `allSessions.find(...)` — O(n) per sessie. Totaal O(n²) per render. Niet problematisch bij de huidige schaal (< 30 sessies), maar valt op.

**Eenvoudige fix:** Bereken eenmalig:
```typescript
const parkingSet = new Set(
  activeSessions
    .filter(s => shouldBeInParkingLane(s, isActivelyRunning(s.key), idleThreshold, activeSessions))
    .map(s => s.key)
)
const visibleFilter = activeSessions.filter(s => !parkingSet.has(s.key))
const parkingFilter = activeSessions.filter(s => parkingSet.has(s.key))
```

#### 9. Geen unit tests (Iteratie 4 overgeslagen)

**Impact:** Regressions in `shouldBeInParkingLane` en `hasActiveSubagents` zullen handmatig getest moeten worden. Het plan had concrete test cases gespecificeerd — die zijn waardevol.

**Advies:** Na merge, in volgende sprint unit tests toevoegen voor de grace window logica. Minimaal:
- Subagent parkeert NIET als parent main recent geüpdated (grace window actief)
- Subagent parkeert WEL als parent main ook oud is
- Archived status → direct parken
- `hasActiveSubagents()` secondary check: parent recent + heeft kind → supervising

---

## Positieve observaties

### ✅ Pre-existing bug gefixed (grote vangst!)

**Locatie:** `backend/app/services/history.py`, `_parse_session_file()`

**Originele (buggy) code:**
```python
agent_id = file_path.parent.name  # → altijd "sessions"!
```

Als het pad `~/.openclaw/agents/dev/sessions/abc.jsonl` is, was `file_path.parent.name` = `"sessions"` — waardoor ALLE history items `agent_id = "sessions"` kregen. De history view werkte daardoor nooit correct voor sessies in een `sessions/` submap. De fix is correct:

```python
parent_name = file_path.parent.name
if parent_name in ("sessions", "archive"):
    agent_id = file_path.parent.parent.name  # correct!
else:
    agent_id = parent_name  # fallback
```

### ✅ Defensieve gelaagdheid voor ghost session preventie

De fix voor Issue 2 heeft drie correcte verdedigingslagen:
1. **Backend** filtert voor broadcast (`active_dicts` met `_INACTIVE_STATUSES`)
2. **`splitSessionsForDisplay`** hard-filtert op `ACTIVE_STATUSES.has(s.status)`
3. **`shouldBeInParkingLane`** parkeert direct als `rawStatus` niet-actief is

Dit is defense-in-depth zoals het hoort.

### ✅ `kill_session()` is nu idempotent

Strategy 1 (sessie niet meer in actieve lijst → return True) maakt de operatie idempotent. Een "Kill" op een al-gearchiveerde sessie geeft geen HTTP 500 meer. Correcte UX-verbetering.

### ✅ `session-removed` events nu eindelijk functioneel

De frontend had al een `handleSessionRemoved` handler — maar die werd nooit getriggerd omdat de backend nooit het event stuurde. Nu is dat gesloten. Clean architectuurherstel.

### ✅ `status?: string` in `CrewSession` interface

De optionele `status` toevoegen aan de interface is de juiste manier — geen type castings nodig, expliciete documentatie van verwachte waarden.

### ✅ DIAG logs zijn nuttig en goed gestuurd

De `[DIAG]` en `[POLL]` prefixes zijn consistent. Backend logs zijn altijd zichtbaar (niet achter DEV guard — terecht, want je wilt ze ook in staging/productie bij problemen). Frontend logs zijn correct achter `import.meta.env.DEV` — ze verschijnen nooit in productie builds (uitzondering: punt #6 hierboven).

De stale-updatedAt detectie (6 polls = ~30s) is een slimme manier om Issue 1 te observeren zonder overmatig te loggen.

### ✅ Grace windows zijn defensief maar niet overdreven

- `ANNOUNCE_ROUTING_GRACE_MS = 240s` (2× threshold) — veilig
- `SUPERVISING_GRACE_MS = 60s` — kort genoeg om snel te herstellen

---

## Samenvatting per bestand

| Bestand | Kwaliteit | Opmerkingen |
|---------|-----------|-------------|
| `backend/app/main.py` | 🟡 Goed, 1 fix nodig | Memory leak in `_poll_stale_count`/`_poll_prev_updatedAt` bij removed sessions |
| `backend/app/services/connections/openclaw.py` | ✅ Uitstekend | Multi-strategy kill_session is clean en idempotent |
| `backend/app/services/history.py` | ✅ Uitstekend | Pre-existing bug gefixed + archive folder support — solide |
| `frontend/src/hooks/useSessionsStream.ts` | 🟡 Goed, 1 minor | `console.log` → `console.debug` |
| `frontend/src/lib/minionUtils.ts` | 🟡 Goed, 2 verbeterpunten | Sibling check te breed; heuristic patronen niet gevalideerd |
| `frontend/src/lib/sessionFiltering.ts` | ✅ Goed | Dubbele aanroep is minor; logica correct |
| `frontend/src/lib/api.ts` | ✅ Uitstekend | Correct en goed gedocumenteerd |

---

## Vereiste actie voor merge

### Blocker (moet gefixed vóór merge):

**1. Memory leak fix in `backend/app/main.py`:**
```python
# In de removed_keys loop, voeg toe:
for removed_key in removed_keys:
    logger.info(f"[POLL] Session removed from active list: {removed_key}")
    await broadcast("session-removed", {"key": removed_key})
    _poll_stale_count.pop(removed_key, None)    # ← TOEVOEGEN
    _poll_prev_updatedAt.pop(removed_key, None)  # ← TOEVOEGEN
```

### Aanbevolen (kan ook in iteratie 2):

2. `console.log` → `console.debug` + DEV guard in `useSessionsStream.ts`  
3. `_isLikelyAnnounceRouting()` voorzien van DEV console.warn bij match  
4. Sibling subagent check evalueren na eerste productieobservaties  
5. Unit tests schrijven (Iteratie 4 uit plan)

---

## Open vragen (ongewijzigd uit plan)

Deze zijn niet beantwoord in de implementatie en moeten nog geobserveerd worden in productie:

1. **Exact `status` waarden** die OpenClaw v2026.2.17 retourneert → uitbreiden `_INACTIVE_STATUSES` na eerste DIAG logs
2. **Exact format van announce-routing berichten** in parent transcript → verfijnen `_isLikelyAnnounceRouting()` patronen
3. **Wordt sub-subagent's `updatedAt` écht niet gebumpt?** → bevestigen via `[DIAG] updatedAt stale` logs
4. **Exact pad van archive folder** → verifieren dat `archive/` correct is voor OpenClaw v2026.2.17 filesystem

---

*Review geschreven door Reviewer (GPT-5.2) subagent — 2026-02-18*  
*Codebase: commit `9668c14`, branch `develop`, `~/ekinapps/crewhub/`*
