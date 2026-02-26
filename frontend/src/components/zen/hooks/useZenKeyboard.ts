/**
 * Zen Mode Keyboard Shortcuts Hook
 * Handles all keyboard shortcuts within Zen Mode
 */

import { useEffect, useCallback, useRef } from 'react'

export interface ZenKeyboardActions {
  // Navigation
  onFocusNext?: () => void
  onFocusPrev?: () => void
  onFocusPanelByIndex?: (index: number) => void

  // Panel operations
  onSplitVertical?: () => void
  onSplitHorizontal?: () => void
  onClosePanel?: () => void
  onToggleMaximize?: () => void

  // Layout
  onCycleLayouts?: () => void
  onSaveLayout?: () => void

  // Exit
  onExit?: () => void

  // Resize (returns delta to apply)
  onResizeLeft?: () => void
  onResizeRight?: () => void
  onResizeUp?: () => void
  onResizeDown?: () => void

  // Theme & Command Palette
  onOpenThemePicker?: () => void
  onOpenCommandPalette?: () => void
  onOpenKeyboardHelp?: () => void

  // Session management
  onNewChat?: () => void

  // Tab management
  onNewTab?: () => void
  onCloseTab?: () => void
  onNextTab?: () => void
  onPrevTab?: () => void
  onReopenClosedTab?: () => void
}

export interface UseZenKeyboardOptions {
  enabled?: boolean
  actions: ZenKeyboardActions
}

/**
 * Safe keyboard shortcuts that don't conflict with browser defaults
 *
 * GLOBAL
 *   Escape           Exit Zen Mode / Close modal
 *   Ctrl+K           Open command palette
 *   Tab              Focus next panel
 *   Shift+Tab        Focus previous panel
 *   Ctrl+1-9         Focus panel by number
 *
 * PANELS
 *   Ctrl+\           Split vertical
 *   Ctrl+Shift+\     Split horizontal
 *   Ctrl+Shift+W     Close panel (NOT Ctrl+W - that closes browser tab!)
 *   Ctrl+Shift+M     Maximize/restore panel
 *
 * TABS
 *   Ctrl+Alt+T       New tab (Ctrl+T conflicts with browser)
 *   Ctrl+Alt+W       Close tab
 *   Ctrl+Alt+Tab     Next tab
 *   Ctrl+Alt+Shift+Tab  Previous tab
 *   Ctrl+Alt+R       Reopen closed tab (Ctrl+Shift+T conflicts with browser)
 *
 * LAYOUT
 *   Ctrl+Shift+L     Cycle layouts
 *
 * THEME
 *   Ctrl+Shift+Y     Open theme picker
 *
 * RESIZE
 *   Ctrl+Shift+Arrow Resize focused panel
 */
export function useZenKeyboard({ enabled = true, actions }: UseZenKeyboardOptions) {
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // NOSONAR
    // NOSONAR: complexity from legitimate keyboard shortcut dispatch; each branch handles a distinct key binding
    const a = actionsRef.current

    // Escape - Exit (but NOT if a fullscreen overlay is open — it handles its own Escape)
    if (e.key === 'Escape') {
      if (document.querySelector('[data-fullscreen-overlay]')) return
      e.preventDefault()
      e.stopPropagation()
      a.onExit?.()
      return
    }

    // Don't capture shortcuts when typing in an input
    const target = e.target as HTMLElement
    const isInput =
      target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

    // Ctrl+K - Command Palette (works even in inputs)
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      e.stopPropagation()
      a.onOpenCommandPalette?.()
      return
    }

    // ── Tab Shortcuts ──────────────────────────────────────────────

    // Ctrl+Alt+T - New tab
    if (e.ctrlKey && e.altKey && !e.shiftKey && e.key.toLowerCase() === 't') {
      e.preventDefault()
      e.stopPropagation()
      a.onNewTab?.()
      return
    }

    // Ctrl+Alt+W - Close tab
    if (e.ctrlKey && e.altKey && !e.shiftKey && e.key.toLowerCase() === 'w') {
      e.preventDefault()
      e.stopPropagation()
      a.onCloseTab?.()
      return
    }

    // Ctrl+Alt+Tab / Ctrl+Alt+Shift+Tab - Navigate tabs
    // Note: Ctrl+Tab is reserved by browser, so we use Ctrl+Alt+Tab
    if (e.ctrlKey && e.altKey && e.key === 'Tab') {
      e.preventDefault()
      e.stopPropagation()
      if (e.shiftKey) {
        a.onPrevTab?.()
      } else {
        a.onNextTab?.()
      }
      return
    }

    // Ctrl+Alt+R - Reopen closed tab (Ctrl+Shift+T conflicts with browser)
    if (e.ctrlKey && e.altKey && !e.shiftKey && e.key.toLowerCase() === 'r') {
      e.preventDefault()
      e.stopPropagation()
      a.onReopenClosedTab?.()
      return
    }

    // ── Theme Picker ───────────────────────────────────────────────

    // Ctrl+Shift+Y - Theme Picker (moved from Ctrl+Shift+T to accommodate reopen tab)
    if (e.ctrlKey && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'y') {
      e.preventDefault()
      e.stopPropagation()
      a.onOpenThemePicker?.()
      return
    }

    // Tab / Shift+Tab - Focus navigation (unless in input with Tab)
    if (e.key === 'Tab' && !isInput && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      if (e.shiftKey) {
        a.onFocusPrev?.()
      } else {
        a.onFocusNext?.()
      }
      return
    }

    // Ctrl+1-9 - Focus panel by index
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key >= '1' && e.key <= '9') {
      e.preventDefault()
      const index = Number.parseInt(e.key) - 1
      a.onFocusPanelByIndex?.(index)
      return
    }

    // Ctrl+\ - Split vertical
    if (e.ctrlKey && !e.shiftKey && e.key === '\\') {
      e.preventDefault()
      a.onSplitVertical?.()
      return
    }

    // Ctrl+Shift+\ - Split horizontal
    if (e.ctrlKey && e.shiftKey && e.key === '\\') {
      e.preventDefault()
      a.onSplitHorizontal?.()
      return
    }

    // Ctrl+Shift+W - Close panel (NOT Ctrl+W!)
    if (e.ctrlKey && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'w') {
      e.preventDefault()
      a.onClosePanel?.()
      return
    }

    // Ctrl+Shift+M - Toggle maximize
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') {
      e.preventDefault()
      a.onToggleMaximize?.()
      return
    }

    // Ctrl+Shift+L - Cycle layouts
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') {
      e.preventDefault()
      a.onCycleLayouts?.()
      return
    }

    // Ctrl+Shift+S - Save layout
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault()
      a.onSaveLayout?.()
      return
    }

    // Ctrl+/ or ? - Keyboard help
    if ((e.ctrlKey && e.key === '/') || (!isInput && e.key === '?')) {
      e.preventDefault()
      a.onOpenKeyboardHelp?.()
      return
    }

    // Ctrl+N - New chat
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'n' && !isInput) {
      e.preventDefault()
      a.onNewChat?.()
      return
    }

    // Ctrl+Shift+Arrow - Resize
    if (e.ctrlKey && e.shiftKey && e.key.startsWith('Arrow')) {
      e.preventDefault()
      switch (e.key) {
        case 'ArrowLeft':
          a.onResizeLeft?.()
          break
        case 'ArrowRight':
          a.onResizeRight?.()
          break
        case 'ArrowUp':
          a.onResizeUp?.()
          break
        case 'ArrowDown':
          a.onResizeDown?.()
          break
      }
      return
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    // Use capture phase to intercept before other handlers
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [enabled, handleKeyDown])
}

// ── Keyboard Hint Component Data ──────────────────────────────────

export interface ShortcutHint {
  keys: string[]
  description: string
  category: 'global' | 'panels' | 'tabs' | 'layout' | 'theme'
}

export const KEYBOARD_SHORTCUTS: ShortcutHint[] = [
  // Global
  { keys: ['Esc'], description: 'Exit Zen Mode', category: 'global' },
  { keys: ['Ctrl', 'K'], description: 'Command palette', category: 'global' },
  { keys: ['Ctrl', '/'], description: 'Keyboard shortcuts', category: 'global' },
  { keys: ['Tab'], description: 'Focus next panel', category: 'global' },
  { keys: ['Shift', 'Tab'], description: 'Focus previous panel', category: 'global' },
  { keys: ['Ctrl', '1-9'], description: 'Focus panel by number', category: 'global' },

  // Tabs
  { keys: ['Ctrl', 'Alt', 'T'], description: 'New tab', category: 'tabs' },
  { keys: ['Ctrl', 'Alt', 'W'], description: 'Close tab', category: 'tabs' },
  { keys: ['Ctrl', 'Alt', 'Tab'], description: 'Next tab', category: 'tabs' },
  { keys: ['Ctrl', 'Alt', 'Shift', 'Tab'], description: 'Previous tab', category: 'tabs' },
  { keys: ['Ctrl', 'Alt', 'R'], description: 'Reopen closed tab', category: 'tabs' },

  // Panels
  { keys: ['Ctrl', '\\'], description: 'Split vertical', category: 'panels' },
  { keys: ['Ctrl', 'Shift', '\\'], description: 'Split horizontal', category: 'panels' },
  { keys: ['Ctrl', 'Shift', 'W'], description: 'Close panel', category: 'panels' },
  { keys: ['Ctrl', 'Shift', 'M'], description: 'Maximize / restore', category: 'panels' },
  { keys: ['Ctrl', 'Shift', '←→↑↓'], description: 'Resize panel', category: 'panels' },

  // Layout
  { keys: ['Ctrl', 'Shift', 'L'], description: 'Cycle layouts', category: 'layout' },
  { keys: ['Ctrl', 'Shift', 'S'], description: 'Save layout', category: 'layout' },

  // Theme
  { keys: ['Ctrl', 'Shift', 'Y'], description: 'Open theme picker', category: 'theme' },

  // Sessions
  { keys: ['Ctrl', 'N'], description: 'New chat with agent', category: 'global' },
]
