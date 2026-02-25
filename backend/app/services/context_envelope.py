"""
CrewHub Context Envelope - lightweight JSON context for sub-agents.

Builds a ≤2KB JSON envelope with room/project/participants/tasks info,
respecting privacy tiers (internal vs external channels).
"""

import hashlib
import json
import logging
from typing import Any, Optional

import aiosqlite

from app.db.database import get_db

logger = logging.getLogger(__name__)

# External channels where participants/tasks should be redacted
EXTERNAL_CHANNELS = {"whatsapp", "slack", "discord", "telegram", "sms", "email"}

SCHEMA_VERSION = 1

# Map common hex colors to friendly names
COLOR_NAMES = {
    "#3b82f6": "blue",
    "#f97316": "orange",
    "#8b5cf6": "purple",
    "#ec4899": "pink",
    "#10b981": "green",
    "#ef4444": "red",
    "#f59e0b": "amber",
    "#06b6d4": "cyan",
    "#84cc16": "lime",
    "#6366f1": "indigo",
    "#14b8a6": "teal",
    "#f43f5e": "rose",
}


def _canonical_json(obj: dict) -> str:
    """Deterministic JSON for hashing (sorted keys, no whitespace)."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _compute_hash(envelope: dict) -> str:
    """SHA-256 of canonical JSON (excluding the hash field itself)."""
    hashable = {k: v for k, v in envelope.items() if k != "context_hash" and not k.startswith("_")}
    return hashlib.sha256(_canonical_json(hashable).encode()).hexdigest()[:16]


async def build_crewhub_context(
    room_id: str,
    channel: Optional[str] = None,
    max_tasks: int = 10,
    session_key: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """
    Build a CrewHub context envelope for injection into agent preambles.

    Args:
        room_id: The room ID to build context for.
        channel: Origin channel (e.g. 'whatsapp', 'crewhub-ui').
        max_tasks: Maximum number of tasks to include.

    Returns:
        Context envelope dict, or None if room not found.
    """
    try:
        async with get_db() as db:
            # Determine privacy tier
            privacy = "external" if channel and channel.lower() in EXTERNAL_CHANNELS else "internal"

            # 1. Room
            async with db.execute(
                "SELECT id, name, is_hq, project_id FROM rooms WHERE id = ?",
                (room_id,),
            ) as cur:
                room_row = await cur.fetchone()

            if not room_row:
                return None

            room = {
                "id": room_row["id"],
                "name": room_row["name"],
                "type": "hq" if room_row["is_hq"] else "standard",
            }

            # 2. Projects linked to this room
            project_id = room_row["project_id"]
            projects: list[dict] = []
            if project_id:
                async with db.execute(
                    "SELECT id, name, folder_path FROM projects WHERE id = ?",
                    (project_id,),
                ) as cur:
                    proj_row = await cur.fetchone()
                if proj_row:
                    p: dict[str, Any] = {"id": proj_row["id"], "name": proj_row["name"]}
                    if proj_row["folder_path"]:
                        p["repo"] = proj_row["folder_path"]
                    projects.append(p)

            # 3. Participants (agents assigned to this room) — internal only
            participants: list[dict] = []
            if privacy == "internal":
                async with db.execute(
                    """SELECT a.id, a.name, a.agent_session_key,
                              d.display_name
                       FROM agents a
                       LEFT JOIN session_display_names d ON a.agent_session_key = d.session_key
                       WHERE a.default_room_id = ?""",
                    (room_id,),
                ) as cur:
                    async for row in cur:
                        handle = row["display_name"] or row["name"] or row["id"]
                        participants.append({"role": "agent", "handle": handle})

            # 4. Tasks — internal only
            tasks: list[dict] = []
            if privacy == "internal" and project_id:
                async with db.execute(
                    """SELECT t.id, t.title, t.status, d.display_name
                       FROM tasks t
                       LEFT JOIN session_display_names d ON t.assigned_session_key = d.session_key
                       WHERE t.project_id = ? AND t.status != 'done'
                       ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
                               t.updated_at DESC
                       LIMIT ?""",
                    (project_id, max_tasks),
                ) as cur:
                    async for row in cur:
                        t: dict[str, Any] = {
                            "id": row["id"],
                            "title": row["title"],
                            "status": row["status"],
                        }
                        if row["display_name"]:
                            t["assignee"] = row["display_name"]
                        tasks.append(t)

            # 5. Self-identity — resolve who the calling agent is
            self_identity: Optional[dict[str, str]] = None
            if session_key:
                # Try matching agent by session_key directly
                async with db.execute(
                    "SELECT id, name, color, agent_session_key FROM agents WHERE agent_session_key = ?",
                    (session_key,),
                ) as cur:
                    agent_row = await cur.fetchone()
                if not agent_row and ":" in session_key:
                    # For sub-sessions like agent:main:slack:..., try the base key
                    parts = session_key.split(":")
                    if len(parts) >= 2:
                        base_key = f"agent:{parts[1]}:main"
                        async with db.execute(
                            "SELECT id, name, color, agent_session_key FROM agents WHERE agent_session_key = ?",
                            (base_key,),
                        ) as cur:
                            agent_row = await cur.fetchone()
                if agent_row:
                    # Resolve display name: session_display_names > agents.name > agent_id
                    display_name = agent_row["name"]
                    # Try to get display name from session_display_names
                    # Check both the calling session_key and the agent's base session_key
                    lookup_keys = [session_key]
                    try:
                        ask = agent_row["agent_session_key"]
                        if ask and ask != session_key:
                            lookup_keys.append(ask)
                    except (IndexError, KeyError):
                        pass
                    for sk in lookup_keys:
                        async with db.execute(
                            "SELECT display_name FROM session_display_names WHERE session_key = ?",
                            (sk,),
                        ) as cur:
                            dn_row = await cur.fetchone()
                        if dn_row and dn_row["display_name"]:
                            display_name = dn_row["display_name"]
                            break
                    self_identity = {
                        "handle": display_name,
                        "agentId": agent_row["id"],
                        "role": "agent",
                    }
                    if agent_row["color"]:
                        self_identity["color"] = agent_row["color"]

            # 6. Context version — count of mutations (simple: max updated_at across relevant tables)
            context_version = await _get_context_version(db, room_id, project_id)

            # Build envelope
            envelope: dict[str, Any] = {
                "v": SCHEMA_VERSION,
                "room": room,
                "projects": projects,
                "privacy": privacy,
                "context_version": context_version,
            }

            if self_identity:
                envelope["self"] = self_identity

            if privacy == "internal":
                if participants:
                    envelope["participants"] = participants
                if tasks:
                    envelope["tasks"] = tasks

            # Attach persona + identity prompt (not included in hash, stripped before serialization)
            if self_identity and self_identity.get("agentId"):
                persona_prompt = await get_persona_prompt(
                    self_identity["agentId"],
                    channel=channel,
                    agent_name=self_identity.get("handle"),
                )
                if persona_prompt:
                    envelope["_persona_prompt"] = persona_prompt

            # Add integrity hash (excludes _persona_prompt since it starts with _)
            envelope["context_hash"] = _compute_hash(envelope)

            return envelope

    except Exception as e:
        logger.error(f"Failed to build context envelope for room {room_id}: {e}")
        return None


async def _get_context_version(
    db: aiosqlite.Connection,
    room_id: str,
    project_id: Optional[str],
) -> int:
    """
    Compute a context_version as max(updated_at) across room, project, tasks, agents.
    This increments whenever any relevant entity is mutated.
    """
    candidates = []

    async with db.execute("SELECT updated_at FROM rooms WHERE id = ?", (room_id,)) as cur:
        row = await cur.fetchone()
        if row:
            candidates.append(row["updated_at"])

    if project_id:
        async with db.execute("SELECT updated_at FROM projects WHERE id = ?", (project_id,)) as cur:
            row = await cur.fetchone()
            if row:
                candidates.append(row["updated_at"])

        async with db.execute(
            "SELECT MAX(updated_at) as m FROM tasks WHERE project_id = ?",
            (project_id,),
        ) as cur:
            row = await cur.fetchone()
            if row and row["m"]:
                candidates.append(row["m"])

    async with db.execute(
        "SELECT MAX(updated_at) as m FROM agents WHERE default_room_id = ?",
        (room_id,),
    ) as cur:
        row = await cur.fetchone()
        if row and row["m"]:
            candidates.append(row["m"])

    return max(candidates) if candidates else 0


async def get_persona_prompt(
    agent_id: str,
    channel: Optional[str] = None,
    agent_name: Optional[str] = None,
) -> Optional[str]:
    """Build persona + identity prompt fragment for an agent, or None if no persona configured.

    When a channel is specified, includes identity stability rules and
    surface-specific format hints (Agent Identity Pattern).
    """
    from app.services.personas import build_full_persona_prompt, build_persona_prompt

    try:
        async with get_db() as db:
            async with db.execute("SELECT * FROM agent_personas WHERE agent_id = ?", (agent_id,)) as cur:
                row = await cur.fetchone()
            if not row:
                return None

            # Read identity fields safely (may not exist on older schemas)
            identity_anchor = ""
            surface_rules = ""
            try:
                identity_anchor = row["identity_anchor"] or ""
            except (IndexError, KeyError):
                pass
            try:
                surface_rules = row["surface_rules"] or ""
            except (IndexError, KeyError):
                pass

            # Check for per-surface custom rules
            surface_format = ""
            if channel:
                try:
                    async with db.execute(
                        "SELECT format_rules, enabled FROM agent_surfaces WHERE agent_id = ? AND surface = ?",
                        (agent_id, channel.lower()),
                    ) as scur:
                        srow = await scur.fetchone()
                    if srow and srow["enabled"]:
                        surface_format = srow["format_rules"] or ""
                except Exception:
                    pass

            # Build full prompt with identity if we have identity data
            if identity_anchor or channel:
                full_surface_rules = surface_rules
                if surface_format:
                    full_surface_rules = (
                        f"{surface_rules}\n{surface_format}".strip() if surface_rules else surface_format
                    )

                return build_full_persona_prompt(
                    start_behavior=row["start_behavior"],
                    checkin_frequency=row["checkin_frequency"],
                    response_detail=row["response_detail"],
                    approach_style=row["approach_style"],
                    custom_instructions=row["custom_instructions"] or "",
                    identity_anchor=identity_anchor,
                    surface_rules=full_surface_rules,
                    current_surface=channel,
                    agent_name=agent_name,
                )
            else:
                # Legacy behavior: just persona prompt
                return build_persona_prompt(
                    start_behavior=row["start_behavior"],
                    checkin_frequency=row["checkin_frequency"],
                    response_detail=row["response_detail"],
                    approach_style=row["approach_style"],
                    custom_instructions=row["custom_instructions"] or "",
                )
    except Exception as e:
        logger.error(f"Failed to get persona prompt for agent {agent_id}: {e}")
        return None


def format_context_block(envelope: dict) -> str:
    """Format envelope as a fenced JSON block for injection into preamble."""
    compact = json.dumps(envelope, separators=(",", ":"), ensure_ascii=False)
    block = f"```crewhub-context\n{compact}\n```"

    # Add human-readable identity line + visual appearance
    self_info = envelope.get("self")
    if self_info:
        handle = self_info["handle"]
        block += f"\n\n**You are {handle}** — your display name in CrewHub."

        # Visual appearance in 3D world
        color_hex = self_info.get("color")
        if color_hex:
            color_name = COLOR_NAMES.get(color_hex.lower(), color_hex)
        else:
            color_name = "unknown"

        block += f"""

**Visual appearance in 3D world:**
- Color: {color_name}
- You appear as a bot character made of two stacked rounded boxes
- When active: you carry a laptop and work at a desk
- When idle: you wander around the campus between rooms
- Environment: toon-shaded office building on a grid

(You may have a different personal identity in your workspace files.)"""

    # Persona + identity guidelines (injected if available)
    # The prompt may already include ## Identity and ## Behavior Guidelines sections
    persona_prompt = envelope.get("_persona_prompt")
    if persona_prompt:
        block += f"\n\n{persona_prompt}"

    return block
