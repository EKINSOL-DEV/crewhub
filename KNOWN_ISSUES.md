# Known Issues

## Prop Movement

### ~~Visual glitch on save~~ (FIXED in v0.15.0)
~~When confirming a prop move with the HUD save button, the prop briefly jumps back to its original position (~100ms) before settling in the new location.~~

**Fixed:** Selection is now cleared synchronously with the optimistic placement update, so React 18 batches both state changes together. No more flash-back.
