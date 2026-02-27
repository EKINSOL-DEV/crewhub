"""Shared helpers for file-browsing APIs (agent files + project documents)."""

from datetime import UTC, datetime
from pathlib import Path

from fastapi import HTTPException

MSG_INVALID_PATH = "Invalid path"
MSG_PATH_OUTSIDE_WORKSPACE = "Path outside workspace"
MSG_PATH_OUTSIDE_PROJECT = "Path outside project folder"

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

LANGUAGE_MAP = {
    ".md": "markdown",
    ".txt": "text",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
}


def validate_relative_path(path_value: str, *, error_message: str = MSG_INVALID_PATH) -> None:
    """Reject path traversal markers in API path params."""
    if ".." in path_value:
        raise HTTPException(status_code=400, detail=error_message)


def is_safe_path(base: Path, target: Path) -> bool:
    """Check that target is inside base (no path traversal)."""
    try:
        target.resolve().relative_to(base.resolve())
        return True
    except ValueError:
        return False


def ensure_safe_path(base: Path, target: Path, *, outside_message: str) -> None:
    """Validate target path is contained in base path."""
    if not is_safe_path(base, target):
        raise HTTPException(status_code=403, detail=outside_message)


def count_lines(path: Path) -> int:
    """Count lines in a text file."""
    try:
        with open(path, errors="replace") as f:
            return sum(1 for _ in f)
    except Exception:
        return 0


def build_file_info(base: Path, path: Path, *, max_file_size: int = MAX_FILE_SIZE) -> dict:
    """Build list API metadata for one file."""
    stat = path.stat()
    rel = path.relative_to(base)
    return {
        "name": path.name,
        "path": str(rel),
        "type": "file",
        "size": stat.st_size,
        "modified": datetime.fromtimestamp(stat.st_mtime, tz=UTC).isoformat(),
        "lines": count_lines(path) if stat.st_size < max_file_size else None,
    }


def scan_directory(
    base: Path,
    directory: Path,
    depth: int,
    max_depth: int,
    *,
    allowed_extensions: set[str] = ALLOWED_EXTENSIONS,
    skip_dirs: set[str] = SKIP_DIRS,
    max_file_size: int = MAX_FILE_SIZE,
) -> list:
    """Recursively scan directory for allowed files."""
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
        if entry.name in skip_dirs:
            continue

        if entry.is_dir():
            children = scan_directory(
                base,
                entry,
                depth + 1,
                max_depth,
                allowed_extensions=allowed_extensions,
                skip_dirs=skip_dirs,
                max_file_size=max_file_size,
            )
            if children:  # Only include dirs that have visible files
                items.append(
                    {
                        "name": entry.name,
                        "path": str(entry.relative_to(base)) + "/",
                        "type": "directory",
                        "children": children,
                    }
                )
        elif entry.is_file() and entry.suffix.lower() in allowed_extensions:
            items.append(build_file_info(base, entry, max_file_size=max_file_size))

    return items


def ensure_readable_file(
    target: Path,
    file_path: str,
    *,
    allowed_extensions: set[str] = ALLOWED_EXTENSIONS,
) -> None:
    """Validate existence, file type and extension."""
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    if not target.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")

    if target.suffix.lower() not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {target.suffix}")


def read_file_content(
    target: Path,
    file_path: str,
    *,
    max_file_size: int = MAX_FILE_SIZE,
    language_map: dict[str, str] = LANGUAGE_MAP,
) -> dict:
    """Read and return file payload used by read endpoints."""
    stat = target.stat()
    if stat.st_size > max_file_size:
        raise HTTPException(status_code=413, detail=f"File too large: {stat.st_size} bytes (max {max_file_size})")

    try:
        content = target.read_text(errors="replace")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {e}")

    return {
        "path": file_path,
        "content": content,
        "size": stat.st_size,
        "modified": datetime.fromtimestamp(stat.st_mtime, tz=UTC).isoformat(),
        "lines": content.count("\n") + 1 if content else 0,
        "language": language_map.get(target.suffix.lower(), "text"),
    }


def build_saved_file_response(file_path: str, content: str, target: Path) -> dict:
    """Build save API response payload."""
    stat = target.stat()
    return {
        "path": file_path,
        "size": stat.st_size,
        "modified": datetime.fromtimestamp(stat.st_mtime, tz=UTC).isoformat(),
        "lines": content.count("\n") + 1 if content else 0,
        "status": "saved",
    }
