"""Media file serving and upload endpoint.

Serves media files from allowed directories with security checks.
Supports images from OpenClaw media folder.
Handles image uploads for chat attachments.
Handles audio uploads for voice messages with auto-transcription via Groq Whisper.
"""

import asyncio
import logging
import os
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Annotated, Optional

import aiofiles
import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

MEDIA_DIR = ".crewhub"
OPENCLAW_DIR = ".openclaw"
EXT_WEBM = ".webm"
MIME_WEBM = "audio/webm"
MIME_MP4 = "audio/mp4"
MIME_OGG = "audio/ogg"
MIME_WAV = "audio/wav"
MIME_MPEG = "audio/mpeg"
MIME_JPEG = "image/jpeg"
MIME_PNG = "image/png"
MIME_GIF = "image/gif"
MIME_WEBP = "image/webp"
MSG_NO_AUDIO_CONV = "Audio conversion not available"
MSG_AUDIO_PREFIX = "audio/"

logger = logging.getLogger(__name__)

router = APIRouter()

# Upload directory for chat images
UPLOAD_DIR = Path.home() / OPENCLAW_DIR / "media" / "uploads"

# Upload directory for voice messages
AUDIO_UPLOAD_DIR = Path.home() / MEDIA_DIR / "media" / "audio"

# Allowed base directories for media files (resolved to absolute paths)
ALLOWED_MEDIA_DIRS = [
    Path.home() / OPENCLAW_DIR / "media",
    Path.home() / OPENCLAW_DIR / "media" / "inbound",
    Path.home() / OPENCLAW_DIR / "media" / "uploads",
    Path.home() / MEDIA_DIR / "media",
    Path.home() / MEDIA_DIR / "media" / "audio",
    Path("/tmp") / "crewhub-media",  # For testing
]

# Max upload size for images: 10MB
MAX_UPLOAD_SIZE = 10 * 1024 * 1024

# Max upload size for audio: 50MB
MAX_AUDIO_UPLOAD_SIZE = 50 * 1024 * 1024

# Supported image MIME types
IMAGE_MIME_TYPES = {
    ".jpg": MIME_JPEG,
    ".jpeg": MIME_JPEG,
    ".png": MIME_PNG,
    ".gif": MIME_GIF,
    ".webp": MIME_WEBP,
}

# Supported audio MIME types
AUDIO_MIME_TYPES = {
    EXT_WEBM: MIME_WEBM,
    ".mp4": MIME_MP4,
    ".ogg": MIME_OGG,
    ".wav": MIME_WAV,
    ".m4a": MIME_MP4,
}

# Allowed upload MIME types for images
ALLOWED_UPLOAD_TYPES = {
    MIME_JPEG,
    MIME_PNG,
    MIME_GIF,
    MIME_WEBP,
}

# Allowed upload MIME types for audio
ALLOWED_AUDIO_UPLOAD_TYPES = {
    MIME_WEBM,
    MIME_MP4,
    MIME_OGG,
    MIME_WAV,
    MIME_MPEG,
    "audio/x-m4a",
}

# Extension mapping for image MIME types
MIME_TO_EXT = {
    MIME_JPEG: ".jpg",
    MIME_PNG: ".png",
    MIME_GIF: ".gif",
    MIME_WEBP: ".webp",
}

# Extension mapping for audio MIME types
AUDIO_MIME_TO_EXT = {
    MIME_WEBM: EXT_WEBM,
    MIME_MP4: ".mp4",
    MIME_OGG: ".ogg",
    MIME_WAV: ".wav",
    MIME_MPEG: ".mp3",
    "audio/x-m4a": ".m4a",
}


# ─── UPLOAD ROUTE (must be before catch-all GET) ─────────────────────────────


@router.post(
    "/api/media/upload",
    responses={
        413: {"description": "Request entity too large"},
        415: {"description": "Unsupported media type"},
        500: {"description": "Internal server error"},
    },
)
async def upload_media(file: Annotated[UploadFile, File(...)]):
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
            status_code=415, detail=f"Unsupported file type: {content_type}. Allowed: jpeg, png, gif, webp"
        )

    # Read file content (with size check)
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413, detail=f"File too large. Maximum size: {MAX_UPLOAD_SIZE // (1024 * 1024)}MB"
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
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)
        logger.info(f"Uploaded media file: {file_path}")
    except Exception as e:
        logger.error(f"Failed to save upload: {e}")
        raise HTTPException(status_code=500, detail="Failed to save file")

    # Return path info
    return {
        "success": True,
        "path": str(file_path),
        "url": f"/api/media/files/{filename}",
        "filename": filename,
        "mimeType": content_type,
        "size": len(content),
    }


# ─── AUDIO UPLOAD ROUTE ──────────────────────────────────────────────────────

FFMPEG_PATH = "/opt/homebrew/bin/ffmpeg"
GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_MODEL = "whisper-large-v3"


async def _transcribe_audio(audio_path: Path) -> tuple[Optional[str], Optional[str]]:
    """Transcribe an audio file via Groq Whisper API.

    Converts audio to mp3 first via ffmpeg, then calls Groq API.

    Returns:
        (transcript, error) — one will be None if the other is set.
    """
    # Check for API key
    groq_api_key = os.environ.get("GROQ_API_KEY")
    if not groq_api_key:
        return None, "No transcription API key configured"

    # Check for ffmpeg
    if not os.path.isfile(FFMPEG_PATH):
        return None, MSG_NO_AUDIO_CONV

    # Convert to mp3 via ffmpeg in a temp file
    fd, mp3_path = tempfile.mkstemp(suffix=".mp3")
    os.close(fd)

    try:
        proc = await asyncio.create_subprocess_exec(
            FFMPEG_PATH,
            "-y",  # overwrite output
            "-i",
            str(audio_path),
            "-ar",
            "16000",  # 16kHz sample rate (optimal for Whisper)
            "-ac",
            "1",  # mono
            "-b:a",
            "64k",  # 64kbps bitrate
            mp3_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            _, stderr_bytes = await asyncio.wait_for(proc.communicate(), timeout=30)
        except asyncio.TimeoutError:
            proc.kill()
            return None, MSG_NO_AUDIO_CONV
        if proc.returncode != 0:
            logger.warning(f"ffmpeg conversion failed: {stderr_bytes.decode()[:200]}")
            return None, MSG_NO_AUDIO_CONV
    except FileNotFoundError:
        return None, MSG_NO_AUDIO_CONV

    # Call Groq Whisper API
    try:
        async with aiofiles.open(mp3_path, "rb") as af:
            mp3_bytes = await af.read()
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                GROQ_TRANSCRIPTION_URL,
                headers={"Authorization": f"Bearer {groq_api_key}"},
                files={"file": ("audio.mp3", mp3_bytes, MIME_MPEG)},
                data={
                    "model": GROQ_MODEL,
                    "response_format": "json",
                    "language": "nl",
                },
            )

        if response.status_code == 200:
            data = response.json()
            transcript = data.get("text", "").strip()
            logger.info(f"Transcription successful: {len(transcript)} chars")
            return transcript, None
        else:
            logger.warning(f"Groq API error: {response.status_code} {response.text[:200]}")
            return None, f"Transcription failed: {response.status_code}"

    except httpx.TimeoutException:
        return None, "Transcription timed out"
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        return None, f"Transcription failed: {str(e)[:100]}"
    finally:
        # Clean up temp mp3
        try:
            os.unlink(mp3_path)
        except Exception:
            pass


@router.post(
    "/api/media/audio",
    responses={
        413: {"description": "Request entity too large"},
        415: {"description": "Unsupported media type"},
        500: {"description": "Internal server error"},
    },
)
async def upload_audio(file: Annotated[UploadFile, File(...)]):
    """Upload an audio file for voice message.

    Accepts: webm, mp4, ogg, wav, mp3, m4a
    Max size: 50MB

    Auto-transcribes via Groq Whisper if GROQ_API_KEY is set.
    Transcription failure never breaks the upload — audio URL is always returned.

    Returns:
        url: URL to access the file via /api/media/
        filename: Saved filename
        mimeType: Detected MIME type
        size: File size in bytes
        transcript: Transcribed text (null if unavailable)
        transcriptError: Error message if transcription failed (null on success)
    """
    # Normalize content type (browsers may send audio/webm;codecs=opus)
    raw_content_type = (file.content_type or "").split(";")[0].strip().lower()

    # Accept audio/* types broadly
    if not raw_content_type.startswith(MSG_AUDIO_PREFIX) and raw_content_type not in ALLOWED_AUDIO_UPLOAD_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {file.content_type}. Expected audio/*")

    # Read file content (with size check)
    content = await file.read()
    if len(content) > MAX_AUDIO_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413, detail=f"File too large. Maximum size: {MAX_AUDIO_UPLOAD_SIZE // (1024 * 1024)}MB"
        )

    # Determine extension
    ext = AUDIO_MIME_TO_EXT.get(raw_content_type, EXT_WEBM)

    # Generate unique filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]
    filename = f"voice_{timestamp}_{unique_id}{ext}"

    # Ensure audio upload directory exists
    AUDIO_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Save file
    file_path = AUDIO_UPLOAD_DIR / filename
    try:
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)
        logger.info(f"Uploaded audio file: {file_path}")
    except Exception as e:
        logger.error(f"Failed to save audio upload: {e}")
        raise HTTPException(status_code=500, detail="Failed to save audio file")

    # Auto-transcribe (never let failure break the upload)
    transcript: Optional[str] = None
    transcript_error: Optional[str] = None
    try:
        transcript, transcript_error = await _transcribe_audio(file_path)
    except Exception as e:
        logger.error(f"Unexpected transcription error: {e}")
        transcript_error = "Transcription failed"

    return {
        "success": True,
        "url": f"/api/media/audio/{filename}",
        "filename": filename,
        "mimeType": raw_content_type,
        "size": len(content),
        "transcript": transcript,
        "transcriptError": transcript_error,
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


@router.get(
    "/api/media/{file_path:path}",
    responses={404: {"description": "Not found"}, 415: {"description": "Unsupported media type"}},
)
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
    elif file_path.startswith(MSG_AUDIO_PREFIX):
        # Audio uploads → ~/.crewhub/media/audio/
        filename = file_path[len("audio/") :]
        path = AUDIO_UPLOAD_DIR / filename
    elif file_path.startswith("files/"):
        # Image/file uploads → ~/.openclaw/media/uploads/
        filename = file_path[len("files/") :]
        path = UPLOAD_DIR / filename
    else:
        # Relative to ~/.openclaw/media
        path = Path.home() / OPENCLAW_DIR / "media" / file_path

    # Security check: ensure path is in allowed directories
    if not is_path_allowed(path):
        logger.warning(f"Media access denied - path not allowed: {file_path}")  # NOSONAR
        raise HTTPException(status_code=404, detail="File not found")

    # Check if file exists
    resolved_path = path.resolve()
    if not resolved_path.exists():
        logger.debug(f"Media file not found: {resolved_path}")
        raise HTTPException(status_code=404, detail="File not found")

    if not resolved_path.is_file():
        raise HTTPException(status_code=404, detail="Not a file")

    # Check MIME type (images + audio)
    mime_type = get_mime_type(resolved_path)
    if not mime_type:
        logger.warning(f"Unsupported media type: {resolved_path.suffix}")
        raise HTTPException(status_code=415, detail=f"Unsupported media type: {resolved_path.suffix}")

    logger.debug(f"Serving media file: {resolved_path}")

    return FileResponse(
        path=str(resolved_path),
        media_type=mime_type,
        filename=resolved_path.name,
    )
