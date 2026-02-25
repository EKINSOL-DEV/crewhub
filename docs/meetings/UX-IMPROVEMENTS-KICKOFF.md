# AI Meetings UX Improvements - Kickoff

> **Date:** 2026-02-13
> **Goal:** Improve meeting UX based on user feedback
> **Strategy:** Opus implementation + GPT-5.2 review

---

## 🎯 User Feedback (Nicky - Voice Notes)

**Current Issues:**
1. "Stand-Up Meeting" is too specific - should be generic "Meeting"
2. Multiple "Round Topics" is confusing - need single topic field
3. No way to attach a document as meeting context
4. Meeting table only in HQ - should be in every project room
5. Participants default selected - risky (accidental meetings with everyone)

---

## 📋 Required Changes

### Change 1: Rename "Stand-Up Meeting" → "Meeting"
**Scope:** Dialog title, API responses, docs

**Files to update:**
- `MeetingDialog.tsx` - Dialog title
- `MeetingTable.tsx` - Tooltip text
- Blog post if not published yet
- API responses (cosmetic only)

**Effort:** 15 minutes

---

### Change 2: Round Topics → Single Topic Field
**Current:**
```
Round Topics (editable)
1. [What have you been working on?]
2. [What will you focus on next?]
3. [Any blockers or concerns?]
```

**New:**
```
Meeting Topic
[What should we discuss?]

Optional: Attach Document
[Dropdown: Select markdown file from project...] ⬇️
+ Text input for additional context before document
```

**Backend Impact:**
- `MeetingConfig` still has `round_topics` array
- Frontend just sends 1 topic repeated for all rounds? Or...
- Backend uses topic + document as context for all rounds?

**Decision Needed:**
- **Option A:** Keep round_topics array, just fill with same topic 3x
- **Option B:** Change backend to `topic: string` + `document_path?: string`
- **Option C:** Keep array, but generate round questions from main topic

**Recommendation:** Option A (least backend changes, works with existing orchestrator)

**Files to update:**
- `MeetingDialog.tsx` - Replace round topics UI with single topic field
- Add document selector dropdown
- Add "Additional context" text area (optional)

**Effort:** 1-2 hours

---

### Change 3: Document Context Selector
**Requirements:**
- Dropdown showing markdown files from:
  - Current room's project folder (if room has project)
  - `/01-Projects/{project}/` in Synology Drive
- Show file tree or flat list?
- On select: document content becomes part of meeting context

**Implementation:**
1. **Backend API** - New endpoint:
   ```
   GET /api/projects/{project_id}/markdown-files
   → Returns list of .md files with paths
   ```

2. **Frontend UI:**
   ```
   Optional: Attach Document
   [Select markdown file...] ⬇️

   If selected:
   "We'll discuss: analysis/market-research.md"

   Additional context (before document):
   [Text area: Add intro/questions before document content...]
   ```

3. **Meeting Context:**
   - Orchestrator reads document from Synology Drive
   - Prepends to each round's context:
     ```
     Meeting topic: [user topic]
     Document: [filename]

     [additional context if provided]

     --- Document Content ---
     [full markdown content]
     ---

     [cumulative context from previous speakers]
     ```

**Token Budget Impact:**
- Document could be large (5k+ tokens)
- Need to truncate or summarize if too big
- Or warn user if document >2k tokens

**Files to update:**
- `backend/app/routes/projects.py` - Add markdown files endpoint
- `MeetingDialog.tsx` - Add document selector
- `meeting_orchestrator.py` - Include document in context envelope

**Effort:** 2-3 hours

---

### Change 4: Meeting Tables in All Project Rooms
**Current:** Meeting Table only in HQ

**New:** Every room with a project gets a meeting table

**Implementation:**
1. **PropRegistry logic:**
   ```typescript
   // In room blueprint or dynamic prop injection
   if (room.project_id) {
     room.props.push({
       type: 'meeting-table',
       position: 'center', // or specific grid position
       metadata: {
         room_id: room.id,
         project_id: room.project_id
       }
     });
   }
   ```

2. **MeetingDialog auto-populate:**
   - Detect which table was clicked
   - Auto-select project from table metadata
   - Auto-filter document list to that project
   - Auto-select participants from room assignments

3. **Visual differentiation:**
   - HQ table: generic meetings
   - Project room tables: project-specific meetings
   - Icon/label difference?

**Files to update:**
- Room blueprints or dynamic prop injection logic
- `MeetingTable.tsx` - Accept room_id/project_id props
- `MeetingDialog.tsx` - Auto-populate from table context

**Effort:** 1-2 hours

---

### Change 5: Participants Default Deselected
**Current:** All available participants pre-selected

**New:** Empty selection by default

**Rationale:** Prevent accidental meetings with everyone

**Implementation:**
```typescript
// MeetingDialog.tsx
const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
// NOT: useState(availableAgents.map(a => a.id))

// Validation:
if (selectedParticipants.length < 2) {
  return "Please select at least 2 participants";
}
```

**Files to update:**
- `MeetingDialog.tsx` - Change default state

**Effort:** 5 minutes

---

## 🏗️ Implementation Plan

### Phase 1: Quick Wins (30 min)
**Developer:** Opus
1. Change 1 - Rename to "Meeting"
2. Change 5 - Participants default deselected
3. Test: Dialog opens, participants empty, can select 2+

### Phase 2: Topic + Document Selector (3h)
**Developer:** Opus
1. Change 2 - Single topic field UI
2. Change 3 - Document selector dropdown
3. Backend: `/api/projects/{id}/markdown-files` endpoint
4. Backend: Include document in orchestrator context
5. Test: Select document, start meeting, verify document in context

**Review:** GPT-5.2
- API design
- Context injection logic
- Token budget concerns
- UX flow

**Fixes:** Opus (if needed)

### Phase 3: Multi-Room Tables (1-2h)
**Developer:** Opus
1. Change 4 - Add tables to all project rooms
2. Auto-populate dialog from table context
3. Test: Click table in different rooms, verify correct project/docs

**Review:** GPT-5.2
- Prop injection logic
- Auto-populate behavior
- Edge cases (room without project, etc.)

**Fixes:** Opus (if needed)

### Phase 4: Integration Testing
**Manual QA:**
1. HQ table still works
2. Project room tables work
3. Document selector works
4. Meeting with document context produces good output
5. Participants must be manually selected
6. No regressions

---

## 📊 Effort Estimate

| Phase | Time | Total |
|-------|------|-------|
| Phase 1 | 30m | 30m |
| Phase 2 | 3h | 3h30m |
| Phase 3 | 1-2h | 4h30m - 5h30m |
| Reviews | 30m | 5h - 6h |
| Fixes | 1h | 6h - 7h |

**Total:** ~6-7 hours

---

## 🎨 Mockup: New Dialog

```
┌─────────────────────────────────────────────────────┐
│  📋 Start Meeting                              ✕   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Project: CrewHub (auto-detected from room)         │
│                                                     │
│  Meeting Topic                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ Discuss markdown viewer Phase 4 features    │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Optional: Attach Document                          │
│  ┌─────────────────────────────────────────────┐    │
│  │ Select markdown file...                    ▼│    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Additional context (before document):              │
│  ┌─────────────────────────────────────────────┐    │
│  │ Focus on implementation timeline and        │    │
│  │ technical feasibility                       │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Participants (select at least 2)                   │
│  ┌─────────────────────────────────────────────┐    │
│  │ ☐ 🟣 DevBot        (Developer)             │    │
│  │ ☐ 🔵 DesignBot     (Designer)              │    │
│  │ ☐ 🟢 PlannerBot    (Project Manager)       │    │
│  │ ☐ 🟡 QABot         (Quality Assurance)     │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Rounds: 3  (each bot speaks 3 times)               │
│                                                     │
│              ┌──────────┐  ┌──────────────────┐     │
│              │  Cancel   │  │  Start Meeting ▶ │     │
│              └──────────┘  └──────────────────┘     │
└─────────────────────────────────────────────────────┘
```

---

## 🔑 Key Technical Decisions

1. **Round topics backend:**
   - Keep existing `round_topics` array
   - Frontend generates 3 generic prompts from main topic
   - Example: Topic "Discuss Phase 4" → rounds: ["Discuss Phase 4 - Round 1", "Round 2", "Round 3"]
   - Orchestrator unchanged

2. **Document context injection:**
   - Read full document content
   - Check token count (warn if >2000 tokens)
   - Prepend to EACH round's context envelope
   - Not just first round - all speakers see document

3. **Table placement:**
   - Dynamic prop injection based on room.project_id
   - Same grid position in all rooms (center or specific coord)
   - Table metadata carries project context

4. **Participants selection:**
   - Empty by default
   - "Select All" helper button still available
   - Validation: min 2 required

---

## ✅ Success Criteria

**Phase 1:**
- Dialog says "Start Meeting" not "Start Stand-Up Meeting"
- Participants list empty on open
- Must manually select at least 2

**Phase 2:**
- Single topic field instead of round topics list
- Document selector dropdown works
- Can type additional context
- Meeting includes document content in context
- Bots reference document in responses

**Phase 3:**
- Tables visible in all project rooms
- Clicking table auto-selects correct project
- Document list filtered to room's project
- HQ table still works (no project = generic meeting)

**Final:**
- No regressions in existing meeting flow
- Token budget still respected
- All visual polish intact
- No console errors

---

## 🚀 Ready to Start!

All requirements documented. Multi-agent workflow ready.

**Next:** Spawn Opus for Phase 1 (quick wins) → Phase 2 → Review → Phase 3 → Review → QA
