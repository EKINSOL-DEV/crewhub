"""
Discovery service for finding local agent runtimes.

Provides a pluggable system of detectors that probe for installed
and running runtimes (OpenClaw, Claude Code, Codex CLI).
Each detector returns DiscoveryCandidate objects with evidence.
"""

import asyncio
import json
import logging
import shutil
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

OPENCLAW_DIR = ".openclaw"

logger = logging.getLogger(__name__)


# =============================================================================
# Models
# =============================================================================


@dataclass
class DiscoveryCandidate:
    """Result of a runtime discovery probe."""

    runtime_type: str  # openclaw | claude_code | codex_cli
    discovery_method: str  # port_probe | config_file | cli_detect
    target: dict = field(default_factory=dict)  # {url, host, port, transport}
    auth: dict = field(default_factory=dict)  # {required, token_hint, has_token}
    confidence: str = "low"  # high | medium | low
    status: str = "not_found"  # reachable | unreachable | auth_required | installed_only | not_found
    evidence: list[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "runtime_type": self.runtime_type,
            "discovery_method": self.discovery_method,
            "target": self.target,
            "auth": self.auth,
            "confidence": self.confidence,
            "status": self.status,
            "evidence": self.evidence,
            "metadata": self.metadata,
        }


# =============================================================================
# Base detector
# =============================================================================


class BaseDetector(ABC):
    """Abstract base class for runtime detectors."""

    @abstractmethod
    async def detect(self) -> list[DiscoveryCandidate]:
        """Run detection and return candidates."""
        ...


# =============================================================================
# OpenClaw detector
# =============================================================================


class OpenClawDetector(BaseDetector):
    """Detect local OpenClaw Gateway instances."""

    DEFAULT_PORT = 18789
    # OpenClaw config files in priority order
    CONFIG_PATHS = [
        Path.home() / OPENCLAW_DIR / "openclaw.json",
        Path.home() / OPENCLAW_DIR / "clawdbot.json",
        Path.home() / OPENCLAW_DIR / "config.json",
    ]

    async def detect(self) -> list[DiscoveryCandidate]:
        candidates: list[DiscoveryCandidate] = []

        # 1. Read config file for port/token
        config_port = self.DEFAULT_PORT
        config_token: Optional[str] = None
        config_found = False
        config_path_used: Optional[Path] = None

        for config_path in self.CONFIG_PATHS:
            try:
                if config_path.exists():
                    config_found = True
                    config_path_used = config_path
                    raw = json.loads(config_path.read_text())
                    gateway = raw.get("gateway", {})
                    config_port = gateway.get("port", self.DEFAULT_PORT)
                    # Token can be at gateway.auth.token or gateway.token
                    config_token = gateway.get("auth", {}).get("token") or gateway.get("token")
                    if config_token:
                        break  # Found token, stop searching
            except Exception as e:
                logger.debug(f"Error reading OpenClaw config {config_path}: {e}")

        # 2. Check for running process
        process_running = await self._check_process()

        # 3. Probe WebSocket
        url = f"ws://127.0.0.1:{config_port}"
        probe_result = await self._probe_websocket(url, config_token)

        # Build candidate
        candidate = DiscoveryCandidate(
            runtime_type="openclaw",
            discovery_method="port_probe",
            target={
                "url": url,
                "host": "127.0.0.1",
                "port": config_port,
                "transport": "websocket",
            },
            auth={
                "required": bool(config_token),
                "token_hint": str(config_path_used) if config_token else None,
                "has_token": bool(config_token),
            },
        )

        if config_found:
            candidate.evidence.append(f"Config file found at {config_path_used}")

        if process_running:
            candidate.evidence.append("OpenClaw process detected running")

        if probe_result["reachable"]:
            candidate.status = "reachable"
            candidate.confidence = "high"
            candidate.evidence.append(f"WebSocket reachable at {url}")
            if probe_result.get("sessions") is not None:
                candidate.metadata["sessions_count"] = probe_result["sessions"]
                candidate.evidence.append(f"Found {probe_result['sessions']} active session(s)")
            if probe_result.get("version"):
                candidate.metadata["version"] = probe_result["version"]
        elif probe_result.get("auth_required"):
            candidate.status = "auth_required"
            candidate.confidence = "medium"
            candidate.evidence.append(f"WebSocket reachable but auth required at {url}")
        elif process_running:
            candidate.status = "unreachable"
            candidate.confidence = "medium"
            candidate.evidence.append("Process running but WebSocket not responding")
        elif config_found:
            candidate.status = "unreachable"
            candidate.confidence = "low"
            candidate.evidence.append("Config found but gateway not running")
        else:
            candidate.status = "not_found"
            candidate.confidence = "low"
            candidate.evidence.append("No OpenClaw installation detected")

        candidates.append(candidate)
        return candidates

    async def _check_process(self) -> bool:
        """Check if an OpenClaw gateway process is running."""
        try:
            proc = await asyncio.create_subprocess_exec(
                "pgrep",
                "-f",
                "openclaw",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=3.0)
            return proc.returncode == 0 and bool(stdout.strip())
        except Exception:
            return False

    async def _probe_websocket(self, url: str, token: Optional[str] = None) -> dict[str, Any]:
        """Probe a WebSocket endpoint for OpenClaw Gateway."""
        result: dict[str, Any] = {"reachable": False}
        try:
            import uuid

            import websockets  # noqa: F811

            ws = await asyncio.wait_for(
                websockets.connect(url, ping_interval=None),
                timeout=3.0,
            )
            try:
                # Read challenge
                challenge_raw = await asyncio.wait_for(ws.recv(), timeout=3.0)
                challenge = json.loads(challenge_raw)
                if challenge.get("event") != "connect.challenge":
                    result["reachable"] = True
                    return result

                # Send connect
                connect_req = {
                    "type": "req",
                    "id": f"discovery-{uuid.uuid4()}",
                    "method": "connect",
                    "params": {
                        "minProtocol": 3,
                        "maxProtocol": 3,
                        "client": {
                            "id": "cli",
                            "version": "1.0.0",
                            "platform": "python",
                            "mode": "cli",
                        },
                        "role": "operator",
                        "scopes": ["operator.read"],
                        "auth": {"token": token} if token else {},
                        "locale": "en-US",
                        "userAgent": "crewhub-discovery/1.0.0",
                    },
                }
                await ws.send(json.dumps(connect_req))

                response_raw = await asyncio.wait_for(ws.recv(), timeout=3.0)
                response = json.loads(response_raw)

                if response.get("ok"):
                    result["reachable"] = True
                    # Try to get session count
                    session_count = await self._get_session_count(ws)
                    if session_count is not None:
                        result["sessions"] = session_count
                else:
                    error = response.get("error", {})
                    if "auth" in str(error).lower() or "token" in str(error).lower():
                        result["auth_required"] = True
                    result["reachable"] = False

            finally:
                await ws.close()

        except TimeoutError:
            logger.debug(f"WebSocket probe timed out: {url}")
        except Exception as e:
            logger.debug(f"WebSocket probe failed: {url} - {e}")

        return result

    async def _get_session_count(self, ws) -> Optional[int]:
        """Try to get session count from connected gateway."""
        try:
            import uuid

            req = {
                "type": "req",
                "id": f"sessions-{uuid.uuid4()}",
                "method": "sessions.list",
                "params": {},
            }
            await ws.send(json.dumps(req))
            raw = await asyncio.wait_for(ws.recv(), timeout=3.0)
            data = json.loads(raw)
            if data.get("ok"):
                payload = data.get("payload", {})
                sessions = payload.get("sessions", [])
                return len(sessions)
        except Exception as e:
            logger.debug(f"Failed to get session count: {e}")
        return None


# =============================================================================
# Claude Code detector
# =============================================================================


class ClaudeCodeDetector(BaseDetector):
    """Detect local Claude Code CLI installation."""

    async def detect(self) -> list[DiscoveryCandidate]:
        candidate = DiscoveryCandidate(
            runtime_type="claude_code",
            discovery_method="cli_detect",
        )

        # Check CLI availability
        version = await self._get_cli_version()
        has_config = (Path.home() / ".claude").is_dir()

        if version:
            candidate.status = "installed_only"
            candidate.confidence = "high"
            candidate.evidence.append(f"Claude CLI found: {version}")
            candidate.metadata["version"] = version
        elif has_config:
            candidate.status = "installed_only"
            candidate.confidence = "medium"
            candidate.evidence.append("~/.claude/ directory found")
        else:
            candidate.status = "not_found"
            candidate.confidence = "low"
            candidate.evidence.append("Claude Code CLI not found")

        if has_config:
            candidate.evidence.append("~/.claude/ configuration directory exists")

        return [candidate]

    async def _get_cli_version(self) -> Optional[str]:
        """Run claude --version and return version string."""
        try:
            # Check if claude is available
            claude_path = shutil.which("claude")
            if not claude_path:
                return None

            proc = await asyncio.create_subprocess_exec(
                "claude",
                "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5.0)
            if proc.returncode == 0:
                return stdout.decode().strip()
        except Exception as e:
            logger.debug(f"Claude CLI detection failed: {e}")
        return None


# =============================================================================
# Codex CLI detector
# =============================================================================


class CodexDetector(BaseDetector):
    """Detect local Codex CLI installation."""

    async def detect(self) -> list[DiscoveryCandidate]:
        candidate = DiscoveryCandidate(
            runtime_type="codex_cli",
            discovery_method="cli_detect",
        )

        version = await self._get_cli_version()

        if version:
            candidate.status = "installed_only"
            candidate.confidence = "high"
            candidate.evidence.append(f"Codex CLI found: {version}")
            candidate.metadata["version"] = version
        else:
            candidate.status = "not_found"
            candidate.confidence = "low"
            candidate.evidence.append("Codex CLI not found")

        return [candidate]

    async def _get_cli_version(self) -> Optional[str]:
        """Run codex --version and return version string."""
        try:
            codex_path = shutil.which("codex")
            if not codex_path:
                return None

            proc = await asyncio.create_subprocess_exec(
                "codex",
                "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5.0)
            if proc.returncode == 0:
                return stdout.decode().strip()
        except Exception as e:
            logger.debug(f"Codex CLI detection failed: {e}")
        return None


# =============================================================================
# Discovery Service
# =============================================================================


class DiscoveryService:
    """
    Pluggable discovery service that runs all registered detectors.

    Usage:
        svc = DiscoveryService()
        candidates = await svc.scan(mode="local")
    """

    def __init__(self) -> None:
        self._detectors: dict[str, list[BaseDetector]] = {
            "local": [
                OpenClawDetector(),
                ClaudeCodeDetector(),
                CodexDetector(),
            ],
        }

    async def scan(self, mode: str = "local") -> list[DiscoveryCandidate]:
        """
        Run all detectors for the given mode.

        Args:
            mode: Discovery mode ('local' or future 'lan')

        Returns:
            List of all discovered candidates.
        """
        detectors = self._detectors.get(mode, [])
        if not detectors:
            logger.warning(
                f"No detectors registered for mode: {mode}"
            )  # NOSONAR: mode is an internal enum value ('local'/'lan'), not user input
            return []

        # Run all detectors concurrently
        tasks = [d.detect() for d in detectors]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        candidates: list[DiscoveryCandidate] = []
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Detector error: {result}")
                continue
            candidates.extend(result)

        return candidates

    async def test_connection(
        self,
        runtime_type: str,
        url: str,
        token: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Test connectivity to a specific runtime endpoint.

        Args:
            runtime_type: Type of runtime to test
            url: WebSocket/HTTP URL to probe
            token: Auth token (optional)

        Returns:
            Dict with reachable, sessions, error fields.
        """
        if runtime_type == "openclaw":
            detector = OpenClawDetector()
            probe = await detector._probe_websocket(url, token)
            return {
                "reachable": probe.get("reachable", False),
                "sessions": probe.get("sessions"),
                "error": None if probe.get("reachable") else "Connection failed",
            }
        else:
            return {
                "reachable": False,
                "sessions": None,
                "error": f"Connection testing not supported for {runtime_type}",
            }


# Module-level singleton
_discovery_service: Optional[DiscoveryService] = None


def get_discovery_service() -> DiscoveryService:
    """Get or create the global discovery service instance."""
    global _discovery_service
    if _discovery_service is None:
        _discovery_service = DiscoveryService()
    return _discovery_service
