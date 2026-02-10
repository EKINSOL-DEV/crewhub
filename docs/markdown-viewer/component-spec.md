# Markdown Viewer/Editor — Component Specification

*Created: 2026-02-10*

## 1. MarkdownViewer

Core read-only renderer. Used inline and in fullscreen.

```typescript
interface MarkdownViewerProps {
  content: string;
  className?: string;
  maxHeight?: string;          // CSS max-height for inline mode
  showTOC?: boolean;           // Show table of contents sidebar
  onHeadingClick?: (id: string) => void;
  highlightLine?: number;      // Highlight specific line
}
```

**Implementation:**
- Library: `react-markdown` + `remark-gfm` (tables, strikethrough, task lists)
- Code highlighting: `rehype-highlight` with `highlight.js` (lighter than Prism for our needs)
- Code block features: language label, copy button
- Heading IDs: auto-generated slugs for TOC linking
- Images: render if URL, skip local paths (security)

**Styling approach:**
- CSS module: `MarkdownViewer.module.css`
- Scoped under `.markdown-body` class
- Inherits CrewHub CSS variables for colors
- Responsive: adjusts font size and padding for narrow panels

```css
.markdown-body {
  font-family: var(--font-body);
  color: var(--text-primary);
  line-height: 1.7;
  max-width: 720px;
}
.markdown-body h2 { color: var(--accent); border-bottom: 1px solid var(--border); }
.markdown-body pre { background: var(--bg-tertiary); border-radius: 8px; padding: 16px; }
.markdown-body code { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.9em; }
.markdown-body table { border-collapse: collapse; width: 100%; }
.markdown-body td, .markdown-body th { border: 1px solid var(--border); padding: 8px 12px; }
```

## 2. TOCSidebar

Auto-generated from markdown headings.

```typescript
interface TOCSidebarProps {
  headings: { id: string; text: string; level: number }[];
  activeId?: string;           // Currently visible heading
  onSelect: (id: string) => void;
  collapsed?: boolean;
  onToggle?: () => void;
}
```

**Active tracking:** Uses `IntersectionObserver` on heading elements.

## 3. FileTree

Displays agent files or project documents as a tree.

```typescript
interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  lines?: number;
  children?: FileNode[];
}

interface FileTreeProps {
  files: FileNode[];
  selectedPath?: string;
  onSelect: (file: FileNode) => void;
  onExpand?: (file: FileNode) => void;  // Fullscreen button
  loading?: boolean;
}
```

**Visual:** Indented list with folder/file icons. Folders toggle open/closed. Selected file highlighted.

## 4. FilesTab

New tab in BotInfoPanel.

```typescript
interface FilesTabProps {
  agentId: string;
}
```

**State:**
- `files: FileNode[]` — loaded from API on mount
- `selectedFile: string | null` — currently previewed file
- `fileContent: string | null` — loaded on file select
- `fullscreenOpen: boolean`

**Layout:** Top half = FileTree, bottom half = inline MarkdownViewer preview. Divider draggable.

## 5. FullscreenOverlay

Portal-rendered overlay for immersive reading.

```typescript
interface FullscreenOverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;          // e.g., agent name
  content: string;
  metadata?: {
    size: number;
    modified: string;
    lines: number;
  };
  onEdit?: () => void;        // Phase 3: show edit button
}
```

**Behavior:**
- Renders via React portal to document body
- Backdrop: `rgba(0,0,0,0.85)` with `backdrop-filter: blur(4px)`
- Close: Escape key, X button, click backdrop
- Animates in: fade + slight scale (200ms)
- Traps focus inside overlay
- Body scroll locked while open

## 6. MarkdownEditor (Phase 3)

```typescript
interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave: (content: string) => Promise<void>;
  readOnly?: boolean;
  filePath: string;
  conflictWarning?: boolean;
}
```

**Implementation:**
- Editor: CodeMirror 6 (`@codemirror/lang-markdown`)
  - Rationale: lighter than Monaco, better markdown support, good mobile behavior
- Layout: split pane (editor left, preview right), toggle to full-editor or full-preview
- Auto-save: debounced 2000ms after last keystroke
- Unsaved indicator: dot in tab/header
- Keyboard shortcuts: `Cmd+S` save, `Cmd+B` bold, `Cmd+I` italic

## 7. Hooks

```typescript
// Fetch file list for an agent
function useAgentFiles(agentId: string): {
  files: FileNode[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// Fetch single file content
function useFileContent(agentId: string, path: string | null): {
  content: string | null;
  metadata: FileMetadata | null;
  loading: boolean;
  error: string | null;
}

// Same pattern for project documents
function useProjectDocuments(projectId: string): { ... }
function useProjectDocument(projectId: string, path: string | null): { ... }
```

## 8. Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `react-markdown` | MD → React | ~12KB |
| `remark-gfm` | GFM tables/tasks | ~3KB |
| `rehype-highlight` | Code highlighting | ~2KB |
| `highlight.js` (subset) | Language grammars | ~30KB (with tree-shaking) |
| `@codemirror/lang-markdown` | Editor (Phase 3) | ~50KB |

All are well-maintained, widely used, and tree-shakeable.

## 9. File Organization

```
frontend/src/
├── components/
│   ├── markdown/
│   │   ├── MarkdownViewer.tsx
│   │   ├── MarkdownViewer.module.css
│   │   ├── MarkdownEditor.tsx        (Phase 3)
│   │   ├── TOCSidebar.tsx
│   │   ├── FullscreenOverlay.tsx
│   │   └── CodeBlock.tsx             (copy button wrapper)
│   ├── files/
│   │   ├── FileTree.tsx
│   │   ├── FilesTab.tsx
│   │   └── ProjectDocumentsPanel.tsx  (Phase 2)
├── hooks/
│   ├── useAgentFiles.ts
│   ├── useFileContent.ts
│   └── useProjectDocuments.ts        (Phase 2)
```
