# AI Meetings Frontend Review

## Summary
Good

This is a strong Phase 2+3 delivery overall: clean feature scope, coherent UI flow, and thoughtful 3D integration. The biggest gaps are a couple of React state-management anti-patterns and some UX/accessibility polish items before QA hardening.

## Strengths
- Clear separation between **meeting orchestration** (`useMeeting`), **cross-layer coordination** (`MeetingContext`), and **render-time bot behavior** (`meetingStore` + `Bot3D`).
- `meetingStore` pattern is appropriate for `useFrame` access and avoids expensive React re-renders in the 3D loop.
- 3D implementation is visually coherent:
  - Meeting table has clear affordance (hover/click/active ring).
  - Bot gathering movement and facing logic is understandable and mostly smooth.
  - Active-speaker glow + completion checkmarks improve readability of turn state.
- UX flow (Dialog → Progress → Output) is intuitive and mostly complete.
- Error/cancelled states are surfaced in progress panel.
- Cleanup in `useMeeting` SSE subscriptions is present and correct.
- Props registry integration for `meeting-table` is done properly and non-invasive.

## Issues Found
### Critical
- **State updates during render (React anti-pattern) in two places:**
  1. `MeetingContext.tsx`: phase transition logic runs in render and calls `setView(...)` + `meeting.fetchOutput()`.
  2. `MeetingDialog.tsx`: open-transition init logic runs in render and calls multiple `setState(...)`.

  This can trigger React warnings (`Cannot update a component while rendering`) and is brittle under StrictMode/concurrent rendering.

### Medium Priority
- **`totalRounds` never appears to be set from SSE payloads** in `useMeeting.ts` (initialized to `0`, not updated in handlers). Progress bar can show `Round X/0` and degrade UX clarity.
- **Meeting completion fetch timing is fragile** because output fetch is tied to render-time phase switching. If fetch fails or races, output panel may show “Loading output…” without recovery UI.
- **`meetingStore` `phase` is typed as `string`** instead of `MeetingPhase`, reducing type safety and allowing invalid values.
- **Accessibility gaps in interactive 3D affordances**:
  - Meeting table interaction is pointer-centric; no keyboard equivalent exposed.
  - Some icon-only semantic cues (✓, ●, ⊘) may not be screen-reader friendly unless mirrored in textual status.
- **Potential global cursor style leakage** (`document.body.style.cursor`) if component unmounts while hovered.

### Low Priority / Nice-to-have
- Markdown rendering in `MeetingOutput` is intentionally simple, but currently limited (no robust markdown parsing/features).
- Transcript auto-scroll depends on `meeting.rounds`; it may miss some non-structural updates in future event variants.
- Minor consistency polish: combine repeated inline styles in `Html` bubbles/labels into shared style tokens/components.

## Recommendations
1. **Move all phase/open transition side effects into `useEffect`.**
   - In `MeetingContext`, track previous phase with `useRef` and react in effect.
   - In `MeetingDialog`, initialize defaults in `useEffect(() => { if (open) ... }, [open, availableAgents])`.
2. **Populate and trust `totalRounds` from backend event payloads** (preferably from `meeting-started`), with a fallback from selected config.
3. **Harden output loading path**:
   - Add explicit `outputLoading`/`outputError` UI in `MeetingOutput`.
   - Retry button if `/output` fetch fails.
4. **Tighten typing**:
   - Use `MeetingPhase` in store instead of `string`.
   - Consider typing SSE event payloads (discriminated interfaces) to reduce field drift bugs.
5. **Accessibility pass before release**:
   - Add keyboard-trigger path for opening meeting dialog from non-3D UI fallback.
   - Ensure status text accompanies icon indicators for screen readers.
   - Verify focus handling when dialog opens/closes and when switching progress/output overlays.
6. **Cursor cleanup safety**:
   - Add unmount cleanup restoring cursor to default in interactive 3D components.
7. **Performance sanity check in QA**:
   - With 8+ bots and active meeting, profile frame time and React commits to confirm 60fps target holds.

## UX/Visual Notes
- Overall flow is understandable and pleasant.
- “Meeting in progress” handling in dialog is good and avoids accidental duplicate starts.
- Gathering/synthesizing empty states are clear.
- Speech bubble truncation keeps scene readable; consider tooltip/expand on panel side for full current utterance.
- Output panel is useful, but adding a clear “retry loading summary” state would reduce confusion on transient API failures.

## Conclusion
Solid implementation with good architecture direction and strong 3D/UI integration. **Not blocked by major design flaws**, but fix the render-time state updates (critical) and address the `totalRounds`/output-loading robustness before full QA sign-off. After those fixes, this should be ready for QA.