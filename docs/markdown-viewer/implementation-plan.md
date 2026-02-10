# Markdown Viewer/Editor — Implementation Plan

*Created: 2026-02-10*

## Phase 1: Agent File Viewing (MVP)

**Goal:** Click bot → Files tab → see MEMORY.md rendered → fullscreen
**Estimate:** 4-6 hours

### Tasks

1. **Backend: Agent files endpoints** (~1.5h)
   - GET `/api/agents/{id}/files` — list workspace .md files
   - GET `/api/agents/{id}/files/{path}` — read file content
   - Agent workspace mapping in settings table
   - Path traversal security, extension whitelist, size limit
   - Tests

2. **Frontend: MarkdownViewer component** (~1h)
   - Install `react-markdown`, `remark-gfm`, `rehype-highlight`
   - MarkdownViewer with heading slugs, code copy, GFM support
   - CSS module matching CrewHub theme
   - CodeBlock wrapper with copy button

3. **Frontend: FileTree + FilesTab** (~1h)
   - FileTree component (expandable folders, file icons)
   - FilesTab in BotInfoPanel (new tab)
   - useAgentFiles + useFileContent hooks
   - Split layout: file list top, preview bottom

4. **Frontend: FullscreenOverlay** (~1h)
   - Portal overlay with backdrop blur
   - TOCSidebar (auto-generated, IntersectionObserver)
   - Header (title, close, edit placeholder)
   - Footer (metadata)
   - Keyboard: Escape close, T toggle TOC

5. **Integration + testing** (~0.5h)
   - Wire FilesTab into BotInfoPanel tabs
   - Test with MEMORY.md, SOUL.md, daily logs
   - Responsive check in panel widths

### Dependencies
- `react-markdown` ^9
- `remark-gfm` ^4
- `rehype-highlight` ^7
- `highlight.js` ^11 (markdown, json, python, typescript, bash subsets)

### Milestone
✅ Click any bot → Files tab → browse files → inline preview → fullscreen with TOC

---

## Phase 2: Project Documents

**Goal:** Browse project documents from mounted data directory in CrewHub
**Estimate:** 3-4 hours

### Tasks

1. **Database: Add `docs_path` to projects** (~0.5h)
   - Migration script (schema v+1)
   - Default mapping: `${PROJECT_DATA_PATH}/{name}/` (configurable via env)
   - Docker: mount volume to `/mnt/project-data`

2. **Backend: Project documents endpoints** (~1h)
   - GET `/api/projects/{id}/documents` — folder tree
   - GET `/api/projects/{id}/documents/{path}` — read doc
   - Path validation (prevent directory traversal)
   - Handle filesystem edge cases gracefully

3. **Frontend: ProjectDocumentsPanel** (~1.5h)
   - Folder tree with breadcrumb navigation
   - Reuse MarkdownViewer + FullscreenOverlay
   - Integration point: Room focus project tab, or HQ

4. **Testing** (~0.5h)
   - Test with Docker volume mount
   - Handle empty projects, missing folders

### Milestone
✅ Room focus → Documents tab → browse project files → fullscreen

---

## Phase 3: Editing

**Goal:** Edit markdown files with live preview and auto-save
**Estimate:** 5-7 hours

### Tasks

1. **Backend: PUT endpoints** (~1h)
   - PUT `/api/agents/{id}/files/{path}` — write file
   - PUT `/api/projects/{id}/documents/{path}` — write doc
   - Optimistic concurrency (expected_modified check)
   - Backup before write (.bak)

2. **Frontend: MarkdownEditor** (~3h)
   - Install CodeMirror 6 + markdown language
   - Split pane: editor | preview (resizable)
   - Auto-save (2s debounce), unsaved indicator
   - Keyboard shortcuts (Cmd+S, Cmd+B, Cmd+I)
   - Conflict warning dialog

3. **Edit mode integration** (~1h)
   - "Edit" button in FullscreenOverlay header
   - Transition: viewer → editor (same overlay)
   - Cancel confirms if unsaved changes

4. **Permissions** (~0.5h)
   - Agent own files: editable
   - System files (AGENTS.md from skills): read-only indicator
   - Project docs: editable

### Dependencies (new)
- `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-markdown`

### Milestone
✅ Fullscreen → Edit → live preview → auto-save → close

---

## Phase 4: Polish & Advanced

**Goal:** Side-by-side, search, bookmarks
**Estimate:** 4-6 hours (can be split across multiple releases)

### Tasks

1. **Side-by-side mode** (~2h)
   - Split viewport: 3D left, document right
   - Resizable divider
   - Persist split state

2. **Recent docs + favorites** (~1h)
   - Track recently viewed in localStorage
   - Star/bookmark files
   - Quick access dropdown

3. **Full-text search** (~2h)
   - Backend: search across agent files + project docs
   - Frontend: search input with results list
   - Highlight matches in viewer

4. **Extras** (future backlog)
   - Mermaid diagram rendering
   - LaTeX math (KaTeX)
   - Export to PDF
   - Version history / git diff view

### Milestone
✅ Polished document experience integrated into CrewHub workflow

---

## Summary

| Phase | Scope | Estimate | Dependencies |
|-------|-------|----------|-------------|
| 1 | Agent file viewing + fullscreen | 4-6h | react-markdown, highlight.js |
| 2 | Project documents | 3-4h | Phase 1 |
| 3 | Editing | 5-7h | CodeMirror, Phase 1 |
| 4 | Polish | 4-6h | Phases 1-3 |

**Total: ~16-23 hours across all phases**

Phase 1 is self-contained and delivers immediate value. Phases 2-4 can be prioritized based on usage.

---

## Configuration

### Environment Variables

**Backend (.env or docker-compose.yml):**

```bash
# Project data directory (for Phase 2)
PROJECT_DATA_PATH=/mnt/project-data  # Docker: volume mount
# OR for local dev:
PROJECT_DATA_PATH=/Users/youruser/project-data
```

### Docker Setup

**docker-compose.yml:**

```yaml
services:
  backend:
    volumes:
      - /path/to/your/project-data:/mnt/project-data:ro  # Read-only mount
    environment:
      - PROJECT_DATA_PATH=/mnt/project-data
```

**Security:** Mount as read-only (`:ro`) for viewing-only mode. Remove `:ro` if editing is enabled.

### Agent Workspace Mapping

Agent workspaces are stored in the `settings` table:

```sql
INSERT INTO settings (key, value) VALUES 
  ('agent.workspaces', '{"main": "/path/to/clawd", "dev": "/path/to/clawd-dev"}');
```

This is configured via the onboarding wizard or Settings UI.
