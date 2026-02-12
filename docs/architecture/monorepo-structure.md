# CrewHub Monorepo Architecture

## Overview

CrewHub uses a **shared-source monorepo** pattern where the Zen Standalone app imports directly from the main frontend source via Vite path aliases.

```
crewhub/
├── backend/                    # Python FastAPI backend (shared by all apps)
│   ├── app/
│   │   ├── main.py            # FastAPI app with CORS allow_origins=["*"]
│   │   ├── routes/            # API endpoints
│   │   └── db/                # SQLite database
│   └── ...
│
├── frontend/                   # Main CrewHub frontend (3D world + Zen Mode)
│   ├── src/
│   │   ├── components/
│   │   │   ├── zen/           # ← Zen Mode components (shared)
│   │   │   ├── chat/          # Chat components (shared by zen)
│   │   │   ├── sessions/      # Session views
│   │   │   └── world3d/       # 3D world (CrewHub only)
│   │   ├── contexts/          # React contexts (shared)
│   │   ├── hooks/             # Custom hooks (shared)
│   │   ├── lib/               # API client, SSE manager (shared)
│   │   └── utils/             # Utilities (shared)
│   └── package.json
│
├── apps/
│   └── zen-standalone/         # Standalone Zen Mode app
│       ├── src/
│       │   ├── main.tsx       # Entry point
│       │   └── App.tsx        # Workspace selector + Zen wrapper
│       ├── vite.config.ts     # @/ → ../../frontend/src
│       └── package.json
│
└── docs/
    └── architecture/
        └── monorepo-structure.md  # This file
```

## Design Decisions

### Why shared-source aliases instead of npm packages?

1. **Zero extraction overhead** — No need to refactor 30+ components into packages
2. **Instant consistency** — Changes in shared code appear in both apps immediately
3. **Simple dependency graph** — Both apps depend on the same source, no version conflicts
4. **Low risk** — CrewHub frontend remains untouched; zen-standalone is additive

### Why not move frontend to apps/crewhub/?

Moving the existing frontend would break:
- All existing CI/CD and scripts
- Docker configs
- Developer muscle memory
- Git history for the frontend directory

The current approach is **additive only** — nothing existing changes.

## Data Flow

```
┌─────────────────┐     ┌─────────────────┐
│  CrewHub App     │     │ Zen Standalone   │
│  (port 5180)     │     │  (port 5183)     │
│                  │     │                  │
│  3D World        │     │  Workspace       │
│  + Zen Mode      │     │  Selector        │
│  + Sessions      │     │  + Zen Mode      │
│  + Settings      │     │                  │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         │    /api/* proxy        │
         └────────┬───────────────┘
                  │
         ┌────────▼─────────┐
         │  Backend API      │
         │  (port 8091)      │
         │                   │
         │  SQLite DB        │
         │  SSE streams      │
         └───────────────────┘
```

Both apps:
- Connect to the same backend via `/api` proxy
- Share the same SQLite database
- Receive the same SSE event streams
- Changes in one app instantly appear in the other

## Running

```bash
# All services
make dev-all

# Individual
make dev-backend   # Port 8091
make dev-frontend  # Port 5180
make dev-zen       # Port 5183
```
