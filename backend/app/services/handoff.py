"""
Agent Handoff Service.

Constructs CLI commands and executes handoff to external tools
(terminal, VS Code, clipboard).
"""

import logging
import os
import shutil
import subprocess
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class HandoffTarget:
    """An available handoff target."""

    id: str
    label: str
    icon: str
    available: bool = True

    def to_dict(self) -> dict:
        return {"id": self.id, "label": self.label, "icon": self.icon, "available": self.available}


@dataclass
class HandoffResult:
    """Result of a handoff execution."""

    success: bool
    target: str
    command: str
    message: str
    error: Optional[str] = None

    def to_dict(self) -> dict:
        d: dict = {
            "success": self.success,
            "target": self.target,
            "command": self.command,
            "message": self.message,
        }
        if self.error:
            d["error"] = self.error
        return d


# ---------------------------------------------------------------------------
# Terminal detection
# ---------------------------------------------------------------------------

_TERMINAL_APPS = [
    ("/Applications/iTerm.app", "iterm", "iTerm2"),
    ("/Applications/Warp.app", "warp", "Warp"),
    ("/System/Applications/Utilities/Terminal.app", "terminal", "Terminal"),
    ("/Applications/Utilities/Terminal.app", "terminal", "Terminal"),
]


def _detect_terminal() -> tuple[str, str]:
    """Return (id, label) for the first detected terminal app."""
    for path, tid, label in _TERMINAL_APPS:
        if os.path.exists(path):
            return tid, label
    return "terminal", "Terminal"


def _has_vscode() -> bool:
    """Check if VS Code CLI is available."""
    return shutil.which("code") is not None


# ---------------------------------------------------------------------------
# HandoffService
# ---------------------------------------------------------------------------


class HandoffService:
    """Handles agent session handoff to external tools."""

    # -- target discovery ----------------------------------------------------

    def detect_available_targets(self) -> list[HandoffTarget]:
        """Detect which handoff targets are available on this machine."""
        targets: list[HandoffTarget] = []

        # Primary: terminal
        tid, tlabel = _detect_terminal()
        targets.append(HandoffTarget(id=tid, label=tlabel, icon="terminal"))

        # Secondary: VS Code
        if _has_vscode():
            targets.append(HandoffTarget(id="vscode", label="VS Code Terminal", icon="code"))

        # Universal fallback: clipboard
        targets.append(HandoffTarget(id="clipboard", label="Copy Command", icon="clipboard"))

        return targets

    # -- command building ----------------------------------------------------

    @staticmethod
    def build_command(
        session_id: Optional[str] = None,
        project_path: Optional[str] = None,
        source: Optional[str] = None,
    ) -> str:
        """Build the CLI command for resuming/starting a session.

        Args:
            session_id: Claude Code session UUID (if available).
            project_path: Working directory for the project.
            source: Session source type ('claude_code' or other).
        """
        parts: list[str] = []
        if project_path:
            parts.append(f"cd {project_path}")

        if source == "claude_code" and session_id:
            parts.append(f"claude --resume {session_id}")
        else:
            # OpenClaw sessions cannot be directly resumed; open a new Claude session
            parts.append("claude")

        return " && ".join(parts)

    # -- handoff execution ---------------------------------------------------

    def execute_handoff(
        self,
        command: str,
        target: str,
        working_dir: Optional[str] = None,
    ) -> HandoffResult:
        """Execute the handoff to the specified target."""
        try:
            if target in ("iterm", "terminal", "warp"):
                return self._handoff_terminal(command, target, working_dir)
            elif target == "vscode":
                return self._handoff_vscode(command, working_dir)
            elif target == "clipboard":
                return self._handoff_clipboard(command)
            else:
                return HandoffResult(
                    success=False,
                    target=target,
                    command=command,
                    message="",
                    error=f"Unknown target: {target}",
                )
        except Exception as e:
            logger.error("Handoff to %s failed: %s", target, e)
            return HandoffResult(
                success=False,
                target=target,
                command=command,
                message="",
                error=str(e),
            )

    # -- private helpers -----------------------------------------------------

    def _handoff_terminal(self, command: str, target: str, working_dir: Optional[str]) -> HandoffResult:
        """Open a terminal app via AppleScript and run the command."""
        if target == "iterm":
            script = self._iterm_applescript(command)
            label = "iTerm2"
        elif target == "warp":
            # Warp supports the same AppleScript interface as Terminal.app
            script = self._terminal_applescript(command, app_name="Warp")
            label = "Warp"
        else:
            script = self._terminal_applescript(command)
            label = "Terminal"

        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.returncode == 0:
            return HandoffResult(
                success=True,
                target=target,
                command=command,
                message=f"Opened in {label}",
            )
        else:
            error_msg = result.stderr.strip() or "AppleScript execution failed"
            return HandoffResult(
                success=False,
                target=target,
                command=command,
                message="",
                error=error_msg,
            )

    def _handoff_vscode(self, command: str, working_dir: Optional[str]) -> HandoffResult:
        """Open VS Code integrated terminal with the command."""
        args = ["code"]
        if working_dir:
            args.extend(["--folder-uri", f"file://{working_dir}"])

        # Open VS Code
        subprocess.run(args, capture_output=True, timeout=10)

        # Use AppleScript to type in VS Code terminal
        script = f'''
tell application "Visual Studio Code"
    activate
end tell
delay 0.5
tell application "System Events"
    keystroke "`" using control down
    delay 0.3
    keystroke "{self._escape_applescript(command)}"
    keystroke return
end tell
'''
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=15,
        )

        if result.returncode == 0:
            return HandoffResult(
                success=True,
                target="vscode",
                command=command,
                message="Opened in VS Code Terminal",
            )
        else:
            error_msg = result.stderr.strip() or "VS Code handoff failed"
            return HandoffResult(
                success=False,
                target="vscode",
                command=command,
                message="",
                error=error_msg,
            )

    def _handoff_clipboard(self, command: str) -> HandoffResult:
        """Copy the command to the system clipboard via pbcopy."""
        try:
            result = subprocess.run(
                ["pbcopy"],
                input=command.encode(),
                capture_output=True,
                timeout=5,
            )
            if result.returncode == 0:
                return HandoffResult(
                    success=True,
                    target="clipboard",
                    command=command,
                    message="Command copied to clipboard",
                )
            else:
                return HandoffResult(
                    success=False,
                    target="clipboard",
                    command=command,
                    message="",
                    error="pbcopy failed",
                )
        except FileNotFoundError:
            return HandoffResult(
                success=False,
                target="clipboard",
                command=command,
                message="",
                error="pbcopy not found (macOS only)",
            )

    # -- AppleScript templates -----------------------------------------------

    @staticmethod
    def _escape_applescript(text: str) -> str:
        """Escape special characters for AppleScript strings."""
        return text.replace("\\", "\\\\").replace('"', '\\"')

    @classmethod
    def _iterm_applescript(cls, command: str) -> str:
        safe = cls._escape_applescript(command)
        return f'''
tell application "iTerm"
    activate
    set newWindow to (create window with default profile)
    tell current session of newWindow
        write text "{safe}"
    end tell
end tell
'''

    @classmethod
    def _terminal_applescript(cls, command: str, app_name: str = "Terminal") -> str:
        safe = cls._escape_applescript(command)
        return f'''
tell application "{app_name}"
    activate
    do script "{safe}"
end tell
'''


# Module-level singleton
_handoff_service: Optional[HandoffService] = None


def get_handoff_service() -> HandoffService:
    """Get or create the singleton HandoffService."""
    global _handoff_service
    if _handoff_service is None:
        _handoff_service = HandoffService()
    return _handoff_service
