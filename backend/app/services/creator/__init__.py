"""Creator Zone service layer.

Sub-modules:
  prop_generator  — template data, detection helpers, code gen, storage
  prop_stream     — SSE async generator for AI-driven prop generation
  prop_ai         — OpenClaw AI call + post-processing wrapper
  prop_crud       — blueprint usage lookup, cascade delete, part helpers
"""

from .prop_ai import generate_prop_via_ai
from .prop_crud import (
    apply_color_changes_to_parts,
    cascade_delete_prop_from_blueprints,
    find_prop_usage_in_blueprints,
    persist_refined_prop,
)
from .prop_generator import (
    AVAILABLE_MODELS,
    COLOR_KEYWORDS,
    DEFAULT_MODEL,
    SHAPE_KEYWORD_MAP,
    SHAPE_TEMPLATES,
    add_generation_record,
    detect_color,
    detect_shape,
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
)
from .prop_stream import stream_prop_generation

__all__ = [
    "AVAILABLE_MODELS",
    "DEFAULT_MODEL",
    "SHAPE_TEMPLATES",
    "SHAPE_KEYWORD_MAP",
    "COLOR_KEYWORDS",
    "add_generation_record",
    "detect_color",
    "detect_shape",
    "extract_parts",
    "generate_template_code",
    "load_generation_history",
    "load_prompt_template",
    "load_saved_props",
    "parse_ai_parts",
    "prompt_to_filename",
    "resolve_model",
    "save_generation_history",
    "save_props_to_disk",
    "strip_parts_block",
    "stream_prop_generation",
    "generate_prop_via_ai",
    "apply_color_changes_to_parts",
    "cascade_delete_prop_from_blueprints",
    "find_prop_usage_in_blueprints",
    "persist_refined_prop",
]
