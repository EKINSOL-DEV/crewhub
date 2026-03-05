# CrewHub Features Matrix

*Last updated: 2026-02-19*
*Current version: v0.17.0*

Quick-reference table showing all CrewHub features, their status, and implementation versions.

---

## 📊 Status Legend

| Icon | Status | Meaning |
|------|--------|---------|
| ✅ | **Released** | Available in production |
| 🚧 | **In Progress** | Currently being developed |
| 📋 | **Planned** | Designed but not started |
| 🔬 | **Research** | Concept/feasibility phase |

---

## 📊 Summary by Category

| Category | Total Features | Released | In Progress | Planned | Research | Total Docs |
|----------|----------------|----------|-------------|---------|----------|------------|
| **Core** | 6 | 6 | 0 | 0 | 0 | 14 |
| **3D World** | 6 | 2 | 0 | 4 | 0 | 12 |
| **UI** | 7 | 6 | 0 | 1 | 0 | 11 |
| **Productivity** | 5 | 2 | 0 | 3 | 0 | 12 |
| **Creative** | 12 | 6 | 0 | 5 | 1 | 8 |
| **SaaS & Distribution** | 2 | 0 | 0 | 2 | 0 | 6 |
| **Meta** | 2 | 2 | 0 | 0 | 0 | 3 |
| **TOTAL** | **40** | **24** | **0** | **15** | **1** | **66** |

---

## 📈 Status Distribution

```
Released:     ████████████████████████████████████████     60% (24)
In Progress:                                                0% (0)
Planned:      ███████████████████                          38% (15)
Research:     █                                             2% (1)
```

---

## 📅 Release Timeline

| Version | Date | Features Added |
|---------|------|----------------|
| **v0.15.0** | 2026-02-13 | AI Meetings (CRUD, orchestrator, real-time SSE), Post-Meeting Workflow (6 features), Bot Pathfinding |
| **v0.14.0** | 2026-02-12 | URL Parameter Zen Mode, Project CRUD, Prop Delete, PropMaker Quality Phase 2-3 |
| **v0.13.0** | 2026-02-11 | PropCreator Showcase (211 props), Markdown Viewer Phase 1-3, Backend Watchdog |
| **v0.12.0** | 2026-02-10 | Agent Persona Tuning, Creator Zone MVP |
| **v0.11.0** | 2026-02-07 | Zen Mode Tabs, Zen Statue, Activity Panel |
| **v0.9.0** | 2026-02-06 | Task Board, TaskWall3D, Agent Bios |
| **v0.7.0** | 2026-02-05 | 4 Environments, Wandering Bots, Room Textures |
| **v0.6.0** | 2026-02-05 | Modding System (Registry<T>, blueprints) |
| **v0.5.0** | 2026-02-04 | Room Projects, HQ command center |
| **v0.4.0** | 2026-02-04 | Onboarding wizard, Settings API, Debug panel |
| **v0.3.0** | 2026-02-04 | Grid system, Room Focus Mode, Bot movement |
| **v0.2.0** | 2026-02-04 | 3D World View (toon shading, zoom levels) |
| **v0.1.0** | 2026-02-02 | Initial beta (Cards view, SSE monitoring) |

---

## 🗓️ Upcoming Roadmap

### v0.13.0
- ✅ Creator Zone MVP (PropMaker alpha - AI generation, history, model chooser UI)
- ✅ Backend watchdog & auto-restart (Docker-based, crash logging, healthcheck)
- ✅ Markdown viewer Phase 1-3 (view docs, fullscreen, TOC, editor with CodeMirror 6)
- ✅ PropCreator Design Showcase (71 props across 7 categories with tab navigation)
- ✅ PropMaker Quality Phase 1 (AI prompt rewrite, post-processor, showcase library API, flatShading materials)
- 📋 Markdown viewer Phase 4 (Polish - search, bookmarks, breadcrumbs, favorites, light theme)

### v0.14.0
- ✅ URL Parameter Zen Mode (?mode=zen replaces standalone app - simpler deployment, one codebase)
- ✅ Zen Mode Project CRUD (full project management with cascade warnings, World button → Projects)
- ✅ Zen Mode Context Bug Fix (active project context now correctly sent from Zen Mode to chat)
- ✅ Prop Delete (delete props from history with cascade warning for room placements)
- ✅ PropMaker Quality Phase 2-3 (component library PARTS_DATA, 19 unit tests, structured generation)
- ✅ PropMaker Bug Fixes (camera persistence, Refiner "Apply Changes" fix, HMR mixed exports, prop flicker)
- ✅ PropMaker Part Editor (select & transform individual sub-objects with position/rotation controls)
- ✅ PropMaker Refiner UI Cleanup (remove non-functional Material/Animation/Add Details buttons)
- ✅ Dev Error Logger (bug icon with error tracking, persistent log viewer, dev-only)

### v0.15.0 (Current)
- ✅ AI Meetings (meeting orchestrator, real-time SSE updates, post-meeting workflow with 6 features)
- ✅ Bot Pathfinding (waypoint-based navigation system for meeting gatherings)
- ✅ Post-Meeting Workflow (markdown export, action items extraction, follow-up meetings, summary, task creation, Planner API integration)
- ✅ Agent Identity Pattern (single identity, multiple surfaces - prevents personality drift)
- ✅ Agent Status Logic Improvements ('supervising' status for long-running subagent tasks)
- ✅ Spatial Awareness (waypoint pathfinding, proximity detection)

### v0.16.0
- 📋 Zen Mode panel registry (single source of truth: Ctrl+K, context menu, layouts)
- 📋 Improving and Reviewing Skills usage during onboarding

### v0.17.0
- ✅ **Streaming Chat** — Real-time token-by-token streaming for all chat UIs (AgentChatWindow, MobileAgentChat, GroupThreadChat, ZenChatPanel) via unified ChatStreamService. Backend: async generator + SSE proxy endpoint. Frontend: shared hook with progressive rendering + typing cursor.
- 🚧 Zones system (Creator Center, Academy, Game Center)
- 📋 Academy Zone (Knowledge Tree, flying books)
- 📋 Prop Library (RAG-based baseline library, semantic search, self-improving from approved props)

### v0.18.0
- 📋 HQ visual redesign (design TBD)
- Voice chat in first person mode
- Agent Teams support (Anthropic extended context)
- 📋 External 3D Generation APIs (Meshy.ai, etc. - alternative/fallback to AI code generation)
- 📋 Prop Library with Ratings (evolved from design showcase - user ratings, favorites, search, categories)
- 📋 Voice settings in onboarding (mic selection, transcription language, test recording during CrewHub setup)

### v0.19.0
- 📋 Bot navigation to props via voice commands (spatial awareness + pathfinding)

### v0.20.0
- 📋 Prop Editor (manual editing of generated props - position, rotation, scale, colors)
- 📋 Tauri Desktop App (native desktop app pointing to online API, ~10MB bundle, OS keychain, auto-updates)
- 📋 API Key Management (secure API keys with scopes, expiration, rate limiting, audit logging)

### v0.21.0
- 📋 Agent World Vision — agents can take a screenshot from their own camera POV in the 3D world, enabling situational awareness, visual task confirmation, and vision-LLM integration

### Research (no version assigned)
- 🔬 Pixel avatars alternative aesthetic
- Steam/desktop app distribution
- Multi-world architecture

---

## 🏗️ Core Platform Features

| Feature | Status | Version | Docs | Description |
|---------|--------|---------|------|-------------|
| **Agent Persona Tuning** | ✅ | persona-system-v1 | 4 | Customize agent behavior with presets or fine-tune traits |
| **Onboarding** | ✅ | v0.4.0 | 4 | Auto-discovery setup wizard for OpenClaw/Claude/Codex |
| **Settings** | ✅ | v0.4.0 | 2 | 5-tab configuration UI with backup/restore |
| **Room Projects** | ✅ | v0.5.0 | 3 | Organize agents by project, HQ command center |
| **Backend Watchdog** | ✅ | v0.13.0 | 1 | Auto-restart on crash, healthcheck, logging |
| **Agent Status Logic** | ✅ | v0.15.0 | 0 | Improved sleeping/active detection with 'supervising' status for long subagent tasks |

**Total:** 6 features • 14 docs • 6 released, 0 planned

---

## 🌍 3D World & Visualization

| Feature | Status | Version | Docs | Description |
|---------|--------|---------|------|-------------|
| **3D World Core** | ✅ | v0.3.0 | 3 | Toon-shaded campus, 3 zoom levels, animated bots |
| **Zones** | 📋 | v0.17.0 | 6 | Thematic areas: Creator Center, Academy, Game Center |
| **Academy Zone** | 📋 | v0.17.0 | 1 | Learning-focused zone with Knowledge Tree |
| **Spatial Awareness** | ✅ | v0.15.0 | 1 | Waypoint-based pathfinding for meeting gatherings, proximity detection |
| **Bot Navigation** | 📋 | v0.19.0 | 0 | Voice-controlled bot movement to props (e.g. "walk to the coffee machine") |
| **Multi-Zone System** | 📋 | v0.17.0 | 1 | Architecture for multiple themed zones |
| **Agent World Vision** | 📋 | v0.21.0 | 0 | Agents take screenshots from their bot camera POV (off-screen WebGLRenderTarget), enabling situational awareness, visual task confirmation, and vision-LLM integration |

**Total:** 7 features • 12 docs • 2 released, 5 planned

---

## 🖥️ User Interface Components

| Feature | Status | Version | Docs | Description |
|---------|--------|---------|------|-------------|
| **Bot Panel** | ✅ | v0.7.0 | 2 | Draggable info panel with tabs (Info/Chat/Files/Sessions) |
| **Grid System** | ✅ | v0.3.0 | 2 | 20×20 tile grid for room layout & bot movement |
| **Debug Panel** | ✅ | v0.4.0 | 1 | Developer tools (F2/F3/F4 test bots, camera HUD) |
| **Room Focus Mode** | ✅ | v0.3.0 | 1 | Zoom into rooms, camera fly-to, TaskWall3D |
| **Agent Chat** | ✅ | v0.7.0 | 1 | Direct messaging with agents (Planner-style windows) |
| **Zen Mode** | ✅ | v0.11.0 | 4 | Distraction-free multi-tab workspaces, Zen Statue |
| **HQ Visual Redesign** | 📋 | v0.18.0 | 0 | Visual redesign of HQ command center (design TBD) |

**Total:** 7 features • 11 docs • 6 released, 1 planned

---

## 📋 Productivity Tools

| Feature | Status | Version | Docs | Description |
|---------|--------|---------|------|-------------|
| **Markdown Viewer/Editor** | ✅ | v0.13.0 | 4 | Phase 1-3: View docs, fullscreen + TOC, Editor. Phase 4: Polish |
| **Zen Mode Panel Registry** | 📋 | v0.15.0 | 1 | Single source of truth for all panels (Ctrl+K, context menu, layouts) |
| **AI Meetings** | ✅ | v0.15.0 | 5 | Meeting orchestrator, real-time SSE, post-meeting workflow (markdown export, action items, follow-up meetings, summary, task creation, Planner sync) |
| **Zen Mode Standalone** | 📋 | v0.14.0 | 1 | Standalone app sharing code/DB/API with CrewHub (monorepo architecture) |
| **Task Management** | ✅ | v0.9.0 | 2 | Visual task board, TaskWall3D, Run with Agent |

**Total:** 5 features • 12 docs • 3 released, 2 planned

---

## 🎨 Creative & Customization

| Feature | Status | Version | Docs | Description |
|---------|--------|---------|------|-------------|
| **Creator Zone** | ✅ | v0.13.0 | 1 | PropMaker alpha - AI generation, history tab, model chooser UI, thinking process view |
| **PropMaker AI Streaming** | ✅ | v0.13.0 | 0 | Real-time streaming of AI thinking process during prop generation (SSE-based) |
| **Prop Post-Processing** | ✅ | v0.13.0 | 0 | Auto-detect and fix orientation errors (vertical spines, upright text) with SSE transparency |
| **PropCreator Design Showcase** | ✅ | v0.13.0 | 1 | 71 high-quality example props across 7 categories (General, Office, Tech, Creative, Gaming, Science, Workshop) with tab navigation |
| **Prop Delete** | 📋 | v0.14.0 | 1 | Delete props from history with cascade warning (shows rooms where prop is placed) |
| **Prop Library** | 📋 | v0.17.0 | 0 | RAG-based baseline library with 50-100+ templates, semantic search, learns from approved props |
| **External 3D APIs** | 📋 | v0.18.0 | 0 | Integration with Meshy.ai and similar services for alternative/fallback 3D generation |
| **Prop Library with Ratings** | 📋 | v0.18.0 | 0 | Evolved design showcase - categorized props (70+), user ratings, favorites, search & filter |
| **PropMaker Quality Phase 1** | ✅ | v0.13.0 | 3 | AI prompt rewrite, post-processor, showcase library API, flatShading materials, quality scoring |
| **PropMaker Quality Phase 2-3** | 📋 | v0.14.0 | 0 | Component library, multi-pass generation, iteration system, style transfer, hybrid generation |
| **Prop Editor** | 📋 | v0.20.0 | 0 | Manual editing UI for generated props (position, rotation, scale, colors, mesh tweaks) |
| **Modding System** | ✅ | v0.6.0 | 4 | Data-driven modding with Registry<T>, JSON blueprints |
| **Pixel Avatars** | 🔬 | TBD | 1 | Pixel art bots as alternative to 3D geometric style |

**Total:** 11 features • 8 docs • 5 released, 5 planned, 1 research

---

## 🚀 SaaS & Distribution

| Feature | Status | Version | Docs | Description |
|---------|--------|---------|------|-------------|
| **Tauri Desktop App** | 📋 | v0.20.0 | 6 | Native desktop app (macOS/Windows/Linux) pointing to online CrewHub API. ~10MB bundle (98% smaller than Electron), OS keychain for API keys, auto-updates, SSE/WebSocket support. ~98% frontend code reuse. |
| **API Key Management** | 📋 | v0.20.0 | 6 | Secure API key system with scopes (read/self/manage/admin), expiration (default 90d), rate limiting (slowapi), audit logging (90d retention), `ch_live_`/`ch_test_` format (128-bit entropy). Frontend UI in Settings. ~70% already implemented. |

**Total:** 2 features • 6 docs • 0 released, 2 planned

---

## 🔧 Meta & Internal

| Feature | Status | Version | Docs | Description |
|---------|--------|---------|------|-------------|
| **Demo Site** | ✅ | live @ demo.crewhub.dev | 2 | Public demo with mock API, no OpenClaw dependency |
| **Agent Identity Pattern** | ✅ | v0.15.0 | 1 | Single identity, multiple surfaces pattern (prevents personality drift) |

**Total:** 2 features • 3 docs • 2 released

---

## 🔗 Quick Links

- **Full Feature Descriptions:** See [overview.md](./overview.md)
- **Technical Analysis:** See [../analysis/](../analysis/)
- **Internal Planning:** See [../internal/](../internal/)
- **Version History:** See [releases/](../../releases/)

---

*Generated from: 7 categories × 41 features × 66 documentation files*
