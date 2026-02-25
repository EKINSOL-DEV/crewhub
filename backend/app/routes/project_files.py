"""Project files API routes - browse and read files from project folders."""

import logging
import mimetypes
import os
from pathlib import Path
from typing import Annotated, List

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.db.database import get_db

MSG_PATH_TRAVERSAL = "Path traversal not allowed"

logger = logging.getLogger(__name__)
router = APIRouter()

# File extensions we allow browsing
ALLOWED_EXTENSIONS = {
    # Documents
    ".md",
    ".txt",
    ".rst",
    ".adoc",
    ".org",
    # Code
    ".py",
    ".js",
    ".ts",
    ".tsx",
    ".jsx",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".ini",
    ".cfg",
    ".conf",
    ".sh",
    ".bash",
    ".zsh",
    ".html",
    ".css",
    ".scss",
    ".less",
    ".sql",
    ".graphql",
    ".go",
    ".rs",
    ".rb",
    ".java",
    ".kt",
    ".swift",
    ".c",
    ".cpp",
    ".h",
    ".dockerfile",
    ".env.example",
    ".gitignore",
    # Images
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".webp",
    ".ico",
    # Config
    ".xml",
    ".csv",
}

# Max file size for content reading (1MB)
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
}


def _resolve_project_folder(folder_path: str) -> Path:
    """Resolve and validate a project folder path."""
    # Expand ~ to home directory
    resolved = Path(os.path.expanduser(folder_path)).resolve()
    if not resolved.exists():
        raise HTTPException(status_code=404, detail=f"Project folder not found: {folder_path}")
    if not resolved.is_dir():
        raise HTTPException(status_code=400, detail=f"Path is not a directory: {folder_path}")
    return resolved


def _is_safe_path(base: Path, target: Path) -> bool:
    """Check that target is inside base (no path traversal)."""
    try:
        target.resolve().relative_to(base.resolve())
        return True
    except ValueError:
        return False


def _get_file_type(path: Path) -> str:
    """Determine file type category."""
    ext = path.suffix.lower()
    if ext in {".md", ".txt", ".rst", ".adoc", ".org"}:
        return "document"
    if ext in {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico"}:
        return "image"
    if ext in {".json", ".yaml", ".yml", ".toml", ".xml", ".ini", ".cfg", ".conf", ".csv"}:
        return "config"
    return "code"


async def _get_project_folder(project_id: str) -> str:
    """Get the folder_path for a project from DB."""
    async with get_db() as db:
        async with db.execute("SELECT folder_path FROM projects WHERE id = ?", (project_id,)) as cursor:
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Project not found")
            if not row.get("folder_path"):
                raise HTTPException(status_code=404, detail="Project has no folder configured")
            return row["folder_path"]


@router.get("/{project_id}/files", responses={400: {"description": "Bad request"}, 403: {"description": "Forbidden"}, 404: {"description": "Not found"}})
async def list_project_files(
    project_id: str,
    path: Annotated[str, Query("", description="Relative path within project folder")],
    depth: Annotated[int, Query(2, ge=1, le=5, description="Max directory depth to scan")],
):
    """List files in a project folder. Returns a tree structure."""
    folder_path = await _get_project_folder(project_id)
    base = _resolve_project_folder(folder_path)

    # Resolve the requested subdirectory
    target = (base / path).resolve() if path else base
    if not _is_safe_path(base, target):
        raise HTTPException(status_code=403, detail=MSG_PATH_TRAVERSAL)
    if not target.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    if not target.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")

    def scan_dir(dir_path: Path, current_depth: int) -> list:
        items = []
        try:
            entries = sorted(dir_path.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
        except PermissionError:
            return items

        for entry in entries:
            # Skip hidden files and excluded directories
            if entry.name.startswith(".") and entry.name not in {".env.example", ".gitignore"}:
                continue
            if entry.is_dir() and entry.name in SKIP_DIRS:
                continue

            rel = entry.relative_to(base)

            if entry.is_dir():
                children = scan_dir(entry, current_depth + 1) if current_depth < depth else []
                items.append(
                    {
                        "name": entry.name,
                        "path": str(rel),
                        "type": "directory",
                        "children": children,
                        "child_count": len(children),
                    }
                )
            elif entry.suffix.lower() in ALLOWED_EXTENSIONS:
                try:
                    size = entry.stat().st_size
                except OSError:
                    size = 0
                items.append(
                    {
                        "name": entry.name,
                        "path": str(rel),
                        "type": _get_file_type(entry),
                        "extension": entry.suffix.lower(),
                        "size": size,
                    }
                )

        return items

    files = scan_dir(target, 1)

    return {
        "project_id": project_id,
        "base_path": str(base),
        "relative_path": path or "",
        "files": files,
    }


@router.get("/{project_id}/files/content", responses={400: {"description": "Bad request"}, 403: {"description": "Forbidden"}, 404: {"description": "Not found"}, 413: {"description": "Request entity too large"}})
async def read_project_file(
    project_id: str,
    path: Annotated[str, Query(..., description="Relative path to file within project folder")],
):
    """Read the content of a file from the project folder."""
    folder_path = await _get_project_folder(project_id)
    base = _resolve_project_folder(folder_path)

    target = (base / path).resolve()
    if not _is_safe_path(base, target):
        raise HTTPException(status_code=403, detail=MSG_PATH_TRAVERSAL)
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if not target.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    if target.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=403, detail=f"File type not allowed: {target.suffix}")

    # Check file size
    size = target.stat().st_size
    if size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large ({size} bytes, max {MAX_FILE_SIZE})")

    file_type = _get_file_type(target)

    # For images, return as file response
    if file_type == "image":
        mime = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        return FileResponse(str(target), media_type=mime)

    # For text files, read and return content
    try:
        content = target.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        try:
            content = target.read_text(encoding="latin-1")
        except Exception:
            raise HTTPException(status_code=422, detail="Could not decode file content")

    return {
        "project_id": project_id,
        "path": path,
        "name": target.name,
        "type": file_type,
        "extension": target.suffix.lower(),
        "size": size,
        "content": content,
    }


@router.get("/{project_id}/files/image", responses={400: {"description": "Bad request"}, 403: {"description": "Forbidden"}, 404: {"description": "Not found"}})
async def get_project_image(
    project_id: str,
    path: Annotated[str, Query(..., description="Relative path to image within project folder")],
):
    """Serve an image file from the project folder."""
    folder_path = await _get_project_folder(project_id)
    base = _resolve_project_folder(folder_path)

    target = (base / path).resolve()
    if not _is_safe_path(base, target):
        raise HTTPException(status_code=403, detail=MSG_PATH_TRAVERSAL)
    if not target.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    if not target.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")

    if _get_file_type(target) != "image":
        raise HTTPException(status_code=400, detail="Not an image file")

    mime = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
    return FileResponse(str(target), media_type=mime)


# ── Project Folder Discovery ─────────────────────────────────────
# NOTE: This endpoint is exposed via a separate router to avoid
# conflicts with the /{project_id} catch-all in projects.py.

# Default projects base path (configurable via settings)
DEFAULT_PROJECTS_BASE_PATH = "~/Projects"

discover_router = APIRouter()


async def _get_projects_base_path() -> str:
    """Get the configured projects base path from settings, with fallback to default."""
    try:
        async with get_db() as db:
            async with db.execute("SELECT value FROM settings WHERE key = 'projects_base_path'") as cursor:
                row = await cursor.fetchone()
                if row:
                    return row[0] if isinstance(row, tuple) else row["value"]
    except Exception:
        pass
    return DEFAULT_PROJECTS_BASE_PATH


@discover_router.get("/project-folders/discover")
async def discover_project_folders():
    """Discover available project folders in the configured projects base directory.

    Returns folders found in the configured projects base path
    that could be linked to CrewHub projects.
    """
    folders: List[dict] = []

    base_path_str = await _get_projects_base_path()
    base = Path(os.path.expanduser(base_path_str))

    if not base.exists():
        return {"base_path": base_path_str, "folders": []}

    resolved_base = base.resolve()

    try:
        for entry in sorted(resolved_base.iterdir()):
            if entry.is_dir() and not entry.name.startswith("."):
                # Count files inside
                file_count = 0
                has_readme = False
                has_docs = False
                try:
                    for child in entry.iterdir():
                        if child.is_file() and child.suffix.lower() in ALLOWED_EXTENSIONS:
                            file_count += 1
                        if child.name.lower() in ("readme.md", "readme.txt"):
                            has_readme = True
                        if child.name.lower() == "docs" and child.is_dir():
                            has_docs = True
                except PermissionError:
                    pass

                folders.append(
                    {
                        "name": entry.name,
                        "path": f"{base_path_str}/{entry.name}",
                        "resolved_path": str(entry),
                        "file_count": file_count,
                        "has_readme": has_readme,
                        "has_docs": has_docs,
                    }
                )
    except PermissionError:
        pass

    return {
        "base_path": base_path_str,
        "resolved_path": str(resolved_base),
        "folders": folders,
    }
