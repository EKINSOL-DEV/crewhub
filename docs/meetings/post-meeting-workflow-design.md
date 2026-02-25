# Post-Meeting Workflow — Design Document

> CrewHub HQ · v0.15.0 · 2026-02-13

---

## 1. Overview

Six features that transform meeting output from a static markdown file into an actionable, navigable workflow. These build on the existing AI Meeting system (v0.14.0) which uses `MeetingOrchestrator` → SSE → `MeetingOutput` component.

### Feature Summary

| # | Feature | Complexity | Phase |
|---|---------|-----------|-------|
| F1 | Action Items → Tasks | Medium | 2 |
| F2 | Open Results in Sidebar | Low | 1 |
| F3 | Better Results UI | Medium | 1 |
| F4 | Follow-up Meeting | Medium | 2 |
| F5 | Meeting History Browser | Medium | 3 |
| F6 | Meeting Filename with Context | Low (bug fix) | 1 |

### Dependencies

```
F6 (filename) ← standalone, do first
F3 (better UI) ← F2 (sidebar) uses same component
F1 (action items) ← F3 (needs interactive cards UI)
F4 (follow-up) ← F5 (history) can link to it
```

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│                                                              │
│  ┌─────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │MeetingDialog │  │ MeetingResultsUI │  │MeetingHistory  │  │
│  │ (config)     │  │ (F2/F3 sidebar)  │  │Browser (F5)    │  │
│  └──────┬───────┘  └───────┬──────────┘  └───────┬────────┘  │
│         │                  │                     │           │
│         │          ┌───────┴──────────┐          │           │
│         │          │ ActionItemCard   │          │           │
│         │          │ FollowUpButton   │          │           │
│         │          │ SidebarPanel     │          │           │
│         │          └───────┬──────────┘          │           │
│         │                  │                     │           │
└─────────┼──────────────────┼─────────────────────┼───────────┘
          │                  │                     │
┌─────────┼──────────────────┼─────────────────────┼───────────┐
│         ▼      Backend     ▼                     ▼           │
│  POST /meetings/start                                        │
│  GET  /meetings/:id/results          (existing)              │
│  GET  /meetings/history              (F5 - new)              │
│  POST /meetings/:id/action-items     (F1 - new)              │
│  POST /meetings/:id/follow-up       (F4 - new)              │
│  GET  /meetings/by-room/:roomId     (F5 - new)              │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Feature Designs

### F6: Meeting Filename with Context (Bug Fix)

**Problem:** Files saved as `2026-02-13-meeting.md` with no topic info.

**Solution:** Slugify the meeting title/goal into the filename.

**Backend change** in `MeetingOrchestrator._save_output()`:

```python
import re

def _slugify(text: str, max_len: int = 40) -> str:
    """Convert text to URL-safe slug."""
    text = text.lower().strip()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s-]+', '-', text)
    return text[:max_len].rstrip('-')

async def _save_output(self, output_md: str) -> Optional[str]:
    # ... existing path logic ...
    today = datetime.now().strftime("%Y-%m-%d")

    # Use title or goal for context
    topic_slug = _slugify(self.title or self.goal or "meeting")
    if topic_slug == "team-meeting":  # default title, not useful
        topic_slug = _slugify(self.goal) if self.goal else "meeting"

    base_name = f"{today}-{topic_slug}"
    filename = f"{base_name}.md"
    counter = 2
    while (meetings_dir / filename).exists():
        filename = f"{base_name}-{counter}.md"
        counter += 1
    # ... rest unchanged
```

**Complexity:** ~30 min. No frontend changes. No DB changes.

---

### F2: Open Results in Sidebar

**Problem:** Meeting results only show in the full MeetingDialog overlay. Users want a side panel.

**Solution:** Create a `MeetingResultsPanel` that renders in the existing CrewHub sidebar system.

**Frontend components:**

```
src/components/meetings/
  MeetingResultsPanel.tsx    ← NEW: sidebar wrapper
  MeetingOutput.tsx          ← EXISTING: refactor to accept `mode: 'dialog' | 'sidebar'`
```

**UX Flow:**
```
Meeting completes
  → SSE "meeting-complete" arrives
  → Toast notification: "Meeting complete ✅" with [Open in Sidebar] button
  → OR: Button in MeetingOutput footer: "📌 Open in Sidebar"
  → Clicking opens right sidebar panel with MeetingResultsPanel
  → Panel persists until closed (survives navigation within HQ)
```

**Implementation:**

1. Add `sidebarContent` state to a layout context or use existing panel system
2. `MeetingResultsPanel` wraps `MeetingOutput` with sidebar-appropriate sizing
3. Meeting data loaded from `GET /meetings/:id` (already exists via `list_meetings`)

**New state in MeetingContext:**
```typescript
// Add to useMeeting hook
sidebarMeetingId: string | null
openInSidebar: (meetingId: string) => void
closeSidebar: () => void
```

**Complexity:** ~3-4 hours. No backend changes needed.

---

### F3: Better Results UI

**Problem:** Current `MeetingOutput` does naive line-by-line markdown rendering. Action items are plain checkboxes.

**Solution:** Parse structured sections from meeting output and render rich components.

**Architecture:**

```
MeetingOutput (refactored)
  ├── MeetingHeader        — title, date, duration, participants
  ├── MeetingSummaryCard   — key points in a styled card
  ├── ActionItemsList      — interactive action item cards
  │   └── ActionItemCard   — individual item with actions
  ├── RoundAccordion       — collapsible round-by-round view
  └── MeetingFooter        — copy, share, follow-up buttons
```

**Parsing meeting output:**

The synthesis prompt already produces structured markdown. Parse it:

```typescript
interface ParsedMeetingOutput {
  title: string
  summary: string[]          // bullet points
  actionItems: ActionItem[]
  keyDecisions: string[]
  sections: { heading: string; content: string }[]
  rawMd: string
}

interface ActionItem {
  id: string                 // generated client-side
  text: string
  assignee?: string          // parsed from "- [ ] @AgentName: ..."
  priority?: 'high' | 'medium' | 'low'
  status: 'pending' | 'added_to_planner' | 'executing'
}

function parseMeetingOutput(md: string): ParsedMeetingOutput {
  // Split by ## headers
  // Find "Action Items" or "Next Steps" section
  // Parse "- [ ]" lines as action items
  // Extract @mentions as assignees
}
```

**ActionItemCard component:**

```
┌─────────────────────────────────────────────┐
│ ☐  Implement SEO meta tags for Garret BE    │
│    👤 Agent: dev-bot  ·  🔴 High priority   │
│                                             │
│  [➕ Add to Planner]  [🤖 Execute Now]      │
└─────────────────────────────────────────────┘
```

**Styling:** Use shadcn Card, Accordion, Badge components. Dark-mode compatible.

**Complexity:** ~6-8 hours frontend work. No backend changes.

---

### F1: Action Items → Tasks

**Problem:** Action items in meeting output are just text. Users want to push them to Planner or let an agent execute them.

**Solution:** Two flows: (a) create task in Ekinbot Planner, (b) spawn agent execution.

**New API Endpoints:**

```
POST /api/meetings/:id/action-items
  Body: { items: ActionItem[] }
  Response: { created: number }
  → Saves action items to DB for tracking

POST /api/meetings/:id/action-items/:itemId/to-planner
  Body: { title: string, assignee?: string, priority?: string }
  → Creates task in Ekinbot Planner via HTTP API
  Response: { task_id: string, planner_url: string }

POST /api/meetings/:id/action-items/:itemId/execute
  Body: { agent_id: string }
  → Spawns agent session to execute the action item
  Response: { session_id: string }
```

**Data Model — New table:**

```sql
CREATE TABLE IF NOT EXISTS meeting_action_items (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    text TEXT NOT NULL,
    assignee_agent_id TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',  -- pending, planned, executing, done, failed
    planner_task_id TEXT,           -- if pushed to planner
    execution_session_id TEXT,      -- if agent is executing
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id)
);
```

**Planner Integration:**

```python
async def create_planner_task(title: str, assignee: str, source_meeting_id: str):
    """Create task in Ekinbot Planner via its API."""
    async with aiohttp.ClientSession() as session:
        resp = await session.post("http://localhost:8080/api/tasks", json={
            "title": title,
            "assignee": assignee,
            "source": f"meeting:{source_meeting_id}",
            "priority": "medium",
        })
        return await resp.json()
```

**Agent Execution Flow:**
```
User clicks "Execute Now" on action item
  → POST /meetings/:id/action-items/:itemId/execute
  → Backend spawns agent session via Gateway:
      sessions_spawn(agent_session_key, prompt=action_item_text)
  → Status updates via SSE: "action-item-status"
  → Card updates in real-time: pending → executing → done/failed
```

**Frontend additions to ActionItemCard:**
```typescript
// In ActionItemCard
const handleAddToPlanner = async () => {
  const res = await fetch(`/api/meetings/${meetingId}/action-items/${item.id}/to-planner`, {
    method: 'POST',
    body: JSON.stringify({ title: item.text, assignee: item.assignee }),
  })
  // Update card status to "planned"
}

const handleExecute = async () => {
  const res = await fetch(`/api/meetings/${meetingId}/action-items/${item.id}/execute`, {
    method: 'POST',
    body: JSON.stringify({ agent_id: item.assignee }),
  })
  // Subscribe to SSE for status updates
}
```

**Complexity:** ~8-10 hours (backend + frontend + Planner integration).

---

### F4: Follow-up Meeting

**Problem:** After reviewing results, users want to continue the conversation with same context.

**Solution:** "Start Follow-up" button that pre-fills MeetingDialog with previous meeting context.

**UX Flow:**
```
User views meeting results (dialog or sidebar)
  → Clicks "🔄 Start Follow-up Meeting"
  → MeetingDialog opens, pre-filled:
      - Same participants (editable)
      - Same room/project
      - Goal = "Follow-up: {original title}"
      - document_context = previous meeting output_md (injected as context)
  → User adjusts and starts
  → New meeting runs with full previous context
  → Result saved as: 2026-02-13-seo-followup.md
```

**Backend changes:**

Add `parent_meeting_id` to meetings table:

```sql
ALTER TABLE meetings ADD COLUMN parent_meeting_id TEXT;
```

Add to `StartMeetingRequest`:
```python
class StartMeetingRequest(BaseModel):
    # ... existing fields ...
    parent_meeting_id: Optional[str] = None  # NEW
```

In `MeetingOrchestrator.__init__`, if `parent_meeting_id` is set, load the parent meeting's output and prepend to document_context:

```python
if parent_meeting_id:
    parent = await get_meeting(parent_meeting_id)
    if parent and parent.get("output_md"):
        context_prefix = f"## Previous Meeting Results\n\n{parent['output_md']}\n\n---\n\n"
        self._document_content = context_prefix + (self._document_content or "")
```

**Frontend:**

Add to `MeetingOutput` footer:
```tsx
<Button onClick={() => onStartFollowUp(meeting)}>
  🔄 Follow-up Meeting
</Button>
```

`onStartFollowUp` opens `MeetingDialog` with pre-filled state. The dialog already supports all needed fields.

**Reuse same window:** If meeting was in sidebar, close results panel → open MeetingDialog. If in dialog, swap content. Use `MeetingContext` phase transitions:
```
complete → (follow-up clicked) → idle → gathering → round → ...
```

**Complexity:** ~4-5 hours. Small backend change + frontend wiring.

---

### F5: Meeting History Browser

**Problem:** No way to see past meetings. Each meeting is fire-and-forget.

**Solution:** Meeting history panel accessible from the Meeting Table interaction.

**UX Flow:**
```
User clicks Meeting Table in 3D HQ
  → MeetingDialog opens (existing)
  → NEW: Tab bar at top: [New Meeting] [History]
  → History tab shows list of past meetings:

  ┌──────────────────────────────────────────────┐
  │ 📋 Meeting History                    🔍     │
  ├──────────────────────────────────────────────┤
  │                                              │
  │ ┌──────────────────────────────────────────┐ │
  │ │ 📝 SEO Strategy - Garret BE             │ │
  │ │ Feb 13, 2026 · 3 rounds · 45s           │ │
  │ │ 🤖 dev-bot, seo-bot, content-bot        │ │
  │ │                                          │ │
  │ │ [View Results] [Follow-up] [Reuse Setup] │ │
  │ └──────────────────────────────────────────┘ │
  │                                              │
  │ ┌──────────────────────────────────────────┐ │
  │ │ 📝 Sprint Planning                      │ │
  │ │ Feb 12, 2026 · 3 rounds · 52s           │ │
  │ │ 🤖 dev-bot, pm-bot                      │ │
  │ │                                          │ │
  │ │ [View Results] [Follow-up] [Reuse Setup] │ │
  │ └──────────────────────────────────────────┘ │
  │                                              │
  │         Showing 2 of 12 meetings             │
  │            [Load More]                       │
  └──────────────────────────────────────────────┘
```

**New API Endpoints:**

```
GET /api/meetings/history?room_id=X&project_id=Y&limit=20&offset=0
  → Returns paginated meeting list with summary info
  Response: {
    meetings: [{
      id, title, goal, state, room_id, project_id,
      participant_names: string[],
      num_rounds, duration_seconds,
      output_path, created_at, completed_at
    }],
    total: number,
    has_more: boolean
  }
```

The `list_meetings` function already exists in the backend but may need filtering enhancements.

**Frontend components:**

```
src/components/meetings/
  MeetingHistoryBrowser.tsx   ← NEW: history list
  MeetingHistoryCard.tsx      ← NEW: individual meeting card
  MeetingDialog.tsx           ← MODIFIED: add tab navigation
```

**Room-scoped history:** Filter by `room_id` so each meeting table shows its own history.

**Actions per history item:**
- **View Results** → Opens `MeetingResultsPanel` (F2/F3)
- **Follow-up** → Starts follow-up meeting (F4)
- **Reuse Setup** → Pre-fills MeetingDialog with same participants/rounds/topics

**Complexity:** ~6-8 hours. Backend query enhancement + new frontend components.

---

## 4. Data Model Summary

### New Table

```sql
CREATE TABLE IF NOT EXISTS meeting_action_items (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    text TEXT NOT NULL,
    assignee_agent_id TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    planner_task_id TEXT,
    execution_session_id TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id)
);
```

### Altered Tables

```sql
-- meetings table
ALTER TABLE meetings ADD COLUMN parent_meeting_id TEXT;

-- Index for history queries
CREATE INDEX IF NOT EXISTS idx_meetings_room ON meetings(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project_id, created_at DESC);
```

---

## 5. API Endpoints Summary

| Method | Path | Feature | Description |
|--------|------|---------|-------------|
| GET | `/meetings/history` | F5 | Paginated meeting history |
| GET | `/meetings/by-room/:roomId` | F5 | Room-scoped history |
| POST | `/meetings/:id/action-items` | F1 | Save parsed action items |
| POST | `/meetings/:id/action-items/:itemId/to-planner` | F1 | Push to Ekinbot Planner |
| POST | `/meetings/:id/action-items/:itemId/execute` | F1 | Spawn agent execution |
| GET | `/meetings/:id/action-items` | F1 | Get action items + status |

---

## 6. Frontend Component Tree

```
MeetingTable (3D prop, existing)
  └── MeetingDialog (existing, modified)
      ├── Tab: "New Meeting" (existing config UI)
      │   └── DocumentSelectorModal (existing)
      └── Tab: "History" (F5 - NEW)
          └── MeetingHistoryBrowser
              └── MeetingHistoryCard (per meeting)

MeetingProgressView (existing, during meeting)

MeetingOutput (existing, refactored for F3)
  ├── MeetingHeader
  ├── MeetingSummaryCard
  ├── ActionItemsList
  │   └── ActionItemCard (F1/F3)
  │       ├── [Add to Planner] button
  │       └── [Execute Now] button
  ├── RoundAccordion
  └── MeetingFooter
      ├── [Copy] [Close] (existing)
      ├── [Open in Sidebar] (F2)
      └── [Follow-up Meeting] (F4)

MeetingResultsPanel (F2 - NEW, sidebar wrapper)
  └── MeetingOutput (shared component)
```

---

## 7. SSE Events (New)

| Event | Payload | Feature |
|-------|---------|---------|
| `action-item-status` | `{ meetingId, itemId, status, taskId? }` | F1 |
| `meeting-sidebar-open` | `{ meetingId }` | F2 (optional, for multi-tab sync) |

---

## 8. Phased Rollout Plan

### Phase 1 — Quick Wins (~1 day)
- **F6: Filename with Context** — Bug fix, standalone, 30 min
- **F2: Sidebar Panel** — Low complexity, 3-4 hours
- **F3: Better Results UI** — Visual upgrade, 6-8 hours

These have no backend DB changes and can ship together.

### Phase 2 — Core Workflow (~1.5 days)
- **F1: Action Items → Tasks** — Needs F3's ActionItemCard, 8-10 hours
- **F4: Follow-up Meeting** — Small backend + frontend, 4-5 hours

Requires DB migration (new table + alter). Ship together.

### Phase 3 — Discovery (~1 day)
- **F5: Meeting History Browser** — Backend query + new UI, 6-8 hours

Can be done independently after Phase 1-2.

### Total Estimate: ~3.5 days of focused development

---

## 9. Synthesis Prompt Enhancement

To make action item parsing reliable, update the synthesis prompt in `MeetingOrchestrator._synthesize()` to enforce structured output:

```python
SYNTHESIS_SUFFIX = """
## Output Format

Structure your summary with these exact headers:
## Summary
## Key Decisions
## Action Items
## Next Steps

For Action Items, use this exact format:
- [ ] @{agent_name}: {action item description} [priority: high/medium/low]

This format enables automated parsing and task creation.
"""
```

This ensures the meeting output is machine-parseable while remaining human-readable.

---

## 10. Risk & Considerations

1. **Planner API dependency** — Planner must be running for F1 task creation. Handle gracefully with error state on card.
2. **Agent execution** — F1 "Execute Now" spawns real agent work. Add confirmation dialog + ability to cancel.
3. **Output parsing** — F3 depends on consistent synthesis output format. The prompt enhancement (§9) mitigates this.
4. **Sidebar state persistence** — F2 sidebar should survive HQ room navigation. Store `sidebarMeetingId` in a top-level context, not room-scoped.
5. **Large history** — F5 with many meetings needs pagination. The API design includes offset/limit.
