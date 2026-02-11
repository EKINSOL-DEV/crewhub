# Zen Mode Projects Panel — Design Document

> **Version:** 1.1  
> **Date:** 2026-02-10  
> **Status:** Draft  
> **CrewHub Version:** v0.12.0 → v0.13.0

---

## 1. Overview

Rename and extend the existing "Documents Panel" (`ZenDocumentsPanel`) into a **Projects Panel** that serves as a unified project workspace within Zen Mode. The Projects Panel combines document browsing with project-level filtering that propagates to Tasks and Kanban panels.

Additionally, refactor the **RoomInfoPanel** (3D world sidebar) from a single vertical scroll into a **tab-based layout** for much better UX.

### Goals
1. **Rename** Documents Panel → Projects Panel (UI + code)
2. **Add project filter dropdown** to Tasks, Kanban, and Projects panels
3. **Pre-select project filter** when entering Zen Mode via the Zen Beeldje (room → project association)
4. **Without filter** = show everything (current behavior preserved)
5. **Refactor RoomInfoPanel** into 3 tabs: Room Info, Project, Project Files

### Non-Goals
- No new database tables or API endpoints needed (existing infrastructure is sufficient)
- No changes to the 3D world or Zen Beeldje behavior (already calls `enterWithProject`)
- No project CRUD within Zen Mode (use HQ for that)

---

## 2. Current Architecture

### Component Map
```
ZenMode.tsx
├── useZenMode() hook (tabs, project filter, state persistence)
├── ZenTasksPanel.tsx      — receives projectId, filters via useTasks({projectId})
├── ZenKanbanPanel.tsx     — receives projectId, filters via useTasks({projectId})
├── ZenDocumentsPanel.tsx  — receives projectId, browses project docs
└── ZenTopBar.tsx          — shows active project filter badge
```

### State Flow (current)
```
ZenBeeldje click
  → zenMode.enterWithProject({ projectId, projectName, projectColor })
  → Creates/switches to tab with projectFilter
  → ZenMode.tsx derives activeProjectId from tab.projectFilter OR worldFocusState
  → Passes activeProjectId to Tasks/Kanban/Documents panels
```

### What Already Works
- ✅ Project filter stored per-tab in `useZenMode`
- ✅ `enterWithProject()` creates a project-scoped tab
- ✅ Tasks and Kanban accept `projectId` prop and filter server-side
- ✅ Documents panel browses project docs when given `projectId`
- ✅ Top bar shows project filter badge with clear button

### What's Missing
- ❌ No way to change project filter **within** Zen Mode (only set on entry)
- ❌ Panel type is still called "documents" in code and UI
- ❌ No project selector dropdown in Tasks/Kanban/Projects panels
- ❌ Documents panel doesn't show project overview info (just file tree)

---

## 3. Proposed Architecture

### 3.1 Projects Panel (replaces Documents Panel)

The Projects Panel is a **tabbed panel** with two views:

#### Tab 1: Overview
- Project name, description, color badge
- Quick stats: task counts by status, room count, agent count
- Links to related rooms
- Recent activity (optional, Phase 2)

#### Tab 2: Documents
- Existing `ZenDocumentsPanel` functionality (file tree + markdown viewer)
- No changes to document browsing behavior

When no project is selected, show a **project picker** list (all projects) instead.

### 3.2 Project Filter Dropdown

A shared `<ProjectFilterSelect>` component rendered in:
- **ZenTasksPanel** header (replaces static focus indicator)
- **ZenKanbanPanel** header (replaces static focus indicator)
- **ProjectsPanel** header

Behavior:
- Dropdown lists all projects + "All Projects" option
- Selecting a project updates `tab.projectFilter` via `useZenMode`
- All panels on the same tab react to the filter change
- "All Projects" clears the filter → shows everything

### 3.3 State Management

```
useZenMode (existing)
  └── tab.projectFilter: { projectId, projectName, projectColor } | null
      ├── Set on entry via enterWithProject()
      ├── Set via ProjectFilterSelect dropdown (NEW)
      └── Cleared via top bar badge × or dropdown "All"

ZenMode.tsx (existing derivation)
  └── activeProjectId = tab.projectFilter?.projectId || worldFocus room's project
      └── Passed to: ZenTasksPanel, ZenKanbanPanel, ProjectsPanel
```

**No new state needed.** The existing `tab.projectFilter` in `useZenMode` is sufficient. We just need a way to set it from within panels.

### 3.4 Component Hierarchy

```
ZenMode.tsx
├── ZenTopBar.tsx
│   └── Project filter badge (existing, keep)
├── ProjectsPanel.tsx (renamed from ZenDocumentsPanel)
│   ├── ProjectFilterSelect (shared)
│   ├── ProjectOverview (new, when project selected)
│   └── DocumentsBrowser (extracted from ZenDocumentsPanel)
├── ZenTasksPanel.tsx
│   └── ProjectFilterSelect (shared)
├── ZenKanbanPanel.tsx
│   └── ProjectFilterSelect (shared)
```

### 3.5 Shared Components

#### `ProjectFilterSelect`
```tsx
interface ProjectFilterSelectProps {
  currentProjectId: string | null
  onSelect: (projectId: string | null, projectName: string, projectColor?: string) => void
  compact?: boolean  // For narrow panels
}
```

Fetches project list via existing `/api/projects` endpoint. Renders as a styled dropdown matching Zen Mode theme variables.

---

## 4. Pre-Selection Logic

### Entry via Zen Beeldje (existing, no change)
1. User clicks Zen Beeldje in Room3D
2. `Room3D.handleZenActivate()` calls `zenMode.enterWithProject({...})`
3. `enterWithProject` checks for existing tab with same `projectId`
4. Creates new tab or switches to existing one
5. Tab has `projectFilter` set → panels auto-filter

### Entry via Zen Mode button (global)
1. User clicks Zen Mode button (bottom-left)
2. Opens with last active tab (persisted in localStorage)
3. If tab has `projectFilter` → panels are pre-filtered
4. If not → shows all tasks/projects

### Changing filter within Zen Mode (NEW)
1. User selects project in any panel's `ProjectFilterSelect`
2. Calls `setProjectFilter(tabId, filter)` on `useZenMode`
3. All panels on same tab re-render with new filter
4. Tab label updates to project name

---

## 5. UX Flow

```
┌─────────────────────────────────────────────────────────┐
│ Zen Mode Tab Bar: [CrewHub ×] [My Project ×] [+]       │
├────────────────────┬────────────────────────────────────┤
│ Projects Panel     │ Tasks Panel                        │
│ ┌────────────────┐ │ ┌──────────────────────────────┐   │
│ │ Filter: [MyProj▾]│ │ Filter: [My Project     ▾]   │   │
│ ├────────────────┤ │ ├──────────────────────────────┤   │
│ │ [Overview|Docs]│ │ │ 📋 All │ 🔄 3 │ 👀 1 │ ...  │   │
│ ├────────────────┤ │ ├──────────────────────────────┤   │
│ │ My Project     │ │ │ Task 1: Fix login bug        │   │
│ │ 🎯 12 tasks    │ │ │ Task 2: Add tests            │   │
│ │ 🏠 2 rooms     │ │ │ ...                          │   │
│ │ 🤖 3 agents    │ │ └──────────────────────────────┘   │
│ │                │ │                                    │
│ │ [View Docs →]  │ │                                    │
│ └────────────────┘ │                                    │
└────────────────────┴────────────────────────────────────┘
```

When "All Projects" selected:
- Projects Panel shows project list (clickable to select)
- Tasks Panel shows all tasks across projects
- Kanban shows all tasks across projects

---

## 6. Data Flow

### Existing APIs (no changes needed)

| Endpoint | Used By | Filter Support |
|----------|---------|---------------|
| `GET /api/projects` | ProjectFilterSelect, ProjectOverview | — |
| `GET /api/projects/overview` | ProjectOverview (stats) | — |
| `GET /api/tasks?project_id=X` | ZenTasksPanel, ZenKanbanPanel | ✅ Already supported |
| `GET /api/projects/{id}/documents` | DocumentsBrowser | ✅ Already supported |

### New Hook: `useProjects`
Simple fetch hook for project list. Cached, auto-refreshes on SSE `project_updated` events.

```tsx
function useProjects(): {
  projects: Project[]
  isLoading: boolean
  error: string | null
}
```

---

## 7. Panel Type Registry Update

Current panel types in `types/layout.ts`:
```ts
type PanelType = 'chat' | 'sessions' | 'activity' | 'rooms' | 'tasks' | 
                 'kanban' | 'cron' | 'logs' | 'documents' | 'empty'
```

Change to:
```ts
type PanelType = 'chat' | 'sessions' | 'activity' | 'rooms' | 'tasks' | 
                 'kanban' | 'cron' | 'logs' | 'projects' | 'empty'
```

**Migration:** Persisted layouts in localStorage with `panelType: 'documents'` need to be migrated to `'projects'`. Handle in `loadPersistedState()`.

---

## 8. RoomInfoPanel Tab-Based Redesign

### Problem
The current `RoomInfoPanel` (`world3d/RoomInfoPanel.tsx`) renders everything in a single vertical scroll:
1. Project info (name, description, status badge, change/clear buttons)
2. Project Files (inline file browser via `ProjectFilesSection`)
3. Tasks section (summary counts + active task cards + "View Board →")
4. Room Stats (Total Agents, Active, Idle, Sleeping)
5. Agents in Room (list with status/model)

This is **too much content** for a 360px-wide sidebar panel. Users have to scroll constantly.

### Solution: 3 Tabs

The panel header (room icon, name, activity status, edit/close buttons) stays fixed at the top. Below it, a **tab bar** switches between three views:

#### Tab 1: 🏠 Room Info (default)
- Room Stats grid (Total Agents, Active, Idle, Sleeping)
- Agents in Room list (name, status badge, model)
- This is the most frequently needed view

#### Tab 2: 📋 Project
- Project info card (name, icon, color dot, description, status badge)
- Project actions (Change Project / Clear buttons)
- Tasks summary (count badges: "2 To Do, 1 In Progress, 1 Blocked, 5 Done")
- "View Board →" button to open full task board
- Active task preview (top 3-5 mini task cards)
- When no project assigned: "Assign Project" button

#### Tab 3: 📂 Files
- Only visible when project has `folder_path` or `docs_path`
- Full file tree browser (currently `ProjectFilesSection`)
- Markdown viewer for selected file
- Fullscreen toggle button
- When no project: tab hidden or shows "No project assigned"

### Tab Bar Design
```
┌─────────────────────────────────────┐
│ 🎯 My Room                    ✏️ ✕ │
│ ● 2 agents working                 │
├──────────┬──────────┬───────────────┤
│ 🏠 Room  │ 📋 Proj  │ 📂 Files     │
├──────────┴──────────┴───────────────┤
│                                     │
│  [Tab content - no more scrolling   │
│   for most tabs!]                   │
│                                     │
└─────────────────────────────────────┘
```

### State
- Active tab stored in component local state (no persistence needed — it resets on panel close/reopen, which is fine)
- Default tab: "Room Info" (most common use case)
- When entering via task notification: auto-switch to "Project" tab
- Files tab auto-hidden when no project docs available

### Component Extraction

Current `RoomInfoPanel.tsx` is 600+ lines. Refactor into:

```
RoomInfoPanel.tsx (shell: header + tab bar + tab content)
├── RoomInfoTab.tsx      — stats grid + agent list
├── RoomProjectTab.tsx   — project info + tasks summary + actions
├── RoomFilesTab.tsx     — file tree + markdown viewer (wraps ProjectFilesSection)
└── (shared helpers stay in RoomInfoPanel or extract to utils)
```

### HQ Room Special Case
When `room.is_hq === true`, the Project tab is replaced with the **HQ Dashboard** (existing `HQDashboard` component showing all projects overview + "HQ Board" button). The tab label changes to "🏛️ HQ".

---

## 9. Theme Integration

The `ProjectFilterSelect` dropdown and `ProjectOverview` components use existing Zen theme CSS variables:
- `--zen-bg-panel`, `--zen-bg-hover`, `--zen-bg-active`
- `--zen-fg`, `--zen-fg-muted`, `--zen-border`
- `--zen-accent` for selected state

No new theme variables needed.
