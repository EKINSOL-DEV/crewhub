# Markdown Viewer/Editor — UX Design

*Status: Phase 1-3 implemented, Phase 4 in progress*

## Component Hierarchy

```
App
├── BotInfoPanel
│   └── FilesTab                    ✅ Implemented
│       ├── FileTree                ✅ Implemented
│       ├── MarkdownViewer (inline) ✅ Implemented
│       └── FullscreenOverlay       ✅ Implemented
│           ├── TOCSidebar          ✅ Implemented
│           ├── MarkdownViewer      ✅ Implemented
│           └── MarkdownEditor      ✅ Implemented
├── RoomInfoPanel
│   └── ProjectFilesSection         ✅ Implemented
│       ├── FileTreeNode            ✅ Implemented
│       └── FullscreenOverlay       ✅ (reused)
└── ZenMode
    └── (MarkdownViewer reuse)      ✅ Implemented
```

## User Flows

### Flow 1: View Agent Files
1. Click bot in 3D world → BotInfoPanel opens
2. Switch to **Files** tab
3. File tree loads (MEMORY.md, SOUL.md, memory/, TOOLS.md, etc.)
4. Click file → inline preview appears (bottom 60%)
5. Click ⤢ Fullscreen → FullscreenOverlay opens

### Flow 2: Fullscreen Document Viewer
```
┌────────────────────────────────────────────────────┐
│  [✕] Close     📄 MEMORY.md     Assistent  [✏️ Edit]│  ← Header
├──────────┬─────────────────────────────────────────┤
│ CONTENTS │                                         │
│          │  # MEMORY.md — Ekinbot Long-Term ...    │
│ ▸ Team   │                                         │
│ ▸ Nicky  │  *Last updated: 2026-02-05*             │
│ ▸ Water..│                                         │
│ ▸ Planner│  ## Team Hiërarchie                     │
│ ▸ ...    │  ```                                    │
│          │  Nicky (Owner/CEO/CTO)                  │
│          │      ↓                                  │
│          │  Assistent (Director of Bots)            │
│          │  ```                                    │
├──────────┴─────────────────────────────────────────┤
│  4.2 KB  •  180 lines  •  Modified: Feb 5, 2026   │  ← Footer
└────────────────────────────────────────────────────┘
```

- **ESC** closes overlay
- **Click outside** closes overlay
- **TOC sidebar** has active heading highlight (IntersectionObserver)
- **Scroll to section** on TOC click (smooth scroll)

### Flow 3: Edit Document
1. In fullscreen overlay, click ✏️ Edit
2. CodeMirror 6 editor replaces viewer
3. Status bar: Save (⌘S) | Cancel (Esc) | auto-save indicator
4. Auto-save after 2.5s debounce
5. Dirty state tracking with unsaved changes warning
6. Cancel → confirm if dirty → back to viewer

### Flow 4: Project Documents
1. Open room → Room Info Panel
2. ProjectFilesSection shows project folder tree
3. Click file → opens FullscreenOverlay directly (no inline preview)
4. Editing supported via PUT endpoint (with .bak backup)

## Interaction Details

### Fullscreen Overlay
- **Portal**: Rendered via `createPortal` to `document.body`
- **Z-index**: 9999 (above everything)
- **3D blocking**: Disables canvas pointer events + dispatches `fullscreen-overlay` event to pause CameraControls
- **Body scroll lock**: `overflow: hidden` on body
- **Backdrop**: `rgba(0,0,0,0.85)` with `blur(4px)`

### File Tree
- Directories auto-expand at depth 0
- File icons: 📁 directory, 📝 .md, 📋 .json, ⚙️ .yaml, 📄 other
- Size shown in compact format (e.g., "4.2K")
- Selected file highlighted with primary color

### Markdown Rendering
- Max content width: 720px (centered)
- Font: system-ui, 14px, line-height 1.7
- Headings get auto-generated `id` slugs for TOC linking
- Code blocks: syntax highlighting (rehype-highlight), copy button, language label
- Tables: full border, scrollable overflow
- Images: remote only (local paths shown as `[Image: alt]`)
- Checkboxes: rendered but disabled

## Remaining UX Work (Phase 4)

### Not Yet Implemented
- [ ] Side-by-side mode (doc viewer + 3D view split)
- [ ] Recent docs history
- [ ] Favorites/bookmarks
- [ ] Full-text search across all docs
- [ ] Breadcrumb navigation in project docs
- [ ] Keyboard shortcuts (F11 for fullscreen from inline)
- [ ] Light theme support (currently dark-only styling)

### Known Issues
- Inline preview in FilesTab has fixed 40%/60% split — not resizable
- No loading skeleton (just "Loading…" text)
- TOC sidebar not collapsible
- Editor is dark-theme-only (hardcoded CodeMirror theme)
