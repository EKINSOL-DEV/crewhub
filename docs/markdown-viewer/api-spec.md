# Markdown Viewer/Editor — API Specification

> All endpoints implemented in `backend/app/routes/agent_files.py` and `project_documents.py`.

## Agent Files API

Base: `/api/agents`

### List Files
```
GET /api/agents/{agent_id}/files?depth=3
```

**Response 200:**
```json
{
  "agent_id": "main",
  "workspace": "/Users/ekinbot/clawd",
  "files": [
    {
      "name": "MEMORY.md",
      "path": "MEMORY.md",
      "type": "file",
      "size": 12800,
      "modified": "2026-02-05T14:30:00Z",
      "lines": 342,
      "extension": ".md"
    },
    {
      "name": "memory",
      "path": "memory",
      "type": "directory",
      "children": [
        {
          "name": "2026-02-12.md",
          "path": "memory/2026-02-12.md",
          "type": "file",
          "size": 2048,
          "modified": "2026-02-12T09:00:00Z",
          "lines": 45,
          "extension": ".md"
        }
      ]
    }
  ]
}
```

**Workspace resolution priority:**
1. Settings DB (`agent_workspaces` key)
2. `DEFAULT_WORKSPACES` dict (main→`~/clawd`, flowy→`~/clawd-flowy`, etc.)

**Filters:**
- Allowed extensions: `.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.toml`
- Skipped dirs: `node_modules`, `.git`, `__pycache__`, `.venv`, `dist`, `build`, etc.
- Max depth: configurable via `depth` query param (default 3)

### Read File
```
GET /api/agents/{agent_id}/files/{file_path}
```

**Response 200:**
```json
{
  "path": "MEMORY.md",
  "content": "# MEMORY.md — Ekinbot Long-Term Memory\n...",
  "size": 12800,
  "modified": "2026-02-05T14:30:00Z",
  "lines": 342,
  "language": "markdown"
}
```

**Errors:**
- `404` — File not found or agent workspace unknown
- `403` — Path traversal attempt (resolved path outside workspace)
- `413` — File exceeds 1MB limit

### Save File
```
PUT /api/agents/{agent_id}/files/{file_path}
Content-Type: application/json

{ "content": "# Updated content\n..." }
```

**Response 200:**
```json
{
  "path": "MEMORY.md",
  "size": 13200,
  "modified": "2026-02-12T10:00:00Z",
  "lines": 355
}
```

**Security:**
- Path traversal protection (`_is_safe_path` — resolved path must be under workspace)
- Only allowed extensions can be written
- Max file size: 1MB

---

## Project Documents API

Base: `/api/projects`

### List Documents
```
GET /api/projects/{project_id}/documents?depth=3
```

**Response 200:**
```json
{
  "project_id": "abc123",
  "project_name": "CrewHub",
  "docs_path": "/Users/ekinbot/SynologyDrive/ekinbot/01-Projects/CrewHub",
  "files": [ /* same structure as agent files */ ]
}
```

**Path resolution priority:**
1. Project `docs_path` field in DB
2. `PROJECT_DATA_PATH` env var + `/{project_name}/`

### Read Document
```
GET /api/projects/{project_id}/documents/{file_path}
```
Same response schema as agent file read.

### Save Document
```
PUT /api/projects/{project_id}/documents/{file_path}
Content-Type: application/json

{ "content": "# Updated doc\n..." }
```
Same response schema as agent file save.

---

## Error Responses

All errors follow:
```json
{
  "detail": "Human-readable error message"
}
```

| Code | Meaning |
|------|---------|
| 400 | Invalid request (empty content, bad extension) |
| 403 | Path traversal / security violation |
| 404 | File, agent, or project not found |
| 413 | File too large (>1MB) |
| 500 | Server error (disk I/O, etc.) |

## Future Endpoints (Phase 4)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/agents/{id}/files/search?q=term` | Full-text search |
| GET | `/api/agents/{id}/files/{path}/history` | Git log for file |
| GET | `/api/agents/{id}/files/{path}/diff?ref=HEAD~1` | Diff view |
