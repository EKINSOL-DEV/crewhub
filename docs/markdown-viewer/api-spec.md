# Markdown Viewer/Editor — API Spec

*All endpoints implemented and working.*

## Agent Files API

Base: `/api/agents`

### List Agent Files
```
GET /api/agents/{agent_id}/files?path=&depth=2
```

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| path | string | null | Subdirectory to list |
| depth | int | 2 | Max folder depth (1-5) |

**Response:**
```json
{
  "agent_id": "main",
  "workspace": "/Users/ekinbot/clawd",
  "files": [
    {
      "name": "MEMORY.md",
      "path": "MEMORY.md",
      "type": "file",
      "size": 4321,
      "modified": "2026-02-05T10:30:00+00:00",
      "lines": 180
    },
    {
      "name": "memory",
      "path": "memory/",
      "type": "directory",
      "children": [...]
    }
  ]
}
```

**Workspace resolution:**
1. Check `settings` table key `agent_workspaces` (JSON map)
2. Fallback to `DEFAULT_WORKSPACES` dict (main→~/clawd, flowy→~/clawd-flowy, etc.)

**Security:**
- Path traversal blocked (`..` rejected)
- `_is_safe_path()` validates resolved path within workspace
- Skipped dirs: node_modules, .git, __pycache__, .venv, dist, build, etc.
- Allowed extensions: .md, .txt, .json, .yaml, .yml, .toml
- Max file size: 1MB

### Read Agent File
```
GET /api/agents/{agent_id}/files/{file_path}
```

**Response:**
```json
{
  "path": "MEMORY.md",
  "content": "# MEMORY.md — Ekinbot Long-Term Memory\n...",
  "size": 4321,
  "modified": "2026-02-05T10:30:00+00:00",
  "lines": 180,
  "language": "markdown"
}
```

**Language detection:** Extension-based (.md→markdown, .json→json, .yaml→yaml, .toml→toml, .txt→text)

---

## Project Documents API

Base: `/api/projects`

### List Project Documents
```
GET /api/projects/{project_id}/documents?path=&depth=3
```

**Response:**
```json
{
  "project_id": "abc123",
  "project_name": "CrewHub",
  "base_path": "/Users/ekinbot/SynologyDrive/ekinbot/01-Projects/CrewHub",
  "files": [...]
}
```

**Path resolution:**
1. Check `projects.docs_path` column (explicit override)
2. Fallback: `PROJECT_DATA_PATH/{project.name}/`

### Read Project Document
```
GET /api/projects/{project_id}/documents/{file_path}
```

Same response format as agent file read.

### Save Project Document ✅
```
PUT /api/projects/{project_id}/documents/{file_path}
```

**Body:**
```json
{ "content": "# Updated content\n..." }
```

**Response:**
```json
{
  "path": "design-doc.md",
  "size": 1234,
  "modified": "2026-02-11T09:00:00+00:00",
  "lines": 45,
  "status": "saved"
}
```

**Safety:** Creates `.bak` backup before overwriting.

---

## Project Files API (Extended)

Base: `/api/project-files`

Broader file browsing (code, images, configs) for project source folders. Allows more extensions than the documents API.

---

## Not Yet Implemented

- `PUT /api/agents/{agent_id}/files/{path}` — Write agent files (Phase 3 gap)
- Full-text search endpoint
- File diff/version history
- Conflict detection (compare `modified` timestamp before save)

## Error Handling

| Status | Meaning |
|--------|---------|
| 400 | Invalid path (traversal, not a file) |
| 403 | Path outside workspace/project |
| 404 | Agent/project/file not found |
| 413 | File too large (>1MB) |
| 500 | Read/write failure |
