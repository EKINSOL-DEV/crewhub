"""Creator Zone routes — AI prop generation endpoints.

HTTP layer only: request parsing, validation, response formatting.
All generation logic lives in app.services.creator.
Pydantic models live in .creator_models.
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from ..services.creator import (
    AVAILABLE_MODELS,
    DEFAULT_MODEL,
    add_generation_record,
    apply_color_changes_to_parts,
    cascade_delete_prop_from_blueprints,
    extract_parts,
    find_prop_usage_in_blueprints,
    generate_prop_via_ai,
    generate_template_code,
    load_generation_history,
    load_saved_props,
    parse_ai_parts,
    persist_refined_prop,
    prompt_to_filename,
    resolve_model,
    save_generation_history,
    save_props_to_disk,
    stream_prop_generation,
    strip_parts_block,
)
from .creator_models import (
    CrossbreedRequest,
    GeneratePropRequest,
    GeneratePropResponse,
    HybridGenerateRequest,
    IteratePropRequest,
    PropPart,
    PropRefinementRequest,
    PropRefinementResponse,
    QualityScoreRequest,
    SavedPropResponse,
    SavePropRequest,
    StyleTransferRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/creator", tags=["creator"])

SHOWCASE_PROPS_DIR = Path(__file__).parent.parent.parent / "data" / "showcase_props"


# ─── Models / Info ────────────────────────────────────────────────


@router.get("/models")
async def list_models():
    """List available AI models for prop generation."""
    return {"models": [{"key": k, **v} for k, v in AVAILABLE_MODELS.items()], "default": DEFAULT_MODEL}


# ─── Generation ───────────────────────────────────────────────────


@router.get("/generate-prop-stream")
async def generate_prop_stream(
    request: Request,
    prompt: str = Query(..., min_length=1),
    model: str = Query(DEFAULT_MODEL),
):
    """SSE endpoint for streaming prop generation."""
    name, _filename = prompt_to_filename(prompt.strip())
    return StreamingResponse(
        stream_prop_generation(request, prompt.strip(), name, model),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.post("/generate-prop", response_model=GeneratePropResponse)
async def generate_prop(req: GeneratePropRequest):
    """Generate a 3D prop (non-streaming). Tries AI first, falls back to template."""
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    name, filename = prompt_to_filename(req.prompt)
    resolve_model(req.model)

    code, ai_parts, method = None, [], "template"
    if req.use_ai:
        code, ai_parts, method = await generate_prop_via_ai(req.prompt.strip(), name, req.model)

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


# ─── Generation History ───────────────────────────────────────────


@router.get("/generation-history")
async def get_generation_history(limit: int = Query(50, ge=1, le=100)):
    return {"records": load_generation_history()[:limit]}


@router.get("/generation-history/{gen_id}/usage")
async def get_prop_usage(gen_id: str):
    """Check where a generated prop is used in blueprints/rooms."""
    record = next((r for r in load_generation_history() if r.get("id") == gen_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="Generation record not found")
    prop_name = record.get("name", "")
    placements = await find_prop_usage_in_blueprints(prop_name)
    return {
        "propId": gen_id,
        "propName": prop_name,
        "canDelete": True,
        "placements": placements,
        "totalInstances": sum(p["instanceCount"] for p in placements),
    }


@router.get("/generation-history/{gen_id}")
async def get_generation_record(gen_id: str):
    record = next((r for r in load_generation_history() if r.get("id") == gen_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="Generation record not found")
    return record


@router.delete("/generation-history/{gen_id}")
async def delete_generation_record(gen_id: str, cascade: bool = Query(False)):
    """Delete a generation history record, optionally cascading to blueprint placements."""
    history = load_generation_history()
    record_idx = next((i for i, r in enumerate(history) if r.get("id") == gen_id), None)
    if record_idx is None:
        raise HTTPException(status_code=404, detail="Generation record not found")

    record = history[record_idx]
    prop_name = record.get("name", "")
    placements = await find_prop_usage_in_blueprints(prop_name)

    if placements and not cascade:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Prop is used in rooms. Use cascade=true to delete anyway.",
                "placements": placements,
                "totalInstances": sum(p["instanceCount"] for p in placements),
            },
        )

    deleted_rooms, total_removed = [], 0
    if placements and cascade:
        try:
            deleted_rooms, total_removed = await cascade_delete_prop_from_blueprints(placements, prop_name)
        except Exception as exc:
            logger.error(f"Cascade delete failed: {exc}")
            raise HTTPException(status_code=500, detail=f"Cascade delete failed: {exc}")

    history.pop(record_idx)
    save_generation_history(history)

    saved = load_saved_props()
    new_saved = [p for p in saved if p.get("propId") != prop_name]
    if len(new_saved) != len(saved):
        save_props_to_disk(new_saved)

    logger.info(f"Deleted prop '{prop_name}' (gen_id={gen_id}), cascade={cascade}, rooms={len(deleted_rooms)}")
    return {
        "success": True,
        "propId": gen_id,
        "propName": prop_name,
        "deleted_from_rooms": deleted_rooms,
        "total_instances_removed": total_removed,
    }


# ─── Saved Props ──────────────────────────────────────────────────


@router.post("/save-prop", response_model=SavedPropResponse)
async def save_prop(req: SavePropRequest):
    props = [p for p in load_saved_props() if p["propId"] != req.propId]
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


@router.delete("/saved-props/{prop_id}")
async def delete_saved_prop(prop_id: str):
    props = load_saved_props()
    new_props = [p for p in props if p["propId"] != prop_id]
    if len(new_props) == len(props):
        raise HTTPException(status_code=404, detail="Prop not found")
    save_props_to_disk(new_props)
    return {"status": "deleted", "propId": prop_id}


# ─── Showcase Props Library ───────────────────────────────────────


@router.get("/showcase-props")
async def list_showcase_props():
    props = []
    if SHOWCASE_PROPS_DIR.exists():
        for f in sorted(SHOWCASE_PROPS_DIR.glob("*.tsx")):
            code = f.read_text()
            props.append(
                {
                    "name": f.stem,
                    "filename": f.name,
                    "code": code,
                    "isShowcase": True,
                    "meshCount": len(re.findall(r"<mesh\b", code)),
                    "hasAnimation": "useFrame" in code,
                    "hasEmissive": "emissive=" in code,
                }
            )
    return {"props": props, "count": len(props)}


@router.get("/showcase-props/{name}")
async def get_showcase_prop(name: str):
    path = SHOWCASE_PROPS_DIR / f"{name}.tsx"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Showcase prop '{name}' not found")
    code = path.read_text()
    return {"name": name, "filename": path.name, "code": code, "isShowcase": True}


# ─── Phase 2: Multi-Pass & Refinement ────────────────────────────


@router.post("/props/refine", response_model=PropRefinementResponse)
async def refine_prop(req: PropRefinementRequest):
    """Apply user refinements to a generated prop."""
    from ..services.multi_pass_generator import MultiPassGenerator

    record = next((r for r in load_generation_history() if r.get("id") == req.propId), None)
    if not record or not record.get("code"):
        raise HTTPException(status_code=404, detail="Prop not found or has no code")

    generator = MultiPassGenerator()
    refined_code, diagnostics = generator.apply_refinement(record["code"], req.changes)
    options = generator.get_refinement_options(record.get("prompt", ""))
    parts = apply_color_changes_to_parts(record.get("parts", []), req.changes.get("colorChanges", {}))
    persist_refined_prop(req.propId, refined_code, parts)

    return PropRefinementResponse(
        propId=req.propId,
        code=refined_code,
        parts=[PropPart(**p) for p in parts],
        diagnostics=diagnostics,
        refinementOptions=options,
    )


@router.get("/props/refinement-options")
async def get_refinement_options(prompt: str = Query("", min_length=0)):
    from ..services.multi_pass_generator import MultiPassGenerator

    return MultiPassGenerator().get_refinement_options(prompt)


# ─── Phase 3: Advanced Features ──────────────────────────────────


@router.post("/props/iterate")
async def iterate_prop(req: IteratePropRequest):
    """Iterate on a prop with natural language feedback."""
    from ..services.prop_iterator import PropIterator
    from ..services.prop_quality_scorer import QualityScorer

    try:
        improved_code, feedback_type = await PropIterator().iterate_prop(
            original_code=req.code,
            feedback=req.feedback,
            component_name=req.componentName,
        )
        score = QualityScorer().score_prop(improved_code)
        return {"code": improved_code, "feedbackType": feedback_type, "qualityScore": score.to_dict()}
    except Exception as exc:
        logger.error(f"Iteration failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/props/style-transfer")
async def apply_style_transfer(req: StyleTransferRequest):
    """Apply a showcase style to a generated prop."""
    from ..services.prop_quality_scorer import QualityScorer
    from ..services.style_transfer import StyleTransfer

    try:
        styled_code = await StyleTransfer().apply_style(
            generated_code=req.code,
            style_source=req.styleSource,
            component_name=req.componentName,
        )
        score = QualityScorer().score_prop(styled_code)
        return {"code": styled_code, "styleSource": req.styleSource, "qualityScore": score.to_dict()}
    except Exception as exc:
        logger.error(f"Style transfer failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/props/styles")
async def list_styles():
    from ..services.style_transfer import get_available_styles

    return {"styles": get_available_styles()}


@router.post("/props/hybrid-generate")
async def hybrid_generate(req: HybridGenerateRequest):
    """Generate a prop using hybrid AI + template approach."""
    from ..services.hybrid_generator import HybridGenerator
    from ..services.prop_quality_scorer import QualityScorer

    name, filename = prompt_to_filename(req.prompt.strip())
    try:
        code = await HybridGenerator().generate_hybrid(
            description=req.prompt,
            component_name=name,
            template_base=req.templateBase,
        )
        score = QualityScorer().score_prop(code)
        ai_parts = parse_ai_parts(code)
        clean_code = strip_parts_block(code)
        parts = ai_parts if ai_parts else extract_parts(req.prompt)
        method = "hybrid" if req.templateBase else "ai-enhanced"
        gen_id = uuid.uuid4().hex[:8]
        add_generation_record(
            {
                "id": gen_id,
                "prompt": req.prompt,
                "name": name,
                "model": req.model,
                "modelLabel": "Hybrid",
                "method": method,
                "fullPrompt": "",
                "toolCalls": [],
                "corrections": [],
                "diagnostics": [f"Template: {req.templateBase or 'none'}"],
                "parts": parts,
                "code": clean_code,
                "createdAt": datetime.utcnow().isoformat(),
                "error": None,
            }
        )
        return {
            "name": name,
            "filename": filename,
            "code": clean_code,
            "method": method,
            "parts": parts,
            "qualityScore": score.to_dict(),
            "generationId": gen_id,
        }
    except Exception as exc:
        logger.error(f"Hybrid generation failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/props/templates")
async def list_templates():
    from ..services.hybrid_generator import HybridGenerator

    return {"templates": HybridGenerator().get_templates()}


@router.post("/props/crossbreed")
async def crossbreed_props(req: CrossbreedRequest):
    """Crossbreed two props to create a hybrid offspring."""
    from ..services.prop_genetics import PropGenetics
    from ..services.prop_quality_scorer import QualityScorer

    try:
        offspring_code = await PropGenetics().crossbreed(
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
            "code": clean_code,
            "name": req.componentName,
            "parts": ai_parts or [],
            "qualityScore": score.to_dict(),
            "parents": [req.parentAName, req.parentBName],
        }
    except Exception as exc:
        logger.error(f"Crossbreeding failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/props/quality-score")
async def score_prop_quality(req: QualityScoreRequest):
    from ..services.prop_quality_scorer import QualityScorer

    return QualityScorer().score_prop(req.code).to_dict()
