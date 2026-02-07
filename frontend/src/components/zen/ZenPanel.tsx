/**
 * Zen Panel - Individual panel wrapper with header and focus state
 */

import { type ReactNode, useCallback, useState, useEffect, useRef } from 'react'
import { type LeafNode, type PanelType, PANEL_INFO } from './types/layout'

// Available panel types for switcher
const PANEL_TYPES: PanelType[] = ['chat', 'sessions', 'activity', 'rooms', 'tasks', 'cron', 'logs']

// ── Panel Type Picker Component ────────────────────────────────

interface PanelTypePickerProps {
  currentType: PanelType
  onSelect: (type: PanelType) => void
  onClose: () => void
}

function PanelTypePicker({ currentType, onSelect, onClose }: PanelTypePickerProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])
  
  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])
  
  return (
    <div className="zen-panel-type-menu" ref={menuRef}>
      {PANEL_TYPES.map(type => {
        const info = PANEL_INFO[type]
        return (
          <button
            key={type}
            className={`zen-panel-type-option ${type === currentType ? 'active' : ''}`}
            onClick={() => {
              onSelect(type)
              onClose()
            }}
          >
            <span>{info.icon}</span>
            <span>{info.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Panel Props ────────────────────────────────────────────────

interface ZenPanelProps {
  panel: LeafNode
  isFocused: boolean
  canClose: boolean
  children: ReactNode
  onFocus: () => void
  onClose: () => void
  onSplitVertical?: () => void
  onSplitHorizontal?: () => void
  onChangePanelType?: (type: PanelType) => void
}

export function ZenPanel({
  panel,
  isFocused,
  canClose,
  children,
  onFocus,
  onClose,
  onSplitVertical,
  onSplitHorizontal,
  onChangePanelType,
}: ZenPanelProps) {
  const [showTypePicker, setShowTypePicker] = useState(false)
  const info = PANEL_INFO[panel.panelType]
  
  // Build the display label
  let displayLabel = info.label
  if (panel.panelType === 'chat' && panel.agentName) {
    displayLabel = panel.agentName
  }
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    // Don't focus if clicking on a button or interactive element
    const target = e.target as HTMLElement
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return
    }
    onFocus()
  }, [onFocus])
  
  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onClose()
  }, [onClose])
  
  const handleChangeType = useCallback((type: PanelType) => {
    onChangePanelType?.(type)
  }, [onChangePanelType])
  
  return (
    <div 
      className={`zen-panel ${isFocused ? 'zen-panel-focused' : ''}`}
      onClick={handleClick}
      role="region"
      aria-label={displayLabel}
      tabIndex={-1}
    >
      {/* Panel Header */}
      <div className="zen-panel-header">
        <div className="zen-panel-header-left">
          <span className="zen-panel-icon">
            {panel.panelType === 'chat' && panel.agentIcon ? panel.agentIcon : info.icon}
          </span>
          {onChangePanelType ? (
            <div className="zen-panel-type-picker">
              <button
                type="button"
                className="zen-panel-title zen-panel-title-btn"
                onClick={(e) => { e.stopPropagation(); setShowTypePicker(!showTypePicker) }}
                title="Change panel type"
              >
                {displayLabel}
                <span className="zen-panel-title-chevron">▾</span>
              </button>
              {showTypePicker && (
                <PanelTypePicker
                  currentType={panel.panelType}
                  onSelect={handleChangeType}
                  onClose={() => setShowTypePicker(false)}
                />
              )}
            </div>
          ) : (
            <span className="zen-panel-title">{displayLabel}</span>
          )}
        </div>
        
        <div className="zen-panel-header-right">
          {/* Split Vertical (side by side) */}
          {onSplitVertical && (
            <button
              type="button"
              className="zen-btn zen-btn-icon zen-panel-split"
              onClick={(e) => { e.stopPropagation(); onSplitVertical(); }}
              title="Split vertical (Ctrl+\)"
              aria-label="Split panel vertically"
            >
              ⬍
            </button>
          )}
          
          {/* Split Horizontal (stacked) */}
          {onSplitHorizontal && (
            <button
              type="button"
              className="zen-btn zen-btn-icon zen-panel-split"
              onClick={(e) => { e.stopPropagation(); onSplitHorizontal(); }}
              title="Split horizontal (Ctrl+Shift+\)"
              aria-label="Split panel horizontally"
            >
              ⬌
            </button>
          )}
          
          {/* Close button */}
          {canClose && (
            <button
              type="button"
              className="zen-btn zen-btn-icon zen-panel-close"
              onClick={handleClose}
              title="Close panel (Ctrl+Shift+W)"
              aria-label="Close panel"
            >
              ×
            </button>
          )}
        </div>
      </div>
      
      {/* Panel Content */}
      <div className="zen-panel-content">
        {children}
      </div>
    </div>
  )
}
