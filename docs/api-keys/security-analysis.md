# API Key Security Analysis — CrewHub

> **Version:** 1.0 (Iteration 1)
> **Date:** 2026-02-12

---

## 1. Current State Assessment

CrewHub **already has a functional API key system** (`backend/app/auth.py`). Here's what exists:

### ✅ Already Implemented
- Key generation: `chk_{scope}_{random_hex_24chars}` format
- SHA-256 hashing (keys stored as hashes, never plaintext)
- 4-level hierarchical scopes: `read < self < manage < admin`
- FastAPI dependency injection: `require_scope("admin")`
- Key prefix storage for identification
- CRUD routes: create, list, revoke (soft delete)
- `X-API-Key` header authentication
- `last_used_at` tracking
- Identity creation rate limiting (10/hour/key)
- Agent identity binding (key → agent_id)
- Default key generation on first startup

### ❌ Missing for SaaS Production
- **No key expiration** (no `expires_at` field)
- **No per-key rate limiting** (only identity creation is rate-limited)
- **No audit log** (only `last_used_at`, no request history)
- **SHA-256 hashing** (fast — should use Argon2 or PBKDF2 for production)
- **No key rotation** mechanism
- **No organization/user binding** (keys are global or agent-bound)
- **No frontend UI** for key management
- **No webhook signing keys**

---

## 2. Security Recommendations

### 2.1 Hashing Algorithm

**Current:** SHA-256 (fast, vulnerable to brute-force if DB is leaked)

**Recommendation:** Keep SHA-256 but **increase key entropy**.

**Rationale:** API keys are high-entropy random tokens (not human-chosen passwords). With 24 hex chars (96 bits of entropy), brute-force is infeasible even with SHA-256. Argon2/bcrypt add latency to every API request (~100ms vs ~0.01ms) without meaningful security benefit for high-entropy tokens.

**Industry precedent:** Stripe, GitHub, AWS all use fast hashes (SHA-256/HMAC) for API keys. Slow hashes are for passwords.

**Action:** Increase key length from 24 to 32 hex chars (128 bits), keep SHA-256.

### 2.2 Key Format

**Current:** `chk_{scope}_{hex24}` — e.g., `chk_admin_a1b2c3d4e5f6a1b2c3d4e5f6`

**Recommendation:** Adopt Stripe-like format for better identification:

```
ch_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6    # Production key
ch_test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6    # Test/sandbox key
```

- **Prefix `ch_`** — identifies CrewHub keys in logs/configs
- **Environment `live_`/`test_`** — prevents accidental use of test keys in production
- **32 hex chars** — 128 bits of entropy
- **Total length:** ~42 chars (prefix + 32 hex)

**Benefits:**
- Grep-able in logs (`grep ch_live_`)
- Secret scanning tools can detect leaked keys
- Users immediately know which environment a key belongs to

### 2.3 Key Expiration

**Add `expires_at` column** with configurable defaults:

| Key Type | Default Expiration | Max Allowed |
|----------|-------------------|-------------|
| Agent keys (self) | 365 days | Never |
| Admin keys | 90 days | 365 days |
| Read-only | 365 days | Never |
| CI/CD keys | 30 days | 90 days |

Allow `expires_at = NULL` for non-expiring keys (with admin approval).

### 2.4 Rate Limiting

**Recommendation:** `slowapi` (FastAPI-native, wraps `limits` library)

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_api_key_id)  # Rate limit per API key

@app.get("/api/agents")
@limiter.limit("100/minute")
async def list_agents(request: Request):
    ...
```

**Tiers:**
| Scope | Rate Limit |
|-------|-----------|
| read | 60 req/min |
| self | 120 req/min |
| manage | 300 req/min |
| admin | 600 req/min |

**Storage:** In-memory for single-server, Redis for multi-server SaaS.

### 2.5 Audit Log

New `api_key_usage` table for tracking:

```sql
CREATE TABLE api_key_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (key_id) REFERENCES api_keys(id)
);
```

**Important:** Only log metadata, never request/response bodies. Rotate logs after 90 days.

### 2.6 Organization vs User Keys

**Recommendation for SaaS:** Per-organization with user attribution.

```
Organization (CrewHub instance)
├── Owner (admin)
│   ├── API Key: "Production Admin" (admin scope)
│   └── API Key: "CI Pipeline" (manage scope)
├── Member (developer)
│   ├── API Key: "Dev Key" (self scope)
│   └── API Key: "Read Dashboard" (read scope)
└── Agent (bot)
    └── API Key: "Agent Alpha" (self scope, bound to agent_id)
```

This can be added later. For now, keep the current model (keys are global/agent-bound) and add `user_id` + `org_id` columns when multi-tenancy is implemented.

### 2.7 Webhook Signing Keys

**For later.** When CrewHub needs to send webhooks (e.g., "session completed"), use HMAC-SHA256 signing:

```python
import hmac, hashlib

def sign_webhook(payload: bytes, secret: str) -> str:
    return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()

# Header: X-CrewHub-Signature: sha256=<hex>
```

Not needed for MVP. Add when webhook feature is built.

---

## 3. Library Evaluation

| Library | Purpose | Verdict | Notes |
|---------|---------|---------|-------|
| `secrets` (stdlib) | Token generation | ✅ **Use** | Already using, perfect for API keys |
| `hashlib` (stdlib) | SHA-256 hashing | ✅ **Keep** | Sufficient for high-entropy tokens |
| `passlib` + Argon2 | Slow hashing | ❌ **Skip** | Overkill for API keys, adds latency |
| `slowapi` | Rate limiting | ✅ **Add** | FastAPI-native, easy integration |
| `authlib` | JWT-based keys | ❌ **Skip** | JWT adds complexity, opaque tokens are simpler |
| `pydantic` | Models | ✅ **Already using** | For request/response validation |
| `keyring` (Rust) | OS keychain | ✅ **Use in Tauri** | For desktop app secure storage |

---

## 4. Threat Model

| Threat | Severity | Current Mitigation | Needed |
|--------|----------|-------------------|--------|
| Key leaked in logs | High | Prefix masking | Add secret scanning CI |
| DB stolen | High | SHA-256 hashed | Sufficient with 128-bit keys |
| Brute force API | Medium | None | Add rate limiting |
| Key never rotated | Medium | None | Add expiration |
| Replay attack | Low | HTTPS | Sufficient |
| Scope escalation | Medium | Hierarchical scopes | Add audit log |

---

*Next: Implementation plan in `implementation-plan.md`*
