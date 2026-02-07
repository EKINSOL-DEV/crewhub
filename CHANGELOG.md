# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.11.2] - 2026-02-07

### 🌟 New Features
- **Zen Mode Tabs** — Multi-tab workspaces with state persistence, keyboard shortcuts (Ctrl+Alt+T/W/R)
- **Zen Statue (ZenBeeldje)** — 3D meditation figure in rooms with projects, always-on floating animation with yellow glow
- **Task detail pane** — Click on task in Tasks panel to see details at bottom (like Kanban)
- **Activity panel rewrite** — Shows real agent activity with Current/History tabs, same info as 3D bubbles
- **Kanban in all menus** — Added to context menu and Ctrl+K command palette
- **Live Demo banner dismiss** — ❌ button to hide the demo banner, persisted in localStorage

### 🔧 Fixes
- **Split Vertical/Horizontal swap** — Fixed in context menu, command palette, and panel header buttons
- **Panel type dropdown z-index** — Menu no longer appears behind session items
- **Context menu height** — Increased to show all 8 panel types without scrolling
- **New tagline** — "Getting real work done doesn't have to be boring."

### 📦 Other
- Version display updated to v0.11.2 in UI
- UUID fallback for http:// contexts (crypto.randomUUID not available)

## [0.11.0] - 2026-02-07

### 🌟 New Features
- **Zen Mode** — Full-screen tmux-style terminal interface with split panels, themes, and keyboard navigation
- **Zen Panels** — Chat, Sessions, Activity, Rooms, Tasks, Kanban, Cron, Logs
- **Zen Themes** — Multiple color schemes including Gruvbox, Monokai, Nord, and more
- **Project-focused Zen** — Enter Zen Mode filtered to a specific project via ZenBeeldje

## [0.10.0] - 2026-02-06

### 🌟 New Features
- **Onboarding wizard** — 5-step guided setup for new users
- **Auto-discovery** — Automatic detection of OpenClaw, Claude Code, and Codex
- **Settings API** — Database-driven settings with backup/restore
- **Bot jitter fixes** — 8 root causes identified and fixed
- **Debug panel** — 🧪 Test bots spawning for development
- **Settings refactor** — 5 tabs: Look & Feel, Rooms, Behavior, Data, Advanced

## [0.9.1] - 2026-02-06

### 🌟 New Features
- **Embedded TaskBoard in 3D whiteboard** — Full interactive TaskBoard component rendered on room whiteboards (replaces sticky notes)
- **Focus Board button** — "🔍 Focus Board" button zooms camera directly to the TaskBoard for easy task management
- **Camera Debug HUD** — Press F2 to toggle debug overlay showing camera position and target coordinates

### 🔧 Fixes
- **UI interaction blocking** — DragDropContext with isInteractingWithUI prevents camera controls from interfering with UI elements
- **Desk rotation fix** — All desks now rotate 180° to face into the room (agents face the room, not walls)
- **Whiteboard prop removed from Dev Room** — Cleaned up duplicate/conflicting whiteboard prop

## [0.9.0] - 2026-02-06

### 🌟 New Features
- **Task Board in HQ** — Full Kanban board with columns: To Do, In Progress, Review, Done, Blocked
- **Run vs Spawn actions** — Task cards now offer "Run with Agent" (existing session) and "Spawn Agent" (new subagent) options
- **Active Tasks Ticker** — Collapsible ticker showing currently running tasks across all agents
- **Agent Bios** — Bio field for agents with AI-powered bio generation
- **TaskWall3D for room whiteboards** — 3D task boards rendered on room walls
- **Comprehensive mock data** — Demo mode now includes realistic tasks and projects

### 🔧 Fixes
- **React 19 + Radix Dialog fix** — Migrated all dialogs to native `<dialog>` element to resolve infinite loop crashes
- **Subagent detection** — Completed subagents now detected using updatedAt timestamp
- **Friendly names in dropdowns** — Assignee dropdowns show display names instead of raw session keys
- **Temporary subagent filtering** — Assign To dropdown no longer shows temporary subagents

### 📦 Other
- Renamed Break Room to "Another AI took my job zone"
- Python 3.9 compatibility (Optional[str] instead of str | None)
- SSE performance improvements with queueMicrotask

## [0.8.0] - 2026-02-06

### 🌟 New Features
- **Demo Mode** — Standalone frontend with mock API for trying CrewHub without backend setup
- **Mobile warning screen** — Desktop-only message for small screens
- **Move to room button** — BotInfoPanel now has quick room reassignment
- **Fullscreen mode** — Native browser Fullscreen API integration
- **Onboarding wizard** — Guided setup flow for new users with no-connection gating

### 🔧 Fixes
- **Bot expressions** — All bots now have happy/neutral expressions (no more frowns)
- **Demo banner** — Centered top banner with GitHub and website links

### 📦 Other
- Light mode as default theme
- Desert as default environment in demo mode
- Minimal seed data (2 rooms + 3 rules)
- Public launch preparation with security review

## v0.7.1 (2026-02-05)

### Added
- **Website screenshots** — Full screenshot showcase on crewhub.dev with 17 new images across features, hero, and gallery sections
- **Desert as default environment** — Desert theme is now the default 3D world environment
- **Light room textures** — 4 new floor styles (marble, light-wood, light-tiles, sand) and 3 new wall styles (light, pastel-band, glass) for Scandinavian/modern office vibes
- **Edit Room in focus panel** — Edit room name, icon, color, floor and wall style directly from the room focus view
- **Room nameplate redesign** — Subtle fixed-orientation nameplates above room entrances
- **Wandering bot collision** — Sleeping agents now avoid walking through rooms
- **Drag handle improvements** — Delayed unhover prevents handle from disappearing while reaching for it

### Fixed
- Edit Room dialog left-side clipping on scrollable area
- Dialog click propagation through Radix portals
- Agent Top Bar z-index layering with Settings overlay
- Chat windows opening for non-fixed agents
- Double render on load (fingerprint-based dedup)
- Nameplate size consistency across zoom levels

## [0.7.0] - 2026-02-05

### 🌟 New Features
- **Room floor & wall textures** — 6 floor styles + 4 wall styles with procedural GLSL shaders, per-room selectable
- **Desert environment** — New environment theme with sand dunes, cacti, rocks, and tumbleweeds
- **Agent bios** — Bio field for agents with pre-filled descriptions for fixed crew (schema v8)
- **Agent Top Bar** — Boss button (center) + pinned agent (left) + agent picker dropdown (right)
- **Wandering bots** — Sleeping agents walk around campus between rooms
- **Activity bubbles** — Show humanized task summaries from session labels above bots
- **Boss HUD button** — Quick access to main agent, opens chat on click
- **Room nameplates v2** — Floating HTML billboards above rooms with hover fade
- **Drag & drop in 3D** — Drag bots between rooms with status indicator and Escape to cancel
- **Working bots carry laptops** — Animated laptop with typing micro-pauses
- **Bot walk animation** — Foot stepping + arm swinging during movement
- **Debug prop hover labels** — F2 debug mode shows prop registry ID on hover
- **Comprehensive test suite** — 138 backend + 133 frontend + 7 E2E tests
- **Agent onboarding masterplan** — 1300+ line design document for agent self-onboarding

### 🔧 Fixes
- **Double render on load** — Fingerprint-based deduplication prevents visible flash on page load
- **Chat windows for non-fixed bots** — Chat only opens for fixed agents (agent:*:main)
- **Camera initial position** — Correct position on mount without animation
- **Bot fixed Y height** — BOT_FIXED_Y = 0.35 constant, never influenced by geometry
- **Wandering bounds** — Campus-only with 3-unit margin and clampToCampus() safety net
- **Room click crash** — React hooks violation in RoomNameplate.tsx fixed
- **Wall-grid alignment** — WALL_THICKNESS = 0.3 matching RoomWalls.tsx
- **Camera zoom-2 angle** — No 180° rotation on room focus
- **Agent picker scrollbar** — Dropdown centering and scroll fixes

### ⚡ Performance
- **Environment optimization** — Instanced meshes, distance culling, larger tiles
- **Double render prevention** — Fingerprint dedup in useSessionsStream, RoomsContext, useAgentsRegistry, useProjects

### 📦 Other
- Database schema v8 (floor_style, wall_style, agent bio)
- Bot scale increased 30%
- 3D room nameplates redesigned from Text3D to floating HTML billboards

## [0.6.0] - 2026-02-05

### 🌟 New Features
- **Modding foundation: Registry\<T\> pattern** — Generic registry with namespaced IDs (`namespace:id`), batch registration, and Zod validation
- **Data-driven props** — Props defined as JSON data instead of hardcoded components, with PropRegistry split into 5 focused modules
- **Blueprint system** — Room blueprints as JSON with import/export API and validation
- **Data-driven environments** — Environment configurations loaded from data files
- **Blueprint import/export API** — Full API for sharing and validating blueprints
- **Starlight documentation site** — Dedicated docs site for CrewHub modding and architecture

### ⚡ Performance
- **Centralized SSE** — Single Server-Sent Events connection shared across components
- **RoomsContext** — Shared room state to prevent redundant fetches
- **AbortController** — Proper request cancellation on unmount

### 📦 Other
- Batch registration support for registries
- Zod schema validation for all registry entries
- PropRegistry refactored from monolith into 5 modules

## [0.3.0] - 2026-02-04

### 🌟 New Features
- **Grid System (Phase 1)** — 20×20 grid per room with data model, room blueprints, and A* pathfinding (`e83e1a0`)
- **Grid-based prop rendering (Phase 2)** — Rooms built from blueprints with grid-based prop renderer and bot pathfinding (`7d144b1`)
- **Grid debug overlay** — Visual grid with color-coded cells, toggle in Settings (`feb5a30`)
- **Simplified bot movement** — Natural random walk with obstacle avoidance, replacing A* (`b151d00`)
- **Camera orbit in bot focus** — Orbital rotation when zoomed into a bot (zoom level 3) (`d8177ea`)
- **Planner-style chat windows** — Individual draggable/resizable windows with left-side minimize bar (`9446872`)
- **Settings consolidation** — Centralized session config with unified thresholds and Settings UI (`949aeb9`)
- **Live room refresh** — SSE broadcast on room CRUD + immediate refetch, new rooms appear without page reload (`9bb4db4`)

### 🐛 Bug Fixes
- **Bot pathfinding coordinate alignment** — Fixed worldToGrid off-by-one, start cell snapping, parking fallback (`9f210c0`)
- **Composite props & stale paths** — Fixed desk+monitor overwriting each other, safe pathfinding fallback, stale path clearing (`d80aa53`)
- **Props floating in air** — Correct Y-positioning per mount type (floor/wall), wall placement, boundary clamping (`27e6fb3`, `7651840`)
- **Routing rules duplication** — Use fixed IDs instead of uuid4, cleaned 110 duplicate rules on backend restart (`651b777`)
- **Display names for fixed agents** — Flowy now shows 'Flowy' instead of 'main' (`95d3f43`)
- **Room blueprints audit** — Comprehensive fix for all 8 room blueprints (`5b90e8c`)
- **Smooth bot movement** — Path simplification, look-ahead rotation, constant speed (`d0354ca`)

### 📦 Other
- Updated GridRoomRenderer JSDoc to reflect room-local Y positioning (`b29db23`)
- Bumped version to 0.3.0-dev for grid system development cycle (`acc34dd`)

## [0.2.0] - 2026-02-03

### Added
- 3D Bot Playground improvements
- Room routing rules
- Session management enhancements

## [0.1.0-beta] - 2026-02-02

### 🎉 Initial Beta Release

First public beta release of CrewHub - a real-time dashboard for monitoring AI agent sessions.

### Added

- **Real-time Session Monitoring**
  - Live session updates via Server-Sent Events (SSE)
  - Automatic reconnection on connection loss
  - Session activity indicators

- **Dashboard Views**
  - Active Minions view with room organization
  - Playground view with drag-and-drop layout
  - Dark/Light mode toggle

- **Room Organization**
  - Predefined rooms: Dev Room, Creative Corner, Playground, Ops Center, Launch Bay
  - Parking lane for unassigned agents
  - Persistent room assignments

- **Session Management**
  - Custom display names for sessions
  - Session statistics (tokens, costs, runtime)
  - Kill session functionality

- **Log Viewer**
  - Full chat history display
  - Search and filter by role
  - Export to JSON
  - Auto-scroll with live updates

- **Stats Header**
  - Total active sessions count
  - Total tokens used
  - Total cost tracking

- **Gateway Integration**
  - OpenClaw Gateway WebSocket connection
  - Real-time session state sync
  - Gateway status indicator

- **Docker Support**
  - Docker Compose setup for easy deployment
  - Health checks for both services
  - Development mode with hot-reload

### Technical Details

- **Backend**: Python 3.11+ with FastAPI
- **Frontend**: React 18 with TypeScript, Vite, and Tailwind CSS
- **Real-time**: Server-Sent Events for live updates

[0.11.2]: https://github.com/EKINSOL-DEV/crewhub/releases/tag/v0.11.2
[0.11.0]: https://github.com/EKINSOL-DEV/crewhub/releases/tag/v0.11.0
[0.10.0]: https://github.com/EKINSOL-DEV/crewhub/releases/tag/v0.10.0
[0.9.1]: https://github.com/EKINSOL-DEV/crewhub/releases/tag/v0.9.1
[0.9.0]: https://github.com/EKINSOL-DEV/crewhub/releases/tag/v0.9.0
[0.8.0]: https://github.com/EKINSOL-DEV/crewhub/releases/tag/v0.8.0
[0.7.0]: https://github.com/EKINSOL-DEV/crewhub/releases/tag/v0.7.0
[0.6.0]: https://github.com/EKINSOL-DEV/crewhub/releases/tag/v0.6.0
[0.3.0]: https://github.com/EKINSOL-DEV/crewhub/releases/tag/v0.3.0
[0.2.0]: https://github.com/EKINSOL-DEV/crewhub/releases/tag/v0.2.0
[0.1.0-beta]: https://github.com/EKINSOL-DEV/crewhub/releases/tag/v0.1.0-beta
