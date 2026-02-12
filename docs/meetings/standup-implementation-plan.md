# Stand-Up Meetings — Implementation Plan

> CrewHub HQ Feature · v1.0 · 2026-02-12

---

## Overview

Implementation is split into 4 phases, each delivering a usable increment. Phase 1 is the MVP — a working backend that can be tested via API. Each subsequent phase adds visual polish and advanced features.

**Total estimated effort: 4-6 days**

---

## Phase 1: Backend Round-Robin Engine (No Visuals)

> **Goal:** Working meeting orchestration, testable via REST API and SSE events.

### Tasks

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 1.1 | Create `MeetingState` enum and Pydantic models | `backend/app/db/meeting_models.py` | 1h |
| 1.2 | Database migration: `meetings`, `meeting_participants`, `meeting_turns` tables | `backend/app/db/database.py` | 1h |
| 1.3 | Create `MeetingOrchestrator` service with state machine | `backend/app/services/meeting_orchestrator.py` | 4h |
| 1.4 | Implement round-robin with cumulative context passing | `backend/app/services/meeting_orchestrator.py` | 2h |
| 1.5 | Implement synthesis step (summary generation) | `backend/app/services/meeting_orchestrator.py` | 1h |
| 1.6 | Create REST endpoints: start, status, cancel, list, output | `backend/app/routes/meetings.py` | 2h |
| 1.7 | Wire SSE events for all state transitions | `backend/app/routes/meetings.py` | 1h |
| 1.8 | Save output MD to Synology Drive path | `backend/app/services/meeting_orchestrator.py` | 0.5h |
| 1.9 | Register routes in `main.py` | `backend/app/main.py` | 0.25h |
| 1.10 | Error handling: timeouts, retries, gateway failures | `backend/app/services/meeting_orchestrator.py` | 1h |
| 1.11 | Test via curl/httpie: full meeting flow | — | 1h |

### Deliverable
- `POST /api/meetings/start` triggers a full round-robin meeting
- Each bot responds via gateway connection
- SSE events stream progress in real time
- Final MD saved to disk
- Testable without frontend changes

### Effort: **~1.5 days**

### Key Decisions
- Reuse existing `ConnectionManager` for bot communication
- Orchestrator runs as `asyncio.Task` (non-blocking)
- New tables, don't modify existing `standups` table (that's the old simple standup system)
- State persisted to DB after every transition for crash recovery

---

## Phase 2: 3D Gathering Animation

> **Goal:** Bots visually walk to the Meeting Table and stand in a circle.

### Tasks

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 2.1 | Create `MeetingTable.tsx` 3D prop (round table model) | `frontend/src/components/world3d/props/MeetingTable.tsx` | 2h |
| 2.2 | Add Meeting Table to HQ room props config | `frontend/src/data/` or room config | 0.5h |
| 2.3 | Click handler: detect meeting table click → open dialog | `MeetingTable.tsx` | 0.5h |
| 2.4 | Create `MeetingDialog.tsx` (config form) | `frontend/src/components/meetings/MeetingDialog.tsx` | 3h |
| 2.5 | Bot gathering animation: walk to table positions | `frontend/src/components/world3d/Bot3D.tsx` | 3h |
| 2.6 | Calculate circle positions around table | `frontend/src/components/world3d/utils/` | 1h |
| 2.7 | SSE listener: react to `meeting-started` → trigger gathering | `frontend/src/hooks/useMeetingEvents.ts` | 1h |
| 2.8 | Bot return animation: walk back to original position after meeting | `Bot3D.tsx` | 1h |
| 2.9 | "Meeting in progress" indicator on table | `MeetingTable.tsx` | 0.5h |

### Deliverable
- Clickable Meeting Table prop in HQ room
- MeetingDialog with participant picker, goal input, round config
- Bots walk to table when meeting starts
- Bots return to normal after meeting ends

### Effort: **~1.5 days**

### Key Decisions
- Gathering positions: evenly spaced on circle of radius ~2 units around table center
- Walking animation: use existing bot movement system (lerp to target position)
- Table model: procedural geometry (cylinder + top disc), not imported GLTF (keep it lightweight)
- MeetingDialog reuses existing UI components (Dialog from shadcn/ui, etc.)

---

## Phase 3: Live Speech Bubbles & Progress UI

> **Goal:** See who's speaking, read responses live, track progress.

### Tasks

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 3.1 | Active speaker highlight: glow ring around speaking bot | `Bot3D.tsx`, `BotStatusGlow.tsx` | 1.5h |
| 3.2 | Speech bubble component (3D text above bot) | `frontend/src/components/world3d/BotSpeechBubble.tsx` | 2h |
| 3.3 | Create `MeetingProgressView.tsx` (inline panel) | `frontend/src/components/meetings/MeetingProgressView.tsx` | 3h |
| 3.4 | Progress bar component with round/turn tracking | `frontend/src/components/meetings/MeetingProgressBar.tsx` | 1h |
| 3.5 | Live transcript: append bot responses as SSE events arrive | `MeetingProgressView.tsx` | 1.5h |
| 3.6 | Create `MeetingOutput.tsx` (final results view) | `frontend/src/components/meetings/MeetingOutput.tsx` | 2h |
| 3.7 | Copy to clipboard, open file actions | `MeetingOutput.tsx` | 0.5h |
| 3.8 | Full transcript toggle (summary ↔ raw turns) | `MeetingOutput.tsx` | 1h |
| 3.9 | `useMeeting` hook: SSE state management for meeting events | `frontend/src/hooks/useMeeting.ts` | 2h |
| 3.10 | Cancel button wired to `POST /meetings/{id}/cancel` | `MeetingProgressView.tsx` | 0.5h |
| 3.11 | Bot ✓ indicator after completing turn | `Bot3D.tsx` | 0.5h |

### Deliverable
- Active speaker visually highlighted in 3D with glow
- Speech bubbles show abbreviated response above bots
- Side panel shows live transcript with progress bar
- Final output rendered with actions (copy, open, toggle transcript)
- Cancel button works

### Effort: **~1.5 days**

### Key Decisions
- Speech bubbles use `Html` from `@react-three/drei` (HTML overlay in 3D space)
- Truncate bubble text to ~60 chars with "..." (full text in side panel)
- Progress view replaces the right-side panel content during meeting
- `useMeeting` hook manages all meeting state via SSE events (no polling)

---

## Phase 4: Recording, Replay & Templates

> **Goal:** Polish features for daily use — history browsing, templates, replay.

### Tasks

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 4.1 | Meeting history list page | `frontend/src/components/meetings/MeetingHistory.tsx` | 2h |
| 4.2 | Meeting detail/replay view (step through turns) | `frontend/src/components/meetings/MeetingReplay.tsx` | 3h |
| 4.3 | Meeting templates system (backend model + API) | `backend/app/routes/meetings.py`, `meeting_models.py` | 2h |
| 4.4 | Template presets: Daily Standup, Retrospective, Planning, Brainstorm | `backend/app/services/meeting_templates.py` | 1h |
| 4.5 | Template picker in MeetingDialog | `MeetingDialog.tsx` | 1h |
| 4.6 | Token usage tracking and display | `MeetingOutput.tsx`, `meeting_orchestrator.py` | 1h |
| 4.7 | Meeting comparison (diff between today and yesterday) | `frontend/src/components/meetings/MeetingCompare.tsx` | 2h |
| 4.8 | Auto-schedule: cron trigger for daily standup | `backend/app/routes/cron.py` integration | 1.5h |
| 4.9 | Integration with task system (action items → tasks) | `backend/app/routes/meetings.py` | 2h |
| 4.10 | Polish: animations, transitions, loading states | Various | 1.5h |

### Deliverable
- Browse past meetings with search/filter
- Replay meetings turn by turn (like a presentation)
- Meeting templates (quick-start for common formats)
- Action items can be converted to tasks
- Optional auto-scheduling via cron

### Effort: **~2 days**

### Key Decisions
- Templates stored as JSON presets, not DB records (simple, version-controlled)
- Replay uses the same MeetingProgressView but in "replay mode" (manual step-through)
- Action items → tasks: parse `- [ ]` items from synthesis, offer "Create Tasks" button
- Auto-schedule: leverage existing cron system in CrewHub

---

## Summary

| Phase | Focus | Effort | Cumulative |
|-------|-------|--------|------------|
| **Phase 1** | Backend engine | 1.5 days | 1.5 days |
| **Phase 2** | 3D gathering | 1.5 days | 3 days |
| **Phase 3** | Live UI | 1.5 days | 4.5 days |
| **Phase 4** | Polish & extras | 2 days | 6.5 days |

### Recommended Approach
- **Phase 1 + 2** together for first demo (~3 days)
- **Phase 3** for a polished daily-use feature (~1.5 days)
- **Phase 4** as needed, tasks can be cherry-picked individually

### Dependencies
- Phase 1: No frontend dependencies. Needs working gateway connections.
- Phase 2: Depends on Phase 1 API. Needs Three.js/R3F knowledge.
- Phase 3: Depends on Phase 1 SSE events + Phase 2 3D elements.
- Phase 4: Depends on Phase 1-3 being stable.

### Migration from Existing Standups
The current `standups` and `standup_entries` tables (manual entry system) remain untouched. The new meeting system uses separate `meetings`, `meeting_participants`, and `meeting_turns` tables. The old system can be deprecated once the new one is proven.

---

## File Structure (New Files)

```
backend/
  app/
    db/
      meeting_models.py          # Pydantic models for meetings
    routes/
      meetings.py                # REST API endpoints (replaces/extends standups.py)
    services/
      meeting_orchestrator.py    # State machine + round-robin engine
      meeting_templates.py       # Template presets (Phase 4)

frontend/
  src/
    components/
      meetings/
        MeetingDialog.tsx        # Config dialog
        MeetingProgressView.tsx  # Live progress panel
        MeetingProgressBar.tsx   # Progress bar component
        MeetingOutput.tsx        # Final results view
        MeetingHistory.tsx       # History list (Phase 4)
        MeetingReplay.tsx        # Replay view (Phase 4)
        MeetingCompare.tsx       # Comparison view (Phase 4)
        index.ts
    components/
      world3d/
        props/
          MeetingTable.tsx       # 3D meeting table prop
        BotSpeechBubble.tsx      # Speech bubble overlay
    hooks/
      useMeeting.ts              # Meeting SSE state management
      useMeetingEvents.ts        # SSE event listener
```
