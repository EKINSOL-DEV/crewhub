# Performance Audit - 2026-02-14

**CrewHub v0.15.0 | Branch: develop**

---

## 1. Bundle Size Analysis

### Before (single main chunk)
| Chunk | Raw | Gzip |
|-------|-----|------|
| `index.js` | 3,719 KB | 1,072 KB |
| `vendor-dnd.js` | 59 KB | 19 KB |
| **Total** | **3,778 KB** | **1,091 KB** |

### After (code-split — IMPLEMENTED ✅)
| Chunk | Raw | Gzip | Load |
|-------|-----|------|------|
| `index.js` | 731 KB | 194 KB | Immediate |
| `vendor-three.js` | 1,374 KB | 392 KB | Lazy (3D tab) |
| `ZoneRenderer.js` | 618 KB | 160 KB | Lazy (3D tab) |
| `vendor-codemirror.js` | 499 KB | 172 KB | On use |
| `vendor-markdown.js` | 495 KB | 152 KB | On use |
| `vendor-dnd.js` | 50 KB | 17 KB | Immediate |
| **Initial load** | **781 KB** | **211 KB** | |
| **Total** | **3,767 KB** | **1,087 KB** | |

**Result: Initial bundle reduced from 1,072 KB → 211 KB gzip (80% reduction)**

### Dependency breakdown (by node_modules size)
| Dependency | Size | Usage |
|------------|------|-------|
| three | 37 MB | 3D world rendering |
| lucide-react | 28 MB | Icons (67 unique used) |
| highlight.js | 9.1 MB | Code syntax highlighting |
| @react-three | 5.1 MB | React Three.js bindings |
| @codemirror | 2.9 MB | Markdown editor |

### Observations
- **lucide-react** is tree-shaken well (28MB on disk → only used icons included in bundle)
- **highlight.js** includes all languages via rehype-highlight; could reduce by importing only needed languages
- **No duplicate dependencies** found in bundle

---

## 2. React Render Optimization

### Current state
- **9 context providers** (Theme, Chat, Rooms, Demo, Zone, DragDrop, TaskBoard, WorldFocus, Meeting)
- **31 `useContext` calls** across the app
- **Only 2 `React.memo()` usages** in the entire codebase (441 .tsx files)
- **`useMemo`/`useCallback`** used in ~20 files, mostly in contexts and complex components

### Issues found
1. **Context value objects recreated every render** — Most context providers create new objects on every render, causing all consumers to re-render. Only a few (RoomsContext, ChatContext) use `useMemo` for their value.

2. **Missing `React.memo` on expensive components** — With 441 components and only 2 memo'd, many components re-render unnecessarily when parent state changes. Key candidates:
   - 3D scene components (BotAvatar, props, environments)
   - Session list items
   - Task cards
   - Chat messages

3. **Sessions fingerprinting** — `useSessionsStream` has good fingerprint-based change detection to avoid unnecessary re-renders of the 3D scene. This is well-implemented.

4. **SSE event handling** — Uses `queueMicrotask` for deferred processing, preventing browser violations. Well-optimized.

### Impact: MEDIUM
Most re-render issues are masked by React 19's automatic batching, but could become noticeable with many sessions/bots.

---

## 3. Three.js Performance

### Codebase stats
- **308 3D component files** (33,480 lines of code)
- **20 files using `useFrame`** (per-frame updates)
- **InstancedMesh used** in Desert and Grass environments (good)
- **frustumCulled={false}** set on instanced meshes (necessary for batched instances)

### Architecture
- Scene components are already lazy-loaded via `showcaseProps.ts` (workshop props)
- Environments use instanced meshes for decorations (rocks, grass, cacti)
- Camera controller uses `useFrame` for smooth transitions

### Potential issues
1. **Many unique meshes per bot** — Each bot avatar is a separate mesh group. With many bots in a room, draw calls scale linearly. Could benefit from instanced rendering for identical bot parts.
2. **No LOD (Level of Detail)** — All 3D objects render at full detail regardless of camera distance.
3. **Multiple `useFrame` hooks** — 20 components with per-frame callbacks; these run on every animation frame even when nothing changes. Could add conditional logic to skip updates.

### Impact: LOW-MEDIUM
Current usage (typically <20 bots) is well within performance bounds. Would matter more at scale (100+ bots).

---

## 4. Network/API Performance

### SSE Architecture (well-designed ✅)
- **Single SSE connection** managed by `sseManager.ts`
- Pub/sub pattern — components subscribe to event types
- Automatic reconnection with exponential backoff (max 30s)
- Falls back to polling (5s interval) when SSE unavailable

### API calls
- **10 fetch calls in contexts** (initial data loading)
- **38 fetch calls in hooks** (on-demand data)
- Contexts load data on mount: rooms, assignments, rules, sessions, settings
- No redundant fetching detected — contexts use SSE for updates after initial load

### Caching
- No HTTP caching headers or service worker caching
- State cached in React contexts (in-memory)
- SSE provides real-time updates, reducing need for re-fetching

### Impact: LOW
The SSE-based architecture is already efficient. Main improvement would be HTTP caching for static assets.

---

## 5. Top 5 Optimization Opportunities (Ranked by Impact)

### 1. ✅ IMPLEMENTED: Code-Split Three.js & Heavy Dependencies
**Impact: HIGH | Effort: LOW**
- Lazy-load ZoneRenderer (Three.js) — only loaded when 3D tab is active
- Split vendor-three, vendor-codemirror, vendor-markdown into separate chunks
- **Result: 80% initial bundle reduction (1,072 KB → 211 KB gzip)**

### 2. ✅ IMPLEMENTED: Memoize Context Values
**Impact: MEDIUM | Effort: MEDIUM (2-3 hours)**
- Wrapped all 7 unmemoized context provider values in `useMemo`
- WorldFocusContext, ZoneContext, RoomsContext, ChatContext, DemoContext, TaskBoardContext, MeetingContext
- ThemeContext and DragDropContext were already memoized
- Prevents cascading re-renders when unrelated state changes

### 3. ✅ IMPLEMENTED: Add React.memo to Expensive Components
**Impact: MEDIUM | Effort: MEDIUM (2-4 hours)**
- Wrapped Bot3D, Room3D, RoomInfoPanel, BotInfoPanel, SessionCard in `React.memo`
- TaskCard was already memoized. Total memoized: 2 → 7 components
- Focus on frequently re-rendering 3D scene and panel components

### 4. ✅ IMPLEMENTED: Reduce highlight.js Bundle
**Impact: LOW-MEDIUM | Effort: LOW (30 min)**
- Replaced rehype-highlight with custom rehypeHighlightLite plugin
- Imports only 10 languages instead of ~40 common languages
- **vendor-markdown chunk: 495 KB → 388 KB raw, 152 KB → 120 KB gzip (~107 KB saved)**

### 5. ✅ IMPLEMENTED: Three.js useFrame Optimization
**Impact: LOW | Effort: MEDIUM (2 hours)**
- Added `useThrottledFrame` utility (runs every Nth frame)
- Applied to cosmetic prop animations: RotatingPart, GlowOrb, LED, Screen, BotStatusGlow
- Bot3D and CameraController keep full 60fps for smooth movement
- Reduces CPU cost of decorative animations by 50-67%

---

## Quick Wins Implemented

### Code Splitting (commit included)
- `App.tsx`: ZoneRenderer lazy-loaded with `React.lazy()` + `Suspense`
- `vite.config.ts`: Manual chunks for three, codemirror, markdown, dnd
- Initial page load reduced by 80%
- TypeScript compilation: clean ✅
- Build: successful ✅

---

## Review Comments (Validation) — 2026-02-14

### Scope reviewed
- Document: `docs/performance-audit-2026-02-14.md`
- Implementation commit: `224689b` (branch `develop`)
- Files checked: `frontend/src/App.tsx`, `frontend/vite.config.ts`

### Implementation validation
- ✅ **Code splitting approach is correct and production-appropriate.**
  - `ZoneRenderer` is loaded via `React.lazy(() => import(...))`, so Three.js payload is deferred until the Active/3D view is actually rendered.
  - `Suspense` fallback exists and prevents blank screen during chunk fetch.
  - `manualChunks` groups heavy libraries (`three`, `codemirror`, markdown/highlight stack) into stable async chunks.
- ✅ **Reported outcome is plausible.**
  - Moving Three.js + related libs out of the initial path explains the large initial bundle drop.
- ✅ **No immediate architectural red flags** in the selected implementation.

### Top 5 ranking validation
1. **Code-splitting Three.js & heavy deps** — ✅ Correctly ranked #1 (highest user-perceived impact, low effort, already delivered).
2. **Memoize context values** — ✅ Good #2. Likely broad render reduction across app.
3. **Add `React.memo` to expensive components** — ✅ Good #3. Valuable after context stabilization.
4. **Reduce `highlight.js` payload** — ✅ Reasonable #4. Chunk-size win, but less critical than render-path issues.
5. **Three.js `useFrame` optimization** — ✅ Reasonable #5 for current scale; becomes more important with high bot/session density.

### Lazy-loading UX risk assessment
- **Current risk level: LOW-MEDIUM (acceptable).**
- Potential issue: first switch to Active (3D) tab can show a visible loading pause on slow network/CPU because `vendor-three` + `ZoneRenderer` are fetched on demand.
- Mitigations already present:
  - Explicit `Suspense` loading state (“Loading 3D view…”)
  - 3D is not loaded when there are zero sessions (good guardrail)
- Recommended UX hardening:
  - Add lightweight skeleton/progress UI instead of plain text fallback
  - Optionally prefetch 3D chunk after app becomes idle (`requestIdleCallback`) when sessions exist
  - Optionally prefetch on tab hover/focus for perceived instant switch

### Additional optimizations / concerns
- **Priority add:** include chunk-size budgets in CI (`build --report` + threshold check) to prevent regressions.
- **Vendor chunk strategy:** monitor `vendor-react` split; if cache churn is low this is fine, but excessive micro-chunking can increase request overhead.
- **Markdown stack:** consider replacing broad `rehype-highlight` usage with selective language registration to reduce `vendor-markdown` further.
- **Context-first optimization order:** do context value memoization before mass `React.memo` rollout to maximize ROI and avoid unnecessary custom comparators.

### Critical issues requiring immediate attention
- ❗ **No blocker/critical defect found** in the code-splitting implementation.
- Follow-up priority is UX polish for first-load of 3D chunk (not a release blocker).
