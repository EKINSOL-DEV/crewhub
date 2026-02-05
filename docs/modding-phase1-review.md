# CrewHub – Modding System Phase 1a–2b Code Review (2026-02-05)

Scope reviewed:
- Frontend registry pattern + instances
- PropRegistry refactor
- Blueprints JSON migration + loader + API
- Environment registry + UI integration hooks
- Backend Blueprint API + DB models/schema
- Starlight docs in `~/ekinapps/crewhub-docs/`

This review is intentionally critical: it flags correctness, safety, strict-mode compatibility, forward-compatibility for modding, and subtle runtime risks.

---

## Executive summary

**Overall direction is good**: a typed observable `Registry<T>` used by built-ins (and later mods) is a solid foundation.

**Main issues to address before relying on this in production/modding:**
1. **`ROOM_BLUEPRINTS` compatibility shim is not actually “live”** (it’s computed once at module import).
2. **`Registry<T>.getSnapshot()` returns a mutable array reference** → consumers can accidentally mutate global state; also consider defensive freezing.
3. **`useSyncExternalStore` integration uses `subscribe.bind(...)` inline** → unstable subscribe function can cause unnecessary resubscriptions.
4. **Backend Pydantic model mismatch**: `BlueprintJson.id` is required but routes treat it as optional.
5. **Backend validation collects warnings but never returns/exposes them** (dead code / missed UX opportunity).
6. **Docs drift**: Modding docs show `props: [...]` but implementation uses `placements: [...]`.

---

## 1) `Registry<T>` pattern (`frontend/src/lib/modding/Registry.ts` + `registries.ts`)

### What’s solid
- **Simple, typed, runtime-extensible** registry with metadata (`source`, `modId`).
- JS runtime is single-threaded; in that sense it’s “thread-safe enough” for typical React/Vite usage.
- **`useSyncExternalStore` compatibility is mostly OK** because:
  - `subscribe(listener)` returns an unsubscribe function.
  - `getSnapshot()` returns a stable reference that changes on mutation.

### Risks / issues
1. **Snapshot mutability risk (important)**
   - `list()` caches an array (`this.snapshot`) and returns it directly.
   - Any consumer can mutate it (`push`, `sort`, `splice`), corrupting the registry’s cached snapshot.
   - This is a *classic* footgun when using external stores.

   **Recommendation:**
   - Return a frozen array (dev + prod) or at least freeze in dev:
     - `this.snapshot = Object.freeze([...this.entries.values()]) as RegistryEntry<T>[]`
   - Alternatively return a *copy* every time (safer but less performant). React ESM stores typically freeze.

2. **Listener isolation**
   - If one listener throws, the loop aborts and later listeners won’t run.

   **Recommendation:** wrap listener calls in `try/catch` and log (or accumulate errors).

3. **Overwrite semantics**
   - `register()` overwrites without signaling whether it replaced.

   **Recommendation (optional):** return `{ replaced: boolean }` or provide `registerOnce`/`assertNotExists` for debugging.

4. **React concurrent rendering nuance**
   - `useSyncExternalStore` expects that `getSnapshot()` is pure and stable.
   - Your pattern is fine *if* you prevent external mutation (see #1).

### `registries.ts` notes
- Good: `import type { PropEntry } ...` prevents runtime circular dependency.
- Minor: keep registry definitions “leafy” (no runtime imports from feature modules) to avoid future cycles.

---

## 2) PropRegistry refactor (`frontend/src/components/world3d/grid/PropRegistry.tsx`)

### What’s solid
- Migration to `propRegistry.register(...)` is consistent with the modding direction.
- Public API functions (`getPropComponent`, `getPropEntry`, etc.) preserve existing call sites.
- Unknown props safely return `null` → allows partial mods without crashes.

### Risks / issues
1. **Backward compatibility for old constant exports**
   - If there previously was an exported frozen record like `PROP_REGISTRY` or similar, it’s now gone.
   - I didn’t find other in-repo imports of such a constant in a quick grep, but external usage (or older code) could break.

   **Recommendation:** if a constant was public API, add a compatibility shim similar to blueprints (but do it correctly; see blueprint section).

2. **Module-load side effects**
   - `registerBuiltinProps()` runs at import time.
   - This is OK, but note: any test environment importing the module will mutate global singleton state.

   **Recommendation:** consider an explicit `initBuiltins()` entry point later (Phase 2+) and keep module self-registration only for now if desired.

3. **File size / maintainability**
   - `PropRegistry.tsx` is huge and mixes:
     - Rendering components
     - Animation hooks (`useFrame`)
     - Registry wiring

   **Recommendation:** split into:
   - `propComponents/*` (renderers)
   - `builtinProps.ts` (data)
   - `PropRegistry.ts` (registry + API)

---

## 3) Blueprints → JSON (`frontend/src/lib/grid/blueprints/*` + `blueprintLoader.ts` + `blueprints.ts`)

### JSON structure quality
- `placements` array is clear and data-driven.
- `span` being optional with defaults is good.
- Doors are present.

### Loader correctness (`blueprintLoader.ts`)
- Rebuilding via `createEmptyGrid` + `placeOnGrid` + `placeDoor` is a strong approach: it ensures parity with the imperative pipeline.

### Risks / issues
1. **Redundant door fields (consistency risk)**
   - JSON contains both:
     - `doors: {x,z}[]` (used to place doors in grid)
     - `doorPositions: {x,z,facing}[]` (copied into output)

   These can diverge (e.g. `doors` has 2 entries, `doorPositions` has 1 entry in the sample JSON).

   **Recommendation:**
   - Prefer a single canonical field in JSON:
     - Either only `doorPositions` and derive the grid doors from it
     - Or only `doors` and derive positions/facing algorithmically

2. **`ROOM_BLUEPRINTS` shim is NOT live (important)**
   - `ROOM_BLUEPRINTS` is created once via `buildBlueprintRecord()`.
   - If anything registers/unregisters later (mods, user blueprints), `ROOM_BLUEPRINTS` will not update.

   **Recommendation:**
   - Change it to a getter function (`getRoomBlueprintsRecord()`) OR
   - Export a Proxy that resolves against the registry on access OR
   - Update it on registry changes (subscribe + mutate object) – but then you must manage cleanup.

3. **Fuzzy matching robustness**
   - Current approach: substring keyword checks.
   - It’s OK as a fallback but can produce surprises:
     - “devops” contains `dev` → returns `dev-room`, not `ops-room`.
     - “headquarters-2” includes `headquarter` ok.

   **Recommendation:**
   - Order matchers by specificity (longer/more specific keywords first).
   - Consider word-boundary-ish heuristics or explicit mapping by room id.

4. **Validation at load-time**
   - Frontend loader does not validate JSON shape beyond TS casting.

   **Recommendation (optional):** add a lightweight runtime validator (zod) in dev builds.

---

## 4) Environment registry (`frontend/src/components/world3d/environments/index.tsx`)

### What’s solid
- Environment IDs are now open-ended strings → mod-friendly.
- Built-ins register via the same registry API.
- `EnvironmentSwitcher` correctly resolves the component by id and falls back if missing.

### Risks / issues
1. **`useSyncExternalStore` subscribe function identity (important-ish)**
   - `useEnvironmentList()` passes `environmentRegistry.subscribe.bind(environmentRegistry)`.
   - `bind(...)` creates a new function each render → React will resubscribe more often than needed.

   **Recommendation:**
   - Use a stable wrapper function, e.g.
     - `const subscribe = useCallback((l) => environmentRegistry.subscribe(l), [])`
   - Or in `Registry`, define `subscribe = (listener) => { ... }` as an arrow field so it’s already bound.

2. **Custom event bus vs store subscription**
   - `useEnvironment()` uses window events to sync changes.
   - This is fine, but now you have *two* reactive systems (registry for list; window event for selection).

   **Recommendation:** later consider storing active env in a single external store (settings store) to avoid split-brain.

3. **SSR safety**
   - `getStoredEnvironment()` accesses `localStorage` inside try/catch.
   - On SSR, just importing can still reference `window` in `setStoredEnvironment` (only called at runtime though).

   **Recommendation:** OK for now; just ensure no SSR import path executes `setStoredEnvironment`.

---

## 5) Blueprint API (`backend/app/routes/blueprints.py` + `backend/app/db/models.py` + `backend/app/db/database.py`)

### Security / SQL injection
- Queries use **parameterized SQL (`?`)** → good.
- No obvious injection vectors in SQL statements.

### Validation quality
Good parts:
- Grid size limits (`MIN_GRID_SIZE`/`MAX_GRID_SIZE`).
- Placement bounds and span bounds.
- Overlap detection for non-interaction props.

### Issues / edge cases
1. **Pydantic model mismatch: `BlueprintJson.id` is required (important)**
   - `BlueprintJson.id: str` but routes do `body.blueprint.id or generate_id()`.
   - If a client omits `id`, request will fail before route code.

   **Recommendation:** change to `id: Optional[str] = None`.

2. **`validate_blueprint` has unused `warnings`**
   - Warnings are collected but never returned/logged.

   **Recommendation:**
   - Either return `(errors, warnings)` and include warnings in 201/200 responses
   - Or log warnings server-side for visibility.

3. **`walkableCenter` optional check is dead / misleading**
   - Model requires `walkableCenter`, but validation checks `if bp.walkableCenter:`.

   **Recommendation:** treat it as required and validate unconditionally.

4. **Door validation incomplete vs dual door representations**
   - Validates `bp.doors` only, not `doorPositions`.
   - But frontend JSON includes both.

   **Recommendation:** unify server model + validation around one door field.

5. **Filename/header safety in export**
   - `safe_name = row["name"].replace(" ", "-").lower()`.
   - If name contains quotes/newlines, could cause header issues.

   **Recommendation:** strict sanitize to `[a-z0-9-_]` and strip others.

6. **Source field validation**
   - `source` accepted as arbitrary string.

   **Recommendation:** restrict to enum (`user|import|mod`) to keep DB clean.

### DB schema (`database.py`)
- Adds `custom_blueprints` table + indexes; looks fine.
- Migration strategy is simplistic but OK for early phase.

---

## 6) Starlight docs (`~/ekinapps/crewhub-docs/`)

### What’s good
- Clean structure, minimal pages, consistent sidebar.
- Brand color set and custom CSS hook present.

### Issues
1. **Docs do not match implementation (important)**
   - Modding overview blueprint example uses `"props"` but implementation uses `"placements"`.
   - Door representation differs too.

   **Recommendation:** update docs to match current JSON schema and link to a canonical JSON schema/spec.

2. **Implementation status messaging**
   - The “Work in Progress” section is good.
   - Consider adding a small “Current shipped in Phase 1” checklist so readers don’t assume features exist.

---

## Cross-cutting checks

### Circular dependencies
- `registries.ts` imports `PropEntry` as **type-only** → avoids runtime cycles.
- No obvious runtime circular dependency detected in the reviewed subset.

### TypeScript strict-mode compatibility
- Frontend `tsconfig.json` has `strict: true`.
- The reviewed code appears compatible.
- Biggest strict-mode *design* issue is `ROOM_BLUEPRINTS` being described as “live” but actually static.

### Breaking changes risk
- Prop API functions appear preserved.
- Blueprint API: `ROOM_BLUEPRINTS` still exists but semantics may differ from previous usage.
- If any external code relied on static records staying immutable, the registry migration changes runtime behavior.

---

## Recommended fixes (priority list)

### P0 (should fix now)
- Make registry snapshots immutable / non-mutable by consumers.
- Fix `ROOM_BLUEPRINTS` so it’s actually live or stop advertising it as such.
- Fix backend `BlueprintJson.id` to be optional (or remove the “generate id” logic).
- Sanitize export filename/header.

### P1 (next)
- Remove/merge `doors` vs `doorPositions` duplication across FE/BE.
- Stabilize `useSyncExternalStore` subscribe function identity.
- Expose backend validation warnings.

### P2 (later)
- Split `PropRegistry.tsx` into smaller modules.
- Add optional runtime validation (zod) for JSON blueprint loading.

---

## Notes / small nits
- Consider adding `clear()` or `unregisterByModId(modId)` to `Registry<T>` for uninstalling mods cleanly.
- Consider ordering `Registry.list()` deterministically (e.g., insertion order is OK, but explicit sort can help stable UIs).

---

## Review Round 2 (after fixes)

Reviewed files:
- `frontend/src/lib/modding/Registry.ts`
- `frontend/src/lib/grid/blueprints.ts`
- `frontend/src/lib/grid/blueprintLoader.ts` + `frontend/src/lib/grid/blueprints/*.json`
- `frontend/src/components/world3d/environments/index.tsx`
- `backend/app/routes/blueprints.py`
- `backend/app/db/models.py`
- `~/ekinapps/crewhub-docs/src/content/docs/modding/overview.md`

### ✅ Confirmed fixes

#### 1) `Registry<T>`
- **Snapshot immutability:** `list()` now rebuilds snapshot on mutation and returns `Object.freeze([...values])` → prevents accidental consumer mutation of the cached snapshot.
- **Listener isolation:** `notify()` wraps each listener in `try/catch`, so one crashing subscriber won’t block others.
- **`useSyncExternalStore` stability:** `subscribe` and `getSnapshot` are **arrow fields**, so identity is stable and no `.bind()` is needed.
- **`clear()` / `unregisterByModId()` behavior:**
  - `clear()` is no-op when already empty and notifies only on actual change.
  - `unregisterByModId()` deletes matching entries, returns count, notifies once when `removed > 0`.

#### 2) Blueprints
- **Doors duplication:** Built-in JSON files now use **only `doorPositions`**. Loader treats `doorPositions` as canonical and keeps `doors` only as deprecated optional input.
- **Live record:** `getRoomBlueprintsRecord()` is now a function that builds from `blueprintRegistry.list()` at call time (so it reflects registry changes).
- **Fuzzy matching:** matcher order now correctly maps **"devops" → `ops-room`** before generic `dev` matching.

#### 3) Environment registry
- `useEnvironmentList()` now passes `environmentRegistry.subscribe` directly (stable identity because `subscribe` is an arrow field). This resolves the prior “`.bind()` each render” issue.

#### 4) Backend
- **`BlueprintJson.id` optional:** now `Optional[str] = None`, matching route behavior that generates an id when absent.
- **Filename sanitization:** export now strictly whitelists `[a-z0-9-_]` and strips separators; much safer for `Content-Disposition`.
- **Warnings:** `validate_blueprint()` returns `(errors, warnings)` and routes now include warnings in the HTTPException `detail` and attempt to include warnings in success responses.
- **`source` typing:** `CustomBlueprintCreate.source` is now `Literal["user", "import", "mod"]`.

### ⚠️ New / remaining issues found in Round 2

1. **Backend: warnings likely NOT returned due to `response_model` filtering (P0)**
   - `create_blueprint()` / `import_blueprint()` / `update_blueprint()` add `response["warnings"] = ...`, **but** these routes set `response_model=CustomBlueprintResponse`.
   - `CustomBlueprintResponse` in `models.py` does **not** define a `warnings` field, so FastAPI/Pydantic will typically **drop** it from the response.
   - Fix options:
     - Add `warnings: Optional[list[str]] = None` to `CustomBlueprintResponse`, or
     - Introduce a separate response model for endpoints that may return warnings.

2. **Docs still drift on door field (P1)**
   - `crewhub-docs/.../overview.md` blueprint example still uses `"doors"`, while the frontend canonical field is now `"doorPositions"` (and built-in JSONs don’t include `doors`).
   - Recommendation: update docs example to match current canonical schema (`doorPositions`) and include `interactionPoints` if required by backend import.

3. **Frontend loader: door placement can go out-of-bounds for malformed JSON (P2)**
   - `loadBlueprintFromJSON()` places a second door cell at `x+1` or `z+1` based on facing without bounds checks.
   - Built-ins are fine, but for user/mod JSON this could cause errors if a doorPosition is placed at the far edge incorrectly (e.g. `x = gridWidth-1` with `facing: south`).
   - Consider validating `doorPositions` in the loader (dev) or in backend validation rules.

### Round 2 conclusion
- The main Round 1 issues around **registry snapshot mutability**, **subscribe identity**, **blueprint door duplication**, **ROOM_BLUEPRINTS “live” behavior**, **backend `id` optionality**, and **export sanitization** look correctly addressed.
- The standout remaining gap is **backend warnings not actually reaching clients** due to response-model filtering, and **docs still not matching canonical blueprint JSON**.
