/**
 * Zen Command Palette
 * Quick access to all Zen Mode commands with fuzzy search
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { getPanelCommands } from './registry'

// ── Command Types ─────────────────────────────────────────────────

export interface Command {
  id: string
  label: string
  description?: string
  icon?: string
  shortcut?: string
  category: 'layout' | 'theme' | 'panel' | 'navigation' | 'general'
  action: () => void
}

interface ZenCommandPaletteProps {
  readonly commands: Command[]
  readonly onClose: () => void
}

// ── Fuzzy Search ──────────────────────────────────────────────────

function fuzzyMatch(query: string, text: string): { match: boolean; score: number } {
  if (!query) return { match: true, score: 0 }

  query = query.toLowerCase()
  text = text.toLowerCase()

  // Exact substring match gets highest score
  if (text.includes(query)) {
    return { match: true, score: 100 - text.indexOf(query) }
  }

  // Fuzzy character-by-character match
  let queryIndex = 0
  let score = 0
  let consecutiveMatches = 0

  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (text[i] === query[queryIndex]) {
      queryIndex++
      consecutiveMatches++
      score += consecutiveMatches * 2 // Bonus for consecutive matches
    } else {
      consecutiveMatches = 0
    }
  }

  const match = queryIndex === query.length
  return { match, score: match ? score : 0 }
}

// ── Component ─────────────────────────────────────────────────────

export function ZenCommandPalette({ commands, onClose }: ZenCommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filter and sort commands by fuzzy match
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      return commands
    }

    return commands
      .map((cmd) => ({
        cmd,
        ...fuzzyMatch(query, `${cmd.label} ${cmd.description || ''}`),
      }))
      .filter(({ match }) => match)
      .sort((a, b) => b.score - a.score)
      .map(({ cmd }) => cmd)
  }, [commands, query])

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups = new Map<string, Command[]>()

    for (const cmd of filteredCommands) {
      const group = groups.get(cmd.category) || []
      group.push(cmd)
      groups.set(cmd.category, group)
    }

    return groups
  }, [filteredCommands])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Execute selected command
  const executeCommand = useCallback(
    (cmd: Command) => {
      onClose()
      // Small delay to allow modal to close before action
      setTimeout(() => cmd.action(), 50)
    },
    [onClose]
  )

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex])
          }
          break
        case 'Tab':
          e.preventDefault()
          if (e.shiftKey) {
            setSelectedIndex((i) => Math.max(i - 1, 0))
          } else {
            setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1))
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredCommands, selectedIndex, executeCommand, onClose])

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return

    const items = list.querySelectorAll('.zen-command-item')
    items[selectedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedIndex])

  // Click outside to close
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose]
  )

  // Category labels
  const categoryLabels: Record<string, { icon: string; label: string }> = {
    general: { icon: '⚡', label: 'General' },
    layout: { icon: '📐', label: 'Layout' },
    theme: { icon: '🎨', label: 'Themes' },
    panel: { icon: '🪟', label: 'Panels' },
    navigation: { icon: '🧭', label: 'Navigation' },
  }

  let globalIndex = -1

  return (
    <div
      className="zen-command-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div className="zen-command-palette">
        <div className="zen-command-input-wrapper">
          <span className="zen-command-input-icon">⌘</span>
          <input
            ref={inputRef}
            type="text"
            className="zen-command-input"
            placeholder="Type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search commands"
          />
          {query && (
            <button
              className="zen-command-clear"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div ref={listRef} className="zen-command-list" role="listbox">
          {filteredCommands.length === 0 ? (
            <div className="zen-command-empty">
              <span className="zen-command-empty-icon">🔍</span>
              <span>No commands found</span>
            </div>
          ) : (
            Array.from(groupedCommands.entries()).map(([category, cmds]) => (
              <div key={category} className="zen-command-group">
                <div className="zen-command-group-header">
                  <span>{categoryLabels[category]?.icon || '📁'}</span>
                  <span>{categoryLabels[category]?.label || category}</span>
                </div>
                {cmds.map((cmd) => {
                  globalIndex++
                  const isSelected = globalIndex === selectedIndex
                  const currentIndex = globalIndex

                  return (
                    <button
                      key={cmd.id}
                      className={`zen-command-item ${isSelected ? 'zen-command-item-selected' : ''}`}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <span className="zen-command-item-icon">{cmd.icon || '→'}</span>
                      <div className="zen-command-item-content">
                        <span className="zen-command-item-label">{cmd.label}</span>
                        {cmd.description && (
                          <span className="zen-command-item-desc">{cmd.description}</span>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <span className="zen-command-item-shortcut">
                          {cmd.shortcut.split('+').map((key, i) => (
                            <span key={`key-${i}`} className="zen-kbd">
                              {key}
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="zen-command-footer">
          <span>
            <span className="zen-kbd">↑↓</span> navigate
          </span>
          <span>
            <span className="zen-kbd">Enter</span> run
          </span>
          <span>
            <span className="zen-kbd">Esc</span> close
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Command Registry Hook ─────────────────────────────────────────

export interface UseCommandRegistryOptions {
  onExit: () => void
  onOpenThemePicker: () => void
  onCycleLayouts: () => void
  onSplitVertical: () => void
  onSplitHorizontal: () => void
  onClosePanel: () => void
  onToggleMaximize: () => void
  themes: Array<{ id: string; name: string }>
  onSetTheme: (themeId: string) => void
  // Phase 5 additions
  onOpenKeyboardHelp?: () => void
  onSaveLayout?: () => void
  onLoadLayout?: () => void
  onNewChat?: () => void
  onAddPanel?: (type: string) => void
}

export function useCommandRegistry(options: UseCommandRegistryOptions): Command[] {
  return useMemo(() => {
    const commands: Command[] = [
      // General
      {
        id: 'zen.exit',
        label: 'Exit Zen Mode',
        description: 'Return to normal view',
        icon: '🚪',
        shortcut: 'Esc',
        category: 'general',
        action: options.onExit,
      },
      {
        id: 'zen.keyboard-help',
        label: 'Keyboard Shortcuts',
        description: 'Show all keyboard shortcuts',
        icon: '⌨️',
        shortcut: 'Ctrl+/',
        category: 'general',
        action: options.onOpenKeyboardHelp || (() => {}),
      },

      // Navigation
      {
        id: 'nav.new-chat',
        label: 'New Chat',
        description: 'Open new chat with agent picker',
        icon: '💬',
        shortcut: 'Ctrl+N',
        category: 'navigation',
        action: options.onNewChat || (() => {}),
      },

      // Layout
      {
        id: 'layout.cycle',
        label: 'Cycle Layouts',
        description: 'Switch between layout presets',
        icon: '🔄',
        shortcut: 'Ctrl+Shift+L',
        category: 'layout',
        action: options.onCycleLayouts,
      },
      {
        id: 'layout.save',
        label: 'Save Layout',
        description: 'Save current layout as preset',
        icon: '💾',
        shortcut: 'Ctrl+Shift+S',
        category: 'layout',
        action: options.onSaveLayout || (() => {}),
      },
      {
        id: 'layout.load',
        label: 'Load Layout',
        description: 'Load a saved layout or preset',
        icon: '📂',
        category: 'layout',
        action: options.onLoadLayout || (() => {}),
      },
      {
        id: 'layout.split-vertical',
        label: 'Split Vertically',
        description: 'Split focused panel left/right',
        icon: '↔️',
        shortcut: 'Ctrl+\\',
        category: 'layout',
        action: options.onSplitVertical,
      },
      {
        id: 'layout.split-horizontal',
        label: 'Split Horizontally',
        description: 'Split focused panel top/bottom',
        icon: '↕️',
        shortcut: 'Ctrl+Shift+\\',
        category: 'layout',
        action: options.onSplitHorizontal,
      },
      {
        id: 'layout.maximize',
        label: 'Toggle Maximize',
        description: 'Maximize or restore focused panel',
        icon: '⛶',
        shortcut: 'Ctrl+Shift+M',
        category: 'layout',
        action: options.onToggleMaximize,
      },

      // Panel types — auto-generated from registry
      ...(options.onAddPanel ? getPanelCommands(options.onAddPanel) : []),
      {
        id: 'panel.close',
        label: 'Close Panel',
        description: 'Close the focused panel',
        icon: '✕',
        shortcut: 'Ctrl+Shift+W',
        category: 'panel',
        action: options.onClosePanel,
      },

      // Theme - Quick picker
      {
        id: 'theme.picker',
        label: 'Change Theme',
        description: 'Open theme picker',
        icon: '🎨',
        shortcut: 'Ctrl+Shift+T',
        category: 'theme',
        action: options.onOpenThemePicker,
      },

      // Individual themes
      ...options.themes.map((theme) => ({
        id: `theme.set.${theme.id}`,
        label: `Theme: ${theme.name}`,
        description: `Switch to ${theme.name} theme`,
        icon: '🎨',
        category: 'theme' as const,
        action: () => options.onSetTheme(theme.id),
      })),
    ]

    return commands
  }, [options])
}
