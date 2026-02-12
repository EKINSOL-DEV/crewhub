# CrewHub SaaS Strategy — Masterplan

> **Version:** 1.0 (Iteration 1 — Opus Research)
> **Date:** 2026-02-12
> **Status:** Draft for GPT-5.2 review

---

## Vision

CrewHub evolves from a local-first dev tool to a **hosted SaaS platform** with an optional desktop app. Users connect via browser or native Tauri app to a cloud-hosted CrewHub API.

```
                    ┌─────────────────┐
                    │  CrewHub SaaS   │
                    │  (Cloud API)    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────┴─────┐ ┌─────┴─────┐ ┌─────┴─────┐
        │  Browser  │ │  Desktop  │ │  CLI/SDK  │
        │  (Web)    │ │  (Tauri)  │ │  (API)    │
        └───────────┘ └───────────┘ └───────────┘
```

---

## Components & Dependencies

| Component | Status | Depends On | Timeline |
|-----------|--------|------------|----------|
| **API Key System** (hardened) | 70% done | — | 1-2 weeks |
| **SaaS API Deployment** | Not started | API keys, hosting | 2-4 weeks |
| **Tauri Desktop App** | Not started | SaaS API | 2-4 weeks |
| **Multi-tenancy** (orgs/users) | Not started | API keys | 4-8 weeks |
| **Billing** (Stripe) | Not started | Multi-tenancy | 4-8 weeks |

### Critical Path

```
API Key Hardening → SaaS Deployment → Tauri App → Multi-tenancy → Billing
     (P0)              (P0)            (P1)          (P2)          (P2)
```

---

## Recommended Execution Order

### Sprint 1 (Weeks 1-2): API Key Hardening
- Increase key entropy (128-bit)
- New `ch_live_` / `ch_test_` format
- Add `expires_at` column + expiration logic
- Add `slowapi` rate limiting
- Backward-compatible with existing keys

### Sprint 2 (Weeks 3-4): SaaS API Deployment
- Deploy CrewHub backend to cloud (Railway / Fly.io / VPS)
- PostgreSQL migration (from SQLite — or keep SQLite for single-tenant)
- HTTPS + domain setup (api.crewhub.io)
- CORS configuration for web + desktop clients
- Health monitoring + error tracking (Sentry)

### Sprint 3 (Weeks 5-6): Tauri Desktop App — Phase 1+2
- Tauri v2 initialization
- API base URL configuration
- OS keychain for API key storage
- First macOS build
- System tray + native notifications

### Sprint 4 (Weeks 7-8): Frontend UI + Distribution
- API Keys management UI in settings
- Audit logging
- Tauri auto-updates + code signing
- Multi-platform builds (macOS, Windows, Linux)
- Release page

### Sprint 5+ (Weeks 9+): Multi-tenancy & Billing
- User accounts + authentication (email/password, OAuth)
- Organizations
- Per-org API keys
- Stripe billing integration
- Usage metering

---

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Desktop framework | Tauri v2 | 96% smaller than Electron, native keychain, mobile path |
| API key hashing | SHA-256 | Sufficient for 128-bit random tokens |
| Key format | `ch_{env}_{hex32}` | Stripe-like, scannable, environment-aware |
| Rate limiting | `slowapi` | FastAPI-native, simple |
| Database (SaaS) | SQLite initially | Simplicity; migrate to PostgreSQL when needed |
| Frontend sharing | Single `frontend/` | No code duplication between web and desktop |
| Auth model | API keys (not OAuth) | Simpler for API-first product; add OAuth later for web UI |

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| WebView bugs across OS | Medium | Medium | Early cross-platform testing |
| SQLite scaling limits | Low (initially) | High | Plan PostgreSQL migration path |
| Apple signing delays | Medium | Low | Start Apple Dev account process early |
| SSE over HTTPS issues | Low | Medium | Tauri HTTP plugin as fallback |
| Scope creep on multi-tenancy | High | High | Keep MVP simple, add features incrementally |

---

## Success Metrics

- **Desktop app bundle:** < 10 MB
- **API key operations:** < 50ms latency
- **SSE connection:** stable over 24h
- **Rate limiting:** zero false positives
- **Cross-platform:** works on macOS, Windows, Ubuntu

---

## Documents Index

1. [Tauri Architecture](desktop-app/tauri-architecture.md) — Desktop app design
2. [Tauri Implementation Plan](desktop-app/implementation-plan.md) — Phased rollout
3. [API Key Security Analysis](api-keys/security-analysis.md) — Security research
4. [API Key Implementation Plan](api-keys/implementation-plan.md) — Backend + frontend plan
5. [API Key Database Schema](api-keys/schema.md) — Current + target schema

---

*Ready for GPT-5.2 review (Iteration 2).*
