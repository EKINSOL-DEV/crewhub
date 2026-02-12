# Stand-Up Meetings — UX Flow

> CrewHub HQ Feature · v1.0 · 2026-02-12

---

## 1. User Journey Overview

```
Click Meeting Table    Configure Meeting     Watch Discussion      View Results
  (3D HQ Room)      ─→  (Dialog)          ─→  (Live Progress)   ─→  (MD Output)
      [1]                 [2]                    [3]                   [4]
```

---

## 2. Step 1 — Trigger: Meeting Table Prop

The **Meeting Table** is a 3D interactive prop placed in the HQ room, rendered alongside existing props (Desk, Plant, CoffeeMachine, etc.).

### Visual Design
- Round/oval table model, distinct from rectangular desks
- Subtle pulsing glow when hovered (same pattern as other interactive props)
- Small icon overlay: 📋 or meeting icon
- Positioned centrally in HQ room

### Interaction
- **Click** → Opens MeetingDialog
- **Hover** → Tooltip: "Start Stand-Up Meeting"
- Table is only interactive when no meeting is in progress
- During active meeting: table shows a "Meeting in Progress" indicator

---

## 3. Step 2 — Configure: MeetingDialog

### Dialog Mockup

```
┌─────────────────────────────────────────────────────┐
│  📋 Start Stand-Up Meeting                      ✕   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Meeting Goal                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │ Daily standup for CrewHub development       │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Participants                    Select All ☐       │
│  ┌─────────────────────────────────────────────┐    │
│  │ ☑ 🟣 DevBot        (Developer)             │    │
│  │ ☑ 🔵 DesignBot     (Designer)              │    │
│  │ ☑ 🟢 PlannerBot    (Project Manager)       │    │
│  │ ☑ 🟡 QABot         (Quality Assurance)     │    │
│  │ ☐ 🔴 ResearchBot   (Researcher)            │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Rounds  ┌───┐                                      │
│           │ 3 │  ▲▼                                  │
│           └───┘                                      │
│                                                     │
│  Round Topics (editable)                            │
│  1. ┌──────────────────────────────────────────┐    │
│     │ What have you been working on?           │    │
│     └──────────────────────────────────────────┘    │
│  2. ┌──────────────────────────────────────────┐    │
│     │ What will you focus on next?             │    │
│     └──────────────────────────────────────────┘    │
│  3. ┌──────────────────────────────────────────┐    │
│     │ Any blockers or concerns?                │    │
│     └──────────────────────────────────────────┘    │
│                                                     │
│  Project: CrewHub (auto-detected from HQ room)      │
│                                                     │
│              ┌──────────┐  ┌──────────────────┐     │
│              │  Cancel   │  │  Start Meeting ▶ │     │
│              └──────────┘  └──────────────────┘     │
└─────────────────────────────────────────────────────┘
```

### Behavior
- Participants default to all bots assigned to the HQ room
- Round topics have sensible defaults, fully editable
- Project auto-detected from room's assigned project
- "Start Meeting" → POST `/api/meetings/start` → Dialog transitions to progress view

---

## 4. Step 3 — Live Progress: MeetingProgressView

### 3D Visual Behavior

#### Gathering Phase (3-5 seconds)
1. Bots stop their current wandering/idle animations
2. Each bot walks toward the Meeting Table using pathfinding
3. Bots arrange themselves in a circle around the table
4. Standing positions calculated: `angle = (2π / numBots) * index`

```
        Bot 3
         ◉
    Bot 2     Bot 4
      ◉  ┌───┐  ◉
         │ ○ │         ← Meeting Table (top view)
      ◉  └───┘  ◉
    Bot 1     Bot 5
```

#### During Rounds
- **Active speaker:** Highlighted with a glow ring + slightly raised position
- **Speech bubble:** Shows abbreviated response text above active bot
- **Waiting bots:** Subtle idle animation (slight sway)
- **Completed turn:** Small ✓ checkmark appears above bot

#### Synthesis Phase
- All bots face center
- Table glows/pulses indicating processing
- No individual speaker highlight

#### Complete
- Bots do a small "nod" animation
- Table displays a ✓
- Bots return to normal wandering after 3 seconds

### Progress Dialog Mockup

```
┌─────────────────────────────────────────────────────┐
│  📋 Stand-Up Meeting in Progress               ✕   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─ Progress ─────────────────────────────────────┐ │
│  │ ████████████████████░░░░░░░░░  Round 2/3  60%  │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  Round 2: What will you focus on next?              │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ ✓ 🟣 DevBot: "I'll finish the auth          │    │
│  │   middleware refactor and start on the       │    │
│  │   WebSocket reconnection logic."             │    │
│  │                                              │    │
│  │ ✓ 🔵 DesignBot: "Building on what Dev       │    │
│  │   said about auth, I'll update the login     │    │
│  │   flow mockups to match the new middleware." │    │
│  │                                              │    │
│  │ ● 🟢 PlannerBot: generating...              │    │
│  │   ░░░░░░░░░░                                │    │
│  │                                              │    │
│  │ ○ 🟡 QABot: waiting                         │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌────────────────────────┐                         │
│  │  Cancel Meeting  ⏹     │                         │
│  └────────────────────────┘                         │
└─────────────────────────────────────────────────────┘

Legend:  ✓ = completed   ● = speaking   ○ = waiting
```

### SSE Events Driving Updates

| SSE Event | UI Update |
|-----------|-----------|
| `meeting-state` | Update progress bar, round label |
| `meeting-turn` | Add bot response to transcript, move to next bot |
| `meeting-turn-start` | Show "generating..." for active bot |
| `meeting-synthesis` | Show "Generating summary..." state |
| `meeting-complete` | Switch to output view |
| `meeting-error` | Show error message with retry option |
| `meeting-cancelled` | Close dialog, show toast |

---

## 5. Step 4 — Results: MeetingOutput

### Output Dialog Mockup

```
┌─────────────────────────────────────────────────────┐
│  ✅ Stand-Up Complete — Feb 12, 2026            ✕   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  # Stand-Up Meeting — 2026-02-12                    │
│                                                     │
│  ## Goal                                            │
│  Daily standup for CrewHub development              │
│                                                     │
│  ## Participants                                    │
│  - 🟣 DevBot (Developer)                           │
│  - 🔵 DesignBot (Designer)                         │
│  - 🟢 PlannerBot (Project Manager)                 │
│  - 🟡 QABot (Quality Assurance)                    │
│                                                     │
│  ## Discussion Summary                              │
│  The team focused on auth middleware refactoring    │
│  and its downstream effects on the login flow...    │
│                                                     │
│  ## Action Items                                    │
│  - [ ] DevBot: Complete auth middleware refactor    │
│  - [ ] DesignBot: Update login flow mockups         │
│  - [ ] PlannerBot: Reprioritize sprint backlog      │
│  - [ ] QABot: Write integration tests for auth      │
│                                                     │
│  ## Decisions                                       │
│  - Agreed to use JWT refresh tokens over sessions   │
│                                                     │
│  ## Blockers                                        │
│  - QABot: Waiting on staging environment access     │
│                                                     │
│  ────────────────────────────────────────────────   │
│                                                     │
│  💾 Saved to: CrewHub/meetings/2026-02-12-standup.md│
│                                                     │
│  ┌──────┐  ┌──────────┐  ┌───────────────────┐     │
│  │ Copy │  │ Open File │  │ View Full Transcript│    │
│  └──────┘  └──────────┘  └───────────────────┘     │
│                                                     │
│              ┌──────────────────┐                    │
│              │      Close       │                    │
│              └──────────────────┘                    │
└─────────────────────────────────────────────────────┘
```

### Actions
- **Copy:** Copy MD to clipboard
- **Open File:** Open in system file viewer (Synology Drive path)
- **View Full Transcript:** Toggle between summary and raw turn-by-turn transcript

### Full Transcript View

```
┌─────────────────────────────────────────────────────┐
│  📋 Full Transcript                         [Summary]│
├─────────────────────────────────────────────────────┤
│                                                     │
│  ── Round 1: What have you been working on? ──      │
│                                                     │
│  🟣 DevBot:                                        │
│  "I've been refactoring the auth middleware to      │
│  support JWT refresh tokens. About 70% done,        │
│  the token rotation logic is working in tests."     │
│                                                     │
│  🔵 DesignBot:                                     │
│  "Completed the dark mode color palette. Also       │
│  reviewed DevBot's auth changes — the login flow    │
│  will need updated mockups for the token flow."     │
│                                                     │
│  🟢 PlannerBot:                                    │
│  "Updated the sprint board. Auth refactor is now    │
│  the top priority based on what Dev and Design      │
│  mentioned. Moved 3 lower-priority items to next    │
│  sprint."                                           │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

---

## 6. Edge Cases & Error States

### No Bots in Room
```
┌─────────────────────────────────────────────┐
│  ⚠️ No bots available                       │
│                                             │
│  Assign at least 2 bots to HQ to start     │
│  a stand-up meeting.                        │
│                                             │
│           ┌──────────┐                      │
│           │    OK     │                      │
│           └──────────┘                      │
└─────────────────────────────────────────────┘
```

### Meeting Already Running
```
┌─────────────────────────────────────────────┐
│  ⚠️ Meeting in progress                     │
│                                             │
│  A stand-up is already running in this      │
│  room. View it or wait for it to complete.  │
│                                             │
│     ┌──────────┐  ┌─────────────────┐       │
│     │  Cancel   │  │  View Progress  │       │
│     └──────────┘  └─────────────────┘       │
└─────────────────────────────────────────────┘
```

### Bot Fails to Respond
- Show "(no response — skipped)" in the transcript
- Continue with next bot
- Note in synthesis that a participant was unavailable

### Connection Lost
- Show reconnecting spinner
- Auto-resume when SSE reconnects (state is server-side)
- After 60s: show "Meeting may have failed" with refresh option

---

## 7. Responsive Behavior

The MeetingDialog and output views use the existing CrewHub panel system:
- On desktop: Rendered in the right-side panel (same as BotInfoPanel, ChatPanel)
- The 3D view continues to be visible behind/beside the panel
- Progress dialog is compact enough to not obstruct the 3D meeting animation

---

## 8. Accessibility

- All dialog elements have proper ARIA labels
- Progress bar uses `role="progressbar"` with `aria-valuenow`
- Bot responses are announced via `aria-live="polite"` region
- Cancel button is keyboard-accessible (Escape key also works)
- Color indicators are paired with icons/names (not color-only)
