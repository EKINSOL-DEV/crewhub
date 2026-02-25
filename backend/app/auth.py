"""
Authentication & Authorization for CrewHub.

Implements API key system with 4 scopes: read, self, manage, admin.
Keys are stored in SQLite. On first startup, default keys are generated
and written to ~/.crewhub/agent.json and ~/.crewhub/api-keys.json.

Key format: ch_live_<32hexchars>  (128-bit entropy)
"""

import hashlib
import json
import logging
import os
import secrets
import time
from enum import IntEnum
from typing import Optional

from fastapi import Depends, HTTPException, Request, Security
from fastapi.security import APIKeyHeader

from app.db.database import DB_DIR, get_db

logger = logging.getLogger(__name__)

# ── Scopes ────────────────────────────────────────────────────────────


class Scope(IntEnum):
    """Permission scopes, ordered by privilege level."""

    READ = 0
    SELF = 1
    MANAGE = 2
    ADMIN = 3


SCOPE_NAMES = {
    Scope.READ: "read",
    Scope.SELF: "self",
    Scope.MANAGE: "manage",
    Scope.ADMIN: "admin",
}

SCOPE_BY_NAME = {v: k for k, v in SCOPE_NAMES.items()}


# Scope hierarchy: higher scopes include all lower ones
# admin >= manage >= self >= read
def scope_includes(held: list[str], required: str) -> bool:
    """Check if held scopes satisfy the required scope (hierarchical)."""
    required_level = SCOPE_BY_NAME.get(required, 999)
    return any(SCOPE_BY_NAME.get(s, -1) >= required_level for s in held)


# ── Key format helpers ────────────────────────────────────────────────


def generate_api_key(env: str = "live") -> str:
    """Generate a new API key: ch_<env>_<32hexchars> (128-bit entropy)."""
    random_part = secrets.token_hex(16)  # 16 bytes = 128 bits = 32 hex chars
    return f"ch_{env}_{random_part}"


def hash_key(raw_key: str) -> str:
    """Hash an API key for storage (SHA-256)."""
    return hashlib.sha256(raw_key.encode()).hexdigest()


def mask_key(raw_key: str) -> str:
    """Return prefix + last 4 chars for display (e.g. ch_live_ab...cdef)."""
    if len(raw_key) <= 12:
        return raw_key[:4] + "..." + raw_key[-4:]
    # Show prefix (up to first 12 chars) and last 4 chars
    parts = raw_key.split("_")
    if len(parts) >= 3:
        prefix = "_".join(parts[:2]) + "_" + parts[2][:4]
    else:
        prefix = raw_key[:12]
    return prefix + "..." + raw_key[-4:]


# ── Key data model ────────────────────────────────────────────────────


class APIKeyInfo:
    """Resolved API key information."""

    __slots__ = ("key_id", "name", "scopes", "agent_id", "created_at", "last_used_at", "expires_at")

    def __init__(
        self,
        key_id: str,
        name: str,
        scopes: list[str],
        agent_id: Optional[str] = None,
        created_at: int = 0,
        last_used_at: Optional[int] = None,
        expires_at: Optional[int] = None,
    ):
        self.key_id = key_id
        self.name = name
        self.scopes = scopes
        self.agent_id = agent_id
        self.created_at = created_at
        self.last_used_at = last_used_at
        self.expires_at = expires_at

    def has_scope(self, required: str) -> bool:
        return scope_includes(self.scopes, required)


# ── Rate limiter (in-memory, per API key) ─────────────────────────────

# General API rate limiting: {key_id: [timestamp_ms, ...]}
_rate_limit_log: dict[str, list[float]] = {}
RATE_LIMIT_REQUESTS = 200  # requests
RATE_LIMIT_WINDOW = 60  # seconds (200 req/min default)

# Identity creation rate limit
_identity_creation_log: dict[str, list[tuple[float, str]]] = {}
IDENTITY_CREATION_LIMIT = 10  # per hour per key
IDENTITY_CREATION_WINDOW = 3600  # seconds


def check_rate_limit(key_id: str, limit: int = RATE_LIMIT_REQUESTS, window: int = RATE_LIMIT_WINDOW) -> bool:
    """Return True if request is allowed (not rate-limited)."""
    now = time.time()
    entries = _rate_limit_log.get(key_id, [])
    entries = [t for t in entries if now - t < window]
    _rate_limit_log[key_id] = entries
    if len(entries) >= limit:
        return False
    entries.append(now)
    _rate_limit_log[key_id] = entries
    return True


def check_identity_creation_rate(key_id: str) -> bool:
    """Return True if identity creation is allowed for this key."""
    now = time.time()
    entries = _identity_creation_log.get(key_id, [])
    entries = [(t, aid) for t, aid in entries if now - t < IDENTITY_CREATION_WINDOW]
    _identity_creation_log[key_id] = entries
    return len(entries) < IDENTITY_CREATION_LIMIT


def record_identity_creation(key_id: str, agent_id: str):
    """Record that a new agent_id was created by this key."""
    now = time.time()
    if key_id not in _identity_creation_log:
        _identity_creation_log[key_id] = []
    _identity_creation_log[key_id].append((now, agent_id))


# ── Audit logging ─────────────────────────────────────────────────────

AUDIT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000  # 90 days in milliseconds


async def log_key_usage(key_id: str, endpoint: str, method: str, status_code: int = 200, ip: Optional[str] = None):
    """Write an audit log entry for API key usage."""
    now = int(time.time() * 1000)
    try:
        async with get_db() as db:
            await db.execute(
                """INSERT INTO api_key_audit_log
                   (key_id, endpoint, method, status_code, ip_addr, used_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (key_id, endpoint, method, status_code, ip, now),
            )
            await db.commit()
    except Exception as exc:
        logger.warning("Failed to write audit log: %s", exc)


async def cleanup_audit_log():
    """Delete audit log entries older than 90 days."""
    cutoff = int(time.time() * 1000) - AUDIT_RETENTION_MS
    try:
        async with get_db() as db:
            await db.execute("DELETE FROM api_key_audit_log WHERE used_at < ?", (cutoff,))
            await db.commit()
    except Exception as exc:
        logger.warning("Failed to clean up audit log: %s", exc)


# ── Key resolution from DB ────────────────────────────────────────────


async def resolve_api_key(raw_key: str) -> Optional[APIKeyInfo]:
    """Look up an API key in the database. Returns None if not found or expired."""
    key_hash = hash_key(raw_key)
    now = int(time.time() * 1000)
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM api_keys WHERE key_hash = ? AND revoked = 0",
            (key_hash,),
        ) as cursor:
            row = await cursor.fetchone()

        if not row:
            return None

        # Check expiration
        expires_at = row.get("expires_at")
        if expires_at and now > expires_at:
            logger.info("API key %s has expired", row["id"])
            return None

        # Update last_used_at
        await db.execute(
            "UPDATE api_keys SET last_used_at = ? WHERE id = ?",
            (now, row["id"]),
        )
        await db.commit()

        scopes = json.loads(row["scopes"]) if isinstance(row["scopes"], str) else row["scopes"]
        return APIKeyInfo(
            key_id=row["id"],
            name=row["name"],
            scopes=scopes,
            agent_id=row.get("agent_id"),
            created_at=row["created_at"],
            last_used_at=now,
            expires_at=expires_at,
        )


# ── FastAPI dependency ────────────────────────────────────────────────

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Public endpoints that don't require auth
PUBLIC_PATHS = {
    "/health",
    "/",
    "/api/discovery/manifest",
    "/api/discovery/scan",
    "/api/discovery/test",
    "/docs",
    "/openapi.json",
    "/redoc",
}

# Path prefixes that are public
PUBLIC_PREFIXES = [
    "/api/discovery/docs/",
]


def _is_public(path: str) -> bool:
    """Check if a path is public (no auth required)."""
    if path in PUBLIC_PATHS:
        return True
    for prefix in PUBLIC_PREFIXES:
        if path.startswith(prefix):
            return True
    return False


async def get_current_key(
    request: Request,
    api_key: Optional[str] = Security(_api_key_header),
) -> Optional[APIKeyInfo]:
    """
    FastAPI dependency that resolves the current API key.

    Returns None for public endpoints (no key required).
    Raises 401 for protected endpoints without a valid key.
    Raises 429 if rate limit exceeded.
    """
    path = request.url.path

    # Public endpoints
    if _is_public(path):
        if api_key:
            info = await resolve_api_key(api_key)
            return info  # May be None if key is invalid, but that's OK for public
        return None

    # Protected endpoints require a valid key
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="Missing API key. Provide X-API-Key header.",
        )

    info = await resolve_api_key(api_key)
    if not info:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired API key.",
        )

    # Rate limiting
    if not check_rate_limit(info.key_id):
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Max {RATE_LIMIT_REQUESTS} requests per {RATE_LIMIT_WINDOW}s.",
        )

    return info


def require_scope(scope: str):
    """
    FastAPI dependency factory that requires a specific scope.

    Usage:
        @router.post("/something")
        async def endpoint(key: APIKeyInfo = Depends(require_scope("manage"))):
            ...
    """

    async def _check(
        key: Optional[APIKeyInfo] = Depends(get_current_key),
    ) -> APIKeyInfo:
        if key is None:
            raise HTTPException(status_code=401, detail="Authentication required.")
        if not key.has_scope(scope):
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient permissions. Required scope: {scope}. Your scopes: {key.scopes}",
            )
        return key

    return _check


# ── Startup: generate default keys ───────────────────────────────────


async def init_api_keys():
    """
    Create the api_keys and audit log tables, generate default keys on first startup.

    Writes:
    - ~/.crewhub/agent.json  (self-scoped key, 0600)
    - ~/.crewhub/api-keys.json  (admin key, 0600)
    """
    async with get_db() as db:
        # Create api_keys table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS api_keys (
                id TEXT PRIMARY KEY,
                key_hash TEXT NOT NULL UNIQUE,
                key_prefix TEXT NOT NULL,
                name TEXT NOT NULL,
                scopes TEXT NOT NULL DEFAULT '["read"]',
                agent_id TEXT,
                revoked INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                expires_at INTEGER,
                last_used_at INTEGER
            )
        """)

        # Add expires_at column to existing databases (migration)
        try:
            await db.execute("ALTER TABLE api_keys ADD COLUMN expires_at INTEGER")
        except Exception:
            pass  # Column already exists

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_api_keys_agent ON api_keys(agent_id)
        """)

        # Create audit log table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS api_key_audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key_id TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                method TEXT NOT NULL DEFAULT 'GET',
                status_code INTEGER NOT NULL DEFAULT 200,
                ip_addr TEXT,
                used_at INTEGER NOT NULL,
                FOREIGN KEY (key_id) REFERENCES api_keys(id)
            )
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_audit_log_key_id
            ON api_key_audit_log(key_id, used_at DESC)
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_audit_log_used_at
            ON api_key_audit_log(used_at DESC)
        """)

        # Create agent_identities table (tracks key → agent_id bindings)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS agent_identities (
                agent_id TEXT NOT NULL,
                session_key TEXT NOT NULL,
                api_key_id TEXT,
                runtime TEXT,
                bound_at INTEGER NOT NULL,
                last_seen_at INTEGER NOT NULL,
                PRIMARY KEY (agent_id, session_key),
                FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
            )
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_agent_identities_session
            ON agent_identities(session_key)
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_agent_identities_key
            ON agent_identities(api_key_id)
        """)

        await db.commit()

        # Check if we already have keys
        async with db.execute("SELECT COUNT(*) as cnt FROM api_keys") as cursor:
            count = (await cursor.fetchone())["cnt"]

        if count == 0:
            await _generate_default_keys(db)
        else:
            # Ensure file exists even if keys are in DB (idempotent)
            await _ensure_key_files(db)


async def _generate_default_keys(db):
    """Generate default admin + self keys and write to files."""
    now = int(time.time() * 1000)
    default_expiry = now + (90 * 24 * 60 * 60 * 1000)  # 90 days

    # Admin key (no expiry for default admin)
    admin_raw = generate_api_key("live")
    admin_id = f"key_{secrets.token_hex(4)}"
    await db.execute(
        """INSERT INTO api_keys (id, key_hash, key_prefix, name, scopes, agent_id, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            admin_id,
            hash_key(admin_raw),
            mask_key(admin_raw),
            "Default Local Admin",
            json.dumps(["read", "self", "manage", "admin"]),
            None,
            now,
            None,
        ),
    )

    # Self key (for agents), expires in 90 days
    self_raw = generate_api_key("live")
    self_id = f"key_{secrets.token_hex(4)}"
    await db.execute(
        """INSERT INTO api_keys (id, key_hash, key_prefix, name, scopes, agent_id, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            self_id,
            hash_key(self_raw),
            mask_key(self_raw),
            "Default Agent Key",
            json.dumps(["read", "self"]),
            None,
            now,
            default_expiry,
        ),
    )

    await db.commit()
    logger.info("Generated default API keys")

    # Write key files
    _write_agent_json(self_raw)
    _write_api_keys_json(admin_raw, self_raw)


async def _ensure_key_files(db):
    """Ensure key files exist. If not, we can't recover raw keys — log warning."""
    agent_json = DB_DIR / "agent.json"
    api_keys_json = DB_DIR / "api-keys.json"

    if not agent_json.exists() or not api_keys_json.exists():
        logger.warning(
            "Key files missing but keys exist in DB. "
            "Raw keys cannot be recovered. Delete api_keys table rows "
            "and restart to regenerate, or create new keys via API."
        )


def _write_agent_json(self_key: str):
    """Write ~/.crewhub/agent.json with self-scoped key."""
    DB_DIR.mkdir(parents=True, exist_ok=True)
    agent_json = DB_DIR / "agent.json"
    data = {
        "crewhub_url": "http://localhost:8090",
        "auth": {
            "default_key": self_key,
            "scopes": ["read", "self"],
            "mode": "local-trust",
        },
        "version": "1.0",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    agent_json.write_text(json.dumps(data, indent=2))
    try:
        os.chmod(agent_json, 0o600)
    except OSError as e:
        logger.warning(f"Failed to set permissions on agent.json: {e}")
    logger.info(f"Wrote {agent_json}")


def _write_api_keys_json(admin_key: str, self_key: str):
    """Write ~/.crewhub/api-keys.json with admin + self keys."""
    DB_DIR.mkdir(parents=True, exist_ok=True)
    api_keys_json = DB_DIR / "api-keys.json"
    data = {
        "keys": [
            {
                "key": admin_key,
                "name": "Default Local Admin",
                "scopes": ["read", "self", "manage", "admin"],
            },
            {
                "key": self_key,
                "name": "Default Agent Key",
                "scopes": ["read", "self"],
            },
        ],
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    api_keys_json.write_text(json.dumps(data, indent=2))
    try:
        os.chmod(api_keys_json, 0o600)
    except OSError as e:
        logger.warning(f"Failed to set permissions on api-keys.json: {e}")
    logger.info(f"Wrote {api_keys_json}")
