# Stand-Up Meetings — API Specification

> CrewHub HQ Feature · February 2026

## Base URL

```
http://localhost:8091/api/meetings
```

---

## Endpoints

### POST `/api/meetings/start`

Start a new stand-up meeting.

**Request Body:**

```json
{
  "topic": "Sprint review & blockers",
  "bots": ["main", "dev", "flowy", "creator", "reviewer"],
  "rounds": 3,
  "project": "CrewHub"
}
```

**Response: `201 Created`**

```json
{
  "id": "mtg_a1b2c3d4",
  "topic": "Sprint review & blockers",
  "state": "GATHERING",
  "bots": ["main", "dev", "flowy", "creator", "reviewer"],
  "rounds": 3,
  "project": "CrewHub",
  "created_at": "2026-02-10T10:45:00Z",
  "stream_url": "/api/meetings/mtg_a1b2c3d4/stream"
}
```

**Errors:**

| Status | Reason |
|--------|--------|
| 400 | Missing topic or empty bots list |
| 409 | Another meeting already in progress |
| 422 | Invalid bot ID or rounds out of range (1-5) |

---

### GET `/api/meetings/{id}/status`

Get current meeting state.

**Response: `200 OK`**

```json
{
  "id": "mtg_a1b2c3d4",
  "topic": "Sprint review & blockers",
  "state": "ROUND_2",
  "bots": ["main", "dev", "flowy", "creator", "reviewer"],
  "rounds": 3,
  "current_round": 2,
  "current_bot": "flowy",
  "turns_completed": 7,
  "turns_total": 15,
  "progress": 0.47,
  "created_at": "2026-02-10T10:45:00Z",
  "output": null
}
```

When state is `COMPLETE`:

```json
{
  "state": "COMPLETE",
  "progress": 1.0,
  "output": "# Stand-Up Meeting — 2026-02-10\n...",
  "output_path": "/mnt/project-data/CrewHub/meetings/2026-02-10-standup.md",
  "completed_at": "2026-02-10T10:48:30Z"
}
```

**Errors:**

| Status | Reason |
|--------|--------|
| 404 | Meeting not found |

---

### POST `/api/meetings/{id}/cancel`

Cancel a running meeting.

**Response: `200 OK`**

```json
{
  "id": "mtg_a1b2c3d4",
  "state": "CANCELLED",
  "turns_completed": 7,
  "partial_output": "# Partial Stand-Up — 2026-02-10\n..."
}
```

**Errors:**

| Status | Reason |
|--------|--------|
| 404 | Meeting not found |
| 409 | Meeting already completed or cancelled |

---

### GET `/api/meetings/{id}/stream` (SSE)

Server-Sent Events stream for real-time meeting updates.

**Headers:**

```
Accept: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**SSE Events:**

---

#### `bot_gathering`

Emitted when meeting starts and bots begin walking to table.

```
event: bot_gathering
data: {"meeting_id": "mtg_a1b2c3d4", "bots": ["main", "dev", "flowy", "creator", "reviewer"]}
```

#### `turn_start`

A bot begins their turn.

```
event: turn_start
data: {"meeting_id": "mtg_a1b2c3d4", "round": 1, "bot": "dev", "bot_name": "Dev", "turn_index": 1}
```

#### `turn_chunk`

Streaming text chunk from the active bot (for live speech bubbles).

```
event: turn_chunk
data: {"meeting_id": "mtg_a1b2c3d4", "bot": "dev", "chunk": "I think we should"}
```

#### `turn_complete`

A bot finishes their turn.

```
event: turn_complete
data: {"meeting_id": "mtg_a1b2c3d4", "round": 1, "bot": "dev", "content": "I think we should focus on...", "turn_index": 1, "progress": 0.13}
```

#### `round_complete`

All bots completed a round.

```
event: round_complete
data: {"meeting_id": "mtg_a1b2c3d4", "round": 1, "turns": 5, "progress": 0.33}
```

#### `synthesizing`

Synthesis phase started.

```
event: synthesizing
data: {"meeting_id": "mtg_a1b2c3d4"}
```

#### `meeting_complete`

Meeting finished with output.

```
event: meeting_complete
data: {"meeting_id": "mtg_a1b2c3d4", "output": "# Stand-Up Meeting...", "output_path": "...", "duration_seconds": 210}
```

#### `meeting_error`

An error occurred (bot timeout, etc). Meeting may continue.

```
event: meeting_error
data: {"meeting_id": "mtg_a1b2c3d4", "error": "Bot 'dev' timed out in round 2", "fatal": false}
```

#### `meeting_cancelled`

Meeting was cancelled.

```
event: meeting_cancelled
data: {"meeting_id": "mtg_a1b2c3d4", "partial_output": "..."}
```

---

## Data Models

### MeetingConfig

```typescript
interface MeetingConfig {
  topic: string;            // Meeting topic/agenda
  bots: string[];           // Bot IDs to participate
  rounds: number;           // 1-5, default 3
  project: string;          // Project name for output path
}
```

### Meeting

```typescript
interface Meeting {
  id: string;               // "mtg_" + nanoid(8)
  topic: string;
  state: MeetingState;
  bots: string[];
  rounds: number;
  project: string;
  current_round: number | null;
  current_bot: string | null;
  turns: Turn[];
  output: string | null;
  output_path: string | null;
  created_at: string;       // ISO 8601
  completed_at: string | null;
}

type MeetingState =
  | "CREATED"
  | "GATHERING"
  | "ROUND_1" | "ROUND_2" | "ROUND_3" | "ROUND_4" | "ROUND_5"
  | "SYNTHESIZING"
  | "COMPLETE"
  | "CANCELLED"
  | "FAILED";
```

### Round

```typescript
interface Round {
  number: number;           // 1-based
  turns: Turn[];
  completed_at: string | null;
}
```

### Turn

```typescript
interface Turn {
  bot: string;              // Bot ID
  bot_name: string;         // Display name
  round: number;
  content: string;          // Bot's response text
  tokens_used: number;      // Actual token count
  duration_ms: number;      // Response time
  skipped: boolean;         // True if bot timed out
  timestamp: string;        // ISO 8601
}
```

---

## Frontend Integration

### React Hook

```typescript
function useMeetingStream(meetingId: string) {
  const [state, setState] = useState<Meeting | null>(null);
  const [activeChunk, setActiveChunk] = useState<string>("");

  useEffect(() => {
    const es = new EventSource(`/api/meetings/${meetingId}/stream`);

    es.addEventListener("turn_start", (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({ ...prev, current_bot: data.bot, state: `ROUND_${data.round}` }));
      setActiveChunk("");
    });

    es.addEventListener("turn_chunk", (e) => {
      const data = JSON.parse(e.data);
      setActiveChunk(prev => prev + data.chunk);
    });

    es.addEventListener("turn_complete", (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({
        ...prev,
        turns: [...(prev?.turns || []), data],
        progress: data.progress,
      }));
    });

    es.addEventListener("meeting_complete", (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({ ...prev, state: "COMPLETE", output: data.output }));
      es.close();
    });

    return () => es.close();
  }, [meetingId]);

  return { meeting: state, activeChunk };
}
```

---

## Rate Limits & Constraints

| Constraint | Value |
|------------|-------|
| Max concurrent meetings | 1 |
| Max rounds | 5 |
| Max bots per meeting | 5 |
| Bot turn timeout | 30 seconds |
| Meeting total timeout | 10 minutes |
| Max topic length | 500 characters |
