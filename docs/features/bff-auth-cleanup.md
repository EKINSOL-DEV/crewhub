# BFF Auth Cleanup — Feature Plan

**Branch:** `feature/bff-auth-cleanup`  
**Status:** Planning / Review pending  
**Author:** Ekinbot (analysis by subagent)  
**Date:** 2026-02-17

---

## 1. Doel & Motivatie

CrewHub volgt een **Backend For Frontend (BFF)** architectuur waarbij:
- De browser **uitsluitend** met de CrewHub backend praat
- De CrewHub backend **server-side** de verbinding met de OpenClaw gateway beheert

Momenteel zijn er twee permissive flags in de OpenClaw config (`~/.openclaw/openclaw.json`) actief die éigenlijk niet nodig zouden mogen zijn:

```json
"controlUi": {
  "allowInsecureAuth": true,
  "dangerouslyDisableDeviceAuth": true
}
```

**Doel van deze cleanup:** de backend laten verbinden via proper device pairing + device token auth, zodat beide flags veilig verwijderd kunnen worden.

---

## 2. Huidige Situatie (As-Is)

### 2.1 Frontend → Backend

**✅ Goed geïmplementeerd.** De frontend maakt GEEN directe calls naar de OpenClaw gateway.

Alle frontend API-calls gaan via `/api/...` naar de CrewHub backend:
- `api.ts` → `fetch('/api/...')` — alle sessie/history calls naar backend
- `sseManager.ts` → `EventSource('http://localhost:8091/api/events')` — SSE via backend
- `ConnectionsView.tsx` → `fetch('/api/connections/...')` — connection management via backend
- `OpenClawWizard.tsx` → `testOpenClawConnection()` → `/api/onboarding/test-openclaw` — test via backend

**De browser praat nooit rechtstreeks met port 18789 (OpenClaw gateway).**

### 2.2 Backend → OpenClaw Gateway

**⚠️ Probleem hier.** De backend verbindt met de gateway via **token-only auth**, zonder device pairing.

In `backend/app/services/connections/openclaw.py`, method `_do_connect()`:

```python
connect_req = {
    "type": "req",
    "id": f"connect-{uuid.uuid4()}",
    "method": "connect",
    "params": {
        "client": {
            "id": "cli",
            "mode": "cli"           # ← presenteert zich als CLI client
        },
        "role": "operator",
        "auth": {"token": self.token} if self.token else {},  # ← alleen token, geen device
    }
}
```

**Wat ontbreekt:**
- Geen device identity aanmaken/ophalen
- Geen device keypair (Ed25519) bij de connect handshake
- De gateway verwacht bij `dangerouslyDisableDeviceAuth: false` dat de client een geregistreerd device is met een device token

### 2.3 Device Identity Code (aanwezig maar ongebruikt)

Er bestaat al een volledige implementatie in `backend/app/services/connections/device_identity.py`:
- `DeviceIdentity` — device keypair (Ed25519) + device token
- `DeviceIdentityManager` — CRUD in SQLite (`device_identities` tabel)
- `pair_device()` — volledige pairing flow met gateway

**Deze code wordt nergens aangeroepen.** De `OpenClawConnection._do_connect()` kent deze klasse niet.

### 2.4 OpenClaw Config Flags

In `~/.openclaw/openclaw.json`:

```json
"gateway": {
  "controlUi": {
    "allowInsecureAuth": true,           // laat token-only auth toe zonder device check
    "dangerouslyDisableDeviceAuth": true  // schakelt device authentication volledig uit
  },
  "auth": {
    "mode": "token",
    "token": "2330ce1b5e9ce27d7299f4628020df9ab5e08ff70c8a50f5"
  }
}
```

**Waarom actief:** zonder deze flags zou de gateway de huidige token-only verbinding weigeren omdat de backend geen geregistreerd device is.

---

## 3. Wat moet er veranderen (To-Be)

### 3.1 Backend: Device Pairing integreren in `OpenClawConnection`

De `_do_connect()` method in `openclaw.py` moet uitgebreid worden:

**Flow:**
1. Haal device identity op voor deze connection (`DeviceIdentityManager.get_or_create_device_identity()`)
2. Als device identity **geen device token** heeft → initieer pairing flow
3. Als device identity **wel een device token** heeft → gebruik dit in de `auth` parameter

**Connect request met device token:**
```python
connect_req = {
    "params": {
        "client": {
            "id": identity.device_id,
            "mode": "device"          # ← correct mode
        },
        "role": "operator",
        "auth": {
            "deviceToken": identity.device_token  # ← device token ipv gateway token
        }
    }
}
```

### 3.2 Backend: Pairing Flow afhandelen

Bij een **nieuwe verbinding zonder device token**:

1. Verbind met gateway (tijdelijk met gateway token als fallback)
2. Roep `pair_device()` aan met het nieuwe device identity
3. Sla het ontvangen `deviceToken` op in de DB
4. Herverbind met het device token

**Pairing request (wordt al gestuurd door `pair_device()`):**
```python
{
    "method": "devices.pair",
    "params": {
        "deviceId": identity.device_id,
        "publicKey": identity.get_public_key_pem(),
        "name": "CrewHub-<connection_id>",
        "platform": "crewhub"
    }
}
```

### 3.3 Backend: Config aanpassen

In de connections DB of `.env`:
- Het gateway token blijft beschikbaar voor de **initiële pairing** (eenmalig)
- Na pairing wordt het `deviceToken` primair gebruikt
- Het gateway token kan optioneel blijven als fallback

### 3.4 OpenClaw Config: flags verwijderen

Na succesvolle implementatie:

```json
// VERWIJDEREN:
"allowInsecureAuth": true,
"dangerouslyDisableDeviceAuth": true
```

De gateway accepteert dan alleen nog verbindingen van **gepaard devices**.

---

## 4. Stap-voor-stap Implementatieplan

### Stap 1: `OpenClawConnection._do_connect()` uitbreiden

**Bestand:** `backend/app/services/connections/openclaw.py`

Aanpassen van `_do_connect()`:

```python
async def _do_connect(self) -> bool:
    # 1. Haal/maak device identity
    from .device_identity import DeviceIdentityManager
    identity_manager = DeviceIdentityManager()
    identity = await identity_manager.get_or_create_device_identity(
        connection_id=self.connection_id,
        device_name=f"CrewHub-{self.name}"
    )
    
    # 2. Maak WebSocket verbinding
    self.ws = await websockets.connect(self.uri, ...)
    
    # 3. Ontvang challenge
    challenge = await self.ws.recv()
    
    # 4. Als geen device token → pairing flow
    if not identity.device_token:
        success = await identity_manager.pair_device(identity, self.ws)
        if not success:
            # Fallback: probeer met gateway token (tijdelijk, voor backwards compat)
            logger.warning("Pairing failed, falling back to token auth")
    
    # 5. Bouw connect request
    auth = {}
    if identity.device_token:
        auth = {"deviceToken": identity.device_token}
    elif self.token:
        auth = {"token": self.token}  # tijdelijke fallback
    
    connect_req = {
        "params": {
            "client": {
                "id": identity.device_id if identity.device_token else "cli",
                "mode": "device" if identity.device_token else "cli",
                "version": "1.0.0",
                "platform": "crewhub",
            },
            "role": "operator",
            "scopes": ["operator.read", "operator.write", "operator.admin"],
            "auth": auth,
        }
    }
    # ... rest van connect flow
```

### Stap 2: Pairing UI/feedback in backend routes

**Bestand:** `backend/app/routes/connections.py`

Voeg een endpoint toe om pairing status op te vragen:

```
GET  /api/connections/{id}/device-status
POST /api/connections/{id}/pair         ← handmatig re-pairen triggeren
```

Geeft terug:
```json
{
  "device_id": "uuid",
  "paired": true,
  "device_name": "CrewHub-my-connection",
  "paired_at": 1708000000
}
```

### Stap 3: Pairing feedback in frontend (optioneel, nice-to-have)

**Bestand:** `frontend/src/components/sessions/ConnectionsView.tsx`

Toon in de connection card:
- "🔑 Paired" badge als device token aanwezig
- "⚠️ Not paired" badge als geen device token
- Knop "Pair Device" om pairing handmatig te starten

### Stap 4: Test de volledige flow

1. Verwijder device identity uit DB (of maak nieuwe connection)
2. Start backend
3. Check dat pairing automatisch plaatsvindt (logs)
4. Check dat gateway het device accepteert

### Stap 5: OpenClaw config cleanup

Na verificatie dat alles werkt:

```bash
# In ~/.openclaw/openclaw.json:
# Verwijder:
#   "allowInsecureAuth": true
#   "dangerouslyDisableDeviceAuth": true

openclaw gateway restart
```

Test dat CrewHub backend nog steeds verbindt.

### Stap 6: Optioneel — gateway token verwijderen uit config

Als de pairing volledig werkt, is het gateway token niet meer nodig voor de dagelijkse verbinding. Het kan verwijderd worden uit de `.env` van CrewHub (het staat dan alleen nog in `~/.openclaw/openclaw.json` voor de gateway zelf).

---

## 5. Risico's & Aandachtspunten

### 5.1 Pairing vereist gateway approval

De OpenClaw gateway kan pairing requests vereisen dat een beheerder ze goedkeurt (afhankelijk van config). Controleer of:
- `devices.pair` automatisch goedgekeurd wordt bij token-auth
- Of er een `devices.approve` flow nodig is

### 5.2 Herconnect na token-expiry

Device tokens kunnen verlopen. De `_schedule_reconnect()` logica moet ook het geval afhandelen waarbij een device token geweigerd wordt → nieuwe pairing starten.

**Aanbeveling:** bij een `401 DEVICE_TOKEN_INVALID` error → clear device token → herstart connect flow → re-pair.

### 5.3 Backwards compat tijdens transitie

Tijdens implementatie: houd `allowInsecureAuth: true` aan totdat de nieuwe flow volledig werkt. Verwijder de flags pas in stap 5, niet eerder.

### 5.4 Device identity in DB vs per-connection

Momenteel is `DeviceIdentityManager` per `connection_id`. Dit is correct — elke CrewHub connection naar een gateway heeft zijn eigen device identity.

### 5.5 `pair_device()` timing in `_do_connect()`

De huidige `pair_device()` verwacht een open WebSocket waarop het zelf stuurt en recv doet. Dit botst met de `_listen_loop()` die ook recv doet. Oplossing: pairing afhandelen **vóór** de listen loop start (wat al het geval is in `_do_connect()`).

---

## 6. Bestanden die wijzigen

| Bestand | Type wijziging |
|---------|---------------|
| `backend/app/services/connections/openclaw.py` | **Core** — device identity integreren in `_do_connect()` |
| `backend/app/routes/connections.py` | **Minor** — device status endpoint toevoegen |
| `~/.openclaw/openclaw.json` | **Config** — flags verwijderen (na verificatie) |
| `backend/app/services/connections/device_identity.py` | Geen wijziging — code is al compleet |
| `frontend/src/components/sessions/ConnectionsView.tsx` | **Optional** — pairing status UI |

---

## 7. Welke OpenClaw flags worden verwijderd

Na succesvolle implementatie:

| Flag | Locatie | Verwijderd wanneer |
|------|---------|-------------------|
| `dangerouslyDisableDeviceAuth: true` | `~/.openclaw/openclaw.json` → `gateway.controlUi` | Stap 5: na verificatie working device auth |
| `allowInsecureAuth: true` | `~/.openclaw/openclaw.json` → `gateway.controlUi` | Stap 5: samen met bovenstaande |

**Resultaat:** de gateway accepteert alleen nog verbindingen van gepaard devices met geldige device tokens. Token-only auth wordt geweigerd.

---

## 8. Definitie van Done

- [ ] Backend verbindt met gateway via device token (na auto-pairing bij eerste connect)
- [ ] Device identity wordt opgeslagen in SQLite en hergebruikt bij herstart
- [ ] Gateway logs tonen "device connected" (niet "legacy token auth")
- [ ] `dangerouslyDisableDeviceAuth` verwijderd uit openclaw.json
- [ ] `allowInsecureAuth` verwijderd uit openclaw.json
- [ ] Gateway restart na config change → CrewHub backend verbindt nog steeds
- [ ] Geen directe gateway calls vanuit de browser (was al correct)

---

*Dit document wordt bijgehouden in `docs/features/bff-auth-cleanup.md` op branch `feature/bff-auth-cleanup`.*
