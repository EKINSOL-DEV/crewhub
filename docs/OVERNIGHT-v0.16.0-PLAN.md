# v0.16.0 Overnight Plan
**Date:** 2026-02-14 01:05 - 09:00
**Goal:** Complete v0.16.0 features + 4 quality iterations (Opus + GPT-5.2)

---

## 🎯 v0.16.0 Features

### Priority 1: Zen Mode Panel Registry ⭐⭐⭐
**Impact:** High - Central architecture for all Zen Mode panels
**Effort:** ~2h
**Description:** Single source of truth for panel management (Ctrl+K, context menu, layouts)
- Centralized panel registry with metadata (title, icon, component, category)
- Command palette integration (Ctrl+K search)
- Context menu generation from registry
- Layout presets (default, focused, compare, etc.)
- Panel state persistence

**Docs:**
- Design: `docs/features/productivity/zen-mode-panel-registry/concept.md`
- Implementation plan: TBD (create during kickoff)

---

### Priority 2: Frontend Watchdog ⭐⭐
**Impact:** Medium - Dev experience improvement
**Effort:** ~1.5h
**Description:** Docker-based auto-restart for Vite dev server crashes
- Health check endpoint in Vite dev server
- Docker healthcheck configuration
- Restart policy on failure
- Error logging and notifications
- Similar to backend watchdog (v0.13.0)

**Docs:**
- Reference: Backend watchdog implementation
- Create: `docs/features/core/frontend-watchdog/concept.md`

---

### Priority 3: Grid Boundary Fine-tuning ⭐
**Impact:** Medium - Polish for prop placement
**Effort:** ~2h (potentially defer if complex)
**Status:** Already attempted 5+ times, multi-cell edge cases remain
**Description:** Perfect prop placement against walls
- Multi-cell placement edge cases
- Wall gap calculations
- Symmetry preservation
- Rotation alignment

**Decision:** Attempt 1 iteration max, defer to v0.17.0 if not resolved quickly

---

### Deferred: Skills Onboarding Improvements
**Reason:** Lower priority, can wait for v0.17.0

---

## 🔬 Quality Iterations (4 rounds)

### Iteration 1: Performance Audit ⚡
**Lead:** Opus (analysis) → GPT-5.2 (review + suggestions)
**Time:** ~1h
**Focus:**
- Bundle size analysis (identify large dependencies)
- React render optimization (useMemo, useCallback, React.memo)
- Three.js performance (instanced meshes, LOD, frustum culling)
- Network requests (reduce API calls, caching)
- Lighthouse/WebPageTest audit

**Deliverables:**
- Performance audit report
- Top 5 optimization opportunities
- Implementation plan for quick wins

---

### Iteration 2: Bug Sweep 🐛
**Lead:** Opus (testing + fixes) → GPT-5.2 (review)
**Time:** ~1h
**Focus:**
- Review KNOWN_ISSUES.md
- Test edge cases (empty states, errors, race conditions)
- Browser compatibility (Chrome, Firefox, Safari)
- Mobile/tablet testing (responsive issues)
- Error boundary coverage

**Deliverables:**
- Bug fixes committed
- Updated KNOWN_ISSUES.md
- Test coverage improvements

---

### Iteration 3: Code Quality 📐
**Lead:** Opus (refactoring) → GPT-5.2 (review)
**Time:** ~1.5h
**Focus:**
- TypeScript strict mode progress
- Reduce code duplication (shared hooks, utilities)
- Improve component patterns (composition over props)
- ESLint/Prettier consistency
- Remove dead code

**Deliverables:**
- Refactoring commits
- Updated coding guidelines
- Tech debt reduction metrics

---

### Iteration 4: Final Review 🔍
**Lead:** GPT-5.2 (comprehensive review) → Opus (critical fixes)
**Time:** ~1h
**Focus:**
- Security review (XSS, CSRF, injection)
- Accessibility audit (ARIA, keyboard nav, screen readers)
- Documentation gaps (missing JSDoc, outdated README)
- API consistency (naming, error handling)
- Final smoke test

**Deliverables:**
- Security fixes (if any)
- Accessibility improvements
- Documentation updates
- Pre-release checklist

---

## 📋 Timeline

| Time | Task | Agent | Duration |
|------|------|-------|----------|
| 01:05 - 01:30 | Kickoff: Zen Panel Registry design doc | Main | 25m |
| 01:30 - 03:30 | Zen Panel Registry implementation | Opus | 2h |
| 03:30 - 04:00 | Zen Panel Registry review | GPT-5.2 | 30m |
| 04:00 - 05:30 | Frontend Watchdog implementation | Opus | 1.5h |
| 05:30 - 06:00 | Frontend Watchdog review | GPT-5.2 | 30m |
| 06:00 - 07:00 | **Quality Iteration 1: Performance** | Opus + GPT-5.2 | 1h |
| 07:00 - 08:00 | **Quality Iteration 2: Bug Sweep** | Opus + GPT-5.2 | 1h |
| 08:00 - 09:30 | **Quality Iteration 3: Code Quality** | Opus + GPT-5.2 | 1.5h |
| 09:30 - 10:30 | **Quality Iteration 4: Final Review** | GPT-5.2 + Opus | 1h |

**Total:** ~9h

---

## 🎯 Success Criteria

### v0.16.0 Features
- ✅ Zen Panel Registry fully functional (Ctrl+K, context menu, layouts)
- ✅ Frontend Watchdog auto-restarts Vite on crash
- ⚠️ Grid boundary improvements (best effort, defer if needed)

### Quality Iterations
- ✅ Performance audit complete with top optimizations implemented
- ✅ All critical bugs from KNOWN_ISSUES.md addressed
- ✅ Code quality improvements (strict mode, reduced duplication)
- ✅ Security & accessibility review complete

---

## 📝 Notes

- **Grid boundary:** Max 1 iteration, defer to v0.17.0 if complex
- **All work on develop branch**
- **Commit after each feature/iteration**
- **Update matrix.md when features complete**
- **Morning summary for Nicky in memory/2026-02-14.md**

---

**Status:** 🚀 READY TO START
