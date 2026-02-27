"""Tests for media routes (upload, audio upload, serve)."""

import io
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

pytestmark = pytest.mark.asyncio


# ── Helper functions tests ───────────────────────────────────────


class TestIsPathAllowed:
    def test_allowed_path(self, tmp_path):
        from app.routes.media import is_path_allowed

        with patch("app.routes.media.ALLOWED_MEDIA_DIRS", [tmp_path]):
            f = tmp_path / "test.jpg"
            f.touch()
            assert is_path_allowed(f) is True

    def test_disallowed_path(self):
        from app.routes.media import is_path_allowed

        assert is_path_allowed(Path("/etc/passwd")) is False

    def test_traversal_attack(self, tmp_path):
        from app.routes.media import is_path_allowed

        p = tmp_path / ".." / ".." / "etc" / "passwd"
        assert is_path_allowed(p) is False


class TestGetMimeType:
    def test_image_types(self):
        from app.routes.media import get_mime_type

        assert get_mime_type(Path("photo.jpg")) == "image/jpeg"
        assert get_mime_type(Path("photo.jpeg")) == "image/jpeg"
        assert get_mime_type(Path("photo.png")) == "image/png"
        assert get_mime_type(Path("photo.gif")) == "image/gif"
        assert get_mime_type(Path("photo.webp")) == "image/webp"

    def test_audio_types(self):
        from app.routes.media import get_mime_type

        assert get_mime_type(Path("voice.webm")) == "audio/webm"
        assert get_mime_type(Path("voice.mp4")) == "audio/mp4"
        assert get_mime_type(Path("voice.ogg")) == "audio/ogg"
        assert get_mime_type(Path("voice.wav")) == "audio/wav"

    def test_unsupported(self):
        from app.routes.media import get_mime_type

        assert get_mime_type(Path("file.txt")) is None
        assert get_mime_type(Path("file.pdf")) is None


# ── Upload image tests ───────────────────────────────────────────


class TestUploadMedia:
    async def test_upload_success(self, client):
        content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        with patch("app.routes.media.UPLOAD_DIR", Path(tempfile.mkdtemp())):
            resp = await client.post(
                "/api/media/upload",
                files={"file": ("test.png", io.BytesIO(content), "image/png")},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["filename"].endswith(".png")
        assert data["mimeType"] == "image/png"
        assert data["size"] == len(content)

    async def test_upload_unsupported_type(self, client):
        resp = await client.post(
            "/api/media/upload",
            files={"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")},
        )
        assert resp.status_code == 415

    async def test_upload_too_large(self, client):
        big = b"\x00" * (10 * 1024 * 1024 + 1)
        resp = await client.post(
            "/api/media/upload",
            files={"file": ("big.png", io.BytesIO(big), "image/png")},
        )
        assert resp.status_code == 413

    async def test_upload_save_failure(self, client):
        content = b"\x89PNG" + b"\x00" * 50
        tmp = Path(tempfile.mkdtemp())
        with patch("app.routes.media.UPLOAD_DIR", tmp):
            with patch("app.routes.media.aiofiles.open", side_effect=OSError("disk full")):
                resp = await client.post(
                    "/api/media/upload",
                    files={"file": ("test.png", io.BytesIO(content), "image/png")},
                )
        assert resp.status_code == 500


# ── Upload audio tests ───────────────────────────────────────────


class TestUploadAudio:
    async def test_upload_audio_success(self, client):
        content = b"\x00" * 200
        tmp = Path(tempfile.mkdtemp())
        with (
            patch("app.routes.media.AUDIO_UPLOAD_DIR", tmp),
            patch("app.routes.media._transcribe_audio", new_callable=AsyncMock, return_value=("hello", None)),
        ):
            resp = await client.post(
                "/api/media/audio",
                files={"file": ("voice.webm", io.BytesIO(content), "audio/webm")},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["transcript"] == "hello"
        assert data["transcriptError"] is None

    async def test_upload_audio_with_codec_suffix(self, client):
        """Browser sends audio/webm;codecs=opus — should be accepted."""
        content = b"\x00" * 100
        tmp = Path(tempfile.mkdtemp())
        with (
            patch("app.routes.media.AUDIO_UPLOAD_DIR", tmp),
            patch("app.routes.media._transcribe_audio", new_callable=AsyncMock, return_value=(None, "no key")),
        ):
            resp = await client.post(
                "/api/media/audio",
                files={"file": ("voice.webm", io.BytesIO(content), "audio/webm;codecs=opus")},
            )
        assert resp.status_code == 200

    async def test_upload_audio_unsupported_type(self, client):
        resp = await client.post(
            "/api/media/audio",
            files={"file": ("file.txt", io.BytesIO(b"hello"), "text/plain")},
        )
        assert resp.status_code == 415

    async def test_upload_audio_too_large(self, client):
        big = b"\x00" * (50 * 1024 * 1024 + 1)
        tmp = Path(tempfile.mkdtemp())
        with patch("app.routes.media.AUDIO_UPLOAD_DIR", tmp):
            resp = await client.post(
                "/api/media/audio",
                files={"file": ("voice.webm", io.BytesIO(big), "audio/webm")},
            )
        assert resp.status_code == 413

    async def test_upload_audio_save_failure(self, client):
        content = b"\x00" * 50
        tmp = Path(tempfile.mkdtemp())
        with patch("app.routes.media.AUDIO_UPLOAD_DIR", tmp):
            with patch("app.routes.media.aiofiles.open", side_effect=OSError("fail")):
                resp = await client.post(
                    "/api/media/audio",
                    files={"file": ("voice.webm", io.BytesIO(content), "audio/webm")},
                )
        assert resp.status_code == 500

    async def test_upload_audio_transcription_exception(self, client):
        """Transcription exception should not break upload."""
        content = b"\x00" * 100
        tmp = Path(tempfile.mkdtemp())
        with (
            patch("app.routes.media.AUDIO_UPLOAD_DIR", tmp),
            patch("app.routes.media._transcribe_audio", new_callable=AsyncMock, side_effect=RuntimeError("boom")),
        ):
            resp = await client.post(
                "/api/media/audio",
                files={"file": ("voice.webm", io.BytesIO(content), "audio/webm")},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["transcriptError"] == "Transcription failed"


# ── Serve media tests ────────────────────────────────────────────


class TestServeMedia:
    async def test_serve_image(self, client, tmp_path):
        img = tmp_path / "test.jpg"
        img.write_bytes(b"\xff\xd8\xff\xe0" + b"\x00" * 100)
        with patch("app.routes.media.ALLOWED_MEDIA_DIRS", [tmp_path]):
            resp = await client.get(f"/api/media/{img}")
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("image/jpeg")

    async def test_serve_not_found(self, client):
        resp = await client.get("/api/media/files/nonexistent.jpg")
        assert resp.status_code == 404

    async def test_serve_unsupported_type(self, client, tmp_path):
        txt = tmp_path / "readme.txt"
        txt.write_text("hello")
        with patch("app.routes.media.ALLOWED_MEDIA_DIRS", [tmp_path]):
            resp = await client.get(f"/api/media/{txt}")
        assert resp.status_code == 415

    async def test_serve_path_not_allowed(self, client):
        resp = await client.get("/api/media//etc/passwd")
        assert resp.status_code == 404

    async def test_serve_relative_audio(self, client, tmp_path):
        audio_file = tmp_path / "voice.webm"
        audio_file.write_bytes(b"\x00" * 50)
        with patch("app.routes.media.AUDIO_UPLOAD_DIR", tmp_path):
            with patch("app.routes.media.ALLOWED_MEDIA_DIRS", [tmp_path]):
                resp = await client.get("/api/media/audio/voice.webm")
        assert resp.status_code == 200

    async def test_serve_relative_files(self, client, tmp_path):
        f = tmp_path / "pic.png"
        f.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 50)
        with patch("app.routes.media.UPLOAD_DIR", tmp_path):
            with patch("app.routes.media.ALLOWED_MEDIA_DIRS", [tmp_path]):
                resp = await client.get("/api/media/files/pic.png")
        assert resp.status_code == 200

    async def test_serve_directory_rejected(self, client, tmp_path):
        d = tmp_path / "subdir.jpg"
        d.mkdir()
        with patch("app.routes.media.ALLOWED_MEDIA_DIRS", [tmp_path]):
            resp = await client.get(f"/api/media/{d}")
        assert resp.status_code == 404


# ── Transcription helper tests ───────────────────────────────────


class TestTranscribeAudio:
    async def test_no_api_key(self):
        from app.routes.media import _transcribe_audio

        with patch.dict("os.environ", {}, clear=True):
            with patch("os.environ.get", return_value=None):
                transcript, err = await _transcribe_audio(Path("/tmp/test.webm"))
        assert transcript is None
        assert "API key" in err

    async def test_no_ffmpeg(self):
        from app.routes.media import _transcribe_audio

        with (
            patch("os.environ.get", return_value="fake-key"),
            patch("os.path.isfile", return_value=False),
        ):
            transcript, err = await _transcribe_audio(Path("/tmp/test.webm"))
        assert transcript is None
        assert "not available" in err

    async def test_ffmpeg_failure(self):
        from app.routes.media import _transcribe_audio

        mock_proc = AsyncMock()
        mock_proc.communicate.return_value = (b"", b"error")
        mock_proc.returncode = 1

        with (
            patch("os.environ.get", return_value="fake-key"),
            patch("os.path.isfile", return_value=True),
            patch("asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=mock_proc),
            patch("tempfile.mkstemp", return_value=(99, "/tmp/fake.mp3")),
            patch("os.close"),
            patch("os.unlink"),
        ):
            transcript, err = await _transcribe_audio(Path("/tmp/test.webm"))
        assert transcript is None
        assert "not available" in err

    async def test_successful_transcription(self):
        from app.routes.media import _transcribe_audio

        mock_proc = AsyncMock()
        mock_proc.communicate.return_value = (b"", b"")
        mock_proc.returncode = 0

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"text": "hallo wereld"}

        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post.return_value = mock_response

        mock_afile = AsyncMock()
        mock_afile.__aenter__ = AsyncMock(return_value=mock_afile)
        mock_afile.__aexit__ = AsyncMock(return_value=False)
        mock_afile.read.return_value = b"fake mp3 data"

        with (
            patch("os.environ.get", return_value="fake-key"),
            patch("os.path.isfile", return_value=True),
            patch("asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=mock_proc),
            patch("tempfile.mkstemp", return_value=(99, "/tmp/fake.mp3")),
            patch("os.close"),
            patch("os.unlink"),
            patch("app.routes.media.aiofiles.open", return_value=mock_afile),
            patch("app.routes.media.httpx.AsyncClient", return_value=mock_http),
        ):
            transcript, err = await _transcribe_audio(Path("/tmp/test.webm"))
        assert transcript == "hallo wereld"
        assert err is None

    async def test_groq_api_error(self):
        from app.routes.media import _transcribe_audio

        mock_proc = AsyncMock()
        mock_proc.communicate.return_value = (b"", b"")
        mock_proc.returncode = 0

        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post.return_value = mock_response

        mock_afile = AsyncMock()
        mock_afile.__aenter__ = AsyncMock(return_value=mock_afile)
        mock_afile.__aexit__ = AsyncMock(return_value=False)
        mock_afile.read.return_value = b"mp3"

        with (
            patch("os.environ.get", return_value="fake-key"),
            patch("os.path.isfile", return_value=True),
            patch("asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=mock_proc),
            patch("tempfile.mkstemp", return_value=(99, "/tmp/fake.mp3")),
            patch("os.close"),
            patch("os.unlink"),
            patch("app.routes.media.aiofiles.open", return_value=mock_afile),
            patch("app.routes.media.httpx.AsyncClient", return_value=mock_http),
        ):
            transcript, err = await _transcribe_audio(Path("/tmp/test.webm"))
        assert transcript is None
        assert "500" in err

    async def test_ffmpeg_timeout(self):
        from app.routes.media import _transcribe_audio

        mock_proc = AsyncMock()
        mock_proc.communicate.side_effect = TimeoutError()
        mock_proc.kill = MagicMock()

        with (
            patch("os.environ.get", return_value="fake-key"),
            patch("os.path.isfile", return_value=True),
            patch("asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=mock_proc),
            patch("tempfile.mkstemp", return_value=(99, "/tmp/fake.mp3")),
            patch("os.close"),
            patch("os.unlink"),
            patch("asyncio.wait_for", side_effect=TimeoutError()),
        ):
            transcript, err = await _transcribe_audio(Path("/tmp/test.webm"))
        assert transcript is None

    async def test_httpx_timeout(self):
        import httpx as httpx_mod

        from app.routes.media import _transcribe_audio

        mock_proc = AsyncMock()
        mock_proc.communicate.return_value = (b"", b"")
        mock_proc.returncode = 0

        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post.side_effect = httpx_mod.TimeoutException("timeout")

        mock_afile = AsyncMock()
        mock_afile.__aenter__ = AsyncMock(return_value=mock_afile)
        mock_afile.__aexit__ = AsyncMock(return_value=False)
        mock_afile.read.return_value = b"mp3"

        with (
            patch("os.environ.get", return_value="fake-key"),
            patch("os.path.isfile", return_value=True),
            patch("asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=mock_proc),
            patch("tempfile.mkstemp", return_value=(99, "/tmp/fake.mp3")),
            patch("os.close"),
            patch("os.unlink"),
            patch("app.routes.media.aiofiles.open", return_value=mock_afile),
            patch("app.routes.media.httpx.AsyncClient", return_value=mock_http),
        ):
            transcript, err = await _transcribe_audio(Path("/tmp/test.webm"))
        assert transcript is None
        assert "timed out" in err
