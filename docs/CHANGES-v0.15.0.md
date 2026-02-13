# v0.15.0 Changes - Overnight Session

*Session: 2026-02-12 22:00 → 2026-02-13 08:00*

## 🎯 Priority Features

### Agent Identity Pattern
**Status:** ✅ Complete (23:15)

- **Added:** Identity anchor system — core "who am I" statement injected into every conversation
- **Added:** Surface adapter — per-channel format rules (WhatsApp, Discord, Slack, etc.) without personality changes
- **Added:** Identity lock — prevents onboarding wizards from overriding existing agent identities
- **Added:** `agent_surfaces` table — per-agent, per-surface format rule overrides
- **Added:** Settings → Identity tab — full UI for managing identity anchor, surface rules, and per-surface format customization
- **Added:** 9 known surfaces with default format rules (whatsapp, discord, slack, telegram, crewhub-ui, email, sms, signal, imessage)
- **Changed:** Context envelope now includes identity + surface-aware prompt alongside persona behavior guidelines
- **Changed:** Onboarding PersonaStep detects locked identities and offers connection-only mode
- **Changed:** Schema version bumped to v13 (auto-migration: 3 new columns on agent_personas + agent_surfaces table)
- **Fixed:** Persona prompt in context envelope was double-wrapping `## Behavior Guidelines` header
- **Backend:** New API endpoints: GET/PUT `/agents/{id}/identity`, GET/PUT/DELETE `/agents/{id}/surfaces/{surface}`, GET `/personas/surfaces`
- **Frontend:** New `IdentityTab` component, updated `personaApi.ts` with identity/surface helpers, updated `personaTypes.ts`
- **Tests:** 29 new tests covering identity blocks, surface rules, API endpoints, and cross-concern integration
- **Blog:** `docs/features/core/agent-persona-tuning/agent-identity-pattern-blog.md`
- **Commits:** feat: Agent Identity Pattern - single identity, multiple surfaces

### Agent Status Logic Improvements (v2)
**Status:** ✅ Complete (02:40)

- **Added:** New "Supervising" status (👁️) — agents with active subagents show as supervising instead of idle/sleeping
- **Added:** `hasActiveSubagents()` utility for detecting parent-child session relationships
- **Added:** `getActiveSubagentLabel()` — shows which subagent task is being supervised
- **Added:** Purple glow effect for supervising bots in 3D world (`BotStatusGlow.tsx`)
- **Added:** Supervising personality messages for all agent types (`personality.ts`)
- **Added:** Supervising filter in Cards view, stats header, and sort ordering
- **Changed:** `getSessionStatus()` now accepts optional `allSessions` parameter for subagent detection
- **Changed:** `calculateStatus()` in `useAgentsRegistry.ts` checks `childSessions` activity
- **Changed:** `getAccurateBotStatus()` in `World3DView.tsx` checks for active subagents
- **Changed:** `shouldBeInParkingLane()` — supervising sessions never get parked
- **Changed:** `getCurrentActivity()` shows "Supervising: [task name]" when delegating
- **Changed:** `BotStatus` type extended across all 3D components (Bot3D, BotBody, BotFace, BotStatusGlow, BotInfoPanel, RoomInfoTab, RoomInfoPanel, AgentTopBar)
- **Changed:** `CrewStatus` type in CrewBar extended with "supervising"
- **Changed:** `CrewAvatar` shows purple status dot and 👁️ emoji for supervising agents
- **Added:** 4 new tests for supervising status (parent with active subagent, stale subagent, sibling isolation, cron supervision)
- **Tests:** All 151 tests pass
- **Files:** 17 files changed
- **Blog:** `docs/features/core/agent-status-logic-blog.md` (updated)

### Spatial Awareness Research
**Status:** Scheduled (04:00)

- Research: [to be filled by agent]
- Prototype: [to be filled by agent]
- Documentation: [to be filled by agent]
- Commits: [to be filled by agent]

---

## 📋 Secondary Features

### Grid Boundary Fine-Tuning
**Status:** Deferred (if time permits)

### Zen Mode Panel Registry
**Status:** Deferred (if time permits)

### Frontend Watchdog
**Status:** Deferred (if time permits)

---

## 📊 Summary

**Total commits:** [to be calculated]
**Total files changed:** [to be calculated]
**Lines added:** [to be calculated]
**Lines removed:** [to be calculated]

**Session duration:** [actual duration]
**Features completed:** [count]
**Blog posts written:** 1

---

*This document is updated by overnight agents as work progresses.*
