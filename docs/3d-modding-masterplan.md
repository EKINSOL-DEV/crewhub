# CrewHub 3D World — Modding Masterplan

*Version: 1.0 — 2026-02-04*
*Status: DRAFT — Awaiting approval*
*Based on: Opus architecture analysis + GPT-5.2 strategic review*

---

## 1. Executive Summary

CrewHub's 3D World is a Three.js visualization of AI agent sessions — rooms, bots, props, environments — rendered in the browser. Today it's a closed system: adding a new prop means editing `PropRegistry.tsx`, adding a room layout means writing TypeScript in `blueprints.ts`, adding a bot skin means touching three component files with switch statements.

**The goal:** Turn CrewHub's 3D World into a moddable platform where users can create, share, and install custom content — props, room layouts, environments, bot skins, and full world packs — without writing code or touching the source.

**The approach:** Data-first modding. No code execution from mods. JSON definitions, glTF models, and a registry pattern that makes built-in content behave exactly like modded content. Think Minecraft resource packs, not Roblox scripting.

**The end vision:** A user downloads a `.crewhub-worldpack` file from Discord/GitHub, drops it into CrewHub, and their entire office transforms — new room layouts, custom furniture, themed environments, unique bot appearances. Later, a visual editor lets them build rooms by dragging props onto a grid. Eventually, a community gallery makes discovery effortless.

**Why this matters:** CrewHub is open-source. Community content is the multiplier. The 3D world is the most visual, shareable, and fun part of the product. Making it moddable turns every user into a potential contributor.

**The good news:** We're already halfway there. The grid system, blueprint data model, and prop registry pattern are well-designed. The main work is converting static TypeScript constants into dynamic registries and adding JSON serialization. Estimated total effort: **8-12 developer days** across 5 phases.

---

## 2. Current State

### What Works Well

The 3D world has a solid architecture with clean separation:

- **Grid system** (`frontend/src/lib/grid/`): A 20×20 cell grid per room with walkability, interaction points, pathfinding. ~1,350 lines, self-contained. This is the right data model.
- **Prop pipeline**: `PropRegistry` (46 props) → `placeOnGrid()` → `GridRoomRenderer` — string IDs map to components, mount types, and Y offsets. The pattern is right; it's just not dynamic.
- **Blueprint model**: `RoomBlueprint` type already contains everything needed for serialization — grid dimensions, cell data, door positions, interaction points, walkable center.
- **Environment system**: Clean interface — environments only receive `buildingWidth` and `buildingDepth`. Adding a new one is trivial once the registry is open.
- **Bot variants**: Config-driven with `BotVariantConfig` (color, accessory, expression, chest display). 5 built-in variants detected by keyword matching.

### What's Hardcoded

From the Opus audit — the full list of blockers for modding:

| Blocker | File | Impact |
|---------|------|--------|
| `PROP_REGISTRY` is a frozen `const` | `PropRegistry.tsx:763` | Can't add props at runtime |
| Blueprints are imperative TypeScript | `blueprints.ts` (9 `create*()` functions) | Can't load from JSON |
| Room-to-blueprint matching is fuzzy string matching | `blueprints.ts:395` | Fragile, breaks with custom names |
| `EnvironmentType` is a string literal union | `environments/index.tsx:7` | Can't add environments |
| Bot accessories use switch statements | `BotAccessory.tsx:15` | Can't add new accessory types |
| Bot chest displays use switch statements | `BotChestDisplay.tsx:20` | Can't add new display types |
| 5 variant configs are static | `botVariants.ts:17-50` | Can't create custom bot skins |
| Grid dimensions are module constants | `blueprints.ts:12-14` | All rooms forced to 20×20 |

### The Gap

The data models are right. The rendering pipeline is clean. What's missing is:

1. **Dynamic registries** — making existing static records into runtime-extensible stores
2. **JSON serialization** — blueprints and prop definitions as data files, not code
3. **A mod loading system** — discover, validate, register, and unload content packs
4. **Import/export** — pack format, validation, sharing

None of this requires architectural revolution. It's a migration from "code-defined content" to "data-defined content" using patterns already present in the codebase.

---

## 3. Architecture Vision

### Core Principle: Registry<T> Everything

Every content type gets a typed registry. Built-in content registers itself at startup, exactly like mods would. No special paths for built-ins.

```typescript
// frontend/src/lib/modding/Registry.ts
export class Registry<T> {
  private entries = new Map<string, RegistryEntry<T>>()
  private listeners = new Set<() => void>()

  register(id: string, data: T, source: 'builtin' | 'mod' = 'builtin', modId?: string): void
  unregister(id: string): boolean
  get(id: string): T | null
  has(id: string): boolean
  list(): RegistryEntry<T>[]
  listBySource(source: 'builtin' | 'mod'): RegistryEntry<T>[]
  subscribe(listener: () => void): () => void  // React integration
}

interface RegistryEntry<T> {
  id: string
  data: T
  source: 'builtin' | 'mod'
  modId?: string
}
```

This is ~50 lines of code. It powers everything.

### Registry Instances

```typescript
// frontend/src/lib/modding/registries.ts
export const propRegistry       = new Registry<PropRegistryEntry>()
export const blueprintRegistry  = new Registry<BlueprintRegistryEntry>()
export const environmentRegistry = new Registry<EnvironmentRegistryEntry>()
export const botVariantRegistry = new Registry<BotVariantConfig>()
export const accessoryRegistry  = new Registry<React.FC<AccessoryProps>>()
export const chestDisplayRegistry = new Registry<React.FC<ChestDisplayProps>>()
```

### How Content Flows

```
                    ┌─────────────────────────┐
                    │     Content Sources      │
                    │                          │
                    │  Built-in (startup)      │
                    │  .crewhub-worldpack      │
                    │  JSON file import        │
                    │  (Future: gallery)       │
                    └────────┬────────────────┘
                             │
                             ▼
                    ┌─────────────────────────┐
                    │      ModManager          │
                    │                          │
                    │  validate()              │
                    │  loadMod(manifest)       │
                    │  unloadMod(id)           │
                    └────────┬────────────────┘
                             │
                    ┌────────┴────────────────┐
                    │      Registries          │
                    │                          │
                    │  propRegistry            │
                    │  blueprintRegistry       │
                    │  environmentRegistry     │
                    │  botVariantRegistry      │
                    │  accessoryRegistry       │
                    │  chestDisplayRegistry    │
                    └────────┬────────────────┘
                             │
                    ┌────────┴────────────────┐
                    │    Rendering Layer       │
                    │                          │
                    │  GridRoomRenderer        │
                    │  EnvironmentSwitcher     │
                    │  Bot3D / BotAccessory    │
                    │  BotChestDisplay         │
                    └─────────────────────────┘
```

### Key Design Decisions

1. **Data-only mods by default.** No arbitrary JavaScript from mod packs. Props defined via JSON geometry primitives or glTF models. No React components from untrusted sources.

2. **Built-ins are first-party mods.** Built-in props, blueprints, and environments register through the same API as mods. This ensures the API actually works.

3. **Explicit room-to-blueprint mapping.** Replace fuzzy string matching with a `blueprintId` field on Room objects. Fall back to fuzzy matching only for rooms without explicit mapping.

4. **Backend stores mod state.** Installed packs, enabled state, and environment selection stored via `/settings` endpoint (already exists in `backend/app/routes/settings.py`). No more localStorage for persistent 3D world state.

5. **glTF 2.0 for external models.** When users want custom 3D geometry beyond primitives, use `.glb` files. Standard, well-tooled (Blender), efficient.

6. **No custom shaders in v1.** Toon materials only. Custom shaders are a GPU security risk and maintenance burden.

---

## 4. Content Format Standards

### 4.1 Prop Definition

A prop is a piece of furniture or decoration that can be placed on the room grid.

```json
{
  "$schema": "https://crewhub.dev/schemas/prop.v1.json",
  "id": "workbench",
  "name": "Workbench",
  "category": "furniture",
  "mountType": "floor",
  "yOffset": 0.16,
  "defaultSpan": { "w": 2, "d": 1 },
  "geometry": {
    "type": "composite",
    "parts": [
      {
        "shape": "box",
        "args": [1.2, 0.06, 0.7],
        "position": [0, 0.75, 0],
        "color": "#8B6B4A",
        "material": "toon"
      },
      {
        "shape": "box",
        "args": [0.06, 0.75, 0.06],
        "position": [-0.55, 0.375, -0.30],
        "color": "#6B4A3A",
        "material": "toon"
      },
      {
        "shape": "box",
        "args": [0.06, 0.75, 0.06],
        "position": [0.55, 0.375, -0.30],
        "color": "#6B4A3A",
        "material": "toon"
      },
      {
        "shape": "box",
        "args": [0.06, 0.75, 0.06],
        "position": [-0.55, 0.375, 0.30],
        "color": "#6B4A3A",
        "material": "toon"
      },
      {
        "shape": "box",
        "args": [0.06, 0.75, 0.06],
        "position": [0.55, 0.375, 0.30],
        "color": "#6B4A3A",
        "material": "toon"
      }
    ]
  },
  "metadata": {
    "author": "crewhub",
    "description": "A sturdy wooden workbench with four legs",
    "tags": ["workshop", "furniture"]
  }
}
```

**Geometry types supported:**

| Type | Description | When to use |
|------|-------------|-------------|
| `composite` | Array of primitive shapes (box, cylinder, sphere, cone) | Simple props, fast to create |
| `model` | Reference to a `.glb` file | Complex props, imported from Blender |
| `builtin` | Reference to a built-in React component by name | Existing props during migration |

**Model-based prop example:**
```json
{
  "id": "fancy-desk",
  "name": "Fancy Desk",
  "category": "furniture",
  "mountType": "floor",
  "yOffset": 0.16,
  "defaultSpan": { "w": 2, "d": 2 },
  "geometry": {
    "type": "model",
    "uri": "models/fancy-desk.glb",
    "scale": [1, 1, 1],
    "pivot": "bottom-center"
  }
}
```

**Built-in prop (migration bridge):**
```json
{
  "id": "desk-with-monitor",
  "name": "Desk with Monitor",
  "category": "furniture",
  "mountType": "floor",
  "yOffset": 0.16,
  "defaultSpan": { "w": 2, "d": 2 },
  "geometry": {
    "type": "builtin",
    "component": "DeskWithMonitorProp"
  }
}
```

### 4.2 Room Blueprint

A room blueprint defines the layout of props, interaction points, and doors on a grid.

```json
{
  "$schema": "https://crewhub.dev/schemas/room-blueprint.v1.json",
  "id": "library",
  "name": "Library",
  "gridWidth": 20,
  "gridDepth": 20,
  "cellSize": 0.6,
  "props": [
    {
      "propId": "bookshelf",
      "x": 17, "z": 1,
      "type": "furniture",
      "span": { "w": 2, "d": 2 }
    },
    {
      "propId": "desk-with-monitor",
      "x": 3, "z": 4,
      "type": "furniture",
      "span": { "w": 2, "d": 2 }
    },
    {
      "propId": "desk-with-monitor",
      "x": 14, "z": 4,
      "type": "furniture",
      "span": { "w": 2, "d": 2 }
    },
    {
      "propId": "lamp",
      "x": 2, "z": 16,
      "type": "decoration"
    },
    {
      "propId": "plant",
      "x": 18, "z": 16,
      "type": "decoration"
    }
  ],
  "interactions": {
    "work": [{ "x": 3, "z": 5 }, { "x": 14, "z": 5 }],
    "coffee": [{ "x": 17, "z": 3 }],
    "sleep": [{ "x": 2, "z": 18 }]
  },
  "doors": [
    { "x": 9, "z": 19, "facing": "south" },
    { "x": 10, "z": 19, "facing": "south" }
  ],
  "walkableCenter": { "x": 10, "z": 10 },
  "metadata": {
    "author": "crewhub",
    "description": "A cozy library with study desks and bookshelves",
    "tags": ["study", "creative"]
  }
}
```

**Grid coordinate system:**
- `x=0` west wall, `x=19` east wall
- `z=0` north wall, `z=19` south wall
- Walls occupy the perimeter (row/col 0 and 19)
- Interior cells: `x=1..18`, `z=1..18`
- Standard door position: `(9,19)` and `(10,19)` — south wall center

**Validation rules (enforced at load time):**
- Grid dimensions: 10×10 minimum, 30×30 maximum
- At least one door on a wall edge
- At least one `work` interaction point
- All interaction points must be on walkable cells
- Walkable center must be walkable
- No prop overlaps (span collision detection)
- All referenced `propId` values must exist in the prop registry

### 4.3 Environment / Theme

Environments define the world outside the building — sky, ground, lighting, fog, scattered decorations.

```json
{
  "$schema": "https://crewhub.dev/schemas/environment.v1.json",
  "id": "desert",
  "name": "Desert",
  "description": "Sandy desert landscape with warm lighting",
  "sky": {
    "color": "#87CEEB",
    "fog": { "color": "#D2B48C", "near": 30, "far": 120 }
  },
  "lighting": {
    "ambient": { "color": "#FFF5E0", "intensity": 0.5 },
    "directional": { "color": "#FFFFFF", "intensity": 0.9, "position": [10, 20, 5] },
    "hemisphere": { "skyColor": "#87CEEB", "groundColor": "#D2B48C", "intensity": 0.3 }
  },
  "ground": {
    "type": "builtin",
    "component": "GrassEnvironment"
  },
  "metadata": {
    "author": "crewhub",
    "tags": ["warm", "outdoor"]
  }
}
```

**Decision:** For v1, environments use `"type": "builtin"` referencing existing React components. The lighting and sky configuration is data-driven. Custom ground geometry via glTF is a Phase 4+ feature — it's complex, and the 3 built-in environments cover most needs.

### 4.4 Bot Skin / Variant

Bot skins customize a bot's visual appearance — color, head accessory, chest display, expression.

```json
{
  "$schema": "https://crewhub.dev/schemas/bot-skin.v1.json",
  "id": "pirate",
  "name": "Pirate Bot",
  "color": "#8B4513",
  "expression": "happy",
  "accessory": "crown",
  "chestDisplay": "tool",
  "icon": "🏴‍☠️",
  "matchKeywords": ["pirate", "arr"],
  "metadata": {
    "author": "community-user",
    "description": "Arr! A seafaring bot variant"
  }
}
```

**Constraints:**
- `expression` must be one of: `happy`, `thoughtful`, `determined`, `talking`, `serious`
- `accessory` must reference a registered accessory type (5 built-in: `crown`, `lightbulb`, `clock`, `signal`, `gear`)
- `chestDisplay` must reference a registered chest display type (5 built-in: `tool`, `dots`, `clock-display`, `chat-dots`, `code`)
- Custom accessories/chest displays require glTF geometry (Phase 3+)
- Bot body shape is fixed (head + body + arms + feet) — full custom models are out of scope for now

### 4.5 World Pack (Bundle)

A world pack bundles multiple content types into a single distributable package.

**File format:** `.crewhub-worldpack` — a ZIP archive with a `manifest.json` at the root.

```
neon-office.crewhub-worldpack (ZIP)
├── manifest.json
├── blueprints/
│   ├── neon-lab.json
│   └── server-room.json
├── props/
│   ├── neon-desk.json
│   └── hologram-display.json
├── environments/
│   └── cyberpunk.json
├── bots/
│   └── hacker-bot.json
├── models/
│   ├── neon-desk.glb
│   └── hologram.glb
└── thumbnails/
    ├── pack-cover.png
    └── neon-lab-preview.png
```

**manifest.json:**
```json
{
  "$schema": "https://crewhub.dev/schemas/worldpack-manifest.v1.json",
  "id": "com.example.neon-office",
  "name": "Neon Office Pack",
  "version": "1.0.0",
  "author": "neon-creator",
  "description": "A cyberpunk-themed office with neon props and holographic displays",
  "crewhub": ">=0.3.0",
  "schemaVersion": 1,
  "content": {
    "blueprints": ["blueprints/neon-lab.json", "blueprints/server-room.json"],
    "props": ["props/neon-desk.json", "props/hologram-display.json"],
    "environments": ["environments/cyberpunk.json"],
    "botSkins": ["bots/hacker-bot.json"]
  },
  "assets": {
    "models": ["models/neon-desk.glb", "models/hologram.glb"],
    "thumbnails": ["thumbnails/pack-cover.png", "thumbnails/neon-lab-preview.png"]
  },
  "thumbnail": "thumbnails/pack-cover.png"
}
```

---

## 5. Modding Capabilities

What can users mod, ranked by value and difficulty:

### Tier 1: Quick Wins (Phase 1-2)

#### Custom Room Layouts ⭐⭐⭐⭐⭐ value / ⭐⭐ difficulty
Write a JSON blueprint, reference existing props from the 46 built-in set, assign to a room. This is the highest-value mod with the lowest barrier — no 3D modeling needed, just spatial thinking.

**User experience:** "I wrote a JSON file with my dream office layout, dropped it in CrewHub, and my Dev Room transformed."

#### Custom Props via Primitives ⭐⭐⭐⭐ value / ⭐⭐ difficulty
Define new props using JSON geometry (boxes, cylinders, spheres composed together). No 3D software needed. Good for simple furniture and decorations.

**User experience:** "I defined a bookstack prop with three colored boxes. It shows up in the prop palette."

#### Custom Bot Skins ⭐⭐⭐⭐ value / ⭐ difficulty
Change bot colors, pick from existing accessories/expressions/chest displays, set keyword matching. Pure JSON, no geometry.

**User experience:** "My cron bots now wear pirate colors and have the gear accessory."

### Tier 2: Intermediate (Phase 2-3)

#### Custom Props via glTF ⭐⭐⭐⭐⭐ value / ⭐⭐⭐ difficulty
Import `.glb` models from Blender or other 3D tools. Requires 3D modeling skills but enables unlimited prop variety.

**User experience:** "I modeled a custom standing desk in Blender, exported to GLB, and it renders perfectly in my room."

#### Custom Environments (config) ⭐⭐⭐ value / ⭐⭐ difficulty
Customize sky color, fog, lighting settings for existing environment types. Change the mood without new geometry.

**User experience:** "I made a sunset theme — warm orange sky, golden lighting, pink fog."

### Tier 3: Advanced (Phase 4+)

#### Full World Packs ⭐⭐⭐⭐⭐ value / ⭐⭐⭐⭐ difficulty
Bundle everything — custom blueprints, props, environments, bot skins — into a shareable `.crewhub-worldpack`. The modder's endgame.

**User experience:** "I shared my 'Cyberpunk Office' world pack on GitHub. 50 people downloaded it."

#### Custom Bot Accessories/Displays ⭐⭐⭐ value / ⭐⭐⭐⭐ difficulty
Define new head accessories and chest display types via glTF geometry. Requires precise modeling to fit the bot body.

**What we won't support (by design):**
- Custom animations (deeply coupled to Bot3D's useFrame loop — too complex, low demand)
- Custom bot body shapes (fixed head+body+arms+feet structure is core to the aesthetic)
- Custom shaders (security risk, maintenance burden)
- Arbitrary JavaScript execution (see Security section)

---

## 6. Import/Export System

### How Mods Get Installed

#### Method 1: Single File Import (UI)
1. User clicks "Import" in 3D World settings
2. Selects a `.json` file (single blueprint/prop/skin) or `.crewhub-worldpack` (bundle)
3. ModManager validates the content against schemas
4. If valid: registers content in the appropriate registries, stores in backend
5. If invalid: shows clear error messages (which field, what's wrong)

#### Method 2: Pack Directory (Advanced)
Power users can place packs in `~/.crewhub/packs/` and they load on startup. Good for development.

```
~/.crewhub/packs/
├── neon-office/
│   ├── manifest.json
│   ├── blueprints/
│   └── props/
└── medieval-castle/
    ├── manifest.json
    └── ...
```

#### Method 3: URL Import (Future)
```
POST /api/mods/install
{ "url": "https://github.com/user/repo/releases/download/v1/pack.crewhub-worldpack" }
```

### How Mods Get Exported

#### Blueprint Export
Right-click a room → "Export Blueprint" → downloads `room-name.json` with the full blueprint definition and any custom prop references.

#### Full World Export
Settings → "Export World Pack" → bundles:
- All room configurations (room ↔ blueprint mappings)
- All custom blueprints (not built-ins)
- All custom props (definitions + model files)
- Environment selection + custom environment configs
- Custom bot skins
- Building layout settings

Output: `.crewhub-worldpack` ZIP file.

### Backend Storage

Installed mod state is persisted via the existing `/settings` API:

```json
{
  "world.mods.installed": [
    {
      "id": "com.example.neon-office",
      "version": "1.0.0",
      "enabled": true,
      "installedAt": "2026-02-04T16:00:00Z"
    }
  ],
  "world.environment.selected": "grass",
  "world.rooms.blueprintOverrides": {
    "room-uuid-1": "custom-blueprint-id"
  }
}
```

### Validation Pipeline

Every piece of imported content goes through:

1. **Schema validation** — JSON Schema check against the appropriate `v1` schema
2. **Reference validation** — All `propId` references resolve to registered props
3. **Constraint validation** — Grid bounds, span collisions, door placement rules
4. **Asset validation** — File size limits (models < 5MB, textures < 2MB, pack < 50MB)
5. **Conflict detection** — Warn if IDs overlap with existing content (mod wins by default, configurable)

---

## 7. Visual Editor Roadmap

The visual editor is Phase 4 — after the data foundation is solid. Don't build the editor until schemas are stable, or you'll be rewriting it constantly.

### Minimum Viable Editor (Phase 4)

A room blueprint editor integrated into the 3D World UI:

**What it looks like:**
- Split view: 3D preview on left, tool palette on right
- Top-down grid overlay mode (like the existing `GridDebugOverlay` but interactive)
- Prop palette: scrollable list of registered props, grouped by category, with thumbnails
- Click-to-place, click-to-select, drag-to-move
- Rotation buttons (0°/90°/180°/270°)
- Delete key to remove
- Interaction point placement mode (work/coffee/sleep markers)
- Door placement on wall edges

**What it produces:**
- A `room-blueprint.v1.json` file
- Validation errors shown inline (red highlights on invalid placements)
- "Export" button → download JSON
- "Apply" button → live-update the room

**What it doesn't do (yet):**
- No prop geometry editing (use Blender for that)
- No environment editing (JSON config is sufficient)
- No undo/redo (keep it simple for v1)
- No multi-room editing

### Extended Editor (Phase 5+)

- Undo/redo stack
- Building layout editor (room arrangement, hallway config)
- Prop preview hover (3D thumbnail on mouse-over)
- Copy/paste room sections
- Template system ("start from Dev Room template")
- Integrated `.crewhub-worldpack` export

### Technology

The grid system (`frontend/src/lib/grid/`) is the ideal foundation. The editor manipulates `GridCell` arrays and outputs `BlueprintJSON`. The existing `GridDebugOverlay` component (`GridDebugOverlay.tsx`) already renders the grid visually — extend it with interaction handlers.

---

## 8. Security & Sandboxing

### What Mods Can Do

✅ Define prop geometry using primitives (box, cylinder, sphere, cone)
✅ Reference `.glb` model files bundled in the pack
✅ Define room blueprints (grid layouts, prop placements)
✅ Configure environment parameters (colors, lighting, fog)
✅ Define bot skins (colors, accessory/display selection)
✅ Include static assets (models, textures, thumbnails)

### What Mods Cannot Do

❌ Execute arbitrary JavaScript
❌ Load React components at runtime (even though PropRegistry uses them internally — mods don't)
❌ Make network requests
❌ Access the filesystem beyond the pack directory
❌ Access session data, logs, or API keys
❌ Define custom shaders or GPU programs
❌ Override core mechanics (camera, physics, animation state machine)

### Why No Code Mods

CrewHub is a dashboard for AI agent management. It handles sensitive data — API keys, session logs, agent configurations. Allowing arbitrary code execution from community content would be a serious security risk. The value/risk ratio doesn't justify it.

If code mods are ever needed (far future), the approach would be:
- Web Worker sandbox (no DOM access)
- Message-passing API with a narrow surface
- Explicit permissions model
- Mandatory code review for gallery submissions

### Asset Safety

Even data-only mods can cause issues:

| Risk | Mitigation |
|------|------------|
| Oversized models (crash/slowdown) | Max 5MB per `.glb`, max 50MB per pack |
| Oversized textures | Max 2048×2048 per texture, max 2MB per file |
| Excessive poly count | Warn above 10K triangles per prop (soft limit) |
| Malformed JSON | Schema validation rejects invalid data |
| ID collisions | Explicit conflict warning, last-loaded wins |
| Path traversal in ZIP | Sanitize all paths, reject `../` |

---

## 9. Implementation Phases

### Phase 1: Registry Pattern (2-3 days)

**Goal:** Replace all static constants with dynamic registries. Zero visual changes. Drop-in replacement.

**Tasks:**

| Task | File(s) | Effort |
|------|---------|--------|
| Create `Registry<T>` class | `frontend/src/lib/modding/Registry.ts` (new) | 0.5 day |
| Create registry instances | `frontend/src/lib/modding/registries.ts` (new) | 0.25 day |
| Migrate `PROP_REGISTRY` to `propRegistry` | `PropRegistry.tsx` → split + refactor | 0.5 day |
| Replace `BotAccessory` switch with registry | `BotAccessory.tsx` | 0.25 day |
| Replace `BotChestDisplay` switch with registry | `BotChestDisplay.tsx` | 0.25 day |
| Migrate `VARIANT_CONFIGS` to `botVariantRegistry` | `botVariants.ts` | 0.25 day |
| Replace `EnvironmentType` union with registry | `environments/index.tsx` | 0.25 day |
| Register all built-in content at startup | New `builtins.ts` initialization file | 0.5 day |

**Key files changed:**
- `frontend/src/lib/modding/` — NEW directory (Registry, registries, types)
- `frontend/src/components/world3d/grid/PropRegistry.tsx` — refactored to use propRegistry
- `frontend/src/components/world3d/utils/botVariants.ts` — refactored
- `frontend/src/components/world3d/bot/BotAccessory.tsx` — switch → registry
- `frontend/src/components/world3d/bot/BotChestDisplay.tsx` — switch → registry
- `frontend/src/components/world3d/environments/index.tsx` — union → registry

**Verification:** All existing tests pass. Visual diff = zero. The 3D world looks exactly the same.

**Dependencies:** None. Can start immediately.

### Phase 2: Blueprint Serialization (2-3 days)

**Goal:** Blueprints defined in JSON files, loaded via a parser/validator. Existing blueprints converted.

**Tasks:**

| Task | File(s) | Effort |
|------|---------|--------|
| Define `BlueprintJSON` schema | `frontend/src/lib/modding/schemas/room-blueprint.v1.json` (new) | 0.5 day |
| Create `blueprintLoader.ts` (JSON → RoomBlueprint) | `frontend/src/lib/modding/blueprintLoader.ts` (new) | 0.5 day |
| Create `blueprintValidator.ts` | `frontend/src/lib/modding/blueprintValidator.ts` (new) | 0.5 day |
| Convert 9 built-in blueprints to JSON | `frontend/src/lib/grid/blueprints/` — 9 JSON files (new) | 1 day |
| Refactor `blueprints.ts` to load from JSON + register | `frontend/src/lib/grid/blueprints.ts` — major refactor | 0.5 day |
| Replace fuzzy `getBlueprintForRoom()` with registry lookup | `blueprints.ts` + `Room3D.tsx` | 0.25 day |
| Add `blueprintId` field support on Room objects | Backend: Room model + frontend hook | 0.25 day |

**Key files changed:**
- `frontend/src/lib/grid/blueprints.ts` — refactored from imperative to JSON loader
- `frontend/src/lib/grid/blueprints/` — NEW directory with 9 JSON files
- `frontend/src/lib/modding/blueprintLoader.ts` — NEW
- `frontend/src/lib/modding/blueprintValidator.ts` — NEW
- `frontend/src/components/world3d/Room3D.tsx` — use blueprintRegistry instead of getBlueprintForRoom()

**Verification:** All 9 rooms render identically from JSON definitions. Validation catches intentionally broken blueprints.

**Dependencies:** Phase 1 (needs blueprintRegistry).

### Phase 3: Import/Export + ModManager (3-4 days)

**Goal:** Users can import single content files and world packs. Mod state persisted in backend.

**Tasks:**

| Task | File(s) | Effort |
|------|---------|--------|
| Create `ModManager` class | `frontend/src/lib/modding/ModManager.ts` (new) | 1 day |
| Create JSON Schema files for all content types | `frontend/src/lib/modding/schemas/` (new) | 0.5 day |
| Create prop definition parser (JSON geometry → Three.js) | `frontend/src/lib/modding/propLoader.ts` (new) | 1 day |
| Create ZIP pack parser (unpack + validate + register) | `frontend/src/lib/modding/packLoader.ts` (new) | 0.5 day |
| Add Mods UI panel (list installed, enable/disable, import) | `frontend/src/components/world3d/ModsPanel.tsx` (new) | 0.5 day |
| Add backend settings for mod state | Settings API calls from frontend | 0.25 day |
| World export (all content → `.crewhub-worldpack`) | Export logic in ModManager | 0.5 day |

**Key deliverables:**
- Import `.json` file → validates → registers in appropriate registry
- Import `.crewhub-worldpack` → unzips → validates manifest → loads all content
- Mods panel shows installed packs with enable/disable toggles
- "Export World" button produces a downloadable pack

**Dependencies:** Phase 1 + Phase 2.

### Phase 4: Visual Blueprint Editor (3-4 days)

**Goal:** In-app room layout editor. Click to place props on the grid, export blueprints.

**Tasks:**

| Task | File(s) | Effort |
|------|---------|--------|
| Editor mode toggle in Room3D | `Room3D.tsx` modification | 0.25 day |
| Interactive grid overlay (click cells) | Extend `GridDebugOverlay.tsx` | 1 day |
| Prop palette sidebar (categorized, searchable) | `BlueprintEditor.tsx` (new) | 0.5 day |
| Place/move/rotate/delete props on grid | Editor interaction logic | 1 day |
| Interaction point & door placement tools | Editor tool modes | 0.5 day |
| Live validation display (red = invalid) | Validation integration | 0.25 day |
| Export/Apply buttons | Editor actions | 0.25 day |

**Dependencies:** Phase 1 + Phase 2 + Phase 3 (needs stable schemas and registry).

### Phase 5: Polish & Community Features (2-3 days)

**Goal:** glTF model support, prop splitting, documentation, pack template.

**Tasks:**

| Task | File(s) | Effort |
|------|---------|--------|
| glTF/GLB model loader for props | Three.js `useGLTF` integration in prop renderer | 1 day |
| Split `PropRegistry.tsx` (830 lines) into individual files | `grid/props/floor/`, `grid/props/wall/` directories | 0.5 day |
| Modding documentation | `docs/modding/getting-started.md`, etc. | 0.5 day |
| World pack template repository | `worldpack-template/` folder | 0.25 day |
| Content preview panel (3D thumbnail of props/blueprints) | Preview renderer component | 0.5 day |
| Environment settings persistence (localStorage → backend) | Settings API integration | 0.25 day |

**Dependencies:** Phase 3.

### Timeline Summary

```
Phase 1: Registry Pattern          ████░░░░░░░░░░░░░░  2-3 days  (Week 1)
Phase 2: Blueprint Serialization   ░░░████░░░░░░░░░░░░  2-3 days  (Week 1-2)
Phase 3: Import/Export + ModMgr    ░░░░░░░█████░░░░░░░  3-4 days  (Week 2-3)
Phase 4: Visual Editor             ░░░░░░░░░░░░█████░░  3-4 days  (Week 3-4)
Phase 5: Polish & Community        ░░░░░░░░░░░░░░░░███  2-3 days  (Week 4-5)
                                   ─────────────────────
                                   Total: 12-17 days (~3-4 weeks)
```

**Quick wins to ship early:**
- Phase 1 alone makes the codebase cleaner (no more switch statements, extensible registries)
- Phase 1 + 2 enables power users to edit JSON blueprints and see custom room layouts
- Phase 3 makes it user-friendly (import button, mods panel)

---

## 10. Risk Assessment

### Risk 1: Over-Engineering 🔴 HIGH

**The trap:** Building a full mod platform for what is primarily a dashboard visualization. CrewHub isn't Minecraft — the 3D world is a nice feature, not the core product.

**Guardrail:** Each phase must be independently shippable and add value on its own. If after Phase 2 modding interest is low, stop there. The registry refactoring (Phase 1) improves code quality regardless of modding.

**Decision checkpoint:** After Phase 3, evaluate community interest before investing in the visual editor (Phase 4).

### Risk 2: Schema Churn 🟡 MEDIUM

**The trap:** Changing JSON schemas every release, breaking community content.

**Guardrail:** Declare v1 schemas as stable after Phase 2. Add fields only in backward-compatible ways (new optional fields). Support deprecated fields for at least 2 minor versions. Include `schemaVersion` in all content files for migration.

### Risk 3: Scope Creep on Visual Editor 🟡 MEDIUM

**The trap:** The editor grows from "place props on grid" to "full 3D modeling suite."

**Guardrail:** The editor does exactly three things: place props, set interaction points, set doors. That's it. No prop geometry editing, no environment editing, no multi-room layout editing. Export JSON and get out.

### Risk 4: Performance with Many Mods 🟢 LOW

**The trap:** 50 custom glTF models tank frame rate.

**Guardrail:** Enforce file size limits. Warn on high poly counts. The existing `InstancedMesh` pattern in environments shows the team knows how to optimize. For v1, this is unlikely to be an issue — the audience is small.

### Risk 5: Security from Data Mods 🟢 LOW

**The trap:** Even without code execution, malicious packs could cause issues.

**Guardrail:** Strict validation pipeline (schema, references, sizes, path sanitization). No custom shaders. No network access. The attack surface of "JSON + glTF in a sandbox" is small.

### What We're Explicitly NOT Building

- ❌ Marketplace backend (GitHub releases + Discord is fine for now)
- ❌ Code mod system / scripting API
- ❌ Custom animation system
- ❌ Custom bot body shapes
- ❌ Real-time collaborative editing
- ❌ NPM-based mod distribution
- ❌ Mod dependency resolution (keep packs self-contained)

---

## Appendix A: File Structure (Target State)

```
frontend/src/
├── lib/
│   ├── modding/                          # NEW — Core mod system
│   │   ├── Registry.ts                   # Generic Registry<T> class
│   │   ├── registries.ts                 # All registry instances
│   │   ├── ModManager.ts                 # Mod loading/unloading
│   │   ├── blueprintLoader.ts            # JSON → RoomBlueprint
│   │   ├── blueprintValidator.ts         # Blueprint validation
│   │   ├── propLoader.ts                 # JSON geometry → Three.js
│   │   ├── packLoader.ts                 # ZIP → validated content
│   │   ├── builtins.ts                   # Register all built-in content
│   │   ├── types.ts                      # Shared types
│   │   └── schemas/                      # JSON Schema definitions
│   │       ├── room-blueprint.v1.json
│   │       ├── prop-definition.v1.json
│   │       ├── environment.v1.json
│   │       ├── bot-skin.v1.json
│   │       └── worldpack-manifest.v1.json
│   └── grid/
│       ├── types.ts                      # Existing — unchanged
│       ├── blueprints/                   # NEW — JSON blueprint files
│       │   ├── headquarters.json
│       │   ├── dev-room.json
│       │   ├── creative-room.json
│       │   ├── marketing-room.json
│       │   ├── thinking-room.json
│       │   ├── automation-room.json
│       │   ├── comms-room.json
│       │   ├── ops-room.json
│       │   └── default.json
│       ├── blueprintIndex.ts             # REFACTORED — loads JSON, registers
│       ├── blueprintUtils.ts             # Existing — unchanged
│       └── pathfinding.ts                # Existing — unchanged
├── components/world3d/
│   ├── grid/
│   │   ├── PropRegistry.ts              # REFACTORED — uses propRegistry
│   │   ├── props/                       # NEW (Phase 5) — split prop files
│   │   │   ├── floor/
│   │   │   ├── wall/
│   │   │   └── composites/
│   │   ├── GridRoomRenderer.tsx          # Existing — uses propRegistry.get()
│   │   └── GridDebugOverlay.tsx          # Existing — extended for editor
│   ├── bot/
│   │   ├── BotAccessory.tsx             # REFACTORED — registry lookup
│   │   └── BotChestDisplay.tsx          # REFACTORED — registry lookup
│   ├── environments/
│   │   └── index.tsx                    # REFACTORED — registry lookup
│   ├── editor/                          # NEW (Phase 4)
│   │   ├── BlueprintEditor.tsx
│   │   ├── PropPalette.tsx
│   │   └── EditorToolbar.tsx
│   └── ModsPanel.tsx                    # NEW (Phase 3) — mod management UI
```

## Appendix B: Quick Reference — "How Do I...?"

| I want to... | Format | Where it goes | Phase |
|---|---|---|---|
| Add a room layout | `room-blueprint.v1.json` | Import via UI or `~/.crewhub/packs/` | Phase 2 |
| Add a simple prop | `prop-definition.v1.json` (composite geometry) | Import via UI | Phase 3 |
| Add a 3D model prop | `prop-definition.v1.json` + `.glb` file | World pack | Phase 5 |
| Change a bot's look | `bot-skin.v1.json` | Import via UI | Phase 3 |
| Change sky/lighting | `environment.v1.json` | Import via UI | Phase 3 |
| Share my whole setup | "Export World" → `.crewhub-worldpack` | Share the file | Phase 3 |
| Build a room visually | In-app editor | Click & place | Phase 4 |

---

*This document supersedes `3d-world-architecture-analysis.md` (technical reference) and `3d-modding-strategy-review.md` (strategic review) as the approved plan. Those documents remain useful as detailed references.*
