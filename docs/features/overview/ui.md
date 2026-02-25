# User Interface Components

UI elements and interaction patterns.

---

## Bot Panel
**Status:** ✅ Released in **v0.7.0**
**Description:** Draggable info panel for inspecting agents. Includes tabs: Info (bio, status, stats), Chat (Planner-style messaging), Files (workspace browser), and Sessions (history).

**Docs:**
- `ui/bot-panel/bot-panel-tabs-design.md` — Tab design specification
- `ui/bot-panel/bot-reference-design.jpg` — Visual mockup

---

## Grid System
**Status:** ✅ Released in **v0.3.0**
**Description:** 20×20 tile grid system for room layout. Simplified bot movement (snap to grid), drag-and-drop between rooms, and collision detection. Replaced complex pathfinding with straightforward tile-based logic.

**Docs:**
- `ui/grid-system/grid-system-design.md` — Grid architecture
- `ui/grid-system/grid-system-review-gpt5.md` — GPT-5.2 implementation review

---

## Debug Panel
**Status:** ✅ Released in **v0.4.0**
**Description:** Developer tools for testing and debugging. Features: F2/F3/F4 test bot spawning, camera position HUD, lighting controls, environment switcher, and performance metrics.

**Docs:**
- `ui/debug-panel/debug-panel-design.md` — Debug UI specification

---

## Room Focus Mode
**Status:** ✅ Released in **v0.3.0**
**Description:** Zoom into a room for closer inspection. Camera flies to room, disables orbit during drag, and shows TaskWall3D when room has a project. Escape or back button returns to overview.

**Docs:**
- `ui/room-focus/room-focus-mode-design.md` — Focus mode interaction design

---

## Agent Chat
**Status:** ✅ Released in **v0.7.0**
**Description:** Direct messaging interface with agents in the 3D world. Planner-style chat windows (draggable, resizable, minimizable), markdown support, and only available for fixed agents (agent:*:main).

**Docs:**
- `ui/agent-chat/agent-chat-design.md` — Chat UI specification

---

## Zen Mode
**Status:** ✅ Released in **v0.11.0**
**Description:** Distraction-free focus mode with multi-tab workspaces, Zen Statue interaction (click statue in project rooms), persistent state (localStorage), and Activity Panel showing active tasks with icons.

**Docs:**
- `ui/zen-mode/zen-mode-design.md` — Full design document
- `ui/zen-mode/zen-mode-masterplan.md` — Implementation masterplan
- `ui/zen-mode/zen-mode-review.md` — Design review
- `ui/zen-mode/zen-mode-keyboard-shortcuts.md` — Keyboard shortcuts spec

---

## HQ Visual Redesign
**Status:** 📋 Planned (v0.15.0)
**Description:** Visual redesign of the HQ command center room. Design to be determined — potential directions include: elevated platform, holographic displays, mission control aesthetic, wall-mounted dashboards, or central strategy table.

**Docs:**
- Design TBD

---

*Last updated: 2026-02-10 13:50 (auto-generated from matrix.md)*
