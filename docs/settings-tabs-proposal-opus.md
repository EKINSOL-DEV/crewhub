# Settings Panel Tab Structure — Proposal

> **Author:** Opus (subagent)  
> **Date:** 2026-02-04  
> **Status:** Proposal — no code changes  
> **File:** `frontend/src/components/sessions/SettingsPanel.tsx` (1609 lines)

---

## Current State

The settings panel is a full-screen overlay with a 3-column grid layout containing 11 sections. It works, but:

- **Cognitive overload** — users see everything at once, even settings they rarely touch
- **Uneven columns** — the right column has 7 sections vs 2 in the left, 2 in the center
- **Mixed audiences** — casual users see developer toggles alongside theme pickers
- **No navigation** — you have to scroll the right column to find what you need

---

## Proposed Tab Structure

### 4 tabs — clean, balanced, purposeful

| # | Tab Name | Icon | Sections Included |
|---|----------|------|-------------------|
| 1 | **Look & Feel** | `Palette` | Appearance, World Environment, Display, Fun & Playfulness |
| 2 | **Rooms** | `LayoutGrid` | Room Management, Routing Rules |
| 3 | **Behavior** | `SlidersHorizontal` | Updates, Playground, Thresholds & Timing |
| 4 | **System** | `Wrench` | Data & Backup, Developer |

---

## Detailed Breakdown

### Tab 1: Look & Feel
**Sections:**
- 🎨 Appearance (theme mode, accent colors)
- 🌍 World Environment (3 environment styles)
- 📺 Display (animations toggle, achievement badges)
- 🎉 Fun & Playfulness (easter eggs, sound effects)

**Reasoning:**  
All four sections answer the same question: *"How does it look and feel?"* Theme, world style, visual toggles, and playfulness are all aesthetic/experiential. Users who want to customize the vibe land here once and tweak everything in one place.

**Layout suggestion:** 2-column within this tab. Left: Appearance + World Environment (visual/heavy). Right: Display + Fun (toggle-light).

**Merge consideration:** Display and Fun & Playfulness could merge into a single "Visual Effects" section since they're both just toggle switches (animations, badges, easter eggs, sounds). That would leave 3 clean sections in this tab. However, keeping them separate is also fine — the sections are small.

---

### Tab 2: Rooms
**Sections:**
- 🏢 Room Management (CRUD rooms with icons, colors, reordering)
- 🔀 Routing Rules (session→room mapping rules with priorities)

**Reasoning:**  
These two sections are tightly coupled — you create rooms, then define rules that route sessions into them. They already sit together in the current center column. This is the "spatial organization" tab: *"Where do sessions go?"*

This tab will feel like a mini-admin panel for workspace topology. It's the most complex tab (dialogs for create/edit/delete), so isolating it keeps the other tabs clean.

**Layout suggestion:** Full-width within this tab. Room list on top, routing rules below. Or side-by-side if screen width allows.

---

### Tab 3: Behavior
**Sections:**
- 🔄 Updates (auto-refresh toggle, refresh interval)
- 🎮 Playground (parking idle threshold, movement speed)
- ⏱️ Thresholds & Timing (all ConfigField groups: status thresholds, bot thresholds, activity detection, parking limits, bot movement speeds, polling intervals)

**Reasoning:**  
These sections all control *how the system behaves over time* — polling, timing, speed, thresholds. They're the "knobs and dials" that tune runtime behavior. A user adjusting how quickly sessions go idle will also want to tweak bot movement speed and refresh rates.

**Rename suggestion:** Consider renaming "Playground" to something like "3D World" or "World Behavior" since "Playground" is ambiguous (could mean a code playground). The current content (parking threshold + movement speed) is really about the 3D world simulation.

**Layout suggestion:** Updates is small (2 controls) — keep it as a compact section at top. Playground below it. Thresholds & Timing stays collapsible and takes the rest.

---

### Tab 4: System
**Sections:**
- 💾 Data & Backup (export, import, snapshots, backup history)
- 🔧 Developer (grid overlay, lighting editor, debug bots)

**Reasoning:**  
These are maintenance/power-user sections that most users touch rarely. Backups are an admin concern; developer toggles are for debugging. Grouping them prevents them from cluttering the everyday tabs.

**Layout suggestion:** Data & Backup on top (more commonly used for exports). Developer section below.

---

## Tab Order Rationale

1. **Look & Feel** — First because it's what new users want first (personalization). Also the most frequently accessed — people change themes and colors often.
2. **Rooms** — Second because room setup is the core organizational feature. Accessed during initial setup and when workflows change.
3. **Behavior** — Third because timing/thresholds are "set and forget" for most users. Power users who need fine-tuning know where to find it.
4. **System** — Last because backups and debug toggles are least frequently accessed. Putting them last follows the convention of "advanced" being at the end.

---

## Sections to Rename / Merge / Split

| Current | Proposed Change | Why |
|---------|----------------|-----|
| 🎮 Playground | Rename → **🎮 World Simulation** or **🌐 3D Behavior** | "Playground" is vague. The contents (parking threshold, movement speed) are about the 3D simulation. |
| 📺 Display + 🎉 Fun & Playfulness | **Consider merging** → **✨ Visual Effects** | Both are small (2 toggles each). Together they form a cohesive "effects and extras" section. Keeps tab 1 from having too many small sections. |
| 🔄 Updates | Keep as-is, or rename → **🔄 Refresh** | "Updates" could be confused with software updates. "Refresh" is more precise. |
| ⏱️ Thresholds & Timing | Keep as-is | Already well-named. The internal sub-sections (Session Status, 3D Bot Status, Activity Detection, Parking, Bot Movement, Polling) are excellent. |

No sections need splitting — they're all well-scoped.

---

## Icon Suggestions (Lucide)

| Tab | Primary Icon | Alternative |
|-----|-------------|-------------|
| Look & Feel | `Palette` | `Paintbrush`, `Sparkles` |
| Rooms | `LayoutGrid` | `DoorOpen`, `Building2` |
| Behavior | `SlidersHorizontal` | `Settings2`, `Gauge` |
| System | `Wrench` | `HardDrive`, `Shield` |

---

## Implementation Notes (for when coding starts)

1. **Tab component:** Use a horizontal tab bar below the header. Consider `@radix-ui/react-tabs` (already likely available via shadcn).
2. **URL persistence:** Consider storing the active tab in URL hash (`#rooms`) or localStorage so users return to their last tab.
3. **Badge on tabs:** Show counts on tab badges where useful — e.g., "Rooms (5)" or a dot on System when there are overrides.
4. **Layout per tab:** Each tab can have its own column layout. Rooms benefits from full-width; Look & Feel works well as 2-column.
5. **Keep dialogs at top level:** Room/rule create/delete dialogs should remain outside the tab content (they already are).
6. **Transition:** A subtle fade or slide animation between tabs would match the existing polish level.
7. **Keyboard:** Arrow keys to switch tabs, plus the existing Escape to close.

---

## Summary

```
┌─────────────────────────────────────────────────────┐
│  ⚙️ Crew Settings                              [✕]  │
│                                                      │
│  🎨 Look & Feel  │  🏢 Rooms  │  ⚙ Behavior  │  🔧 System  │
│  ═══════════════                                     │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │ 🎨 Appearance    │  │ 📺 Display       │          │
│  │  Theme mode      │  │  Animations      │          │
│  │  Accent color    │  │  Badges          │          │
│  ├──────────────────┤  ├──────────────────┤          │
│  │ 🌍 World Env     │  │ 🎉 Fun          │          │
│  │  Grass/Island/   │  │  Easter eggs     │          │
│  │  Sky Platform    │  │  Sounds          │          │
│  └──────────────────┘  └──────────────────┘          │
│                                                      │
└─────────────────────────────────────────────────────┘
```

4 tabs. Clean groupings. Most-used first. No orphan sections.
