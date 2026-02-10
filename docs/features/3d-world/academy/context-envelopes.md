# Context Envelopes 📬

**What are they?** Automatic context packages that give agents all the information they need about where they are and what's happening.

**The Metaphor:** Think of it like mail delivery. When an agent enters a room or receives a task, they get a sealed envelope with their name on it. They open it, read the contents, and immediately know:
- Which room they're in
- What project they're working on
- Who else is in the room
- What tasks are active
- What changed since last time

No manual setup. No repeating yourself. The envelope just shows up.

---

## The Problem: Context Drift

Without automatic context, AI agents need to be told everything, every time:

```
You: "Agent, fix this bug in the authentication module."
Agent: "Which project?"
You: "CrewHub."
Agent: "Which room?"
You: "Dev Room."
Agent: "Who else is working on this?"
You: "Dev and Gamedev agents."
Agent: "What other tasks are active?"
You: *sighs and lists 10 tasks*
```

This is **context drift** — the gap between what the agent knows and what it *should* know. It's exhausting.

---

## The Solution: Automatic Envelopes

With context envelopes, the conversation becomes:

```
You: "Agent, fix this bug in the authentication module."
Agent: *opens envelope, reads room context*
Agent: "Got it. I see I'm in Dev Room working on CrewHub. Dev and Gamedev are here too, and we have 9 other active tasks. I'll tackle this one and coordinate with the team if needed."
```

The agent already knows. You didn't have to say a word.

---

## What's Inside an Envelope?

Every context envelope contains:

### 🏠 Room Info
- **Name:** Dev Room, Design Studio, etc.
- **Type:** standard, project-specific, experimental
- **Purpose:** what this room is for

### 📦 Project Details
- **Name:** CrewHub
- **Repo path:** where the code lives
- **Description:** what the project does (optional)

### ✅ Active Tasks
- **Recent tasks** (up to 10)
- Title, status (todo/in_progress/done), assignee
- Helps agents understand current priorities

### 👥 Participants
- **Agents in the room:** Dev, Gamedev, Reviewer
- **Humans:** (if internal channel)
- Who to coordinate with

### 🔢 Version & Hash
- **Context version:** timestamp of last update
- **Context hash:** fingerprint of the data
- Lets agents detect when context changed

---

## How It Works (Technical)

1. **Assignment:** You assign a task to an agent (via "Run with Agent")
2. **Generation:** CrewHub backend queries the database for room/project/tasks/participants
3. **Privacy filter:** Sensitive data stripped for external channels (Slack, Discord)
4. **Injection:** Envelope gets prepended to the agent's prompt:

```markdown
```crewhub-context
{
  "v": 1,
  "room": {"id": "dev-room", "name": "Dev Room", "type": "standard"},
  "projects": [{"id": "...", "name": "CrewHub", "repo": "~/..."}],
  "tasks": [
    {"id": "...", "title": "Fix auth bug", "status": "todo"},
    ...9 more
  ],
  "participants": [
    {"role": "agent", "handle": "Dev"},
    {"role": "agent", "handle": "Gamedev"}
  ],
  "context_version": 1770639881043,
  "context_hash": "b426b93ebc010c23"
}
\```
```

5. **Agent reads it:** The LLM sees this block and incorporates it into reasoning

---

## Privacy Tiers

Not all channels see the same envelope:

| Channel | Privacy Level | What's Included |
|---------|---------------|-----------------|
| **Internal** (CrewHub UI, local) | Full context | Everything: room, project, tasks, participants |
| **External** (Slack, Discord, WhatsApp) | Redacted | Only room/project names, no tasks or participants |

This means you can safely give agents access to external channels without leaking internal project details.

---

## Why This Matters

Context-aware agents are fundamentally more **collaborative**:

### ✅ Continuity
Agents can pick up where others left off. They see the task list, they know what's already done.

### ✅ Coordination
They know who else is working on the project, so they can avoid conflicts or ask for help.

### ✅ Learning
Repeated exposure to the same context envelope helps agents build domain knowledge.

### ✅ Better questions
Instead of "What am I supposed to do?", they can jump straight to "Should I handle this edge case?"

---

## Example: Before vs After

### Before (Manual Context)
```
You: "Dev, implement the settings API."
Dev: "Which project? Which repo? What's the structure?"
You: "CrewHub backend, ~/ekinapps/crewhub/backend. We use FastAPI. There are 3 other tasks in progress: onboarding wizard, multi-zone, and task management. Gamedev is also working in this room."
Dev: "Got it. Where does the settings API fit in the architecture?"
You: "Settings are stored in SQLite, we have a Settings table with key/value pairs..."
*15 minutes of setup*
```

### After (With Envelope)
```
You: "Dev, implement the settings API."
Dev: *reads envelope, sees CrewHub project, 3 active tasks, Gamedev in room*
Dev: "Got it. I see we're using SQLite for storage and there's already task management infrastructure I can reference. I'll implement the settings API endpoint and coordinate with Gamedev if there are any conflicts."
```

**Time saved:** 15 minutes → 15 seconds

---

## Viewing Envelopes (Coming Soon)

In v0.12.0, you'll be able to inspect context envelopes directly in the UI:

- **Context Inspector panel:** See exactly what agents see
- **Live updates:** Watch the envelope change as room state changes
- **Diff view:** See what changed since last version
- **Privacy toggle:** Switch between internal/external views
- **Export:** Copy envelope as JSON or markdown

**Why view them?**
- **Transparency:** Understand what information agents receive
- **Debugging:** Verify envelope is correct when agents behave unexpectedly
- **Education:** Learn how context injection works

---

## Best Practices

### ✅ Do
- **Assign agents to rooms** — gives them consistent context
- **Use meaningful task titles** — agents see these in the envelope
- **Keep room participant lists updated** — helps agents coordinate

### ❌ Don't
- **Overload tasks list** — envelope includes max 10 recent tasks (intentional)
- **Mix unrelated projects in one room** — creates confusing context
- **Rely on external channels for sensitive coordination** — they get redacted envelopes

---

## What's Next

Upcoming improvements to context envelopes:

- **Mid-session updates:** Notify agents when context changes while they're working
- **Historical context:** Include recent activity (last 5 completed tasks, recent messages)
- **Custom fields:** Add room-specific metadata (tech stack, conventions, links)
- **Context inheritance:** Sub-rooms inherit parent room context + add their own

The goal: make context **ambient**. Agents should just *know* without you having to tell them.

---

## Try It Yourself

1. Create a room and assign it a project
2. Add a few tasks to the task board
3. Click "Run with Agent" on a task
4. Watch how the agent references room context in their response

They'll mention the project, sometimes other tasks, and coordinate naturally with other agents in the room. That's the envelope at work.

---

**Questions?** Check the [Context Envelopes blog post](https://crewhub.dev/blog/how-bots-know-what-theyre-doing) for a deeper dive, or ask in [Discord](https://discord.gg/Bfupkmvp).
