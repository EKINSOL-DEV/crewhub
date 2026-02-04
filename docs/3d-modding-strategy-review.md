# Strategic Review: CrewHub 3D World — Modding, Extensibility & Best Practices

*Author: GPT-5.2 (strategic review subagent)*  
*Date: 2026-02-04*  
*Scope: 3D World (Three.js / @react-three/fiber) content extensibility: rooms, props, environments, bot variants; distribution; security; phased roadmap.*

---

## Executive summary (opinionated)

CrewHub’s 3D World is already **halfway to moddable** because it’s largely **data-driven** at the room level: a **20×20 grid blueprint system** exists (`frontend/src/lib/grid/types.ts`, `frontend/src/lib/grid/blueprints.ts`) and a **PropRegistry** maps string IDs to renderable components (`frontend/src/components/world3d/grid/PropRegistry.tsx`). That’s the right spine.

To become genuinely community-extensible, CrewHub should:

1. **Commit to “data-first mods” as the default** (JSON + assets) and treat **code mods** as an advanced, explicitly permissioned tier.
2. Introduce a **stable content API** (schema + versioning + validation + conflict rules) so mods don’t break every release.
3. Use **glTF 2.0** for external models (Phase 2+), but keep the existing procedural components as “built-ins”.
4. Ship an **import/export pack format** that works offline (zip/worldpack), and later add an online registry/gallery.
5. Make security a first-class constraint: **no arbitrary JS execution by default**; sandbox any code extensions.

The pragmatic path is: **Phase 1 = content packs (no code)** → **Phase 2 = import/export + validation** → **Phase 3 = creator tooling** → **Phase 4 = registry/gallery** → **Phase 5 = code mods (sandboxed)**.

---

## 1) Industry best practices for modding (patterns that apply to CrewHub)

### Minecraft (data packs + resource packs + mods)
**Pattern:** “Most creators should never write code.” Minecraft’s ecosystem works because it splits:
- **Data packs**: structured gameplay/config data.
- **Resource packs**: textures/models/sounds.
- **Mods**: code with deeper power (and more risk).

**Apply to CrewHub:**
- **World Packs** (data packs): room blueprints, building layout, bot variant configs.
- **Asset Packs** (resource packs): models/textures/audio.
- **Extension Mods** (code mods): optional advanced behaviors (new animations, new AI interactions) behind explicit permissions.

### Roblox (creator platform + sandboxed code)
**Pattern:** A tightly controlled runtime with a creator ecosystem. Roblox allows code, but in a sandboxed environment and under a consistent API.

**Apply to CrewHub:**
- If/when CrewHub supports code mods, offer **a narrow scripting surface** (e.g., “add a prop animation”, “respond to bot state changes”) and **sandbox the runtime**.

### Cities: Skylines (asset workshop + dependency management)
**Pattern:** Users share assets and mods; dependencies and load-order conflicts are common.

**Apply to CrewHub:**
- Add a **mod manifest** with:
  - semantic versioning
  - dependencies
  - “requires CrewHub >= x.y”
  - conflicts/overrides
- Add an explicit **load order** and deterministic override rules (described below).

### VS Code extensions (marketplace + stable extension points)
**Pattern:** A well-defined extension API + marketplace + strong versioning.

**Apply to CrewHub:**
- “Extension points” should be explicit:
  - register props
  - register environments
  - register rooms/blueprints
  - register bot variant skins
- Provide a **capabilities model** (permissions) and a **compatibility range**.

---

## 2) Mod system design principles

### 2.1 Discoverability
A mod system succeeds when users can answer:
- What mods are installed?
- What does each mod add/override?
- What version and compatibility range?

**Recommendation:**
- A dedicated **Mods** panel that lists installed packs/mods, with:
  - author, version, description
  - enabled/disabled toggle
  - dependencies/conflicts
  - “overrides” summary (e.g., “overrides prop ‘desk’”) 

### 2.2 Sandboxing (default-deny)
**Opinion:** Do not allow arbitrary JS by default. In a dashboard app, the security bar is closer to “browser extension” than “game mod”.

- **Default tier:** data-only mods (safe) 
- **Advanced tier:** code mods, explicitly permissioned and sandboxed (see §6)

### 2.3 Versioning + compatibility
**Rule:** Mods should declare:
- `engineRange`: e.g., `"crewhub": ">=0.3.0 <0.5.0"`
- `schemaVersion`: for content schemas
- `dependencies`: other mods/packs

CrewHub should:
- validate ranges at install time
- keep a **content API changelog**
- support **deprecated fields** for at least 1–2 minor versions

### 2.4 Dependencies
Use a simple dependency model initially:
- hard dependencies: must be present
- optional dependencies: enable extra content if present

### 2.5 Hot-reloading vs restart-required
**Pragmatic stance:**
- **Data changes** (blueprints, materials, placements) should hot-reload during development and ideally at runtime.
- **Asset changes** (glTF/textures) can hot-reload in dev, but may require reloading the 3D view in production.
- **Code mods** should require reload/restart (and may be blocked in production builds).

### 2.6 Conflict resolution
Conflicts are inevitable when mods can override IDs.

**Recommendation (deterministic, simple):**
- Every mod has a `priority` (default 0).
- Load order: by priority, then by install time.
- Overrides:
  - same `type/id` → highest priority wins.
  - allow “merge strategies” only for specific structures (e.g., append-only lists).

Expose conflict outcomes in UI.

---

## 3) Content format standards (recommended)

CrewHub already uses string IDs for blueprints/props; formalize that into a **content spec**.

### 3.1 Room blueprints (JSON + JSON Schema)
Today:
- `RoomBlueprint` is a TS type (`frontend/src/lib/grid/types.ts`).
- Blueprints are authored in code (`frontend/src/lib/grid/blueprints.ts`).

**Recommendation:** Move blueprints to external JSON files and validate them.

#### Proposed JSON structure (v1)
```json
{
  "$schema": "https://crewhub.dev/schemas/room-blueprint.v1.json",
  "id": "dev-room",
  "name": "Dev Room",
  "gridWidth": 20,
  "gridDepth": 20,
  "cellSize": 0.6,
  "cells": [[{ "type": "empty", "walkable": true }]],
  "doorPositions": [{ "x": 9, "z": 19, "facing": "south" }],
  "walkableCenter": { "x": 10, "z": 10 },
  "interactionPoints": {
    "work": [{ "x": 5, "z": 15 }],
    "coffee": [],
    "sleep": [{ "x": 2, "z": 2 }]
  },
  "metadata": {
    "tags": ["office", "tech"],
    "author": "...",
    "version": "1.0.0"
  }
}
```

#### JSON Schema essentials
- enforce grid sizes
- enforce allowed `CellType`, `InteractionType`, `Direction`
- validate `cells` dimensions match `gridWidth/gridDepth`
- optional lint rules:
  - at least one door
  - at least one work interaction
  - no prop overlaps if spans are used

### 3.2 Props (definition + geometry)
Today:
- `PropRegistry.tsx` is a hardcoded map from `propId` → React component plus mount metadata.
- Props are mostly procedural (good for v1).

**Recommendation:** Split “prop definition” from “prop rendering implementation”.

#### Prop definition format (JSON)
```json
{
  "$schema": "https://crewhub.dev/schemas/prop.v1.json",
  "id": "desk-with-monitor",
  "displayName": "Desk (with Monitor)",
  "category": "furniture",
  "mount": { "type": "floor", "yOffset": 0.16 },
  "footprint": { "w": 2, "d": 2 },
  "supports": {
    "rotation": [0, 90, 180, 270],
    "variants": ["oak", "white"]
  },
  "render": {
    "kind": "builtin",
    "component": "DeskWithMonitor"
  }
}
```

#### 3D geometry standard
- **glTF 2.0** as the primary external model format.
- Encourage:
  - single mesh per prop when possible
  - baked materials or simple PBR
  - texture size budgets (e.g., 512–1024)
  - optional Draco compression

For external props:
```json
"render": {
  "kind": "gltf",
  "uri": "models/desk.glb",
  "scale": [1, 1, 1],
  "pivot": "bottom-center"
}
```

### 3.3 Environments (configurable theme packs)
Today:
- Environments are React components: `GrassEnvironment`, `IslandEnvironment`, `FloatingEnvironment`.
- Current selection is stored in `localStorage` via `EnvironmentSwitcher` (`frontend/src/components/world3d/environments/index.tsx`).

**Recommendation:**
- Treat environments as **themes** with a config file + optional assets.
- Persist environment choice via **backend settings** (`/settings`) instead of localStorage, so it travels with backups.

Environment config (JSON):
```json
{
  "$schema": "https://crewhub.dev/schemas/environment.v1.json",
  "id": "floating",
  "name": "Floating Platform",
  "sky": { "color": "#9ad0ff", "fog": { "color": "#cfe8ff", "near": 30, "far": 120 } },
  "lighting": {
    "ambient": { "color": "#ffeedd", "intensity": 0.4 },
    "directional": { "color": "#ffffff", "intensity": 0.8, "position": [10, 15, 10] }
  },
  "ground": { "kind": "builtin", "component": "FloatingEnvironment" }
}
```

### 3.4 Bot skins/variants
Today:
- Bot variants are logic + palette in `botVariants.ts`.

**Recommendation:**
- Keep “variant detection” builtin (to avoid spoofing) but make **visual skins** data-driven:
  - colors
  - accessory choice
  - chest display style
  - optional glTF skin

Bot skin JSON:
```json
{
  "$schema": "https://crewhub.dev/schemas/bot-skin.v1.json",
  "id": "dev-neon",
  "appliesTo": ["dev"],
  "color": "#ff3b30",
  "accessory": "gear",
  "model": { "kind": "gltf", "uri": "bots/dev-neon.glb" }
}
```

### 3.5 World packs (bundles)
A **World Pack** is a bundle of:
- room blueprints
- prop definitions + optional assets
- environments
- bot skins
- optional building layout

**Format recommendation:**
- `.crewhub-worldpack` = a zip with a manifest.

`manifest.json`:
```json
{
  "id": "com.example.neon-office",
  "name": "Neon Office Pack",
  "version": "1.2.0",
  "crewhub": ">=0.3.0 <0.5.0",
  "schemaVersion": 1,
  "priority": 0,
  "content": {
    "blueprints": ["blueprints/dev-room.json"],
    "props": ["props/desk.json"],
    "environments": ["env/floating.json"],
    "botSkins": ["bots/dev-neon.json"]
  },
  "assets": {
    "models": ["models/desk.glb"],
    "textures": ["textures/neon.png"]
  }
}
```

---

## 4) Distribution & sharing

### 4.1 Immediate (MVP): direct file sharing
- Export a `.crewhub-worldpack` file.
- Users share via GitHub Releases, Discord, direct download.

This is the fastest path and aligns with the existing `backup` API and open-source distribution.

### 4.2 Medium-term: “CrewHub Gallery” (curated index)
- A static JSON index hosted on GitHub Pages (cheap + low ops) listing:
  - pack metadata
  - download URLs
  - screenshots
  - compatibility

### 4.3 Advanced: marketplace / registry
Options (choose one later):
1. **GitHub-based registry** (PRs add packs). Very OSS-friendly.
2. **NPM packages** for world packs (works well for devs, not for normal users).
3. **ClawHub integration** (if CrewHub has a central service): best UX, highest ops burden.

**Opinionated recommendation:** Start with **GitHub registry + zip packs**. Avoid NPM as the primary user-facing channel.

### 4.4 Versioning and compatibility rules
- Packs declare `crewhub` engine range.
- CrewHub enforces it at install time.
- Backups should include installed pack list + enabled state.

**Note:** Current backup export includes the `settings` table (`backend/app/routes/backup.py`). That’s a natural place to store:
- installed packs (metadata)
- enabled packs
- selected environment

---

## 5) Onboarding for mod creators

### 5.1 Visual editor vs file-based
**Phase order matters:**
- Start with **file-based JSON** + validation + preview tooling.
- Add a visual editor only once you have a stable content schema.

A visual editor without schema stability becomes a maintenance trap.

### 5.2 Recommended tooling
- **Blender → glTF (.glb)** export pipeline for custom models.
- Provide a small “Asset Checklist”:
  - scale conventions
  - pivot point expectations (bottom-center)
  - polycount budget
  - texture budget

### 5.3 Documentation strategy
Ship a “Modding SDK” inside the repo:
- `docs/modding/`:
  - `getting-started.md`
  - `schemas/` (JSON Schema files + examples)
  - `pack-format.md`
  - `security.md`
- Provide a `worldpack-template/` folder:
  - manifest
  - example blueprint
  - example prop
  - example environment

Also provide a **preview mode** inside CrewHub:
- load pack from file
- show validation errors
- render a “test room” scene

---

## 6) Security & sandboxing

### 6.1 What mods *can* do (recommended)
Data mods should only be able to:
- define blueprints (grid layout)
- place props by ID
- define environment parameters
- define bot skin parameters
- provide assets (glTF/textures)

### 6.2 What mods *must not* do by default
- execute arbitrary JS in the main app context
- make network requests
- access local files
- access session logs or secrets

### 6.3 Code execution risk (custom props/animations)
The current PropRegistry model is React components. If you let mods “register a React component”, that is **full code execution**.

**Recommendation:**
- Do **not** accept React components from untrusted mods.
- If/when you support code mods, isolate them:
  - **Web Worker** sandbox (no DOM access)
  - message-passing API only
  - allowlist of capabilities
  - strict time/memory limits

### 6.4 Asset security
Even data-only packs can be dangerous if you allow:
- extremely large textures/models (DoS)
- shaders (GPU hangs)

Mitigations:
- enforce file size limits
- enforce texture dimensions
- deny custom shader code in v1

---

## 7) Phased implementation plan (grounded in this codebase)

### Phase 1 — Data-driven foundation (ship this first)
**Goal:** Make built-in content behave like “first-party mods”.

Concrete refactors:
- Move `ROOM_BLUEPRINTS` out of `frontend/src/lib/grid/blueprints.ts` into JSON files (or at least into a separate data module) and load them via a loader.
- Add validation for the `RoomBlueprint` model.
- Introduce a `PropDefinition` layer (metadata) separate from `PropRegistry.tsx` rendering.
- Store environment selection in backend settings instead of localStorage:
  - `/settings` already supports upsert (`backend/app/routes/settings.py`).

Deliverable:
- A stable `content/` folder structure with built-in packs.

### Phase 2 — Import/export system
**Goal:** Users can install/uninstall packs; backups include pack state.

- Add pack install location (e.g., `~/.crewhub/packs/`).
- Add endpoints:
  - list installed packs
  - install pack (upload zip)
  - remove pack
- Reuse existing backup patterns (`/backup/export`, `/backup/import`) to include:
  - settings keys like `world.packs.installed`, `world.packs.enabled`, `world.environment.selected`.

### Phase 3 — Visual editor (mod creator UX)
**Goal:** In-app grid editor for blueprints.

- Reuse grid model (`GridCell` in `frontend/src/lib/grid/types.ts`).
- Add:
  - palette of props filtered by mount type
  - rotation
  - span/footprint validation
  - export to blueprint JSON

### Phase 4 — Mod registry / gallery
**Goal:** discovery + sharing.

- Start with GitHub registry index.
- Later, integrate with a hosted service.

### Phase 5 — Community tools + (optional) code mods
**Goal:** advanced effects, animations, behaviors.

- If you ship code mods, do it last and sandboxed.

---

## 8) Risk assessment (keep it pragmatic)

### Biggest risks
1. **Over-engineering**: building a full “game mod platform” for what is primarily a dashboard visualization.
2. **Security**: allowing code mods too early turns CrewHub into an extension-host with serious risk.
3. **Schema churn**: if blueprint/prop schemas change every release, community content dies.
4. **Editor trap**: a visual editor can balloon in scope and maintenance.

### Pragmatic mitigations
- Start with **data-only packs**.
- Freeze a **v1 content schema** and deprecate slowly.
- Keep the first editor minimal: grid placement + rotate + export.
- Prefer “built-in environments” + configuration over “custom environment code” early.

### What you should *not* do yet
- Do not accept third-party React components for props.
- Do not build a marketplace backend before you have working import/export + schemas.

---

## References to current codebase

- Vision & phase plan: `docs/3d-world-design.md`
- Grid system RFC & migration notes: `docs/grid-system-design.md`
- Grid model (20×20): `frontend/src/lib/grid/types.ts`
- Built-in blueprints: `frontend/src/lib/grid/blueprints.ts`
- Prop mapping + mount types: `frontend/src/components/world3d/grid/PropRegistry.tsx`
- Environment selection (currently localStorage): `frontend/src/components/world3d/environments/index.tsx`
- Bot variant mapping: `frontend/src/components/world3d/utils/botVariants.ts`
- Backend settings store: `backend/app/routes/settings.py`
- Backup/export/import: `backend/app/routes/backup.py`
