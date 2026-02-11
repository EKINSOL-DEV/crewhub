# Live Mirror Demo Site (Vendetta Concept)

**Proposed for:** v0.21.0 or later  
**Status:** 💡 Concept  
**Source:** Nicky's idea 2026-02-11  
**Credit:** Shoutout to user Vendetta @ ClawHub Discord (after v0.13.0 release)

---

## Concept

A public demo site that mirrors the **real-time activity** from Vendetta's own CrewHub production environment, but in **read-only mode** (no agent input from visitors).

Think: "Behind the glass" view of a working CrewHub instance.

---

## Key Features

### 1. Real-Time Mirror
- Live feed of activities from Vendetta's production CrewHub
- Shows real agents working on real tasks
- Updates in real-time via SSE/WebSocket

### 2. Read-Only Mode
- Visitors can **see** everything:
  - Agents moving around the 3D world
  - Tasks being created and completed
  - Chat conversations (if not private)
  - Sessions and activity logs
  - Projects and room assignments
- Visitors **cannot**:
  - Send messages to agents
  - Create/modify tasks
  - Interact with the 3D world
  - Change settings

### 3. Privacy Controls
- Filter what gets mirrored (no sensitive data)
- Anonymize certain content (customer names, private projects)
- Option to pause/disable mirror temporarily

---

## Use Cases

### Marketing & Sales
- **"See it in action"** - More convincing than mock data
- Live demo during sales calls
- Conference booth display (big screen with live activity)

### Transparency
- Show how Vendetta uses their own product
- "We eat our own dog food" credibility
- Community engagement (see the team working)

### Product Education
- New users see real workflows
- Learn by observing experienced users
- Understand what's possible with CrewHub

---

## Technical Architecture

### Option A: Dedicated Mirror Instance
```
Production CrewHub (Vendetta)
    ↓ (one-way sync)
Mirror Database (read-only replica)
    ↓
Public Mirror Frontend (mirror.vendetta.com)
```

**Pros:**
- Clean separation of concerns
- No risk to production
- Independent scaling

**Cons:**
- More infrastructure
- Sync lag
- Duplicate maintenance

### Option B: Read-Only API Layer
```
Production CrewHub (Vendetta)
    ↓ (read-only API endpoints)
Public Mirror Frontend (mirror.vendetta.com)
```

**Pros:**
- Real-time (no sync lag)
- Less infrastructure
- Single source of truth

**Cons:**
- Load on production backend
- Need careful API security
- Potential attack vector

### Option C: Event Stream
```
Production CrewHub (Vendetta)
    ↓ (publish events to stream)
Event Bus (Kafka/Redis/Pub-Sub)
    ↓ (subscribe)
Public Mirror Frontend (mirror.vendetta.com)
```

**Pros:**
- Decoupled from production
- Can filter events before publishing
- Scalable (multiple mirrors)

**Cons:**
- More complex architecture
- Need event bus infrastructure
- Eventual consistency

---

## Privacy & Filtering

### What to Mirror
- ✅ Agent names and roles
- ✅ Task titles (if not sensitive)
- ✅ General activity ("Agent X is working on Y")
- ✅ Room assignments and projects (public ones)
- ✅ 3D world state (bot positions, room layout)

### What to Filter/Redact
- ❌ Customer names
- ❌ Private task details
- ❌ Chat conversations (unless marked public)
- ❌ File contents
- ❌ Session transcripts
- ❌ API keys, tokens, credentials

### Privacy Controls
- **Project-level flag:** `is_public` (mirror this project or not)
- **Task-level flag:** `is_public` (show in mirror or not)
- **Global switch:** Pause entire mirror (e.g., during sensitive work)

---

## UI Differences (Mirror vs Production)

### Mirror Site
- **Banner:** "Live Mirror - Read-Only View"
- **Disabled interactions:** All buttons/inputs disabled or hidden
- **Tooltip explanations:** "This is a mirror of Vendetta's CrewHub"
- **Optional annotations:** Explain what's happening (e.g., "Agent is fixing a bug")

### Production Site
- Full interactivity
- No banner

---

## Implementation Phases

### Phase 1: Proof of Concept (1-2 weeks)
- Basic event stream from production
- Simple mirror frontend (just activity feed)
- Manual privacy filtering

### Phase 2: Full 3D Mirror (2-3 weeks)
- 3D world view synced
- Bot movements mirrored
- Room and project sync

### Phase 3: Privacy & Controls (1-2 weeks)
- Automated filtering based on flags
- Admin panel for mirror controls
- Anonymization rules

### Phase 4: Polish & Marketing (1 week)
- Beautiful mirror UI
- Explanatory tooltips
- Embed options for website

---

## Open Questions

1. **Domain:** `mirror.vendetta.com` or `live.crewhub.dev`?
2. **Anonymization:** How much to redact? (e.g., "Agent X" vs real names)
3. **Lag acceptable?** Real-time vs 5-10 second delay for safety buffer
4. **Authentication:** Public access or gated (e.g., sign up to view)?
5. **Recording:** Can visitors replay past activity? Or only live?

---

## Related Work

- **`demo.crewhub.dev`** - Mock API demo (no real data)
- **Live Mirror** (this concept) - Real data, read-only
- **Embedded Widgets** - Could extract from mirror for website embeds

---

## Next Steps

1. **Validate concept** with team (is this valuable?)
2. **Choose architecture** (A/B/C)
3. **Define privacy rules** (what gets mirrored)
4. **Build POC** (Phase 1)
5. **Iterate** based on feedback

---

## 📢 Release Notes (When Implemented)

**Post-release announcement:**
- 🎉 **Shoutout to user Vendetta @ ClawHub Discord** for suggesting this concept!
- Announce in #announcements channel
- Share in blog post / website update
- Credit Vendetta in release notes

---

*This is a concept document. No implementation yet.*
