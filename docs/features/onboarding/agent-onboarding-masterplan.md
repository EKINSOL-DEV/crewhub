# CrewHub Agent Onboarding Masterplan

*Version: 3.0 — 2026-02-05*
*Status: FINAL*

---

## Quick Start (Read in 30 Seconds)

```
CrewHub = real-time 3D dashboard monitoring your AI agent sessions.
API: http://localhost:8090  |  UI: http://localhost:5180

1. Discover:  curl -sf http://localhost:8090/health
2. Get key:   jq -r '.auth.default_key' ~/.crewhub/agent.json
3. Identify:  POST /api/self/identify  {"agent_id":"agent:dev","session_key":"agent:dev:main"}
4. Name:      POST /api/self/display-name  {"display_name":"My Agent"}
5. Room:      POST /api/self/room  {"room_id":"dev-room"}

Auth: X-API-Key header on every request (except /health and /api/discovery/manifest).
All /api/self/* endpoints are idempotent. Safe to retry.
Full capabilities: GET /api/discovery/manifest
Extended docs:     GET /api/discovery/docs/{topic}
```

---

## Revision History

### v3.0 (2026-02-05) — Final Iteration

Changes based on [GPT-5.2 review round 2](./agent-onboarding-review-2.md):

| # | Change | Rationale |
|---|--------|-----------|
| 1 | **Added identity binding rules** (Section 4.5) | Prevent agent A from claiming agent B's identity. Bound keys lock agent_id; unbound keys require `manage` scope to create new identities. |
| 2 | **Local-trust guardrails** (Section 3.4) | Explicit insecure-mode framing, required 0600 file permissions, clear "when to switch" guidance. |
| 3 | **SSE delivery contract** (Section 10.3) | At-least-once semantics, monotonic ordering, buffer limits, server-restart behavior, snapshot includes `last_event_id`. |
| 4 | **Safe defaults key strategy** (Section 3.4) | Default key in `agent.json` is now `self` scope (not `admin`). Admin key only in `api-keys.json`. |
| 5 | **Machine-readable constraints** (Section 2.3) | Added `constraints` object per capability in manifest (e.g., `chat: {main_session_only: true}`). |
| 6 | **ETag/caching for docs** (Section 7.3) | `ETag` + `If-None-Match` for manifest and extended docs endpoints. |
| 7 | **SKILL.md CI budget** (Section 7.2) | Hard limit: 120 lines / 500 tokens, enforced by CI. |
| 8 | **Manifest endpoint visibility** (Section 2.3) | Public by default, with `auth.manifest_public` setting to restrict when deployed remotely. |
| 9 | **Manifest-OpenAPI drift check** (Section 8.4) | Lightweight test ensuring manifest endpoints exist in OpenAPI. |
| 10 | **Scope boundary clarification** (Section 3.3) | Explicit note that 4 coarse scopes are intentional; `/api/notify` placed behind `manage`. |

### v2.0 (2026-02-05) — Post-Review Iteration

Changes based on [GPT-5.2 review](./agent-onboarding-review-1.md):

| # | Change | Rationale |
|---|--------|-----------|
| 1 | **Added Section 3: Authentication & Permissions** | Auth was undefined. Now covers scopes, API keys, local-trust model, and a permission matrix for every endpoint group. |
| 2 | **Added Section 4: Identity Model** | Clarified agent_id (stable) vs session_key (ephemeral), added `/api/self` endpoints so agents don't need to know their session key. |
| 3 | **Redesigned SKILL.md as tiered** (Section 7) | Original SKILL.md was ~300 lines, too large for small context windows. Now: minimal SKILL.md (~80 lines) + fetchable extended docs via `/api/discovery/docs/{topic}`. |
| 4 | **Added SSE reliability** (Section 10.3) | Added `event_id`, `Last-Event-ID` reconnect, exponential backoff, and guidance on switching from snapshot polling to incremental events. |
| 5 | **Reordered phases** (Section 11) | Auth + self endpoints moved to Phase 1. SSE reliability to Phase 2. Auto-generated manifest and room messaging deferred. |
| 6 | **Added `/api/self/*` endpoints** (Section 4.3) | Agents shouldn't need to interpolate session keys. Server resolves caller identity from token/connection. |
| 7 | **Added manifest schema versioning** (Section 2.3) | `manifest_schema_version` field for backwards compatibility. |
| 8 | **Added Docker/remote discovery** (Section 2.1) | `localhost:8090` isn't always correct. Added `reachable_from` hints and container guidance. |
| 9 | **Added Glossary** (Appendix E) | Terms like agent_id, session_key, scope were used inconsistently. |
| 10 | **Added idempotency contract** (Section 6.3) | Explicit upsert semantics + optional `Idempotency-Key` header support. |
| 11 | **Trimmed Phase 5 room messaging** | Deferred and simplified; existing chat + display name signals cover most coordination needs. |

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Discovery & Awareness](#2-discovery--awareness)
3. [Authentication & Permissions](#3-authentication--permissions)
4. [Identity Model](#4-identity-model)
5. [Knowledge Distribution](#5-knowledge-distribution)
6. [Onboarding Flow for Agents](#6-onboarding-flow-for-agents)
7. [Skill Architecture (Tiered)](#7-skill-architecture-tiered)
8. [API Documentation for Agents](#8-api-documentation-for-agents)
9. [Self-Updating Knowledge](#9-self-updating-knowledge)
10. [Multi-Agent Awareness](#10-multi-agent-awareness)
11. [Implementation Plan](#11-implementation-plan)
12. [Appendices](#12-appendices)

---

## 1. Problem Statement

### The Scenario

An AI agent (OpenClaw, Claude Code, Codex CLI) wakes up fresh on a machine where CrewHub is installed. It has no memory of CrewHub. It needs to:

1. **Discover** that CrewHub exists and is running
2. **Authenticate** with appropriate permissions for its role
3. **Identify** itself (stable identity across restarts)
4. **Understand** what CrewHub can do (rooms, 3D world, chat, modding, settings)
5. **Interact** with CrewHub's API to register itself, join rooms, set display names
6. **Collaborate** with other agents visible through CrewHub
7. **Stay current** as CrewHub adds features

### Why This Matters

CrewHub is a *monitoring dashboard for AI agents*. The irony: the agents it monitors don't know it exists. If agents could self-discover and interact with CrewHub, they could:

- Announce themselves in rooms ("I'm working on the frontend refactor")
- Set meaningful display names instead of raw session keys
- Route themselves to project-specific rooms
- Chat with users through CrewHub's chat proxy
- Coordinate with other agents by seeing who's in which room
- Leverage room-assignment rules to auto-organize their subagents

### Design Philosophy

**Agent-first, not human-first.** Agents don't read READMEs linearly. They need:

- **Machine-readable** discovery (not "go to Settings and click...")
- **Secure by default** with least-privilege scopes
- **Stable identity** that survives session restarts
- **Idempotent** operations (agents retry; everything must be safe to repeat)
- **Progressive disclosure** (don't dump 50 endpoints on first contact)
- **Minimal context cost** (small SKILL.md + on-demand extended docs)
- **Offline-capable** knowledge (agents may lack internet access)
- **Zero-config defaults** that Just Work™

---

## 2. Discovery & Awareness

### 2.1 How Does an Agent Discover CrewHub?

CrewHub runs as a local service: FastAPI backend on port `8090`, React frontend on port `5180`. An agent needs to find it.

#### Discovery Signal Priority

| Priority | Method | Confidence | Latency |
|----------|--------|------------|---------|
| 1 | Environment variable `CREWHUB_URL` | High | Instant |
| 2 | Config file `~/.crewhub/agent.json` | High | ~1ms |
| 3 | Well-known port probe `localhost:8090/health` | High | ~50ms |
| 4 | CrewHub skill installed in agent framework | High | Instant |
| 5 | OpenClaw Gateway metadata (if connected) | Medium | ~100ms |

#### Method 1: Environment Variable (Recommended)

```bash
export CREWHUB_URL=http://localhost:8090
```

When agents start, they should check for `CREWHUB_URL`. This is the most explicit, reliable signal. It should be documented in CrewHub's installation guide and `.env.example`.

**Implementation:** Add `CREWHUB_URL` to CrewHub's Docker Compose and startup scripts. When CrewHub starts, it can optionally write this to a discoverable location.

#### Method 2: Config File

```json
// ~/.crewhub/agent.json
{
  "version": "0.7.0",
  "api_url": "http://localhost:8090",
  "frontend_url": "http://localhost:5180",
  "reachable_from": {
    "host": "http://localhost:8090",
    "docker": "http://host.docker.internal:8090"
  },
  "capabilities": ["rooms", "sessions", "chat", "blueprints", "sse"],
  "auth": {
    "mode": "local_trust",
    "required": true,
    "default_key": "chk_self_<random>",
    "key_file": "~/.crewhub/api-keys.json"
  }
}
```

CrewHub backend writes this file on startup. Agents check for it. This works even when the agent framework doesn't support environment variables.

**Location precedence:**
1. `$CREWHUB_CONFIG` (explicit override)
2. `~/.crewhub/agent.json` (default)
3. `./.crewhub/agent.json` (project-local)

**Docker / Remote:** The `reachable_from` field provides URL hints for different network contexts. Agents running inside Docker should use `reachable_from.docker` instead of `api_url`. For remote machines, add a `remote` key with the externally reachable URL.

#### Method 3: Port Probe

If no env var or config file exists, agents can probe the well-known port:

```bash
curl -s http://localhost:8090/health
# → {"status": "healthy", "version": "0.7.0"}
```

The `/health` endpoint is lightweight and always available. If it responds, CrewHub is running.

#### Method 4: Skill-Based (see Section 7)

When a CrewHub skill is installed in the agent framework, discovery is handled by the skill itself.

#### Method 5: Gateway Metadata

If the agent is already connected to an OpenClaw Gateway, CrewHub could advertise itself through gateway status:

```json
// Gateway status response (future enhancement)
{
  "integrations": {
    "crewhub": {
      "url": "http://localhost:8090",
      "version": "0.7.0"
    }
  }
}
```

### 2.2 The "Hello World" Interaction

Once an agent discovers CrewHub, the first interaction should be minimal and informative:

```bash
# Step 1: Health check (am I talking to CrewHub?)
GET /health → {"status": "healthy", "version": "0.7.0"}

# Step 2: Authenticate (get or verify API key)
# (see Section 3 for details)

# Step 3: Identify myself
POST /api/self/identify → {"agent_id": "...", "session_key": "...", "scopes": [...]}

# Step 4: Capability manifest (what can CrewHub do?)
GET /api/discovery/manifest → {capabilities, quick_start, auth, ...}

# Step 5: Set display name + assign room
POST /api/self/display-name → {"display_name": "My Agent"}
POST /api/self/room → {"room_id": "dev-room"}
```

**Key principle:** An agent can go from zero to visible in 5 HTTP calls. The `/api/self/*` endpoints mean agents don't need to know their session key.

### 2.3 Endpoint: `/api/discovery/manifest`

This is the **single most important endpoint** for agent onboarding. It's the machine-readable equivalent of a README.

#### Visibility

The manifest endpoint is **public by default** (no auth required) — essential for agent discovery. For remote deployments where exposing capability surface is undesirable, restrict with:

```
Setting: auth.manifest_public = false
```

When `false`, the manifest requires a valid API key (any scope). In both modes, `/health` remains fully public.

```python
# Proposed response structure
{
  "name": "CrewHub",
  "version": "0.7.0",
  "manifest_schema_version": 1,
  "description": "Real-time monitoring dashboard for AI agent sessions",
  "api_base": "http://localhost:8090",
  "frontend_url": "http://localhost:5180",

  "auth": {
    "required": true,
    "mode": "local_trust",
    "methods": ["api_key"],
    "header": "X-API-Key",
    "scopes": ["read", "self", "manage", "admin"],
    "docs_url": "/api/discovery/docs/auth"
  },

  "capabilities": [
    {
      "id": "sessions",
      "description": "View and manage active agent sessions",
      "since": "0.1.0",
      "stability": "stable",
      "scopes": {"read": ["GET"], "admin": ["DELETE", "PATCH"]},
      "endpoints": ["GET /api/sessions", "DELETE /api/sessions/{key}"],
      "constraints": {}
    },
    {
      "id": "rooms",
      "description": "Organize agents into named rooms/workspaces",
      "since": "0.1.0",
      "stability": "stable",
      "scopes": {"read": ["GET"], "manage": ["POST", "PUT", "DELETE"]},
      "endpoints": ["GET /api/rooms", "POST /api/rooms", "PUT /api/rooms/{id}"],
      "constraints": {}
    },
    {
      "id": "self",
      "description": "Manage your own session (display name, room, identity)",
      "since": "0.7.0",
      "stability": "stable",
      "scopes": {"self": ["POST", "GET"]},
      "endpoints": [
        "POST /api/self/identify",
        "GET /api/self",
        "POST /api/self/display-name",
        "POST /api/self/room"
      ],
      "constraints": {
        "identity_binding": "bound keys can only operate as their bound agent_id"
      }
    },
    {
      "id": "room_assignments",
      "description": "Assign sessions to rooms",
      "since": "0.1.0",
      "stability": "stable",
      "scopes": {"self": ["POST (own)"], "manage": ["POST (any)", "DELETE"]},
      "endpoints": ["GET /api/session-room-assignments", "POST /api/session-room-assignments"],
      "constraints": {}
    },
    {
      "id": "display_names",
      "description": "Set custom display names for sessions",
      "since": "0.1.0",
      "stability": "stable",
      "scopes": {"self": ["POST (own)"], "manage": ["POST (any)", "DELETE"]},
      "endpoints": ["GET /api/session-display-names", "POST /api/session-display-names/{key}"],
      "constraints": {}
    },
    {
      "id": "chat",
      "description": "Chat with agents through CrewHub",
      "since": "0.3.0",
      "stability": "stable",
      "scopes": {"read": ["GET"], "self": ["POST (own)"]},
      "endpoints": ["GET /api/chat/{key}/history", "POST /api/chat/{key}/send"],
      "constraints": {
        "main_session_only": true,
        "rate_limit": "20/min per session, 3s cooldown"
      }
    },
    {
      "id": "agents",
      "description": "Agent registry with metadata (name, icon, color)",
      "since": "0.2.0",
      "stability": "stable",
      "scopes": {"read": ["GET"], "manage": ["PUT"]},
      "endpoints": ["GET /api/agents", "PUT /api/agents/{id}"],
      "constraints": {}
    },
    {
      "id": "assignment_rules",
      "description": "Automatic room assignment rules (keyword, model, label pattern)",
      "since": "0.2.0",
      "stability": "stable",
      "scopes": {"read": ["GET"], "manage": ["POST", "PUT", "DELETE"]},
      "endpoints": ["GET /api/room-assignment-rules", "POST /api/room-assignment-rules"],
      "constraints": {}
    },
    {
      "id": "blueprints",
      "description": "Room layout blueprints (modding)",
      "since": "0.6.0",
      "stability": "beta",
      "scopes": {"read": ["GET"], "manage": ["POST", "PUT", "DELETE"]},
      "endpoints": ["GET /api/blueprints", "POST /api/blueprints"],
      "constraints": {}
    },
    {
      "id": "sse",
      "description": "Real-time event stream (Server-Sent Events)",
      "since": "0.1.0",
      "stability": "stable",
      "scopes": {"read": ["GET"]},
      "endpoints": ["GET /api/events"],
      "constraints": {
        "max_connections_per_key": 1,
        "supports_compact": true,
        "delivery": "at_least_once",
        "buffer_size": 1000
      }
    },
    {
      "id": "notify",
      "description": "Push custom SSE notifications to connected clients",
      "since": "0.1.0",
      "stability": "stable",
      "scopes": {"manage": ["POST"]},
      "endpoints": ["POST /api/notify"],
      "constraints": {}
    },
    {
      "id": "settings",
      "description": "Application settings (key-value store)",
      "since": "0.3.0",
      "stability": "stable",
      "scopes": {"admin": ["GET", "PUT"]},
      "endpoints": ["GET /api/settings", "PUT /api/settings/{key}"],
      "constraints": {}
    },
    {
      "id": "connections",
      "description": "Manage connections to agent runtimes (OpenClaw, Claude Code, Codex)",
      "since": "0.4.0",
      "stability": "stable",
      "scopes": {"admin": ["*"]},
      "endpoints": ["GET /api/connections", "POST /api/connections"],
      "constraints": {}
    },
    {
      "id": "projects",
      "description": "Project tracking and room association",
      "since": "0.5.0",
      "stability": "beta",
      "scopes": {"read": ["GET"], "manage": ["POST"]},
      "endpoints": ["GET /api/projects", "POST /api/projects"],
      "constraints": {}
    }
  ],

  "quick_start": {
    "1_authenticate": {
      "method": "POST",
      "path": "/api/self/identify",
      "headers": {"X-API-Key": "<your-key>"},
      "description": "Identify yourself and verify your scopes"
    },
    "2_set_display_name": {
      "method": "POST",
      "path": "/api/self/display-name",
      "body": {"display_name": "My Agent Name"},
      "description": "Give your session a human-friendly name"
    },
    "3_assign_room": {
      "method": "POST",
      "path": "/api/self/room",
      "body": {"room_id": "dev-room"},
      "description": "Move your session to a room"
    },
    "4_list_rooms": {
      "method": "GET",
      "path": "/api/rooms",
      "description": "See available rooms"
    },
    "5_subscribe_events": {
      "method": "GET",
      "path": "/api/events",
      "description": "Connect to SSE stream for real-time updates"
    }
  },

  "extended_docs": {
    "base_url": "/api/discovery/docs",
    "topics": ["auth", "identity", "rooms", "sessions", "chat", "sse", "rules", "blueprints", "workflows"]
  },

  "rate_limits": {
    "default": "60/min",
    "chat_send": "20/min per session (3s cooldown)",
    "sse": "1 connection per key"
  },

  "event_types": [
    "session.created",
    "session.updated",
    "session.deleted",
    "room.created",
    "room.updated",
    "room.deleted",
    "assignment.changed",
    "rules.updated"
  ],

  "agent_frameworks": {
    "openclaw": {
      "skill_name": "crewhub",
      "skill_url": "https://github.com/ekinsolbot/crewhub-skill"
    },
    "claude_code": {
      "config_file": "CLAUDE.md or AGENTS.md",
      "setup": "Add CrewHub API reference to your project's CLAUDE.md"
    },
    "codex_cli": {
      "config_file": "AGENTS.md",
      "setup": "Add CrewHub API reference to AGENTS.md"
    }
  }
}
```

#### Manifest Schema Versioning

The `manifest_schema_version` field (integer) guarantees backwards compatibility:

- **Schema v1**: Initial manifest structure. Fields may be added but never removed or renamed within the same schema version.
- If a breaking change is needed → increment `manifest_schema_version` and maintain both schemas for at least 2 minor versions.
- Agents should check `manifest_schema_version` before parsing to ensure they understand the format.

---

## 3. Authentication & Permissions

### 3.1 Threat Model

CrewHub is primarily a **local service** on a developer's machine. The threat model is:

| Scenario | Likelihood | Risk | Mitigation |
|----------|------------|------|------------|
| Single-user laptop | Very high | Low | Local-trust with optional auth |
| Shared dev machine | Medium | Medium | API keys with scopes |
| Remote/cloud deploy | Low (today) | High | Required auth, HTTPS |
| Malicious agent | Low | High | Least-privilege scopes |

### 3.2 Auth Model: API Keys with Scopes

**Design principle:** Auth is always *available* but starts *permissive* for local setups. The default local-trust key has `self` scope; stricter or broader scopes are explicit.

#### How It Works

1. **On first startup**, CrewHub generates two API keys:
   - A `self`-scoped key written to `~/.crewhub/agent.json` (auto-discoverable by agents)
   - An `admin`-scoped key written only to `~/.crewhub/api-keys.json` (for human operators)
2. **`agent.json`** includes the `self` key so agents can auto-discover it with limited blast radius.
3. **Additional keys** can be created via the API or settings UI with any scope.
4. **Keys are sent** via the `X-API-Key` header on every request (except `/health` and `/api/discovery/manifest` which are public by default).

#### API Key Format

```
chk_<scope_hint>_<random>
```

Examples:
- `chk_admin_a1b2c3d4e5f6` — full admin access
- `chk_self_x9y8z7w6` — can only manage own session
- `chk_read_m3n4o5p6` — read-only access

The prefix is cosmetic (for human identification); actual scopes are server-side.

#### Key Management Endpoints

```
POST   /api/auth/keys              → Create a new API key (admin only)
GET    /api/auth/keys              → List keys (admin only, keys are masked)
DELETE /api/auth/keys/{key_id}     → Revoke a key (admin only)
GET    /api/auth/keys/self         → Show current key's scopes and metadata
```

#### Key File Structure

```json
// ~/.crewhub/api-keys.json (file permissions: 0600)
{
  "keys": [
    {
      "id": "key_001",
      "key": "chk_admin_a1b2c3d4e5f6",
      "name": "Default Local Admin",
      "scopes": ["read", "self", "manage", "admin"],
      "created": "2026-02-05T12:00:00Z",
      "agent_id": null
    },
    {
      "id": "key_002",
      "key": "chk_self_x9y8z7w6",
      "name": "Default Agent Key",
      "scopes": ["read", "self"],
      "created": "2026-02-05T12:00:00Z",
      "agent_id": null
    }
  ]
}
```

### 3.3 Permission Scopes

Four scopes, from least to most privileged. **This is intentionally coarse** — CrewHub is a local-first tool where most agents need either "read" or "self" access. Splitting `manage` into sub-scopes (rooms, agents, blueprints) would add complexity without practical benefit for the current use case. If fine-grained needs emerge later, sub-scopes can be added without breaking the existing 4-scope model.

| Scope | Description | Typical User |
|-------|-------------|--------------|
| `read` | Read-only access to all public data (sessions, rooms, agents, assignments, rules) | Monitoring dashboards, read-only agents |
| `self` | Read + manage own session (set own display name, assign own room, identify) | Typical agent |
| `manage` | Self + create/update/delete rooms, rules, agents, assignments for any session + push notifications | Orchestrator agent, main agent |
| `admin` | Manage + settings, connections, key management, kill sessions, backup | Human operator, trusted main agent |

#### Permission Matrix

| Endpoint Group | `read` | `self` | `manage` | `admin` |
|----------------|--------|--------|----------|---------|
| `GET /health`, `GET /api/discovery/*` | ✅ (public) | ✅ | ✅ | ✅ |
| `GET /api/sessions` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/rooms` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/agents` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/events` (SSE) | ✅ | ✅ | ✅ | ✅ |
| `POST /api/self/*` | ❌ | ✅ | ✅ | ✅ |
| `POST /api/session-display-names/{own}` | ❌ | ✅ | ✅ | ✅ |
| `POST /api/session-room-assignments` (own) | ❌ | ✅ | ✅ | ✅ |
| `POST /api/session-display-names/{other}` | ❌ | ❌ | ✅ | ✅ |
| `POST /api/session-room-assignments` (other) | ❌ | ❌ | ✅ | ✅ |
| `POST /api/rooms` | ❌ | ❌ | ✅ | ✅ |
| `PUT/DELETE /api/rooms/{id}` | ❌ | ❌ | ✅ | ✅ |
| `POST/PUT/DELETE /api/room-assignment-rules` | ❌ | ❌ | ✅ | ✅ |
| `PUT /api/agents/{id}` | ❌ | ❌ | ✅ | ✅ |
| `POST /api/notify` | ❌ | ❌ | ✅ | ✅ |
| `DELETE /api/sessions/{key}` | ❌ | ❌ | ❌ | ✅ |
| `PATCH /api/sessions/{key}` | ❌ | ❌ | ❌ | ✅ |
| `*/api/settings/*` | ❌ | ❌ | ❌ | ✅ |
| `*/api/connections/*` | ❌ | ❌ | ❌ | ✅ |
| `*/api/auth/keys` (manage) | ❌ | ❌ | ❌ | ✅ |
| `*/api/backup/*` | ❌ | ❌ | ❌ | ✅ |

### 3.4 Local-Trust Mode (Default)

For single-user local setups (the common case). **This is explicitly an insecure-but-convenient default** — appropriate for single-user laptops where filesystem access ≈ trust.

#### How It Works

- CrewHub auto-generates a `self`-scoped key and writes it to `~/.crewhub/agent.json`
- The `admin` key is written only to `~/.crewhub/api-keys.json`
- Agents auto-discover the `self` key — enough for identify, display name, room assignment
- Agents that need `manage` or `admin` must use the key from `api-keys.json` or `$CREWHUB_API_KEY`

#### File Permission Requirements (Hard Requirement)

Both config files **must** be created with restrictive permissions:

| File | Permissions | Rationale |
|------|-------------|-----------|
| `~/.crewhub/agent.json` | `0600` | Contains `self` key — readable only by owner |
| `~/.crewhub/api-keys.json` | `0600` | Contains `admin` key — readable only by owner |
| `~/.crewhub/` directory | `0700` | Prevent listing by other users |

**Behavior on incorrect permissions:**
- CrewHub logs a **warning** on startup if permissions are too broad (e.g., `0644`)
- In strict mode (see Section 3.5), CrewHub **refuses to start** if permissions are wrong

**Implementation:** CrewHub sets permissions at file creation time using `os.chmod()`.

#### When to Switch to Strict Mode

Switch to **strict mode** when ANY of these apply:
- Multiple users share the machine
- CrewHub is exposed over a network (not just localhost)
- You run untrusted agents or code (random npm packages, untrusted repos)
- You're deploying to a server/cloud environment
- You want audit-grade security for who did what

### 3.5 Strict Mode

Enable via setting: `auth.strict_mode = true`

In strict mode:
- **No auto-discoverable keys**: `agent.json` is written with `auth.default_key: null` and a message directing to `$CREWHUB_API_KEY`
- Agents must be given keys explicitly (via env var `CREWHUB_API_KEY` or per-agent config)
- The default key for new agents is `self` scope only
- Key creation requires interactive confirmation in the UI
- CrewHub **refuses to start** if file permissions on `~/.crewhub/` are too broad
- The manifest requires authentication if `auth.manifest_public = false`

The manifest includes the current auth mode so agents can detect it:
```json
"auth": {
  "mode": "strict",
  ...
}
```

---

## 4. Identity Model

### 4.1 The Problem

Agents need a stable identity across runtimes. Today, CrewHub uses OpenClaw's `session_key` (e.g., `agent:dev:main`), but:

- Session keys are **runtime-specific** — a Claude Code agent has no OpenClaw session key
- Session keys are **ephemeral** — they change when the runtime restarts (for subagents)
- Multiple runtimes may connect the same logical agent

We need to separate **who you are** from **which session you're in**.

### 4.2 Two-Level Identity

```
┌────────────────────────────────────────────────┐
│  agent_id (stable, server-verified)            │  "Who are you?"
│  e.g., "agent:dev"                             │  Survives restarts, across runtimes
│  Derived from: runtime + name                  │  Stored in agent registry
├────────────────────────────────────────────────┤
│  session_key (ephemeral)                       │  "Which session are you in right now?"
│  e.g., "agent:dev:main"                       │  Changes per session/runtime
│  Assigned by: runtime                          │  Linked to agent_id
└────────────────────────────────────────────────┘
```

#### agent_id

- **Stable across restarts.** An agent that restarts gets the same `agent_id`.
- **Unique per logical agent.** Two different agents on the same machine have different IDs.
- **Format:** `<runtime>:<name>` — e.g., `agent:dev`, `claude-code:project-x`, `codex:my-repo`
- **Stored in:** CrewHub's agent registry (`/api/agents`)
- **Carries:** display name, icon, color, default room, metadata

#### session_key

- **Ephemeral per session.** Each time the agent starts a session, it gets a (possibly new) session key.
- **Runtime-assigned.** OpenClaw assigns `agent:dev:main`, `agent:dev:subagent:abc123`. Claude Code has its own format.
- **Linked to agent_id** via the identify flow.

#### Mapping

One `agent_id` → many `session_key`s (one main + N subagents).

### 4.3 `/api/self/*` Endpoints

These endpoints let agents operate **without knowing their session key**. The server resolves identity from the API key (which can be bound to an `agent_id`) or from connection metadata.

```
POST /api/self/identify
  Request:  {"agent_id": "agent:dev", "runtime": "openclaw", "session_key": "agent:dev:main"}
  Response: {
    "agent_id": "agent:dev",
    "session_key": "agent:dev:main",
    "scopes": ["read", "self"],
    "display_name": "Dev Agent",
    "room_id": "dev-room",
    "agent_metadata": {"icon": "🤖", "color": "#3b82f6"}
  }

  Notes:
  - If agent_id doesn't exist in registry, creates it (auto-registration) — subject to binding rules (see 4.5).
  - If API key is bound to an agent_id, session_key in request is optional.
  - Idempotent: calling twice with same data is a no-op.

GET /api/self
  Response: Same as identify response (read current state)

POST /api/self/display-name
  Request:  {"display_name": "My Cool Agent"}
  Response: {"ok": true, "display_name": "My Cool Agent"}

POST /api/self/room
  Request:  {"room_id": "dev-room"}
  Response: {"ok": true, "room_id": "dev-room"}

POST /api/self/heartbeat
  Request:  {"status": "working", "task": "refactoring auth module"}
  Response: {"ok": true}
  Notes:    Updates agent presence. Optional but useful for real-time dashboards.
```

#### How Identity Resolution Works

The server resolves "who is calling?" using this priority:

| Priority | Method | When Used |
|----------|--------|-----------|
| 1 | API key bound to agent_id | Key was created for a specific agent |
| 2 | `agent_id` in request body | Agent provides its own ID (e.g., `/api/self/identify`) — subject to binding rules (4.5) |
| 3 | OpenClaw connection metadata | Agent connects through OpenClaw Gateway — session key known |
| 4 | `X-Agent-Id` header | Fallback for frameworks that can provide identity but not via key |

For **Claude Code / Codex** (no runtime session key), the flow is:
1. Human creates an API key bound to an agent_id: `POST /api/auth/keys {"scopes": ["self"], "agent_id": "claude-code:my-project"}`
2. Agent uses that key → server knows who it is
3. Agent calls `/api/self/identify` with `session_key` set to a self-generated value (e.g., `claude-code:my-project:session-<timestamp>`)

For **OpenClaw** agents:
1. Agent auto-discovers key from `agent.json`
2. Calls `/api/self/identify` with its known session key from the runtime environment
3. Server links the session_key to the agent_id

### 4.4 Cross-Runtime Identity

An agent that runs in both OpenClaw and Claude Code can maintain the same `agent_id`:

```
agent_id: "ekinbot-dev"
├── session_key: "agent:dev:main"           (OpenClaw)
├── session_key: "agent:dev:subagent:abc"   (OpenClaw subagent)
└── session_key: "claude-code:ekinbot-dev:session-1707134400"  (Claude Code)
```

The agent registry stores the `agent_id` with all its metadata. Session keys are ephemeral references that come and go.

### 4.5 Identity Binding Rules

Identity spoofing — where agent A claims to be agent B — is prevented by binding rules enforced at `/api/self/identify`:

#### Rule 1: Bound Keys Lock Identity

If an API key is bound to an `agent_id` (via `agent_id` field on the key):
- The caller **can only operate as that agent_id**
- Providing a different `agent_id` in the request body → `403 Forbidden`
- The `agent_id` field in request body is optional (server uses the key's binding)

This is the **recommended approach** for all non-local-trust setups.

#### Rule 2: Unbound Keys Require `manage` to Create New Identities

If an API key is **not** bound to an agent_id (like the default local-trust key):
- The caller may claim an `agent_id` that **already exists and was previously created by an unbound key** → allowed (re-identification)
- The caller may **create a new agent_id** only if the key has `manage` or `admin` scope
- A `self`-scoped unbound key can only claim an `agent_id` that the server already associates with the current connection (e.g., from OpenClaw gateway metadata)

This prevents a `self`-scoped agent from creating arbitrary fake agents, while still allowing the orchestrator (with `manage` scope) to register new agents.

#### Rule 3: Gateway-Derived Identity Takes Priority

For agents connected through OpenClaw Gateway:
- The server knows the real `session_key` from gateway metadata
- If the agent provides a `session_key` in the request body that conflicts with gateway metadata → `409 Conflict`
- The body-provided `session_key` is treated as **advisory** — gateway metadata is authoritative

#### Rule 4: Rate Limit Identity Creation

To prevent registry poisoning (one agent creating thousands of fake identities):
- New `agent_id` creation is rate-limited: **10 per hour per API key**
- Existing `agent_id` re-identification is unlimited
- Rate limit is per key, not per IP

#### Summary Table

| Key Type | Claim existing agent_id | Create new agent_id | Provide session_key |
|----------|------------------------|--------------------|--------------------|
| Bound to agent_id X | Only X | ❌ | Optional (server resolves) |
| Unbound, `self` scope | Only if server already associates it | ❌ | Advisory (gateway wins) |
| Unbound, `manage`+ scope | Any | ✅ (rate-limited) | Advisory (gateway wins) |

---

## 5. Knowledge Distribution

### 5.1 Decision Matrix: How Should Agents Learn About CrewHub?

| Channel | Audience | Pros | Cons | Recommendation |
|---------|----------|------|------|----------------|
| **Minimal SKILL.md** | OpenClaw agents | Auto-loaded, small, offline | Only essentials | ✅ Build it (~80 lines) |
| **Extended docs endpoint** | Agents needing details | On-demand, no context bloat | Requires HTTP | ✅ Build it |
| **`/api/discovery/manifest`** | Any HTTP-capable agent | Framework-agnostic, live | Requires CrewHub running | ✅ Build it (core) |
| **`~/.crewhub/agent.json`** | Any local agent | Works offline, simple | Stale if not updated | ✅ Write on startup |
| **CLAUDE.md snippet** | Claude Code | Standard, per-project | Manual, limited | ✅ Provide template |
| **OpenAPI spec** | Any agent | Industry standard | Verbose, overwhelming | ✅ Keep at `/api/docs` |

### 5.2 Knowledge Layers (Token-Aware)

```
Layer 0: Discovery           ~50 tokens    "CrewHub exists at localhost:8090"
   ↓
Layer 1: Auth + Identity     ~100 tokens   "Here's your key, here's who you are"
   ↓
Layer 2: Quick Start         ~200 tokens   "5 essential calls with /api/self/*"
   ↓
Layer 3: Manifest            ~500 tokens   "12 capabilities, endpoints, scopes"
   ↓
Layer 4: Extended Docs       on-demand     "Full API for a specific topic"
   ↓
Layer 5: OpenAPI Spec        on-demand     "Complete spec with all parameters"
```

**Layers 0–2 fit in ~350 tokens** — that's the minimal SKILL.md. Layer 3 is fetched via the manifest endpoint. Layers 4–5 are fetched on-demand only when the agent needs a specific capability.

### 5.3 Minimum Viable Knowledge (MVK)

If an agent can only absorb one thing, it should be this (~80 lines, ~350 tokens):

```
CrewHub is running at http://localhost:8090.
It monitors your AI agent sessions in a 3D dashboard.

Auth: X-API-Key header. Key from ~/.crewhub/agent.json or $CREWHUB_API_KEY.

Key actions:
- POST /api/self/identify                       → register yourself
  body: {"agent_id": "agent:dev", "session_key": "agent:dev:main"}
- POST /api/self/display-name                   → set your display name
  body: {"display_name": "Your Name"}
- POST /api/self/room                           → assign yourself to a room
  body: {"room_id": "dev-room"}
- GET  /api/rooms                               → list available rooms
- GET  /api/discovery/manifest                  → full capability list
- GET  /api/discovery/docs/{topic}              → extended docs (auth|rooms|sessions|chat|sse|rules|workflows)
- GET  /api/events                              → real-time updates (SSE)
```

This is 12 lines. Any agent can parse and use it.

---

## 6. Onboarding Flow for Agents

### 6.1 Step-by-Step: First Contact

```
┌─────────────────────────────────────────────────┐
│ Agent Session Starts                            │
│                                                 │
│  1. Check $CREWHUB_URL env var                  │
│     ├─ Set? → use it                            │
│     └─ Not set? → continue                      │
│                                                 │
│  2. Check ~/.crewhub/agent.json                 │
│     ├─ Exists? → read api_url + auth.default_key│
│     └─ Not found? → continue                    │
│                                                 │
│  3. Probe http://localhost:8090/health           │
│     ├─ 200 OK? → CrewHub found!                 │
│     └─ Error? → CrewHub not running, stop       │
│                                                 │
│  4. POST /api/self/identify                     │
│     → Authenticate, register, get scopes        │
│                                                 │
│  5. POST /api/self/display-name                 │
│     → Set my display name                       │
│                                                 │
│  6. POST /api/self/room                         │
│     → Assign myself to appropriate room         │
│                                                 │
│  7. (Optional) GET /api/discovery/manifest      │
│     → Learn full capabilities if needed         │
│                                                 │
│  8. (Optional) GET /api/events                  │
│     → Subscribe to SSE for live updates         │
│                                                 │
│  Agent is now visible in CrewHub! 🎉             │
└─────────────────────────────────────────────────┘
```

### 6.2 Push vs Pull

| Information | Push or Pull? | Mechanism |
|-------------|---------------|-----------|
| CrewHub exists | Pull | Agent checks env/config/port |
| API key | Pull | Agent reads agent.json or env var |
| Capabilities | Pull | Agent requests manifest |
| Available rooms | Pull | Agent queries `/api/rooms` |
| Session assigned to room | Push (if rules exist) | Room assignment rules auto-trigger |
| Other agents' status | Push | SSE stream |
| New features/version | Pull (periodic) | Agent checks manifest version |

**Key insight:** Room assignment rules can handle most routing automatically. If a rule says "sessions with label containing 'dev' go to dev-room", agents don't need to self-assign. The pull model is for agents that want more control.

### 6.3 Idempotency Contract

All mutating endpoints in CrewHub follow upsert semantics:

| Operation | Behavior on Repeat | Idempotent? |
|-----------|-------------------|-------------|
| Set display name | Overwrites existing | ✅ |
| Assign room | Overwrites existing | ✅ |
| Identify | Returns existing data | ✅ |
| Create room (same ID) | Returns existing room | ✅ |
| Create rule (same params) | Returns existing rule | ✅ |

**Optional `Idempotency-Key` header:** For operations where the agent wants guaranteed exactly-once semantics (e.g., creating a room when the response might be lost), the agent can send:

```
Idempotency-Key: <unique-string>
```

The server caches the response for 5 minutes. If the same key is sent again, the cached response is returned without re-executing. This is optional — upsert semantics handle most cases.

### 6.4 Progressive Disclosure

#### Level 1: Passive Awareness (Zero Effort)

The agent doesn't need to do anything. CrewHub already monitors it through the OpenClaw Gateway connection. The agent appears on the dashboard automatically.

**What the agent gets for free:**
- Visible in CrewHub's session list
- Visible in 3D world (as a bot)
- Session activity tracked (tokens, cost, runtime)
- Room assignment via rules (if configured)

#### Level 2: Self-Identification (3 API Calls)

The agent identifies itself, sets a display name, and assigns itself to a room.

```bash
# Identify (with auth)
curl -X POST http://localhost:8090/api/self/identify \
  -H "X-API-Key: chk_self_x9y8z7w6" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "agent:dev", "session_key": "agent:dev:main"}'

# Set display name
curl -X POST http://localhost:8090/api/self/display-name \
  -H "X-API-Key: chk_self_x9y8z7w6" \
  -H "Content-Type: application/json" \
  -d '{"display_name": "CrewHub Dev Agent"}'

# Assign to room
curl -X POST http://localhost:8090/api/self/room \
  -H "X-API-Key: chk_self_x9y8z7w6" \
  -H "Content-Type: application/json" \
  -d '{"room_id": "dev-room"}'
```

#### Level 3: Active Participant (SSE + Chat)

The agent subscribes to SSE events and can respond to chat messages through CrewHub.

```bash
# Subscribe to SSE (with Last-Event-ID for reconnect)
curl -N -H "X-API-Key: chk_self_x9y8z7w6" \
  -H "Last-Event-ID: evt_1707134400_42" \
  http://localhost:8090/api/events
```

#### Level 4: Orchestrator (Room + Agent Management)

The agent creates rooms, sets up assignment rules, manages other agents. Requires `manage` scope.

```bash
# Create a project-specific room
curl -X POST http://localhost:8090/api/rooms \
  -H "X-API-Key: chk_admin_a1b2c3d4e5f6" \
  -H "Content-Type: application/json" \
  -d '{"id": "crewhub-dev", "name": "CrewHub Dev", "icon": "🏗️", "color": "#3b82f6"}'

# Create a rule: sessions with "crewhub" in label go to this room
curl -X POST http://localhost:8090/api/room-assignment-rules \
  -H "X-API-Key: chk_admin_a1b2c3d4e5f6" \
  -H "Content-Type: application/json" \
  -d '{"room_id": "crewhub-dev", "rule_type": "label_pattern", "rule_value": "crewhub", "priority": 10}'
```

#### Level 5: Modder (Blueprints + Customization)

The agent creates custom room blueprints and manages the 3D world. Requires `manage` scope.

---

## 7. Skill Architecture (Tiered)

### 7.1 The Token Budget Problem

The v1 SKILL.md was ~300 lines with a full API reference. For agents with small context windows (4K–8K tokens), loading this burns 15–30% of their budget on CrewHub docs alone. That's unacceptable.

**Solution: Two-tier documentation.**

```
Tier 1: SKILL.md (~80 lines, ~350 tokens)
  → Always loaded, minimal, covers 90% of agent needs
  → Discovery, auth, /api/self/*, list rooms, SSE

Tier 2: Extended docs (on-demand, ~200-500 lines per topic)
  → Fetched via GET /api/discovery/docs/{topic}
  → Full endpoint reference, workflows, recipes
  → Only loaded when agent needs a specific capability
```

### 7.2 Tier 1: Minimal SKILL.md

**Hard budget: 120 lines / 500 tokens maximum.** Enforced by CI — a GitHub Actions check fails the build if SKILL.md exceeds either limit. This prevents feature creep from gradually bloating the always-loaded context.

**What belongs in Tier 1:** Discovery, auth, the 5 essential `/api/self/*` calls, list rooms, SSE link, pointer to extended docs. Nothing else.

```markdown
# CrewHub Skill

CrewHub monitors AI agent sessions in a real-time 3D dashboard.

## Connection

- **API:** ${CREWHUB_URL:-http://localhost:8090}
- **Dashboard:** http://localhost:5180
- **Auth:** `X-API-Key` header. Key from `~/.crewhub/agent.json` → `auth.default_key`

## Discovery

```bash
# Check if running
curl -sf http://localhost:8090/health

# Full capabilities
curl -s http://localhost:8090/api/discovery/manifest | jq .
```

## Quick Start (Self-Service)

All `/api/self/*` endpoints resolve your identity from your API key.

```bash
# 1. Identify yourself
curl -X POST $CREWHUB_URL/api/self/identify \
  -H "X-API-Key: $CREWHUB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "agent:dev", "session_key": "agent:dev:main"}'

# 2. Set display name
curl -X POST $CREWHUB_URL/api/self/display-name \
  -H "X-API-Key: $CREWHUB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"display_name": "My Agent"}'

# 3. Join a room
curl -X POST $CREWHUB_URL/api/self/room \
  -H "X-API-Key: $CREWHUB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"room_id": "dev-room"}'
```

## Read Operations (no auth scope needed beyond `read`)

```bash
# List rooms
curl -s $CREWHUB_URL/api/rooms | jq '.rooms[] | {id, name}'

# List sessions
curl -s $CREWHUB_URL/api/sessions | jq '.sessions | length'

# Subscribe to events (SSE)
curl -N $CREWHUB_URL/api/events
```

## Extended Documentation

For full endpoint reference, workflows, and recipes:
```bash
# Fetch docs for a specific topic
curl -s $CREWHUB_URL/api/discovery/docs/{topic}
# Topics: auth, identity, rooms, sessions, chat, sse, rules, blueprints, workflows
```

## Tips

1. **You're already visible** — CrewHub sees you via OpenClaw Gateway automatically.
2. **Use `/api/self/*`** — no need to know your session key for basic operations.
3. **Idempotent** — setting name/room twice is safe. CrewHub uses upserts.
4. **Room assignment rules** — may auto-route you. Check before manually assigning.
5. **Chat only works for main sessions** — subagents can't be chatted through CrewHub.
```

**Token count: ~350 tokens.** Fits comfortably in any context window.

### 7.3 Tier 2: Extended Docs Endpoint

```
GET /api/discovery/docs/{topic}
```

Returns markdown documentation for a specific topic. Topics:

| Topic | Content | Approximate Size |
|-------|---------|-----------------|
| `auth` | Auth model, scopes, key management, permission matrix | ~200 lines |
| `identity` | agent_id vs session_key, cross-runtime identity, binding rules, /api/self/* details | ~150 lines |
| `rooms` | Room CRUD, HQ rooms, reordering, project association | ~150 lines |
| `sessions` | Session listing, history, spawn, kill, model switching | ~150 lines |
| `chat` | Chat history, send, info, rate limits, main-session-only constraint | ~100 lines |
| `sse` | Event types, reconnect, backoff, Last-Event-ID, delivery guarantees, payload examples | ~150 lines |
| `rules` | Assignment rule types, priority, bulk update, common patterns | ~150 lines |
| `blueprints` | Blueprint CRUD, import/export, modding guide | ~100 lines |
| `workflows` | Multi-step recipes: project setup, subagent routing, war room | ~200 lines |

**Implementation:** Markdown files stored in the repo (e.g., `docs/agent-api/`), served by a simple endpoint that reads the file and returns it as `text/markdown`.

**Caching:** Agents can cache topic docs by version. Responses include:
```
ETag: "v0.7.0-auth-abc123"
Last-Modified: Thu, 05 Feb 2026 12:00:00 GMT
Cache-Control: public, max-age=3600
```

Agents should use conditional requests to avoid re-downloading:
```
GET /api/discovery/docs/auth
If-None-Match: "v0.7.0-auth-abc123"
→ 304 Not Modified (cache hit)
```

The manifest endpoint also supports `ETag`:
```
GET /api/discovery/manifest
If-None-Match: "v0.7.0-manifest-xyz789"
→ 304 Not Modified
```

**Topic list stability:** The topic names listed above are stable — they will not be renamed or removed without a manifest schema version bump. New topics may be added.

### 7.4 Skill Directory Structure

```
skills/crewhub/
├── SKILL.md                    # Tier 1: minimal agent doc (~80 lines)
├── crewhub-cli.sh              # Helper CLI for common operations
└── templates/
    ├── claude-md-snippet.md    # CLAUDE.md section to paste
    └── agents-md-snippet.md    # AGENTS.md section to paste
```

Note: Recipes and full docs live on the server (Tier 2), not in the skill directory. This keeps the skill small and always up-to-date.

### 7.5 Helper CLI: `crewhub-cli.sh`

A lightweight shell script that wraps common API calls:

```bash
#!/usr/bin/env bash
# crewhub-cli.sh — Quick CrewHub interactions for AI agents

CREWHUB_URL="${CREWHUB_URL:-http://localhost:8090}"
CREWHUB_API_KEY="${CREWHUB_API_KEY:-}"

# Auto-discover key if not set
if [ -z "$CREWHUB_API_KEY" ] && [ -f ~/.crewhub/agent.json ]; then
  CREWHUB_API_KEY=$(jq -r '.auth.default_key // empty' ~/.crewhub/agent.json 2>/dev/null)
fi

AUTH_HEADER=""
[ -n "$CREWHUB_API_KEY" ] && AUTH_HEADER="-H \"X-API-Key: $CREWHUB_API_KEY\""

case "$1" in
  status)
    curl -sf "$CREWHUB_URL/health" && echo " CrewHub is healthy" || echo " CrewHub not reachable"
    ;;
  identify)
    # crewhub-cli.sh identify agent:dev agent:dev:main
    eval curl -sX POST "$CREWHUB_URL/api/self/identify" \
      $AUTH_HEADER \
      -H "Content-Type: application/json" \
      -d "{\"agent_id\": \"$2\", \"session_key\": \"$3\"}"
    ;;
  rooms)
    eval curl -s $AUTH_HEADER "$CREWHUB_URL/api/rooms" | jq -r '.rooms[] | "\(.icon // "📦") \(.name) [\(.id)]"'
    ;;
  sessions)
    eval curl -s $AUTH_HEADER "$CREWHUB_URL/api/sessions" | jq -r '.sessions[] | "\(.sessionKey) → \(.status // "active")"'
    ;;
  name)
    # crewhub-cli.sh name "My Dev Agent"
    eval curl -sX POST "$CREWHUB_URL/api/self/display-name" \
      $AUTH_HEADER \
      -H "Content-Type: application/json" \
      -d "{\"display_name\": \"$2\"}"
    ;;
  room)
    # crewhub-cli.sh room dev-room
    eval curl -sX POST "$CREWHUB_URL/api/self/room" \
      $AUTH_HEADER \
      -H "Content-Type: application/json" \
      -d "{\"room_id\": \"$2\"}"
    ;;
  manifest)
    eval curl -s $AUTH_HEADER "$CREWHUB_URL/api/discovery/manifest" | jq .
    ;;
  docs)
    # crewhub-cli.sh docs auth
    eval curl -s $AUTH_HEADER "$CREWHUB_URL/api/discovery/docs/$2"
    ;;
  agents)
    eval curl -s $AUTH_HEADER "$CREWHUB_URL/api/agents" | jq -r '.agents[] | "\(.icon) \(.name) [\(.id)] → \(.agent_session_key)"'
    ;;
  version)
    curl -s "$CREWHUB_URL/health" | jq -r '.version'
    ;;
  *)
    echo "Usage: crewhub-cli.sh <command> [args]"
    echo ""
    echo "Commands:"
    echo "  status                    Check if CrewHub is running"
    echo "  identify <agent_id> <key> Register yourself"
    echo "  name <display_name>       Set your display name"
    echo "  room <room_id>            Assign yourself to a room"
    echo "  rooms                     List available rooms"
    echo "  sessions                  List active sessions"
    echo "  manifest                  Show full capability manifest"
    echo "  docs <topic>              Fetch extended docs (auth|rooms|sessions|chat|sse|rules|workflows)"
    echo "  agents                    List registered agents"
    echo "  version                   Show CrewHub version"
    ;;
esac
```

### 7.6 Claude Code / CLAUDE.md Integration

For Claude Code projects, add a section to `CLAUDE.md`:

```markdown
## CrewHub Integration

CrewHub monitoring dashboard is running at http://localhost:8090.
Dashboard UI: http://localhost:5180.
Auth: X-API-Key header. Key in ~/.crewhub/agent.json.

### Quick API Reference

| Action | Method | Endpoint | Body |
|--------|--------|----------|------|
| Identify | POST | /api/self/identify | `{"agent_id": "...", "session_key": "..."}` |
| Set display name | POST | /api/self/display-name | `{"display_name": "..."}` |
| Assign to room | POST | /api/self/room | `{"room_id": "..."}` |
| List rooms | GET | /api/rooms | - |
| List sessions | GET | /api/sessions | - |
| SSE events | GET | /api/events | - |
| Extended docs | GET | /api/discovery/docs/{topic} | - |
```

### 7.7 Codex CLI / AGENTS.md Integration

```markdown
## CrewHub

API at http://localhost:8090. Auth: X-API-Key from ~/.crewhub/agent.json.
Identify: POST /api/self/identify with {"agent_id": "...", "session_key": "..."}
Set name: POST /api/self/display-name with {"display_name": "..."}
Assign room: POST /api/self/room with {"room_id": "..."}
List rooms: GET /api/rooms
Extended docs: GET /api/discovery/docs/{topic}
```

---

## 8. API Documentation for Agents

### 8.1 Machine-Readable API Spec

FastAPI automatically generates OpenAPI docs at `/api/docs` (Swagger UI) and `/api/redoc` (ReDoc). The JSON spec is at `/api/openapi.json`.

**Enhancement:** Update FastAPI metadata to guide agents:

```python
app = FastAPI(
    title="CrewHub API",
    description="Multi-agent orchestration and monitoring platform. "
                "For agent onboarding, start with GET /api/discovery/manifest. "
                "Auth: X-API-Key header. Scopes: read, self, manage, admin.",
    version="0.7.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)
```

### 8.2 Inline Examples

Every endpoint should include request/response examples in its FastAPI docstring. Agents parse OpenAPI examples directly. This is the canonical source for full parameter documentation.

### 8.3 Extended Docs vs OpenAPI

| Need | Use | Canonical For |
|------|-----|--------------|
| "What can CrewHub do?" | `/api/discovery/manifest` | Capability list + scopes |
| "How do I do X?" (workflow) | `/api/discovery/docs/workflows` | Narrative guides |
| "What are the exact parameters for POST /api/rooms?" | `/api/openapi.json` | Parameters + types |
| "Give me the 5 things I need" | SKILL.md (Tier 1) | Quick reference |

The extended docs endpoint bridges the gap between the manifest (what exists) and OpenAPI (exact parameters) by providing **narrative documentation with examples and context**.

**Sources of truth (to prevent drift):**
- **Capability list + scopes** → manifest (curated)
- **Endpoint parameters + types** → OpenAPI (auto-generated by FastAPI)
- **Workflows + recipes** → extended docs (Tier 2, curated)

### 8.4 Manifest-OpenAPI Drift Check

A lightweight test ensures the manifest stays consistent with the actual API:

```python
# tests/test_manifest_drift.py
def test_manifest_endpoints_exist_in_openapi():
    """Every endpoint listed in the manifest must exist in OpenAPI."""
    manifest = load_manifest()
    openapi = load_openapi_spec()
    openapi_paths = set(openapi["paths"].keys())

    for capability in manifest["capabilities"]:
        for endpoint in capability["endpoints"]:
            method, path = endpoint.split(" ", 1)
            # Normalize path params: /api/rooms/{id} → /api/rooms/{id}
            assert path in openapi_paths, (
                f"Manifest endpoint {endpoint} (capability: {capability['id']}) "
                f"not found in OpenAPI spec"
            )
```

This test runs in CI alongside the SKILL.md line-count check.

---

## 9. Self-Updating Knowledge

### 9.1 Version-Aware Capabilities

The manifest endpoint includes a `version` field. Agents can cache the manifest and re-fetch when the version changes:

```python
# Agent pseudocode
cached = load_cached_manifest()
live = fetch("/api/discovery/manifest")
if live.version != cached.version:
    update_cached_manifest(live)
    log("CrewHub updated from {cached.version} to {live.version}")
    new_caps = set(live.capabilities) - set(cached.capabilities)
    if new_caps:
        log(f"New capabilities available: {new_caps}")
```

### 9.2 Capability Metadata

Each capability in the manifest includes:

```json
{
  "id": "blueprints",
  "description": "Room layout blueprints (modding)",
  "since": "0.6.0",
  "stability": "beta",
  "deprecated_since": null,
  "scopes": {"read": ["GET"], "manage": ["POST", "PUT", "DELETE"]},
  "constraints": {}
}
```

- `since`: First version where this capability was available
- `stability`: `stable` | `beta` | `experimental` — agents can skip experimental features
- `deprecated_since`: Set when a capability is being phased out
- `constraints`: Machine-readable limits/flags (see capability definitions in Section 2.3)

### 9.3 Upgrade Path

When CrewHub adds a new feature:

1. Feature is added to the backend (new route, new capability)
2. Manifest is updated (manually curated in Phase 1–3; auto-generated later)
3. Extended docs topic is added/updated
4. SKILL.md is only updated if the feature is essential enough for Tier 1 (and still fits the 120-line budget)
5. `~/.crewhub/agent.json` is regenerated on next startup with new version
6. Agents that check the manifest periodically discover the new capability

**Note:** Auto-generating the manifest from FastAPI router metadata is deferred to a later phase. A manually curated manifest is more reliable and stable in early versions.

---

## 10. Multi-Agent Awareness

### 10.1 Agent Discovery Through CrewHub

Agents can discover each other by querying CrewHub:

```bash
# Who else is active?
curl -s http://localhost:8090/api/sessions | jq '.sessions[] | {key: .sessionKey, status: .status}'

# Who's registered?
curl -s http://localhost:8090/api/agents | jq '.agents[] | {id, name, session_key: .agent_session_key}'

# Who's in the dev room?
curl -s http://localhost:8090/api/session-room-assignments/room/dev-room \
  | jq '.assignments[] | .session_key'
```

### 10.2 Room-Based Collaboration Patterns

#### Pattern: War Room

All agents working on an urgent issue join the same room.

```bash
# Create a war room (requires manage scope)
POST /api/rooms
{"id": "incident-2026-02-05", "name": "🚨 Production Incident", "icon": "🚨", "color": "#ef4444"}

# Route all agents there
POST /api/room-assignment-rules
{"room_id": "incident-2026-02-05", "rule_type": "label_pattern", "rule_value": "incident|hotfix|urgent", "priority": 100}
```

#### Pattern: Specialist Rooms

```
🏠 Headquarters     — main agent, coordination
💻 Dev Room         — coding agents, dev subagents
🎨 Creative Corner  — content generation, design
🔍 Review Room      — code review, QA
⚡ Ops Center       — deployment, monitoring, ops
```

#### Pattern: Project Rooms

```
🌐 Website Redesign  — label_pattern: website|redesign
📱 Mobile App         — label_pattern: mobile|app
🛠️ Infrastructure     — label_pattern: infra|devops|deploy
```

### 10.3 SSE for Real-Time Awareness

#### Delivery Contract

**Semantics: At-least-once delivery.** Clients must be prepared to receive duplicate events and should dedupe by `event_id`. This is inherent to the SSE + replay model — a reconnect may re-deliver events the client already processed before the connection dropped.

**Ordering: Strictly monotonic per server process.** Event IDs are generated as `evt_<unix_timestamp>_<sequence>` where the sequence counter increments monotonically. Within a single server process, events are guaranteed to arrive in order. After a server restart, the sequence resets (see "Server Restart" below).

**Buffer: In-memory only.** The event buffer (last 1000 events or 5 minutes, whichever is smaller) is held in server memory. It is **not persisted** across server restarts. This is a deliberate simplicity trade-off for a local-first tool.

**Server restart behavior:**
1. Event buffer is empty after restart
2. Any `Last-Event-ID` from a client will not be found in the buffer
3. Server sends a `snapshot` event with full current state
4. Normal incremental events resume from there
5. The `snapshot` event includes `last_event_id` (the ID assigned to the snapshot itself) so clients can resume cleanly after processing it

#### Event Types

| Event Type | Payload | When Fired |
|------------|---------|------------|
| `session.created` | `{"session_key": "...", "agent_id": "...", "label": "..."}` | New session connects |
| `session.updated` | `{"session_key": "...", "changes": {...}}` | Session metadata changes (model, tokens, status) |
| `session.deleted` | `{"session_key": "..."}` | Session disconnects |
| `room.created` | `{"room": {...}}` | Room created |
| `room.updated` | `{"room": {...}}` | Room modified |
| `room.deleted` | `{"room_id": "..."}` | Room deleted |
| `assignment.changed` | `{"session_key": "...", "room_id": "...", "action": "assigned\|unassigned"}` | Room assignment changes |
| `rules.updated` | `{"count": N}` | Assignment rules changed |
| `snapshot` | `{"sessions": [...], "rooms": [...], "assignments": [...], "last_event_id": "..."}` | Full state (on reconnect miss or server restart) |
| `heartbeat` | `{}` | Keepalive (every 30 seconds) |

**Backwards compatibility:** The `sessions-refresh` (full snapshot) event continues to fire at a configurable interval (default: 30 seconds, down from 5) for clients that depend on it. New clients should use incremental events.

#### Event ID and Reconnect

Every event includes an `id` field for reconnection:

```
id: evt_1707134400_42
event: session.created
data: {"session_key": "agent:dev:subagent:abc", "agent_id": "agent:dev", "label": "frontend-fix"}

id: evt_1707134401_43
event: assignment.changed
data: {"session_key": "agent:dev:subagent:abc", "room_id": "dev-room", "action": "assigned"}
```

**Event ID format:** `evt_<unix_timestamp>_<sequence>`

#### Reconnect Semantics

When an SSE connection drops, the client reconnects with:

```
GET /api/events
Last-Event-ID: evt_1707134400_42
```

The server:
1. Checks if the requested event ID is still in the buffer (last 1000 events or 5 minutes)
2. If yes: replays all events after that ID, then continues live. **Clients must dedupe** — events delivered before the disconnect may be re-delivered.
3. If no (too old or post-restart): sends a `snapshot` event with full current state including `last_event_id`, then continues live

This guarantees no missed events on short disconnects, and graceful recovery on long disconnects or server restarts.

#### Reconnect Backoff Strategy

Agents should implement exponential backoff on SSE reconnect:

```
Attempt 1: wait 1 second
Attempt 2: wait 2 seconds
Attempt 3: wait 4 seconds
Attempt 4: wait 8 seconds
...
Maximum: wait 60 seconds
Reset on successful connection (first event received)
```

Add jitter: `actual_wait = base_wait * (0.5 + random() * 1.0)`

#### Compact Mode

For bandwidth-sensitive agents:

```
GET /api/events?compact=1
```

In compact mode:
- `session.updated` only includes changed fields, not full session
- `sessions-refresh` snapshots are suppressed
- Payload size reduced ~60%

#### SSE Connection Example

```python
import requests
import time
import random

CREWHUB_URL = "http://localhost:8090"
last_event_id = None
seen_ids = set()  # dedupe buffer
backoff = 1

while True:
    try:
        headers = {"X-API-Key": api_key}
        if last_event_id:
            headers["Last-Event-ID"] = last_event_id

        response = requests.get(f"{CREWHUB_URL}/api/events", stream=True, headers=headers)
        backoff = 1  # reset on successful connect

        for line in response.iter_lines():
            if not line:
                continue
            line = line.decode("utf-8")
            if line.startswith("id: "):
                current_id = line[4:]
                if current_id in seen_ids:
                    continue  # dedupe
                seen_ids.add(current_id)
                last_event_id = current_id
                # Trim dedupe buffer to last 2000 IDs
                if len(seen_ids) > 2000:
                    seen_ids = set(list(seen_ids)[-1000:])
            elif line.startswith("event: "):
                event_type = line[7:]
            elif line.startswith("data: "):
                data = json.loads(line[6:])
                if event_type == "snapshot":
                    # Full state reset — rebuild local state from snapshot
                    reset_state(data)
                    last_event_id = data.get("last_event_id", last_event_id)
                else:
                    handle_event(event_type, data)

    except (requests.ConnectionError, requests.Timeout):
        jitter = backoff * (0.5 + random.random())
        time.sleep(jitter)
        backoff = min(backoff * 2, 60)
```

### 10.4 Coordination via Display Names (Today)

As a practical workaround (no extra infrastructure), agents use display names to signal status:

```bash
# Agent signals it's working on something specific
POST /api/self/display-name
{"display_name": "Dev Agent (working on: auth refactor)"}
```

Other agents can read display names to understand what's happening:

```bash
curl -s http://localhost:8090/api/session-display-names \
  | jq '.display_names[] | {key: .session_key, name: .display_name}'
```

### 10.5 Future: Room Messaging

Room-level messaging (agents leaving messages in rooms for each other) is deferred until there's a clear use case that can't be met with existing chat + display name signals. When built, it will need:

- Retention policy (auto-expire after N hours)
- Access control (room membership = read access)
- Rate limiting (prevent spam)
- Clear distinction from existing chat (chat = human↔agent, room messages = agent↔agent)

---

## 11. Implementation Plan

### Phase 1: Foundation + Auth + Identity (3-4 days)

**Goal:** An agent can discover CrewHub, authenticate, identify itself, and set basic metadata.

| Task | Effort | Priority |
|------|--------|----------|
| Implement `/api/discovery/manifest` endpoint (manually curated) | 3h | P0 |
| Implement API key system (create, verify, scopes, binding rules) | 5h | P0 |
| Implement `/api/self/*` endpoints (identify, display-name, room) with identity binding | 5h | P0 |
| Write `~/.crewhub/agent.json` on startup (with `self` key, 0600 perms) | 2h | P0 |
| Write `~/.crewhub/api-keys.json` on first startup (with `admin` key, 0600 perms) | 1h | P0 |
| Add `CREWHUB_URL` and `CREWHUB_API_KEY` env vars to Docker Compose | 30m | P0 |
| Update `/health` to return version info | 30m | P1 |
| Update FastAPI OpenAPI metadata (title, description, scopes) | 30m | P1 |
| Add permission middleware (scope checking per endpoint) | 3h | P0 |
| Add identity creation rate limiting (10/hour/key) | 1h | P0 |

**Deliverables:**
- Auth system with 4 scopes + identity binding rules
- `/api/self/*` endpoints live with spoofing prevention
- `/api/discovery/manifest` endpoint live (with `constraints` per capability)
- `~/.crewhub/agent.json` auto-created on startup with `self`-scoped key
- All existing endpoints protected by appropriate scopes

### Phase 2: Skill, Docs & SSE Reliability (3-4 days)

**Goal:** Agents have consumable tiered documentation; SSE is reliable for production use.

| Task | Effort | Priority |
|------|--------|----------|
| Create minimal SKILL.md (Tier 1, ~80 lines, CI budget check) | 2h | P0 |
| Implement `/api/discovery/docs/{topic}` endpoint with ETag | 3h | P0 |
| Write extended docs for core topics (auth, identity, rooms, sessions, sse) | 4h | P0 |
| Add `event_id` to all SSE events (monotonic sequence) | 2h | P0 |
| Implement `Last-Event-ID` reconnect with in-memory event buffer (1000 events) | 3h | P0 |
| Add `snapshot` event with `last_event_id` for buffer-miss recovery | 2h | P0 |
| Add incremental event types (session.created, room.updated, etc.) | 3h | P1 |
| Add SSE `compact` mode | 1h | P2 |
| Create `crewhub-cli.sh` helper script | 2h | P1 |
| Create `CLAUDE.md` snippet template | 1h | P1 |
| Create `AGENTS.md` snippet template | 1h | P1 |
| Add manifest-OpenAPI drift test | 1h | P1 |

**Deliverables:**
- Tiered documentation (minimal SKILL.md + extended docs endpoint with ETag caching)
- Reliable SSE with at-least-once delivery, reconnect support, snapshot fallback
- Incremental events alongside legacy snapshot events
- Helper CLI and framework templates
- CI checks: SKILL.md budget + manifest drift

### Phase 3: Auto-Registration & Refinement (2-3 days)

**Goal:** Agents auto-register when they read the skill; edge cases handled.

| Task | Effort | Priority |
|------|--------|----------|
| Add startup hook in skill: auto-identify + set name + assign room | 3h | P1 |
| Add room assignment rule presets (common patterns) | 2h | P1 |
| Add default display name generation from session key | 1h | P2 |
| Add Docker / remote `reachable_from` support in agent.json | 2h | P1 |
| Add `Idempotency-Key` header support | 2h | P2 |
| Write extended docs for remaining topics (chat, rules, blueprints, workflows) | 3h | P1 |

**Deliverables:**
- Agents that read the CrewHub skill auto-register on startup
- Pre-configured room assignment rules for common patterns
- Full extended docs coverage

### Phase 4: Enhanced Discovery + Strict Mode (2-3 days)

**Goal:** Manifest stays current automatically; strict mode for security-conscious setups.

| Task | Effort | Priority |
|------|--------|----------|
| Auto-generate manifest from FastAPI router metadata | 4h | P2 |
| Add `/api/discovery/changelog` endpoint | 2h | P2 |
| Add capability `deprecated_since` support | 1h | P2 |
| Implement `auth.strict_mode` setting (full) | 2h | P2 |
| Implement `auth.manifest_public` setting | 1h | P2 |
| Package as OpenClaw skill (if skill distribution exists) | 2h | P2 |

**Deliverables:**
- Manifest auto-reflects actual API state
- Changelog for agents to discover changes
- Full strict auth mode for shared/remote deployments

### Phase 5: Multi-Agent Coordination (3-5 days)

**Goal:** Agents can coordinate through CrewHub beyond display names.

| Task | Effort | Priority |
|------|--------|----------|
| Agent presence heartbeat system (via `/api/self/heartbeat`) | 3h | P2 |
| "Who's in this room" enriched query (with display names + status) | 2h | P2 |
| Room messaging (if needed — evaluate first) | 6h | P3 |
| Inter-agent notification mechanism | 4h | P3 |

**Deliverables:**
- Agent presence with status signals
- Enriched room queries
- (Conditional) Room-level messaging

### Phase 6: Community & Distribution (2-4 days)

**Goal:** Polished, distributable onboarding experience.

| Task | Effort | Priority |
|------|--------|----------|
| Publish CrewHub skill to GitHub | 2h | P2 |
| Create onboarding tutorial for docs.crewhub.dev | 4h | P2 |
| Add "Agent Integration" section to README | 2h | P1 |
| Onboarding wizard in CrewHub UI (generate keys, test connection) | 4h | P3 |

**Deliverables:**
- Skill published and discoverable
- Documentation on docs.crewhub.dev
- README updated with agent integration info

### Dependency Graph

```
Phase 1: Foundation + Auth + Identity
   ├── Phase 2: Skill, Docs & SSE Reliability
   │    └── Phase 3: Auto-Registration & Refinement
   │         └── Phase 4: Enhanced Discovery + Strict Mode
   │              └── Phase 5: Multi-Agent Coordination
   │                   └── Phase 6: Community & Distribution
```

### Total Effort Estimate

| Phase | Days | Priority |
|-------|------|----------|
| Phase 1: Foundation + Auth + Identity | 3-4 | **Must have** |
| Phase 2: Skill, Docs & SSE Reliability | 3-4 | **Must have** |
| Phase 3: Auto-Registration & Refinement | 2-3 | **Should have** |
| Phase 4: Enhanced Discovery + Strict Mode | 2-3 | **Nice to have** |
| Phase 5: Multi-Agent Coordination | 3-5 | **Nice to have** |
| Phase 6: Community & Distribution | 2-4 | **Nice to have** |
| **Total** | **15-23 days** | |

---

## 12. Appendices

### Appendix A: Edge Cases

#### Agent Has No Internet

**Solution:** All discovery is local. `~/.crewhub/agent.json` is written on CrewHub startup. The manifest endpoint is served locally. SKILL.md is bundled with the skill. No internet required for any onboarding step.

#### Multiple CrewHub Instances

**Solution:** `CREWHUB_URL` env var specifies which instance. If multiple are running, `~/.crewhub/agent.json` points to the last one started (last-write-wins). For multi-instance setups, use distinct env vars:

```bash
export CREWHUB_URL=http://localhost:8090          # Primary
export CREWHUB_URL_STAGING=http://staging:8090    # Staging
```

#### CrewHub Version Mismatch

**Solution:** The manifest includes `version`, `manifest_schema_version`, and each capability has a `since` field. Agents check compatibility before using features:

```python
manifest = fetch_manifest()
if manifest.get("manifest_schema_version") != 1:
    log("Unknown manifest schema, falling back to basic operations")
    return use_basic_mode()

if version_compare(manifest["version"], "0.7.0") < 0:
    log("CrewHub too old for /api/self/* endpoints, using direct endpoints")
    use_legacy_mode()
```

#### Agent Framework Doesn't Support Skills

**Solution:** The `/api/discovery/manifest` endpoint is framework-agnostic. Any agent that can make HTTP requests can use it. For raw LLMs with no tool use, include the MVK (Section 5.3) in the system prompt.

#### CrewHub Not Running

**Solution:** All discovery methods fail gracefully:
- Env var → port probe fails → agent continues without CrewHub
- Config file → stale data but includes `api_url` to check → probe fails → skip
- Port probe → connection refused → skip

Agents should treat CrewHub as **optional**. Missing CrewHub should never block agent operation.

#### Docker Networking

**Solution:** The `reachable_from` field in `agent.json` provides per-context URLs:

```json
{
  "reachable_from": {
    "host": "http://localhost:8090",
    "docker": "http://host.docker.internal:8090",
    "remote": "https://crewhub.example.com"
  }
}
```

Agents should try `reachable_from.docker` first if they detect they're in a container (check for `/.dockerenv` or `DOCKER_HOST` env var), then fall back to `api_url`.

### Appendix B: Full Endpoint Reference

#### Current API Surface (v0.7.0)

| Group | Prefix | Endpoints |
|-------|--------|-----------|
| Health | `/` | `GET /health`, `GET /ready` |
| Root | `/` | `GET /` (name, version, status) |
| **Self** | `/api/self` | `POST /identify`, `GET /`, `POST /display-name`, `POST /room`, `POST /heartbeat` |
| **Auth** | `/api/auth` | `POST /keys`, `GET /keys`, `DELETE /keys/{id}`, `GET /keys/self` |
| Sessions | `/api/sessions` | `GET`, `GET /{key}/history`, `PATCH /{key}`, `DELETE /{key}`, `POST /spawn` |
| Agents | `/api/agents` | `GET`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}` |
| Rooms | `/api/rooms` | `GET`, `GET /{id}`, `POST`, `PUT /{id}`, `DELETE /{id}`, `PUT /{id}/hq`, `POST /{id}/project`, `DELETE /{id}/project`, `PUT /reorder` |
| Room Assignments | `/api/session-room-assignments` | `GET`, `GET /{key}`, `POST`, `DELETE /{key}`, `GET /room/{room_id}`, `POST /batch` |
| Display Names | `/api/session-display-names` | `GET`, `GET /{key}`, `POST /{key}`, `DELETE /{key}` |
| Assignment Rules | `/api/room-assignment-rules` | `GET`, `GET /{id}`, `POST`, `PUT /{id}`, `DELETE /{id}`, `PUT /bulk`, `GET /room/{room_id}` |
| Chat | `/api/chat` | `GET /{key}/history`, `POST /{key}/send`, `GET /{key}/info` |
| SSE | `/api` | `GET /events`, `POST /notify` |
| Connections | `/api/connections` | `GET`, `GET /{id}`, `POST`, `PATCH /{id}`, `DELETE /{id}`, `POST /{id}/connect`, `POST /{id}/disconnect`, `GET /{id}/health`, `GET /{id}/sessions` |
| Blueprints | `/api/blueprints` | `GET`, `GET /{id}`, `POST`, `PUT /{id}`, `DELETE /{id}`, `POST /import`, `GET /export/{id}` |
| Projects | `/api/projects` | `GET`, `POST`, etc. |
| Discovery | `/api/discovery` | `GET /manifest`, `GET /docs/{topic}`, `POST /scan`, `POST /test` |
| Settings | `/api/settings` | `GET`, `GET /{key}`, `PUT /{key}`, `DELETE /{key}`, `PUT /batch` |
| Onboarding | `/api/onboarding` | `GET /status` |
| Backup | `/api/backup` | (backup/restore endpoints) |
| Gateway | `/api/gateway` | (gateway status) |
| Cron | `/api/cron` | (cron job monitoring) |
| History | `/api/sessions/archived` | (session history/archive) |

#### New Endpoints (v3 plan)

| Endpoint | Purpose | Phase |
|----------|---------|-------|
| `POST /api/self/identify` | Agent self-identification (with binding rules) | Phase 1 |
| `GET /api/self` | Get own session info | Phase 1 |
| `POST /api/self/display-name` | Set own display name | Phase 1 |
| `POST /api/self/room` | Set own room | Phase 1 |
| `POST /api/self/heartbeat` | Agent presence heartbeat | Phase 5 |
| `POST /api/auth/keys` | Create API key (with optional agent_id binding) | Phase 1 |
| `GET /api/auth/keys` | List API keys | Phase 1 |
| `DELETE /api/auth/keys/{id}` | Revoke API key | Phase 1 |
| `GET /api/auth/keys/self` | Get own key info | Phase 1 |
| `GET /api/discovery/manifest` | Capability manifest (with constraints) | Phase 1 |
| `GET /api/discovery/docs/{topic}` | Extended docs per topic (with ETag) | Phase 2 |
| `GET /api/discovery/changelog` | Machine-readable changelog | Phase 4 |

### Appendix C: SSE Event Reference

See [Section 10.3](#103-sse-for-real-time-awareness) for the full SSE specification including delivery contract, event types, reconnect semantics, and backoff strategy.

### Appendix D: Design Decisions & Rationale

#### Why a Manifest Endpoint (Not Just OpenAPI)?

OpenAPI is comprehensive but overwhelming for first contact. The manifest endpoint is a curated, agent-friendly summary designed for progressive disclosure. Think of it as the difference between a dictionary and a phrasebook — agents need the phrasebook first.

#### Why File-Based Discovery Too?

Some agents start before CrewHub, or CrewHub may restart. The `~/.crewhub/agent.json` file provides a stable reference that survives service restarts. It's also readable without making HTTP requests, which matters for agents with restricted network access.

#### Why API Keys Over OAuth/JWT?

For a local service, API keys are the simplest auth mechanism that provides scoping. OAuth is overkill for localhost. JWT adds complexity (signing keys, expiration, refresh) without benefit for this use case. If CrewHub ever becomes a multi-tenant cloud service, JWT can be layered on top.

#### Why `/api/self/*` Endpoints?

Agents in non-OpenClaw runtimes may not reliably know their session key. `/api/self/*` endpoints resolve identity server-side, reducing agent complexity and preventing footgun scenarios where an agent accidentally modifies another agent's data.

#### Why Tiered Documentation Instead of One Big SKILL.md?

Token costs are real. A 300-line SKILL.md costs ~800 tokens per load. An 80-line minimal SKILL.md costs ~350 tokens. For an agent that loads the skill on every session, that's 450 saved tokens × N sessions per day. Extended docs are fetched on-demand only when needed, amortized across sessions.

#### Why Not WebSocket for Agent Communication?

CrewHub's SSE approach is simpler, more reliable, and sufficient for the current use case (broadcast updates to viewers). WebSocket would be needed for bidirectional real-time agent communication — that's Phase 5+ territory. SSE with `Last-Event-ID` reconnect provides reliable delivery without WebSocket complexity.

#### Why Manually Curated Manifest First?

Auto-generating the manifest from FastAPI router metadata sounds appealing but is non-trivial to do well (grouping, descriptions, scope annotations, stability labels). A wrong manifest is worse than a manually maintained one. Start manual, automate later when the schema is stable.

#### Why Room Assignment Rules Over Manual Assignment?

Rules scale. If an agent spawns 20 subagents, rules automatically route them to the right rooms. Manual assignment requires 20 API calls. Rules are the "set it and forget it" approach that makes CrewHub useful without constant agent interaction.

#### Why `self` Scope as Default Key (Not `admin`)?

The default auto-discoverable key in `agent.json` has `self` scope instead of `admin`. This limits blast radius: an autonomous agent (or untrusted process) that discovers the key can only manage its own session — not delete other agents, change settings, or modify rooms. The `admin` key is available in `api-keys.json` for human operators who need it. This follows the principle of least privilege while maintaining the "it just works" experience.

#### Why Four Coarse Scopes?

CrewHub is a local-first tool. Fine-grained scopes (`manage_rooms`, `manage_agents`, `manage_world`) would add configuration burden without practical benefit for the primary use case (single developer with a few agents). Four scopes cover the real-world permission patterns: "can only read" → "can manage self" → "can manage others" → "can do everything." If fine-grained needs emerge, sub-scopes can be added as `manage:rooms`, `manage:agents` without breaking the existing model.

### Appendix E: Glossary

| Term | Definition |
|------|-----------|
| **agent_id** | Stable identifier for a logical agent across restarts and runtimes. Format: `<runtime>:<name>`. Example: `agent:dev`. Stored in agent registry. |
| **session_key** | Ephemeral identifier for a specific runtime session. Format varies by runtime (e.g., `agent:dev:main` for OpenClaw). Changes per session/restart for subagents. |
| **scope** | Permission level for an API key: `read`, `self`, `manage`, `admin`. See Section 3.3 for details. |
| **API key** | Authentication token sent via `X-API-Key` header. Format: `chk_<scope_hint>_<random>`. Bound to scopes and optionally to an agent_id. |
| **bound key** | An API key linked to a specific `agent_id`. The caller can only operate as that agent. See Section 4.5. |
| **unbound key** | An API key not linked to any `agent_id`. Identity is resolved from request body or gateway metadata. |
| **manifest** | The JSON response from `/api/discovery/manifest` describing all CrewHub capabilities, auth requirements, and quick start guide. |
| **room** | A named group/workspace in CrewHub's 3D world. Agents are assigned to rooms for organization and collaboration. |
| **assignment rule** | An automatic rule that routes sessions to rooms based on criteria (keyword, model, label pattern, etc.). |
| **blueprint** | A custom 3D room layout definition (modding system). |
| **SSE** | Server-Sent Events — one-way event stream from server to client for real-time updates. At-least-once delivery; clients must dedupe by event_id. |
| **event_id** | Unique identifier for each SSE event. Format: `evt_<timestamp>_<sequence>`. Used for reconnect via `Last-Event-ID`. Monotonically increasing per server process. |
| **snapshot** | A special SSE event containing full system state, sent when a client's `Last-Event-ID` is no longer in the buffer (or after server restart). |
| **MVK** | Minimum Viable Knowledge — the smallest amount of information an agent needs to interact with CrewHub (~12 lines, ~350 tokens). |
| **Tier 1 docs** | Minimal SKILL.md loaded into agent context. ~80 lines, ~350 tokens. Hard budget: 120 lines / 500 tokens (CI-enforced). |
| **Tier 2 docs** | Extended documentation fetched on-demand via `/api/discovery/docs/{topic}`. Supports ETag caching. |
| **local-trust** | Default auth mode where a `self`-scoped key is auto-discoverable via filesystem. Appropriate for single-user machines. |
| **strict mode** | Auth mode where keys must be explicitly distributed. No auto-discoverable keys in `agent.json`. For shared/remote deployments. |
| **identity binding** | Rules that prevent identity spoofing. Bound keys lock agent_id; unbound keys have restrictions on creating new identities. See Section 4.5. |

---

*End of masterplan v3 (FINAL). Next step: Build Phase 1 — auth system with identity binding, `/api/self/*` endpoints, manifest endpoint with constraints, and config file generation with proper permissions.*
