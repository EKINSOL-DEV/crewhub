# Why Your Agent Looked Asleep (When It Wasn't)

*CrewHub v0.15.0 — Agent Status Logic*

## The Problem

Picture this: you ask your AI agent to generate a complex 3D prop. It spawns a subagent, which starts working hard — reading files, generating code, testing builds. Ten minutes later, you glance at CrewHub and see... your agent sleeping. 😴

But it's not sleeping. It delegated the work to a child session, and the parent session hasn't sent a message in a while. The old status logic only looked at the *parent's* last activity timestamp. If that was more than 5 minutes ago? Sleeping.

This was confusing. Agents appeared idle precisely when they were doing their most important work — supervising long-running tasks.

## The Fix

The new status logic asks a simple question before marking an agent as idle or sleeping:

> "Do any of my child sessions have recent activity?"

If yes, the parent agent shows as **working** (or **active**), not sleeping. It's that straightforward.

### What counts as a child session?

CrewHub now recognizes three patterns:
- **Subagent sessions** — spawned via `sessions_spawn` (e.g., `agent:dev:subagent:abc123`)
- **Cron sessions** — scheduled background tasks (e.g., `agent:main:cron:xyz789`)
- **Spawn sessions** — any session whose key indicates it was created by the parent

### How it works

1. When calculating an agent's status, we gather all sessions that match the agent's key prefix
2. We check if any child session has been updated within the activity threshold
3. If active children exist, the parent is marked as "working" regardless of its own last message time
4. This also prevents the agent from being moved to the "parking lane" (the area for inactive sessions)

## Before & After

| Scenario | Before | After |
|----------|--------|-------|
| Agent spawns 10-min PropMaker task | Shows "sleeping" after 5 min | Shows "working" throughout |
| Agent delegates research to subagent | Shows "idle" after 2 min | Shows "active" while subagent works |
| Agent's cron job runs in background | No effect on status | Parent reflects cron activity |
| Agent genuinely idle (no children) | Shows "sleeping" ✅ | Shows "sleeping" ✅ (unchanged) |

## Technical Details

The changes touch 4 files with a net addition of ~60 lines:

- **`useAgentsRegistry.ts`** — Enriched session data with child activity detection
- **`minionUtils.ts`** — `calculateStatus()` and `shouldBeInParkingLane()` now accept and respect `hasActiveChildren`
- **`minionUtils.test.ts`** — New test cases for the `hasActiveChildren` behavior
- **`CHANGELOG.md`** — Documented the fix

No database changes. No API changes. No breaking changes. Just smarter status inference from existing session data.

## Why It Matters

In a multi-agent system like CrewHub, delegation is the norm. The main assistant delegates to dev agents, review agents, and specialized workers. If the UI shows the orchestrator as "sleeping" while its team is hard at work, that erodes trust in the system.

Now, the 3D world accurately reflects what's happening: if work is being done on your behalf, your agent shows it. Simple, correct, trustworthy.

---

*Commit: `bfcd31c` — fix: agent status shows 'working' during long tasks with active subagents*
