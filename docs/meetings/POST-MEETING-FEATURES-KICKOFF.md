# AI Meetings - Post-Meeting Workflow Features

> **Date:** 2026-02-13
> **Goal:** Implement complete post-meeting workflow
> **Strategy:** Opus implementation + GPT-5.2 review

---

## 🎯 Overview

Transform meeting results from static markdown into an actionable workflow system with task creation, follow-ups, and meeting history.

**User Vision:**
"Na de meeting wil ik de action items direct kunnen oppakken - als tasks toevoegen, of laten uitvoeren door agents. Ik wil makkelijk een follow-up meeting starten met alle context. En ik wil de meeting history kunnen browsen."

---

## 📋 Features to Implement

### Feature #1: Action Items → Tasks Conversion
**Priority:** High
**Effort:** Medium (2-3h)

**User Story:**
As a user, when a meeting ends with action items, I want to see those as interactive cards with options to create tasks or execute directly.

**Current State:**
- Meeting ends with markdown output
- Action items listed as `- [ ] Task description`
- User must manually copy to Planner or ask agent

**Desired State:**
- Meeting results show action items as interactive cards
- Each card has buttons:
  - "Add to Planner" - Creates task in Ekinbot Planner
  - "Execute Now" - Spawns agent to do the task immediately
  - "Dismiss" - Mark as handled

**UI Mockup:**
```
┌─────────────────────────────────────────┐
│  Meeting Results                    ✕  │
├─────────────────────────────────────────┤
│  # Meeting — 2026-02-13                 │
│  Goal: SEO voor garret.be               │
│                                         │
│  ## Action Items                        │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 📋 Dev: Run Lighthouse audit      │  │
│  │                                   │  │
│  │ [Add to Planner] [Execute Now] [✓]│  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 📋 Flowy: Keyword gap analysis    │  │
│  │                                   │  │
│  │ [Add to Planner] [Execute Now] [✓]│  │
│  └───────────────────────────────────┘  │
│                                         │
│  [Start Follow-up Meeting]              │
└─────────────────────────────────────────┘
```

**Implementation:**

**Backend:**
- Parse action items from meeting output markdown
- Extract: assignee, task description
- API: `POST /api/meetings/{id}/action-items/{index}/execute`
- API: `POST /api/meetings/{id}/action-items/{index}/to-task`

**Frontend:**
- Parse markdown `- [ ] **Assignee**: Task` format
- Render as interactive cards
- "Add to Planner": POST to Planner API
- "Execute Now": Spawn subagent with task description

**Action Item Parser:**
```typescript
function parseActionItems(markdown: string): ActionItem[] {
  const lines = markdown.split('\n');
  const items: ActionItem[] = [];

  for (const line of lines) {
    // Match: - [ ] **Name**: Description
    const match = line.match(/^- \[ \] \*\*(.+?)\*\*:? (.+)$/);
    if (match) {
      items.push({
        assignee: match[1],
        description: match[2],
        completed: false
      });
    }
  }
  return items;
}
```

---

### Feature #2: Open Results in Sidebar
**Priority:** Medium
**Effort:** Low (1h)

**User Story:**
As a user, I want to open meeting results in a sidebar panel so I can see them alongside the 3D view.

**Current State:**
- Results only show in fullscreen overlay
- Must close overlay to see 3D world

**Desired State:**
- Option to open results in right sidebar panel
- Can keep 3D world visible while reading results
- Toggle between fullscreen and sidebar

**Implementation:**
- Add "Open in Sidebar" button to fullscreen results
- Use existing panel system (like BotInfoPanel)
- Store meeting results in panel state
- Panel shows same content as fullscreen but in sidebar format

**UI:**
```
[3D World]  │  [Meeting Results Panel]
            │
Bots moving │  # Meeting — 2026-02-13
Table etc.  │
            │  ## Action Items
            │  [cards...]
```

---

### Feature #3: Enhanced Results UI with Action Cards
**Priority:** High
**Effort:** Medium (2h)

**User Story:**
As a user, I want a beautiful, scannable interface for meeting results with clear sections and interactive elements.

**Current State:**
- Plain markdown rendering
- All text, no interactivity
- Hard to scan quickly

**Desired State:**
- Sections in collapsible cards
- Color-coded action items by assignee
- Quick actions on hover
- Summary stats at top

**UI Design:**
```
┌─────────────────────────────────────────┐
│  Meeting: SEO voor garret.be            │
│  2026-02-13 • 4 participants • 3 rounds │
├─────────────────────────────────────────┤
│  📊 Summary                             │
│  ✓ 13 action items                      │
│  ✓ 3 decisions made                     │
│  ⚠ 3 blockers identified                 │
├─────────────────────────────────────────┤
│  📋 Action Items (13)          [Expand] │
│  ┌───────────────────────────────────┐  │
│  │ 🔵 Dev (5 tasks)                  │  │
│  │ • Run Lighthouse audit            │  │
│  │ • Implement structured data       │  │
│  │ ...                               │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ 🟣 Flowy (4 tasks)                │  │
│  │ ...                               │  │
│  └───────────────────────────────────┘  │
├─────────────────────────────────────────┤
│  ✅ Decisions                           │
│  • Prioritize technical SEO first      │
│  • Content calendar: 1-2 posts/month   │
│  ...                                    │
├─────────────────────────────────────────┤
│  ⛔ Blockers                             │
│  • Need backend access to garret.be    │
│  • Need GSC access                     │
│  ...                                    │
└─────────────────────────────────────────┘
```

**Components:**
- `MeetingResultsPanel.tsx` - Main container
- `ActionItemCard.tsx` - Individual action item
- `DecisionCard.tsx` - Decision display
- `BlockerCard.tsx` - Blocker display
- `MeetingSummaryStats.tsx` - Top stats bar

---

### Feature #4: Start Follow-up Meeting
**Priority:** High
**Effort:** Medium (2-3h)

**User Story:**
As a user, after reviewing meeting results, I want to start a follow-up meeting that automatically includes the previous meeting's context.

**Current State:**
- Must manually start new meeting
- No automatic context carryover
- Previous discussion not available to bots

**Desired State:**
- "Start Follow-up Meeting" button in results view
- Opens meeting dialog pre-filled with:
  - Same participants
  - Topic: "Follow-up: [original topic]"
  - Previous meeting summary as document context
- Bots can reference previous meeting in discussion

**Implementation:**

**Button in Results:**
```tsx
<button onClick={() => startFollowUp(meeting)}>
  🔄 Start Follow-up Meeting
</button>
```

**Pre-fill Logic:**
```typescript
function startFollowUp(previousMeeting: Meeting) {
  openMeetingDialog({
    topic: `Follow-up: ${previousMeeting.goal}`,
    participants: previousMeeting.participant_ids,
    documentContext: {
      type: 'previous-meeting',
      content: previousMeeting.output_md,
      filename: `${previousMeeting.id}-summary.md`
    }
  });
}
```

**Context Injection:**
- Previous meeting summary prepended to each round's context
- Bots see: "Previous meeting summary: [...]" before current discussion
- Can reference previous action items, decisions, blockers

---

### Feature #5: Meeting History Browser
**Priority:** Medium
**Effort:** Medium (2-3h)

**User Story:**
As a user, when I click a meeting table, I want to see a history of previous meetings in that room/project, so I can review or continue past discussions.

**Current State:**
- Can only start new meetings
- No access to meeting history
- Previous meetings "lost" after closing results

**Desired State:**
- Meeting dialog has "Recent Meetings" tab
- Shows list of past meetings for this project
- Can click to view results
- Can start follow-up from history

**UI:**
```
┌─────────────────────────────────────────┐
│  Start Meeting  │  Recent Meetings      │
├─────────────────────────────────────────┤
│  [Today]                                │
│  ┌───────────────────────────────────┐  │
│  │ 19:26 - SEO voor garret.be        │  │
│  │ 4 participants • 13 action items  │  │
│  │ [View] [Follow-up]                │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [Yesterday - Feb 12]                   │
│  ┌───────────────────────────────────┐  │
│  │ 14:30 - Phase 4 features          │  │
│  │ 3 participants • 8 action items   │  │
│  │ [View] [Follow-up]                │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [Show older...] (30 days)              │
└─────────────────────────────────────────┘
```

**Implementation:**

**Backend:**
- Extend `GET /api/meetings` with filters:
  - `?room_id={id}` - meetings in this room
  - `?project_id={id}` - meetings for this project
  - `?days=30` - last N days
- Return: list with summary stats (participant count, action items, etc.)

**Frontend:**
- `MeetingHistoryTab.tsx` in MeetingDialog
- Fetch meetings for current room/project
- Group by date (Today, Yesterday, This Week, etc.)
- "View" → opens results in panel
- "Follow-up" → starts new meeting with context

---

### Feature #6: Meeting Filename with Context
**Priority:** High (prevents confusion)
**Effort:** Low (30m)

**User Story:**
As a user, when I browse the meetings folder, I want filenames to include the meeting topic so I know what each file contains.

**Current State:**
- Filename: `2026-02-13-standup.md`
- Multiple meetings same day: `2026-02-13-standup-2.md`, `-3.md`
- No context in filename

**Desired State:**
- Filename includes topic slug: `2026-02-13-seo-garret-be.md`
- Easy to identify in file browser
- Still sortable by date

**Implementation:**

**Slugify Function:**
```python
import re

def slugify(text: str, max_length: int = 50) -> str:
    """Convert text to URL-friendly slug."""
    slug = text.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)  # Remove special chars
    slug = re.sub(r'[\s_-]+', '-', slug)  # Replace spaces with -
    slug = slug.strip('-')
    return slug[:max_length]
```

**Filename Generation:**
```python
def generate_meeting_filename(meeting: Meeting) -> str:
    date_str = datetime.now().strftime("%Y-%m-%d")
    topic_slug = slugify(meeting.goal)
    base_name = f"{date_str}-{topic_slug}"

    # Handle duplicates
    counter = 1
    filename = f"{base_name}.md"
    while (output_dir / filename).exists():
        filename = f"{base_name}-{counter}.md"
        counter += 1

    return filename
```

**Examples:**
- Topic: "SEO voor garret.be" → `2026-02-13-seo-voor-garret-be.md`
- Topic: "Discuss Phase 4 features" → `2026-02-13-discuss-phase-4-features.md`
- Duplicate: `2026-02-13-discuss-phase-4-features-2.md`

---

## 📊 Implementation Priority

**Phase 1: Core Workflow (4-5h)**
1. Feature #6: Contextual filenames (30m) - quick win
2. Feature #1: Action items → Tasks (2-3h) - core value
3. Feature #4: Follow-up meetings (2h) - workflow completion

**Phase 2: Enhanced UX (3-4h)**
4. Feature #3: Enhanced results UI (2h) - better readability
5. Feature #2: Sidebar results (1h) - viewing option
6. Feature #5: Meeting history (2-3h) - discovery & continuity

**Total Estimate:** 7-9 hours

---

## 🧪 Testing Checklist

### Feature #1: Action Items → Tasks
- [ ] Meeting ends with action items
- [ ] Items shown as interactive cards
- [ ] "Add to Planner" creates task in Planner API
- [ ] "Execute Now" spawns subagent
- [ ] Cards can be marked complete
- [ ] UI updates after action

### Feature #2: Sidebar Results
- [ ] "Open in Sidebar" button works
- [ ] Results render in right panel
- [ ] Can see 3D world + results simultaneously
- [ ] Toggle between fullscreen and sidebar

### Feature #3: Enhanced Results UI
- [ ] Stats summary shows at top
- [ ] Sections are collapsible
- [ ] Action items grouped by assignee
- [ ] Color-coded cards
- [ ] Quick actions on hover
- [ ] Scannable layout

### Feature #4: Follow-up Meeting
- [ ] "Start Follow-up" button in results
- [ ] Dialog opens with pre-filled data
- [ ] Previous meeting context included
- [ ] Bots reference previous meeting
- [ ] Can modify topic/participants before start

### Feature #5: Meeting History
- [ ] "Recent Meetings" tab in dialog
- [ ] Shows meetings for current room/project
- [ ] Grouped by date
- [ ] "View" opens results
- [ ] "Follow-up" starts new meeting with context
- [ ] Can filter/search history

### Feature #6: Contextual Filenames
- [ ] New meeting filename includes topic slug
- [ ] Duplicate handling works (appends -2, -3)
- [ ] Filename is filesystem-safe
- [ ] Easy to identify in file browser

---

## 📁 Files to Create/Modify

**Backend:**
- `backend/app/routes/meetings.py`
  - Add action item endpoints
  - Add meeting history filters
  - Update filename generation

- `backend/app/services/meeting_orchestrator.py`
  - Update save logic for new filename format

**Frontend:**
- `frontend/src/components/meetings/MeetingResultsPanel.tsx` (NEW)
  - Enhanced results UI
  - Action item cards
  - Follow-up button

- `frontend/src/components/meetings/ActionItemCard.tsx` (NEW)
  - Interactive action item
  - Add to Planner / Execute buttons

- `frontend/src/components/meetings/MeetingHistoryTab.tsx` (NEW)
  - History browser
  - Meeting list with stats

- `frontend/src/components/meetings/MeetingSummaryStats.tsx` (NEW)
  - Top stats bar

- `frontend/src/components/meetings/MeetingDialog.tsx`
  - Add Recent Meetings tab
  - Pre-fill logic for follow-ups

- `frontend/src/hooks/useMeetingHistory.ts` (NEW)
  - Fetch meeting history
  - Filter by room/project

---

## 🎨 Design Principles

**Progressive Disclosure:**
- Don't overwhelm with all features at once
- Default view: simple and scannable
- Advanced features available on demand

**Contextual Actions:**
- Right action at right time
- "Execute Now" only for actionable items
- "Follow-up" only when context is valuable

**Consistent Visual Language:**
- Color code by agent (same colors as in 3D)
- Icons for action types (📋 task, ✅ decision, ⛔ blocker)
- Status indicators (✓ done, ● active, ○ pending)

---

## ✅ Success Criteria

**Feature #1 Success:**
- Can convert action items to Planner tasks with 1 click
- Can spawn agent to execute task immediately
- Clear feedback on what happened

**Feature #2 Success:**
- Can view results in sidebar
- 3D world remains visible and interactive
- Easy toggle between views

**Feature #3 Success:**
- Results are scannable at a glance
- Clear visual hierarchy
- Interactive elements intuitive

**Feature #4 Success:**
- Follow-up meeting starts with full context
- Bots reference previous discussion naturally
- Workflow feels continuous

**Feature #5 Success:**
- Easy to find previous meetings
- Can review and continue past work
- Meeting history is discoverable

**Feature #6 Success:**
- Filenames descriptive and organized
- No more "meeting-2.md" confusion
- Easy to browse in file manager

---

**Ready to build a complete post-meeting workflow!** 🚀
