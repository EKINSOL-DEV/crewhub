/**
 * Zen Mode Top Bar
 * Minimal header with title, layout info, theme, and action buttons
 */

interface ZenTopBarProps {
  onExit: () => void
  isMaximized?: boolean
  onRestore?: () => void
  layoutName?: string
  themeName?: string
  onOpenThemePicker?: () => void
  onOpenCommandPalette?: () => void
  onOpenKeyboardHelp?: () => void
}

export function ZenTopBar({ 
  onExit, 
  isMaximized, 
  onRestore, 
  layoutName,
  themeName,
  onOpenThemePicker,
  onOpenCommandPalette,
  onOpenKeyboardHelp,
}: ZenTopBarProps) {
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
            <kbd className="zen-kbd">Ctrl+K</kbd> commands
          </span>
          <span className="zen-top-bar-hint">
            <kbd className="zen-kbd">Tab</kbd> panels
          </span>
          <span className="zen-top-bar-hint">
            <kbd className="zen-kbd">Ctrl+\</kbd> split
          </span>
        </div>
      </div>
      
      <div className="zen-top-bar-right">
        {/* Theme Button */}
        {themeName && onOpenThemePicker && (
          <button
            className="zen-btn zen-btn-theme"
            onClick={onOpenThemePicker}
            title="Change theme (Ctrl+Shift+T)"
          >
            <span className="zen-btn-theme-icon">🎨</span>
            <span className="zen-btn-theme-name">{themeName}</span>
          </button>
        )}
        
        {/* Keyboard Help Button */}
        {onOpenKeyboardHelp && (
          <button
            className="zen-btn zen-btn-icon"
            onClick={onOpenKeyboardHelp}
            title="Keyboard shortcuts (Ctrl+/)"
          >
            ⌨️
          </button>
        )}
        
        {/* Command Palette Button */}
        {onOpenCommandPalette && (
          <button
            className="zen-btn zen-btn-icon"
            onClick={onOpenCommandPalette}
            title="Command palette (Ctrl+K)"
          >
            ⌘
          </button>
        )}
        
        {/* Restore from maximized */}
        {isMaximized && onRestore && (
          <button
            className="zen-btn zen-btn-icon"
            onClick={onRestore}
            title="Restore layout (Ctrl+Shift+M)"
          >
            ⊡
          </button>
        )}
        
        {/* Exit button */}
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
