# CrewHub Modding System — Opus Architecture Review

*Reviewer: Opus (Claude) — Senior Three.js/Game Development perspective*
*Date: 2026-02-05*
*Scope: Complete modding architecture (Registry, Blueprints, Props, Environments, Backend API)*
*Files reviewed: 2,452 lines across 8 core files + 9 JSON blueprints + masterplan + docs*

---

## Executive Verdict

**Grade: B+ — Solid foundation with clear path to A.**

The architecture is genuinely well-designed. The Registry pattern is correct, the data separation is clean, and the "built-ins are first-party mods" principle is properly implemented. This is not a toy — it's a real modding foundation that follows patterns used by successful moddable games.

However, there are specific technical issues that will cause real problems at scale, and some design decisions that could lock you into expensive refactors later. None are showstoppers — they're all fixable within the current architecture.

**TL;DR:** Ship Phase 1-2 confidently. Fix the snapshot allocation pattern and add lazy loading before Phase 3. The biggest risk isn't technical — it's over-engineering (and the masterplan acknowledges this, which is a good sign).

---

## 1. Game/Modding Pattern Analysis

### What You Got Right (Compared to Minecraft/Factorio/Cities:Skylines)

**✅ Registry Pattern = Industry Standard**

Every successful moddable game uses some variant of this pattern:
- **Minecraft** → `Registry<Block>`, `Registry<Item>`, `Registry<Biome>` — typed registries per content type
- **Factorio** → `data.raw["entity-type"]["entity-name"]` — nested map with string keys
- **Cities:Skylines** → `PrefabCollection` — asset registry with metadata

Your `Registry<T>` is a clean, typed version of exactly this. The `source: 'builtin' | 'mod'` metadata field is smart — Factorio tracks this too, and it's essential for debugging ("which mod added this broken prop?").

**✅ Data-Only Mods = Correct Security Model**

The decision to restrict mods to JSON + glTF (no JavaScript execution) is the right call for a dashboard application. Minecraft learned this the hard way — Java mods are a security nightmare. Factorio's Lua sandbox is complex. Cities:Skylines modding works precisely because most content is data-only (assets + config). Your constraint fits the product.

**✅ Built-ins Use the Same API**

This is the single most important pattern in modding architecture, and you nailed it. If built-in content has a special path, the mod API is untested. By forcing builtins through `propRegistry.register()`, you guarantee the API works because every frame depends on it.

Minecraft calls this "vanilla is just another mod." It's the gold standard.

**✅ JSON Blueprints with Declarative Placements**

The shift from imperative `createDevRoom()` functions to declarative JSON placements is exactly how Minecraft structure files and Cities:Skylines building templates work. The `blueprintLoader.ts` that replays placements through `placeOnGrid()` is clean — it reuses the same grid pipeline.

### What Needs Work

**⚠️ Missing: Namespaced IDs**

This is the **#1 pattern** that every moddable game uses and you're missing.

```
Current:  "desk-with-monitor"
Correct:  "crewhub:desk-with-monitor"  (built-in)
          "neon-pack:hologram-desk"     (mod)
```

Minecraft uses `minecraft:stone`, `modname:custom_block`. Factorio uses `base/stone`. Without namespacing, ID collisions between mods are inevitable. Two mods that both define `"custom-desk"` will silently overwrite each other.

The `modId` field on `RegistryEntry` is good, but it's metadata — not part of the key. When mod A and mod B both register `"custom-desk"`, the Map overwrites silently. With namespaces, they'd be `"mod-a:custom-desk"` and `"mod-b:custom-desk"` — no collision.

**Impact:** Low right now (no community mods yet), HIGH when Phase 3 ships.
**Fix:** Add namespace prefix to IDs. Keep plain IDs as sugar for `"crewhub:"` namespace. ~30 min change.

```typescript
// Enhanced register with namespace enforcement
register(id: string, data: T, source: 'builtin' | 'mod' = 'builtin', modId?: string): void {
  const qualifiedId = id.includes(':') ? id : `${modId ?? 'crewhub'}:${id}`
  // Also register the short alias for builtins
  if (source === 'builtin') {
    this.entries.set(id, { id, data, source, modId })
  }
  this.entries.set(qualifiedId, { id: qualifiedId, data, source, modId })
  this.notify()
}
```

**⚠️ Missing: Load Order / Priority System**

Factorio has explicit mod load order. Minecraft has mod loading phases (pre-init, init, post-init). Your registry just does "last write wins" — `register()` silently overwrites.

This matters when:
1. Mod A wants to *replace* a built-in prop (intentional override)
2. Mod B accidentally uses the same ID (collision)
3. Both mods are loaded — which one wins depends on import order

**Fix:** Add a `priority` field or an `override` flag:

```typescript
register(id: string, data: T, opts?: {
  source?: 'builtin' | 'mod'
  modId?: string
  override?: boolean  // explicit "I want to replace"
}): void {
  if (this.entries.has(id) && !opts?.override) {
    console.warn(`[Registry] ID '${id}' already registered by ${this.entries.get(id)!.source}. Use override:true to replace.`)
    return
  }
  // ...
}
```

**⚠️ Missing: Lifecycle Hooks**

Successful mod systems fire events when content is registered/unregistered:
- Factorio: `on_init`, `on_load`, `on_configuration_changed`
- Minecraft: `RegistryEvent.Register<Block>`

Your `subscribe()` is close (it notifies on any change), but there's no way to distinguish *what* changed. A mod that adds 50 props triggers 50 re-renders because each `register()` call fires `notify()`.

**Fix:** Batch registration + typed events:

```typescript
registerBatch(entries: Array<{ id: string; data: T }>, source: 'builtin' | 'mod', modId?: string): void {
  for (const { id, data } of entries) {
    this.entries.set(id, { id, data, source, modId })
  }
  this.snapshotDirty = true
  this.notify() // ONE notification for the whole batch
}
```

This is already partially implemented for blueprints (`registerBuiltinBlueprints()` loops and calls individual `register()`), but each call triggers a separate notification.

---

## 2. Three.js / R3F Performance Analysis

### Current Architecture

```
Registry<PropEntry>  →  getPropComponent(id)  →  React component  →  Three.js meshes
                                                    ↑
                         useSyncExternalStore       |
                                                    |
                    Every registry mutation triggers re-render
```

### Issues Found

**🔴 Critical: Snapshot Allocation on Every `list()` Call**

```typescript
// Registry.ts line 68-72
list(): readonly RegistryEntry<T>[] {
  if (this.snapshotDirty) {
    this.snapshot = Object.freeze([...this.entries.values()]) as readonly RegistryEntry<T>[]
    this.snapshotDirty = false
  }
  return this.snapshot
}
```

This allocates a new frozen array on every mutation. With `useSyncExternalStore` calling `getSnapshot()` on every render cycle, this is fine *as long as the snapshot is actually stable*. The current implementation correctly uses `snapshotDirty` to avoid re-allocating — **this is actually correct**.

However, `Object.freeze()` on every mutation has a hidden cost: it iterates the entire array to make it frozen. For 46 props this is negligible. For 500 props with frequent mod hot-reloading, it adds up.

**Fix:** Remove `Object.freeze()` — TypeScript's `readonly` already prevents mutation at compile time. Freeze is a runtime check that serves no purpose in a typed codebase.

```typescript
this.snapshot = [...this.entries.values()] as readonly RegistryEntry<T>[]
```

**🟡 Warning: `useToonMaterialProps` Called Per-Prop Instance**

Looking at `PropRegistry.tsx`, every prop component calls `useToonMaterialProps()` which likely creates new material instances per render. In Three.js, materials should be **shared** across identical meshes.

```tsx
// Current: Each BookshelfProp creates its own material instances
function BookshelfProp({ position, rotation }: PropProps) {
  const shelfToon = useToonMaterialProps(WARM_COLORS.wood)  // New material per instance!
```

With 20 bookshelves across rooms, you get 20 × (number of meshes per bookshelf) material instances. Three.js doesn't deduplicate these automatically.

**Impact:** Medium. For 46 props × 9 rooms this is ~150-400 materials. Acceptable for desktop, potentially problematic on mobile or with many modded props.

**Fix (Phase 3+):** Material cache by color/params hash:

```typescript
const materialCache = new Map<string, THREE.MeshToonMaterial>()
function getCachedToonMaterial(color: string): THREE.MeshToonMaterial {
  if (!materialCache.has(color)) {
    materialCache.set(color, new THREE.MeshToonMaterial({ color }))
  }
  return materialCache.get(color)!
}
```

**🟡 Warning: No Geometry Instancing for Repeated Props**

If a blueprint places 8 `desk-with-monitor` props, each one creates its own mesh geometry. Three.js `InstancedMesh` can render all 8 with a single draw call.

This isn't a bug — it's an optimization that becomes important with modded content. A mod blueprint with 50 identical plants would create 50 separate draw calls.

**Impact:** Low now, medium at 100+ prop instances per room.

**Fix (Phase 5):** Implement geometry instancing for identical propIds in the renderer. This is a GridRoomRenderer concern, not a Registry concern.

**🟢 Good: Frame Skip Pattern**

The animated props (ServerLED, WallClock, GearMechanism, SignalWaves) all use a frame skip pattern:

```tsx
const frameSkip = useRef(0)
useFrame(({ clock }) => {
  if (++frameSkip.current % 3 !== 0) return
  // update animation
})
```

This is smart — running animations at 20fps instead of 60fps saves CPU. Good Three.js hygiene.

**🟢 Good: Registry Subscribe is `useSyncExternalStore`-Compatible**

The `subscribe` and `getSnapshot` arrow fields have stable identity (no `.bind()` needed) and return referentially stable snapshots. This is exactly how external stores should integrate with React 18+. No unnecessary re-renders.

---

## 3. Scalability Analysis

### Current Scale

| Content Type | Count | Performance |
|---|---|---|
| Props | 46 built-in | ✅ Fine |
| Blueprints | 9 JSON files | ✅ Fine |
| Environments | 3 components | ✅ Fine |
| Total registry entries | ~58 | ✅ Negligible |

### Projected Scale (with mods)

| Scenario | Props | Blueprints | Environments |
|---|---|---|---|
| 5 mod packs | 100-150 | 30-50 | 10-15 |
| Community gallery | 300-500 | 100-200 | 30-50 |
| Power user w/ all packs | 500+ | 200+ | 50+ |

### What Breaks at Scale

**🔴 1. Blueprint Loader: All Blueprints Loaded at Startup**

```typescript
// blueprintLoader.ts — ALL 9 blueprints are statically imported and registered
import headquartersJSON from './blueprints/headquarters.json'
// ... 8 more imports
const BUILTIN_BLUEPRINTS: BlueprintJSON[] = [headquartersJSON, ...]
registerBuiltinBlueprints() // Processes ALL at module load
```

With 9 blueprints this is instant. With 200 blueprints, you're parsing 200 JSON files and running `createEmptyGrid()` + `placeOnGrid()` for each one at startup, before the first frame renders.

Each blueprint creates a 20×20 GridCell[][] (400 objects), so 200 blueprints = 80,000 cell objects in memory, most of which are never rendered (user sees one room at a time).

**Fix:** Lazy blueprint loading — register metadata (id, name, thumbnail) eagerly, load full grid data on demand:

```typescript
interface LazyBlueprint {
  id: string
  name: string
  thumbnail?: string
  _loaded?: RoomBlueprint  // cached after first load
  load(): RoomBlueprint    // creates grid cells on demand
}
```

**🟡 2. Fuzzy Name Matching is O(n) per Room**

```typescript
// blueprints.ts — getBlueprintForRoom()
for (const matcher of NAME_MATCHERS) {
  if (matcher.test(name)) {
    const bp = blueprintRegistry.get(matcher.blueprintId)
    if (bp) return bp
  }
}
```

This iterates through 10 matchers per room. Fine for 9 rooms, slow for 100 rooms if each needs fuzzy matching. But the real problem is that NAME_MATCHERS is hardcoded — mod blueprints can't add fuzzy matchers.

**Fix:** The masterplan already identifies this — explicit `blueprintId` on Room objects. Fuzzy matching should be deprecated to a migration path, not the primary lookup.

**🟡 3. PropRegistry.tsx is a 1,097-Line Monolith**

Every prop component lives in one file. At 46 props this is manageable. At 100+ it becomes unmaintainable. More critically, adding a single new prop requires loading all 1,097 lines (Vite can't tree-shake a single module).

**Fix:** The masterplan identifies this for Phase 5 — split into `props/floor/`, `props/wall/`, etc. This should be Phase 3, not Phase 5. It's a prerequisite for good mod DX because modders will look at existing props as examples.

**🟢 4. Registry Lookups are O(1)**

`Map.get()` is hash-based — lookups don't degrade with size. 500 entries vs 50 entries has identical lookup performance. The Map-based registry is the right data structure.

**🟢 5. `listBySource()` Filters Correctly**

```typescript
listBySource(source: 'builtin' | 'mod'): readonly RegistryEntry<T>[] {
  return this.list().filter((e) => e.source === source)
}
```

This creates a new array on every call, but it's only used in UI (mod manager panel), not in render loops. Acceptable.

---

## 4. Developer Experience (DX) Analysis

### How Easy Is It to Add a New Prop?

**Current (built-in prop):**
1. Write a React component in PropRegistry.tsx
2. Add it to the `builtins` record in `registerBuiltinProps()`
3. Done — it's available for blueprints

**Rating: 8/10** — Clear, minimal steps. But the 1,097-line file is intimidating.

**Future (modded prop via JSON):**
1. Write a JSON file with geometry primitives
2. Drop it into a world pack or import it
3. Done — it's available for blueprints

**Rating: 7/10** — The JSON format is intuitive (masterplan Section 4.1), but there's no validation tooling yet. A modder writing JSON by hand won't know if their `"args": [1.2, 0.06, 0.7]` is correct until they see it rendered.

### How Easy Is It to Add a New Blueprint?

**Current:**
1. Create a JSON file in `blueprints/`
2. Static import in `blueprintLoader.ts`
3. Add to `BUILTIN_BLUEPRINTS` array
4. Done

**Rating: 7/10** — Clear, but requires 3 touches. The JSON format is clean and well-documented.

**Future (modded):**
1. Write JSON file
2. Import via UI

**Rating: 9/10** — This is excellent. The JSON format is simple enough that non-programmers can write it with examples.

### How Easy Is It to Add a New Environment?

**Current:**
1. Write a React component (GrassEnvironment, etc.)
2. Call `environmentRegistry.register()` in `index.tsx`
3. Done

**Rating: 7/10** — Clean, but environments are full React components which mods can't provide. The masterplan acknowledges this limitation — environments are `"type": "builtin"` with configurable parameters (sky, lighting, fog) for now.

### DX Issues

**⚠️ No Type-Checking for JSON Blueprints**

The `BlueprintJSON` interface exists in `blueprintLoader.ts` but there's no runtime validation on the frontend. The backend has `validate_blueprint()` but the frontend loader just casts:

```typescript
import headquartersJSON from './blueprints/headquarters.json'
// ...
headquartersJSON as BlueprintJSON  // trust me bro
```

A typo in a JSON file (`"placements"` → `"placement"`) would cause a silent empty room, not a helpful error.

**Fix:** Add Zod or io-ts schema validation in `loadBlueprintFromJSON()`:

```typescript
export function loadBlueprintFromJSON(json: unknown): RoomBlueprint {
  const parsed = BlueprintSchema.parse(json) // throws with clear error message
  // ... proceed with validated data
}
```

**⚠️ Duplicate Interaction Point Definition**

Blueprints define interaction points in TWO places:

```json
{
  "placements": [
    { "propId": "work-point", "x": 4, "z": 15, "type": "interaction", "interactionType": "work" }
  ],
  "interactionPoints": {
    "work": [{ "x": 4, "z": 15 }]
  }
}
```

This is a sync bug waiting to happen. A modder adds a work point in `placements` but forgets `interactionPoints`, or vice versa. Bots won't find the interaction point.

**Fix:** Derive `interactionPoints` from `placements` automatically in the loader:

```typescript
function loadBlueprintFromJSON(json: BlueprintJSON): RoomBlueprint {
  // ... build grid from placements
  
  // AUTO-derive interaction points from placements
  const interactionPoints = {
    work: json.placements.filter(p => p.interactionType === 'work').map(p => ({ x: p.x, z: p.z })),
    coffee: json.placements.filter(p => p.interactionType === 'coffee').map(p => ({ x: p.x, z: p.z })),
    sleep: json.placements.filter(p => p.interactionType === 'sleep').map(p => ({ x: p.x, z: p.z })),
  }
  
  return { ...blueprint, interactionPoints }
}
```

This is the Factorio pattern: declare once, derive everything else. "Single source of truth."

**⚠️ Inconsistent Door Models**

The backend Pydantic model has `doors` and `doorPositions` as separate fields. The frontend JSON has both too. The loader uses `doorPositions` (with `facing`), but the validator checks both.

```python
# backend/models.py
class BlueprintJson(BaseModel):
    doors: List[BlueprintDoor] = []           # deprecated
    doorPositions: List[BlueprintDoor] = []   # canonical
```

This is tech debt that'll confuse modders. Pick one field and migrate.

---

## 5. Toekomstbestendigheid (Future-Proofing)

### ✅ Ready for glTF Models

The architecture cleanly separates "what to render" (Registry data) from "how to render" (React components). Adding glTF support means:

1. New geometry type in prop definitions: `"type": "model", "uri": "model.glb"`
2. A `GltfPropRenderer` that uses `@react-three/drei`'s `useGLTF`
3. The registry doesn't care — it stores data, not rendering logic

**Assessment: 90% prepared.** The one gap is that `PropEntry` currently stores a React `component` field. For JSON-defined props, you'd need a universal `JsonPropRenderer` that reads the geometry config and dispatches to either primitive shapes or glTF loading.

### ✅ Ready for Visual Editor

The grid data model is editor-ready:
- `GridCell[][]` is mutable during editing
- `placeOnGrid()` / `placeDoor()` are pure functions that manipulate cells
- `gridToWorld()` / `worldToGrid()` handle coordinate conversion
- `GridDebugOverlay` exists for visual debugging

The editor just needs: click → worldToGrid → placeOnGrid → serialize to JSON. The data flow is clean.

### ✅ Ready for Community Gallery

The backend Blueprint CRUD API is solid:
- Full validation with clear error messages
- Import/export with proper filename sanitization
- Source tracking (`user`, `import`, `mod`)
- Clean REST endpoints

A gallery is: this API + a public-facing frontend + user accounts. The API doesn't need changes.

### ⚠️ Partially Ready for World Packs

The manifest format (masterplan Section 4.5) is well-designed, but there's no implementation yet. The key missing piece is the ZIP pack parser (`packLoader.ts` — listed in Phase 3). The data models are ready; the plumbing isn't.

### ⚠️ Not Ready for Hot Reloading

Currently, `registerBuiltinProps()` and `registerBuiltinBlueprints()` run once at module load (side-effect imports). There's no way to:
1. Unload a mod pack (remove all entries with `modId === 'neon-office'`)
2. Reload a mod pack (update entries without full page refresh)

The API exists (`unregisterByModId()`) but it's never called and untested. Hot reloading is essential for mod development — modders need to edit JSON, save, and see changes.

**Fix:** Add a `ModManager.reloadMod(modId)` that calls `unregisterByModId()` + re-registers from the pack files. Add a dev-mode file watcher for `~/.crewhub/packs/`.

---

## 6. Backend API Review

### What's Good

**✅ Thorough Validation**

`validate_blueprint()` in `blueprints.py` is solid:
- Grid dimension bounds (4-40)
- Out-of-bounds placement detection
- Span overflow checking
- Overlap detection (with proper interaction-type exception)
- Door-on-wall-edge enforcement
- Unknown propId warnings (not errors — future-proof for mods)

This is production-quality validation. The errors/warnings separation is smart — warnings for "maybe wrong" (unknown propId), errors for "definitely wrong" (out of bounds).

**✅ Clean REST Design**

Standard CRUD + import/export:
- `GET /blueprints` — list with filters
- `POST /blueprints` — create with validation
- `POST /blueprints/import` — import from raw JSON
- `GET /blueprints/export/{id}` — download as file
- `PUT /blueprints/{id}` — partial update
- `DELETE /blueprints/{id}` — remove

This follows REST conventions correctly. The import endpoint accepting raw `BlueprintJson` (not wrapped in `CustomBlueprintCreate`) is a nice DX touch.

### Issues Found

**🟡 Database Connection Leak Risk**

Every route manually calls `await get_db()` and `await db.close()` in a try/finally:

```python
db = await get_db()
try:
    # ... queries
finally:
    await db.close()
```

This works but is brittle — if `get_db()` throws, the `finally` block tries to close a non-existent `db`. Should use a context manager or dependency injection:

```python
# Better: FastAPI dependency injection
async def get_db_dep():
    db = await get_db()
    try:
        yield db
    finally:
        await db.close()

@router.get("")
async def list_blueprints(db = Depends(get_db_dep)):
    # ...
```

**🟡 KNOWN_PROP_IDS is Hardcoded**

```python
KNOWN_PROP_IDS = {
    "desk-with-monitor", "desk-with-dual-monitors", ...
}
```

This list will drift from the frontend's actual prop registry. When a mod adds new props, the backend will generate spurious warnings. This should either:
1. Be removed (unknown propIds aren't errors, just skip validation)
2. Be synced from the frontend's propRegistry at build time
3. Be served via a `/props/ids` endpoint that the backend queries

**🟡 Validation Min/Max Grid Sizes Differ Frontend vs Backend**

Backend: `MIN_GRID_SIZE = 4`, `MAX_GRID_SIZE = 40`
Masterplan: "10×10 minimum, 30×30 maximum"
Frontend: No validation at all (trusts the JSON)

These should be consistent. Recommend aligning on the masterplan values (10-30) and adding frontend validation.

---

## 7. Architecture Comparison with Reference Games

| Feature | Minecraft | Factorio | Cities:Skylines | CrewHub |
|---|---|---|---|---|
| Namespaced IDs | ✅ `mod:id` | ✅ `mod/id` | ❌ | ❌ **Add this** |
| Typed Registry | ✅ | ✅ | ✅ | ✅ |
| Data-only mods | ❌ (Java code) | ❌ (Lua code) | ✅ (assets) | ✅ |
| Batch registration | ✅ | ✅ | ✅ | ❌ **Add this** |
| Lazy loading | ✅ | ✅ | ✅ | ❌ **Add this** |
| Override detection | ✅ | ✅ | ❌ | ❌ **Add this** |
| Schema validation | ❌ | ✅ (prototype system) | ❌ | ✅ (backend) ❌ (frontend) |
| Hot reload | ✅ | ✅ | ❌ | ❌ **Planned** |
| Load order control | ✅ | ✅ | ❌ | ❌ **Consider** |
| Built-in = mod API | ✅ | ✅ | ✅ | ✅ |

**CrewHub's closest analog is Cities:Skylines** — data-driven assets with a visual editor, no code execution, community sharing. The difference: C:S has Workshop for distribution (Steam), CrewHub will need its own (worldpacks + gallery).

---

## 8. Specific Code Issues

### 8.1 `ROOM_BLUEPRINTS` Compatibility Shim is a Trap

```typescript
// blueprints.ts
/**
 * @deprecated Use `getRoomBlueprintsRecord()` or `blueprintRegistry` directly.
 * This is a compatibility shim — it returns a snapshot that is NOT live.
 */
export const ROOM_BLUEPRINTS: Record<string, RoomBlueprint> = getRoomBlueprintsRecord()
```

This is evaluated once at module load. If any code imports `ROOM_BLUEPRINTS` (the constant), it gets a frozen-in-time snapshot that never reflects mod additions. The deprecation comment is correct, but the export should be removed in Phase 2 — keeping it around is a footgun.

### 8.2 Environment Fallback Creates Silent Failure

```tsx
// environments/index.tsx
export function EnvironmentSwitcher({ buildingWidth, buildingDepth }: EnvironmentSwitcherProps) {
  const [environment] = useEnvironment()
  const config = environmentRegistry.get(environment)
  if (!config) {
    const fallback = environmentRegistry.get(DEFAULT_ENVIRONMENT)
    if (!fallback) return null  // ← Silent failure: user sees nothing
```

If both the selected environment and the default are missing (e.g., environments haven't registered yet due to import order), the component returns `null`. No error, no feedback. The user sees a void.

**Fix:** Add a `<Suspense>` boundary or a visible error state.

### 8.3 `registerBuiltinBlueprints()` Side-Effect Import Chain

```typescript
// blueprints.ts
import './blueprintLoader'  // side-effect: registers blueprints

// blueprintLoader.ts
registerBuiltinBlueprints()  // called at module load
```

This relies on module evaluation order. If anything imports `blueprintRegistry` directly before `blueprintLoader` runs, they'll see an empty registry. Side-effect imports are fragile — they depend on bundler behavior.

**Fix:** Make registration explicit via an `initModding()` function called once from the app root:

```typescript
// modding/init.ts
export function initModding() {
  registerBuiltinProps()        // from PropRegistry
  registerBuiltinBlueprints()   // from blueprintLoader
  registerBuiltinEnvironments() // from environments/index
}

// App.tsx
import { initModding } from '@/lib/modding/init'
initModding()
```

This gives you deterministic load order — critical for mods that depend on built-in content existing.

### 8.4 Backend `row_factory` Set Inside Routes

```python
db.row_factory = lambda cursor, row: dict(
    zip([col[0] for col in cursor.description], row)
)
```

This is repeated in every route. It's also a mutation on the db connection — if two concurrent requests share a connection, they could interfere. Should be set once at connection creation.

---

## 9. Priority Recommendations

### Must Fix Before Phase 3 (Mod Loading)

| # | Issue | Effort | Impact |
|---|---|---|---|
| 1 | Add namespaced IDs (`namespace:id`) | 2h | Prevents mod ID collisions |
| 2 | Add batch registration to Registry | 1h | Prevents 50 re-renders when loading a mod pack |
| 3 | Derive interaction points from placements | 1h | Eliminates duplicate data / sync bugs |
| 4 | Add frontend JSON validation (Zod) | 2h | Catches modder errors early |
| 5 | Explicit init instead of side-effect imports | 1h | Deterministic load order |

### Should Fix Before Phase 4 (Visual Editor)

| # | Issue | Effort | Impact |
|---|---|---|---|
| 6 | Lazy blueprint loading | 3h | Memory for 200+ blueprints |
| 7 | Split PropRegistry.tsx into per-prop files | 4h | DX + tree-shaking |
| 8 | Unify door field (`doorPositions` only) | 2h | Eliminates modder confusion |
| 9 | Align validation bounds (frontend/backend/docs) | 1h | Consistency |

### Nice to Have (Phase 5+)

| # | Issue | Effort | Impact |
|---|---|---|---|
| 10 | Material caching for repeated colors | 3h | GPU memory optimization |
| 11 | InstancedMesh for repeated propIds | 8h | Draw call optimization |
| 12 | Remove `Object.freeze()` from snapshot | 5min | Micro-optimization |
| 13 | Load order / priority system | 4h | Mod conflict resolution |

---

## 10. What's Genuinely Excellent

I don't want to end on criticisms. This architecture has real strengths:

1. **The Registry<T> class is beautifully simple.** 111 lines, fully typed, observable, React-compatible. No over-abstraction. No unnecessary dependencies. This is senior-level code.

2. **The "data → grid → renderer" pipeline is clean.** JSON → `loadBlueprintFromJSON()` → `placeOnGrid()` → `GridRoomRenderer` — each layer only knows about its own types. The grid doesn't know about Three.js. The renderer doesn't know about JSON.

3. **The backend validation is production-quality.** Proper error/warning separation, specific error messages referencing array indices and field names, edge case handling (span overflow, door placement). This is the kind of validation that saves debugging hours.

4. **The masterplan is refreshingly honest about scope.** "What We're NOT Building" sections, risk assessment with explicit over-engineering warnings, decision checkpoints between phases. This is rare and valuable.

5. **The frame-skip pattern in animated props shows Three.js expertise.** Subtle performance optimization that most R3F codebases miss.

6. **The `useSyncExternalStore` integration is correct.** Arrow function fields for stable identity, dirty-checked snapshots, proper listener cleanup. This is how external store integration should work in React 18+.

---

## Summary

The CrewHub modding system is a solid B+. The core patterns are correct, the data model is clean, and the separation of concerns is well-executed. The issues identified are all fixable within the existing architecture — none require a rewrite.

The biggest risks are:
1. **ID collisions without namespacing** (easily fixed)
2. **Batch registration for mod loading performance** (easily fixed)
3. **PropRegistry monolith blocking good mod DX** (medium effort but critical)

Ship Phase 1-2 with confidence. Fix items 1-5 before Phase 3. The architecture will scale.

---

*This review was conducted against the codebase as of 2026-02-05. Files reviewed: Registry.ts (111 loc), registries.ts (43 loc), PropRegistry.tsx (1097 loc), blueprints.ts (80 loc), blueprintLoader.ts (126 loc), environments/index.tsx (116 loc), blueprints.py (539 loc), models.py (340 loc), 9 JSON blueprint files, masterplan (500+ lines), modding overview documentation.*
