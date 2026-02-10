# CrewHub Features Overview

*Last updated: 2026-02-10*  
*Current version: v0.12.0*

This document provides a complete overview of all CrewHub features, organized by category. Each feature includes its implementation status and the version where it was introduced or is planned.

---

## 📊 Feature Status

| Status | Meaning |
|--------|---------|
| ✅ **Released** | Fully implemented and available in production |
| 🚧 **In Progress** | Currently being developed |
| 📋 **Planned** | Designed but not yet started |
| 🔬 **Research** | Concept phase, exploring feasibility |

---

## 🏗️ Core Platform Features

Fundamental features that power the CrewHub platform.

### Agent Persona Tuning
**Status:** ✅ Released in **persona-system-v1** (v0.12.0)  
**Description:** Customize agent behavior with presets (Executor, Advisor, Explorer) or fine-tune individual traits (start behavior, check-in frequency, response detail, approach style). Includes migration guide for existing agents.

**Docs:**
- `agent-persona-tuning.md` — System design (425 lines)
- `agent-persona-tuning-REVIEW.md` — GPT-5.2 review (B+ rating)
- `persona-tuning-plan-SUMMARY.md` — Implementation summary
- `MIGRATION-persona-system.md` — Migration guide

---

### Onboarding
**Status:** ✅ Released in **v0.4.0**  
**Description:** Initial setup wizard with auto-discovery of OpenClaw, Claude Code, and Codex installations. Configures gateway connection, agent workspaces, and persona preferences. Zero-config experience for supported platforms.

**Docs:**
- `agent-onboarding-masterplan.md` — Full design (JTBD for 4 personas)
- `agent-onboarding-review-1.md` — Opus review (iteration 1)
- `agent-onboarding-review-2.md` — GPT-5.2 review (iteration 2)
- `onboarding-analysis.md` — Requirements analysis

---

### Settings
**Status:** ✅ Released in **v0.4.0**  
**Description:** App-wide configuration UI with 5 tabs: Look & Feel, Rooms, Behavior, Data, Advanced. Includes backup/restore system, persistent state in localStorage, and database-driven settings API.

**Docs:**
- `settings-tabs-proposal-opus.md` — Opus design proposal
- `settings-tabs-proposal-gpt5.md` — GPT-5.2 alternative proposal

---

### Room Projects
**Status:** ✅ Released in **v0.5.0**  
**Description:** Organize agents by project. HQ room acts as command center with visibility into all projects. Project-specific rooms show only relevant agents. Visual indicators (nameplate badges, floor tints, tab dots) show project membership.

**Docs:**
- `room-projects-masterplan.md` — Full design document
- `room-projects-design.md` — Implementation spec
- `room-projects-ux-review.md` — UX review

---

## 🌍 3D World & Visualization

Features for the immersive 3D agent world.

### 3D World Core
**Status:** ✅ Released in **v0.3.0**  
**Description:** Toon-shaded 3D campus with 20×20 grid, animated bots, 3 zoom levels (Overview → Room focus → Bot focus), draggable agents, and activity bubbles. Uses React Three Fiber, CameraControls, and instanced meshes for performance.

**Docs:**
- `3d-world-design.md` — Original vision document
- `3d-world-architecture-analysis.md` — Technical deep-dive
- `3d-world-parity-plan.md` — Feature parity checklist

---

### Zones
**Status:** 🚧 In Progress (v0.15.0)  
**Description:** Thematic campus areas with specialized props, environments, and activities. Three zones planned: Creator Center (film studio), Academy (Hogwarts meets MIT), Game Center (arcade meets indie studio). Each zone includes unique props, interactive elements, and Easter eggs.

**Docs:**
- `zones/README.md` — Zone system overview
- `zones/creator-center-vision.md` — Creator Center design (5 rooms)
- `zones/academy-vision.md` — Academy design (6 rooms)
- `zones/game-center-vision.md` — Game Center design (6 rooms)
- `zones/creator/mvp-summary.md` — Creator Zone MVP
- `zones/creator/prop-maker-guide.md` — Prop generation guide

---

### Academy Zone
**Status:** 📋 Planned (v0.15.0)  
**Description:** Learning-focused zone with Great Library, Research Lab, Lecture Hall, Sandbox, Study Pods, and Map Room. Features: Knowledge Tree (grows with agent learning), flying books, owl mascot, scholar ranking system.

**Docs:**
- `academy/context-envelopes.md` — Context management design

---

### Spatial Awareness
**Status:** 🔬 Research (v0.14.0)  
**Description:** Agent awareness of their surroundings in the 3D world. Includes vision system (what agents "see"), proximity detection, pathfinding around obstacles, and context-aware behavior (agents mention nearby bots in conversation).

**Docs:**
- `spatial-awareness/spatial-awareness-design.md` — Vision, proximity, pathfinding

---

### Multi-Zone System
**Status:** 📋 Planned (v0.15.0)  
**Description:** Architecture for supporting multiple themed zones on the campus. Includes zone switcher UI, persistent navigation, and zone-specific environments/props.

**Docs:**
- `multi-zone/multi-zone-implementation.md` — Implementation notes

---

## 🖥️ User Interface Components

UI elements and interaction patterns.

### Bot Panel
**Status:** ✅ Released in **v0.7.0**  
**Description:** Draggable info panel for inspecting agents. Includes tabs: Info (bio, status, stats), Chat (Planner-style messaging), Files (workspace browser), and Sessions (history).

**Docs:**
- `bot-panel/bot-panel-tabs-design.md` — Tab design specification
- `bot-panel/bot-reference-design.jpg` — Visual mockup

---

### Grid System
**Status:** ✅ Released in **v0.3.0**  
**Description:** 20×20 tile grid system for room layout. Simplified bot movement (snap to grid), drag-and-drop between rooms, and collision detection. Replaced complex pathfinding with straightforward tile-based logic.

**Docs:**
- `grid-system/grid-system-design.md` — Grid architecture
- `grid-system/grid-system-review-gpt5.md` — GPT-5.2 implementation review

---

### Debug Panel
**Status:** ✅ Released in **v0.4.0**  
**Description:** Developer tools for testing and debugging. Features: F2/F3/F4 test bot spawning, camera position HUD, lighting controls, environment switcher, and performance metrics.

**Docs:**
- `debug-panel/debug-panel-design.md` — Debug UI specification

---

### Room Focus Mode
**Status:** ✅ Released in **v0.3.0**  
**Description:** Zoom into a room for closer inspection. Camera flies to room, disables orbit during drag, and shows TaskWall3D when room has a project. Escape or back button returns to overview.

**Docs:**
- `room-focus/room-focus-mode-design.md` — Focus mode interaction design

---

### Agent Chat
**Status:** ✅ Released in **v0.7.0**  
**Description:** Direct messaging interface with agents in the 3D world. Planner-style chat windows (draggable, resizable, minimizable), markdown support, and only available for fixed agents (agent:*:main).

**Docs:**
- `agent-chat/agent-chat-design.md` — Chat UI specification

---

### Zen Mode
**Status:** ✅ Released in **v0.11.0**  
**Description:** Distraction-free focus mode with multi-tab workspaces, Zen Statue interaction (click statue in project rooms), persistent state (localStorage), and Activity Panel showing active tasks with icons.

**Docs:**
- `zen-mode/zen-mode-design.md` — Full design document
- `zen-mode/zen-mode-masterplan.md` — Implementation masterplan
- `zen-mode/zen-mode-review.md` — Design review
- `zen-mode/zen-mode-keyboard-shortcuts.md` — Keyboard shortcuts spec

---

## 📋 Productivity Tools

Features that help teams work more effectively.

### Markdown Viewer/Editor
**Status:** 📋 Planned (v0.13.0)  
**Description:** View and edit markdown files from agent workspaces and project directories. Phase 1: Files tab in bot panel, fullscreen viewer with TOC. Phase 2: Live editing with CodeMirror 6, auto-save, side-by-side view.

**Docs:**
- `markdown-viewer/ux-design.md` — UX wireframes and flows
- `markdown-viewer/api-spec.md` — REST API specification
- `markdown-viewer/component-spec.md` — React component specs
- `markdown-viewer/implementation-plan.md` — 4-phase plan (16-23h total)

---

### Stand-Up Meetings
**Status:** 📋 Planned (v0.13.0)  
**Description:** Automated stand-up meetings in the 3D world. Bots walk to meeting room, form circle, take turns speaking, and generate meeting summaries. Integrates with project task boards.

**Docs:**
- `meetings/standup-ux-flow.md` — UX flow with ASCII diagrams
- `meetings/standup-system-design.md` — Backend architecture
- `meetings/standup-api-spec.md` — REST API endpoints
- `meetings/standup-implementation-plan.md` — Phase-based plan

---

### Task Management
**Status:** ✅ Released in **v0.9.0**  
**Description:** Visual task board with drag-and-drop Kanban columns. TaskWall3D embeds full board in 3D rooms. "Run with Agent" spawns subagent for task execution. HQ command center shows all tasks across projects.

**Docs:**
- `task-management/task-management-design.md` — Original design
- `task-management/task-management-implementation.md` — Implementation notes

---

## 🎨 Creative & Customization

Tools for creating and modding CrewHub.

### Creator Zone
**Status:** 🚧 In Progress (v0.12.0+)  
**Description:** In-app prop maker with AI-powered generation. PropMakerRoom with PropMakerMachine, chat-based prop requests ("make me a coffee mug"), live preview, and save to registry. Supports ultra-focused subagent prompts.

**Docs:**
- `creator-zone/creator-zone-prompt.md` — AI generation prompt template

---

### Modding System
**Status:** ✅ Released in **v0.6.0**  
**Description:** Data-driven modding with Registry<T> pattern, namespaced IDs (`core:desk`, `desert:cactus`), JSON blueprints (rooms, props, environments), Zod validation, and import/export API.

**Docs:**
- `modding/3d-modding-masterplan.md` — 5-phase modding vision
- `modding/3d-modding-strategy-review.md` — Strategy analysis
- `modding/modding-opus-review.md` — Opus technical review
- `modding/modding-phase1-review.md` — Phase 1 implementation review

---

### Pixel Avatars
**Status:** 🔬 Research  
**Description:** Pixel art bot designs as alternative to 3D geometric bots. Includes sprite animation, emotes, and retro aesthetic. Research phase exploring art style and technical feasibility.

**Docs:**
- `pixel-avatars/pixel-avatar-masterplan.md` — Concept and art direction

---

## 🔧 Meta & Internal

Deployment, demos, and platform-level features.

### Demo Site
**Status:** ✅ Released (demo.crewhub.dev)  
**Description:** Public demo with mock API layer, simulated agents/rooms, and no OpenClaw dependency. Uses Docker with demo.yml config, deployed via Coolify.

**Docs:**
- `demo-site/demo-site-plan.md` — Mock API design and deployment
- `demo-site/demo-site-review.md` — Implementation review

---

## 📅 Version History

| Version | Release Date | Major Features |
|---------|-------------|----------------|
| **v0.13.0** | TBD | Zones system, Markdown viewer Phase 1 |
| **v0.12.0** | 2026-02-10 | Agent persona tuning, Creator Zone MVP |
| **v0.11.0** | 2026-02-07 | Zen Mode Tabs, Zen Statue, Activity Panel |
| **v0.9.0** | 2026-02-06 | Task Board, TaskWall3D, Run vs Spawn, Agent Bios |
| **v0.7.0** | 2026-02-05 | Environments (4), Agent Bios, Wandering Bots, Room Textures |
| **v0.6.0** | 2026-02-05 | Modding foundation (Registry<T>, blueprints, SSE refactor) |
| **v0.5.0** | 2026-02-04 | Project Rooms, HQ command center, Visual indicators |
| **v0.4.0** | 2026-02-04 | Onboarding wizard, Auto-discovery, Settings API, Debug panel |
| **v0.3.0** | 2026-02-04 | Grid system, Bot movement, Drag & drop, Camera improvements |
| **v0.2.0** | 2026-02-04 | 3D World View (toon shading, 3 zoom levels, activity bubbles) |
| **v0.1.0** | 2026-02-02 | Initial beta release (Cards view, SSE, basic monitoring) |

---

## 🗺️ Roadmap Priorities

**v0.13.0 (Next):**
- Markdown viewer Phase 1 (agent file viewing + fullscreen)
- Stand-up meetings Phase 1 (UX + backend)
- Markdown editor (CodeMirror 6, auto-save)

**v0.14.0:**
- Spatial awareness (vision, proximity, pathfinding)

**v0.15.0:**
- Zones system (Creator Center, Academy, Game Center)
- Academy Zone (Knowledge Tree, flying books)

**v0.16.0+:**
- Voice chat in first person mode
- Agent Teams support (Anthropic extended context)

**Research (no version assigned):**
- Pixel avatars alternative aesthetic
- Steam/desktop app distribution
- Multi-world architecture (multiple campuses)

---

## 📖 Documentation Structure

This `features/` directory is organized into 6 categories:

- **core/** — Platform fundamentals (persona tuning, onboarding, settings, room projects)
- **3d-world/** — 3D visualization (world, zones, academy, spatial awareness, multi-zone)
- **ui/** — Interface components (bot panel, grid, debug, room focus, agent chat, zen mode)
- **productivity/** — Productivity tools (markdown viewer, meetings, task management)
- **creative/** — Customization (creator zone, modding, pixel avatars)
- **meta/** — Platform (demo site, deployment, research)

Each feature folder contains design docs, implementation plans, and reviews. For implementation details, see the individual markdown files.

---

*For technical architecture and analysis, see `../analysis/`*  
*For internal planning documents, see `../internal/`*
