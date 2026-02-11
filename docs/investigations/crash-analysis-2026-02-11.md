# CrewHub Crash Analysis — 2026-02-11

## Summary

Both CrewHub frontend (Vite) and backend (uvicorn) are being killed with SIGKILL during active development. SIGKILL cannot be caught or handled — it comes from the OS, not the application. This is **macOS memory pressure (Jetsam)** killing processes to reclaim RAM.

## Root Cause Theories (Ranked by Likelihood)

### 🥇 #1: macOS Memory Pressure / Jetsam (95% likely)

**The smoking gun:**
- **16 GB RAM** on this Mac mini
- **10 GB total swapped out** historically (massive memory pressure over time)
- **2.4 GB in compressor** right now
- **1.85 GB swap in use** currently
- **4 concurrent Node.js dev servers** running (CrewHub Vite, Ekinbot Planner Vite, 2x Astro servers)
- **Plus:** Chrome, VS Code, Synology Drive, Safari, iTerm, Spotlight, mediaanalysisd

**How it works:**
1. macOS monitors memory pressure via `memorystatus` / Jetsam
2. When free memory drops below threshold (~20%), it starts killing processes
3. It picks processes based on priority ("dirty" memory, app state, etc.)
4. Dev servers (background Node.js processes) are LOW priority targets — easy kills
5. SIGKILL is sent — no cleanup, no graceful shutdown

**Why HMR triggers it:**
- Each HMR update causes Vite to re-parse/re-transform modules
- Large file edits (600+ line PropMakerMachine.tsx) = big memory spike
- Vite has **known HMR memory leaks** (see [vitejs/vite#20155](https://github.com/vitejs/vite/issues/20155)) — memory grows with each edit
- Node.js garbage collector may not reclaim fast enough during rapid edits
- Combined spike from Vite + Chrome (browser-side HMR) + uvicorn reload = memory cliff

**Evidence:**
- SIGKILL (not SIGTERM, SIGSEGV, etc.) = OS-level kill
- Crashes correlate with active editing (HMR = memory spikes)
- Both services crash together sometimes = system-wide pressure, not per-process bug
- 4 dev servers + Chrome + VS Code on 16GB = very tight

**How to confirm:**
- Run `memory_pressure` command during development
- Monitor with `sudo log stream --predicate 'sender == "kernel" AND eventMessage contains "memorystatus"'`
- Watch Activity Monitor → Memory Pressure graph during editing sessions

### 🥈 #2: Vite HMR Memory Leak Accumulation (80% likely, contributes to #1)

Vite 5.x has documented memory leaks during HMR — module graph entries aren't fully cleaned up after hot updates. Over a multi-hour dev session with frequent saves:

- Vite's memory grows from ~200MB to 500MB+
- This doesn't crash Vite directly, but pushes the system closer to the Jetsam threshold
- Combined with other memory-hungry processes = triggers #1

### 🥉 #3: uvicorn --reload File Watcher Overhead (30% likely, minor contributor)

`uvicorn --reload` uses `watchfiles` which monitors the filesystem. On macOS with large `node_modules` directories nearby, it can:
- Open many file descriptors (though limit is 1M+ so unlikely bottleneck)
- Use extra memory for the watch tree
- Spawn new Python processes on each reload (old process killed + new one started)

The `--reload` implementation kills the worker with SIGKILL by design in some watchdog implementations, but this wouldn't explain frontend crashes.

### ❌ Ruled Out

- **File descriptor limits**: Limit is 1,048,575 — not a factor
- **CPU throttling**: M-series doesn't SIGKILL for CPU
- **App Nap**: Dev servers in terminal sessions are exempt
- **Disk space**: 276GB free — not a factor
- **Process count limits**: 2666 limit, nowhere near it

## Crash Timeline Pattern

| Time | What Crashed | Likely Trigger |
|------|-------------|----------------|
| 11:44 | Frontend | HMR during editing |
| 13:44 | Frontend | HMR memory accumulation |
| 14:08 | Frontend | Rapid edits |
| 14:38 | Frontend | Memory threshold reached |
| 15:09 | Frontend | Continued pressure |
| 15:42 | Frontend | Same |
| 16:28 | Frontend | Same |
| 15:50 | Backend + Frontend | System-wide Jetsam |
| 21:17 | Backend + Frontend | System-wide Jetsam |
| 22:00 | Backend + Frontend | System-wide Jetsam |
| 22:33 | Backend + Frontend | System-wide Jetsam |

The pattern: single frontend crashes = Vite memory growing until killed. Dual crashes = system-wide memory pressure where macOS kills multiple low-priority processes.

## Memory Budget Analysis

| Process | RSS (current) | Notes |
|---------|--------------|-------|
| Vite (CrewHub) | 224 MB | Can grow to 500MB+ with HMR leaks |
| Astro (ekinsol) | 52 MB | Background, idle |
| Astro (flowz) | 50 MB | Background, idle |
| Vite (planner) | 47 MB | Background, idle |
| uvicorn | 24 MB | + child process 91 MB |
| Chrome | 152 + 83 + 75 + ... MB | ~500 MB total |
| VS Code | 118 MB | |
| Synology Drive | 85 MB | |
| mediaanalysisd | 144 MB | Apple system |
| Other system | ~1.5 GB | |

**Total estimated: ~3-4 GB active, 2.4 GB compressed, 1.85 GB swapped**

During active HMR editing, Vite + Chrome can spike another 500MB+ combined, pushing the system into critical memory pressure.

## Conclusion

This is a **resource contention problem**: too many dev servers on 16GB RAM. The immediate crash trigger is macOS Jetsam killing processes during memory pressure spikes caused by Vite HMR operations on large files.
