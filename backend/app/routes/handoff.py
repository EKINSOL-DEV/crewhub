"""
Handoff API routes.

Provides endpoints for discovering available handoff targets
and executing agent session handoffs to external tools.
"""

import logging
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from ..services.connections import get_connection_manager
from ..services.handoff import get_handoff_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class HandoffRequest(BaseModel):
    """Request body for executing a handoff."""

    target: str  # "iterm" | "terminal" | "warp" | "vscode" | "clipboard"
    working_dir: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/targets")
async def get_handoff_targets():
    """Get available handoff targets on this machine.

    Returns auto-detected targets (terminals, VS Code, clipboard).
    Called once on frontend load and cached.
    """
    service = get_handoff_service()
    targets = service.detect_available_targets()
    return {"targets": [t.to_dict() for t in targets]}


@router.post("/sessions/{session_key:path}")
async def execute_handoff(session_key: str, body: HandoffRequest):
    """Execute a handoff for a specific session.

    Resolves the session key to a Claude CLI session ID (if possible),
    builds the resume command, and executes the handoff to the target.

    Args:
        session_key: Session key (e.g., claude:<uuid>, cc:<agent-id>, agent:main:main)
        body: Handoff request with target and optional working directory
    """
    service = get_handoff_service()

    # Resolve session key to Claude session ID and project path
    session_id, project_path, source = await _resolve_session(session_key)

    # Allow working_dir override from request
    working_dir = body.working_dir or project_path

    # Build the CLI command
    command = service.build_command(
        session_id=session_id,
        project_path=working_dir,
        source=source,
    )

    # For clipboard target, no server-side execution needed beyond building the command
    # But we still go through execute_handoff for consistency and clipboard copy
    result = service.execute_handoff(
        command=command,
        target=body.target,
        working_dir=working_dir,
    )

    if not result.success:
        # If terminal/vscode fails, include the command so frontend can fallback to clipboard
        return {
            "success": False,
            "error": result.error,
            "target": result.target,
            "command": command,
            "fallback_command": command,
        }

    return result.to_dict()


# ---------------------------------------------------------------------------
# Session resolution helpers
# ---------------------------------------------------------------------------


async def _resolve_session(session_key: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Resolve a session key to (session_id, project_path, source).

    Returns:
        Tuple of (claude_session_id, project_path, source_type).
        session_id may be None for non-Claude sessions.
    """
    # Claude Code session: claude:<uuid>
    if session_key.startswith("claude:"):
        session_id = session_key[7:]
        project_path = await _get_session_project_path(session_key)
        return session_id, project_path, "claude_code"

    # CC agent session: cc:<agent-id>
    if session_key.startswith("cc:"):
        agent_id = session_key[3:]
        from ..services.cc_chat import _agent_sessions

        cc_session_id = _agent_sessions.get(agent_id)
        if cc_session_id:
            project_path = await _get_session_project_path(f"claude:{cc_session_id}")
            return cc_session_id, project_path, "claude_code"
        return None, None, "cc"

    # OpenClaw agent session: agent:*
    project_path = await _get_session_project_path(session_key)
    return None, project_path, "openclaw"


async def _get_session_project_path(session_key: str) -> Optional[str]:
    """Try to determine the project path for a session.

    Looks at the session metadata from the connection manager.
    Falls back to None if not determinable.
    """
    try:
        manager = await get_connection_manager()
        sessions = await manager.get_all_sessions()
        for s in sessions:
            if s.key == session_key:
                # Check for projectPath or cwd in session data
                raw = s.to_dict()
                return raw.get("projectPath") or raw.get("cwd")
    except Exception as e:
        logger.debug("Could not resolve project path for %s: %s", session_key, e)
    return None
