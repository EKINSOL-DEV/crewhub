"""Media file serving endpoint.

Serves media files from allowed directories with security checks.
Supports images from OpenClaw media folder.
"""

import os
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# Allowed base directories for media files (resolved to absolute paths)
ALLOWED_MEDIA_DIRS = [
    Path.home() / ".openclaw" / "media",
    Path.home() / ".openclaw" / "media" / "inbound",
    Path("/tmp") / "crewhub-media",  # For testing
]

# Supported image MIME types
IMAGE_MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}


def is_path_allowed(file_path: Path) -> bool:
    """Check if the file path is within allowed directories.
    
    Security: Prevents path traversal attacks by ensuring the resolved
    path starts with an allowed directory.
    """
    try:
        resolved = file_path.resolve()
        for allowed_dir in ALLOWED_MEDIA_DIRS:
            allowed_resolved = allowed_dir.resolve()
            if str(resolved).startswith(str(allowed_resolved)):
                return True
        return False
    except Exception:
        return False


def get_mime_type(file_path: Path) -> str | None:
    """Get MIME type for a file based on extension."""
    ext = file_path.suffix.lower()
    return IMAGE_MIME_TYPES.get(ext)


@router.get("/api/media/{file_path:path}")
async def serve_media(file_path: str):
    """Serve a media file from allowed directories.
    
    Args:
        file_path: Path to the media file (can be absolute or relative to home/.openclaw/media)
        
    Returns:
        FileResponse with the image
        
    Raises:
        HTTPException 404 if file not found or not in allowed directory
        HTTPException 415 if file type not supported
    """
    # Handle both absolute paths and relative paths
    if file_path.startswith("/"):
        # Absolute path
        path = Path(file_path)
    else:
        # Relative to ~/.openclaw/media
        path = Path.home() / ".openclaw" / "media" / file_path
    
    # Security check: ensure path is in allowed directories
    if not is_path_allowed(path):
        logger.warning(f"Media access denied - path not allowed: {file_path}")
        raise HTTPException(
            status_code=404,
            detail="File not found"
        )
    
    # Check if file exists
    resolved_path = path.resolve()
    if not resolved_path.exists():
        logger.debug(f"Media file not found: {resolved_path}")
        raise HTTPException(
            status_code=404,
            detail="File not found"
        )
    
    if not resolved_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Not a file"
        )
    
    # Check MIME type
    mime_type = get_mime_type(resolved_path)
    if not mime_type:
        logger.warning(f"Unsupported media type: {resolved_path.suffix}")
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported media type: {resolved_path.suffix}"
        )
    
    logger.debug(f"Serving media file: {resolved_path}")
    
    return FileResponse(
        path=str(resolved_path),
        media_type=mime_type,
        filename=resolved_path.name,
    )
