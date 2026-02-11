# Security Review: CrewHub Hardening Plan

**Reviewed document:** `docs/security-hardening-plan.md` (v1.0, 2026-02-09)  
**Reviewer date:** 2026-02-09  
**Scope:** Threat model, auth/session design, token handling, HTTPS/TLS, Docker hardening, migration safety, defense-in-depth, OWASP coverage

---

## Executive Verdict

**Final verdict: APPROVED WITH CONDITIONS**

The plan is a strong baseline and addresses several critical current risks (no auth, no TLS, open exposure). However, a few items should be treated as **must-fix before public production**—especially around **CSRF/session model, auth auto-detection trust boundary, brute-force protection, and secrets handling**.

---

## ✅ What’s well-designed (Strengths)

1. **Correctly prioritizes highest risks first**
   - Fixes the most dangerous current state: unauthenticated public UI/API, no HTTPS, and open ports.

2. **Layered hardening approach**
   - Token management, auth, TLS/network, and container hardening are separated into phases.
   - Practical migration path is included.

3. **Good transport/network baseline**
   - Nginx TLS termination with redirect, HSTS, and firewall restrictions.
   - Binding backend/frontend to `127.0.0.1` is an important exposure reduction.

4. **Session cookie security direction is mostly good**
   - `HttpOnly`, `Secure` (when HTTPS), `SameSite=Lax`, expiration.
   - Better than storing JWT in localStorage.

5. **Container hardening starts correctly**
   - Non-root runtime, `no-new-privileges`, capability drop, read-only FS.

6. **Acknowledges testing/audit checklist**
   - Includes operational verification (ports, auth endpoints, SSL rating), which is often missing in plans.

---

## 🚨 Critical to fix (High risk)

1. **Auth decision based on `Host` header is unsafe as an authorization control**
   - Current auto-mode (`host not in localhost/127.0.0.1/ekinbot.local`) can be spoofed by crafted requests if app is directly reachable or proxy trust is misconfigured.
   - **Risk:** auth bypass in edge/misconfig scenarios.
   - **Required fix:**
     - For internet deployments, use explicit `CREWHUB_AUTH_ENABLED=on` (no auto for prod).
     - If auto mode remains for dev, gate by trusted environment/profile, not client-supplied headers.
     - Add strict proxy trust model and block direct backend exposure.

2. **Missing CSRF protection for cookie-authenticated state-changing endpoints**
   - JWT in cookie means browser auto-sends credentials; `SameSite=Lax` helps but is not a full CSRF control.
   - **Risk:** unauthorized actions via cross-site requests in some flows.
   - **Required fix:**
     - Add CSRF token pattern (double-submit cookie or synchronizer token).
     - Validate Origin/Referer on mutating requests (`POST/PUT/PATCH/DELETE`).
     - Keep `SameSite` but do not rely on it as sole control.

3. **No brute-force/rate limiting on login (explicitly deferred)**
   - Public password endpoint without throttling is high-risk.
   - **Risk:** credential stuffing / online guessing.
   - **Required fix:**
     - Per-IP and per-account rate limits on `/api/auth/login`.
     - Progressive backoff + temporary lockout.
     - Optional fail2ban at Nginx level.

4. **Generated admin password printed to stdout**
   - Secrets can leak to logs/aggregators/backups.
   - **Risk:** credential disclosure.
   - **Required fix:**
     - Do not print generated secrets in plain logs.
     - Prefer mandatory bootstrap secret via environment/one-time setup command.
     - If temporary display is unavoidable, output once to secure TTY only and redact from logs.

5. **Single long-lived session model with no revocation strategy**
   - 24h JWT cookie without server-side revocation (logout-all, compromise response) is weak operationally.
   - **Risk:** stolen cookie remains valid until expiry.
   - **Required fix:**
     - Add token version or session store (jti) to support revocation.
     - Rotate signing secret with graceful key rollover mechanism.

---

## ⚠️ Needs improvement (Medium risk)

1. **Password source-of-truth ambiguity (env vs DB first-run hash)**
   - Migration rules can create confusion and drift.
   - Recommendation: choose one canonical source (DB with explicit bootstrap command, or env hash only) and document deterministic behavior.

2. **Cookie flags not fully specified for all environments**
   - Add explicit `Path=/`, consider `SameSite=Strict` if UX allows, and ensure secure handling behind TLS-terminating proxy (`X-Forwarded-Proto` trust).

3. **JWT key management not fully mature**
   - `CREWHUB_JWT_SECRET` in `.env` is acceptable baseline, but no rotation plan.
   - Add key IDs (`kid`) and dual-key validation window for rotation.

4. **Nginx headers include legacy `X-XSS-Protection`**
   - Obsolete in modern browsers.
   - Better add Content-Security-Policy (CSP), `Referrer-Policy`, `Permissions-Policy`.

5. **No explicit CORS/Origin policy details**
   - Must define allowed origins in prod (exact domain), deny wildcard with credentials.

6. **SSE auth lifecycle not fully covered**
   - Ensure SSE endpoint re-validates auth at connect and handles expired sessions predictably.

7. **Running deployment/migration as root in guide**
   - Operationally common but avoidable.
   - Use least-privileged user + controlled sudo for service management.

8. **No explicit account lockout/alerting/audit logging**
   - Add auth event logs (without sensitive content), suspicious login alerts, and monitoring.

---

## 💡 Additional recommendations (Nice-to-haves)

1. **Adopt modern secret management over plain `.env`**
   - `.env` is acceptable for small VPS, but better with Docker secrets / SOPS / Vault for scale.

2. **Dependency/supply-chain controls**
   - Pin base image digests, use `pip-tools`/lockfiles, run Trivy/Grype in CI, enable Dependabot/Renovate.
   - Generate SBOM (CycloneDX/SPDX).

3. **Runtime hardening extras**
   - Add seccomp/apparmor profiles; keep `init: true`; set `pids_limit`, memory/CPU limits.

4. **WAF-lite protections at Nginx**
   - Basic request size limits, timeout tuning, and optional ModSecurity/OWASP CRS if exposure grows.

5. **Security regression tests in CI**
   - Add automated checks for: unauthenticated access denied, CSRF enforcement, rate limit behavior, secure cookie flags.

6. **Backup and incident response**
   - Document key compromise response (rotate JWT secret, invalidate sessions, rotate API keys), and recovery runbook.

---

## Threat Modeling Assessment

### Attack vectors covered well
- Unauthenticated internet access to admin UI/API.
- Plain HTTP traffic interception.
- Overexposed service ports.
- Container privilege overreach (partially).

### Attack vectors missing or under-modeled
- CSRF against cookie-based auth.
- Brute force/credential stuffing.
- Session theft/replay and revocation gap.
- Host header trust/bypass scenarios.
- Dependency and container supply-chain compromise.
- Sensitive data leakage via logs/errors.
- SSRF/command abuse paths (if backend invokes external tools/services).

---

## OWASP Top 10 Coverage Snapshot

- **A01 Broken Access Control:** **Partially addressed** (auth added), but host-header auto logic + missing CSRF weaken control.
- **A02 Cryptographic Failures:** **Improved** via TLS and bcrypt; key rotation and secret lifecycle need work.
- **A03 Injection:** **Not directly covered** in this plan (assume existing code hygiene).
- **A04 Insecure Design:** **Partially addressed** (good phased design) but missing abuse controls (rate limit/CSRF).
- **A05 Security Misconfiguration:** **Strongly addressed** (firewall, localhost binding, headers), with some gaps (CSP, proxy trust hardening).
- **A06 Vulnerable/Outdated Components:** **Not addressed enough** (no dependency governance process).
- **A07 Identification & Authentication Failures:** **Partially addressed**; needs brute-force controls and robust session revocation.
- **A08 Software & Data Integrity Failures:** **Limited**; no artifact signing/SBOM/pinned digests mentioned.
- **A09 Security Logging & Monitoring Failures:** **Limited**; checklist mentions logs but lacks concrete policy/alerts.
- **A10 SSRF:** **Not explicitly addressed**.

---

## Backward Compatibility & Migration Risk Review

- The migration is practical and likely low-friction.
- Main security concern is **temporary insecure states during phased rollout** (e.g., auth introduced before rate limiting/CSRF).
- Recommended rollout order tweak for safety:
  1. TLS + firewall + localhost binding
  2. Auth (with CSRF + rate limiting together)
  3. Session revocation and logging
  4. Container hardening + supply-chain controls

---

## Minimum Conditions to meet before public production

1. Force `CREWHUB_AUTH_ENABLED=on` in prod (no Host-header auto logic for internet).
2. Implement CSRF protection for cookie-authenticated mutating endpoints.
3. Add login rate limiting + brute-force protections.
4. Remove plain-secret logging behavior (no generated password in logs).
5. Add session revocation capability (token version/jti store) and logout invalidation semantics.

If these five are implemented, the plan is production-viable for a single-admin public VPS deployment.
