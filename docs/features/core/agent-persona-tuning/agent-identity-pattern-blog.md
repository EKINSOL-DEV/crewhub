# The Agent Identity Pattern: One Identity, Many Surfaces

*February 13, 2026 · CrewHub v0.15.0*

---

## The Problem Nobody Talks About

Here's a weird thing that happens with AI agents: give them access to multiple channels — WhatsApp, Discord, a web dashboard — and they start acting like they have multiple personalities. The same agent that's casual and helpful on WhatsApp suddenly tries to be "more professional" when you chat via the web UI. Or an onboarding wizard accidentally overwrites a carefully tuned personality because it didn't know one already existed.

We saw this firsthand in CrewHub's Discord:

> *"I clicked on my main assistant and sent a chat through the web interface and it tried to change his personality."*

The agent thought the 3D avatar in CrewHub was a **different identity**, not just a different window into the same agent.

## The Insight

A human doesn't become a different person when they switch from texting to a phone call. They might adjust their tone — shorter messages in texts, more detail in an email — but they're still the same person.

**That's the pattern:** agents should behave the same way.

```
Human:
  - Body (physical presence)
  - Mirror (visual representation)  
  - Phone calls (voice access)
  - Text messages (written access)
  → Still ONE person

Agent:
  - OpenClaw instance (main existence)
  - CrewHub 3D avatar (visual representation)
  - WhatsApp / Discord / Slack (access channels)
  → Still ONE agent
```

## How It Works

The Agent Identity Pattern has three components:

### 1. Identity Anchor

A core "who am I" statement that gets injected into every conversation, regardless of which channel the agent is accessed through:

```
I am Assistent, the Director of Bots. I coordinate the crew, 
manage schedules, and help Nicky with whatever he needs. 
My personality is constant across all channels.
```

This anchor is like a north star — it keeps the agent's personality consistent even when the context around it changes.

### 2. Surface Adapter

Instead of changing personality per channel, the system provides **format rules** — guidance on how to structure messages for each surface:

| Surface | Format Rules |
|---------|-------------|
| **WhatsApp** | No markdown tables. Bullet lists. No headers. Keep it concise. |
| **Discord** | Use Discord markdown. Wrap links in `<>`. |
| **Slack** | Use mrkdwn syntax. Thread for details. |
| **Email** | Professional formatting. Proper greetings. |
| **CrewHub UI** | Full markdown. Rich formatting. Code blocks. |

The key distinction: **format adapts, personality doesn't.**

### 3. Identity Lock

When an agent already has a configured personality (SOUL.md, IDENTITY.md, or a CrewHub persona), the system detects this and skips personality setup during onboarding. Instead of asking "how should your agent behave?", it says:

> ✅ **Identity Detected** — This agent's personality is already defined. CrewHub will connect for monitoring without modifying its identity.

No more accidental personality overwrites.

## The Architecture

In the backend, the Identity Pattern extends the existing Persona system:

```
agent_personas table:
  ├─ Behavior dimensions (start_behavior, checkin_frequency, etc.)
  ├─ Identity anchor (core "who am I" statement)        ← NEW
  ├─ Surface rules (global format adaptation rules)     ← NEW
  └─ Identity locked (prevent onboarding overwrites)    ← NEW

agent_surfaces table:                                    ← NEW
  ├─ Per-surface format rules (whatsapp, discord, etc.)
  └─ Enable/disable per surface
```

When building the context envelope for an agent session, the system now combines:

1. **Identity block** → Who am I + stability rule + current surface format
2. **Behavior block** → Existing persona dimensions (how autonomous, how verbose, etc.)

The prompt fragment looks like:

```markdown
## Identity
I am Assistent, the Director of Bots. [...]

**Identity stability rule:** Your personality and core behavior are 
constant across all access channels. You adapt your *format* per 
channel, never your *personality*.

**Current surface:** whatsapp
**Format rules:** No markdown tables. Use bullet lists. [...]

## Behavior Guidelines
Execute tasks immediately without asking for confirmation. [...]
```

## What Changes for Users

**New Settings tab: Identity** — Right next to Personas in CrewHub settings. Configure:
- Identity anchor (who your agent is)
- Global surface rules
- Per-surface format overrides (with sensible defaults)
- Identity lock toggle

**Smarter onboarding** — If your agent already has a personality, CrewHub won't try to change it. It just connects for monitoring.

**Better multi-channel behavior** — Agents that are accessed through WhatsApp, Discord, and the web UI will maintain consistent personality while properly adapting their message format.

## The Bigger Picture

The Identity Pattern is about preventing **personality drift** — the gradual degradation of agent behavior when it's accessed through many different surfaces. It's a simple idea (one identity, multiple representations) but it requires explicit architecture to enforce.

As agents get more capable and operate across more surfaces, this becomes increasingly important. You don't want your careful persona tuning to unravel just because someone clicked "chat" in a web dashboard instead of texting on WhatsApp.

**One identity. Many surfaces. Zero drift.**

---

*The Agent Identity Pattern ships in CrewHub v0.15.0. It builds on the Persona Tuning system from v0.12.0 and adds identity stability across all access channels.*

*Related: [Agent Persona Tuning docs](./agent-persona-tuning.md) · [Migration Guide](./MIGRATION-persona-system.md)*
