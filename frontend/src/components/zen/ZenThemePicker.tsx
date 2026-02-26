/**
 * Zen Theme Picker
 * A beautiful modal for selecting themes with color previews
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { themeInfo, type ThemeInfo } from './themes'

interface ZenThemePickerProps {
  readonly currentThemeId: string
  readonly onSelectTheme: (themeId: string) => void
  readonly onClose: () => void
}

export function ZenThemePicker({ currentThemeId, onSelectTheme, onClose }: ZenThemePickerProps) {
  const [selectedIndex, setSelectedIndex] = useState(() =>
    Math.max(
      0,
      themeInfo.findIndex((t) => t.id === currentThemeId)
    )
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Focus trap and keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'ArrowDown':
        case 'j':
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, themeInfo.length - 1))
          break
        case 'ArrowUp':
        case 'k':
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          onSelectTheme(themeInfo[selectedIndex].id)
          onClose()
          break
        case 'Tab':
          e.preventDefault()
          if (e.shiftKey) {
            setSelectedIndex((i) => Math.max(i - 1, 0))
          } else {
            setSelectedIndex((i) => Math.min(i + 1, themeInfo.length - 1))
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, onSelectTheme, onClose])

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current
    const item = list?.children[selectedIndex] as HTMLElement | undefined
    if (item) {
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])

  // Click outside to close
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === containerRef.current) {
        onClose()
      }
    },
    [onClose]
  )

  const handleThemeClick = useCallback(
    (theme: ThemeInfo, index: number) => {
      setSelectedIndex(index)
      onSelectTheme(theme.id)
      onClose()
    },
    [onSelectTheme, onClose]
  )

  return (
    <div
      ref={containerRef}
      className="zen-theme-picker-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Select Theme"
    >
      <div className="zen-theme-picker">
        <div className="zen-theme-picker-header">
          <h2 className="zen-theme-picker-title">
            <span className="zen-theme-picker-icon">🎨</span> Select Theme
          </h2>
          <div className="zen-theme-picker-hints">
            <span className="zen-kbd">↑↓</span> navigate{' '}
            <span className="zen-theme-picker-sep">•</span> <span className="zen-kbd">Enter</span>{' '}
            select <span className="zen-theme-picker-sep">•</span>{' '}
            <span className="zen-kbd">Esc</span> close
          </div>
        </div>

        <div className="zen-theme-picker-sections">
          <div className="zen-theme-picker-section">
            <h3 className="zen-theme-picker-section-title">
              <span>🌙</span> Dark Themes
            </h3>
            <div ref={listRef} className="zen-theme-picker-list">
              {themeInfo
                .filter((t) => t.type === 'dark')
                .map((theme) => {
                  const globalIndex = themeInfo.findIndex((t) => t.id === theme.id)
                  return (
                    <ThemeOption
                      key={theme.id}
                      theme={theme}
                      isSelected={globalIndex === selectedIndex}
                      isCurrent={theme.id === currentThemeId}
                      onClick={() => handleThemeClick(theme, globalIndex)}
                    />
                  )
                })}
            </div>
          </div>

          <div className="zen-theme-picker-section">
            <h3 className="zen-theme-picker-section-title">
              <span>☀️</span> Light Themes
            </h3>
            <div className="zen-theme-picker-list">
              {themeInfo
                .filter((t) => t.type === 'light')
                .map((theme) => {
                  const globalIndex = themeInfo.findIndex((t) => t.id === theme.id)
                  return (
                    <ThemeOption
                      key={theme.id}
                      theme={theme}
                      isSelected={globalIndex === selectedIndex}
                      isCurrent={theme.id === currentThemeId}
                      onClick={() => handleThemeClick(theme, globalIndex)}
                    />
                  )
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ThemeOptionProps {
  readonly theme: ThemeInfo
  readonly isSelected: boolean
  readonly isCurrent: boolean
  readonly onClick: () => void
}

function ThemeOption({ theme, isSelected, isCurrent, onClick }: ThemeOptionProps) {
  return (
    <button
      className={`zen-theme-option ${isSelected ? 'zen-theme-option-selected' : ''} ${isCurrent ? 'zen-theme-option-current' : ''}`}
      onClick={onClick}
      aria-selected={isSelected}
      role="option"
    >
      <div
        className="zen-theme-preview"
        style={{
          background: theme.preview.bg,
          borderColor: theme.preview.accent,
        }}
      >
        <div className="zen-theme-preview-accent" style={{ background: theme.preview.accent }} />
        <div className="zen-theme-preview-text" style={{ color: theme.preview.fg }}>
          Aa
        </div>
      </div>

      <div className="zen-theme-info">
        <div className="zen-theme-name">
          {theme.name}
          {isCurrent && <span className="zen-theme-current-badge">Current</span>}
        </div>
        <div className="zen-theme-description">{theme.description}</div>
      </div>

      <div className="zen-theme-colors">
        <div
          className="zen-theme-color-dot"
          style={{ background: theme.preview.bg }}
          title="Background"
        />
        <div
          className="zen-theme-color-dot"
          style={{ background: theme.preview.accent }}
          title="Accent"
        />
        <div
          className="zen-theme-color-dot"
          style={{ background: theme.preview.fg }}
          title="Foreground"
        />
      </div>
    </button>
  )
}
