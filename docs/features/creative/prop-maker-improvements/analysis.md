# PropMaker Quality Analysis

*Date: 2026-02-11*
*Based on: 10 showcase props from `rnd/prop-creator-showcase/`*

---

## 1. Why the Showcase Props Are Great

### 1.1 Composition Patterns

Every showcase prop follows a **layered composition** model:

| Layer | Purpose | Example (CoffeeMachine) |
|-------|---------|------------------------|
| **Base/Stand** | Visual grounding | Drip tray, machine body |
| **Core Body** | Identity shape | Red box body + top section |
| **Functional Details** | Storytelling | Water tank, spout, buttons |
| **Life Details** | Personality | Steam particles, green LED, coffee in cup |
| **Animation** | Breathing / life | Gentle Y-rotation sway |

**Average part count:** 8-15 distinct meshes per prop (not counting instanced/array elements).

### 1.2 Color Strategy

The showcase uses **saturated, purposeful color**:

- **Primary body:** Strong identity color (red machine, white rocket, dark server rack)
- **Accent/glow:** Cyan `#00ffff`, green `#00ff44`, orange `#ff8800` for LEDs/emissive
- **Transparency:** Used sparingly for glass/water (`opacity: 0.2-0.5`)
- **Complementary pairs:** Blue water in red machine, green LEDs on dark rack

**Emissive usage:** Every prop has at least one emissive element (LED, glow, flame). This is the single biggest differentiator — it makes props feel alive in 3D.

### 1.3 Animation Philosophy

Animations are **subtle and purposeful**:

| Prop | Animation | Speed |
|------|-----------|-------|
| AIBrain | Slow rotation + node pulse | 0.008 rad/frame |
| DataCrystal | Rotation + float + inner pulse | 0.012 rad/frame |
| Rocket | Gentle bob + flame flicker | 15 Hz flicker |
| ServerRack | LED blink patterns | Per-LED phase offset |
| Hourglass | Sand draining (scale anim) | 0.15× speed |
| Plant | Leaf gentle sway | 1.5 Hz sine |
| Globe | Sphere + ring rotation | Dual-speed |
| CodeTerminal | Text scroll + gentle sway | 0.3× scroll |

**Key insight:** No prop rotates faster than ~0.015 rad/frame. Everything feels calm and polished.

### 1.4 Technical Sophistication

Advanced techniques used across props:

- **InstancedMesh** (AIBrain) — 40 neural nodes efficiently rendered
- **CatmullRomCurve3 + TubeGeometry** (DataCrystal) — smooth data streams
- **Procedural generation** (AIBrain) — random sphere-surface point distribution
- **Particle arrays** (CoffeeMachine, Hourglass) — steam/sand from useMemo arrays
- **Per-instance animation** (ServerRack LEDs) — phase-offset blink patterns
- **Text rendering** (CodeTerminal, Whiteboard) — @react-three/drei Text component
- **DoubleSide materials** (Plant, Hourglass) — proper leaf/glass rendering

### 1.5 What Makes Each Prop Recognizable

| Prop | Signature Element | Why It Works |
|------|-------------------|--------------|
| AIBrain | Neural network sphere | Wireframe + glowing nodes = instant "AI" |
| CodeTerminal | Scrolling code + cursor | Real code lines with syntax colors |
| CoffeeMachine | Steam + coffee cup | Universal office symbol |
| DataCrystal | Floating + glowing octahedron | Fantasy/sci-fi crystal archetype |
| Globe | Land patches + orbit rings | Low-poly earth is instantly readable |
| Hourglass | Draining sand animation | Time symbol everyone knows |
| Plant | Pot + leaves | Organic shape in geometric world |
| Rocket | Fins + flame | Classic rocket silhouette |
| ServerRack | Blinking LEDs + cables | Data center visual language |
| Whiteboard | Sticky notes + markers | Office/agile visual cue |

---

## 2. Current PropMaker Gap Analysis

### 2.1 What the Current Prompt Does Right

- Enforces `useToonMaterialProps` for consistency
- Provides color palettes
- Has simple examples (Plant, Lamp)
- Sets size constraints (0.5-1.5 units)
- Requires `castShadow`

### 2.2 What's Missing vs Showcase Quality

| Aspect | Current Prompt | Showcase Props | Gap |
|--------|---------------|----------------|-----|
| **Part count** | "1-3 simple, 5-10 complex" | 8-15+ always | Under-specifying complexity |
| **Emissive** | Only for "glowing parts" | Every prop has emissive | Not emphasized enough |
| **Animation** | Not mentioned at all | Every prop animates | Major gap |
| **Particles** | Not mentioned | Steam, sand, data bits | Major gap |
| **Transparency** | Not mentioned | Glass, water, wireframes | Missing |
| **Advanced geometry** | "Built-in only" | InstancedMesh, TubeGeometry, CatmullRomCurve3 | Restrictive |
| **Text** | Not mentioned | CodeTerminal, Whiteboard use Text | Missing |
| **Composition** | "base + body + details" | 5-layer model | Under-specified |
| **Examples** | 2 simple (Plant, Lamp) | 10 complex, varied | Insufficient |

### 2.3 Known Issues Not Addressed by Showcase Patterns

1. **Orientation** — Showcase props don't show how to prevent upside-down generation (post-processing addresses this)
2. **Style drift** — Current prompt allows MeshStandardMaterial AND MeshToonMaterial; showcase uses only MeshStandardMaterial (no toon!)
3. **No feedback loop** — AI generates once; showcase props were hand-iterated

### 2.4 Critical Insight: Material Mismatch

The showcase props use **`meshStandardMaterial` with `flatShading`**, NOT `meshToonMaterial`. This actually produces a better low-poly look because:
- `flatShading` gives the faceted geometric feel
- `meshStandardMaterial` supports `metalness`, `roughness`, `transparent`, `wireframe`
- `emissive` + `emissiveIntensity` works naturally
- More visual range than toon material's stepped shading

**The current PropMaker prompt enforces toon material, but the best-looking props don't use it.**

---

## 3. Root Causes of Quality Gap

1. **Too few examples** — 2 simple examples vs 10 rich ones
2. **Wrong material strategy** — Forcing toon when flatShading standard looks better
3. **No animation requirement** — Static props feel dead
4. **No emissive requirement** — Missing the "glow" that makes 3D props pop
5. **Restrictive geometry** — Banning InstancedMesh, curves, Text limits expressiveness
6. **Vague composition guidance** — "5-10 meshes" without explaining layered structure
7. **No reference to known-good output** — AI has no target to aim for

---

## 4. Summary: The 5 Rules of Great Props

1. **Always animate** — Even subtle rotation or pulse
2. **Always glow** — At least one emissive element
3. **Layer your composition** — Base → Body → Function → Detail → Life
4. **Use flatShading** — Better than toon for low-poly geometric style
5. **Tell a micro-story** — Steam means "hot", blinking LEDs mean "working", flame means "power"
