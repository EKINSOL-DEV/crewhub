# Known Issues

## Prop Movement

### Visual glitch on save
**Severity:** Low (cosmetic)

When confirming a prop move with the HUD save button, the prop briefly jumps back to its original position (~100ms) before settling in the new location.

**Cause:** Race condition between state cleanup and parent re-render receiving updated placements.

**Workaround:** Ignore the brief visual glitch. The prop position is saved correctly to the backend and persists after refresh.

**Status:** Documented, low priority fix.
