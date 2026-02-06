# Zen Mode Implementation Masterplan

**Date:** 2026-02-07  
**Status:** Ready for Implementation  
**Based on:** zen-mode-design.md + zen-mode-review.md

---

## Executive Summary

This masterplan provides a concrete, actionable implementation guide for CrewHub's Zen Mode feature. It incorporates all review feedback and defines clear phases with checkboxes, acceptance criteria, and time estimates.

**Key Review Feedback Incorporated:**
- ✅ Split-tree layout model (instead of row/col spans)
- ✅ Safe keyboard shortcuts (avoiding browser conflicts)
- ✅ Complete theme token sets with contrast testing
- ✅ Per-panel agent state (not global selectedAgentId)
- ✅ Mode-level input router for 3D world handling

---

## Phase 1: MVP Foundation (Tonight - 3-4 hours)

**Goal:** Working Zen Mode with single chat panel that can be toggled on/off.

### Files to Create

```
src/components/zen/
├── ZenMode.tsx              # Main container component
├── ZenMode.css              # Base styles + Tokyo Night theme
├── ZenTopBar.tsx            # Minimal top bar (title + exit button)
├── ZenStatusBar.tsx         # Bottom status bar
├── ZenChatPanel.tsx         # Chat interface (reuses useAgentChat)
├── hooks/
│   └── useZenMode.ts        # Zen mode state and toggle
└── themes/
    └── tokyo-night.ts       # Default theme tokens
```

### Files to Modify

```
src/App.tsx                  # Add Zen Mode conditional render + keyboard listener
src/contexts/                # (if needed) Add ZenModeContext
```

### Implementation Checklist

#### 1.1 Core Container
- [ ] Create `ZenMode.tsx` - full-screen overlay container
- [ ] Implement CSS custom properties for Tokyo Night theme
- [ ] Add `data-zen-theme` attribute on root for theme switching
- [ ] Create `useZenMode.ts` hook with `isActive`, `toggle()`, `exit()`

#### 1.2 Toggle Mechanism
- [ ] Add global keyboard listener in `App.tsx`
- [ ] **Shortcut: `Ctrl+Shift+Z`** (toggle Zen Mode)
  - Note: Reviewed for conflicts - this is safe (not standard redo in browsers)
- [ ] **Shortcut: `Escape`** (exit Zen Mode when active)
- [ ] Conditional render: `{zenMode.isActive ? <ZenMode /> : <World3DView />}`
- [ ] **Mode-level input router:** disable 3D input handlers when Zen active
  - Set `aria-hidden` on 3D world container
  - Release pointer lock if active
  - Stop 3D keyboard event handlers

#### 1.3 Top Bar
- [ ] Create `ZenTopBar.tsx` with:
  - Left: "Zen Mode" label
  - Right: Exit button (×) with tooltip "Exit Zen Mode (Esc)"
- [ ] Height: 32px, compact styling

#### 1.4 Status Bar
- [ ] Create `ZenStatusBar.tsx` with:
  - Left: Active agent name + status badge
  - Center: Current room (or "—" if none)
  - Right: Connection status + current time
- [ ] Height: 24px, monospace font
- [ ] Show keyboard hints: "Esc to exit • Ctrl+K for commands (coming soon)"

#### 1.5 Chat Panel (MVP)
- [ ] Create `ZenChatPanel.tsx` that:
  - Reuses `useAgentChat` hook from existing codebase
  - Shows message history with compact styling
  - Has input field at bottom
  - Supports streaming responses
- [ ] Message styling:
  - User messages: right-aligned or left with "USER" label
  - Assistant messages: left-aligned with "ASSISTANT" label
  - Compact timestamps (relative: "2m ago")
  - Code blocks with basic syntax highlighting
- [ ] Tool call display: inline compact cards with status icon

#### 1.6 Tokyo Night Theme
- [ ] Create complete token set in `themes/tokyo-night.ts`:
```typescript
export const tokyoNight = {
  id: 'tokyo-night',
  name: 'Tokyo Night',
  type: 'dark',
  colors: {
    bg: '#1a1b26',
    bgPanel: '#24283b',
    bgHover: '#2f3549',
    bgActive: '#3d4560',
    fg: '#c0caf5',
    fgMuted: '#565f89',
    fgDim: '#3d4560',
    border: '#3d4560',
    borderFocus: '#7aa2f7',
    accent: '#7aa2f7',
    accentHover: '#89b4fa',
    success: '#9ece6a',
    warning: '#e0af68',
    error: '#f7768e',
    info: '#7dcfff',
    userBubble: '#3d4560',
    assistantBubble: '#1e2030',
  }
};
```
- [ ] Verify WCAG AA contrast ratios for:
  - `fg` on `bg` (should be ≥4.5:1)
  - `fg` on `bgPanel`
  - `fgMuted` on `bg`

### Acceptance Criteria (Phase 1)

| Criteria | Test |
|----------|------|
| Toggle works | Press `Ctrl+Shift+Z` → Zen Mode appears fullscreen |
| Exit works | Press `Escape` → returns to 3D world |
| Chat functional | Can send message, see response streaming |
| 3D input disabled | No WASD movement or mouse look while in Zen |
| Theme applied | Tokyo Night colors visible, monospace font |
| Status bar shows info | Agent name, room, time visible |

### Estimated Time: 3-4 hours

---

## Phase 2: Panel System with Split-Tree Layout (4-5 hours)

**Goal:** Multi-panel layouts with resizing, using split-tree model per review feedback.

### Files to Create

```
src/components/zen/
├── ZenPanelContainer.tsx    # Split-tree layout renderer
├── ZenPanel.tsx             # Panel wrapper with header/focus
├── ZenSessionsPanel.tsx     # Session list panel
├── ZenActivityPanel.tsx     # Real-time SSE activity feed
├── hooks/
│   ├── useZenLayout.ts      # Split-tree layout state
│   └── useZenKeyboard.ts    # Keyboard shortcut handling
└── types/
    └── layout.ts            # Layout type definitions
```

### Key Design Decision: Split-Tree Layout

**Per review feedback**, use a split-tree model instead of grid:

```typescript
// types/layout.ts
type LayoutNode =
  | { kind: 'leaf'; panelId: string; panelType: PanelType }
  | { kind: 'split'; dir: 'row' | 'col'; ratio: number; a: LayoutNode; b: LayoutNode };

type PanelType = 'chat' | 'sessions' | 'activity' | 'rooms' | 'tasks' | 'logs' | 'details' | 'empty';

interface ZenLayoutState {
  root: LayoutNode;
  focusedPanelId: string;
  presets: Record<string, LayoutNode>;
}
```

**Benefits:**
- Arbitrary nested splits (like tmux)
- Deterministic resize/swap/close operations
- Easy maximize/restore (save subtree, replace with leaf)

### Implementation Checklist

#### 2.1 Layout Types & State
- [ ] Create `types/layout.ts` with `LayoutNode` type
- [ ] Create `useZenLayout.ts` hook with:
  - `layout: LayoutNode`
  - `focusedPanelId: string`
  - `splitPanel(panelId, direction)`
  - `closePanel(panelId)`
  - `resizePanel(panelId, delta)`
  - `swapPanels(panelIdA, panelIdB)`
  - `maximizePanel(panelId)` / `restoreLayout()`
  - `applyPreset(presetName)`

#### 2.2 Panel Container
- [ ] Create `ZenPanelContainer.tsx`:
  - Recursively renders `LayoutNode` tree
  - Uses CSS flexbox for splits (flex-direction based on `dir`)
  - Renders resize handles between split children
- [ ] Resize handles: 4px wide/tall, cursor change, drag to resize
- [ ] Minimum panel sizes: 200px width, 150px height

#### 2.3 Panel Wrapper
- [ ] Create `ZenPanel.tsx`:
  - Header with panel type icon + title
  - Focus ring when `focusedPanelId` matches
  - Close button (if more than 1 panel)
- [ ] Click to focus panel

#### 2.4 Sessions Panel
- [ ] Create `ZenSessionsPanel.tsx`:
  - Uses existing `useSessions` hook
  - Compact list with: status dot, agent name, room, last activity
  - Click to select agent (updates chat panel)
  - Status colors: green=active, yellow=thinking, gray=idle
- [ ] Keyboard: `j/k` or arrows to navigate, `Enter` to select

#### 2.5 Activity Panel
- [ ] Create `ZenActivityPanel.tsx`:
  - Connects to existing SSE stream (`/api/events`)
  - Shows: timestamp, agent badge, event description
  - Tool calls as compact inline cards
  - Handle disconnect/reconnect with "Reconnecting..." state
- [ ] **Batch updates** (per review): 100ms debounce to prevent render storms

#### 2.6 Layout Presets
- [ ] Implement 3 presets:
  1. **Default**: `sessions (25%) | chat (75%)`
  2. **Chat + Activity**: `sessions (20%) | chat (50%) | activity (30%)`
  3. **Monitor**: `sessions (40%) | activity (60%)`
- [ ] Store presets in `useZenLayout`

#### 2.7 Keyboard Shortcuts (Safe Bindings)

**Per review feedback**, avoid browser conflicts:

| Action | Shortcut | Notes |
|--------|----------|-------|
| Focus next panel | `Tab` | Standard |
| Focus prev panel | `Shift+Tab` | Standard |
| Focus panel N | `Ctrl+1-9` | Safe |
| Split vertical | `Ctrl+\` | Safe (not browser) |
| Split horizontal | `Ctrl+Shift+\` | Safe |
| Close panel | `Ctrl+Shift+W` | **Not** Ctrl+W (closes tab!) |
| Maximize toggle | `Ctrl+Shift+M` | Safe |
| Cycle layouts | `Ctrl+Shift+L` | Safe |

- [ ] Create `useZenKeyboard.ts` hook
- [ ] Register shortcuts only when Zen Mode active
- [ ] Release shortcuts on exit

### Acceptance Criteria (Phase 2)

| Criteria | Test |
|----------|------|
| Multi-panel layout | Can see sessions + chat + activity simultaneously |
| Panel resize | Drag border to resize panels |
| Panel focus | Tab cycles through panels, focused panel has border |
| Session selection | Click session → chat shows that agent |
| Activity feed | Real-time events appear, reconnects on disconnect |
| Layout presets | Can switch between Default/Chat+Activity/Monitor |
| No browser conflicts | Ctrl+W still closes browser tab, not panel |

### Estimated Time: 4-5 hours

---

## Phase 3: Theme System & Polish (3-4 hours)

**Goal:** Complete theme system with 5+ themes, theme picker, visual polish.

### Files to Create

```
src/components/zen/
├── ZenThemePicker.tsx       # Theme selection modal
├── themes/
│   ├── index.ts             # Theme registry
│   ├── tokyo-night.ts       # (already exists)
│   ├── dracula.ts
│   ├── nord.ts
│   ├── catppuccin.ts
│   └── github-light.ts
└── utils/
    └── contrast.ts          # WCAG contrast ratio checker
```

### Implementation Checklist

#### 3.1 Theme Registry
- [ ] Create `themes/index.ts` exporting all themes
- [ ] Each theme implements complete `ZenTheme` interface
- [ ] Add `getTheme(id)`, `getAllThemes()`, `getThemesByType(dark|light)`

#### 3.2 Additional Themes
- [ ] **Dracula**: Purple accents, high contrast
- [ ] **Nord**: Arctic blues, muted
- [ ] **Catppuccin Mocha**: Pastel on dark
- [ ] **GitHub Light**: Clean light theme

Each theme must define ALL tokens (per review: no partial themes).

#### 3.3 Contrast Testing
- [ ] Create `utils/contrast.ts`:
  - `getContrastRatio(color1, color2): number`
  - `meetsWCAG_AA(fg, bg): boolean` (≥4.5:1 for text)
- [ ] Add test/script that validates all themes meet WCAG AA for:
  - `fg` on `bg`
  - `fg` on `bgPanel`
  - `fgMuted` on `bg` (≥3:1 for large text acceptable)
  - `accent` on `bg`

#### 3.4 Theme Picker
- [ ] Create `ZenThemePicker.tsx`:
  - Modal overlay (centered, keyboard navigable)
  - List of themes with color swatches
  - Current theme highlighted
  - Click or Enter to select
  - Escape to close
- [ ] Shortcut: `Ctrl+Shift+T` opens theme picker

#### 3.5 Theme State
- [ ] Add `useZenTheme.ts` hook:
  - `currentTheme: ZenTheme`
  - `setTheme(themeId)`
  - Persist preference to localStorage
- [ ] Apply theme by setting `data-zen-theme` attribute and CSS variables

#### 3.6 Visual Polish
- [ ] Smooth transitions for theme switch (150ms color transition)
- [ ] Panel animations: subtle fade-in on open (100ms)
- [ ] Loading states: skeleton for sessions/activity while loading
- [ ] Empty states: "No messages yet" in chat, "No activity" in feed
- [ ] Scrollbars: styled to match theme (thin, muted)

### Acceptance Criteria (Phase 3)

| Criteria | Test |
|----------|------|
| 5 themes available | Can switch between Tokyo Night, Dracula, Nord, Catppuccin, GitHub Light |
| Theme picker works | Ctrl+Shift+T opens picker, can select theme |
| Contrast passes | All themes pass WCAG AA for main text |
| Preference persisted | Theme choice survives page refresh |
| Visual polish | Smooth transitions, loading states, styled scrollbars |

### Estimated Time: 3-4 hours

---

## Phase 4: Command Palette & Extended Features (4-5 hours)

**Goal:** Command palette, keyboard help overlay, rooms panel, log viewer.

### Files to Create

```
src/components/zen/
├── ZenCommandPalette.tsx    # Fuzzy search command palette
├── ZenKeyboardHelp.tsx      # Shortcut overlay
├── ZenRoomsPanel.tsx        # Room list panel
├── ZenLogsPanel.tsx         # Session transcript viewer
└── hooks/
    └── useCommandRegistry.ts # Command registration
```

### Implementation Checklist

#### 4.1 Command Registry
- [ ] Create `useCommandRegistry.ts`:
  - `registerCommand(id, label, action, shortcut?)`
  - `getCommands(): Command[]`
  - `executeCommand(id)`
  - `searchCommands(query): Command[]` (fuzzy match)

#### 4.2 Command Palette
- [ ] Create `ZenCommandPalette.tsx`:
  - Modal overlay with search input
  - Fuzzy-filtered command list
  - Keyboard navigation (arrows + Enter)
  - Shows shortcut hints next to commands
  - Recent commands at top
- [ ] Shortcut: `Ctrl+K` opens palette
- [ ] Commands to register:
  - `zen.exit` - Exit Zen Mode
  - `zen.theme.*` - Switch to specific theme
  - `zen.layout.*` - Apply layout preset
  - `panel.add.*` - Add panel type
  - `panel.close` - Close focused panel
  - `agent.*` - Focus specific agent's chat

#### 4.3 Keyboard Help Overlay
- [ ] Create `ZenKeyboardHelp.tsx`:
  - Full-screen overlay with shortcut table
  - Grouped by category (Global, Panel, Chat)
  - Dismiss with Escape or click outside
- [ ] Shortcut: `Ctrl+/` or `?` (when not in input)

#### 4.4 Rooms Panel
- [ ] Create `ZenRoomsPanel.tsx`:
  - Uses existing `useRooms` hook
  - Shows: room icon, name, agent count
  - Click to filter sessions by room
  - Selected room highlighted

#### 4.5 Logs Panel
- [ ] Create `ZenLogsPanel.tsx`:
  - Full transcript for selected session
  - Search within logs (Ctrl+F when focused)
  - Timestamp + role for each entry
  - Collapsible tool call details
  - Virtualized for performance

### Acceptance Criteria (Phase 4)

| Criteria | Test |
|----------|------|
| Command palette | Ctrl+K opens, can search "exit", Enter executes |
| Fuzzy search | Typing "thdr" finds "Theme: Dracula" |
| Keyboard help | Ctrl+/ shows all shortcuts grouped |
| Rooms panel | Can add rooms panel, click to filter |
| Logs panel | Can view full session transcript with search |

### Estimated Time: 4-5 hours

---

## Phase 5: Production Polish & Testing (3-4 hours)

**Goal:** Performance optimization, accessibility audit, settings UI.

### Implementation Checklist

#### 5.1 Performance
- [ ] Virtualize long lists (sessions, activity, logs) with `react-virtual`
- [ ] Memoize heavy components (`React.memo`, `useMemo`)
- [ ] Batch activity feed updates (100ms window)
- [ ] Lazy-load panels not in current layout
- [ ] Cache syntax highlighting results

#### 5.2 Accessibility
- [ ] Focus trapping within Zen Mode overlay
- [ ] All panels have `aria-label`
- [ ] Status announcements for screen readers (agent started, completed, etc.)
- [ ] High contrast mode support (respects `prefers-contrast`)
- [ ] Keyboard-only navigation test: all features reachable

#### 5.3 Edge Cases (per review)
- [ ] **Panel state persistence**: Save per-panel state (scroll position, filters)
- [ ] **Missing agent handling**: Gracefully handle if agent no longer exists
- [ ] **Streaming + scroll**: "New messages ↓" banner when scrolled up during stream
- [ ] **SSE reconnect**: Show "Reconnecting..." with backoff
- [ ] **Mobile warning**: Show "Zen Mode requires desktop" on small screens

#### 5.4 Settings
- [ ] Add Zen Mode section to existing settings UI:
  - Theme preference
  - Default layout
  - Font size (12-16px)
  - Custom shortcuts (later)
- [ ] Sync settings with backend settings table

#### 5.5 Testing
- [ ] Unit tests for layout tree operations
- [ ] Integration tests for keyboard shortcuts
- [ ] Visual regression tests for themes
- [ ] Manual testing checklist (all features, all themes)

### Acceptance Criteria (Phase 5)

| Criteria | Test |
|----------|------|
| No lag with 100+ sessions | Scrolling is smooth |
| Screen reader announces events | VoiceOver/NVDA reads status changes |
| Settings persist | Font size change survives refresh |
| Mobile handled | "Desktop required" message on phone |
| All tests pass | Unit + integration tests green |

### Estimated Time: 3-4 hours

---

## Summary: Total Implementation Time

| Phase | Scope | Estimate |
|-------|-------|----------|
| Phase 1 | MVP (toggle, chat, theme) | 3-4 hours |
| Phase 2 | Panel system + sessions/activity | 4-5 hours |
| Phase 3 | Full themes + polish | 3-4 hours |
| Phase 4 | Command palette + extended panels | 4-5 hours |
| Phase 5 | Performance + a11y + settings | 3-4 hours |
| **Total** | | **17-22 hours** |

---

## Tonight's Focus: Phase 1 MVP

**Priority for tonight (3-4 hours):**

1. `ZenMode.tsx` - container with full-screen overlay ✓
2. `useZenMode.ts` - toggle state ✓
3. `App.tsx` - keyboard listener + conditional render ✓
4. `ZenChatPanel.tsx` - chat with existing hook ✓
5. `ZenTopBar.tsx` + `ZenStatusBar.tsx` - minimal UI ✓
6. `tokyo-night.ts` - complete theme tokens ✓
7. Test: toggle in/out, send message, verify 3D disabled ✓

**Definition of Done (Phase 1):**
- [ ] Can press `Ctrl+Shift+Z` to enter Zen Mode
- [ ] Can press `Escape` to exit
- [ ] Can send a message and see streaming response
- [ ] Tokyo Night theme looks correct
- [ ] 3D world is hidden and not receiving input
- [ ] Code committed and pushed to `develop`

---

## Appendix: Safe Keyboard Shortcuts Reference

**Avoiding browser conflicts (per review):**

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `Ctrl+W` | Closes browser tab | `Ctrl+Shift+W` or prefix+x |
| `Ctrl+T` | New browser tab | `Ctrl+Shift+T` (theme) |
| `Ctrl+L` | Focus URL bar | — |
| `Ctrl+N` | New window | Use for message history only in input |
| `Ctrl+B` | Some apps: bold | `Ctrl+Space` or avoid prefix |

**Final shortcut mapping:**

```
GLOBAL
  Ctrl+Shift+Z     Toggle Zen Mode
  Escape           Exit Zen Mode / Close modal
  Ctrl+K           Command Palette
  Ctrl+/           Keyboard shortcuts help
  Tab              Focus next panel
  Shift+Tab        Focus previous panel
  Ctrl+1-9         Focus panel by number

PANELS
  Ctrl+\           Split vertical
  Ctrl+Shift+\     Split horizontal
  Ctrl+Shift+W     Close panel
  Ctrl+Shift+M     Maximize/restore panel
  Ctrl+Shift+L     Cycle layouts

THEMES
  Ctrl+Shift+T     Open theme picker

CHAT (when focused)
  Enter            Send message
  Shift+Enter      New line
  Escape           Cancel streaming
  Page Up/Down     Scroll history
```

---

*Ready to implement. Let's build this tonight!*
