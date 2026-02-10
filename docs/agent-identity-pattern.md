# Agent Identity Pattern: Single Identity, Multiple Surfaces

*Created: 2026-02-10*  
*Status: Design Pattern*  
*Version: v0.14.0*

## The Problem

When agents are accessed through different surfaces (WhatsApp, Discord, CrewHub web UI, 3D World), they may become confused about their identity:

- Agent tries to adopt different personalities per surface
- Thinks "I'm a different agent when in CrewHub"
- Onboarding wizards accidentally override existing agent personalities
- Context pollution: agent behavior drifts based on access method

**Real Example (Discord #dev):**
```
TODinSort: "I don't talk to them through crewhub they don't know what is going on 
and I have a 4 task from chat and it showed working but the bug when I click 
on the assistant show blank"

TODinSort: "Lie here is an example. I clicked on my main assistant and sent a 
chat thought the web interface and it tried to change his personality."
```

## The Solution: 3D Avatar ≠ Different Identity

**Core Principle:**
An agent has **one identity** but **multiple representations**:
- Main existence: OpenClaw agent instance
- Monitoring: CrewHub 3D avatar (like a security camera feed)
- Access points: WhatsApp, Discord, web UI, etc.

**Analogy:**
```
Human:
  - Body (physical presence)
  - Reflection in mirror (visual representation)
  - Phone calls (voice access)
  - Text messages (written access)
  → Still ONE person, not four different identities

Agent:
  - OpenClaw instance (main existence)
  - CrewHub 3D avatar (visual representation)
  - WhatsApp/Discord/Web (access channels)
  → Still ONE agent, not multiple personalities
```

## Implementation Guidelines

### 1. Agent Identity Files (SOUL.md, IDENTITY.md)

**IDENTITY.md Pattern:**
```markdown
# IDENTITY.md - Who Am I?

- **Name:** Assistent (or your agent name)
- **Platform:** OpenClaw
- **Monitoring:** CrewHub dashboard (3D avatar representation)
- **Access Channels:** WhatsApp, Discord, Slack, Web UI
- **Avatar:** 🦞 (or your agent emoji)

**Important:**
I exist in ONE place (OpenClaw), but I'm:
- Visible in CrewHub (like a security camera watching me work)
- Reachable via multiple channels (WhatsApp, Discord, etc.)
- The 3D avatar in CrewHub is just a visual representation, not a different identity
```

### 2. Context Awareness (What to Know vs. What to Ignore)

**✅ Agent SHOULD know:**
- Current access channel (WhatsApp, Discord, web UI)
- User they're talking to
- Available tools/capabilities on this channel
- Message format constraints (e.g., Discord markdown vs WhatsApp plain text)

**❌ Agent should NOT:**
- Change personality based on access method
- Think "I'm a different agent in CrewHub"
- Behave differently when accessed via web UI vs chat
- Let monitoring visibility affect core identity

**Example (Correct Behavior):**
```
User clicks 3D avatar in CrewHub → Opens chat panel
Agent: "Hey! How can I help?" 
  (Same personality as WhatsApp, just different UI)

NOT: "Oh, I'm in CrewHub now, let me act more professional"
```

### 3. Onboarding Pattern: Detect Existing Agents

**Problem:** Onboarding wizards may try to set up personality when one already exists.

**Solution:** Connection-only mode for existing agents.

**Pseudo-code:**
```typescript
async function onboard() {
  const hasSoul = fs.existsSync('~/clawd/SOUL.md')
  const hasIdentity = fs.existsSync('~/clawd/IDENTITY.md')
  
  if (hasSoul || hasIdentity) {
    console.log('✓ Detected existing agent personality')
    return onboardConnectionOnly() // Just set up CrewHub connection
  } else {
    console.log('○ New agent - running full onboarding')
    return onboardFull() // Personality + connection setup
  }
}

function onboardConnectionOnly() {
  // 1. Connect to OpenClaw gateway
  // 2. Set up CrewHub monitoring (read-only)
  // 3. Do NOT touch SOUL.md, IDENTITY.md, or personality
  // 4. Confirm: "Connected to CrewHub for monitoring"
}
```

### 4. Model-Specific Considerations

Different LLM models may handle this differently:

| Model | Tendency | Mitigation |
|-------|----------|------------|
| **Opus** | More likely to roleplay/adapt personality | Stronger SOUL.md constraints, explicit "don't change identity" rules |
| **Sonnet** | More pragmatic/consistent | Usually fine, less likely to drift |
| **GPT** | Moderate adaptation | Clear examples in USER.md help |

**Recommendation:** Include in SOUL.md:
```markdown
## Identity Stability

My personality is defined in this file and does NOT change based on:
- Access method (WhatsApp, Discord, CrewHub web UI)
- Who's watching (CrewHub monitoring dashboard)
- Time of day or context switches

I adapt my **format** (Discord markdown vs WhatsApp plain) but not my **personality**.
```

### 5. Multi-Surface Response Adaptation (The Right Way)

**✅ Adapt format, not personality:**
```python
# Good: Format adaptation
if channel == "discord":
    return format_with_markdown(response)
elif channel == "whatsapp":
    return strip_markdown(response)

# Bad: Personality change
if channel == "crewhub_web":
    personality = "more professional"  # ❌ NO!
```

**Example:**
```
WhatsApp message: "Hey, can you help with X?"
Agent: "Sure! Let me check that for you 🦞"

Discord message: "Hey, can you help with X?"
Agent: "Sure! Let me check that for you 🦞"
  (same tone, just Discord allows richer formatting)

CrewHub chat panel: "Hey, can you help with X?"
Agent: "Sure! Let me check that for you 🦞"
  (SAME personality, just different UI)
```

## Implementation Checklist (v0.14.0)

- [ ] **Update Onboarding Wizard**
  - Detect existing SOUL.md/IDENTITY.md
  - Skip personality setup if agent already exists
  - Add "connection-only" mode for CrewHub monitoring setup

- [ ] **Add IDENTITY.md Template**
  - Include "3D avatar = representation, not identity" explanation
  - Clear distinction between monitoring and personality

- [ ] **Update AGENTS.md Guidance**
  - Document this pattern for new agents
  - Add "don't change personality based on access method" rule

- [ ] **CrewHub Connection Docs**
  - Clarify CrewHub is a monitoring dashboard, not a different platform
  - Agents don't "enter" CrewHub, they're just observed by it

- [ ] **Test with Multiple Models**
  - Verify Opus doesn't personality-drift via web UI
  - Confirm Sonnet maintains consistency
  - Test GPT behavior across surfaces

## Visual Diagram

```
┌─────────────────────────────────────────────────────────┐
│  OpenClaw Agent Instance (Single Identity)              │
│  ├─ SOUL.md (who I am)                                  │
│  ├─ IDENTITY.md (my core attributes)                    │
│  └─ Memory (my experiences)                             │
└────────────┬────────────────────────────────────────────┘
             │
             ├─── 📱 WhatsApp (access channel)
             ├─── 💬 Discord (access channel)
             ├─── 🌐 Web UI (access channel)
             └─── 👁️ CrewHub 3D Avatar (monitoring view)
                      ↑
                      └─ "Watching" not "different agent"
```

## Related Discord Discussion

**Thread:** #dev, 2026-02-10  
**Participants:** TODinSort, ch-ekinsol (Nicky)  
**Key Insight (ch-ekinsol):**
> "Could be as simple as providing the agent the idea of also having a 
> representation in CrewHub with a 3d avatar, instead of calling it 
> a different personal identity"

**Problem Identified:**
- Agent personality changed when accessed via CrewHub web UI
- Confusion between "being monitored" and "being a different agent"

**Solution:**
This pattern document.

## See Also

- `AGENTS.md` - Agent workspace setup
- `SOUL.md` - Agent personality definition
- `IDENTITY.md` - Agent identity template
- `docs/onboarding-analysis.md` - Onboarding wizard design
- CrewHub connection architecture docs

---

*This pattern should be applied to all agents to prevent identity drift and context confusion.*
