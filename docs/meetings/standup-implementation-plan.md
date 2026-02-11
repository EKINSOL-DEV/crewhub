# Stand-Up Meeting Implementation Plan

> CrewHub HQ — Phased Implementation
> Version: 1.0 | Date: 2026-02-11

## Phase Overview

```
Phase 1          Phase 2           Phase 3            Phase 4
Backend Core     3D Animations     Live UX Polish     Advanced Features
─────────────    ─────────────     ──────────────     ─────────────────
2-3 days         2-3 days          2-3 days           Ongoing
                                                      
Round-robin      Gathering anim    Speech bubbles     Recording/replay
State machine    Bot positioning   Progress bar       Guest bots
REST + SSE       Walk animations   Streaming tokens   Voting
DB schema        Camera focus      Sound effects      Templates library
Gateway comms    Table highlight   Results dialog     Analytics
Basic output     Return animation  Save to project    Scheduling
```

---

## Phase 1: Backend Round-Robin Engine (No Visuals)

**Goal:** Working meeting orchestration via API. Test via curl/Postman before any frontend.

**Effort:** 2-3 days

### Tasks

| # | Task | File(s) | Est. |
|---|------|---------|------|
| 1.1 | Create DB schema (meetings + turns tables) | `db/meeting_models.py`, migration | 2h |
| 1.2 | Implement `RoundRobinEngine` class | `services/meetings/round_robin.py` | 2h |
| 1.3 | Implement `MeetingOrchestrator` state machine | `services/meetings/orchestrator.py` | 4h |
| 1.4 | Write prompt templates (per-turn + synthesis) | `services/meetings/prompts.py` | 2h |
| 1.5 | Create REST endpoints (start, status, cancel) | `routes/meetings.py` | 3h |
| 1.6 | Add SSE meeting events to existing broadcast | `routes/sse.py` (extend) | 2h |
| 1.7 | Gateway integration for agent communication | `services/meetings/orchestrator.py` | 3h |
| 1.8 | Synthesizer: compile final markdown output | `services/meetings/synthesizer.py` | 2h |
| 1.9 | Error handling (timeouts, offline bots) | Orchestrator | 2h |
| 1.10 | Manual testing via API | — | 2h |

**Total: ~24h (~3 days)**

### Definition of Done
- [ ] `POST /api/meetings/start` creates meeting and runs to completion
- [ ] SSE events fire for each state transition
- [ ] Final markdown output contains all sections (Goal, Summary, Actions, Decisions)
- [ ] Cancellation works mid-meeting
- [ ] Timeout handling for unresponsive bots
- [ ] Meeting history persisted in SQLite

### Key Decisions for Phase 1
- **Sequential turns only** (no parallelism yet) — simpler, more natural conversation
- **In-memory state + SQLite persistence** — state machine in memory, persist after each turn
- **Reuse existing SSE** — extend `_sse_clients` pool, add meeting event types

---

## Phase 2: 3D Gathering Animation

**Goal:** Visual feedback in the HQ room when a meeting starts. Bots walk to table and stand in formation.

**Effort:** 2-3 days

**Depends on:** Phase 1

### Tasks

| # | Task | File(s) | Est. |
|---|------|---------|------|
| 2.1 | Make Meeting Table an interactive prop | `components/hq/MeetingTable.tsx` | 2h |
| 2.2 | Meeting context provider + state hook | `contexts/MeetingContext.tsx`, `hooks/useMeeting.ts` | 3h |
| 2.3 | Bot selection dialog component | `components/meetings/BotSelectionDialog.tsx` | 3h |
| 2.4 | Configuration dialog component | `components/meetings/MeetingConfigDialog.tsx` | 2h |
| 2.5 | Calculate circle positions around table | `lib/meetingPositions.ts` | 1h |
| 2.6 | Bot walk-to-table animation (use pathfinding) | `components/hq/BotGathering.tsx` | 4h |
| 2.7 | Bot return-to-position animation | Same | 1h |
| 2.8 | Connect dialogs to REST API | `hooks/useMeeting.ts` | 2h |
| 2.9 | Subscribe to SSE for state updates | `hooks/useMeetingStream.ts` | 2h |
| 2.10 | Active speaker glow/highlight | `components/hq/BotAvatar.tsx` | 2h |

**Total: ~22h (~3 days)**

### Definition of Done
- [ ] Click meeting table → setup dialog opens
- [ ] Bots animate to table positions after "Start"
- [ ] Active speaker has visible highlight
- [ ] Bots return to original positions after meeting ends
- [ ] Works with existing pathfinding grid

---

## Phase 3: Live Speech Bubbles + Progress

**Goal:** Real-time visual feedback during meeting. Streaming text in speech bubbles, progress tracking, polished results dialog.

**Effort:** 2-3 days

**Depends on:** Phase 2

### Tasks

| # | Task | File(s) | Est. |
|---|------|---------|------|
| 3.1 | 3D speech bubble component (HTML overlay or sprite) | `components/meetings/SpeechBubble3D.tsx` | 4h |
| 3.2 | Streaming token display in speech bubble | Same + SSE consumer | 2h |
| 3.3 | Meeting progress bar (bottom overlay) | `components/meetings/MeetingProgressBar.tsx` | 3h |
| 3.4 | Round indicators (✓ ● ○) | Same | 1h |
| 3.5 | Time remaining estimate | `hooks/useMeeting.ts` | 1h |
| 3.6 | Synthesis animation (writing on whiteboard) | `components/meetings/SynthesisAnimation.tsx` | 2h |
| 3.7 | Results dialog with markdown preview | `components/meetings/MeetingResultsDialog.tsx` | 3h |
| 3.8 | "Copy MD" + "Save to Project" actions | Same + API call | 2h |
| 3.9 | Sound effects (optional: turn chime, complete) | `lib/meetingSounds.ts` | 1h |
| 3.10 | Polish: transitions, timing, edge cases | Various | 3h |

**Total: ~22h (~3 days)**

### Definition of Done
- [ ] Speech bubbles show streaming text above active speaker
- [ ] Progress bar accurately reflects meeting state
- [ ] Results dialog renders final markdown beautifully
- [ ] Copy to clipboard works
- [ ] Save to project docs works
- [ ] Smooth transitions between all states

---

## Phase 4: Advanced Features (Ongoing)

**Goal:** Power-user features built incrementally after the core experience is solid.

### 4A: Recording & Replay (3-4 days)
- Save full meeting transcript with timestamps
- Replay meeting: re-animate the 3D scene with recorded turns
- Export as PDF or share link
- Browse meeting history in a dedicated panel

### 4B: Guest Bots (2-3 days)
- Invite external agents (not in HQ) to a meeting
- Temporary bot avatar appears at table
- Configure guest bot's model and persona inline

### 4C: Voting & Reactions (2-3 days)
- After meeting, participants vote on action items
- Thumbs up/down reactions during turns (shown as emoji above bots)
- Priority ranking of decisions

### 4D: Meeting Templates Library (1-2 days)
- Pre-built templates: Sprint Planning, Feature Design, Bug Triage, Retrospective, Brainstorm
- Each template sets: default rounds, prompt style, output format
- User-created custom templates saved to project

### 4E: Scheduling & Recurring (2-3 days)
- Schedule meetings for later (cron-like)
- Recurring stand-ups (daily, weekly)
- Auto-start at scheduled time, results delivered to project docs

### 4F: Analytics Dashboard (2-3 days)
- Meeting frequency, avg duration, token costs
- Per-bot contribution metrics
- Action item completion tracking
- Cost trends over time

---

## Total Effort Summary

| Phase | Effort | Cumulative | Milestone |
|-------|--------|------------|-----------|
| Phase 1 | 3 days | 3 days | API works end-to-end |
| Phase 2 | 3 days | 6 days | Visual meetings in HQ |
| Phase 3 | 3 days | 9 days | **Full experience complete** |
| Phase 4 | Ongoing | — | Power features |

**MVP (Phases 1-3): ~9 working days**

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gateway latency spikes | Meetings take >10 min | Implement per-turn timeout (30s), skip on failure |
| Token costs higher than estimated | $0.15+ per meeting | Add cost cap in config, warn before start |
| 3D performance with speech bubbles | FPS drops | Use HTML overlays (CSS3DRenderer) not 3D geometry |
| Multiple simultaneous meetings | State confusion | Phase 1: single meeting lock. Phase 4: multi-meeting support |
| Bot prompt quality | Incoherent discussion | Iterate on prompts before any frontend work |

## Recommended Start

1. **Start with Phase 1, Task 1.4** (prompts) — get the conversation quality right first
2. Then build the engine around proven prompts
3. Test 5+ meetings via API before touching frontend
4. Phase 2-3 can be parallelized (one person on 3D, another on dialogs)
