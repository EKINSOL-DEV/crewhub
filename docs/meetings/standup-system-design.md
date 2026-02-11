# Stand-Up Meeting System Design

> CrewHub HQ — Multi-Agent Stand-Up Meetings
> Version: 1.0 | Date: 2026-02-11

## Overview

Stand-up meetings allow CrewHub agents to collaboratively discuss a topic using a round-robin algorithm with cumulative context. The user initiates a meeting, selects participants, and receives a polished markdown summary with goals, action items, and decisions.

**Key constraint:** ~5 minutes wall-clock → polished `plan.md` output.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Frontend (React + Three.js)        │
│  ┌─────────┐  ┌──────────┐  ┌───────────────────┐   │
│  │ Meeting  │  │ 3D Scene │  │ SSE Event         │   │
│  │ Dialog   │  │ Avatars  │  │ Consumer          │   │
│  └────┬─────┘  └────┬─────┘  └────┬──────────────┘   │
│       │              │              │                  │
└───────┼──────────────┼──────────────┼──────────────────┘
        │ REST         │ state        │ SSE
        ▼              ▼              ▼
┌──────────────────────────────────────────────────────┐
│              FastAPI Backend (:8091)                   │
│  ┌──────────────────────────────────────────────┐    │
│  │           MeetingOrchestrator                 │    │
│  │  ┌────────────┐  ┌─────────────────────────┐ │    │
│  │  │ State      │  │ Round-Robin Engine       │ │    │
│  │  │ Machine    │  │ (context accumulator)    │ │    │
│  │  └────────────┘  └─────────────────────────┘ │    │
│  └──────────────────────┬───────────────────────┘    │
│                         │                             │
│  ┌──────────┐  ┌───────┴────────┐  ┌─────────────┐  │
│  │ SSE      │  │ Gateway Client │  │ SQLite DB    │  │
│  │ Broadcast│  │ (OpenClaw WS)  │  │ (meetings)   │  │
│  └──────────┘  └────────────────┘  └─────────────┘  │
└──────────────────────────────────────────────────────┘
        │
        ▼ WebSocket
┌──────────────────────┐
│  OpenClaw Gateway    │
│  (:18789)            │
│  ┌────┐ ┌────┐      │
│  │Main│ │Dev │ ...   │
│  └────┘ └────┘      │
└──────────────────────┘
```

## State Machine

```
                    ┌─────────┐
          start()   │IDLE     │
         ┌─────────►│(no mtg) │
         │          └────┬────┘
         │               │ POST /api/meetings/start
         │               ▼
         │          ┌─────────┐
         │          │GATHERING│  Bots walk to table (3-5s)
         │          └────┬────┘
         │               │ all bots positioned
         │               ▼
         │          ┌─────────┐
    cancel()        │ROUND_1  │  Each bot speaks in order
    at any ──────►  ├─────────┤
    point           │ROUND_2  │  Cumulative context grows
         │          ├─────────┤
         │          │ROUND_3  │  Final perspectives
         │          └────┬────┘
         │               │ all rounds complete
         │               ▼
         │          ┌───────────┐
         │          │SYNTHESIZING│  Synthesizer bot creates summary
         │          └────┬──────┘
         │               │
         │               ▼
         │          ┌─────────┐
         └──────────│COMPLETE │  Output: plan.md
                    └─────────┘
```

### State Transitions

| From | To | Trigger |
|------|-----|---------|
| IDLE | GATHERING | `POST /meetings/start` |
| GATHERING | ROUND_1 | Animation complete (or timeout 5s) |
| ROUND_N | ROUND_N+1 | All bots in round have spoken |
| ROUND_N (last) | SYNTHESIZING | Final round complete |
| SYNTHESIZING | COMPLETE | Summary generated |
| Any | CANCELLED | `POST /meetings/{id}/cancel` |

## Round-Robin Algorithm

### Turn Order

Each round iterates through selected bots in a fixed order. The order is determined at meeting start and stays consistent across rounds.

```python
class RoundRobinEngine:
    def __init__(self, participants: list[str], num_rounds: int):
        self.participants = participants
        self.num_rounds = num_rounds
        self.current_round = 0
        self.current_turn = 0
        self.context = []  # cumulative conversation

    def next_turn(self) -> tuple[str, int, int] | None:
        """Returns (bot_id, round_num, turn_num) or None if complete."""
        if self.current_round >= self.num_rounds:
            return None
        bot = self.participants[self.current_turn]
        result = (bot, self.current_round, self.current_turn)
        self.current_turn += 1
        if self.current_turn >= len(self.participants):
            self.current_turn = 0
            self.current_round += 1
        return result
```

### Context Passing Strategy

Each bot receives a growing context window containing all previous contributions:

```
Round 1, Bot 1 (Main):
  System: "You are Main (Sonnet). Topic: {topic}. You speak first. Share your perspective."
  → Output: "I think we should..."

Round 1, Bot 2 (Dev):
  System: "You are Dev (Opus). Topic: {topic}."
  Context: [Main said: "I think we should..."]
  → Output: "Building on Main's point..."

Round 2, Bot 1 (Main):
  System: "You are Main. This is round 2. Build on the discussion."
  Context: [All Round 1 contributions]
  → Output: "After hearing everyone..."
```

**Prompt template per turn:**

```
You are {agent_name}, participating in a stand-up meeting.
Topic: {topic}
Round: {round_num}/{total_rounds}

Previous discussion:
{cumulative_context}

Provide a concise contribution (2-4 sentences). Focus on:
- Round 1: Your initial perspective on the topic
- Round 2: Build on others' points, identify agreements/disagreements
- Round 3: Propose concrete action items and decisions

Respond in character. Be concise.
```

### Synthesis Prompt

After all rounds, a designated synthesizer (first participant or user-chosen) generates the final output:

```
You are the meeting synthesizer. Compile the following stand-up discussion into a clean summary.

Topic: {topic}
Participants: {participant_list}
Full Discussion:
{all_contributions}

Output format:
# Stand-Up Summary: {topic}
**Date:** {date}
**Participants:** {names}

## Goal
{one sentence}

## Discussion Summary
{key points from each round}

## Action Items
- [ ] {action} — @{owner}

## Decisions
- {decision 1}
- {decision 2}
```

## Gateway Integration

The backend communicates with agents through the existing OpenClaw Gateway WebSocket connection at `ws://localhost:18789`.

**Message flow per turn:**

1. Backend constructs prompt with cumulative context
2. Sends to Gateway targeting specific agent session
3. Streams response tokens back via Gateway
4. Appends completed response to context accumulator
5. Broadcasts SSE event to frontend

**Connection reuse:** Uses existing `services/gateway.py` WebSocket client. No new connections needed.

## Token Cost Analysis

### Per-Turn Token Breakdown

| Component | Tokens (approx) |
|-----------|-----------------|
| System prompt | ~150 |
| Topic + instructions | ~50 |
| Cumulative context (avg) | ~200 |
| Bot response (target) | ~80 |
| **Total per turn** | **~480** |

### Full Meeting Cost (5 bots, 3 rounds)

```
Turns: 5 bots × 3 rounds = 15 turns
Context growth: starts ~0, ends ~1200 tokens

Early turns (round 1):  ~250 tokens each × 5 = 1,250
Mid turns (round 2):    ~450 tokens each × 5 = 2,250
Late turns (round 3):   ~650 tokens each × 5 = 3,250
Synthesis turn:          ~800 input + ~300 output = 1,100

Total input tokens:  ~6,750
Total output tokens: ~1,500 (15×80 + 300 synthesis)
────────────────────────────
Estimated total:     ~8,250 tokens

At Sonnet pricing ($3/1M input, $15/1M output):
  Input:  $0.020
  Output: $0.023
  Total:  ~$0.04 per meeting
```

**With mixed models (Opus for Dev):** ~$0.08-0.12 per meeting.

### Optimization Strategies

1. **Context compression:** Summarize earlier rounds instead of passing verbatim
2. **Parallel turns:** Within a round, bots that don't need each other's input could run in parallel (breaks round-robin purity but saves time)
3. **Response length cap:** Enforce max 100 tokens per response via `max_tokens`
4. **Smart truncation:** Only pass last 2 rounds of context if context exceeds 1000 tokens

## Data Model

```sql
CREATE TABLE meetings (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'gathering',
    config_json TEXT NOT NULL,      -- MeetingConfig as JSON
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER,
    output_md TEXT                   -- Final markdown output
);

CREATE TABLE meeting_turns (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL REFERENCES meetings(id),
    round_num INTEGER NOT NULL,
    turn_num INTEGER NOT NULL,
    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    content TEXT,                    -- Bot's contribution
    tokens_used INTEGER,
    started_at INTEGER,
    completed_at INTEGER,
    status TEXT DEFAULT 'pending'    -- pending, speaking, complete, error
);
```

## Error Handling

| Error | Strategy |
|-------|----------|
| Bot timeout (>30s) | Skip turn, note in summary: "{bot} did not respond" |
| Gateway disconnect | Retry once, then pause meeting with resume option |
| All bots fail in round | End meeting early, synthesize with available data |
| User cancels | Set CANCELLED, return partial results if any |

## Performance Targets

| Metric | Target |
|--------|--------|
| Total meeting time | < 5 minutes (3 rounds, 5 bots) |
| Per-turn latency | < 15 seconds |
| Time to first SSE event | < 2 seconds after start |
| Gathering animation | 3-5 seconds |
