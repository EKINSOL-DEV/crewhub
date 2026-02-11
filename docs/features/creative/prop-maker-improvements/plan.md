# PropMaker Evolution — Improvement Plan

*Date: 2026-02-11*
*Goal: AI-generated props that match showcase quality*

---

## Phase 1: Foundation (v0.13.0) ✅ RELEASED 2026-02-11

**Goal:** Immediate quality lift with minimal code changes.
**Status:** ✅ Complete — all items shipped.

### 1.1 Rewrite Generation Prompt

Replace the current `creator-zone-prompt.md` with showcase-informed instructions:

**Key changes:**
- Switch default from `meshToonMaterial` to `meshStandardMaterial` with `flatShading`
- Require at least one animated element per prop
- Require at least one emissive element per prop
- Expand part count guidance: "Always 8+ distinct meshes"
- Add 5-layer composition model (Base → Body → Function → Detail → Life)
- Include 3-4 showcase props as full examples in the prompt

**Effort:** 2-3 hours (prompt rewrite + testing)

### 1.2 Ship Showcase Props as Built-in Library

- Copy 10 showcase props into `frontend/src/props/showcase/`
- Make them available in PropMaker history as "Example Props"
- Users can view, place, and use as reference
- AI prompt includes "generate in the style of these examples"

**Effort:** 1-2 hours

### 1.3 Improve Post-Processing

Current post-processor fixes orientation. Extend to:
- Add `flatShading` to any `meshStandardMaterial` missing it
- Ensure at least one mesh has emissive properties
- Add gentle `useFrame` rotation if no animation exists
- Validate part count (warn if < 5 meshes)

**Effort:** 3-4 hours

### 1.4 Material Defaults Update

- Update `useToonMaterialProps` hook or deprecate it
- Create new `usePropMaterial` hook that returns `meshStandardMaterial` props with `flatShading`
- Keep emissive materials as raw `meshStandardMaterial`

**Effort:** 1-2 hours

---

## Phase 2: Quality Boost (v0.15.0)

**Goal:** Match showcase quality consistently.

### 2.1 Reusable Component Library

Pre-built, high-quality components AI can reference:

| Component | Description | Usage |
|-----------|-------------|-------|
| `<LED color />` | Small emissive sphere with pulse | Status indicators |
| `<SteamParticles />` | Rising translucent spheres | Hot objects |
| `<SparkParticles />` | Tiny emissive cubes, random motion | Electric/data |
| `<GlowOrb color />` | Transparent sphere with inner glow | Magic/energy |
| `<Cable color from to />` | TubeGeometry curve | Server/tech props |
| `<FloatingText text />` | drei Text with gentle bob | Labels |

AI prompt references these: "Use `<LED>` for indicator lights, `<SteamParticles>` for steam effects."

**Effort:** 4-6 hours

### 2.2 Multi-Pass Generation

Instead of single AI generation:

1. **Pass 1 — Structure:** AI generates base geometry (body + core shapes)
2. **Pass 2 — Enhancement:** Automated script adds details:
   - Injects LED components on flat surfaces
   - Adds subtle animation via `useFrame`
   - Applies color palette normalization
3. **Pass 3 — Validation:** Check against quality rules (part count, emissive, animation)

**Effort:** 8-12 hours

### 2.3 Visual Refinement UI

In PropMaker UI, after generation:
- **Color palette picker** — swap colors while keeping structure
- **Material presets** — "Metallic", "Glowing", "Matte", "Glass"
- **Animation toggle** — "Rotate", "Pulse", "Float", "None"

**Effort:** 6-8 hours

---

## Phase 3: Advanced (v0.16.0+)

**Goal:** Exceed showcase quality.

### 3.1 Iteration System

After initial generation, user can refine via text:
- "Make it more colorful"
- "Add blinking lights"
- "Make it taller"
- "Add steam coming out the top"

AI receives current component code + instruction → generates improved version.

**Effort:** 4-6 hours

### 3.2 Style Transfer from Showcase

Train the prompt to extract and apply patterns:
- Analyze user's text description
- Find closest showcase prop
- Use that prop's code patterns as template basis
- AI fills in the specific details

**Effort:** 6-8 hours

### 3.3 Hybrid Generation (RAG + AI)

Combine with Prop Library (v0.17.0):
- User describes prop → semantic search finds similar templates
- AI uses template as skeleton → modifies to match description
- Best of both: template quality + AI creativity

**Effort:** Depends on Prop Library implementation

---

## Success Metrics

| Metric | Current | Phase 1 Target | Phase 2 Target |
|--------|---------|----------------|----------------|
| Avg meshes per prop | 3-5 | 8-12 | 10-15 |
| Props with animation | ~10% | 80%+ | 100% |
| Props with emissive | ~20% | 90%+ | 100% |
| Orientation issues | ~30% | <10% | <5% |
| User "keep" rate | ~30% | 60%+ | 80%+ |
| Generation iterations needed | 3-5 | 1-2 | 1 |

---

## Quick Wins (Implementable Now)

These require zero architecture changes:

1. ✏️ **Rewrite AI prompt** — Add showcase examples, enforce animation/emissive
2. 📦 **Ship showcase props** — Copy to library, show in history
3. 🎨 **Fix material strategy** — `flatShading` standard > toon
4. 🔧 **Enhance post-processor** — Auto-add rotation if missing

**Combined effort for all quick wins: ~8 hours**
**Expected quality improvement: 2-3× better output**

---

## Dependencies

| Item | Depends On | Version |
|------|-----------|---------|
| Prompt rewrite | Nothing | v0.14.0 |
| Showcase library | Nothing | v0.14.0 |
| Component library | Prompt rewrite | v0.15.0 |
| Multi-pass | Component library | v0.15.0 |
| Iteration system | Multi-pass | v0.16.0 |
| Hybrid/RAG | Prop Library feature | v0.17.0 |
