import { useState, useEffect, useCallback, useRef } from 'react'
import { ZenTabBar } from './ZenTabBar'
import type { ZenTab, ZenProjectFilter } from './hooks/useZenMode'

/**
 * Zen Mode Top Bar
 * Minimal header with tabs, title, layout info, theme, and action buttons
 */

interface ProjectFilterInfo {
  name: string
  color?: string
}

interface ZenTopBarProps {
  onExit: () => void
  exitLabel?: string // Default "World" — standalone uses "Projects"
  exitIcon?: string // Default "🌍"
  isMaximized?: boolean
  onRestore?: () => void
  layoutName?: string
  themeName?: string
  onOpenThemePicker?: () => void
  onOpenCommandPalette?: () => void
  onOpenKeyboardHelp?: () => void
  onAddBrowserPanel?: () => void
  projectFilter?: ProjectFilterInfo
  onClearProjectFilter?: () => void
  // Tab bar props
  tabs?: ZenTab[]
  activeTabId?: string
  canAddTab?: boolean
  closedTabsCount?: number
  onSwitchTab?: (tabId: string) => void
  onCloseTab?: (tabId: string) => void
  onAddTab?: (projectFilter?: ZenProjectFilter) => void
  onReopenClosedTab?: () => void
  onRenameTab?: (tabId: string, newLabel: string) => void
}

/**
 * Always-on-top toggle — only meaningful in the standalone Tauri Zen window.
 * We detect this by checking both __TAURI_INTERNALS__ (Tauri context) and
 * the ?mode=zen query param (standalone zen window, not the overlay).
 */
function useAlwaysOnTop() {
  const [pinned, setPinned] = useState(false)
  const isStandalone = useRef(
    typeof window !== 'undefined' &&
      !!window.__TAURI_INTERNALS__ &&
      new URLSearchParams(window.location.search).get('mode') === 'zen'
  )

  const toggle = useCallback(async () => {
    if (!isStandalone.current) return
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const next = !pinned
      await getCurrentWindow().setAlwaysOnTop(next)
      setPinned(next)
    } catch (e) {
      console.warn('[ZenTopBar] setAlwaysOnTop failed:', e)
    }
  }, [pinned])

  return { pinned, toggle, isStandalone: isStandalone.current }
}

function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement)

  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }, [])

  return { isFullscreen, toggle }
}

export function ZenTopBar({
  onExit,
  exitLabel = 'World',
  exitIcon = '🌍',
  isMaximized,
  onRestore,
  layoutName,
  themeName,
  onOpenThemePicker,
  onOpenCommandPalette,
  onOpenKeyboardHelp,
  onAddBrowserPanel,
  projectFilter,
  onClearProjectFilter,
  // Tab bar props
  tabs,
  activeTabId,
  canAddTab = true,
  closedTabsCount = 0,
  onSwitchTab,
  onCloseTab,
  onAddTab,
  onReopenClosedTab,
  onRenameTab,
}: ZenTopBarProps) {
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()
  const { pinned, toggle: togglePin, isStandalone: showPinButton } = useAlwaysOnTop()
  const showTabBar = tabs && tabs.length > 0 && onSwitchTab && onCloseTab && onAddTab

  // Keyboard shortcut for fullscreen (F11 or Ctrl+Shift+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11' || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f')) {
        e.preventDefault()
        toggleFullscreen()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleFullscreen])

  return (
    <div className="zen-top-bar-wrapper">
      {/* Main Top Bar (Title) */}
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

          {/* Project Focus Indicator (only if no tab bar, else it's shown in tab) */}
          {projectFilter && !showTabBar && (
            <>
              <span className="zen-top-bar-separator">•</span>
              <div
                className="zen-top-bar-project"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  background: projectFilter.color
                    ? `${projectFilter.color}20`
                    : 'var(--zen-bg-hover)',
                  borderRadius: '6px',
                  border: projectFilter.color
                    ? `1px solid ${projectFilter.color}50`
                    : '1px solid var(--zen-border)',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: projectFilter.color || 'var(--zen-accent)',
                  }}
                />
                <span style={{ fontSize: '12px', fontWeight: 500 }}>{projectFilter.name}</span>
                {onClearProjectFilter && (
                  <button
                    type="button"
                    onClick={onClearProjectFilter}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '16px',
                      height: '16px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--zen-fg-muted)',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      fontSize: '12px',
                      marginLeft: '2px',
                    }}
                    title="Clear project filter"
                  >
                    ✕
                  </button>
                )}
              </div>
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
              type="button"
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
              type="button"
              className="zen-btn zen-btn-icon"
              onClick={onOpenKeyboardHelp}
              title="Keyboard shortcuts (Ctrl+/)"
              aria-label="Keyboard shortcuts"
            >
              ⌨️
            </button>
          )}

          {/* Command Palette Button */}
          {onOpenCommandPalette && (
            <button
              type="button"
              className="zen-btn zen-btn-icon"
              onClick={onOpenCommandPalette}
              title="Command palette (Ctrl+K)"
              aria-label="Open command palette"
            >
              🔍
            </button>
          )}

          {/* Restore from maximized */}
          {isMaximized && onRestore && (
            <button
              type="button"
              className="zen-btn zen-btn-icon"
              onClick={onRestore}
              title="Restore layout (Ctrl+Shift+M)"
              aria-label="Restore layout"
            >
              ⊡
            </button>
          )}

          {/* Add Browser Panel button */}
          {onAddBrowserPanel && (
            <button
              type="button"
              className="zen-btn zen-btn-icon"
              onClick={onAddBrowserPanel}
              title="Add browser panel (split right)"
              aria-label="Add browser panel"
              style={{ fontSize: '14px' }}
            >
              🌐
            </button>
          )}

          {/* Always-on-top pin — only in standalone Tauri Zen window */}
          {showPinButton && (
            <button
              type="button"
              className={`zen-btn zen-btn-icon ${pinned ? 'zen-btn-active' : ''}`}
              onClick={togglePin}
              title={pinned ? 'Unpin window (disable always-on-top)' : 'Pin window (always on top)'}
              aria-label={pinned ? 'Disable always on top' : 'Enable always on top'}
              style={{
                opacity: pinned ? 1 : undefined,
                color: pinned ? 'var(--zen-accent)' : undefined,
              }}
            >
              📌
            </button>
          )}

          {/* Fullscreen toggle */}
          <button
            type="button"
            className="zen-btn zen-btn-icon"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen (F11)' : 'Fullscreen (F11)'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? '⊙' : '⛶'}
          </button>

          {/* Exit button (World in CrewHub, Projects in standalone) */}
          <button
            type="button"
            className="zen-btn zen-btn-world"
            onClick={onExit}
            title={`Go to ${exitLabel} (Esc)`}
            aria-label={`Go to ${exitLabel}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <span>{exitIcon}</span>
            <span>{exitLabel}</span>
          </button>
        </div>
      </header>

      {/* Tab Bar (below title bar) */}
      {showTabBar && (
        <ZenTabBar
          tabs={tabs}
          activeTabId={activeTabId || tabs[0]?.id || ''}
          canAddTab={canAddTab}
          closedTabsCount={closedTabsCount}
          onSwitchTab={onSwitchTab}
          onCloseTab={onCloseTab}
          onAddTab={onAddTab}
          onReopenClosedTab={onReopenClosedTab}
          onRenameTab={onRenameTab}
        />
      )}
    </div>
  )
}
