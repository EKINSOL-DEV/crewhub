# Tauri Desktop App Architecture — CrewHub

> **Version:** 1.0 (Iteration 1 — Opus Research)
> **Date:** 2026-02-12
> **Status:** Draft for GPT-5.2 review

---

## 1. Executive Summary

CrewHub's frontend is React + Vite + TypeScript with Radix UI, Three.js, and CodeMirror. **Tauri v2** wraps the existing frontend in a native webview, connecting to a remote CrewHub API instead of a local backend. This gives us a native desktop app with ~3-8MB installer (vs 100-150MB for Electron) while reusing **95-100%** of existing frontend code.

---

## 2. Why Tauri v2

### Comparison: Tauri vs Electron vs Web-Only

| Aspect | Tauri v2 | Electron | Web-Only (Browser) |
|--------|----------|----------|---------------------|
| **Bundle size** | 3-8 MB | 80-150 MB | 0 (URL) |
| **RAM usage** | 50-100 MB | 150-300 MB | Browser-dependent |
| **Backend runtime** | Rust (native) | Node.js (bundled Chromium) | N/A |
| **Startup time** | ~1s | 2-5s | Page load |
| **Secure storage** | OS keychain (native) | electron-store (file) | localStorage only |
| **Auto-updates** | Built-in plugin | electron-updater | N/A |
| **Code signing** | Standard OS tools | Standard OS tools | N/A |
| **macOS/Win/Linux** | ✅ | ✅ | ✅ |
| **iOS/Android** | ✅ (Tauri v2) | ❌ (need Capacitor) | ✅ (PWA) |
| **Offline support** | SQLite plugin | Any Node DB | Service Worker |
| **System tray** | Built-in plugin | Built-in | ❌ |
| **Native notifications** | Built-in plugin | Built-in | Notification API |
| **Deep linking** | Built-in plugin | Custom protocol | N/A |

**Verdict:** Tauri v2 is the clear winner for CrewHub. Smaller bundle, lower resource usage, native secure storage, mobile support path, and full Rust backend for any local processing.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────┐
│  Tauri v2 Desktop App                       │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  WebView (system)                     │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │  CrewHub React Frontend         │  │  │
│  │  │  (identical to web version)     │  │  │
│  │  │                                 │  │  │
│  │  │  API calls → remote server      │  │  │
│  │  │  SSE → remote /api/events       │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Rust Backend (Tauri Core)            │  │
│  │  • Secure storage (OS keychain)       │  │
│  │  • Auto-updater                       │  │
│  │  • System tray                        │  │
│  │  • Deep link handler                  │  │
│  │  • Optional: SQLite cache             │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
              │
              │ HTTPS
              ▼
┌─────────────────────────────────────────────┐
│  CrewHub SaaS API                           │
│  (FastAPI, remote server)                   │
│  • /api/* endpoints                         │
│  • /api/events (SSE)                        │
│  • Auth: X-API-Key header                   │
└─────────────────────────────────────────────┘
```

---

## 4. Frontend Code Reuse

### Can we reuse 100% of `frontend/src/`?

**Answer: ~98% reuse, with minor adaptations.**

#### What works as-is:
- All React components, hooks, contexts
- Radix UI components
- Three.js 3D views
- CodeMirror editors
- SSE via native `EventSource` (works in all webviews)
- All styling (Tailwind, CSS)

#### What needs adaptation:

| Area | Change Required |
|------|----------------|
| **API base URL** | Replace Vite proxy with configurable base URL |
| **Auth token storage** | Add Tauri secure storage option alongside localStorage |
| **File downloads** | Use Tauri `dialog.save()` for native save dialogs |
| **Notifications** | Optional: use Tauri native notifications |

#### API Base URL Strategy

Currently the frontend uses Vite's proxy (`/api → localhost:8091`). In Tauri, we need absolute URLs:

```typescript
// src/lib/api.ts — unified approach
const getApiBaseUrl = (): string => {
  // Check if running in Tauri
  if (window.__TAURI__) {
    // Read from Tauri secure storage or use default
    return localStorage.getItem('crewhub_api_url') || 'https://api.crewhub.io';
  }
  // Web: use relative URLs (proxy handles it)
  return '';
};

export const API_BASE = getApiBaseUrl();
```

The SSE manager needs the same treatment:

```typescript
// sseManager.ts modification
const sseUrl = `${API_BASE}/api/events?token=${encodeURIComponent(token)}`;
```

---

## 5. SSE and WebSocket Support

### SSE (Server-Sent Events)
**Works out of the box.** The system webview (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux) fully supports the `EventSource` API. CrewHub's existing `sseManager.ts` will work unchanged.

**Caveat:** SSE over HTTPS requires valid SSL certificates. Self-signed certs may fail in some webviews. For self-hosted instances, users should use proper certs (Let's Encrypt) or configure Tauri's webview to accept custom CAs.

### WebSocket
Also fully supported in system webviews. If CrewHub adds WebSocket features later, they'll work. The OpenClaw gateway connection (`ws://localhost:18789`) works via standard WebSocket API.

### Tauri-Specific Enhancement
For scenarios where the webview's network stack has limitations, Tauri v2 offers `tauri-plugin-http` which uses Rust's `reqwest` under the hood. This can bypass CORS restrictions and handle custom TLS configurations:

```rust
// src-tauri/src/lib.rs
use tauri_plugin_http;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 6. Secure Storage

Tauri v2 has `tauri-plugin-store` (file-based, encrypted) and access to OS keychain via `tauri-plugin-stronghold` or custom Rust commands using the `keyring` crate.

### Recommended: Layered approach

1. **API key** → OS keychain via Rust command (most secure)
2. **User preferences** (API URL, theme, etc.) → `tauri-plugin-store` (encrypted JSON)
3. **Session data** → localStorage (same as web)

```rust
// src-tauri/src/keychain.rs
use keyring::Entry;

#[tauri::command]
fn store_api_key(key: String) -> Result<(), String> {
    let entry = Entry::new("crewhub", "api-key").map_err(|e| e.to_string())?;
    entry.set_password(&key).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_api_key() -> Result<Option<String>, String> {
    let entry = Entry::new("crewhub", "api-key").map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}
```

---

## 7. Auto-Updates

Tauri v2's built-in updater checks a JSON endpoint for new versions:

```json
// https://releases.crewhub.io/latest.json
{
  "version": "1.2.0",
  "notes": "Bug fixes and performance improvements",
  "pub_date": "2026-02-12T18:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "...",
      "url": "https://releases.crewhub.io/crewhub_1.2.0_aarch64.app.tar.gz"
    },
    "darwin-x86_64": { ... },
    "windows-x86_64": { ... },
    "linux-x86_64": { ... }
  }
}
```

Configuration in `tauri.conf.json`:
```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": ["https://releases.crewhub.io/latest.json"],
      "dialog": true,
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ..."
    }
  }
}
```

**Distribution options:**
- GitHub Releases (free, integrated with CI)
- Self-hosted (S3/Cloudflare R2 + JSON manifest)
- CrabNebula Cloud (Tauri-specific hosting)

---

## 8. Code Signing

### macOS
- **Requirement:** Apple Developer Program ($99/year)
- **Certificate:** "Developer ID Application" certificate
- **Notarization:** Required for macOS 10.15+, Tauri CLI handles it
- **Environment vars:** `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`

### Windows
- **Requirement:** Code signing certificate (EV or OV)
- **Options:** DigiCert, Sectigo, GlobalSign ($200-500/year)
- **Alternative:** Azure Trusted Signing (cheaper, newer)
- **Tauri:** Supports `signtool.exe` integration

### Linux
- **No signing required** for most distributions
- **AppImage/deb/rpm** generated by Tauri CLI

---

## 9. Project Structure

```
crewhub/
├── frontend/               # Existing React app (shared)
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── src-tauri/              # NEW: Tauri backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── lib.rs          # Plugin registration
│   │   ├── main.rs         # Entry point
│   │   └── keychain.rs     # Secure storage commands
│   ├── icons/              # App icons (all platforms)
│   └── capabilities/       # Permission declarations
├── backend/                # Existing FastAPI (SaaS server)
└── docs/
```

The key insight: **`frontend/`** remains the single source of truth for both web and desktop. Tauri's `tauri.conf.json` points to the Vite dev server in dev mode and the built `dist/` folder for production.

```json
// tauri.conf.json
{
  "build": {
    "devUrl": "http://localhost:5180",
    "frontendDist": "../frontend/dist"
  }
}
```

---

## 10. Offline Support (Optional, Phase 3)

Using `tauri-plugin-sql` (SQLite):

- Cache crew/agent data locally
- Queue actions when offline, sync when online
- Store SSE events locally for offline viewing

This mirrors the backend's SQLite schema but as a read cache. Not needed for MVP.

---

## 11. Key Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Framework | Tauri v2 | Smaller, faster, native keychain, mobile path |
| Frontend sharing | Shared `frontend/` dir | No code duplication |
| API URL config | Settings UI + Tauri store | Default production, allow self-hosted |
| Auth storage | OS keychain via Rust | Most secure option |
| Updates | Tauri built-in updater | Simple, well-supported |
| SSE | Native EventSource | Works in all webviews |
| Offline | Phase 3 (optional) | Adds complexity, not needed for MVP |
| Signing | Apple Dev + Windows cert | Required for distribution |

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| WebView inconsistency across OS | UI bugs on specific platforms | Test on all 3 OS; use feature detection |
| Three.js WebGL in system webview | 3D view may not render | Fallback to 2D grid view; test early |
| Self-signed certs for self-hosted | SSE/API fail in webview | Document cert requirements; Tauri HTTP plugin as fallback |
| Rust compilation time | Slower dev cycle | Use `cargo watch`, only rebuild Rust when backend changes |
| macOS signing cost | $99/year | Required for serious distribution |

---

*Next: Implementation plan in `implementation-plan.md`*
