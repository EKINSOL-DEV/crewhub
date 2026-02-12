# API Key System — Implementation Plan

> **Version:** 1.0 (Iteration 1)
> **Date:** 2026-02-12

---

## Phase 1: Harden Existing System (3-5 days)

**Goal:** Production-ready security for the existing API key system.

### Backend Changes

- [ ] **Increase key entropy:** Change `token_hex(12)` → `token_hex(16)` (128 bits)
- [ ] **New key format:** `ch_live_{hex32}` and `ch_test_{hex32}`
- [ ] **Add `expires_at` column** to `api_keys` table (nullable INTEGER, unix ms)
- [ ] **Expiration check** in `resolve_api_key()` — reject expired keys
- [ ] **Add rate limiting** via `slowapi`:
  ```python
  pip install slowapi
  ```
  - Rate limit per API key ID
  - Configurable limits per scope tier
- [ ] **Migration script** for existing keys (backward compatible — old format still works)

### Code Changes

```python
# auth.py — updated key format
def generate_api_key(environment: str = "live") -> str:
    random_part = secrets.token_hex(16)  # 128 bits
    return f"ch_{environment}_{random_part}"

# auth.py — expiration check in resolve_api_key()
if row["expires_at"] and row["expires_at"] < int(time.time() * 1000):
    return None  # Expired
```

```python
# main.py — rate limiting setup
from slowapi import Limiter
from slowapi.util import get_remote_address

def get_key_id(request: Request) -> str:
    key = request.headers.get("X-API-Key", "")
    return hash_key(key)[:16] if key else get_remote_address(request)

limiter = Limiter(key_func=get_key_id)
app.state.limiter = limiter
```

### Database Migration

```sql
ALTER TABLE api_keys ADD COLUMN expires_at INTEGER;
ALTER TABLE api_keys ADD COLUMN environment TEXT DEFAULT 'live';
```

---

## Phase 2: Audit Logging (2-3 days)

- [ ] Create `api_key_usage` table
- [ ] FastAPI middleware to log all authenticated requests
- [ ] Log rotation: delete entries older than 90 days (cron job)
- [ ] Admin endpoint: `GET /api/auth/keys/{key_id}/usage`

```python
# middleware
@app.middleware("http")
async def audit_log_middleware(request: Request, call_next):
    response = await call_next(request)
    key_info = getattr(request.state, "api_key_info", None)
    if key_info:
        await log_api_usage(key_info.key_id, request, response.status_code)
    return response
```

---

## Phase 3: Frontend UI (3-5 days)

### Settings → API Keys Tab

**Components needed:**

1. **APIKeysPage** — main settings tab
2. **CreateKeyDialog** — modal for creating new key
3. **KeyCreatedDialog** — shows raw key once (copy to clipboard)
4. **KeyListTable** — list all keys with actions

**UI Flow:**

```
Settings → API Keys
┌─────────────────────────────────────────────────────┐
│  API Keys                          [+ Create Key]   │
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │ Name         │ Scopes    │ Created  │ Last Used ││
│  │──────────────│───────────│──────────│───────────││
│  │ Production   │ admin     │ Feb 12   │ 2m ago    ││
│  │ ch_live_a1.. │           │          │ [Revoke]  ││
│  │──────────────│───────────│──────────│───────────││
│  │ Agent Alpha  │ read,self │ Feb 10   │ 5h ago    ││
│  │ ch_live_b2.. │           │          │ [Revoke]  ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

**Create Key Dialog:**
```
┌──────────────────────────────────┐
│  Create API Key                  │
│                                  │
│  Name: [My Integration      ]   │
│                                  │
│  Scopes:                         │
│  ☑ read    ☑ self               │
│  ☐ manage  ☐ admin              │
│                                  │
│  Expires: [90 days ▼]           │
│                                  │
│       [Cancel]  [Create Key]     │
└──────────────────────────────────┘
```

**Key Created Dialog (shown once):**
```
┌──────────────────────────────────┐
│  ✅ API Key Created              │
│                                  │
│  Copy this key now — it won't   │
│  be shown again.                 │
│                                  │
│  ┌────────────────────────────┐  │
│  │ ch_live_a1b2c3d4e5f6...   │  │
│  └────────────────────────────┘  │
│             [📋 Copy]            │
│                                  │
│           [Done]                 │
└──────────────────────────────────┘
```

---

## Phase 4: Key Rotation & Advanced (1-2 weeks, optional)

- [ ] Key rotation: create new key, grace period for old key, auto-revoke
- [ ] Webhook signing keys (HMAC-SHA256)
- [ ] Per-organization keys (when multi-tenancy is added)
- [ ] API key scoping to specific endpoints (granular permissions)
- [ ] IP allowlist per key

---

## Effort Summary

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Harden | 3-5 days | **P0** (before SaaS launch) |
| Phase 2: Audit | 2-3 days | **P1** (before public beta) |
| Phase 3: Frontend UI | 3-5 days | **P1** |
| Phase 4: Advanced | 1-2 weeks | **P2** (post-launch) |
| **Total** | **2-4 weeks** | |
