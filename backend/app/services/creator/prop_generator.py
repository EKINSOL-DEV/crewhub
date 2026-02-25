"""Creator Zone — prop generation service layer.

Contains all template data, shape/color detection, code generation,
AI output parsing, prompt utilities, model resolution, and storage
helpers. No FastAPI / HTTP concerns here.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

# ─── Paths ───────────────────────────────────────────────────────

PROMPT_TEMPLATE_PATH = (
    Path(__file__).parent.parent.parent.parent.parent
    / "docs"
    / "features"
    / "creative"
    / "creator-zone"
    / "creator-zone-prompt.md"
)

GENERATION_HISTORY_PATH = Path(__file__).parent.parent.parent.parent / "data" / "generation_history.json"
SAVED_PROPS_PATH = Path(__file__).parent.parent.parent.parent / "data" / "saved_props.json"

# ─── Available Models ─────────────────────────────────────────────

AVAILABLE_MODELS: dict[str, dict] = {
    "opus-4-6": {"id": "anthropic/claude-opus-4-6", "label": "Opus 4-6", "provider": "anthropic"},
    "sonnet-4-5": {"id": "anthropic/claude-sonnet-4-5", "label": "Sonnet 4.5", "provider": "anthropic"},
    "gpt-5-2": {"id": "openai/gpt-5.2", "label": "GPT-5.2", "provider": "openai"},
}
DEFAULT_MODEL = "sonnet-4-5"

# ─── Color Keywords ───────────────────────────────────────────────

COLOR_KEYWORDS: dict[str, str] = {
    "red": "#CC3333",
    "blue": "#3366CC",
    "green": "#338833",
    "yellow": "#CCAA33",
    "purple": "#8833AA",
    "pink": "#CC6699",
    "orange": "#CC6633",
    "white": "#EEEEEE",
    "black": "#333333",
    "brown": "#8B6238",
    "gold": "#DAA520",
    "silver": "#C0C0C0",
    "wooden": "#A0724A",
    "wood": "#A0724A",
    "metal": "#888888",
    "metallic": "#AAAAAA",
    "neon": "#00FF88",
    "glowing": "#FFDD44",
    "dark": "#444444",
    "bright": "#FFCC00",
    "stone": "#888877",
    "crystal": "#88CCEE",
    "rusty": "#8B4513",
    "copper": "#B87333",
}

# ─── Shape Templates ──────────────────────────────────────────────

SHAPE_TEMPLATES: dict[str, dict] = {
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
            ("cylinder", [0, 0.15, 0], [0.06, 0.08, 0.3, 8], "accent"),
            ("sphere", [0, 0.38, 0], [0.2, 12, 12, 0, 6.28, 0, 1.57], "main"),
            ("cylinder", [0, 0.01, 0], [0.12, 0.14, 0.02, 10], "accent"),
        ],
        "main_color": "#CC4444",
        "accent_color": "#EEDDCC",
    },
    "lamp": {
        "parts": [
            ("cylinder", [0, 0.04, 0], [0.18, 0.22, 0.08, 16], "accent"),
            ("cylinder", [0, 0.5, 0], [0.03, 0.03, 0.9, 8], "accent"),
            ("sphere", [0, 1.0, 0], [0.15, 12, 12], "emissive"),
        ],
        "main_color": "#FFDD44",
        "accent_color": "#777777",
    },
    "table": {
        "parts": [
            ("box", [0, 0.4, 0], [0.8, 0.06, 0.5], "main"),
            ("box", [-0.35, 0.18, -0.2], [0.05, 0.36, 0.05], "accent"),
            ("box", [0.35, 0.18, -0.2], [0.05, 0.36, 0.05], "accent"),
            ("box", [-0.35, 0.18, 0.2], [0.05, 0.36, 0.05], "accent"),
            ("box", [0.35, 0.18, 0.2], [0.05, 0.36, 0.05], "accent"),
        ],
        "main_color": "#A0724A",
        "accent_color": "#8B6238",
    },
    "sign": {
        "parts": [
            ("box", [0, 0.6, 0], [0.7, 0.35, 0.04], "emissive"),
            ("cylinder", [0, 0.3, 0], [0.03, 0.03, 0.6, 8], "accent"),
            ("cylinder", [0, 0.01, 0], [0.12, 0.14, 0.02, 10], "accent"),
        ],
        "main_color": "#FF4488",
        "accent_color": "#555555",
    },
    "box": {
        "parts": [
            ("box", [0, 0.2, 0], [0.4, 0.4, 0.4], "main"),
            ("box", [0, 0.41, 0], [0.42, 0.02, 0.42], "accent"),
        ],
        "main_color": "#B8956A",
        "accent_color": "#8B6238",
    },
    "crystal": {
        "parts": [
            ("cone", [0, 0.3, 0], [0.15, 0.6, 6], "emissive"),
            ("cone", [0.12, 0.2, 0.05], [0.08, 0.35, 6], "emissive"),
            ("cone", [-0.08, 0.18, -0.06], [0.06, 0.3, 6], "emissive"),
            ("cylinder", [0, 0.02, 0], [0.2, 0.22, 0.04, 8], "accent"),
        ],
        "main_color": "#88CCEE",
        "accent_color": "#666666",
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
        "main_color": "#6688AA",
        "accent_color": "#555555",
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
        "main_color": "#CC8844",
        "accent_color": "#8B6238",
    },
    "mug": {
        "parts": [
            ("cylinder", [0, 0.18, 0], [0.12, 0.12, 0.32, 16], "main"),
            ("cylinder", [0, 0.18, 0], [0.13, 0.13, 0.02, 16], "accent"),
            ("cylinder", [0, 0.02, 0], [0.12, 0.13, 0.04, 16], "accent"),
            ("torus", [0.16, 0.18, 0], [0.06, 0.015, 8, 16], "accent"),
        ],
        "main_color": "#EEEEEE",
        "accent_color": "#CCCCCC",
    },
    "bottle": {
        "parts": [
            ("cylinder", [0, 0.2, 0], [0.1, 0.1, 0.35, 12], "main"),
            ("cylinder", [0, 0.45, 0], [0.05, 0.1, 0.15, 12], "main"),
            ("cylinder", [0, 0.55, 0], [0.04, 0.04, 0.06, 8], "accent"),
            ("cylinder", [0, 0.02, 0], [0.11, 0.11, 0.04, 12], "accent"),
        ],
        "main_color": "#336644",
        "accent_color": "#555555",
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
        "main_color": "#F5F5DC",
        "accent_color": "#8B6238",
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
        "main_color": "#888888",
        "accent_color": "#555555",
    },
    "book": {
        "parts": [
            ("box", [0, 0.12, 0], [0.3, 0.22, 0.04], "main"),
            ("box", [0, 0.12, 0], [0.28, 0.2, 0.03], "accent"),
            ("box", [-0.15, 0.12, 0], [0.01, 0.22, 0.05], "accent"),
        ],
        "main_color": "#8B2222",
        "accent_color": "#EEDDCC",
    },
    "sword": {
        "parts": [
            ("box", [0, 0.55, 0], [0.04, 0.7, 0.01], "accent"),
            ("box", [0, 0.18, 0], [0.18, 0.04, 0.03], "accent"),
            ("cylinder", [0, 0.1, 0], [0.025, 0.025, 0.14, 8], "main"),
            ("sphere", [0, 0.02, 0], [0.03, 8, 8], "main"),
        ],
        "main_color": "#8B6238",
        "accent_color": "#C0C0C0",
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
        "main_color": "#FF6699",
        "accent_color": "#338833",
    },
    "trophy": {
        "parts": [
            ("cylinder", [0, 0.04, 0], [0.15, 0.18, 0.06, 12], "accent"),
            ("cylinder", [0, 0.12, 0], [0.04, 0.04, 0.12, 8], "accent"),
            ("cylinder", [0, 0.28, 0], [0.14, 0.08, 0.2, 12], "main"),
            ("torus", [-0.18, 0.3, 0], [0.05, 0.015, 8, 12], "main"),
            ("torus", [0.18, 0.3, 0], [0.05, 0.015, 8, 12], "main"),
        ],
        "main_color": "#DAA520",
        "accent_color": "#8B6238",
    },
    "skull": {
        "parts": [
            ("sphere", [0, 0.2, 0], [0.18, 12, 12], "main"),
            ("box", [0, 0.08, 0.1], [0.12, 0.1, 0.08], "main"),
            ("sphere", [-0.06, 0.22, 0.14], [0.03, 8, 8], "accent"),
            ("sphere", [0.06, 0.22, 0.14], [0.03, 8, 8], "accent"),
        ],
        "main_color": "#EEDDCC",
        "accent_color": "#333333",
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
        "main_color": "#2222AA",
        "accent_color": "#333333",
    },
    "tree": {
        "parts": [
            ("cylinder", [0, 0.3, 0], [0.08, 0.1, 0.6, 8], "accent"),
            ("cone", [0, 0.8, 0], [0.35, 0.5, 8], "main"),
            ("cone", [0, 1.05, 0], [0.25, 0.4, 8], "main"),
        ],
        "main_color": "#338833",
        "accent_color": "#8B6238",
    },
}

DEFAULT_SHAPE = "box"

SHAPE_KEYWORD_MAP: dict[str, list[str]] = {
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

# ─── Model Utilities ──────────────────────────────────────────────


def resolve_model(model_key: str) -> tuple[str, str]:
    """Resolve model key to (model_id, label). Falls back to DEFAULT_MODEL."""
    if model_key not in AVAILABLE_MODELS:
        logger.warning(f"Unknown model key '{model_key}', falling back to {DEFAULT_MODEL}")
        model_key = DEFAULT_MODEL
    info = AVAILABLE_MODELS[model_key]
    return info["id"], info["label"]


# ─── Filename / Name Utilities ────────────────────────────────────


def prompt_to_filename(prompt: str) -> tuple[str, str]:
    """Convert a prompt string into a PascalCase component name and .tsx filename."""
    words = re.sub(r"[^a-zA-Z0-9\s]", "", prompt).split()[:4]
    pascal = "".join(w.capitalize() for w in words) if words else "CustomProp"
    return pascal, f"{pascal}.tsx"


# ─── Prompt Template ──────────────────────────────────────────────


def load_prompt_template() -> str:
    try:
        return PROMPT_TEMPLATE_PATH.read_text()
    except FileNotFoundError:
        logger.warning(f"Prompt template not found at {PROMPT_TEMPLATE_PATH}")
        return ""


# ─── Shape / Color Detection ─────────────────────────────────────


def detect_shape(prompt: str) -> str:
    lower = prompt.lower()
    for shape, keywords in SHAPE_KEYWORD_MAP.items():
        for kw in keywords:
            if kw in lower:
                return shape
    return DEFAULT_SHAPE


def detect_color(prompt: str, default: str) -> str:
    lower = prompt.lower()
    for kw, color in COLOR_KEYWORDS.items():
        if kw in lower:
            return color
    return default


# ─── Parts Extraction ────────────────────────────────────────────


def extract_parts(prompt: str) -> list[dict]:
    shape_key = detect_shape(prompt)
    shape = SHAPE_TEMPLATES[shape_key]
    main_color = detect_color(prompt, shape["main_color"])
    accent_color = shape["accent_color"]

    parts = []
    for geo_type, pos, args, color_role in shape["parts"]:
        color = main_color if color_role in ("main", "emissive") else accent_color
        parts.append(
            {
                "type": geo_type,
                "position": pos,
                "rotation": [0, 0, 0],
                "args": [float(a) for a in args],
                "color": color,
                "emissive": color_role == "emissive",
            }
        )
    return parts


# ─── Template Code Generation ────────────────────────────────────


def generate_template_code(name: str, prompt: str) -> str:
    shape_key = detect_shape(prompt)
    shape = SHAPE_TEMPLATES[shape_key]
    main_color = detect_color(prompt, shape["main_color"])
    accent_color = shape["accent_color"]

    hooks: list[str] = []
    meshes: list[str] = []
    hook_names: dict[str, str] = {}

    geo_map = {
        "box": "boxGeometry",
        "cylinder": "cylinderGeometry",
        "sphere": "sphereGeometry",
        "cone": "coneGeometry",
        "torus": "torusGeometry",
    }

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

    return (
        f"import {{ useToonMaterialProps }} from '../../utils/toonMaterials'\n\n"
        f"interface {name}Props {{\n"
        f"  position?: [number, number, number]\n"
        f"  scale?: number\n"
        f"}}\n\n"
        f"export function {name}({{ position = [0, 0, 0], scale = 1 }}: {name}Props) {{\n"
        f"{hooks_str}\n\n"
        f"  return (\n"
        f"    <group position={{position}} scale={{scale}}>\n"
        f"{meshes_str}\n"
        f"    </group>\n"
        f"  )\n"
        f"}}\n"
    )


# ─── AI Output Parsing ───────────────────────────────────────────


def parse_ai_parts(raw: str) -> list[dict] | None:
    match = re.search(r"/\*\s*PARTS_DATA\s*\n(.*?)\nPARTS_DATA\s*\*/", raw, re.DOTALL)
    if not match:
        return None
    try:
        parts = json.loads(match.group(1).strip())
        if isinstance(parts, list) and len(parts) > 0:
            for p in parts:
                if "rotation" not in p:
                    p["rotation"] = [0, 0, 0]
            return parts
    except (json.JSONDecodeError, ValueError):
        pass
    return None


def strip_parts_block(code: str) -> str:
    return re.sub(
        r"/\*\s*PARTS_DATA\s*\n.*?\nPARTS_DATA\s*\*/",
        "",
        code,
        flags=re.DOTALL,
    ).strip()


# ─── Storage Helpers ─────────────────────────────────────────────


def load_generation_history() -> list[dict]:
    try:
        if GENERATION_HISTORY_PATH.exists():
            return json.loads(GENERATION_HISTORY_PATH.read_text())
    except Exception:
        pass
    return []


def save_generation_history(records: list[dict]) -> None:
    GENERATION_HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    GENERATION_HISTORY_PATH.write_text(json.dumps(records, indent=2))


def add_generation_record(record: dict) -> None:
    try:
        history = load_generation_history()
        history.insert(0, record)
        history = history[:100]
        save_generation_history(history)
    except Exception as e:
        logger.error(f"Failed to save generation record: {e}")


def load_saved_props() -> list[dict]:
    try:
        if SAVED_PROPS_PATH.exists():
            return json.loads(SAVED_PROPS_PATH.read_text())
    except Exception:
        pass
    return []


def save_props_to_disk(props: list[dict]) -> None:
    SAVED_PROPS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SAVED_PROPS_PATH.write_text(json.dumps(props, indent=2))
