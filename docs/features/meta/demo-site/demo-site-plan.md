# Demo Site Plan — `demo.crewhub.dev`

> **Status:** Draft
> **Date:** 2026-02-05
> **Author:** Dev Agent (Opus)
> **Goal:** Deploy CrewHub frontend as a standalone static site with mock API — no backend required

---

## 1. Executive Summary

Deploy the CrewHub frontend at `demo.crewhub.dev` as a static site that runs entirely in the browser. Visitors can explore the full 3D world with mock agents, rooms, and projects — without any backend. The existing `DemoContext` provides mock sessions; this plan adds a complete mock API layer to handle all remaining backend dependencies.

**Chosen approach: Option B — Mock API module with `VITE_DEMO_MODE=true`**

Why:
- No extra dependencies (no MSW, no service workers)
- Build-time switch via environment variable — zero overhead in production
- Simple to maintain: one file with all mock data and handlers
- Clean separation: `mockFetch` wraps `window.fetch` at boot time

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    demo.crewhub.dev                       │
│               (Static files on Coolify)                   │
│                                                           │
│  ┌─────────────┐    ┌──────────────────────────────────┐ │
│  │   Vite SPA   │───▶│  mockFetch interceptor           │ │
│  │  (React/R3F) │    │  (replaces window.fetch for /api)│ │
│  └─────────────┘    └────────┬─────────────────────────┘ │
│                              │                             │
│        ┌─────────────────────┼──────────────────────┐     │
│        │                     ▼                      │     │
│        │           ┌──────────────────┐             │     │
│        │           │  mockApi.ts      │             │     │
│        │           │  ─────────────── │             │     │
│        │           │  Mock Rooms      │             │     │
│        │           │  Mock Agents     │             │     │
│        │           │  Mock Sessions   │             │     │
│        │           │  Mock Projects   │             │     │
│        │           │  Mock Settings   │             │     │
│        │           │  Mock SSE (noop) │             │     │
│        │           └──────────────────┘             │     │
│        │                                            │     │
│        │   ┌──────────────────────────────────┐     │     │
│        │   │  DemoContext.tsx (existing)       │     │     │
│        │   │  ───────────────────────────────  │     │     │
│        │   │  10 mock sessions with live       │     │     │
│        │   │  timestamps, room assignments,    │     │     │
│        │   │  F5 toggle                        │     │     │
│        │   └──────────────────────────────────┘     │     │
│        │                                            │     │
│        └────────────────────────────────────────────┘     │
│                                                           │
│  Build: VITE_DEMO_MODE=true npm run build                 │
│  Output: dist/ → static deploy on Coolify                 │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Data flow

1. App boots → `main.tsx` checks `import.meta.env.VITE_DEMO_MODE`
2. If `true`, imports `setupMockApi()` from `mockApi.ts`
3. `setupMockApi()` monkey-patches `window.fetch` to intercept `/api/*` requests
4. Non-`/api` requests (assets, fonts) pass through to real `fetch`
5. Mock `EventSource` constructor is installed to handle SSE `/api/events`
6. `DemoContext` is auto-enabled (no F5 toggle needed — demo mode is always on)
7. Onboarding wizard is bypassed (`localStorage` flag set at boot)

---

## 3. Complete API Endpoint Inventory

Every `fetch()` and `EventSource` call in the frontend, grouped by priority:

### 3.1 Critical — Required for 3D world to render

| Endpoint | Method | Used By | Mock Strategy |
|----------|--------|---------|---------------|
| `GET /api/sessions` | GET | `useSessionsStream` | Return `{ sessions: [] }` — DemoContext provides sessions |
| `GET /api/rooms` | GET | `RoomsContext` | Return 6 mock rooms matching DemoContext assignments |
| `GET /api/session-room-assignments` | GET | `RoomsContext` | Return assignments matching DemoContext's `demoRoomAssignments` |
| `GET /api/room-assignment-rules` | GET | `RoomsContext` | Return 3 sample rules |
| `GET /api/agents` | GET | `useAgentsRegistry` | Return 6 mock agents matching demo sessions |
| `GET /api/settings` | GET | `useSettings` | Return default theme/env settings |
| `GET /api/projects` | GET | `useProjects` | Return 3 mock projects |
| `GET /api/session-display-names` | GET | `useSessionDisplayNames` | Return display names for demo sessions |
| `SSE /api/events` | EventSource | `sseManager` | No-op EventSource that fires `open` then stays idle |

### 3.2 Important — Required for secondary features

| Endpoint | Method | Used By | Mock Strategy |
|----------|--------|---------|---------------|
| `GET /api/connections` | GET | `ConnectionsView` | Return 1 mock OpenClaw connection (connected) |
| `GET /api/onboarding/status` | GET | `App.tsx` | Return `{ completed: true }` |
| `GET /api/cron/jobs` | GET | `CronView` | Return 2 sample cron jobs |
| `GET /api/sessions/archived` | GET | `HistoryView` | Return 5 mock archived sessions |
| `GET /api/settings/projects_base_path` | GET | `ProjectPicker` | Return mock path |
| `GET /api/project-folders/discover` | GET | `ProjectPicker` | Return empty array |
| `GET /api/projects/overview` | GET | `RoomInfoPanel` | Return mock overview |
| `GET /api/projects/:id/files` | GET | `ProjectDocsPanel` | Return mock file tree |
| `GET /api/projects/:id/files/content` | GET | `ProjectDocsPanel` | Return mock README.md |
| `GET /api/sessions/:key/history` | GET | `LogViewer`, `useAgentChat` | Return mock chat history |

### 3.3 Mutations — Silently succeed (no-op)

| Endpoint | Method | Used By | Mock Strategy |
|----------|--------|---------|---------------|
| `PUT /api/settings/:key` | PUT | `useSettings` | Return `200 OK`, no-op |
| `PUT /api/settings/batch` | PUT | `useSettings` | Return `200 OK`, no-op |
| `POST /api/rooms` | POST | `RoomsContext` | Return `200 OK`, no-op |
| `PUT /api/rooms/:id` | PUT | `RoomsContext` | Return `200 OK`, no-op |
| `DELETE /api/rooms/:id` | DELETE | `RoomsContext` | Return `200 OK`, no-op |
| `PUT /api/rooms/reorder` | PUT | `RoomsContext` | Return `200 OK`, no-op |
| `POST /api/session-room-assignments` | POST | `DragDropContext` | Return `200 OK`, no-op |
| `DELETE /api/session-room-assignments/:key` | DELETE | `DragDropContext` | Return `200 OK`, no-op |
| `POST /api/rooms/:id/project` | POST | `useProjects` | Return `200 OK`, no-op |
| `DELETE /api/rooms/:id/project` | DELETE | `useProjects` | Return `200 OK`, no-op |
| `POST /api/projects` | POST | `useProjects` | Return `200 OK`, no-op |
| `PUT /api/projects/:id` | PUT | `useProjects` | Return `200 OK`, no-op |
| `DELETE /api/projects/:id` | DELETE | `useProjects` | Return `200 OK`, no-op |
| `PUT /api/agents/:id` | PUT | `useAgentsRegistry` | Return `200 OK`, no-op |
| `POST /api/connections` | POST | `ConnectionsView` | Return `200 OK`, no-op |
| `PATCH /api/connections/:id` | PATCH | `ConnectionsView` | Return `200 OK`, no-op |
| `DELETE /api/connections/:id` | DELETE | `ConnectionsView` | Return `200 OK`, no-op |
| `POST /api/connections/:id/connect` | POST | `ConnectionsView` | Return `{ connected: true }` |
| `POST /api/session-display-names/:key` | POST | `useSessionDisplayNames` | Return `200 OK`, no-op |
| `DELETE /api/session-display-names/:key` | DELETE | `useSessionDisplayNames` | Return `200 OK`, no-op |
| `POST /api/room-assignment-rules` | POST | `useRoomAssignmentRules` | Return `200 OK`, no-op |
| `PUT /api/room-assignment-rules/:id` | PUT | `useRoomAssignmentRules` | Return `200 OK`, no-op |
| `DELETE /api/room-assignment-rules/:id` | DELETE | `useRoomAssignmentRules` | Return `200 OK`, no-op |
| `POST /api/discovery/scan` | POST | `OnboardingWizard` | Return `{ candidates: [] }` |
| `POST /api/discovery/test` | POST | `OnboardingWizard` | Return `{ reachable: false }` |
| `POST /api/agents/:id/chat` | POST | `useAgentChat` | Return mock response |
| `GET /api/agents/:id/chat/history` | GET | `useAgentChat` | Return mock history |

---

## 4. Mock Data Definitions

### 4.1 Rooms (6 rooms — matching DemoContext assignments)

```typescript
const MOCK_ROOMS: Room[] = [
  {
    id: 'headquarters',
    name: 'Headquarters',
    icon: '🏢',
    color: '#6366f1',
    sort_order: 0,
    floor_style: 'marble',
    wall_style: 'glass',
    project_id: null,
    project_name: null,
    project_color: null,
    is_hq: true,
    created_at: Date.now() - 86400000,
    updated_at: Date.now(),
  },
  {
    id: 'dev-room',
    name: 'Development Lab',
    icon: '💻',
    color: '#22c55e',
    sort_order: 1,
    floor_style: 'concrete',
    wall_style: 'two-tone',
    project_id: 'proj-crewhub',
    project_name: 'CrewHub',
    project_color: '#6366f1',
    is_hq: false,
    created_at: Date.now() - 86400000,
    updated_at: Date.now(),
  },
  {
    id: 'creative-room',
    name: 'Creative Studio',
    icon: '🎨',
    color: '#f59e0b',
    sort_order: 2,
    floor_style: 'wood',
    wall_style: 'pastel-band',
    project_id: 'proj-website',
    project_name: 'Website Redesign',
    project_color: '#f59e0b',
    is_hq: false,
    created_at: Date.now() - 86400000,
    updated_at: Date.now(),
  },
  {
    id: 'ops-room',
    name: 'Operations Center',
    icon: '⚙️',
    color: '#ef4444',
    sort_order: 3,
    floor_style: 'tiles',
    wall_style: 'accent-band',
    project_id: null,
    project_name: null,
    project_color: null,
    is_hq: false,
    created_at: Date.now() - 86400000,
    updated_at: Date.now(),
  },
  {
    id: 'marketing-room',
    name: 'Marketing Hub',
    icon: '📢',
    color: '#a855f7',
    sort_order: 4,
    floor_style: 'carpet',
    wall_style: 'light',
    project_id: null,
    project_name: null,
    project_color: null,
    is_hq: false,
    created_at: Date.now() - 86400000,
    updated_at: Date.now(),
  },
  {
    id: 'thinking-room',
    name: 'Thinking Room',
    icon: '🧠',
    color: '#06b6d4',
    sort_order: 5,
    floor_style: 'light-wood',
    wall_style: 'wainscoting',
    project_id: null,
    project_name: null,
    project_color: null,
    is_hq: false,
    created_at: Date.now() - 86400000,
    updated_at: Date.now(),
  },
]
```

### 4.2 Agents (6 agents — matching demo sessions)

```typescript
const MOCK_AGENTS: Agent[] = [
  {
    id: 'agent-main',
    name: 'Assistent',
    icon: '🤖',
    avatar_url: null,
    color: '#6366f1',
    agent_session_key: 'agent:main:main',
    default_model: 'claude-sonnet-4-20250514',
    default_room_id: 'headquarters',
    sort_order: 0,
    is_pinned: true,
    auto_spawn: false,
    bio: 'Main orchestrating agent — handles communication, planning, and task delegation.',
    created_at: Date.now() - 86400000 * 7,
    updated_at: Date.now(),
  },
  {
    id: 'agent-dev',
    name: 'Dev',
    icon: '💻',
    avatar_url: null,
    color: '#22c55e',
    agent_session_key: 'agent:dev:main',
    default_model: 'claude-opus-4-20250514',
    default_room_id: 'dev-room',
    sort_order: 1,
    is_pinned: true,
    auto_spawn: false,
    bio: 'Senior developer agent — writes code, builds features, manages deployments.',
    created_at: Date.now() - 86400000 * 7,
    updated_at: Date.now(),
  },
  {
    id: 'agent-gamedev',
    name: 'Game Dev',
    icon: '🎮',
    avatar_url: null,
    color: '#f97316',
    agent_session_key: 'agent:gamedev:main',
    default_model: 'claude-opus-4-20250514',
    default_room_id: 'dev-room',
    sort_order: 2,
    is_pinned: true,
    auto_spawn: false,
    bio: 'Game development specialist — 3D rendering, physics, creative coding.',
    created_at: Date.now() - 86400000 * 5,
    updated_at: Date.now(),
  },
  {
    id: 'agent-flowy',
    name: 'Flowy',
    icon: '✍️',
    avatar_url: null,
    color: '#a855f7',
    agent_session_key: 'agent:flowy:main',
    default_model: 'claude-sonnet-4-20250514',
    default_room_id: 'marketing-room',
    sort_order: 3,
    is_pinned: true,
    auto_spawn: false,
    bio: 'Content creator — writes blog posts, docs, and marketing copy.',
    created_at: Date.now() - 86400000 * 3,
    updated_at: Date.now(),
  },
  {
    id: 'agent-reviewer',
    name: 'Reviewer',
    icon: '🔍',
    avatar_url: null,
    color: '#06b6d4',
    agent_session_key: 'agent:reviewer:main',
    default_model: 'gpt-5.2',
    default_room_id: 'thinking-room',
    sort_order: 4,
    is_pinned: false,
    auto_spawn: false,
    bio: 'Code reviewer and QA — reviews PRs, spots bugs, suggests improvements.',
    created_at: Date.now() - 86400000 * 3,
    updated_at: Date.now(),
  },
  {
    bio: 'Water technology specialist — data analysis, monitoring, alerts.',
    created_at: Date.now() - 86400000 * 2,
    updated_at: Date.now(),
  },
]
```

### 4.3 Projects (3 projects)

```typescript
const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-crewhub',
    name: 'CrewHub',
    description: 'Multi-agent orchestration platform with 3D visualization',
    icon: '🚀',
    color: '#6366f1',
    folder_path: '/home/user/projects/crewhub',
    status: 'active',
    created_at: Date.now() - 86400000 * 14,
    updated_at: Date.now(),
    rooms: ['dev-room'],
  },
  {
    id: 'proj-website',
    name: 'Website Redesign',
    description: 'New company website with interactive demos',
    icon: '🌐',
    color: '#f59e0b',
    folder_path: '/home/user/projects/website',
    status: 'active',
    created_at: Date.now() - 86400000 * 7,
    updated_at: Date.now(),
    rooms: ['creative-room'],
  },
  {
    id: 'proj-monitoring',
    name: 'Water Monitoring',
    description: 'Real-time water quality monitoring system',
    icon: '💧',
    color: '#22c55e',
    folder_path: '/home/user/projects/monitoring',
    status: 'active',
    created_at: Date.now() - 86400000 * 21,
    updated_at: Date.now(),
    rooms: [],
  },
]
```

### 4.4 Connections (1 demo connection)

```typescript
const MOCK_CONNECTIONS = [
  {
    id: 'conn-demo',
    name: 'Local OpenClaw',
    type: 'openclaw',
    config: { gateway_url: 'http://localhost:3000', token: '***' },
    enabled: true,
    status: 'connected',
    error: null,
    created_at: Date.now() - 86400000 * 7,
    updated_at: Date.now(),
  },
]
```

### 4.5 Settings (defaults)

```typescript
const MOCK_SETTINGS: Record<string, string> = {
  'crewhub-theme': 'dark',
  'crewhub-accent': 'indigo',
  'crewhub-environment': 'floating',
  'crewhub-view-mode': 'world',
  'crewhub-lighting': 'ambient',
  'crewhub-idle-threshold': '300000',
  'crewhub-offline-threshold': '600000',
}
```

### 4.6 Display Names

```typescript
const MOCK_DISPLAY_NAMES = [
  { session_key: 'agent:main:main', display_name: 'Assistent' },
  { session_key: 'agent:dev:main', display_name: 'Dev' },
  { session_key: 'agent:gamedev:main', display_name: 'Game Dev' },
  { session_key: 'agent:flowy:main', display_name: 'Flowy' },
  { session_key: 'agent:reviewer:main', display_name: 'Reviewer' },
]
```

### 4.7 Cron Jobs (2 samples)

```typescript
const MOCK_CRON_JOBS = [
  {
    id: 'cron-heartbeat',
    label: 'Heartbeat Check',
    schedule: { kind: 'every', everyMs: 1800000 },
    payload: { kind: 'agentTurn', message: 'Heartbeat check' },
    enabled: true,
    state: {
      lastRunAtMs: Date.now() - 900000,
      nextRunAtMs: Date.now() + 900000,
      lastStatus: 'ok',
      lastDurationMs: 2340,
      lastError: null,
    },
  },
  {
    id: 'cron-email',
    label: 'Email Monitor',
    schedule: { kind: 'cron', expr: '*/10 * * * *', tz: 'Europe/Brussels' },
    payload: { kind: 'agentTurn', message: 'Check for new emails' },
    enabled: true,
    state: {
      lastRunAtMs: Date.now() - 300000,
      nextRunAtMs: Date.now() + 300000,
      lastStatus: 'ok',
      lastDurationMs: 4120,
      lastError: null,
    },
  },
]
```

### 4.8 Archived Sessions (5 samples for History view)

```typescript
const MOCK_ARCHIVED_SESSIONS = [
  {
    session_key: 'agent:dev:subagent:deploy-v0.6',
    session_id: 'archived-1',
    agent_id: 'agent-dev',
    display_name: 'deploy-v0.6',
    minion_type: 'subagent',
    model: 'claude-opus-4-20250514',
    channel: 'internal',
    started_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    ended_at: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString(),
    message_count: 47,
    status: 'completed',
    summary: 'Deployed CrewHub v0.6 to production with zero downtime',
    file_path: '/archive/deploy-v0.6.json',
  },
  // ... 4 more similar entries
]
```

---

## 5. Implementation Plan

### Step 1: Create `mockApi.ts` — the mock fetch interceptor
**File:** `frontend/src/lib/mockApi.ts`
**Effort:** ~3 hours

This is the core of the demo. A single file that:
1. Stores all mock data (sections 4.1–4.8)
2. Exports `setupMockApi()` which patches `window.fetch`
3. Routes requests by URL pattern + method
4. Returns `Response` objects with appropriate JSON bodies
5. Installs a mock `EventSource` for SSE

```typescript
// Pseudocode structure
const originalFetch = window.fetch

export function setupMockApi() {
  // 1. Patch fetch
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
    const method = init?.method?.toUpperCase() || 'GET'

    // Only intercept /api/* requests
    if (!url.startsWith('/api')) {
      return originalFetch(input, init)
    }

    // Route to mock handler
    const response = handleMockRequest(url, method, init?.body)
    if (response) return response

    // Fallback: 200 OK for unhandled mutations
    if (method !== 'GET') {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Unhandled GET → 404
    console.warn(`[MockAPI] Unhandled: ${method} ${url}`)
    return new Response('Not Found', { status: 404 })
  }

  // 2. Patch EventSource for SSE
  const OriginalEventSource = window.EventSource
  window.EventSource = class MockEventSource extends EventTarget {
    readyState = EventSource.OPEN
    url: string

    constructor(url: string) {
      super()
      this.url = url
      // Fire 'open' event on next tick
      setTimeout(() => {
        this.readyState = EventSource.OPEN
        this.dispatchEvent(new Event('open'))
        if (this.onopen) this.onopen(new Event('open'))
      }, 100)
    }

    close() { this.readyState = EventSource.CLOSED }
    onopen: ((ev: Event) => void) | null = null
    onmessage: ((ev: MessageEvent) => void) | null = null
    onerror: ((ev: Event) => void) | null = null

    // Implement addEventListener/removeEventListener via EventTarget
  } as any

  // 3. Auto-enable demo mode
  localStorage.setItem('crewhub-demo-mode', 'true')

  // 4. Skip onboarding
  localStorage.setItem('crewhub-onboarded', 'true')
}
```

### Step 2: Wire up in `main.tsx`
**File:** `frontend/src/main.tsx`
**Effort:** 15 minutes

```typescript
import { setupMockApi } from './lib/mockApi'

// Initialize mock API for demo builds
if (import.meta.env.VITE_DEMO_MODE === 'true') {
  setupMockApi()
}

// ... existing ReactDOM.createRoot(...)
```

### Step 3: Auto-enable demo mode in DemoContext
**File:** `frontend/src/contexts/DemoContext.tsx`
**Effort:** 15 minutes

Small change: when `VITE_DEMO_MODE=true`, start with demo mode enabled and hide the F5 toggle message (replace with "Demo Site" indicator).

```typescript
const [isDemoMode, setIsDemoMode] = useState(() => {
  if (import.meta.env.VITE_DEMO_MODE === 'true') return true // Always on for demo
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
})
```

### Step 4: Adjust DemoModeIndicator for public demo
**File:** `frontend/src/contexts/DemoContext.tsx`
**Effort:** 15 minutes

When `VITE_DEMO_MODE=true`, show a "Try CrewHub" CTA instead of "F5 to exit":
```typescript
export function DemoModeIndicator() {
  const { isDemoMode } = useDemoMode()
  const isPublicDemo = import.meta.env.VITE_DEMO_MODE === 'true'

  if (!isDemoMode && !isPublicDemo) return null

  if (isPublicDemo) {
    return (
      <div style={/* bottom banner */}>
        <span>🚀 This is a live demo</span>
        <a href="https://github.com/ekinsolbot/crewhub" target="_blank">
          View on GitHub →
        </a>
      </div>
    )
  }
  // ... existing indicator
}
```

### Step 5: Create production Dockerfile for static build
**File:** `frontend/Dockerfile.demo`
**Effort:** 30 minutes

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV VITE_DEMO_MODE=true
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx-demo.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Step 6: Nginx config for SPA routing
**File:** `frontend/nginx-demo.conf`
**Effort:** 15 minutes

```nginx
server {
    listen 80;
    server_name demo.crewhub.dev;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # No cache for HTML
    location = /index.html {
        add_header Cache-Control "no-cache";
    }
}
```

### Step 7: Deploy to Coolify
**Effort:** 30 minutes

1. Create new app in Coolify: `demo.crewhub.dev`
2. Source: GitHub repo `ekinsolbot/crewhub`
3. Build: Dockerfile path → `frontend/Dockerfile.demo`
4. Domain: `demo.crewhub.dev`
5. SSL: Auto (Let's Encrypt)
6. Build env: `VITE_DEMO_MODE=true`

---

## 6. File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/src/lib/mockApi.ts` | **NEW** | Mock API layer (~400 lines) |
| `frontend/src/main.tsx` | **EDIT** | Add 3-line mock setup |
| `frontend/src/contexts/DemoContext.tsx` | **EDIT** | Auto-enable for demo builds, update indicator |
| `frontend/Dockerfile.demo` | **NEW** | Multi-stage Dockerfile for static build |
| `frontend/nginx-demo.conf` | **NEW** | SPA routing config |

**Total new code:** ~450 lines (mockApi.ts is the bulk)
**Total edits:** ~15 lines across 2 files

---

## 7. Mock Behavior Details

### 7.1 SSE / EventSource

The mock `EventSource` fires `open` immediately, then stays idle. This means:
- `sseManager` thinks it's connected → shows "Live" indicator
- No SSE events are fired → sessions only come from DemoContext
- The `useSessionsStream` hook falls back gracefully

### 7.2 Mutations (Drag & Drop, Room Edits, etc.)

All PUT/POST/DELETE requests return `200 OK` with `{ success: true }`. This means:
- Drag-and-drop sessions between rooms → appears to work (API returns success)
- Room settings changes → appear to save
- **Important:** Changes don't persist (page refresh resets everything)
- This is acceptable for a demo — visitors expect exploration, not persistence

### 7.3 Session History / Chat

Mock chat history with 3-4 messages per session showing realistic AI interactions. The chat input (if shown) will accept messages but the "AI response" is a pre-canned reply.

### 7.4 Console Warnings

Log a `[MockAPI]` prefix for all intercepted requests (helpful for debugging):
```
[MockAPI] GET /api/rooms → 200 (6 rooms)
[MockAPI] GET /api/agents → 200 (6 agents)
```

---

## 8. UX Considerations for Demo

### 8.1 What visitors see
- Full 3D world with 6 rooms and 10 active sessions (6 agents + 4 subagents)
- Agents moving around in rooms with activity bubbles
- Room tabs at the bottom
- Click on a room → zoom in, see assigned agents
- Click on an agent → see info panel with bio, model, tokens
- Stats header shows active counts, total tokens
- Dark theme by default (most impressive for 3D)
- "Floating Islands" environment (most visually striking)

### 8.2 What visitors can do
- Pan, zoom, rotate the 3D world
- Click rooms to focus
- Click agents to see details
- Switch between tabs (Cards, All, Cron, History, Connections)
- Change theme/settings (resets on refresh)
- Drag sessions between rooms (resets on refresh)

### 8.3 Demo banner
Bottom-right banner with:
- "🚀 This is a live demo — no real agents are running"
- "Get started →" link to GitHub/docs
- Semi-transparent, non-intrusive

### 8.4 Disabled features
- Agent chat: Show pre-canned messages, disable send button with tooltip "Chat unavailable in demo"
- Onboarding wizard: Bypassed entirely
- Backup/export: Disabled
- Connection test: Returns mock success

---

## 9. Estimated Total Effort

| Step | Task | Effort |
|------|------|--------|
| 1 | `mockApi.ts` — all mock data + fetch interceptor | 3h |
| 2 | Wire up in `main.tsx` | 15min |
| 3 | DemoContext auto-enable | 15min |
| 4 | Demo indicator / banner | 30min |
| 5 | `Dockerfile.demo` | 30min |
| 6 | `nginx-demo.conf` | 15min |
| 7 | Coolify deploy + DNS | 30min |
| 8 | Testing & polish | 1h |
| **Total** | | **~6 hours** |

---

## 10. Future Enhancements (Post-MVP)

1. **Animated session activity** — Periodically fire mock SSE events to simulate agents starting/stopping work
2. **Interactive tutorial** — Step-by-step overlay explaining CrewHub features
3. **Shareable room configs** — URL params to load different room/agent setups
4. **Performance mode** — Reduced quality settings for mobile visitors
5. **Analytics** — Basic visitor tracking (Plausible/Umami)

---

## 11. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Mock data gets stale as API evolves | Medium | TypeScript interfaces enforce structure; tests catch mismatches |
| Demo site has different bugs than real site | Low | Same codebase, same build — only data source differs |
| Visitors confused by non-working features | Medium | Clear demo banner, disable destructive actions |
| Search engines index demo content | Low | `robots.txt` or `noindex` meta tag |
| Build size increases from mock data | Very Low | Mock data is ~5KB — negligible vs Three.js bundle |

---

## 12. Testing Checklist

- [ ] 3D world renders with all 6 rooms
- [ ] 10 demo sessions appear in correct rooms
- [ ] Agent info panels show correct data
- [ ] Room tab navigation works
- [ ] Drag-and-drop doesn't crash (even though it resets)
- [ ] Cards view shows all sessions
- [ ] All Sessions view renders correctly
- [ ] Cron view shows mock jobs
- [ ] History view shows archived sessions
- [ ] Connections view shows mock connection
- [ ] Settings panel opens and saves (locally)
- [ ] Theme switching works
- [ ] Environment switching works
- [ ] No console errors on load
- [ ] Mobile responsive (3D still loads)
- [ ] Demo banner visible and links work
- [ ] Page refresh resets cleanly
- [ ] No API calls leak to non-existent backend
