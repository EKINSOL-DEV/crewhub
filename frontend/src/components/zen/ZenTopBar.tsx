import { useState, useEffect, useCallback } from 'react'
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
  isMaximized?: boolean
  onRestore?: () => void
  layoutName?: string
  themeName?: string
  onOpenThemePicker?: () => void
  onOpenCommandPalette?: () => void
  onOpenKeyboardHelp?: () => void
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
  isMaximized, 
  onRestore, 
  layoutName,
  themeName,
  onOpenThemePicker,
  onOpenCommandPalette,
  onOpenKeyboardHelp,
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
                <span style={{ fontSize: '12px', fontWeight: 500 }}>
                  {projectFilter.name}
                </span>
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
          
          {/* Fullscreen toggle */}
          <button
            type="button"
            className="zen-btn zen-btn-icon"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen (F11)" : "Fullscreen (F11)"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? '⊙' : '⛶'}
          </button>
          
          {/* Exit button */}
          <button
            type="button"
            className="zen-btn zen-btn-icon zen-btn-close"
            onClick={onExit}
            title="Exit Zen Mode (Esc)"
            aria-label="Exit Zen Mode"
          >
            ✕
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
