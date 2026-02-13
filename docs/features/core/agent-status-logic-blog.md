# Why Your Agent Looked Asleep (When It Wasn't)

Ever noticed your main agent showing as "sleeping" 💤 while it was clearly doing something? You'd spawn a subagent to handle a big task, check back 10 minutes later, and see the parent agent snoozing — even though its subagent was actively churning away.

That's because the old status logic was... simple. Too simple.

## The Problem

Previously, agent status was determined by one thing: **how recently the session's `updatedAt` timestamp changed**. The logic was straightforward:

- Updated in the last 5 minutes → 🟢 **Active**
- Updated 5–30 minutes ago → 🟡 **Idle**
- Updated 30+ minutes ago → 💤 **Sleeping**

This works fine for agents that do everything themselves. But modern agents don't work alone — they **delegate**. A parent agent spawns a subagent, gives it a task, and waits for the result. During that wait, the parent's `updatedAt` stops changing, and within minutes it looks like it fell asleep.

**Before:**
```
🦞 Main Agent    → 💤 Sleeping (10 min idle)
⚡ Subagent #1   → 🟢 Active (working on task)
```

The main agent looks dead, but it's actually supervising a running task. Misleading!

## The Fix: "Supervising" Status

We added a new status: **👁️ Supervising**. The system now checks whether an agent has active child sessions (subagents) before marking it as idle or sleeping.

**After:**
```
🦞 Main Agent    → 👁️ Supervising: "fix-login-bug"
⚡ Subagent #1   → 🟢 Active (working on task)
```

The logic is simple but effective:
1. Is the session recently active? → **Active** (as before)
2. Is the session idle, but does it have subagents that *are* active? → **Supervising**
3. Otherwise → **Idle** or **Sleeping** (as before)

### How It Detects Parent-Child Relationships

Agent sessions follow a naming convention:
- `agent:dev:main` — the main Dev agent session
- `agent:dev:subagent:abc123` — a subagent spawned by the Dev agent
- `agent:main:cron:daily` — a cron job for the Main agent

The system matches parent and child by the agent ID (the second part of the key). If `agent:dev:main` has any `agent:dev:subagent:*` sessions that are active, the parent shows as supervising.

## What Changed in the UI

### Status Cards & Filters
The cards view now shows a **purple "Supervising"** badge and you can filter by it.

### 3D World
- Supervising bots keep their laptop visible (they're watching, not napping)
- A soft **purple glow** pulsates under the bot
- Activity bubbles show "👁️ Supervising: [task name]"
- Supervising bots stay visible in the overview (not hidden like sleeping ones)
- They **won't be parked** — they're still working, just indirectly

### Stats Bar
A new purple dot shows the supervising count when there are agents in that state.

## Edge Cases Handled

- **Cron sessions** that spawn subagents also show as supervising
- **Subagents don't supervise siblings** — only main/cron sessions can supervise
- **Stale subagents** don't trigger supervising — the child must be active (within the threshold)
- **No backend changes needed** — all detection is done client-side using existing session data

## The Takeaway

Status detection should reflect what an agent is *actually doing*, not just when it last spoke. Delegating work is still work — and now CrewHub shows that.
