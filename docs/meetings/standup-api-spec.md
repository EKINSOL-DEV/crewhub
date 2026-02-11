# Stand-Up Meeting API Specification

> CrewHub HQ — REST + SSE API Design
> Version: 1.0 | Date: 2026-02-11

## Base URL

```
http://localhost:8091/api/meetings
```

## Endpoints Overview

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/meetings/start` | Start a new meeting |
| `GET` | `/api/meetings/{id}/status` | Get meeting status |
| `POST` | `/api/meetings/{id}/cancel` | Cancel a meeting |
| `GET` | `/api/meetings/{id}/stream` | SSE event stream |
| `GET` | `/api/meetings/{id}/output` | Get final markdown output |
| `GET` | `/api/meetings/history` | List past meetings |

---

## Data Models

### MeetingConfig

```python
class MeetingConfig(BaseModel):
    topic: str                              # Meeting topic/agenda
    participants: list[str]                 # Agent IDs
    num_rounds: int = 3                     # 1-5
    synthesizer_id: str | None = None       # Agent to write summary (default: first participant)
    template: str | None = None             # "sprint_planning", "feature_design", "debug_session"
    max_response_tokens: int = 150          # Per-turn token limit
```

### Meeting

```python
class Meeting(BaseModel):
    id: str
    topic: str
    status: MeetingStatus                   # gathering|round_1|round_2|round_3|synthesizing|complete|cancelled
    config: MeetingConfig
    participants: list[MeetingParticipant]
    current_round: int | None
    current_speaker: str | None
    created_at: int                         # Unix timestamp
    updated_at: int
    completed_at: int | None
    output_md: str | None                   # Final markdown (set on complete)
    duration_seconds: int | None
    total_tokens: int | None
```

### MeetingStatus (enum)

```python
class MeetingStatus(str, Enum):
    GATHERING = "gathering"
    ROUND_1 = "round_1"
    ROUND_2 = "round_2"
    ROUND_3 = "round_3"
    SYNTHESIZING = "synthesizing"
    COMPLETE = "complete"
    CANCELLED = "cancelled"
```

### MeetingParticipant

```python
class MeetingParticipant(BaseModel):
    agent_id: str
    agent_name: str
    model: str                              # sonnet, opus, gpt5
    role: str | None                        # user-visible role
```

### Turn

```python
class Turn(BaseModel):
    id: str
    meeting_id: str
    round_num: int                          # 0-indexed
    turn_num: int                           # Position within round
    agent_id: str
    agent_name: str
    content: str | None                     # Response text
    tokens_used: int | None
    status: TurnStatus                      # pending|speaking|complete|skipped|error
    started_at: int | None
    completed_at: int | None
    error: str | None
```

---

## Endpoint Details

### POST `/api/meetings/start`

Start a new stand-up meeting.

**Request:**
```json
{
  "topic": "Plan authentication system for mobile app",
  "participants": ["main", "dev", "flowy", "creator"],
  "num_rounds": 3,
  "synthesizer_id": "main",
  "template": null,
  "max_response_tokens": 150
}
```

**Response: `201 Created`**
```json
{
  "id": "mtg_a1b2c3d4",
  "topic": "Plan authentication system for mobile app",
  "status": "gathering",
  "config": { ... },
  "participants": [
    {"agent_id": "main", "agent_name": "Main", "model": "sonnet", "role": "Coordinator"},
    {"agent_id": "dev", "agent_name": "Dev", "model": "opus", "role": "Developer"}
  ],
  "current_round": null,
  "current_speaker": null,
  "created_at": 1739270400,
  "updated_at": 1739270400,
  "stream_url": "/api/meetings/mtg_a1b2c3d4/stream"
}
```

**Errors:**
- `400` — Invalid config (< 2 participants, rounds out of range)
- `409` — Meeting already in progress
- `503` — Gateway not connected

---

### GET `/api/meetings/{id}/status`

**Response: `200 OK`**
```json
{
  "id": "mtg_a1b2c3d4",
  "status": "round_2",
  "current_round": 1,
  "current_speaker": "flowy",
  "progress": {
    "total_turns": 12,
    "completed_turns": 6,
    "percentage": 50
  },
  "turns": [
    {
      "round_num": 0,
      "agent_name": "Main",
      "status": "complete",
      "content": "I think we should use OAuth2..."
    },
    ...
  ],
  "estimated_remaining_seconds": 120
}
```

---

### POST `/api/meetings/{id}/cancel`

Cancel a running meeting. Returns partial results if any turns completed.

**Response: `200 OK`**
```json
{
  "id": "mtg_a1b2c3d4",
  "status": "cancelled",
  "completed_turns": 6,
  "partial_output_md": "# Partial Stand-Up Notes\n..."
}
```

---

### GET `/api/meetings/{id}/stream`

Server-Sent Events stream for real-time meeting updates. Connects to existing SSE infrastructure in `routes/sse.py`.

**Headers:**
```
Accept: text/event-stream
Cache-Control: no-cache
```

**Events:**

#### `meeting_started`
```
event: meeting_started
data: {"meeting_id": "mtg_a1b2c3d4", "topic": "Auth planning", "participants": ["Main", "Dev", "Flowy", "Creator"]}
```

#### `gathering_complete`
```
event: gathering_complete
data: {"meeting_id": "mtg_a1b2c3d4"}
```

#### `round_started`
```
event: round_started
data: {"meeting_id": "mtg_a1b2c3d4", "round": 1, "total_rounds": 3}
```

#### `bot_speaking`
```
event: bot_speaking
data: {"meeting_id": "mtg_a1b2c3d4", "agent_id": "main", "agent_name": "Main", "round": 1, "turn": 0}
```

#### `bot_token`
Streamed tokens for live speech bubble:
```
event: bot_token
data: {"meeting_id": "mtg_a1b2c3d4", "agent_id": "main", "token": "I think"}
```

#### `bot_complete`
```
event: bot_complete
data: {"meeting_id": "mtg_a1b2c3d4", "agent_id": "main", "round": 1, "content": "I think we should use OAuth2 with JWT tokens for stateless auth...", "tokens_used": 87}
```

#### `bot_error`
```
event: bot_error
data: {"meeting_id": "mtg_a1b2c3d4", "agent_id": "dev", "round": 2, "error": "timeout", "message": "Dev did not respond within 30s"}
```

#### `round_complete`
```
event: round_complete
data: {"meeting_id": "mtg_a1b2c3d4", "round": 1, "summary": "Round 1 complete. 4/4 bots contributed."}
```

#### `synthesizing`
```
event: synthesizing
data: {"meeting_id": "mtg_a1b2c3d4", "synthesizer": "Main"}
```

#### `meeting_complete`
```
event: meeting_complete
data: {"meeting_id": "mtg_a1b2c3d4", "output_md": "# Stand-Up Summary...", "duration_seconds": 263, "total_tokens": 3847}
```

#### `meeting_cancelled`
```
event: meeting_cancelled
data: {"meeting_id": "mtg_a1b2c3d4", "reason": "user_cancelled", "completed_turns": 6}
```

---

### GET `/api/meetings/{id}/output`

Get the final markdown output after meeting completes.

**Response: `200 OK`**
```json
{
  "meeting_id": "mtg_a1b2c3d4",
  "output_md": "# Stand-Up Summary: Auth System Planning\n...",
  "format": "markdown"
}
```

**Errors:**
- `404` — Meeting not found
- `425` — Meeting not yet complete

---

### GET `/api/meetings/history`

List past meetings with pagination.

**Query params:** `?limit=20&offset=0&status=complete`

**Response: `200 OK`**
```json
{
  "meetings": [
    {
      "id": "mtg_a1b2c3d4",
      "topic": "Auth system planning",
      "status": "complete",
      "participants": ["Main", "Dev", "Flowy", "Creator"],
      "created_at": 1739270400,
      "duration_seconds": 263
    }
  ],
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

---

## Backend Implementation Notes

### Router Registration

Add to `app/main.py`:
```python
from app.routes.meetings import router as meetings_router
app.include_router(meetings_router, prefix="/api/meetings", tags=["meetings"])
```

### SSE Integration

Reuse existing `routes/sse.py` broadcast infrastructure. Meeting events use the same `_sse_clients` pool with meeting-specific event types:

```python
from app.routes.sse import broadcast

# During meeting orchestration:
await broadcast("bot_speaking", {
    "meeting_id": meeting.id,
    "agent_id": "main",
    "agent_name": "Main",
    "round": 1,
    "turn": 0
})
```

### File Structure

```
backend/app/
├── routes/
│   └── meetings.py          # REST endpoints
├── services/
│   └── meetings/
│       ├── __init__.py
│       ├── orchestrator.py   # MeetingOrchestrator (state machine)
│       ├── round_robin.py    # RoundRobinEngine
│       ├── prompts.py        # Prompt templates
│       └── synthesizer.py    # Summary generation
└── db/
    └── meeting_models.py     # Pydantic models
```

### Gateway Communication

```python
# In orchestrator.py
async def execute_turn(self, turn: Turn) -> str:
    """Send prompt to agent via gateway, return response."""
    prompt = self.build_prompt(turn)

    # Use existing gateway service
    response = await self.gateway.send_to_agent(
        agent_id=turn.agent_id,
        message=prompt,
        max_tokens=self.config.max_response_tokens,
        stream_callback=lambda token: self.on_token(turn, token)
    )

    return response.content
```
