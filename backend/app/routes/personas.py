"""
Agent Persona Tuning API routes.

GET  /api/agents/{agent_id}/persona   - Get persona for an agent
PUT  /api/agents/{agent_id}/persona   - Update persona for an agent
GET  /api/personas/presets            - List all presets
POST /api/personas/preview            - Preview persona prompt output
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
    build_persona_prompt,
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
    created_at: Optional[int] = None
    updated_at: Optional[int] = None


class PersonaUpdate(BaseModel):
    preset: Optional[str] = None
    start_behavior: int = Field(ge=1, le=5, default=1)
    checkin_frequency: int = Field(ge=1, le=5, default=4)
    response_detail: int = Field(ge=1, le=5, default=2)
    approach_style: int = Field(ge=1, le=5, default=3)
    custom_instructions: str = Field(default="", max_length=2000)


class PreviewRequest(BaseModel):
    prompt: str = "Say Hello World"
    preset: Optional[str] = None
    start_behavior: int = Field(ge=1, le=5, default=1)
    checkin_frequency: int = Field(ge=1, le=5, default=4)
    response_detail: int = Field(ge=1, le=5, default=2)
    approach_style: int = Field(ge=1, le=5, default=3)
    custom_instructions: str = ""


# ========================================
# ROUTES
# ========================================

@router.get("/agents/{agent_id}/persona", response_model=PersonaResponse)
async def get_agent_persona(agent_id: str):
    """Get the persona configuration for an agent.
    
    Returns the stored persona or defaults (Executor preset) if none configured.
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
            return PersonaResponse(
                agent_id=row["agent_id"],
                preset=row["preset"],
                start_behavior=row["start_behavior"],
                checkin_frequency=row["checkin_frequency"],
                response_detail=row["response_detail"],
                approach_style=row["approach_style"],
                custom_instructions=row["custom_instructions"] or "",
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
    """
    prompt_fragment = build_persona_prompt(
        start_behavior=body.start_behavior,
        checkin_frequency=body.checkin_frequency,
        response_detail=body.response_detail,
        approach_style=body.approach_style,
        custom_instructions=body.custom_instructions,
    )

    # Get preview response (use preset if provided, else nearest match)
    preset_key = body.preset or "executor"
    sample_response = get_preview_response(preset_key, body.prompt)

    return {
        "system_prompt_fragment": prompt_fragment,
        "sample_response": sample_response,
        "preset_used": preset_key,
    }
