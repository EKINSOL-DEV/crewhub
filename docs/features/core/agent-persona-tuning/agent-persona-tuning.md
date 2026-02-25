# Agent Persona Tuning — Onboarding UX Design

> **Status:** Draft v2 · 2026-02-10
> **Context:** Agent "Boingz" executed context envelope perfectly but was too hesitant on simple tasks. Users need control over agent behavior from day one.

---

## v2 Changes

Based on GPT-5.2 UX review (grade: B+), this iteration addresses:

1. **Simplified onboarding** — Preset-first UI; sliders hidden behind "Fine-tune" disclosure. Reduces cognitive load at the critical onboarding moment.
2. **Renamed dimensions** — More intuitive labels: Start Behavior, Check-in Frequency, Response Detail, Approach Style. Added always-visible helper text.
3. **Better preview** — Custom prompt input with side-by-side persona comparison replaces 3-button scenario picker.
4. **Accessibility** — Keyboard nav, ARIA labels, visible scale markers (1–5), non-hover helper text, WCAG-compliant contrast.
5. **Copy improvements** — Page title → "Choose how your agent behaves"; clearer endpoint labels; safety reassurance on Executor preset.
6. **Merged Test Drive into persona step** — Inline preview panel instead of separate wizard step (reduces funnel drop-off).
7. **Conflict hint** — Lightweight warning when custom instructions obviously contradict slider positions.

**What stayed:** Core direction, Executor default, preset card model, technical implementation plan, Boingz post-mortem.

---

## 1. Wizard Integration

### Current Onboarding Flow
```
Welcome → Create Hub → Connect Gateway → First Bot → ✅ Done
```

### Proposed Flow
```
Welcome → Create Hub → Connect Gateway → First Bot → Persona & Preview → ✅ Done
                                                      ▲
                                                      │
                                                  NEW STEP
```

**Placement rationale:** After "First Bot" because the user has already named their agent and picked a model — they have a mental identity for it. We can immediately apply persona to the bot they just created.

**Skip option:** "Use recommended defaults" link at the top. Applies Executor preset. They can always tune later from agent settings.

**v2 change:** Test Drive is now an inline preview panel within this step, not a separate step. This reduces the wizard from 6 to 5 steps.

---

## 2. UI Components

### 2.1 Layout (Step: "Choose how your agent behaves")

```
┌─────────────────────────────────────────────────────────────┐
│  Step 4 of 5 · Choose how your agent behaves                │
│                                                             │
│  Pick a style for {agent_name}:                             │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ ⚡ ⭐     │  │ 🧠       │  │ 🔬       │                  │
│  │ Executor │  │ Advisor  │  │ Explorer │                  │
│  │          │  │          │  │          │                  │
│  │ Acts     │  │ Thinks   │  │ Tries    │                  │
│  │ first    │  │ first    │  │ new ways │                  │
│  │          │  │          │  │          │                  │
│  │ ✓ Best   │  │ Great    │  │ Great    │                  │
│  │ for most │  │ for      │  │ for R&D  │                  │
│  │ users    │  │ learning │  │ & hobby  │                  │
│  └─────┬────┘  └──────────┘  └──────────┘                  │
│        ▼ selected                                           │
│                                                             │
│  🔒 Still respects safety rules and dangerous-action        │
│     safeguards, regardless of preset.                       │
│                                                             │
│  ┌ Fine-tune ▸ ─────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  Start Behavior                                      │   │
│  │  How should the agent begin tasks?                   │   │
│  │  Start quickly  ●━━━━━━━━━━━━━━━○  Confirm first    │   │
│  │  1    2    3    4    5                                │   │
│  │                                                      │   │
│  │  Check-in Frequency                                  │   │
│  │  How often should the agent update you?              │   │
│  │  Frequent check-ins  ○━━━━━━━●━━━━━  Final result   │   │
│  │  1    2    3    4    5               only             │   │
│  │                                                      │   │
│  │  Response Detail                                     │   │
│  │  How much should the agent explain?                  │   │
│  │  Just results  ●━━━━━━━━━○━━━━━━━  Full context     │   │
│  │  1    2    3    4    5                                │   │
│  │                                                      │   │
│  │  Approach Style                                      │   │
│  │  What methods should the agent prefer?               │   │
│  │  Conservative  ○━━━━━━━━━━●━━━━━  Experimental      │   │
│  │  1    2    3    4    5                                │   │
│  │                                                      │   │
│  │  ▾ Custom instructions                               │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │ e.g. "Always respond in Dutch"                 │  │   │
│  │  │      "Never delete files without asking"       │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ─── Preview ───────────────────────────────────────────    │
│  Try a prompt:  [Say Hello World_______________] [Preview]  │
│                                                             │
│  ┌─ Executor ──────────────┐ ┌─ Advisor ──────────────┐    │
│  │ Hello World! ✅          │ │ Where should I print   │    │
│  │                         │ │ it? Terminal? File?     │    │
│  └─────────────────────────┘ └─────────────────────────┘    │
│                                                             │
│                        [ Use defaults ]  [ Continue → ]     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Interaction Details

**Preset cards:**
- Clicking a preset sets all sliders to its values
- Selected card gets a colored border + checkmark icon (not color-only — accessible)
- Each card shows a one-line tagline + audience hint
- No separate "Custom" card — adjusting any slider after selecting a preset shows a subtle toast: *"Using custom settings"*

**Fine-tune disclosure:**
- Collapsed by default in onboarding (label: "Fine-tune ▸")
- Clicking expands the slider panel
- In agent settings page (post-onboarding), sliders are always visible

**Sliders:**
- 5-point discrete scale with visible numbered markers (1–5)
- Labels at each end describe the extremes in plain language
- Always-visible helper line below each slider name explains what the dimension controls
- Current value shown as text next to slider (e.g., "Level 2: Start quickly, confirm only for risky ops")
- Keyboard: arrow keys move between positions, Tab moves between sliders
- ARIA: `role="slider"`, `aria-valuemin="1"`, `aria-valuemax="5"`, `aria-valuenow`, `aria-label` with dimension name + current description

**Custom instructions textarea:**
- Nested inside Fine-tune, collapsed by default
- Placeholder shows concrete examples (not abstract guidance)
- Max 500 chars in onboarding (full editor in settings)
- **Conflict hint:** If text contains obvious contradictions with slider positions (e.g., "always ask before acting" with Start Behavior at 1), show amber hint: *"This may override your Start Behavior setting above."*

**Preview panel:**
- Always visible below the preset cards
- Default prompt pre-filled: "Say Hello World"
- User can type a custom prompt
- Shows side-by-side: selected persona response vs. contrasting persona
- Static pre-computed responses for preset combinations; for custom slider positions, show nearest preset match with note: *"Approximate preview"*
- Contrast text meets WCAG AA (4.5:1 minimum)

---

## 3. Behavior Dimensions

| Dimension | Label | Left (1) | Right (5) | Helper text |
|-----------|-------|----------|-----------|-------------|
| **Start Behavior** | `start_behavior` | Start quickly | Confirm first | How should the agent begin tasks? |
| **Check-in Frequency** | `checkin_frequency` | Frequent check-ins | Final result only | How often should the agent update you? |
| **Response Detail** | `response_detail` | Just results | Full context | How much should the agent explain? |
| **Approach Style** | `approach_style` | Conservative methods | Experimental methods | What methods should the agent prefer? |

### Mapping to System Prompt

Each dimension at each level maps to a prompt fragment. The fragments are concatenated.

**Start Behavior** (formerly Action Bias):
| Level | Prompt fragment |
|-------|----------------|
| 1 | `Execute tasks immediately without asking for confirmation. Only ask when the request is genuinely ambiguous or dangerous.` |
| 2 | `Prefer action over asking. Confirm only for irreversible or high-impact operations.` |
| 3 | `Balance between acting and confirming. Ask for clarification on moderately ambiguous requests.` |
| 4 | `Err on the side of asking. Confirm your understanding before executing non-trivial tasks.` |
| 5 | `Always confirm your plan before executing. Present options and wait for user approval.` |

**Check-in Frequency** (formerly Autonomy):
| Level | Prompt fragment |
|-------|----------------|
| 1 | `Provide frequent progress updates. Check in after each major step.` |
| 2 | `Give brief status updates at key milestones.` |
| 3 | `Report when starting and completing tasks. Summarize what you did.` |
| 4 | `Work through multi-step tasks independently. Report the final result.` |
| 5 | `Work fully autonomously. Only surface the final result or if you're blocked.` |

**Response Detail** (formerly Communication):
| Level | Prompt fragment |
|-------|----------------|
| 1 | `Be extremely concise. Give answers and results, skip explanations unless asked.` |
| 2 | `Keep responses brief. Add short explanations only when helpful.` |
| 3 | `Provide moderate detail. Explain your reasoning for non-obvious decisions.` |
| 4 | `Be thorough in responses. Explain your approach and reasoning.` |
| 5 | `Give detailed, comprehensive responses. Explain context, alternatives, and trade-offs.` |

**Approach Style** (formerly Risk Tolerance):
| Level | Prompt fragment |
|-------|----------------|
| 1 | `Use proven, well-established approaches. Avoid experimental methods.` |
| 2 | `Prefer conventional solutions. Suggest alternatives but default to safe choices.` |
| 3 | `Balance reliability with innovation. Use proven approaches for critical tasks, experiment on lower-stakes ones.` |
| 4 | `Be willing to try creative or unconventional approaches. Note when something is experimental.` |
| 5 | `Actively explore creative and unconventional solutions. Push boundaries and try new approaches.` |

---

## 4. Preset Personas

### ⚡ Executor ⭐ Recommended
> *"Give me a task, I'll get it done."*

- Start Behavior: 1 (Start quickly)
- Check-in Frequency: 4 (Final result focus)
- Response Detail: 2 (Brief)
- Approach Style: 3 (Balanced)

**Best for:** Developers, power users, automation-heavy workflows.
**Solves the Boingz problem directly.**

🔒 *Still respects safety rules and dangerous-action safeguards.*

### 🧠 Advisor
> *"Let me think through this with you."*

- Start Behavior: 4 (Confirm first)
- Check-in Frequency: 2 (Frequent updates)
- Response Detail: 4 (Thorough)
- Approach Style: 2 (Conservative)

**Best for:** Non-technical users, learning scenarios, sensitive operations.

### 🔬 Explorer
> *"Let's try something interesting."*

- Start Behavior: 2 (Bias to action)
- Check-in Frequency: 4 (Independent)
- Response Detail: 3 (Moderate)
- Approach Style: 5 (Experimental)

**Best for:** Creative projects, R&D, brainstorming, hobby projects.

---

## 5. Preview (Inline)

### How it works

The preview panel is part of the persona step (not a separate wizard step).

- **Default prompt:** "Say Hello World" pre-filled — the exact task that exposed the Boingz problem
- **Custom input:** User can type any short prompt to see how the agent would respond
- **Side-by-side:** Shows selected persona vs. a contrasting persona (e.g., Executor vs. Advisor)
- **Not a live LLM call** — pre-computed responses for each scenario × preset combination
- For custom slider positions: show nearest preset match with note: *"Approximate preview. Actual behavior may vary."*

### Future Enhancement (v2 implementation)
- Live LLM preview with a lightweight model (e.g., Haiku) using the constructed system prompt
- ~2s latency, cached per slider combination
- Cost: negligible (short prompts, cheap model)

---

## 6. Technical Implementation

### 6.1 Database Schema

```sql
CREATE TABLE agent_persona (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

    -- Dimensions (1-5 scale), renamed from v1
    start_behavior INTEGER NOT NULL DEFAULT 1,      -- was: action_bias
    checkin_frequency INTEGER NOT NULL DEFAULT 4,    -- was: autonomy
    response_detail INTEGER NOT NULL DEFAULT 2,      -- was: communication
    approach_style INTEGER NOT NULL DEFAULT 3,       -- was: risk_tolerance

    -- Preset name if one was selected, NULL if custom
    preset TEXT,  -- 'executor' | 'advisor' | 'explorer' | NULL

    -- User's custom prompt additions
    custom_instructions TEXT DEFAULT '',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(agent_id)
);
```

### 6.2 API Endpoints

```
GET    /api/agents/{id}/persona              → PersonaResponse
PUT    /api/agents/{id}/persona              → PersonaResponse
GET    /api/persona/presets                   → list of preset definitions
GET    /api/persona/preview?prompt=X&preset=Y → preview response for prompt+preset
```

**PUT body:**
```json
{
  "start_behavior": 1,
  "checkin_frequency": 4,
  "response_detail": 2,
  "approach_style": 3,
  "preset": "executor",
  "custom_instructions": ""
}
```

### 6.3 Context Envelope Injection

In the existing envelope builder (`build_context_envelope()`), add a new section:

```python
def build_persona_prompt(persona: AgentPersona) -> str:
    """Convert persona dimensions to system prompt fragment."""
    fragments = []
    fragments.append(START_BEHAVIOR_PROMPTS[persona.start_behavior])
    fragments.append(CHECKIN_FREQUENCY_PROMPTS[persona.checkin_frequency])
    fragments.append(RESPONSE_DETAIL_PROMPTS[persona.response_detail])
    fragments.append(APPROACH_STYLE_PROMPTS[persona.approach_style])

    if persona.custom_instructions:
        fragments.append(f"\nAdditional instructions from your user:\n{persona.custom_instructions}")

    return "\n\n".join(fragments)
```

Injected into the envelope as:
```
## Behavior Guidelines
{persona_prompt}
```

Placed **after** the core system prompt but **before** task-specific context. This ensures persona shapes behavior without overriding essential instructions.

### 6.4 Onboarding State

```json
{
  "onboarding": {
    "steps_completed": ["hub", "gateway", "first_bot", "persona"],
    "persona_configured": true
  }
}
```

---

## 7. Default Behavior

### Default Preset: **Executor** (recommended)

**Rationale:**
- The #1 complaint (Boingz) was an agent being *too hesitant*
- Users creating agents in CrewHub want them to *do things*
- "Ask permission" is a safer default in general, but our users are technical and expect action
- Better to have an agent that does too much (user says "wait, stop") than one that does too little (user says "why are you asking me?")

### UI Treatment
- Executor card has a "⭐ Recommended" badge
- If user clicks "Use defaults" (skip), Executor is applied
- Safety reassurance line visible below presets: *"Still respects safety rules and dangerous-action safeguards, regardless of preset."*

### Post-Onboarding Access
- Agent settings page → "Persona" tab with full slider UI (always expanded, no disclosure)
- Changes take effect on next message (no restart needed)
- History of persona changes logged for debugging
- **Per-dimension reset:** each slider has a small reset icon to return to preset default
- **Future:** saved persona variants for quick switching ("Coding mode", "Planning mode")

---

## 8. Accessibility Checklist

| Requirement | Implementation |
|------------|---------------|
| Keyboard navigation | Arrow keys for slider values, Tab between controls |
| Screen reader | ARIA `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-label` |
| Selected preset | Colored border + checkmark icon (not color-only) |
| Scale markers | Visible numbered dots (1–5) below each slider |
| Helper text | Always visible below dimension name (not tooltip-only) |
| Current value | Text label next to slider showing level + description |
| Preview contrast | Comparison text meets WCAG AA (4.5:1 ratio) |
| Focus states | Visible focus ring on all interactive elements |

---

## 9. Edge Cases & Considerations

### Multiple Agents
Each agent has its own persona. When creating a second agent, the wizard offers:
- "Copy from {existing_agent}"
- "Start fresh"

### Persona Conflicts with Custom Instructions
If a user sets Start Behavior to "Start quickly" but writes "always ask before deleting files":
- **Custom instructions win** — they're more specific
- **Conflict hint:** Lightweight amber hint when obvious contradictions detected: *"This may override your Start Behavior setting above."*
- Does not block the user — just surfaces awareness

### Model-Specific Behavior
Different LLMs respond differently to the same prompt. The persona prompts are written to be model-agnostic, but:
- Future: per-model prompt variants if needed
- For now: test prompts against Claude, GPT-4, and Llama to ensure reasonable behavior

---

## 10. Success Metrics

| Metric | Target | How to measure |
|--------|--------|----------------|
| Onboarding completion rate | No drop vs. current (now 5 steps, not 6) | Funnel analytics |
| "Ask too many questions" complaints | -80% | Support tickets, feedback |
| Persona customization rate | >40% customize beyond default | DB query |
| Time on persona step | <60 seconds | Analytics |
| Fine-tune disclosure opens | >20% | Analytics |
| Preview interaction | >50% try preview | Analytics |

---

## Appendix: Boingz Post-Mortem

**What happened:** Agent "Boingz" received a valid context envelope and was given the task "Say Hello World". Instead of printing "Hello World", it asked clarifying questions: "Where should I print it?", "In what language?", "Should I create a file or print to console?"

**Root cause:** The default system prompt had no behavioral guidance. The model's default behavior (Claude in this case) is to be helpful by being thorough — which means asking before assuming.

**Fix:** The Executor persona's start_behavior=1 prompt explicitly tells the agent to execute immediately and only ask when genuinely ambiguous. "Say Hello World" is not ambiguous. Problem solved.
