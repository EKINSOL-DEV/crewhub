# TASK B — Onboarding StepConnectionMode

Branch develop. `git -C ~/ekinapps/crewhub checkout develop && git pull origin develop`

Read `frontend/src/components/onboarding/` fully first to understand existing structure.

1. `onboardingTypes.ts`: add `ConnectionMode = 'openclaw' | 'claude_code' | 'both'` type + `connectionMode` field to wizard state

2. Create `frontend/src/components/onboarding/steps/StepConnectionMode.tsx`:
   - 3 choice cards:
     - OpenClaw (orange #FF6B35) with icon + description + 2-3 bullets
     - Claude Code (purple #8B5CF6) with icon + description + 2-3 bullets
     - Both (green #10B981) with icon + description + 2-3 bullets
   - On select → update wizard state connectionMode + advance

3. `OnboardingWizard.tsx`: add step after Welcome, skip OpenClaw steps if claude_code selected

4. Verify: `cd ~/ekinapps/crewhub/frontend && npx tsc --noEmit` — no errors

5. Commit + push:
```bash
cd ~/ekinapps/crewhub
git add -A
git commit -m "feat: add connection mode picker to onboarding"
git push origin develop
```
