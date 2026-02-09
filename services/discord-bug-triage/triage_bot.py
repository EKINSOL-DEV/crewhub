#!/usr/bin/env python3
"""
Discord Bug Triage Bot for CrewHub.

Monitors #bug-reports for new threads, replies with a triage template,
creates/dedupes GitHub issues, and posts the link back.
"""
import json
import logging
import asyncio
from difflib import SequenceMatcher
from pathlib import Path

import discord
from github import Github, GithubException

import config

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("triage")

# ── Persistence ──────────────────────────────────────────────────────────────

def load_mapping() -> dict:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    if config.MAPPING_FILE.exists():
        return json.loads(config.MAPPING_FILE.read_text())
    return {}

def save_mapping(m: dict):
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    config.MAPPING_FILE.write_text(json.dumps(m, indent=2))

# ── GitHub helpers ───────────────────────────────────────────────────────────

gh = None
repo = None

def _gh():
    global gh, repo
    if gh is None:
        gh = Github(config.GITHUB_TOKEN)
        repo = gh.get_repo(config.GITHUB_REPO)
    return repo

TRIAGE_TEMPLATE = (
    "👋 Thanks for reporting! To help us triage this faster, please provide:\n\n"
    "1. **CrewHub version** (or commit/branch)\n"
    "2. **Steps to reproduce**\n"
    "3. **Expected behaviour**\n"
    "4. **Actual behaviour**\n"
    "5. **Relevant logs / screenshots**\n\n"
    "A GitHub issue will be created shortly."
)

def find_similar_open_issue(title: str, threshold: float = 0.55):
    """Search for an existing open issue with a similar title."""
    # Use GitHub search first (fast)
    query = f"repo:{config.GITHUB_REPO} is:issue is:open {title[:80]}"
    try:
        _gh()
        results = gh.search_issues(query)
        for issue in results[:10]:
            ratio = SequenceMatcher(None, title.lower(), issue.title.lower()).ratio()
            if ratio >= threshold:
                return issue
    except GithubException:
        pass
    return None

def create_or_link_issue(thread_name: str, thread_url: str, first_message: str) -> tuple[str, bool]:
    """Create a new issue or link to existing. Returns (issue_url, is_new)."""
    r = _gh()
    existing = find_similar_open_issue(thread_name)
    if existing:
        existing.create_comment(
            f"New Discord report linked to this issue:\n"
            f"**Thread:** [{thread_name}]({thread_url})\n\n"
            f"> {first_message[:500]}"
        )
        return existing.html_url, False

    body = (
        f"**Source:** [Discord #{thread_name}]({thread_url})\n\n"
        f"## Original report\n\n"
        f"> {first_message[:1500]}\n\n"
        f"---\n*Auto-created by bug-triage bot*"
    )
    issue = r.create_issue(
        title=thread_name,
        body=body,
        labels=[r.get_label(l) for l in config.ISSUE_LABELS],
    )
    return issue.html_url, True

# ── Discord bot ──────────────────────────────────────────────────────────────

intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True
client = discord.Client(intents=intents)

mapping = load_mapping()

@client.event
async def on_ready():
    log.info(f"Logged in as {client.user} – watching for threads in #{config.BUG_REPORTS_CHANNEL}")

@client.event
async def on_thread_create(thread: discord.Thread):
    """Fires when a new thread is created."""
    parent = thread.parent
    if not parent or parent.name != config.BUG_REPORTS_CHANNEL:
        return

    tid = str(thread.id)
    if tid in mapping:
        log.info(f"Thread {tid} already mapped – skipping")
        return

    log.info(f"New bug thread: {thread.name} ({tid})")

    # Join the thread so we can send messages
    await thread.join()

    # Small delay to let the first message arrive
    await asyncio.sleep(2)

    # Grab first message for issue body
    first_msg = ""
    async for msg in thread.history(limit=1, oldest_first=True):
        first_msg = msg.content or ""

    # Reply with triage template
    await thread.send(TRIAGE_TEMPLATE)

    # Create / dedupe GitHub issue
    thread_url = f"https://discord.com/channels/{thread.guild.id}/{thread.id}"
    try:
        issue_url, is_new = create_or_link_issue(thread.name, thread_url, first_msg)
    except Exception as e:
        log.error(f"GitHub error: {e}")
        await thread.send(f"⚠️ Could not create GitHub issue: `{e}`")
        return

    if is_new:
        await thread.send(f"✅ GitHub issue created: {issue_url}")
    else:
        await thread.send(f"🔗 Linked to existing issue: {issue_url}")

    # Persist
    mapping[tid] = issue_url
    save_mapping(mapping)
    log.info(f"Mapped thread {tid} → {issue_url}")

if __name__ == "__main__":
    if not config.GITHUB_TOKEN:
        log.error("Set GITHUB_TOKEN env var (needs repo scope)")
        raise SystemExit(1)
    client.run(config.DISCORD_TOKEN)
