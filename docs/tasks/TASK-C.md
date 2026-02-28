# TASK C — SourceBadge UI component

Branch develop. `git -C ~/ekinapps/crewhub checkout develop && git pull origin develop`

1. Check `frontend/src/lib/api.ts` CrewSession type — add `source?: string` if missing

2. Create `frontend/src/components/ui/SourceBadge.tsx`:
   - Small badge component
   - OpenClaw = #FF6B35 bg, Claude Code = #8B5CF6 bg, unknown = grey
   - Styling: text-xs px-1.5 py-0.5 rounded, white text

3. Add SourceBadge to session cards (find CardsView or SessionCard component)

4. Add SourceBadge to Bot3D name labels (find Html overlay in Bot3D.tsx or BotNameLabel)

5. Verify: `cd ~/ekinapps/crewhub/frontend && npx tsc --noEmit` — no errors

6. Commit + push:
```bash
cd ~/ekinapps/crewhub
git add -A
git commit -m "feat: add SourceBadge for OpenClaw/Claude Code sessions"
git push origin develop
```
