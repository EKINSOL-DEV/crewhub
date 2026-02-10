# Migration Guide: Agent Persona Tuning System

**Date:** 2026-02-10  
**Schema Version:** v10  
**Tag:** `persona-system-v1`

---

## Overview

CrewHub v0.12.0 introduces **Agent Persona Tuning** — a system to customize how agents behave (autonomous vs. cautious, detailed vs. concise, systematic vs. creative). This guide helps you migrate existing agents to the new system.

---

## What Changed

### Database Schema (v10)

**New table: `personas`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key (agent key or session key) |
| `start_behavior` | INTEGER | 1–5 scale: autonomous vs. ask-first |
| `checkin_frequency` | INTEGER | 1–5 scale: never vs. every step |
| `response_detail` | INTEGER | 1–5 scale: concise vs. verbose |
| `approach_style` | INTEGER | 1–5 scale: systematic vs. creative |
| `preset_used` | TEXT | Name of preset applied (or NULL) |
| `custom_notes` | TEXT | User notes (optional) |
| `last_updated` | TIMESTAMP | Last modification time |

**Migration:** The schema migration is **automatic** when you start the backend. No manual SQL required.

---

## For Existing Agents

### Behavior After Migration

All existing agents **continue to work without changes**. The persona system is **opt-in**:

1. **If no persona is configured:** Agent uses **default behavior** (same as before).
2. **If a persona is configured:** The custom settings are injected into the system prompt.

### Default Preset: "Executor"

The system includes 3 presets:

| Preset | Icon | When to Use | Traits |
|--------|------|-------------|--------|
| **Executor** ⚡ | Default | Developers, power users, automation | Autonomous, minimal check-ins, concise, systematic |
| **Advisor** 🧠 | Optional | Non-technical users, learning | Ask-first, frequent check-ins, detailed, balanced |
| **Explorer** 🔬 | Optional | Creative projects, R&D | Autonomous, minimal check-ins, balanced, creative |

**Executor is the recommended default** for most use cases (coding agents, automation).

---

## How to Apply Personas

### Option 1: Via UI (Settings → Personas)

1. Open CrewHub at `http://localhost:8446` (or your deployed URL)
2. Click **Settings** (⚙️)
3. Navigate to **Personas** tab
4. Select an agent from the dropdown
5. Choose a preset or adjust sliders manually
6. Click **Save**

### Option 2: Via API

**Apply a preset:**

```bash
curl -X PUT http://localhost:8090/api/personas/agent:dev:main \
  -H "Content-Type: application/json" \
  -d '{
    "preset_used": "executor"
  }'
```

**Fine-tune individual traits:**

```bash
curl -X PUT http://localhost:8090/api/personas/agent:dev:main \
  -H "Content-Type: application/json" \
  -d '{
    "start_behavior": 1,
    "checkin_frequency": 4,
    "response_detail": 2,
    "approach_style": 3,
    "custom_notes": "Coding agent — should auto-execute and stay concise"
  }'
```

**Get current persona:**

```bash
curl http://localhost:8090/api/personas/agent:dev:main
```

### Option 3: During Onboarding

New users will see a **Persona Setup** step in the onboarding wizard. Existing users can skip this step — the wizard only appears on first launch.

---

## How It Works

### Prompt Injection

The persona settings are converted into a **system prompt snippet** that's injected into the agent's context. For example:

**Executor preset:**

```
You should:
- Start tasks autonomously (minimal permission-seeking)
- Check in rarely (only for critical decisions)
- Keep responses concise (skip explanations unless asked)
- Approach work systematically (methodical, not exploratory)
```

**Explorer preset:**

```
You should:
- Start tasks autonomously (minimal permission-seeking)
- Check in rarely (only for critical decisions)
- Provide balanced detail (neither too brief nor too verbose)
- Approach work creatively (try novel solutions, explore alternatives)
```

### Preview Before Saving

The UI includes a **live preview panel** showing:
- Exact system prompt snippet
- Human-readable trait descriptions
- Preset comparison

This lets you verify the settings before applying them.

---

## Recommended Configurations

### For OpenClaw Agents

| Agent Role | Recommended Preset | Why |
|------------|-------------------|-----|
| `dev` (Opus) | **Executor** | Coding tasks need autonomy + conciseness |
| `reviewer` (GPT-5.2) | **Advisor** | Code review benefits from detailed explanations |
| `flowy` (GPT-5.2) | **Explorer** | Marketing/content needs creativity |
| `creator` (Sonnet) | **Executor** | Video editing is systematic work |

### For General Use

- **Power users / Developers:** Executor (autonomous, concise)
- **Non-technical users:** Advisor (ask-first, detailed)
- **Creative projects:** Explorer (creative, experimental)

---

## Breaking Changes

**None.** The persona system is fully backward-compatible:

- Existing agents work without configuration
- No changes to existing API endpoints
- No changes to agent startup flow

---

## Testing Your Configuration

**1. Apply a preset to an agent:**

```bash
curl -X PUT http://localhost:8090/api/personas/agent:dev:main \
  -d '{"preset_used": "executor"}'
```

**2. Preview the generated prompt:**

```bash
curl http://localhost:8090/api/personas/agent:dev:main/preview
```

**3. Verify in the UI:**

- Open Settings → Personas tab
- Select `agent:dev:main`
- Confirm the sliders match the preset

---

## Troubleshooting

### "Persona not found" error

This is normal for agents without a configured persona. It means the agent will use default behavior.

### Changes not reflected in agent behavior

- **Check:** Did you save the persona? Look for a success toast in the UI.
- **Check:** Is the agent running? Persona settings are applied when the agent starts.
- **Restart the agent** to apply changes immediately.

### Sliders reset to default when I reload the page

This is expected if no persona is saved. Click **Save** to persist your changes.

---

## Rollback Instructions

If you encounter issues and need to revert:

**1. Drop the personas table:**

```bash
sqlite3 ~/.crewhub/crewhub.db "DROP TABLE IF EXISTS personas;"
```

**2. Downgrade schema version:**

```bash
sqlite3 ~/.crewhub/crewhub.db "UPDATE schema_version SET version = 9;"
```

**3. Restart the backend:**

```bash
docker compose restart backend
# OR for local dev:
pkill -f uvicorn
cd backend && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8091
```

The system will continue to work with the old schema (agents will use default behavior).

---

## Support

- **Discord:** https://discord.gg/Bfupkmvp (ask in `#help`)
- **GitHub Issues:** https://github.com/EKINSOL-DEV/crewhub/issues
- **Design Doc:** See `docs/agent-persona-tuning.md` for technical details

---

## Next Steps

After migrating:

1. **Experiment with presets** — try all 3 and see which fits your workflow
2. **Fine-tune for specific agents** — adjust individual traits for edge cases
3. **Share your configs** — post your favorite persona setups in Discord!

---

*Last updated: 2026-02-10*
