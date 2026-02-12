# Stand-Up Meetings — API Specification

> CrewHub HQ Feature · v1.0 · 2026-02-12

---

## 1. REST Endpoints

Base path: `/api/meetings`

### POST /api/meetings/start

Start a new stand-up meeting. Returns immediately; orchestration runs asynchronously.

**Request Body:**
```json
{
  "title": "Daily Standup",
  "goal": "Sync on CrewHub development progress",
  "room_id": "hq",
  "project_id": "proj_abc123",
  "participants": ["agent_dev", "agent_design", "agent_planner", "agent_qa"],
  "num_rounds": 3,
  "round_topics": [
    "What have you been working on?",
    "What will you focus on next?",
    "Any blockers or concerns?"
  ],
  "max_tokens_per_turn": 200
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `title` | string | No | `"Daily Standup"` | Display title |
| `goal` | string | No | `""` | Meeting goal/context for bots |
| `room_id` | string | No | `null` | Room where meeting happens |
| `project_id` | string | No | `null` | Associated project (for file output path) |
| `participants` | string[] | **Yes** | — | Agent IDs, in speaking order. Min 2. |
| `num_rounds` | int | No | `3` | Number of rounds (1-5) |
| `round_topics` | string[] | No | See defaults | Topic per round. Length must match `num_rounds`. |
| `max_tokens_per_turn` | int | No | `200` | Max response tokens per bot per turn |

**Response: `201 Created`**
```json
{
  "id": "mtg_7f3a2b1c",
  "title": "Daily Standup",
  "state": "gathering",
  "participants": [
    {"agent_id": "agent_dev", "name": "DevBot", "sort_order": 0},
    {"agent_id": "agent_design", "name": "DesignBot", "sort_order": 1},
    {"agent_id": "agent_planner", "name": "PlannerBot", "sort_order": 2},
    {"agent_id": "agent_qa", "name": "QABot", "sort_order": 3}
  ],
  "config": {
    "num_rounds": 3,
    "round_topics": ["What have you been working on?", "What will you focus on next?", "Any blockers or concerns?"],
    "max_tokens_per_turn": 200
  },
  "created_at": 1739353200000
}
```

**Errors:**
| Code | Condition |
|------|-----------|
| `400` | Fewer than 2 participants |
| `400` | `round_topics` length ≠ `num_rounds` |
| `404` | Unknown agent ID in participants |
| `409` | Meeting already in progress in this room |

---

### GET /api/meetings/{id}/status

Get current state and progress of a meeting.

**Response: `200 OK`**
```json
{
  "id": "mtg_7f3a2b1c",
  "title": "Daily Standup",
  "state": "round_2",
  "current_round": 2,
  "current_turn": 1,
  "total_rounds": 3,
  "total_participants": 4,
  "progress_pct": 45,
  "participants": [
    {"agent_id": "agent_dev", "name": "DevBot", "sort_order": 0},
    {"agent_id": "agent_design", "name": "DesignBot", "sort_order": 1},
    {"agent_id": "agent_planner", "name": "PlannerBot", "sort_order": 2},
    {"agent_id": "agent_qa", "name": "QABot", "sort_order": 3}
  ],
  "rounds": [
    {
      "round_num": 1,
      "topic": "What have you been working on?",
      "status": "complete",
      "turns": [
        {
          "agent_id": "agent_dev",
          "agent_name": "DevBot",
          "response": "I've been refactoring the auth middleware...",
          "started_at": 1739353205000,
          "completed_at": 1739353212000
        },
        {
          "agent_id": "agent_design",
          "agent_name": "DesignBot",
          "response": "Completed the dark mode palette...",
          "started_at": 1739353212000,
          "completed_at": 1739353219000
        }
      ]
    },
    {
      "round_num": 2,
      "topic": "What will you focus on next?",
      "status": "in_progress",
      "turns": [
        {
          "agent_id": "agent_dev",
          "agent_name": "DevBot",
          "response": "I'll finish the auth refactor...",
          "started_at": 1739353225000,
          "completed_at": 1739353231000
        }
      ]
    }
  ],
  "output_md": null,
  "output_path": null,
  "started_at": 1739353200000,
  "completed_at": null
}
```

**Progress Calculation:**
```
progress_pct = (completed_turns / total_turns) * 90 + (synthesis_done ? 10 : 0)
total_turns = num_participants × num_rounds
```

The last 10% is reserved for the synthesis step.

**Errors:**
| Code | Condition |
|------|-----------|
| `404` | Meeting not found |

---

### POST /api/meetings/{id}/cancel

Cancel a running meeting.

**Response: `200 OK`**
```json
{
  "id": "mtg_7f3a2b1c",
  "state": "cancelled",
  "cancelled_at": 1739353240000
}
```

**Errors:**
| Code | Condition |
|------|-----------|
| `404` | Meeting not found |
| `409` | Meeting already completed or cancelled |

---

### GET /api/meetings

List recent meetings.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `days` | int | `30` | How many days back to look |
| `room_id` | string | `null` | Filter by room |
| `project_id` | string | `null` | Filter by project |
| `limit` | int | `20` | Max results |

**Response: `200 OK`**
```json
{
  "meetings": [
    {
      "id": "mtg_7f3a2b1c",
      "title": "Daily Standup",
      "state": "complete",
      "participant_count": 4,
      "project_id": "proj_abc123",
      "project_name": "CrewHub",
      "output_path": "CrewHub/meetings/2026-02-12-standup.md",
      "created_at": 1739353200000,
      "completed_at": 1739353280000
    }
  ]
}
```

---

### GET /api/meetings/{id}/output

Get the final meeting output (markdown).

**Response: `200 OK`**
```json
{
  "id": "mtg_7f3a2b1c",
  "output_md": "# Stand-Up Meeting — 2026-02-12\n\n## Goal\n...",
  "output_path": "/Users/ekinbot/SynologyDrive/ekinbot/01-Projects/CrewHub/meetings/2026-02-12-standup.md"
}
```

**Errors:**
| Code | Condition |
|------|-----------|
| `404` | Meeting not found |
| `409` | Meeting not yet complete |

---

## 2. SSE Events

All meeting events are broadcast through the existing SSE endpoint at `/api/sse` using the `broadcast()` function.

### Event Types

#### `meeting-started`
Fired when meeting transitions from initial state to GATHERING.

```json
{
  "meeting_id": "mtg_7f3a2b1c",
  "title": "Daily Standup",
  "state": "gathering",
  "participants": ["agent_dev", "agent_design", "agent_planner", "agent_qa"]
}
```

#### `meeting-state`
Fired on every state transition.

```json
{
  "meeting_id": "mtg_7f3a2b1c",
  "state": "round_2",
  "previous_state": "round_1",
  "current_round": 2,
  "round_topic": "What will you focus on next?",
  "progress_pct": 35
}
```

#### `meeting-turn-start`
Fired when a bot begins generating its response.

```json
{
  "meeting_id": "mtg_7f3a2b1c",
  "round": 2,
  "agent_id": "agent_design",
  "agent_name": "DesignBot",
  "turn_index": 1,
  "total_turns": 4
}
```

#### `meeting-turn`
Fired when a bot completes its turn.

```json
{
  "meeting_id": "mtg_7f3a2b1c",
  "round": 2,
  "agent_id": "agent_design",
  "agent_name": "DesignBot",
  "response": "Building on what Dev said about auth, I'll update the login flow mockups...",
  "turn_index": 1,
  "total_turns": 4,
  "progress_pct": 42
}
```

#### `meeting-synthesis`
Fired when synthesis begins.

```json
{
  "meeting_id": "mtg_7f3a2b1c",
  "state": "synthesizing",
  "progress_pct": 90
}
```

#### `meeting-complete`
Fired when meeting is fully complete and output is saved.

```json
{
  "meeting_id": "mtg_7f3a2b1c",
  "state": "complete",
  "output_path": "CrewHub/meetings/2026-02-12-standup.md",
  "progress_pct": 100,
  "duration_seconds": 82,
  "total_tokens": 3650
}
```

#### `meeting-error`
Fired on unrecoverable errors.

```json
{
  "meeting_id": "mtg_7f3a2b1c",
  "state": "error",
  "error": "Gateway connection lost after 60s retry",
  "last_completed_round": 1
}
```

#### `meeting-cancelled`
Fired when user cancels.

```json
{
  "meeting_id": "mtg_7f3a2b1c",
  "state": "cancelled",
  "cancelled_at": 1739353240000
}
```

---

## 3. Data Models

### Meeting

```python
class Meeting(BaseModel):
    id: str
    title: str
    goal: str
    state: MeetingState
    room_id: Optional[str]
    project_id: Optional[str]
    config: MeetingConfig
    current_round: int = 0
    current_turn: int = 0
    output_md: Optional[str] = None
    output_path: Optional[str] = None
    error_message: Optional[str] = None
    created_by: str = "user"
    started_at: Optional[int] = None
    completed_at: Optional[int] = None
    cancelled_at: Optional[int] = None
    created_at: int
```

### MeetingConfig

```python
class MeetingConfig(BaseModel):
    participants: list[str]              # agent IDs in speaking order
    num_rounds: int = 3                  # 1-5
    round_topics: list[str] = [
        "What have you been working on?",
        "What will you focus on next?",
        "Any blockers, risks, or things you need help with?",
    ]
    max_tokens_per_turn: int = 200
    synthesis_max_tokens: int = 500
```

### MeetingState

```python
class MeetingState(str, Enum):
    GATHERING = "gathering"
    ROUND_1 = "round_1"
    ROUND_2 = "round_2"
    ROUND_3 = "round_3"
    ROUND_4 = "round_4"       # optional
    ROUND_5 = "round_5"       # optional
    SYNTHESIZING = "synthesizing"
    COMPLETE = "complete"
    CANCELLED = "cancelled"
    ERROR = "error"
```

### Round

```python
class Round(BaseModel):
    round_num: int
    topic: str
    status: Literal["pending", "in_progress", "complete", "skipped"]
    turns: list[Turn] = []
```

### Turn

```python
class Turn(BaseModel):
    id: str
    meeting_id: str
    round_num: int
    turn_index: int
    agent_id: str
    agent_name: str
    response: Optional[str] = None
    prompt_tokens: Optional[int] = None
    response_tokens: Optional[int] = None
    started_at: Optional[int] = None
    completed_at: Optional[int] = None
```

### MeetingParticipant

```python
class MeetingParticipant(BaseModel):
    meeting_id: str
    agent_id: str
    agent_name: str
    agent_icon: Optional[str] = None
    agent_color: Optional[str] = None
    sort_order: int = 0
```

---

## 4. Integration Points

### Existing SSE Infrastructure
Uses the existing `broadcast()` from `app/routes/sse.py`:
```python
from app.routes.sse import broadcast
await broadcast("meeting-turn", {...})
```

### Existing Database Pattern
Uses `get_db()` from `app/db/database.py` for SQLite access.

### Existing Agent/Room System
- Participants reference agents from the `agents` table
- Room ID references the `rooms` table
- Project ID references the `projects` table

### Gateway Connections
Bot responses routed through `ConnectionManager` from `app/services/connections/`.

---

## 5. Rate Limits & Constraints

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Max concurrent meetings per room | 1 | Avoid confusion |
| Max concurrent meetings globally | 3 | Token budget control |
| Max participants per meeting | 8 | Context window limits |
| Min participants per meeting | 2 | Need a conversation |
| Max rounds | 5 | Diminishing returns |
| Max tokens per turn | 500 | Keep responses focused |
| Meeting timeout | 10 minutes | Safety net for stuck meetings |
