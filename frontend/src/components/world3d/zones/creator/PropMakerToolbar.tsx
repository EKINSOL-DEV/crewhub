/**
 * PropMakerToolbar — Top bar for FullscreenPropMaker.
 * Shows title, live status, and the close button.
 */

// ── Props ─────────────────────────────────────────────────────

export interface PropMakerToolbarProps {
  readonly isGenerating: boolean
  readonly successMessage: string | null
  readonly onClose: () => void
}

// ── Component ─────────────────────────────────────────────────

export function PropMakerToolbar({ isGenerating, successMessage, onClose }: PropMakerToolbarProps) {
  return (
    <div className="fpm-topbar">
      <div className="fpm-topbar-left">
        <span className="fpm-topbar-icon">🔧</span>
        <span className="fpm-topbar-title">Prop Maker</span>
        {isGenerating && (
          <span className="fpm-topbar-status" style={{ color: '#eab308' }}>
            ⚙️ Generating...
          </span>
        )}
        {successMessage && (
          <span className="fpm-topbar-status" style={{ color: 'var(--zen-success, #22c55e)' }}>
            {successMessage}
          </span>
        )}
      </div>
      <button className="fpm-close" onClick={onClose} title="Close (Esc)">
        ✕
      </button>
    </div>
  )
}
