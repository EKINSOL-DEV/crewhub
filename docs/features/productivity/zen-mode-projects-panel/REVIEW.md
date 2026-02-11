# Review — Zen Mode Projects Panel Design & Implementation

## 1) Summary
The proposal is strong and pragmatic: it reuses existing Zen Mode primitives (`tab.projectFilter`, existing APIs, per-tab persistence) and minimizes backend risk. The overall direction aligns with Nicky’s requirements, especially pre-selection via Zen statue and “view all by default”. Main gaps are around ownership of filter state semantics, incomplete coverage of Room Info tab refactor in implementation phases, and a few UX/performance edge cases that should be tightened before build.

## 2) Strengths
- **Good leverage of existing architecture**
  - Reusing `useZenMode` + `tab.projectFilter` avoids parallel state sources.
  - Existing `enterWithProject()` flow already supports preselection and per-tab scoping.
- **Low-risk delivery strategy**
  - No DB migrations, no new backend endpoints required.
  - LocalStorage migration (`documents` → `projects`) is explicitly planned.
- **Clear cross-panel filter intent**
  - Shared `ProjectFilterSelect` in Tasks/Kanban/Projects is consistent and discoverable.
  - “All Projects” fallback preserves current behavior and reduces surprise.
- **Thoughtful UI evolution**
  - Projects panel split (Overview + Documents) keeps markdown viewer behavior intact while adding value.
  - Tab label/project badge sync is a nice affordance for context awareness.
- **Reasonable phased implementation**
  - Renaming/migration first, then shared filter primitive, then panel integrations.

## 3) Concerns

### A. Requirement coverage gap: Room Info tab-based redesign is not fully implemented in the plan
- The design states a major goal: **RoomInfoPanel → 3 tabs (Room Info | Project | Project Files)**.
- The implementation phases focus on Zen panels and do **not** include a concrete RoomInfoPanel refactor phase, file list, or test cases.
- This is currently the largest requirement mismatch.

### B. State precedence is ambiguous (possible UX confusion)
- Proposed derivation: `tab.projectFilter?.projectId || worldFocus room’s project`.
- This can create unclear behavior in “All Projects” mode if world focus keeps injecting a project implicitly.
- Users may believe filter is cleared, but data can still appear scoped due to fallback.

### C. `useZenMode` scope is mostly right, but persistence semantics need explicit rules
- Storing filter per tab in `useZenMode` is correct.
- Missing clarity on:
  - Should transient world focus be persisted as `projectFilter` or only explicit user selections?
  - On reopen, should tab restore explicit filter only, or also re-derive from current room focus?
- Without explicit policy, behavior may feel inconsistent across sessions.

### D. Potential over-fetch and duplicated queries
- `ProjectFilterSelect` rendered in multiple panels may trigger repeated `/api/projects` fetches unless a shared cache layer is used.
- `ProjectOverview` + Tasks + Kanban can cause multiple concurrent data loads on filter change; acceptable now, but can feel heavy in large workspaces.

### E. UX risk in filter controls density
- Putting full dropdowns in every panel header may crowd narrow layouts, especially when search/actions are already present.
- Compact mode is mentioned, but interaction details (keyboard nav, truncation behavior, selected-label display) are unspecified.

### F. Edge cases not fully covered
- Missing/partial scenarios:
  - Project renamed/color changed while selected (tab label/color badge sync).
  - User loses permission to a selected project.
  - Empty states per panel when a filter returns no tasks/docs.
  - Rapid filter switching + race conditions (stale responses).
  - Cross-tab concurrency (change filter in tab A while tab B active via async state updates).

### G. Testing checklist is good but incomplete for regressions
- No explicit tests for markdown viewer parity (scroll, file switching, rendering behavior).
- No explicit accessibility checks for dropdown/tabs (keyboard + screen reader labels).
- No explicit performance checks (large project/task counts, filter latency).

## 4) Recommendations

1. **Add a dedicated RoomInfoPanel phase (must-have)**
   - Add explicit phase/files/tests for the required 3-tab RoomInfoPanel layout.
   - Include acceptance criteria:
     - Tabs exactly: **Room Info | Project | Project Files**
     - Project tab reflects room-linked project
     - Project Files tab preserves current document viewer behavior

2. **Define deterministic filter precedence and source-of-truth policy**
   - Recommended model:
     - `explicitFilter` (user-selected via dropdown or Zen statue entry) has highest priority.
     - `implicitRoomProject` (world focus) only used **when explicitFilter is undefined**, not when explicitly set to “All”.
   - Represent states distinctly:
     - `undefined` = no explicit user choice yet (eligible for implicit prefill)
     - `null` = explicit “All Projects”
     - `{project}` = explicit selected project
   - This avoids “I chose all, why am I still filtered?” confusion.

3. **Keep `useZenMode` as owner, but centralize writes through one API**
   - Add a single action like `setTabProjectScope(scope, source)` where source = `user|entry|system`.
   - Benefit: auditability, easier debugging, cleaner tab-label update rules.

4. **Use a shared cache/query layer for projects list**
   - Ensure `useProjects()` dedupes fetches across multiple mounted selectors.
   - If React Query/SWR exists, use it; otherwise implement module-level cache + stale-while-revalidate.

5. **Guard against async race conditions**
   - For Tasks/Kanban/doc fetches on filter changes, ensure stale requests are canceled or ignored.
   - Add request-keying by `projectId` and only render latest response.

6. **Strengthen UX details for constrained layouts**
   - Define compact dropdown behavior (icon + tooltip + current selection chip).
   - Keep one global filter badge in top bar as canonical indicator; panel controls as local editors.

7. **Expand test plan with high-value additions**
   - Markdown viewer regression tests (open file, switch file, preserve scroll where expected).
   - Accessibility tests: tab order, keyboard activation, aria-labels for filter + inner tabs.
   - Performance smoke tests with high counts (e.g., 200+ projects, 5k tasks).
   - Rename/update events: selected project changes name/color and UI updates everywhere.

8. **Add rollout safety**
   - Optional feature flag for Projects panel redesign to reduce release risk.
   - Include fallback path to old documents panel if critical regression appears.

## 5) Architecture Alternatives

### Alternative A (recommended if you want minimal complexity now)
**Keep a single shared project scope at ZenMode level (current direction), but add explicit-vs-implicit scope semantics.**
- Pros: smallest delta, aligns with existing architecture, easy to reason about.
- Cons: less flexible if future requirement asks per-panel independent filters.

### Alternative B (future-ready, more complex)
**Per-panel filter overrides on top of tab-level default scope.**
- Model: `tabScope` + optional `panelScopeOverrides[panelId]`.
- Pros: advanced workflows (e.g., Tasks filtered, Kanban all).
- Cons: higher complexity, more UX explanation needed; likely overkill for current requirements.

### Alternative C (derived-only scope from room focus)
**No persistent explicit filter; always derive from current room/project context.**
- Pros: very simple mental model in immersive mode.
- Cons: fails requirement “view all by default, filterable per panel”; poor user control/persistence.
- Not recommended.

## 6) Final Grade
**A-**

The plan is fundamentally solid, appropriately low-risk, and closely aligned with core product goals. The main reason it is not an A/A+ is requirement completeness: the RoomInfoPanel tab refactor is described in design but not operationalized in implementation phases. With clarified filter semantics, a dedicated RoomInfoPanel implementation phase, and stronger race-condition/performance/accessibility coverage, this can realistically reach **A**.
