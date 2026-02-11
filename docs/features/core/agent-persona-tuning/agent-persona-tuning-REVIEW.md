# Agent Persona Tuning UX Review (Second Pair of Eyes)

**Reviewer:** GPT-5.2 (UX critique)  
**Date:** 2026-02-10  
**Reviewed doc:** `agent-persona-tuning.md`  
**Scope:** UX flow, mental model clarity, alternatives, edge cases, simplification, accessibility, copy

---

## Executive Summary

This is a strong v1 concept with good product intuition: it directly targets the Boingz hesitation problem, introduces lightweight control, and adds a preview step before completion. The preset-first approach is practical, and the dimensions are mostly meaningful.

The biggest UX risk is **cognitive load in onboarding**: users are asked to understand 4 abstract dimensions + presets + advanced instructions in a high-friction moment. There is also a likely mental-model mismatch between **Action Bias**, **Autonomy**, and **Risk Tolerance**, which can feel overlapping/confusing.

**Bottom line:** Keep the direction, but simplify what users must decide in onboarding and improve preview realism for custom settings.

---

## 1) UX Flow & Friction Points

## What works well
- Good placement after “First Bot”: users have context and agent identity.
- “Use recommended defaults” skip is essential and correctly included.
- Test Drive before finish reduces fear and increases confidence.
- Preset cards give fast-start path for users who don’t want to tune deeply.

## Friction points
1. **Two new steps (Persona + Test Drive) in onboarding** may reduce completion, especially for first-time/curious users.
2. **Step title mismatch risk:** “Set the Vibe” sounds casual, but controls are behavior-critical. Might under-signal impact.
3. **Too much choice too early:** 4 sliders + advanced text + preset comparison in one view can overwhelm users.
4. **Custom mode behavior ambiguity:** “Custom starts from current slider positions” is fine, but users may not understand whether they are “breaking” a preset or creating a profile.
5. **Static preview limitations:** users may over-trust preview examples and feel discrepancy later (“it didn’t behave like preview”).

## Recommendations
- In onboarding, default to **Preset-only first**, then optional “Fine-tune” disclosure.
- Consider collapsing Test Drive into Persona step as an inline panel to avoid one extra step.
- Rename “Set the Vibe” to something clearer like **“How your agent works”** with a short consequence line.

---

## 2) Mental Model Clarity (Will users understand dimensions?)

## Potential confusion
- **Action Bias vs Autonomy** can feel similar:
  - Action Bias = asks before starting
  - Autonomy = check-ins during execution
  Many users won’t naturally separate these.
- **Risk Tolerance** may be interpreted as “safety/risky operations” by some and “creativity/novelty” by others.
- **Communication** is clear, but users may want style control (tone) rather than length/detail.

## What to improve
- Add microcopy under each slider with plain-language examples (“Before starting”, “During task”, “How much detail”, etc.).
- Rename dimensions to reduce abstraction:
  - Action Bias → **Start Behavior**
  - Autonomy → **Check-in Frequency**
  - Communication → **Response Detail**
  - Risk Tolerance → **Approach Style (Conservative ↔ Experimental)**

---

## 3) Alternative Approaches to Consider

1. **2-level onboarding approach (recommended):**
   - Level 1 (default): choose preset + optional test example.
   - Level 2 (optional): “Fine-tune behavior” expands sliders.
   This preserves power while reducing initial complexity.

2. **Goal-based setup instead of abstract sliders:**
   - “I want my agent to…” options (e.g., “move fast”, “explain decisions”, “play safe”, “work independently”).
   - These map to sliders behind the scenes.

3. **Task-context presets (optional future):**
   - “For coding”, “for research”, “for admin tasks” variants.
   Users often think in task contexts, not personality traits.

4. **Dual-mode safety framing:**
   - Quick toggle: **“Fast mode”** vs **“Careful mode”** with advanced controls below.
   Solves Boingz immediately with minimal cognition.

---

## 4) Edge Cases / Gaps

1. **Regulated/sensitive environments:** Default Executor could be too aggressive for some users (legal/compliance, finance, ops). Add “sensitive workflow?” branch or safer recommendation when signals indicate risk-sensitive use.
2. **Non-technical users:** Current copy assumes users understand autonomy/risk dimensions. Need simpler plain-language helper text.
3. **Conflicting instructions:** “Custom instructions win” is correct, but hidden conflict can create surprises. Add lightweight warning when obvious contradictions are detected.
4. **Custom preview interpolation:** nearest-preset approximation may mislead at mixed slider values (e.g., high autonomy + low action bias). Need explicit uncertainty messaging.
5. **No “reset per dimension”:** user may want to tweak one slider and reset only that control.
6. **No saved persona variants:** users may want quick switching (“Coding mode”, “Planning mode”). Even post-onboarding this is valuable.

---

## 5) Simplification Opportunities

- Reduce onboarding UI to:
  1) Preset select
  2) One “Behavior intensity” modifier (optional)
  3) Optional advanced section
- Defer full 4-slider matrix to settings page, with onboarding “fine-tune” link.
- Limit advanced textarea in onboarding to “one instruction” helper pattern with chips/examples.
- Keep Test Drive to 1 canonical scenario + 1 user-typed mini prompt instead of 3 scenario buttons.

---

## 6) Accessibility & Progressive Disclosure

## Accessibility improvements needed
- Ensure sliders are keyboard-operable with clear focus states and ARIA labels.
- Do not rely only on color to indicate selected preset.
- Provide visible scale markers (1–5) and textual current value.
- Tooltips on hover are not enough; include always-visible helper text for touch and keyboard users.
- Ensure contrast on gray “comparison” text in Test Drive is WCAG-compliant.

## Progressive disclosure
- Good that “Advanced” is collapsed.
- Extend this principle to sliders: presets first, sliders hidden behind “Fine-tune”.

---

## 7) Copy & Messaging Effectiveness

## Strong points
- Preset names are memorable.
- “Most users prefer Executor” recommendation is decisive.
- Boingz connection is concrete and useful for internal alignment.

## Copy risks
- “Set the Vibe” may undersell risk/impact.
- “Just do it” can imply unsafe behavior if taken literally.
- “Work solo” can feel anthropomorphic and vague.

## Suggested copy tweaks
- Page title: **“Choose how your agent behaves”**
- Action Bias endpoints: **“Start quickly” ↔ “Confirm first”**
- Autonomy endpoints: **“Frequent check-ins” ↔ “Final result only”**
- Risk endpoints: **“Conservative methods” ↔ “Experimental methods”**
- Add safety reassurance line near Executor: “Still respects safety rules and dangerous-action safeguards.”

---

## 8) Specific Answers to Requested Questions

## Which sliders might be confusing?
Most confusing likely order:
1. **Autonomy** (overlaps with Action Bias)
2. **Risk Tolerance** (creativity vs safety ambiguity)
3. **Action Bias** (clear once examples are shown)
4. **Communication** (clearest)

## Is the preset system intuitive?
Yes, mostly. The card model is intuitive. The “Custom on slider change” behavior is standard and good. Add a subtle toast/message: “You’re now using a custom profile.”

## Better ways to preview behavior?
Yes:
- Let user enter a **single custom mini prompt** (e.g., “Say Hello World”) and show 2 side-by-side outputs (selected persona vs Executor/Advisor).
- Use deterministic scripted templates now, but include a stronger disclaimer for custom slider mixes.
- In v2, live preview with lightweight model is worth it if latency stays low.

## Should any dimensions be removed or added?
- **Potentially merge/reframe** Action Bias + Autonomy in onboarding (keep separate in advanced settings).
- Consider adding (future): **Initiative** (“suggest next steps proactively” ↔ “only do requested tasks”). This often matters more than abstract risk.
- Avoid adding more dimensions in v1 onboarding; complexity already near threshold.

---

## 9) Actionable Iteration Plan for Opus

1. **Onboarding simplification (high priority):** preset-first UI, sliders under “Fine-tune”.
2. **Dimension renaming + helper text (high priority):** improve comprehension without changing backend model.
3. **Preview upgrade (high priority):** one custom prompt input + side-by-side comparison.
4. **Conflict affordance (medium):** basic warning when advanced instructions clearly contradict slider endpoints.
5. **Accessibility pass (high priority):** keyboard, labels, non-hover guidance, contrast.
6. **Post-onboarding depth (medium):** saved persona variants and per-dimension reset.

---

## 10) Ratings

- **Simplicity:** **7/10**  
  Good structure, but still too many choices during onboarding.

- **Learnability:** **6.5/10**  
  Presets help; dimension overlap and abstract labels hurt first-time understanding.

- **Effectiveness (Boingz problem):** **8.5/10**  
  Strong direct fix via Action Bias + Executor default + preview around “Hello World”.

- **Overall grade:** **B+**  
  Strong product direction with clear user value; needs onboarding simplification and clearer mental model to become excellent.

---

## Final Take

This is a solid and shippable v1 direction. The core idea is right and likely to reduce hesitation complaints significantly. The main opportunity is not adding capability but reducing cognitive burden in onboarding while making behavior controls more intuitively understandable.
