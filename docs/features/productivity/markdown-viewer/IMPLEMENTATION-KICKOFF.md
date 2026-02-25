# Markdown Viewer/Editor — Implementation Kickoff

**Date:** 2026-02-10 14:58
**Assigned:** Dev (Opus)
**Scope:** All 4 phases (16-23h total)
**Target:** v0.13.0

---

## Strategy

This is too large for a single session. Break into iterative phases:

### Iteration 1 (Phase 1) — MVP
**Goal:** Agent file viewing + fullscreen
**Estimate:** 4-6h
**Subagent:** Dev (Opus)

**Deliverables:**
1. Backend: Agent files API (`/api/agents/{id}/files`, `/api/agents/{id}/files/{path}`)
2. Frontend: MarkdownViewer component (react-markdown + GFM)
3. Frontend: FileTree + FilesTab in BotInfoPanel
4. Frontend: FullscreenOverlay with TOC
5. Tests + integration

**Success:** Click bot → Files tab → browse .md files → fullscreen with TOC

---

### Iteration 2 (Phase 2) — Project Documents
**Goal:** Browse project docs from mounted data directory
**Estimate:** 3-4h
**Subagent:** Dev (Opus)

**Deliverables:**
1. Database: `docs_path` column in projects table (schema v+1)
2. Backend: Project documents API
3. Frontend: ProjectDocumentsPanel
4. Docker: volume mount for PROJECT_DATA_PATH

**Success:** Room focus → Documents tab → browse project files

---

### Iteration 3 (Phase 3) — Editing
**Goal:** Edit markdown with CodeMirror 6 + auto-save
**Estimate:** 5-7h
**Subagent:** Dev (Opus)

**Deliverables:**
1. Backend: PUT endpoints for file writes
2. Frontend: MarkdownEditor with CodeMirror 6
3. Frontend: Side-by-side view (editor | preview)
4. Auto-save logic (debounced, optimistic concurrency)

**Success:** Edit MEMORY.md → auto-save → changes persist

---

### Iteration 4 (Phase 4) — Polish
**Goal:** Search, bookmarks, UX refinements
**Estimate:** 4-6h
**Subagent:** Dev (Opus) + Reviewer (GPT-5.2)

**Deliverables:**
1. Search (files + content)
2. Bookmarks system
3. Keyboard shortcuts polish
4. Mobile responsive
5. Performance optimization

**Success:** Production-ready feature

---

## Review Gates

After each iteration:
1. Dev commits to develop branch
2. Reviewer (GPT-5.2) does code review
3. Assistent tests manually (http://ekinbot.local:5180)
4. Fix critical issues before next iteration

---

## Dependencies

### NPM packages (install in iteration 1):
```bash
cd ~/ekinapps/crewhub/frontend
npm install react-markdown@^9 remark-gfm@^4 rehype-highlight@^7 highlight.js@^11
```

### NPM packages (install in iteration 3):
```bash
npm install @codemirror/state @codemirror/view @codemirror/lang-markdown @codemirror/commands
```

---

## Environment Variables

Add to backend `.env` (or docker-compose.yml):
```bash
PROJECT_DATA_PATH=/mnt/project-data  # Docker
# OR for local dev:
PROJECT_DATA_PATH=/Users/ekinbot/SynologyDrive/ekinbot/01-Projects
```

---

## Branch Strategy

- Work on `develop` branch
- Commit after each phase milestone
- Tag `markdown-viewer-mvp-v1` after Phase 1
- Tag `markdown-viewer-full-v1` after Phase 4

---

## Communication

- Dev spawns, works, commits, reports back
- Assistent monitors progress via `sessions_list` + `sessions_history`
- Nicky gets progress updates via WhatsApp

---

## Start Command

```
Spawn dev subagent with:
- Task: Markdown Viewer Phase 1 (MVP)
- Model: Opus
- Timeout: 4h (14400s)
- Label: "markdown-viewer-phase1"
```

---

*Kickoff: 2026-02-10 14:58*
