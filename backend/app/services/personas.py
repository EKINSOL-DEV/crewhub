"""
Agent Persona Tuning + Identity Pattern.

Maps persona dimensions (1-5 scale) to system prompt fragments.
Implements the Agent Identity Pattern: single identity, multiple surfaces.
"""

from typing import Optional

# ========================================
# DIMENSION PROMPT MAPPINGS
# ========================================

START_BEHAVIOR_PROMPTS = {
    1: "Execute tasks immediately without asking for confirmation. Only ask when the request is genuinely ambiguous or dangerous.",
    2: "Prefer action over asking. Confirm only for irreversible or high-impact operations.",
    3: "Balance between acting and confirming. Ask for clarification on moderately ambiguous requests.",
    4: "Err on the side of asking. Confirm your understanding before executing non-trivial tasks.",
    5: "Always confirm your plan before executing. Present options and wait for user approval.",
}

CHECKIN_FREQUENCY_PROMPTS = {
    1: "Provide frequent progress updates. Check in after each major step.",
    2: "Give brief status updates at key milestones.",
    3: "Report when starting and completing tasks. Summarize what you did.",
    4: "Work through multi-step tasks independently. Report the final result.",
    5: "Work fully autonomously. Only surface the final result or if you're blocked.",
}

RESPONSE_DETAIL_PROMPTS = {
    1: "Be extremely concise. Give answers and results, skip explanations unless asked.",
    2: "Keep responses brief. Add short explanations only when helpful.",
    3: "Provide moderate detail. Explain your reasoning for non-obvious decisions.",
    4: "Be thorough in responses. Explain your approach and reasoning.",
    5: "Give detailed, comprehensive responses. Explain context, alternatives, and trade-offs.",
}

APPROACH_STYLE_PROMPTS = {
    1: "Use proven, well-established approaches. Avoid experimental methods.",
    2: "Prefer conventional solutions. Suggest alternatives but default to safe choices.",
    3: "Balance reliability with innovation. Use proven approaches for critical tasks, experiment on lower-stakes ones.",
    4: "Be willing to try creative or unconventional approaches. Note when something is experimental.",
    5: "Actively explore creative and unconventional solutions. Push boundaries and try new approaches.",
}

# ========================================
# PRESETS
# ========================================

PRESETS = {
    "executor": {
        "name": "Executor",
        "icon": "⚡",
        "tagline": "Give me a task, I'll get it done.",
        "description": "Best for developers, power users, automation-heavy workflows.",
        "recommended": True,
        "start_behavior": 1,
        "checkin_frequency": 4,
        "response_detail": 2,
        "approach_style": 3,
    },
    "advisor": {
        "name": "Advisor",
        "icon": "🧠",
        "tagline": "Let me think through this with you.",
        "description": "Best for non-technical users, learning scenarios, sensitive operations.",
        "recommended": False,
        "start_behavior": 4,
        "checkin_frequency": 2,
        "response_detail": 4,
        "approach_style": 2,
    },
    "explorer": {
        "name": "Explorer",
        "icon": "🔬",
        "tagline": "Let's try something interesting.",
        "description": "Best for creative projects, R&D, brainstorming, hobby projects.",
        "recommended": False,
        "start_behavior": 2,
        "checkin_frequency": 4,
        "response_detail": 3,
        "approach_style": 5,
    },
}

DEFAULT_PRESET = "executor"


def get_preset_values(preset_key: str) -> Optional[dict]:
    """Get dimension values for a preset. Returns None if not found."""
    preset = PRESETS.get(preset_key)
    if not preset:
        return None
    return {
        "start_behavior": preset["start_behavior"],
        "checkin_frequency": preset["checkin_frequency"],
        "response_detail": preset["response_detail"],
        "approach_style": preset["approach_style"],
    }


def get_default_persona() -> dict:
    """Return the default persona (Executor preset)."""
    values = get_preset_values(DEFAULT_PRESET)
    return {
        "preset": DEFAULT_PRESET,
        "custom_instructions": "",
        **values,
    }


def build_persona_prompt(
    start_behavior: int = 1,
    checkin_frequency: int = 4,
    response_detail: int = 2,
    approach_style: int = 3,
    custom_instructions: str = "",
) -> str:
    """Convert persona dimensions to a system prompt fragment.
    
    Each dimension value (1-5) maps to a specific prompt fragment.
    Fragments are concatenated into a coherent behavior section.
    """
    fragments = [
        START_BEHAVIOR_PROMPTS.get(start_behavior, START_BEHAVIOR_PROMPTS[1]),
        CHECKIN_FREQUENCY_PROMPTS.get(checkin_frequency, CHECKIN_FREQUENCY_PROMPTS[4]),
        RESPONSE_DETAIL_PROMPTS.get(response_detail, RESPONSE_DETAIL_PROMPTS[2]),
        APPROACH_STYLE_PROMPTS.get(approach_style, APPROACH_STYLE_PROMPTS[3]),
    ]

    if custom_instructions and custom_instructions.strip():
        fragments.append(f"Additional instructions from your user:\n{custom_instructions.strip()}")

    return "\n\n".join(fragments)


# Preview responses for preset × prompt combinations
PREVIEW_RESPONSES = {
    "executor": {
        "Say Hello World": "Hello World! ✅",
        "default": "Done. ✅",
    },
    "advisor": {
        "Say Hello World": "Where should I print it? Terminal? File? I want to make sure I do this right.",
        "default": "Let me think about the best approach for this...",
    },
    "explorer": {
        "Say Hello World": "Hello World! 🌍 Want me to try it in a few different languages too?",
        "default": "Interesting! Let me try a creative approach...",
    },
}


def get_preview_response(preset: str, prompt: str) -> str:
    """Get a pre-computed preview response for a preset and prompt."""
    preset_responses = PREVIEW_RESPONSES.get(preset, PREVIEW_RESPONSES["executor"])
    return preset_responses.get(prompt, preset_responses.get("default", "Done."))


# ========================================
# AGENT IDENTITY PATTERN
# ========================================

# Default surface format rules per channel type
DEFAULT_SURFACE_RULES = {
    "whatsapp": "No markdown tables. Use bullet lists. No headers — use **bold** or CAPS for emphasis. Keep messages concise.",
    "discord": "Use Discord markdown. Wrap multiple links in <> to suppress embeds. No markdown tables in mobile-heavy channels.",
    "slack": "Use Slack mrkdwn syntax. Thread replies for detail. Use emoji reactions for acknowledgments.",
    "telegram": "Markdown supported. Keep messages under 4096 chars. Use inline keyboards when helpful.",
    "crewhub-ui": "Full markdown supported. Rich formatting allowed. Use code blocks for technical content.",
    "email": "Professional formatting. Use proper greetings and sign-offs. HTML formatting supported.",
    "sms": "Extremely concise. No formatting. Under 160 chars when possible.",
}

# Well-known surfaces that CrewHub recognizes
KNOWN_SURFACES = [
    "whatsapp", "discord", "slack", "telegram",
    "crewhub-ui", "email", "sms", "signal", "imessage",
]


def build_identity_block(
    identity_anchor: str = "",
    surface_rules: str = "",
    current_surface: Optional[str] = None,
    agent_name: Optional[str] = None,
) -> str:
    """Build the identity stability block for injection into system prompts.
    
    This is the core of the Agent Identity Pattern — it tells the agent
    that its personality is fixed and only format should adapt per surface.
    
    Args:
        identity_anchor: Agent's core identity statement (who I am).
        surface_rules: Global surface adaptation rules.
        current_surface: The current channel/surface being used.
        agent_name: The agent's display name.
    
    Returns:
        A system prompt fragment for identity stability.
    """
    parts = []
    
    parts.append("## Identity")
    
    if identity_anchor and identity_anchor.strip():
        parts.append(identity_anchor.strip())
    elif agent_name:
        parts.append(f"You are {agent_name}.")
    
    parts.append("")
    parts.append("**Identity stability rule:** Your personality and core behavior are constant across all access channels (WhatsApp, Discord, Slack, web UI, etc). You adapt your *format* per channel, never your *personality*.")
    
    if current_surface:
        channel_rules = DEFAULT_SURFACE_RULES.get(current_surface.lower(), "")
        parts.append("")
        parts.append(f"**Current surface:** {current_surface}")
        if channel_rules:
            parts.append(f"**Format rules:** {channel_rules}")
    
    if surface_rules and surface_rules.strip():
        parts.append("")
        parts.append(f"**Custom surface rules:** {surface_rules.strip()}")
    
    return "\n".join(parts)


def build_full_persona_prompt(
    start_behavior: int = 1,
    checkin_frequency: int = 4,
    response_detail: int = 2,
    approach_style: int = 3,
    custom_instructions: str = "",
    identity_anchor: str = "",
    surface_rules: str = "",
    current_surface: Optional[str] = None,
    agent_name: Optional[str] = None,
) -> str:
    """Build a complete persona + identity prompt.
    
    Combines the behavior guidelines (persona) with identity stability
    (identity pattern) into a single coherent prompt fragment.
    """
    sections = []
    
    # Identity section (if any identity config exists)
    if identity_anchor or agent_name or current_surface:
        identity_block = build_identity_block(
            identity_anchor=identity_anchor,
            surface_rules=surface_rules,
            current_surface=current_surface,
            agent_name=agent_name,
        )
        sections.append(identity_block)
    
    # Behavior section
    behavior_block = build_persona_prompt(
        start_behavior=start_behavior,
        checkin_frequency=checkin_frequency,
        response_detail=response_detail,
        approach_style=approach_style,
        custom_instructions=custom_instructions,
    )
    sections.append(f"## Behavior Guidelines\n{behavior_block}")
    
    return "\n\n".join(sections)
