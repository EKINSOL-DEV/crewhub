# CrewHub Live — Livestream Architecture

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
  → Winner determined
  → The Judge executes the task
      → Watch Agent monitors execution
          → if error/breakpoint → WhatsApp notification to Nicky
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
- **Name ideas:** `Rover`, `Wanderer`, `Scout`, `Nomad`, `Ranger` *(Nicky to pick)*
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
- **Format:** `"[CrewHub Stream] Rover hit an error: {error_summary}. Task: {task_title}"`

### 4. Creator (standalone, external)
- **Not part of CrewHub Live** — operates as a "god" agent in its own world
- Can be invoked by The Judge if the task is creative in nature, but is not a CrewHub Live citizen

---

## 🔄 Detailed Cycle

```
T+0:00  Triage Agent reads last 5 min of chat
T+0:30  LLM clusters chat → Top 3 themes generated
T+0:31  Twitch Poll created (2 min duration)
T+2:31  Poll ends, winner determined
T+2:32  The Judge receives task prompt
T+2:35  Watch Agent starts monitoring
T+?     Task executes (duration varies)
T+?     Watch Agent notifies Nicky on events
T+?     Task complete → results shown on stream
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

## 🏗️ Implementation Plan

### Phase 1 — Chat Reader + Triage (standalone)
- Twitch chat reader (Python service)
- 5-min message buffer
- LLM triage → console output
- No poll yet, just validate the clustering logic

### Phase 2 — Twitch Poll Integration
- Create poll after each triage cycle
- Read poll winner
- Log to CrewHub backend

### Phase 3 — The Judge + Watch Agent
- The Judge session in CrewHub
- Task injection from poll result
- Watch Agent monitors via SSE
- WhatsApp notifications on events

### Phase 4 — Stream Integration
- OBS overlay showing current task, poll, chat consensus
- CrewHub 3D world visible on stream
- Full cycle running live

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
| Triage model | Select | claude-haiku-3-5 | Lighter model for frequent triage |

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
6. **Twitch channel name** → TBD (Nicky to provide)

---

*Written 2026-02-19 based on Nicky's voice note*  
*Updated 2026-02-20 — Control App concept added, open questions resolved*
