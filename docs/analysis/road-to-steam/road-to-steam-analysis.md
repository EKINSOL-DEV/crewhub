# 🎮 Road to Steam: CrewHub Early Access Analysis

**Date:** February 7, 2026
**Status:** Strategic Planning Document
**Confidential:** Private Document - Not for Repository

---

## Executive Summary

> **"Getting real work done doesn't have to be boring."**

CrewHub has the potential to carve out a unique niche on Steam as the first "AI Agent Dashboard as a Game." By combining the productivity of an agent monitoring tool with gamification elements inspired by programming puzzle games (TIS-100, EXAPUNKS, while True: learn()), we can create something genuinely novel.

**Main Tagline:** "Getting real work done doesn't have to be boring."

**Key Opportunity:** No one has made a gamified AI agent command center before. The Steam audience for developer-focused games is proven (Zachtronics sold 500,000+ copies across their catalog), and the timing aligns with explosive AI interest.

**Recommendation:** Proceed with Steam Early Access development, targeting a Q4 2026 launch with a €8.67 price point.

---

## 1. Market Analysis

### 1.1 Steam Indie Game Market Landscape

The indie game market on Steam has evolved significantly:

**Market Size (2024-2025):**
- ~15,000+ new games released annually on Steam
- ~13-15% of releases are Early Access titles
- Only ~10% of indie games achieve profitability
- However, niche genres with dedicated audiences outperform

**Developer Tools as Games - Proven Category:**

| Game | Price (Base) | Reviews | Rating | Launch Year |
|------|-------------|---------|--------|-------------|
| TIS-100 | €6.89 | 3,309 | Overwhelmingly Positive | 2015 |
| EXAPUNKS | €19.50 | 1,326 | Overwhelmingly Positive | 2018 |
| while True: learn() | €8.67 | 7,100+ | Very Positive (91%) | 2018 |
| Hacknet | €9.99 | 16,500+ | Very Positive (93%) | 2015 |
| Shenzhen I/O | €18.50 | 4,800+ | Overwhelmingly Positive | 2016 |
| Grey Hack | €14.99 | 2,400+ | Very Positive | 2017 |

**Key Insight:** Programming/tech games command premium prices (€10-20) and achieve excellent review scores. The audience is small but loyal and forgiving of niche appeal.

### 1.2 Target Audience Analysis

**Primary Audience (Core):**
- Software developers using AI coding assistants
- DevOps/SRE professionals managing automation
- Tech enthusiasts experimenting with AI agents
- Indie developers monitoring Claude Code/Copilot sessions

**Secondary Audience (Growth):**
- Gamers who enjoyed Zachtronics games
- Cyberpunk/hacking aesthetic enthusiasts
- Productivity tool users seeking gamification
- Students learning about AI/ML concepts

**Audience Overlap:**
```
┌─────────────────────────────────────────────────┐
│                   STEAM USERS                   │
│  ┌─────────────────────────────────────────┐   │
│  │      Indie/Puzzle Game Enthusiasts      │   │
│  │  ┌───────────────────────────────────┐  │   │
│  │  │   Programming Game Fans           │  │   │
│  │  │  ┌────────────────────────────┐   │  │   │
│  │  │  │  AI/Developer Tool Users  │   │  │   │
│  │  │  │  ← CREWHUB CORE TARGET    │   │  │   │
│  │  │  └────────────────────────────┘   │  │   │
│  │  └───────────────────────────────────┘  │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### 1.3 Comparable Title Deep Dive

**while True: learn() - Most Relevant Comparison:**
- Concept: Visual programming puzzles teaching machine learning
- Gamification: Cat companion, startup simulation, unlockable items
- Price: €8.67 base, €9.99 DLC
- Success factors: Cute aesthetics, real learning, accessible to non-programmers
- **Lesson for CrewHub:** Make AI concepts tangible through play

**Hacknet - Immersion Reference:**
- Concept: Terminal-based hacking simulation
- Gamification: Story progression, achievements, atmosphere
- Price: €9.99 base, €4.99 DLC
- Success factors: Authentic feel, narrative, great soundtrack
- **Lesson for CrewHub:** Atmosphere and audio matter enormously

**EXAPUNKS - Aesthetic Reference:**
- Concept: Virus programming in 90s cyberpunk setting
- Gamification: Zines to read, mini-games to unlock, global leaderboards
- Price: €19.50
- Success factors: Physical-feeling materials, competitive element
- **Lesson for CrewHub:** Physical metaphors (zines = documentation) work

### 1.4 Pricing Research Summary

**Recommended Price Point: €8.67 (Early Access) → €16.99 (Full Release)**

Rationale:
- Below EXAPUNKS (€19.50) - less content, newer
- Above TIS-100 (€6.89) - more visual, ongoing value
- Matches while True: learn() - similar accessibility/concept
- Room to increase at 1.0 release (common practice)
- Supports 25-50% sale discounts for visibility events

**Regional Pricing:**
- Use Steam's recommended regional pricing
- Be generous with lower-income regions (builds goodwill, prevents piracy)
- Consider free/heavily discounted tier for verified open source contributors

---

## 2. Gamification Design

### 2.1 XP and Leveling System

**Agent XP System:**
Each AI agent session earns XP based on:

| Action | Base XP | Multipliers |
|--------|---------|-------------|
| Task completed | 100 | ×1.5 for complex, ×2 for multi-step |
| Tool call successful | 10 | ×1.2 for each unique tool type |
| Session duration (per 10min) | 25 | Caps at 2 hours |
| Streak bonus (consecutive days) | 50 | ×(1 + days/7), caps at ×3 |
| First of day | 100 | — |
| Code committed | 75 | — |
| Tests passed | 50 | ×1.5 if first try |

**Agent Levels:**
```
Level 1-10:   Rookie Agent      (0 - 10,000 XP)
Level 11-25:  Junior Agent      (10,001 - 50,000 XP)
Level 26-50:  Senior Agent      (50,001 - 200,000 XP)
Level 51-75:  Lead Agent        (200,001 - 500,000 XP)
Level 76-99:  Principal Agent   (500,001 - 1,000,000 XP)
Level 100:    Legendary Agent   (1,000,001+ XP)
```

**User Level (Meta-progression):**
Your overall "Commander" level based on total XP across all agents. Unlocks global features.

### 2.2 Achievement System

**Categories & Examples:**

**🎯 Task Achievements:**
| Achievement | Requirement | Rarity |
|-------------|-------------|--------|
| First Steps | Complete first task | Common |
| Century | Complete 100 tasks | Uncommon |
| Thousand | Complete 1,000 tasks | Rare |
| Workaholic | Complete 10,000 tasks | Epic |
| Infinite Machine | Complete 100,000 tasks | Legendary |

**⏰ Time-Based:**
| Achievement | Requirement | Rarity |
|-------------|-------------|--------|
| Early Bird | Agent completes task before 6 AM | Uncommon |
| Night Owl | 24-hour session (with activity) | Rare |
| Speed Demon | Task completed in <30 seconds | Uncommon |
| The Long Game | Agent runs for 30 days straight | Epic |

**🛠️ Tool Mastery:**
| Achievement | Requirement | Rarity |
|-------------|-------------|--------|
| Editor Pro | 1,000 file edits | Uncommon |
| Shell Master | 1,000 exec calls | Uncommon |
| Web Crawler | 500 web searches | Rare |
| Browser Whisperer | 100 browser automations | Rare |
| Polyglot | Use 10+ different tools | Uncommon |

**🌟 Special:**
| Achievement | Requirement | Rarity |
|-------------|-------------|--------|
| Perfect Streak | 30-day login streak | Rare |
| Zero Errors | Session with 50+ tasks, no failures | Epic |
| The Collective | Run 10 agents simultaneously | Rare |
| Open Source Hero | Contribute to CrewHub repo | Epic |
| Founder | Play during Early Access | Unique |

**Steam Integration:**
- All achievements sync to Steam Achievements
- Rare achievements trigger Steam notification
- Total of 50 achievements at launch, expanding with updates

### 2.3 Unlockables System

**Themes (Visual):**
| Theme | Unlock Condition | Style |
|-------|------------------|-------|
| Tokyo Night | Default | Purple/blue cyberpunk |
| Dracula | Level 5 | Dark purple, high contrast |
| Nord | Level 10 | Arctic blues, calm |
| Catppuccin Mocha | Level 15 | Pastel colors |
| GitHub Light | Level 20 | Clean, professional |
| Matrix Rain | 1,000 tasks | Green terminal aesthetic |
| Synthwave | 100-hour playtime | Neon 80s |
| LCARS | Secret (Star Trek reference) | Star Trek computer |
| Paper | Secret (while True: learn() reference) | Notebook style |
| Retro Terminal | Purchase DLC | Amber/green CRT |

**3D Environment Props:**
| Prop | Unlock Condition | Description |
|------|------------------|-------------|
| Basic Desk | Default | Simple workstation |
| Dual Monitor | Level 5 | Second monitor appears |
| Server Rack | Level 15 | Background server rack |
| Holographic Display | Level 25 | Floating HUD elements |
| Plant | 7-day streak | Desktop plant |
| Coffee Mug | 10 AM login | Animated steam |
| Cat | while True: learn() Easter egg | Sleeping cat on desk |
| Rubber Duck | First debug session | Classic debugger |
| Trophy Shelf | 25 achievements | Displays your trophies |
| RGB Everything | 1,000 hours | Ridiculous RGB setup |

**Bot Accessories (Per Agent):**
| Accessory | Unlock Condition | Visual |
|-----------|------------------|--------|
| Sunglasses | Complete "cool" task | Matrix reference |
| Hard Hat | First build failure recovered | Construction theme |
| Crown | 100-task streak | Royal agent |
| Wizard Hat | Complex task automated | Magic/code wizardry |
| Antenna | First remote agent | Communication theme |
| Cape | 1,000 tasks single agent | Superhero |
| Graduation Cap | Complete tutorial | Scholar |
| Party Hat | Anniversary | Celebration |

### 2.4 Daily/Weekly Challenges

**Daily Challenges (Rotating):**
```
🎯 Complete 5 tasks              (+100 XP, +10 credits)
⚡ Complete a task in under 1 min (+75 XP)
🛠️ Use 3 different tools          (+50 XP)
📝 Make 10 file edits            (+50 XP)
🌐 Perform 5 web searches        (+50 XP)
```

**Weekly Challenges (More Ambitious):**
```
🏆 Complete 50 tasks this week        (+500 XP, Theme Unlock Token)
⏰ Maintain 5-day login streak        (+300 XP)
🤖 Run 3 different agents             (+250 XP)
📊 Accumulate 10 hours session time   (+400 XP)
💡 Discover an Easter egg             (+200 XP)
```

**Challenge Rewards:**
- XP bonus for leveling
- "Credits" for cosmetic shop (in-game currency, not MTX)
- Unlock tokens for theme/prop selection
- Limited-time exclusive cosmetics

### 2.5 Leaderboards (Privacy-Conscious)

**Opt-In Global Leaderboards:**
- Players must explicitly enable
- Display username (customizable, not real name)
- Categories:
  - Weekly XP earned
  - Total tasks completed
  - Longest streak
  - Most agents managed
  - Challenge completion rate

**Friend Leaderboards:**
- Compare only with Steam friends who also opted in
- Lower stakes, more fun
- Weekly reset for freshness

**Room Leaderboards:**
- Compare agents within your rooms
- "Best performer this week"
- Entirely local/private

**Privacy Features:**
- All leaderboards opt-in (off by default)
- No data shared without consent
- Can participate anonymously (show rank, not name)
- GDPR-compliant data deletion available

### 2.6 Prestige System

**Concept:** After reaching Level 100, players can "Prestige" to reset their level but gain permanent bonuses.

**Prestige Tiers:**
| Tier | Icon | Bonus |
|------|------|-------|
| Prestige 1 | ⭐ | +5% XP gain |
| Prestige 2 | ⭐⭐ | +10% XP, exclusive frame |
| Prestige 3 | ⭐⭐⭐ | +15% XP, exclusive avatar |
| Prestige 5 | 🌟 | +25% XP, "Veteran" title |
| Prestige 10 | 💫 | +50% XP, unique environment |

**What Resets:**
- Level → Back to 1
- Achievements → Kept
- Unlocks → Kept
- Stats → Archived (viewable)

**What's Gained:**
- Prestige star on profile
- XP multiplier (stacks)
- Exclusive cosmetics per tier
- Bragging rights

**Design Philosophy:**
- Never feel forced to prestige
- Pure vanity/challenge for dedicated players
- Keeps endgame interesting

---

## 3. Technical Requirements

### 3.1 Steam SDK Integration (Steamworks)

**Required Integrations:**

| Feature | API | Priority | Complexity |
|---------|-----|----------|------------|
| User Authentication | ISteamUser | P0 | Low |
| Achievements | ISteamUserStats | P0 | Medium |
| Cloud Saves | ISteamRemoteStorage | P1 | Medium |
| Overlay | ISteamUtils | P1 | Low |
| Workshop | ISteamUGC | P2 | High |
| Leaderboards | ISteamUserStats | P2 | Medium |
| Trading Cards | Store Config | P3 | Low |
| Rich Presence | ISteamFriends | P3 | Low |

**Implementation Approach:**

For Electron/Tauri apps, use:
- **Greenworks** (Electron) - Node.js bindings for Steamworks
- **steamworks-rs** (Tauri/Rust) - Rust bindings

```javascript
// Example Greenworks integration
const greenworks = require('greenworks');

if (greenworks.initAPI()) {
  console.log('Steam API initialized');

  // Unlock achievement
  greenworks.activateAchievement('FIRST_TASK', () => {
    console.log('Achievement unlocked!');
  });

  // Cloud save
  greenworks.saveTextToFile('savegame.json', saveData, () => {
    console.log('Game saved to Steam Cloud');
  });
}
```

### 3.2 Desktop App Packaging

**Electron vs Tauri Decision:**

| Factor | Electron | Tauri |
|--------|----------|-------|
| Bundle Size | ~150MB | ~10MB |
| Memory Usage | Higher | 58% less |
| Steam SDK | Greenworks (mature) | steamworks-rs (newer) |
| Linux/Steam Deck | More tested | WebKitGTK issues |
| Build Complexity | Simple | Rust toolchain needed |
| **Recommendation** | ✅ For Steam | Consider for future |

**Why Electron for Steam Launch:**
- Greenworks is battle-tested
- Steam Deck Electron guide exists (Brainhub article)
- Already have Electron expertise (CrewHub is web-first)
- Can migrate to Tauri post-launch if needed

**Packaging Tools:**
- electron-builder for Windows/Mac/Linux
- Dedicated Steam branch with Steamworks enabled
- Separate builds: Steam (with SDK) vs GitHub (without)

### 3.3 Steam Cloud Saves

**What to Save:**
```json
{
  "user": {
    "level": 42,
    "xp": 150000,
    "prestige": 0,
    "achievements": ["FIRST_TASK", "CENTURY", ...],
    "unlockedThemes": ["tokyo-night", "dracula", ...],
    "unlockedProps": ["plant", "coffee-mug", ...],
    "stats": {
      "totalTasks": 4521,
      "totalSessions": 892,
      "playTime": 18432
    }
  },
  "preferences": {
    "theme": "tokyo-night",
    "zenModeEnabled": true,
    "notifications": true
  },
  "rooms": [
    { "id": "dev", "name": "Dev Room", "agents": [...] }
  ]
}
```

**Implementation:**
- Auto-save every 5 minutes
- Save on significant events (achievement, level up)
- Conflict resolution: server time wins
- Max save size: 1MB (Steam limit per file)

### 3.4 Steam Deck Compatibility

**Target Rating:** ✅ Verified (or at minimum 🟡 Playable)

**Requirements for Verified:**
1. ✅ Full controller support
2. ✅ Readable text at 1280×800
3. ✅ Default graphics work
4. ✅ No launcher before game
5. ✅ Support Steam Deck's suspend/resume

**Electron on Steam Deck Challenges:**
- libcups dependency issue (solved with symlink)
- Game Mode vs Desktop Mode behavior differences
- Need to test WebGL/GPU acceleration

**Implementation Checklist:**
- [ ] Controller mapping for all actions
- [ ] UI scales to 1280×800 without scroll
- [ ] Font sizes minimum 14px
- [ ] Touch-friendly buttons (48px minimum)
- [ ] Zen Mode keyboard alternatives (virtual keyboard trigger)
- [ ] Test suspend/resume doesn't break SSE connection
- [ ] Provide recovery reconnect for dropped connections

**Launch Command (Steam Deck):**
```
LD_PRELOAD="" %command% --no-sandbox
```

### 3.5 Achievement API Integration

**Achievement Categories:**

```cpp
// Steam Achievement definitions (partner.steamgames.com)
{
  "name": "FIRST_TASK",
  "displayName": "First Steps",
  "description": "Complete your first task",
  "hidden": false,
  "icon": "achievement_first_task.png",
  "icon_gray": "achievement_first_task_gray.png"
}
```

**In-Game Triggers:**
```typescript
// Achievement service
class AchievementService {
  checkAndUnlock(event: GameEvent) {
    switch(event.type) {
      case 'TASK_COMPLETE':
        this.incrementStat('tasks_completed');
        if (this.stats.tasks_completed === 1) {
          this.unlock('FIRST_TASK');
        }
        if (this.stats.tasks_completed === 100) {
          this.unlock('CENTURY');
        }
        break;
      // ... more triggers
    }
  }
}
```

### 3.6 Workshop Support for Mods

**Workshop Content Types:**

| Type | Format | Size Limit | Review |
|------|--------|-----------|--------|
| Themes | JSON + CSS | 100KB | Auto |
| Props | GLTF/GLB | 5MB | Manual |
| Environments | Scene files | 10MB | Manual |
| Sound Packs | OGG/MP3 | 20MB | Manual |

**Theme Format (JSON):**
```json
{
  "name": "My Custom Theme",
  "author": "steam_username",
  "version": "1.0.0",
  "type": "dark",
  "colors": {
    "bg": "#1a1a2e",
    "fg": "#eaeaea",
    "accent": "#e94560"
  },
  "preview": "preview.png"
}
```

**Workshop Integration Flow:**
1. Creator makes theme in Theme Editor (in-game tool)
2. Export generates Workshop-ready package
3. Upload via Steam Workshop (ISteamUGC)
4. Users subscribe → auto-download
5. CrewHub reads subscribed items on startup

**Modding API (Future):**
- Custom panel types (advanced)
- Script hooks for events
- Custom achievement triggers
- Full environment customization

---

## 4. Business Model

### 4.1 AGPL Open Source + Paid Steam Coexistence

**Challenge:** CrewHub core is (or will be) AGPL licensed. Steam's Steamworks SDK is proprietary. These are technically incompatible.

**Solution: Split Architecture**

```
┌─────────────────────────────────────────────────────────┐
│                    CrewHub Ecosystem                    │
├─────────────────────────┬───────────────────────────────┤
│   OPEN SOURCE (AGPL)    │    STEAM VERSION (Proprietary)│
├─────────────────────────┼───────────────────────────────┤
│ • Core dashboard        │ • Steamworks integration      │
│ • Backend API           │ • Achievement system          │
│ • SSE streaming         │ • Cloud saves                 │
│ • Room management       │ • Gamification layer          │
│ • Agent monitoring      │ • Exclusive themes            │
│ • Zen Mode              │ • Workshop support            │
│                         │ • Steam Deck optimization     │
│                         │ • Trading cards               │
└─────────────────────────┴───────────────────────────────┘
```

**License Strategy:**

1. **crewhub-core** (GitHub): AGPL-3.0
   - Full dashboard functionality
   - Self-hostable
   - Community contributions welcome

2. **crewhub-steam** (Private): Proprietary
   - Thin wrapper around core
   - Adds Steam-specific features
   - Gamification overlays
   - Never distributed outside Steam

**Legal Justification:**
- You own both codebases
- AGPL requires source distribution of modifications
- Steam version is a separate proprietary product that uses your code
- Similar to MySQL (GPL + commercial), Qt (LGPL + commercial)
- Precedent: Blender (GPL) has Steam version

**What Users Get:**

| Feature | GitHub (Free) | Steam (Paid) |
|---------|---------------|--------------|
| Core dashboard | ✅ | ✅ |
| Room management | ✅ | ✅ |
| Zen Mode | ✅ | ✅ |
| XP & Leveling | ❌ | ✅ |
| Achievements | ❌ | ✅ |
| Unlockables | ❌ | ✅ |
| Cloud saves | ❌ | ✅ |
| Workshop themes | ❌ | ✅ |
| Leaderboards | ❌ | ✅ |
| Trading cards | ❌ | ✅ |
| Auto-updates | Manual | ✅ |
| Support | Community | Priority |

### 4.2 Early Access Pricing Strategy

**Launch Price: €8.67**

**Rationale:**
- Below psychological barrier of €15
- Room for 25-50% sales discounts
- Matches while True: learn() tier
- Can increase to €16.99 at full release

**Pricing Events:**
| Event | Discount | Price |
|-------|----------|-------|
| Launch Week | 10% | €11.69 |
| Summer Sale | 25% | €9.74 |
| Winter Sale | 33% | €8.70 |
| 1.0 Release | -20% (off new price) | €13.59 |

**Bundle Options:**
- CrewHub + Soundtrack: €14.99
- CrewHub + Theme Pack DLC: €16.99 (day-one bundle)

### 4.3 Free Demo / Trial Considerations

**Options:**

**Option A: Timed Trial (Recommended)**
- Full game for 2 hours
- Save carries over if purchased
- Shows "Demo" watermark
- Achievements disabled

**Option B: Feature-Limited Demo**
- Free forever
- Only 1 room, 2 agents max
- No gamification
- Upgrade prompt after milestones

**Option C: No Demo**
- Rely on wishlists/sales
- Use Steam refund as "try before you buy"
- Lower risk of demo-only players

**Recommendation:** Option A (Timed Trial)
- Best conversion rates historically
- Shows full value proposition
- Steam's refund policy already functions as trial
- Demo builds require extra maintenance

### 4.4 DLC Potential

**Theme Packs (€4.99 each):**
| Pack Name | Themes Included |
|-----------|-----------------|
| Retro Terminal Pack | Amber CRT, Green Phosphor, IBM 3270 |
| Vaporwave Pack | Aesthetic, Outrun, Synthwave |
| Nature Pack | Forest, Ocean, Sunset |
| Seasonal Pack | Halloween, Winter, Spring |

**Premium Environments (€6.99 each):**
- Cyberpunk Apartment
- Space Station
- Cozy Cabin
- Japanese Garden
- Hacker Den

**Expansion: CrewHub Stories (€9.99)**
- Narrative mode with agent "adventures"
- Puzzle challenges using real agent interactions
- Unique storyline and endings
- New achievements

**Soundtrack (€4.99):**
- Lo-fi beats compilation
- Ambient work music
- Retro synth tracks
- Available as DLC and standalone

---

## 5. Steam Store Presence

### 5.1 Store Page Requirements

**Required Assets:**

| Asset | Size | Purpose |
|-------|------|---------|
| Header Capsule | 460×215 | Store browsing |
| Small Capsule | 231×87 | Wishlist, library |
| Main Capsule | 616×353 | Store page hero |
| Library Hero | 600×900 | Steam library view |
| Library Logo | 600×900 (transparent) | Library overlay |
| Page Background | 1438×810 | Store page BG |
| Screenshots | 1920×1080 (5+ required) | Gallery |

**Store Description Structure:**
```
[HEADER IMAGE]

CrewHub: Command Center for AI Agents

"Getting real work done doesn't have to be boring."

CrewHub transforms your AI agent workflow into a gaming experience.
Watch your agents work in real-time, earn XP for completed tasks,
unlock themes and achievements, and become the ultimate AI Commander.

[KEY FEATURES]
🤖 Real-time agent monitoring with 3D visualization
🎮 XP, levels, and 50+ achievements
🎨 10+ themes with Workshop mod support
📊 Statistics, leaderboards, and challenges
☁️ Steam Cloud saves across devices

[EARLY ACCESS NOTE]
We're building CrewHub with our community. Join Early Access to...
```

### 5.2 Trailer/Video Needs

**Launch Trailer (60-90 seconds):**

```
0:00-0:10  Hook: "What if your AI agents... could level up?"
0:10-0:30  Show 3D dashboard, agents working, real-time updates
0:30-0:45  Achievement pop-ups, XP gaining, level up animation
0:45-0:60  Theme switching, customization, Workshop glimpse
0:60-0:75  "Join Early Access" + features summary
0:75-0:90  Logo, price, release date
```

**Gameplay Preview (2-3 minutes):**
- Uncut dashboard session
- Show actual agent completing tasks
- Demonstrate Zen Mode
- Show settings and customization
- Reveal some Easter eggs

**Additional Videos:**
- Update trailers (major Early Access milestones)
- Theme showcase (30 seconds each)
- Tutorial/Getting Started (5 minutes)

**Production Notes:**
- Invest in quality audio (music + VO optional)
- Show real functionality, not mock-ups
- Capture at 60fps, 1080p minimum
- Consider professional editing for launch trailer

### 5.3 Screenshots Strategy

**10 Screenshots (Curated Order):**

1. **Hero Shot** - Full 3D dashboard with active agents (nighttime theme)
2. **Zen Mode** - Clean chat interface with Tokyo Night theme
3. **Achievement Pop** - Moment of achievement unlocking
4. **Theme Showcase** - Split view of 4 different themes
5. **Agent Stats** - Detailed agent performance view
6. **Customization** - Prop/accessory selection UI
7. **Room View** - Multiple rooms with agents
8. **Leaderboard** - Global rankings (anonymized)
9. **Workshop** - Steam Workshop browse/upload
10. **Steam Deck** - Playing on Steam Deck (lifestyle shot)

**GIF Captures (for store page):**
- Agent completing task (2-second loop)
- XP bar filling up (2-second loop)
- Theme transition (3-second loop)

### 5.4 Tags and Categories

**Primary Tags:**
- Early Access ✅
- Indie ✅
- Simulation ✅
- Casual ✅
- Strategy ✅

**Secondary Tags:**
- Automation
- Management
- Singleplayer
- Relaxing
- Programming
- Sandbox
- Steam Achievements
- Steam Cloud
- Steam Workshop
- Controller Support
- Steam Deck Verified

**Categories:**
- Genre: Simulation, Strategy
- Features: Single-player, Steam Achievements, Full controller support
- VR Support: No

### 5.5 Community Hub Setup

**Discussion Forums (Create these boards):**
- General Discussion
- Feature Requests
- Bug Reports
- Show Off Your Setup (screenshots)
- Workshop Creations
- Guides & Tutorials

**Pre-Launch Activity:**
- Post weekly dev updates
- Engage with wishlisters
- Run community polls for feature priority
- Share behind-the-scenes content

**Steam Curator Outreach:**
- Identify 20+ curators who cover:
  - Indie games
  - Programming/tech games
  - Cozy/relaxing games
  - Productivity tools
- Send personalized pitches with review copies

---

## 6. Development Roadmap

### 6.1 Pre-Steam Launch Requirements

**Must-Have (P0):**
- [ ] Steamworks SDK integration (auth, achievements, cloud)
- [ ] Electron packaging with Steam support
- [ ] XP and leveling system
- [ ] 30 achievements implemented
- [ ] 5 themes fully designed
- [ ] Basic 3D props system
- [ ] Steam Cloud save/load
- [ ] Controller support (basic)
- [ ] Linux build testing

**Should-Have (P1):**
- [ ] Steam Deck testing and optimization
- [ ] Workshop upload/download for themes
- [ ] 10 more achievements (40 total)
- [ ] Daily challenges system
- [ ] Settings persistence
- [ ] Tutorial/onboarding flow

**Nice-to-Have (P2):**
- [ ] Leaderboards (can add in EA update)
- [ ] Trading cards (requires sales data)
- [ ] Premium props
- [ ] Sound pack system

### 6.2 Phased Early Access Plan

**Phase 1: Foundation (Months 1-2)**
"Core Experience"
- Launch with base features
- 30 achievements, 5 themes
- Basic gamification (XP, levels)
- Collect feedback on core loop
- Fix critical bugs rapidly
- Weekly patches

**Phase 2: Expansion (Months 3-4)**
"More to Do"
- Add 20 more achievements
- Weekly challenges system
- 5 additional themes
- First DLC (Theme Pack)
- Workshop for themes
- Leaderboards (opt-in)

**Phase 3: Polish (Months 5-6)**
"Quality of Life"
- Steam Deck Verified push
- Performance optimization
- Accessibility improvements
- Community-requested features
- Trading cards unlock
- More Workshop content types

**Phase 4: 1.0 (Month 7-8)**
"Full Release"
- Feature complete
- Price increase to €16.99
- Launch trailer update
- PR push for 1.0
- Post-launch content roadmap

### 6.3 Community Feedback Integration

**Feedback Channels:**
1. Steam Discussions (official)
2. Discord server (real-time)
3. In-game feedback form
4. GitHub issues (for open source core)
5. Reddit (r/crewhub if created)

**Triage Process:**
```
Weekly Review
├── Bug Reports → Prioritize by severity
├── Feature Requests → Add to roadmap board
├── Balance Feedback → Track patterns
└── Praise → Share with team, use in marketing
```

**Community Influence:**
- Monthly polls for feature priority
- "Community Choice" theme (voted on)
- Beta branch for early testers
- Top contributors get special flair

### 6.4 Full Release Criteria

**1.0 Release Checklist:**
- [ ] All 50 launch achievements implemented
- [ ] 10+ themes (5 unlockable, 5 Workshop)
- [ ] 20+ props with unlock conditions
- [ ] Weekly challenges stable for 4+ weeks
- [ ] Leaderboards running smoothly
- [ ] Workshop moderation process established
- [ ] No P0/P1 bugs open
- [ ] Steam Deck Verified status
- [ ] Positive review ratio >80%
- [ ] 2,000+ reviews total
- [ ] 30-day retention >25%
- [ ] Monetization DLC available

---

## 7. Risks and Challenges

### 7.1 Open Source vs Paid Concerns

**Risk:** Community backlash for charging for "open source" software.

**Mitigation:**
- Crystal clear messaging: Steam = gamification layer, not core
- GitHub version remains fully functional
- Contributors get free Steam keys
- Acknowledge community in credits
- Be transparent about what's exclusive

**Messaging Template:**
> "CrewHub Core is and always will be open source. The Steam version adds gamification, achievements, and Steam features for players who want that experience. Both versions coexist—choose what works for you."

### 7.2 Steam Review Bombing Risks

**Potential Triggers:**
- Price changes without notice
- Broken update
- Controversial decision
- External drama (unrelated to product)

**Prevention:**
- 2-week notice before any price increase
- Beta branch for update testing
- Stay apolitical in official communications
- Quick response to legitimate criticism

**Response Plan:**
1. Don't panic - steam reviews recover
2. Acknowledge the issue publicly
3. Fix if fixable, explain if not
4. Post update showing resolution
5. Move on (don't dwell)

### 7.3 Technical Support Burden

**Expected Issues:**
- SSE connection drops
- Steam Cloud conflicts
- Linux dependency issues
- Steam Deck quirks
- Workshop content problems

**Support Strategy:**
- Comprehensive FAQ/Knowledge Base
- In-game diagnostics (exportable logs)
- Auto-crash reporting (opt-in)
- Discord bot for common issues
- Limit direct email to critical issues

**Self-Service Tools:**
- Connection diagnostic in settings
- "Reset to defaults" option
- Force sync cloud saves
- Validate local files via Steam

### 7.4 Competition Analysis

**Direct Competitors (AI Agent Dashboards):**
- Currently: None on Steam (first mover advantage!)
- Potential: Big tech companies (Anthropic, OpenAI) could build dashboards
- Risk: They'd likely be free/integrated

**Indirect Competitors:**
| Competitor | Threat Level | Our Advantage |
|------------|--------------|---------------|
| Terminal UIs | Low | Visual, gamified |
| VSCode extensions | Medium | Dedicated experience |
| Web dashboards | Medium | Native + Steam features |
| Future official tools | High | Community, Workshop, independence |

**Competitive Moat:**
- First to market on Steam
- Gamification (hard to replicate in productivity tools)
- Workshop ecosystem (community lock-in)
- Cross-provider support (not locked to one AI company)
- Independent (no corporate agenda)

---

## 8. Marketing Strategy

### 8.1 Pre-Launch Wishlists Campaign

**Goal:** 5,000 wishlists before Early Access launch

**Timeline:**
| Phase | Timing | Target Wishlists |
|-------|--------|------------------|
| Announcement | T-12 weeks | 500 |
| Teaser Trailer | T-8 weeks | 1,500 |
| Demo/Beta | T-4 weeks | 3,000 |
| Launch Week | T-0 | 5,000 |

**Wishlist Growth Tactics:**
1. **Steam Store Page Up Early** - Let organic discovery work
2. **"Coming Soon" Announcements** - Cross-post everywhere
3. **Email List** - crewhub.dev signup converts to wishlists
4. **Demo/Festival** - Apply for Steam Next Fest
5. **Content Creator Previews** - Keys to influencers
6. **Reddit/HN Posts** - "Show HN: I made..."
7. **Twitter/X Devlogs** - Build in public

### 8.2 Developer Community Outreach

**Target Communities:**
| Platform | Community | Size | Approach |
|----------|-----------|------|----------|
| Reddit | r/programming | 6M | Launch post |
| Reddit | r/indiegaming | 500K | Regular updates |
| Reddit | r/gamedev | 1.5M | Development insights |
| Reddit | r/ClaudeAI | 100K+ | Direct audience |
| Hacker News | Tech | 500K+ | Show HN launch |
| Twitter/X | Indie gamedev | Varies | Devlog threads |
| Discord | Coding servers | Varies | Bot integrations |
| YouTube | Programming channels | Varies | Sponsorships |

**Key Messages:**
- "Made by developers, for developers"
- "Your agents work hard. Let them level up."
- "The first gamified AI agent command center"
- "Open source core, Steam for the full experience"

### 8.3 Content Creator Partnerships

**Tier 1: Programming YouTubers**
- Fireship (2M+ subs) - Tech overview style
- ThePrimeagen (800K+) - Developer commentary
- Code Bullet (4M+) - AI/bot focused
- NetworkChuck (3M+) - Hacking/tech aesthetic

**Tier 2: Indie Game Channels**
- SplatterCatGaming (500K+) - Indie coverage
- Wanderbots (200K+) - Indie let's plays
- RetroGrade (100K+) - Niche gaming

**Tier 3: Streamers**
- Target: Programmers who stream
- Coding + gaming crossover audience
- Offer beta access, exclusive content

**Partnership Types:**
| Type | Cost | Value |
|------|------|-------|
| Sponsored video | $1-10K | High reach |
| Free key + hope | Free | Variable |
| Affiliate link | Revenue share | Aligned incentives |
| Discord integration | Free/trade | Community building |

### 8.4 Launch Timing

**Best Launch Windows:**
| Period | Pros | Cons |
|--------|------|------|
| January | Post-holiday money, resolutions | Steam sale hangover |
| March-April | Clear of major releases | Quiet media period |
| **September** | Back to work/school | Crowded fall releases |
| **October** | Pre-holiday buildup | Same as September |

**Avoid:**
- Steam Summer Sale week (June)
- Steam Winter Sale week (December)
- Major AAA release weeks
- E3/Game Awards proximity (attention elsewhere)

**Recommended:** Late September or October 2026
- Developers back from summer vacation
- "Productivity season" mindset
- Before holiday rush
- Time for Early Access updates before year-end

**Launch Day Strategy:**
1. Update Steam page with final assets (T-24h)
2. Press release to gaming outlets (T-12h)
3. Launch at 10 AM PT (Steam optimal time)
4. Post to Reddit/HN (T+1h)
5. Email newsletter to subscribers (T+2h)
6. Stream launch party on Discord/Twitch (T+4h)
7. Engage all day in discussions
8. First patch within 48h (show responsiveness)

---

## 9. Financial Projections

### 9.1 Revenue Scenarios

**Conservative Scenario:**
- 2,000 units Year 1
- Average sale price: €10 (discounts)
- Gross: €20,000
- Net after Steam 30%: €14,000

**Moderate Scenario:**
- 8,000 units Year 1
- Average sale price: €11
- Gross: €88,000
- Net after Steam 30%: €61,600

**Optimistic Scenario:**
- 25,000 units Year 1
- Average sale price: €12
- Gross: €300,000
- Net after Steam 30%: €210,000

### 9.2 Cost Estimates

**Pre-Launch:**
| Item | Cost |
|------|------|
| Steam Direct fee | €100 (one-time) |
| Trailer production | €500-2,000 |
| Art assets | €500-1,000 |
| Marketing budget | €1,000-5,000 |
| **Total** | **€2,100-8,100** |

**Ongoing (Monthly):**
| Item | Cost |
|------|------|
| Hosting (if any backend) | €50-200 |
| Support tools | €0-50 |
| Marketing | €0-500 |
| **Total** | **€50-750** |

### 9.3 Break-Even Analysis

**At Conservative (€14,000 net):**
- Covers development costs
- Minimal profit margin
- Validates market, informs decisions

**At Moderate (€61,600 net):**
- Comfortable profit
- Fund further development
- Consider part-time focus

**At Optimistic (€210,000 net):**
- Full-time viable
- Hire help possible
- Expand product line

---

## 10. Next Steps

### Immediate Actions (Next 2 Weeks)

1. **Technical Validation**
   - [ ] Prototype Steamworks integration with Greenworks
   - [ ] Test Electron packaging for all platforms
   - [ ] Verify Steam Deck basic functionality

2. **Design Finalization**
   - [ ] Finalize achievement list (50 items)
   - [ ] Design XP curve and level progression
   - [ ] Create theme token specifications

3. **Business Setup**
   - [ ] Register Steamworks developer account
   - [ ] Pay Steam Direct fee (€100)
   - [ ] Set up store page (Coming Soon)

### 30-Day Milestones

- [ ] Steam store page live (Coming Soon)
- [ ] First working Steamworks build
- [ ] 500 wishlists
- [ ] Trailer storyboard complete
- [ ] Achievement system functional
- [ ] First theme pack designed

### 90-Day Milestones

- [ ] 2,000 wishlists
- [ ] Steam Deck testing complete
- [ ] Workshop integration working
- [ ] Beta testing with 50 users
- [ ] Marketing materials ready
- [ ] Launch date announced

---

## Appendix A: Reference Links

**Steam Documentation:**
- [Steamworks Documentation](https://partner.steamgames.com/doc/home)
- [Early Access Best Practices](https://partner.steamgames.com/doc/store/earlyaccess)
- [Steam Workshop Guide](https://partner.steamgames.com/doc/features/workshop)
- [Open Source on Steam](https://partner.steamgames.com/doc/sdk/uploading/distributing_opensource)

**Competitor Store Pages:**
- [TIS-100](https://store.steampowered.com/app/370360/TIS100/)
- [EXAPUNKS](https://store.steampowered.com/app/716490/EXAPUNKS/)
- [while True: learn()](https://store.steampowered.com/app/619150/while_True_learn/)
- [Hacknet](https://store.steampowered.com/app/365450/Hacknet/)

**Technical References:**
- [Greenworks (Electron + Steam)](https://github.com/nicholasrq/greenworks)
- [Electron Steam Deck Guide](https://brainhub.eu/library/making-electron-apps-steam-deck-compatible)
- [steamworks-rs (Tauri)](https://github.com/Noxime/steamworks-rs)

---

## Appendix B: Achievement List (Draft)

| ID | Name | Description | Rarity |
|----|------|-------------|--------|
| 1 | First Steps | Complete your first task | Common |
| 2 | Warming Up | Complete 10 tasks | Common |
| 3 | Getting Started | Complete 50 tasks | Common |
| 4 | Century | Complete 100 tasks | Uncommon |
| 5 | Productive | Complete 500 tasks | Uncommon |
| 6 | Thousand | Complete 1,000 tasks | Rare |
| 7 | Dedicated | Complete 5,000 tasks | Rare |
| 8 | Workaholic | Complete 10,000 tasks | Epic |
| 9 | Infinite Machine | Complete 100,000 tasks | Legendary |
| 10 | First Session | Start your first agent session | Common |
| 11 | Crew Builder | Have 5 agents running simultaneously | Uncommon |
| 12 | The Collective | Have 10 agents running simultaneously | Rare |
| 13 | Swarm Controller | Have 25 agents running simultaneously | Epic |
| 14 | Level 10 | Reach Commander level 10 | Common |
| 15 | Level 25 | Reach Commander level 25 | Uncommon |
| 16 | Level 50 | Reach Commander level 50 | Rare |
| 17 | Level 75 | Reach Commander level 75 | Epic |
| 18 | Level 100 | Reach Commander level 100 | Legendary |
| 19 | Prestige I | Prestige for the first time | Rare |
| 20 | Streak 7 | Maintain a 7-day login streak | Uncommon |
| 21 | Streak 30 | Maintain a 30-day login streak | Rare |
| 22 | Streak 100 | Maintain a 100-day login streak | Epic |
| 23 | Early Bird | Complete a task before 6 AM | Uncommon |
| 24 | Night Owl | Complete a task after midnight | Uncommon |
| 25 | Speed Demon | Complete a task in under 30 seconds | Uncommon |
| 26 | Marathon | Single session lasting 24 hours | Rare |
| 27 | Tool Master | Use 10 different tool types | Uncommon |
| 28 | Editor Pro | 1,000 file edits | Rare |
| 29 | Shell Master | 1,000 exec calls | Rare |
| 30 | Web Crawler | 500 web searches | Rare |
| 31 | Theme Collector | Unlock 5 themes | Uncommon |
| 32 | Decorator | Unlock 10 props | Uncommon |
| 33 | Stylist | Dress an agent with 5 accessories | Rare |
| 34 | Challenge Accepted | Complete first daily challenge | Common |
| 35 | Weekly Warrior | Complete all weekly challenges | Rare |
| 36 | Perfect Week | Complete all dailies for 7 days | Rare |
| 37 | Top 100 | Reach global top 100 leaderboard | Epic |
| 38 | Social | Connect with 10 Steam friends | Uncommon |
| 39 | Workshop Creator | Upload first Workshop item | Rare |
| 40 | Workshop Star | Get 100 subscribers on Workshop item | Epic |
| 41 | Zero Errors | 50 tasks in a row without failure | Rare |
| 42 | Perfectionist | Achieve 99% success rate (100+ tasks) | Epic |
| 43 | Founder | Play during Early Access | Unique |
| 44 | Day One | Play on release day | Rare |
| 45 | Zen Master | Spend 10 hours in Zen Mode | Rare |
| 46 | Minimalist | Complete 100 tasks with default theme | Uncommon |
| 47 | Room Manager | Create 5 rooms | Uncommon |
| 48 | Secret Cat | Find the cat Easter egg | Secret |
| 49 | Hello World | Complete first coding task | Common |
| 50 | The End? | Complete the hidden story | Secret |

---

*Document last updated: February 7, 2026*
*Author: CrewHub Development Team*
*Classification: Internal Strategy Document*
