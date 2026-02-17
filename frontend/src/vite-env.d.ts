/// <reference types="vite/client" />

// ── Tauri Desktop App Globals ──────────────────────────────────────────────
// Injected by WebviewWindowBuilder.initialization_script() in lib.rs.
// Present only when running inside the Tauri desktop app.
interface Window {
  /**
   * Injected by Tauri's initializationScript before page load.
   * - 'mobile'   → compact chat window (390×700px)
   * - 'desktop'  → full 3D world window (1280×900px)
   * - 'settings' → settings window (420×280px)
   * - undefined  → running in browser (not Tauri)
   */
  __TAURI_VIEW__?: 'mobile' | 'desktop' | 'settings'

  /**
   * Set by Tauri core when running inside the desktop app.
   * Use this to detect Tauri context without importing the API.
   */
  __TAURI__?: unknown
}
