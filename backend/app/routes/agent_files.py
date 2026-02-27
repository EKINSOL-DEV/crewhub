"""Agent files API - browse and read markdown files from agent workspaces."""

import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Query

from ..db.database import get_db
from ._file_api_helpers import (
    ALLOWED_EXTENSIONS,
    MSG_INVALID_PATH,
    MSG_PATH_OUTSIDE_WORKSPACE,
    build_saved_file_response,
    ensure_readable_file,
    ensure_safe_path,
    read_file_content,
    scan_directory,
    validate_relative_path,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Default agent workspace mappings (fallback if not in settings)
DEFAULT_WORKSPACES = {
    "main": str(Path.home() / "clawd"),
    "dev": str(Path.home() / "clawd"),
    "flowy": str(Path.home() / "clawd-flowy"),
    "creator": str(Path.home() / "clawd-creator"),
}


async def _get_agent_workspace(agent_id: str) -> Path:
    """Resolve the workspace path for an agent."""
    # Try settings table first
    async with get_db() as db:
        async with db.execute("SELECT value FROM settings WHERE key = 'agent_workspaces'") as cursor:
            row = await cursor.fetchone()
            if row:
                workspaces = json.loads(row["value"])
                if agent_id in workspaces:
                    return Path(workspaces[agent_id]).resolve()

    # Fallback to defaults
    if agent_id in DEFAULT_WORKSPACES:
        return Path(DEFAULT_WORKSPACES[agent_id]).resolve()

    raise HTTPException(status_code=404, detail=f"No workspace configured for agent: {agent_id}")


@router.get(
    "/{agent_id}/files",
    responses={
        400: {"description": "Bad request"},
        403: {"description": "Forbidden"},
        404: {"description": "Not found"},
    },
)
async def list_agent_files(
    agent_id: str,
    path: Annotated[Optional[str], Query(description="Subdirectory to list")] = None,
    depth: Annotated[int, Query(ge=1, le=5, description="Max folder depth")] = 2,
):
    """List files in an agent's workspace."""
    workspace = await _get_agent_workspace(agent_id)

    if not workspace.exists():
        raise HTTPException(status_code=404, detail=f"Workspace not found: {workspace}")

    scan_root = workspace
    if path:
        validate_relative_path(path, error_message=MSG_INVALID_PATH)
        scan_root = workspace / path
        ensure_safe_path(workspace, scan_root, outside_message=MSG_PATH_OUTSIDE_WORKSPACE)
        if not scan_root.exists():
            raise HTTPException(status_code=404, detail=f"Directory not found: {path}")

    files = scan_directory(workspace, scan_root, 0, depth)

    return {
        "agent_id": agent_id,
        "workspace": str(workspace),
        "files": files,
    }


@router.put(
    "/{agent_id}/files/{file_path:path}",
    responses={
        400: {"description": "Bad request"},
        403: {"description": "Forbidden"},
        404: {"description": "Not found"},
        409: {"description": "Conflict"},
        500: {"description": "Internal server error"},
    },
)
async def save_agent_file(agent_id: str, file_path: str, body: dict):
    """Save/update a file in an agent's workspace."""
    validate_relative_path(file_path, error_message=MSG_INVALID_PATH)

    content = body.get("content")
    if content is None:
        raise HTTPException(status_code=400, detail="Missing 'content' field")

    workspace = await _get_agent_workspace(agent_id)
    target = (workspace / file_path).resolve()

    ensure_safe_path(workspace, target, outside_message=MSG_PATH_OUTSIDE_WORKSPACE)
    ensure_readable_file(target, file_path, allowed_extensions=ALLOWED_EXTENSIONS)

    # Optimistic concurrency check
    expected_modified = body.get("expected_modified")
    if expected_modified:
        current_mtime = datetime.fromtimestamp(target.stat().st_mtime, tz=UTC).isoformat()
        if current_mtime != expected_modified:
            raise HTTPException(
                status_code=409,
                detail="File was modified by another process. Refresh and try again.",
            )

    # Create backup
    try:
        bak = target.with_suffix(target.suffix + ".bak")
        bak.write_text(target.read_text(errors="replace"))
    except Exception as e:
        logger.warning(f"Failed to create backup for {file_path}: {e}")  # NOSONAR

    # Write file
    try:
        target.write_text(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write file: {e}")

    return build_saved_file_response(file_path, content, target)


@router.get(
    "/{agent_id}/files/{file_path:path}",
    responses={
        400: {"description": "Bad request"},
        403: {"description": "Forbidden"},
        404: {"description": "Not found"},
        413: {"description": "Request entity too large"},
        500: {"description": "Internal server error"},
    },
)
async def read_agent_file(agent_id: str, file_path: str):
    """Read a single file from an agent's workspace."""
    validate_relative_path(file_path, error_message=MSG_INVALID_PATH)

    workspace = await _get_agent_workspace(agent_id)
    target = (workspace / file_path).resolve()

    ensure_safe_path(workspace, target, outside_message=MSG_PATH_OUTSIDE_WORKSPACE)
    ensure_readable_file(target, file_path, allowed_extensions=ALLOWED_EXTENSIONS)

    return read_file_content(target, file_path)
