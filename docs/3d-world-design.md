# CrewHub 3D World — Design Document

*Version: 1.0 — 2026-02-03*
*Status: In Development*

## Vision

Transform CrewHub's playground view into an immersive, cartoon-style 3D world where AI agents live and work. Think low-poly toon-shaded environments (Overcooked / Two Point Hospital vibes) with the colorful personality of the CrewHub logo.

The 3D world should feel alive — bots wander around their rooms, interact with props, and visually reflect their real-time status.

---

## Art Direction

### Style
- **Low-poly procedural geometry** — no external 3D models needed (v1)
- **Toon/cel shading** — `MeshToonMaterial` with gradient maps, subtle outlines
- **Warm lighting** — soft directional light + ambient, no harsh shadows
- **Color palette** — derived from CrewHub logo (orange, blue, green, purple, red, white accents)
- **Rounded shapes** — friendly, approachable (matching 2D SVG bot designs)

### Reference
- CrewHub logo: colorful robot-hub with rounded shapes, multi-color scheme
- Agent Design Lab 2D SVGs: Worker (orange), Thinker (blue), Cron (green), Comms (purple), Dev (red)
- Inspiration: Overcooked kitchen scenes, Two Point Hospital rooms, Crossy Road characters

### Camera
- **Default:** Isometric view (45° rotation, ~35° elevation)
- **Controls:** OrbitControls with constrained zoom (min/max distance), pan, rotate
- **Presets:** Per-room fly-to with smooth camera transition
- **Mini-map:** Small top-down view in corner (Phase 4)

---

## Tech Stack

- **React Three Fiber** (`@react-three/fiber`) — React renderer for Three.js
- **Drei** (`@react-three/drei`) — helpers (OrbitControls, Text, RoundedBox, Float, etc.)
- **Three.js** — core 3D engine
- **MeshToonMaterial** — toon/cel shading
- **Procedural geometry** — BoxGeometry, CylinderGeometry, SphereGeometry composed into props/rooms
- **No external models** — everything built in code for v1 (Blender models possible in v2)

---

## Architecture

### Component Hierarchy

```
<World3DView>                    // Top-level — Canvas, camera, lights, controls
├── <WorldLighting />            // Directional + ambient + optional point lights
├── <WorldFloor />               // Large ground plane with subtle grid/texture
├── <Room3D />                   // One per room — floor, walls, nameplate, props
│   ├── <RoomFloor />            // Toon-shaded floor tiles/planks
│   ├── <RoomWalls />            // Low walls (waist-height, see-through from camera)
│   ├── <RoomNameplate />        // Floating sign above room
│   ├── <RoomProps />            // Room-specific decorations
│   │   ├── <Desk />             // Desk with monitor
│   │   ├── <Whiteboard />       // For dev room
│   │   ├── <SatelliteDish />    // For comms room
│   │   ├── <ClockTower />       // For cron room
│   │   └── ...                  // More props per room theme
│   ├── <Bot3D />                // One per agent/session in this room
│   │   ├── <BotBody />          // Rounded capsule/pill body (agent color)
│   │   ├── <BotFace />          // Eyes (blinking), mouth
│   │   ├── <BotAccessory />     // Hard hat / antenna / clock / chat / gear
│   │   ├── <BotStatusGlow />    // Ground glow ring (green=active, yellow=idle, gray=sleeping)
│   │   ├── <BotBubble />        // 3D speech/thought bubble (Html overlay or sprite)
│   │   └── <BotNameTag />       // Floating name label
│   └── <SubagentOrbit />        // Child sessions orbiting parent bot
└── <ParkingArea3D />            // Off to the side — bench, coffee machine, ZZZ particles
```

### State Flow

```
Gateway SSE → useSessionsStream → sessions[]
                                      ↓
                             useAgentsRegistry → agentRuntimes[]
                                      ↓
                                useRooms → rooms[]
                                      ↓
                              World3DView renders:
                              - Room3D per room (with assigned agents/sessions)
                              - Bot3D per agent/session
                              - ParkingArea3D for overflow
```

### Integration Points
- Reuse existing hooks: `useSessionsStream`, `useAgentsRegistry`, `useRooms`
- Reuse existing utils: `minionUtils`, `agentUtils`, `friendlyNames`
- LogViewer opens on bot click (same as 2D view)
- Drag & drop: `@dnd-kit` may not work in 3D — use raycasting click-to-select + click-room-to-move

---

## Phases

### Phase 1: 3D Room Foundation ⬅️ CURRENT

**Goal:** Single room rendered in 3D with toon shading, basic props, correct camera.

**Deliverables:**
- [ ] `World3DView.tsx` — main Canvas component with lights + camera
- [ ] `WorldLighting.tsx` — directional (warm), ambient, hemisphere lights
- [ ] `Room3D.tsx` — procedural room with:
  - Toon-shaded floor (stone/wood planks, `MeshToonMaterial`)
  - Low walls (~1.5 units high, rounded top)
  - Color-coded accent (room.color on walls/floor border)
  - Nameplate floating above (room name + icon)
- [ ] `RoomProps.tsx` — 2-3 basic props per room:
  - Desk (box + thin top slab)
  - Monitor (thin box on desk)
  - Chair (cylinder + back)
  - Lamp (cylinder + sphere)
- [ ] Camera: isometric default, OrbitControls with constraints
- [ ] Toggle in App.tsx: 2D ↔ 3D (reuse existing toggle pattern)
- [ ] Ground plane outside rooms (subtle grid pattern)

**Technical:**
- All geometry procedural (BoxGeometry, CylinderGeometry, SphereGeometry)
- ToonMaterial with 3-step gradient map for cel shading
- Warm directional light at 45° angle
- Soft ambient for fill

### Phase 2: 3D Bot Characters

**Goal:** The 5 bot types as 3D low-poly characters matching the 2D SVG designs.

**Deliverables:**
- [ ] `Bot3D.tsx` — main bot component
- [ ] Body: rounded capsule/pill shape (CapsuleGeometry or composed spheres + cylinder)
- [ ] Color: matches agent type (orange/blue/green/purple/red)
- [ ] Face: two sphere eyes (with blinking animation), simple mouth arc
- [ ] Accessories (one per bot type):
  - Worker: hard hat (flattened hemisphere on top)
  - Thinker: antenna with glowing tip (cylinder + sphere)
  - Cron: small clock face on chest (circle + hands)
  - Comms: chat bubble floating near head
  - Dev: gear icon on chest (torus + spokes)
- [ ] Idle animation: gentle bobbing (Float from drei)
- [ ] Status glow: ring on ground under bot
  - Green pulse = active/working
  - Yellow steady = idle
  - Gray dim = sleeping
- [ ] Name tag: floating text below bot (drei `<Text>`)
- [ ] Size: main agents larger, subagents smaller (0.6x)

### Phase 3: Multi-Room World Layout

**Goal:** All rooms visible in a navigable 3D world.

**Deliverables:**
- [ ] Room grid layout (2x2, 3x2, etc. based on room count)
- [ ] Spacing between rooms with pathways/corridors
- [ ] Room-specific prop themes:
  - **Dev Room:** desks with monitors, whiteboard, coffee cups, code on screens
  - **Comms Room:** satellite dish, mailboxes, antenna tower, screens showing messages
  - **Cron Room:** large clock tower, gears, schedule board, timers
  - **Creative Room:** easel, paint pots, camera on tripod, mood board
  - **Default Room:** generic office furniture
- [ ] Camera fly-to: click room name → smooth camera transition to that room
- [ ] Parking area: separate zone with bench, coffee machine, dimmed lighting
- [ ] World boundaries: subtle fence or fog at edges
- [ ] Ground: grass/stone outside rooms, different floor per room

### Phase 4: Interactivity & Polish

**Goal:** Full interactivity matching (and exceeding) 2D playground.

**Deliverables:**
- [ ] **Click bot → LogViewer** (raycasting, `onClick` on Bot3D)
- [ ] **Move bot between rooms:** click bot (selected glow) → click target room → API call to reassign
- [ ] **3D speech bubbles:** Html overlay or sprite-based
  - Speech: "Working on..." / "Thinking..."
  - Thought: cloud bubble when idle
  - Alert: exclamation when error
- [ ] **Particle effects:**
  - Coding: small code characters floating up (dev bots when working)
  - Comms: envelope particles when sending messages
  - Cron: clock tick particles
  - Success: confetti burst on task complete
  - Error: red sparks
- [ ] **Bot animations:**
  - Walking between positions (lerp with bobbing)
  - Typing at desk (arm movement)
  - Sleeping: ZZZ particles, eyes closed, gentle breathing scale
  - Celebrating: jump + spin on success
- [ ] **Mini-map:** top-down orthographic camera in corner, click to navigate
- [ ] **Day/night cycle:** lighting changes based on real time (subtle, not extreme)
- [ ] **Sound effects:** optional, toggle in settings
  - Ambient office hum
  - Bot spawn pop
  - Task complete chime

---

## Bot Design Specification (3D)

### Common Body
All bots share the same base body shape — a rounded capsule/pill:

```
    ┌─────────┐
   │  (eyes)   │    ← Sphere head (top half)
   │  (mouth)  │
   ├───────────┤
   │           │    ← Cylinder torso
   │  [icon]   │    ← Chest icon/accessory
   │           │
   ├───────────┤
   │    ╱  ╲   │    ← Short legs (two small cylinders)
   └───╱────╲──┘
      ■      ■      ← Feet (small rounded boxes)
```

### Per-Bot Customization

| Bot | Color | Accessory | Chest Icon | Idle Quirk |
|-----|-------|-----------|------------|------------|
| Worker | `#FE9600` (orange) | Hard hat | Wrench | Stretches arms |
| Thinker | `#1277C3` (blue) | Antenna w/ glow | Lightbulb | Taps chin |
| Cron | `#82B30E` (green) | None | Clock face | Checks watch |
| Comms | `#9370DB` (purple) | Headset | Chat bubble | Waves |
| Dev | `#F32A1C` (red) | None | Gear | Types in air |

### Size & Scale
- Main agent bots: 1.0 unit scale
- Subagent bots: 0.6 unit scale
- Props (desk, chair): 0.8-1.2 units
- Room: ~12x12 units floor
- Wall height: 1.5 units (low enough for camera to see in)

---

## Room Design Specification

### Common Elements
Every room has:
- Floor: toon-shaded with room-specific material (stone, wood, tile)
- Low walls: colored accent strip at top matching `room.color`
- Nameplate: floating sign above entrance with room name + emoji
- Light source: warm point light inside room
- Door opening: gap in wall facing camera

### Room Themes

#### 🔧 Dev Room
- 2-3 desks with glowing monitors
- Whiteboard with "TODO" text
- Coffee cup on desk (steam particles when bot is working)
- Stack of books
- Small plant
- Floor: dark wood planks

#### 📡 Comms Room
- Satellite dish on roof/wall
- Multiple small screens
- Antenna tower
- Message board with pinned notes
- Headset stand
- Floor: blue/gray tiles

#### ⏰ Cron Room
- Large wall clock (animated hands)
- Gear mechanisms on wall
- Schedule board with checkmarks
- Hourglass on desk
- Metronome
- Floor: green stone tiles

#### 🎨 Creative Room
- Easel with canvas
- Paint pots (colorful)
- Camera on tripod
- Mood board with images
- Bean bag chair
- Floor: colorful tiles/carpet

#### 🅿️ Parking Area
- Park bench
- Coffee/vending machine
- Street lamp
- Small garden
- "Break Room" sign
- Dimmed ambient lighting
- ZZZ particle emitter

---

## Toon Shader Setup

```typescript
// Create a 3-tone gradient map for cel shading
function createToonGradientMap(): THREE.DataTexture {
  const colors = new Uint8Array([
    80, 80, 80,     // shadow
    160, 160, 160,  // mid
    255, 255, 255,  // highlight
  ])
  const gradientMap = new THREE.DataTexture(colors, 3, 1, THREE.RGBFormat)
  gradientMap.minFilter = THREE.NearestFilter
  gradientMap.magFilter = THREE.NearestFilter
  gradientMap.needsUpdate = true
  return gradientMap
}

// Usage
const material = new THREE.MeshToonMaterial({
  color: botColor,
  gradientMap: createToonGradientMap(),
})
```

### Outline Effect (optional, Phase 4)
- Post-processing outline pass for cartoon look
- Or mesh-based: slightly scaled-up dark mesh behind each object

---

## Lighting Setup

```typescript
// Main scene lighting
<ambientLight intensity={0.4} color="#ffeedd" />        // Warm ambient fill
<directionalLight
  position={[10, 15, 10]}
  intensity={0.8}
  color="#ffffff"
  castShadow
  shadow-mapSize={[1024, 1024]}
/>
<hemisphereLight
  skyColor="#87CEEB"      // Sky blue
  groundColor="#8B4513"   // Warm brown
  intensity={0.3}
/>

// Per-room point light (warm)
<pointLight position={[0, 3, 0]} intensity={0.5} color="#FFD700" distance={8} />
```

---

## Camera Setup

```typescript
// Isometric-style camera
<Canvas camera={{
  position: [20, 20, 20],
  fov: 35,                    // Low FOV for flatter perspective
  near: 0.1,
  far: 200,
}}>
  <OrbitControls
    enablePan={true}
    enableZoom={true}
    enableRotate={true}
    minDistance={10}
    maxDistance={60}
    minPolarAngle={Math.PI / 6}     // Don't go too flat
    maxPolarAngle={Math.PI / 3}     // Don't go too top-down
    target={[0, 0, 0]}              // Center of world
  />
</Canvas>
```

### Camera Presets
```typescript
const CAMERA_PRESETS = {
  overview: { position: [30, 30, 30], target: [0, 0, 0] },
  devRoom: { position: [5, 8, 5], target: [0, 0, 0] },
  commsRoom: { position: [20, 8, 5], target: [15, 0, 0] },
  // ... per room
}
```

---

## Performance Considerations

- **Instanced meshes** for repeated geometry (desk legs, wall segments)
- **LOD** (Level of Detail): simplify distant rooms
- **Frustum culling**: Three.js default, but ensure props are grouped per room
- **Max bots rendered**: cap at ~30 in 3D (rest in parking list)
- **Shadows**: only on main directional light, shadow map 1024x1024
- **Particles**: max ~100 particles per effect, auto-cleanup
- **Lazy load**: only render rooms visible to camera

---

## Settings Integration

Add to existing `MinionsSettings`:
```typescript
interface MinionsSettings {
  // ... existing
  world3dEnabled: boolean          // Master toggle for 3D world (vs 2D playground)
  world3dQuality: 'low' | 'medium' | 'high'   // Affects shadow quality, particle count
  world3dShadows: boolean          // Toggle shadows
  world3dParticles: boolean        // Toggle particle effects
  world3dSound: boolean            // Toggle sound effects (Phase 4)
  world3dCameraPreset: string      // Saved camera position
}
```

---

## Migration Path

1. **Phase 1:** 3D view as separate toggle option (existing 2D stays default)
2. **Phase 2-3:** 3D matures, becomes recommended view
3. **Phase 4:** 3D is default, 2D is "classic mode"
4. **Future:** 2D may be deprecated if 3D covers all functionality

---

## Open Questions

- [ ] Should rooms be arranged in a grid or free-form layout?
- [ ] Do we want pathways/corridors between rooms?
- [ ] Sound effects: ambient only, or also per-action sounds?
- [ ] Should the 3D view work on mobile/touch devices?
- [ ] Do we want a "build mode" where users can customize room layouts?
- [ ] Weather effects outside rooms (rain, snow, sun based on real weather)?

---

## Files to Create/Modify

### New Files
```
frontend/src/components/world3d/
├── World3DView.tsx          // Main canvas + scene
├── WorldLighting.tsx        // Lights setup
├── WorldFloor.tsx           // Ground plane
├── Room3D.tsx               // Room container
├── RoomFloor.tsx            // Room floor tiles
├── RoomWalls.tsx            // Room walls
├── RoomNameplate.tsx        // Floating room label
├── RoomProps.tsx             // Room furniture/props
├── Bot3D.tsx                // Bot character
├── BotBody.tsx              // Bot body shape
├── BotFace.tsx              // Eyes, mouth, expressions
├── BotAccessory.tsx         // Per-type accessories
├── BotStatusGlow.tsx        // Ground glow ring
├── BotBubble.tsx            // Speech/thought bubble
├── ParkingArea3D.tsx        // Parking/break area
├── props/                   // Individual prop components
│   ├── Desk.tsx
│   ├── Monitor.tsx
│   ├── Chair.tsx
│   ├── Whiteboard.tsx
│   ├── SatelliteDish.tsx
│   ├── Clock.tsx
│   ├── Easel.tsx
│   ├── CoffeeMachine.tsx
│   ├── Lamp.tsx
│   └── Bench.tsx
└── utils/
    ├── toonMaterials.ts     // Toon shader helpers
    ├── cameraPresets.ts     // Camera position presets
    └── particleEffects.ts   // Particle system helpers
```

### Modified Files
```
frontend/src/App.tsx                         // Add 3D toggle/view
frontend/src/components/sessions/SettingsPanel.tsx  // Add 3D settings
```

---

*This document will be updated as we iterate. Each phase completion should update the checkboxes and add learnings.*
