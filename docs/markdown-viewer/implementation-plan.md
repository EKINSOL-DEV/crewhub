# Markdown Viewer/Editor — Implementation Plan

## Phase Summary

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — Viewing (MVP) | ✅ Done | Backend API, MarkdownViewer, FilesTab, Fullscreen |
| 2 — Project Docs | ✅ Done | ProjectFilesSection, folder tree, project documents API |
| 3 — Editing | ✅ Done | CodeMirror editor, PUT endpoints, auto-save, dirty tracking |
| 4 — Polish | 🔜 Next | Side-by-side, search, conflict detection, extras |

---

## What's Built (Phases 1-3)

### Backend (~300 LOC)
- `routes/agent_files.py` — workspace file listing + read + write
- `routes/project_documents.py` — project docs listing + read + write
- Workspace resolution from settings DB or defaults
- Security: extension whitelist, path traversal protection, size limits

### Frontend (~1,200 LOC)
- `markdown/MarkdownViewer.tsx` — Full GFM rendering with syntax highlighting
- `markdown/MarkdownEditor.tsx` — CodeMirror 6 with auto-save
- `markdown/FullscreenOverlay.tsx` — Portal overlay with TOC + edit mode
- `markdown/TOCSidebar.tsx` — Auto-generated TOC with scroll tracking
- `markdown/CodeBlock.tsx` — Syntax highlighted code blocks
- `files/FilesTab.tsx` — Agent file browser
- `files/FileTree.tsx` — Collapsible tree component
- `files/ProjectFilesSection.tsx` — Project docs browser

### Dependencies (already installed)
- `react-markdown`, `remark-gfm`, `rehype-highlight`
- `@codemirror/state`, `@codemirror/view`, `@codemirror/lang-markdown`
- `@codemirror/commands`, `@codemirror/language`

---

## Phase 4 — Polish (Estimated: 2-3 days)

### 4.1 Side-by-Side Mode (~4h)
Split screen: markdown viewer on one side, 3D world on other.
- Resizable splitter (drag to resize)
- Toggle button in fullscreen header: "⬛ Fullscreen" ↔ "◧ Side-by-side"
- Persist preference in localStorage
- Re-enable canvas pointer events on the 3D side

### 4.2 In-Document Search (~3h)
- Ctrl+F / ⌘F in fullscreen viewer → search bar
- Highlight matches in rendered markdown
- Next/Previous navigation
- Match count display

### 4.3 Conflict Detection (~2h)
- On edit start: store file `modified` timestamp
- Before save: GET metadata, compare timestamps
- If changed: show "File was modified externally. Overwrite / Reload / Merge?"
- Polling: check every 30s while editing

### 4.4 Recent Docs & Favorites (~3h)
- localStorage history of recently viewed files (per agent, max 10)
- Star/favorite toggle on file items
- "Recent" section at top of FilesTab
- "Starred" filter toggle

### 4.5 Full-Text Search (~4h)
- New endpoint: `GET /api/agents/{id}/files/search?q=term`
- Backend: walk workspace, grep allowed files
- Frontend: search input above file tree, results list with snippets
- Click result → open file at matching line

### 4.6 Advanced Rendering (~2h)
- Mermaid diagrams: `rehype-mermaid` or lazy-load mermaid.js
- Math: `remark-math` + `rehype-katex`
- Only if needed — adds bundle size

### 4.7 Split Edit/Preview (~3h)
- Side-by-side: CodeMirror left, live MarkdownViewer right
- Synced scroll position
- Toggle: "Edit" | "Preview" | "Split"

---

## Dependencies & Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large files (>1MB) | Editor may lag | Already capped at 1MB |
| Synology Drive paths | Files may not be materialized | Skip unmaterialized, show warning |
| CodeMirror bundle size | ~150KB | Already loaded, acceptable |
| Mermaid bundle | ~500KB | Lazy-load only when diagram detected |

---

## Decision Log

- **react-markdown over marked**: Better React integration, component overrides
- **CodeMirror 6 over Monaco**: Lighter weight, better mobile, sufficient for markdown
- **Portal overlay over route**: Preserves 3D state, no navigation needed
- **Inline styles over CSS modules**: Consistent with CrewHub codebase, theme var access
- **Auto-save over manual-only**: Better UX, 2.5s debounce prevents data loss
