"""Media file serving and upload endpoint.

Serves media files from allowed directories with security checks.
Supports images from OpenClaw media folder.
Handles image uploads for chat attachments.
Handles audio uploads for voice messages.
"""

import os
import uuid
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# Upload directory for chat images
UPLOAD_DIR = Path.home() / ".openclaw" / "media" / "uploads"

# Upload directory for voice messages
AUDIO_UPLOAD_DIR = Path.home() / ".crewhub" / "media" / "audio"

# Allowed base directories for media files (resolved to absolute paths)
ALLOWED_MEDIA_DIRS = [
    Path.home() / ".openclaw" / "media",
    Path.home() / ".openclaw" / "media" / "inbound",
    Path.home() / ".openclaw" / "media" / "uploads",
    Path.home() / ".crewhub" / "media",
    Path.home() / ".crewhub" / "media" / "audio",
    Path("/tmp") / "crewhub-media",  # For testing
]

# Max upload size for images: 10MB
MAX_UPLOAD_SIZE = 10 * 1024 * 1024

# Max upload size for audio: 50MB
MAX_AUDIO_UPLOAD_SIZE = 50 * 1024 * 1024

# Supported image MIME types
IMAGE_MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}

# Supported audio MIME types
AUDIO_MIME_TYPES = {
    ".webm": "audio/webm",
    ".mp4": "audio/mp4",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
}

# Allowed upload MIME types for images
ALLOWED_UPLOAD_TYPES = {
    "image/jpeg",
    "image/png", 
    "image/gif",
    "image/webp",
}

# Allowed upload MIME types for audio
ALLOWED_AUDIO_UPLOAD_TYPES = {
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
    "audio/wav",
    "audio/mpeg",
    "audio/x-m4a",
}

# Extension mapping for image MIME types
MIME_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}

# Extension mapping for audio MIME types
AUDIO_MIME_TO_EXT = {
    "audio/webm": ".webm",
    "audio/mp4": ".mp4",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/mpeg": ".mp3",
    "audio/x-m4a": ".m4a",
}


# ─── UPLOAD ROUTE (must be before catch-all GET) ─────────────────────────────

@router.post("/api/media/upload")
async def upload_media(file: UploadFile = File(...)):
    """Upload an image file for chat attachment.
    
    Accepts: jpeg, png, gif, webp
    Max size: 10MB
    
    Returns:
        path: Absolute path to the saved file
        url: URL to access the file via /api/media/
    """
    # Validate content type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {content_type}. Allowed: jpeg, png, gif, webp"
        )
    
    # Read file content (with size check)
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {MAX_UPLOAD_SIZE // (1024*1024)}MB"
        )
    
    # Generate unique filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]
    ext = MIME_TO_EXT.get(content_type, ".jpg")
    filename = f"chat_{timestamp}_{unique_id}{ext}"
    
    # Ensure upload directory exists
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    
    # Save file
    file_path = UPLOAD_DIR / filename
    try:
        with open(file_path, "wb") as f:
            f.write(content)
        logger.info(f"Uploaded media file: {file_path}")
    except Exception as e:
        logger.error(f"Failed to save upload: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to save file"
        )
    
    # Return path info
    return {
        "success": True,
        "path": str(file_path),
        "url": f"/api/media/{file_path}",
        "filename": filename,
        "mimeType": content_type,
        "size": len(content),
    }


# ─── AUDIO UPLOAD ROUTE ──────────────────────────────────────────────────────

@router.post("/api/media/audio")
async def upload_audio(file: UploadFile = File(...)):
    """Upload an audio file for voice message.
    
    Accepts: webm, mp4, ogg, wav, mp3, m4a
    Max size: 50MB
    
    Returns:
        url: URL to access the file via /api/media/
        filename: Saved filename
        mimeType: Detected MIME type
        size: File size in bytes
    """
    # Normalize content type (browsers may send audio/webm;codecs=opus)
    raw_content_type = (file.content_type or "").split(";")[0].strip().lower()
    
    # Accept audio/* types broadly
    if not raw_content_type.startswith("audio/") and raw_content_type not in ALLOWED_AUDIO_UPLOAD_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type}. Expected audio/*"
        )
    
    # Read file content (with size check)
    content = await file.read()
    if len(content) > MAX_AUDIO_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {MAX_AUDIO_UPLOAD_SIZE // (1024*1024)}MB"
        )
    
    # Determine extension
    ext = AUDIO_MIME_TO_EXT.get(raw_content_type, ".webm")
    
    # Generate unique filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]
    filename = f"voice_{timestamp}_{unique_id}{ext}"
    
    # Ensure audio upload directory exists
    AUDIO_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    
    # Save file
    file_path = AUDIO_UPLOAD_DIR / filename
    try:
        with open(file_path, "wb") as f:
            f.write(content)
        logger.info(f"Uploaded audio file: {file_path}")
    except Exception as e:
        logger.error(f"Failed to save audio upload: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to save audio file"
        )
    
    return {
        "success": True,
        "url": f"/api/media/{file_path}",
        "filename": filename,
        "mimeType": raw_content_type,
        "size": len(content),
    }


# ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

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


def get_mime_type(file_path: Path) -> Optional[str]:
    """Get MIME type for a file based on extension (images and audio)."""
    ext = file_path.suffix.lower()
    return IMAGE_MIME_TYPES.get(ext) or AUDIO_MIME_TYPES.get(ext)


@router.get("/api/media/{file_path:path}")
async def serve_media(file_path: str):
    """Serve a media file from allowed directories.
    
    Args:
        file_path: Path to the media file (can be absolute or relative to home/.openclaw/media)
        
    Returns:
        FileResponse with the image or audio
        
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
    
    # Check MIME type (images + audio)
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
