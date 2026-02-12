# Tauri Desktop App — Implementation Plan

> **Version:** 1.0 (Iteration 1)
> **Date:** 2026-02-12

---

## Phased Rollout

### Phase 1: Foundation (1-2 weeks)

**Goal:** Tauri wrapping the existing frontend, pointing to remote API.

- [ ] Initialize Tauri v2 in repo (`cargo install create-tauri-app`, or manual)
- [ ] Create `src-tauri/` directory with `tauri.conf.json`
- [ ] Configure Vite integration (devUrl + frontendDist)
- [ ] Adapt `frontend/src/lib/api.ts` — add configurable API base URL
- [ ] Detect Tauri environment (`window.__TAURI__`)
- [ ] Create Settings page with API URL input field
- [ ] Use `tauri-plugin-store` for persisting user settings
- [ ] Basic Rust commands: `get_api_url`, `set_api_url`
- [ ] Test SSE connection to remote server
- [ ] Generate app icons (`tauri icon`)
- [ ] First build: macOS `.dmg`

**Deliverable:** Working desktop app that connects to remote CrewHub API.

### Phase 2: Security & Polish (1-2 weeks)

- [ ] Implement OS keychain storage for API key (`keyring` crate)
- [ ] First-run onboarding: enter API key, validate against server
- [ ] API key validation endpoint: `GET /api/auth/keys/self`
- [ ] System tray with connection status indicator
- [ ] Native notifications for important events (new session, errors)
- [ ] Menu bar: File, Edit, View, Help
- [ ] Keyboard shortcuts (Cmd+, for settings, etc.)
- [ ] Window state persistence (size, position)
- [ ] Error handling: connection lost banner, retry logic

**Deliverable:** Polished desktop experience with secure auth.

### Phase 3: Distribution & Updates (1 week)

- [ ] Set up auto-updater (JSON endpoint + signed builds)
- [ ] macOS code signing + notarization (CI pipeline)
- [ ] Windows code signing
- [ ] Linux: AppImage + .deb builds
- [ ] GitHub Actions workflow for multi-platform builds
- [ ] Release page / download site

**Deliverable:** Distributable, auto-updating app for all platforms.

### Phase 4: Advanced Features (2-4 weeks, optional)

- [ ] Offline mode with SQLite cache
- [ ] Deep linking (`crewhub://open/session/123`)
- [ ] Multi-server support (switch between CrewHub instances)
- [ ] File drag-and-drop integration
- [ ] Mobile builds (iOS/Android via Tauri v2)

---

## CI/CD Pipeline

```yaml
# .github/workflows/desktop-release.yml
name: Desktop Release
on:
  push:
    tags: ['desktop-v*']

jobs:
  build:
    strategy:
      matrix:
        platform: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - uses: dtolnay/rust-toolchain@stable
      - run: cd frontend && npm ci && npm run build
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

---

## Effort Estimates

| Phase | Effort | Prerequisites |
|-------|--------|---------------|
| Phase 1 | 1-2 weeks | Rust installed, SaaS API accessible |
| Phase 2 | 1-2 weeks | Phase 1 complete |
| Phase 3 | 1 week | Apple Dev account, Windows cert |
| Phase 4 | 2-4 weeks | Phases 1-3 complete |
| **Total** | **5-9 weeks** | |

---

## Dependencies

- **Rust toolchain** (rustup)
- **Tauri CLI v2** (`cargo install tauri-cli`)
- **Node.js 22+** (already have)
- **Apple Developer Program** ($99/year) — for macOS signing
- **Windows code signing cert** ($200-500/year) — for Windows signing
- **SaaS API** deployed and accessible — needed before Phase 1 testing
