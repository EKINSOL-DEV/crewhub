# Zen Mode Design Review (Comments & Suggestions)

**Reviewer:** GPT-5.2 (subagent)

This is a strong draft: clear motivation, scoped v1 constraints, and a coherent “tmux-meets-modern-terminal” aesthetic. Below are constructive concerns and suggested improvements, aligned to the requested review focus.

---

## 1) Practicality & Implementability

### ✅ What looks implementable
- **DOM-only UI + CSS variables for theming** is practical and fast to ship.
- **Component breakdown** is sensible (ZenMode container + panels + hooks).
- **Virtualized lists** called out early is good.
- **Reuse of existing hooks** is a realistic integration strategy.

### ⚠️ Key implementation risk: layout model
The proposed `position: { row, col, rowSpan, colSpan }` grid model is fine for simple presets but becomes painful for:
- arbitrary splits (especially nested splits)
- resizing with constraints
- swapping adjacent panes deterministically
- “close others”, maximize, restore previous geometry

**Suggestion:** model layout as a **split tree** (like tmux/iTerm):
```ts
type LayoutNode =
  | { kind: 'leaf'; panelId: string }
  | { kind: 'split'; dir: 'row'|'col'; ratio: number; a: LayoutNode; b: LayoutNode };
```
Then derive CSS grid/flex from the tree. This makes resize/swap/close/maximize reliable and predictable.

### Zen overlay vs unmounting the 3D world
Doc says “don’t unmount, just hide.” That’s correct, but you’ll need to define:
- how input focus and pointer lock from the 3D world is released when entering Zen
- how to prevent the 3D canvas from still handling key events

**Suggestion:** explicitly implement a **mode-level input router**:
- On enter Zen: disable 3D input handlers, stop pointer lock, set `aria-hidden` on the world container.
- On exit Zen: restore previous 3D input state.

### Settings storage
The JSON example is good. Consider versioning/migrations:
- `zen.settingsVersion: 1`
- migrate old keymaps/layout schema over time

---

## 2) Missing Features / Edge Cases

### Panel lifecycle & state
- **Panel-specific state persistence** isn’t specified. Example: logs panel search query, chat scroll position, active filter in sessions.
- **Restoring layout**: what happens if a layout references a session/agent that no longer exists?

**Suggestions:**
- Define per-panel state contract: `panel.state` should be serializable and versioned.
- On restore: gracefully degrade (replace missing targets with `sessions` or `empty`).

### Minimum viable UX edge cases
- **Unread indicators**: specified conceptually, but define behavior:
  - does unread clear on focus? on scroll to bottom? on explicit mark-read?
- **Streaming & scroll**:
  - “character-by-character with blinking cursor” + virtualization can be tricky.
  - user scrolls up while streaming: do you auto-stick to bottom or show “New messages ↓” banner?
- **SSE reconnect**:
  - activity feed should handle disconnect/backoff and show “reconnecting…” state.
- **Multiple chat panels + one selected agent**:
  - State model has `selectedAgentId` global, but multi-chat implies each chat panel has its own agent context.

**Suggestion:** remove/limit global `selectedAgentId` and keep agent selection **per chat panel**.

### “Minimum 1 panel always visible”
Good constraint; define what “close panel” means if only one left: maybe replace with `empty` or block the action.

### Command palette scope
`Ctrl+K` palette is great, but you’ll need consistent command registry:
- commands should be context-aware (focused panel type)
- ensure commands are visible in help overlay

### Copy/paste + tool cards
- Code blocks: define copy behavior and syntax highlighter choice (Shiki vs Prism vs highlight.js) and performance.
- Tool call cards: consider expandable details (stdout/stderr) without overflowing layout.

---

## 3) Is tmux-style the right choice?

### Strengths
- Fits “power user” mental model: splits, prefix chords, status bar.
- Works well for monitoring multiple streams (sessions + activity + chat).

### Risks / mismatches with the browser
- **Prefix key `Ctrl+B` conflicts**:
  - In many editors/input contexts, Ctrl+B is “bold” or used by accessibility tooling.
  - Capturing `Ctrl+B` inside a textarea can be inconsistent and can harm text editing.
- **Browser-reserved shortcuts**:
  - `Ctrl+W` closes the tab in browsers (your design uses `Ctrl+W` to close panel).
  - `Ctrl+K` focuses browser URL bar in some browsers (also common in web apps).

**Suggestion:** keep tmux feel but adapt for web:
- default prefix: **`Ctrl+Space`** or **`Ctrl+;`** (and allow remap)
- avoid `Ctrl+W` entirely; use prefix + `x` to close pane (tmux-style) and/or `Alt+Shift+X`
- ensure all global binds are suppressed only when Zen is active (and don’t hijack when user is typing unless intended)

### Discoverability
Tmux-style chords are not self-evident to non-tmux users. The doc mentions hints—good.

**Suggestion:** add a **first-run overlay** with:
- “Press ? after prefix for help”
- a small interactive cheat sheet

---

## 4) Color Schemes / Theming

### What’s good
- Using well-known terminal palettes (Tokyo Night, Nord, Dracula, etc.) is a smart shortcut.
- CSS variables are the right architecture.

### Gaps / concerns
- Theme samples are partial; the `ZenTheme` interface includes many tokens (fgMuted, bgHover, borders, syntax, bubbles) but theme snippets only define a subset.
  - This can lead to accidental fallbacks and inconsistent look across themes.
- **WCAG contrast** is mentioned but not operationalized.

**Suggestions:**
1. Provide a **complete token set per theme** (even if some are derived).
2. Add a small script/test that computes contrast ratios for core pairs:
   - text on bg, text on panel bg, muted text on bg, accent on bg, status colors on bg.
3. Consider **semantic roles** vs raw colors:
   - e.g. `--zen-fg-danger`, `--zen-fg-warning`, `--zen-badge-bg-success`, etc.
4. Message bubble colors: ensure they don’t reduce readability for code blocks inside bubbles.

---

## 5) Keyboard Shortcuts Intuitiveness

### Positives
- Prefix + mnemonic bindings (`c` chat, `s` sessions) are intuitive for tmux users.
- `Tab`/`Shift+Tab` for cycling panels is good.

### Conflicts / ergonomic concerns
- `Ctrl+Shift+Z` often maps to **redo** in many apps; in the browser it’s not universal, but it’s a known pattern.
- `Ctrl+Enter` “send from anywhere” can be risky if focus is in a filter/search input.
- `Alt+1-9` vs `Ctrl+1-9`: you list `Ctrl+1-9` for focusing panels and also `Alt+1-9` (multi-agent switch). This is okay but must be consistent.

**Suggestions:**
- Avoid browser-tab collisions: don’t use `Ctrl+W`, `Ctrl+L`, `Ctrl+T`, etc.
- Define **shortcut precedence rules**:
  - while typing in a textarea: only allow a minimal set (Escape, maybe prefix) unless explicitly intended
  - allow users to disable “global send” (`Ctrl+Enter`) in settings
- Make “prefix active for 1 second” configurable; some users will need longer.

---

## 6) Panel Layout Flexibility

### Presets are good
The four presets cover real workflows.

### But you’ll want these capabilities clarified
- **Nested splits**: can you split a panel that is already inside a split? (tmux yes)
- **Panel tabs vs splits**: sometimes users want multiple views in one pane (tabs) rather than infinite splits.
- **Minimum sizes**: what happens on small screens or when many panels exist?

**Suggestions:**
- Add constraints: `minWidth`, `minHeight` per panel type.
- Consider an optional **tabbed panel container** (v2) to reduce layout complexity.

---

## 7) Performance / Complexity Concerns

### Where performance could bite
- **Activity feed + chat streaming** = frequent state updates.
- If every token streamed triggers React re-render across panels, it can stutter.

**Suggestions:**
- Ensure streaming updates are isolated to the active chat panel (or even the message component).
- For activity feed, consider batching events (e.g. 50–100ms) to avoid re-render storms.
- Use virtualization not only for sessions/activity, but consider it for long chat histories too.
- Be careful with syntax highlighting: Shiki can be heavy; cache results and avoid re-highlighting on every render.

### Complexity hot spots
- Keyboard system with prefix + timeouts + remapping + per-panel scope is non-trivial.

**Suggestion:** implement keyboard handling with an explicit state machine:
- `mode: 'normal' | 'prefix' | 'palette' | 'modal'`
- and a single authoritative dispatcher.

---

## 8) Mockup Prompts Quality

### What’s good
- Prompts are detailed enough to get a plausible UI.
- They include palette hex codes, layout percentages, and typography cues.

### How to improve to get more *useful* images
AI generators often produce illegible text, random glyphs, and inconsistent spacing. The prompts can be tightened to bias toward **Figma-like vector UI**:

**Suggestions:**
- Add constraints like:
  - “vector UI mockup, crisp sharp text, no gibberish text, consistent grid, straight lines”
  - “no perspective tilt, flat 2D screenshot”
  - “high contrast legible UI text (use generic labels, not paragraphs)”
- Specify exact canvas/aspect:
  - “16:9, 1920x1080” or “4K 3840x2160”
- Reduce long textual content requirements; instead:
  - “short placeholder messages” to avoid the model generating messy paragraphs.
- Add a prompt for **focus state** and **selection**:
  - “focused panel with bright border, inactive panels muted”
- Add a prompt for **keyboard shortcut overlay** or command palette (important for Zen):
  - command palette centered with fuzzy search results.

---

## Additional notes / quick wins

1. **Terminology consistency**: “Assistent” vs “Assistant” appears mixed; choose one.
2. **Internationalization**: decide if Zen UI strings are localized or English-only.
3. **Security/privacy**: logs panel + export needs explicit redaction rules (tokens, secrets) and warning before export.
4. **Mobile**: “desktop-first” is fine, but add a clear “Zen not supported on small screens” UX instead of broken layout.

---

## Summary Recommendation
Proceed with this direction, but I strongly recommend:
- switching the panel layout model to a split-tree (tmux-like) rather than row/col spans
- revising shortcut defaults to avoid browser collisions (`Ctrl+W`, likely `Ctrl+B`)
- making theme token sets complete + contrast-tested
- clarifying multi-chat agent state (per panel)

If those are addressed, the design is practical and should be implementable without accruing a lot of UI debt.
