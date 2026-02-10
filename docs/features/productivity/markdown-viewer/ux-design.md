# Markdown Viewer/Editor — UX Design

*Created: 2026-02-10*

## 1. Entry Points

### 1.1 Bot Info Panel → Files Tab

Current tabs: `Activity | Info | Actions`
New tabs: `Activity | Info | Files | Actions`

```
┌─ BotInfoPanel ──────────────────────┐
│  [Activity] [Info] [Files] [Actions] │
├──────────────────────────────────────┤
│  📄 SOUL.md              1.2 KB  ↗  │  ← file list
│  📄 MEMORY.md           12.4 KB  ↗  │     ↗ = fullscreen
│  📄 TOOLS.md             3.1 KB  ↗  │
│  📁 memory/                     ▶   │  ← expandable
│  │  📄 2026-02-10.md     0.8 KB     │
│  │  📄 2026-02-09.md     1.1 KB     │
│  📄 AGENTS.md            4.2 KB  ↗  │
├──────────────────────────────────────┤
│         ── Preview ──                │
│                                      │
│  # SOUL.md - Who You Are             │  ← inline preview
│  *You're not a chatbot...*           │     of selected file
│                                      │
│  ## Core Truths                      │
│  **Be genuinely helpful...**         │
│                                      │
│              [⛶ Fullscreen]          │
└──────────────────────────────────────┘
```

**Interaction:**
- Click file → show inline preview below list
- Click ↗ or double-click → fullscreen overlay
- Click folder → expand/collapse
- File list sorted: SOUL → MEMORY → TOOLS → AGENTS → memory/

### 1.2 Project Documents (Phase 2)

Accessible from Room Focus → Project panel, or HQ.

```
┌─ Project: CrewHub ──────────────────┐
│  [Tasks] [Documents] [Activity]      │
├──────────────────────────────────────┤
│  📁 docs/                            │
│  │  📄 3d-world-design.md            │
│  │  📄 onboarding-analysis.md        │
│  │  📁 markdown-viewer/              │
│  │  │  📄 ux-design.md               │
│  │  │  📄 api-spec.md                │
│  📁 plans/                           │
│  │  📄 roadmap.md                    │
├──────────────────────────────────────┤
│  > docs / markdown-viewer / ux-de... │  ← breadcrumb
│                                      │
│  [rendered markdown content]         │
│              [⛶ Fullscreen]          │
└──────────────────────────────────────┘
```

## 2. Fullscreen Overlay

Triggered by: ↗ button, double-click, or `F` key when file selected.
Closed by: `Escape`, X button, or clicking outside.

```
┌──────────────────────────────────────────────────────────────┐
│  [✕]  MEMORY.md — Assistent              [Edit ✏️] [Raw 📝]  │
├────────────┬─────────────────────────────────────────────────┤
│            │                                                 │
│  Contents  │  # MEMORY.md — Ekinbot Long-Term Memory         │
│            │                                                 │
│  ▸ Team    │  *Last updated: 2026-02-05*                     │
│  ▸ Nicky   │                                                 │
│  ▸ Water.. │  ## Team Hiërarchie                              │
│  ▸ Planner │                                                 │
│  ▸ Synol.. │  ```                                            │
│  ▸ Comms   │  Nicky (Owner/CEO/CTO)                          │
│  ▸ Cron    │      ↓                                          │
│  ▸ Rules   │  Assistent (jij - Director of Bots)             │
│  ▸ Audio   │  ```                                            │
│  ▸ Flowz   │                                                 │
│  ▸ CrewHub │  ## Nicky — Key Facts                            │
│            │  - Full name: Nicky Goethals                     │
│            │  - Location: Zedelgem, Belgium                   │
│            │                                                 │
│            │  ## Waterleau Data Platform                       │
│            │  - Nicky is Technical Lead...                    │
│            │                                                 │
├────────────┴─────────────────────────────────────────────────┤
│  Last modified: 2026-02-05 · 12.4 KB · 287 lines            │
└──────────────────────────────────────────────────────────────┘
```

**Layout:**
- TOC sidebar: 200px, collapsible (toggle with `T` key)
- Content: centered, `max-width: 720px`, comfortable reading
- Header: sticky, file name + agent name, action buttons
- Footer: metadata bar

**TOC Behavior:**
- Auto-generated from h2/h3 headings
- Click → smooth scroll to section
- Active section highlighted as user scrolls
- Collapsible on mobile/narrow panels

## 3. Side-by-Side Mode (Phase 4)

Split the viewport: 3D world left, document right.

```
┌──────────────────────┬───────────────────────┐
│                      │  MEMORY.md            │
│    [3D World]        │                       │
│                      │  ## Team Hiërarchie    │
│   🤖  🤖             │  ...                  │
│                      │                       │
│                      │  ## Key Facts          │
│                      │  ...                  │
└──────────────────────┴───────────────────────┘
```

Trigger: drag fullscreen edge, or `Split View` button.

## 4. Editing Mode (Phase 3)

### Split Editor (Preferred)

```
┌──────────────────────────────────────────────────────────────┐
│  [✕]  SOUL.md — Editing              [Save 💾] [Cancel]      │
├─────────────────────────┬────────────────────────────────────┤
│                         │                                    │
│  # SOUL.md - Who You    │  # SOUL.md - Who You Are           │
│  Are                    │                                    │
│                         │  *You're not a chatbot.*           │
│  *You're not a chatbot  │                                    │
│  .*                     │  ## Core Truths                     │
│                         │  **Be genuinely helpful...**       │
│  ## Core Truths         │                                    │
│  **Be genuinely help    │                                    │
│  ful...**               │                                    │
│                         │                                    │
│   [Editor - CodeMirror] │   [Preview - react-markdown]       │
├─────────────────────────┴────────────────────────────────────┤
│  ● Unsaved changes · Auto-save in 3s                         │
└──────────────────────────────────────────────────────────────┘
```

## 5. Component Hierarchy

```
App
├── BotInfoPanel
│   └── FilesTab
│       ├── FileTree (list of files)
│       └── InlineMarkdownPreview
├── ProjectPanel (Phase 2)
│   ├── FolderTree
│   ├── Breadcrumb
│   └── InlineMarkdownPreview
├── FullscreenOverlay (portal)
│   ├── FullscreenHeader
│   ├── TOCSidebar
│   ├── MarkdownViewer
│   └── MetadataFooter
└── MarkdownEditor (Phase 3, portal)
    ├── EditorPane (CodeMirror)
    └── PreviewPane (MarkdownViewer)
```

## 6. User Flows

### View Agent File
1. Click bot in 3D → BotInfoPanel opens
2. Click "Files" tab
3. File list loads (GET /api/agents/{id}/files)
4. Click file → inline preview appears
5. Click ↗ → fullscreen overlay opens
6. Browse with TOC, scroll, Escape to close

### View Project Document
1. Enter room focus → click project tab "Documents"
2. Folder tree loads (GET /api/projects/{id}/documents)
3. Navigate folders via tree or breadcrumb
4. Click document → preview
5. Fullscreen available

### Edit File (Phase 3)
1. In fullscreen, click "Edit ✏️"
2. Split editor opens (source | preview)
3. Edit markdown, see live preview
4. Auto-save after 2s idle, or manual Save
5. If conflict detected → "File changed on disk" warning with merge options

## 7. Theming

Match CrewHub's existing aesthetic:
- Background: `var(--bg-primary)` (dark mode default)
- Text: `var(--text-primary)`
- Code blocks: slightly darker bg, `JetBrains Mono` or `Fira Code`
- Headings: CrewHub accent color
- Links: standard blue, hover underline
- Tables: bordered, alternating row colors
- Blockquotes: left border accent

Fullscreen overlay: slight backdrop blur over 3D world.
