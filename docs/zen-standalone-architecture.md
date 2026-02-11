# Zen Mode Standalone Architecture Plan

**Date:** 2026-02-11  
**Status:** Planning (no implementation)  
**Goal:** Extract Zen Mode into a standalone app while reusing CrewHub code, API, and database where appropriate.

---

## 1) Executive summary

Recommendation: **Monorepo + shared packages + two frontend entrypoints + modular backend routers**.

- Keep one repository.
- Split shared domain/UI/API logic into reusable packages.
- Build two frontend apps:
  - `apps/crewhub-web` (full 3D + existing app shell)
  - `apps/zen-web` (standalone Zen shell)
- Keep one FastAPI service process by default, but reorganize routes into:
  - shared/core APIs
  - CrewHub-only APIs
  - Zen-only APIs (if any)
- Keep one SQLite DB (`~/.crewhub/crewhub.db`) with the same schema.

This satisfies all requirements with lowest long-term duplication risk and manageable migration cost.

---

## 2) Current-state observations (from codebase)

### Frontend
- Zen Mode lives in `frontend/src/components/zen/*` and is currently mounted from `frontend/src/App.tsx` as an overlay.
- Zen UI already has rich internal composition (tabs/panels/hooks/theme/layout manager).
- Zen relies on shared hooks/APIs like:
  - `useProjects` (`/api/projects`, `/api/projects/overview`)
  - `useTasks` (`/api/tasks`)
  - project files/docs routes (`/api/projects/:id/files`, docs/markdown viewers)
  - some direct fetches in Zen panels (`/api/cron/*`, `/api/media/upload`)

### Backend
- A single FastAPI app (`backend/app/main.py`) includes many routers:
  - shared business APIs (projects/tasks/files/docs)
  - CrewHub runtime/orchestration APIs (sessions/agents/rooms/connections/etc)
- DB initialization and lifespan currently assume one broad app lifecycle.

### Data
- DB models are shared for projects/tasks/files and runtime metadata.
- SQLite path is centralized and compatible with shared usage target (`~/.crewhub/crewhub.db`).

---

## 3) Architecture options (initial proposal)

## Option A — **Recommended**: Monorepo workspaces + shared packages + dual frontends + modular backend

### Shape
- Keep single repo.
- Introduce workspace packages:
  - `packages/domain-core` (types, validation, domain logic)
  - `packages/api-client` (typed API client used by both UIs)
  - `packages/zen-ui` (Zen panels/layout/theme/components)
  - `packages/shared-ui` (generic reusable UI pieces)
- Create frontend apps:
  - `apps/crewhub-web`
  - `apps/zen-web`
- Reorganize backend routers into modules:
  - `backend/app/routes/core/*` (projects/tasks/files/documents/history)
  - `backend/app/routes/crewhub/*` (agents/sessions/rooms/connections/world-specific)
  - `backend/app/routes/zen/*` (optional shell endpoints if needed)

### Pros
- Strong code reuse with clear boundaries.
- Minimal duplication, easiest synchronized evolution.
- Allows independent frontend deployment with shared APIs.
- Keeps existing DB and API continuity.

### Cons
- Requires monorepo restructuring and import-path cleanup.
- Build pipeline and CI become slightly more complex.

### Risk level
- **Medium** (mostly refactor risk, low product risk).

---

## Option B — Split Zen into separate repo, consume shared libs via private package registry/git submodule

### Shape
- `crewhub` and `zen` in separate repos.
- Shared packages published/versioned externally.

### Pros
- Strong product-level isolation.
- Independent release cadence.

### Cons
- Higher operational overhead (version drift, publishing discipline).
- Harder cross-cutting refactors.
- Greater risk of temporary divergence.

### Risk level
- **High** for current stage (team/process overhead).

---

## Option C — Keep single frontend app, route-based mode (`/zen`) and conditional loading

### Shape
- One app bundle with two shells inside one Vite app.
- Zen “standalone” is a route; backend unchanged.

### Pros
- Fastest to deliver initially.
- Minimal repo churn.

### Cons
- Weak separation of concerns.
- CrewHub dependencies can leak into Zen bundle/runtime.
- Harder to package/deploy truly standalone artifacts.

### Risk level
- **Low short-term**, **High long-term architecture debt**.

---

## 4) Recommended target architecture

```text
crewhub/
├─ apps/
│  ├─ crewhub-web/              # Full product (3D world + Zen integration)
│  └─ zen-web/                  # Standalone Zen app shell
├─ packages/
│  ├─ domain-core/              # Shared types/entities/use-cases
│  ├─ api-client/               # Typed HTTP client + endpoint contracts
│  ├─ shared-ui/                # Generic UI components
│  └─ zen-ui/                   # Zen-specific reusable UI + state hooks
├─ backend/
│  └─ app/
│     ├─ routes/
│     │  ├─ core/               # projects/tasks/files/documents/history
│     │  ├─ crewhub/            # sessions/agents/rooms/connections/world
│     │  └─ zen/                # optional zen-only endpoints
│     ├─ services/
│     ├─ db/
│     └─ main.py                # compose router groups via feature flags/profiles
└─ docker/
   ├─ Dockerfile.backend
   ├─ Dockerfile.crewhub-web
   └─ Dockerfile.zen-web
```

### Runtime composition
- **Shared backend API** (single process by default).
- Two independent frontend deployments can point to same backend+DB.
- Optional backend profiles (env-driven) to disable irrelevant routers in minimal zen deployments.

---

## 5) Backend API split strategy

## 5.1 Shared/Core API (must remain stable)
Used by both CrewHub and Zen:
- `/api/projects*`
- `/api/tasks*`
- `/api/projects/{id}/files*`
- `/api/projects/{id}/documents*`
- markdown/document content endpoints
- potentially `/api/media/upload` (if Zen chat/docs need it)

## 5.2 CrewHub-specific API
Primarily 3D/runtime orchestration:
- `/api/sessions*`
- `/api/agents*`
- `/api/rooms*`
- `/api/connections*`
- gateway status/orchestration routes

## 5.3 Zen-specific API (optional)
Only introduce if Zen needs behavior not appropriate in generic core routes.

## 5.4 Composition approach in `main.py`
- Build router registries:
  - `register_core_routes(app)`
  - `register_crewhub_routes(app)`
  - `register_zen_routes(app)`
- Drive inclusion with env profile:
  - `APP_PROFILE=full|zen|core`
- Default remains `full` for backwards compatibility.

---

## 6) Frontend sharing strategy

## 6.1 Extract Zen from overlay-only assumptions
Current Zen component should become a reusable “feature module” with an injected app shell:
- `ZenWorkspace` (pure feature UI, no knowledge of CrewHub 3D shell)
- `ZenShell` adapters:
  - `CrewHubZenShell` (overlay behavior in existing app)
  - `StandaloneZenShell` (full-page app, own navigation)

## 6.2 State boundaries
- In `packages/zen-ui`, keep only Zen domain state:
  - tabs/layout/theme/project filter/current workspace
- Move CrewHub-coupled state behind adapters/interfaces:
  - selected session from world/chat windows
  - room context derived from CrewHub world
- Example interface:
  - `ZenSessionContextProvider` with adapters for each host app.

## 6.3 API access normalization
- Replace ad-hoc `fetch('/api/...')` calls in Zen components with shared `api-client` methods.
- Benefits:
  - consistent error handling
  - easier endpoint evolution
  - testability and typed contracts

## 6.4 Navigation model
- CrewHub app: Zen remains entry via button/hotkey overlay.
- Standalone app: native Zen routing (projects/kanban/files/docs/archive/monitoring/docker) with URL state.

---

## 7) Database schema considerations

## 7.1 Reuse strategy
- Continue using `~/.crewhub/crewhub.db` as single source of truth.
- No immediate schema split required.

## 7.2 Guardrails
- Ensure shared entities remain product-agnostic:
  - `projects`, `tasks`, `project_files`, `documents` should not depend on world/3D concepts.
- If Zen-only preferences are needed, add namespaced settings:
  - e.g., `settings.key = 'zen.*'`

## 7.3 Migration policy
- Keep one migration pipeline for both products.
- Add compatibility checks to ensure both frontends operate against same schema version.

## 7.4 Concurrency note
- If both UIs run simultaneously against one SQLite file, keep write paths short and explicit; consider WAL mode and retry handling where not already in place.

---

## 8) Deployment options

## Option 1 (recommended default): Shared backend + selectable frontend
- Deploy one backend container/service.
- Deploy either/both frontends:
  - CrewHub web
  - Zen web
- Both point to same backend and same DB volume mount.

## Option 2: Zen all-in-one image
- Build `zen-web + backend` into one deployable for simple standalone usage.
- Good for users who only want Zen.
- Still supports mounting existing `~/.crewhub/crewhub.db` volume.

## Option 3: Full stack compose profile
- `docker compose --profile full` → CrewHub + Zen + backend
- `docker compose --profile zen` → Zen + backend only

---

## 9) Migration plan (phased)

## Phase 1 — Refactor shared code into libraries (1.5–2.5 weeks)
- Create workspace structure (`apps/`, `packages/`).
- Extract `zen-ui` module from current `frontend/src/components/zen`.
- Introduce `api-client` package and migrate Zen/API hooks to it.
- Keep existing CrewHub app behavior unchanged (compat shim layer).

**Exit criteria:** CrewHub still works; Zen overlay uses extracted packages.

## Phase 2 — Create standalone Zen app (1–1.5 weeks)
- Build `apps/zen-web` shell.
- Implement standalone navigation and route state.
- Wire to same backend APIs.

**Exit criteria:** Zen app runs independently without 3D world dependencies.

## Phase 3 — Update CrewHub to consume shared library (1 week)
- Replace direct imports with package imports (`@crewhub/zen-ui`, `@crewhub/api-client`).
- Add adapter for CrewHub-specific context (session/room).
- Verify feature parity.

**Exit criteria:** CrewHub and Zen both consume the same Zen feature code.

## Phase 4 — Deployment, hardening, and testing (1–1.5 weeks)
- Dockerfiles + compose profiles.
- Cross-app integration tests (same DB, concurrent usage).
- Regression testing for projects/tasks/files/docs.
- Docs and runbooks.

**Exit criteria:** Production-ready standalone and integrated deployment paths.

---

## 10) Tradeoffs analysis

## Monorepo vs separate repos
- **Monorepo (recommended):**
  - ✅ Easier shared refactors and consistent versions
  - ✅ Lower coordination overhead
  - ❌ Requires disciplined package boundaries
- **Separate repos:**
  - ✅ Strong isolation and independent governance
  - ❌ Higher release/versioning friction
  - ❌ More likely to drift

## Backend single app vs split services
- **Single app with modular routers (recommended now):**
  - ✅ Lowest ops complexity
  - ✅ Keeps API contracts stable
  - ❌ Some unused routes may ship unless profile-gated
- **Separate services:**
  - ✅ Maximum isolation/scaling freedom
  - ❌ Major complexity increase (auth, routing, deployments)

## Frontend separate apps vs route mode
- **Separate apps (recommended):**
  - ✅ True standalone build/deploy
  - ✅ Cleaner UX and dependency boundaries
  - ❌ Additional build config
- **Single app route mode:**
  - ✅ Faster initial delivery
  - ❌ Harder long-term isolation

## Branding decision
- **Same product family, distinct surface:**
  - “CrewHub Zen” as standalone companion app.
  - Shared design language; optional logo/title overrides per app.

---

## 11) Effort estimate (rough)

### Team estimate (1 senior full-stack + optional reviewer)
- **Total:** ~5 to 7 weeks calendar time
  - Refactor foundations: 2–2.5 weeks
  - Standalone shell + integration: 1.5–2 weeks
  - Hardening/deployment/testing: 1.5–2 weeks

### Risk-adjusted notes
- If hidden coupling between Zen and world/session internals is higher than expected: +1–1.5 weeks.
- If API contracts are standardized early (`api-client` first), risk and rework decrease materially.

---

## 12) Review loop mapping (requested workflow)

1. **GPT-5.2 draft** → This document’s options and recommendation section can serve as initial draft.
2. **Opus critique** → Focus on hidden coupling, migration sequencing, and DX/CI impacts.
3. **GPT-5.2 refinement** → Incorporate critique into final target structure and phases.
4. **Opus final pass** → Validate effort estimate and implementation risk.
5. **Consolidate** → Publish final architecture + migration acceptance criteria.

---

## 13) Suggested next planning artifacts (no implementation)

- `docs/zen-boundary-inventory.md`
  - List each Zen file and dependency category: shared vs CrewHub-coupled.
- `docs/zen-api-contracts.md`
  - Explicit endpoint contracts used by Zen (request/response/error).
- `docs/zen-test-plan.md`
  - Matrix: CrewHub integrated mode vs standalone mode across same DB.

---

## Final recommendation

Proceed with **Option A**. It best satisfies:
- standalone deployability,
- maximal code sharing,
- shared DB/API continuity,
- and clean separation of concerns

without introducing unnecessary operational complexity too early.
