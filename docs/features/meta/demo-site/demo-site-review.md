# Demo Site Review — `demo.crewhub.dev`

**Reviewed:** 2026-02-05
**Input plan:** `docs/demo-site-plan.md`

## Grade: **B+**

The plan is solid and very close to “simplest thing that could work.” The main gaps are (1) endpoint completeness/robust URL matching, (2) illusion-breaking around “saving” and chat, and (3) a couple of deployment/SEO hardening details.

---

## Strengths

- **Simple, dependency-free approach**: a single `setupMockApi()` that intercepts `/api/*` is easy to reason about and avoids MSW/service-worker complexity.
- **Good endpoint inventory structure**: the critical/important/mutations grouping is exactly the right way to plan the work.
- **Demo-first UX intent**: banner/CTA, bypass onboarding, and “always-on” demo mode are good calls for a public demo site.
- **Static deployment is straightforward**: multi-stage Dockerfile → nginx with SPA fallback is a reliable baseline for Coolify.

---

## Weaknesses

### 1) Completeness risks
- The inventory is **credible**, but it is still **hand-curated**. If any screen makes a new call (or a call changes), the demo can silently break.
- The interceptor’s routing rule `if (!url.startsWith('/api'))` is fragile:
  - If the app uses an absolute base URL (e.g. `https://api.crewhub.dev/api/...`) it won’t match.
  - If it uses `import.meta.env.VITE_API_BASE_URL` with a full origin, it won’t match.
  - If it uses `/api` vs `/api/` variants, query strings, etc., you need a robust pathname matcher.
- SSE mocking via `window.EventSource = class ...` can fail in surprising ways if code relies on:
  - `readyState` transitions,
  - error events to trigger reconnect,
  - `withCredentials`, headers, or custom event types.

### 2) UX illusion breakers
- **“Silently succeed but doesn’t persist”** is likely to confuse visitors:
  - Drag sessions between rooms, edit settings, edit room names, etc., then refresh → everything reverts.
  - That’s acceptable for internal demos, but for a public marketing demo it can feel buggy.
- Chat: plan says *disable send button* **and** earlier says “accept messages but canned reply.” Pick one. Letting people type and then getting a canned reply can feel fake fast.
- Showing a “connected OpenClaw connection” in a static demo may create mismatched expectations (“where is the gateway?”).

### 3) Performance / bundle
- Mock data is small, but `mockApi.ts` will still ship to clients. It’s not huge, but ensure it’s:
  - **dynamically imported only when `VITE_DEMO_MODE` is true**,
  - not accidentally included in non-demo builds.
- If you later add large mock file trees / markdown content, bundle bloat can creep in.

### 4) Deployment hardening
- Missing (but easy) public-demo essentials:
  - `robots.txt` and/or `<meta name="robots" content="noindex">` to avoid indexing demo content.
  - Security headers (basic CSP at least; or accept defaults but be intentional).
  - Cache control for JSON-like routes is irrelevant (because there is no backend), but ensure the SPA is cached correctly.

### 5) Timeline realism
- **~6 hours is optimistic** unless endpoint inventory is validated by an automated scan or you plan time for iterative “fix the next missing endpoint.”
- Expect **another 2–6 hours** of whack-a-mole if any less-traveled screens call endpoints not listed.

---

## Specific suggestions

### A) Make matching robust (prevents 80% of “it works locally but not on demo domain” issues)
- Normalize the URL:
  - `const u = new URL(url, window.location.origin)`
  - match on `u.pathname.startsWith('/api/')` (or `=== '/api'`)
- Also intercept requests where pathname starts with `/api` even if the input URL is absolute.

### B) Add a “strict mode” + automated endpoint discovery
- In demo builds, consider **failing loudly** on unhandled GETs *in development*:
  - return `501 Not Implemented` with a JSON body telling you what’s missing.
- Add a simple script/test that:
  - greps the frontend for `/api/` and `new EventSource(`,
  - outputs a list of endpoints,
  - compares to the mock router table.

### C) Preserve the illusion: persist a few user-visible edits
- Instead of no-op mutations, persist the “obvious” ones to `localStorage`:
  - room name/color/order,
  - assignments,
  - display names,
  - theme settings.
- This is small effort and dramatically improves perceived quality.

### D) Be explicit about “Demo” limitations in UI
- For actions that do not persist, show a toast:
  - “Saved (demo only). Refresh resets changes.”
- For connection features:
  - show “Demo connection (simulated)” rather than “connected.”

### E) SSE: simulate minimal activity
- Instead of an idle EventSource, emit a lightweight event every ~10–20s:
  - session activity pings,
  - “agent started task,” “agent moved room,” etc.
- This helps the world feel alive even with no backend.

### F) Consider MSW only if complexity grows
- Current approach is fine.
- If endpoint shape divergence becomes painful, MSW can help by:
  - letting you define handlers closer to “real network” behavior,
  - supporting request matching/fixtures cleanly.
- I would **not** start with MSW given your simplicity goal, but keep it as a fallback if the mock router becomes brittle.

---

## Recommended changes (actionable)

1. **Update fetch interception to match absolute URLs** (pathname-based matching with `new URL`).
2. **Add logging + a dev-only hard error for unhandled GETs** to quickly reach completeness.
3. **Persist a minimal set of mutations to `localStorage`** (rooms/assignments/settings) to avoid “buggy” feel.
4. **Decide on chat behavior**:
   - either fully disable with clear copy (“Chat disabled in demo”),
   - or provide a *small, varied* canned interaction (but don’t make it obviously fake).
5. **Add `noindex`/robots + (optional) basic security headers** to the nginx config.
6. **Adjust estimate** to **~1 day** including iterative endpoint discovery and polish, unless you already know the inventory is complete.

---

## Notes on alternatives

- **MSW (Mock Service Worker):** Better fidelity and handler ergonomics, but adds complexity, a service worker lifecycle, and potential caching/debug issues. Good if your API surface is large and changing.
- **Service Worker without MSW:** Possible, but more work than needed.
- **Simplest possible:** Keep the current plan (fetch patch), but add the robustness + persistence items above.
