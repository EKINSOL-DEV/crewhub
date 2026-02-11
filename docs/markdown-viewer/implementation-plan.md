# Markdown Viewer/Editor — Implementation Plan

## Status Overview

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Viewing (MVP) | ✅ Complete |
| Phase 2 | Project Docs | ✅ Complete |
| Phase 3 | Editing | ✅ Complete (project docs) |
| Phase 4 | Polish | 🔄 In Progress |

## Phase 1 — Viewing (MVP) ✅

- [x] Backend: `GET /api/agents/{id}/files` + `GET /api/agents/{id}/files/{path}`
- [x] MarkdownViewer component (react-markdown + remark-gfm + rehype-highlight)
- [x] BotInfoPanel Files tab (FileTree + inline preview)
- [x] FullscreenOverlay with TOC sidebar
- [x] CodeBlock with copy button
- [x] Zen-mode CSS variable theming

## Phase 2 — Project Documents ✅

- [x] Backend: `GET /api/projects/{id}/documents` + read endpoint
- [x] ProjectFilesSection component
- [x] Folder tree navigation (collapsible)
- [x] Integration in Room Info Panel
- [x] Project docs_path resolution (DB override → PROJECT_DATA_PATH fallback)

## Phase 3 — Editing ✅

- [x] MarkdownEditor component (CodeMirror 6)
- [x] `PUT /api/projects/{id}/documents/{path}` with .bak backup
- [x] Auto-save (2.5s debounce) + ⌘S manual save
- [x] Dirty state tracking + unsaved changes warning
- [x] View ↔ Edit toggle in FullscreenOverlay

**Gap:** `PUT /api/agents/{id}/files/{path}` not yet implemented (agent file editing).

## Phase 4 — Polish 🔄

### Remaining Work

| Feature | Effort | Priority |
|---------|--------|----------|
| Agent file write endpoint | S | High |
| Side-by-side mode (doc + 3D) | M | Medium |
| Full-text search | M | Medium |
| Recent docs history | S | Low |
| Favorites/bookmarks | S | Low |
| Breadcrumb navigation | S | Medium |
| Collapsible TOC sidebar | XS | Low |
| Light theme editor support | S | Low |
| Resizable inline preview | S | Low |
| Loading skeletons | XS | Low |
| Mermaid diagram support | M | Low |
| Version history / diff view | L | Future |
| Live collaboration | XL | Future |

### Recommended Next Steps

1. **Agent file write endpoint** — Mirror project_documents PUT pattern, add to agent_files.py
2. **Breadcrumb navigation** — Show path segments as clickable links in fullscreen header
3. **Side-by-side mode** — CSS grid split (50/50 or resizable) with 3D view on one side
4. **Search** — Backend: scan all files in workspace for query string; Frontend: search input in Files tab

## Architecture Notes

- All markdown components use CSS variables for theming (zen-mode compatible)
- FullscreenOverlay uses React portal + custom events to coordinate with 3D camera
- File tree scanning is synchronous (fast for small workspaces, may need async for large ones)
- CodeMirror editor is dark-only — needs theme abstraction for light mode
