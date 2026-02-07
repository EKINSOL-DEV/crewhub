/**
 * Zen Keyboard Help Overlay
 * Shows all keyboard shortcuts grouped by category
 * Triggered by Ctrl+/ or ?
 */

import { useEffect, useCallback, useRef } from 'react'

interface ShortcutGroup {
  title: string
  icon: string
  shortcuts: Array<{
    keys: string[]
    description: string
  }>
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Global',
    icon: '🌐',
    shortcuts: [
      { keys: ['Esc'], description: 'Exit Zen Mode / Close modal' },
      { keys: ['Ctrl', 'K'], description: 'Open command palette' },
      { keys: ['Ctrl', '/'], description: 'Show keyboard shortcuts' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Toggle Zen Mode (from outside)' },
    ],
  },
  {
    title: 'Panel Navigation',
    icon: '🧭',
    shortcuts: [
      { keys: ['Tab'], description: 'Focus next panel' },
      { keys: ['Shift', 'Tab'], description: 'Focus previous panel' },
      { keys: ['Ctrl', '1-9'], description: 'Focus panel by number' },
    ],
  },
  {
    title: 'Panel Operations',
    icon: '🪟',
    shortcuts: [
      { keys: ['Ctrl', '\\'], description: 'Split panel vertically' },
      { keys: ['Ctrl', 'Shift', '\\'], description: 'Split panel horizontally' },
      { keys: ['Ctrl', 'Shift', 'W'], description: 'Close focused panel' },
      { keys: ['Ctrl', 'Shift', 'M'], description: 'Maximize / restore panel' },
      { keys: ['Ctrl', 'Shift', '←→↑↓'], description: 'Resize focused panel' },
    ],
  },
  {
    title: 'Layouts',
    icon: '📐',
    shortcuts: [
      { keys: ['Ctrl', 'Shift', 'L'], description: 'Cycle layout presets' },
      { keys: ['Ctrl', 'Shift', 'S'], description: 'Save current layout' },
    ],
  },
  {
    title: 'Theme',
    icon: '🎨',
    shortcuts: [
      { keys: ['Ctrl', 'Shift', 'T'], description: 'Open theme picker' },
    ],
  },
  {
    title: 'Sessions',
    icon: '🤖',
    shortcuts: [
      { keys: ['Ctrl', 'N'], description: 'New chat with agent picker' },
      { keys: ['Ctrl', 'Shift', 'N'], description: 'Spawn new agent session' },
    ],
  },
  {
    title: 'Chat (when focused)',
    icon: '💬',
    shortcuts: [
      { keys: ['Enter'], description: 'Send message' },
      { keys: ['Shift', 'Enter'], description: 'New line' },
      { keys: ['Escape'], description: 'Cancel streaming / clear input' },
      { keys: ['↑'], description: 'Edit last message' },
      { keys: ['Page Up/Down'], description: 'Scroll history' },
    ],
  },
]

interface ZenKeyboardHelpProps {
  onClose: () => void
}

export function ZenKeyboardHelp({ onClose }: ZenKeyboardHelpProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  
  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onClose])
  
  // Click outside to close
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])
  
  // Focus trap
  useEffect(() => {
    modalRef.current?.focus()
  }, [])
  
  return (
    <div 
      className="zen-keyboard-help-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts"
    >
      <div 
        ref={modalRef}
        className="zen-keyboard-help"
        tabIndex={-1}
      >
        <header className="zen-keyboard-help-header">
          <h2 className="zen-keyboard-help-title">
            <span className="zen-keyboard-help-icon">⌨️</span>
            Keyboard Shortcuts
          </h2>
          <div className="zen-keyboard-help-hints">
            <span><kbd className="zen-kbd">Esc</kbd> close</span>
          </div>
        </header>
        
        <div className="zen-keyboard-help-content">
          <div className="zen-keyboard-help-grid">
            {SHORTCUT_GROUPS.map((group) => (
              <section key={group.title} className="zen-keyboard-help-group">
                <h3 className="zen-keyboard-help-group-title">
                  <span className="zen-keyboard-help-group-icon">{group.icon}</span>
                  {group.title}
                </h3>
                <div className="zen-keyboard-help-list">
                  {group.shortcuts.map((shortcut, index) => (
                    <div key={index} className="zen-keyboard-help-item">
                      <div className="zen-keyboard-help-keys">
                        {shortcut.keys.map((key, keyIndex) => (
                          <kbd key={keyIndex} className="zen-kbd zen-kbd-large">
                            {key}
                          </kbd>
                        ))}
                      </div>
                      <span className="zen-keyboard-help-desc">
                        {shortcut.description}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
        
        <footer className="zen-keyboard-help-footer">
          <span className="zen-keyboard-help-tip">
            💡 Tip: Use <kbd className="zen-kbd">Ctrl+K</kbd> command palette for quick access to all actions
          </span>
        </footer>
      </div>
    </div>
  )
}
