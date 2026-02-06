# CrewHub — Zen Mode Design Document

**Date:** 2026-02-07  
**Author:** Opus  
**Status:** Draft  
**Version:** 1.0

---

## Table of Contents

1. [Overview & Motivation](#1-overview--motivation)
2. [Key Features & Requirements](#2-key-features--requirements)
3. [UI/UX Design](#3-uiux-design)
4. [Panel Layout System](#4-panel-layout-system)
5. [Color Scheme System](#5-color-scheme-system)
6. [Keyboard Shortcuts](#6-keyboard-shortcuts)
7. [Chat Integration](#7-chat-integration)
8. [Technical Implementation](#8-technical-implementation)
9. [Mockup Generation Prompts](#9-mockup-generation-prompts)
10. [Implementation Phases](#10-implementation-phases)

---

## 1. Overview & Motivation

### What is Zen Mode?

Zen Mode is a **full-screen, distraction-free interface** for CrewHub that replaces the 3D world and standard UI with a terminal/tmux-inspired layout. It's designed for users who need to focus on agent activity, manage multiple sessions, and chat with agents—without the visual overhead of the 3D environment.

### Why Zen Mode?

1. **Focus & Productivity**: The 3D world is visually engaging but can be distracting during intense work sessions. Some users prefer dense, information-rich interfaces.

2. **Performance**: Rendering a 3D scene with animations consumes GPU/CPU resources. Zen Mode is lightweight—pure DOM, no Three.js overhead.

3. **Accessibility**: Terminal-style interfaces are familiar to developers and power users. Keyboard-first navigation reduces mouse dependency.

4. **Multi-Tasking**: tmux-style split panes allow monitoring multiple agents, rooms, and conversations simultaneously.

5. **Remote/Low-Bandwidth**: A text-based interface is faster to load and uses less bandwidth—ideal for SSH tunnels or constrained connections.

### Design Philosophy

> *"Everything you need, nothing you don't."*

- **Information Density**: Show more content in less space with compact fonts and minimal padding
- **Keyboard-First**: Every action reachable via keyboard shortcuts
- **Consistent Rhythm**: Fixed grid system, predictable layouts
- **Quick Context Switching**: Jump between agents, rooms, and views in milliseconds
- **Theming Freedom**: Multiple color schemes to match user preferences and reduce eye strain

---

## 2. Key Features & Requirements

### Core Features

| Feature | Description | Priority |
|---------|-------------|----------|
| **Full-Screen Toggle** | Enter/exit Zen Mode with single key | P0 |
| **Panel System** | Resizable, rearrangeable split panes | P0 |
| **Agent Chat** | Full chat with streaming, history, markdown | P0 |
| **Session List** | All active/idle sessions with status | P0 |
| **Activity Feed** | Real-time event stream (SSE-powered) | P0 |
| **Room Overview** | Quick room switcher and stats | P1 |
| **Task Board** | Compact task list per room/project | P1 |
| **Log Viewer** | Session transcript with search | P1 |
| **Color Schemes** | Dark, light, and custom themes | P0 |
| **Keyboard Navigation** | tmux-style prefix + key bindings | P0 |
| **Layout Presets** | Save/load panel arrangements | P2 |
| **Command Palette** | Fuzzy search for any action | P2 |

### Non-Goals (v1)

- 3D visualization of any kind
- Drag-and-drop between panels (keyboard-only resize/swap)
- Heavy animations or transitions
- Mobile-optimized layout (desktop-first)

### Constraints

- Must integrate with existing CrewHub backend (no new endpoints required for v1)
- Must reuse existing hooks (`useAgentChat`, `useSessions`, `useRooms`, etc.)
- Must be toggleable without losing 3D world state (mode switch, not navigation)

---

## 3. UI/UX Design

### Layout Inspiration: tmux + Modern Terminals

Zen Mode draws from:
- **tmux**: Split panes, prefix key navigation, status bar
- **Warp/Kitty/Alacritty**: Modern terminal aesthetics, smooth fonts
- **Neovim**: Compact panels, command line at bottom
- **Linear**: Clean, minimal task interfaces

### Visual Characteristics

| Element | Specification |
|---------|---------------|
| **Font** | Monospace: `JetBrains Mono`, `Fira Code`, or system monospace |
| **Base Font Size** | 13px (adjustable: 11-16px) |
| **Line Height** | 1.4 (compact but readable) |
| **Spacing** | 4px base unit, 8px panel gaps |
| **Borders** | 1px solid, muted color (no shadows) |
| **Corners** | 2px radius (subtle, not rounded) |
| **Icons** | Minimal, monochrome, 14px |

### Screen Regions

```
┌─────────────────────────────────────────────────────────────────────┐
│ TOP BAR (24px)                                           [mode] [⚙] │
├───────────────────────────────────────────────────────┬─────────────┤
│                                                       │             │
│                                                       │             │
│                    MAIN AREA                          │   SIDEBAR   │
│               (flexible panels)                       │  (optional) │
│                                                       │             │
│                                                       │             │
│                                                       │             │
├───────────────────────────────────────────────────────┴─────────────┤
│ STATUS BAR (20px)  [active agent] [room] [time] [shortcuts hint]    │
└─────────────────────────────────────────────────────────────────────┘
```

### Top Bar

Minimal header with:
- **Left**: "Zen Mode" label + current layout name
- **Center**: Quick tabs (Agents | Rooms | Tasks) if multiple views are open
- **Right**: Theme toggle, settings gear, exit Zen Mode button

### Status Bar

Always-visible footer showing:
- Currently focused agent (name + status badge)
- Current room context
- Connection status (Gateway connected/disconnected)
- Current time
- Keyboard shortcut hints (context-aware)

---

## 4. Panel Layout System

### Panel Types

Each panel is a self-contained view that can be placed anywhere in the grid:

| Panel Type | Description | Default Size |
|------------|-------------|--------------|
| `sessions` | List of all sessions with status, room, last activity | 30% width |
| `chat` | Full chat interface for selected agent | 40% width |
| `activity` | Real-time event feed (all agents) | 30% width |
| `rooms` | Room list with agent counts | 20% width |
| `tasks` | Task board for current room/project | 30% width |
| `logs` | Full transcript viewer with search | 50% width |
| `details` | Agent/session metadata and stats | 25% width |
| `empty` | Placeholder for collapsed panels | - |

### Layout Presets

Pre-configured layouts for common workflows:

#### 1. **Default**: Chat-Focused
```
┌──────────────────────────────────────────────────────────────────┐
│   SESSIONS (25%)   │       CHAT (50%)         │  ACTIVITY (25%)  │
│                    │                          │                  │
│  ○ Assistent      │  ┌────────────────────┐  │  10:42 Assistent │
│  ◐ Dev            │  │ Agent: Assistent   │  │    started task  │
│  ○ Flowy          │  ├────────────────────┤  │  10:41 Dev       │
│  ◐ Creator        │  │                    │  │    completed     │
│                    │  │  [conversation]   │  │  10:40 Flowy     │
│  ─────────────────  │  │                    │  │    idle          │
│  Rooms:            │  │                    │  │                  │
│  · HQ (3)          │  │                    │  │                  │
│  · Dev Room (2)    │  ├────────────────────┤  │                  │
│  · Studio (1)      │  │ > Type message... │  │                  │
└──────────────────────────────────────────────────────────────────┘
```

#### 2. **Multi-Chat**: Side-by-Side Conversations
```
┌──────────────────────────────────────────────────────────────────┐
│  SESSIONS (20%)  │   CHAT 1 (40%)   │   CHAT 2 (40%)            │
│                   │  [Assistent]      │  [Dev]                    │
│  → Assistent      │                   │                           │
│    Dev            │  conversation...  │  conversation...          │
│    Flowy          │                   │                           │
│                   │  > input...       │  > input...               │
└──────────────────────────────────────────────────────────────────┘
```

#### 3. **Monitor**: Activity-Focused
```
┌──────────────────────────────────────────────────────────────────┐
│       SESSIONS (33%)        │         ACTIVITY FEED (67%)        │
│                              │                                    │
│  Status | Agent    | Room    │  10:42:15  [Assistent] Tool call:  │
│  ───────┼──────────┼──────   │            web_search → success   │
│    ●    │ Assistent│ HQ      │  10:42:12  [Assistent] Response:   │
│    ◐    │ Dev      │ Dev     │            "I found 3 results..." │
│    ○    │ Flowy    │ HQ      │  10:42:01  [Dev] Started thinking  │
│    ●    │ Creator  │ Studio  │  10:41:55  [Dev] User message      │
│    ○    │ Cron-1   │ -       │  10:41:30  [Flowy] Became idle     │
└──────────────────────────────────────────────────────────────────┘
```

#### 4. **Tasks**: Project Management
```
┌──────────────────────────────────────────────────────────────────┐
│  ROOMS (20%)  │     TASK BOARD (50%)     │     CHAT (30%)       │
│               │                           │                      │
│  → HQ (3)     │  ☐ Deploy v0.9.2         │  [Dev]               │
│    Dev (2)    │  ☐ Fix SSE reconnect     │                      │
│    Studio (1) │  ☑ Add Zen Mode          │  Working on the      │
│               │  ☑ Onboarding wizard     │  deployment now...   │
│               │                           │                      │
└──────────────────────────────────────────────────────────────────┘
```

### Panel Interactions

- **Focus**: Click or keyboard navigate to focus a panel (highlighted border)
- **Resize**: Drag border or use `Ctrl+Arrow` keys
- **Swap**: `Ctrl+Shift+Arrow` swaps panel with neighbor
- **Maximize**: `Ctrl+M` or double-click header to full-screen one panel
- **Close**: `Ctrl+W` closes panel (minimum 1 panel always visible)
- **Add**: Command palette or `Ctrl+N` to add new panel

---

## 5. Color Scheme System

### Theme Architecture

Themes are defined as CSS custom property sets, loaded dynamically:

```typescript
interface ZenTheme {
  id: string;
  name: string;
  type: 'dark' | 'light';
  colors: {
    // Background layers
    bg: string;           // Main background
    bgPanel: string;      // Panel background
    bgHover: string;      // Hover states
    bgActive: string;     // Active/selected
    
    // Foreground
    fg: string;           // Primary text
    fgMuted: string;      // Secondary text
    fgDim: string;        // Tertiary/disabled
    
    // Borders
    border: string;       // Default borders
    borderFocus: string;  // Focused panel border
    
    // Accent colors
    accent: string;       // Primary accent (links, focus)
    accentHover: string;  // Accent hover
    
    // Status colors
    success: string;      // Active, online
    warning: string;      // Thinking, pending
    error: string;        // Error, disconnected
    info: string;         // Info, working
    
    // Chat-specific
    userBubble: string;   // User message background
    assistantBubble: string; // Assistant message background
    
    // Syntax highlighting (for code blocks)
    syntax: {
      keyword: string;
      string: string;
      comment: string;
      function: string;
      variable: string;
    };
  };
}
```

### Built-in Themes

#### 1. **Tokyo Night** (Default Dark)
```css
--bg: #1a1b26;
--bg-panel: #24283b;
--fg: #c0caf5;
--fg-muted: #565f89;
--accent: #7aa2f7;
--success: #9ece6a;
--warning: #e0af68;
--error: #f7768e;
```

#### 2. **Dracula**
```css
--bg: #282a36;
--bg-panel: #44475a;
--fg: #f8f8f2;
--accent: #bd93f9;
--success: #50fa7b;
--warning: #ffb86c;
--error: #ff5555;
```

#### 3. **Nord**
```css
--bg: #2e3440;
--bg-panel: #3b4252;
--fg: #eceff4;
--accent: #88c0d0;
--success: #a3be8c;
--warning: #ebcb8b;
--error: #bf616a;
```

#### 4. **Solarized Dark**
```css
--bg: #002b36;
--bg-panel: #073642;
--fg: #839496;
--accent: #268bd2;
--success: #859900;
--warning: #b58900;
--error: #dc322f;
```

#### 5. **Solarized Light**
```css
--bg: #fdf6e3;
--bg-panel: #eee8d5;
--fg: #657b83;
--accent: #268bd2;
```

#### 6. **GitHub Light**
```css
--bg: #ffffff;
--bg-panel: #f6f8fa;
--fg: #24292f;
--accent: #0969da;
```

#### 7. **Gruvbox Dark**
```css
--bg: #282828;
--bg-panel: #3c3836;
--fg: #ebdbb2;
--accent: #fabd2f;
--success: #b8bb26;
--error: #fb4934;
```

#### 8. **One Dark**
```css
--bg: #282c34;
--bg-panel: #21252b;
--fg: #abb2bf;
--accent: #61afef;
```

#### 9. **Catppuccin Mocha**
```css
--bg: #1e1e2e;
--bg-panel: #313244;
--fg: #cdd6f4;
--accent: #cba6f7;
```

#### 10. **Custom** (User-defined)
Users can create custom themes via settings, defining all color values.

### Theme Switching

- Quick switch: `Ctrl+K T` opens theme picker (fuzzy search)
- Cycle themes: `Ctrl+Shift+T` cycles through favorites
- System follow: Option to auto-switch based on OS dark/light mode
- Per-session: Remember last theme preference

---

## 6. Keyboard Shortcuts

### Design Principles

- **Prefix Key**: Following tmux convention, complex actions use a prefix (`Ctrl+B` by default)
- **Mnemonic**: Keys relate to actions (C for Chat, S for Sessions)
- **Discoverable**: Status bar shows context-aware hints
- **Customizable**: All bindings can be remapped in settings

### Global Shortcuts (No Prefix)

| Key | Action | Description |
|-----|--------|-------------|
| `Ctrl+Shift+Z` | Toggle Zen Mode | Enter/exit Zen Mode |
| `Escape` | Close/Back | Close modal, deselect, or exit focused panel |
| `Ctrl+K` | Command Palette | Fuzzy search all actions |
| `Ctrl+/` | Show Shortcuts | Display keyboard shortcut overlay |
| `Tab` | Next Panel | Focus next panel |
| `Shift+Tab` | Previous Panel | Focus previous panel |
| `Ctrl+1-9` | Focus Panel N | Jump to panel by number |

### Prefix Mode (Default: `Ctrl+B`)

After pressing prefix, the following keys are available for 1 second:

| Key | Action | Description |
|-----|--------|-------------|
| `c` | New Chat Panel | Add a new chat panel |
| `s` | Sessions Panel | Add/focus sessions panel |
| `a` | Activity Panel | Add/focus activity feed |
| `r` | Rooms Panel | Add/focus rooms panel |
| `t` | Tasks Panel | Add/focus tasks panel |
| `l` | Logs Panel | Add/focus log viewer |
| `%` | Split Vertical | Split current panel vertically |
| `"` | Split Horizontal | Split current panel horizontally |
| `x` | Close Panel | Close current panel |
| `z` | Maximize Toggle | Maximize/restore current panel |
| `o` | Close Others | Close all panels except current |
| `Space` | Layout Picker | Choose a layout preset |
| `n` | Next Layout | Cycle to next layout preset |
| `[` | Scroll Up (Panel) | Scroll up in scrollable panel |
| `]` | Scroll Down (Panel) | Scroll down in scrollable panel |
| `{` | Swap Left/Up | Swap panel with left/up neighbor |
| `}` | Swap Right/Down | Swap panel with right/down neighbor |
| `Arrow Keys` | Resize Panel | Grow/shrink panel in direction |
| `1-9` | Go to Agent N | Focus chat for agent by list position |
| `,` | Rename Panel | Rename current panel |
| `?` | Help | Show all prefix shortcuts |

### Chat Panel Shortcuts

When a chat panel is focused:

| Key | Action |
|-----|--------|
| `Enter` | Send message (when input focused) |
| `Shift+Enter` | New line in message |
| `Ctrl+Enter` | Send message (from anywhere in panel) |
| `Ctrl+U` | Clear input |
| `Ctrl+P` | Previous message (edit history) |
| `Ctrl+N` | Next message (edit history) |
| `Page Up/Down` | Scroll chat history |
| `Ctrl+F` | Search in chat |
| `/` | Focus input (when not in input) |
| `Escape` | Cancel streaming / blur input |

### Sessions Panel Shortcuts

When sessions panel is focused:

| Key | Action |
|-----|--------|
| `j` / `↓` | Next session |
| `k` / `↑` | Previous session |
| `Enter` | Open chat for selected session |
| `l` / `→` | Open logs for selected session |
| `r` | Refresh sessions |
| `/` | Filter sessions |
| `f` | Toggle filter (Active/Idle/All) |

### Command Palette (`Ctrl+K`)

Searchable commands include:
- `> zen: exit` — Exit Zen Mode
- `> theme: tokyo night` — Switch theme
- `> layout: monitor` — Apply layout preset
- `> agent: assistent` — Focus Assistent's chat
- `> room: dev room` — Show Dev Room's tasks
- `> panel: add activity` — Add activity panel
- `> settings` — Open Zen Mode settings

---

## 7. Chat Integration

### Chat Panel Design

The chat panel is the primary interaction point in Zen Mode:

```
┌─────────────────────────────────────────────────────┐
│  ● Assistent                    [HQ] [⋮]  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────────────────────────┐           │
│  │ 10:42 USER                           │           │
│  │ Can you check the deployment status? │           │
│  └──────────────────────────────────────┘           │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ 10:42 ASSISTANT                              │   │
│  │ I'll check that now.                         │   │
│  │                                              │   │
│  │ ┌──────────────────────────────────────────┐ │   │
│  │ │ 🔧 exec: docker ps                    ✓  │ │   │
│  │ └──────────────────────────────────────────┘ │   │
│  │                                              │   │
│  │ The deployment is running. Container        │   │
│  │ `crewhub-frontend` shows healthy status.    │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
├─────────────────────────────────────────────────────┤
│ > Type a message...                    [↵ Send]     │
└─────────────────────────────────────────────────────┘
```

### Chat Display Features

1. **Compact Headers**: Timestamp + role on same line, minimal styling
2. **Message Alignment**: User right, Assistant left (or both left for terminal feel)
3. **Tool Calls**: Inline compact cards with icon, command preview, status
4. **Streaming**: Character-by-character with blinking cursor
5. **Code Blocks**: Syntax highlighted with copy button
6. **Images**: Thumbnail previews (click to expand)
7. **Markdown**: Full markdown rendering with compact styling
8. **Timestamps**: Relative (2m ago) with full timestamp on hover

### Multi-Agent Chat

Zen Mode supports multiple chat panels simultaneously:

- Each panel is independent (different agent)
- Keyboard shortcuts to switch between (`Alt+1-9`)
- Visual indicator for unread messages in unfocused panels
- Optional "unified" view showing all agent messages interleaved

### Input Features

- Auto-growing textarea (up to 6 lines, then scroll)
- Slash commands: `/clear`, `/history`, `/export`
- @-mentions for agent switching (`@dev` switches chat to Dev agent)
- File drop to attach (shows preview before send)
- Command history with `Ctrl+P` / `Ctrl+N`

---

## 8. Technical Implementation

### Component Architecture

```
src/components/zen/
├── ZenMode.tsx              # Main container, layout orchestrator
├── ZenTopBar.tsx            # Top bar with mode/theme/exit
├── ZenStatusBar.tsx         # Bottom status bar
├── ZenCommandPalette.tsx    # Ctrl+K command palette
├── ZenPanelContainer.tsx    # Grid/split panel manager
├── panels/
│   ├── ZenChatPanel.tsx     # Chat interface
│   ├── ZenSessionsPanel.tsx # Session list
│   ├── ZenActivityPanel.tsx # Real-time feed
│   ├── ZenRoomsPanel.tsx    # Room list
│   ├── ZenTasksPanel.tsx    # Task board
│   ├── ZenLogsPanel.tsx     # Log viewer
│   └── ZenDetailsPanel.tsx  # Agent/session details
├── hooks/
│   ├── useZenMode.ts        # Zen mode state and toggle
│   ├── useZenLayout.ts      # Panel layout management
│   ├── useZenKeyboard.ts    # Keyboard shortcut handling
│   └── useZenTheme.ts       # Theme management
├── themes/
│   ├── index.ts             # Theme registry
│   ├── tokyo-night.ts
│   ├── dracula.ts
│   └── ... (other themes)
└── ZenMode.css              # Base styles (or Tailwind classes)
```

### State Management

```typescript
interface ZenModeState {
  // Mode
  isActive: boolean;
  
  // Layout
  layout: PanelLayout;
  activeLayoutPreset: string | null;
  focusedPanelId: string;
  
  // Panels
  panels: ZenPanel[];
  
  // Theme
  themeId: string;
  
  // Keyboard
  prefixActive: boolean;
  prefixTimeout: number | null;
  
  // Agent context
  selectedAgentId: string | null;
  selectedRoomId: string | null;
}

interface ZenPanel {
  id: string;
  type: PanelType;
  position: { row: number; col: number; rowSpan: number; colSpan: number };
  state: PanelState; // Panel-specific state
}

type PanelType = 'chat' | 'sessions' | 'activity' | 'rooms' | 'tasks' | 'logs' | 'details';
```

### Integration Points

1. **Toggle from 3D World**: 
   - Add `Ctrl+Shift+Z` global listener in `App.tsx`
   - Conditionally render `<ZenMode />` or `<World3DView />` based on state
   - Preserve 3D world state in context (don't unmount, just hide)

2. **Reuse Existing Hooks**:
   ```typescript
   // In ZenChatPanel
   const { messages, sendMessage, isStreaming } = useAgentChat(agentSessionKey);
   
   // In ZenSessionsPanel  
   const { sessions, isLoading, refresh } = useSessions();
   
   // In ZenRoomsPanel
   const { rooms, isLoading } = useRooms();
   ```

3. **SSE Integration**: Activity feed connects to existing SSE stream at `/api/events`

4. **Settings Storage**: Zen mode preferences stored in existing `settings` table:
   ```json
   {
     "zen": {
       "theme": "tokyo-night",
       "layout": "default",
       "fontSize": 13,
       "customLayouts": [...],
       "shortcuts": { "prefix": "ctrl+b", ... }
     }
   }
   ```

### Performance Considerations

1. **Virtualized Lists**: Sessions and activity panels use `react-virtual` for long lists
2. **Lazy Panel Mounting**: Panels not visible in layout are not mounted
3. **Debounced Resize**: Panel resize events debounced to prevent excessive re-renders
4. **Memoized Components**: Heavy components wrapped in `React.memo`
5. **CSS Variables for Themes**: Theme switching is instant (no re-render, just CSS update)

### Accessibility

1. **Focus Management**: Proper focus trapping in panels
2. **ARIA Labels**: All panels and interactive elements have accessible names
3. **Keyboard Navigation**: Full keyboard support as documented
4. **High Contrast**: Ensure all themes meet WCAG AA contrast ratios
5. **Screen Reader**: Activity feed announces new events

---

## 9. Mockup Generation Prompts

For AI image generators (Midjourney, DALL-E, Flux, etc.):

### Prompt 1: Full Zen Mode Overview (Dark Theme)

```
A sleek, modern terminal-style dashboard interface for monitoring AI agents. 
Dark theme with deep blue-gray background (#1a1b26). 

The screen is divided into three vertical panels:
- Left panel (25%): List of AI agents with colored status dots (green=active, 
  yellow=thinking, gray=idle), showing names like "Assistent", "Dev", "Flowy"
- Center panel (50%): Chat interface with alternating message bubbles, user 
  messages on right in subtle blue, assistant messages on left in dark gray, 
  code blocks with syntax highlighting
- Right panel (25%): Real-time activity feed with timestamps and agent names

Top bar with minimal controls, bottom status bar showing "Assistent • HQ • Connected"

Monospace font (JetBrains Mono style), compact spacing, subtle 1px borders, 
accent color is soft blue (#7aa2f7). 

UI screenshot, high resolution, developer tools aesthetic, 4K render, 
professional software interface, tmux meets VS Code design language.
```

### Prompt 2: Multi-Chat Layout (Catppuccin Theme)

```
Terminal-style application interface with multiple chat windows side by side.
Catppuccin color palette - deep purple-black background (#1e1e2e) with 
pastel accent colors.

Two large chat panels dominate the screen, each showing a conversation with 
a different AI agent. Left chat labeled "Assistent" with purple accent, 
right chat labeled "Dev" with teal accent. Each has a compact input field 
at the bottom.

Narrow sidebar on far left shows minimal agent list with status indicators.

Bottom status bar shows keyboard shortcuts: "Ctrl+B for commands • Alt+1-2 switch chats"

Clean, minimal, information-dense, developer-focused UI. 
Monospace typography, subtle rounded corners (2px), no shadows.
High-fidelity UI mockup, Figma-quality render.
```

### Prompt 3: Monitor Layout (Nord Theme)

```
System monitoring dashboard with Nordic color palette - arctic blues and 
muted frost tones. Background #2e3440.

Split into two main areas:
- Left side (40%): Session table showing AI agent status with columns for 
  Status (colored dots), Agent Name, Room, Last Activity. Rows alternate 
  in subtle shading.
- Right side (60%): Scrolling activity log with timestamps, agent names in 
  colored badges, and event descriptions. Tool calls shown as compact inline 
  cards with checkmark icons.

Compact, terminal-inspired design. Monospace font throughout.
Top bar minimal, bottom bar shows connection status and time.

UI design screenshot, dashboard interface, clean data visualization, 
Scandinavian design aesthetic, high resolution render.
```

### Prompt 4: Light Theme Variant

```
Light theme terminal dashboard, GitHub-inspired color scheme.
Clean white background (#ffffff) with subtle gray panel backgrounds (#f6f8fa).

Three-panel layout:
- Sessions list on left with black text, blue accent on selected item
- Central chat area with light gray message bubbles, clear typography
- Activity feed on right with timestamp column and event descriptions

Professional, accessible design. High contrast text (black on white).
Thin gray borders separating panels. Blue (#0969da) accent for links 
and active states.

UI mockup, light mode, developer tools, accessible design, 
minimal interface, 4K screenshot render.
```

### Prompt 5: Task Board Focus

```
Dark terminal interface focused on task management. Gruvbox color palette - 
warm dark background (#282828) with earthy accent colors.

Three panels:
- Left: Room list with folder icons, showing "HQ (3)", "Dev Room (2)", etc.
  Selected room highlighted in warm yellow
- Center: Kanban-lite task board with three columns (To Do, In Progress, Done),
  tasks as compact cards with checkboxes, task titles in off-white text
- Right: Compact chat panel with recent messages from the agent assigned 
  to selected task

Retro-modern terminal aesthetic, information-dense, productivity-focused.
Monospace fonts, warm color temperature, subtle borders.

UI screenshot, task management interface, developer productivity tool, 
high resolution mockup.
```

---

## 10. Implementation Phases

### Phase 1: Core Foundation (Week 1)

**Goal**: Basic Zen Mode with single chat panel

- [ ] Create `ZenMode.tsx` container component
- [ ] Implement toggle mechanism (`Ctrl+Shift+Z`)
- [ ] Build `ZenTopBar` and `ZenStatusBar`
- [ ] Create `ZenChatPanel` (reusing `useAgentChat`)
- [ ] Implement Tokyo Night theme as default
- [ ] Basic keyboard navigation (tab between panels)

### Phase 2: Panel System (Week 2)

**Goal**: Multi-panel layouts with resizing

- [ ] Build `ZenPanelContainer` with CSS Grid
- [ ] Implement panel resize (keyboard-based)
- [ ] Create `ZenSessionsPanel`
- [ ] Create `ZenActivityPanel` (SSE feed)
- [ ] Implement layout presets (Default, Multi-Chat, Monitor)
- [ ] Add `Ctrl+1-9` panel focusing

### Phase 3: Themes & Polish (Week 3)

**Goal**: Full theme system and visual polish

- [ ] Implement all 9 built-in themes
- [ ] Create theme picker (`Ctrl+K T`)
- [ ] Add custom theme support (settings)
- [ ] Implement prefix-key system (`Ctrl+B + key`)
- [ ] Create `ZenCommandPalette` (`Ctrl+K`)
- [ ] Add keyboard shortcut overlay (`Ctrl+/`)

### Phase 4: Extended Panels (Week 4)

**Goal**: Complete panel suite

- [ ] Create `ZenRoomsPanel`
- [ ] Create `ZenTasksPanel`
- [ ] Create `ZenLogsPanel`
- [ ] Create `ZenDetailsPanel`
- [ ] Implement panel add/remove/swap
- [ ] Add layout save/load

### Phase 5: Polish & Testing (Week 5)

**Goal**: Production-ready Zen Mode

- [ ] Performance optimization (virtualization, memoization)
- [ ] Accessibility audit and fixes
- [ ] Mobile warning / responsive considerations
- [ ] Documentation and help system
- [ ] User testing and feedback iteration
- [ ] Settings UI for Zen Mode preferences

---

## Appendix A: CSS Custom Properties Reference

```css
:root[data-zen-theme="tokyo-night"] {
  /* Backgrounds */
  --zen-bg: #1a1b26;
  --zen-bg-panel: #24283b;
  --zen-bg-hover: #2f3549;
  --zen-bg-active: #3d4560;
  
  /* Foregrounds */
  --zen-fg: #c0caf5;
  --zen-fg-muted: #565f89;
  --zen-fg-dim: #3d4560;
  
  /* Borders */
  --zen-border: #3d4560;
  --zen-border-focus: #7aa2f7;
  
  /* Accent */
  --zen-accent: #7aa2f7;
  --zen-accent-hover: #89b4fa;
  
  /* Status */
  --zen-success: #9ece6a;
  --zen-warning: #e0af68;
  --zen-error: #f7768e;
  --zen-info: #7dcfff;
  
  /* Chat */
  --zen-user-bubble: #3d4560;
  --zen-assistant-bubble: #1e2030;
  
  /* Syntax */
  --zen-syntax-keyword: #bb9af7;
  --zen-syntax-string: #9ece6a;
  --zen-syntax-comment: #565f89;
  --zen-syntax-function: #7aa2f7;
  --zen-syntax-variable: #c0caf5;
  
  /* Typography */
  --zen-font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  --zen-font-size: 13px;
  --zen-line-height: 1.4;
  
  /* Spacing */
  --zen-space-xs: 4px;
  --zen-space-sm: 8px;
  --zen-space-md: 12px;
  --zen-space-lg: 16px;
  
  /* Borders */
  --zen-radius: 2px;
  --zen-border-width: 1px;
}
```

---

## Appendix B: Keyboard Shortcut Quick Reference

```
GLOBAL
  Ctrl+Shift+Z     Toggle Zen Mode
  Ctrl+K           Command Palette
  Ctrl+/           Show all shortcuts
  Tab / Shift+Tab  Next/Previous panel
  Ctrl+1-9         Focus panel by number
  Escape           Close/cancel/back

PREFIX MODE (Ctrl+B, then...)
  c                New chat panel
  s                Sessions panel
  a                Activity panel
  r                Rooms panel
  t                Tasks panel
  l                Logs panel
  x                Close panel
  z                Maximize toggle
  %                Split vertical
  "                Split horizontal
  Space            Layout picker
  Arrows           Resize panel
  { }              Swap panels
  1-9              Go to agent N
  ?                Help

CHAT PANEL
  Enter            Send message
  Shift+Enter      New line
  Ctrl+F           Search chat
  /                Focus input
  Page Up/Down     Scroll history
  Ctrl+P/N         Message history

SESSIONS PANEL
  j/k or ↑/↓      Navigate list
  Enter            Open chat
  l or →           Open logs
  /                Filter
  f                Toggle filter
```

---

*End of Design Document*
