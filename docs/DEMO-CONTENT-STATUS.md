# Demo Content Status — CrewHub v0.15.0

> Last updated: 2026-02-13

## Overview

All demo content has been updated for v0.15.0, covering new features: AI Meetings, Post-Meeting Workflow, and Bot Pathfinding.

## Inventory

### 1. Demo Tasks (7 items)
All prefixed with `Demo:` in the title for easy identification.

| Task | Status | Priority | Room |
|------|--------|----------|------|
| Build authentication system | done | high | dev-room |
| Design landing page mockups | in_progress | medium | creative-room |
| Write API documentation | review | medium | dev-room |
| Performance audit for 3D rendering | todo | urgent | thinking-room |
| Onboarding tutorial flow | blocked | low | headquarters |
| **Set up AI Meeting agenda templates** *(new)* | in_progress | high | headquarters |
| **Configure bot pathfinding routes** *(new)* | todo | medium | dev-room |

Each task has associated project history events (created, assigned, status changes).

### 2. Demo Meetings (2 items)
All prefixed with `Demo:` in the title.

| Meeting | State | Participants | Turns | Action Items |
|---------|-------|-------------|-------|-------------|
| Sprint Planning - v0.15.0 Features | completed | Dev, Main, Flowy | 6 (2 rounds × 3) | 5 |
| UX Brainstorm - Bot Animations | completed | Main, Flowy | 1 | 0 |

- Sprint planning meeting has full output markdown at `data/meeting-outputs/demo-sprint-planning.md`
- Action items have varied priorities and statuses (completed/pending)

### 3. Demo Props / PropMaker History (30 items)
- 29 real generation history items from actual usage
- 4 demo entries available in seed script (not added since history already > 5)
- Mix of success and error states
- Located in `backend/data/generation_history.json`

### 4. Demo Documents (5 files)
Located in `data/demo-docs/`:

| File | Content |
|------|---------|
| README.md | Project overview with v0.15.0 features |
| CHANGELOG.md | Changelog covering v0.12 → v0.15 |
| ARCHITECTURE.md | Architecture docs including meetings system |
| guides/getting-started.md | Getting started guide |
| guides/ai-meetings.md | **New** — AI Meetings user guide |

### 5. Agents & Rooms
- **7 agents**: Main, Dev, Flowy, Creator, Reviewer, Gamedev, WTL
- **8 rooms**: Headquarters, Marketing, Dev Room, Creative Room, Thinking Room, Automation Room, Ops Room, Clients
- Room assignments managed via `session_room_assignments` table (agents table has no `room_id` column)

## What Was Updated for v0.15.0

1. **Seed script** (`scripts/seed_demo_data.py`) — fully rewritten:
   - Added 2 new demo tasks for AI Meetings and Bot Pathfinding
   - Added demo meeting seeding (meetings, participants, turns, action items)
   - Added meeting output markdown generation
   - Added agent room assignment helper
   - Updated reset to clean meetings data
   - DB path updated to `~/.crewhub/crewhub.db`

2. **Demo documents** — all updated to reference v0.15.0 features, added `guides/ai-meetings.md`

3. **Meeting output** — `data/meeting-outputs/demo-sprint-planning.md` created

## Resetting Demo Content

```bash
# Reset and re-seed all demo data
python3 scripts/seed_demo_data.py --reset

# Seed without resetting (skips existing)
python3 scripts/seed_demo_data.py
```

This removes all items with `Demo:` prefix and re-creates them fresh.

## Notes

- PropMaker history is not reset by default (has real usage data)
- The seed script uses `~/.crewhub/crewhub.db` (production DB path)
- Demo meetings reference existing agent IDs (dev, main, flowy)
