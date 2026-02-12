# Prop Delete Feature

**Proposed for:** v0.14.0  
**Status:** ✅ Implemented (2026-02-12)  
**Category:** Creative & Customization

---

## Overview

Add ability to delete generated props from PropMaker history with proper cascade warnings.

---

## User Story

**As a user**, I want to delete props I've generated that I no longer need, **so that** I can keep my PropMaker history clean and organized.

---

## Feature Requirements

### 1. Delete Button
- Add delete button/action to prop history items
- Location: PropMaker History tab (both fullscreen and regular view)
- Icon: 🗑️ or trash can icon
- Position: Next to "Load into Preview" button

### 2. Confirmation Dialog
**Critical:** Show warning before deleting:

```
⚠️ Delete Prop?

This will delete "[Prop Name]" from your history.

Warning: This prop is currently placed in [X] room(s):
• HQ Office (2 instances)
• Meeting Room (1 instance)

Deleting this prop will remove it from all rooms where it's placed.

[Cancel] [Delete Prop]
```

If prop is not placed anywhere:
```
Delete "[Prop Name]" from history?

This action cannot be undone.

[Cancel] [Delete Prop]
```

### 3. Cascade Delete
When prop is deleted:
- ✅ Remove from generation history
- ✅ Remove from all rooms where placed (instances)
- ✅ Update room state
- ✅ Delete associated files (if any)
- ✅ Show success toast: "Prop deleted"

### 4. Visual Feedback
- Show loading state during delete
- Disable other actions during delete
- Remove prop from list immediately after successful delete
- Toast notification on success/error

---

## Technical Implementation

### Backend API
**New endpoint:** `DELETE /api/creator/generation-history/:id`

**Logic:**
1. Check if prop exists in `generation_history.json`
2. Find all room instances where prop is placed
3. Return count + room names for confirmation
4. On confirmed delete:
   - Remove from generation history
   - Remove from all room prop instances
   - Clean up any associated files
   - Broadcast room updates via SSE

**Response:**
```json
{
  "success": true,
  "deleted_from_rooms": ["HQ Office", "Meeting Room"],
  "total_instances_removed": 3
}
```

### Frontend Changes
**Files to modify:**
- `FullscreenPropMaker.tsx` - Add delete button to history items
- `PropMakerMachine.tsx` - Same for in-scene view (if still exists)
- New component: `PropDeleteDialog.tsx` - Confirmation dialog

**Delete Flow:**
1. User clicks delete button
2. Frontend queries: `GET /api/creator/generation-history/:id/usage`
   - Returns list of rooms + instance counts
3. Show confirmation dialog with cascade warning
4. On confirm: `DELETE /api/creator/generation-history/:id`
5. Update local state, remove from UI

---

## UX Considerations

### Safety First
- **Always require confirmation** (no instant delete)
- **Show cascade impact** (which rooms will be affected)
- **Cannot undo** - make this clear

### Edge Cases
- What if prop is placed in many rooms (10+)?
  - Show first 5 rooms, "+ 5 more"
  - Link to see full list
- What if delete fails mid-cascade?
  - Roll back or mark as partial delete?
  - Show error with details
- What if user deletes prop while another user has it loaded in preview?
  - SSE update to notify other users
  - Gracefully handle missing prop

---

## Future Enhancements

### v0.15.0+ Additions
- **Bulk delete** - Select multiple props, delete at once
- **Archive instead of delete** - Soft delete, can restore
- **Move to project** - Organize props by project
- **Export prop** - Download prop code/files before delete

---

## Related Features

- **Prop Editor** (v0.20.0) - Manual editing of props
- **Prop Library** (v0.17.0) - Approved/curated props
- Both features may need delete functionality too

---

## Testing Checklist

- [ ] Delete prop with no room placements
- [ ] Delete prop placed in 1 room
- [ ] Delete prop placed in multiple rooms
- [ ] Delete prop while it's loaded in preview
- [ ] Cancel delete dialog
- [ ] Delete fails gracefully (backend error)
- [ ] SSE updates rooms after delete
- [ ] Toast notifications show correctly

---

*Feature requested by user 2026-02-11 for v0.14.0*
