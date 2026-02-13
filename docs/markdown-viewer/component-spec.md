# Markdown Viewer/Editor — Component Specification

## Status: Implemented ✅

---

## MarkdownViewer

Renders markdown content with full GFM support.

```typescript
interface MarkdownViewerProps {
  content: string        // Raw markdown string
  className?: string     // Additional CSS class
  maxHeight?: string     // CSS max-height (scroll container)
}
```

**Dependencies:** `react-markdown`, `remark-gfm`, `rehype-highlight`

**Features:**
- Headings (h1-h4) with auto-generated `id` slugs for TOC linking
- GFM: tables, strikethrough, task lists, autolinks
- Code blocks with syntax highlighting (rehype-highlight)
- Inline code with monospace styling
- Blockquotes, lists (ordered/unordered), horizontal rules
- Images (remote only — local paths show `[Image: alt]` placeholder)
- Checkboxes (disabled, display only)
- Links open in new tab (`target="_blank"`)
- Zen mode CSS variable support (`--zen-fg`, `--zen-border`, etc.)
- Max content width: 720px

---

## MarkdownEditor

CodeMirror 6 based editor with auto-save.

```typescript
interface MarkdownEditorProps {
  initialContent: string              // Starting content
  onSave: (content: string) => Promise<void>  // Save handler
  onCancel: () => void                // Cancel/close handler
  onDirtyChange?: (dirty: boolean) => void    // Dirty state callback
  autoSaveMs?: number                 // Auto-save delay (default: 2500ms)
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
```

**Dependencies:** `@codemirror/state`, `@codemirror/view`, `@codemirror/lang-markdown`, `@codemirror/commands`, `@codemirror/language`

**Features:**
- Line numbers, active line highlighting
- Markdown syntax highlighting
- History (undo/redo)
- Line wrapping
- ⌘S to save, ESC to cancel (with dirty check confirm)
- Auto-save on 2.5s idle after changes
- Save status indicator (saving/saved/error)
- Dark theme matching CrewHub palette
- Auto-focus on mount

---

## FullscreenOverlay

Portal-based fullscreen document viewer/editor.

```typescript
interface FullscreenOverlayProps {
  open: boolean
  onClose: () => void
  title: string           // Filename
  subtitle?: string       // Agent name
  content: string
  metadata?: {
    size: number
    modified: string
    lines: number
  }
  editable?: boolean      // Show Edit button
  onSave?: (content: string) => Promise<void>
}
```

**Features:**
- `createPortal` to `document.body` (z-index 9999)
- TOC sidebar (auto-generated, collapsible by omission if no headings)
- Active heading tracking via IntersectionObserver
- Smooth scroll on TOC click
- View mode ↔ Edit mode toggle
- ESC to close, click-outside to close
- Body scroll lock while open
- Canvas pointer events disabled (prevents 3D camera interference)
- Camera controls blocked via `fullscreen-overlay` CustomEvent
- Backdrop blur + dark overlay
- Footer with file metadata (size, lines, modified date)

---

## TOCSidebar

Auto-generated table of contents from markdown headings.

```typescript
interface TOCHeading {
  id: string    // Slugified heading text
  text: string  // Plain heading text
  level: number // 1-4
}

interface TOCSidebarProps {
  headings: TOCHeading[]
  activeId?: string
  onSelect: (id: string) => void
}

// Utilities
function extractHeadings(content: string): TOCHeading[]
function useActiveHeading(headings: TOCHeading[], containerRef?): string | undefined
```

**Features:**
- 240px fixed width sidebar
- Indentation by heading level (12px per level)
- Active heading: blue highlight + left border
- Hover state on inactive items
- IntersectionObserver with `-20% 0px -70% 0px` margins

---

## FilesTab

Agent file browser in BotInfoPanel.

```typescript
interface FilesTabProps {
  agentId: string
  agentName?: string
}
```

**Layout:** File tree (top, max 40% when file selected) + inline preview (bottom, flex 1)

---

## FileTree

Collapsible file/folder tree.

```typescript
interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
  extension?: string
  children?: FileNode[]
}

interface FileTreeProps {
  files: FileNode[]
  selectedPath?: string
  onSelect: (file: FileNode) => void
  onExpand: (file: FileNode) => void
  loading?: boolean
}
```

---

## Styling Approach

All components use inline styles with CSS variables for theming:
- Standard: `hsl(var(--foreground))`, `hsl(var(--border))`, etc.
- Zen mode: `var(--zen-fg)`, `var(--zen-border)`, etc. with standard fallbacks
- CodeMirror: Custom `EditorView.theme()` with matching dark palette
- No external CSS files — fully self-contained components
