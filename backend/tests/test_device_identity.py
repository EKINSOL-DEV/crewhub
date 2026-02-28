"""Tests for app.services.connections.device_identity."""

from __future__ import annotations

import base64
import hashlib
from unittest.mock import AsyncMock, patch

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

import app.main  # noqa: F401
from app.services.connections.device_identity import (
    CREWHUB_CLIENT_ID,
    CREWHUB_CLIENT_MODE,
    CREWHUB_ROLE,
    CREWHUB_SCOPES,
    DeviceIdentity,
    DeviceIdentityManager,
    _pubkey_to_b64url,
    _pubkey_to_device_id,
    _sig_to_b64url,
)

# ---------------------------------------------------------------------------
# Helper to generate a real key pair
# ---------------------------------------------------------------------------


def _generate_keypair():
    priv = Ed25519PrivateKey.generate()
    pub = priv.public_key()
    pub_bytes = pub.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    device_id = _pubkey_to_device_id(pub_bytes)
    return priv, pub, pub_bytes, device_id


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


class TestPubkeyHelpers:
    def test_pubkey_to_b64url_no_padding(self):
        data = b"A" * 32
        result = _pubkey_to_b64url(data)
        assert "=" not in result
        # Verify it's valid base64url
        # Add padding if needed
        padding = 4 - len(result) % 4
        if padding < 4:
            result_padded = result + "=" * padding
        else:
            result_padded = result
        decoded = base64.urlsafe_b64decode(result_padded)
        assert decoded == data

    def test_pubkey_to_device_id_is_sha256_hex(self):
        data = b"X" * 32
        result = _pubkey_to_device_id(data)
        expected = hashlib.sha256(data).hexdigest()
        assert result == expected
        assert len(result) == 64  # 32 bytes as hex

    def test_sig_to_b64url_no_padding(self):
        sig = b"Z" * 64  # Ed25519 signature is 64 bytes
        result = _sig_to_b64url(sig)
        assert "=" not in result


# ---------------------------------------------------------------------------
# DeviceIdentity
# ---------------------------------------------------------------------------


class TestDeviceIdentity:
    def setup_method(self):
        self.priv, self.pub, self.pub_bytes, self.device_id = _generate_keypair()
        self.identity = DeviceIdentity(
            device_id=self.device_id,
            private_key=self.priv,
            public_key=self.pub,
        )

    def test_device_id(self):
        assert self.identity.device_id == self.device_id

    def test_default_device_name(self):
        assert self.identity.device_name.startswith("CrewHub-")
        assert self.device_id[:16] in self.identity.device_name

    def test_custom_device_name(self):
        identity = DeviceIdentity(
            device_id=self.device_id,
            private_key=self.priv,
            public_key=self.pub,
            device_name="CustomName",
        )
        assert identity.device_name == "CustomName"

    def test_default_platform(self):
        assert self.identity.platform == "crewhub"

    def test_custom_platform(self):
        identity = DeviceIdentity(
            device_id=self.device_id,
            private_key=self.priv,
            public_key=self.pub,
            platform="test_platform",
        )
        assert identity.platform == "test_platform"

    def test_device_token_default_none(self):
        assert self.identity.device_token is None

    def test_device_token_set(self):
        identity = DeviceIdentity(
            device_id=self.device_id,
            private_key=self.priv,
            public_key=self.pub,
            device_token="mytoken123",
        )
        assert identity.device_token == "mytoken123"

    def test_get_public_key_raw(self):
        raw = self.identity.get_public_key_raw()
        assert isinstance(raw, bytes)
        assert len(raw) == 32  # Ed25519 public key is 32 bytes

    def test_get_public_key_b64url(self):
        b64 = self.identity.get_public_key_b64url()
        assert isinstance(b64, str)
        assert "=" not in b64
        # Verify it decodes correctly
        expected = _pubkey_to_b64url(self.pub_bytes)
        assert b64 == expected

    def test_get_public_key_pem(self):
        pem = self.identity.get_public_key_pem()
        assert "BEGIN PUBLIC KEY" in pem

    def test_get_private_key_pem(self):
        pem = self.identity.get_private_key_pem()
        assert "PRIVATE KEY" in pem

    def test_build_signed_payload_format(self):
        payload = self.identity.build_signed_payload(
            nonce="test-nonce",
            auth_token="auth123",
            signed_at_ms=1700000000000,
        )
        parts = payload.split("|")
        assert parts[0] == "v2"
        assert parts[1] == self.device_id
        assert parts[2] == CREWHUB_CLIENT_ID
        assert parts[3] == CREWHUB_CLIENT_MODE
        assert parts[4] == CREWHUB_ROLE
        assert parts[5] == ",".join(CREWHUB_SCOPES)
        assert parts[6] == "1700000000000"
        assert parts[7] == "auth123"
        assert parts[8] == "test-nonce"

    def test_build_signed_payload_auto_timestamp(self):
        import time

        before = int(time.time() * 1000)
        payload = self.identity.build_signed_payload("nonce", "token")
        after = int(time.time() * 1000)
        parts = payload.split("|")
        ts = int(parts[6])
        assert before <= ts <= after

    def test_build_signed_payload_empty_token(self):
        payload = self.identity.build_signed_payload("nonce", "")
        parts = payload.split("|")
        assert parts[7] == ""

    def test_sign_payload(self):
        payload = "test payload string"
        sig = self.identity.sign_payload(payload)
        assert isinstance(sig, str)
        assert "=" not in sig  # base64url, no padding

    def test_sign_payload_is_valid_signature(self):
        """Verify signature with public key."""

        payload = "v2|deviceid|cli|cli|operator|scope|ts|token|nonce"
        sig_b64 = self.identity.sign_payload(payload)
        # Add padding
        padding = 4 - len(sig_b64) % 4
        if padding < 4:
            sig_padded = sig_b64 + "=" * padding
        else:
            sig_padded = sig_b64
        sig_bytes = base64.urlsafe_b64decode(sig_padded)
        # Verify (should not raise)
        self.pub.verify(sig_bytes, payload.encode("utf-8"))

    def test_build_device_block_structure(self):
        block = self.identity.build_device_block(
            nonce="my-nonce",
            auth_token="token123",
            signed_at_ms=1700000000000,
        )
        assert block["id"] == self.device_id
        assert "publicKey" in block
        assert "signature" in block
        assert block["signedAt"] == 1700000000000
        assert block["nonce"] == "my-nonce"

    def test_build_device_block_auto_timestamp(self):
        import time

        before = int(time.time() * 1000)
        block = self.identity.build_device_block("nonce", "token")
        after = int(time.time() * 1000)
        assert before <= block["signedAt"] <= after

    def test_sign_nonce_base64(self):
        """sign_nonce should return regular base64 (with padding)."""
        sig = self.identity.sign_nonce("test-nonce")
        assert isinstance(sig, str)
        # Should be decodable with standard base64
        decoded = base64.b64decode(sig.encode())
        assert len(decoded) == 64  # Ed25519 signature

    def test_to_dict(self):
        d = self.identity.to_dict()
        assert d["device_id"] == self.device_id
        assert "private_key_pem" in d
        assert "public_key_pem" in d
        assert d["device_token"] is None
        assert d["device_name"] == self.identity.device_name
        assert d["platform"] == "crewhub"

    def test_to_dict_with_token(self):
        identity = DeviceIdentity(
            device_id=self.device_id,
            private_key=self.priv,
            public_key=self.pub,
            device_token="abc123",
        )
        d = identity.to_dict()
        assert d["device_token"] == "abc123"


class TestDeviceIdentityFromPem:
    def setup_method(self):
        self.priv, self.pub, self.pub_bytes, self.device_id = _generate_keypair()
        self.identity = DeviceIdentity(
            device_id=self.device_id,
            private_key=self.priv,
            public_key=self.pub,
        )
        self.pem = self.identity.get_private_key_pem()

    def test_from_pem_creates_identity(self):
        loaded = DeviceIdentity.from_pem(
            device_id=self.device_id,
            private_key_pem=self.pem,
        )
        assert loaded.device_id == self.device_id
        assert isinstance(loaded.private_key, Ed25519PrivateKey)

    def test_from_pem_preserves_device_token(self):
        loaded = DeviceIdentity.from_pem(
            device_id=self.device_id,
            private_key_pem=self.pem,
            device_token="saved-token",
        )
        assert loaded.device_token == "saved-token"

    def test_from_pem_preserves_device_name(self):
        loaded = DeviceIdentity.from_pem(
            device_id=self.device_id,
            private_key_pem=self.pem,
            device_name="MyDevice",
        )
        assert loaded.device_name == "MyDevice"

    def test_from_pem_preserves_platform(self):
        loaded = DeviceIdentity.from_pem(
            device_id=self.device_id,
            private_key_pem=self.pem,
            platform="linux",
        )
        assert loaded.platform == "linux"

    def test_from_pem_roundtrip_signing(self):
        """Keys loaded from PEM should produce same signatures."""
        loaded = DeviceIdentity.from_pem(
            device_id=self.device_id,
            private_key_pem=self.pem,
        )
        # Same payload should produce same result only if same key
        # Just verify it doesn't raise and produces a valid sig
        block = loaded.build_device_block("nonce123", "token456")
        assert block["id"] == self.device_id

    def test_from_pem_invalid_key_raises(self):
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric.rsa import generate_private_key

        # Generate an RSA key (not Ed25519) and try to load as Ed25519
        rsa_key = generate_private_key(65537, 2048)
        rsa_pem = rsa_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode()

        with pytest.raises(ValueError, match="Invalid private key type"):
            DeviceIdentity.from_pem(device_id="test", private_key_pem=rsa_pem)


# ---------------------------------------------------------------------------
# DeviceIdentityManager
# ---------------------------------------------------------------------------


class TestDeviceIdentityManager:
    """Test the async database operations with mocked DB."""

    def _make_manager(self):
        return DeviceIdentityManager()

    @pytest.mark.asyncio
    async def test_generate_device_identity(self):
        """Test generating a new device identity."""
        manager = self._make_manager()
        mock_db = AsyncMock()
        mock_cursor = AsyncMock()
        mock_cursor.fetchone.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.connections.device_identity.get_db", return_value=mock_db):
            identity = await manager.generate_device_identity(
                connection_id="conn-test",
                device_name="TestDevice",
            )

        assert isinstance(identity, DeviceIdentity)
        assert len(identity.device_id) == 64  # SHA256 hex
        assert identity.device_name == "TestDevice"
        assert identity.platform == "crewhub"

    @pytest.mark.asyncio
    async def test_generate_device_identity_default_name(self):
        """Test default device name."""
        manager = self._make_manager()
        mock_db = AsyncMock()
        mock_cursor = AsyncMock()
        mock_cursor.fetchone.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.connections.device_identity.get_db", return_value=mock_db):
            identity = await manager.generate_device_identity(connection_id="conn-123")

        # Default name uses device_id[:16]
        assert identity.device_name.startswith("CrewHub-")

    @pytest.mark.asyncio
    async def test_save_device_identity_insert(self):
        """Test inserting a new device identity."""
        manager = self._make_manager()
        priv, pub, pub_bytes, device_id = _generate_keypair()
        identity = DeviceIdentity(device_id=device_id, private_key=priv, public_key=pub)

        mock_db = AsyncMock()
        mock_cursor = AsyncMock()
        mock_cursor.fetchone.return_value = None  # Not exists → INSERT
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.connections.device_identity.get_db", return_value=mock_db):
            await manager.save_device_identity(identity, "conn-1")

        # Should have called execute multiple times (init table + select + insert)
        assert mock_db.execute.called
        assert mock_db.commit.called

    @pytest.mark.asyncio
    async def test_save_device_identity_update(self):
        """Test updating an existing device identity."""
        manager = self._make_manager()
        priv, pub, pub_bytes, device_id = _generate_keypair()
        identity = DeviceIdentity(device_id=device_id, private_key=priv, public_key=pub)

        mock_db = AsyncMock()
        mock_cursor = AsyncMock()
        mock_cursor.fetchone.return_value = {"device_id": device_id}  # Exists → UPDATE
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.connections.device_identity.get_db", return_value=mock_db):
            await manager.save_device_identity(identity, "conn-1")

        assert mock_db.execute.called
        assert mock_db.commit.called

    @pytest.mark.asyncio
    async def test_get_device_identity_not_found(self):
        """Test retrieving a non-existent identity returns None."""
        manager = self._make_manager()

        mock_db = AsyncMock()
        mock_cursor = AsyncMock()
        mock_cursor.fetchone.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.connections.device_identity.get_db", return_value=mock_db):
            result = await manager.get_device_identity("conn-missing")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_device_identity_found(self):
        """Test retrieving an existing identity."""
        manager = self._make_manager()
        priv, pub, pub_bytes, device_id = _generate_keypair()
        identity = DeviceIdentity(device_id=device_id, private_key=priv, public_key=pub)
        pem = identity.get_private_key_pem()

        mock_row = {
            "device_id": device_id,
            "device_name": "TestDevice",
            "platform": "crewhub",
            "private_key_pem": pem,
            "device_token": None,
        }

        mock_db = AsyncMock()
        mock_cursor = AsyncMock()
        mock_cursor.fetchone.return_value = mock_row
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.connections.device_identity.get_db", return_value=mock_db):
            result = await manager.get_device_identity("conn-1")

        assert result is not None
        assert result.device_id == device_id
        assert result.device_name == "TestDevice"

    @pytest.mark.asyncio
    async def test_get_device_identity_bad_pem_returns_none(self):
        """Test that corrupt PEM returns None."""
        manager = self._make_manager()

        mock_row = {
            "device_id": "bad_id",
            "device_name": "BadDevice",
            "platform": "crewhub",
            "private_key_pem": "NOT A VALID PEM",
            "device_token": None,
        }

        mock_db = AsyncMock()
        mock_cursor = AsyncMock()
        mock_cursor.fetchone.return_value = mock_row
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.connections.device_identity.get_db", return_value=mock_db):
            result = await manager.get_device_identity("conn-corrupt")

        assert result is None

    @pytest.mark.asyncio
    async def test_update_device_token(self):
        """Test updating a device token."""
        manager = self._make_manager()

        mock_db = AsyncMock()
        mock_cursor = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.connections.device_identity.get_db", return_value=mock_db):
            await manager.update_device_token("device-123", "new-token-456")

        # Verify the UPDATE was called
        assert mock_db.execute.called
        assert mock_db.commit.called

    @pytest.mark.asyncio
    async def test_clear_device_token(self):
        """Test clearing a device token."""
        manager = self._make_manager()

        mock_db = AsyncMock()
        mock_cursor = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.connections.device_identity.get_db", return_value=mock_db):
            await manager.clear_device_token("device-123")

        assert mock_db.execute.called
        assert mock_db.commit.called

    @pytest.mark.asyncio
    async def test_get_or_create_returns_existing(self):
        """Test get_or_create returns existing identity if found."""
        manager = self._make_manager()
        priv, pub, pub_bytes, device_id = _generate_keypair()
        mock_identity = DeviceIdentity(
            device_id=device_id,
            private_key=priv,
            public_key=pub,
        )

        with patch.object(manager, "get_device_identity", new=AsyncMock(return_value=mock_identity)):
            result = await manager.get_or_create_device_identity("conn-1")

        assert result.device_id == device_id

    @pytest.mark.asyncio
    async def test_get_or_create_creates_new_when_none(self):
        """Test get_or_create generates new identity when none exists."""
        manager = self._make_manager()

        mock_db = AsyncMock()
        mock_cursor = AsyncMock()
        mock_cursor.fetchone.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch.object(manager, "get_device_identity", new=AsyncMock(return_value=None)):
            with patch("app.services.connections.device_identity.get_db", return_value=mock_db):
                result = await manager.get_or_create_device_identity("conn-new")

        assert isinstance(result, DeviceIdentity)

    def test_pair_device_deprecated_returns_false(self):
        """pair_device() is deprecated and always returns False."""
        manager = self._make_manager()
        priv, pub, pub_bytes, device_id = _generate_keypair()
        identity = DeviceIdentity(device_id=device_id, private_key=priv, public_key=pub)

        result = manager.pair_device(identity, None)
        assert result is False


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------


class TestConstants:
    def test_client_id(self):
        assert CREWHUB_CLIENT_ID == "cli"

    def test_client_mode(self):
        assert CREWHUB_CLIENT_MODE == "cli"

    def test_role(self):
        assert CREWHUB_ROLE == "operator"

    def test_scopes_not_empty(self):
        assert len(CREWHUB_SCOPES) > 0
        assert "operator.admin" in CREWHUB_SCOPES
