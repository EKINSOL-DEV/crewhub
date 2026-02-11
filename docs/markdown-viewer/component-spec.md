# Markdown Viewer/Editor — Component Spec

## Components (All Implemented)

### MarkdownViewer
**Location:** `src/components/markdown/MarkdownViewer.tsx`

```typescript
interface MarkdownViewerProps {
  content: string        // Raw markdown string
  className?: string     // CSS class
  maxHeight?: string     // Scrollable container height
}
```

**Stack:** react-markdown + remark-gfm + rehype-highlight
**Features:** Auto-slugified heading IDs, code copy buttons, GFM tables, checkbox rendering, remote images only
**Theming:** CSS variables (`--zen-fg`, `--zen-border`, `--zen-accent`, `--zen-bg-elevated`) with HSL fallbacks

### MarkdownEditor
**Location:** `src/components/markdown/MarkdownEditor.tsx`

```typescript
interface MarkdownEditorProps {
  initialContent: string
  onSave: (content: string) => Promise<void>
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  autoSaveMs?: number    // Default: 2500ms
}
```

**Stack:** CodeMirror 6 (@codemirror/lang-markdown, @codemirror/commands)
**Features:** Line numbers, active line highlight, history (undo/redo), ⌘S save, ESC cancel, auto-save with debounce, dirty state tracking
**Theme:** Custom dark theme matching CrewHub (hardcoded HSL values)

### FullscreenOverlay
**Location:** `src/components/markdown/FullscreenOverlay.tsx`

```typescript
interface FullscreenOverlayProps {
  open: boolean
  onClose: () => void
  title: string           // Filename
  subtitle?: string       // Agent/project name
  content: string
  metadata?: { size: number; modified: string; lines: number }
  editable?: boolean
  onSave?: (content: string) => Promise<void>
}
```

**Features:** Portal to body, ESC close, backdrop click close, TOC sidebar, view/edit toggle, body scroll lock, 3D canvas pointer blocking, camera-controls event blocking

### TOCSidebar
**Location:** `src/components/markdown/TOCSidebar.tsx`

```typescript
interface TOCSidebarProps {
  headings: TOCHeading[]
  activeId?: string
  onSelect: (id: string) => void
}

interface TOCHeading {
  id: string    // Slugified
  text: string  // Clean text
  level: number // 1-4
}
```

**Helpers:** `extractHeadings(content)` — regex-based H1-H4 extraction; `useActiveHeading(headings)` — IntersectionObserver-based scroll tracking

### CodeBlock
**Location:** `src/components/markdown/CodeBlock.tsx`

```typescript
interface CodeBlockProps {
  className?: string    // "language-xxx" from rehype
  children: React.ReactNode
}
```

**Features:** Language label, copy-to-clipboard button with feedback

### FileTree
**Location:** `src/components/files/FileTree.tsx`

```typescript
interface FileTreeProps {
  files: FileNode[]
  selectedPath?: string
  onSelect: (file: FileNode) => void
  onExpand?: (file: FileNode) => void
  loading?: boolean
}
```

### FilesTab
**Location:** `src/components/files/FilesTab.tsx`

```typescript
interface FilesTabProps {
  agentId: string
  agentName?: string
}
```

Composes FileTree + MarkdownViewer (inline) + FullscreenOverlay.

### ProjectFilesSection
**Location:** `src/components/files/ProjectFilesSection.tsx`

```typescript
interface ProjectFilesSectionProps {
  projectId: string
  projectName: string
  projectColor?: string
}
```

Compact file tree for room info panel. Opens fullscreen directly on file click.

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react-markdown | ^9.1.0 | Markdown → React |
| remark-gfm | ^4.0.1 | GFM tables, strikethrough, task lists |
| rehype-highlight | (bundled) | Syntax highlighting |
| @codemirror/lang-markdown | ^6.5.0 | Editor language support |
| @codemirror/commands | ^6.10.2 | Keybindings |
| @codemirror/state | ^6.5.4 | Editor state |
| @codemirror/view | ^6.39.13 | Editor view + extensions |

## Hooks

- `useAgentFiles(agentId)` → `{ files, loading, error }`
- `useFileContent(agentId, path)` → `{ content, metadata, loading }`
- `useProjectDocuments(projectId)` → `{ files, loading, error }`
- `useProjectDocumentContent(projectId, path)` → `{ content, metadata }`
