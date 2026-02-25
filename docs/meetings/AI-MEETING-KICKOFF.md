# AI Stand-Up Meetings - Implementation Kickoff

> **Date:** 2026-02-13
> **Goal:** Full AI-orchestrated meeting system (Phase 1-3)
> **Strategy:** Multi-agent with Opus + GPT-5.2 review cycles

---

## 🎯 What We're Building

**The Vision:**
An AI-orchestrated stand-up meeting system where bots:
1. Walk to a Meeting Table in 3D HQ
2. Take turns speaking in a round-robin fashion
3. Build on each other's responses (cumulative context)
4. Generate a structured summary saved to Synology Drive

**Current State:**
- ✅ Basic database schema (`standups`, `standup_entries`) exists
- ✅ Simple CRUD API in `backend/app/routes/standups.py`
- ✅ Manual entry form in frontend
- ❌ **No AI orchestration** (this is what we're building)
- ❌ No 3D Meeting Table prop
- ❌ No bot gathering animations
- ❌ No round-robin discussion engine

---

## 📋 Implementation Phases

### Phase 1: Backend Round-Robin Engine (1.5 days)
**Owner:** Dev agent (Opus)
**Reviewer:** Reviewer agent (GPT-5.2)

**Deliverables:**
- `MeetingOrchestrator` service with state machine
- Round-robin algorithm with cumulative context
- AI synthesis to structured markdown
- REST API: `/api/meetings/start`, `/status`, `/cancel`, `/output`
- SSE events for real-time progress
- Database migrations for new tables
- Save output to Synology Drive

**Testing:** Via curl/httpie (no frontend needed)

### Phase 2: 3D Gathering Animation (1.5 days)
**Owner:** Dev agent (Opus)
**Reviewer:** Reviewer agent (GPT-5.2)

**Deliverables:**
- `MeetingTable.tsx` 3D prop (clickable)
- `MeetingDialog.tsx` config form
- Bot walking animations to table positions
- Circle positioning around table
- Return animations after meeting

**Testing:** Visual verification in 3D world

### Phase 3: Live Progress UI (1.5 days)
**Owner:** Dev agent (Opus)
**Reviewer:** Reviewer agent (GPT-5.2)

**Deliverables:**
- Active speaker highlight (glow)
- Speech bubbles above bots
- `MeetingProgressView.tsx` live transcript panel
- Progress bar with round/turn tracking
- `MeetingOutput.tsx` final results view
- Copy/open file actions
- Full transcript toggle
- Cancel meeting button

**Testing:** End-to-end meeting flow

### Phase 4: Polish & Extras (DEFERRED)
Templates, replay, history browsing - can be added later.

---

## 🗂️ Critical Documents

All required reading for dev agents:

1. **System Design:** `~/ekinapps/crewhub/docs/meetings/standup-system-design.md`
   Architecture, state machine, round-robin algorithm, synthesis

2. **UX Flow:** `~/ekinapps/crewhub/docs/meetings/standup-ux-flow.md`
   User journey, dialog mockups, 3D behavior, edge cases

3. **API Spec:** `~/ekinapps/crewhub/docs/meetings/standup-api-spec.md`
   REST endpoints, SSE events, data models, constraints

4. **Implementation Plan:** `~/ekinapps/crewhub/docs/meetings/standup-implementation-plan.md`
   Phased tasks, file structure, effort estimates

---

## 🏗️ Architecture Summary

```
Frontend (React + Three.js)
  ├─ MeetingTable.tsx (3D prop, click to start)
  ├─ MeetingDialog.tsx (config form)
  ├─ MeetingProgressView.tsx (live transcript panel)
  ├─ MeetingOutput.tsx (final results)
  ├─ Bot3D.tsx (gathering animations, speech bubbles)
  └─ useMeeting.ts (SSE state management)
           │
           ▼ POST /api/meetings/start
           │ SSE /api/sse (real-time events)
           │
Backend (FastAPI + Python)
  ├─ routes/meetings.py (REST API)
  ├─ services/meeting_orchestrator.py (state machine)
  │     │
  │     ▼ sessions_send (via ConnectionManager)
  │     │
  ├─ ConnectionManager (OpenClaw gateway)
  ├─ SQLite (meetings, meeting_participants, meeting_turns)
  └─ Synology Drive (output MD files)
```

---

## 🎨 Key Technical Decisions

### Backend
- **State machine:** `GATHERING → ROUND_1 → ROUND_2 → ROUND_3 → SYNTHESIZING → COMPLETE`
- **Persistence:** SQLite for state, resume on restart
- **Bot communication:** Via existing `ConnectionManager` + OpenClaw gateway
- **Concurrency:** One meeting per room, max 3 globally
- **Error handling:** Retry once per turn, skip on timeout, mark meeting as ERROR on gateway failure
- **Token budget:** ~3500-4000 tokens per meeting (200 per turn × 15 turns + 500 synthesis)

### Frontend
- **3D table:** Procedural geometry (cylinder + disc), not GLTF
- **Bot positions:** Circle around table, radius ~2 units
- **Speech bubbles:** `Html` from `@react-three/drei`, truncate to ~60 chars
- **Progress panel:** Replaces right-side panel during meeting
- **SSE state:** `useMeeting` hook manages all real-time updates

### Data Flow
```
1. User clicks MeetingTable → MeetingDialog
2. User configures → POST /api/meetings/start
3. Backend creates meeting → SSE "meeting-started"
4. Frontend: bots walk to table (GATHERING phase)
5. Backend: Round 1 begins
   - Bot 1 speaks → SSE "meeting-turn"
   - Bot 2 speaks (with Bot 1's response as context) → SSE "meeting-turn"
   - Bot 3 speaks (with Bot 1+2 as context) → SSE "meeting-turn"
   - ...
6. Backend: Round 2 begins (same pattern)
7. Backend: Round 3 begins (same pattern)
8. Backend: SYNTHESIZING → generate MD summary
9. Backend: Save MD to Synology Drive → SSE "meeting-complete"
10. Frontend: Show MeetingOutput with final results
```

---

## 🧪 Testing Strategy

### Phase 1 Testing (Backend Only)
```bash
# Start a meeting
curl -X POST http://localhost:8091/api/meetings/start \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Meeting",
    "goal": "Testing AI orchestration",
    "participants": ["agent:dev:main", "agent:flowy:main"],
    "num_rounds": 2,
    "round_topics": ["What are you working on?", "Any blockers?"]
  }'

# Watch SSE events
curl -N http://localhost:8091/api/sse

# Check status
curl http://localhost:8091/api/meetings/{id}/status

# Get output (after complete)
curl http://localhost:8091/api/meetings/{id}/output
```

### Phase 2 Testing (3D Animation)
1. Open CrewHub frontend
2. Navigate to HQ room
3. Click Meeting Table
4. Configure meeting
5. Watch bots walk to table
6. Verify circle positioning

### Phase 3 Testing (Full Flow)
1. Start meeting via UI
2. Watch live progress panel
3. Verify active speaker highlights
4. Read speech bubbles
5. Check progress bar updates
6. Review final output
7. Test copy/open actions
8. Test cancel button

---

## ⚠️ Critical Constraints

1. **Don't modify existing `standups` table** - create NEW `meetings` tables
2. **Reuse ConnectionManager** - don't create new gateway logic
3. **Follow existing patterns:**
   - SSE via `broadcast()` from `app/routes/sse.py`
   - Database via `get_db()` from `app/db/database.py`
   - Props registry pattern for MeetingTable
4. **Token limits:**
   - Max 200 tokens per turn
   - Max 500 tokens for synthesis
   - Target ~3500-4000 total per meeting
5. **Error handling:**
   - Timeout per turn: 30s
   - Gateway reconnect: 60s max
   - Retry: 1 attempt per turn
6. **Synology path:** Use `PROJECT_DATA_PATH` env variable
7. **Backend port:** 8091 (not 8090)

---

## 📦 New Files to Create

```
backend/
  app/
    db/
      meeting_models.py          # Pydantic models
    routes/
      meetings.py                # REST API (NEW)
    services/
      meeting_orchestrator.py    # Core engine (NEW)

frontend/
  src/
    components/
      meetings/
        MeetingDialog.tsx        # Config form
        MeetingProgressView.tsx  # Live progress
        MeetingProgressBar.tsx   # Progress bar
        MeetingOutput.tsx        # Results view
        index.ts
      world3d/
        props/
          MeetingTable.tsx       # 3D table prop
        BotSpeechBubble.tsx      # Speech bubble
    hooks/
      useMeeting.ts              # SSE state hook
      useMeetingEvents.ts        # Event listener
```

---

## 🚀 Execution Plan

### Step 1: Backend Implementation (Opus)
**Session label:** `AI Meetings - Backend Engine (Phase 1)`
**Timeout:** 2h
**Model:** Opus

**Instructions:**
1. Read all 4 design docs
2. Implement Phase 1 tasks (see implementation-plan.md)
3. Test via curl/httpie
4. Commit with message: "feat: AI meeting backend orchestration (Phase 1)"

### Step 2: Backend Review (GPT-5.2)
**Session label:** `AI Meetings - Backend Review`
**Timeout:** 30m
**Model:** GPT-5.2

**Instructions:**
1. Review backend code quality
2. Check error handling
3. Verify token budget
4. Suggest optimizations
5. Write review to `docs/meetings/BACKEND-REVIEW.md`

### Step 3: Backend Fixes (Opus)
**Session label:** `AI Meetings - Backend Fixes`
**Timeout:** 1h
**Model:** Opus

**Instructions:**
1. Read `BACKEND-REVIEW.md`
2. Implement fixes
3. Re-test
4. Commit: "fix: address backend review feedback"

### Step 4: Frontend Implementation (Opus)
**Session label:** `AI Meetings - Frontend 3D + UI (Phase 2+3)`
**Timeout:** 3h
**Model:** Opus

**Instructions:**
1. Implement Phase 2 (3D table + gathering)
2. Implement Phase 3 (live UI + progress)
3. Test end-to-end flow
4. Commit: "feat: AI meeting 3D UI and live progress (Phase 2+3)"

### Step 5: Frontend Review (GPT-5.2)
**Session label:** `AI Meetings - Frontend Review`
**Timeout:** 30m
**Model:** GPT-5.2

**Instructions:**
1. Review 3D code quality
2. Check React patterns
3. Verify UX flow
4. Suggest improvements
5. Write review to `docs/meetings/FRONTEND-REVIEW.md`

### Step 6: Frontend Fixes (Opus)
**Session label:** `AI Meetings - Frontend Fixes`
**Timeout:** 1h
**Model:** Opus

**Instructions:**
1. Read `FRONTEND-REVIEW.md`
2. Implement fixes
3. Re-test
4. Commit: "fix: address frontend review feedback"

### Step 7: Integration Testing (Manual QA)
**Session label:** `AI Meetings - QA Testing`
**Owner:** Main assistant (me)

**Checklist:**
- [ ] Backend starts without errors
- [ ] Frontend builds without warnings
- [ ] Meeting Table clickable in HQ
- [ ] Dialog opens with correct defaults
- [ ] Bots walk to table on start
- [ ] Progress panel updates in real-time
- [ ] Speech bubbles appear
- [ ] Active speaker highlighted
- [ ] Progress bar accurate
- [ ] Final output renders correctly
- [ ] MD file saved to Synology Drive
- [ ] Cancel button works
- [ ] Error states handled gracefully

### Step 8: Blog Post (GPT-5.2)
**Session label:** `AI Meetings - Blog Post`
**Timeout:** 20m
**Model:** GPT-5.2

**Instructions:**
1. Write announcement blog post
2. Format: `~/ekinapps/crewhub-web/src/content/blog/ai-meetings-released.md`
3. Include: screenshots, demo GIF, key features, use cases
4. Match tone of previous v0.14.0 post
5. Use ISO timestamp for date

---

## 📝 Success Criteria

**Phase 1 Complete:**
- ✅ `POST /api/meetings/start` triggers full meeting
- ✅ SSE events stream in real-time
- ✅ MD file saved to Synology Drive
- ✅ Testable via curl

**Phase 2 Complete:**
- ✅ Meeting Table clickable
- ✅ Bots walk to table
- ✅ Circle positioning correct
- ✅ Bots return after meeting

**Phase 3 Complete:**
- ✅ Live progress panel works
- ✅ Speech bubbles visible
- ✅ Active speaker highlighted
- ✅ Final output renders
- ✅ All actions work (copy, open, cancel)

**Final Acceptance:**
- ✅ All QA checklist items pass
- ✅ No console errors
- ✅ Blog post published
- ✅ Feature demo-ready

---

## 🎬 Let's Build!

All design docs are ready. Dev agents have full context. Time to execute! 🚀
