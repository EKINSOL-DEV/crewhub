# TASK D — Research & verify

Branch develop. `git -C ~/ekinapps/crewhub checkout develop && git pull origin develop`

1. Run: `which claude 2>/dev/null && claude --help 2>&1 | head -80 || echo "claude not found"`
2. List: `ls -la ~/ekinapps/crewhub/backend/app/services/connections/`
3. Read current `claude_code.py` stub
4. Read `backend/app/main.py` startup flow
5. Read `backend/app/services/connections/connection_manager.py`
6. Read `backend/app/db/schema.py` — note schema version
7. Check if `~/.claude/projects/` exists and list contents

Write findings to `~/ekinapps/crewhub/docs/claude-code-research-notes.md`:
- Claude CLI available? Version? Key flags (--resume, --print, --output-format, --session-id)?
- Current claude_code.py stub analysis
- ConnectionManager registration pattern
- Schema version
- ~/.claude directory structure

Commit + push:
```bash
cd ~/ekinapps/crewhub
git add docs/claude-code-research-notes.md
git commit -m "docs: add claude code implementation research notes"
git push origin develop
```
