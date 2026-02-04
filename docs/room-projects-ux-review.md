# UX Review — Room Projects & Interaction Design (CrewHub 3D World)

*Date: 2026-02-04*

## TL;DR (one-liners)
- Replace the 🔍 button with **direct room interaction**: hover = highlight, click = select.
- Use a **single, predictable HUD pattern**: *anchored popover for quick actions + right sidebar for details*.
- Make “project rooms” legible at a glance via a **consistent project badge + color stripe on the room nameplate** (not just glow).
- Keep rooms **single-project** (at a time); allow one project to span **multiple rooms**.

---

## 1) Interaction patterns (3D UI best practices)

### 1.1 Hover states in 3D — what works / what doesn’t

**What works**
- **Subtle, bounded highlight** that reads as “this is interactive” without changing the scene too much:
  - brighten/boost emissive on the room’s floor plane;
  - a thin outline or rim-light on the room boundary;
  - slight scale-up of the room label/nameplate (2D overlay).
- **Stable hover feedback** (no flicker) by using:
  - raycast against simplified colliders (room bounding box), not complex meshes;
  - hysteresis/debounce (e.g. 50–100ms) when the pointer crosses edges.
- **Cursor change** on hover (pointer/hand) and a lightweight tooltip: “Click for room menu”.

**What doesn’t**
- Large glows/bloom on hover: in isometric views, bloom often “bleeds” into adjacent rooms and destroys depth cues.
- Hover effects that alter geometry silhouettes significantly (big scale changes) → causes depth popping and makes click precision worse.
- Hover-only affordances as the *only* signifier: touch devices and trackpads don’t have true hover.

**Recommendation (pick one)**
- Implement hover as **(A) floor brighten + (B) thin outline + (C) label micro-animate**.
  - Keep it consistent across all rooms.
  - Ensure highlight is **bounded to the room footprint**.

### 1.2 Click targets in an isometric view (precision issues)

Isometric 3D has classic UX problems:
- occlusion (bots/props overlap),
- small targets at overview zoom,
- “wrong depth” clicking (you hit a bot when you intended the room).

**Best practice approach**
- Treat a room as a **large click target** using a dedicated invisible collider (e.g. a box/plane).
- Apply **click priority rules**:
  1) if user clicks a bot *and bots are intended selectable at this zoom* → select bot;
  2) else select room.
- Add **forgiveness**:
  - use a slightly expanded collider around the room footprint;
  - accept click even when pointer is near the boundary (within a few px/units).
- Provide a clear “selected state” distinct from hover.

**Recommendation (pick one)**
- In **Overview**: clicking anywhere inside a room collider selects the room (bots do not steal clicks).
- In **Room Focus** (zoomed in): bots become selectable; room click still available via floor/collider.

### 1.3 HUD panel positioning (avoid occlusion, stay contextual)

You need *context* (which room) and *space* (readable UI) without covering the 3D content.

**Patterns to consider**
- **Floating near room (popover)**: feels contextual, but can occlude and jitter with camera motion.
- **Slide-in right sidebar**: stable, readable, scalable content; less contextual but excellent for management.
- **Bottom panel**: good on mobile/tablet; can block the scene on desktop.

**Recommendation (pick one)**
Use a **two-step HUD**:
1) **Anchored “Room Popover”** (small, near the room label or centroid) on click — quick actions + key stats.
2) **Right Sidebar “Room Inspector”** when user clicks “Details” (or on double-click room) — full management.

This gives: contextual immediacy *and* a place for deeper content without clutter.

---

## 2) Room HUD design (click panel)

### 2.1 Compact vs detailed

**Recommendation (pick one)**
- Default to **compact** (popover) with a clear path to **expand** (sidebar).

Rationale: overview interactions should be fast; detailed panels should not fight the 3D view.

### 2.2 Proposed layout (specific)

#### A) Room Popover (compact)
**Trigger:** single click on room.

**Placement:** anchored to the room nameplate (2D overlay) with a small leader line to the room.
- If off-screen/near edge → clamp to viewport and keep leader line.

**Content (at-a-glance)**
- Header: `Room Name` + status dot (Idle / Active / Blocked)
- Row 1: `Project` pill (assigned project name or “General”)
- Row 2: quick stats chips:
  - `Agents: N` (active/idle split)
  - `Queue: N`
  - `Last activity: Xm`
- Actions:
  - Primary: **Assign / Change Project**
  - Secondary: **Open Details**
  - Tertiary: **Focus Room** (camera fly-to)

#### B) Room Inspector (right sidebar)
**Trigger:** “Open Details” or double-click room.

**Sections**
1) **Project**
   - Project picker (search + recent)
   - “Create project…” inline
   - Optional: project description link
2) **Room stats**
   - Agents (list with status)
   - Activity timeline (last 5 events)
   - Cost/tokens (if available)
3) **Routing & behavior**
   - Toggle: “Prefer project agents here” (if you implement auto-routing)
   - Capacity/limits (max agents)
4) **Danger zone**
   - “Unassign project” (with confirmation if agents are active)

**Why sidebar**: stable reading, supports complex project management, doesn’t jitter with camera.

### 2.3 What to show at a glance vs expand

**At a glance (popover)**
- project assignment state
- agent count + activity
- 1–2 obvious actions

**On expand (sidebar)**
- full agent list
- assignment rules and implications
- history/logs/costs

---

## 3) Project UX flow

### 3.1 Assigning a project to a room

**Recommendation (pick one)**
Use a **project picker** in the popover and sidebar:
- Click **Assign Project** → dropdown opens with:
  - search field (typeahead),
  - “Recent projects”,
  - “Create new project…” at bottom.
- Selecting a project applies immediately.
- Creating a project is inline (name required; optional color).

**Microcopy suggestions**
- Unassigned state label: **General Room** (avoid “None”).
- Assignment button: **Assign project** / **Change project**.

### 3.2 Visualizing “this room is working on Project X”

There are two distinct concepts:
1) **Assigned to project** (configuration)
2) **Currently doing project work** (activity)

**Recommendation (pick one)**
- Treat *assignment* as the primary truth.
- Indicate *activity* as a secondary overlay (small “Active” pulse or dot), not a different color system.

### 3.3 Should project assignment affect agent routing automatically?

If assignment changes behavior, users need predictability.

**Recommendation (pick one)**
- Implement **soft routing** (preference, not hard constraints):
  - rooms assigned to Project X are preferred destinations for agents tagged Project X;
  - manual overrides always allowed;
  - show a short explanation in the sidebar: “Agents for Project X will prefer this room.”

Avoid hard locks initially (e.g., preventing non-project agents), because it creates surprising failures.

### 3.4 Can one project span multiple rooms?

**Recommendation (pick one)**
- Yes: **one project can be assigned to multiple rooms**.
- But **a room can only have one project assignment at a time** (see edge cases).

Reason: multi-room projects are common; multi-project rooms create ambiguity (“what is this room for?”) and complicate routing.

---

## 4) Visual language for project rooms

### 4.1 What to use (color, banners, nameplates)

**Goal:** readable at overview zoom; doesn’t rely on bloom; consistent across the scene.

**Recommendation (pick one)**
Use **room nameplate changes** as the primary indicator:
- Add a **project badge**: `[●] Project Name` (small colored dot + name)
- Add a **thin color stripe** on the left edge of the nameplate (project color)
- Add a small icon (optional): `📁` for project rooms

Then supplement with subtle 3D cues:
- a **thin colored ring** or border around the room footprint (low intensity, no bloom)

### 4.2 Readability at overview zoom

Rules of thumb:
- project name in overview should be short; if too long → truncate + tooltip.
- prefer **color + icon + text** redundancy:
  - color alone fails for color-blind users and low saturation scenes.

### 4.3 Distinguish general vs project rooms

**Recommendation (pick one)**
- General rooms show a neutral nameplate: `Room Name` + small tag **GENERAL**.
- Project rooms show: `Room Name` + `[● Project X]` badge.

This makes “assigned vs unassigned” obvious without opening anything.

---

## 5) Edge cases (and how the UX should behave)

### 5.1 Room has a project but no agents

**Behavior**
- Still show project badge (it’s configuration).
- Popover shows: `Agents: 0` and a suggestion link: “Add agents” / “Route agents here” (if supported).

### 5.2 Multiple projects in one room?

**Recommendation (pick one)**
- **Do not allow** multiple projects per room (v1).
- If needed later, implement as a structured concept (e.g., “primary project” + “secondary tags”), not ad-hoc multi-assign.

### 5.3 Changing project while agents are working

This can cause confusion (“did their task change?”).

**Recommendation (pick one)**
- Allow change, but show a **confirm dialog** if room has active agents:
  - Title: “Change room project?”
  - Body: “Agents will continue current tasks. New tasks will be routed using the new project.”
  - Options: Cancel / Change Project

Also log the change in the Room Inspector timeline.

### 5.4 Mobile/tablet interaction (touch)

No hover; precision is worse.

**Recommendation (pick one)**
- Use **tap-to-highlight** (first tap selects/highlights), second tap opens popover.
- Use a **bottom sheet** instead of a small popover on touch:
  - same content as popover,
  - swipe up for details (replaces right sidebar).

---

## 6) Final recommendations (single decisions)

1) **Replace 🔍 with direct interaction**: hover highlight + click select.
2) **Hover effect**: bounded floor brighten + thin outline + label micro-animate (no heavy bloom).
3) **Click behavior**: Overview prioritizes room selection; Room Focus enables bot selection.
4) **HUD**: click opens small anchored popover; “Details” opens right sidebar.
5) **Project assignment UI**: typeahead picker + recent + inline create.
6) **Project-room visualization**: nameplate badge (text + colored dot) + thin stripe; optional subtle footprint ring.
7) **Project model**: room has **one project**; project can span **many rooms**.
8) **Routing**: soft preference routing (explainable, override-friendly).
9) **Touch**: tap-to-select, bottom sheet for actions/details.

---

## Implementation notes (non-prescriptive, but helpful)

- Use a dedicated collider mesh per room for stable pointer events.
- Add hover debounce/hysteresis to prevent flicker along room boundaries.
- Maintain explicit UI states: `hoveredRoomId`, `selectedRoomId`, `inspectedRoomId`.
- Ensure keyboard support: `Esc` closes popover → closes sidebar → clears selection.
