# Stand-Up Meetings — Implementation Plan

> CrewHub HQ Feature · February 2026

## Overview

4-phase rollout, each phase builds on the previous. Designed so Phase 1 is immediately useful (backend-only meetings via API), with progressive 3D enhancements.

---

## Phase 1: Backend Round-Robin Engine

> **Goal:** Working meetings via API, no 3D visuals yet.

### Deliverables

- [ ] `MeetingEngine` class — state machine + round-robin orchestration
- [ ] SQLite table `meetings` for persistence
- [ ] REST endpoints: `start`, `status`, `cancel`
- [ ] SSE endpoint: `stream` with all event types
- [ ] Integration with `sessions_send` for bot turns
- [ ] Cumulative context builder
- [ ] Synthesis prompt + output generation
- [ ] Auto-save meeting output to project data directory
- [ ] Unit tests for state machine transitions
- [ ] Error handling (timeouts, bot failures, cancellation)

### Technical Details

**New files:**
```
backend/app/meetings/
├── engine.py          # MeetingEngine, state machine
├── models.py          # Pydantic models
├── routes.py          # FastAPI endpoints
├── prompts.py         # Prompt templates per role
└── storage.py         # SQLite + file output
```

**Dependencies:**
- Existing `sessions_send` / `sessions_spawn` system
- SQLite (already used by CrewHub)
- `sse-starlette` package for SSE

### Effort Estimate

| Task | Time |
|------|------|
| Data models + DB schema | 2h |
| MeetingEngine core | 4h |
| REST + SSE endpoints | 3h |
| Prompt engineering | 2h |
| Output formatting + save | 1h |
| Testing + edge cases | 3h |
| **Total** | **~15h (2 days)** |

---

## Phase 2: 3D Gathering Animation

> **Goal:** Bots visually walk to the meeting table when a meeting starts.

### Deliverables

- [ ] Meeting Table prop in HQ 3D scene (clickable)
- [ ] Config dialog (React modal)
- [ ] Bot walk animation to table positions
- [ ] "Gathering" state visualization (bots arriving)
- [ ] Camera pan to meeting table on start
- [ ] Bots return to positions after meeting

### Technical Details

**Frontend components:**
```
frontend/src/components/meetings/
├── MeetingConfigDialog.tsx    # Topic, bots, rounds picker
├── MeetingTable3D.tsx         # Three.js meeting table prop
├── BotGathering.tsx           # Walk animation controller
└── useMeetingStore.ts         # Zustand store for meeting state
```

**3D specifics:**
- Meeting table: rectangular mesh with chairs, positioned in HQ room
- Bot positions: calculated evenly around table (circle formula)
- Walk: lerp bot position along path over 2-3 seconds
- Staggered arrival: 0.5s delay between bots

**Dependencies:**
- Phase 1 complete
- Existing bot avatar system in Three.js
- HQ room layout (needs table placement coordinates)

### Effort Estimate

| Task | Time |
|------|------|
| Meeting Table 3D prop | 3h |
| Config dialog UI | 3h |
| Bot walk animation | 4h |
| Camera transitions | 2h |
| State sync (SSE → 3D) | 2h |
| Polish + testing | 2h |
| **Total** | **~16h (2 days)** |

---

## Phase 3: Live Speech Bubbles + Progress

> **Goal:** Real-time visual feedback during meetings.

### Deliverables

- [ ] Speech bubble component (3D overlay above active bot)
- [ ] Streaming text in speech bubble (word-by-word via SSE chunks)
- [ ] Active speaker highlight effect (glow ring)
- [ ] Progress bar component (bottom of screen)
- [ ] Round indicators (✅🔵⬜ per bot per round)
- [ ] Synthesis animation (table pulse/glow)
- [ ] Meeting complete dialog with output

### Technical Details

**Components:**
```
frontend/src/components/meetings/
├── SpeechBubble.tsx           # 3D-attached HTML overlay
├── ActiveSpeakerEffect.tsx    # Glow ring shader/sprite
├── MeetingProgressBar.tsx     # Bottom bar with round grid
├── MeetingOutputDialog.tsx    # Final results + copy/save
└── SynthesisAnimation.tsx     # Table glow during synthesis
```

**Speech bubble approach:**
- CSS2DRenderer overlay (HTML positioned in 3D space)
- Anchored above bot's head position
- Auto-sized with max-width 300px
- Fade in/out with CSS transitions
- Text streams in via `turn_chunk` SSE events

**Dependencies:**
- Phase 2 complete
- CSS2DRenderer setup in Three.js scene

### Effort Estimate

| Task | Time |
|------|------|
| Speech bubble component | 4h |
| Streaming text integration | 3h |
| Active speaker highlight | 2h |
| Progress bar UI | 3h |
| Output dialog | 2h |
| Synthesis animation | 1h |
| Integration testing | 3h |
| **Total** | **~18h (2-3 days)** |

---

## Phase 4: Advanced Features

> **Goal:** Power-user features, polish, and extensibility.

### 4a: Recording & Replay

- [ ] Meeting history page (list of past meetings)
- [ ] Replay mode: step through turns with 3D visualization
- [ ] Export meeting as PDF
- [ ] Search across meeting outputs

**Effort:** ~12h

### 4b: Voting System

- [ ] After rounds, bots vote on key decisions
- [ ] Visual voting UI (thumbs up/down per bot)
- [ ] Vote tally in meeting output

**Effort:** ~8h

### 4c: Meeting Templates

- [ ] Pre-configured meeting types:
  - **Daily Standup** — 3 rounds, all bots, "What's the status?"
  - **Brainstorm** — 2 rounds, Creator + Dev + Flowy
  - **Code Review** — 2 rounds, Dev + Reviewer
  - **Sprint Planning** — 3 rounds, all bots
- [ ] Template selector in config dialog
- [ ] Custom template creation

**Effort:** ~6h

### 4d: Guest Bots

- [ ] Invite external/temporary agents to meetings
- [ ] Guest bot config (name, role, model, system prompt)
- [ ] Guest avatar in 3D (generic placeholder)

**Effort:** ~10h

### Phase 4 Total: ~36h (1 week)

---

## Timeline Summary

| Phase | What | Effort | Dependencies |
|-------|------|--------|--------------|
| **1** | Backend engine | ~15h (2d) | Existing session system |
| **2** | 3D gathering | ~16h (2d) | Phase 1 |
| **3** | Speech bubbles + progress | ~18h (2-3d) | Phase 2 |
| **4** | Advanced features | ~36h (1w) | Phase 3 |
| **Total** | | **~85h (~2 weeks)** | |

## Priority Recommendation

**Ship Phase 1 first** — it's immediately useful. Meetings can run via API/CLI while 3D visuals are built. Phase 2+3 can be done together as one sprint. Phase 4 is nice-to-have, pick features based on what Nicky wants most.

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Bot response quality varies | Tune prompts per role, add examples |
| SSE reliability | Reconnect logic + state recovery endpoint |
| 3D performance with overlays | Limit active overlays, use LOD |
| Context window overflow (many rounds) | Cap at 5 rounds, truncate early turns if needed |
| Meeting feels slow | Parallelize where possible, show progress |
