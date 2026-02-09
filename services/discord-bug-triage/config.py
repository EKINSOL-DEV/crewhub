"""Configuration for Discord bug triage bot."""
import os
from pathlib import Path

# Discord
DISCORD_TOKEN_PATH = Path("~/.crewhub/discord-bot-token.txt").expanduser()
DISCORD_TOKEN = os.environ.get("DISCORD_BOT_TOKEN") or DISCORD_TOKEN_PATH.read_text().strip()

# The #bug-reports channel name (matched by name, not ID, for portability)
BUG_REPORTS_CHANNEL = os.environ.get("BUG_REPORTS_CHANNEL", "bug-reports")

# GitHub
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "EKINSOL-DEV/crewhub")
ISSUE_LABELS = ["bug", "from-discord"]

# Persistence
DATA_DIR = Path("~/.crewhub/bug-triage").expanduser()
MAPPING_FILE = DATA_DIR / "thread_issue_map.json"
