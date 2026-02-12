# Stand-Up Meetings — System Design

> CrewHub HQ Feature · v1.0 · 2026-02-12

---

## 1. Overview

Stand-Up Meetings bring AI-orchestrated round-robin discussions to CrewHub HQ. A user clicks the **Meeting Table** prop in the 3D HQ room, selects participants and a topic, and the backend orchestrates a multi-round conversation between bots — each building on cumulative context from prior speakers.

The output is a structured Markdown report saved to the project's Synology Drive folder.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │MeetingTable│ │MeetingDialog │  │MeetingOutput  │  │
│  │  (3D prop)│  │  (config UI) │  │  (results)    │  │
│  └─────┬─────┘  └──────┬───────┘  └───────▲───────┘  │
│        │               │                  │          │
│        │         POST /meetings/start     │          │
│        │               │          SSE stream         │
│        ▼               ▼                  │          │
│  ┌─────────────────────────────────────────┐         │
│  │          SSE Client (EventSource)       │         │
│  └─────────────────────▲───────────────────┘         │
└────────────────────────┼─────────────────────────────┘
                         │ SSE events
┌────────────────────────┼─────────────────────────────┐
│                Backend (FastAPI)                      │
│  ┌─────────────────────┴───────────────────┐         │
│  │         /api/meetings/* routes           │         │
│  └─────────────────────┬───────────────────┘         │
│                        │                             │
│  ┌─────────────────────▼───────────────────┐         │
│  │        MeetingOrchestrator              │         │
│  │  ┌───────────┐  ┌────────────────┐      │         │
│  │  │StateMachine│  │RoundRobinEngine│      │         │
│  │  └───────────┘  └────────┬───────┘      │         │
│  │                          │              │         │
│  │  ┌───────────────────────▼────────┐     │         │
│  │  │  ConnectionManager (Gateway)   │     │         │
│  │  │  sessions_send / sessions_spawn│     │         │
│  │  └────────────────────────────────┘     │         │
│  └─────────────────────────────────────────┘         │
│                                                      │
│  ┌──────────────┐  ┌──────────────────────┐          │
│  │  SQLite DB   │  │  SSE broadcast()     │          │
│  │  (meetings)  │  │  (real-time events)  │          │
│  └──────────────┘  └──────────────────────┘          │
└──────────────────────────────────────────────────────┘
```

### Key Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `MeetingOrchestrator` | `backend/app/services/meetings.py` | Runs the state machine, orchestrates bot turns |
| `routes/meetings.py` | `backend/app/routes/meetings.py` | REST API + SSE event emission |
| `MeetingDialog` | `frontend/src/components/meetings/MeetingDialog.tsx` | Config UI (participants, topic, rounds) |
| `MeetingTable` | `frontend/src/components/world3d/props/MeetingTable.tsx` | 3D clickable prop in HQ |
| `MeetingOutput` | `frontend/src/components/meetings/MeetingOutput.tsx` | Renders final MD report |

---

## 3. State Machine

```
                    POST /meetings/start
                           │
                           ▼
                    ┌──────────────┐
                    │   GATHERING  │  Bots walk to table (3D)
                    │  (3-5 sec)   │  Frontend animation phase
                    └──────┬───────┘
                           │ all bots positioned
                           ▼
                    ┌──────────────┐
                    │   ROUND_1    │  Each bot speaks in order
                    │              │  Topic: "What did you work on?"
                    └──────┬───────┘
                           │ all turns complete
                           ▼
                    ┌──────────────┐
                    │   ROUND_2    │  Each bot speaks in order
                    │              │  Topic: "What will you do next?"
                    └──────┬───────┘
                           │ all turns complete
                           ▼
                    ┌──────────────┐
                    │   ROUND_3    │  Each bot speaks in order
                    │              │  Topic: "Any blockers or concerns?"
                    └──────┬───────┘
                           │ all turns complete
                           ▼
                    ┌──────────────┐
                    │ SYNTHESIZING │  Generate summary from all turns
                    │              │  Create structured MD output
                    └──────┬───────┘
                           │ synthesis complete
                           ▼
                    ┌──────────────┐
                    │   COMPLETE   │  Save MD to disk
                    │              │  Broadcast final event
                    └──────────────┘

          At any point:
                    ┌──────────────┐
                    │  CANCELLED   │  via POST /meetings/{id}/cancel
                    └──────────────┘
                    ┌──────────────┐
                    │    ERROR     │  on unrecoverable failure
                    └──────────────┘
```

### State Transitions

| From | To | Trigger |
|------|----|---------|
| `GATHERING` | `ROUND_1` | Timer expires or frontend signals ready |
| `ROUND_1` | `ROUND_2` | All participants have spoken |
| `ROUND_2` | `ROUND_3` | All participants have spoken |
| `ROUND_3` | `SYNTHESIZING` | All participants have spoken |
| `SYNTHESIZING` | `COMPLETE` | Summary generated and saved |
| `*` | `CANCELLED` | User cancels |
| `*` | `ERROR` | Unrecoverable error (gateway down, all retries exhausted) |

### State Storage

```python
class MeetingState(str, Enum):
    GATHERING = "gathering"
    ROUND_1 = "round_1"
    ROUND_2 = "round_2"
    ROUND_3 = "round_3"
    SYNTHESIZING = "synthesizing"
    COMPLETE = "complete"
    CANCELLED = "cancelled"
    ERROR = "error"
```

States are persisted in SQLite (`meetings` table) so meetings survive backend restarts. The orchestrator checks state on startup and resumes incomplete meetings.

---

## 4. Round-Robin Algorithm

### Core Principle: Cumulative Context

Each bot receives the full context of all previous speakers in the current round. This creates a natural conversation flow where later speakers can build on, agree with, or challenge what earlier speakers said.

### Algorithm

```python
async def run_round(self, round_num: int, round_topic: str):
    """Execute one round of the standup."""
    cumulative_context = []
    
    for i, bot in enumerate(self.participants):
        # Build prompt with cumulative context
        prompt = self._build_turn_prompt(
            bot=bot,
            round_num=round_num,
            round_topic=round_topic,
            previous_responses=cumulative_context,
            meeting_goal=self.config.goal,
            project_context=self.project_summary,
        )
        
        # Send to bot via gateway connection
        response = await self._get_bot_response(
            bot=bot,
            prompt=prompt,
            max_tokens=200,
        )
        
        # Add to cumulative context for next speakers
        cumulative_context.append({
            "bot_name": bot.display_name,
            "bot_role": bot.role,
            "response": response,
        })
        
        # Broadcast turn completion via SSE
        await broadcast("meeting-turn", {
            "meeting_id": self.meeting_id,
            "round": round_num,
            "bot_id": bot.id,
            "bot_name": bot.display_name,
            "response": response,
            "turn_index": i,
            "total_turns": len(self.participants),
        })
        
        # Store in DB
        await self._save_turn(round_num, bot.id, response)
```

### Prompt Template (per turn)

```
You are {bot_name}, role: {bot_role}.
You're in a stand-up meeting about: {meeting_goal}
Project context: {project_summary}

Round {round_num}/3: {round_topic}

{if previous_responses:}
Previous speakers in this round:
{for resp in previous_responses:}
- **{resp.bot_name}** ({resp.bot_role}): {resp.response}
{endfor}

Build on what was said. Don't repeat. Add your unique perspective.
{endif}

Respond concisely (2-3 sentences max). Be specific and actionable.
```

### Speaker Order

Default order follows room assignment order. Can be overridden in `MeetingConfig`:

```python
class MeetingConfig(BaseModel):
    participants: list[str]          # agent IDs, order = speaking order
    goal: str = "Daily standup"
    num_rounds: int = 3              # 1-5
    max_tokens_per_turn: int = 200
    round_topics: list[str] = [
        "What have you been working on?",
        "What will you focus on next?",
        "Any blockers, risks, or things you need help with?",
    ]
```

---

## 5. Bot Orchestration via Gateway

CrewHub communicates with bots through the **ConnectionManager** which interfaces with OpenClaw gateway connections.

### How a Turn Works

```
MeetingOrchestrator
    │
    ▼ get connection for bot's agent
ConnectionManager.get_connection(agent_key)
    │
    ▼ send prompt via gateway
connection.sessions_send(
    session_id=meeting_session_id,
    message=turn_prompt,
    model=bot.default_model or "sonnet",
)
    │
    ▼ await response (with timeout)
response = await connection.wait_for_response(
    timeout=30,
)
    │
    ▼ parse and return
return response.text
```

### Connection Strategy

1. **Preferred:** Use the bot's existing gateway connection (`connections` table)
2. **Fallback:** Use any available connection with the required model
3. **Error:** If no connection available, mark meeting as ERROR

### Session Management

Each meeting creates a dedicated session context:
- Session ID format: `meeting-{meeting_id}`
- The session accumulates all turns as conversation history
- After COMPLETE, the session is closed

---

## 6. Token Budget

Target: **~3500-4000 tokens per meeting** (cost-efficient for daily use)

| Component | Tokens | Count | Subtotal |
|-----------|--------|-------|----------|
| Turn response | ~200 | 15 (5 bots × 3 rounds) | ~3000 |
| Synthesis | ~500 | 1 | ~500 |
| **Total output** | | | **~3500** |

Input tokens (prompts) scale with cumulative context but are bounded:
- Round 1, Bot 1: ~100 tokens (system + topic only)
- Round 3, Bot 5: ~900 tokens (system + topic + 4 previous responses)
- Total input across all turns: ~6000-8000 tokens

**Total cost estimate:** ~$0.01-0.02 per meeting with Sonnet.

---

## 7. Synthesis Engine

After all rounds complete, the orchestrator generates a summary:

```python
async def synthesize(self) -> str:
    """Generate structured meeting summary."""
    all_turns = await self._get_all_turns()
    
    synthesis_prompt = f"""
    Synthesize this stand-up meeting into a structured summary.
    
    Meeting: {self.config.goal}
    Participants: {', '.join(p.display_name for p in self.participants)}
    
    {self._format_all_turns(all_turns)}
    
    Output format (Markdown):
    # Stand-Up Meeting — {date}
    
    ## Goal
    {self.config.goal}
    
    ## Participants
    - List each with role
    
    ## Discussion Summary
    Key points organized by theme (not by person)
    
    ## Action Items
    - [ ] Specific, assigned action items extracted from discussion
    
    ## Decisions
    - Any decisions or agreements reached
    
    ## Blockers
    - Unresolved blockers that need attention
    """
    
    response = await self._get_bot_response(
        bot=self.synthesis_bot,  # Use first participant or designated lead
        prompt=synthesis_prompt,
        max_tokens=500,
    )
    
    return response
```

### Output File

Saved to: `~/SynologyDrive/ekinbot/01-Projects/{project_name}/meetings/{YYYY-MM-DD}-standup.md`

If multiple standups per day: `{YYYY-MM-DD}-standup-2.md`

---

## 8. Database Schema

```sql
-- New tables for meetings feature

CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Daily Standup',
    goal TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT 'gathering',
    room_id TEXT,
    project_id TEXT,
    config_json TEXT,           -- JSON: MeetingConfig
    output_md TEXT,             -- Final synthesized markdown
    output_path TEXT,           -- File path where MD was saved
    current_round INTEGER DEFAULT 0,
    current_turn INTEGER DEFAULT 0,
    started_at INTEGER,
    completed_at INTEGER,
    cancelled_at INTEGER,
    error_message TEXT,
    created_by TEXT DEFAULT 'user',
    created_at INTEGER NOT NULL,
    
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS meeting_participants (
    meeting_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    
    PRIMARY KEY (meeting_id, agent_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id),
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS meeting_turns (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    round_num INTEGER NOT NULL,
    turn_index INTEGER NOT NULL,
    agent_id TEXT NOT NULL,
    agent_name TEXT,
    prompt_tokens INTEGER,
    response_tokens INTEGER,
    response_text TEXT,
    started_at INTEGER,
    completed_at INTEGER,
    
    FOREIGN KEY (meeting_id) REFERENCES meetings(id)
);
```

---

## 9. Error Handling & Recovery

| Scenario | Handling |
|----------|----------|
| Bot timeout (>30s) | Retry once, then skip with "[no response]" |
| Gateway disconnected | Pause meeting, retry connection for 60s, then ERROR |
| All bots fail in a round | Skip round, note in synthesis |
| Backend restart mid-meeting | Resume from last saved state (check `current_round`/`current_turn`) |
| User cancels | Set state=CANCELLED, stop orchestrator, broadcast event |

### Retry Policy

```python
MAX_RETRIES_PER_TURN = 1
TURN_TIMEOUT_SECONDS = 30
GATEWAY_RECONNECT_TIMEOUT = 60
```

---

## 10. Concurrency

- **One meeting per room at a time.** Attempting to start a second returns HTTP 409.
- The orchestrator runs as an `asyncio.Task` — non-blocking to the API server.
- SSE broadcasts are fire-and-forget to all connected clients.
- Database writes use the existing `get_db()` pattern (per-request connections).

---

## 11. Future Extensions

- **Meeting templates:** Pre-configured topics (retrospective, planning, brainstorm)
- **Configurable rounds:** 1-5 rounds with custom topics per round
- **Meeting history:** Browse past meetings, compare across days
- **Bot voting:** Bots can +1 action items from other bots
- **External triggers:** Start meetings via cron or API (automated daily standups)
