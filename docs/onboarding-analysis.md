# CrewHub Onboarding & Auto‑Discovery Analysis (First‑Run Experience)

**Goal:** Make CrewHub feel instantly useful on first run by automatically finding existing agent runtimes (OpenClaw, Claude Code, Codex CLI) and guiding the user to a *live dashboard* with minimal configuration.

**North Star metric:** *Time-to-first-live-agent* (TTFLA) — time from opening CrewHub to seeing at least one agent/session streaming status.

---

## 1) Jobs‑To‑Be‑Done (JTBD) Analysis

### Personas & assumptions
CrewHub has a rare mix of users:
- developers who run agents locally and want visibility,
- technical leads who need oversight across machines,
- OSS explorers who decide in minutes whether to adopt,
- agencies that manage multiple client environments and frameworks.

### JTBD matrix (persona × job × pain points × solutions)

| Persona | Primary Job (JTBD) when installing CrewHub | Expected Time‑to‑Value | Current / likely friction today | “Magical” onboarding outcome | Product solutions to deliver magic |
|---|---|---:|---|---|---|
| **Solo developer** (OpenClaw on Mac) | “Show me what my agents are doing right now and help me debug/monitor them.” | **< 60 seconds** to see local agents | Doesn’t know what runtime URL/port/token is; doesn’t know if OpenClaw is running; manual config feels like work; fear of misconfig or security tokens | CrewHub opens → instantly shows **OpenClaw detected** + number of active sessions; one click “Connect”; dashboard populates automatically | Default localhost probing; config file detection; clear status & “Start OpenClaw” guidance; auto-create sensible rooms; remember choice; no-token local mode with warning if applicable |
| **Team lead** (multiple machines) | “Get visibility across our team’s agent activity, sessions, and errors without being a devops project.” | **2–5 minutes** to add first machine; **< 15 min** to cover team | Needs cross-machine discovery; credentials/tokens; firewall/VPN; uncertainty who’s running what; must avoid scanning causing security concerns; wants repeatable setup | CrewHub detects local + LAN nodes; suggests “Team Mode”; provides **shareable invite / pairing** workflow; shows real-time activity across hosts | mDNS discovery + explicit permission; pairing tokens; QR code or copy-paste connection link; role-based access; “Add another machine” wizard; readiness checks |
| **Open source contributor** (first time) | “Evaluate quickly: does this work with my setup, and is it worth contributing to?” | **< 2 minutes** to see something real (or a guided demo) | May not have any runtime running; unclear prerequisites; confusion between frameworks; any blank screen is failure; docs fatigue | CrewHub offers “Scan” and also “Try Demo Data” mode; if nothing found, clear steps to start a runtime; contributor-friendly logs and links to docs | Discovery that explains what was checked; actionable next steps (“Install OpenClaw”, “Start Claude Code MCP server”); demo mode; telemetry opt-in, never default; easy bug report export |
| **Agency** (multiple frameworks, clients) | “Standardize monitoring across many agent stacks and environments; onboard new client environments fast.” | **10–30 minutes** for first client environment; minutes thereafter | Needs multi-tenant separation; differing tokens; remote networks; compliance; must avoid accidental scans; wants templates and automation | Wizard supports multiple runtimes, labels, environments; exports/imports connection profiles; detects frameworks and suggests best connector; strict permission boundaries | Connection profiles (YAML/JSON) import/export; environment tags; scanning is opt-in + scope-limited; audit trail; secrets management integration (env vars, vault) |

### Design principles derived from JTBD
1. **Never show an empty dashboard on first run** (either real connections or demo data + next steps).
2. **Explain what’s happening**: discovery must be transparent and non-creepy.
3. **Default to local, ask for LAN** (permission & scope).
4. **Make success a single click** (connect, test, proceed).
5. **Offer “power user escape hatches”** (manual URLs, tokens, advanced settings).

---

## 2) Auto‑Discovery System — Technical Spec

### Objectives
- Identify supported runtimes installed and/or running.
- Determine likely connection parameters (URL, auth token, protocol).
- Validate with a lightweight handshake.
- Return actionable results to UI with confidence levels.

### Discovery modes
- **Passive/local checks (default, no prompts):**
  - localhost port probes (well-known ports)
  - local config file presence
  - local CLI presence (`--version`)
  - local process inspection (best-effort)

- **Active network discovery (opt-in):**
  - mDNS/Bonjour browse for advertised services
  - optional subnet scan **only with explicit user consent and scope selection**

### Result model (recommended)
Each discovered “candidate” should include:
- `runtimeType`: `openclaw | claude_code | codex_cli | unknown`
- `discoveryMethod`: `port_probe | config_file | cli_detect | mdns | subnet_scan | manual`
- `target`: `{ url, host, port, transport }`
- `auth`: `{ required, tokenHint, tokenValue?: redacted }`
- `confidence`: `high | medium | low`
- `status`: `reachable | unreachable | auth_required | incompatible | unknown`
- `evidence`: list of checks that led to this result (for transparency)
- `metadata`: versions, active sessions count (if obtainable), machine name (if LAN), etc.

### OpenClaw discovery
**Signals**
1. **Localhost WebSocket probe**
   - Try `ws://localhost:18789` (and optionally `127.0.0.1`).
   - Handshake expectation: if OpenClaw exposes an identifiable “hello” / version message, read it; otherwise treat successful WS connection as medium confidence.
2. **Config file detection**
   - Look for `~/.openclaw/config.json` (and potentially additional known paths).
   - Extract default port, auth, and host binding if present.
   - If config indicates non-default port, probe that.
3. **Process inspection (best-effort)**
   - Look for running `openclaw`/gateway process; infer listening port if possible.
4. **LAN discovery (opt-in)**
   - **mDNS/Bonjour:** OpenClaw instances advertise `_openclaw._tcp` (ideal). If OpenClaw doesn’t yet advertise, CrewHub can still browse for custom service names if documented.
   - If no mDNS: optionally allow user to add `host:port` manually.

**Validation**
- Attempt connection; if it supports an endpoint to query active sessions, return `activeSessions`.
- If token required, return `auth_required` plus where to obtain token.

### Claude Code discovery
**Signals**
1. **CLI presence**
   - Run `claude --version`.
2. **MCP server mode detection**
   - If Claude Code supports MCP server, look for known default port / socket.
   - Check known session/state directories (if documented) to infer whether it’s used.
3. **Process inspection**
   - Find processes matching `claude` and relevant server flags.

**Validation**
- Prefer a defined health endpoint or handshake; otherwise, treat as “installed but not running” with clear next steps.

### Codex CLI discovery
**Signals**
1. **CLI presence**: `codex --version`
2. **Process inspection**: `ps` for codex server modes (if any)
3. **Known ports** (if Codex offers a service mode): probe if documented.

**Validation**
- Similar: if only a CLI tool, the onboarding should phrase it as “Installed, but needs connector mode / agent runtime to monitor”.

### General discovery algorithm (first run)
1. If **no connections exist in DB** → start onboarding wizard.
2. Immediately run **local passive discovery** (fast, <2–5 seconds target).
3. Stream results to UI as they arrive.
4. If nothing found:
   - Offer “Start a runtime” guide and “Use demo data”.
   - Offer optional “Scan my LAN (requires permission)”.

### Performance and safety constraints
- Time budget for default scan: **≤ 5 seconds**.
- Never scan network ranges without explicit user consent.
- Avoid noisy probes (rate-limit, short timeouts).
- Redact tokens and secrets by default in UI/logs.

---

## 3) Onboarding Flow Design (text wireframes)

### Entry condition
- If `connections.count === 0` AND `localStorage.crewhub-onboarded !== true` → show wizard.
- If user skips onboarding, still allow “Run discovery scan” from settings.

### Step 1 — Welcome
```
[ CrewHub logo ]
Monitor your AI agents across runtimes.

(Primary)  Let’s find your agents
(Secondary) Use demo data
(Tertiary)  I’ll configure manually

Small print: We’ll only scan your computer by default. LAN scanning requires permission.
```

### Step 2 — Auto‑Scan (streaming)
```
Scanning for agent runtimes…   [spinner]

Discovered
- OpenClaw  ✅ Reachable  localhost:18789   (3 active sessions)
  [Connect] [Details]

- Claude Code ✅ Installed  claude v1.2.3  (not running)
  [How to enable monitoring]

- Codex CLI ❌ Not found
  [Install guide]

[Scan again]   [Scan my LAN…]  (requires permission)
(Primary) Continue
```

**Details drawer (per runtime)**
- Evidence: “Port probe succeeded”, “Config found at …”, “Version …”
- Editable fields: URL, token, name/label
- “Test connection” button with immediate feedback

### Step 3 — Configure Connections
```
Choose what to connect:

[✓] OpenClaw (local)   URL: ws://localhost:18789   Token: [••••••]  [Test]
[ ] Claude Code        Status: installed only      [Setup]
[+] Add connection manually

(Primary) Save & continue
(Secondary) Back
```

### Step 4 — Room Setup (optional, defaults-first)
```
Set up your workspace (optional)

Suggested rooms
- “Local Dev”  (OpenClaw)   [Create]
- “Errors & Alerts”         [Create]

Or: [Use defaults]

(Primary) Continue
```

### Step 5 — Ready + quick tour
```
You’re connected!
- OpenClaw: 3 active sessions streaming

(Primary) Go to dashboard
(Secondary) Invite another machine

Tour highlights (dismissible)
- Rooms: group agents by purpose
- Live sessions: inspect logs + tool calls
- 3D world (optional): visualize activity
```

### “Nothing found” variant (critical)
```
We didn’t find any running agent runtimes.

(Primary) Start OpenClaw (recommended)
- Install / start instructions
- Button: “I started it, scan again”

(Secondary) Use demo data
(Tertiary) Configure manually
(Optional) Scan my LAN… (permission required)
```

---

## 4) Technical Architecture (no code, design only)

### Backend
**Endpoint:** `POST /api/discovery/scan`
- Request: `{ mode: 'local' | 'lan', lanOptions?: { mdns: boolean, subnet?: string } }`
- Response: streamed (SSE/websocket) or chunked list.
  - Prefer streaming so the UI feels “alive”.

**Service:** `backend/app/services/discovery.py`
- Pluggable “detectors” per runtime.
- Each detector produces `DiscoveryCandidate` objects.
- Validation step optionally refines candidate (e.g., session count).

**Data storage**
- Connections stored in DB as first-class objects.
- Add `discoveredBy` metadata for support/debug.
- Never persist raw secrets unless user explicitly saves them.

### Frontend
**Component:** `OnboardingWizard.tsx`
- Steps: Welcome → Scan → Configure → Rooms → Ready.
- Maintains `onboardingState` in memory; persists completion flag.

**State flags**
- `localStorage.crewhub-onboarded = true` after step 5.
- If DB has connections, onboarding is skipped regardless of localStorage.

**UX: transparency + control**
- “What did we scan?” link that shows a concise explanation.
- Inline error messages with next steps.

---

## 5) Network Discovery (LAN)

### Recommended approach hierarchy
1. **mDNS/Bonjour (best UX, lowest risk)**
   - Browse for `_openclaw._tcp` and future `_crewhub-agent._tcp` services.
   - Show discovered hosts with machine name + IP + port.

2. **Manual add (always available)**
   - “Add remote OpenClaw” → paste URL + token.

3. **Subnet scanning (opt-in, guarded)**
   - Only after explicit consent.
   - Let user choose scope: “My current subnet only” and show what that means.
   - Hard limits: max IPs, rate limit, short timeouts.

### UX for LAN permission
- Explain: what will be scanned, how long it will take, what ports.
- Provide a “safe default”: mDNS only.
- Provide “advanced”: subnet scan for port 18789 (and any other known ports).

---

## Implementation plan (phased)

### Phase 0 — Baseline UX hygiene (1–2 days)
- Add onboarding gating logic (no connections → wizard).
- Add “Demo data mode” to avoid empty first run.
- Add “Run discovery scan” in settings for later.

### Phase 1 — Local discovery MVP (3–5 days)
- Implement `/api/discovery/scan` for `mode=local`.
- OpenClaw: probe default port + config file detection.
- Claude/Codex: CLI presence detection (`--version`).
- UI Step 2/3: list candidates, edit, test, save.

### Phase 2 — Validation & quality (3–6 days)
- Streaming results (SSE or WS).
- Better evidence & confidence scoring.
- Robust “Test connection” UX + error messaging.
- Token handling improvements (redaction, copy/paste flows).

### Phase 3 — LAN discovery via mDNS (5–10 days)
- Add mDNS browse support (backend dependency + cross-platform notes).
- UI permission prompt and discovered host list.
- One-click add remote connection.

### Phase 4 — Subnet scan (advanced, optional) (5–12 days)
- Implement opt-in subnet scan with strict limits.
- Add scanning scope UI + warnings.
- Add audit log for scan events.

### Phase 5 — “Team/Agency readiness” (variable, 2–6 weeks)
- Connection profile import/export.
- Tagging/environments.
- Multi-user/roles if applicable.
- Pairing/invite flow.

---

## Risks & mitigations

1. **Security / trust concerns (network scanning, tokens)**
   - Mitigation: local-only default; LAN scanning opt-in; explain evidence; redact secrets; never auto-save tokens.

2. **False positives / confusing detections**
   - Mitigation: confidence scoring + “evidence”; require “Test connection” before saving; clear language (“installed” vs “running”).

3. **Cross-platform differences (paths, mDNS support)**
   - Mitigation: abstraction layer per OS; document supported OSes; degrade gracefully to manual entry.

4. **Performance (scan delays make UI feel broken)**
   - Mitigation: strict timeouts; streaming results; show partial results quickly.

5. **Runtime protocol drift (OpenClaw/Claude/Codex change behaviors)**
   - Mitigation: detector plugin architecture; versioned capability detection; community-driven updates.

6. **Open-source contributor expectations (privacy + transparency)**
   - Mitigation: explicit privacy posture in onboarding; no telemetry by default; “export diagnostic bundle” for bug reports.

---

## Effort estimates (summary)
- Phase 0: **1–2 days**
- Phase 1: **3–5 days**
- Phase 2: **3–6 days**
- Phase 3: **5–10 days**
- Phase 4: **5–12 days**
- Phase 5: **2–6+ weeks** (depends on scope: multi-user, tenancy, automation)

---

## Opinionated “BEST experience” recommendations

1. **Instant gratification:** If OpenClaw is running locally, CrewHub should connect in one click and show active sessions immediately.
2. **Never blank:** If nothing is discovered, offer demo data + crystal-clear “Start a runtime” steps.
3. **Transparency wins trust:** show evidence of what was checked, and keep scanning opt-in beyond localhost.
4. **Treat discovery as a product feature:** make discovery re-runnable, visible, and shareable (diagnostics export) — not only first-run.
5. **LAN via mDNS first:** it’s the only “magical” network discovery that doesn’t feel creepy.
