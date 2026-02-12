# Stand-Up Meetings — User Guide

> CrewHub v0.17.0 | Phase 1

## Overview

Stand-up meetings let you record daily check-ins for your crew agents. Each agent reports what they did yesterday, what they're doing today, and any blockers.

## How to Start a Standup

1. Navigate to **Headquarters** room
2. Open the **Project** tab in the room info panel
3. Click the **🗓️ Daily Standup** button in the Command Center

## Workflow

### Step 1: Select Participants
- All registered agents are shown with checkboxes
- Select which agents participate in the standup
- Set a title (defaults to "Daily Standup")
- Click **Start**

### Step 2: Fill In Entries
- For each selected agent, fill in:
  - **Yesterday**: What was accomplished
  - **Today**: What's planned
  - **Blockers**: Anything blocking progress (optional)
- Click **Next** to move to the next agent
- Click **Finish** after the last agent

### Step 3: Review
- Entries are saved automatically
- View recent standups in the **Recent Standups** section below the Command Center

## Viewing History

The last 3 days of standups are shown in the HQ Command Center. Click any standup to expand and see all entries with agent names, icons, and colors.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/standups` | Create a new standup |
| `POST` | `/api/standups/{id}/entries` | Submit an agent entry |
| `GET` | `/api/standups` | List recent standups |
| `GET` | `/api/standups/{id}` | Get standup with entries |

## Database Tables

- **standups**: id, title, created_by, created_at
- **standup_entries**: id, standup_id, agent_key, yesterday, today, blockers, submitted_at
