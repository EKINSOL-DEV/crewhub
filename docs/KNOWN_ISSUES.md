# Known Issues - CrewHub

*Last updated: 2026-02-12*

## 🐛 Active Issues

### PropMaker Part Editor - TransformControls Position (v0.14.0)

**Severity:** Medium  
**Status:** Known, will fix in v0.14.1 hotfix (no announcement)

**Problem:**
- TransformControls gizmo doesn't position correctly at selected part center
- Example: Click on pink straw (top of smoothie) → controls appear at smoothie cup (bottom)
- Grootte is correct, maar position offset is wrong

**Root cause (hypotheses):**
1. `geometry.center()` applied but world position not recalculated
2. Parent transform chain niet correct doorgerekend
3. Bounding box center computed in wrong coordinate space
4. AI-generated parts hebben inconsistent pivot points

**Workaround:**
- Part Editor werkt, maar controls zijn niet bij selected part
- Transform functionality works (can move/rotate), just visual positioning is off

**Plan:**
- Multi-iteration fix AFTER v0.14.0 release
- Need deep dive into:
  - drei TransformControls attachment patterns
  - Three.js world matrix computation with nested scaled groups
  - Part geometry pivot points from AI generation
- Test with multiple prop types (smoothie, desk, lamp, etc.)
- Deploy as v0.14.1 hotfix patch (silent release, no Discord announcement)

**Tracking:**
- Issue discovered: 2026-02-12 21:09
- Multiple fix attempts: 21:11, 21:16, 21:23, 21:28, 21:30 (all partial success)
- Final attempt for v0.14.0: 21:30 (geometry.center() applied, size correct, position still wrong)
- Status: Deferred to post-release hotfix

---

## 🔄 Resolved Issues

*(Will be populated as issues are fixed)*

---

## 📝 Notes

- For urgent production-blocking issues, see #dev channel on Discord
- Minor visual/UX issues can be tracked here for batched fixes
