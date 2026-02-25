# Zen Mode Projects Panel — Implementation Plan

> **Date:** 2026-02-10
> **Estimated Effort:** ~3-4 days
> **Risk:** Low (mostly refactoring + new UI, no DB changes)

---

## Phase 1: Rename Documents → Projects (0.5 day)

### File Changes
| Action | File | Details |
|--------|------|---------|
| Rename | `ZenDocumentsPanel.tsx` → `ProjectsPanel.tsx` | Keep existing code, change component name |
| Edit | `types/layout.ts` | Change `'documents'` → `'projects'` in PanelType union |
| Edit | `ZenMode.tsx` | Update import, switch case `'documents'` → `'projects'` |
| Edit | `ZenEmptyPanel.tsx` | Update panel type option label from "Documents" to "Projects" |
| Edit | `ZenCommandPalette.tsx` | Update command name if referenced |
| Edit | `hooks/useZenMode.tsx` | Add migration in `loadPersistedState()` for localStorage |

### localStorage Migration
In `loadPersistedState()`, after parsing:
```ts
// Migrate 'documents' → 'projects' panel type
function migrateLayout(node: LayoutNode): LayoutNode {
  if (node.kind === 'leaf') {
    return node.panelType === 'documents'
      ? { ...node, panelType: 'projects' }
      : node
  }
  return { ...node, a: migrateLayout(node.a), b: migrateLayout(node.b) }
}
```

---

## Phase 2: Shared ProjectFilterSelect Component (0.5 day)

### New Files
| File | Purpose |
|------|---------|
| `frontend/src/hooks/useProjects.ts` | Fetch + cache project list |
| `frontend/src/components/zen/ProjectFilterSelect.tsx` | Dropdown component |
| `frontend/src/components/zen/ProjectFilterSelect.css` | Styles |

### `useProjects` Hook
```ts
export function useProjects() {
  // GET /api/projects → cache in state
  // Listen to SSE 'project_updated' for refresh
  // Return { projects, isLoading, error }
}
```

### `ProjectFilterSelect` Component
- Fetches projects via `useProjects()`
- Shows dropdown: "All Projects" + project list with color dots
- On select, calls `onSelect(projectId | null, name, color)`
- Compact mode for narrow panels (icon only, expands on click)
- Styled with `--zen-*` CSS variables

### Integration Point
Add a new method to `useZenMode`:
```ts
setProjectFilter: (filter: ZenProjectFilter | null) => void
```
This updates `activeTab.projectFilter` and tab label. Wire it through ZenMode.tsx to child panels.

---

## Phase 3: Integrate Filter into Tasks & Kanban (0.5 day)

### ZenTasksPanel.tsx Changes
1. Add `ProjectFilterSelect` in header (between focus indicator and search)
2. Replace static focus indicator with the dropdown
3. Props: add `onProjectFilterChange?: (filter: ZenProjectFilter | null) => void`
4. When dropdown changes → call `onProjectFilterChange` → ZenMode updates tab filter → re-render

### ZenKanbanPanel.tsx Changes
Same pattern as Tasks:
1. Add `ProjectFilterSelect` in header
2. Replace static focus indicator
3. Add `onProjectFilterChange` callback

### ZenMode.tsx Changes
Pass filter change handler to both panels:
```tsx
case 'tasks':
  return (
    <ZenTasksPanel
      projectId={activeProjectId}
      roomFocusName={activeProjectName}
      onProjectFilterChange={handleProjectFilterChange}
    />
  )
```

Where `handleProjectFilterChange` calls:
```ts
const handleProjectFilterChange = useCallback((filter: ZenProjectFilter | null) => {
  if (filter) {
    setTabsState(prev => ({
      ...prev,
      tabs: prev.tabs.map(tab =>
        tab.id === prev.activeTabId
          ? { ...tab, projectFilter: filter, label: filter.projectName }
          : tab
      ),
    }))
  } else {
    clearProjectFilter()
  }
}, [clearProjectFilter])
```

---

## Phase 4: Redesign Projects Panel (1 day)

### Restructure `ProjectsPanel.tsx`

#### When no project selected → Project List
```tsx
function ProjectList({ projects, onSelect }) {
  // Grid/list of project cards
  // Each card: name, color, task count, room count
  // Click → sets project filter
}
```

#### When project selected → Tabbed View
```tsx
function ProjectsPanel({ projectId, projectName, onProjectFilterChange }) {
  const [activeView, setActiveView] = useState<'overview' | 'documents'>('overview')

  return (
    <>
      <ProjectFilterSelect ... />
      <ViewTabs active={activeView} onChange={setActiveView} />
      {activeView === 'overview' ? <ProjectOverview /> : <DocumentsBrowser />}
    </>
  )
}
```

#### ProjectOverview Component (new)
```tsx
function ProjectOverview({ projectId }) {
  // Fetch from /api/projects/overview
  // Display: name, description, task counts, room list, agent list
  // Quick action: "View Documents →" switches to documents tab
}
```

#### DocumentsBrowser Component (extracted)
- Extract existing file tree + markdown viewer logic from `ZenDocumentsPanel`
- Same functionality, just wrapped in the new panel structure

---

## Phase 5: RoomInfoPanel Tab Refactor (1 day)

### Problem
`RoomInfoPanel.tsx` is 600+ lines, renders everything vertically. Too much scrolling.

### Step 1: Extract Tab Components

Create 3 new files from existing code in `RoomInfoPanel.tsx`:

| New File | Extracts From |
|----------|--------------|
| `world3d/RoomInfoTab.tsx` | "Room Stats" section + "Agents in Room" section |
| `world3d/RoomProjectTab.tsx` | "Project" section + `TasksSection` + confirm dialogs |
| `world3d/RoomFilesTab.tsx` | `ProjectFilesSection` integration + fullscreen |

Shared helpers (`SectionHeader`, `InfoRow`, status helpers) → `world3d/roomInfoUtils.ts`

### Step 2: Add Tab Bar to RoomInfoPanel

```tsx
// RoomInfoPanel.tsx (simplified)
const [activeTab, setActiveTab] = useState<'room' | 'project' | 'files'>('room')

const hasFiles = !!currentProject?.folder_path || !!currentProject?.docs_path
const tabs = [
  { id: 'room', label: '🏠 Room', always: true },
  { id: 'project', label: room.is_hq ? '🏛️ HQ' : '📋 Project', always: true },
  { id: 'files', label: '📂 Files', always: hasFiles },
].filter(t => t.always)

return (
  <div>
    {/* Header (unchanged) */}
    <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />
    <div className="tab-content">
      {activeTab === 'room' && <RoomInfoTab ... />}
      {activeTab === 'project' && (room.is_hq ? <HQDashboard ... /> : <RoomProjectTab ... />)}
      {activeTab === 'files' && <RoomFilesTab ... />}
    </div>
  </div>
)
```

### Step 3: Tab Bar Styling

```css
/* Horizontal tab bar, matching panel's frosted glass aesthetic */
.room-panel-tabs {
  display: flex;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding: 0 16px;
  gap: 0;
}
.room-panel-tab {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #9ca3af;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.room-panel-tab.active {
  color: #374151;
  border-bottom-color: #3b82f6;
}
```

### File Changes
| Action | File |
|--------|------|
| **New** | `frontend/src/components/world3d/RoomInfoTab.tsx` |
| **New** | `frontend/src/components/world3d/RoomProjectTab.tsx` |
| **New** | `frontend/src/components/world3d/RoomFilesTab.tsx` |
| **New** | `frontend/src/components/world3d/roomInfoUtils.ts` |
| **Refactor** | `frontend/src/components/world3d/RoomInfoPanel.tsx` (shell only) |

---

## Phase 6: Polish & Edge Cases (0.5 day)

### Default Layout Update
When entering via Zen Beeldje, the default tab layout should include the Projects panel:
```ts
// In createDefaultTab(), when projectFilter is set:
function createDefaultLayout(hasProject: boolean): LayoutNode {
  if (hasProject) {
    return createSplit('row',
      createSplit('col', createLeaf('chat'), createLeaf('projects'), 0.6),
      createLeaf('tasks'),
      0.6
    )
  }
  return createSplit('row', createLeaf('chat'), createLeaf('tasks'), 0.6)
}
```

### Edge Cases
1. **Project deleted while tab is open** → Show "Project not found" state, offer to clear filter
2. **Filter sync across panels** → All panels on same tab share filter via `activeProjectId`
3. **Tab label** → Auto-update when project filter changes
4. **URL deep-link** → Not needed for v0.13, consider for future

### Testing Checklist
- [ ] Enter Zen via Zen Beeldje → Tasks/Kanban/Projects pre-filtered to project
- [ ] Change project filter in Tasks dropdown → Kanban + Projects update
- [ ] Change project filter in Projects panel → Tasks + Kanban update
- [ ] Select "All Projects" → filter cleared, all data shown
- [ ] Close and reopen Zen → filter persisted in localStorage
- [ ] Create new tab → starts with no filter (shows all)
- [ ] Multiple tabs with different project filters work independently
- [ ] Panel type "documents" in old localStorage → auto-migrates to "projects"
- [ ] Projects panel with no project → shows project list
- [ ] Projects panel with project → shows overview + documents tabs
- [ ] Kanban drag-and-drop still works with project filter active
- [ ] Theme variables applied correctly to new components
- [ ] ZenEmptyPanel shows "Projects" option (not "Documents")
- **RoomInfoPanel tabs:**
- [ ] Room Info tab shows stats + agent list (default tab)
- [ ] Project tab shows project info + tasks summary + actions
- [ ] Files tab shows file tree + markdown viewer
- [ ] Files tab hidden when no project docs available
- [ ] HQ room shows HQ Dashboard instead of Project tab
- [ ] Tab state resets on panel close/reopen
- [ ] No vertical scrolling needed within Room Info tab (for typical room)
- [ ] Project assign/change/clear still works from Project tab

---

## File Change Summary

### New Files (8)
- `frontend/src/hooks/useProjects.ts` *(if not already existing)*
- `frontend/src/components/zen/ProjectFilterSelect.tsx`
- `frontend/src/components/zen/ProjectFilterSelect.css`
- `frontend/src/components/zen/ProjectOverview.tsx`
- `frontend/src/components/world3d/RoomInfoTab.tsx`
- `frontend/src/components/world3d/RoomProjectTab.tsx`
- `frontend/src/components/world3d/RoomFilesTab.tsx`
- `frontend/src/components/world3d/roomInfoUtils.ts`

### Modified Files (9)
- `frontend/src/components/zen/ZenDocumentsPanel.tsx` → rename to `ProjectsPanel.tsx`
- `frontend/src/components/zen/ZenMode.tsx` — imports, switch case, filter handler
- `frontend/src/components/zen/ZenTasksPanel.tsx` — add ProjectFilterSelect
- `frontend/src/components/zen/ZenKanbanPanel.tsx` — add ProjectFilterSelect
- `frontend/src/components/zen/ZenEmptyPanel.tsx` — label update
- `frontend/src/components/zen/types/layout.ts` — PanelType update
- `frontend/src/components/zen/hooks/useZenMode.tsx` — migration + setProjectFilter
- `frontend/src/components/zen/ZenMode.css` — styles for new components
- `frontend/src/components/world3d/RoomInfoPanel.tsx` — refactor to shell with tab bar

### No Backend Changes
All necessary API endpoints already exist:
- `GET /api/projects` — project list
- `GET /api/projects/overview` — project stats
- `GET /api/tasks?project_id=X` — filtered tasks
- `GET /api/projects/{id}/documents` — project documents

### No Database Changes
- `projects` table already has `docs_path`
- `rooms` table already has `project_id`
- `tasks` table already has `project_id`
- No migration needed
