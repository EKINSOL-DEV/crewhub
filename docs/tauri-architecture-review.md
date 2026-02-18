# Tauri v2 Architecture Review — CrewHub Desktop App

> **Reviewer:** Ekinbot (Architecture Review)
> **Date:** 2026-02-17
> **Branch:** feature/tauri-desktop-app
> **Status:** Final

---

## Context

CrewHub is een Vite + React + FastAPI app. De Tauri v2 desktop build voegt toe:

- **Menubar/tray icon** — geen dock icon op macOS
- **"Chat" venster** — 390×700px, mobile layout (`?view=mobile`)
- **"3D World" venster** — 1280×900px, desktop layout
- **Backend** — lokaal op `localhost:8091` (buiten Tauri beheer)

Dit is een **significante afwijking** van de bestaande architectuurdoc** (die remote SaaS API assumeerde). Deze review focust specifiek op het menubar + lokale backend model.

---

## 1. Tauri v2 Menubar Apps — Valkuilen per Platform

### macOS ✅ (goed ondersteund)

Tauri v2 heeft `tauri-plugin-positioner` en een expliciete menubar-flow. Valkuilen:

**Tray icon positioning:**
```rust
// Correct: gebruik AppHandle om venster te positioneren bij tray icon
use tauri_plugin_positioner::{Position, WindowExt};

tray.on_tray_icon_event(|tray, event| {
    if let TrayIconEvent::Click { .. } = event {
        let window = app.get_webview_window("chat").unwrap();
        let _ = window.as_ref().window().move_window(Position::TrayCenter);
        window.show().unwrap();
        window.set_focus().unwrap();
    }
});
```

**Activatie policy** is de grootste valkuil (zie punt 6 — LSUIElement).

**WebKit op macOS:** Gebruikt het systeem WebKit (niet gebundeld). Op macOS 13+ is dit stabiel. Op macOS 12 kan WebGL voor Three.js problemen geven — test vroeg.

### Windows ⚠️ (meer werk)

- Windows heeft geen native "menubar" concept — tray icon werkt anders
- `tauri-plugin-positioner` heeft een `TrayCenter` position maar op Windows werkt dit anders afhankelijk van taskbar positie (links, rechts, boven, onder)
- **Aanbeveling:** Detecteer taskbar positie en gebruik `SystemTray` positioning fallback:

```rust
// Fallback als positioner niet correct werkt op Windows
#[cfg(target_os = "windows")]
fn position_window_near_tray(window: &WebviewWindow) {
    // Bereken cursor positie + schermgrootte
    // Positioneer venster in de hoek
    use tauri::PhysicalPosition;
    let monitor = window.current_monitor().unwrap().unwrap();
    let size = monitor.size();
    window.set_position(PhysicalPosition::new(
        size.width - 400,
        size.height - 750,
    )).unwrap();
}
```

- **WebView2 op Windows:** Microsoft WebView2 runtime moet geïnstalleerd zijn. Tauri kan dit bundelen (grotere installer) of een bootstrap downloader gebruiken. Voor lokale app: bootstrap downloader is prima.

### Linux ⚠️ (experimenteel)

- Tray support vereist `libayatana-appindicator` of `libappindicator3`
- Niet alle desktop environments ondersteunen system tray (bijv. GNOME zonder extensie)
- **Aanbeveling:** Documenteer als "niet officieel ondersteund" voor nu. Focus op macOS + Windows.

### Concrete `tauri.conf.json` aanpak (menubar):

```json
{
  "app": {
    "windows": [
      {
        "label": "chat",
        "title": "CrewHub Chat",
        "width": 390,
        "height": 700,
        "decorations": false,
        "transparent": true,
        "visible": false,
        "skipTaskbar": true,
        "alwaysOnTop": false,
        "resizable": false
      },
      {
        "label": "world",
        "title": "CrewHub 3D World",
        "width": 1280,
        "height": 900,
        "decorations": true,
        "visible": false,
        "skipTaskbar": false,
        "resizable": true,
        "minWidth": 900,
        "minHeight": 600
      }
    ]
  }
}
```

**Let op:** `visible: false` voor beide vensters bij startup — tray icon triggert `.show()`.

---

## 2. Multi-Window State Synchronisatie

Beide vensters praten direct met de backend op `localhost:8091` — dit is de **server-as-source-of-truth** pattern. Dit is de juiste aanpak voor CrewHub.

### Pattern: Backend als state hub

```
[Chat Window] ←→ HTTP/SSE ←→ localhost:8091 ←→ SSE ←→ [3D World Window]
```

React state is inderdaad per window (separate WebView instances). Maar via SSE/polling houden beide windows zich automatisch gesynchroniseerd via de backend.

**Wat je NIET nodig hebt:**
- Tauri IPC voor state sync (overkill als backend running is)
- SharedArrayBuffer / BroadcastChannel (niet beschikbaar in Tauri WebViews)
- Rust state management als bridge

**Wat je WEL moet doen — Tauri Events voor lightweight notificaties:**

```rust
// Rust: broadcast event naar alle windows
app.emit("session-updated", payload).unwrap();

// Of specifiek naar één window:
app.get_webview_window("world").unwrap()
    .emit("session-updated", payload).unwrap();
```

```typescript
// Frontend: luister naar Tauri events
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
  const unlisten = listen('session-updated', (event) => {
    // Invalidate React Query cache of refetch
    queryClient.invalidateQueries(['sessions']);
  });
  return () => { unlisten.then(f => f()); };
}, []);
```

**Aanbevolen architectuur:**
1. **Backend (SSE)** — primaire state sync voor data (agents, sessions, messages)
2. **Tauri Events** — lightweight UI-only notificaties (bijv. "chat window geopend", "focus window X")
3. **Geen shared React state** tussen windows — elk window heeft zijn eigen query cache

### Edge case: Backend offline

Als de backend down is, divergeert state sowieso. Dit maakt de backend-als-hub aanpak robuust: haal backend terug, beide windows resync via SSE reconnect.

---

## 3. `?view=mobile` Routing — Query Param vs Alternatieven

### Huidige aanpak: Query parameter

```
http://localhost:5180/?view=mobile  →  Chat window (390×700px)
http://localhost:5180/              →  3D World window
```

### Beoordeling: ✅ Query param is prima, maar er is een betere aanpak

**Probleem met query param:**
- React Router kan de param kwijtraken bij navigatie (bijv. na login redirect)
- Beide windows laden dezelfde app bundle en branchen pas na hydration
- In production (geen dev server) is de URL `tauri://localhost` — query params werken maar zijn fragiel

**Beter: Tauri `data-` attribuut via IPC bij startup**

```rust
// Rust: injecteer view type in webview via initScript
tauri::WebviewWindowBuilder::new(app, "chat", WebviewUrl::App("index.html".into()))
    .initialization_script("window.__TAURI_VIEW__ = 'mobile';")
    .build()?;

tauri::WebviewWindowBuilder::new(app, "world", WebviewUrl::App("index.html".into()))
    .initialization_script("window.__TAURI_VIEW__ = 'desktop';")
    .build()?;
```

```typescript
// React: lees view type
const isMobileView = window.__TAURI_VIEW__ === 'mobile';

// Of gebruik Tauri window label
import { getCurrent } from '@tauri-apps/api/webviewWindow';
const windowLabel = getCurrent().label; // "chat" of "world"
const isChatWindow = windowLabel === 'chat';
```

**Aanbevolen aanpak:**
1. Gebruik `window.__TAURI_VIEW__` via `initializationScript` (meest betrouwbaar)
2. Als fallback: window label check via Tauri API
3. Query param als laatste resort (voor dev server compatibiliteit)

**Voordeel:** Geen URL manipulatie, werkt in dev én production, geen routing side effects.

---

## 4. Backend Koppeling — Sidecar vs. Externe Process

### Opties vergelijking

| Aanpak | Pros | Cons |
|--------|------|------|
| **Sidecar (Tauri)** | Geïntegreerd, lifecycle beheerd | Complexe bundeling Python, grote installer |
| **Externe process** | Simpel, bestaande setup | App nutteloos zonder backend |
| **Health check + graceful error** | Beste UX, weinig overhead | Iets meer frontend werk |

### Aanbeveling: Health check + graceful error UI ✅

Voor het scenario "backend draait lokaal op `localhost:8091`" (niet gebundeld in Tauri):

**Reden om GEEN sidecar te gebruiken:**
- Python + FastAPI bundelen in een Tauri sidecar vereist PyInstaller of Nuitka
- Resultaat: installer van 50-100MB (versus 5-10MB zonder)
- Python versie conflicten op user's machine
- Complexe cross-platform bundeling

**Aanbevolen flow:**

```rust
// src-tauri/src/lib.rs
use std::time::Duration;

#[tauri::command]
async fn check_backend_health() -> Result<bool, String> {
    let client = reqwest::Client::new();
    match client
        .get("http://localhost:8091/api/health")
        .timeout(Duration::from_secs(3))
        .send()
        .await
    {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}
```

```typescript
// React: AppHealthGate component
const AppHealthGate: React.FC = ({ children }) => {
  const [status, setStatus] = useState<'checking' | 'ok' | 'down'>('checking');

  useEffect(() => {
    const check = async () => {
      if (window.__TAURI__) {
        const healthy = await invoke<boolean>('check_backend_health');
        setStatus(healthy ? 'ok' : 'down');
      } else {
        setStatus('ok'); // Web mode: backend altijd bereikbaar
      }
    };

    check();
    const interval = setInterval(check, 10_000); // Hercheck elke 10s
    return () => clearInterval(interval);
  }, []);

  if (status === 'checking') return <LoadingScreen />;
  if (status === 'down') return <BackendDownScreen />;
  return children;
};
```

**BackendDownScreen moet tonen:**
- "CrewHub backend is niet bereikbaar op localhost:8091"
- Instructie: hoe te starten (`cd ~/ekinapps/crewhub/backend && python3 -m uvicorn...`)
- "Opnieuw proberen" knop
- **Geen app crash** — venster blijft open, hercheck automatisch

**Toekomstige optie:** Een lichte Rust process launcher als wrapper script (niet sidecar):

```rust
// Optioneel: start backend als apart process (niet embedded)
#[tauri::command]
fn launch_backend() -> Result<(), String> {
    std::process::Command::new("python3")
        .args(["-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8091"])
        .current_dir("/Users/ekinbot/ekinapps/crewhub/backend")
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

Dit is een middenweg: geen sidecar bundeling, maar wel auto-start vanuit de app.

---

## 5. Window Lifecycle — Hide vs. Destroy

### Vergelijking

| Methode | Memory | Startup tijd | State behoud |
|---------|--------|--------------|--------------|
| **Destroy** | Vrijgegeven | ~500ms-1s | Verloren |
| **Hide** | Behouden | ~50ms | Behouden |
| **Minimize** | Behouden | Direct | Behouden |

### Aanbeveling: Hide voor beide vensters ✅

**Reden:**
- Chat window (390×700px) is licht — hide kost ~20-50MB RAM, nauwelijks merkbaar
- 3D World window heeft Three.js loaded — re-initialize kost 500ms+ en WebGL context setup
- Menubar apps verwachten instant respons bij klikken

**Implementatie:**

```rust
// Tauri v2: intercept close event, hide in plaats van destroy
use tauri::Manager;

fn setup_window_close_handlers(app: &tauri::App) {
    for label in ["chat", "world"] {
        if let Some(window) = app.get_webview_window(label) {
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    window.hide().unwrap();
                }
            });
        }
    }
}
```

**Uitzonderingen waar destroy beter is:**
- 3D World venster op low-memory devices (< 4GB RAM) — overweeg destroy + snelle re-init
- Bij app quit: destroy alle vensters correct (geen zombie processes)

**App quit handler:**

```rust
app.on_window_event(|window, event| {
    if let tauri::WindowEvent::Destroyed = event {
        // Laatste venster destroyed = app exit
        if window.app_handle().webview_windows().is_empty() {
            std::process::exit(0);
        }
    }
});
```

**Memory tip:** Three.js scene in 3D World window kan WebGL resources lekken als window hidden is maar scene actief blijft. Implementeer een `visibilitychange` handler:

```typescript
// In 3D World component
useEffect(() => {
  const handleVisibility = () => {
    if (document.hidden) {
      renderer.setAnimationLoop(null); // Stop render loop
    } else {
      renderer.setAnimationLoop(animate); // Herstart
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => document.removeEventListener('visibilitychange', handleVisibility);
}, []);
```

---

## 6. macOS LSUIElement — Menubar-Only App

### Correcte aanpak

`LSUIElement = true` verwijdert de app uit het Dock én de App Switcher (Cmd+Tab). Dit is de standaard voor menubar-only apps zoals Bartender, CleanMyMac's menubar, etc.

**In `src-tauri/Info.plist` (macOS specific):**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>LSUIElement</key>
    <true/>
</dict>
</plist>
```

**In Tauri v2 `tauri.conf.json`:**

```json
{
  "bundle": {
    "macOS": {
      "infoPlist": {
        "LSUIElement": true
      }
    }
  }
}
```

**Valkuilen met LSUIElement:**

1. **Venster focus gedrag verandert** — `window.set_focus()` moet expliciet aangeroepen worden na `.show()`, want LSUIElement apps krijgen geen automatische focus
   ```rust
   window.show().unwrap();
   window.set_focus().unwrap(); // VERPLICHT bij LSUIElement
   ```

2. **Cmd+Tab werkt niet** — users kunnen niet naar de app switchen. Zorg dat het tray icon altijd zichtbaar en klikbaar is.

3. **macOS 14 Sonoma:** Tray icons zijn gestandardiseerd. Test op Sonoma dat je icon correct schaalt (template image aanbevolen: zwart/wit met transparantie, `@2x` variant).

4. **Activation policy in code:**
   ```rust
   // Als je tóch soms dock icon wil tonen (bijv. voor "Open 3D World"):
   #[cfg(target_os = "macos")]
   app.set_activation_policy(tauri::ActivationPolicy::Accessory);
   // vs Regular (toont dock icon):
   // app.set_activation_policy(tauri::ActivationPolicy::Regular);
   ```
   `Accessory` = geen dock icon maar wél venster focus. `Prohibited` = strict menubar only.

5. **Tauri v2 specifiek:** Zet `activationPolicy` in de builder:
   ```rust
   tauri::Builder::default()
       .setup(|app| {
           #[cfg(target_os = "macos")]
           app.set_activation_policy(tauri::ActivationPolicy::Accessory);
           Ok(())
       })
   ```

**Aanbeveling:** Gebruik `ActivationPolicy::Accessory` (niet `Prohibited`) — dit geeft betere window focus behavior terwijl de app uit het dock blijft.

---

## 7. Security — CSP voor `localhost:8091`

### Standaard Tauri CSP (te restrictief)

De Tauri default CSP blokkeert alles buiten de app zelf. Voor `localhost:8091` moet je expliciet whitelisten.

### Aanbevolen CSP configuratie

```json
{
  "app": {
    "security": {
      "csp": {
        "default-src": ["'self'", "tauri:"],
        "connect-src": [
          "'self'",
          "http://localhost:8091",
          "ws://localhost:8091",
          "http://127.0.0.1:8091",
          "ws://127.0.0.1:8091"
        ],
        "img-src": [
          "'self'",
          "asset:",
          "https:",
          "http://localhost:8091",
          "data:"
        ],
        "media-src": ["'self'", "http://localhost:8091"],
        "script-src": ["'self'", "'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "font-src": ["'self'", "data:"],
        "worker-src": ["'self'", "blob:"]
      }
    }
  }
}
```

**Waarom `ws://localhost:8091` erbij?**
- SSE gebruikt HTTP long-polling onder de hood, maar als CrewHub ooit WebSocket toevoegt (bijv. voor gateway), is deze al gewhitelisted

**`unsafe-inline` voor scripts:**
- Vite injecteert inline scripts in dev mode
- In production: verwijder `'unsafe-inline'` en gebruik een nonce-based CSP
- Voor nu (dev + early production): acceptabel

### Capabilities systeem (Tauri v2)

Tauri v2 gebruikt een **capabilities** systeem naast CSP. Maak een `capabilities/main.json`:

```json
{
  "identifier": "main-window",
  "description": "Capabilities for chat and world windows",
  "windows": ["chat", "world"],
  "permissions": [
    "core:default",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-focus",
    "core:window:allow-set-size",
    "core:window:allow-set-position",
    "http:default",
    "store:default"
  ]
}
```

**Principe van least privilege:**
- Geef het chat window GEEN bestandssysteem toegang
- Geef het world window GEEN shell access
- Alleen de specifieke capabilities die elke window nodig heeft

### CORS op de backend

De FastAPI backend moet CORS correct geconfigureerd hebben voor Tauri requests. Tauri production gebruikt `tauri://localhost` als origin (niet `http://localhost:5180`):

```python
# backend/app/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5180",    # Dev mode
        "http://localhost:1420",    # Tauri dev default
        "tauri://localhost",        # Tauri production (macOS/Linux)
        "https://tauri.localhost",  # Tauri production (Windows WebView2)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Samenvatting Aanbevelingen

| # | Topic | Aanbeveling | Prioriteit |
|---|-------|-------------|-----------|
| 1 | Tray positioning | `tauri-plugin-positioner` + Windows fallback | Hoog |
| 2 | State sync | Backend (SSE) als primaire hub, Tauri events voor UI notificaties | Hoog |
| 3 | View routing | `initializationScript` met `window.__TAURI_VIEW__` | Medium |
| 4 | Backend koppeling | Health check + graceful error UI (geen sidecar) | Hoog |
| 5 | Window lifecycle | Hide (niet destroy) + render loop pauzeren bij hidden | Medium |
| 6 | LSUIElement | `ActivationPolicy::Accessory` + expliciete `set_focus()` | Hoog |
| 7 | CSP | Whitelist `localhost:8091` in connect-src + backend CORS update | Kritiek |

### Quick wins voor eerste implementatie

1. ✅ Voeg `LSUIElement` toe aan `tauri.conf.json` (5 min)
2. ✅ Stel CSP in met `localhost:8091` whitelist (10 min)
3. ✅ Gebruik `initializationScript` voor view detection (15 min)
4. ✅ Implementeer `AppHealthGate` component (30 min)
5. ✅ `window.on_window_event` → prevent close + hide (20 min)
6. ✅ Update FastAPI CORS origins (5 min)

### Toekomstige verbeteringen (niet voor MVP)

- Optionele backend auto-launch via Rust `Command::spawn()`
- `tauri-plugin-autostart` voor start bij login
- Deep linking (`crewhub://chat`)
- Window state persistence (grootte + positie onthouden)

---

*Review door Ekinbot — 2026-02-17 — Branch: feature/tauri-desktop-app*
