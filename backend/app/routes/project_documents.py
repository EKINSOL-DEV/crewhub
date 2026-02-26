"""Project documents API - browse and read markdown files from project data directories.

Uses PROJECT_DATA_PATH env var as base, with optional per-project docs_path override.
Reuses patterns from agent_files.py (Phase 1).
"""

import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Query

from ..config import settings
from ..db.database import get_db

MSG_INVALID_PATH = "Invalid path"
MSG_PATH_OUTSIDE_PROJECT = "Path outside project folder"

logger = logging.getLogger(__name__)
router = APIRouter()

# Allowed file extensions for viewing
ALLOWED_EXTENSIONS = {".md", ".txt", ".json", ".yaml", ".yml", ".toml"}

# Max file size (1MB)
MAX_FILE_SIZE = 1_048_576

# Directories to skip
SKIP_DIRS = {
    "node_modules",
    ".git",
    "__pycache__",
    ".venv",
    "venv",
    ".next",
    "dist",
    "build",
    ".cache",
    ".tox",
    ".mypy_cache",
    ".pytest_cache",
    "egg-info",
    ".eggs",
    ".DS_Store",
}


async def _get_project_docs_path(project_id: str) -> tuple[Path, str]:
    """Resolve the documents directory for a project.

    Returns (resolved_path, project_name).
    Priority: project.docs_path > PROJECT_DATA_PATH/{project.name}/
    """
    async with get_db() as db:
        async with db.execute("SELECT name, docs_path FROM projects WHERE id = ?", (project_id,)) as cursor:
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Project not found")

    project_name = row["name"]

    # Use explicit docs_path if set
    if row.get("docs_path"):
        docs_dir = Path(os.path.expanduser(row["docs_path"])).resolve()
    else:
        # Default: PROJECT_DATA_PATH / project_name
        base = Path(os.path.expanduser(settings.project_data_path)).resolve()
        docs_dir = base / project_name

    return docs_dir, project_name


def _is_safe_path(base: Path, target: Path) -> bool:
    """Check that target is inside base (no path traversal)."""
    try:
        target.resolve().relative_to(base.resolve())
        return True
    except ValueError:
        return False


def _count_lines(path: Path) -> int:
    try:
        with open(path, errors="replace") as f:
            return sum(1 for _ in f)
    except Exception:
        return 0


def _file_info(base: Path, path: Path) -> dict:
    stat = path.stat()
    rel = path.relative_to(base)
    return {
        "name": path.name,
        "path": str(rel),
        "type": "file",
        "size": stat.st_size,
        "modified": datetime.fromtimestamp(stat.st_mtime, tz=UTC).isoformat(),
        "lines": _count_lines(path) if stat.st_size < MAX_FILE_SIZE else None,
    }


def _scan_directory(base: Path, directory: Path, depth: int, max_depth: int) -> list:
    if depth > max_depth:
        return []
    items = []
    try:
        entries = sorted(directory.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
    except PermissionError:
        return []
    for entry in entries:
        if entry.name.startswith(".") and entry.name != ".":
            continue
        if entry.name in SKIP_DIRS:
            continue
        if entry.is_dir():
            children = _scan_directory(base, entry, depth + 1, max_depth)
            if children:
                items.append(
                    {
                        "name": entry.name,
                        "path": str(entry.relative_to(base)) + "/",
                        "type": "directory",
                        "children": children,
                    }
                )
        elif entry.is_file() and entry.suffix.lower() in ALLOWED_EXTENSIONS:
            items.append(_file_info(base, entry))
    return items


@router.get(
    "/{project_id}/documents", responses={400: {"description": "Bad request"}, 403: {"description": "Forbidden"}}
)
async def list_project_documents(
    project_id: str,
    path: Annotated[Optional[str], Query(None, description="Subdirectory to list")],
    depth: Annotated[int, Query(3, ge=1, le=5, description="Max folder depth")],
):
    """List documents in a project's data directory."""
    docs_dir, project_name = await _get_project_docs_path(project_id)

    # Handle missing folders gracefully
    if not docs_dir.exists():
        return {
            "project_id": project_id,
            "project_name": project_name,
            "base_path": str(docs_dir),
            "files": [],
        }

    scan_root = docs_dir
    if path:
        if ".." in path:
            raise HTTPException(status_code=400, detail=MSG_INVALID_PATH)
        scan_root = docs_dir / path
        if not _is_safe_path(docs_dir, scan_root):
            raise HTTPException(status_code=403, detail=MSG_PATH_OUTSIDE_PROJECT)
        if not scan_root.exists():
            return {
                "project_id": project_id,
                "project_name": project_name,
                "base_path": str(docs_dir),
                "files": [],
            }

    files = _scan_directory(docs_dir, scan_root, 0, depth)

    return {
        "project_id": project_id,
        "project_name": project_name,
        "base_path": str(docs_dir),
        "files": files,
    }


@router.put(
    "/{project_id}/documents/{file_path:path}",
    responses={
        400: {"description": "Bad request"},
        403: {"description": "Forbidden"},
        404: {"description": "Not found"},
        500: {"description": "Internal server error"},
    },
)
async def save_project_document(project_id: str, file_path: str, body: dict):
    """Save/update a document in a project's data directory."""
    if ".." in file_path:
        raise HTTPException(status_code=400, detail=MSG_INVALID_PATH)

    content = body.get("content")
    if content is None:
        raise HTTPException(status_code=400, detail="Missing 'content' field")

    docs_dir, _ = await _get_project_docs_path(project_id)
    target = (docs_dir / file_path).resolve()

    if not _is_safe_path(docs_dir, target):
        raise HTTPException(status_code=403, detail=MSG_PATH_OUTSIDE_PROJECT)

    if not target.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    if not target.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")

    if target.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {target.suffix}")

    # Create backup
    try:
        bak = target.with_suffix(target.suffix + ".bak")
        bak.write_text(target.read_text(errors="replace"))
    except Exception as e:
        logger.warning(
            f"Failed to create backup for {file_path}: {e}"
        )  # NOSONAR: file_path is validated server-side; e is system exception, needed for diagnostics

    # Write file
    try:
        target.write_text(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write file: {e}")

    stat = target.stat()
    return {
        "path": file_path,
        "size": stat.st_size,
        "modified": datetime.fromtimestamp(stat.st_mtime, tz=UTC).isoformat(),
        "lines": content.count("\n") + 1 if content else 0,
        "status": "saved",
    }


@router.get(
    "/{project_id}/documents/{file_path:path}",
    responses={
        400: {"description": "Bad request"},
        403: {"description": "Forbidden"},
        404: {"description": "Not found"},
        413: {"description": "Request entity too large"},
        500: {"description": "Internal server error"},
    },
)
async def read_project_document(project_id: str, file_path: str):
    """Read a single document from a project's data directory."""
    if ".." in file_path:
        raise HTTPException(status_code=400, detail=MSG_INVALID_PATH)

    docs_dir, _ = await _get_project_docs_path(project_id)
    target = (docs_dir / file_path).resolve()

    if not _is_safe_path(docs_dir, target):
        raise HTTPException(status_code=403, detail=MSG_PATH_OUTSIDE_PROJECT)

    if not target.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    if not target.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")

    if target.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {target.suffix}")

    stat = target.stat()
    if stat.st_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large: {stat.st_size} bytes (max {MAX_FILE_SIZE})")

    try:
        content = target.read_text(errors="replace")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {e}")

    lang_map = {
        ".md": "markdown",
        ".txt": "text",
        ".json": "json",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".toml": "toml",
    }

    return {
        "path": file_path,
        "content": content,
        "size": stat.st_size,
        "modified": datetime.fromtimestamp(stat.st_mtime, tz=UTC).isoformat(),
        "lines": content.count("\n") + 1 if content else 0,
        "language": lang_map.get(target.suffix.lower(), "text"),
    }
