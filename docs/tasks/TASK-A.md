# TASK A — claude_transcript_parser.py + tests

Branch develop. `git -C ~/ekinapps/crewhub checkout develop && git pull origin develop`

1. Create `backend/app/services/connections/claude_transcript_parser.py` — copy the EXACT code from `~/SynologyDrive/ekinbot/01-Projects/CrewHub/standalone-claude-code-plan.md` section 2.1. The full parser class is there.

2. Create `backend/tests/test_claude_transcript_parser.py` with min 15 tests covering:
   - empty/invalid JSON lines
   - unknown type
   - assistant text event
   - assistant tool_use event
   - assistant Task tool (is_task_tool=True)
   - assistant mixed text + tool_use
   - assistant string content
   - user text message
   - user tool_result
   - user mixed content
   - system turn_duration
   - system unknown subtype
   - progress with nested assistant
   - progress without nested
   - parse_file with offset

3. Run: `cd ~/ekinapps/crewhub/backend && python -m pytest tests/test_claude_transcript_parser.py -v` — ALL GREEN

4. Commit + push:
```bash
cd ~/ekinapps/crewhub
git add backend/app/services/connections/claude_transcript_parser.py backend/tests/test_claude_transcript_parser.py
git commit -m "feat: add ClaudeTranscriptParser"
git push origin develop
```
