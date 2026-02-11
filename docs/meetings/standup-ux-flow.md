# Stand-Up Meeting UX Flow

> CrewHub HQ — User Experience & Interface Design
> Version: 1.0 | Date: 2026-02-11

## User Journey Overview

```
Click Meeting Table → Select Bots → Configure → Watch Meeting → Get Summary
     (1s)              (5s)          (5s)        (~4 min)        (instant)
```

## Step 1: Trigger — Click Meeting Table Prop

In the HQ 3D room, the user clicks the **Meeting Table** or **Whiteboard** prop. The prop glows on hover to indicate interactivity.

```
┌─────────────────────────────────────────────┐
│                  HQ Room (3D)                │
│                                              │
│    🤖 Main        🤖 Dev                     │
│         \          /                         │
│          ┌────────┐                          │
│          │Meeting │  ← click                 │
│          │ Table  │  ← glow on hover         │
│          └────────┘                          │
│         /          \                         │
│    🤖 Flowy      🤖 Creator                  │
│                                              │
└─────────────────────────────────────────────┘
```

**Interaction:** Cursor changes to pointer. Table emits subtle pulse animation. Click opens the Meeting Setup dialog.

## Step 2: Bot Selection Dialog

```
┌─────────────────────────────────────────────┐
│  🗓  Start Stand-Up Meeting                  │
│─────────────────────────────────────────────│
│                                              │
│  Select Participants:                        │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │ [✓] 🟢 Main      Sonnet   (Coordinator)│ │
│  │ [✓] 🟢 Dev       Opus     (Developer)  │ │
│  │ [✓] 🟢 Flowy     GPT-5.2  (Creative)   │ │
│  │ [✓] 🟢 Creator   Sonnet   (Designer)   │ │
│  │ [ ] 🔴 Reviewer  GPT-5.2  (Offline)    │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  🟢 = Online  🔴 = Offline (cannot select)   │
│                                              │
│  Selected: 4/5 agents                        │
│                                              │
│         [ Cancel ]        [ Next → ]         │
└─────────────────────────────────────────────┘
```

**Rules:**
- Minimum 2 participants
- Offline bots are greyed out
- Pre-selects all online bots by default

## Step 3: Meeting Configuration

```
┌─────────────────────────────────────────────┐
│  🗓  Configure Meeting                       │
│─────────────────────────────────────────────│
│                                              │
│  Topic / Agenda:                             │
│  ┌─────────────────────────────────────────┐ │
│  │ Plan the authentication system for      │ │
│  │ CrewHub mobile app                      │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  Rounds:  [ 1 ]  [ 2 ]  [•3•]  [ 4 ]  [ 5 ]│
│                                              │
│  Estimated time: ~4 min                      │
│  Est. cost: ~$0.04                           │
│                                              │
│  Templates:                                  │
│  ┌────────┐ ┌────────┐ ┌────────┐           │
│  │Sprint  │ │Feature │ │Debug   │           │
│  │Planning│ │Design  │ │Session │           │
│  └────────┘ └────────┘ └────────┘           │
│                                              │
│  Advanced ▼                                  │
│  ┌─────────────────────────────────────────┐ │
│  │ Synthesizer: [ Main (default) ▾ ]       │ │
│  │ Max response length: [ Normal ▾ ]       │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│       [ ← Back ]        [ 🚀 Start ]        │
└─────────────────────────────────────────────┘
```

**Estimated time formula:** `(participants × rounds × 10s) + 30s synthesis + 5s gathering`

## Step 4: Gathering Animation (3D)

When "Start" is clicked, the dialog closes and the 3D scene animates:

```
Phase 1: Bots walk to table (3s)
┌─────────────────────────────────────────────┐
│                                              │
│    🤖→→→→→→→     ←←←←←←←🤖                  │
│              ┌────────┐                      │
│              │Meeting │                      │
│              │ Table  │                      │
│              └────────┘                      │
│    🤖→→→→→→→     ←←←←←←←🤖                  │
│                                              │
└─────────────────────────────────────────────┘

Phase 2: Bots stand in circle (arrived)
┌─────────────────────────────────────────────┐
│                                              │
│        🤖 Main    🤖 Dev                     │
│            \      /                          │
│             ╔════╗                           │
│             ║Table║                          │
│             ╚════╝                           │
│            /      \                          │
│      🤖 Flowy   🤖 Creator                  │
│                                              │
│  ┌───────────────────────────────────────┐   │
│  │ 📋 Stand-Up: Auth system planning     │   │
│  │ ██░░░░░░░░░░░░░░░░  Round 1/3        │   │
│  └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Animation details:**
- Bots use existing pathfinding (`lib/grid/pathfinding.ts`) to navigate to table
- Each bot gets assigned a position around the table (evenly spaced circle)
- Bots face the center of the table
- Meeting status bar appears at bottom of viewport

## Step 5: Active Meeting — Speech Bubbles

As each bot speaks, they get highlighted and a speech bubble appears:

```
┌─────────────────────────────────────────────┐
│                                              │
│        🤖 Main    🤖 Dev                     │
│   ┌──────────────┐  |                        │
│   │ "I think we  │  |                        │
│   │ should use   │  ╔════╗                   │
│   │ OAuth2..."   │  ║Table║                  │
│   └──────┬───────┘  ╚════╝                   │
│     ⭐ SPEAKING       \                      │
│      🤖 Flowy       🤖 Creator               │
│     (waiting)       (waiting)                │
│                                              │
│  ┌───────────────────────────────────────┐   │
│  │ 📋 Stand-Up: Auth system planning     │   │
│  │ ████████░░░░░░░░░░  Round 2/3         │   │
│  │ 🗣 Main speaking... (3/4 bots done)   │   │
│  └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Visual cues:**
- **Active speaker:** Glowing ring around bot, larger avatar, speech bubble with streaming text
- **Waiting bots:** Subtle idle animation (bobbing)
- **Completed bots (this round):** Small ✓ checkmark
- **Speech bubble:** Shows last ~50 chars of response, streams in real-time

## Step 6: Progress Bar

The bottom bar tracks meeting progress:

```
┌─────────────────────────────────────────────────┐
│ 📋 Auth system planning                         │
│                                                  │
│ Round 1  ✓✓✓✓     Round 2  ✓✓●○     Round 3     │
│ ████████████████   ████████████░░   ░░░░░░░░░░  │
│                                                  │
│ 🗣 Flowy speaking...        ⏱ ~2:15 remaining   │
│                              [ Cancel Meeting ]  │
└─────────────────────────────────────────────────┘
```

- ✓ = bot completed turn
- ● = currently speaking
- ○ = waiting
- Real-time countdown estimate

## Step 7: Synthesis Phase

```
┌─────────────────────────────────────────────┐
│                                              │
│        🤖    🤖     🤖    🤖                  │
│         \    |     |    /                    │
│          ╔════════════╗                      │
│          ║  ✨ Main   ║                      │
│          ║ writing    ║                      │
│          ║ summary... ║                      │
│          ╚════════════╝                      │
│                                              │
│  ┌───────────────────────────────────────┐   │
│  │ 📋 Synthesizing meeting notes...      │   │
│  │ ████████████████████████████████░░░░  │   │
│  └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

All bots look toward synthesizer. Whiteboard/table shows a writing animation.

## Step 8: Results Dialog

```
┌─────────────────────────────────────────────────┐
│  ✅  Stand-Up Complete!                          │
│─────────────────────────────────────────────────│
│                                                  │
│  # Stand-Up Summary: Auth System Planning        │
│  **Date:** 2026-02-11 11:50                      │
│  **Participants:** Main, Dev, Flowy, Creator     │
│                                                  │
│  ## Goal                                         │
│  Design OAuth2 authentication for CrewHub        │
│  mobile app with social login support.           │
│                                                  │
│  ## Discussion Summary                           │
│  - Main proposed OAuth2 + JWT approach           │
│  - Dev recommended Keycloak for identity mgmt    │
│  - Flowy suggested progressive auth (guest →     │
│    full account)                                 │
│  - Creator proposed login screen mockups with    │
│    biometric fallback                            │
│                                                  │
│  ## Action Items                                 │
│  - [ ] Set up Keycloak instance — @Dev           │
│  - [ ] Design login flow mockups — @Creator      │
│  - [ ] Research OAuth providers — @Flowy         │
│  - [ ] Write auth middleware — @Dev              │
│                                                  │
│  ## Decisions                                    │
│  - Use OAuth2 + JWT (not session-based)          │
│  - Support Google + GitHub social login          │
│  - Implement refresh token rotation              │
│                                                  │
│  ⏱ Duration: 4m 23s | 💰 ~$0.04                 │
│                                                  │
│  [ 📋 Copy MD ] [ 💾 Save to Project ] [ Close ] │
└─────────────────────────────────────────────────┘
```

**Actions:**
- **Copy MD:** Copies raw markdown to clipboard
- **Save to Project:** Saves to current room's project docs folder
- **Close:** Dismisses dialog, bots return to their positions

## Post-Meeting: Bots Return

After closing the results dialog, bots animate back to their original positions in the HQ room. The meeting table returns to its idle state.

## Edge Cases

| Scenario | UX Behavior |
|----------|-------------|
| User clicks table during meeting | "Meeting in progress" tooltip |
| Bot goes offline mid-meeting | Skip remaining turns, note in summary |
| Network disconnect | Pause indicator, auto-resume on reconnect |
| Cancel during synthesis | Show partial results collected so far |
| Very long response | Truncate speech bubble, full text in final output |

## Responsive Considerations

- **Small viewports:** Progress bar becomes floating pill, speech bubbles are smaller
- **Performance mode:** Disable walking animation, instant teleport to positions
- **Accessibility:** All speech bubble text available via screen reader, progress announced

## Component Hierarchy

```
<MeetingProvider>                    // Context for meeting state
  <MeetingTrigger />                 // Detects click on table prop
  <MeetingSetupDialog>               // Steps 2-3
    <BotSelectionStep />
    <ConfigurationStep />
  </MeetingSetupDialog>
  <MeetingScene3D>                   // Steps 4-7
    <BotGatheringAnimation />
    <ActiveSpeakerHighlight />
    <SpeechBubble3D />
  </MeetingScene3D>
  <MeetingProgressBar />             // Step 6
  <MeetingResultsDialog />           // Step 8
</MeetingProvider>
```
