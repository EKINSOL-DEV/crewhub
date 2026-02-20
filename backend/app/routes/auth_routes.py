"""
/api/auth/* endpoints for API key management.

Admin-only endpoints for creating, listing, and revoking API keys.
Phase 1 of Agent Onboarding Masterplan.
"""

import json
import logging
import secrets
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import (
    APIKeyInfo,
    generate_api_key,
    hash_key,
    require_scope,
)
from app.db.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Models ────────────────────────────────────────────────────────────

class CreateKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    scopes: list[str] = Field(default=["read", "self"])
    agent_id: Optional[str] = Field(None, max_length=128,
                                     description="Bind key to specific agent_id")


class CreateKeyResponse(BaseModel):
    id: str
    key: str  # Raw key — only shown once!
    name: str
    scopes: list[str]
    agent_id: Optional[str] = None
    created_at: int


class KeyListItem(BaseModel):
    id: str
    key_prefix: str  # Masked key
    name: str
    scopes: list[str]
    agent_id: Optional[str] = None
    created_at: int
    last_used_at: Optional[int] = None
    revoked: bool = False


class KeySelfResponse(BaseModel):
    key_id: str
    name: str
    scopes: list[str]
    agent_id: Optional[str] = None


VALID_SCOPES = {"read", "self", "manage", "admin"}


# ── Routes ────────────────────────────────────────────────────────────

@router.post("/keys", response_model=CreateKeyResponse)
async def create_key(
    body: CreateKeyRequest,
    key: APIKeyInfo = Depends(require_scope("admin")),
):
    """
    Create a new API key. Admin only.
    
    The raw key is returned once — store it securely.
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

    # Determine scope hint for key format
    if "admin" in body.scopes:
        hint = "admin"
    elif "manage" in body.scopes:
        hint = "manage"
    elif "self" in body.scopes:
        hint = "self"
    else:
        hint = "read"

    raw_key = generate_api_key(hint)
    key_id = f"key_{secrets.token_hex(4)}"
    now = int(time.time() * 1000)

    async with get_db() as db:
        await db.execute(
            """INSERT INTO api_keys (id, key_hash, key_prefix, name, scopes, agent_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (key_id, hash_key(raw_key), raw_key[:16] + "...",
             body.name, json.dumps(body.scopes), body.agent_id, now),
        )
        await db.commit()

    logger.info(f"Created API key '{body.name}' (id={key_id}, scopes={body.scopes})")

    return CreateKeyResponse(
        id=key_id,
        key=raw_key,
        name=body.name,
        scopes=body.scopes,
        agent_id=body.agent_id,
        created_at=now,
    )


@router.get("/keys", response_model=dict)
async def list_keys(
    key: APIKeyInfo = Depends(require_scope("admin")),
):
    """List all API keys (masked). Admin only."""
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM api_keys ORDER BY created_at DESC"
        ) as cursor:
            rows = await cursor.fetchall()

        items = []
        for row in rows:
            scopes = json.loads(row["scopes"]) if isinstance(row["scopes"], str) else row["scopes"]
            items.append(KeyListItem(
                id=row["id"],
                key_prefix=row["key_prefix"],
                name=row["name"],
                scopes=scopes,
                agent_id=row["agent_id"],
                created_at=row["created_at"],
                last_used_at=row["last_used_at"],
                revoked=bool(row["revoked"]),
            ).model_dump())

        return {"keys": items}


@router.delete("/keys/{key_id}")
async def revoke_key(
    key_id: str,
    key: APIKeyInfo = Depends(require_scope("admin")),
):
    """Revoke an API key. Admin only."""
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
    )
