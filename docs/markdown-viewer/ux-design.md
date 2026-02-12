# Markdown Viewer/Editor — UX Design

> Status: Phase 1 (Viewing) & Phase 3 (Editing) **COMPLETE**. Phase 2 & 4 in progress/planned.

## Current Implementation Summary

The Markdown Viewer/Editor system is already substantially built with:
- `MarkdownViewer` — react-markdown + GFM + syntax highlighting
- `MarkdownEditor` — CodeMirror 6 with dark theme, auto-save, ⌘S
- `FullscreenOverlay` — Portal-based fullscreen with TOC sidebar, edit mode, metadata footer
- `TOCSidebar` — Auto-generated from headings, IntersectionObserver active tracking
- `FilesTab` — File tree + inline preview + fullscreen button
- `FileTree` — Collapsible directory tree with icons
- `ProjectFilesSection` — Project document browsing

### Component Hierarchy

```
BotInfoPanel
  └── BotInfoTabs
        ├── Activity tab
        ├── Info tab
        ├── Actions tab
        └── Files tab ← FilesTab
              ├── FileTree (top 40%)
              ├── MarkdownViewer (bottom 60%, inline preview)
              └── FullscreenOverlay (portal to body)
                    ├── Header (title, subtitle, Edit button, Close)
                    ├── Body
                    │   ├── TOCSidebar (left 240px)
                    │   └── MarkdownViewer (center, max-width 720px)
                    │   OR
                    │   └── MarkdownEditor (CodeMirror 6, full width)
                    └── Footer (size, lines, modified date)
```

## User Flows

### Flow 1: View Agent File
```
Click bot → BotInfoPanel opens → Click "Files" tab
→ FileTree loads (API: GET /api/agents/{id}/files)
→ Click file → Inline preview appears (API: GET /api/agents/{id}/files/{path})
→ Click "⤢ Fullscreen" → FullscreenOverlay with TOC
→ Click TOC heading → Smooth scroll to section
→ Press Escape → Close overlay
```

### Flow 2: Edit Agent File
```
Open file in Fullscreen → Click "✏️ Edit" button
→ CodeMirror editor opens (replaces viewer)
→ Type changes → Auto-save after 2.5s debounce
→ Or press ⌘S → Immediate save (PUT /api/agents/{id}/files/{path})
→ Status bar shows: Saving... → ✓ Saved
→ Click "Cancel (Esc)" → Confirm discard if dirty → Back to viewer
```

### Flow 3: View Project Documents
```
Open project panel → ProjectFilesSection loads
→ Folder tree from GET /api/projects/{id}/documents
→ Click file → Preview/fullscreen (same as agent files)
→ Edit → PUT /api/projects/{id}/documents/{path}
```

## Wireframes

### FilesTab (in BotInfoPanel)
```
┌──────────────────────────────┐
│ 📂 Files                     │ ← Tab header
├──────────────────────────────┤
│ 📄 AGENTS.md                 │
│ 📄 MEMORY.md            ⤢   │ ← expand icon on hover
│ 📄 SOUL.md                   │
│ 📄 TOOLS.md                  │
│ 📁 memory/                   │
│   📄 2026-02-12.md           │
│   📄 2026-02-11.md           │
├──────────────────────────────┤
│ memory/2026-02-12.md    ⤢    │ ← path + fullscreen btn
│                              │
│ # Daily Notes                │ ← inline preview
│ - Worked on CrewHub v0.11    │   (MarkdownViewer)
│ - Fixed jitter bugs          │
│ ...                          │
└──────────────────────────────┘
```

### Fullscreen Overlay
```
┌──────────────────────────────────────────────────────────┐
│  📄 MEMORY.md    Assistent           [✏️ Edit]    [✕]   │
├────────────┬─────────────────────────────────────────────┤
│  CONTENTS  │                                             │
│            │  # MEMORY.md — Ekinbot Long-Term Memory     │
│  ● Team    │                                             │
│    Hiërar  │  *Last updated: 2026-02-05*                 │
│  ○ Nicky   │                                             │
│  ○ Water-  │  ## Team Hiërarchie                         │
│    leau    │  ```                                        │
│  ○ Ekinbot │  Nicky (Owner/CEO/CTO)                     │
│    Planner │      ↓                                      │
│  ○ Synol-  │  Assistent (Director of Bots)               │
│    ogy     │  ```                                        │
│  ...       │                                             │
├────────────┴─────────────────────────────────────────────┤
│  12.4 KB   │  342 lines  │  Modified: Feb 5, 2026       │
└──────────────────────────────────────────────────────────┘
```

### Edit Mode (replaces TOC + viewer)
```
┌──────────────────────────────────────────────────────────┐
│  📄 MEMORY.md    Assistent    ● Unsaved changes    [✕]  │
├──────────────────────────────────────────────────────────┤
│                           💾 Saving... [Save ⌘S] [Cancel]│
├──────────────────────────────────────────────────────────┤
│  1 │ # MEMORY.md — Ekinbot Long-Term Memory             │
│  2 │                                                     │
│  3 │ *Last updated: 2026-02-05*                          │
│  4 │                                                     │
│  5 │ ## Team Hiërarchie                                  │
│  6 │ ```                                                 │
│  7 │ Nicky (Owner/CEO/CTO)                               │
│  8 │     ↓                                               │
│  9 │ Assistent (jij - Director of Bots)                  │
│ 10 │ ```                                                 │
│    │ █                                                   │
└──────────────────────────────────────────────────────────┘
```

## Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| Escape | Fullscreen overlay | Close (confirm if dirty) |
| Escape | Edit mode | Cancel editing |
| ⌘S | Edit mode | Save immediately |

## Theme Integration

All components use CSS custom properties for theming:
- `hsl(var(--foreground))`, `hsl(var(--background))`, etc.
- Zen mode overrides via `var(--zen-fg)`, `var(--zen-bg)`, etc.
- CodeMirror uses custom `crewHubTheme` (dark mode matching CrewHub palette)

## Remaining Work

### Phase 2 — Project Documents Panel (TODO)
- Dedicated ProjectDocumentsPanel (not just in project settings)
- Breadcrumb navigation
- Recent/starred docs
- Search across project docs

### Phase 4 — Polish (TODO)
- Side-by-side mode (doc viewer + 3D world split)
- Recent docs history / favorites
- Full-text search across all docs
- Version history / diff view
- Mermaid diagram support
- LaTeX math rendering
