# API Keys — Database Schema

> **Version:** 1.0 (Iteration 1)
> **Date:** 2026-02-12

---

## Current Schema (as-is)

```sql
CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,              -- "key_a1b2c3d4"
    key_hash TEXT NOT NULL UNIQUE,    -- SHA-256 hash
    key_prefix TEXT NOT NULL,         -- "chk_admin_a1b2..." (masked)
    name TEXT NOT NULL,               -- Human-readable name
    scopes TEXT NOT NULL DEFAULT '["read"]',  -- JSON array
    agent_id TEXT,                    -- Bound agent (nullable)
    revoked INTEGER DEFAULT 0,       -- Soft delete
    created_at INTEGER NOT NULL,     -- Unix ms
    last_used_at INTEGER             -- Unix ms
);

CREATE TABLE agent_identities (
    agent_id TEXT NOT NULL,
    session_key TEXT NOT NULL,
    api_key_id TEXT,
    runtime TEXT,
    bound_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    PRIMARY KEY (agent_id, session_key),
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
);
```

---

## Target Schema (SaaS-ready)

### api_keys (updated)

```sql
CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,              -- "key_a1b2c3d4"
    key_hash TEXT NOT NULL UNIQUE,    -- SHA-256 of full key
    key_prefix TEXT NOT NULL,         -- "ch_live_a1b2c3d4..." (first 16 chars)
    name TEXT NOT NULL,               -- "Production Admin Key"
    scopes TEXT NOT NULL DEFAULT '["read"]',  -- JSON: ["read","self","manage","admin"]
    environment TEXT DEFAULT 'live',  -- "live" or "test"
    agent_id TEXT,                    -- Bound to specific agent (nullable)
    user_id TEXT,                     -- Owner user (nullable, for future multi-tenancy)
    org_id TEXT,                      -- Organization (nullable, for future)
    revoked INTEGER DEFAULT 0,       -- 1 = revoked (soft delete)
    created_at INTEGER NOT NULL,     -- Unix timestamp ms
    expires_at INTEGER,              -- Unix timestamp ms (NULL = never)
    last_used_at INTEGER,            -- Unix timestamp ms
    description TEXT                 -- Optional notes
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_agent ON api_keys(agent_id);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_org ON api_keys(org_id);
```

### api_key_usage (new — audit log)

```sql
CREATE TABLE api_key_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,           -- "/api/agents"
    method TEXT NOT NULL,             -- "GET", "POST", etc.
    status_code INTEGER,             -- 200, 401, 403, etc.
    ip_address TEXT,
    user_agent TEXT,
    timestamp INTEGER NOT NULL,      -- Unix timestamp ms
    FOREIGN KEY (key_id) REFERENCES api_keys(id)
);

CREATE INDEX idx_usage_key ON api_key_usage(key_id);
CREATE INDEX idx_usage_ts ON api_key_usage(timestamp);
```

**Retention:** Auto-delete rows older than 90 days.

---

## Migration Script

```sql
-- Migration: v1 → v2 (add SaaS columns)
ALTER TABLE api_keys ADD COLUMN expires_at INTEGER;
ALTER TABLE api_keys ADD COLUMN environment TEXT DEFAULT 'live';
ALTER TABLE api_keys ADD COLUMN user_id TEXT;
ALTER TABLE api_keys ADD COLUMN org_id TEXT;
ALTER TABLE api_keys ADD COLUMN description TEXT;

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(org_id);

-- Create audit log table
CREATE TABLE IF NOT EXISTS api_key_usage (
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

CREATE INDEX IF NOT EXISTS idx_usage_key ON api_key_usage(key_id);
CREATE INDEX IF NOT EXISTS idx_usage_ts ON api_key_usage(timestamp);
```

---

## Key Format Examples

```
ch_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6    # Production
ch_test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6    # Test/sandbox

# Stored prefix (for display):
ch_live_a1b2c3d4...
ch_test_b2c3d4e5...
```

---

## Entity Relationship

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  api_keys    │────<│ agent_identities │     │ api_key_usage   │
│              │     │                  │     │                 │
│  id (PK)     │     │  agent_id        │     │  id (PK)        │
│  key_hash    │     │  session_key     │     │  key_id (FK)    │
│  name        │     │  api_key_id (FK) │     │  endpoint       │
│  scopes      │     │  runtime         │     │  method         │
│  environment │     │  bound_at        │     │  status_code    │
│  expires_at  │     │  last_seen_at    │     │  timestamp      │
│  user_id     │     └──────────────────┘     └─────────────────┘
│  org_id      │
│  revoked     │
└──────────────┘
```
