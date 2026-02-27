"""Tests for app.routes.onboarding — onboarding routes and helpers."""

import json
import socket
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Re-import response models with non-Test prefix to avoid pytest collection warnings
from app.routes.onboarding import TestOpenClawResponse as OpenClawResp
from app.routes.onboarding import (
    _auth_or_protocol_failure,
    _build_connect_request,
    _build_suggested_urls,
    _check_dns,
    _check_host_docker_internal,
    _check_tcp,
    _detect_docker,
    _find_token_file,
    _get_lan_ip,
    _parse_ws_url,
    _protocol_error_response,
    _query_sessions,
    _test_openclaw_connection,
)

# ===========================================================================
# Pure helper tests
# ===========================================================================


class TestDetectDocker:
    def test_dockerenv_exists(self):
        with patch("app.routes.onboarding.Path") as P:

            def side_effect(arg):
                m = MagicMock()
                m.exists.return_value = arg == "/.dockerenv"
                return m

            P.side_effect = side_effect
            assert _detect_docker() is True

    def test_env_var(self):
        with patch("app.routes.onboarding.Path") as P:
            P.side_effect = lambda x: MagicMock(
                exists=MagicMock(return_value=False), read_text=MagicMock(side_effect=FileNotFoundError)
            )
            with patch.dict("os.environ", {"RUNNING_IN_DOCKER": "true"}):
                assert _detect_docker() is True

    def test_not_docker(self):
        with patch("app.routes.onboarding.Path") as P:
            P.side_effect = lambda x: MagicMock(
                exists=MagicMock(return_value=False), read_text=MagicMock(side_effect=FileNotFoundError)
            )
            with patch.dict("os.environ", {}, clear=True):
                assert _detect_docker() is False

    def test_cgroup_docker(self):
        with patch("app.routes.onboarding.Path") as P:

            def side_effect(arg):
                m = MagicMock()
                if arg == "/.dockerenv":
                    m.exists.return_value = False
                elif arg == "/proc/1/cgroup":
                    m.exists.return_value = True
                    m.read_text.return_value = "12:blkio:/docker/abc123"
                else:
                    m.exists.return_value = False
                return m

            P.side_effect = side_effect
            with patch.dict("os.environ", {}, clear=True):
                assert _detect_docker() is True


class TestGetLanIp:
    def test_success(self):
        with patch("app.routes.onboarding.socket") as mock_sock:
            s = MagicMock()
            mock_sock.socket.return_value = s
            mock_sock.AF_INET = socket.AF_INET
            mock_sock.SOCK_DGRAM = socket.SOCK_DGRAM
            s.getsockname.return_value = ("192.168.1.10", 0)
            assert _get_lan_ip() == "192.168.1.10"

    def test_fallback_hostname(self):
        with patch("app.routes.onboarding.socket") as mock_sock:
            mock_sock.AF_INET = socket.AF_INET
            mock_sock.SOCK_DGRAM = socket.SOCK_DGRAM
            s = MagicMock()
            s.connect.side_effect = OSError
            mock_sock.socket.return_value = s
            mock_sock.gethostname.return_value = "myhost"
            mock_sock.gethostbyname.return_value = "10.0.0.1"
            assert _get_lan_ip() == "10.0.0.1"

    def test_all_fail(self):
        with patch("app.routes.onboarding.socket") as mock_sock:
            mock_sock.AF_INET = socket.AF_INET
            mock_sock.SOCK_DGRAM = socket.SOCK_DGRAM
            s = MagicMock()
            s.connect.side_effect = OSError
            mock_sock.socket.return_value = s
            mock_sock.gethostbyname.side_effect = Exception
            assert _get_lan_ip() is None


class TestCheckHostDockerInternal:
    def test_reachable(self):
        with patch("app.routes.onboarding.socket.getaddrinfo", return_value=[("ok",)]):
            assert _check_host_docker_internal() is True

    def test_not_reachable(self):
        with patch("app.routes.onboarding.socket.getaddrinfo", side_effect=OSError):
            assert _check_host_docker_internal() is False


class TestFindTokenFile:
    def test_found(self, tmp_path):
        cfg = {"gateway": {"auth": {"token": "secret"}}}
        token_file = tmp_path / ".openclaw" / "openclaw.json"
        token_file.parent.mkdir()
        token_file.write_text(json.dumps(cfg))
        with patch("app.routes.onboarding.Path.home", return_value=tmp_path):
            path, available = _find_token_file()
        assert path == str(token_file)
        assert available is True

    def test_not_found(self, tmp_path):
        with patch("app.routes.onboarding.Path.home", return_value=tmp_path):
            path, available = _find_token_file()
        assert path is None
        assert available is False

    def test_no_token_in_file(self, tmp_path):
        cfg = {"gateway": {}}
        token_file = tmp_path / ".openclaw" / "openclaw.json"
        token_file.parent.mkdir()
        token_file.write_text(json.dumps(cfg))
        with patch("app.routes.onboarding.Path.home", return_value=tmp_path):
            path, available = _find_token_file()
        assert path is not None
        assert available is False

    def test_fallback_token_key(self, tmp_path):
        cfg = {"gateway": {"token": "fallback-tok"}}
        token_file = tmp_path / ".openclaw" / "openclaw.json"
        token_file.parent.mkdir()
        token_file.write_text(json.dumps(cfg))
        with patch("app.routes.onboarding.Path.home", return_value=tmp_path):
            path, available = _find_token_file()
        assert available is True


class TestBuildSuggestedUrls:
    def test_not_docker(self):
        urls = _build_suggested_urls(False, "192.168.1.10", False)
        assert "ws://127.0.0.1:18789" in urls
        assert "ws://192.168.1.10:18789" in urls

    def test_docker_with_host_internal(self):
        urls = _build_suggested_urls(True, None, True)
        assert "ws://host.docker.internal:18789" in urls
        assert "ws://127.0.0.1:18789" not in urls

    def test_docker_no_host_internal(self):
        urls = _build_suggested_urls(True, None, False)
        assert "ws://<HOST_IP>:18789" in urls


class TestParseWsUrl:
    def test_valid(self):
        parsed, err = _parse_ws_url("ws://localhost:18789")
        assert err is None
        assert parsed == ("localhost", 18789)

    def test_default_port(self):
        parsed, err = _parse_ws_url("ws://localhost")
        assert parsed == ("localhost", 18789)


class TestCheckDns:
    def test_ok(self):
        with patch("app.routes.onboarding.socket.getaddrinfo"):
            assert _check_dns("localhost", 18789) is None

    def test_fail(self):
        with patch("app.routes.onboarding.socket.getaddrinfo", side_effect=socket.gaierror):
            result = _check_dns("badhost", 18789)
        assert result is not None
        assert result.category == "dns"

    def test_fail_in_docker(self):
        with patch("app.routes.onboarding.socket.getaddrinfo", side_effect=socket.gaierror):
            with patch("app.routes.onboarding._detect_docker", return_value=True):
                result = _check_dns("localhost", 18789)
        assert "Docker" in " ".join(result.hints)


class TestCheckTcpHelper:
    @pytest.mark.asyncio
    async def test_timeout(self):
        with patch("app.routes.onboarding.asyncio.wait_for", side_effect=TimeoutError):
            result = await _check_tcp("localhost", 18789)
        assert result.category == "tcp"
        assert "timed out" in result.message

    @pytest.mark.asyncio
    async def test_os_error(self):
        with patch("app.routes.onboarding.asyncio.wait_for", side_effect=OSError("Connection refused")):
            result = await _check_tcp("localhost", 18789)
        assert result.category == "tcp"

    @pytest.mark.asyncio
    async def test_success(self):
        writer = AsyncMock()
        with patch("app.routes.onboarding.asyncio.wait_for", return_value=(AsyncMock(), writer)):
            result = await _check_tcp("localhost", 18789)
        assert result is None


class TestProtocolErrorResponse:
    def test_response(self):
        r = _protocol_error_response({"event": "weird"})
        assert r.category == "protocol"


class TestBuildConnectRequest:
    def test_with_token(self):
        req = _build_connect_request("tok")
        assert req["params"]["auth"] == {"token": "tok"}

    def test_without_token(self):
        req = _build_connect_request(None)
        assert req["params"]["auth"] == {}


class TestAuthOrProtocolFailureHelper:
    def test_auth_failure_dict(self):
        r = _auth_or_protocol_failure({"message": "Invalid auth token"}, "tok")
        assert r.category == "auth"

    def test_protocol_failure_dict(self):
        r = _auth_or_protocol_failure({"message": "Unknown error"}, None)
        assert r.category == "protocol"

    def test_auth_no_token_no_file(self):
        with patch("app.routes.onboarding._find_token_file", return_value=(None, False)):
            r = _auth_or_protocol_failure({"message": "auth required"}, None)
        assert r.category == "auth"
        assert any("No token" in h for h in r.hints)

    def test_auth_with_token_file(self, tmp_path):
        with patch("app.routes.onboarding._find_token_file", return_value=(str(tmp_path / "tok.json"), True)):
            r = _auth_or_protocol_failure({"message": "Invalid token"}, "bad")
        assert r.category == "auth"
        assert any("tok.json" in h for h in r.hints)

    def test_string_error(self):
        r = _auth_or_protocol_failure("some string error", None)
        assert r.category == "protocol"


class TestQuerySessionsHelper:
    @pytest.mark.asyncio
    async def test_success(self):
        ws = AsyncMock()
        ws.recv.return_value = json.dumps({"ok": True, "payload": {"sessions": [{"key": "a"}, {"key": "b"}]}})
        result = await _query_sessions(ws)
        assert result == 2

    @pytest.mark.asyncio
    async def test_failure(self):
        ws = AsyncMock()
        ws.send.side_effect = Exception("fail")
        result = await _query_sessions(ws)
        assert result is None

    @pytest.mark.asyncio
    async def test_not_ok(self):
        ws = AsyncMock()
        ws.recv.return_value = json.dumps({"ok": False})
        result = await _query_sessions(ws)
        assert result is None


# ===========================================================================
# Full _test_openclaw_connection
# ===========================================================================


class TestOpenClawConnectionFlow:
    @pytest.mark.asyncio
    async def test_parse_error(self):
        err = OpenClawResp(ok=False, category="dns", message="bad", hints=[])
        with patch("app.routes.onboarding._parse_ws_url", return_value=(None, err)):
            r = await _test_openclaw_connection("bad://url", None)
        assert r.ok is False

    @pytest.mark.asyncio
    async def test_dns_error(self):
        err = OpenClawResp(ok=False, category="dns", message="nope", hints=[])
        with patch("app.routes.onboarding._parse_ws_url", return_value=(("host", 123), None)):
            with patch("app.routes.onboarding._check_dns", return_value=err):
                r = await _test_openclaw_connection("ws://host:123", None)
        assert r.category == "dns"

    @pytest.mark.asyncio
    async def test_tcp_error(self):
        err = OpenClawResp(ok=False, category="tcp", message="nope", hints=[])
        with patch("app.routes.onboarding._parse_ws_url", return_value=(("host", 123), None)):
            with patch("app.routes.onboarding._check_dns", return_value=None):
                with patch("app.routes.onboarding._check_tcp", return_value=err):
                    r = await _test_openclaw_connection("ws://host:123", None)
        assert r.category == "tcp"

    @pytest.mark.asyncio
    async def test_ws_timeout(self):
        """Timeout during websockets.connect."""
        with (
            patch("app.routes.onboarding._parse_ws_url", return_value=(("h", 1), None)),
            patch("app.routes.onboarding._check_dns", return_value=None),
            patch("app.routes.onboarding._check_tcp", return_value=None),
        ):
            # The function does `import websockets` then `websockets.connect`
            # We need to make the wait_for raise TimeoutError
            # The function calls asyncio.wait_for(websockets.connect(...), timeout=5)
            # Easiest: patch websockets.connect to return a coroutine that hangs, and patch wait_for

            async def patched_wait_for(coro, timeout=None):
                # Cancel the real coroutine to avoid warnings
                try:
                    coro.close()
                except Exception:
                    pass
                raise TimeoutError()

            with patch("asyncio.wait_for", side_effect=patched_wait_for):
                r = await _test_openclaw_connection("ws://h:1", None)
        assert r.category == "timeout"

    @pytest.mark.asyncio
    async def test_ws_refused_exception(self):
        """Generic exception with 'refused' in message."""
        with (
            patch("app.routes.onboarding._parse_ws_url", return_value=(("h", 1), None)),
            patch("app.routes.onboarding._check_dns", return_value=None),
            patch("app.routes.onboarding._check_tcp", return_value=None),
        ):

            async def patched_wait_for(coro, timeout=None):
                try:
                    coro.close()
                except Exception:
                    pass
                raise Exception("connection refused")

            with patch("asyncio.wait_for", side_effect=patched_wait_for):
                r = await _test_openclaw_connection("ws://h:1", None)
        assert r.category == "tcp"

    @pytest.mark.asyncio
    async def test_ws_generic_exception(self):
        with (
            patch("app.routes.onboarding._parse_ws_url", return_value=(("h", 1), None)),
            patch("app.routes.onboarding._check_dns", return_value=None),
            patch("app.routes.onboarding._check_tcp", return_value=None),
        ):

            async def patched_wait_for(coro, timeout=None):
                try:
                    coro.close()
                except Exception:
                    pass
                raise Exception("something weird")

            with patch("asyncio.wait_for", side_effect=patched_wait_for):
                r = await _test_openclaw_connection("ws://h:1", None)
        assert r.category == "ws"

    @pytest.mark.asyncio
    async def test_import_error(self):
        """When websockets is not importable."""
        with (
            patch("app.routes.onboarding._parse_ws_url", return_value=(("h", 1), None)),
            patch("app.routes.onboarding._check_dns", return_value=None),
            patch("app.routes.onboarding._check_tcp", return_value=None),
        ):

            async def patched_wait_for(coro, timeout=None):
                try:
                    coro.close()
                except Exception:
                    pass
                raise ImportError("no websockets")

            with patch("asyncio.wait_for", side_effect=patched_wait_for):
                r = await _test_openclaw_connection("ws://h:1", None)
        assert r.category == "protocol"

    @pytest.mark.asyncio
    async def test_protocol_error_bad_challenge(self):
        """Server sends wrong challenge event."""
        ws = AsyncMock()
        bad_challenge = json.dumps({"event": "wrong.event"})

        call_idx = 0

        async def fake_wait_for(coro, timeout=None):
            nonlocal call_idx
            call_idx += 1
            if call_idx == 1:
                # websockets.connect
                return ws
            elif call_idx == 2:
                # ws.recv (challenge)
                return bad_challenge
            return await coro

        with (
            patch("app.routes.onboarding._parse_ws_url", return_value=(("h", 1), None)),
            patch("app.routes.onboarding._check_dns", return_value=None),
            patch("app.routes.onboarding._check_tcp", return_value=None),
            patch("asyncio.wait_for", side_effect=fake_wait_for),
        ):
            r = await _test_openclaw_connection("ws://h:1", None)
        assert r.category == "protocol"

    @pytest.mark.asyncio
    async def test_auth_failure_flow(self):
        """Server rejects auth."""
        ws = AsyncMock()
        challenge = json.dumps({"event": "connect.challenge", "payload": {}})
        auth_fail = json.dumps({"ok": False, "error": {"message": "Invalid auth token"}})

        call_idx = 0

        async def fake_wait_for(coro, timeout=None):
            nonlocal call_idx
            call_idx += 1
            if call_idx == 1:
                return ws
            elif call_idx == 2:
                return challenge
            elif call_idx == 3:
                return auth_fail
            return await coro

        with (
            patch("app.routes.onboarding._parse_ws_url", return_value=(("h", 1), None)),
            patch("app.routes.onboarding._check_dns", return_value=None),
            patch("app.routes.onboarding._check_tcp", return_value=None),
            patch("asyncio.wait_for", side_effect=fake_wait_for),
        ):
            r = await _test_openclaw_connection("ws://h:1", "badtoken")
        assert r.category == "auth"

    @pytest.mark.asyncio
    async def test_success_flow(self):
        """Full successful connection test."""
        ws = AsyncMock()
        challenge = json.dumps({"event": "connect.challenge", "payload": {}})
        ok_resp = json.dumps({"ok": True, "payload": {}})
        sessions_resp = json.dumps({"ok": True, "payload": {"sessions": [{"k": 1}]}})

        call_idx = 0

        async def fake_wait_for(coro, timeout=None):
            nonlocal call_idx
            call_idx += 1
            if call_idx == 1:
                return ws
            elif call_idx == 2:
                return challenge
            elif call_idx == 3:
                return ok_resp
            elif call_idx == 4:
                # _query_sessions inner wait_for for recv
                return sessions_resp
            return await coro

        with (
            patch("app.routes.onboarding._parse_ws_url", return_value=(("h", 1), None)),
            patch("app.routes.onboarding._check_dns", return_value=None),
            patch("app.routes.onboarding._check_tcp", return_value=None),
            patch("asyncio.wait_for", side_effect=fake_wait_for),
        ):
            r = await _test_openclaw_connection("ws://h:1", "tok")
        assert r.ok is True
        assert "Connected" in r.message


# ===========================================================================
# Route integration tests (via client fixture)
# ===========================================================================


class TestOnboardingRoutes:
    @pytest.mark.asyncio
    async def test_get_onboarding_status(self, client):
        resp = await client.get("/api/onboarding/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "completed" in data
        assert "connections_count" in data
        assert "has_active_connection" in data

    @pytest.mark.asyncio
    async def test_get_environment_info(self, client):
        resp = await client.get("/api/onboarding/environment")
        assert resp.status_code == 200
        data = resp.json()
        assert "is_docker" in data
        assert "hostname" in data
        assert "suggested_urls" in data
        assert "platform" in data

    @pytest.mark.asyncio
    async def test_test_openclaw_endpoint(self, client):
        with patch("app.routes.onboarding._test_openclaw_connection", new_callable=AsyncMock) as mock_test:
            mock_test.return_value = OpenClawResp(
                ok=False, category="dns", message="Cannot resolve", hints=["try again"]
            )
            resp = await client.post("/api/onboarding/test-openclaw", json={"url": "ws://badhost:18789"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is False
        assert data["category"] == "dns"

    @pytest.mark.asyncio
    async def test_onboarding_completed_via_setting(self, client):
        """When onboardingCompleted setting is true, status should show completed."""
        from app.db.database import get_db

        async with get_db() as db:
            await db.execute(
                "INSERT INTO settings (key, value, updated_at) VALUES ('onboardingCompleted', 'true', datetime('now'))"
            )
            await db.commit()
        resp = await client.get("/api/onboarding/status")
        assert resp.status_code == 200
        assert resp.json()["completed"] is True

    @pytest.mark.asyncio
    async def test_onboarding_not_completed(self, client):
        resp = await client.get("/api/onboarding/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["completed"] is False
        assert data["connections_count"] == 0
