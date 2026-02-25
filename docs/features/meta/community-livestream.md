# Community Livestream Feature

**Status:** Research / Concept (v0.20.0+)
**Category:** Meta / Community Engagement
**Priority:** Future (after core features stable)

---

## 🎯 Vision

Make the CrewHub 3D world **publicly visible and interactive** via YouTube/Twitch livestream with community controls.

**Think:** Big Brother meets AI development — viewers watch bots work in real-time AND can influence what they do.

---

## 🎮 Community Controls

### 1. **Camera Controls**
- Auto-switch camera between bots
- Follow specific bot (vote-based)
- Overview mode vs. room focus
- First-person bot POV

### 2. **World Controls**
- Pause/resume (snapshot the current state)
- Rewind recent activity
- Highlight mode (show active bots only)

### 3. **Task Suggestions**
Community submits ideas for what bots should do:
- "Build a calculator app"
- "Fix bug in X feature"
- "Research Y topic"
- "Create Z design"

**With constraints:**
- Prompt size limits (no novels)
- Scope limits (no massive projects)
- Time limits (tasks must complete in reasonable time)
- Safety filters (no harmful/unethical requests)

### 4. **Chat Consensus Voting** 🆕
Automatic task prioritization based on chat volume:
- Monitor all chat messages in real-time
- Detect requests/suggestions (e.g., "make the bot do X")
- Calculate consensus threshold:
  - **20-30% of active chatters** asking for same thing = high priority
  - **40%+ consensus** = immediate execution (bypass moderation queue)
- Smart grouping of similar requests (e.g., "fix the bug" + "debug that issue" = same intent)
- Display live consensus meter on stream overlay

**How it works:**
```
Chat activity over last 5 minutes:
- 50 unique chatters
- 12 messages saying "make bot build a todo app" (24%)
- 8 messages saying "build todo list" (16%)
- AI groups both → 20 messages (40% consensus)
→ Task automatically queued with HIGH PRIORITY
```

**Benefits:**
- Organic community-driven priorities
- No single troll can dominate
- Popular ideas rise to the top naturally
- Stream feels responsive to audience

---

## 🛡️ Safeguards

### Technical Constraints
- **Prompt size:** Max 500 chars for community suggestions
- **Scope limits:** Tasks must be completable in 1-2 hours
- **Resource limits:** No tasks that spam APIs or consume excessive resources
- **Sandbox:** Bots work in isolated environment (can't access real systems)

### Safety Controls
- **Moderation queue:** All community suggestions reviewed before execution (unless 40%+ consensus)
- **Blocklist:** Reject harmful/unethical/illegal requests
- **Rate limiting:** Max X tasks per hour from community
- **Emergency stop:** Moderator can pause/kill any task instantly
- **Transparency log:** All executed tasks visible to viewers
- **Consensus override:** Even high-consensus tasks can be vetoed by moderator

### Privacy
- No personal data visible
- No access to real systems/credentials
- Demo/sandbox environment only

---

## 🎬 Content Strategy

### Stream Format
- **24/7 live stream** OR scheduled sessions (e.g., 3x per week, 4 hours each)
- Picture-in-picture: 3D world + chat + task queue + bot status
- Overlays: current task, active bots, recent completions, **consensus meter**
- Time-lapse mode for long tasks

### Engagement Mechanics
- **Consensus voting:** Visual meter showing % agreement on suggestions
- **Task queue:** See what's coming up based on community vote
- **Achievements:** Unlock badges for contributing good ideas
- **Leaderboard:** Top contributors (most implemented tasks)
- **Challenges:** "Can bots solve this in under 1 hour?"

### Content Reuse
- Highlight clips (bot did something cool)
- Time-lapse compilations
- Behind-the-scenes (how the system works)
- Community spotlight (best task ideas)

---

## 🏗️ Technical Architecture

### Streaming Pipeline
```
CrewHub World (frontend)
  ↓ Canvas capture (OBS)
  ↓ Stream overlay (task queue, chat, status, consensus meter)
  ↓ RTMP output
  ↓ YouTube/Twitch ingest
```

### Interaction Pipeline
```
YouTube/Twitch Chat
  ↓ Chat bot (parse commands/suggestions)
  ↓ AI intent detection (group similar requests)
  ↓ Consensus calculator (% of active chatters)
  ↓ Auto-queue if threshold met (20-40%)
  ↓ Moderation queue (manual review for <40%)
  ↓ Task API (approved tasks)
  ↓ CrewHub backend
  ↓ Assign to bot
  ↓ Execute & stream result
```

### Components Needed
1. **Chat bot integration** (YouTube/Twitch API)
2. **AI intent detector** (group similar requests using LLM)
3. **Consensus engine** (track active chatters, calculate %)
4. **Moderation dashboard** (web UI for moderators)
5. **Task queue UI** (visible on stream with consensus scores)
6. **Camera control system** (auto-switch logic)
7. **Safety layer** (filters, rate limits, blocklist)
8. **Analytics** (track suggestions, votes, completions)

---

## 📊 Phases

### Phase 1: Read-Only Stream (v0.20.0)
- Set up OBS capture of CrewHub world
- Stream to YouTube/Twitch (no interaction yet)
- Chat shows what's happening
- Test viewer engagement

**Goal:** Prove there's an audience for this

### Phase 2: Basic Interaction (v0.21.0)
- Chat commands for camera control
- Voting on pre-defined tasks
- Moderator dashboard
- Simple consensus detection (exact phrase matching)

**Goal:** Community can influence, but within tight guardrails

### Phase 3: Task Suggestions + Consensus (v0.22.0)
- Community submits custom task ideas
- AI-powered intent grouping
- Real-time consensus calculation (20-40% thresholds)
- Auto-queue high-consensus tasks
- Moderation queue with approval workflow
- Task constraints + safety filters
- Public task backlog visible on stream

**Goal:** Community co-creates with bots via organic voting

### Phase 4: Advanced Features (v0.23.0+)
- Bot POV mode (first-person view)
- Achievements & leaderboards
- Challenge mode (time-limited tasks)
- Multi-bot coordination tasks
- Highlight reel automation
- Community task templates (save popular patterns)

**Goal:** Full community-driven development experience

---

## 🎯 Why This Matters

### For CrewHub
- **Marketing:** Constant live demo of the platform
- **Community:** Deep engagement (not just users, but co-creators)
- **Content:** Every stream = content for YouTube/social
- **Feedback:** Real-world testing at scale
- **Differentiation:** No other AI agent platform does this

### For Viewers
- **Entertainment:** Watch bots work (like Twitch Plays Pokémon but useful)
- **Education:** See how AI agents actually work
- **Influence:** Shape what gets built via consensus voting
- **Community:** Be part of something being built live
- **Instant feedback:** See your idea come to life if enough people agree

### For AI Development
- **Transparency:** Demystify AI by showing it live
- **Collaboration:** Human + AI co-creation at scale
- **Testing:** Discover edge cases through diverse community input
- **Trust:** Show that AI can work in public, with safeguards
- **Emergent behavior:** See what happens when crowd wisdom meets AI execution

---

## 🚧 Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| **Trolls/bad actors** | Consensus threshold prevents single-troll dominance, moderation queue, blocklist, rate limits |
| **Boring content** | Pre-seed interesting tasks, auto-switch camera, AI can suggest tasks during slow periods |
| **Bot failures on stream** | Have backup content, acknowledge failures transparently, "debug live" can be entertaining |
| **Scope creep** | Strict constraints on task size/complexity, AI pre-filters unrealistic requests |
| **Privacy leaks** | Sandbox environment, no real data visible, transparent about what's safe to show |
| **Resource abuse** | Rate limits, resource monitoring, emergency stop, cost caps per task |
| **Consensus manipulation** | Track unique IPs/accounts, detect sock puppets, moderator veto power |
| **Spam voting** | Require minimum account age, rate limit votes per user, AI detects coordinated spam |

---

## 🔗 Related

- **Live Mirror Concept** (`docs/features/meta/live-mirror-concept.md`) — Public dashboard for bot status
- **Spatial Awareness** (v0.16.0+) — Bots need to navigate intelligently for good stream content
- **Voice Chat** (v0.17.0+) — Bots could "talk" on stream about what they're doing
- **Bot Domain Names** — arethebotsokay.com, whataremybotsdoing.com could integrate with stream

---

## 💡 Wild Ideas

- **Bot interviews:** Moderator "interviews" a bot about its work
- **Bot vs. Bot challenges:** Two bots race to complete same task
- **Community bot:** Special bot that only does community-suggested tasks
- **Viewer-controlled bot:** One bot entirely controlled by chat votes
- **Time travel:** Rewind stream to see how bot solved a problem
- **Multi-stream:** Different camera angles on different channels
- **Consensus battles:** Two competing ideas both get >20% → bots race to implement both
- **Chat co-pilot:** AI summarizes chat sentiment and suggests tasks proactively
- **Live leaderboard:** Show top contributors on overlay
- **Task auctions:** Community "bids" attention on tasks (gamified priority)

---

## 📝 Next Steps (Not Immediate)

1. **Research:** Study Twitch Plays Pokémon, other interactive streams, crowd-sourced content
2. **Prototype:** Local OBS capture test
3. **Safety design:** Deep dive on moderation + constraints + consensus thresholds
4. **AI intent grouping:** Test LLM's ability to detect similar requests in different phrasings
5. **Community survey:** Gauge interest before building
6. **Legal review:** ToS, content policy, liability for community-suggested tasks
7. **Consensus algorithm:** Design and test threshold math (20/30/40%, time windows, unique user tracking)

---

**This is a future feature.** Needs stable core product first (v0.13.0-v0.17.0). But the vision is clear: **make AI development a spectator sport with real community influence**.

---

*Concept proposed by Nicky, 2026-02-12*
*Chat consensus voting added: 2026-02-12*
