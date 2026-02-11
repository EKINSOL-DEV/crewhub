# Stand-Up Meetings — System Design

> CrewHub HQ Feature · February 2026

## Overview

Multi-agent round-robin meetings where CrewHub bots collaborate on a topic through structured rounds. Each bot contributes sequentially, building on all previous responses, culminating in a synthesized summary.

## State Machine

```
┌────────────┐
│  CREATED    │ ← Meeting config saved
└─────┬──────┘
      │ POST /api/meetings/start
      ▼
┌────────────┐
│ GATHERING   │ ← Bots walk to table (3D animation)
└─────┬──────┘
      │ All bots arrived / timeout (5s)
      ▼
┌────────────┐
│  ROUND_1    │ ← Each bot speaks once (round-robin)
└─────┬──────┘
      │ All bots completed turn
      ▼
┌────────────┐
│  ROUND_2    │ ← Second pass, informed by Round 1
└─────┬──────┘
      │
      ▼
┌────────────┐
│  ROUND_3    │ ← Final refinement round
└─────┬──────┘
      │
      ▼
┌────────────┐
│SYNTHESIZING │ ← Designated bot (or system) creates summary
└─────┬──────┘
      │
      ▼
┌────────────┐
│  COMPLETE   │ ← Output saved, meeting archived
└────────────┘

Possible at any state:
  ──→ CANCELLED (via POST /cancel)
  ──→ FAILED (on unrecoverable error)
```

## Round-Robin Algorithm

```python
async def run_meeting(meeting: Meeting):
    meeting.state = "GATHERING"
    emit_sse("bot_gathering", meeting)
    await gather_bots(meeting.bots)  # 3D animation trigger

    for round_num in range(1, meeting.config.rounds + 1):
        meeting.state = f"ROUND_{round_num}"
        round = Round(number=round_num, turns=[])

        for bot in meeting.bots:
            emit_sse("turn_start", {"bot": bot.id, "round": round_num})

            # Cumulative context: topic + all previous turns
            context = build_context(meeting.topic, meeting.turns_so_far)
            prompt = build_round_prompt(bot, round_num, context)

            response = await sessions_send(bot.session_id, prompt)
            turn = Turn(bot=bot.id, round=round_num, content=response)

            round.turns.append(turn)
            meeting.turns_so_far.append(turn)
            emit_sse("turn_complete", turn)

        emit_sse("round_complete", {"round": round_num})

    # Synthesis
    meeting.state = "SYNTHESIZING"
    emit_sse("synthesizing", {})
    summary = await synthesize(meeting)

    meeting.state = "COMPLETE"
    meeting.output = summary
    save_meeting_output(meeting)
    emit_sse("meeting_complete", {"output": summary})
```

## Context Passing Strategy — Cumulative

Each bot sees **all previous outputs** when it's their turn:

| Turn | Bot sees |
|------|----------|
| R1-Bot1 | Topic only |
| R1-Bot2 | Topic + R1-Bot1 output |
| R1-Bot3 | Topic + R1-Bot1 + R1-Bot2 |
| R2-Bot1 | Topic + all R1 outputs |
| R2-Bot2 | Topic + all R1 + R2-Bot1 |
| ... | Cumulative |

**Prompt template per turn:**

```
You are {bot.name} ({bot.role}) in a stand-up meeting.
Topic: {meeting.topic}
Round {round_num} of {total_rounds}.

Previous contributions:
{formatted_previous_turns}

Your turn. Respond concisely (~200 tokens) from your role's perspective.
Focus on: {role_specific_guidance}
```

### Role-Specific Guidance

| Bot | Focus |
|-----|-------|
| **Main/Assistent** | Coordination, priorities, blockers |
| **Dev** | Technical feasibility, implementation details |
| **Flowy** | Workflow, automation, process improvements |
| **Creator** | Design, UX, creative solutions |
| **Reviewer** | Quality, risks, edge cases, improvements |

## Integration with CrewHub Session System

Meetings use CrewHub's existing `sessions_spawn` / `sessions_send`:

```python
# At meeting start — spawn a meeting orchestrator session
meeting_session = await sessions_spawn(
    agent="system",
    label=f"meeting-{meeting.id}",
    model="sonnet"  # Cost-efficient for coordination
)

# For each bot turn — send to bot's existing session
response = await sessions_send(
    session_id=bot.active_session_id,
    message=turn_prompt,
    timeout=30
)
```

**Key decisions:**
- Bots use their **existing sessions** (no new spawn per meeting)
- Meeting orchestrator is a lightweight system session
- If a bot fails to respond within 30s → skip turn, log warning
- All turns stored in `meetings` table for replay

## Token Cost Analysis

**Per meeting (5 bots × 3 rounds):**

| Component | Tokens |
|-----------|--------|
| Turn prompt (topic + context) | ~150 avg input |
| Turn response | ~200 output |
| Turns total (15) | ~5,250 (input+output combined) |
| Synthesis prompt | ~800 input (all turns) |
| Synthesis response | ~500 output |
| **Total** | **~3,500–4,000 tokens** |

**Cost at Sonnet rates (~$3/M input, $15/M output):**
- Input: ~2,500 tokens → $0.0075
- Output: ~3,500 tokens → $0.0525
- **~$0.06 per meeting** → negligible

**Scaling considerations:**
- Context grows linearly per round (cumulative)
- 3 rounds keeps context manageable (~2K tokens by R3)
- More than 5 rounds would push past 8K context → not recommended

## Data Model

```sql
CREATE TABLE meetings (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    config JSON NOT NULL,       -- MeetingConfig
    state TEXT DEFAULT 'CREATED',
    bots JSON NOT NULL,         -- List of bot IDs
    turns JSON DEFAULT '[]',    -- All Turn objects
    output TEXT,                 -- Final synthesis markdown
    project TEXT,                -- For output path
    created_at TIMESTAMP,
    completed_at TIMESTAMP
);
```

## Output Storage

Meeting results save to project data directory:

```
${PROJECT_DATA_PATH}/{project}/meetings/{date}-standup.md
```

Format:
```markdown
# Stand-Up Meeting — {date}
**Topic:** {topic}
**Participants:** {bot_names}
**Rounds:** {num_rounds}

## Round 1
### Dev
{content}
### Flowy
{content}
...

## Synthesis
{synthesis_content}
```

## Error Handling

| Scenario | Handling |
|----------|----------|
| Bot timeout (30s) | Skip turn, add "[skipped — timeout]" |
| Bot error | Skip turn, log error, continue |
| All bots fail in a round | Abort → FAILED state |
| SSE disconnect | Client reconnects, gets current state |
| Cancel during round | Finish current turn, then stop |

## Future Considerations

- **Parallel turns** — bots respond simultaneously per round (faster, no cumulative context)
- **Voting** — bots vote on proposals after rounds
- **Templates** — pre-configured meeting types (standup, brainstorm, review)
- **Guest bots** — temporary external agents join a meeting
