"""Creator Zone routes — AI prop generation endpoints."""

from __future__ import annotations

import asyncio
import re
import json
import logging
import uuid as _uuid_mod
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/creator", tags=["creator"])

# Path to prompt template
PROMPT_TEMPLATE_PATH = Path(__file__).parent.parent.parent.parent / "docs" / "features" / "creative" / "creator-zone" / "creator-zone-prompt.md"

# ─── Available Models ────────────────────────────────────────────
AVAILABLE_MODELS = {
    "opus-4-6": {"id": "anthropic/claude-opus-4-6", "label": "Opus 4-6", "provider": "anthropic"},
    "sonnet-4-5": {"id": "anthropic/claude-sonnet-4-5", "label": "Sonnet 4.5", "provider": "anthropic"},
    "gpt-5-2": {"id": "openai/gpt-5.2", "label": "GPT-5.2", "provider": "openai"},
}
DEFAULT_MODEL = "sonnet-4-5"


class GeneratePropRequest(BaseModel):
    prompt: str
    use_ai: bool = True
    model: str = DEFAULT_MODEL


class PropRefinementRequest(BaseModel):
    propId: str
    changes: dict = {}  # colorChanges, addComponents, animation, material


class PropRefinementResponse(BaseModel):
    propId: str
    code: str
    diagnostics: list[str] = []
    refinementOptions: dict = {}


class PropPart(BaseModel):
    type: str  # "box", "cylinder", "sphere", "cone", "torus"
    position: list[float]  # [x, y, z]
    rotation: list[float] = [0, 0, 0]  # [x, y, z] radians
    args: list[float]
    color: str
    emissive: bool = False


class GeneratePropResponse(BaseModel):
    name: str
    filename: str
    code: str
    method: str  # "ai" or "template"
    parts: list[PropPart] = []


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


# ─── Generation History Storage ──────────────────────────────────
GENERATION_HISTORY_PATH = Path(__file__).parent.parent.parent / "data" / "generation_history.json"
SAVED_PROPS_PATH = Path(__file__).parent.parent.parent / "data" / "saved_props.json"


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


def _load_generation_history() -> list[dict]:
    try:
        if GENERATION_HISTORY_PATH.exists():
            return json.loads(GENERATION_HISTORY_PATH.read_text())
    except Exception:
        pass
    return []


def _save_generation_history(records: list[dict]):
    GENERATION_HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    GENERATION_HISTORY_PATH.write_text(json.dumps(records, indent=2))


def _add_generation_record(record: dict):
    try:
        history = _load_generation_history()
        history.insert(0, record)
        history = history[:100]
        _save_generation_history(history)
    except Exception as e:
        logger.error(f"Failed to save generation record: {e}")


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
    words = re.sub(r'[^a-zA-Z0-9\s]', '', prompt).split()[:4]
    pascal = ''.join(w.capitalize() for w in words) if words else 'CustomProp'
    return pascal, f"{pascal}.tsx"


def _load_prompt_template() -> str:
    try:
        return PROMPT_TEMPLATE_PATH.read_text()
    except FileNotFoundError:
        logger.warning(f"Prompt template not found at {PROMPT_TEMPLATE_PATH}")
        return ""


# ─── Smart Template Fallback ────────────────────────────────────

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
        "main_color": "#A0724A", "accent_color": "#777777",
    },
    "mushroom": {
        "parts": [
            ("cylinder", [0, 0.15, 0], [0.06, 0.08, 0.3, 8], "accent"),
            ("sphere", [0, 0.38, 0], [0.2, 12, 12, 0, 6.28, 0, 1.57], "main"),
            ("cylinder", [0, 0.01, 0], [0.12, 0.14, 0.02, 10], "accent"),
        ],
        "main_color": "#CC4444", "accent_color": "#EEDDCC",
    },
    "lamp": {
        "parts": [
            ("cylinder", [0, 0.04, 0], [0.18, 0.22, 0.08, 16], "accent"),
            ("cylinder", [0, 0.5, 0], [0.03, 0.03, 0.9, 8], "accent"),
            ("sphere", [0, 1.0, 0], [0.15, 12, 12], "emissive"),
        ],
        "main_color": "#FFDD44", "accent_color": "#777777",
    },
    "table": {
        "parts": [
            ("box", [0, 0.4, 0], [0.8, 0.06, 0.5], "main"),
            ("box", [-0.35, 0.18, -0.2], [0.05, 0.36, 0.05], "accent"),
            ("box", [0.35, 0.18, -0.2], [0.05, 0.36, 0.05], "accent"),
            ("box", [-0.35, 0.18, 0.2], [0.05, 0.36, 0.05], "accent"),
            ("box", [0.35, 0.18, 0.2], [0.05, 0.36, 0.05], "accent"),
        ],
        "main_color": "#A0724A", "accent_color": "#8B6238",
    },
    "sign": {
        "parts": [
            ("box", [0, 0.6, 0], [0.7, 0.35, 0.04], "emissive"),
            ("cylinder", [0, 0.3, 0], [0.03, 0.03, 0.6, 8], "accent"),
            ("cylinder", [0, 0.01, 0], [0.12, 0.14, 0.02, 10], "accent"),
        ],
        "main_color": "#FF4488", "accent_color": "#555555",
    },
    "box": {
        "parts": [
            ("box", [0, 0.2, 0], [0.4, 0.4, 0.4], "main"),
            ("box", [0, 0.41, 0], [0.42, 0.02, 0.42], "accent"),
        ],
        "main_color": "#B8956A", "accent_color": "#8B6238",
    },
    "crystal": {
        "parts": [
            ("cone", [0, 0.3, 0], [0.15, 0.6, 6], "emissive"),
            ("cone", [0.12, 0.2, 0.05], [0.08, 0.35, 6], "emissive"),
            ("cone", [-0.08, 0.18, -0.06], [0.06, 0.3, 6], "emissive"),
            ("cylinder", [0, 0.02, 0], [0.2, 0.22, 0.04, 8], "accent"),
        ],
        "main_color": "#88CCEE", "accent_color": "#666666",
    },
    "chair": {
        "parts": [
            ("box", [0, 0.25, 0], [0.4, 0.06, 0.4], "main"),
            ("box", [0, 0.5, -0.18], [0.4, 0.5, 0.04], "main"),
            ("box", [-0.17, 0.11, -0.17], [0.04, 0.22, 0.04], "accent"),
            ("box", [0.17, 0.11, -0.17], [0.04, 0.22, 0.04], "accent"),
            ("box", [-0.17, 0.11, 0.17], [0.04, 0.22, 0.04], "accent"),
            ("box", [0.17, 0.11, 0.17], [0.04, 0.22, 0.04], "accent"),
        ],
        "main_color": "#6688AA", "accent_color": "#555555",
    },
    "teapot": {
        "parts": [
            ("sphere", [0, 0.22, 0], [0.2, 12, 12], "main"),
            ("cylinder", [0, 0.4, 0], [0.08, 0.12, 0.06, 12], "main"),
            ("sphere", [0, 0.45, 0], [0.04, 8, 8], "accent"),
            ("cylinder", [0.28, 0.22, 0], [0.03, 0.03, 0.16, 8], "accent"),
            ("cone", [0.38, 0.24, 0], [0.02, 0.06, 8], "accent"),
            ("torus", [-0.24, 0.24, 0], [0.08, 0.02, 8, 16], "accent"),
            ("cylinder", [0, 0.04, 0], [0.12, 0.14, 0.04, 12], "accent"),
        ],
        "main_color": "#CC8844", "accent_color": "#8B6238",
    },
    "mug": {
        "parts": [
            ("cylinder", [0, 0.18, 0], [0.12, 0.12, 0.32, 16], "main"),
            ("cylinder", [0, 0.18, 0], [0.13, 0.13, 0.02, 16], "accent"),
            ("cylinder", [0, 0.02, 0], [0.12, 0.13, 0.04, 16], "accent"),
            ("torus", [0.16, 0.18, 0], [0.06, 0.015, 8, 16], "accent"),
        ],
        "main_color": "#EEEEEE", "accent_color": "#CCCCCC",
    },
    "bottle": {
        "parts": [
            ("cylinder", [0, 0.2, 0], [0.1, 0.1, 0.35, 12], "main"),
            ("cylinder", [0, 0.45, 0], [0.05, 0.1, 0.15, 12], "main"),
            ("cylinder", [0, 0.55, 0], [0.04, 0.04, 0.06, 8], "accent"),
            ("cylinder", [0, 0.02, 0], [0.11, 0.11, 0.04, 12], "accent"),
        ],
        "main_color": "#336644", "accent_color": "#555555",
    },
    "clock": {
        "parts": [
            ("cylinder", [0, 0.5, 0], [0.25, 0.25, 0.06, 24], "main"),
            ("torus", [0, 0.5, 0], [0.26, 0.02, 8, 24], "accent"),
            ("box", [0, 0.53, 0.04], [0.01, 0.004, 0.1], "accent"),
            ("box", [0.03, 0.53, 0], [0.01, 0.004, 0.07], "accent"),
            ("sphere", [0, 0.53, 0], [0.015, 8, 8], "accent"),
            ("box", [0, 0.5, -0.04], [0.04, 0.15, 0.02], "accent"),
        ],
        "main_color": "#F5F5DC", "accent_color": "#8B6238",
    },
    "robot": {
        "parts": [
            ("box", [0, 0.35, 0], [0.3, 0.35, 0.2], "main"),
            ("box", [0, 0.65, 0], [0.22, 0.22, 0.18], "main"),
            ("sphere", [-0.06, 0.7, 0.1], [0.03, 8, 8], "emissive"),
            ("sphere", [0.06, 0.7, 0.1], [0.03, 8, 8], "emissive"),
            ("cylinder", [0, 0.8, 0], [0.02, 0.04, 0.08, 6], "accent"),
            ("box", [-0.22, 0.35, 0], [0.08, 0.25, 0.08], "accent"),
            ("box", [0.22, 0.35, 0], [0.08, 0.25, 0.08], "accent"),
            ("box", [-0.08, 0.08, 0], [0.1, 0.16, 0.12], "accent"),
            ("box", [0.08, 0.08, 0], [0.1, 0.16, 0.12], "accent"),
        ],
        "main_color": "#888888", "accent_color": "#555555",
    },
    "book": {
        "parts": [
            ("box", [0, 0.12, 0], [0.3, 0.22, 0.04], "main"),
            ("box", [0, 0.12, 0], [0.28, 0.2, 0.03], "accent"),
            ("box", [-0.15, 0.12, 0], [0.01, 0.22, 0.05], "accent"),
        ],
        "main_color": "#8B2222", "accent_color": "#EEDDCC",
    },
    "sword": {
        "parts": [
            ("box", [0, 0.55, 0], [0.04, 0.7, 0.01], "accent"),
            ("box", [0, 0.18, 0], [0.18, 0.04, 0.03], "accent"),
            ("cylinder", [0, 0.1, 0], [0.025, 0.025, 0.14, 8], "main"),
            ("sphere", [0, 0.02, 0], [0.03, 8, 8], "main"),
        ],
        "main_color": "#8B6238", "accent_color": "#C0C0C0",
    },
    "flower": {
        "parts": [
            ("cylinder", [0, 0.25, 0], [0.02, 0.025, 0.45, 6], "accent"),
            ("sphere", [0, 0.5, 0], [0.05, 8, 8], "accent"),
            ("sphere", [0.08, 0.52, 0], [0.04, 8, 8], "main"),
            ("sphere", [-0.08, 0.52, 0], [0.04, 8, 8], "main"),
            ("sphere", [0, 0.52, 0.08], [0.04, 8, 8], "main"),
            ("sphere", [0, 0.52, -0.08], [0.04, 8, 8], "main"),
            ("cylinder", [0, 0.04, 0], [0.08, 0.1, 0.08, 8], "accent"),
        ],
        "main_color": "#FF6699", "accent_color": "#338833",
    },
    "trophy": {
        "parts": [
            ("cylinder", [0, 0.04, 0], [0.15, 0.18, 0.06, 12], "accent"),
            ("cylinder", [0, 0.12, 0], [0.04, 0.04, 0.12, 8], "accent"),
            ("cylinder", [0, 0.28, 0], [0.14, 0.08, 0.2, 12], "main"),
            ("torus", [-0.18, 0.3, 0], [0.05, 0.015, 8, 12], "main"),
            ("torus", [0.18, 0.3, 0], [0.05, 0.015, 8, 12], "main"),
        ],
        "main_color": "#DAA520", "accent_color": "#8B6238",
    },
    "skull": {
        "parts": [
            ("sphere", [0, 0.2, 0], [0.18, 12, 12], "main"),
            ("box", [0, 0.08, 0.1], [0.12, 0.1, 0.08], "main"),
            ("sphere", [-0.06, 0.22, 0.14], [0.03, 8, 8], "accent"),
            ("sphere", [0.06, 0.22, 0.14], [0.03, 8, 8], "accent"),
        ],
        "main_color": "#EEDDCC", "accent_color": "#333333",
    },
    "arcade": {
        "parts": [
            ("box", [0, 0.5, 0], [0.5, 1.0, 0.4], "main"),
            ("box", [0, 0.85, 0.05], [0.4, 0.3, 0.02], "emissive"),
            ("box", [0, 0.55, 0.22], [0.3, 0.15, 0.04], "accent"),
            ("sphere", [-0.08, 0.56, 0.25], [0.02, 8, 8], "emissive"),
            ("sphere", [0.08, 0.56, 0.25], [0.02, 8, 8], "emissive"),
            ("cylinder", [-0.02, 0.58, 0.25], [0.015, 0.015, 0.04, 6], "accent"),
        ],
        "main_color": "#2222AA", "accent_color": "#333333",
    },
    "tree": {
        "parts": [
            ("cylinder", [0, 0.3, 0], [0.08, 0.1, 0.6, 8], "accent"),
            ("cone", [0, 0.8, 0], [0.35, 0.5, 8], "main"),
            ("cone", [0, 1.05, 0], [0.25, 0.4, 8], "main"),
        ],
        "main_color": "#338833", "accent_color": "#8B6238",
    },
}

DEFAULT_SHAPE = "box"

SHAPE_KEYWORD_MAP = {
    "teapot": ["teapot", "tea pot", "kettle"],
    "mug": ["mug", "cup", "coffee mug", "coffee cup", "coffee", "tea cup", "espresso", "latte", "cappuccino", "cocoa"],
    "barrel": ["barrel", "keg", "cask", "drum"],
    "mushroom": ["mushroom", "fungus", "toadstool", "shroom"],
    "lamp": ["lamp", "light", "lantern", "torch", "candle", "chandelier", "bulb", "spotlight"],
    "table": ["table", "desk", "workbench", "counter", "shelf", "nightstand"],
    "sign": ["sign", "neon", "billboard", "poster", "banner", "placard"],
    "bottle": ["bottle", "flask", "vial", "potion", "jar", "vase"],
    "clock": ["clock", "watch", "timer", "timepiece"],
    "robot": ["robot", "mech", "android", "droid", "automaton", "bot"],
    "book": ["book", "tome", "journal", "notebook", "grimoire", "spellbook"],
    "sword": ["sword", "blade", "dagger", "katana", "knife", "weapon"],
    "flower": ["flower", "rose", "daisy", "tulip", "sunflower", "lily", "orchid", "bouquet"],
    "trophy": ["trophy", "award", "medal", "cup", "prize", "chalice", "goblet", "grail"],
    "skull": ["skull", "skeleton", "bone", "cranium"],
    "arcade": ["arcade", "cabinet", "pinball", "jukebox", "gaming"],
    "box": ["box", "crate", "chest", "trunk", "package", "cube"],
    "crystal": ["crystal", "gem", "diamond", "jewel", "prism", "shard", "obelisk"],
    "chair": ["chair", "stool", "seat", "throne", "bench", "sofa"],
    "tree": ["tree", "bush", "shrub", "bonsai", "pine", "oak"],
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
            "rotation": [0, 0, 0],
            "args": [float(a) for a in args],
            "color": color,
            "emissive": color_role == "emissive",
        })
    return parts


def _generate_template_code(name: str, prompt: str) -> str:
    shape_key = _detect_shape(prompt)
    shape = SHAPE_TEMPLATES[shape_key]
    main_color = _detect_color(prompt, shape["main_color"])
    accent_color = shape["accent_color"]
    
    hooks = []
    meshes = []
    hook_names = {}
    
    for i, (geo_type, pos, args, color_role) in enumerate(shape["parts"]):
        color = main_color if color_role in ("main", "emissive") else accent_color
        
        hook_name = f"toon{i}"
        if color not in hook_names:
            hook_names[color] = hook_name
            hooks.append(f"  const {hook_name} = useToonMaterialProps('{color}')")
        else:
            hook_name = hook_names[color]
        
        pos_str = f"[{pos[0]}, {pos[1]}, {pos[2]}]"
        args_str = ", ".join(str(a) for a in args)
        
        geo_map = {
            "box": "boxGeometry", "cylinder": "cylinderGeometry",
            "sphere": "sphereGeometry", "cone": "coneGeometry", "torus": "torusGeometry",
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


# ─── AI Output Parsing ───────────────────────────────────────────

def _parse_ai_parts(raw: str) -> list[dict] | None:
    match = re.search(r'/\*\s*PARTS_DATA\s*\n(.*?)\nPARTS_DATA\s*\*/', raw, re.DOTALL)
    if not match:
        return None
    try:
        parts = json.loads(match.group(1).strip())
        if isinstance(parts, list) and len(parts) > 0:
            # Ensure rotation field exists
            for p in parts:
                if "rotation" not in p:
                    p["rotation"] = [0, 0, 0]
            return parts
    except (json.JSONDecodeError, ValueError):
        pass
    return None


def _strip_parts_block(code: str) -> str:
    return re.sub(r'/\*\s*PARTS_DATA\s*\n.*?\nPARTS_DATA\s*\*/', '', code, flags=re.DOTALL).strip()


def _resolve_model(model_key: str) -> tuple[str, str]:
    """Resolve model key to (model_id, label). Falls back to default."""
    if model_key not in AVAILABLE_MODELS:
        logger.warning(f"Unknown model key '{model_key}', falling back to {DEFAULT_MODEL}")
        model_key = DEFAULT_MODEL
    info = AVAILABLE_MODELS[model_key]
    return info["id"], info["label"]


# ─── SSE Streaming Prop Generation ───────────────────────────────

async def _stream_prop_generation(request: Request, prompt: str, name: str, model_key: str):
    """SSE generator that streams real AI thinking process."""
    from ..services.connections import get_connection_manager, OpenClawConnection

    def sse_event(event_type: str, data: dict) -> str:
        return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"

    model_id, model_label = _resolve_model(model_key)
    gen_id = str(_uuid_mod.uuid4())[:8]
    
    # Track metadata for history
    tool_calls_collected: list[dict] = []
    corrections_collected: list[str] = []
    diagnostics_collected: list[str] = []

    # Find connected OpenClaw connection
    try:
        manager = await get_connection_manager()
        conn = None
        for c in manager.get_connections().values():
            if isinstance(c, OpenClawConnection) and c.is_connected():
                conn = c
                break
        if not conn:
            yield sse_event("error", {"message": "No connected OpenClaw connection"})
            return
    except Exception as e:
        yield sse_event("error", {"message": str(e)})
        return

    # Load prompt template
    template = _load_prompt_template()
    if not template:
        yield sse_event("error", {"message": "Prompt template not found"})
        return

    full_prompt = (
        f"{template}\n\n"
        f"Generate a prop for: {prompt}\n"
        f"Component name: `{name}`. Output ONLY the code followed by the PARTS_DATA block."
    )

    yield sse_event("status", {"message": f"🔍 Analyzing prompt: \"{prompt}\"...", "phase": "start"})
    yield sse_event("model", {"model": model_key, "modelLabel": model_label, "modelId": model_id})
    yield sse_event("full_prompt", {"prompt": full_prompt})

    # Send the agent request
    agent_id = "dev"
    req_id = str(_uuid_mod.uuid4())
    ws_request = {
        "type": "req",
        "id": req_id,
        "method": "agent",
        "params": {
            "message": full_prompt,
            "agentId": agent_id,
            "deliver": False,
            "idempotencyKey": str(_uuid_mod.uuid4()),
        },
    }

    q: asyncio.Queue = asyncio.Queue()
    conn._response_queues[req_id] = q

    logger.info(f"[PropGen:{gen_id}] Sending agent request req_id={req_id} agent={agent_id} model={model_id}")

    try:
        await conn.ws.send(json.dumps(ws_request))
        logger.info(f"[PropGen:{gen_id}] WS request sent successfully")
    except Exception as e:
        conn._response_queues.pop(req_id, None)
        logger.error(f"[PropGen:{gen_id}] Failed to send WS request: {e}")
        yield sse_event("error", {"message": f"Failed to send request: {e}"})
        return

    # Wait for accepted response
    session_id = None
    try:
        accepted = await asyncio.wait_for(q.get(), timeout=15.0)
        logger.info(f"[PropGen:{gen_id}] Accepted response: ok={accepted.get('ok')} keys={list(accepted.keys())}")
        if accepted.get("ok"):
            payload = accepted.get("payload", {})
            logger.info(f"[PropGen:{gen_id}] Accepted payload keys: {list(payload.keys()) if isinstance(payload, dict) else type(payload)}")
            if isinstance(payload, dict):
                session_id = payload.get("sessionId") or (
                    payload.get("session", {}).get("sessionId") if isinstance(payload.get("session"), dict) else None
                )
                logger.info(f"[PropGen:{gen_id}] Extracted session_id={session_id}")
        else:
            error_info = accepted.get("error", {})
            err_msg = error_info.get("message", str(error_info)) if isinstance(error_info, dict) else str(error_info)
            logger.error(f"[PropGen:{gen_id}] Agent request rejected: {err_msg}")
            conn._response_queues.pop(req_id, None)
            
            # Fall back to template
            code = _generate_template_code(name, prompt)
            parts = _extract_parts(prompt)
            _add_generation_record({
                "id": gen_id, "prompt": prompt, "name": name,
                "model": model_key, "modelLabel": model_label, "method": "template",
                "fullPrompt": full_prompt, "toolCalls": [], "corrections": [],
                "diagnostics": [f"Agent rejected request: {err_msg}"],
                "parts": parts, "code": code,
                "createdAt": datetime.utcnow().isoformat(), "error": f"Agent error: {err_msg}",
            })
            yield sse_event("error", {"message": f"Agent error: {err_msg}"})
            yield sse_event("complete", {
                "name": name, "filename": f"{name}.tsx", "code": code,
                "method": "template", "parts": parts,
                "model": model_key, "modelLabel": model_label, "generationId": gen_id,
            })
            return
    except asyncio.TimeoutError:
        logger.warning(f"[PropGen:{gen_id}] Timeout waiting for accepted response (15s)")
        conn._response_queues.pop(req_id, None)
        
        code = _generate_template_code(name, prompt)
        parts = _extract_parts(prompt)
        _add_generation_record({
            "id": gen_id, "prompt": prompt, "name": name,
            "model": model_key, "modelLabel": model_label, "method": "template",
            "fullPrompt": full_prompt, "toolCalls": [], "corrections": [],
            "diagnostics": ["Timeout waiting for agent acceptance"],
            "parts": parts, "code": code,
            "createdAt": datetime.utcnow().isoformat(), "error": "Agent acceptance timeout",
        })
        yield sse_event("error", {"message": "Agent did not respond in time"})
        yield sse_event("complete", {
            "name": name, "filename": f"{name}.tsx", "code": code,
            "method": "template", "parts": parts,
            "model": model_key, "modelLabel": model_label, "generationId": gen_id,
        })
        return

    yield sse_event("status", {"message": f"🧠 AI agent ({model_label}) started thinking...", "phase": "thinking"})

    # Poll transcript
    transcript_path = None
    if session_id:
        base = Path.home() / ".openclaw" / "agents" / agent_id / "sessions"
        transcript_path = base / f"{session_id}.jsonl"
        logger.info(f"[PropGen:{gen_id}] Transcript path: {transcript_path} exists={transcript_path.exists()}")
    else:
        logger.warning(f"[PropGen:{gen_id}] No session_id - cannot poll transcript")

    lines_read = 0
    final_result = None
    poll_count = 0
    max_polls = 600
    queue_messages_seen = 0

    while poll_count < max_polls:
        if await request.is_disconnected():
            conn._response_queues.pop(req_id, None)
            return

        try:
            final_msg = q.get_nowait()
            queue_messages_seen += 1
            logger.info(f"[PropGen:{gen_id}] Queue msg #{queue_messages_seen} at poll {poll_count}: ok={final_msg.get('ok')} keys={list(final_msg.keys())}")
            
            if final_msg.get("ok"):
                payload = final_msg.get("payload")
                # Check if this is another "accepted" status (skip it)
                if isinstance(payload, dict) and payload.get("status") == "accepted":
                    logger.info(f"[PropGen:{gen_id}] Got another accepted msg, skipping")
                    continue
                final_result = payload
                logger.info(f"[PropGen:{gen_id}] Got final result! payload keys={list(payload.keys()) if isinstance(payload, dict) else type(payload)}")
            elif final_msg.get("error"):
                err_msg = str(final_msg.get("error", {}).get("message", "Agent error"))
                logger.error(f"[PropGen:{gen_id}] Agent error: {err_msg}")
                yield sse_event("error", {"message": err_msg})
                _add_generation_record({
                    "id": gen_id, "prompt": prompt, "name": name,
                    "model": model_key, "modelLabel": model_label, "method": "error",
                    "fullPrompt": full_prompt, "toolCalls": tool_calls_collected,
                    "corrections": [], "diagnostics": [], "parts": [], "code": "",
                    "createdAt": datetime.utcnow().isoformat(), "error": err_msg,
                })
                conn._response_queues.pop(req_id, None)
                return
            else:
                logger.warning(f"[PropGen:{gen_id}] Unknown queue msg format: {json.dumps(final_msg)[:500]}")
                continue
            break
        except asyncio.QueueEmpty:
            pass

        if transcript_path and transcript_path.exists():
            try:
                with open(transcript_path, 'r') as f:
                    all_lines = f.readlines()
                
                new_lines = all_lines[lines_read:]
                lines_read = len(all_lines)

                for line in new_lines:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        role = entry.get("role", "")
                        content = entry.get("content", "")

                        if role == "assistant" and isinstance(content, list):
                            for block in content:
                                if isinstance(block, dict):
                                    bt = block.get("type", "")
                                    if bt == "thinking":
                                        text = block.get("thinking", "")
                                        if text:
                                            for chunk in text.split("\n"):
                                                chunk = chunk.strip()
                                                if chunk:
                                                    yield sse_event("thinking", {"text": chunk})
                                    elif bt == "text":
                                        text = block.get("text", "")
                                        if text:
                                            yield sse_event("text", {"text": text[:200]})
                                    elif bt == "tool_use":
                                        tool_name = block.get("name", "unknown")
                                        tool_input = block.get("input", {})
                                        tool_calls_collected.append({
                                            "name": tool_name,
                                            "input": str(tool_input)[:500],
                                        })
                                        yield sse_event("tool", {
                                            "name": tool_name,
                                            "input": str(tool_input)[:200],
                                            "message": f"🔧 Using tool: {tool_name}"
                                        })
                        elif role == "assistant" and isinstance(content, str) and content:
                            yield sse_event("text", {"text": content[:200]})
                        elif role == "user" and lines_read > 1:
                            if isinstance(content, list):
                                for block in content:
                                    if isinstance(block, dict) and block.get("type") == "tool_result":
                                        yield sse_event("tool_result", {"message": "📋 Tool result received"})
                    except json.JSONDecodeError:
                        continue
            except (OSError, IOError):
                pass

        await asyncio.sleep(0.2)
        poll_count += 1

    conn._response_queues.pop(req_id, None)
    logger.info(f"[PropGen:{gen_id}] Poll loop ended: poll_count={poll_count} queue_msgs={queue_messages_seen} has_result={final_result is not None}")

    if final_result is None:
        logger.info(f"[PropGen:{gen_id}] No result yet, waiting 30s more for final response...")
        try:
            conn._response_queues[req_id] = q
            final_msg = await asyncio.wait_for(q.get(), timeout=30.0)
            logger.info(f"[PropGen:{gen_id}] Late response: ok={final_msg.get('ok')} keys={list(final_msg.keys())}")
            if final_msg.get("ok"):
                final_result = final_msg.get("payload")
            conn._response_queues.pop(req_id, None)
        except asyncio.TimeoutError:
            logger.warning(f"[PropGen:{gen_id}] Final wait also timed out (30s)")
            conn._response_queues.pop(req_id, None)
        except Exception as e:
            logger.error(f"[PropGen:{gen_id}] Final wait error: {e}")
            conn._response_queues.pop(req_id, None)

    # Extract final text
    raw_text = None
    logger.info(f"[PropGen:{gen_id}] Final result type={type(final_result).__name__} value_preview={json.dumps(final_result)[:500] if final_result else 'None'}")
    
    if final_result:
        agent_result = final_result.get("result") if isinstance(final_result, dict) else None
        if isinstance(agent_result, dict):
            payloads = agent_result.get("payloads")
            if isinstance(payloads, list) and payloads:
                raw_text = payloads[0].get("text")
        if not raw_text:
            for key in ("text", "response", "content", "reply"):
                val = final_result.get(key) if isinstance(final_result, dict) else None
                if isinstance(val, str) and val:
                    raw_text = val
                    break

    logger.info(f"[PropGen:{gen_id}] raw_text extracted: {bool(raw_text)} len={len(raw_text) if raw_text else 0}")
    
    if raw_text:
        raw_text = raw_text.strip()
        raw_text = re.sub(r'^```\w*\n', '', raw_text)
        raw_text = re.sub(r'\n```\s*$', '', raw_text)

        ai_parts = _parse_ai_parts(raw_text)
        code = _strip_parts_block(raw_text)

        if 'export function' in code and ('<mesh' in code or 'mesh' in code.lower()):
            # Run post-processor to enhance quality
            from ..services.prop_post_processor import enhance_generated_prop, validate_prop_quality
            
            pp_result = enhance_generated_prop(code)
            code = pp_result.code
            corrections_collected = pp_result.corrections
            diagnostics_collected = []
            
            if pp_result.corrections:
                diagnostics_collected.append(f"✅ Post-processor applied {len(pp_result.corrections)} fixes")
                for fix in pp_result.corrections:
                    diagnostics_collected.append(f"  → {fix}")
            else:
                diagnostics_collected.append("✅ Post-processing: no corrections needed")
            
            if pp_result.warnings:
                for warn in pp_result.warnings:
                    diagnostics_collected.append(f"⚠️ {warn}")
            
            diagnostics_collected.append(f"📊 Quality score: {pp_result.quality_score}/100")
            
            for diag in diagnostics_collected:
                yield sse_event("correction", {"message": diag})

            # Re-parse parts from potentially modified code
            ai_parts_new = _parse_ai_parts(code)
            if ai_parts_new:
                ai_parts = ai_parts_new
            parts = ai_parts if ai_parts else _extract_parts(prompt)
            
            # Validate final quality
            validation = validate_prop_quality(code)
            
            # Save to history
            _add_generation_record({
                "id": gen_id, "prompt": prompt, "name": name,
                "model": model_key, "modelLabel": model_label, "method": "ai",
                "fullPrompt": full_prompt, "toolCalls": tool_calls_collected,
                "corrections": corrections_collected, "diagnostics": diagnostics_collected,
                "parts": parts, "code": code,
                "createdAt": datetime.utcnow().isoformat(), "error": None,
                "qualityScore": pp_result.quality_score, "validation": validation,
            })
            
            yield sse_event("complete", {
                "name": name,
                "filename": f"{name}.tsx",
                "code": code,
                "method": "ai",
                "parts": parts,
                "model": model_key,
                "modelLabel": model_label,
                "generationId": gen_id,
                "qualityScore": pp_result.quality_score,
                "validation": validation,
            })
        else:
            logger.warning(f"AI output invalid for {name}, using template fallback")
            code = _generate_template_code(name, prompt)
            parts = _extract_parts(prompt)
            _add_generation_record({
                "id": gen_id, "prompt": prompt, "name": name,
                "model": model_key, "modelLabel": model_label, "method": "template",
                "fullPrompt": full_prompt, "toolCalls": tool_calls_collected,
                "corrections": [], "diagnostics": ["AI output invalid, used template"],
                "parts": parts, "code": code,
                "createdAt": datetime.utcnow().isoformat(), "error": "AI output validation failed",
            })
            yield sse_event("complete", {
                "name": name, "filename": f"{name}.tsx", "code": code,
                "method": "template", "parts": parts,
                "model": model_key, "modelLabel": model_label, "generationId": gen_id,
            })
    else:
        logger.warning(f"No AI result for {name}, using template fallback")
        code = _generate_template_code(name, prompt)
        parts = _extract_parts(prompt)
        _add_generation_record({
            "id": gen_id, "prompt": prompt, "name": name,
            "model": model_key, "modelLabel": model_label, "method": "template",
            "fullPrompt": full_prompt, "toolCalls": tool_calls_collected,
            "corrections": [], "diagnostics": ["No AI result, used template"],
            "parts": parts, "code": code,
            "createdAt": datetime.utcnow().isoformat(), "error": "No AI response received",
        })
        yield sse_event("complete", {
            "name": name, "filename": f"{name}.tsx", "code": code,
            "method": "template", "parts": parts,
            "model": model_key, "modelLabel": model_label, "generationId": gen_id,
        })


# ─── Routes ──────────────────────────────────────────────────────

@router.get("/models")
async def list_models():
    """List available AI models for prop generation."""
    return {
        "models": [
            {"key": k, **v} for k, v in AVAILABLE_MODELS.items()
        ],
        "default": DEFAULT_MODEL,
    }


@router.get("/generate-prop-stream")
async def generate_prop_stream(
    request: Request,
    prompt: str = Query(..., min_length=1),
    model: str = Query(DEFAULT_MODEL),
):
    """SSE endpoint for streaming prop generation with model choice."""
    name, filename = _prompt_to_filename(prompt.strip())

    return StreamingResponse(
        _stream_prop_generation(request, prompt.strip(), name, model),
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

    name, filename = _prompt_to_filename(req.prompt)
    model_id, model_label = _resolve_model(req.model)
    
    method = "template"
    code = None
    ai_parts = None
    
    if req.use_ai:
        template = _load_prompt_template()
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
                        message=full_prompt, agent_id="dev",
                        timeout=120.0,
                    )
                    if raw:
                        raw = raw.strip()
                        raw = re.sub(r'^```\w*\n', '', raw)
                        raw = re.sub(r'\n```\s*$', '', raw)
                        ai_parts = _parse_ai_parts(raw)
                        code = _strip_parts_block(raw)
                        if 'export function' in code and '<mesh' in code:
                            # Run post-processor
                            from ..services.prop_post_processor import enhance_generated_prop
                            pp_result = enhance_generated_prop(code)
                            code = pp_result.code
                            method = "ai"
                        else:
                            code = None
            except Exception as e:
                logger.warning(f"AI generation error: {e}")
    
    if not code:
        code = _generate_template_code(name, req.prompt)
        method = "template"

    parts = ai_parts if ai_parts else _extract_parts(req.prompt)

    return GeneratePropResponse(
        name=name, filename=filename, code=code, method=method,
        parts=[PropPart(**p) for p in parts],
    )


@router.get("/generation-history")
async def get_generation_history(limit: int = Query(50, ge=1, le=100)):
    """Get generation history with full metadata."""
    history = _load_generation_history()[:limit]
    return {"records": history}


@router.get("/generation-history/{gen_id}")
async def get_generation_record(gen_id: str):
    """Get a specific generation record by ID."""
    for record in _load_generation_history():
        if record.get("id") == gen_id:
            return record
    raise HTTPException(status_code=404, detail="Generation record not found")


@router.post("/save-prop", response_model=SavedPropResponse)
async def save_prop(req: SavePropRequest):
    from datetime import datetime
    
    props = _load_saved_props()
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
    
    return SavedPropResponse(**entry)


@router.get("/saved-props", response_model=list[SavedPropResponse])
async def list_saved_props():
    return [SavedPropResponse(**p) for p in _load_saved_props()]


# ─── Showcase Props Library ───────────────────────────────────────
SHOWCASE_PROPS_DIR = Path(__file__).parent.parent.parent / "data" / "showcase_props"


@router.get("/showcase-props")
async def list_showcase_props():
    """List showcase props as high-quality examples."""
    props = []
    if SHOWCASE_PROPS_DIR.exists():
        for f in sorted(SHOWCASE_PROPS_DIR.glob("*.tsx")):
            name = f.stem
            code = f.read_text()
            mesh_count = len(re.findall(r'<mesh\b', code))
            has_animation = 'useFrame' in code
            has_emissive = 'emissive=' in code
            props.append({
                "name": name,
                "filename": f.name,
                "code": code,
                "isShowcase": True,
                "meshCount": mesh_count,
                "hasAnimation": has_animation,
                "hasEmissive": has_emissive,
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
    props = _load_saved_props()
    new_props = [p for p in props if p["propId"] != prop_id]
    if len(new_props) == len(props):
        raise HTTPException(status_code=404, detail="Prop not found")
    _save_props_to_disk(new_props)
    return {"status": "deleted", "propId": prop_id}


# ─── Phase 2: Multi-Pass & Refinement ───────────────────────────

@router.post("/props/refine", response_model=PropRefinementResponse)
async def refine_prop(req: PropRefinementRequest):
    """Apply user refinements to a generated prop."""
    from ..services.multi_pass_generator import MultiPassGenerator

    # Find the prop in history
    history = _load_generation_history()
    record = None
    for r in history:
        if r.get("id") == req.propId or r.get("name", "").replace(
            r.get("name", "")[0:1].upper() + r.get("name", "")[1:], ""
        ).lower().replace(" ", "-") == req.propId:
            record = r
            break

    if not record or not record.get("code"):
        raise HTTPException(status_code=404, detail="Prop not found or has no code")

    generator = MultiPassGenerator()
    refined_code, diagnostics = generator.apply_refinement(record["code"], req.changes)
    options = generator.get_refinement_options(record.get("prompt", ""))

    return PropRefinementResponse(
        propId=req.propId,
        code=refined_code,
        diagnostics=diagnostics,
        refinementOptions=options,
    )


@router.get("/props/refinement-options")
async def get_refinement_options(prompt: str = Query("", min_length=0)):
    """Get available refinement options for a prop description."""
    from ..services.multi_pass_generator import MultiPassGenerator

    generator = MultiPassGenerator()
    return generator.get_refinement_options(prompt)


# ─── Phase 3: Advanced Features ─────────────────────────────────

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

        scorer = QualityScorer()
        score = scorer.score_prop(improved_code)

        return {
            "code": improved_code,
            "feedbackType": feedback_type,
            "qualityScore": score.to_dict(),
        }
    except Exception as e:
        logger.error(f"Iteration failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/props/style-transfer")
async def apply_style_transfer(req: StyleTransferRequest):
    """Apply a showcase style to a generated prop."""
    from ..services.style_transfer import StyleTransfer
    from ..services.prop_quality_scorer import QualityScorer

    try:
        transfer = StyleTransfer()
        styled_code = await transfer.apply_style(
            generated_code=req.code,
            style_source=req.styleSource,
            component_name=req.componentName,
        )

        scorer = QualityScorer()
        score = scorer.score_prop(styled_code)

        return {
            "code": styled_code,
            "styleSource": req.styleSource,
            "qualityScore": score.to_dict(),
        }
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

    name, filename = _prompt_to_filename(req.prompt.strip())

    try:
        generator = HybridGenerator()
        code = await generator.generate_hybrid(
            description=req.prompt,
            component_name=name,
            template_base=req.templateBase,
        )

        scorer = QualityScorer()
        score = scorer.score_prop(code)

        # Parse parts if available
        ai_parts = _parse_ai_parts(code)
        clean_code = _strip_parts_block(code)
        parts = ai_parts if ai_parts else _extract_parts(req.prompt)

        gen_id = str(_uuid_mod.uuid4())[:8]
        _add_generation_record({
            "id": gen_id, "prompt": req.prompt, "name": name,
            "model": req.model, "modelLabel": "Hybrid",
            "method": "hybrid" if req.templateBase else "ai-enhanced",
            "fullPrompt": "", "toolCalls": [], "corrections": [],
            "diagnostics": [f"Template: {req.templateBase or 'none'}"],
            "parts": parts, "code": clean_code,
            "createdAt": datetime.utcnow().isoformat(), "error": None,
        })

        return {
            "name": name,
            "filename": filename,
            "code": clean_code,
            "method": "hybrid" if req.templateBase else "ai-enhanced",
            "parts": parts,
            "qualityScore": score.to_dict(),
            "generationId": gen_id,
        }
    except Exception as e:
        logger.error(f"Hybrid generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/props/templates")
async def list_templates():
    """List available template bases for hybrid generation."""
    from ..services.hybrid_generator import HybridGenerator
    generator = HybridGenerator()
    return {"templates": generator.get_templates()}


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

        scorer = QualityScorer()
        score = scorer.score_prop(offspring_code)

        ai_parts = _parse_ai_parts(offspring_code)
        clean_code = _strip_parts_block(offspring_code)

        return {
            "code": clean_code,
            "name": req.componentName,
            "parts": ai_parts or [],
            "qualityScore": score.to_dict(),
            "parents": [req.parentAName, req.parentBName],
        }
    except Exception as e:
        logger.error(f"Crossbreeding failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/props/quality-score")
async def score_prop_quality(req: QualityScoreRequest):
    """Score prop code quality objectively."""
    from ..services.prop_quality_scorer import QualityScorer

    scorer = QualityScorer()
    score = scorer.score_prop(req.code)
    return score.to_dict()
