# Overnight Plan — 28 Feb → 1 Mar 2026
**Scope:** Native Claude Code Support (Phase 1 + 2) + Onboarding Redesign
**Window:** 23:00 → 08:00 (9 uur, 9 slots van 1u)

---

## Scope Summary

### Backend (Phase 1 — Read-only monitoring)
- `claude_transcript_parser.py` — JSONL parser (~150 lines, code al in plan)
- `claude_session_watcher.py` — triple-layer file watching (~250 lines, code al in plan)
- `claude_code.py` rewrite — van stub naar volledige implementatie (~400 lines)
- Docker volume mount fix in `docker-compose.yml` + `docker-compose.demo.yml`

### Backend (Phase 2 — Spawning & chat)
- `claude_process_manager.py` — spawn/manage claude CLI processes (~200 lines)
- `chat.py` update — route naar ClaudeCodeConnection wanneer van toepassing
- DB migration: `claude_processes` tabel

### Frontend — Onboarding Redesign
**Kerndoel:** volledige "Claude Code only" flow, zonder OpenClaw dependency.

Nieuwe wizard stap 2 (na Welcome): **"How do you run AI agents?"**
- 🔶 **OpenClaw** — Personal AI platform (existing flow)
- 🟣 **Claude Code CLI** — Anthropic's coding agent (new flow)
- ✅ **Both** — mix van beide

Als "Claude Code only":
- Sla OpenClaw URL/token stappen volledig over
- Toon detectie-kaart: "claude CLI: ✅ gevonden / ❌ niet gevonden + install instructie"
- Sla wizard op met `connection_mode: "claude_code"`
- `onboardingTypes.ts`: voeg `ConnectionMode` + `WizardStep` 7 toe (of hergebruik stap 3)

Als "OpenClaw only": bestaande flow, geen wijziging.
Als "Both": beide flows doorlopen.

### Frontend — Visuele onderscheiding sessies
- Badge per sessie: "OpenClaw" (oranje) vs "Claude Code" (paars) in de cards view + 3D world
- `SessionInfo.source` field al aanwezig → alleen UI badge toevoegen

### Documentation
- README: sectie "Using without OpenClaw (Claude Code only)"
- Docker volume mount instructie
- Onboarding screenshots updaten

---

## Hourly Schedule

### 23:00 – 00:00 | Slot 1: Backend Foundation
**Taak:** `claude_transcript_parser.py` + unit tests
- Kopieer code uit plan §2.1 naar bestand
- Schrijf tests: alle record types (assistant/user/system/progress)
- Verifieer `--continue` vs `--resume` flag via `claude --help`
- Commit: `feat: add ClaudeTranscriptParser with JSONL record parsing`

### 00:00 – 01:00 | Slot 2: Session Watcher
**Taak:** `claude_session_watcher.py`
- Implementeer ClaudeSessionWatcher (code uit plan §2.2)
- Triple-layer watching: watchdog + stat() + asyncio
- Session discovery via directory scanning
- Heuristic timers: permission (7s) + text-idle (5s)
- Commit: `feat: add ClaudeSessionWatcher with triple-layer file watching`

### 01:00 – 02:00 | Slot 3: ClaudeCodeConnection rewrite
**Taak:** `claude_code.py` volledige implementatie
- `connect()` — detecteer claude CLI + start watcher
- `get_sessions()` — scan project dirs, return SessionInfo list
- `get_session_history()` — parse JSONL → HistoryMessage list
- `get_status()` — connection health
- SSE callbacks: `_on_activity_change`, `_on_events`, `_on_sessions_changed`
- Graceful fail als claude CLI niet aanwezig
- Commit: `feat: rewrite ClaudeCodeConnection from stub to full implementation`

### 02:00 – 03:00 | Slot 4: Integration + Docker fix
**Taak:** Integratie in ConnectionManager + Docker volume mounts
- Registreer ClaudeCodeConnection in startup/connection factory
- `docker-compose.yml`: voeg `~/.claude:/root/.claude:ro` volume toe
- `docker-compose.demo.yml`: zelfde
- Test: start backend, open claude sessie, verifieer dat sessie verschijnt
- Commit: `feat: integrate ClaudeCodeConnection + fix Docker volume mount for ~/.claude`

### 03:00 – 04:00 | Slot 5: Onboarding — Connection Mode Picker
**Taak:** Nieuwe wizard stap — "How do you run AI agents?"
- `onboardingTypes.ts`: voeg `ConnectionMode = 'openclaw' | 'claude_code' | 'both'` toe
- Voeg stap toe na Welcome (nieuwe stap 2, schuif rest op)
- Design: 3 grote keuzekaarten met iconen, korte beschrijving per optie
- State: `connectionMode` in wizard
- Commit: `feat: add connection mode picker step to onboarding wizard`

### 04:00 – 05:00 | Slot 6: Onboarding — Claude Code flow
**Taak:** Volledige "Claude Code only" ervaring
- Als `connectionMode === 'claude_code'`: sla OpenClaw stappen over
- Toon detectie-kaart: call `/api/connections/claude-code/detect` endpoint
  - ✅ Groen: "Claude Code CLI gevonden, klaar om te connecten"
  - ❌ Rood: "Niet gevonden — installeer via `npm install -g @anthropic-ai/claude-code`"
- Voeg `/api/connections/claude-code/detect` backend endpoint toe
- Commit: `feat: complete Claude Code only onboarding flow with auto-detection`

### 05:00 – 06:00 | Slot 7: Frontend — Source badges + visuele polish
**Taak:** Sessie-source badges in UI
- Cards view: klein badge "Claude Code" (paars) of "OpenClaw" (oranje) in sessiekaart
- 3D world: bot label of kamer-badge tonen op basis van source
- `SessionInfo.source` al beschikbaar in frontend types
- Commit: `feat: add source badges (OpenClaw/Claude Code) to session cards and 3D world`

### 06:00 – 07:00 | Slot 8: Phase 2 — Process Manager
**Taak:** `claude_process_manager.py` + chat route
- Implementeer ClaudeProcessManager (code uit plan §3.1)
- `chat.py`: detecteer ClaudeCodeConnection sessies, route naar process manager
- DB migration v7: `claude_processes` tabel
- Verifieer `--resume` flag werkt correct
- Commit: `feat: add ClaudeProcessManager and wire Phase 2 chat routing`

### 07:00 – 08:00 | Slot 9: Tests, docs, version bump, merge
**Taak:** Afronden
- Backend: integratie tests voor ClaudeCodeConnection
- README: sectie "Using without OpenClaw" + Docker volume mount docs
- `version.json` + `package.json`: bump naar v0.19.0
- Git tag `v0.19.0`
- Merge `develop` → `main`
- Commit: `chore: release v0.19.0 — native Claude Code support`

---

## Key Files

| File | Actie |
|------|-------|
| `backend/app/services/connections/claude_transcript_parser.py` | Nieuw |
| `backend/app/services/connections/claude_session_watcher.py` | Nieuw |
| `backend/app/services/connections/claude_code.py` | Rewrite |
| `backend/app/services/connections/claude_process_manager.py` | Nieuw (Phase 2) |
| `backend/app/routes/chat.py` | Update (Phase 2) |
| `backend/app/db/migrations/` | v7 migration (Phase 2) |
| `docker-compose.yml` | Volume mount fix |
| `docker-compose.demo.yml` | Volume mount fix |
| `frontend/src/components/onboarding/onboardingTypes.ts` | ConnectionMode type |
| `frontend/src/components/onboarding/OnboardingWizard.tsx` | Connection mode picker stap |
| `frontend/src/components/onboarding/steps/StepConnectionMode.tsx` | Nieuw |
| `frontend/src/components/onboarding/steps/StepClaudeDetect.tsx` | Nieuw |
| `README.md` | Nieuwe sectie |

---

## Success Criteria

- [ ] CrewHub openen, geen OpenClaw nodig, Claude Code sessies verschijnen automatisch
- [ ] Onboarding wizard biedt "Claude Code only" keuze
- [ ] Docker gebruikers: volume mount werkt, sessies zichtbaar
- [ ] OpenClaw sessies blijven werken naast Claude Code sessies
- [ ] Source badges zichtbaar in UI
- [ ] CI passeert (lint + tests)
- [ ] v0.19.0 getagd en op main

---

## Reference
- Plan: `docs/standalone-claude-code-plan.md` (Synology)
- Pixel Agents reference: https://github.com/pablodelucca/pixel-agents
