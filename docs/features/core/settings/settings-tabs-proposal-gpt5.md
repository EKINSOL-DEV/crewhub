# CrewHub Settings Panel — Tab Structure Proposal (GPT-5)

> Goal: reduce cognitive load in `SettingsPanel.tsx` by grouping the current 11 sections into a small set of predictable tabs, with progressive disclosure for advanced/rarely-used options.

## 1) Proposed tab structure (tab → current sections)

### 1. **🎨 Look & Feel**
- **🎨 Appearance** (theme mode + accent colors)
- **📺 Display** (animations, badges, view toggles)
- **🎉 Fun & Playfulness** (easter eggs, sound)

### 2. **🌍 World & Playground**
- **🌍 World Environment** (grass/island/platform)
- **🎮 Playground** (2D playground settings)

### 3. **🏠 Rooms**
- **🏢 Room Management** (CRUD rooms: name/icon/color/sort)
- **🔀 Routing Rules** (auto-assignment rules)

### 4. **⏱️ Behavior & Timing**
- **🔄 Updates** (auto-refresh + refresh interval)
- **⏱️ Thresholds & Timing** (idle/sleep/parking/token/polling thresholds)

### 5. **💾 Data**
- **💾 Data & Backup** (export/import/snapshots/history)

### 6. **🔧 Advanced**
- **🔧 Developer** (grid overlay, debug bots, lighting editor)

---

## 2) Reasoning for the groupings

### Look & Feel
Users typically think in terms of “how it looks” more than individual feature buckets. **Appearance**, **Display**, and **Fun** all affect presentation/feedback rather than system behavior or data.
- Keeps the “I want it prettier / calmer” adjustments together.
- Makes “Fun” feel like a cosmetic preference instead of a separate domain.

### World & Playground
Both settings affect the **visual/interactive environment** rather than admin/config.
- World Environment is a 3D scene choice.
- Playground is an interaction/movement sandbox (still experiential).
- This tab becomes the natural home for future additions like camera, lighting *presets* (not debug), ambient effects, or 2D/3D mode options.

### Rooms
Room Management and Routing Rules are tightly coupled:
- Routing rules target rooms; rooms provide the destination.
- In practice, users often create a room and immediately add rules.
- Putting them together avoids the “where was that room id again?” back-and-forth.

### Behavior & Timing
“Updates” and “Thresholds” both change **system behavior over time**.
- Auto-refresh is effectively a polling/timing configuration.
- Thresholds are time-based behavior changes (idle → sleeping, parking expiry, polling intervals, etc.).
- This tab becomes the default home for future “automation” settings.

### Data
Backup/import/export is high-impact but infrequent. A dedicated tab:
- Avoids accidental clicks.
- Makes it easy to find when needed (“I need to export/import”).
- Leaves room for future data features (reset, migrations, retention, sync status, etc.).

### Advanced
Developer tools are for power users, debugging, or troubleshooting.
- Keeping them out of the main flow supports progressive disclosure.
- Prevents casual users from toggling confusing options (grid overlay, debug bots).

---

## 3) Sections to rename, merge, or split

### Recommended merges
- **Merge “🎉 Fun & Playfulness” into “Look & Feel”** (tab-level merge; keep the section UI as a subsection).

### Recommended renames (clarity / mental model)
- **🔄 Updates** → **🔄 Refresh & Updates** (matches what it actually does: auto-refresh + interval)
- **📺 Display** → **🖥️ Display & Effects** (communicates animations/badges are “effects”)
- **⏱️ Thresholds & Timing** → **⏱️ Automation & Thresholds** or **⏱️ Timing & Thresholds**
- **🏢 Room Management** → **🏠 Rooms** (shorter; aligns with the tab name)
- **🔀 Routing Rules** → **🔀 Auto-Routing** or **🔀 Routing Rules** (either is fine; “Auto-Routing” reads faster)
- **🔧 Developer** → **🔧 Developer Tools**

### Optional split (only if you want finer granularity later)
If Thresholds keeps growing:
- Split into two subgroups inside the same tab:
  - **Session Lifecycle** (active/idle/sleeping)
  - **Parking & Performance** (parking, max bots, polling)
This preserves one tab while improving scanability.

---

## 4) Tab order rationale (most-used first)

1. **Look & Feel** — frequently adjusted (theme, animations), low risk.
2. **Rooms** — core admin workflow (creating and organizing rooms, rules).
3. **World & Playground** — common to tweak for visual preference, but not constant.
4. **Behavior & Timing** — less frequent, more “configuration-y”, moderate risk.
5. **Data** — rare but important; high-impact actions.
6. **Advanced** — rare, power-user/debug only.

> Alternate ordering (if Rooms are “admin-only”): swap **Rooms** and **World & Playground** so casual users see visuals first.

---

## 5) Icon + short label for each tab

- **🎨 Look** (Look & Feel)
- **🌍 World** (World & Playground)
- **🏠 Rooms** (Rooms)
- **⏱️ Timing** (Behavior & Timing)
- **💾 Data** (Data)
- **🔧 Advanced** (Advanced)

Notes:
- Keep labels **≤ 8 chars** where possible for a clean tab bar.
- Icons already match the existing section headers, reducing re-learning.

---

## 6) UX considerations

### Tab behavior
- **Remember last open tab** per user (localStorage) so the panel reopens where they left off.
- Support deep linking (optional): `?settingsTab=rooms` or a hash `#settings/rooms` to jump directly.

### Progressive disclosure
- Keep **Advanced** last, and consider an additional guard:
  - Option A: a small “Show advanced” toggle in the footer of the Settings panel.
  - Option B: keep the tab visible but label it **Advanced** (already self-selecting).

### Safety for destructive actions
- In **Data** tab, keep strong affordances already present (import confirmation is good).
- Consider adding microcopy: “Export before importing” and show last snapshot time.

### Consistency & scanning
- Within each tab, keep sections collapsible where lists/settings are long (Rooms, Thresholds, Data are already collapsible-friendly).
- Maintain a consistent section order within a tab: “basic → advanced” (e.g., Refresh first, then Thresholds).

### Responsive behavior
- On narrow widths, tabs should become:
  - a horizontal scroll tab bar, or
  - a dropdown/tab selector.

---

## Summary
This structure reduces 11+ sections into **6 predictable tabs** aligned to user intent:
- **Look** (cosmetic)
- **World** (environment)
- **Rooms** (organization)
- **Timing** (behavior)
- **Data** (backup)
- **Advanced** (developer)

It keeps high-frequency actions up front, isolates high-risk actions, and leaves room for future growth without re-shuffling everything.
