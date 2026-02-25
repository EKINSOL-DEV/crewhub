# Room Projects & Interaction Overhaul — Design Document

**Date:** 2026-02-04
**Status:** Draft
**Author:** Ekinbot (design analysis)

---

## 1. Current State

### 1.1 Room Interaction Model

Rooms are rendered in `Room3D.tsx` as composites of floor, walls, nameplate, and a **magnifying glass focus button** (`RoomFocusButton`, lines 22–58). This 🔍 button is an `<Html>` overlay from `@react-three/drei` positioned at `[0, 4.2, 0]` above each room. Clicking it calls `focusRoom(roomId)` from `WorldFocusContext`.

There is **no hover behavior** on rooms today — the only interactive element is the magnifying glass icon. The rooms themselves (`RoomFloor`, `RoomWalls`) are plain meshes with no pointer event handlers.

### 1.2 Focus Levels

`WorldFocusContext.tsx` manages a state machine with four levels:

| Level | Description | Triggered by |
|-------|-------------|-------------|
| `overview` | Top-down view of entire building | Default / Esc |
| `room` | Camera zooms to a specific room | 🔍 button or RoomTabsBar click |
| `bot` | Camera zooms to a specific bot, BotInfoPanel slides in | Clicking a bot in 3D |
| `firstperson` | WASD walking mode | 🚶 button |

Transitions are debounced (50ms) and animated (~900ms camera transition). `goBack()` moves up one level: `bot → room → overview`.

### 1.3 Existing HUD Patterns

- **BotInfoPanel** (`BotInfoPanel.tsx`): Right-side slide-in panel (320px wide, `position: absolute; top: 16; right: 16; bottom: 80`). Shows bot info, status, model, tokens, last message. Has "Open Chat" and "Open Full Log" buttons. Slides in with CSS animation.
- **RoomTabsBar** (`RoomTabsBar.tsx`): Bottom-center tab bar showing all rooms with optional bot counts. Clicking a tab focuses that room.
- **WorldNavigation** (`WorldNavigation.tsx`): Top-left back button and first-person toggle.
- **Controls hint**: Top-right overlay with keyboard/mouse hints.

### 1.4 Room Data Model

**rooms** table (`database.py`, line ~25):
```
id TEXT PRIMARY KEY
name TEXT NOT NULL
icon TEXT
color TEXT
sort_order INTEGER DEFAULT 0
default_model TEXT
speed_multiplier REAL DEFAULT 1.0
created_at INTEGER NOT NULL
updated_at INTEGER NOT NULL
```

No concept of "project" exists. Rooms are organizational containers with visual properties (icon, color) and an optional model hint.

### 1.5 Room Assignment System

Sessions are routed to rooms via three mechanisms (priority order):
1. **Explicit assignment** — `session_room_assignments` table (drag-and-drop)
2. **Rule-based routing** — `room_assignment_rules` table (pattern matching on session key, model, label, channel)
3. **Agent default** — `agents.default_room_id` column
4. **Fallback** — `getDefaultRoomForSession()` or first room

### 1.6 Room API

`rooms.py` provides standard CRUD:
- `GET /rooms` — list all
- `GET /rooms/{id}` — get one
- `POST /rooms` — create
- `PUT /rooms/{id}` — update
- `DELETE /rooms/{id}` — delete (cascades assignments + rules)
- `PUT /rooms/reorder` — reorder

All mutations broadcast `rooms-refresh` via SSE.

---

## 2. Proposed Interaction Model

### 2.1 Remove Magnifying Glass

Delete the `RoomFocusButton` component entirely (lines 22–58 of `Room3D.tsx`) and remove its `<RoomFocusButton roomId={room.id} />` usage (line ~122). The focus-on-room behavior moves to direct room click.

### 2.2 Hover Behavior

**Technique:** Use `@react-three/fiber`'s built-in pointer events on the room group.

```tsx
// In Room3D
<group
  position={position}
  onPointerOver={(e) => {
    e.stopPropagation()
    setHovered(true)
    document.body.style.cursor = 'pointer'
  }}
  onPointerOut={(e) => {
    e.stopPropagation()
    setHovered(false)
    document.body.style.cursor = 'auto'
  }}
>
```

R3F uses Three.js raycasting under the hood — no manual raycaster needed. The `<group>` wraps all room meshes, so any child mesh triggers the event.

**Visual effect on hover:**
- **Option A (recommended): Emissive glow on floor.** Set `emissive` and `emissiveIntensity` on the `RoomFloor` `meshToonMaterial` when hovered. This creates a subtle brightening effect without post-processing.
  ```tsx
  <meshToonMaterial
    {...toonProps}
    emissive={isHovered ? roomColor : '#000000'}
    emissiveIntensity={isHovered ? 0.15 : 0}
  />
  ```
- **Option B: Scale pulse.** Slight Y-scale increase (1.0 → 1.02) on the room group. Cheap but less polished.
- **Option C: Outline pass.** Three.js `OutlinePass` from post-processing. Expensive and requires `EffectComposer` setup — not recommended for toon style.

**Recommendation:** Option A — emissive glow on floor + walls. Simple, performant, fits the toon aesthetic.

### 2.3 Click Behavior

**Click on room → Room Info Panel (HUD)**

```tsx
<group
  onClick={(e) => {
    e.stopPropagation()
    focusRoom(room.id)       // existing: zooms camera
    openRoomPanel(room.id)   // new: opens room HUD
  }}
>
```

The click triggers two things:
1. Camera focus (existing `focusRoom()`)
2. A new **RoomInfoPanel** HUD overlay

### 2.4 RoomInfoPanel — New HUD Component

A right-side slide-in panel, similar to `BotInfoPanel` but for rooms. Appears when focus level is `room`.

**Location:** Same slot as BotInfoPanel (`top: 16, right: 16, bottom: 80, width: 360px`). They're mutually exclusive — BotInfoPanel shows at `bot` level, RoomInfoPanel at `room` level.

**Content:**

```
┌─────────────────────────────┐
│  🏛️ Headquarters            │
│  ● Active                   │
│─────────────────────────────│
│                             │
│  📋 PROJECT                 │
│  ┌─────────────────────┐   │
│  │ Website Redesign     │   │
│  │ Redesign the main    │   │
│  │ website for Q2...    │   │
│  │ 🏷️ #design #frontend │   │
│  └─────────────────────┘   │
│  [Change Project] [Clear]   │
│                             │
│  📊 ROOM STATS             │
│  Agents    3 active, 1 idle │
│  Tokens    245.3k today     │
│  Activity  ████░░░░ 52%     │
│  Sessions  12 total         │
│                             │
│  🤖 AGENTS IN ROOM         │
│  ● Main     Active  Sonnet  │
│  ● Dev      Idle    Opus    │
│  ● Creator  Active  Sonnet  │
│  ○ Flowy    Sleep   —       │
│                             │
│─────────────────────────────│
│  [⚙️ Room Settings]         │
│  [📋 Assignment Rules]      │
└─────────────────────────────┘
```

### 2.5 Interaction with Existing Focus Levels

Updated state machine:

```
overview ──(click room)──→ room (+ RoomInfoPanel)
room     ──(click bot)───→ bot  (+ BotInfoPanel, replaces RoomInfoPanel)
room     ──(Esc)─────────→ overview (closes RoomInfoPanel)
bot      ──(Esc/Back)────→ room (+ RoomInfoPanel returns)
```

The `WorldFocusContext` doesn't need new levels — the `room` level now implies "show RoomInfoPanel" and `bot` level implies "show BotInfoPanel". The panels are toggled based on `focusState.level` in `World3DView.tsx`.

---

## 3. Project Data Model

### 3.1 New Database Table: `projects`

```sql
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,           -- accent color (hex), e.g. '#ef4444'
    icon TEXT,            -- emoji icon, e.g. '🚀'
    status TEXT DEFAULT 'active',  -- 'active', 'paused', 'completed', 'archived'
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

### 3.2 Room-Project Assignment

**Option A: One project per room (simple, recommended)**

Add a column to the `rooms` table:

```sql
ALTER TABLE rooms ADD COLUMN project_id TEXT REFERENCES projects(id);
```

This keeps it simple: one room = one project (or none). A room with `project_id = NULL` is a general/multipurpose room.

**Option B: Many-to-many junction table**

```sql
CREATE TABLE room_projects (
    room_id TEXT NOT NULL REFERENCES rooms(id),
    project_id TEXT NOT NULL REFERENCES projects(id),
    assigned_at INTEGER NOT NULL,
    PRIMARY KEY (room_id, project_id)
);
```

**Recommendation:** Option A. Nicky's vision describes rooms as "linked to a project" (singular). Multiple projects per room adds complexity without clear benefit. If needed later, migration is straightforward.

### 3.3 API Endpoints

#### Projects CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/projects` | List all projects |
| `GET` | `/projects/{id}` | Get project details |
| `POST` | `/projects` | Create new project |
| `PUT` | `/projects/{id}` | Update project |
| `DELETE` | `/projects/{id}` | Delete project (nullifies room assignments) |

#### Room-Project Assignment

| Method | Endpoint | Description |
|--------|----------|-------------|
| `PUT` | `/rooms/{id}/project` | Assign a project to room (`{ project_id: "..." }`) |
| `DELETE` | `/rooms/{id}/project` | Remove project from room |
| `GET` | `/rooms/{id}/project` | Get room's current project |

These endpoints broadcast `rooms-refresh` SSE so the frontend updates in real-time.

### 3.4 Pydantic Models

```python
class Project(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    status: str = 'active'
    created_at: int
    updated_at: int

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    status: Optional[str] = None

class RoomProjectAssign(BaseModel):
    project_id: str
```

### 3.5 Frontend Types

```typescript
// hooks/useProjects.ts
export interface Project {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  status: 'active' | 'paused' | 'completed' | 'archived'
  created_at: number
  updated_at: number
}

// Extend Room interface
export interface Room {
  // ...existing fields
  project_id: string | null
  project?: Project | null  // populated via join or separate fetch
}
```

### 3.6 How Agents Get Informed About Room Projects

When an agent session is routed to a room, the room's project context should be available to the agent. Two approaches:

**Approach A: System message injection (recommended)**

When CrewHub detects a session is active in a room with a project, it can inject/update a system context. This is most naturally done via the **OpenClaw gateway connection** — CrewHub already streams session data over WebSocket.

Add a `room_context` field to the session metadata that OpenClaw can use:
```json
{
  "room": {
    "id": "dev-room",
    "name": "Dev Room",
    "project": {
      "name": "Website Redesign",
      "description": "Redesign the main website for Q2 launch..."
    }
  }
}
```

The agent's system prompt or context would include: *"You are currently working in the Dev Room on the project: Website Redesign — Redesign the main website for Q2 launch."*

**Approach B: API polling**

Agents query `/rooms/{id}/project` to discover their context. This is simpler but requires agents to be aware of CrewHub's API.

**Recommendation:** Approach A, implemented incrementally. Start with the data model and UI; agent integration can follow as a separate phase.

---

## 4. Visual Design for Project Rooms

### 4.1 Nameplate Changes

The `RoomNameplate` component (`RoomNameplate.tsx`) currently shows only the room name on a floating sign board. For project rooms:

**Add a subtitle line** below the room name:

```tsx
// Inside RoomNameplate, after the name Text
{project && (
  <Text
    position={[0, -0.18, 0.08]}
    fontSize={0.16}
    color={project.color || '#6b7280'}
    anchorX="center"
    anchorY="middle"
    maxWidth={2.4}
  >
    {project.icon || '📋'} {project.name}
  </Text>
)}
```

The sign backing board height increases from `0.7` to `1.0` when a project is assigned, accommodating the subtitle.

### 4.2 Room Glow / Color Override

When a room has an active project with a custom color:

1. **Floor tint:** Blend the room's base color with the project color. The `RoomFloor` receives a `projectColor` prop and mixes it in:
   ```tsx
   emissive={projectColor || '#000000'}
   emissiveIntensity={projectColor ? 0.08 : 0}
   ```

2. **Subtle pulsing glow** for active projects: A slow sine-wave animation on emissive intensity (0.05 → 0.12 → 0.05 over ~3s). This signals "this room has purpose" at a glance.

### 4.3 Project Banner (Optional Enhancement)

A small floating banner/flag above the nameplate for rooms with projects:

```tsx
<Html position={[0, 3.8, -halfSize + 0.2]} center>
  <div style={{
    background: project.color || '#4f46e5',
    color: '#fff',
    padding: '2px 10px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  }}>
    {project.icon} {project.name}
  </div>
</Html>
```

**Recommendation:** Start with nameplate subtitle (4.1) + floor tint (4.2). Add banner (4.3) if users want more visibility from overview distance.

### 4.4 Room Stats Display

Room stats appear in the **RoomInfoPanel** (section 2.4), not in 3D. This keeps the 3D view clean.

Stats to display:
- **Agent count:** Active / idle / total (computed from `roomBots` map in `SceneContent`)
- **Token usage:** Sum of `session.totalTokens` for all sessions in room (today)
- **Activity level:** Percentage of active bots vs total
- **Session count:** Total sessions routed to this room

These are all **derived from existing data** — no new API needed. The `RoomInfoPanel` receives the bot placements for its room and computes stats client-side.

### 4.5 General Rooms (No Project)

Rooms without a project keep their current appearance — standard nameplate, base room color, no subtitle, no glow. They function as multipurpose spaces.

In the RoomInfoPanel, the project section shows:
```
📋 PROJECT
No project assigned
[Assign Project]
```

---

## 5. Implementation Plan

### Phase 1: Room Interaction Overhaul (2-3 days)

**Goal:** Replace magnifying glass with hover+click, add RoomInfoPanel.

| Task | Effort | Files |
|------|--------|-------|
| Remove `RoomFocusButton` from `Room3D.tsx` | 15m | `Room3D.tsx` |
| Add `onPointerOver`/`onPointerOut`/`onClick` to room `<group>` | 30m | `Room3D.tsx` |
| Pass hover state to `RoomFloor` + `RoomWalls` for emissive glow | 45m | `Room3D.tsx`, `RoomFloor.tsx`, `RoomWalls.tsx` |
| Create `RoomInfoPanel.tsx` (basic: room name, stats, agent list) | 3h | New: `RoomInfoPanel.tsx` |
| Wire RoomInfoPanel into `World3DView.tsx` at `room` focus level | 1h | `World3DView.tsx` |
| Update cursor style on hover | 15m | `Room3D.tsx` |
| Test focus transitions (overview ↔ room ↔ bot) | 1h | Manual testing |

**Total: ~6-7 hours**

### Phase 2: Project Data Model & API (1-2 days)

**Goal:** Backend support for projects and room-project assignment.

| Task | Effort | Files |
|------|--------|-------|
| Add `projects` table to `database.py` | 30m | `database.py` |
| Add `project_id` column to `rooms` table (migration) | 30m | `database.py` |
| Add Pydantic models for Project | 20m | `models.py` |
| Create `/projects` CRUD routes | 2h | New: `routes/projects.py` |
| Add `/rooms/{id}/project` assign/clear endpoints | 1h | `routes/rooms.py` |
| Update Room model to include `project_id` | 15m | `models.py`, `routes/rooms.py` |
| Seed some example projects | 15m | `database.py` |
| Frontend: `useProjects.ts` hook | 1h | New: `hooks/useProjects.ts` |
| Update `useRooms.ts` to include project data | 30m | `hooks/useRooms.ts` |

**Total: ~6-7 hours**

### Phase 3: Project UI in RoomInfoPanel (1 day)

**Goal:** Assign/view/clear projects from the room panel.

| Task | Effort | Files |
|------|--------|-------|
| Add project section to `RoomInfoPanel.tsx` | 2h | `RoomInfoPanel.tsx` |
| Create project picker modal/dropdown | 2h | New: `ProjectPicker.tsx` |
| "Create new project" inline form | 1h | `ProjectPicker.tsx` |
| Wire assign/clear API calls | 30m | `RoomInfoPanel.tsx` |

**Total: ~5-6 hours**

### Phase 4: Visual Indicators for Project Rooms (1 day)

**Goal:** Show project info on room nameplates and floors.

| Task | Effort | Files |
|------|--------|-------|
| Update `RoomNameplate.tsx` to accept project prop, render subtitle | 1.5h | `RoomNameplate.tsx` |
| Expand sign board height when project is present | 30m | `RoomNameplate.tsx` |
| Add emissive tint to `RoomFloor` for project rooms | 30m | `RoomFloor.tsx` |
| Optional: slow pulse animation on project rooms | 1h | `RoomFloor.tsx` |
| Pass project data through `Room3D → RoomNameplate/RoomFloor` | 30m | `Room3D.tsx` |
| Update `RoomTabsBar` to show project indicator | 30m | `RoomTabsBar.tsx` |

**Total: ~4-5 hours**

### Phase 5: Agent Project Context (Future)

**Goal:** Agents are informed about their room's project.

| Task | Effort | Files |
|------|--------|-------|
| Add `room_context` to WebSocket session metadata | 2h | Backend WS handler |
| OpenClaw integration: inject project context into system prompt | 3h | OpenClaw side |
| Test with real agent sessions | 2h | Integration testing |

**Total: ~7 hours** (requires OpenClaw changes)

### Summary Timeline

| Phase | Effort | Dependencies |
|-------|--------|-------------|
| Phase 1: Interaction | 2-3 days | None |
| Phase 2: Data model | 1-2 days | None (parallel with Phase 1) |
| Phase 3: Project UI | 1 day | Phase 1 + 2 |
| Phase 4: Visuals | 1 day | Phase 2 + 3 |
| Phase 5: Agent context | 1-2 days | Phase 2 + OpenClaw |

**Total estimated: 6-10 working days** for Phases 1-4.

---

## 6. Integration with Existing Systems

### 6.1 Routing Rules

Room assignment rules (`room_assignment_rules` table) are **unaffected**. Projects don't change how sessions are routed — they add context to rooms, not routing logic.

However, a future enhancement could add a rule type `project` that routes sessions by project keyword:
```
rule_type: 'project_keyword', rule_value: 'redesign' → routes to whichever room has the "Website Redesign" project
```

This is Phase 5+ territory.

### 6.2 Settings

No changes to the `settings` table needed. Projects are managed per-room, not globally.

Consider adding a setting `show_project_indicators: true/false` to toggle the visual indicators (for users who want cleaner rooms).

### 6.3 Modding System

If CrewHub has a modding/theming system:
- Project colors should be themeable
- The nameplate subtitle format could be configurable
- Custom project status types could be added

Currently no modding system is detected in the codebase, so this is future-proofing.

### 6.4 RoomTabsBar

The tab bar already shows room icons and names. With projects:
- Add a subtle dot indicator for rooms with active projects
- Optionally show project name as tooltip on hover
- Consider grouping: project rooms first, general rooms after

### 6.5 Drag-and-Drop

The existing `RoomDropZone` in `Room3D.tsx` (lines 62–114) is unaffected. When an agent is dropped into a project room, it inherits that room's project context (handled by Phase 5).

### 6.6 First Person Mode

In first-person walking mode, entering a project room could show the project name in the `FirstPersonHUD` (the room label already appears briefly). This is a small enhancement to `FirstPersonController`/`FirstPersonHUD`.

### 6.7 BotInfoPanel

The existing `BotInfoPanel.tsx` could gain a "Room Project" info row showing which project the bot's room is assigned to. This provides context when inspecting a specific agent.

---

## 7. Open Questions

1. **Can multiple rooms share the same project?** (e.g., "Website Redesign" assigned to both Dev Room and Creative Room) — Current design allows this since `rooms.project_id` is just a FK.

2. **Project lifecycle:** What happens when a project is marked "completed"? Should rooms auto-unassign? Or keep the completed project visible as historical context?

3. **Project templates:** Should there be pre-built project types (e.g., "Development Sprint", "Marketing Campaign", "Research") with default settings?

4. **Agent awareness priority:** How urgently do agents need to know about their project? Is it blocking (Phase 5 must ship with initial release) or can it follow later?

5. **Room stats API:** Should stats (token usage, activity) be computed server-side (new endpoint) or client-side from existing session data? Client-side is simpler but less accurate for historical data.
