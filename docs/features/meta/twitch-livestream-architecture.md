# Are the Bots Okay? — Livestream Architecture (CrewHub Live)

**Status:** Planning / Ready to build  
**Proposed by:** Nicky (voice note 2026-02-19)  
**Based on:** `community-livestream.md` (high-level vision)

---

## 🌍 Context

**CrewHub Live** is a new, separate CrewHub environment built specifically for livestreaming. It stands apart from the main CrewHub product.

**Creator** is treated as a "god" entity in this world — a standalone creative agent that operates independently, not as part of CrewHub or CrewHub Live.

**Platforms:**
- **Twitch** → uses the Polls API for community voting (Top 3)
- **YouTube** → no Poll API, so Triage Agent auto-picks the winner

---

## 🎯 Core Flow

```
Twitch/YouTube Chat
  → Triage Agent (every 5 min)
      → analyzes all chat messages
      → clusters into Top 3 themes/requests
      → [Twitch] creates Poll (2 min, community votes)
      → [YouTube] auto-picks Top 1 (no poll available)
  → The Announcer hypes up the options in chat
  → Winner determined
  → The Announcer dramatically announces the winner
  → The Judge executes the task
      → The Announcer narrates progress to chat
      → Watch Agent monitors execution
          → if error/breakpoint → WhatsApp notification to Nicky
                                → The Announcer reacts to chat
  → Task done → The Announcer celebrates/commiserates
```

---

## 🤖 Agents

### 1. Triage Agent
- **What:** Reads all Twitch chat messages from the last 5 minutes
- **How:** Twitch IRC (TMI.js or twitchio) or EventSub Chat Message subscription
- **Every:** 5 minutes (cron-like loop)
- **Output:** Top 3 themes clustered by LLM (group "build X" + "make X" + "create X" → same intent)
- **Then:** Creates Twitch Poll with Top 3 (via Twitch Polls API), runs for 2 minutes
- **Fallback:** If poll not possible, auto-selects Top 1

**Twitch Poll API:**
- `POST /helix/polls` — requires `channel:manage:polls` OAuth scope
- Up to 5 choices, duration 15–1800 seconds
- `GET /helix/polls` to check results after poll ends

### 2. The Judge
- **What:** The main executor — picks up the winning poll task and runs it
- **Name:** The Judge ✅
- **Behavior:** Takes the triage prompt, executes it as a task (coding, research, building, etc.)
- **Reports:** Progress updates visible in CrewHub 3D world + on stream overlay
- **Session:** Long-running, can be interrupted/redirected by next poll cycle

### 3. Watch Agent
- **What:** Monitors the The Judge's execution
- **Triggers notification when:**
  - Unhandled exception / runtime error
  - Task stuck for >10 min without progress
  - Agent asks a question that needs human input
  - Task completed (summary notification)
- **Notification:** WhatsApp to Nicky (+32494330227)
- **Format:** `"[Are the Bots Okay?] The Judge hit an error: {error_summary}. Task: {task_title}"`

### 4. The Announcer
- **What:** The voice and personality of the show — talks directly to the audience
- **Character:** Funny, dramatic, hype-driven. Makes everything feel like a sporting event.
- **Speaks in:** Twitch/YouTube chat (as a bot), stream overlay text, maybe TTS on stream
- **When active:**
  - Poll opens: hypes up each option ("Option 3 is SPICY, chat. Do you dare?")
  - Poll closes: dramatic announcement of the winner ("THE CHAT HAS SPOKEN.")
  - Task starts: narrates what The Judge is about to do
  - During execution: color commentary on progress ("The Judge is 4 files deep and shows no signs of stopping...")
  - Watch Agent alert: reacts to errors dramatically ("Uh oh. Something has gone terribly right. Or wrong. Hard to tell.")
  - Task done: celebrates or commiserates with chat
- **Personality traits:** self-aware, slightly chaotic, loves the drama, never breaks character
- **Model:** gpt-5-nano — fastest, cheapest GPT-5, perfect for live chat commentary
- **Note:** Creator agent is a separate standalone entity (not part of the show)

---

## 🔄 Detailed Cycle

```
T+0:00  Triage Agent reads last 5 min of chat
T+0:30  LLM clusters chat → Top 3 themes generated
T+0:31  Twitch Poll created (2 min duration)
T+0:32  The Announcer hypes each option in Twitch chat
T+2:31  Poll ends, winner determined
T+2:32  The Announcer: "THE CHAT HAS SPOKEN. Starting in 3... 2... 1..."
T+2:33  The Judge receives task prompt
T+2:35  Watch Agent starts monitoring
T+2:36  The Announcer narrates task start to chat
T+?     Task executes (duration varies)
T+?     The Announcer: periodic color commentary
T+?     Watch Agent notifies Nicky on events + Announcer reacts
T+?     Task complete → The Announcer celebrates/commiserates
T+5:00  Next Triage cycle starts (overlapping ok)
```

---

## 📡 Technical Components

### Twitch Chat Reader
```python
# Option 1: twitchio (Python)
# pip install twitchio
# IRC-based, easy to set up, async

# Option 2: Twitch EventSub (webhook/websocket)
# More reliable for high-volume chats
# Requires app access token + EventSub subscription
```

### Chat Message Buffer
- Store last 5 min of messages in memory (ring buffer)
- Fields: `username`, `message`, `timestamp`
- Deduplicate spam/bot messages
- Strip commands (e.g. `!vote`) before sending to LLM

### LLM Triage Prompt
```
You are analyzing Twitch chat from the last 5 minutes.
Chat messages:
{messages}

Identify the top 3 most requested themes or tasks.
Group similar requests together.
Output exactly 3 short labels (max 60 chars each) for a Twitch poll.
Format: JSON array ["option1", "option2", "option3"]
```

### Twitch Poll Integration
```python
# Create poll (Twitch only)
POST https://api.twitch.tv/helix/polls
{
  "broadcaster_id": "{channel_id}",
  "title": "What should [The Judge] do next?",
  "choices": [
    {"title": "Build a calculator"},
    {"title": "Fix the login bug"},
    {"title": "Refactor the API"}
  ],
  "duration": 120
}

# Get results after 2 min
GET https://api.twitch.tv/helix/polls?broadcaster_id={channel_id}&status=TERMINATED
```

### YouTube — Auto-Decision
```python
# YouTube has no Poll API
# Triage Agent picks Top 1 automatically after clustering
# Optionally: post "Starting task: {top_choice}" as YouTube live chat message
```

### Watch Agent — Error Detection
```python
# Monitor The Judge session via CrewHub backend SSE
# Subscribe to session events
# Pattern match for error indicators:
error_patterns = [
  "Error:", "Exception:", "Failed to", "Cannot", 
  "undefined", "null pointer", "SIGTERM", "exit code 1"
]
```

### WhatsApp Notification
- Use existing OpenClaw WhatsApp channel
- Send to `+32494330227`

---

## 🔐 Required OAuth Scopes

| Scope | Purpose |
|-------|---------|
| `channel:manage:polls` | Create/end Twitch polls |
| `chat:read` | Read chat messages (IRC or EventSub) |
| `chat:edit` | Send updates to chat (optional) |
| `channel:read:polls` | Read poll results |

---

## 🔌 Layer Separation — Technical Architecture

### Two OpenClaw Gateways

```
┌─────────────────────────────────────────────────┐
│  META LAYER — Gateway A (port 18790)             │
│                                                  │
│   Triage Agent   The Judge   Watch Agent         │
│   (persistent)  (persistent) (persistent)        │
│                      │                           │
│              sessions_spawn()                    │
│                      │ ← THE PORTAL              │
└──────────────────────┼──────────────────────────┘
                        │
┌──────────────────────┼──────────────────────────┐
│  EXECUTION LAYER — Gateway B (port 18791)        │
│                      │                           │
│              [Isolated Task Session]             │
│              spawned per task, own workspace     │
│              destroyed after completion          │
│                                                  │
└─────────────────────────────────────────────────┘
                        │
         ┌──────────────┴──────────────┐
         │  CrewHub Live Backend       │
         │  (broker + event bus)       │
         │  → Control App (port 18900) │
         │  → Stream Overlay           │
         └─────────────────────────────┘
```

### How It Works

**Meta Layer (Gateway A)**
- The Judge, Triage Agent, Watch Agent run as persistent long-lived sessions
- These agents orchestrate — they never directly write code or execute tasks
- Each has its own workspace under `~/crewhub-live/meta/`

**The Portal = `sessions_spawn`**
- The Judge calls `sessions_spawn` with the winning task prompt
- This spawns an isolated sub-agent on Gateway B in a fresh workspace (`~/crewhub-live/tasks/{task_id}/`)
- The Judge passes context down (task prompt, constraints, max complexity) and monitors via session history
- The sub-agent has no awareness of the meta layer above it

**Execution Layer (Gateway B)**
- Ephemeral sessions: one per task, spawned on demand, destroyed after completion
- Fully isolated: crashes in execution don't affect the meta layer
- Clean slate per task: no pollution from previous runs
- Each task session gets its own workspace directory

**Watch Agent**
- Subscribes to execution session SSE events from Gateway B
- Triggers WhatsApp notification to Nicky on: errors, stuck (>10 min), human input needed, task done
- Reports summary back to The Judge when session ends

**CrewHub Live Backend (broker)**
- Bridges both gateways: receives SSE events from A and B
- Exposes unified event stream to Control App and OBS overlay
- Stores task history (task title, duration, outcome, model used)

### Directory Structure

```
~/crewhub-live/
├── meta/
│   ├── judge/          ← The Judge workspace
│   ├── triage/         ← Triage Agent workspace
│   └── watch/          ← Watch Agent workspace
├── tasks/
│   └── {task_id}/      ← Isolated per-task workspace (auto-cleaned)
├── config.json         ← Control App settings (hot-reloaded)
└── logs/               ← Task history + stream logs
```

### Config Hot-Reload

`config.json` is written by the Control App and watched by all agents:

```json
{
  "poll_duration_seconds": 120,
  "triage_interval_minutes": 5,
  "max_task_complexity": "medium",
  "auto_cycle_on_empty_chat": true,
  "min_chat_messages": 5,
  "platform": "twitch",
  "judge_model": "claude-sonnet-4-6",
  "triage_model": "gpt-5-nano",
  "announcer_model": "gpt-5-nano",
  "paused": false
}
```

---

## 🏗️ Implementation Plan

### Phase 0 — Technical Setup (NOW)
- Scaffold `~/crewhub-live/` directory structure
- Two OpenClaw gateway configs (ports 18790 + 18791)
- CrewHub Live backend scaffold (FastAPI, port 18800)
- `config.json` with defaults, hot-reload watcher
- Control App scaffold (React, port 18900) — settings + status panel
- Verify: spawn isolated task session on Gateway B from Gateway A

### Phase 1 — Chat Reader + Triage
- Twitch chat reader (Python, twitchio or EventSub)
- 5-min ring buffer (username, message, timestamp)
- LLM triage prompt → Top 3 clusters → console output
- No poll yet, just validate the clustering logic

### Phase 2 — Twitch Poll Integration
- Create Twitch Poll from Top 3 (Polls API)
- Wait for poll end, read winner
- Inject winner as task into The Judge (via sessions_spawn on Gateway B)

### Phase 3 — The Judge + Watch Agent
- The Judge persistent session on Gateway A
- Receives task from poll result, spawns execution session on Gateway B
- Watch Agent monitors execution via SSE
- WhatsApp notifications on events
- Results reported back to The Judge

### Phase 4 — Control App + Stream Integration
- Full Control App: all settings, live controls, status panel
- OBS browser source overlay (current task, poll votes, Watch Agent alerts)
- CrewHub 3D world visible on stream
- Full cycle running live end-to-end

---

## 💻 Code View — Live Code Changes on Stream

### Concept
While The Judge executes a task, viewers can watch the actual code being written in real-time. The code flows up through the portal from the execution world into view.

### Architecture
```
The Judge writes/edits files
  → file watcher (chokidar / Python watchdog) detects change
  → git diff computes before/after
  → CrewHub Live backend emits "code_change" SSE event
  → Frontend: live diff viewer
  → OBS browser source displays it on stream
```

### Three View Modes

**1. Live Diff Panel**
Classic split view — left: before, right: after. Green additions, red deletions. Updates every time a file is saved. Shown inside or above the portal visual.

**2. Code Ticker**
Horizontal tape at the bottom of the stream showing the last N lines of changed code. Matrix-style (green on dark). Always visible, low footprint.

**3. Modified Files Sidebar**
List of all files changed during the current task, with timestamp and line count delta. Like VS Code's changed files panel. Good for longer tasks.

### Technical Implementation
- `code_change` event added to CrewHub Live SSE stream
- Session JSONL parsing already exists in CrewHub — extend it to emit `write`/`edit` tool call content as structured events
- Fallback: file system watcher on the Judge's workspace directory (`chokidar` or `watchdog`)
- OBS browser source pointing at a styled standalone diff renderer

### Portal Integration
The code visually flows *upward through the portal* into the meta world above. The Judge looks down and literally sees the code being built below. Every decision has a visible consequence.

---

## 🎬 Visual Concept — The Two Worlds

*Nicky's voice note, 2026-02-19*

### The Meta World (Above)
**The Judge**, **Creator**, and **Triage Agent** exist in a room high above. These are the gods. They don't build — they decide and observe.

The camera frames them standing in the center of their room, looking down at a **portal in the floor** — a circular window into the world below.

### The Execution World (Below / Inside the Portal)
The smaller world visible through the portal is where everything actually gets built. This is the live execution environment: code runs, files change, bots work.

The two worlds are **encapsulated** — the gods above don't interfere with the world below. The world below doesn't know about the gods. The portal is the only connection.

### Decision Moment (Cutscene)
When a poll ends and the verdict is in:
1. Camera cuts to the three agents gathered around the portal
2. They look down together
3. The Judge steps forward — the task descends into the world below
4. Camera follows into the portal, transition to execution view

### Camera Angles
- **Establishing shot:** Wide angle, all three agents, portal glowing below
- **Decision close-up:** The Judge from below looking up, portal behind him
- **Portal descent:** First-person camera falling into the portal
- **World below:** Top-down view of the execution world, task starting

### Why This Works
- Clean metaphor: gods above, world below, portal as the decision channel
- Makes every poll resolution into a cinematic moment
- The "two worlds" framing makes CrewHub Live feel like a proper show, not just a dev stream
- Community votes → gods decide → world changes. Elegant loop.

---

## 🎛️ Control App

A standalone web dashboard (or Tauri app) for dynamic real-time control of CrewHub Live — no redeploy needed, all settings hot-reload.

### Core Controls

| Setting | Type | Default | Notes |
|---------|------|---------|-------|
| Poll duration | Slider (15–300s) | 120s | Changed mid-stream, applies to next poll |
| Max task complexity | Select (Quick/Medium/Deep) | Medium | Quick = <5 min, Medium = <20 min, Deep = no limit |
| Triage interval | Slider (1–15 min) | 5 min | How often Triage Agent reads chat |
| Auto-cycle on empty chat | Toggle | ON | Start new round immediately if chat has no messages |
| Min messages to trigger poll | Number | 5 | Avoid polls from 1–2 messages |
| Platform | Select (Twitch/YouTube/Both) | Twitch | Active streaming platform |
| The Judge model | Select | claude-sonnet-4-6 | Which model The Judge uses |
| Triage model | Select | gpt-5-nano | Fast + cheap, frequent triage cycles |
| Announcer model | Select | gpt-5-nano | Fastest GPT-5, live chat commentary |
| Announcer enabled | Toggle | ON | Mute the Announcer during breaks |

### Live Controls (during stream)

- **Skip current task** — interrupt The Judge, start new triage cycle
- **Pause / Resume** — freeze all agents (e.g. during break)
- **Force task** — manually inject a task, bypassing the poll
- **Extend time** — give The Judge 10 more minutes
- **Open question to chat** — let The Judge ask the stream something

### Status Panel (read-only)

- Current task title + estimated time remaining
- The Judge live status (thinking / coding / waiting / done)
- Current poll status + vote counts
- Chat activity graph (messages/min)
- Watch Agent alerts (errors, stuck, questions)

### Architecture

- Backend: FastAPI service (part of CrewHub Live backend)
- Config stored in DB or JSON file, hot-reloaded by agents via SSE or polling
- Frontend: React single-page app, served at `localhost:18900` (or embedded in CrewHub)
- Auth: simple token-based (only Nicky has access during stream)

---

## 💡 Decisions Made

1. **The Judge name** → The Judge ✅
2. **Poll duration** → configurable in Control App (default 120s) ✅
3. **Empty chat** → auto-start new round immediately ✅
4. **Max task complexity** → configurable in Control App (Quick/Medium/Deep) ✅
5. **Multiple Judges** → always one active at a time (TBD)
6. **Twitch channel / show name** → **Are the Bots Okay?** (`arethebotsokay.com`) ✅

---

*Written 2026-02-19 based on Nicky's voice note*  
*Updated 2026-02-20 — Control App concept added, open questions resolved*
