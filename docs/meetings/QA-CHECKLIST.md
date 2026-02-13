# AI Meetings - QA Checklist

> **Date:** 2026-02-13  
> **Version:** Phase 1-3 Complete  
> **Tester:** Assistent + Nicky

---

## Pre-Flight Checks

- [ ] Backend running on port 8091
- [ ] Frontend running on port 5180
- [ ] No console errors on page load
- [ ] Navigate to HQ room successfully

---

## Phase 2: 3D Gathering Animation

### Meeting Table Prop
- [ ] Meeting Table visible in HQ room
- [ ] Table has proper geometry (cylinder + disc)
- [ ] Hover effect works (glow)
- [ ] Click opens MeetingDialog
- [ ] "Meeting in Progress" indicator appears when meeting active

### Meeting Dialog
- [ ] Dialog opens with proper layout
- [ ] Participant picker shows available agents
- [ ] Can select/deselect participants
- [ ] Goal input field works
- [ ] Round count picker (1-5) works
- [ ] Round topics editable
- [ ] Project auto-detected correctly
- [ ] "Start Meeting" button enabled when valid
- [ ] Edge case: No bots → error message
- [ ] Edge case: Only 1 bot → error message
- [ ] Edge case: Meeting already running → "Meeting in Progress" message

### Bot Gathering
- [ ] Bots walk to table when meeting starts
- [ ] Circle positioning correct (~2 unit radius)
- [ ] Bots face table center
- [ ] Bots arranged evenly around table
- [ ] Walking animation smooth (1.2x speed)
- [ ] Bots return to normal after meeting ends
- [ ] No collision issues
- [ ] No bots stuck in walls/objects

---

## Phase 3: Live Progress UI

### Progress Panel
- [ ] Panel opens automatically when meeting starts
- [ ] Panel replaces right sidebar
- [ ] Progress bar visible
- [ ] Progress percentage accurate
- [ ] Round label shows "Round X/Y" (not "Round X/0")
- [ ] Turn label shows "Turn X/Y"
- [ ] Live transcript updates in real-time
- [ ] Status icons correct (✓ done, ● speaking, ○ waiting)
- [ ] Cancel button visible and clickable

### Active Speaker Visual
- [ ] Active speaker has blue glow ring
- [ ] Only one bot glowing at a time
- [ ] Glow switches to next bot on turn change
- [ ] Glow disappears when round ends

### Speech Bubbles
- [ ] Speech bubble appears above active speaker
- [ ] Text truncated to ~60 chars
- [ ] Full text visible in progress panel
- [ ] Bubble positioned correctly (not clipping)
- [ ] Bubble disappears when turn ends

### Turn Checkmarks
- [ ] ✓ checkmark appears above bot after turn complete
- [ ] Checkmarks visible for all completed bots
- [ ] Checkmarks disappear after meeting ends

### Synthesis Phase
- [ ] Progress bar shows 90%+
- [ ] Status shows "Generating summary..."
- [ ] No active speaker glow during synthesis
- [ ] Table glows/pulses (if implemented)

### Meeting Output
- [ ] Output panel opens automatically on complete
- [ ] Markdown rendered correctly
- [ ] Copy button works (copies to clipboard)
- [ ] Full transcript toggle works
- [ ] File path shown correctly
- [ ] Open file button works (if applicable)

---

## SSE Events & Real-Time Updates

### Event Flow
- [ ] `meeting-started` triggers gathering
- [ ] `meeting-state` updates progress bar
- [ ] `meeting-turn-start` shows "generating..."
- [ ] `meeting-turn` appends to transcript
- [ ] `meeting-synthesis` shows synthesis status
- [ ] `meeting-complete` shows output panel
- [ ] No missed events
- [ ] No duplicate events

### Reconnection
- [ ] If SSE disconnects, shows reconnecting state
- [ ] Reconnects automatically
- [ ] State syncs correctly after reconnect

---

## Error & Edge Cases

### Cancel Meeting
- [ ] Cancel button works during gathering
- [ ] Cancel button works during rounds
- [ ] Cancel button works during synthesis
- [ ] Bots return to normal after cancel
- [ ] Transcript shows cancelled state
- [ ] Can start new meeting after cancel

### Bot Failures
- [ ] If bot doesn't respond, shows "(no response — skipped)"
- [ ] Meeting continues with next bot
- [ ] No infinite loops

### Network Failures
- [ ] Output fetch failure shows error message
- [ ] Retry button appears
- [ ] Retry button works
- [ ] Error state cleared after successful retry

### Multi-Meeting
- [ ] Starting second meeting while one running → error message
- [ ] Can start new meeting after first completes
- [ ] No state leakage between meetings

---

## Performance

### Frame Rate
- [ ] 60fps maintained in HQ with meeting active
- [ ] No stuttering during bot walking
- [ ] No frame drops during turn updates
- [ ] Smooth with 3 bots
- [ ] Smooth with 5 bots
- [ ] Smooth with 8 bots (max)

### Memory
- [ ] No memory leaks after multiple meetings
- [ ] SSE subscriptions cleaned up properly
- [ ] meetingStore cleaned up after meeting

---

## Accessibility

### Keyboard Navigation
- [ ] Tab navigation works in dialog
- [ ] Enter submits dialog
- [ ] Escape closes dialog
- [ ] Arrow keys work in round topics

### Screen Readers
- [ ] Status icons have aria-labels
- [ ] Progress bar has aria attributes
- [ ] State changes announced
- [ ] Error messages read aloud

### Visual
- [ ] All text readable
- [ ] Color contrast sufficient
- [ ] No color-only indicators

---

## Integration

### Existing Features
- [ ] Other props still work (Desk, Plant, CoffeeMachine, etc.)
- [ ] Bot navigation/wandering still works
- [ ] Room focus still works
- [ ] Chat panel still works
- [ ] Task board still works

### Database
- [ ] Meeting saved to `meetings` table
- [ ] Participants saved to `meeting_participants`
- [ ] Turns saved to `meeting_turns`
- [ ] Can query past meetings via API
- [ ] MD file saved to Synology Drive

---

## Output File

### File Content
- [ ] Title correct
- [ ] Goal shown
- [ ] Participants listed
- [ ] Discussion summary coherent
- [ ] Action items extracted
- [ ] Decisions listed
- [ ] Blockers noted
- [ ] Proper markdown formatting

### File Location
- [ ] Saved to Synology Drive
- [ ] Path: `01-Projects/{project}/meetings/YYYY-MM-DD-standup.md`
- [ ] File actually exists on disk
- [ ] File readable
- [ ] Multiple meetings same day → increments filename

---

## Browser Compatibility

### Chrome
- [ ] All features work
- [ ] No console errors
- [ ] Performance good

### Safari (if tested)
- [ ] All features work
- [ ] No console errors
- [ ] Performance acceptable

---

## Sign-Off

**Backend:**
- [ ] All API endpoints working
- [ ] SSE events correct
- [ ] Error handling robust
- [ ] Database persistence working
- [ ] File output working

**Frontend:**
- [ ] 3D rendering correct
- [ ] UI/UX intuitive
- [ ] Real-time updates working
- [ ] No React warnings
- [ ] No TypeScript errors

**Integration:**
- [ ] End-to-end flow complete
- [ ] No breaking changes to existing features
- [ ] Performance acceptable
- [ ] Accessibility baseline met

---

## Blockers Found

*(List any blocking issues discovered during QA)*

---

## Notes

*(Any observations, minor issues, or suggestions)*

---

**QA Status:** [ ] PASS / [ ] FAIL / [ ] NEEDS FIXES

**Tester Signature:** _________________

**Date:** _________________
