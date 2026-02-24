"""
/api/auth/* endpoints for API key management.

Admin-only endpoints for creating, listing, and revoking API keys.
Includes expiration, audit log, and key reveal (one-time).
"""

import json
import logging
import secrets
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth import (
    APIKeyInfo,
    generate_api_key,
    hash_key,
    mask_key,
    require_scope,
    cleanup_audit_log,
)
from app.db.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

# Default expiration: 90 days
DEFAULT_EXPIRES_DAYS = 90


# ── Models ────────────────────────────────────────────────────────────

class CreateKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    scopes: list[str] = Field(default=["read", "self"])
    expires_in_days: Optional[int] = Field(
        default=DEFAULT_EXPIRES_DAYS,
        ge=1,
        le=3650,
        description="Key expiration in days (default 90). Set to null for no expiry.",
    )
    env: str = Field(
        default="live",
        description="Key environment prefix: 'live' or 'test'",
    )
    agent_id: Optional[str] = Field(None, max_length=128,
                                     description="Bind key to specific agent_id")


class CreateKeyResponse(BaseModel):
    id: str
    key: str  # Raw key — only shown once!
    name: str
    scopes: list[str]
    agent_id: Optional[str] = None
    created_at: int
    expires_at: Optional[int] = None


class KeyListItem(BaseModel):
    id: str
    key_prefix: str  # Masked key
    name: str
    scopes: list[str]
    agent_id: Optional[str] = None
    created_at: int
    expires_at: Optional[int] = None
    last_used_at: Optional[int] = None
    revoked: bool = False
    is_expired: bool = False


class KeySelfResponse(BaseModel):
    key_id: str
    name: str
    scopes: list[str]
    agent_id: Optional[str] = None
    expires_at: Optional[int] = None


class AuditLogEntry(BaseModel):
    id: int
    key_id: str
    endpoint: str
    method: str
    status_code: int
    ip_addr: Optional[str] = None
    used_at: int


VALID_SCOPES = {"read", "self", "manage", "admin"}
VALID_ENVS = {"live", "test"}


# ── Routes ────────────────────────────────────────────────────────────

@router.post("/keys", response_model=CreateKeyResponse)
async def create_key(
    body: CreateKeyRequest,
    key: APIKeyInfo = Depends(require_scope("admin")),
):
    """
    Create a new API key. Admin only.

    The raw key is returned once — store it securely.
    Default expiration: 90 days.
    """
    # Validate scopes
    invalid = set(body.scopes) - VALID_SCOPES
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid scopes: {invalid}. Valid: {VALID_SCOPES}",
        )

    if not body.scopes:
        raise HTTPException(status_code=400, detail="At least one scope required.")

    # Validate env
    env = body.env if body.env in VALID_ENVS else "live"

    raw_key = generate_api_key(env)
    key_id = f"key_{secrets.token_hex(4)}"
    now = int(time.time() * 1000)
    expires_at = (now + body.expires_in_days * 86400 * 1000) if body.expires_in_days else None

    async with get_db() as db:
        await db.execute(
            """INSERT INTO api_keys
               (id, key_hash, key_prefix, name, scopes, agent_id, created_at, expires_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (key_id, hash_key(raw_key), mask_key(raw_key),
             body.name, json.dumps(body.scopes), body.agent_id, now, expires_at),
        )
        await db.commit()

    logger.info(f"Created API key '{body.name}' (id={key_id}, scopes={body.scopes}, "
                f"expires_at={expires_at})")

    return CreateKeyResponse(
        id=key_id,
        key=raw_key,
        name=body.name,
        scopes=body.scopes,
        agent_id=body.agent_id,
        created_at=now,
        expires_at=expires_at,
    )


@router.get("/keys", response_model=dict)
async def list_keys(
    include_revoked: bool = Query(False, description="Include revoked keys"),
    key: APIKeyInfo = Depends(require_scope("admin")),
):
    """List all API keys (masked). Admin only."""
    now = int(time.time() * 1000)
    async with get_db() as db:
        if include_revoked:
            query = "SELECT * FROM api_keys ORDER BY created_at DESC"
            params: tuple = ()
        else:
            query = "SELECT * FROM api_keys WHERE revoked = 0 ORDER BY created_at DESC"
            params = ()

        async with db.execute(query, params) as cursor:
            rows = await cursor.fetchall()

        items = []
        for row in rows:
            scopes = json.loads(row["scopes"]) if isinstance(row["scopes"], str) else row["scopes"]
            expires_at = row.get("expires_at")
            is_expired = bool(expires_at and now > expires_at)
            items.append(KeyListItem(
                id=row["id"],
                key_prefix=row["key_prefix"],
                name=row["name"],
                scopes=scopes,
                agent_id=row.get("agent_id"),
                created_at=row["created_at"],
                expires_at=expires_at,
                last_used_at=row.get("last_used_at"),
                revoked=bool(row["revoked"]),
                is_expired=is_expired,
            ).model_dump())

        return {"keys": items}


@router.delete("/keys/{key_id}")
async def revoke_key(
    key_id: str,
    key: APIKeyInfo = Depends(require_scope("admin")),
):
    """Revoke an API key. Admin only."""
    # Prevent self-revocation
    if key_id == key.key_id:
        raise HTTPException(status_code=400, detail="Cannot revoke the key you're currently using.")

    async with get_db() as db:
        cursor = await db.execute(
            "UPDATE api_keys SET revoked = 1 WHERE id = ?", (key_id,)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Key not found.")
        await db.commit()

    logger.info(f"Revoked API key {key_id}")
    return {"ok": True, "revoked": key_id}


@router.get("/keys/self", response_model=KeySelfResponse)
async def get_self_key(
    key: APIKeyInfo = Depends(require_scope("read")),
):
    """Show current key's scopes and metadata. Any authenticated user."""
    return KeySelfResponse(
        key_id=key.key_id,
        name=key.name,
        scopes=key.scopes,
        agent_id=key.agent_id,
        expires_at=key.expires_at,
    )


@router.get("/keys/{key_id}/audit")
async def get_key_audit_log(
    key_id: str,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    key: APIKeyInfo = Depends(require_scope("admin")),
):
    """Get audit log for a specific API key. Admin only."""
    async with get_db() as db:
        # Verify key exists
        async with db.execute("SELECT id, name FROM api_keys WHERE id = ?", (key_id,)) as cursor:
            key_row = await cursor.fetchone()
        if not key_row:
            raise HTTPException(status_code=404, detail="Key not found.")

        async with db.execute(
            """SELECT id, key_id, endpoint, method, status_code, ip_addr, used_at
               FROM api_key_audit_log
               WHERE key_id = ?
               ORDER BY used_at DESC
               LIMIT ? OFFSET ?""",
            (key_id, limit, offset),
        ) as cursor:
            rows = await cursor.fetchall()

        async with db.execute(
            "SELECT COUNT(*) as cnt FROM api_key_audit_log WHERE key_id = ?",
            (key_id,)
        ) as cursor:
            total = (await cursor.fetchone())["cnt"]

    entries = [AuditLogEntry(**row).model_dump() for row in rows]
    return {
        "key_id": key_id,
        "key_name": key_row["name"],
        "entries": entries,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.delete("/keys/{key_id}/audit")
async def clear_key_audit_log(
    key_id: str,
    key: APIKeyInfo = Depends(require_scope("admin")),
):
    """Clear audit log for a specific key (admin only)."""
    async with get_db() as db:
        await db.execute(
            "DELETE FROM api_key_audit_log WHERE key_id = ?", (key_id,)
        )
        await db.commit()

    return {"ok": True, "cleared": key_id}


@router.post("/keys/cleanup")
async def trigger_audit_cleanup(
    key: APIKeyInfo = Depends(require_scope("admin")),
):
    """Manually trigger cleanup of expired audit log entries (90-day retention)."""
    await cleanup_audit_log()
    return {"ok": True, "message": "Audit log cleanup triggered."}
