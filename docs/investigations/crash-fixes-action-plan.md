# CrewHub Crash Fixes — Action Plan

## Root Cause

macOS Jetsam killing processes during memory pressure. 16GB RAM is too tight for 4 concurrent dev servers + Chrome + VS Code + system services.

---

## 🔴 Top 3 Immediate Fixes (Tonight)

### Fix 1: Kill Idle Dev Servers ⭐ HIGHEST IMPACT

**The problem:** You're running 4 Node.js dev servers simultaneously, but only actively developing CrewHub.

**Action:**
```bash
# Kill the idle Astro and Planner dev servers
kill $(pgrep -f "astro dev.*port 4321")
kill $(pgrep -f "astro dev.*port 4322")
kill $(pgrep -f "vite.*ekinbot_planner")
```

**Impact:** Frees ~300-400 MB RAM immediately. This alone may stop crashes.

**Measure:** Track crashes over next dev session. If zero crashes → this was sufficient.

**Long-term:** Only start dev servers you're actively working on. Add aliases:
```bash
alias crewhub-dev='cd ~/ekinapps/crewhub && ./start-dev.sh'
alias crewhub-stop='pkill -f "vite.*crewhub" ; pkill -f "uvicorn.*8091"'
```

### Fix 2: Limit Vite Memory + Restart Fresh Periodically

**Action — add to `package.json`:**
```json
"dev": "NODE_OPTIONS='--max-old-space-size=512' vite --host --port 5180"
```

This caps Node.js heap at 512MB. When Vite's HMR leaks push it close, Node's GC works harder to stay under. If it can't, Node crashes with OOM (which is better than Jetsam — it's predictable and auto-restartable).

**Also:** Restart Vite every ~2 hours during long dev sessions, or when you notice slowness.

**Measure:** Monitor with `ps -o rss -p $(pgrep -f "vite.*5180")` — should stay under 512MB.

### Fix 3: Enable the Watchdog (Auto-Restart)

Since crashes will happen occasionally regardless, make them painless:

**Action:** Create a dev launcher that auto-restarts:
```bash
# ~/ekinapps/crewhub/dev.sh
#!/bin/bash
trap 'kill $(jobs -p) 2>/dev/null' EXIT

while true; do
  echo "[$(date)] Starting backend..."
  cd ~/ekinapps/crewhub/backend
  python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8091 --reload &
  BACK_PID=$!

  echo "[$(date)] Starting frontend..."
  cd ~/ekinapps/crewhub/frontend
  NODE_OPTIONS='--max-old-space-size=512' npx vite --host --port 5180 &
  FRONT_PID=$!

  # Wait for either to die
  wait -n $BACK_PID $FRONT_PID
  echo "[$(date)] ⚠️  Process died! Restarting in 2s..."
  kill $BACK_PID $FRONT_PID 2>/dev/null
  wait
  sleep 2
done
```

**Impact:** Crashes become 2-second blips instead of workflow interruptions.

---

## 🟡 Short-Term (This Week)

### 4. Use `--force` HMR Pre-transform Limit
In `vite.config.ts`:
```ts
server: {
  hmr: {
    // Reduce memory by not pre-transforming too many modules
    overlay: true,
  },
  watch: {
    // Reduce file watcher overhead
    usePolling: false,
    interval: 1000,
  },
}
```

### 5. Monitor Memory During Dev
Keep a terminal open with:
```bash
watch -n 5 'ps -o pid,rss,comm -p $(pgrep -f "vite|uvicorn" | tr "\n" ",")0'
```

### 6. Consider Upgrading to Vite 6.x
Vite 6 has improved memory management for HMR. Check compatibility.

---

## 🟢 Long-Term

### 7. RAM Upgrade
If this Mac mini supports it (M2 Pro/Max models don't — RAM is soldered). If it's an M1/M2 base model with 16GB, consider replacing with 32GB model for development.

### 8. Reduce Active Processes
- Stop Chrome when not debugging frontend (use Safari for general browsing — lower memory)
- Disable Spotlight indexing on dev folders: `sudo mdutil -i off ~/ekinapps/`
- Schedule Synology Drive syncs instead of constant background sync

### 9. Split Development
Use a terminal multiplexer (tmux) with named sessions per project. Only start what you need.

---

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Crashes per day | 5-10 | 0-1 |
| Time to recover from crash | Manual restart (~30s) | Auto-restart (~2s) |
| Memory pressure during dev | Critical (Jetsam kills) | Normal (<80%) |
| Vite RSS after 2h | 500MB+ | <512MB (capped) |
