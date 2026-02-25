# Room Projects — Masterplan

**Date:** 2026-02-04
**Status:** Definitive
**Sources:** Opus technical design + GPT-5.2 UX review + Nicky's HQ requirement

---

## 1. Executive Summary

**Project Rooms** turn CrewHub's 3D rooms from passive agent containers into purposeful workspaces. Each room can be assigned a single project—giving it a name, color, icon, and description that agents, bots, and humans all see. HQ (Headquarters) is the command center with full visibility across all rooms and projects.

Why it matters:
- **Clarity** — you see at a glance what each room is working on.
- **Agent context** — bots in a project room automatically know their assignment.
- **Organization** — projects span multiple rooms; rooms have one focus.
- **Command & control** — HQ aggregates everything for oversight.

---

## 2. Interaction Design

### 2.1 Remove the Magnifying Glass

Delete `RoomFocusButton` entirely. Rooms become directly interactive.

### 2.2 Hover

Add `onPointerOver`/`onPointerOut` to the room `<group>` in `Room3D.tsx`. Visual effect:

- **Floor emissive brighten** — set `emissive={roomColor}` and `emissiveIntensity={0.15}` on hover. Bounded to the room footprint, no bloom bleed.
- **Nameplate micro-scale** — scale nameplate to `1.04` on hover (subtle, fast tween).
- **Cursor** — `pointer` on hover.
- **Debounce** — 80ms hysteresis to prevent flicker at room boundaries.

No outline pass (expensive), no geometry scale (depth popping), no bloom.

### 2.3 Click — Overview Level

Clicking anywhere inside a room's collider at overview zoom:
1. Calls `focusRoom(roomId)` — camera zooms to room.
2. Opens the **Room HUD Panel** (right sidebar).

Bots do **not** steal clicks at overview level. The room is the only click target.

### 2.4 Click — Room Focus Level

When zoomed into a room:
- Clicking a **bot** → selects bot, opens BotInfoPanel (replaces Room HUD).
- Clicking the **floor** → re-opens Room HUD.
- **Esc** → back to overview.

### 2.5 State Machine

```
overview ──(click room)──→ room (+ Room HUD Panel)
room     ──(click bot)───→ bot  (+ BotInfoPanel, Room HUD hides)
room     ──(click floor)──→ room (Room HUD stays/reopens)
room     ──(Esc)──────────→ overview (Room HUD closes)
bot      ──(Esc/Back)─────→ room (+ Room HUD returns)
```

No new focus levels needed. `WorldFocusContext` remains unchanged—panels toggle based on `focusState.level`.

### 2.6 Touch / Mobile

- First tap highlights room, second tap opens Room HUD.
- Room HUD renders as a bottom sheet on small viewports (swipe up for full details).

### 2.7 UI State Variables

Track explicitly in context or zustand:
- `hoveredRoomId: string | null`
- `selectedRoomId: string | null` (= focused room)
- `panelOpen: boolean`

---

## 3. Project Data Model

### 3.1 Database: `projects` Table

```sql
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    icon TEXT,
    status TEXT DEFAULT 'active',  -- active | paused | completed | archived
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

### 3.2 Room-Project Link

One project per room. Add column to `rooms`:

```sql
ALTER TABLE rooms ADD COLUMN project_id TEXT REFERENCES projects(id);
```

A room with `project_id = NULL` is a **General Room**. One project can be assigned to multiple rooms.

### 3.3 API Endpoints

#### Projects CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/projects` | List all projects |
| `GET` | `/projects/{id}` | Get project details |
| `POST` | `/projects` | Create project |
| `PUT` | `/projects/{id}` | Update project |
| `DELETE` | `/projects/{id}` | Delete (nullifies room assignments) |

#### Room-Project Assignment

| Method | Endpoint | Description |
|--------|----------|-------------|
| `PUT` | `/rooms/{id}/project` | Assign project `{ project_id: "..." }` |
| `DELETE` | `/rooms/{id}/project` | Clear project from room |

#### HQ Aggregation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/projects/overview` | All projects with room + agent counts |

All mutations broadcast `rooms-refresh` via SSE.

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

### 3.5 TypeScript Interfaces

```typescript
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

// Extend existing Room interface
export interface Room {
  // ...existing fields
  project_id: string | null
  project?: Project | null  // joined or fetched separately
}
```

---

## 4. Visual Design

### 4.1 Nameplate — Primary Indicator

The `RoomNameplate` is the single source of truth for "what is this room about?"

**Project room nameplate:**
```
┌──────────────────────────┐
│  🏗️  Dev Room            │
│  ● Website Redesign      │  ← colored dot (project.color) + project name
└──────────────────────────┘
```

- Sign board height expands from `0.7` → `1.0` when a project is assigned.
- Project name line: `fontSize: 0.16`, color = `project.color || '#6b7280'`.
- Truncate project name at ~20 chars with ellipsis at overview zoom.

**General room nameplate:**
```
┌──────────────────────────┐
│  🏛️  Headquarters        │
│  GENERAL                 │  ← muted gray label
└──────────────────────────┘
```

This makes assigned vs. unassigned obvious without opening any panel.

### 4.2 Floor — Subtle Project Tint

Rooms with an active project get a persistent low-intensity emissive tint:
```tsx
emissive={project?.color || '#000000'}
emissiveIntensity={project ? 0.08 : 0}
```

No pulsing animation in v1—keep the scene calm. Pulsing can be added later for "active work" indication.

### 4.3 No Floating Banners in v1

The nameplate + floor tint provide sufficient differentiation. Floating HTML banners add visual noise and jitter with camera movement. Skip for now.

### 4.4 RoomTabsBar

Add a small colored dot before the room name in tabs for project rooms. Tooltip on hover shows full project name.

---

## 5. HQ Command Center

HQ is the **only room where bots have full visibility across all projects**. Other rooms are project-scoped.

### 5.1 HQ Detection

HQ is identified by a new boolean column on the `rooms` table:

```sql
ALTER TABLE rooms ADD COLUMN is_hq BOOLEAN DEFAULT 0;
```

Only one room can be HQ. The API enforces this: setting `is_hq = true` on one room clears it from all others.

### 5.2 HQ Room HUD — Extended Panel

When the Room HUD opens for HQ, it shows an additional **Projects Dashboard** section:

```
┌─────────────────────────────┐
│  🏛️ Headquarters            │
│  ● Command Center           │
│─────────────────────────────│
│                             │
│  📊 ALL PROJECTS            │
│  ┌─────────────────────┐   │
│  │ ● Website Redesign  │   │
│  │   Dev Room (3 agents)│   │
│  │   Active · 145k tok  │   │
│  ├─────────────────────┤   │
│  │ ● Marketing Push    │   │
│  │   Creative (2 agents)│   │
│  │   Active · 89k tok   │   │
│  ├─────────────────────┤   │
│  │ ○ Research Phase    │   │
│  │   Lab (1 agent)      │   │
│  │   Paused             │   │
│  └─────────────────────┘   │
│                             │
│  🤖 HQ AGENTS              │
│  ● Main     Active  Sonnet  │
│  ● Overseer Active  Opus    │
│                             │
│  📈 GLOBAL STATS            │
│  Total agents: 12           │
│  Total tokens today: 892k   │
│  Active projects: 3         │
└─────────────────────────────┘
```

### 5.3 HQ Bot Context

Bots assigned to HQ receive system context containing **all projects**:

```json
{
  "room": {
    "id": "hq",
    "name": "Headquarters",
    "is_hq": true,
    "all_projects": [
      {
        "name": "Website Redesign",
        "description": "...",
        "status": "active",
        "rooms": ["dev-room"],
        "agent_count": 3
      },
      ...
    ]
  }
}
```

Regular room bots only receive their own room's project (see §7).

### 5.4 HQ Visual Distinction

HQ gets a unique visual treatment:
- Nameplate shows `COMMAND CENTER` instead of `GENERAL`.
- Floor emissive uses a gold/amber tint (`#f59e0b`, intensity `0.06`) — always on, regardless of project assignment.
- HQ can optionally have a project assigned too (e.g., "Operations"), shown alongside the command center label.

---

## 6. Room HUD Panel

### 6.1 Decision: Single Right Sidebar (No Popover)

The UX review proposed a two-step popover → sidebar flow. **We go with sidebar only.** Reasons:
- Popovers anchored to 3D objects jitter with camera movement.
- The sidebar pattern already exists (BotInfoPanel) — consistency wins.
- One click = one panel. Simple.

### 6.2 Panel Specs

- **Position:** `top: 16, right: 16, bottom: 80, width: 360px`
- **Animation:** Slide in from right (same as BotInfoPanel).
- **Mutually exclusive** with BotInfoPanel — they share the same slot.

### 6.3 Layout

```
┌─────────────────────────────┐
│  {icon} {Room Name}         │
│  ● Active                   │  ← room status
│─────────────────────────────│
│                             │
│  📋 PROJECT                 │
│  ┌─────────────────────┐   │
│  │ {project.icon} {name}│   │
│  │ {description...}     │   │
│  │ Status: Active       │   │
│  └─────────────────────┘   │
│  [Change Project] [Clear]   │
│                             │
│  📊 ROOM STATS             │
│  Agents    3 active, 1 idle │
│  Tokens    245.3k today     │
│  Sessions  12 total         │
│                             │
│  🤖 AGENTS IN ROOM         │
│  ● Main     Active  Sonnet  │
│  ● Dev      Idle    Opus    │
│  ● Creator  Active  Sonnet  │
│                             │
│─────────────────────────────│
│  [⚙️ Room Settings]         │
│  [📋 Assignment Rules]      │
└─────────────────────────────┘
```

**No project assigned:**
```
│  📋 PROJECT                 │
│  General Room               │
│  [Assign Project]           │
```

### 6.4 Project Picker

Triggered by "Assign Project" or "Change Project":
- Dropdown/modal with search (typeahead).
- Recent projects at top.
- "Create new project…" at bottom (inline: name required, color/icon optional).
- Selection applies immediately.

### 6.5 Change Confirmation

If the room has active agents and the user changes/clears the project → show confirm dialog:
> **Change room project?**
> 3 agents are currently active. They will continue current tasks. New tasks will use the updated project context.
> [Cancel] [Change Project]

### 6.6 HQ Extension

When the panel opens for HQ, the "All Projects" dashboard section (§5.2) appears between the project section and room stats.

---

## 7. Agent Context

### 7.1 How Agents Learn About Their Project

When a session is active in a room with a project, CrewHub injects room context into the session metadata via the WebSocket connection.

**Regular room context:**
```json
{
  "room": {
    "id": "dev-room",
    "name": "Dev Room",
    "project": {
      "name": "Website Redesign",
      "description": "Redesign the main website for Q2 launch",
      "status": "active"
    }
  }
}
```

**HQ context (all projects):**
```json
{
  "room": {
    "id": "hq",
    "name": "Headquarters",
    "is_hq": true,
    "project": null,
    "all_projects": [
      { "name": "Website Redesign", "status": "active", "rooms": ["dev-room"], "agent_count": 3 },
      { "name": "Marketing Push", "status": "active", "rooms": ["creative"], "agent_count": 2 }
    ]
  }
}
```

### 7.2 System Prompt Injection

The agent's system prompt includes:
- Regular room: *"You are working in Dev Room on project: Website Redesign — Redesign the main website for Q2 launch."*
- HQ: *"You are in Headquarters (Command Center). You have visibility over all projects: Website Redesign (active, Dev Room, 3 agents), Marketing Push (active, Creative, 2 agents), …"*

### 7.3 Soft Routing

Project assignment creates a **routing preference**, not a hard constraint:
- Rooms assigned to Project X are preferred for agents tagged with Project X.
- Manual overrides always allowed.
- Sidebar shows: "Agents for [Project X] will prefer this room."

No hard locks in v1—avoids surprising failures.

---

## 8. Implementation Phases

### Phase 1: Room Interaction Overhaul (2–3 days)

Replace magnifying glass with hover+click, add Room HUD Panel.

| Task | Effort | Files |
|------|--------|-------|
| Remove `RoomFocusButton` | 15m | `Room3D.tsx` |
| Add pointer events to room `<group>` (hover, click) | 30m | `Room3D.tsx` |
| Hover state → emissive glow on `RoomFloor` + `RoomWalls` | 45m | `Room3D.tsx`, `RoomFloor.tsx`, `RoomWalls.tsx` |
| Hover debounce (80ms hysteresis) | 30m | `Room3D.tsx` |
| Nameplate micro-scale on hover | 20m | `RoomNameplate.tsx` |
| Create `RoomInfoPanel.tsx` (room name, stats, agent list) | 3h | New: `RoomInfoPanel.tsx` |
| Wire into `World3DView.tsx` at `room` focus level | 1h | `World3DView.tsx` |
| Click priority: overview = room only, room-focus = bots selectable | 30m | `Room3D.tsx` |
| Test focus transitions (overview ↔ room ↔ bot) | 1h | Manual |

**Total: ~8 hours**

### Phase 2: Project Data Model & API (1–2 days)

Backend support for projects.

| Task | Effort | Files |
|------|--------|-------|
| `projects` table + `rooms.project_id` column + `rooms.is_hq` column | 45m | `database.py` |
| Pydantic models for Project | 20m | `models.py` |
| `/projects` CRUD routes | 2h | New: `routes/projects.py` |
| `/rooms/{id}/project` assign/clear endpoints | 1h | `routes/rooms.py` |
| `/projects/overview` aggregation endpoint (for HQ) | 1h | `routes/projects.py` |
| HQ enforcement (only one room can be HQ) | 30m | `routes/rooms.py` |
| Update Room model to include `project_id`, `is_hq` | 15m | `models.py`, `routes/rooms.py` |
| Frontend: `useProjects.ts` hook | 1h | New: `hooks/useProjects.ts` |
| Update `useRooms.ts` to include project data | 30m | `hooks/useRooms.ts` |

**Total: ~7.5 hours**

### Phase 3: Project UI in Room HUD (1 day)

| Task | Effort | Files |
|------|--------|-------|
| Project section in `RoomInfoPanel.tsx` | 2h | `RoomInfoPanel.tsx` |
| Project picker (search, recent, inline create) | 2.5h | New: `ProjectPicker.tsx` |
| Change/clear with confirmation dialog | 1h | `RoomInfoPanel.tsx` |
| HQ extended panel (all projects dashboard) | 2h | `RoomInfoPanel.tsx` |

**Total: ~7.5 hours**

### Phase 4: Visual Indicators (1 day)

| Task | Effort | Files |
|------|--------|-------|
| Nameplate subtitle (project badge with colored dot) | 1.5h | `RoomNameplate.tsx` |
| Sign board height expansion when project assigned | 30m | `RoomNameplate.tsx` |
| General room label ("GENERAL" / "COMMAND CENTER" for HQ) | 30m | `RoomNameplate.tsx` |
| Floor emissive tint for project rooms | 30m | `RoomFloor.tsx` |
| HQ gold tint | 15m | `RoomFloor.tsx` |
| RoomTabsBar colored dot for project rooms | 30m | `RoomTabsBar.tsx` |
| Pass project data through `Room3D` → children | 30m | `Room3D.tsx` |

**Total: ~4.5 hours**

### Phase 5: Agent Context Integration (future, 1–2 days)

| Task | Effort | Files |
|------|--------|-------|
| Add `room_context` to WebSocket session metadata | 2h | Backend WS handler |
| HQ context: inject all projects into HQ bot sessions | 1.5h | Backend WS handler |
| Regular room context: inject single project | 1h | Backend WS handler |
| OpenClaw integration: system prompt injection | 3h | OpenClaw side |
| Test with real agent sessions | 2h | Integration testing |

**Total: ~9.5 hours**

### Timeline Summary

| Phase | Effort | Depends On |
|-------|--------|-----------|
| 1 — Interaction | ~8h (2–3 days) | — |
| 2 — Data Model | ~7.5h (1–2 days) | — (parallel with Phase 1) |
| 3 — Project UI | ~7.5h (1 day) | Phase 1 + 2 |
| 4 — Visuals | ~4.5h (1 day) | Phase 2 |
| 5 — Agent Context | ~9.5h (1–2 days) | Phase 2 + OpenClaw |

**Phases 1–4: ~28 hours / 5–7 working days.**
**Phase 5: additional 1–2 days (requires OpenClaw changes).**

---

## 9. Edge Cases & Decisions

| Question | Decision |
|----------|----------|
| Multiple projects per room? | **No.** One room = one project. Keeps UX and routing unambiguous. |
| One project spanning multiple rooms? | **Yes.** `rooms.project_id` is a plain FK — multiple rooms can reference the same project. |
| What happens when a project is "completed"? | Room keeps the assignment. Status shows as "Completed" on nameplate and panel. User can clear manually. No auto-unassign. |
| Change project while agents are active? | Allowed with confirmation dialog (§6.5). Active tasks continue; new tasks use new context. |
| Room has project but no agents? | Project badge still shows (it's configuration, not activity). Panel shows "Agents: 0" with suggestion to add agents. |
| Can HQ also have a project assigned? | **Yes.** HQ gets command center features regardless. An optional project is additive. |
| How is HQ identified? | `rooms.is_hq = true` column. Only one room can be HQ (enforced by API). |
| Touch devices (no hover)? | First tap = highlight, second tap = open panel. Bottom sheet layout on small screens. |
| Project templates? | **Not in v1.** Plain create with name/description/color/icon. Templates are a future enhancement. |
| Room stats: server-side or client-side? | **Client-side** from existing session data. Simple and sufficient for v1. Server-side aggregation only for `/projects/overview` (HQ). |
| Routing: hard or soft? | **Soft preference.** Project rooms are preferred targets, not exclusive. Manual override always allowed. |
| Unassigned room label? | "General Room" (not "None" or blank). HQ without project shows "Command Center". |
