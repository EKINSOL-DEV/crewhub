"""Tests for discovery service (app.services.discovery)."""

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.services.discovery import (
    ClaudeCodeDetector,
    CodexDetector,
    DiscoveryCandidate,
    DiscoveryService,
    OpenClawDetector,
    get_discovery_service,
)

# ── DiscoveryCandidate ──────────────────────────────────────────


class TestDiscoveryCandidate:
    def test_defaults(self):
        c = DiscoveryCandidate(runtime_type="openclaw", discovery_method="port_probe")
        assert c.confidence == "low"
        assert c.status == "not_found"
        assert c.evidence == []
        assert c.target == {}

    def test_to_dict(self):
        c = DiscoveryCandidate(
            runtime_type="openclaw",
            discovery_method="port_probe",
            confidence="high",
            status="reachable",
            evidence=["found it"],
            metadata={"version": "1.0"},
        )
        d = c.to_dict()
        assert d["runtime_type"] == "openclaw"
        assert d["confidence"] == "high"
        assert d["metadata"]["version"] == "1.0"
        assert "evidence" in d


# ── OpenClawDetector ────────────────────────────────────────────


class TestOpenClawDetector:
    def test_read_config_no_files(self, tmp_path):
        detector = OpenClawDetector()
        detector.CONFIG_PATHS = [tmp_path / "nonexistent.json"]
        port, token, found, path_used = detector._read_config()
        assert port == 18789
        assert token is None
        assert found is False

    def test_read_config_with_file(self, tmp_path):
        config = tmp_path / "openclaw.json"
        config.write_text(json.dumps({"gateway": {"port": 19000, "auth": {"token": "secret123"}}}))
        detector = OpenClawDetector()
        detector.CONFIG_PATHS = [config]
        port, token, found, path_used = detector._read_config()
        assert port == 19000
        assert token == "secret123"
        assert found is True
        assert path_used == config

    def test_read_config_bad_json(self, tmp_path):
        config = tmp_path / "openclaw.json"
        config.write_text("not json")
        detector = OpenClawDetector()
        detector.CONFIG_PATHS = [config]
        port, token, found, path_used = detector._read_config()
        assert found is True  # file exists
        assert token is None  # but can't parse

    def test_read_config_token_from_gateway_level(self, tmp_path):
        config = tmp_path / "openclaw.json"
        config.write_text(json.dumps({"gateway": {"token": "tok2"}}))
        detector = OpenClawDetector()
        detector.CONFIG_PATHS = [config]
        _, token, _, _ = detector._read_config()
        assert token == "tok2"

    def test_apply_probe_status_reachable(self):
        detector = OpenClawDetector()
        candidate = DiscoveryCandidate(runtime_type="openclaw", discovery_method="port_probe")
        detector._apply_probe_status(
            candidate,
            {"reachable": True, "sessions": 3, "version": "1.2.3"},
            process_running=True,
            config_found=True,
            url="ws://127.0.0.1:18789",
        )
        assert candidate.status == "reachable"
        assert candidate.confidence == "high"
        assert candidate.metadata["sessions_count"] == 3

    def test_apply_probe_status_auth_required(self):
        detector = OpenClawDetector()
        candidate = DiscoveryCandidate(runtime_type="openclaw", discovery_method="port_probe")
        detector._apply_probe_status(
            candidate,
            {"reachable": False, "auth_required": True},
            process_running=False,
            config_found=True,
            url="ws://127.0.0.1:18789",
        )
        assert candidate.status == "auth_required"
        assert candidate.confidence == "medium"

    def test_apply_probe_status_process_running_unreachable(self):
        detector = OpenClawDetector()
        candidate = DiscoveryCandidate(runtime_type="openclaw", discovery_method="port_probe")
        detector._apply_probe_status(
            candidate,
            {"reachable": False},
            process_running=True,
            config_found=True,
            url="ws://127.0.0.1:18789",
        )
        assert candidate.status == "unreachable"
        assert candidate.confidence == "medium"

    def test_apply_probe_status_config_only(self):
        detector = OpenClawDetector()
        candidate = DiscoveryCandidate(runtime_type="openclaw", discovery_method="port_probe")
        detector._apply_probe_status(
            candidate,
            {"reachable": False},
            process_running=False,
            config_found=True,
            url="ws://127.0.0.1:18789",
        )
        assert candidate.status == "unreachable"
        assert candidate.confidence == "low"

    def test_apply_probe_status_not_found(self):
        detector = OpenClawDetector()
        candidate = DiscoveryCandidate(runtime_type="openclaw", discovery_method="port_probe")
        detector._apply_probe_status(
            candidate,
            {"reachable": False},
            process_running=False,
            config_found=False,
            url="ws://127.0.0.1:18789",
        )
        assert candidate.status == "not_found"

    @pytest.mark.anyio
    async def test_check_process_not_found(self):
        detector = OpenClawDetector()
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            proc = AsyncMock()
            proc.communicate = AsyncMock(return_value=(b"", b""))
            proc.returncode = 1
            mock_exec.return_value = proc
            result = await detector._check_process()
        assert result is False

    @pytest.mark.anyio
    async def test_check_process_found(self):
        detector = OpenClawDetector()
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            proc = AsyncMock()
            proc.communicate = AsyncMock(return_value=(b"12345\n", b""))
            proc.returncode = 0
            mock_exec.return_value = proc
            result = await detector._check_process()
        assert result is True

    @pytest.mark.anyio
    async def test_check_process_exception(self):
        detector = OpenClawDetector()
        with patch("asyncio.create_subprocess_exec", side_effect=Exception("nope")):
            result = await detector._check_process()
        assert result is False

    @pytest.mark.anyio
    async def test_probe_websocket_timeout(self):
        detector = OpenClawDetector()
        with patch("websockets.connect", side_effect=TimeoutError):
            result = await detector._probe_websocket("ws://127.0.0.1:99999")
        assert result["reachable"] is False

    @pytest.mark.anyio
    async def test_probe_websocket_connection_error(self):
        detector = OpenClawDetector()
        with patch("websockets.connect", side_effect=ConnectionRefusedError):
            result = await detector._probe_websocket("ws://127.0.0.1:99999")
        assert result["reachable"] is False

    @pytest.mark.anyio
    async def test_detect_full_not_found(self, tmp_path):
        detector = OpenClawDetector()
        detector.CONFIG_PATHS = [tmp_path / "nope.json"]
        with (
            patch.object(detector, "_check_process", return_value=False),
            patch.object(detector, "_probe_websocket", return_value={"reachable": False}),
        ):
            candidates = await detector.detect()
        assert len(candidates) == 1
        assert candidates[0].status == "not_found"

    @pytest.mark.anyio
    async def test_detect_full_reachable(self, tmp_path):
        config = tmp_path / "openclaw.json"
        config.write_text(json.dumps({"gateway": {"port": 18789, "auth": {"token": "t"}}}))
        detector = OpenClawDetector()
        detector.CONFIG_PATHS = [config]
        with (
            patch.object(detector, "_check_process", return_value=True),
            patch.object(detector, "_probe_websocket", return_value={"reachable": True, "sessions": 2}),
        ):
            candidates = await detector.detect()
        assert candidates[0].status == "reachable"
        assert candidates[0].confidence == "high"
        assert "Config file found" in candidates[0].evidence[0]

    @pytest.mark.anyio
    async def test_get_session_count_success(self):
        detector = OpenClawDetector()
        ws = AsyncMock()
        ws.send = AsyncMock()
        ws.recv = AsyncMock(
            return_value=json.dumps(
                {
                    "ok": True,
                    "payload": {"sessions": [{"id": 1}, {"id": 2}]},
                }
            )
        )
        count = await detector._get_session_count(ws)
        assert count == 2

    @pytest.mark.anyio
    async def test_get_session_count_failure(self):
        detector = OpenClawDetector()
        ws = AsyncMock()
        ws.send = AsyncMock(side_effect=Exception("closed"))
        count = await detector._get_session_count(ws)
        assert count is None


# ── ClaudeCodeDetector ──────────────────────────────────────────


class TestClaudeCodeDetector:
    @pytest.mark.anyio
    async def test_detect_with_cli(self):
        detector = ClaudeCodeDetector()
        with (
            patch.object(detector, "_get_cli_version", return_value="claude 1.0.0"),
            patch.object(Path, "is_dir", return_value=True),
        ):
            candidates = await detector.detect()
        assert candidates[0].status == "installed_only"
        assert candidates[0].confidence == "high"
        assert "claude 1.0.0" in candidates[0].evidence[0]

    @pytest.mark.anyio
    async def test_detect_config_only(self):
        detector = ClaudeCodeDetector()
        with (
            patch.object(detector, "_get_cli_version", return_value=None),
            patch.object(Path, "is_dir", return_value=True),
        ):
            candidates = await detector.detect()
        assert candidates[0].status == "installed_only"
        assert candidates[0].confidence == "medium"

    @pytest.mark.anyio
    async def test_detect_not_found(self):
        detector = ClaudeCodeDetector()
        with (
            patch.object(detector, "_get_cli_version", return_value=None),
            patch.object(Path, "is_dir", return_value=False),
        ):
            candidates = await detector.detect()
        assert candidates[0].status == "not_found"

    @pytest.mark.anyio
    async def test_get_cli_version_success(self):
        detector = ClaudeCodeDetector()
        with (
            patch("shutil.which", return_value="/usr/bin/claude"),
            patch("asyncio.create_subprocess_exec") as mock_exec,
        ):
            proc = AsyncMock()
            proc.communicate = AsyncMock(return_value=(b"claude 2.0.0\n", b""))
            proc.returncode = 0
            mock_exec.return_value = proc
            version = await detector._get_cli_version()
        assert version == "claude 2.0.0"

    @pytest.mark.anyio
    async def test_get_cli_version_not_found(self):
        detector = ClaudeCodeDetector()
        with patch("shutil.which", return_value=None):
            version = await detector._get_cli_version()
        assert version is None

    @pytest.mark.anyio
    async def test_get_cli_version_error(self):
        detector = ClaudeCodeDetector()
        with (
            patch("shutil.which", return_value="/usr/bin/claude"),
            patch("asyncio.create_subprocess_exec", side_effect=Exception("fail")),
        ):
            version = await detector._get_cli_version()
        assert version is None


# ── CodexDetector ───────────────────────────────────────────────


class TestCodexDetector:
    @pytest.mark.anyio
    async def test_detect_with_cli(self):
        detector = CodexDetector()
        with patch.object(detector, "_get_cli_version", return_value="codex 0.1"):
            candidates = await detector.detect()
        assert candidates[0].status == "installed_only"
        assert candidates[0].confidence == "high"

    @pytest.mark.anyio
    async def test_detect_not_found(self):
        detector = CodexDetector()
        with patch.object(detector, "_get_cli_version", return_value=None):
            candidates = await detector.detect()
        assert candidates[0].status == "not_found"

    @pytest.mark.anyio
    async def test_get_cli_version_success(self):
        detector = CodexDetector()
        with patch("shutil.which", return_value="/usr/bin/codex"), patch("asyncio.create_subprocess_exec") as mock_exec:
            proc = AsyncMock()
            proc.communicate = AsyncMock(return_value=(b"codex 0.1\n", b""))
            proc.returncode = 0
            mock_exec.return_value = proc
            version = await detector._get_cli_version()
        assert version == "codex 0.1"

    @pytest.mark.anyio
    async def test_get_cli_version_not_found(self):
        detector = CodexDetector()
        with patch("shutil.which", return_value=None):
            version = await detector._get_cli_version()
        assert version is None


# ── DiscoveryService ────────────────────────────────────────────


class TestDiscoveryService:
    @pytest.mark.anyio
    async def test_scan_local(self):
        svc = DiscoveryService()
        mock_detector = AsyncMock()
        mock_detector.detect = AsyncMock(
            return_value=[DiscoveryCandidate(runtime_type="test", discovery_method="mock", status="reachable")]
        )
        svc._detectors["local"] = [mock_detector]
        candidates = await svc.scan("local")
        assert len(candidates) == 1
        assert candidates[0].status == "reachable"

    @pytest.mark.anyio
    async def test_scan_unknown_mode(self):
        svc = DiscoveryService()
        candidates = await svc.scan("unknown")
        assert candidates == []

    @pytest.mark.anyio
    async def test_scan_detector_exception(self):
        svc = DiscoveryService()
        bad_detector = AsyncMock()
        bad_detector.detect = AsyncMock(side_effect=Exception("boom"))
        good_detector = AsyncMock()
        good_detector.detect = AsyncMock(return_value=[DiscoveryCandidate(runtime_type="ok", discovery_method="mock")])
        svc._detectors["local"] = [bad_detector, good_detector]
        candidates = await svc.scan("local")
        assert len(candidates) == 1

    @pytest.mark.anyio
    async def test_test_connection_openclaw(self):
        svc = DiscoveryService()
        with patch.object(OpenClawDetector, "_probe_websocket", return_value={"reachable": True, "sessions": 1}):
            result = await svc.test_connection("openclaw", "ws://127.0.0.1:18789", "token")
        assert result["reachable"] is True
        assert result["sessions"] == 1

    @pytest.mark.anyio
    async def test_test_connection_unsupported(self):
        svc = DiscoveryService()
        result = await svc.test_connection("unknown_runtime", "http://x")
        assert result["reachable"] is False
        assert "not supported" in result["error"]


class TestGetDiscoveryService:
    def test_singleton(self):
        import app.services.discovery as mod

        mod._discovery_service = None
        svc1 = get_discovery_service()
        svc2 = get_discovery_service()
        assert svc1 is svc2
        mod._discovery_service = None  # cleanup
