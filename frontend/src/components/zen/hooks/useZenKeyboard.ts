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
function isInputTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

function consumeShortcut(e: KeyboardEvent): void {
  e.preventDefault()
  e.stopPropagation()
}

function handleResizeShortcut(e: KeyboardEvent, actions: ZenKeyboardActions): boolean {
  if (!(e.ctrlKey && e.shiftKey && e.key.startsWith('Arrow'))) return false

  consumeShortcut(e)
  const resizeMap: Record<string, (() => void) | undefined> = {
    ArrowLeft: actions.onResizeLeft,
    ArrowRight: actions.onResizeRight,
    ArrowUp: actions.onResizeUp,
    ArrowDown: actions.onResizeDown,
  }
  resizeMap[e.key]?.()
  return true
}

interface ShortcutRule {
  match: (e: KeyboardEvent, isInput: boolean) => boolean
  run: (actions: ZenKeyboardActions, e: KeyboardEvent) => void
}

const SHORTCUT_RULES: ShortcutRule[] = [
  {
    match: (e) => e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k',
    run: (a) => a.onOpenCommandPalette?.(),
  },
  {
    match: (e) => e.ctrlKey && e.altKey && !e.shiftKey && e.key.toLowerCase() === 't',
    run: (a) => a.onNewTab?.(),
  },
  {
    match: (e) => e.ctrlKey && e.altKey && !e.shiftKey && e.key.toLowerCase() === 'w',
    run: (a) => a.onCloseTab?.(),
  },
  {
    match: (e) => e.ctrlKey && e.altKey && e.key === 'Tab',
    run: (a, e) => {
      if (e.shiftKey) a.onPrevTab?.()
      else a.onNextTab?.()
    },
  },
  {
    match: (e) => e.ctrlKey && e.altKey && !e.shiftKey && e.key.toLowerCase() === 'r',
    run: (a) => a.onReopenClosedTab?.(),
  },
  {
    match: (e) => e.ctrlKey && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'y',
    run: (a) => a.onOpenThemePicker?.(),
  },
  {
    match: (e, isInput) => e.key === 'Tab' && !isInput && !e.ctrlKey && !e.altKey,
    run: (a, e) => {
      if (e.shiftKey) a.onFocusPrev?.()
      else a.onFocusNext?.()
    },
  },
  {
    match: (e) => e.ctrlKey && !e.shiftKey && !e.altKey && e.key >= '1' && e.key <= '9',
    run: (a, e) => a.onFocusPanelByIndex?.(Number.parseInt(e.key) - 1),
  },
  {
    match: (e) => e.ctrlKey && !e.shiftKey && e.key === '\\',
    run: (a) => a.onSplitVertical?.(),
  },
  {
    match: (e) => e.ctrlKey && e.shiftKey && e.key === '\\',
    run: (a) => a.onSplitHorizontal?.(),
  },
  {
    match: (e) => e.ctrlKey && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'w',
    run: (a) => a.onClosePanel?.(),
  },
  {
    match: (e) => e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm',
    run: (a) => a.onToggleMaximize?.(),
  },
  {
    match: (e) => e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l',
    run: (a) => a.onCycleLayouts?.(),
  },
  {
    match: (e) => e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's',
    run: (a) => a.onSaveLayout?.(),
  },
  {
    match: (e, isInput) => (e.ctrlKey && e.key === '/') || (!isInput && e.key === '?'),
    run: (a) => a.onOpenKeyboardHelp?.(),
  },
  {
    match: (e, isInput) => e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'n' && !isInput,
    run: (a) => a.onNewChat?.(),
  },
]

export function useZenKeyboard({ enabled = true, actions }: UseZenKeyboardOptions) {
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const a = actionsRef.current

    if (e.key === 'Escape') {
      if (document.querySelector('[data-fullscreen-overlay]')) return
      consumeShortcut(e)
      a.onExit?.()
      return
    }

    const isInput = isInputTarget(e.target)

    for (const rule of SHORTCUT_RULES) {
      if (!rule.match(e, isInput)) continue
      consumeShortcut(e)
      rule.run(a, e)
      return
    }

    handleResizeShortcut(e, a)
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
