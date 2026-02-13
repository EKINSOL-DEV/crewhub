# Demo Meeting Button Review — 2026-02-14

## Scope reviewed
Requested implementation:
- `DemoMeetingButton.tsx`
- `useDemoMeeting.ts`
- Demo-only fake meeting orchestration (animations + transcript + 60s results popup)
- Meeting-table filtering in demo mode (only HQ)
- Demo context updates

## What I found
I could not find the requested implementation on `develop` in `~/ekinapps/crewhub`.

### Evidence
- Branch checked: `develop` (clean working tree)
- HEAD: `1a296b3` (`origin/develop` matches)
- Files not present:
  - `frontend/src/**/DemoMeetingButton.tsx` → not found
  - `frontend/src/**/useDemoMeeting.ts` → not found
- No new demo-meeting-specific commits/files detected in recent history.

## Current related behavior (existing code)
- `MeetingTable.tsx` still opens the real meeting flow (`MeetingContext`) and tooltip text remains **"Start Meeting"**.
- `Room3D.tsx` still renders `ProjectMeetingTable` for non-HQ project rooms without demo gating:
  - `room.project_id && !room.is_hq` → render table
- `DemoContext.tsx` contains demo session/room assignment features, but no fake meeting orchestration state.

## Review outcome
**Status: Not approved (implementation missing from target branch).**

## Actionable next steps for dev agent
1. Add `DemoMeetingButton.tsx` and `useDemoMeeting.ts` (or equivalent) and wire only in demo mode.
2. Ensure strict demo isolation:
   - No calls to `/meetings/start`, `/meetings/*/cancel`, or real SSE meeting events in demo flow.
   - Guard all demo paths behind `isDemoMode`/`VITE_DEMO_MODE`.
3. Update `Room3D.tsx` table rendering logic for demo mode:
   - In demo mode: show meeting table only in HQ.
4. Add concurrency guard:
   - Ignore/reject second start while demo meeting is active.
   - Disable button + show running state.
5. Add cleanup guarantees:
   - Clear timers/RAF on unmount and on stop/reset.
   - Reset bot animation/transcript/results state reliably.
6. UX checks:
   - 3 rounds transcript pacing feels natural.
   - 60s completion popup includes clear CTA (close/replay).
7. Add tests (at least hook-level):
   - single-instance lock
   - timer cleanup
   - completion at ~60s
   - demo-only gating

---
If a different branch/commit contains the work, share that ref and I can re-review immediately.