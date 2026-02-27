import asyncio
import importlib.util
import sys
import types
from pathlib import Path

import pytest


def _load_module(module_name: str, file_path: Path):
    spec = importlib.util.spec_from_file_location(module_name, str(file_path))
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


ROOT = Path(__file__).resolve().parents[1]
CONN_DIR = ROOT / "app" / "services" / "connections"

# Build lightweight package shell to avoid importing app.services.connections.__init__
pkg = types.ModuleType("app.services.connections")
pkg.__path__ = [str(CONN_DIR)]
sys.modules.setdefault("app.services.connections", pkg)

base_mod = _load_module("app.services.connections.base", CONN_DIR / "base.py")
device_identity_mod = _load_module("app.services.connections.device_identity", CONN_DIR / "device_identity.py")
handshake_mod = _load_module("app.services.connections._handshake", CONN_DIR / "_handshake.py")

_choose_auth = handshake_mod._choose_auth
_reset_existing_connection = handshake_mod._reset_existing_connection
perform_handshake = handshake_mod.perform_handshake
ConnectionStatus = base_mod.ConnectionStatus


class DummyConn:
    def __init__(self):
        self.ws = None
        self._listen_task = None
        self.token = "gw-token"
        self.uri = "ws://example"
        self.connection_id = "cid"
        self.name = "name"
        self.status = ConnectionStatus.DISCONNECTED
        self._identity_manager = None
        self._device_identity = None
        self.error = None

    async def _listen_loop(self):
        await asyncio.sleep(0)

    def _set_error(self, msg):
        self.error = msg


class DummyIdentity:
    def __init__(self, token=None):
        self.device_token = token
        self.device_id = "device-1234567890abcdef"

    def build_device_block(self, nonce, auth_token, signed_at_ms):
        return {"nonce": nonce, "auth": auth_token, "signed_at_ms": signed_at_ms}


@pytest.mark.asyncio
async def test_reset_existing_connection_closes_and_cancels():
    conn = DummyConn()

    class WS:
        async def close(self):
            return None

    conn.ws = WS()
    conn._listen_task = asyncio.create_task(asyncio.sleep(10))

    with pytest.raises(asyncio.CancelledError):
        await _reset_existing_connection(conn)
    assert conn.ws is None
    assert conn._listen_task.cancelled()


def test_choose_auth_device_token_and_gateway_token():
    conn = DummyConn()
    use_device, token = _choose_auth(DummyIdentity("dev-token"), conn)
    assert use_device is True and token == "dev-token"
    use_device2, token2 = _choose_auth(DummyIdentity(None), conn)
    assert use_device2 is False and token2 == "gw-token"


@pytest.mark.asyncio
async def test_perform_handshake_success_stores_new_device_token(monkeypatch):
    conn = DummyConn()
    identity = DummyIdentity(None)

    class IM:
        async def get_or_create_device_identity(self, **kwargs):
            return identity

        async def clear_device_token(self, _device_id):
            return None

        async def update_device_token(self, _device_id, token):
            self.updated = token

    class WS:
        def __init__(self):
            self._recv = [
                '{"type":"event","event":"connect.challenge","payload":{"nonce":"abc"}}',
                '{"ok":true,"payload":{"auth":{"deviceToken":"new-token"}}}',
            ]

        async def recv(self):
            return self._recv.pop(0)

        async def send(self, data):
            return None

        async def close(self):
            return None

    async def fake_connect(*_a, **_k):
        return WS()

    monkeypatch.setattr(device_identity_mod, "DeviceIdentityManager", lambda: IM())
    monkeypatch.setattr(handshake_mod.websockets, "connect", fake_connect)

    ok = await perform_handshake(conn)
    assert ok is True
    assert conn.status == ConnectionStatus.CONNECTED
    assert conn._device_identity.device_token == "new-token"


@pytest.mark.asyncio
async def test_perform_handshake_timeout_sets_error(monkeypatch):
    conn = DummyConn()

    async def timeout_wait_for(*args, **kwargs):
        raise TimeoutError()

    monkeypatch.setattr(handshake_mod.asyncio, "wait_for", timeout_wait_for)
    ok = await perform_handshake(conn)
    assert ok is False
    assert conn.error == "Connection timed out"
