# AI Meetings - Bug Fixes

> **Date:** 2026-02-13  
> **Goal:** Fix 5 bugs discovered during user testing  
> **Strategy:** Opus implementation + GPT-5.2 review

---

## 🐛 Bugs to Fix

### Bug #1: Meeting Table Collision with Sleeping Bot
**Priority:** Medium  
**Reported:** 19:29

**Problem:**
- Meeting table spawns at center position [0, 0, 0] in project rooms
- Sleeping bots can also be at that position
- Result: Table and bot overlap (z-fighting/clipping)

**Root Cause:**
- Dynamic table placement uses fixed center position
- No collision detection before placement
- Bots' sleeping/wandering logic doesn't avoid table

**Fix Options:**

**Option A: Check Before Placement**
```typescript
// In Room3D.tsx or wherever table is placed
const isCenterOccupied = bots.some(bot => 
  distance(bot.position, [0, 0]) < 1.5
);

if (!isCenterOccupied && room.project_id) {
  // Render meeting table
}
```

**Option B: Offset Table Position**
- Place table at [2, 0, 2] or another position instead of exact center
- Reduces chance of collision

**Option C: Bots Avoid Table**
- Add table as obstacle in bot navigation
- Bots detect table and move away

**Recommendation:** Option B (simplest) + add table to bot obstacle list later

**Implementation:**
- Change table position in `Room3D.tsx` from `[0, 0.16, 0]` to `[2, 0.16, 2]`
- OR add random offset if exact center occupied
- Test with sleeping bots

---

### Bug #2: File Tree Not Showing in Document Selector
**Priority:** High  
**Reported:** 19:30

**Problem:**
- Document selector modal shows search bar
- But NO file tree visible (should show folder structure like project panel)
- User can search but sees no default files

**Expected Behavior:**
- Modal opens → shows full folder tree
- User can browse folders (expand/collapse)
- Search filters within that tree

**Root Cause (Hypothesis):**
- Tree data not fetching correctly
- Tree component not rendering
- CSS hiding the tree
- Only search results shown, no default view

**Investigation Steps:**
1. Check if `/api/projects/{id}/markdown-files` returns tree data
2. Check if `DocumentSelectorModal` receives tree prop
3. Check if `FolderTreeNode` renders
4. Check CSS - is tree div hidden/height 0?
5. Check console for errors

**Fix:**
- Debug why tree not rendering
- Ensure default view shows all files
- Search should filter existing tree, not replace it

**Implementation:**
- Add logging to see what data arrives
- Verify tree state updates
- Check render conditions in modal
- Fix CSS if tree is hidden

---

### Bug #3: Bots Walk Through Walls During Gathering
**Priority:** Low (visual polish, not breaking)  
**Reported:** 19:31

**Problem:**
- Bots use straight line (lerp) from current position → table position
- They walk through walls/obstacles
- Looks unnatural

**Expected Behavior:**
- Bots pathfind around walls
- Enter room via door/opening
- Natural movement

**Root Cause:**
- Current implementation: simple lerp (linear interpolation)
- No obstacle detection
- No pathfinding algorithm

**Fix Complexity:**
This is a LARGE fix - proper pathfinding is non-trivial:
- Need to detect walls/obstacles
- Implement A* or navmesh pathfinding
- Or: simplified waypoint system

**Options:**

**Option A: Full Pathfinding (A* or navmesh)**
- Pros: Proper solution, works in all scenarios
- Cons: Complex, time-consuming (days of work)

**Option B: Simplified Waypoints**
- Define door positions per room
- Bots go: current pos → door → table
- Pros: Easier, works for most cases
- Cons: Less flexible

**Option C: Defer to Later**
- Not breaking, just visual polish
- Focus on other bugs first
- Add to backlog for "Phase 4: Polish"

**Recommendation:** Option C (defer) - this is days of work for visual polish

**If Implementing:**
- Add room.doorPosition to room metadata
- Bot navigation: lerp to door first, then to table
- Still doesn't handle all wall cases but better than now

---

### Bug #4: Round Display Shows "Round 2/0"
**Priority:** High (user confusion)  
**Reported:** 19:33

**Problem:**
- Progress UI shows: "Round 2 / 0"
- Should show: "Round 2/3" (current/total)
- Total rounds count is 0 or missing

**Root Cause:**
- `totalRounds` not populated from SSE events
- Or: Frontend not receiving total from backend
- Or: Display logic using wrong variable

**Investigation:**
1. Check SSE `meeting-started` event - does it include `num_rounds` or `total_rounds`?
2. Check `useMeeting` hook - does it store totalRounds?
3. Check `MeetingProgressView` - what variable does it display?

**Fix:**
- Ensure backend sends `total_rounds` in SSE events
- Frontend `useMeeting` hook stores it
- Display uses correct variable: `{currentRound}/{totalRounds}`

**Implementation:**
- Check `meeting_orchestrator.py` - does `meeting-started` event include total?
- Check `useMeeting.ts` - update state on event
- Check `MeetingProgressView.tsx` - display logic

---

### Bug #5: Bot Status "Working" Instead of "In Meeting"
**Priority:** Low (cosmetic, but nice UX)  
**Reported:** 19:33

**Problem:**
- During meetings, bots show status "working"
- Better would be: "in meeting" or "meeting"
- Makes clearer what they're doing

**Root Cause:**
- Meeting doesn't set explicit bot status
- Bots default to "working" when active
- No meeting-specific status

**Fix:**
- When meeting starts: set participant bots to status "in meeting"
- When meeting ends: reset to normal status
- Frontend displays this status

**Implementation Options:**

**Option A: Backend Sets Status**
- `MeetingOrchestrator` updates bot status via sessions API
- On start: set to "in meeting"
- On end: reset to "idle" or "active"

**Option B: Frontend Detects**
- Frontend sees bot in `meeting.participants`
- Displays "in meeting" status locally
- No backend change needed

**Option C: Dedicated Meeting Status**
- Add "meeting" to bot status enum
- Backend sets it, frontend shows it

**Recommendation:** Option B (easiest) or Option C (cleanest)

**Implementation:**
- In bot status display logic, check if bot is in active meeting
- If yes, override status with "in meeting"
- When meeting ends, show normal status

---

## 📊 Implementation Priority

**High Priority (fix first):**
1. Bug #2: File tree not showing (blocks document selection)
2. Bug #4: Round display "0" (user confusion)

**Medium Priority:**
3. Bug #1: Table collision (visual issue, medium annoyance)
4. Bug #5: Bot status (cosmetic but nice UX)

**Low Priority (defer):**
5. Bug #3: Wall pathfinding (large effort, visual polish only)

---

## 🧪 Testing Checklist

### Bug #1: Table Collision
- [ ] Spawn meeting table in project room
- [ ] Verify table not at exact same position as sleeping bot
- [ ] No z-fighting or overlap
- [ ] Table still accessible/clickable

### Bug #2: File Tree
- [ ] Open document selector modal
- [ ] See full folder tree
- [ ] Can expand/collapse folders
- [ ] Can select files
- [ ] Search filters within tree

### Bug #3: Wall Pathfinding (if implemented)
- [ ] Start meeting in project room
- [ ] Bots walk around walls
- [ ] Bots enter via door
- [ ] No clipping through geometry

### Bug #4: Round Display
- [ ] Start meeting
- [ ] Check progress panel shows "Round 1/3" (not "Round 1/0")
- [ ] Verify for all rounds

### Bug #5: Bot Status
- [ ] Start meeting
- [ ] Check bot info panel shows "in meeting" (not "working")
- [ ] After meeting ends, status returns to normal

---

## 📁 Files to Modify

**Bug #1:**
- `frontend/src/components/world3d/Room3D.tsx` - Table placement logic

**Bug #2:**
- `frontend/src/components/meetings/DocumentSelectorModal.tsx` - Tree rendering
- `frontend/src/hooks/useProjectMarkdownFiles.ts` - Data fetching
- Debug CSS if tree is hidden

**Bug #3:**
- `frontend/src/components/world3d/Bot3D.tsx` - Navigation logic
- OR: Defer to later phase

**Bug #4:**
- `backend/app/services/meeting_orchestrator.py` - SSE events
- `frontend/src/hooks/useMeeting.ts` - State management
- `frontend/src/components/meetings/MeetingProgressView.tsx` - Display

**Bug #5:**
- `frontend/src/components/world3d/Bot3D.tsx` - Status override logic
- OR: Status display component wherever bot status is shown

---

## 🚀 Execution Plan

**Phase 1: High Priority (1-2h)**
1. Fix Bug #2 (file tree) - investigate & fix
2. Fix Bug #4 (round display) - populate totalRounds

**Phase 2: Medium Priority (1h)**
3. Fix Bug #1 (table collision) - offset position
4. Fix Bug #5 (bot status) - status override

**Phase 3: Defer**
5. Bug #3 (pathfinding) - add to backlog for later

**Review after Phase 1+2** (GPT-5.2, 30m)

**Fixes if needed** (Opus, 1h)

**Total Estimate:** 3-4 hours for bugs 1,2,4,5

---

## ✅ Success Criteria

**Bug #1 Fixed:**
- No table/bot overlap in project rooms
- Table positioned cleanly

**Bug #2 Fixed:**
- File tree visible in modal
- Can browse and select files
- Search filters tree

**Bug #4 Fixed:**
- Shows "Round X/Y" with correct total
- All rounds display properly

**Bug #5 Fixed:**
- Bots show "in meeting" status during meetings
- Status clears after meeting ends

---

**Ready to implement!** 🔧
