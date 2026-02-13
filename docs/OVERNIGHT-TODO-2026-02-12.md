# Overnight TODO - v0.15.0 Planning
*Created: 2026-02-12 22:12*

## 🎯 Priority Features (FOCUS)

### 1. Agent Identity Pattern ⭐⭐⭐
**Goal:** Single identity, multiple surfaces - prevent personality drift

**Deliverables:**
- Implementation in backend + frontend
- Blog post: `docs/features/core/agent-persona-tuning/agent-identity-pattern-blog.md`
  - High-level explanation
  - Why it matters
  - How it works
  - Examples
- Changes document: Track all modifications

**Approach:**
- Opus for implementation (2-3 iterations)
- GPT-5.2 for review
- Test with multiple agents

---

### 2. Agent Status Logic Improvements ⭐⭐⭐
**Goal:** Fix false "sleeping" status during long-running tasks

**Deliverables:**
- Fix status detection logic
- Add activity tracking for long tasks
- Blog post: `docs/features/core/agent-status-logic-blog.md`
  - Problem description
  - Solution approach
  - Technical details (high-level)
- Changes document

**Approach:**
- Analyze current status logic
- Implement better activity detection
- Test with subagent spawns

---

### 3. Spatial Awareness 🔬 ⭐⭐⭐
**Goal:** Vision, proximity, pathfinding (research phase)

**Deliverables:**
- Research document: feasibility, approaches, tech stack
- Prototype (if feasible overnight)
- Blog post: `docs/features/3d-world/spatial-awareness/spatial-awareness-blog.md`
  - Vision for spatial awareness
  - Research findings
  - Next steps
- Changes document

**Approach:**
- Research existing solutions (Three.js raycasting, pathfinding libraries)
- Design system architecture
- Build minimal prototype

---

## 📋 Secondary Features (if time permits)

### 4. Grid Boundary Fine-Tuning
**Status:** Known issue from v0.14.0 (TransformControls position)
**Approach:** Multi-iteration fix after priority features

### 5. Zen Mode Panel Registry
**Goal:** Single source of truth for panels (Ctrl+K, context menu, layouts)
**Approach:** Architectural refactor

### 6. Frontend Watchdog & Auto-Restart
**Goal:** Docker-based monitoring for Vite dev server crashes
**Approach:** Similar to backend watchdog (already implemented)

---

## 📝 Deliverables Format

### Blog Posts
Location: `docs/features/{category}/{feature}/{feature}-blog.md`

Structure:
```markdown
# {Feature Name}

*Date: 2026-02-13*

## What & Why

High-level explanation of the feature and why it matters.

## How It Works

Conceptual overview (not implementation details).

## Impact

What changes for users/developers.

## Next Steps

Future improvements.
```

### Changes Document
Location: `docs/CHANGES-v0.15.0.md`

Structure:
```markdown
# v0.15.0 Changes - Overnight Session

*Session: 2026-02-12 22:00 → 2026-02-13 08:00*

## Agent Identity Pattern
- Changed: [list of files]
- Added: [new features]
- Fixed: [bugs]
- Commits: [commit hashes]

## Agent Status Logic Improvements
...

## Spatial Awareness Research
...

## Summary
Total commits: X
Total files changed: Y
Lines added/removed: +Z / -W
```

---

## ⚙️ Execution Plan

### Phase 1: Setup (30 min)
- Create blog post templates
- Create CHANGES-v0.15.0.md
- Review existing docs for context

### Phase 2: Agent Identity Pattern (2-3h)
- Isolated session with Opus
- Timeout: 3 hours
- Model: opus
- Thinking: high

### Phase 3: Agent Status Logic (1-2h)
- Isolated session with Opus
- Timeout: 2 hours
- Model: opus
- Thinking: medium

### Phase 4: Spatial Awareness Research (2-3h)
- Isolated session with Opus
- Timeout: 3 hours
- Model: opus
- Thinking: high

### Phase 5: Review & Polish (1h)
- GPT-5.2 review of implementations
- Update blog posts
- Finalize CHANGES document
- Commit & push

---

## 📊 Success Criteria

**Must Have:**
- ✅ Agent Identity Pattern implemented & tested
- ✅ Agent Status Logic fixed
- ✅ Spatial Awareness research complete + prototype (if feasible)
- ✅ 3 blog posts written (high-level, readable)
- ✅ CHANGES document complete

**Nice to Have:**
- ✅ Grid boundary fix
- ✅ Zen Mode panel registry
- ✅ Frontend watchdog

---

## 🚨 Important Notes

- **Focus on top 3 features**
- Blog posts must be readable for Nicky in the morning (high-level, not technical details)
- Changes document tracks ALL modifications
- Use isolated sessions (no main assistant involvement)
- Commit frequently
- Test thoroughly before marking complete

---

*Ready for overnight execution. Estimated completion: 2026-02-13 06:00-08:00*
