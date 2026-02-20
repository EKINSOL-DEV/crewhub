"""
Device identity management for OpenClaw Gateway pairing.

Implements the OpenClaw device auth protocol:

1. Generate device keypair (Ed25519).
2. On every connect: include a `device` block with:
   - deviceId  = SHA256(public_key_bytes) as hex
   - publicKey = base64url(public_key_bytes)
   - signature = Ed25519 sign of the v2 payload string
   - signedAt  = current timestamp ms
   - nonce     = nonce from the gateway challenge
3. The gateway verifies the signature and (for new devices) registers the
   device automatically, returning `auth.deviceToken` in the connect response.
4. The client stores the device token and uses it as `auth.token` for all
   future connections (instead of the shared gateway token).

This gives the backend a unique, per-connection identity and grants it
`operator.admin` scope — enabling the removal of the insecure gateway flags
`dangerouslyDisableDeviceAuth` and `allowInsecureAuth` from
`~/.openclaw/openclaw.json`.
"""

import base64
import hashlib
import logging
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import aiosqlite
from app.db.database import get_db
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

logger = logging.getLogger(__name__)

# Database path — use same as main CrewHub database
_db_path_env = os.environ.get("CREWHUB_DB_PATH")
if _db_path_env:
    DB_PATH = Path(_db_path_env)
else:
    DB_PATH = Path.home() / ".crewhub" / "crewhub.db"

# Fixed client identifiers (must match the gateway schema constants)
CREWHUB_CLIENT_ID = "cli"
CREWHUB_CLIENT_MODE = "cli"
CREWHUB_ROLE = "operator"
CREWHUB_SCOPES = [
    "operator.admin",
    "operator.approvals",
    "operator.pairing",
    "operator.read",
    "operator.write",
]


def _pubkey_to_b64url(pub_bytes: bytes) -> str:
    """Encode raw Ed25519 public key bytes as base64url (no padding)."""
    return base64.urlsafe_b64encode(pub_bytes).rstrip(b"=").decode()


def _pubkey_to_device_id(pub_bytes: bytes) -> str:
    """Derive deviceId as SHA-256 hex of raw public key bytes (OpenClaw convention)."""
    return hashlib.sha256(pub_bytes).hexdigest()


def _sig_to_b64url(sig_bytes: bytes) -> str:
    return base64.urlsafe_b64encode(sig_bytes).rstrip(b"=").decode()


class DeviceIdentity:
    """
    Device identity for OpenClaw Gateway pairing.

    Stores:
    - deviceId  = SHA256(pubkey_bytes) as hex — matches OpenClaw convention
    - Ed25519 keypair
    - device_token  — received in connect response after first auth
    - Metadata (name, platform)
    """

    def __init__(
        self,
        device_id: str,
        private_key: Ed25519PrivateKey,
        public_key: Ed25519PublicKey,
        device_token: Optional[str] = None,
        device_name: Optional[str] = None,
        platform: Optional[str] = None,
    ):
        self.device_id = device_id
        self.private_key = private_key
        self.public_key = public_key
        self.device_token = device_token
        self.device_name = device_name or f"CrewHub-{device_id[:16]}"
        self.platform = platform or "crewhub"

    # ── Key serialization ───────────────────────────────────────────

    def get_public_key_raw(self) -> bytes:
        """Raw 32-byte Ed25519 public key."""
        return self.public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )

    def get_public_key_b64url(self) -> str:
        """Base64url-encoded public key (no padding) — for gateway device block."""
        return _pubkey_to_b64url(self.get_public_key_raw())

    def get_public_key_pem(self) -> str:
        """PEM-encoded public key — for storage."""
        pem = self.public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        return pem.decode("utf-8")

    def get_private_key_pem(self) -> str:
        """PEM-encoded private key (unencrypted) — for storage."""
        pem = self.private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        return pem.decode("utf-8")

    # ── Signing ─────────────────────────────────────────────────────

    def build_signed_payload(
        self,
        nonce: str,
        auth_token: str,
        signed_at_ms: Optional[int] = None,
    ) -> str:
        """
        Build the v2 signed payload string.

        Format (all fields joined with '|'):
            "v2|<deviceId>|<clientId>|<clientMode>|<role>|<scopes CSV>|<signedAtMs>|<token>|<nonce>"

        This matches the OpenClaw Control UI signing convention (yg() function).
        """
        if signed_at_ms is None:
            signed_at_ms = int(time.time() * 1000)
        scopes_csv = ",".join(CREWHUB_SCOPES)
        parts = [
            "v2",
            self.device_id,
            CREWHUB_CLIENT_ID,
            CREWHUB_CLIENT_MODE,
            CREWHUB_ROLE,
            scopes_csv,
            str(signed_at_ms),
            auth_token or "",
            nonce,
        ]
        return "|".join(parts)

    def sign_payload(self, payload: str) -> str:
        """Sign a string payload with the Ed25519 private key. Returns base64url."""
        sig_bytes = self.private_key.sign(payload.encode("utf-8"))
        return _sig_to_b64url(sig_bytes)

    def build_device_block(
        self,
        nonce: str,
        auth_token: str,
        signed_at_ms: Optional[int] = None,
    ) -> dict[str, Any]:
        """
        Build the `device` block for the gateway connect request.

        Returns a dict with id, publicKey, signature, signedAt, nonce.
        This block is separate from `client` in the connect params.
        """
        if signed_at_ms is None:
            signed_at_ms = int(time.time() * 1000)
        payload = self.build_signed_payload(nonce, auth_token, signed_at_ms)
        signature = self.sign_payload(payload)
        return {
            "id": self.device_id,
            "publicKey": self.get_public_key_b64url(),
            "signature": signature,
            "signedAt": signed_at_ms,
            "nonce": nonce,
        }

    # ── Legacy / compat ─────────────────────────────────────────────

    def sign_nonce(self, nonce: str) -> str:
        """Sign a raw nonce string. Returns base64 (not urlsafe)."""
        sig_bytes = self.private_key.sign(nonce.encode("utf-8"))
        return base64.b64encode(sig_bytes).decode("utf-8")

    # ── Serialisation ────────────────────────────────────────────────

    @classmethod
    def from_pem(
        cls,
        device_id: str,
        private_key_pem: str,
        device_token: Optional[str] = None,
        device_name: Optional[str] = None,
        platform: Optional[str] = None,
    ) -> "DeviceIdentity":
        """Load device identity from PEM-encoded private key."""
        private_key = serialization.load_pem_private_key(
            private_key_pem.encode("utf-8"),
            password=None,
        )
        if not isinstance(private_key, Ed25519PrivateKey):
            raise ValueError("Invalid private key type")
        public_key = private_key.public_key()
        return cls(
            device_id=device_id,
            private_key=private_key,
            public_key=public_key,
            device_token=device_token,
            device_name=device_name,
            platform=platform,
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dict for storage."""
        return {
            "device_id": self.device_id,
            "private_key_pem": self.get_private_key_pem(),
            "public_key_pem": self.get_public_key_pem(),
            "device_token": self.device_token,
            "device_name": self.device_name,
            "platform": self.platform,
        }


class DeviceIdentityManager:
    """
    Manages device identity lifecycle for OpenClaw Gateway connections.

    - Creates and stores device identities in SQLite
    - Signs connect payloads for device auth
    - Stores device tokens received in connect responses
    """

    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path

    async def init_database(self):
        """Ensure device_identities table exists."""
        async with get_db() as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS device_identities (
                    device_id TEXT PRIMARY KEY,
                    connection_id TEXT,
                    device_name TEXT NOT NULL,
                    platform TEXT NOT NULL,
                    private_key_pem TEXT NOT NULL,
                    public_key_pem TEXT NOT NULL,
                    device_token TEXT,
                    paired_at INTEGER,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            """)
            await db.commit()

    async def generate_device_identity(
        self,
        connection_id: str,
        device_name: Optional[str] = None,
        platform: str = "crewhub",
    ) -> "DeviceIdentity":
        """
        Generate a new device identity with Ed25519 keypair.

        deviceId = SHA256(public_key_bytes) — matches OpenClaw's convention.
        """
        private_key = Ed25519PrivateKey.generate()
        public_key = private_key.public_key()
        pub_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        device_id = _pubkey_to_device_id(pub_bytes)

        identity = DeviceIdentity(
            device_id=device_id,
            private_key=private_key,
            public_key=public_key,
            device_name=device_name or f"CrewHub-{device_id[:16]}",
            platform=platform,
        )

        await self.save_device_identity(identity, connection_id)

        logger.info(
            f"Generated device identity: {device_id[:16]}... "
            f"(name={identity.device_name}, platform={platform})"
        )
        return identity

    async def save_device_identity(
        self,
        identity: "DeviceIdentity",
        connection_id: str,
    ) -> None:
        """Save or update device identity in database."""
        await self.init_database()

        now = int(datetime.utcnow().timestamp())

        async with get_db() as db:
            cursor = await db.execute(
                "SELECT device_id FROM device_identities WHERE device_id = ?",
                (identity.device_id,),
            )
            exists = await cursor.fetchone() is not None

            if exists:
                await db.execute(
                    """
                    UPDATE device_identities
                    SET device_name = ?,
                        platform = ?,
                        private_key_pem = ?,
                        public_key_pem = ?,
                        device_token = ?,
                        paired_at = ?,
                        updated_at = ?
                    WHERE device_id = ?
                    """,
                    (
                        identity.device_name,
                        identity.platform,
                        identity.get_private_key_pem(),
                        identity.get_public_key_pem(),
                        identity.device_token,
                        now if identity.device_token else None,
                        now,
                        identity.device_id,
                    ),
                )
            else:
                await db.execute(
                    """
                    INSERT INTO device_identities (
                        device_id, connection_id, device_name, platform,
                        private_key_pem, public_key_pem, device_token,
                        paired_at, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        identity.device_id,
                        connection_id,
                        identity.device_name,
                        identity.platform,
                        identity.get_private_key_pem(),
                        identity.get_public_key_pem(),
                        identity.device_token,
                        now if identity.device_token else None,
                        now,
                        now,
                    ),
                )

            await db.commit()

    async def get_device_identity(
        self, connection_id: str
    ) -> Optional["DeviceIdentity"]:
        """Retrieve device identity for a connection (most recently created)."""
        await self.init_database()

        async with get_db() as db:
            cursor = await db.execute(
                """
                SELECT device_id, device_name, platform,
                       private_key_pem, device_token
                FROM device_identities
                WHERE connection_id = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (connection_id,),
            )
            row = await cursor.fetchone()

        if not row:
            return None

        try:
            return DeviceIdentity.from_pem(
                device_id=row["device_id"],
                private_key_pem=row["private_key_pem"],
                device_token=row["device_token"],
                device_name=row["device_name"],
                platform=row["platform"],
            )
        except Exception as e:
            logger.error(f"Failed to load device identity: {e}")
            return None

    async def update_device_token(
        self, device_id: str, device_token: str
    ) -> None:
        """Update device token after successful pairing / connect response."""
        await self.init_database()

        now = int(datetime.utcnow().timestamp())

        async with get_db() as db:
            await db.execute(
                """
                UPDATE device_identities
                SET device_token = ?,
                    paired_at = ?,
                    updated_at = ?
                WHERE device_id = ?
                """,
                (device_token, now, now, device_id),
            )
            await db.commit()

        logger.info(f"Updated device token for device {device_id[:16]}...")

    async def clear_device_token(self, device_id: str) -> None:
        """
        Clear device token (e.g. after token expiry / rejection by gateway).

        The device identity (keypair) is kept; only the token is cleared.
        Next connect() will re-authenticate and obtain a fresh token.
        """
        await self.init_database()

        now = int(datetime.utcnow().timestamp())

        async with get_db() as db:
            await db.execute(
                """
                UPDATE device_identities
                SET device_token = NULL,
                    paired_at = NULL,
                    updated_at = ?
                WHERE device_id = ?
                """,
                (now, device_id),
            )
            await db.commit()

        logger.info(
            f"Cleared device token for {device_id[:16]}... "
            "(will re-authenticate on next connect)"
        )

    async def get_or_create_device_identity(
        self, connection_id: str, device_name: Optional[str] = None
    ) -> "DeviceIdentity":
        """Get existing device identity or create a new one."""
        identity = await self.get_device_identity(connection_id)

        if identity:
            logger.debug(
                f"Using existing device identity: {identity.device_id[:16]}... "
                f"(has_token={identity.device_token is not None})"
            )
            return identity

        logger.info(f"Creating new device identity for connection {connection_id}")
        return await self.generate_device_identity(
            connection_id=connection_id,
            device_name=device_name or f"CrewHub-{connection_id[:8]}",
        )

    # ── Legacy compat (kept for tests / external callers) ───────────

    async def pair_device(
        self,
        identity: "DeviceIdentity",
        ws_connection,
        timeout: float = 30.0,
    ) -> bool:
        """
        DEPRECATED: The `devices.pair` WebSocket method does not exist in the
        current OpenClaw gateway.

        Device pairing now happens automatically via the `device` block in the
        connect request (see `OpenClawConnection._do_connect()`). When the
        gateway accepts the device identity, it returns `auth.deviceToken` in
        the connect response, which is then stored by the caller.

        This method is kept as a no-op stub to avoid import errors in any
        existing callers. It will always return False.
        """
        logger.warning(
            "pair_device() called but is deprecated — device auth is handled "
            "via the connect request `device` block. No action taken."
        )
        return False
