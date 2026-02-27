import asyncio

import pytest

from app.services.connections._handshake import _choose_auth, _reset_existing_connection, perform_handshake
from app.services.connections.base import ConnectionStatus


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
        def __init__(self):
            self.closed = False

        async def close(self):
            self.closed = True

    conn.ws = WS()
    conn._listen_task = asyncio.create_task(asyncio.sleep(10))

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
            raise AssertionError("should not clear")

        async def update_device_token(self, _device_id, token):
            self.updated = token

    class WS:
        def __init__(self):
            self.sent = []
            self._recv = [
                '{"type":"event","event":"connect.challenge","payload":{"nonce":"abc"}}',
                '{"ok":true,"payload":{"auth":{"deviceToken":"new-token"}}}',
            ]

        async def recv(self):
            return self._recv.pop(0)

        async def send(self, data):
            self.sent.append(data)

        async def close(self):
            return None

    ws = WS()

    monkeypatch.setattr("app.services.connections.device_identity.DeviceIdentityManager", lambda: IM())
    monkeypatch.setattr("app.services.connections._handshake.websockets.connect", lambda *a, **k: ws)

    ok = await perform_handshake(conn)
    assert ok is True
    assert conn.status == ConnectionStatus.CONNECTED
    assert conn._device_identity.device_token == "new-token"
    assert conn._listen_task is not None


@pytest.mark.asyncio
async def test_perform_handshake_rejected_device_token_clears(monkeypatch):
    conn = DummyConn()
    identity = DummyIdentity("bad-token")

    class IM:
        cleared = False

        async def get_or_create_device_identity(self, **kwargs):
            return identity

        async def clear_device_token(self, _device_id):
            self.cleared = True

        async def update_device_token(self, _device_id, token):
            raise AssertionError("should not update")

    im = IM()

    class WS:
        async def recv(self):
            if not hasattr(self, "_n"):
                self._n = 0
            self._n += 1
            if self._n == 1:
                return '{"type":"event","event":"connect.challenge","payload":{"nonce":"abc"}}'
            return '{"ok":false,"error":{"code":"DEVICE_TOKEN_INVALID","message":"nope"}}'

        async def send(self, _data):
            return None

        async def close(self):
            return None

    monkeypatch.setattr("app.services.connections.device_identity.DeviceIdentityManager", lambda: im)
    monkeypatch.setattr("app.services.connections._handshake.websockets.connect", lambda *a, **k: WS())

    ok = await perform_handshake(conn)
    assert ok is False
    assert im.cleared is True
    assert conn.error.startswith("Connect rejected")


@pytest.mark.asyncio
async def test_perform_handshake_timeout_sets_error(monkeypatch):
    conn = DummyConn()

    async def timeout_wait_for(*args, **kwargs):
        raise TimeoutError()

    monkeypatch.setattr("app.services.connections._handshake.asyncio.wait_for", timeout_wait_for)

    ok = await perform_handshake(conn)
    assert ok is False
    assert conn.error == "Connection timed out"


@pytest.mark.asyncio
async def test_perform_handshake_bad_challenge_sets_error(monkeypatch):
    conn = DummyConn()
    identity = DummyIdentity(None)

    class IM:
        async def get_or_create_device_identity(self, **kwargs):
            return identity

        async def clear_device_token(self, _device_id):
            return None

        async def update_device_token(self, _device_id, token):
            return None

    class WS:
        async def recv(self):
            return '{"type":"event","event":"wrong"}'

        async def send(self, _data):
            return None

        async def close(self):
            return None

    monkeypatch.setattr("app.services.connections.device_identity.DeviceIdentityManager", lambda: IM())
    monkeypatch.setattr("app.services.connections._handshake.websockets.connect", lambda *a, **k: WS())

    ok = await perform_handshake(conn)
    assert ok is False
    assert "Expected connect.challenge" in conn.error
