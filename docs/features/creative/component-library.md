# Component Library — PropMaker Phase 2

*Date: 2026-02-11 | Version: v0.13.0*

Reusable high-quality 3D components that AI-generated props can compose for consistent visual quality.

---

## Overview

The component library provides 7 ready-made, animated building blocks located at:
`frontend/src/components/world3d/props/components/`

Each component is self-contained with built-in animation, customizable via props, and optimized for performance.

---

## Components

### 1. LED
Blinking/pulsing indicator light.

```tsx
import { LED } from '../props/components/LED'

<LED color="#00ff00" position={[0.1, 0.5, 0.2]} />
<LED color="#ff0000" pulse blinkSpeed={3} />
<LED color="#00aaff" size={0.03} intensity={4} />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| color | string | `#00ff00` | Light color |
| position | [n,n,n] | `[0,0,0]` | 3D position |
| size | number | `0.02` | Sphere radius |
| pulse | boolean | `false` | Enable pulsing |
| blinkSpeed | number | `2` | Blink rate |
| intensity | number | `3` | Emissive intensity |

---

### 2. SteamParticles
Rising steam/smoke particle effect.

```tsx
import { SteamParticles } from '../props/components/SteamParticles'

<SteamParticles position={[0, 0.8, 0]} />
<SteamParticles count={20} spread={0.3} color="#ffddaa" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| position | [n,n,n] | `[0,0,0]` | Base position |
| count | number | `12` | Particle count |
| spread | number | `0.15` | Horizontal spread |
| height | number | `0.5` | Rise height |
| color | string | `#ffffff` | Particle color |
| speed | number | `1` | Animation speed |

---

### 3. GlowOrb
Pulsing glowing sphere with optional wireframe shell.

```tsx
import { GlowOrb } from '../props/components/GlowOrb'

<GlowOrb color="#00ffff" position={[0, 1, 0]} />
<GlowOrb color="#aa44ff" size={0.5} wireframe={false} />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| color | string | `#00ffff` | Glow color |
| position | [n,n,n] | `[0,0,0]` | Position |
| size | number | `0.3` | Outer radius |
| pulseSpeed | number | `1.5` | Pulse rate |
| intensity | number | `2` | Emissive intensity |
| wireframe | boolean | `true` | Show wireframe shell |

---

### 4. Cable
Curvy connecting wire between two points using CatmullRom curve.

```tsx
import { Cable } from '../props/components/Cable'

<Cable from={[-0.3, 0.5, 0]} to={[0.3, 0.5, 0]} />
<Cable from={[0, 0, 0]} to={[0, 1, 0.5]} color="#ff4444" sag={0.4} />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| from | [n,n,n] | required | Start point |
| to | [n,n,n] | required | End point |
| color | string | `#333333` | Wire color |
| thickness | number | `0.015` | Wire radius |
| sag | number | `0.2` | Droop amount |

---

### 5. DataStream
Flowing data particles orbiting in a column.

```tsx
import { DataStream } from '../props/components/DataStream'

<DataStream position={[0, 0.5, 0]} color="#ff88ff" />
<DataStream count={16} radius={0.8} speed={2} />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| position | [n,n,n] | `[0,0,0]` | Center position |
| count | number | `10` | Particle count |
| radius | number | `0.5` | Orbit radius |
| height | number | `0.8` | Column height |
| color | string | `#ff88ff` | Particle color |
| speed | number | `1` | Orbit speed |

---

### 6. Screen
Animated display panel with scanlines and flicker.

```tsx
import { Screen } from '../props/components/Screen'

<Screen position={[0, 0.5, 0.2]} />
<Screen width={0.6} height={0.4} color="#00ff88" flicker />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| position | [n,n,n] | `[0,0,0]` | Position |
| width | number | `0.4` | Screen width |
| height | number | `0.25` | Screen height |
| color | string | `#00ff88` | Screen color |
| bezelColor | string | `#1a1a2e` | Frame color |
| scanlines | boolean | `true` | Scanline effect |
| flicker | boolean | `false` | Random flicker |

---

### 7. RotatingPart
Generic wrapper that rotates children around an axis.

```tsx
import { RotatingPart } from '../props/components/RotatingPart'

<RotatingPart speed={0.5}>
  <mesh>
    <torusGeometry args={[0.3, 0.02, 8, 32]} />
    <meshStandardMaterial color="#DAA520" />
  </mesh>
</RotatingPart>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| position | [n,n,n] | `[0,0,0]` | Position |
| axis | 'x'/'y'/'z' | `'y'` | Rotation axis |
| speed | number | `1` | Rotation speed |
| children | ReactNode | required | Content to rotate |

---

## Multi-Pass Generation System

The `MultiPassGenerator` (`backend/app/services/multi_pass_generator.py`) enhances props in 4 passes:

1. **Base** — AI or template generates initial code
2. **Details** — Keyword matching injects components (e.g., "coffee" → SteamParticles)
3. **Polish** — Ensures flatShading, checks for animation and emissive
4. **Validate** — Counts meshes, checks exports and imports

### Keyword → Component Mapping

| Keywords | Component Added |
|----------|----------------|
| coffee, tea, steam, cook | SteamParticles |
| computer, screen, monitor | Screen |
| electronic, server, panel | LED |
| magic, crystal, orb | GlowOrb |
| data, ai, neural, cyber | DataStream |
| robot, mech, tech | LED |
| neon, sign, glow | GlowOrb |
| arcade, gaming, retro | Screen |

---

## Visual Refinement UI

The `PropRefiner` component provides:
- **Color Picker** — Click colors in prop, swap from palette
- **Material Presets** — Solid, Metal, Glow, Glass
- **Animation Presets** — Rotate, Pulse, Bob, Sway
- **Component Injector** — Add LED, Steam, Glow, Screen, DataStream

Available via the refine panel in FullscreenPropMaker after generation.

---

## Best Practices

1. **Performance**: Components use `useRef` + `useFrame` (no state updates per frame)
2. **Composition**: Layer components — base prop + LED + Steam = rich scene
3. **Colors**: Use showcase palette colors for consistency
4. **Animation**: Keep speeds subtle (0.3-2.0 range)
5. **Max 3 components** auto-injected per prop to avoid clutter
