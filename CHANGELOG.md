# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.3.0]: https://github.com/ekinsolbot/crewhub/releases/tag/v0.3.0
[0.2.0]: https://github.com/ekinsolbot/crewhub/releases/tag/v0.2.0
[0.1.0-beta]: https://github.com/ekinsolbot/crewhub/releases/tag/v0.1.0-beta
