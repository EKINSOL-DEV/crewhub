# Markdown Viewer/Editor — Implementation Plan

## Status Overview

| Phase | Status | Components |
|-------|--------|------------|
| **Phase 1 — Viewing** | ✅ Complete | MarkdownViewer, TOCSidebar, FileTree, FilesTab, FullscreenOverlay |
| **Phase 2 — Project Docs** | ✅ Complete | ProjectFilesSection, project_documents.py API |
| **Phase 3 — Editing** | ✅ Complete | MarkdownEditor (CodeMirror 6), PUT endpoints, auto-save |
| **Phase 4 — Polish** | 🔲 Planned | Side-by-side, search, history, advanced rendering |

## What's Built (Phases 1-3)

### Frontend (1,213 lines across 8 components)
- `MarkdownViewer` — react-markdown + GFM + rehype-highlight (124 lines)
- `MarkdownEditor` — CodeMirror 6 with auto-save, dark theme (203 lines)
- `FullscreenOverlay` — Portal overlay, TOC, view/edit toggle (263 lines)
- `TOCSidebar` — Auto-generated, IntersectionObserver tracking (114 lines)
- `CodeBlock` — Syntax highlighted with copy button (71 lines)
- `FilesTab` — Agent file browser with tree + preview (116 lines)
- `FileTree` — Recursive collapsible directory tree (159 lines)
- `ProjectFilesSection` — Project document browser (163 lines)

### Backend (2 route files)
- `agent_files.py` — GET list, GET read, PUT save for agent workspaces
- `project_documents.py` — GET list, GET read, PUT save for project docs
- Security: path traversal protection, extension allowlist, 1MB size limit
- Workspace resolution from settings DB with fallback defaults

### Dependencies (already installed)
- `react-markdown@9`, `remark-gfm`, `rehype-highlight`
- `@codemirror/state`, `@codemirror/view`, `@codemirror/lang-markdown`, `@codemirror/commands`, `@codemirror/language`

---

## Phase 4 — Polish (Remaining Work)

### 4a. Side-by-Side Mode (~1 day)
Split the main viewport: 3D world left, document viewer right.

**Approach:**
- New `SplitViewLayout` wrapper component
- Toggle button in FullscreenOverlay header: "📐 Side-by-side"
- CSS Grid: `grid-template-columns: 1fr 480px`
- Escape or close button returns to full 3D
- Remember preference in localStorage

**Estimate:** 4-6 hours

### 4b. Full-Text Search (~1 day)
Search across all agent files or project documents.

**Backend:**
- `GET /api/agents/{id}/files/search?q=term` — grep-style search
- Return: `[{ path, line, lineNumber, context }]`
- Use Python `pathlib` + simple string matching (no index needed for <1000 files)

**Frontend:**
- Search input in FilesTab header
- Results list with path + highlighted match + click to open
- Debounced search (300ms)

**Estimate:** 6-8 hours

### 4c. Recent/Favorites (~0.5 day)
Track recently opened and starred files.

**Storage:** localStorage (`crewhub-recent-files`, `crewhub-favorite-files`)
**UI:** "Recent" section at top of FileTree, ★ toggle on file items

**Estimate:** 3-4 hours

### 4d. Version History / Diff View (~2 days)
Show git history for files in git-tracked workspaces.

**Backend:**
- `GET /api/agents/{id}/files/{path}/history` → `git log --oneline -20 -- {path}`
- `GET /api/agents/{id}/files/{path}/diff?ref=HEAD~1` → `git diff`

**Frontend:**
- History panel in FullscreenOverlay (tab or dropdown)
- Diff rendering: `react-diff-viewer` or simple line-by-line coloring

**Estimate:** 12-16 hours

### 4e. Advanced Rendering (~1 day)
- **Mermaid diagrams:** `rehype-mermaid` or lazy-load mermaid.js for ```mermaid blocks
- **Math/LaTeX:** `remark-math` + `rehype-katex`
- **Checkbox toggle:** Click to toggle `- [ ]` / `- [x]` and auto-save

**Estimate:** 6-8 hours

---

## Priority Recommendation

1. **4b. Search** — Highest user value, finding files quickly
2. **4c. Recent/Favorites** — Quick wins, improves daily workflow
3. **4a. Side-by-Side** — Nice for doc review while monitoring 3D world
4. **4e. Advanced Rendering** — Mermaid diagrams especially useful for design docs
5. **4d. Version History** — Lower priority, git CLI available as fallback

**Total Phase 4 estimate:** 3-5 days of dev work

---

## Architecture Notes

- All markdown components are **standalone** — reusable outside BotInfoPanel
- Inline styles with CSS custom properties (no CSS modules) — matches CrewHub convention
- FullscreenOverlay uses **createPortal** to escape any parent overflow/z-index stacking
- Camera interference handled via pointer-event blocking + CustomEvent notification
- Backend uses **path traversal protection** (`_is_safe_path`) on all file operations
