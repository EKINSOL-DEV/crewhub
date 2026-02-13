# Markdown Viewer/Editor — UX Design

## Status: Phase 1-3 Implemented ✅

Most of the original design is already built. This document captures the current state and remaining polish items.

## Current Architecture

### Components

```
MarkdownViewer          — react-markdown + remark-gfm + rehype-highlight
├── CodeBlock           — Syntax highlighted code with copy button
MarkdownEditor          — CodeMirror 6 with auto-save (2.5s debounce)
FullscreenOverlay       — Portal-based fullscreen with TOC + Edit mode
TOCSidebar              — Auto-generated from headings, IntersectionObserver tracking
FilesTab                — Agent file browser (BotInfoPanel)
├── FileTree            — Collapsible tree with icons
ProjectFilesSection     — Project docs browser
RoomFilesTab            — Room-level file access
```

### Backend Routes

```
GET  /api/agents/{agent_id}/files         — List workspace files
GET  /api/agents/{agent_id}/files/{path}  — Read file content + metadata
PUT  /api/agents/{agent_id}/files/{path}  — Write file (editing)

GET  /api/projects/{project_id}/documents         — Folder tree
GET  /api/projects/{project_id}/documents/{path}  — Read document
PUT  /api/projects/{project_id}/documents/{path}  — Write document
```

## User Flows

### 1. View Agent Files
```
Click bot → BotInfoPanel → Files tab → FileTree shows workspace
  → Click file → Inline preview (MarkdownViewer, 60% panel height)
  → Click "⤢ Fullscreen" → FullscreenOverlay with TOC sidebar
  → ESC or ✕ → Close overlay
```

### 2. Edit Agent Files
```
Fullscreen overlay → Click "✏️ Edit" → CodeMirror editor replaces viewer
  → Auto-save after 2.5s idle, or ⌘S manual save
  → "● Unsaved changes" indicator in header
  → ESC or Cancel → Confirm dialog if dirty → Back to viewer
```

### 3. View Project Documents
```
Room focus → RoomFilesTab or ProjectFilesSection
  → Folder tree with collapsible dirs
  → Click file → Preview → Fullscreen
```

## Fullscreen Overlay Layout (Implemented)

```
┌──────────────────────────────────────────────────┐
│  📄 MEMORY.md    [subtitle]    [✏️ Edit]    [✕]  │  ← Header
├──────────┬───────────────────────────────────────┤
│ Contents │                                       │
│ ────────│  # MEMORY.md — Ekinbot Long-Term...   │
│ • Team   │                                       │
│ • Nicky  │  *Last updated: 2026-02-05*           │
│ • Water..│                                       │
│ • Ekinb..│  ## Team Hiërarchie                   │
│ • ...    │  ...                                  │
│          │                                       │
├──────────┴───────────────────────────────────────┤
│  3.2 KB    142 lines    Modified: Feb 5, 2026    │  ← Footer
└──────────────────────────────────────────────────┘
```

Key behaviors:
- Click outside overlay → close
- ESC → close
- TOC sidebar: active heading highlighted (IntersectionObserver)
- Click TOC item → smooth scroll
- Canvas pointer events disabled while overlay open
- Camera controls blocked via CustomEvent dispatch
- Body scroll locked

### Edit Mode Layout
```
┌──────────────────────────────────────────────────┐
│  📄 MEMORY.md   ● Unsaved changes          [✕]  │
├──────────────────────────────────────────────────┤
│                    [💾 Saving...] [Save] [Cancel] │  ← Status bar
├──────────────────────────────────────────────────┤
│  1 │ # MEMORY.md — Ekinbot Long-Term Memory     │
│  2 │                                             │  ← CodeMirror 6
│  3 │ *Last updated: 2026-02-05*                  │
│  4 │                                             │
│  5 │ ## Team Hiërarchie                          │
│ ...│                                             │
└──────────────────────────────────────────────────┘
```

## Theme Integration

All components use CSS variables:
- `--zen-fg`, `--zen-bg`, `--zen-border`, `--zen-accent` (Zen mode)
- Falls back to `hsl(var(--foreground))` etc. (standard theme)
- CodeMirror has custom dark theme matching CrewHub palette
- Max content width: 720px (centered)

## Remaining Work (Phase 4 — Polish)

### High Priority
- [ ] Side-by-side mode (doc viewer alongside 3D view as resizable split)
- [ ] Search within document (Ctrl+F in fullscreen)
- [ ] Conflict detection (file changed while editing)

### Medium Priority
- [ ] Recent docs history (localStorage)
- [ ] Favorites/bookmarks per agent
- [ ] Full-text search across all docs
- [ ] Breadcrumb navigation for nested project docs

### Low Priority / Future
- [ ] Mermaid diagram support (`rehype-mermaid`)
- [ ] LaTeX math rendering (`remark-math` + `rehype-katex`)
- [ ] Export to PDF
- [ ] Live collaboration
- [ ] Version history / diff view
- [ ] Split view edit mode (editor | preview side-by-side)
