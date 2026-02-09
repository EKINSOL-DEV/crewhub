"""
API routes for onboarding status and OpenClaw connection testing.

Provides endpoints for:
- Onboarding completion status
- Environment detection (Docker, LAN IP)
- OpenClaw connection testing with error classification
"""

import asyncio
import json
import logging
import os
import platform
import socket
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from ..db.database import get_db
from ..services.connections import get_connection_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/onboarding", tags=["onboarding"])


# =============================================================================
# Response Models
# =============================================================================

class OnboardingStatusResponse(BaseModel):
    """Onboarding completion status."""
    completed: bool
    connections_count: int
    has_active_connection: bool


class EnvironmentInfo(BaseModel):
    """Server environment detection results."""
    is_docker: bool
    lan_ip: Optional[str] = None
    hostname: str = ""
    platform: str = ""
    docker_host_internal_reachable: bool = False
    suggested_urls: list[str] = []
    token_file_path: Optional[str] = None
    token_available: bool = False


class TestOpenClawRequest(BaseModel):
    """Request for testing OpenClaw connection."""
    url: str
    token: Optional[str] = None


class TestOpenClawResponse(BaseModel):
    """Structured test result with error classification."""
    ok: bool
    category: Optional[str] = None  # dns | tcp | ws | auth | protocol | timeout | None
    message: str
    hints: list[str] = []
    sessions: Optional[int] = None


# =============================================================================
# Docker / Environment Detection
# =============================================================================

def _detect_docker() -> bool:
    """Check if we're running inside a Docker container."""
    # Method 1: /.dockerenv file
    if Path("/.dockerenv").exists():
        return True
    # Method 2: Check cgroup for docker/kubepods
    try:
        cgroup = Path("/proc/1/cgroup").read_text()
        if "docker" in cgroup or "kubepods" in cgroup or "containerd" in cgroup:
            return True
    except (FileNotFoundError, PermissionError):
        pass
    # Method 3: Environment variable
    if os.environ.get("RUNNING_IN_DOCKER", "").lower() in ("true", "1", "yes"):
        return True
    return False


def _get_lan_ip() -> Optional[str]:
    """Detect primary LAN IP address."""
    try:
        # Connect to external address (doesn't actually send data)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(1)
        s.connect(("1.1.1.1", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        pass
    # Fallback: hostname resolution
    try:
        return socket.gethostbyname(socket.gethostname())
    except Exception:
        return None


async def _check_host_docker_internal() -> bool:
    """Check if host.docker.internal resolves."""
    try:
        socket.getaddrinfo("host.docker.internal", 18789, socket.AF_INET)
        return True
    except (socket.gaierror, OSError):
        return False


def _find_token_file() -> tuple[Optional[str], bool]:
    """Find OpenClaw config file and check if token exists."""
    paths = [
        Path.home() / ".openclaw" / "openclaw.json",
        Path.home() / ".openclaw" / "clawdbot.json",
        Path.home() / ".openclaw" / "config.json",
    ]
    for p in paths:
        try:
            if p.exists():
                raw = json.loads(p.read_text())
                token = raw.get("gateway", {}).get("auth", {}).get("token") or \
                        raw.get("gateway", {}).get("token")
                return str(p), bool(token)
        except Exception:
            continue
    return None, False


def _build_suggested_urls(is_docker: bool, lan_ip: Optional[str], host_docker_reachable: bool) -> list[str]:
    """Build ordered list of suggested WebSocket URLs."""
    urls = []
    if not is_docker:
        urls.append("ws://127.0.0.1:18789")
    if is_docker and host_docker_reachable:
        urls.append("ws://host.docker.internal:18789")
    if lan_ip:
        urls.append(f"ws://{lan_ip}:18789")
    if is_docker and not host_docker_reachable:
        # Fallback suggestion
        urls.append("ws://<HOST_IP>:18789")
    return urls


# =============================================================================
# OpenClaw Connection Test with Error Classification
# =============================================================================

async def _test_openclaw_connection(url: str, token: Optional[str]) -> TestOpenClawResponse:
    """
    Test an OpenClaw gateway connection with detailed error classification.
    
    Categories: dns, tcp, ws, auth, protocol, timeout
    """
    import urllib.parse

    # Parse URL
    try:
        parsed = urllib.parse.urlparse(url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 18789
    except Exception:
        return TestOpenClawResponse(
            ok=False,
            category="dns",
            message="Invalid URL format.",
            hints=["Use format: ws://hostname:18789", "Example: ws://127.0.0.1:18789"],
        )

    # Step 1: DNS resolution
    try:
        socket.getaddrinfo(host, port, socket.AF_INET)
    except socket.gaierror:
        hints = [f'Host "{host}" could not be resolved.']
        if host in ("localhost", "127.0.0.1") and _detect_docker():
            hints.append("In Docker, localhost points to the container, not the host.")
            hints.append("Use host.docker.internal or your host's LAN IP instead.")
        return TestOpenClawResponse(
            ok=False,
            category="dns",
            message=f"Cannot resolve hostname: {host}",
            hints=hints,
        )

    # Step 2: TCP connection
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=5.0,
        )
        writer.close()
        await writer.wait_closed()
    except asyncio.TimeoutError:
        return TestOpenClawResponse(
            ok=False,
            category="tcp",
            message=f"Connection timed out to {host}:{port}",
            hints=[
                "Check that the OpenClaw gateway is running.",
                f"Ensure port {port} is not blocked by a firewall.",
                "If in Docker, make sure the gateway binds to 0.0.0.0.",
            ],
        )
    except (ConnectionRefusedError, OSError) as e:
        return TestOpenClawResponse(
            ok=False,
            category="tcp",
            message=f"Cannot connect to {host}:{port} — {e}",
            hints=[
                "Start the gateway: openclaw gateway start",
                f"Check that port {port} is open and not in use by another service.",
                "If in Docker, use the host's LAN IP instead of localhost.",
            ],
        )

    # Step 3: WebSocket + protocol handshake
    try:
        import websockets
        import uuid

        ws = await asyncio.wait_for(
            websockets.connect(url, ping_interval=None),
            timeout=5.0,
        )
        try:
            # Read challenge
            challenge_raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
            challenge = json.loads(challenge_raw)

            if challenge.get("event") != "connect.challenge":
                return TestOpenClawResponse(
                    ok=False,
                    category="protocol",
                    message="Unexpected server response (not an OpenClaw gateway).",
                    hints=[
                        "Check that the URL points to an OpenClaw gateway.",
                        f"Received event: {challenge.get('event', 'unknown')}",
                    ],
                )

            # Send connect request
            connect_req = {
                "type": "req",
                "id": f"test-{uuid.uuid4()}",
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
                    "userAgent": "crewhub-onboarding/1.0.0",
                },
            }
            await ws.send(json.dumps(connect_req))

            response_raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
            response = json.loads(response_raw)

            if response.get("ok"):
                # Success! Try to get session count
                sessions = None
                try:
                    session_req = {
                        "type": "req",
                        "id": f"sessions-{uuid.uuid4()}",
                        "method": "sessions.list",
                        "params": {},
                    }
                    await ws.send(json.dumps(session_req))
                    sess_raw = await asyncio.wait_for(ws.recv(), timeout=3.0)
                    sess_data = json.loads(sess_raw)
                    if sess_data.get("ok"):
                        sessions = len(sess_data.get("payload", {}).get("sessions", []))
                except Exception:
                    pass

                return TestOpenClawResponse(
                    ok=True,
                    message="Connected successfully!" + (f" ({sessions} active sessions)" if sessions is not None else ""),
                    sessions=sessions,
                )
            else:
                error = response.get("error", {})
                error_msg = error.get("message", str(error)) if isinstance(error, dict) else str(error)

                if "auth" in error_msg.lower() or "token" in error_msg.lower():
                    token_path, _ = _find_token_file()
                    hints = ["Check your API token is correct."]
                    if token_path:
                        hints.append(f"Token can be found in: {token_path}")
                        hints.append('Look for gateway.auth.token in the JSON file.')
                    elif not token:
                        hints.append("No token was provided. The gateway requires authentication.")
                    return TestOpenClawResponse(
                        ok=False,
                        category="auth",
                        message="Authentication failed.",
                        hints=hints,
                    )
                else:
                    return TestOpenClawResponse(
                        ok=False,
                        category="protocol",
                        message=f"Gateway rejected connection: {error_msg}",
                        hints=["Check gateway logs for details."],
                    )

        finally:
            await ws.close()

    except asyncio.TimeoutError:
        return TestOpenClawResponse(
            ok=False,
            category="timeout",
            message="WebSocket handshake timed out.",
            hints=[
                "The gateway may be overloaded or unresponsive.",
                "Try restarting: openclaw gateway restart",
            ],
        )
    except ImportError:
        return TestOpenClawResponse(
            ok=False,
            category="protocol",
            message="WebSocket library not available.",
            hints=["Install websockets: pip install websockets"],
        )
    except Exception as e:
        err_str = str(e).lower()
        if "refused" in err_str:
            return TestOpenClawResponse(
                ok=False,
                category="tcp",
                message="Connection refused during WebSocket upgrade.",
                hints=["The gateway may not be running or is on a different port."],
            )
        return TestOpenClawResponse(
            ok=False,
            category="ws",
            message=f"WebSocket error: {e}",
            hints=["Check that the URL uses ws:// (not http://)."],
        )


# =============================================================================
# Routes
# =============================================================================

@router.get("/status", response_model=OnboardingStatusResponse)
async def get_onboarding_status():
    """
    Check onboarding completion status.
    
    Onboarding is considered complete if:
    - The 'onboardingCompleted' setting is 'true', OR
    - There is at least one active (connected) connection.
    """
    completed_setting = False
    db = await get_db()
    try:
        db.row_factory = lambda cursor, row: dict(
            zip([col[0] for col in cursor.description], row)
        )
        async with db.execute(
            "SELECT value FROM settings WHERE key = 'onboardingCompleted'"
        ) as cursor:
            row = await cursor.fetchone()
            if row and row["value"].lower() in ("true", "1", "yes"):
                completed_setting = True
    finally:
        await db.close()

    connections_count = 0
    has_active = False

    db = await get_db()
    try:
        async with db.execute(
            "SELECT COUNT(*) FROM connections WHERE enabled = 1"
        ) as cursor:
            row = await cursor.fetchone()
            connections_count = row[0] if row else 0
    finally:
        await db.close()

    manager = await get_connection_manager()
    for conn_id, conn in manager._connections.items():
        if conn.is_connected():
            has_active = True
            break

    return OnboardingStatusResponse(
        completed=completed_setting or has_active,
        connections_count=connections_count,
        has_active_connection=has_active,
    )


@router.get("/environment", response_model=EnvironmentInfo)
async def get_environment_info():
    """
    Detect server environment: Docker, LAN IP, suggested URLs, token location.
    
    Used by the frontend wizard to pre-fill connection details and show warnings.
    """
    is_docker = _detect_docker()
    lan_ip = _get_lan_ip()
    host_docker = await _check_host_docker_internal() if is_docker else False
    token_path, token_available = _find_token_file()
    suggested = _build_suggested_urls(is_docker, lan_ip, host_docker)

    return EnvironmentInfo(
        is_docker=is_docker,
        lan_ip=lan_ip,
        hostname=socket.gethostname(),
        platform=platform.system(),
        docker_host_internal_reachable=host_docker,
        suggested_urls=suggested,
        token_file_path=token_path,
        token_available=token_available,
    )


@router.post("/test-openclaw", response_model=TestOpenClawResponse)
async def test_openclaw_connection(body: TestOpenClawRequest):
    """
    Test an OpenClaw gateway connection with detailed error classification.
    
    Returns structured error info with category and actionable hints.
    Categories: dns, tcp, ws, auth, protocol, timeout.
    """
    return await _test_openclaw_connection(body.url, body.token)
