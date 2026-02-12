# Markdown Viewer/Editor — Component Specification

> All components implemented in `frontend/src/components/markdown/` and `frontend/src/components/files/`.

## MarkdownViewer

**Location:** `components/markdown/MarkdownViewer.tsx` (124 lines)

```typescript
interface MarkdownViewerProps {
  content: string        // Raw markdown string
  className?: string     // Optional CSS class
  maxHeight?: string     // CSS max-height (default: none)
}
```

**Dependencies:** `react-markdown@9`, `remark-gfm`, `rehype-highlight`

**Rendered elements:** h1-h4 (with `id` slugs for TOC linking), p, ul/ol/li, a (external, target=_blank), blockquote, table/th/td, code (inline + block via CodeBlock), hr, img (remote only), checkbox inputs.

**Theming:** Uses CSS custom properties — `var(--zen-fg)` with fallback `hsl(var(--foreground))`. Max-width 720px. Font: system-ui, 14px, line-height 1.7.

---

## MarkdownEditor

**Location:** `components/markdown/MarkdownEditor.tsx` (203 lines)

```typescript
interface MarkdownEditorProps {
  initialContent: string       // Starting content
  onSave: (content: string) => Promise<void>  // Save callback
  onCancel: () => void         // Cancel/close callback
  onDirtyChange?: (dirty: boolean) => void    // Dirty state callback
  autoSaveMs?: number          // Auto-save debounce (default: 2500ms)
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
```

**Dependencies:** `@codemirror/state`, `@codemirror/view`, `@codemirror/lang-markdown`, `@codemirror/commands`, `@codemirror/language`

**Features:**
- Line numbers, active line highlight
- History (undo/redo)
- Line wrapping
- ⌘S to save, Escape to cancel
- Auto-save with configurable debounce
- Status bar: save status + Save/Cancel buttons
- Custom dark theme matching CrewHub palette

---

## FullscreenOverlay

**Location:** `components/markdown/FullscreenOverlay.tsx` (263 lines)

```typescript
interface FullscreenOverlayProps {
  open: boolean
  onClose: () => void
  title: string              // Filename
  subtitle?: string          // Agent name
  content: string
  metadata?: {
    size: number
    modified: string
    lines: number
  }
  editable?: boolean         // Show Edit button
  onSave?: (content: string) => Promise<void>
}
```

**Renders via:** `createPortal` to `document.body` (z-index 9999)

**Key behaviors:**
- Locks body scroll when open
- Disables pointer events on Three.js canvases (prevents camera interference)
- Dispatches `fullscreen-overlay` CustomEvent for CameraController
- Blocks document-level pointer events via capture-phase listeners
- Escape key closes (with dirty confirmation)
- Click outside closes
- Toggles between MarkdownViewer + TOCSidebar and MarkdownEditor

---

## TOCSidebar

**Location:** `components/markdown/TOCSidebar.tsx` (114 lines)

```typescript
interface TOCHeading {
  id: string      // Slugified heading text
  text: string    // Clean heading text
  level: number   // 1-4
}

interface TOCSidebarProps {
  headings: TOCHeading[]
  activeId?: string
  onSelect: (id: string) => void
}

// Utilities
function extractHeadings(content: string): TOCHeading[]
function useActiveHeading(headings: TOCHeading[], containerRef?: RefObject<HTMLElement>): string | undefined
```

**Active tracking:** IntersectionObserver with `rootMargin: '-20% 0px -70% 0px'`

**Width:** 240px fixed. Indentation: 12px per heading level.

---

## CodeBlock

**Location:** `components/markdown/CodeBlock.tsx` (71 lines)

Copy-to-clipboard button on hover. Language label from className.

---

## FilesTab

**Location:** `components/files/FilesTab.tsx` (116 lines)

```typescript
interface FilesTabProps {
  agentId: string
  agentName?: string
}
```

**Hooks:** `useAgentFiles(agentId)`, `useFileContent(agentId, path)`

**Layout:** FileTree (top, max 40% when file selected) + inline MarkdownViewer (bottom 60%) + FullscreenOverlay.

---

## FileTree

**Location:** `components/files/FileTree.tsx` (159 lines)

Recursive collapsible tree. File icons by extension. Click to select, expand button for fullscreen.

---

## ProjectFilesSection

**Location:** `components/files/ProjectFilesSection.tsx` (163 lines)

Same pattern as FilesTab but for project documents. Uses project documents API.

---

## Styling Approach

All components use **inline styles** with CSS custom properties (consistent with CrewHub's existing pattern — no CSS modules or Tailwind). Theme tokens:

| Token | Usage |
|-------|-------|
| `--foreground` | Text color |
| `--background` | Page background |
| `--card` | Panel/header background |
| `--border` | Borders |
| `--primary` | Accent (links, active TOC, buttons) |
| `--secondary` | Secondary backgrounds |
| `--muted-foreground` | Subdued text |
| `--zen-*` | Zen mode overrides |
