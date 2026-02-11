# Bot Panel Tabs Design

**Version:** 1.0  
**Date:** 2026-02-09  
**Status:** Ready for implementation

## Goal
Replace the current single-view BotInfoPanel with a tabbed interface that prioritizes **live activity logs** as the default view, while keeping info and actions accessible.

## Problem
Currently, when you focus on a bot, you see static info (bio, type, model, tokens) and action buttons. To see what the bot is doing, you need to click "Open Full Log" which opens a modal. This adds friction when monitoring bot activity.

## Solution: Tabbed Panel

### Tab Structure
```
┌─────────────────────────────────────┐
│  [Avatar] Dev                    [X]│
│  ● Sleeping                         │
├─────────────────────────────────────┤
│  💬 Activity | 📋 Info | ⚙️ Actions   │  ← Tabs
├─────────────────────────────────────┤
│                                     │
│  [Tab content here]                 │
│                                     │
└─────────────────────────────────────┘
```

**Tab order:** Activity (default) | Info | Actions

---

## Tab 1: 💬 Activity (Default)

**Purpose:** Live log stream of what the bot is currently doing.

### Layout
```
┌─────────────────────────────────────┐
│ 18:45                               │
│ ┌─────────────────────────────────┐ │
│ │ Fixing bug in CrewHub backend   │ │
│ │ context envelope injection      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 18:43                               │
│ ┌─────────────────────────────────┐ │
│ │ Reading task df95225a           │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 18:40                               │
│ ┌─────────────────────────────────┐ │
│ │ Started work in Dev Room        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ─────────────────────────────────── │
│ View Full Log →                     │
└─────────────────────────────────────┘
```

### Styling
- **Bubbles:** Light gray background (`bg-gray-100`), rounded corners, padding
- **Timestamps:** Above each bubble group, gray text, small font
- **Auto-scroll:** Always show latest activity at bottom
- **Max entries:** Show last 20 log entries, then "View Full Log" link at bottom
- **Status indicators:**
  - ⚙️ Working (tool calls active)
  - 💤 Idle (no recent activity)
  - 🟢 Active (responding)
- **Tool call badges:** Small colored badges for tool types
  - 🔧 `exec` → gray
  - 📖 `read` → blue
  - ✍️ `write` → green
  - 🤖 `sessions_spawn` → purple

### Humanization
Parse tool calls into readable sentences:
- `exec("npm run dev")` → "Running dev server"
- `read("/path/to/file.ts")` → "Reading file.ts"
- `sessions_spawn(task="Fix bug")` → "Spawning sub-agent: Fix bug"
- `web_search(query="...")` → "Searching the web"

### Empty State
```
┌─────────────────────────────────────┐
│                                     │
│            💤                       │
│       No recent activity            │
│                                     │
└─────────────────────────────────────┘
```

### Live Updates
- Subscribe to SSE stream for this session
- Append new log entries as bubbles
- Auto-scroll to bottom on new entry
- Fade-in animation for new bubbles

---

## Tab 2: 📋 Info

**Purpose:** Static information about the agent (specs, bio).

### Content (unchanged from current)
- Bio quote (italic, border-left accent)
- ✏️ Update Bio button
- **Metadata grid:**
  - Type (with color dot)
  - Status (humanized, e.g. "Idle 15m")
  - Model (e.g. "Opus")
  - Tokens (e.g. "162.1k")
  - Channel (e.g. "webchat")

---

## Tab 3: ⚙️ Actions

**Purpose:** Bot management actions (move, chat, logs, control).

### Layout
```
┌─────────────────────────────────────┐
│ Room Management                     │
│   📦 Move to Room [dropdown]        │
│                                     │
│ Communication                       │
│   💬 Open Chat                      │
│   📜 Open Full Log                  │
│                                     │
│ Agent Control                       │
│   ⏸️ Pause Session                  │
│   🔄 Restart Agent                  │
└─────────────────────────────────────┘
```

### Actions Breakdown
**Room Management**
- Move to Room dropdown (current functionality)

**Communication**
- Open Chat button → opens AgentChat modal
- Open Full Log button → opens FullLog modal

**Agent Control** (future features, grayed out for now)
- Pause Session (grayed)
- Restart Agent (grayed)

---

## Implementation Plan

### Phase 1: Tab Shell
1. Create `BotInfoTabs.tsx` component
2. Add tab state management (default: "activity")
3. Style tabs as pill buttons (like Planner tabs)
4. Migrate existing content into Info and Actions tabs

### Phase 2: Activity Tab
1. Create `ActivityLogStream.tsx` component
2. Subscribe to SSE for session logs
3. Parse and humanize tool calls
4. Render as chat bubbles with timestamps
5. Add auto-scroll behavior
6. Implement "View Full Log" link

### Phase 3: Polish
1. Add fade-in animations for new bubbles
2. Add empty state for Activity tab
3. Test with multiple bot types
4. Ensure mobile responsive

### Phase 4: Future Enhancements
- Add filters (show only errors, only tool calls, etc.)
- Add search in activity stream
- Add pause/resume controls in Actions tab
- Add "Copy logs" button

---

## Files to Modify

### New Files
- `frontend/src/components/world/BotInfoTabs.tsx` (tab shell)
- `frontend/src/components/world/ActivityLogStream.tsx` (activity tab)
- `frontend/src/components/world/InfoTab.tsx` (info content)
- `frontend/src/components/world/ActionsTab.tsx` (actions content)

### Modified Files
- `frontend/src/components/world/BotInfoPanel.tsx` (replace content with BotInfoTabs)

### API Requirements
- SSE endpoint for session logs (may already exist)
- Log format should include timestamp, tool name, args, result

---

## Design Decisions

### Why Activity as Default?
- Most common use case: "What is this bot doing right now?"
- Info is static and rarely changes
- Actions are infrequent

### Why Chat Bubbles?
- Familiar pattern (like messaging apps)
- Easy to scan chronologically
- Visually distinct from JSON logs

### Why Separate Actions Tab?
- Reduces clutter in main view
- Groups related actions logically
- Makes room for future controls (pause, restart, etc.)

---

## Success Metrics
- ✅ Users can see live bot activity without extra clicks
- ✅ Info and actions remain easily accessible
- ✅ Panel remains clean and uncluttered
- ✅ Activity stream is readable and informative

---

## Next Steps
1. Review and approve design
2. Spawn dev subagent for implementation
3. Test with all bot types (dev, flowy, reviewer, etc.)
4. Iterate based on real-world usage
