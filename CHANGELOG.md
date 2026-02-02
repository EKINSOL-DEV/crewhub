# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

### Known Limitations

- Agent creation/deletion via UI not yet implemented
- Some advanced Gateway features pending
- Mobile layout could be improved

---

## Future Plans

- [ ] Agent creation and management UI
- [ ] Session grouping and filtering
- [ ] Historical statistics and graphs
- [ ] Mobile-optimized layout
- [ ] Keyboard shortcuts
- [ ] Notification system

[0.1.0-beta]: https://github.com/ekinsolbot/crewhub/releases/tag/v0.1.0-beta
