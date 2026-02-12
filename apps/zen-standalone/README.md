# Zen Mode Standalone

A focused, standalone Zen Mode experience that shares all code and data with CrewHub.

## Architecture

```
crewhub/
├── frontend/src/           ← Shared source code (components, hooks, lib, utils)
├── apps/zen-standalone/    ← This app (minimal entry point)
│   └── src/
│       ├── main.tsx        ← Entry: loads shared CSS + App
│       └── App.tsx         ← Workspace selector + ZenMode wrapper
└── backend/                ← Shared backend (API + database)
```

**Key design:** Zen Standalone imports all components directly from `frontend/src/` via Vite path aliases (`@/` → `../../frontend/src/`). This means:
- **Zero code duplication** — DRY by design
- **Instant sync** — Changes to shared components appear in both apps
- **Shared database** — Both apps hit the same backend API
- **Independent deployment** — Each app has its own entry point and build

## Quick Start

```bash
# Prerequisites: backend must be running
cd ~/ekinapps/crewhub
make dev-backend  # Port 8091

# Start Zen Standalone
make dev-zen      # Port 5183

# Or start everything at once
make dev-all      # Backend 8091 + Frontend 5180 + Zen 5183
```

## Ports

| Service | Port | URL |
|---------|------|-----|
| Backend | 8091 | http://localhost:8091 |
| CrewHub Frontend | 5180 | http://ekinbot.local:5180 |
| **Zen Standalone** | **5183** | **http://ekinbot.local:5183** |

## Features

- Workspace selector (projects or all sessions)
- Full Zen Mode: tabs, panels, layouts, themes
- Command palette (Ctrl+K)
- All panels: Chat, Sessions, Activity, Tasks, Projects, Documents, Kanban, Logs
- Shared data with CrewHub (same backend, same database)
- No 3D world, no HQ — just focused work

## How Sharing Works

The `vite.config.ts` maps `@/` to the CrewHub frontend source:

```ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, '../../frontend/src'),
  }
}
```

The `tailwind.config.js` scans both local and shared sources:

```js
content: [
  "./src/**/*.{js,ts,jsx,tsx}",
  "../../frontend/src/**/*.{js,ts,jsx,tsx}",
]
```
