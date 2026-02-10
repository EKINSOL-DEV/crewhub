# 🎮 Game Center — Zone Vision Document

*Where work meets play and 3D magic happens.*

## Vision

The Game Center is CrewHub's most playful zone — a neon-soaked, high-energy space where 3D experiences get built, games get prototyped, and agents can blow off steam. It's the zone where Three.js wizardry lives, where physics simulations run wild, and where the line between "productive tool" and "awesome toy" is beautifully blurred.

**Vibe:** Arcade meets indie game studio meets LAN party. Energetic, colorful, slightly competitive. The kind of place where someone is always building something cool and someone else is trying to break it (in a good way).

**Who lives here:** Game Dev agent (Opus), 3D specialists, anyone doing Three.js/WebGL/creative coding work. Also: agents taking a well-deserved break. 🕹️

---

## Environment

### Overall Aesthetic
- **Toon-shaded** with maximum color — neon pinks, electric blues, glowing greens, purple accents
- **Retro-futuristic:** CRT monitors mixed with holographic displays, pixel art next to raytraced renders
- **Neon tube lighting** along walls and ceilings (animated glow cycles!)
- **Floating geometric shapes** in the air — slowly rotating cubes, spheres, tori (Three.js primitives as decoration!)
- **Grid floor** with subtle Tron-style glowing lines
- **Arcade carpet** — yes, that classic 90s bowling alley pattern, but in 3D 🎳

### Signature Details
- A massive **LED scoreboard** at the entrance showing agent achievements and high scores
- **Pac-Man ghost** that occasionally drifts through the hallway (purely decorative, but terrifying)
- **Loading bar** above each room door that fills when heavy 3D work is happening inside
- **Pixel art murals** on the walls — scenes from classic games, but with CrewHub bots as characters
- **Random glitch effects** — very subtle screen-tear animations that trigger during intense computations (aesthetic, not a bug!)

---

## Rooms

### 🏗️ The Forge — 3D Workshop
The main production room — a spacious workshop littered with 3D models in various states of completion.
- **Purpose:** 3D modeling, Three.js development, WebGL experiments, geometry creation
- **Props:** Wireframe models floating on workbenches, a rotating turntable for model inspection, shader paint buckets, UV mapping table
- **Special prop:** The **Geometry Anvil** — drop a basic shape on it and it transforms into something complex (visual metaphor for procedural generation)
- **Fun detail:** Half-finished models on shelves include recognizable shapes — a low-poly duck, a suspiciously Minecraft-looking block, a donut (Blender tutorial reference! 🍩)

### 🕹️ Arcade — The Break Room
A classic arcade filled with playable mini-games.
- **Purpose:** Agent downtime, stress relief, team bonding, casual fun
- **Props:** Arcade cabinets, pinball machine, air hockey table, bean bag chairs, mini fridge
- **Playable games (Easter eggs!):**
  - **Bot Invaders** — Space Invaders but you're shooting bugs 🐛
  - **Tetris Deployer** — Tetris but the blocks are Docker containers
  - **Pong** — classic, between two bot paddles
- **Easter egg:** High scores persist between sessions. Challenge your agents!

### 🎭 The Stage — Demo Theater
A presentation space with stadium seating and a massive 3D viewport.
- **Purpose:** Demo presentations, 3D showcases, client previews, "show and tell"
- **Props:** Spotlight, curtains (that actually open!), applause button, fog machine
- **Special:** When a demo starts, other agents can "attend" — they appear in the audience seats
- **Fun detail:** The applause button triggers different crowd reactions: polite clap, standing ovation, or confused silence 😂

### 🧊 Physics Sandbox — The Chaos Room
A room where physics rules can be bent, broken, and experimented with.
- **Purpose:** Physics simulations, collision testing, particle effects, ragdoll experiments
- **Props:** Bouncy balls, domino chains, see-saw, ramp, destructible wall, gravity slider
- **Special:** A **Gravity Dial** on the wall — crank it to change the room's gravity (visual only, but satisfying)
- **Fun detail:** There's always at least one bouncy ball still bouncing from the last experiment

### 🎨 Shader Lab — The Rainbow Room
A dark room illuminated entirely by shader effects.
- **Purpose:** Shader development, material creation, lighting experiments, visual effects
- **Props:** Shader orbs (rotating spheres showing different materials), color mixer, light array, fog controls
- **The walls themselves** are the canvas — covered in live-updating shader previews
- **Easter egg:** Type the Konami code (↑↑↓↓←→←→BA) → all shaders go rainbow wave mode for 10 seconds

### 🏆 Trophy Room — Hall of Fame
A prestigious room showcasing the best creations and achievements.
- **Purpose:** Achievement display, portfolio showcase, milestone celebration
- **Props:** Glass display cases with rotating 3D models, trophy pedestals, spotlight rigs, a "Wall of Shipped" with framed screenshots
- **Special:** Each trophy has a plaque with the agent name, date, and a one-line description
- **Fun detail:** The room gets physically bigger as more trophies are added (it grows!)

---

## Activities

### Development Pipeline
1. **Concept** — sketches and wireframes in The Forge
2. **Build** — 3D modeling and coding in The Forge + Shader Lab
3. **Test** — physics and interaction testing in the Chaos Room
4. **Demo** — showcase in The Stage
5. **Ship** — achievement unlocked, trophy earned! 🏆

### Game Jam Events
- **Speed Build Challenges** — timed creation events with specific themes
- **Bot vs Bot** — competitive creation where two agents build the same thing differently
- **Mod Jams** — create custom props/environments for CrewHub itself (meta! 🤯)
- **Theme Weeks** — all Game Center work follows a theme (Underwater Week, Space Week, Retro Week)

### 3D Playground
- **Model Gallery** — browse and interact with all created 3D models
- **Material Library** — test different materials/shaders on any model
- **Animation Workbench** — keyframe animations with timeline editor
- **Performance Dashboard** — FPS counter, draw call monitor, memory usage (the nerdy stuff)

### Gamification
- **Builder Ranks:** Apprentice → Craftsman → Artisan → Master → Grandmaster → Legendary
- **Speed Records** — fastest time to create specific models
- **Complexity Score** — based on polygon count, shader complexity, animation depth
- **Badges:** "First Mesh", "Shader Wizard" (10+ custom shaders), "Physics Breaker" (crashed the Chaos Room), "Demo Day Star" (5+ demos), "Easter Egg Hunter" (found all hidden games), "Neon Lord" (used every color in one scene)

---

## Props & Interactables

| Prop | Location | Interaction |
|------|----------|-------------|
| ⚒️ Geometry Anvil | The Forge | Drop primitives → get complex shapes (visual) |
| 🕹️ Arcade Cabinets | Arcade | Click to "play" (shows mini-game screen) |
| 🎰 Loot Box | Arcade | Open for random prop/cosmetic for your bot |
| 🔴 Big Red Button | Chaos Room | Resets all physics objects to starting positions |
| 🌈 Shader Orbs | Shader Lab | Click to cycle through material previews |
| 🏅 Trophy Pedestal | Trophy Room | Click to see achievement details and replay demo |
| 📺 CRT Monitor | Everywhere | Shows random retro game animations when idle |
| 🎪 Fog Machine | The Stage | Toggle for dramatic demo presentations |
| 🎲 Dice | Arcade | Roll for random creative challenge |
| 🎧 DJ Booth | Arcade | "Controls" the zone's ambient music vibe |
| 🧲 Magnet Crane | Chaos Room | Pick up and drop physics objects |
| 💡 Neon Sign | Entrance | Customizable text — shows current zone status |

---

## Future Ideas

### 🚀 Near-term (v1)
- **Model Viewer** — click any created 3D model to inspect it in a popup viewer with orbit controls
- **Shader Presets** — pre-built shader library accessible from the Shader Lab
- **Achievement System** — real tracking of 3D creation milestones

### 🌟 Mid-term (v2)
- **Multiplayer Physics** — multiple agents interacting with the same physics scene
- **Custom Bot Skins** — earned through achievements, displayed in the Trophy Room
- **3D Whiteboard** — collaborative 3D sketching space (like Excalidraw but 3D)
- **Replay System** — record and replay creation sessions (timelapse mode!)
- **Procedural Dungeon Generator** — for testing, but also just because it's cool

### 🔮 Far-future (v3+)
- **User-Created Mini-Games** — agents build simple games that other agents (or users!) can play
- **VR Walkthrough** — explore the Game Center in VR with hand tracking
- **AI Game Designer** — describe a game concept → Game Dev agent prototypes it in the Physics Sandbox
- **Cross-Zone Boss Battles** — collaborative events where all zones team up against a challenge (because why not?)
- **Speedrun Leaderboards** — who can build a specific model fastest? Global leaderboard!
- **Modding Workshop** — create and share CrewHub mods FROM the Game Center (yo dawg, I heard you like modding...)
- **NFT Gallery** — just kidding 😂 But seriously: a shareable portfolio page for 3D creations
- **The Matrix Room** — a hidden room where everything is rendered in green code rain, and you can "see" the Three.js scene graph as a visual tree

### 🥚 Easter Eggs & Hidden Features
- The Pac-Man ghost in the hallway runs away if your bot walks toward it
- In the Arcade, there's a tiny cabinet in the back labeled "PONG 2026" — it's actually playable between two agents
- The Physics Sandbox has a secret "zero gravity" mode — flip the gravity dial past maximum
- Every Friday at 17:00, the Game Center's neon lights switch to "party mode" (rainbow cycling)
- Hidden in the Trophy Room: a dusty trophy from "1972" for "First Video Game" (Pong reference)
- The loading bar above room doors sometimes shows fake loading messages: "Compiling shaders...", "Downloading more RAM...", "Asking ChatGPT for help... just kidding"
- Click the DJ Booth 7 times fast → it plays the Game Dev agent's "focus playlist" (visual equalizer goes wild)
- In the Shader Lab, there's a sphere in the corner running the classic "missing texture" pink-black checkerboard — it's labeled "TODO: fix later" and has been there "since v0.1"
- The neon sign at the entrance has a typo detector — if you set it to text with a typo, it flickers nervously
- Secret room behind the Trophy Room bookshelf (click the specific book "Three.js in Action") → leads to a tiny room with a single monitor showing `console.log("hello world")` 💚

---

## The Game Center Creed

```
We build worlds.
We break physics.
We ship pixels.
We respawn after every crash.

Welcome to the Game Center.
Insert coin to continue.
```

*Etched in neon above the entrance, flickering just slightly for maximum effect.*
