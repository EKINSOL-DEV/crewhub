# Overnight Tasks - 2026-02-11 → 2026-02-12

Priority tasks for overnight execution (isolated Opus sessions).

---

## 🔴 HIGH PRIORITY

### 1. Frontend Watchdog Implementation
**Goal**: Auto-restart Vite dev server on crash (Docker-based)

**Context**:
- Vite dev server crashed 4× today (SIGKILL during HMR)
- Manual restart required each time
- User requested Docker-based watchdog similar to backend watchdog

**Requirements**:
- Monitor Vite process health in Docker container
- Auto-restart on crash/exit
- Log crashes with timestamps
- Healthcheck endpoint (optional)
- Should work in both dev and production modes

**Files to create/modify**:
- `frontend/Dockerfile` - add process supervisor (e.g., supervisord or custom script)
- `frontend/watchdog.sh` - monitoring script
- `docker-compose.yml` - update frontend service with restart policy
- Documentation: `docs/features/core/frontend-watchdog.md`

**Version**: v0.14.0 (added to Matrix.md)

**Success criteria**:
- Vite crashes automatically restart without manual intervention
- Crash logs saved to file
- Testing: simulate crash, verify auto-restart

---

## 🟡 MEDIUM PRIORITY

### 2. PropMaker UX Polish
**Todo items from today's session** (if time permits):
- PropMaker window width: currently default, user suggested 600px like AI Thinking panel
- Prompt textarea height: user requested 4 lines minimum (currently smaller)

**Files**:
- `frontend/src/components/world3d/zones/creator/PropMakerMachine.tsx`

---

## 📋 CONTEXT

**Recent changes today**:
- PropMaker AI streaming (SSE) implemented ✅
- Zone room refactor (ZoneRoom.tsx) ✅
- PropMaker theme system ✅
- Dialog positioning adjusted (Y=3.5) ✅
- Prompt template flexibility improved ✅

**Known issues**:
- Vite HMR crashes frequently (target of watchdog task)
- Frontend requires manual restart

---

## 🎯 DELIVERABLES

For each task:
1. Implementation (code + tests if applicable)
2. Documentation (design doc or README update)
3. Git commits with clear messages
4. Tag if milestone (e.g., `frontend-watchdog-v1`)
5. Copy docs to Synology Drive: `~/SynologyDrive/ekinbot/01-Projects/CrewHub/`
6. Update Matrix.md if status changes

---

## 📞 REPORT BACK

When complete:
- Summary of what was implemented
- Any blockers or issues encountered
- Recommendations for next steps
- Time taken per task

Good luck! 🚀
