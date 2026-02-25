# CrewHub — Task Management & Project Context Injection (Design)

**Date:** 2026-02-06
**Author:** subagent: reviewer (GPT-5.2)
**Scope:** Bot context injection, per-room task board, project history, and 3D task visualization.

> This doc builds on `docs/room-projects-masterplan.md` (projects + room assignment) and the current DB schema (`backend/app/db/database.py`) + existing UI patterns (e.g. `BotInfoPanel.tsx`).

---

## 0) What already exists in CrewHub (quick inventory)

### Data / schema (existing)
From `backend/app/db/database.py`:

- `rooms`
  - core: `id, name, icon, color, sort_order, default_model, speed_multiplier`
  - **already migrated**: `project_id TEXT REFERENCES projects(id)`
  - **already migrated**: `is_hq BOOLEAN DEFAULT 0`
  - also present: `floor_style, wall_style`

- `projects`
  - `id, name, description, icon, color, status, created_at, updated_at`
  - migrated: `folder_path TEXT` (v5)

- `agents` registry
  - fixed agents have `agent_session_key` like `agent:main:main` etc.

- `session_room_assignments`
  - maps a runtime `session_key` → `room_id`

- `session_display_names`
  - maps `session_key` → display name

- `room_assignment_rules`
  - routing rules based on `session_key_contains` / `session_type` etc.

- `settings`, `connections`, `custom_blueprints`

**Important implication:** tasks/history are not yet modeled in DB; projects/rooms are.

### Frontend UI pattern (existing)
From `frontend/src/components/world3d/BotInfoPanel.tsx`:

- There is a right-side “panel” pattern with:
  - local state
  - actions that hit REST endpoints
  - refresh hooks (`useRooms().refresh()`)
- Bots can be moved between rooms via `POST /session-room-assignments` and `DELETE /session-room-assignments/{session_key}`.

This is relevant because the **RoomInfoPanel** and **TaskBoard UI** should reuse the same panel interaction model.

---

## 1) Goals & non-goals

### Goals
1. **Bot Context Injection**: when a bot/session is assigned to a room, the agent should immediately “know”:
   - room identity and role (HQ vs normal)
   - project details (or aggregated view if HQ)
   - task board context for that room/project

2. **Task Board per Room**:
   - tasks created from HQ or from within a room
   - tasks appear in the corresponding room’s board (and optionally in HQ’s global board)
   - visible in Room Info panel

3. **Project History**:
   - all meaningful task lifecycle events become an immutable audit/history stream
   - history is queryable per project and per room

4. **3D Task Visualization**:
   - active tasks displayed on a wall inside the room (read-only visualization v1)

### Non-goals (v1)
- Full Jira replacement: complex workflows, sprint planning, dependencies/graphs
- Heavy permissioning/ACLs (can be added later)
- Real-time collaborative editing beyond “best effort” updates

---

## 2) Architectural overview

### Key principle: tasks are project-scoped, optionally room-scoped
Given the masterplan: **one project per room**, but one project can span multiple rooms. Therefore:

- **Primary ownership**: `tasks.project_id` (optional but strongly recommended)
- **Optional locality**: `tasks.room_id` (where it is shown / executed)
- HQ can create tasks at project level and optionally target a room.

### Event sourcing-lite for history
Instead of trying to store “history” as text blobs, use a canonical **TaskEvent** stream:

- any mutation to a task inserts a `task_events` row
- the task row is the “current state” (fast queries)
- events are the audit trail and power “project history” views

This is lightweight event sourcing without requiring rebuilding state from scratch.

### Context injection pipeline
When a session enters a room (or the room’s project changes), the backend emits a **context payload**.

Two complementary mechanisms:
1. **Push** (preferred): via existing WS/SSE channel used to update UI state.
2. **Pull**: agent runtime asks `GET /sessions/{key}/context` (or room context endpoint) when it starts.

For OpenClaw / LLM prompt injection, you want a stable “system prompt snippet” that is generated from the context payload.

---

## 3) Data model proposal (tasks + history)

### 3.1 Tables

#### `tasks`
Current-state table.

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,

  -- ownership / display scoping
  project_id TEXT REFERENCES projects(id),
  room_id TEXT REFERENCES rooms(id),

  title TEXT NOT NULL,
  description TEXT,

  status TEXT NOT NULL DEFAULT 'todo',
  -- todo | doing | blocked | done | canceled

  priority INTEGER NOT NULL DEFAULT 2,
  -- 0=lowest .. 4=highest (or 1..5)

  created_by_session_key TEXT,
  assigned_to_session_key TEXT,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  due_at INTEGER,

  -- optional: for 3D wall ordering / placement
  sort_order INTEGER DEFAULT 0,

  -- optional: link to external systems later
  external_ref TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_room ON tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to_session_key);
```

Notes:
- `project_id` can be nullable to allow “room-only” tasks in General rooms, but most tasks should resolve to a project if one exists.
- `assigned_to_session_key` aligns with existing session keys (`agent:...` or ephemeral sessions).

#### `task_events`
Immutable append-only stream.

```sql
CREATE TABLE IF NOT EXISTS task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  project_id TEXT REFERENCES projects(id),
  room_id TEXT REFERENCES rooms(id),

  type TEXT NOT NULL,
  -- created | updated | status_changed | assigned | unassigned
  -- comment | blocked | unblocked | moved_room | moved_project
  -- archived | deleted (soft)

  actor_session_key TEXT,

  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_task_events_project ON task_events(project_id);
CREATE INDEX IF NOT EXISTS idx_task_events_room ON task_events(room_id);
CREATE INDEX IF NOT EXISTS idx_task_events_created_at ON task_events(created_at);
```

Notes:
- denormalizing `project_id/room_id` into events makes project history queries easy even if the task is later moved.
- `payload_json` stores diffs/metadata (old/new status, comment text, etc.)

#### (Optional v1.5) `project_events`
If you want project-level history that is not task-based (e.g. “room assigned project”, “project status changed”).

But you can also reuse a generalized `events` table later.

### 3.2 API endpoints

#### Task board queries
- `GET /rooms/{room_id}/tasks?status=todo,doing,blocked,done`
- `GET /projects/{project_id}/tasks?status=...`
- `GET /tasks/{task_id}`

#### Task mutations (each must create events)
- `POST /tasks`
  - body: `{ title, description?, project_id?, room_id?, priority?, assigned_to_session_key? }`
  - emits event: `created`

- `PUT /tasks/{task_id}`
  - patch-style updates
  - emits event: `updated` (payload contains changed fields)

- `POST /tasks/{task_id}/status`
  - body: `{ status }`
  - emits event: `status_changed`

- `POST /tasks/{task_id}/assign`
  - body: `{ assigned_to_session_key }` (nullable to unassign)
  - emits event: `assigned` / `unassigned`

- `POST /tasks/{task_id}/comment`
  - body: `{ text }`
  - emits event: `comment`

#### History
- `GET /projects/{project_id}/history?limit=200&cursor=...`
  - returns merged stream of task_events (and later project_events)

- `GET /rooms/{room_id}/history?limit=200&cursor=...`

Implementation detail:
- cursor can be `(created_at, id)` tuple for stable pagination.

### 3.3 Consistency rules

1. If a room has `rooms.project_id` set and a task is created with `room_id` but no `project_id`, backend should auto-fill `project_id`.
2. If a task is moved to another room with a different project:
   - either automatically move `project_id` to match room’s project
   - or allow mismatch but show warning (not recommended v1)

Recommendation for v1: **enforce invariants**.
- If `room_id` belongs to project X, then `task.project_id` must be X (or null only if room has no project).

---

## 4) Bot context injection design

### 4.1 What context do bots need?

**Room-scoped bot (normal room):**
- Room: `{id, name, is_hq, icon, color}`
- Project: `{id, name, description, status, icon, color, folder_path?}`
- Task board summary (small):
  - top N `todo/doing/blocked` tasks (title + id + status + assignee)
  - optional: “tasks assigned to you”

**HQ bot:**
- all projects overview (from masterplan)
- optionally all active tasks across projects (but careful with token bloat)

### 4.2 Where to inject?

There are 3 layers:

1. **Backend → session context object** (canonical)
   - computed from DB and current assignments

2. **Backend → frontend (UI)**
   - room panel + 3D wall rely on it

3. **Backend/OpenClaw → LLM system prompt**
   - transforms canonical context into a prompt snippet

### 4.3 Canonical context payload (proposed)

`RoomContextPayload` (normal room):

```json
{
  "room": {
    "id": "dev-room",
    "name": "Dev Room",
    "is_hq": false,
    "project_id": "proj-123"
  },
  "project": {
    "id": "proj-123",
    "name": "Website Redesign",
    "description": "Redesign the main website for Q2 launch",
    "status": "active",
    "folder_path": "/..."
  },
  "tasks": {
    "counts": {"todo": 12, "doing": 2, "blocked": 1, "done": 31},
    "highlight": [
      {"id": "t1", "title": "Implement login", "status": "doing", "assigned_to": "agent:dev:main"}
    ],
    "assigned_to_me": []
  }
}
```

HQ payload:

```json
{
  "room": {"id": "headquarters", "name": "Headquarters", "is_hq": true},
  "projects": [
    {"id": "proj-123", "name": "Website Redesign", "status": "active", "room_ids": ["dev-room"], "active_task_count": 3}
  ]
}
```

### 4.4 Trigger points

- when `session_room_assignments` changes (bot moved/unassigned)
- when `rooms.project_id` changes
- when task board changes (create/status/assign) for that room/project

Mechanism:
- backend broadcasts events: `room-context-updated:{room_id}` and/or `task-updated:{task_id}`.
- agents can re-fetch context when they receive such event (or backend can push the full payload if cheap).

### 4.5 Prompt injection strategy

Avoid dumping everything into the system prompt. Use a tiered approach:

- **System prompt**: stable identity + room + project short description + top 3 active tasks.
- **Tool / endpoint**: `GET /rooms/{room_id}/context` for full details.
- **On-demand**: agent fetches and summarizes if needed.

This reduces token costs and avoids stale huge prompts.

---

## 5) UX flows

### 5.1 Creating a task (from HQ)

Flow:
1. In HQ RoomInfoPanel, show “Tasks” section:
   - global filters: project dropdown, status tabs
2. Click **New Task**
3. Modal fields:
   - Project (required unless “General task”)
   - Room target (optional; defaults to one of the project’s rooms or none)
   - Title, description, priority
   - Assign to (optional: choose agent/session)
4. Create → task appears on:
   - HQ global view
   - targeted room task board (if room specified)
   - project view

### 5.2 Creating a task (inside a room)

Flow:
1. Open RoomInfoPanel → “Task Board” section
2. Click **New Task**
3. Defaults:
   - project prefilled from room
   - room prefilled to current room
4. Create

### 5.3 Executing a task (bot perspective)

- Bot sees “Assigned to me” tasks at top.
- When the bot starts working, it sets status:
  - `todo → doing`
- On completion:
  - `doing → done`
- If blocked:
  - `doing → blocked` + comment

All of the above create `task_events` so the history is readable.

### 5.4 Viewing history

Two entry points:

1. **Project view (HQ)**
   - select a project → “History” tab

2. **Room view**
   - RoomInfoPanel includes “Recent activity” list (latest 20 events)
   - click “View all” → dedicated History panel

History item rendering examples:
- “Dev assigned task ‘Implement login’ to Dev (18:02)”
- “Status changed: doing → blocked (reason: waiting on API key)”

### 5.5 BotInfoPanel integration

BotInfoPanel currently focuses on bot/session info and moving rooms.

Additions (optional v1):
- show **tasks assigned to this bot** (query by `assigned_to_session_key`)
- quick action buttons: “Mark current task done”, “Open assigned tasks”

---

## 6) 3D Task Visualization (wall)

### 6.1 Rendering approach

Goal: show active tasks on a “wall” inside each room.

Implementation options:

**Option A (recommended v1): 2D overlay rendered in 3D (HTML/Canvas texture)**
- Create a plane mesh on the wall.
- Render task cards to a canvas (or use `@react-three/drei` `<Html />` anchored).
- Pros: fastest, readable typography, easy iteration.
- Cons: HTML-in-3D can have occlusion/aliasing issues; canvas text can be a bit blurry.

**Option B: True 3D cards**
- Each task is a small 3D card mesh with text via SDF.
- Pros: consistent 3D look.
- Cons: significantly more work, performance risk.

Recommendation: **Option A** for v1, then evolve.

### 6.2 What to show on the wall

Keep it minimal:
- Columns: `TODO | DOING | BLOCKED`
- Each card: short title (truncate), assignee icon, priority dot
- A small counter for DONE (collapsed) to reduce clutter

### 6.3 Interactions

v1 interactions:
- hover highlights a card (if possible)
- click opens the RoomInfoPanel TaskBoard and scrolls to the task

Avoid direct inline editing in 3D in v1.

### 6.4 Sorting / layout

- use `sort_order` then `updated_at` descending
- limit number of visible cards per column (e.g. 10) and show “+N more”

---

## 7) Risks & open questions

### Risks
1. **Prompt/token bloat**
   - injecting full project history or full task lists will explode tokens.
   - mitigation: small “highlight” in system prompt; fetch details on demand.

2. **State drift** (tasks updated but bots still acting on old context)
   - mitigation: broadcast “context updated” events; bots re-fetch when needed.

3. **Ambiguous identity for assignees**
   - `assigned_to_session_key` works for fixed agents but ephemeral sessions may come/go.
   - mitigation: prefer assigning to fixed agent keys; allow “unassigned” for others.

4. **Invariants between room.project_id and task.project_id**
   - without enforcement, tasks could show in wrong boards.
   - mitigation: enforce in backend and/or auto-correct.

5. **Concurrency**
   - two users/bots updating same task simultaneously.
   - mitigation: last-write-wins v1; optionally add `updated_at` precondition later.

6. **3D readability/performance**
   - too many cards can clutter and slow render.
   - mitigation: cap visible cards; summarise.

### Open questions
1. Do tasks belong primarily to **projects** or **rooms** when a room is “General” (`project_id = NULL`)?
2. Should HQ see **all tasks across all projects by default**, or must it filter by project to prevent overload?
3. Do we need an explicit “task creator identity” beyond `created_by_session_key` (e.g. human user id)?
4. What are the required event types for “project history” besides task events (room assigned project, project status changed)?
5. How will OpenClaw integrate: does CrewHub generate the final system prompt, or does OpenClaw assemble it from context JSON?

---

## 8) Suggested implementation phases (incremental)

### Phase A — Backend schema + minimal CRUD
- Add `tasks`, `task_events` tables + indexes.
- Implement endpoints: create/update/status/assign/list.

### Phase B — Room Task Board UI
- Add section to RoomInfoPanel:
  - list tasks grouped by status
  - create task modal
  - basic status change

### Phase C — History UI
- Activity feed in RoomInfoPanel and HQ.

### Phase D — Bot context integration
- Provide `GET /rooms/{room_id}/context` and `GET /sessions/{session_key}/context`.
- Broadcast updates.

### Phase E — 3D wall visualization
- Read-only wall with active tasks (todo/doing/blocked).

---

## 9) Appendix: mapping to current masterplan

The existing masterplan already defines:
- `projects` table
- `rooms.project_id` and `rooms.is_hq`
- HQ special behavior (aggregated project view)

This task management design extends it by:
- adding a canonical task model
- creating an immutable event stream for “project history”
- defining a context payload that can be injected into bots and UI consistently.
