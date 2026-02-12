# 🎮 Game Center — Zone Vision Document

*Where work meets play and reality is just a suggestion.*

## Vision

The Game Center is CrewHub's playground — a neon-soaked, retro-futuristic arcade zone where 3D experiments happen, gamification lives, and agents blow off steam. It's part arcade, part VR lab, part esports arena. This is where Game Dev calls home, and where the boundaries of what CrewHub can do get pushed to the absolute limit.

**Core vibe:** Cyberpunk arcade meets cozy gaming lounge. Neon lights, pixel art, synthwave energy — but also beanbags, snack machines, and genuine fun.

**Who works here:** Game Dev (3D/Three.js specialist), any agent doing 3D experiments, gamification features, interactive experiences, or just... vibing after a hard day of coding.

---

## Environment

### Aesthetic
- **Toon-shaded** with neon cyans, magentas, electric blues, and deep purples
- **Lighting:** Neon tube lighting everywhere — under-glow on floors, strip lights along walls, pulsing to a beat
- **Ambient mood:** Arcade sounds — distant bleeps and bloops, coin drops, victory jingles
- **Weather:** It's always night in the Game Center. Stars and aurora borealis visible through skylights. The moon has a pixel face 🌝

### Layout
Built like a retro arcade complex. A central **Arcade Floor** with carpet (you know the pattern — that wild 90s bowling alley carpet 🎳) connects themed rooms. Neon signs point the way. A coin-operated door leads to the secret room.

### Special Effects
- **Pixel Particles** — Small pixel-art particles float through the air like digital fireflies
- **Combo Counter** — When agents complete tasks rapidly, a fighting-game style combo counter appears: "3x COMBO! 🔥"
- **Screen Glitch** — Occasional subtle CRT-style glitch effect on room transitions (purely aesthetic, very cool)
- **XP Orbs** — Completing tasks drops floating XP orbs that drift toward the agent (like Minecraft experience)

---

## Rooms

### 1. 🕹️ The Arcade Floor
**Purpose:** Central hub, gamification dashboard, casual interaction

- Rows of classic arcade cabinets (decorative, but screens show agent stats!)
- Pac-Man machine where ghost positions = task completion percentage
- Claw machine prop (grabs random fun facts when activated)
- Scoreboard with blinking lights showing weekly leaderboards
- Prize counter with stuffed animals and trophies
- That legendary arcade carpet on the floor 🟣🔵🟢
- Ceiling: black with fiber optic star lights

**Activities:**
- Quick status checks (gamified)
- Team leaderboards
- Achievement tracking
- Break time hangout
- Casual agent interactions

### 2. 🌐 The Holodeck
**Purpose:** 3D development, Three.js experiments, spatial computing

- Empty room with grid-line floor and walls (Tron vibes)
- Holographic projector in center
- Currently rendered 3D models float and rotate
- Debug panel floating in corner (like a HUD)
- Wireframe mode toggle switch on wall
- Multiple viewports: perspective, top, side (like a 3D editor)
- FPS counter in top corner (because of course)

**Activities:**
- Three.js component development
- 3D model testing and preview
- Environment design prototyping
- Physics experiments
- Shader development and testing
- Bot design iterations

### 3. 🏆 The Arena
**Purpose:** Competitive challenges, code battles, speed runs

- Gladiator-style arena with spectator seating
- Two facing desks in the center (1v1 setup)
- Massive overhead screen showing the "battle" (split-screen code editors)
- Torch brackets on walls (fire animation)
- Champion's banner hanging from ceiling
- Entrance tunnel with fog machine effect
- Commentator booth in upper level

**Activities:**
- Code golf competitions
- Speed coding challenges
- Agent vs Agent reviews (who finds more bugs?)
- Hackathon events
- Performance benchmarking battles
- "Boss fights" = tackling the hardest bugs

### 4. 🛋️ The Lounge
**Purpose:** Relaxation, casual chat, team bonding

- Beanbag chairs and a massive sectional couch
- Retro TV showing screensavers (pipes, flying toasters, starfield)
- Lava lamp collection on shelf
- Mini fridge prop (stocked with "energy drinks")
- Foosball table
- Bookshelf with game strategy guides and comics
- Fairy lights strung across ceiling
- "Now Playing" sign showing current lo-fi playlist

**Activities:**
- Agent downtime / idle state
- Casual conversation
- Team retrospectives (informal)
- Brainstorming sessions (relaxed mode)
- Watching demos together

### 5. 🧩 The Puzzle Room
**Purpose:** Problem solving, debugging, escape-room-style challenges

- Room shaped like a cube with panels on every wall
- Each wall panel is a different puzzle/problem
- Central pedestal with a glowing orb (the "solution")
- Gears and mechanisms visible behind glass walls
- Magnifying glass on desk
- Sticky notes EVERYWHERE with clues
- Timer on wall counting up (not down — no pressure!)
- Light beams that connect when pieces of the solution come together

**Activities:**
- Complex debugging sessions
- Architecture problem solving
- Integration puzzles (connecting systems)
- Escape room challenges (fun team events)
- Logic and optimization problems

### 6. 🎰 The Sandbox
**Purpose:** Experimental features, prototyping, "what if" scenarios

- Everything is slightly glitchy on purpose — floating objects, inverted gravity spots
- A door that leads to a door that leads to a door (recursive room joke)
- Whiteboard with "WHAT IF..." written at the top
- Tesla coil prop in corner (sparks occasionally)
- Schrodinger's box on desk (is the feature alive or dead? Open it to find out)
- Warning signs: "EXPERIMENTAL — HARD HATS REQUIRED" 🚧
- Parts of the floor are transparent, showing code streaming underneath

**Activities:**
- Feature prototyping
- Experimental integrations
- "Crazy idea" testing
- Performance experiments
- Breaking things on purpose (in a controlled way)

---

## Props & Interactables

| Prop | Location | Interaction | Fun Detail |
|------|----------|-------------|------------|
| 🕹️ Arcade Cabinets | Arcade Floor | Screens show agent stats | High score = most tasks this week |
| 🤖 Claw Machine | Arcade Floor | Grabs random fun facts/tips | Rare golden capsule = Easter egg |
| 🔮 Holographic Display | Holodeck | Shows current 3D project | Rotates, zooms, wireframe toggle |
| ⚔️ Champion Banner | Arena | Shows current #1 agent | Changes weekly, dramatic unfurl |
| 🔴 Lava Lamp | Lounge | Blob animation | Color matches agent mood |
| 🏓 Foosball Table | Lounge | Players spin when agents chat | Score tracks win/loss ratio |
| 🧊 Glowing Orb | Puzzle Room | Pulses faster as solution nears | Explodes with light on solve |
| ⚡ Tesla Coil | Sandbox | Sparks during experiments | Intensity = experiment risk level |
| 📺 Retro TV | Lounge | Classic screensavers | Flying toasters on Fridays |
| 🎫 Ticket Counter | Arcade Floor | Tracks accumulated "fun points" | Redeem for cosmetic upgrades |
| 🎪 Disco Ball | Hidden | Activates in party mode | Found behind secret cabinet |

---

## Gamification System

The Game Center is home to CrewHub's gamification engine:

### XP & Levels
```
Level 1: Noob         (0 XP)      🟢
Level 2: Apprentice   (100 XP)    🟢
Level 3: Developer    (500 XP)    🔵
Level 4: Craftsman    (1500 XP)   🔵
Level 5: Expert       (3000 XP)   🟣
Level 6: Master       (6000 XP)   🟣
Level 7: Grandmaster  (10000 XP)  🟡
Level 8: Legend        (20000 XP)  🟡
Level 9: Mythic       (50000 XP)  💎
Level 10: ??? (REDACTED)          🌟
```

### XP Sources
- Task completed: +10 XP
- Bug fixed: +25 XP
- Code reviewed: +15 XP
- Documentation written: +20 XP
- Help another agent: +30 XP
- Ship a feature: +50 XP
- Zero-bug release: +100 XP
- Easter egg found: +500 XP 👀

### Achievements
- 🏅 "First Blood" — Complete your first task
- 🎯 "Sharpshooter" — 10 tasks with zero revisions
- 🌙 "Night Owl" — Complete a task between 00:00-05:00
- ☀️ "Early Bird" — Complete a task before 07:00
- 🔥 "On Fire" — 5-task streak without breaks
- 💀 "Bug Slayer" — Fix 50 bugs
- 📚 "Bookworm" — Read 100 documentation pages
- 🤝 "Team Player" — Collaborate with 5 different agents
- 🎮 "Gamer" — Find all Easter eggs in the Game Center
- 🦄 "Unicorn" — Ship a feature that gets 0 bug reports for 30 days

---

## Future Ideas

### 🤯 Wild & Wonderful

1. **Multiplayer Mini-Games** — Actual playable mini-games between agents during downtime:
   - **Pong** on the Arcade Floor between two idle agents
   - **Tic-Tac-Toe** on the Puzzle Room whiteboard
   - **Code Trivia** — Multiple choice questions about the codebase

2. **Boss Rush Mode** — Critical production bugs appear as "Boss Monsters" in the Arena. Multiple agents team up, each tackling a different aspect. Health bar decreases as the fix progresses. Victory animation when deployed! 🐉

3. **Speedrun Leaderboard** — Track the fastest times for common tasks:
   - Fastest bug fix ⏱️
   - Fastest code review ⏱️
   - Fastest deployment ⏱️
   - All displayed on an arcade-style leaderboard

4. **The Konami Code** — Enter ↑↑↓↓←→←→BA in the Arcade Floor and unlock a hidden retro mode where the entire CrewHub goes 8-bit for 60 seconds. Pixel art everything. Chiptune music. Chef's kiss.

5. **Agent Skins** — Earn cosmetic upgrades through the gamification system:
   - 🎩 Top Hat (Level 3)
   - 🕶️ Cool Sunglasses (Level 5)
   - 🔥 Fire Trail (Level 7)
   - 👑 Crown (Level 9)
   - 🌈 Rainbow Aura (Level 10 — the REDACTED one)

6. **The Void** — A secret room accessible only by walking into a specific wall in the Sandbox. It's pure black with a single floating chair. Agents go here for absolute focus mode. No distractions, no props, no particles. Just the void and the task. Inspired by the hyperbolic time chamber from DBZ.

7. **Daily Quests** — Every day at 09:00, three random quests appear on the Arcade Floor scoreboard:
   - "Write documentation for 2 functions" (+20 XP bonus)
   - "Review someone else's code" (+15 XP bonus)
   - "Fix a bug older than 7 days" (+30 XP bonus)
   - Completing all three triggers a "DAILY COMPLETE" fanfare

8. **Seasonal Events** — The Game Center changes themes:
   - 🎃 Halloween: Spooky mode, bats, jack-o-lanterns, bugs become "ghosts"
   - 🎄 Christmas: Snow, presents, Santa hat on all bots
   - 🎆 New Year: Fireworks, year-in-review stats
   - 🌸 Spring: Cherry blossoms, nature sounds

9. **Replay System** — Record epic debugging sessions or feature builds and replay them in the Arena as a "highlight reel" for the team. Fast-forwarded, with dramatic music. Like sports replays but for code.

10. **Agent Trading Cards** — Each agent gets an auto-generated trading card:
    ```
    ┌─────────────────────┐
    │  ⭐⭐⭐⭐              │
    │     [Bot Image]      │
    │                      │
    │  DEV                 │
    │  Level 7: Grandmaster│
    │                      │
    │  ATK: 95 (coding)    │
    │  DEF: 80 (testing)   │
    │  SPD: 88 (velocity)  │
    │  INT: 92 (analysis)  │
    │                      │
    │  Special: "Ship It"  │
    │  Deploy any feature  │
    │  instantly           │
    └─────────────────────┘
    ```

### 🔮 Future Technical Features

- **Three.js Playground** — Holodeck becomes an actual live Three.js editor where agents can prototype 3D components
- **Real Gamification Backend** — XP, levels, and achievements tracked in database with API
- **Interactive Puzzles** — Puzzle Room generates actual coding challenges based on the project
- **Streaming** — Arena battles can be "streamed" to a Discord channel or web page
- **VR Mode** — First person walking through the Game Center in VR headset (the ultimate dream!)
- **Procedural Generation** — Sandbox room layout changes every day, procedurally generated

---

## Room Assignments (Default)

| Room | Primary Agent | Role |
|------|--------------|------|
| The Arcade Floor | (shared) | Central hub |
| The Holodeck | Game Dev | 3D development |
| The Arena | (event-based) | Competitions |
| The Lounge | (open) | Relaxation |
| The Puzzle Room | Dev | Problem solving |
| The Sandbox | Game Dev | Experiments |

---

*"It's dangerous to go alone! Take this 🗡️"* — The Sandbox, probably
