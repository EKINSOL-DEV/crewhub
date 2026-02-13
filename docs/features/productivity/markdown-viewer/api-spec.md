# Markdown Viewer/Editor — API Specification

*Created: 2026-02-10*

## 1. Agent Files API

### GET /api/agents/{agent_id}/files

List files in an agent's workspace.

**Parameters:**
- `agent_id` (path): Agent identifier (e.g., `main`, `dev`, `flowy`)
- `path` (query, optional): Subdirectory to list (default: root)
- `depth` (query, optional): Max folder depth (default: 2, max: 5)

**Response 200:**
```json
{
  "agent_id": "main",
  "workspace": "/Users/ekinbot/clawd",
  "files": [
    {
      "name": "SOUL.md",
      "path": "SOUL.md",
      "type": "file",
      "size": 1234,
      "modified": "2026-02-05T14:30:00Z",
      "lines": 45
    },
    {
      "name": "MEMORY.md",
      "path": "MEMORY.md",
      "type": "file",
      "size": 12400,
      "modified": "2026-02-05T18:00:00Z",
      "lines": 287
    },
    {
      "name": "memory",
      "path": "memory/",
      "type": "directory",
      "children": [
        {
          "name": "2026-02-10.md",
          "path": "memory/2026-02-10.md",
          "type": "file",
          "size": 820,
          "modified": "2026-02-10T09:00:00Z",
          "lines": 28
        }
      ]
    }
  ]
}
```

**File filtering:** Only `.md` files shown by default. Hidden files/folders (`.git`, `node_modules`, `venv`) excluded.

**Agent workspace mapping** (configured in settings or hardcoded initially):
| Agent | Workspace |
|-------|-----------|
| main | `/Users/ekinbot/clawd` |
| dev | `/Users/ekinbot/clawd` |
| flowy | `/Users/ekinbot/clawd-flowy` |
| creator | `/Users/ekinbot/clawd-creator` |

### GET /api/agents/{agent_id}/files/{path:path}

Read a single file's content.

**Parameters:**
- `agent_id` (path): Agent identifier
- `path` (path): File path relative to workspace (e.g., `MEMORY.md`, `memory/2026-02-10.md`)

**Response 200:**
```json
{
  "path": "MEMORY.md",
  "content": "# MEMORY.md — Ekinbot Long-Term Memory\n\n*Last updated: 2026-02-05*\n...",
  "size": 12400,
  "modified": "2026-02-05T18:00:00Z",
  "lines": 287,
  "language": "markdown"
}
```

**Response 404:**
```json
{ "detail": "File not found: MEMORY.md" }
```

**Security:**
- Path traversal prevention: reject `..` in path
- Whitelist file extensions: `.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.toml`
- Max file size: 1MB (return 413 if exceeded)

### PUT /api/agents/{agent_id}/files/{path:path} (Phase 3)

Write file content.

**Request body:**
```json
{
  "content": "# Updated content\n...",
  "expected_modified": "2026-02-05T18:00:00Z"
}
```

`expected_modified` enables optimistic concurrency — if the file was modified after this timestamp, return 409 Conflict.

**Response 200:**
```json
{
  "path": "MEMORY.md",
  "size": 12800,
  "modified": "2026-02-10T10:15:00Z",
  "lines": 295
}
```

**Response 409 (Conflict):**
```json
{
  "detail": "File modified since last read",
  "current_modified": "2026-02-10T10:10:00Z",
  "expected_modified": "2026-02-05T18:00:00Z"
}
```

## 2. Project Documents API

### GET /api/projects/{project_id}/documents

List documents in a project's data directory.

**Parameters:**
- `project_id` (path): Project UUID from CrewHub DB
- `path` (query, optional): Subdirectory
- `depth` (query, optional): Max depth (default: 3)

**Project → folder mapping:**
Projects store their data path in the `projects` table (`docs_path` column, new field).
Default: `${PROJECT_DATA_PATH}/{project.name}/` where `PROJECT_DATA_PATH` is an env variable (e.g., `/mnt/project-data` in Docker)

**Response 200:**
```json
{
  "project_id": "abc-123",
  "project_name": "CrewHub",
  "base_path": "01-Projects/CrewHub",
  "files": [
    {
      "name": "3d-world-design.md",
      "path": "3d-world-design.md",
      "type": "file",
      "size": 5600,
      "modified": "2026-02-04T20:00:00Z"
    },
    {
      "name": "markdown-viewer",
      "path": "markdown-viewer/",
      "type": "directory",
      "children": []
    }
  ]
}
```

### GET /api/projects/{project_id}/documents/{path:path}

Read a project document. Same response format as agent files.

### PUT /api/projects/{project_id}/documents/{path:path} (Phase 3)

Write a project document. Same format as agent file PUT.

## 3. Error Handling

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 400 | Invalid path or parameters |
| 403 | Path not in allowed workspace |
| 404 | File or agent not found |
| 409 | Conflict (file modified, Phase 3) |
| 413 | File too large (>1MB) |
| 500 | Server error |

## 4. Database Changes

### Schema v+1: Add `docs_path` to projects

```sql
ALTER TABLE projects ADD COLUMN docs_path TEXT;
```

### Settings: Agent workspace paths

Store in `settings` table:
```json
{
  "key": "agent_workspaces",
  "value": {
    "main": "/Users/ekinbot/clawd",
    "flowy": "/Users/ekinbot/clawd-flowy",
    "creator": "/Users/ekinbot/clawd-creator"
  }
}
```

This allows configuration via Settings UI without code changes.
