"""Creator Zone service layer.

Sub-modules:
  prop_generator  — template data, detection helpers, code gen, storage
  prop_stream     — SSE async generator for AI-driven prop generation
"""

from .prop_generator import (
    AVAILABLE_MODELS,
    DEFAULT_MODEL,
    SHAPE_TEMPLATES,
    SHAPE_KEYWORD_MAP,
    COLOR_KEYWORDS,
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
]
