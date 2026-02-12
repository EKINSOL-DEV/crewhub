"""
Agent Persona Tuning + Identity Pattern API routes.

GET  /api/agents/{agent_id}/persona           - Get persona + identity for an agent
PUT  /api/agents/{agent_id}/persona           - Update persona for an agent
PUT  /api/agents/{agent_id}/identity          - Update identity anchor + surface rules
GET  /api/agents/{agent_id}/identity          - Get identity configuration
GET  /api/agents/{agent_id}/surfaces          - Get surface format rules
PUT  /api/agents/{agent_id}/surfaces/{surface} - Set surface format rules
GET  /api/personas/presets                    - List all presets
GET  /api/personas/surfaces                   - List known surfaces + defaults
POST /api/personas/preview                    - Preview persona prompt output
"""

import time
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

import aiosqlite

from app.db.database import DB_PATH
from app.services.personas import (
    PRESETS,
    KNOWN_SURFACES,
    DEFAULT_SURFACE_RULES,
    build_persona_prompt,
    build_identity_block,
    build_full_persona_prompt,
    get_default_persona,
    get_preview_response,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ========================================
# MODELS
# ========================================

class PersonaResponse(BaseModel):
    agent_id: str
    preset: Optional[str] = None
    start_behavior: int = 1
    checkin_frequency: int = 4
    response_detail: int = 2
    approach_style: int = 3
    custom_instructions: str = ""
    identity_anchor: str = ""
    surface_rules: str = ""
    identity_locked: bool = False
    created_at: Optional[int] = None
    updated_at: Optional[int] = None


class PersonaUpdate(BaseModel):
    preset: Optional[str] = None
    start_behavior: int = Field(ge=1, le=5, default=1)
    checkin_frequency: int = Field(ge=1, le=5, default=4)
    response_detail: int = Field(ge=1, le=5, default=2)
    approach_style: int = Field(ge=1, le=5, default=3)
    custom_instructions: str = Field(default="", max_length=2000)


class IdentityUpdate(BaseModel):
    identity_anchor: str = Field(default="", max_length=2000)
    surface_rules: str = Field(default="", max_length=2000)
    identity_locked: bool = False


class SurfaceRuleUpdate(BaseModel):
    format_rules: str = Field(default="", max_length=1000)
    enabled: bool = True


class PreviewRequest(BaseModel):
    prompt: str = "Say Hello World"
    preset: Optional[str] = None
    start_behavior: int = Field(ge=1, le=5, default=1)
    checkin_frequency: int = Field(ge=1, le=5, default=4)
    response_detail: int = Field(ge=1, le=5, default=2)
    approach_style: int = Field(ge=1, le=5, default=3)
    custom_instructions: str = ""
    surface: Optional[str] = None


# ========================================
# ROUTES
# ========================================

@router.get("/agents/{agent_id}/persona", response_model=PersonaResponse)
async def get_agent_persona(agent_id: str):
    """Get the persona + identity configuration for an agent.
    
    Returns the stored persona or defaults (Executor preset) if none configured.
    Includes identity anchor and surface rules from the Identity Pattern.
    """
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # Verify agent exists
        async with db.execute("SELECT id FROM agents WHERE id = ?", (agent_id,)) as cur:
            if not await cur.fetchone():
                raise HTTPException(status_code=404, detail="Agent not found")

        # Get persona
        async with db.execute(
            "SELECT * FROM agent_personas WHERE agent_id = ?", (agent_id,)
        ) as cur:
            row = await cur.fetchone()

        if row:
            # Safely read identity fields (may not exist in older schemas)
            identity_anchor = ""
            surface_rules = ""
            identity_locked = False
            try:
                identity_anchor = row["identity_anchor"] or ""
            except (IndexError, KeyError):
                pass
            try:
                surface_rules = row["surface_rules"] or ""
            except (IndexError, KeyError):
                pass
            try:
                identity_locked = bool(row["identity_locked"])
            except (IndexError, KeyError):
                pass

            return PersonaResponse(
                agent_id=row["agent_id"],
                preset=row["preset"],
                start_behavior=row["start_behavior"],
                checkin_frequency=row["checkin_frequency"],
                response_detail=row["response_detail"],
                approach_style=row["approach_style"],
                custom_instructions=row["custom_instructions"] or "",
                identity_anchor=identity_anchor,
                surface_rules=surface_rules,
                identity_locked=identity_locked,
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            )

        # Return defaults
        defaults = get_default_persona()
        return PersonaResponse(agent_id=agent_id, **defaults)


@router.put("/agents/{agent_id}/persona", response_model=PersonaResponse)
async def update_agent_persona(agent_id: str, body: PersonaUpdate):
    """Update the persona configuration for an agent.
    
    Creates the persona row if it doesn't exist (upsert).
    """
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # Verify agent exists
        async with db.execute("SELECT id FROM agents WHERE id = ?", (agent_id,)) as cur:
            if not await cur.fetchone():
                raise HTTPException(status_code=404, detail="Agent not found")

        # Validate preset if provided
        if body.preset and body.preset not in PRESETS:
            raise HTTPException(status_code=400, detail=f"Unknown preset: {body.preset}")

        now = int(time.time() * 1000)

        await db.execute(
            """INSERT INTO agent_personas 
               (agent_id, preset, start_behavior, checkin_frequency, response_detail, approach_style, custom_instructions, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(agent_id) DO UPDATE SET
                 preset = excluded.preset,
                 start_behavior = excluded.start_behavior,
                 checkin_frequency = excluded.checkin_frequency,
                 response_detail = excluded.response_detail,
                 approach_style = excluded.approach_style,
                 custom_instructions = excluded.custom_instructions,
                 updated_at = excluded.updated_at
            """,
            (
                agent_id,
                body.preset,
                body.start_behavior,
                body.checkin_frequency,
                body.response_detail,
                body.approach_style,
                body.custom_instructions,
                now,
                now,
            ),
        )
        await db.commit()

        return PersonaResponse(
            agent_id=agent_id,
            preset=body.preset,
            start_behavior=body.start_behavior,
            checkin_frequency=body.checkin_frequency,
            response_detail=body.response_detail,
            approach_style=body.approach_style,
            custom_instructions=body.custom_instructions,
            created_at=now,
            updated_at=now,
        )


@router.get("/personas/presets")
async def list_presets():
    """List all available persona presets with their dimension values."""
    return {"presets": PRESETS}


@router.post("/personas/preview")
async def preview_persona(body: PreviewRequest):
    """Preview how a persona configuration translates to a system prompt.
    
    Returns the generated prompt fragment and a sample response.
    If a surface is specified, includes identity + surface format rules.
    """
    prompt_fragment = build_persona_prompt(
        start_behavior=body.start_behavior,
        checkin_frequency=body.checkin_frequency,
        response_detail=body.response_detail,
        approach_style=body.approach_style,
        custom_instructions=body.custom_instructions,
    )

    # If surface specified, also show identity block
    identity_block = ""
    if body.surface:
        identity_block = build_identity_block(
            current_surface=body.surface,
        )

    # Get preview response (use preset if provided, else nearest match)
    preset_key = body.preset or "executor"
    sample_response = get_preview_response(preset_key, body.prompt)

    return {
        "system_prompt_fragment": prompt_fragment,
        "identity_block": identity_block,
        "sample_response": sample_response,
        "preset_used": preset_key,
    }


# ========================================
# IDENTITY PATTERN ROUTES
# ========================================

@router.get("/agents/{agent_id}/identity")
async def get_agent_identity(agent_id: str):
    """Get the identity configuration for an agent.
    
    Returns identity anchor, surface rules, and lock status.
    """
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # Verify agent exists and get name
        async with db.execute("SELECT id, name FROM agents WHERE id = ?", (agent_id,)) as cur:
            agent = await cur.fetchone()
            if not agent:
                raise HTTPException(status_code=404, detail="Agent not found")

        # Get persona (identity is stored there)
        async with db.execute(
            "SELECT identity_anchor, surface_rules, identity_locked FROM agent_personas WHERE agent_id = ?",
            (agent_id,)
        ) as cur:
            row = await cur.fetchone()

        identity_anchor = ""
        surface_rules = ""
        identity_locked = False
        if row:
            try:
                identity_anchor = row["identity_anchor"] or ""
            except (IndexError, KeyError):
                pass
            try:
                surface_rules = row["surface_rules"] or ""
            except (IndexError, KeyError):
                pass
            try:
                identity_locked = bool(row["identity_locked"])
            except (IndexError, KeyError):
                pass

        # Get per-surface rules
        surfaces = []
        try:
            async with db.execute(
                "SELECT surface, format_rules, enabled FROM agent_surfaces WHERE agent_id = ? ORDER BY surface",
                (agent_id,)
            ) as cur:
                async for srow in cur:
                    surfaces.append({
                        "surface": srow["surface"],
                        "format_rules": srow["format_rules"] or "",
                        "enabled": bool(srow["enabled"]),
                    })
        except Exception:
            pass  # Table may not exist yet

        return {
            "agent_id": agent_id,
            "agent_name": agent["name"],
            "identity_anchor": identity_anchor,
            "surface_rules": surface_rules,
            "identity_locked": identity_locked,
            "surfaces": surfaces,
        }


@router.put("/agents/{agent_id}/identity")
async def update_agent_identity(agent_id: str, body: IdentityUpdate):
    """Update the identity anchor and surface rules for an agent.
    
    Creates the persona row if it doesn't exist (upsert on identity fields).
    """
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # Verify agent exists
        async with db.execute("SELECT id FROM agents WHERE id = ?", (agent_id,)) as cur:
            if not await cur.fetchone():
                raise HTTPException(status_code=404, detail="Agent not found")

        now = int(time.time() * 1000)

        # Check if persona row exists
        async with db.execute(
            "SELECT agent_id FROM agent_personas WHERE agent_id = ?", (agent_id,)
        ) as cur:
            exists = await cur.fetchone()

        if exists:
            await db.execute(
                """UPDATE agent_personas 
                   SET identity_anchor = ?, surface_rules = ?, identity_locked = ?, updated_at = ?
                   WHERE agent_id = ?""",
                (body.identity_anchor, body.surface_rules, body.identity_locked, now, agent_id),
            )
        else:
            # Create with defaults + identity
            defaults = get_default_persona()
            await db.execute(
                """INSERT INTO agent_personas 
                   (agent_id, preset, start_behavior, checkin_frequency, response_detail, approach_style,
                    custom_instructions, identity_anchor, surface_rules, identity_locked, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?)""",
                (
                    agent_id,
                    defaults["preset"],
                    defaults["start_behavior"],
                    defaults["checkin_frequency"],
                    defaults["response_detail"],
                    defaults["approach_style"],
                    body.identity_anchor,
                    body.surface_rules,
                    body.identity_locked,
                    now,
                    now,
                ),
            )

        await db.commit()

        return {
            "agent_id": agent_id,
            "identity_anchor": body.identity_anchor,
            "surface_rules": body.surface_rules,
            "identity_locked": body.identity_locked,
            "updated_at": now,
        }


@router.get("/agents/{agent_id}/surfaces")
async def get_agent_surfaces(agent_id: str):
    """Get per-surface format rules for an agent.
    
    Returns configured surfaces with their rules, plus defaults for unconfigured surfaces.
    """
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # Verify agent exists
        async with db.execute("SELECT id FROM agents WHERE id = ?", (agent_id,)) as cur:
            if not await cur.fetchone():
                raise HTTPException(status_code=404, detail="Agent not found")

        # Get configured surfaces
        configured = {}
        try:
            async with db.execute(
                "SELECT surface, format_rules, enabled FROM agent_surfaces WHERE agent_id = ?",
                (agent_id,)
            ) as cur:
                async for row in cur:
                    configured[row["surface"]] = {
                        "format_rules": row["format_rules"] or "",
                        "enabled": bool(row["enabled"]),
                        "is_custom": True,
                    }
        except Exception:
            pass

        # Build full surface list with defaults
        surfaces = []
        for surface in KNOWN_SURFACES:
            if surface in configured:
                surfaces.append({
                    "surface": surface,
                    "default_rules": DEFAULT_SURFACE_RULES.get(surface, ""),
                    **configured[surface],
                })
            else:
                surfaces.append({
                    "surface": surface,
                    "format_rules": DEFAULT_SURFACE_RULES.get(surface, ""),
                    "enabled": True,
                    "is_custom": False,
                    "default_rules": DEFAULT_SURFACE_RULES.get(surface, ""),
                })

        return {"agent_id": agent_id, "surfaces": surfaces}


@router.put("/agents/{agent_id}/surfaces/{surface}")
async def update_agent_surface(agent_id: str, surface: str, body: SurfaceRuleUpdate):
    """Set custom format rules for a specific surface.
    
    Creates or updates the surface rule entry.
    """
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # Verify agent exists
        async with db.execute("SELECT id FROM agents WHERE id = ?", (agent_id,)) as cur:
            if not await cur.fetchone():
                raise HTTPException(status_code=404, detail="Agent not found")

        now = int(time.time() * 1000)

        await db.execute(
            """INSERT INTO agent_surfaces (agent_id, surface, format_rules, enabled, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(agent_id, surface) DO UPDATE SET
                 format_rules = excluded.format_rules,
                 enabled = excluded.enabled,
                 updated_at = excluded.updated_at""",
            (agent_id, surface, body.format_rules, body.enabled, now, now),
        )
        await db.commit()

        return {
            "agent_id": agent_id,
            "surface": surface,
            "format_rules": body.format_rules,
            "enabled": body.enabled,
            "updated_at": now,
        }


@router.delete("/agents/{agent_id}/surfaces/{surface}")
async def delete_agent_surface(agent_id: str, surface: str):
    """Remove a custom surface rule (reverts to default)."""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "DELETE FROM agent_surfaces WHERE agent_id = ? AND surface = ?",
            (agent_id, surface),
        )
        await db.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Surface rule not found")

    return {"status": "deleted", "agent_id": agent_id, "surface": surface}


@router.get("/personas/surfaces")
async def list_known_surfaces():
    """List all known surfaces with their default format rules."""
    return {
        "surfaces": [
            {"surface": s, "default_rules": DEFAULT_SURFACE_RULES.get(s, "")}
            for s in KNOWN_SURFACES
        ]
    }
