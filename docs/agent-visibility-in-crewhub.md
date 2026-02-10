# Agent Visibility in CrewHub: What You See vs. What You Don't

*Created: 2026-02-10*  
*Status: Architecture Documentation*  
*Related: Agent Identity Pattern, CrewHub Monitoring*

## The Question

> "I also assume that if I don't talk to them through crewhub they don't know what is going on? I have it a task from chat and it showed working but the logs when I click on the assistant show blank"  
> — TODinSort, Discord #dev

**Core Question:** When an agent works via chat (WhatsApp, Discord, etc.), what does CrewHub see? Why are logs sometimes "blank"?

## What CrewHub SEES

CrewHub monitors agents through OpenClaw's SSE (Server-Sent Events) stream. Here's what IS visible:

### ✅ Visible in CrewHub

| What | Where | How |
|------|-------|-----|
| **Tool Calls** | Logs tab, Activity Feed | OpenClaw emits `tool_call` events |
| **Status Changes** | 3D World, Agent Info | active/idle/sleeping state transitions |
| **Session Metadata** | Agent Info panel | Last message timestamp, token count, model |
| **Activity Events** | Activity Feed | When agents do things (exec, spawn, etc.) |
| **System Events** | Logs tab | Errors, warnings, gateway events |

**Example (Visible):**
```
Agent receives message via WhatsApp
  ↓
Agent calls exec("ls -la")  ← CrewHub SEES this
  ↓
Agent calls read("file.txt")  ← CrewHub SEES this
  ↓
Agent replies via WhatsApp
```

### ❌ NOT Visible in CrewHub

| What | Why Not | Impact |
|------|---------|--------|
| **Chat Messages** (incoming) | OpenClaw doesn't emit chat content as SSE events | Can't see what user asked |
| **Chat Messages** (outgoing) | Agent replies go directly to channel, not as events | Can't see what agent answered |
| **Thinking Blocks** | Internal reasoning not exposed as events (yet?) | Can't see agent's thought process |
| **Message Content** | Privacy/bandwidth — not everything is logged | Logs appear "blank" if no tool calls |

**Example (Invisible):**
```
User: "Hey, what's the weather?"  ← CrewHub DOESN'T see this
  ↓
Agent thinks: "User asked about weather. I should use weather tool."  ← CrewHub DOESN'T see this
  ↓
Agent calls weather_tool()  ← CrewHub SEES this ✓
  ↓
Agent: "It's 15°C in Brussels"  ← CrewHub DOESN'T see this
```

## Architecture: How Information Flows

### Current Flow (OpenClaw → CrewHub)

```
┌─────────────────────────────────────────────┐
│  WhatsApp/Discord/Chat                       │
│  ↓ (user message)                            │
│  OpenClaw Agent                               │
│  ├─ Receives message (not emitted as event) │
│  ├─ Thinks (not emitted as event)           │
│  ├─ Tool calls (emitted as SSE events) ✓    │
│  └─ Replies (not emitted as event)          │
└────────────┬────────────────────────────────┘
             │ SSE Stream (tool calls only)
             ↓
┌────────────────────────────────────────────┐
│  CrewHub Dashboard                          │
│  ├─ 3D World (bot status)                  │
│  ├─ Activity Feed (tool call events)       │
│  ├─ Logs Tab (tool calls + system events)  │
│  └─ Agent Chat Panel (recent messages?)    │
└────────────────────────────────────────────┘
```

### Why "Blank Logs" Happens

**Scenario 1: Pure Chat Work (No Tools)**
```
User: "Tell me a joke"
Agent: "Why did the chicken cross the road? To get to the other side!"
  → NO tool calls
  → CrewHub logs: BLANK (nothing to show)
```

**Scenario 2: Tool-Heavy Work**
```
User: "Check my tasks"
Agent:
  - exec("task list")  ← Visible in logs
  - read("tasks.json")  ← Visible in logs
  - Reply: "You have 3 tasks"
  → CrewHub logs: FULL (shows both tool calls)
```

**Conclusion:** If an agent does conversational work without tools, CrewHub has nothing to log. This is **expected behavior**, not a bug.

## Potential Solutions

### Option A: Chat Message Events (New Event Type)

**Proposal:** OpenClaw emits chat messages as SSE events.

```typescript
// New SSE event type
{
  type: 'chat_message',
  sessionKey: 'agent:main:main',
  direction: 'incoming' | 'outgoing',
  channel: 'whatsapp' | 'discord' | 'slack',
  message: 'Hey, can you help with X?',
  timestamp: 1707591234000
}
```

**Pros:**
- CrewHub shows full chat history
- "Blank logs" problem solved
- Better debugging (see what user asked)
- Agent Chat panel can display actual conversation

**Cons:**
- **Privacy risk:** Chat messages stored in CrewHub DB
- **Bandwidth overhead:** Many events, high SSE load
- **Not all messages relevant:** Monitoring != full chat transcript
- **Security:** Sensitive info in chat might leak to monitoring

**Verdict:** Probably **NOT worth it** for privacy/bandwidth reasons. Chat should stay in OpenClaw, monitoring in CrewHub.

### Option B: Thinking Block Events (Optional Debug Mode)

**Proposal:** OpenClaw optionally emits thinking blocks for debugging.

```typescript
{
  type: 'thinking',
  sessionKey: 'agent:main:main',
  content: 'User asked about X. I should check Y first...',
  timestamp: 1707591234000,
  tokens: 150  // thinking block token count
}
```

**Pros:**
- Helps debugging agent behavior
- Shows WHY agent chose certain tools
- Useful for training/improving prompts
- Can be toggled on/off (privacy control)

**Cons:**
- Still bandwidth overhead
- Thinking content might be verbose
- Not always useful for monitoring

**Verdict:** Could be useful as **opt-in debug mode** (e.g., "Enable verbose logging" checkbox in CrewHub settings).

### Option C: Activity Summary Events (Lightweight)

**Proposal:** Emit high-level summaries instead of full messages.

```typescript
{
  type: 'activity_summary',
  sessionKey: 'agent:main:main',
  summary: 'Processed user request: task management',
  toolsUsed: ['exec', 'read'],
  messageCount: 3,  // messages exchanged
  timestamp: 1707591234000
}
```

**Pros:**
- Shows activity without revealing content
- Low bandwidth
- Privacy-preserving (no message content)
- Good for monitoring "is agent active?"

**Cons:**
- Still doesn't show WHAT was said
- Generic summaries may not be helpful

**Verdict:** **Best middle-ground** — shows activity without privacy/bandwidth issues.

## Current Workaround: Use Tool Calls as Breadcrumbs

**Best Practice for Agents:**
If you want your work to be visible in CrewHub, make tool calls! Even if the tool call is just for logging:

```python
# Agent working on task
exec("echo 'Starting task analysis'")  # Breadcrumb for CrewHub
# ... do analysis ...
exec("echo 'Task analysis complete'")  # Another breadcrumb
```

This way, CrewHub sees the agent is working even if most work is internal reasoning.

## Agent Chat Panel: What SHOULD It Show?

**Current Status (Unclear):**
Does the Agent Chat panel in CrewHub show recent messages, or is it for sending NEW messages to the agent?

**If it shows history:**
- Where does it get the messages? (OpenClaw transcript API?)
- Why would it be blank if agent is active?

**If it's for NEW messages:**
- It's a way to chat WITH the agent from CrewHub
- Wouldn't show historical chat from WhatsApp/Discord

**Recommendation:**
Clarify Agent Chat panel purpose:
- **Option 1:** Read-only recent messages (pull from OpenClaw /sessions/:key/history)
- **Option 2:** Interactive chat (send messages to agent from CrewHub)
- **Option 3:** Both (show history + input box)

## Recommendations

### For TODinSort (User with "Blank Logs" Issue)

1. **Check if agent makes tool calls:**
   - If agent DOES make tool calls → they SHOULD appear in Logs tab
   - If agent does NOT make tool calls → logs will be blank (expected)

2. **Use Activity Feed:**
   - Shows high-level events, not just logs
   - May show status changes even without tool calls

3. **Check Agent Chat panel:**
   - If it shows messages, check if agent is sending them
   - If blank, might be a UI bug (not architecture issue)

4. **Debug Steps:**
   - Open browser DevTools → Network tab
   - Look for SSE connection to `/api/events`
   - Check if events are arriving when agent works
   - If events arrive but don't display → frontend bug
   - If no events → backend/OpenClaw integration issue

### For CrewHub Development (v0.14.0+)

1. **Document what's visible:**
   - Add "What CrewHub Can See" section to docs
   - Clarify Agent Chat panel purpose
   - Set user expectations (not full transcript)

2. **Consider Activity Summary events:**
   - Lightweight, privacy-preserving
   - Shows agent is working without revealing content
   - Helps with "blank logs" perception

3. **Optional: Verbose Debug Mode:**
   - Toggle in Settings: "Enable verbose agent logging"
   - When enabled, emit thinking blocks + message summaries
   - Default: OFF (privacy)

4. **Improve "No Activity" UI:**
   - If logs are blank, show helpful message:
     > "No tool calls or system events. Agent may be doing conversational work. Check Activity Feed for status changes."

## Related Discussions

- **Discord #dev, 2026-02-10:** TODinSort's "blank logs" issue
- **Agent Identity Pattern:** Single identity, multiple surfaces
- **CrewHub Monitoring Scope:** What is CrewHub meant to show?

## See Also

- `docs/agent-identity-pattern.md` - Agent identity across surfaces
- `docs/connection-architecture-review.md` - OpenClaw ↔ CrewHub integration
- CrewHub SSE manager (`sseManager.ts`) - Event stream handling

---

*This document clarifies what information flows from OpenClaw to CrewHub, and what remains private/local to the agent's chat sessions.*
