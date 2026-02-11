# Agent Persona Tuning System

*How agents adapt their behavior to user preferences.*

## Overview

The Persona system lets users control **how** an agent behaves — not what it can do, but its communication style and autonomy level. Each agent can have a persona configured via presets or custom slider values.

## Dimensions (1-5 scale)

| Dimension | Low (1) | High (5) |
|-----------|---------|----------|
| **Start Behavior** | Execute immediately, no questions | Always confirm plan before acting |
| **Check-in Frequency** | Frequent progress updates | Fully autonomous, report final result only |
| **Response Detail** | Extremely concise | Detailed with context and alternatives |
| **Approach Style** | Proven/conventional methods | Creative/experimental approaches |

## Presets

### ⚡ Executor (Default, Recommended)
- **Best for:** Developers, power users, automation-heavy workflows
- Start Behavior: 1 (act immediately), Check-in: 4, Detail: 2, Approach: 3
- *"Give me a task, I'll get it done."*

### 🧠 Advisor
- **Best for:** Non-technical users, learning scenarios, sensitive operations
- Start Behavior: 4, Check-in: 2, Detail: 4, Approach: 2
- *"Let me think through this with you."*

### 🔬 Explorer
- **Best for:** Creative projects, R&D, brainstorming, hobby projects
- Start Behavior: 2, Check-in: 4, Detail: 3, Approach: 5
- *"Let's try something interesting."*

## How It Works

1. **Configuration** — User selects a preset or adjusts sliders in Settings → Personas tab (or during onboarding)
2. **Storage** — Persona saved in `agent_personas` table (SQLite)
3. **Prompt Generation** — Each dimension value maps to a specific prompt fragment via `build_persona_prompt()`
4. **Context Injection** — When building the context envelope for an agent, the persona prompt is attached as `_persona_prompt` and rendered as a "Behavior Guidelines" section in the agent's system context

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agents/{agent_id}/persona` | Get persona (returns defaults if none set) |
| PUT | `/api/agents/{agent_id}/persona` | Create/update persona (upsert) |
| GET | `/api/personas/presets` | List all available presets |
| POST | `/api/personas/preview` | Preview prompt output for a configuration |

## Frontend Components

- **PersonasTab** — Full settings tab with preset selection and slider customization
- **PersonaStep** — Onboarding wizard step for initial persona selection
- **PersonaPreview** — Live preview showing how the agent would respond
- **PresetCard** — Preset selection card with icon, tagline, description

## When to Use Which Preset

| Scenario | Recommended Preset |
|----------|-------------------|
| CI/CD automation, DevOps | ⚡ Executor |
| Code review, pair programming | 🧠 Advisor |
| Content creation, brainstorming | 🔬 Explorer |
| New user, unfamiliar with agents | 🧠 Advisor |
| Experienced user, wants speed | ⚡ Executor |

## Custom Instructions

Each persona supports a free-text `custom_instructions` field (max 2000 chars) that gets appended to the generated prompt. Use this for agent-specific behavioral notes that don't fit the slider model.

## Migration Notes

- **Existing agents** without a persona get Executor defaults when queried (no migration needed)
- Persona is stored separately from agent config — no breaking changes to existing data
- The `agent_personas` table is created automatically on schema migration

## Troubleshooting

- **Agent not following persona?** Check that the context envelope includes `_persona_prompt`. Verify with `GET /api/agents/{id}/persona`.
- **Sliders reset on page reload?** Ensure the PUT call succeeds (check network tab for 200 response).
- **Preview doesn't match actual behavior?** Preview responses are pre-computed approximations. Actual LLM behavior varies.
