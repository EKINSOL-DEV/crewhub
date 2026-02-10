# Stand-Up Meetings — UX Flow

> CrewHub HQ Feature · February 2026

## User Journey Overview

```
Click Meeting Table → Config Dialog → Bots Gather → Round-Robin → Summary → Done
     (3D prop)        (React UI)     (3D anim)    (speech bubbles) (MD dialog)
```

## Step 1: Trigger — Click Meeting Table Prop

The HQ 3D room contains a **Meeting Table** prop (and optionally a Whiteboard).

- User clicks the table → prop highlights with glow effect
- Context menu or direct dialog opens
- Table has 5 chairs arranged in a circle (matching bot count)

```
       ┌─────────────────────┐
       │    HQ 3D Room       │
       │                     │
       │   🪑    🪑    🪑    │
       │      ┌───────┐      │
       │   🪑 │ TABLE │ 🪑   │
       │      └───────┘      │
       │        ↑ click       │
       └─────────────────────┘
```

## Step 2: Meeting Config Dialog

A modal dialog appears over the 3D view.

```
┌──────────────────────────────────────────┐
│         🗓️  Start Stand-Up Meeting       │
├──────────────────────────────────────────┤
│                                          │
│  Topic:                                  │
│  ┌──────────────────────────────────┐    │
│  │ e.g. "Sprint review & blockers" │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Participants:                           │
│  ☑ Main/Assistent    ☑ Dev              │
│  ☑ Flowy             ☑ Creator          │
│  ☑ Reviewer                              │
│                                          │
│  Rounds:  ◉ 3  ○ 2  ○ 1                │
│                                          │
│  Project: [ CrewHub         ▾ ]          │
│                                          │
│  ┌──────────┐  ┌──────────────┐         │
│  │  Cancel   │  │ 🚀 Start    │         │
│  └──────────┘  └──────────────┘         │
└──────────────────────────────────────────┘
```

**Config fields:**
- **Topic** (required) — free text, what the meeting is about
- **Participants** — checkboxes for each bot, all selected by default
- **Rounds** — 1, 2, or 3 (default: 3)
- **Project** — dropdown of active projects (for output path)

## Step 3: Gathering Animation (3D)

After clicking Start:

1. Dialog minimizes to a **progress bar** at the bottom
2. Each bot's avatar walks from their desk/position to the meeting table
3. Bots arrive one by one (staggered 0.5s) and stand at their chair
4. A subtle "gathering" particle effect plays around the table

```
  Progress Bar (bottom of screen):
  ┌──────────────────────────────────────┐
  │ 🗓️ Stand-Up: Sprint review           │
  │ ████░░░░░░░░░░░░░░░░  Gathering...  │
  └──────────────────────────────────────┘
```

**3D Behavior:**
- Bot avatars use walk animation along navmesh path to table
- Each bot takes assigned position (evenly spaced around table)
- Camera optionally pans to meeting table (smooth transition)
- Gathering takes ~3-5 seconds

## Step 4: Round-Robin with Speech Bubbles

Once all bots are gathered, rounds begin.

### Active Speaker Indication

```
       Bot1    Bot2    Bot3
        🤖      🤖      🤖
                 ↑
              ╔══════════════╗
              ║ I think we   ║
              ║ should focus ║
              ║ on the API...║
              ╚══════╤═══════╝
                     │
        🤖          🤖✨         🤖
       Bot4    Active Speaker   Bot5
```

**Visual effects for active speaker:**
- Glowing ring/highlight around active bot
- Speech bubble appears above bot with streaming text
- Other bots have subtle "listening" idle animation
- Bot name label highlighted in progress bar

### Progress Bar During Rounds

```
  ┌──────────────────────────────────────────────┐
  │ 🗓️ Sprint Review — Round 2/3                  │
  │ ██████████████░░░░░░  Dev is speaking...      │
  │                                                │
  │ R1: ✅✅✅✅✅  R2: ✅✅🔵⬜⬜  R3: ⬜⬜⬜⬜⬜ │
  └──────────────────────────────────────────────┘

  ✅ = completed turn
  🔵 = active turn
  ⬜ = pending turn
```

### Speech Bubble Component

```
┌─ Dev ──────────────────────────┐
│ From a technical standpoint,   │
│ the API endpoints are ready.   │
│ Main blocker is the SSE        │
│ stream reconnection logic...   │
└────────────────────────────────┘
```

- Appears above bot avatar in 3D space (HTML overlay or sprite)
- Text streams in word-by-word (SSE-driven)
- Stays visible for 2s after completion, then fades
- Previous bubbles collapse to one-line summary

## Step 5: Synthesis Phase

After all rounds complete:

```
  ┌──────────────────────────────────────┐
  │ 🗓️ Sprint Review                     │
  │ ██████████████████░░  Synthesizing...│
  └──────────────────────────────────────┘
```

- All bots face the center of the table
- A "thinking" animation plays (subtle pulse on table)
- Synthesis takes ~5-10 seconds

## Step 6: Meeting Complete — Output Dialog

A results dialog appears with the full meeting output.

```
┌──────────────────────────────────────────────────┐
│            ✅ Meeting Complete                     │
├──────────────────────────────────────────────────┤
│                                                    │
│  # Stand-Up: Sprint Review                        │
│  February 10, 2026 · 5 participants · 3 rounds   │
│                                                    │
│  ## Summary                                        │
│  The team agreed on prioritizing the API           │
│  endpoints. Dev flagged SSE reconnection as        │
│  the main blocker. Creator proposed a loading      │
│  state redesign. Reviewer raised concerns          │
│  about error handling coverage...                  │
│                                                    │
│  ## Key Decisions                                  │
│  - Focus on SSE stability before new features     │
│  - Creator to mockup loading states by Friday     │
│  - Add error boundary tests (Reviewer)            │
│                                                    │
│  ─────────────────────────────────────────        │
│  📄 Full transcript available                      │
│                                                    │
│  ┌───────────┐ ┌──────────┐ ┌────────────┐       │
│  │ 📋 Copy   │ │ 💾 Save  │ │   Close    │       │
│  └───────────┘ └──────────┘ └────────────┘       │
└──────────────────────────────────────────────────┘
```

**Actions:**
- **Copy** — copy markdown to clipboard
- **Save** — already auto-saved to `${PROJECT_DATA_PATH}/{project}/meetings/{date}-standup.md`
- **Close** — dismiss dialog, bots walk back to their positions

## Post-Meeting 3D Behavior

- Bots walk back from table to their original positions
- Meeting table returns to idle state (no glow)
- A small "📋" icon floats above the table indicating last meeting (clickable to review)

## Responsive Design Notes

- Config dialog: centered modal, max-width 480px
- Progress bar: fixed bottom, full width, 60px height
- Output dialog: centered modal, max-width 640px, scrollable
- Speech bubbles: 3D-attached, auto-size, max-width 300px
- All dialogs have backdrop blur over 3D scene

## Accessibility

- Progress bar announces state changes via aria-live
- Speech bubbles have aria-label with bot name + content
- Keyboard: Escape to cancel meeting, Tab through dialog fields
- Color-blind safe: use icons + text, not just color for status

## Edge Cases

| Scenario | UX Behavior |
|----------|-------------|
| User navigates away from HQ | Meeting continues, progress bar persists |
| User clicks table during meeting | "Meeting in progress" tooltip |
| Bot fails/times out | Skip indicator in progress, note in output |
| Cancel mid-meeting | Confirmation dialog → partial output shown |
| Network disconnect | Reconnect banner, resync from SSE |
