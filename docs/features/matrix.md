# CrewHub Features Matrix

*Last updated: 2026-02-10*  
*Current version: v0.12.0*

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
| **Core** | 5 | 4 | 0 | 1 | 0 | 14 |
| **3D World** | 6 | 1 | 1 | 3 | 1 | 12 |
| **UI** | 7 | 6 | 0 | 1 | 0 | 11 |
| **Productivity** | 4 | 1 | 0 | 3 | 0 | 11 |
| **Creative** | 3 | 1 | 1 | 0 | 1 | 6 |
| **Meta** | 2 | 1 | 0 | 1 | 0 | 3 |
| **TOTAL** | **27** | **14** | **2** | **9** | **2** | **57** |

---

## 📈 Status Distribution

```
Released:     █████████████████████████                    52% (14)
In Progress:  ███                                           7% (2)
Planned:      ████████████████                             33% (9)
Research:     ███                                           7% (2)
```

---

## 📅 Release Timeline

| Version | Date | Features Added |
|---------|------|----------------|
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

### v0.13.0 (Next)
- 📋 Markdown viewer Phase 1 (agent files + fullscreen)
- 📋 Markdown editor (CodeMirror 6, auto-save)
- 🚧 Creator Zone MVP (prop maker, AI generation, live preview) ← Built overnight
- ✅ Prop drag & drop fixes (edge cases, camera orbit disabled) ← Built overnight

### v0.14.0
- 📋 Zen Mode panel registry (single source of truth: Ctrl+K, context menu, layouts)
- 📋 Backend watchdog & auto-restart (Docker-based, crash logging, healthcheck)
- 📋 Agent Identity Pattern (single identity, multiple surfaces - prevent personality drift)
- 🔬 Spatial awareness (vision, proximity, pathfinding)
- 📋 Stand-up meetings Phase 1 (UX + backend) ← Moved from v0.13.0
- 📋 Improving and Reviewing Skills usage during onboarding

### v0.15.0
- 📋 HQ visual redesign (design TBD)

### v0.16.0
- 🚧 Zones system (Creator Center, Academy, Game Center)
- 📋 Academy Zone (Knowledge Tree, flying books)

### v0.17.0
- Voice chat in first person mode
- Agent Teams support (Anthropic extended context)

### v0.18.0
- 📋 Bot navigation to props via voice commands (spatial awareness + pathfinding)

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
| **Backend Watchdog** | 📋 | v0.14.0 | 1 | Auto-restart on crash, healthcheck, logging |

**Total:** 5 features • 14 docs • 4 released, 1 planned

---

## 🌍 3D World & Visualization

| Feature | Status | Version | Docs | Description |
|---------|--------|---------|------|-------------|
| **3D World Core** | ✅ | v0.3.0 | 3 | Toon-shaded campus, 3 zoom levels, animated bots |
| **Zones** | 🚧 | v0.16.0 | 6 | Thematic areas: Creator Center, Academy, Game Center |
| **Academy Zone** | 📋 | v0.16.0 | 1 | Learning-focused zone with Knowledge Tree |
| **Spatial Awareness** | 🔬 | v0.14.0 | 1 | Agent vision, proximity, pathfinding |
| **Bot Navigation** | 📋 | v0.18.0 | 0 | Voice-controlled bot movement to props (e.g. "walk to the coffee machine") |
| **Multi-Zone System** | 📋 | v0.16.0 | 1 | Architecture for multiple themed zones |

**Total:** 6 features • 12 docs • 1 released, 1 in progress, 3 planned, 1 research

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
| **HQ Visual Redesign** | 📋 | v0.15.0 | 0 | Visual redesign of HQ command center (design TBD) |

**Total:** 7 features • 11 docs • 6 released, 1 planned

---

## 📋 Productivity Tools

| Feature | Status | Version | Docs | Description |
|---------|--------|---------|------|-------------|
| **Markdown Viewer/Editor** | 📋 | v0.13.0 | 4 | Phase 1: View docs, fullscreen + TOC. Phase 2: Edit with CodeMirror 6 |
| **Zen Mode Panel Registry** | 📋 | v0.14.0 | 1 | Single source of truth for all panels (Ctrl+K, context menu, layouts) |
| **Stand-Up Meetings** | 📋 | v0.14.0 | 4 | Automated meetings in 3D (bots walk, take turns, summaries) |
| **Task Management** | ✅ | v0.9.0 | 2 | Visual task board, TaskWall3D, Run with Agent |

**Total:** 4 features • 11 docs • 1 released, 3 planned

---

## 🎨 Creative & Customization

| Feature | Status | Version | Docs | Description |
|---------|--------|---------|------|-------------|
| **Creator Zone** | 🚧 | v0.13.0 | 1 | In-app prop maker, AI generation, live preview (built overnight) |
| **Modding System** | ✅ | v0.6.0 | 4 | Data-driven modding with Registry<T>, JSON blueprints |
| **Pixel Avatars** | 🔬 | TBD | 1 | Pixel art bots as alternative to 3D geometric style |

**Total:** 3 features • 6 docs • 1 released, 1 in progress, 1 research

---

## 🔧 Meta & Internal

| Feature | Status | Version | Docs | Description |
|---------|--------|---------|------|-------------|
| **Demo Site** | ✅ | live @ demo.crewhub.dev | 2 | Public demo with mock API, no OpenClaw dependency |
| **Agent Identity Pattern** | 📋 | v0.14.0 | 1 | Single identity, multiple surfaces pattern (prevents personality drift) |

**Total:** 2 features • 3 docs • 1 released, 1 planned

---

## 🔗 Quick Links

- **Full Feature Descriptions:** See [overview.md](./overview.md)
- **Technical Analysis:** See [../analysis/](../analysis/)
- **Internal Planning:** See [../internal/](../internal/)
- **Version History:** See [releases/](../../releases/)

---

*Generated from: 6 categories × 27 features × 57 documentation files*
