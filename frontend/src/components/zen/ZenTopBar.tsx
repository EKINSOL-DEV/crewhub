/**
 * Zen Mode Top Bar
 * Minimal header with title and exit button
 */

interface ZenTopBarProps {
  onExit: () => void
}

export function ZenTopBar({ onExit }: ZenTopBarProps) {
  return (
    <header className="zen-top-bar">
      <div className="zen-top-bar-left">
        <div className="zen-top-bar-title">
          <span className="zen-top-bar-title-icon">🧘</span>
          <span>Zen Mode</span>
        </div>
      </div>
      
      <div className="zen-top-bar-right">
        <button
          className="zen-btn zen-btn-icon zen-btn-close"
          onClick={onExit}
          title="Exit Zen Mode (Esc)"
        >
          ✕
        </button>
      </div>
    </header>
  )
}
