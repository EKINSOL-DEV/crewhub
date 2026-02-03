"""
Connection abstraction layer for multi-agent support.

Provides a unified interface for connecting to different AI agent systems:
- OpenClaw Gateway (WebSocket)
- Claude Code CLI (subprocess)
- ChatGPT Codex CLI (subprocess)
"""

from .base import AgentConnection, ConnectionStatus, SessionInfo
from .openclaw import OpenClawConnection
from .claude_code import ClaudeCodeConnection
from .codex import CodexConnection
from .connection_manager import ConnectionManager, get_connection_manager

__all__ = [
    # Base
    "AgentConnection",
    "ConnectionStatus",
    "SessionInfo",
    # Implementations
    "OpenClawConnection",
    "ClaudeCodeConnection",
    "CodexConnection",
    # Manager
    "ConnectionManager",
    "get_connection_manager",
]
