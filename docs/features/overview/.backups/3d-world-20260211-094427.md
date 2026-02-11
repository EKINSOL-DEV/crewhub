# 3D World & Visualization

Features for the immersive 3D agent world.

---

## 3D World Core
**Status:** ✅ Released in **v0.3.0**  
**Description:** Toon-shaded 3D campus with 20×20 grid, animated bots, 3 zoom levels (Overview → Room focus → Bot focus), draggable agents, and activity bubbles. Uses React Three Fiber, CameraControls, and instanced meshes for performance.

**Docs:**
- `3d-world/3d-world-design.md` — Original vision document
- `3d-world/3d-world-architecture-analysis.md` — Technical deep-dive
- `3d-world/3d-world-parity-plan.md` — Feature parity checklist

---

## Zones
**Status:** 🚧 In Progress (v0.16.0)  
**Description:** Thematic campus areas with specialized props, environments, and activities. Three zones planned: Creator Center (film studio), Academy (Hogwarts meets MIT), Game Center (arcade meets indie studio). Each zone includes unique props, interactive elements, and Easter eggs.

**Docs:**
- `3d-world/zones/README.md` — Zone system overview
- `3d-world/zones/creator-center-vision.md` — Creator Center design (5 rooms)
- `3d-world/zones/academy-vision.md` — Academy design (6 rooms)
- `3d-world/zones/game-center-vision.md` — Game Center design (6 rooms)
- `3d-world/zones/creator/mvp-summary.md` — Creator Zone MVP
- `3d-world/zones/creator/prop-maker-guide.md` — Prop generation guide

---

## Academy Zone
**Status:** 📋 Planned (v0.16.0)  
**Description:** Learning-focused zone with Great Library, Research Lab, Lecture Hall, Sandbox, Study Pods, and Map Room. Features: Knowledge Tree (grows with agent learning), flying books, owl mascot, scholar ranking system.

**Docs:**
- `3d-world/academy/context-envelopes.md` — Context management design

---

## Spatial Awareness
**Status:** 🔬 Research (v0.14.0)  
**Description:** Agent awareness of their surroundings in the 3D world. Includes vision system (what agents "see"), proximity detection, pathfinding around obstacles, and context-aware behavior (agents mention nearby bots in conversation).

**Docs:**
- `3d-world/spatial-awareness/spatial-awareness-design.md` — Vision, proximity, pathfinding

---

## Multi-Zone System
**Status:** 📋 Planned (v0.16.0)  
**Description:** Architecture for supporting multiple themed zones on the campus. Includes zone switcher UI, persistent navigation, and zone-specific environments/props.

**Docs:**
- `3d-world/multi-zone/multi-zone-implementation.md` — Implementation notes

---

*Last updated: 2026-02-10 13:50 (auto-generated from matrix.md)*
