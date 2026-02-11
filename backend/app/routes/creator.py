"""Creator Zone routes — AI prop generation endpoints."""

from __future__ import annotations

import re
import os
import json
import logging
import asyncio
import subprocess
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/creator", tags=["creator"])

# Path to prompt template
PROMPT_TEMPLATE_PATH = Path(__file__).parent.parent.parent.parent / "docs" / "features" / "creative" / "creator-zone" / "creator-zone-prompt.md"

# OpenClaw gateway config
OPENCLAW_GATEWAY_TOKEN = "ee6e3282bca98c6452a7e2132944c551280ad7776d0969ea"


class GeneratePropRequest(BaseModel):
    prompt: str
    use_ai: bool = True  # Set to False to use template fallback


class PropPart(BaseModel):
    type: str  # "box", "cylinder", "sphere", "cone", "torus"
    position: list[float]  # [x, y, z]
    args: list[float]
    color: str  # hex color
    emissive: bool = False


class GeneratePropResponse(BaseModel):
    name: str
    filename: str
    code: str
    method: str  # "ai" or "template"
    parts: list[PropPart] = []  # structured geometry for runtime rendering


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


# ─── Saved Props Storage (JSON file) ────────────────────────────
SAVED_PROPS_PATH = Path(__file__).parent.parent.parent / "data" / "saved_props.json"


def _load_saved_props() -> list[dict]:
    try:
        if SAVED_PROPS_PATH.exists():
            return json.loads(SAVED_PROPS_PATH.read_text())
    except Exception:
        pass
    return []


def _save_props_to_disk(props: list[dict]):
    SAVED_PROPS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SAVED_PROPS_PATH.write_text(json.dumps(props, indent=2))


def _prompt_to_filename(prompt: str) -> tuple[str, str]:
    """Derive a PascalCase component name and filename from a prompt."""
    words = re.sub(r'[^a-zA-Z0-9\s]', '', prompt).split()[:4]
    pascal = ''.join(w.capitalize() for w in words) if words else 'CustomProp'
    return pascal, f"{pascal}.tsx"


def _load_prompt_template() -> str:
    """Load the system prompt template from docs/creator-zone-prompt.md."""
    try:
        return PROMPT_TEMPLATE_PATH.read_text()
    except FileNotFoundError:
        logger.warning(f"Prompt template not found at {PROMPT_TEMPLATE_PATH}")
        return ""


# ─── Smart Template Fallback ────────────────────────────────────
# Generates real prop code by analyzing prompt keywords and selecting
# appropriate geometries, colors, and structures.

COLOR_KEYWORDS = {
    "red": "#CC3333", "blue": "#3366CC", "green": "#338833", "yellow": "#CCAA33",
    "purple": "#8833AA", "pink": "#CC6699", "orange": "#CC6633", "white": "#EEEEEE",
    "black": "#333333", "brown": "#8B6238", "gold": "#DAA520", "silver": "#C0C0C0",
    "wooden": "#A0724A", "wood": "#A0724A", "metal": "#888888", "metallic": "#AAAAAA",
    "neon": "#00FF88", "glowing": "#FFDD44", "dark": "#444444", "bright": "#FFCC00",
    "stone": "#888877", "crystal": "#88CCEE", "rusty": "#8B4513", "copper": "#B87333",
}

SHAPE_TEMPLATES = {
    "barrel": {
        "parts": [
            ("cylinder", [0, 0.3, 0], [0.25, 0.25, 0.6, 12], "main"),
            ("cylinder", [0, 0.05, 0], [0.27, 0.27, 0.04, 12], "accent"),
            ("cylinder", [0, 0.55, 0], [0.27, 0.27, 0.04, 12], "accent"),
            ("cylinder", [0, 0.3, 0], [0.27, 0.27, 0.04, 12], "accent"),
        ],
        "main_color": "#A0724A",
        "accent_color": "#777777",
    },
    "mushroom": {
        "parts": [
            ("cylinder", [0, 0.15, 0], [0.06, 0.08, 0.3, 8], "accent"),  # stem
            ("sphere", [0, 0.38, 0], [0.2, 12, 12, 0, 6.28, 0, 1.57], "main"),  # cap
            ("cylinder", [0, 0.01, 0], [0.12, 0.14, 0.02, 10], "accent"),  # base
        ],
        "main_color": "#CC4444",
        "accent_color": "#EEDDCC",
    },
    "lamp": {
        "parts": [
            ("cylinder", [0, 0.04, 0], [0.18, 0.22, 0.08, 16], "accent"),  # base
            ("cylinder", [0, 0.5, 0], [0.03, 0.03, 0.9, 8], "accent"),  # pole
            ("sphere", [0, 1.0, 0], [0.15, 12, 12], "emissive"),  # bulb
        ],
        "main_color": "#FFDD44",
        "accent_color": "#777777",
    },
    "table": {
        "parts": [
            ("box", [0, 0.4, 0], [0.8, 0.06, 0.5], "main"),  # top
            ("box", [-0.35, 0.18, -0.2], [0.05, 0.36, 0.05], "accent"),  # legs
            ("box", [0.35, 0.18, -0.2], [0.05, 0.36, 0.05], "accent"),
            ("box", [-0.35, 0.18, 0.2], [0.05, 0.36, 0.05], "accent"),
            ("box", [0.35, 0.18, 0.2], [0.05, 0.36, 0.05], "accent"),
        ],
        "main_color": "#A0724A",
        "accent_color": "#8B6238",
    },
    "sign": {
        "parts": [
            ("box", [0, 0.6, 0], [0.7, 0.35, 0.04], "emissive"),  # sign face
            ("cylinder", [0, 0.3, 0], [0.03, 0.03, 0.6, 8], "accent"),  # pole
            ("cylinder", [0, 0.01, 0], [0.12, 0.14, 0.02, 10], "accent"),  # base
        ],
        "main_color": "#FF4488",
        "accent_color": "#555555",
    },
    "box": {
        "parts": [
            ("box", [0, 0.2, 0], [0.4, 0.4, 0.4], "main"),
            ("box", [0, 0.41, 0], [0.42, 0.02, 0.42], "accent"),  # lid
        ],
        "main_color": "#B8956A",
        "accent_color": "#8B6238",
    },
    "crystal": {
        "parts": [
            ("cone", [0, 0.3, 0], [0.15, 0.6, 6], "emissive"),
            ("cone", [0.12, 0.2, 0.05], [0.08, 0.35, 6], "emissive"),
            ("cone", [-0.08, 0.18, -0.06], [0.06, 0.3, 6], "emissive"),
            ("cylinder", [0, 0.02, 0], [0.2, 0.22, 0.04, 8], "accent"),  # base
        ],
        "main_color": "#88CCEE",
        "accent_color": "#666666",
    },
    "chair": {
        "parts": [
            ("box", [0, 0.25, 0], [0.4, 0.06, 0.4], "main"),  # seat
            ("box", [0, 0.5, -0.18], [0.4, 0.5, 0.04], "main"),  # back
            ("box", [-0.17, 0.11, -0.17], [0.04, 0.22, 0.04], "accent"),  # legs
            ("box", [0.17, 0.11, -0.17], [0.04, 0.22, 0.04], "accent"),
            ("box", [-0.17, 0.11, 0.17], [0.04, 0.22, 0.04], "accent"),
            ("box", [0.17, 0.11, 0.17], [0.04, 0.22, 0.04], "accent"),
        ],
        "main_color": "#6688AA",
        "accent_color": "#555555",
    },
    "tree": {
        "parts": [
            ("cylinder", [0, 0.3, 0], [0.08, 0.1, 0.6, 8], "accent"),  # trunk
            ("cone", [0, 0.8, 0], [0.35, 0.5, 8], "main"),  # foliage
            ("cone", [0, 1.05, 0], [0.25, 0.4, 8], "main"),
        ],
        "main_color": "#338833",
        "accent_color": "#8B6238",
    },
}

# Default fallback
DEFAULT_SHAPE = "box"

SHAPE_KEYWORD_MAP = {
    "barrel": ["barrel", "keg", "cask", "drum"],
    "mushroom": ["mushroom", "fungus", "toadstool", "shroom"],
    "lamp": ["lamp", "light", "lantern", "torch", "candle", "chandelier"],
    "table": ["table", "desk", "workbench", "counter", "shelf"],
    "sign": ["sign", "neon", "billboard", "poster", "banner", "placard"],
    "box": ["box", "crate", "chest", "trunk", "package", "cube"],
    "crystal": ["crystal", "gem", "diamond", "jewel", "prism", "shard", "obelisk"],
    "chair": ["chair", "stool", "seat", "throne", "bench", "sofa"],
    "tree": ["tree", "bush", "shrub", "bonsai", "pine", "oak"],
    "mushroom": ["mushroom", "fungus", "toadstool", "shroom"],
}


def _detect_shape(prompt: str) -> str:
    lower = prompt.lower()
    for shape, keywords in SHAPE_KEYWORD_MAP.items():
        for kw in keywords:
            if kw in lower:
                return shape
    return DEFAULT_SHAPE


def _detect_color(prompt: str, default: str) -> str:
    lower = prompt.lower()
    for kw, color in COLOR_KEYWORDS.items():
        if kw in lower:
            return color
    return default


def _extract_parts(prompt: str) -> list[dict]:
    """Extract structured parts data from template for a prompt."""
    shape_key = _detect_shape(prompt)
    shape = SHAPE_TEMPLATES[shape_key]
    main_color = _detect_color(prompt, shape["main_color"])
    accent_color = shape["accent_color"]
    
    parts = []
    for geo_type, pos, args, color_role in shape["parts"]:
        color = main_color if color_role in ("main", "emissive") else accent_color
        parts.append({
            "type": geo_type,
            "position": pos,
            "args": [float(a) for a in args],
            "color": color,
            "emissive": color_role == "emissive",
        })
    return parts


def _generate_template_code(name: str, prompt: str) -> str:
    """Generate prop code using smart templates based on prompt keywords."""
    shape_key = _detect_shape(prompt)
    shape = SHAPE_TEMPLATES[shape_key]
    
    main_color = _detect_color(prompt, shape["main_color"])
    accent_color = shape["accent_color"]
    
    # Build mesh lines
    hooks = []
    meshes = []
    hook_names = {}
    
    for i, (geo_type, pos, args, color_role) in enumerate(shape["parts"]):
        if color_role == "main":
            color = main_color
        elif color_role == "accent":
            color = accent_color
        elif color_role == "emissive":
            color = main_color
        else:
            color = main_color
        
        hook_name = f"toon{i}"
        if color not in hook_names:
            hook_names[color] = hook_name
            hooks.append(f"  const {hook_name} = useToonMaterialProps('{color}')")
        else:
            hook_name = hook_names[color]
        
        pos_str = f"[{pos[0]}, {pos[1]}, {pos[2]}]"
        args_str = ", ".join(str(a) for a in args)
        
        geo_map = {
            "box": "boxGeometry",
            "cylinder": "cylinderGeometry",
            "sphere": "sphereGeometry",
            "cone": "coneGeometry",
            "torus": "torusGeometry",
        }
        geo_name = geo_map.get(geo_type, "boxGeometry")
        
        if color_role == "emissive":
            mat_line = f'        <meshStandardMaterial color="{color}" emissive="{color}" emissiveIntensity={{0.5}} />'
        else:
            mat_line = f"        <meshToonMaterial {{...{hook_name}}} />"
        
        meshes.append(
            f"      <mesh position={{{pos_str}}} castShadow>\n"
            f"        <{geo_name} args={{[{args_str}]}} />\n"
            f"{mat_line}\n"
            f"      </mesh>"
        )
    
    hooks_str = "\n".join(hooks)
    meshes_str = "\n\n".join(meshes)
    
    return f"""import {{ useToonMaterialProps }} from '../../utils/toonMaterials'

interface {name}Props {{
  position?: [number, number, number]
  scale?: number
}}

export function {name}({{ position = [0, 0, 0], scale = 1 }}: {name}Props) {{
{hooks_str}

  return (
    <group position={{position}} scale={{scale}}>
{meshes_str}
    </group>
  )
}}
"""


# ─── OpenClaw AI Generation ─────────────────────────────────────

def _parse_ai_parts(raw: str) -> list[dict] | None:
    """Extract PARTS_DATA JSON block from AI output."""
    match = re.search(r'/\*\s*PARTS_DATA\s*\n(.*?)\nPARTS_DATA\s*\*/', raw, re.DOTALL)
    if not match:
        return None
    try:
        parts = json.loads(match.group(1).strip())
        if isinstance(parts, list) and len(parts) > 0:
            return parts
    except (json.JSONDecodeError, ValueError):
        pass
    return None


def _strip_parts_block(code: str) -> str:
    """Remove the PARTS_DATA comment block from code."""
    return re.sub(r'/\*\s*PARTS_DATA\s*\n.*?\nPARTS_DATA\s*\*/', '', code, flags=re.DOTALL).strip()


# ─── Generation status tracking (simple in-memory) ──────────────
_generation_status: dict[str, dict] = {}


async def _generate_with_openclaw(name: str, prompt: str) -> tuple[str | None, list[dict] | None]:
    """Try to generate prop code using OpenClaw CLI subprocess.
    
    Returns (code, parts) tuple. Parts may be None if not parseable.
    """
    template = _load_prompt_template()
    if not template:
        return None, None
    
    full_prompt = f"{template}\n\nGenerate a prop for: {prompt}\n\nThe component should be named `{name}`. Output ONLY the code followed by the PARTS_DATA block."
    
    try:
        proc = await asyncio.create_subprocess_exec(
            "openclaw", "run",
            "--model", "sonnet",
            "--system", "You are a React Three Fiber prop generator. Output ONLY valid TSX code followed by a PARTS_DATA comment block. No markdown fences, no explanations.",
            "--message", full_prompt,
            "--no-tools",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={**os.environ, "OPENCLAW_GATEWAY_TOKEN": OPENCLAW_GATEWAY_TOKEN},
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=90)
        
        if proc.returncode == 0 and stdout:
            raw = stdout.decode().strip()
            # Strip markdown fences if present
            raw = re.sub(r'^```\w*\n', '', raw)
            raw = re.sub(r'\n```\s*$', '', raw)
            
            # Extract parts from AI output
            ai_parts = _parse_ai_parts(raw)
            code = _strip_parts_block(raw)
            
            # Basic validation
            if 'useToonMaterialProps' in code and 'export function' in code:
                logger.info(f"AI generated prop: {name} (parts: {len(ai_parts) if ai_parts else 0})")
                return code, ai_parts
            else:
                logger.warning(f"AI output didn't pass validation for {name}")
                return None, None
        else:
            logger.warning(f"openclaw run failed: {stderr.decode()[:200]}")
            return None, None
    except FileNotFoundError:
        logger.warning("openclaw CLI not found in PATH")
        return None, None
    except asyncio.TimeoutError:
        logger.warning("openclaw run timed out after 90s")
        return None, None
    except Exception as e:
        logger.warning(f"openclaw run error: {e}")
        return None, None


@router.post("/generate-prop", response_model=GeneratePropResponse)
async def generate_prop(req: GeneratePropRequest):
    """Generate a 3D prop component from a text prompt.
    
    Tries OpenClaw AI first, falls back to smart template generation.
    """
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    name, filename = _prompt_to_filename(req.prompt)
    
    # Try AI generation first
    method = "template"
    code = None
    ai_parts = None
    
    # Track generation status
    import uuid as _uuid
    gen_id = str(_uuid.uuid4())[:8]
    _generation_status[gen_id] = {"status": "generating", "prompt": req.prompt[:80], "method": "pending"}
    
    if req.use_ai:
        code, ai_parts = await _generate_with_openclaw(name, req.prompt)
        if code:
            method = "ai"
    
    # Fallback to smart template
    if not code:
        code = _generate_template_code(name, req.prompt)
        method = "template"

    logger.info(f"Generated prop ({method}): {name} from prompt: {req.prompt[:80]}")

    # Use AI-extracted parts if available, otherwise fall back to template parts
    if ai_parts:
        parts = ai_parts
    else:
        parts = _extract_parts(req.prompt)
    
    _generation_status[gen_id] = {"status": "complete", "prompt": req.prompt[:80], "method": method, "name": name}

    return GeneratePropResponse(
        name=name, filename=filename, code=code, method=method,
        parts=[PropPart(**p) for p in parts],
    )


@router.get("/generate-prop-status")
async def generate_prop_status():
    """Return current/recent generation status for polling."""
    return {"generations": _generation_status}


@router.post("/save-prop", response_model=SavedPropResponse)
async def save_prop(req: SavePropRequest):
    """Save a generated prop to persistent storage."""
    from datetime import datetime
    
    props = _load_saved_props()
    
    # Remove existing with same propId
    props = [p for p in props if p["propId"] != req.propId]
    
    entry = {
        "propId": req.propId,
        "name": req.name,
        "parts": [p.dict() for p in req.parts],
        "mountType": req.mountType,
        "yOffset": req.yOffset,
        "createdAt": datetime.utcnow().isoformat(),
    }
    props.append(entry)
    _save_props_to_disk(props)
    
    logger.info(f"Saved prop: {req.propId}")
    return SavedPropResponse(**entry)


@router.get("/saved-props", response_model=list[SavedPropResponse])
async def list_saved_props():
    """List all saved props."""
    return [SavedPropResponse(**p) for p in _load_saved_props()]


@router.delete("/saved-props/{prop_id}")
async def delete_saved_prop(prop_id: str):
    """Delete a saved prop."""
    props = _load_saved_props()
    new_props = [p for p in props if p["propId"] != prop_id]
    if len(new_props) == len(props):
        raise HTTPException(status_code=404, detail="Prop not found")
    _save_props_to_disk(new_props)
    logger.info(f"Deleted prop: {prop_id}")
    return {"status": "deleted", "propId": prop_id}
