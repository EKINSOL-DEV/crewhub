# PropMaker Technical Guide — Design Patterns from Showcase

*Date: 2026-02-11*
*Reference: 10 showcase props from `rnd/prop-creator-showcase/`*

---

## 1. The Showcase Pattern Language

### 1.1 Standard Prop Skeleton

Every high-quality prop follows this template:

```tsx
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function MyProp() {
  const groupRef = useRef<THREE.Group>(null);

  // Optional: procedural data
  const particles = useMemo(() => {
    return Array.from({ length: N }, (_, i) => ({
      x: ..., y: ..., offset: Math.random() * Math.PI * 2,
    }));
  }, []);

  // Animation (ALWAYS present)
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.008; // or sway pattern
    }
  });

  return (
    <group ref={groupRef}>
      {/* Layer 1: Base/Stand */}
      {/* Layer 2: Core Body */}
      {/* Layer 3: Functional Details */}
      {/* Layer 4: Small Details (LEDs, buttons) */}
      {/* Layer 5: Life (particles, glow, text) */}
    </group>
  );
}
```

### 1.2 Material Patterns

**Solid body parts** — flatShading for low-poly look:
```tsx
<meshStandardMaterial color="#cc3333" flatShading />
```

**Metal parts** — metalness + roughness:
```tsx
<meshStandardMaterial color="#ccaa44" metalness={0.6} roughness={0.3} />
```

**Glowing elements** — emissive (LEDs, screens, energy):
```tsx
<meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={3} />
```

**Transparent** — glass, water, wireframe shells:
```tsx
<meshStandardMaterial color="#4488cc" transparent opacity={0.3} />
// or wireframe:
<meshStandardMaterial color="#0044ff" transparent opacity={0.08} wireframe />
```

### 1.3 Animation Patterns

**Gentle sway** (most props):
```tsx
groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
```

**Constant slow rotation** (crystals, brains):
```tsx
groupRef.current.rotation.y += 0.008;
```

**Floating/bobbing** (crystals, rockets):
```tsx
groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.08;
```

**Pulsing scale** (inner glow elements):
```tsx
const s = 0.95 + Math.sin(state.clock.elapsedTime * 3) * 0.05;
meshRef.current.scale.setScalar(s);
```

**Flickering** (flames, fast effects):
```tsx
const s = 0.8 + Math.sin(state.clock.elapsedTime * 15) * 0.2;
```

**LED blink with phase offset** (server rack):
```tsx
const blink = Math.sin(state.clock.elapsedTime * (3 + i * 1.7) + i * 2) > 0;
mat.emissiveIntensity = blink ? 3 : 0.2;
```

### 1.4 Particle Patterns

**Steam/rising particles** (CoffeeMachine):
```tsx
const particles = useMemo(() =>
  Array.from({ length: 12 }, () => ({
    x: (Math.random() - 0.5) * 0.15,
    z: (Math.random() - 0.5) * 0.15,
  })), []);

// Render as small, fading spheres stacked vertically
{particles.map((p, i) => (
  <mesh position={[p.x, 0.1 + i * 0.04, p.z]}>
    <sphereGeometry args={[0.015 + i * 0.003, 6, 6]} />
    <meshStandardMaterial color="#ffffff" transparent opacity={0.15 - i * 0.01} />
  </mesh>
))}
```

**Orbiting data bits** (DataCrystal):
```tsx
{[...Array(8)].map((_, i) => {
  const a = (i / 8) * Math.PI * 2;
  return (
    <mesh position={[Math.cos(a) * 1.1, Math.sin(a * 2) * 0.3, Math.sin(a) * 1.1]}>
      <boxGeometry args={[0.04, 0.04, 0.04]} />
      <meshStandardMaterial color="#ff88ff" emissive="#ff88ff" emissiveIntensity={2} />
    </mesh>
  );
})}
```

---

## 2. Color Reference

### Proven Palettes from Showcase

| Category | Colors | Used In |
|----------|--------|---------|
| **Cyber/AI** | `#00ffff` `#00aaff` `#0044ff` | AIBrain |
| **Magic/Data** | `#aa44ff` `#ff66ff` `#cc88ff` | DataCrystal |
| **Machine/Red** | `#cc3333` `#aa2222` `#333333` | CoffeeMachine |
| **Nature** | `#44aa44` `#33cc55` `#cc6633` | Plant |
| **Space** | `#ff4444` `#eeeeee` `#ff6644` | Rocket |
| **Tech/Dark** | `#1a1a2e` `#2a2a3e` `#0d1117` | CodeTerminal, ServerRack |
| **Earth** | `#2266aa` `#44aa55` `#ffaa33` | Globe |
| **Time/Gold** | `#ccaa44` `#ffcc44` `#ff8800` | Hourglass |
| **Office** | `#555566` `#f0f0f0` `#ffee44` | Whiteboard |

### Emissive Color Rules

- LED indicators: same color as emissive, intensity 2-3
- Screens/displays: dark base + lighter emissive, intensity 0.3-0.5
- Energy/magic: saturated emissive, intensity 1-2
- Fire/flame: orange base + red emissive, intensity 2-3

---

## 3. Geometry Complexity Tiers

### Tier 1: Basic (avoid for quality props)
- Single box/cylinder
- 1-3 meshes
- No details

### Tier 2: Good (minimum for PropMaker)
- 5-8 meshes
- Clear silhouette
- 1-2 accent colors
- At least 1 emissive element

### Tier 3: Showcase Quality (target)
- 8-15+ meshes
- Layered composition (5 layers)
- 3-4 colors + emissive accents
- Animation (rotation/sway/pulse)
- Story elements (steam, LEDs, text)
- Proper material variety (solid, metallic, transparent, emissive)

### Tier 4: Advanced (stretch goal)
- InstancedMesh for repeated elements
- Procedural geometry (curves, tubes)
- Complex animation (multi-element, physics-like)
- Text rendering

---

## 4. Component Library Spec (Phase 2)

### Proposed Reusable Components

```tsx
// LED indicator
interface LEDProps {
  color?: string;
  position?: [number, number, number];
  size?: number;
  pulse?: boolean;
}
export function LED({ color = '#00ff00', position = [0,0,0], size = 0.02, pulse = false }: LEDProps)

// Steam particle system
interface SteamProps {
  position?: [number, number, number];
  count?: number;
  spread?: number;
  height?: number;
}
export function Steam({ position, count = 12, spread = 0.15, height = 0.5 }: SteamProps)

// Glow orb (inner + outer sphere)
interface GlowOrbProps {
  color?: string;
  position?: [number, number, number];
  size?: number;
}
export function GlowOrb({ color = '#00ffff', position, size = 0.3 }: GlowOrbProps)

// Cable/wire between two points
interface CableProps {
  from: [number, number, number];
  to: [number, number, number];
  color?: string;
  thickness?: number;
}
export function Cable({ from, to, color = '#ff4444', thickness = 0.015 }: CableProps)
```

---

## 5. Updated AI Prompt Template

This should replace the current `creator-zone-prompt.md` generation instructions:

```
STYLE RULES:
- Use meshStandardMaterial with flatShading for solid parts
- Use metalness/roughness for metal parts (metalness: 0.5-0.7, roughness: 0.3-0.4)
- Use emissive for ALL glowing parts (LEDs, screens, energy) — intensity 1-3
- Use transparent + opacity for glass/water (opacity: 0.2-0.5)
- Every prop MUST have at least one emissive element
- Bright, saturated colors — never grey/dull for main body

COMPOSITION:
- Minimum 8 distinct meshes
- Follow 5-layer model: Base → Body → Function → Detail → Life
- Proper hierarchy with <group> nesting
- Stable proportions (wider base, smaller top details)
- Total size: 0.5–1.5 units

ANIMATION (REQUIRED):
- Every prop must include useFrame animation
- Gentle rotation OR sway: rotation.y += 0.008 or Math.sin() * 0.15
- Optional: floating, pulsing, blinking LEDs
- Keep speeds slow and subtle

DETAILS:
- LED indicators: small spheres (r=0.02) with emissive intensity 2-3
- Particles for effects: steam, sparks, data bits
- Multiple colors per prop (3-4 minimum)
- Buttons, handles, cables, labels where appropriate

DO NOT:
- Generate single-mesh props
- Use only one color
- Skip animation
- Use dull/grey color schemes
- Forget emissive on glowing parts
```

---

## 6. Post-Processing Enhancement Script

```typescript
function enhancePropCode(code: string): string {
  let enhanced = code;

  // 1. Ensure flatShading on meshStandardMaterial
  enhanced = enhanced.replace(
    /meshStandardMaterial\s+color="([^"]+)"\s*\/>/g,
    'meshStandardMaterial color="$1" flatShading />'
  );

  // 2. Add useFrame rotation if missing
  if (!enhanced.includes('useFrame')) {
    // Inject basic rotation animation
    enhanced = addBasicRotation(enhanced);
  }

  // 3. Check for emissive — warn if missing
  if (!enhanced.includes('emissive')) {
    console.warn('Generated prop has no emissive elements — quality may be low');
  }

  // 4. Count meshes — warn if too few
  const meshCount = (enhanced.match(/<mesh/g) || []).length;
  if (meshCount < 5) {
    console.warn(`Only ${meshCount} meshes — consider regenerating for more detail`);
  }

  return enhanced;
}
```
