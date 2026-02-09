# Discord Bug Triage Bot

Monitors `#bug-reports` threads in Discord → creates/dedupes GitHub issues in `EKINSOL-DEV/crewhub`.

## Setup

```bash
cd ~/ekinapps/crewhub/services/discord-bug-triage
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
export GITHUB_TOKEN="$(gh auth token)"
python3 triage_bot.py
```

Discord token is read from `~/.crewhub/discord-bot-token.txt`.

## What it does

1. New thread in `#bug-reports` → bot joins and replies with triage template (version/steps/expected/actual/logs)
2. Searches GitHub for similar open issues (title similarity ≥ 55%)
3. If match found → comments on existing issue with Discord link
4. If no match → creates new issue with labels `bug`, `from-discord`
5. Posts issue link back to Discord thread
6. Persists `thread_id → issue_url` mapping in `~/.crewhub/bug-triage/thread_issue_map.json`

## Ensure labels exist

```bash
gh label create "from-discord" --repo EKINSOL-DEV/crewhub --color "7B68EE" --description "Bug reported via Discord" 2>/dev/null
gh label create "bug" --repo EKINSOL-DEV/crewhub --color "d73a4a" 2>/dev/null
```
