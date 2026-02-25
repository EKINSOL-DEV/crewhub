# Core Platform Features

Fundamental features that power the CrewHub platform.

---

## Agent Persona Tuning
**Status:** ✅ Released in **persona-system-v1** (v0.12.0)
**Description:** Customize agent behavior with presets (Executor, Advisor, Explorer) or fine-tune individual traits (start behavior, check-in frequency, response detail, approach style). Includes migration guide for existing agents.

**Docs:**
- `core/agent-persona-tuning/agent-persona-tuning.md` — System design (425 lines)
- `core/agent-persona-tuning/agent-persona-tuning-REVIEW.md` — GPT-5.2 review (B+ rating)
- `core/agent-persona-tuning/persona-tuning-plan-SUMMARY.md` — Implementation summary
- `core/agent-persona-tuning/MIGRATION-persona-system.md` — Migration guide

---

## Onboarding
**Status:** ✅ Released in **v0.4.0**
**Description:** Initial setup wizard with auto-discovery of OpenClaw, Claude Code, and Codex installations. Configures gateway connection, agent workspaces, and persona preferences. Zero-config experience for supported platforms.

**Docs:**
- `core/onboarding/agent-onboarding-masterplan.md` — Full design (JTBD for 4 personas)
- `core/onboarding/agent-onboarding-review-1.md` — Opus review (iteration 1)
- `core/onboarding/agent-onboarding-review-2.md` — GPT-5.2 review (iteration 2)
- `core/onboarding/onboarding-analysis.md` — Requirements analysis

---

## Settings
**Status:** ✅ Released in **v0.4.0**
**Description:** App-wide configuration UI with 5 tabs: Look & Feel, Rooms, Behavior, Data, Advanced. Includes backup/restore system, persistent state in localStorage, and database-driven settings API.

**Docs:**
- `core/settings/settings-tabs-proposal-opus.md` — Opus design proposal
- `core/settings/settings-tabs-proposal-gpt5.md` — GPT-5.2 alternative proposal

---

## Room Projects
**Status:** ✅ Released in **v0.5.0**
**Description:** Organize agents by project. HQ room acts as command center with visibility into all projects. Project-specific rooms show only relevant agents. Visual indicators (nameplate badges, floor tints, tab dots) show project membership.

**Docs:**
- `core/room-projects/room-projects-masterplan.md` — Full design document
- `core/room-projects/room-projects-design.md` — Implementation spec
- `core/room-projects/room-projects-ux-review.md` — UX review

---

*Last updated: 2026-02-10 13:50 (auto-generated from matrix.md)*
