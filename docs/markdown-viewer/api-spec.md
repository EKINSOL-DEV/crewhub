# Markdown Viewer/Editor — API Specification

## Status: Implemented ✅

All endpoints below are live in the CrewHub backend.

---

## Agent Files API

### List Files
```
GET /api/agents/{agent_id}/files?path=&depth=3
```

**Response:**
```json
{
  "files": [
    {
      "name": "MEMORY.md",
      "path": "MEMORY.md",
      "type": "file",
      "size": 3200,
      "modified": "2026-02-05T14:30:00Z",
      "extension": ".md"
    },
    {
      "name": "memory",
      "path": "memory",
      "type": "directory",
      "children": [...]
    }
  ],
  "workspace": "/Users/ekinbot/clawd"
}
```

**Workspace resolution:** Settings table `agent_workspaces` → fallback to `DEFAULT_WORKSPACES` mapping (main→clawd, flowy→clawd-flowy, etc.)

**Security:** Only `ALLOWED_EXTENSIONS` (.md, .txt, .json, .yaml, .yml, .toml). Skips node_modules, .git, __pycache__, etc. Max file size 1MB.

### Read File
```
GET /api/agents/{agent_id}/files/{path}
```

**Response:**
```json
{
  "content": "# MEMORY.md\n...",
  "metadata": {
    "size": 3200,
    "modified": "2026-02-05T14:30:00Z",
    "lines": 142,
    "extension": ".md"
  }
}
```

### Write File
```
PUT /api/agents/{agent_id}/files/{path}
Content-Type: application/json

{
  "content": "# Updated content\n..."
}
```

**Response:** `200 OK` with updated metadata.

**Validation:** Path traversal protection, extension whitelist, size limit.

---

## Project Documents API

### List Documents
```
GET /api/projects/{project_id}/documents?path=
```

Same response structure as agent files. Base path resolved from `projects.docs_path` column or `PROJECT_DATA_PATH/{project.name}/`.

### Read Document
```
GET /api/projects/{project_id}/documents/{path}
```

### Write Document
```
PUT /api/projects/{project_id}/documents/{path}
Content-Type: application/json

{
  "content": "# Updated doc\n..."
}
```

---

## Error Handling

| Status | Meaning |
|--------|---------|
| 404 | Agent/project not found, or no workspace configured |
| 400 | Invalid path, unsupported extension, path traversal attempt |
| 413 | File exceeds 1MB limit |
| 500 | Filesystem error |

---

## Future Endpoints (Phase 4)

```
GET  /api/agents/{agent_id}/files/search?q=term     — Full-text search
GET  /api/agents/{agent_id}/files/{path}/history     — Git log for file
POST /api/agents/{agent_id}/files/{path}/diff        — Diff between versions
```
