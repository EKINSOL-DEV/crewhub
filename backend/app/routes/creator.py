"""Creator Zone routes — AI prop generation endpoints.

HTTP layer only: request parsing, validation, response formatting.
All generation logic lives in app.services.creator.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..services.creator import (
    AVAILABLE_MODELS,
    DEFAULT_MODEL,
    add_generation_record,
    extract_parts,
    generate_template_code,
    load_generation_history,
    load_prompt_template,
    load_saved_props,
    parse_ai_parts,
    prompt_to_filename,
    resolve_model,
    save_generation_history,
    save_props_to_disk,
    strip_parts_block,
    stream_prop_generation,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/creator", tags=["creator"])

# ─── Showcase Props ───────────────────────────────────────────────
SHOWCASE_PROPS_DIR = Path(__file__).parent.parent.parent / "data" / "showcase_props"


# ─── Pydantic Models ─────────────────────────────────────────────


class PropPart(BaseModel):
    type: str  # "box", "cylinder", "sphere", "cone", "torus"
    position: list[float]  # [x, y, z]
    rotation: list[float] = [0, 0, 0]  # [x, y, z] radians
    args: list[float]
    color: str
    emissive: bool = False


class GeneratePropRequest(BaseModel):
    prompt: str
    use_ai: bool = True
    model: str = DEFAULT_MODEL


class GeneratePropResponse(BaseModel):
    name: str
    filename: str
    code: str
    method: str  # "ai" or "template"
    parts: list[PropPart] = []


class PropRefinementRequest(BaseModel):
    propId: str
    changes: dict = {}  # colorChanges, addComponents, animation, material


class PropRefinementResponse(BaseModel):
    propId: str
    code: str
    parts: list[PropPart] = []
    diagnostics: list[str] = []
    refinementOptions: dict = {}


class SavePropRequest(BaseModel):
    name: str
    propId: str
    code: str = ""
    parts: list[PropPart] = []
    mountType: str = "floor"
    yOffset: float = 0.16


class SavedPropResponse(BaseModel):
    propId: str
    name: str
    parts: list[PropPart] = []
    mountType: str = "floor"
    yOffset: float = 0.16
    createdAt: str = ""


class GenerationRecord(BaseModel):
    id: str
    prompt: str
    name: str
    model: str
    modelLabel: str
    method: str
    fullPrompt: str = ""
    toolCalls: list[dict] = []
    corrections: list[str] = []
    diagnostics: list[str] = []
    parts: list[PropPart] = []
    code: str = ""
    createdAt: str = ""
    error: Optional[str] = None


# ─── Phase 3 request models ───────────────────────────────────────


class IteratePropRequest(BaseModel):
    code: str
    feedback: str
    componentName: str = "CustomProp"


class StyleTransferRequest(BaseModel):
    code: str
    styleSource: str
    componentName: str = "CustomProp"


class HybridGenerateRequest(BaseModel):
    prompt: str
    templateBase: Optional[str] = None
    model: str = DEFAULT_MODEL


class CrossbreedRequest(BaseModel):
    parentACode: str
    parentBCode: str
    parentAName: str = "ParentA"
    parentBName: str = "ParentB"
    componentName: str = "HybridProp"
    traits: list[str] = []


class QualityScoreRequest(BaseModel):
    code: str


# ─── Routes ──────────────────────────────────────────────────────


@router.get("/models")
async def list_models():
    """List available AI models for prop generation."""
    return {
        "models": [{"key": k, **v} for k, v in AVAILABLE_MODELS.items()],
        "default": DEFAULT_MODEL,
    }


@router.get("/generate-prop-stream")
async def generate_prop_stream(
    request: Request,
    prompt: str = Query(..., min_length=1),
    model: str = Query(DEFAULT_MODEL),
):
    """SSE endpoint for streaming prop generation with model choice."""
    name, _filename = prompt_to_filename(prompt.strip())
    return StreamingResponse(
        stream_prop_generation(request, prompt.strip(), name, model),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/generate-prop", response_model=GeneratePropResponse)
async def generate_prop(req: GeneratePropRequest):
    """Generate a 3D prop (non-streaming). Tries AI first, falls back to template."""
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    name, filename = prompt_to_filename(req.prompt)
    _model_id, _model_label = resolve_model(req.model)

    method = "template"
    code = None
    ai_parts = None

    if req.use_ai:
        template = load_prompt_template()
        if template:
            full_prompt = (
                f"{template}\n\n"
                f"Generate a prop for: {req.prompt}\n"
                f"Component name: `{name}`. Output ONLY the code followed by the PARTS_DATA block."
            )
            try:
                from ..services.connections import get_connection_manager, OpenClawConnection
                manager = await get_connection_manager()
                conn = None
                for c in manager.get_connections().values():
                    if isinstance(c, OpenClawConnection) and c.is_connected():
                        conn = c
                        break
                if conn:
                    raw = await conn.send_chat(
                        message=full_prompt,
                        agent_id="dev",
                        timeout=120.0,
                    )
                    if raw:
                        raw = raw.strip()
                        raw = re.sub(r"^```\w*\n", "", raw)
                        raw = re.sub(r"\n```\s*$", "", raw)
                        ai_parts = parse_ai_parts(raw)
                        code = strip_parts_block(raw)
                        if "export function" in code and "<mesh" in code:
                            from ..services.prop_post_processor import enhance_generated_prop
                            pp_result = enhance_generated_prop(code)
                            code = pp_result.code
                            method = "ai"
                        else:
                            code = None
            except Exception as e:
                logger.warning(f"AI generation error: {e}")

    if not code:
        code = generate_template_code(name, req.prompt)
        method = "template"

    parts = ai_parts if ai_parts else extract_parts(req.prompt)

    return GeneratePropResponse(
        name=name,
        filename=filename,
        code=code,
        method=method,
        parts=[PropPart(**p) for p in parts],
    )


@router.get("/generation-history")
async def get_generation_history(limit: int = Query(50, ge=1, le=100)):
    """Get generation history with full metadata."""
    history = load_generation_history()[:limit]
    return {"records": history}


@router.get("/generation-history/{gen_id}")
async def get_generation_record(gen_id: str):
    """Get a specific generation record by ID."""
    for record in load_generation_history():
        if record.get("id") == gen_id:
            return record
    raise HTTPException(status_code=404, detail="Generation record not found")


@router.post("/save-prop", response_model=SavedPropResponse)
async def save_prop(req: SavePropRequest):
    props = load_saved_props()
    props = [p for p in props if p["propId"] != req.propId]

    entry = {
        "propId": req.propId,
        "name": req.name,
        "parts": [p.model_dump() for p in req.parts],
        "mountType": req.mountType,
        "yOffset": req.yOffset,
        "createdAt": datetime.utcnow().isoformat(),
    }
    props.append(entry)
    save_props_to_disk(props)
    return SavedPropResponse(**entry)


@router.get("/saved-props", response_model=list[SavedPropResponse])
async def list_saved_props():
    return [SavedPropResponse(**p) for p in load_saved_props()]


# ─── Showcase Props Library ───────────────────────────────────────


@router.get("/showcase-props")
async def list_showcase_props():
    """List showcase props as high-quality examples."""
    props = []
    if SHOWCASE_PROPS_DIR.exists():
        for f in sorted(SHOWCASE_PROPS_DIR.glob("*.tsx")):
            name = f.stem
            code = f.read_text()
            props.append({
                "name": name,
                "filename": f.name,
                "code": code,
                "isShowcase": True,
                "meshCount": len(re.findall(r"<mesh\b", code)),
                "hasAnimation": "useFrame" in code,
                "hasEmissive": "emissive=" in code,
            })
    return {"props": props, "count": len(props)}


@router.get("/showcase-props/{name}")
async def get_showcase_prop(name: str):
    """Get a specific showcase prop by name."""
    path = SHOWCASE_PROPS_DIR / f"{name}.tsx"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Showcase prop '{name}' not found")
    code = path.read_text()
    return {"name": name, "filename": path.name, "code": code, "isShowcase": True}


@router.delete("/saved-props/{prop_id}")
async def delete_saved_prop(prop_id: str):
    props = load_saved_props()
    new_props = [p for p in props if p["propId"] != prop_id]
    if len(new_props) == len(props):
        raise HTTPException(status_code=404, detail="Prop not found")
    save_props_to_disk(new_props)
    return {"status": "deleted", "propId": prop_id}


# ─── Phase 2: Multi-Pass & Refinement ────────────────────────────


@router.post("/props/refine", response_model=PropRefinementResponse)
async def refine_prop(req: PropRefinementRequest):
    """Apply user refinements to a generated prop."""
    from ..services.multi_pass_generator import MultiPassGenerator

    history = load_generation_history()
    record = None
    for r in history:
        if r.get("id") == req.propId:
            record = r
            break

    if not record or not record.get("code"):
        raise HTTPException(status_code=404, detail="Prop not found or has no code")

    generator = MultiPassGenerator()
    refined_code, diagnostics = generator.apply_refinement(record["code"], req.changes)
    options = generator.get_refinement_options(record.get("prompt", ""))

    # Apply color changes to parts
    parts = record.get("parts", [])
    color_changes = req.changes.get("colorChanges", {})
    if color_changes and parts:
        updated_parts = []
        for part in parts:
            p = dict(part)
            for old_c, new_c in color_changes.items():
                if p.get("color", "").lower() == old_c.lower():
                    p["color"] = new_c
                    break
            updated_parts.append(p)
        parts = updated_parts

    # Persist updated state
    history = load_generation_history()
    for r in history:
        if r.get("id") == req.propId:
            r["code"] = refined_code
            r["parts"] = parts
            break
    save_generation_history(history)

    return PropRefinementResponse(
        propId=req.propId,
        code=refined_code,
        parts=[PropPart(**p) for p in parts],
        diagnostics=diagnostics,
        refinementOptions=options,
    )


@router.get("/props/refinement-options")
async def get_refinement_options(prompt: str = Query("", min_length=0)):
    """Get available refinement options for a prop description."""
    from ..services.multi_pass_generator import MultiPassGenerator
    return MultiPassGenerator().get_refinement_options(prompt)


# ─── Phase 3: Advanced Features ──────────────────────────────────


@router.post("/props/iterate")
async def iterate_prop(req: IteratePropRequest):
    """Iterate on a prop with natural language feedback."""
    from ..services.prop_iterator import PropIterator
    from ..services.prop_quality_scorer import QualityScorer

    try:
        iterator = PropIterator()
        improved_code, feedback_type = await iterator.iterate_prop(
            original_code=req.code,
            feedback=req.feedback,
            component_name=req.componentName,
        )
        score = QualityScorer().score_prop(improved_code)
        return {"code": improved_code, "feedbackType": feedback_type, "qualityScore": score.to_dict()}
    except Exception as e:
        logger.error(f"Iteration failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/props/style-transfer")
async def apply_style_transfer(req: StyleTransferRequest):
    """Apply a showcase style to a generated prop."""
    from ..services.style_transfer import StyleTransfer
    from ..services.prop_quality_scorer import QualityScorer

    try:
        styled_code = await StyleTransfer().apply_style(
            generated_code=req.code,
            style_source=req.styleSource,
            component_name=req.componentName,
        )
        score = QualityScorer().score_prop(styled_code)
        return {"code": styled_code, "styleSource": req.styleSource, "qualityScore": score.to_dict()}
    except Exception as e:
        logger.error(f"Style transfer failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/props/styles")
async def list_styles():
    """List available styles for transfer."""
    from ..services.style_transfer import get_available_styles
    return {"styles": get_available_styles()}


@router.post("/props/hybrid-generate")
async def hybrid_generate(req: HybridGenerateRequest):
    """Generate a prop using hybrid AI + template approach."""
    from ..services.hybrid_generator import HybridGenerator
    from ..services.prop_quality_scorer import QualityScorer

    name, filename = prompt_to_filename(req.prompt.strip())
    try:
        generator = HybridGenerator()
        code = await generator.generate_hybrid(
            description=req.prompt,
            component_name=name,
            template_base=req.templateBase,
        )
        score = QualityScorer().score_prop(code)
        ai_parts = parse_ai_parts(code)
        clean_code = strip_parts_block(code)
        parts = ai_parts if ai_parts else extract_parts(req.prompt)

        gen_id = __import__("uuid").uuid4().hex[:8]
        add_generation_record({
            "id": gen_id, "prompt": req.prompt, "name": name,
            "model": req.model, "modelLabel": "Hybrid",
            "method": "hybrid" if req.templateBase else "ai-enhanced",
            "fullPrompt": "", "toolCalls": [], "corrections": [],
            "diagnostics": [f"Template: {req.templateBase or 'none'}"],
            "parts": parts, "code": clean_code,
            "createdAt": datetime.utcnow().isoformat(), "error": None,
        })

        return {
            "name": name, "filename": filename, "code": clean_code,
            "method": "hybrid" if req.templateBase else "ai-enhanced",
            "parts": parts, "qualityScore": score.to_dict(), "generationId": gen_id,
        }
    except Exception as e:
        logger.error(f"Hybrid generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/props/templates")
async def list_templates():
    """List available template bases for hybrid generation."""
    from ..services.hybrid_generator import HybridGenerator
    return {"templates": HybridGenerator().get_templates()}


@router.post("/props/crossbreed")
async def crossbreed_props(req: CrossbreedRequest):
    """Crossbreed two props to create a hybrid offspring."""
    from ..services.prop_genetics import PropGenetics
    from ..services.prop_quality_scorer import QualityScorer

    try:
        genetics = PropGenetics()
        offspring_code = await genetics.crossbreed(
            parent_a_code=req.parentACode,
            parent_b_code=req.parentBCode,
            parent_a_name=req.parentAName,
            parent_b_name=req.parentBName,
            component_name=req.componentName,
            traits=req.traits,
        )
        score = QualityScorer().score_prop(offspring_code)
        ai_parts = parse_ai_parts(offspring_code)
        clean_code = strip_parts_block(offspring_code)
        return {
            "code": clean_code, "name": req.componentName, "parts": ai_parts or [],
            "qualityScore": score.to_dict(), "parents": [req.parentAName, req.parentBName],
        }
    except Exception as e:
        logger.error(f"Crossbreeding failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/props/quality-score")
async def score_prop_quality(req: QualityScoreRequest):
    """Score prop code quality objectively."""
    from ..services.prop_quality_scorer import QualityScorer
    return QualityScorer().score_prop(req.code).to_dict()


# ─── Prop Delete with Cascade Warning ────────────────────────────


async def _find_prop_usage_in_blueprints(prop_name: str) -> list[dict]:
    """Find all blueprint/room placements that reference a prop by name."""
    from ..db.database import get_db

    placements = []
    try:
        async with get_db() as db:
            cursor = await db.execute(
                "SELECT id, name, room_id, blueprint_json FROM custom_blueprints"
            )
            rows = await cursor.fetchall()
            for row in rows:
                bp_json = row["blueprint_json"]
                if isinstance(bp_json, str):
                    bp_json = json.loads(bp_json)
                instances = [p for p in bp_json.get("placements", []) if p.get("propId") == prop_name]
                if instances:
                    placements.append({
                        "blueprintId": row["id"],
                        "blueprintName": row["name"],
                        "roomId": row["room_id"],
                        "instanceCount": len(instances),
                    })
    except Exception as e:
        logger.error(f"Error checking prop usage in blueprints: {e}")
    return placements


@router.get("/generation-history/{gen_id}/usage")
async def get_prop_usage(gen_id: str):
    """Check where a generated prop is used (in blueprints/rooms)."""
    record = next((r for r in load_generation_history() if r.get("id") == gen_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="Generation record not found")

    prop_name = record.get("name", "")
    placements = await _find_prop_usage_in_blueprints(prop_name)
    return {
        "propId": gen_id,
        "propName": prop_name,
        "canDelete": True,
        "placements": placements,
        "totalInstances": sum(p["instanceCount"] for p in placements),
    }


@router.delete("/generation-history/{gen_id}")
async def delete_generation_record(gen_id: str, cascade: bool = Query(False)):
    """Delete a generation history record, optionally cascading to blueprint placements."""
    from ..db.database import get_db

    history = load_generation_history()
    record = None
    record_idx = None
    for i, r in enumerate(history):
        if r.get("id") == gen_id:
            record = r
            record_idx = i
            break

    if record is None:
        raise HTTPException(status_code=404, detail="Generation record not found")

    prop_name = record.get("name", "")
    deleted_from_rooms: list[str] = []
    total_instances_removed = 0

    placements = await _find_prop_usage_in_blueprints(prop_name)

    if placements and not cascade:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Prop is used in rooms. Use cascade=true to delete anyway.",
                "placements": placements,
                "totalInstances": sum(p["instanceCount"] for p in placements),
            },
        )

    if placements and cascade:
        try:
            async with get_db() as db:
                for placement in placements:
                    cursor = await db.execute(
                        "SELECT id, blueprint_json FROM custom_blueprints WHERE id = ?",
                        (placement["blueprintId"],),
                    )
                    row = await cursor.fetchone()
                    if not row:
                        continue
                    bp_json = row["blueprint_json"]
                    if isinstance(bp_json, str):
                        bp_json = json.loads(bp_json)

                    original_count = len(bp_json.get("placements", []))
                    bp_json["placements"] = [
                        p for p in bp_json.get("placements", [])
                        if p.get("propId") != prop_name
                    ]
                    removed = original_count - len(bp_json["placements"])
                    total_instances_removed += removed
                    deleted_from_rooms.append(placement.get("blueprintName", placement["blueprintId"]))

                    await db.execute(
                        "UPDATE custom_blueprints SET blueprint_json = ? WHERE id = ?",
                        (json.dumps(bp_json), placement["blueprintId"]),
                    )
                await db.commit()
        except Exception as e:
            logger.error(f"Error cascading prop delete to blueprints: {e}")
            raise HTTPException(status_code=500, detail=f"Cascade delete failed: {e}")

    history.pop(record_idx)
    save_generation_history(history)

    saved = load_saved_props()
    new_saved = [p for p in saved if p.get("propId") != record.get("name")]
    if len(new_saved) != len(saved):
        save_props_to_disk(new_saved)

    logger.info(
        f"Deleted prop '{prop_name}' (gen_id={gen_id}), cascade={cascade}, "
        f"rooms_affected={len(deleted_from_rooms)}"
    )

    return {
        "success": True,
        "propId": gen_id,
        "propName": prop_name,
        "deleted_from_rooms": deleted_from_rooms,
        "total_instances_removed": total_instances_removed,
    }
