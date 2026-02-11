"""Agent files API - browse and read markdown files from agent workspaces."""
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..db.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

# Allowed file extensions for viewing
ALLOWED_EXTENSIONS = {'.md', '.txt', '.json', '.yaml', '.yml', '.toml'}

# Max file size (1MB)
MAX_FILE_SIZE = 1_048_576

# Directories to skip
SKIP_DIRS = {
    'node_modules', '.git', '__pycache__', '.venv', 'venv',
    '.next', 'dist', 'build', '.cache', '.tox', '.mypy_cache',
    '.pytest_cache', 'egg-info', '.eggs', '.DS_Store',
}

# Default agent workspace mappings (fallback if not in settings)
DEFAULT_WORKSPACES = {
    "main": str(Path.home() / "clawd"),
    "dev": str(Path.home() / "clawd"),
    "flowy": str(Path.home() / "clawd-flowy"),
    "wtl": str(Path.home() / "clawd-wtl"),
    "creator": str(Path.home() / "clawd-creator"),
}


async def _get_agent_workspace(agent_id: str) -> Path:
    """Resolve the workspace path for an agent."""
    # Try settings table first
    db = await get_db()
    try:
        async with db.execute(
            "SELECT value FROM settings WHERE key = 'agent_workspaces'"
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                workspaces = json.loads(row[0])
                if agent_id in workspaces:
                    return Path(workspaces[agent_id]).resolve()
    finally:
        await db.close()

    # Fallback to defaults
    if agent_id in DEFAULT_WORKSPACES:
        return Path(DEFAULT_WORKSPACES[agent_id]).resolve()

    raise HTTPException(status_code=404, detail=f"No workspace configured for agent: {agent_id}")


def _is_safe_path(base: Path, target: Path) -> bool:
    """Check that target is inside base (no path traversal)."""
    try:
        target.resolve().relative_to(base.resolve())
        return True
    except ValueError:
        return False


def _file_info(base: Path, path: Path) -> dict:
    """Build file info dict."""
    stat = path.stat()
    rel = path.relative_to(base)
    return {
        "name": path.name,
        "path": str(rel),
        "type": "file",
        "size": stat.st_size,
        "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        "lines": _count_lines(path) if stat.st_size < MAX_FILE_SIZE else None,
    }


def _count_lines(path: Path) -> int:
    """Count lines in a text file."""
    try:
        with open(path, 'r', errors='replace') as f:
            return sum(1 for _ in f)
    except Exception:
        return 0


def _scan_directory(base: Path, directory: Path, depth: int, max_depth: int) -> list:
    """Recursively scan directory for allowed files."""
    if depth > max_depth:
        return []

    items = []
    try:
        entries = sorted(directory.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
    except PermissionError:
        return []

    for entry in entries:
        if entry.name.startswith('.') and entry.name != '.':
            continue
        if entry.name in SKIP_DIRS:
            continue

        if entry.is_dir():
            children = _scan_directory(base, entry, depth + 1, max_depth)
            if children:  # Only include dirs that have visible files
                items.append({
                    "name": entry.name,
                    "path": str(entry.relative_to(base)) + "/",
                    "type": "directory",
                    "children": children,
                })
        elif entry.is_file() and entry.suffix.lower() in ALLOWED_EXTENSIONS:
            items.append(_file_info(base, entry))

    return items


@router.get("/{agent_id}/files")
async def list_agent_files(
    agent_id: str,
    path: Optional[str] = Query(None, description="Subdirectory to list"),
    depth: int = Query(2, ge=1, le=5, description="Max folder depth"),
):
    """List files in an agent's workspace."""
    workspace = await _get_agent_workspace(agent_id)

    if not workspace.exists():
        raise HTTPException(status_code=404, detail=f"Workspace not found: {workspace}")

    scan_root = workspace
    if path:
        # Validate path
        if '..' in path:
            raise HTTPException(status_code=400, detail="Invalid path")
        scan_root = workspace / path
        if not _is_safe_path(workspace, scan_root):
            raise HTTPException(status_code=403, detail="Path outside workspace")
        if not scan_root.exists():
            raise HTTPException(status_code=404, detail=f"Directory not found: {path}")

    files = _scan_directory(workspace, scan_root, 0, depth)

    return {
        "agent_id": agent_id,
        "workspace": str(workspace),
        "files": files,
    }


@router.put("/{agent_id}/files/{file_path:path}")
async def save_agent_file(agent_id: str, file_path: str, body: dict):
    """Save/update a file in an agent's workspace."""
    if '..' in file_path:
        raise HTTPException(status_code=400, detail="Invalid path")

    content = body.get("content")
    if content is None:
        raise HTTPException(status_code=400, detail="Missing 'content' field")

    workspace = await _get_agent_workspace(agent_id)
    target = (workspace / file_path).resolve()

    if not _is_safe_path(workspace, target):
        raise HTTPException(status_code=403, detail="Path outside workspace")

    if not target.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    if not target.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")

    if target.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {target.suffix}")

    # Optimistic concurrency check
    expected_modified = body.get("expected_modified")
    if expected_modified:
        current_mtime = datetime.fromtimestamp(target.stat().st_mtime, tz=timezone.utc).isoformat()
        if current_mtime != expected_modified:
            raise HTTPException(
                status_code=409,
                detail="File was modified by another process. Refresh and try again.",
            )

    # Create backup
    try:
        bak = target.with_suffix(target.suffix + '.bak')
        bak.write_text(target.read_text(errors='replace'))
    except Exception as e:
        logger.warning(f"Failed to create backup for {file_path}: {e}")

    # Write file
    try:
        target.write_text(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write file: {e}")

    stat = target.stat()
    return {
        "path": file_path,
        "size": stat.st_size,
        "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        "lines": content.count('\n') + 1 if content else 0,
        "status": "saved",
    }


@router.get("/{agent_id}/files/{file_path:path}")
async def read_agent_file(agent_id: str, file_path: str):
    """Read a single file from an agent's workspace."""
    # Security: reject path traversal
    if '..' in file_path:
        raise HTTPException(status_code=400, detail="Invalid path")

    workspace = await _get_agent_workspace(agent_id)
    target = (workspace / file_path).resolve()

    # Ensure file is within workspace
    if not _is_safe_path(workspace, target):
        raise HTTPException(status_code=403, detail="Path outside workspace")

    if not target.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    if not target.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")

    # Check extension
    if target.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {target.suffix}")

    # Check size
    stat = target.stat()
    if stat.st_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large: {stat.st_size} bytes (max {MAX_FILE_SIZE})")

    try:
        content = target.read_text(errors='replace')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {e}")

    # Determine language from extension
    lang_map = {
        '.md': 'markdown', '.txt': 'text', '.json': 'json',
        '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
    }

    return {
        "path": file_path,
        "content": content,
        "size": stat.st_size,
        "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        "lines": content.count('\n') + 1 if content else 0,
        "language": lang_map.get(target.suffix.lower(), 'text'),
    }
