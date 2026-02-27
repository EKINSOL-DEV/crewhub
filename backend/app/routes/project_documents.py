"""Project documents API - browse and read markdown files from project data directories.

Uses PROJECT_DATA_PATH env var as base, with optional per-project docs_path override.
Reuses patterns from agent_files.py (Phase 1).
"""

import logging
import os
from pathlib import Path
from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Query

from ..config import settings
from ..db.database import get_db
from ._file_api_helpers import (
    ALLOWED_EXTENSIONS,
    MSG_INVALID_PATH,
    MSG_PATH_OUTSIDE_PROJECT,
    build_saved_file_response,
    ensure_readable_file,
    ensure_safe_path,
    read_file_content,
    scan_directory,
    validate_relative_path,
)

logger = logging.getLogger(__name__)
router = APIRouter()


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


@router.get(
    "/{project_id}/documents",
    responses={
        400: {"description": "Bad request"},
        403: {"description": "Forbidden"},
        404: {"description": "Not found"},
    },
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
        validate_relative_path(path, error_message=MSG_INVALID_PATH)
        scan_root = docs_dir / path
        ensure_safe_path(docs_dir, scan_root, outside_message=MSG_PATH_OUTSIDE_PROJECT)
        if not scan_root.exists():
            return {
                "project_id": project_id,
                "project_name": project_name,
                "base_path": str(docs_dir),
                "files": [],
            }

    files = scan_directory(docs_dir, scan_root, 0, depth)

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
    validate_relative_path(file_path, error_message=MSG_INVALID_PATH)

    content = body.get("content")
    if content is None:
        raise HTTPException(status_code=400, detail="Missing 'content' field")

    docs_dir, _ = await _get_project_docs_path(project_id)
    target = (docs_dir / file_path).resolve()

    ensure_safe_path(docs_dir, target, outside_message=MSG_PATH_OUTSIDE_PROJECT)
    ensure_readable_file(target, file_path, allowed_extensions=ALLOWED_EXTENSIONS)

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
    validate_relative_path(file_path, error_message=MSG_INVALID_PATH)

    docs_dir, _ = await _get_project_docs_path(project_id)
    target = (docs_dir / file_path).resolve()

    ensure_safe_path(docs_dir, target, outside_message=MSG_PATH_OUTSIDE_PROJECT)
    ensure_readable_file(target, file_path, allowed_extensions=ALLOWED_EXTENSIONS)

    return read_file_content(target, file_path)
