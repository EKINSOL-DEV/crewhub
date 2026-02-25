# HQ Redesign R&D

5 architecturally excellent HQ building designs rendered in Three.js with a raycasting-based transparent wall shader.

**Live:** http://ekinbot.local:5186

## Transparent Wall Shader

### The Problem
The original prototype made ALL walls transparent based on camera-facing angle (dot product of normal vs view direction). This meant every wall facing the camera would fade, ruining the x-ray effect.

### The Solution: Raycasting
The new `WallSystem` uses a completely different approach:

1. **Registration:** Every `<Wall>` component registers its mesh with a central `WallProvider` via React context
2. **Raycasting:** Each frame, rays are cast from the camera toward the building center (and offset points above/below)
3. **Single target:** Only the FIRST wall hit by any ray gets its opacity reduced to ~6%
4. **Smooth transitions:** Opacity changes are lerped (0.12 per frame) for smooth fade in/out
5. **All others stay opaque:** Non-targeted walls maintain their full opacity

This creates a natural "x-ray vision" effect — you see through exactly ONE wall (the closest one between you and the interior).

### Technical Details
- Custom GLSL vertex/fragment shader per wall mesh
- `uOpacity` uniform controlled per-frame from JS
- `uTargetOpacity` stores the wall's intended opacity (for walls that are intentionally semi-transparent)
- `THREE.Raycaster` with multiple ray targets for robust detection
- `depthWrite: false` + `transparent: true` for proper alpha blending

## 5 Building Designs

### 1. The Ring
**Inspired by:** Apple Park
**Key features:** Curved ring-shaped building (16 segments) enclosing a central courtyard with reflecting pool and trees. Two stories with cantilevered upper floor. Inner courtyard visible through glass panels.
**Why interesting:** The circular form creates a protected interior garden. The cantilever on the upper floor adds dynamic overhang.

### 2. The Cantilever
**Inspired by:** OMA / CCTV HQ Beijing
**Key features:** Two offset towers of different heights (4 and 3 floors) connected by a dramatic bridging volume at the top. Angular meeting pods jut from the facade. Exposed structural cross-bracing.
**Why interesting:** The bridge creates a gateway form. The asymmetry between towers adds tension. Cross-bracing is both structural and aesthetic.

### 3. The Atrium
**Inspired by:** Frank Lloyd Wright's Guggenheim
**Key features:** 4-story building with a central void/atrium running through all floors. Balconied walkways, glass bridges at floors 2 and 4, skylight flooding the core with warm light. Each floor has distinct programming.
**Why interesting:** The central void creates vertical connection between floors. Looking down into the atrium from any level gives spatial drama.

### 4. The Helix
**Inspired by:** Zaha Hadid / BIG (Bjarke Ingels Group)
**Key features:** Spiraling structure wrapping 2.5 rotations around a cylindrical core. Continuous ramping floor plate with workspaces along the outer edge. Cyan accent rings on core. Translucent canopy at top.
**Why interesting:** No traditional "floors" — just a continuous spiral. Movement through the building is a gradual ascent. Each segment has different lighting.

### 5. The Pavilions
**Inspired by:** Google Campus / Renzo Piano
**Key features:** 4 distinct pavilions (main office, creative hub, tech lab, social lounge) connected by enclosed sky bridges. Different roof types (flat, butterfly, angled). Central courtyard with landscaping and pathways.
**Why interesting:** Campus feel with variety. Each building has unique materiality and character. The spaces between buildings are as important as the buildings themselves.

## Props Library
Rich interior props: Workstation (dual monitors), Desk, Chair (star base), MeetingTable, Sofa, CoffeeTable, Plant, TallPlant, ServerRack, Whiteboard, HangingLight, Stairs, Pillar, GlassPanel, Rug, Floor.

## Running
```bash
cd ~/ekinapps/crewhub/rnd/hq-redesign
npm run dev  # Port 5185 (or next available)
```

## Stack
- React + TypeScript
- Three.js via @react-three/fiber + @react-three/drei
- Custom GLSL shaders
- Vite
