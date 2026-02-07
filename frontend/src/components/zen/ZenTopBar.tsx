/**
 * Zen Mode Top Bar
 * Minimal header with title, layout info, and exit button
 */

interface ZenTopBarProps {
  onExit: () => void
  isMaximized?: boolean
  onRestore?: () => void
  layoutName?: string
}

export function ZenTopBar({ onExit, isMaximized, onRestore, layoutName }: ZenTopBarProps) {
  return (
    <header className="zen-top-bar">
      <div className="zen-top-bar-left">
        <div className="zen-top-bar-title">
          <span className="zen-top-bar-title-icon">🧘</span>
          <span>Zen Mode</span>
        </div>
        
        {layoutName && (
          <>
            <span className="zen-top-bar-separator">•</span>
            <span className="zen-top-bar-layout">{layoutName}</span>
          </>
        )}
      </div>
      
      <div className="zen-top-bar-center">
        <div className="zen-top-bar-hints">
          <span className="zen-top-bar-hint">
            <kbd className="zen-kbd">Tab</kbd> switch panels
          </span>
          <span className="zen-top-bar-hint">
            <kbd className="zen-kbd">Ctrl+\</kbd> split
          </span>
          <span className="zen-top-bar-hint">
            <kbd className="zen-kbd">Ctrl+Shift+L</kbd> layouts
          </span>
        </div>
      </div>
      
      <div className="zen-top-bar-right">
        {isMaximized && onRestore && (
          <button
            className="zen-btn zen-btn-icon"
            onClick={onRestore}
            title="Restore layout (Ctrl+Shift+M)"
          >
            ⊡
          </button>
        )}
        
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
