/**
 * Zen Panel - Individual panel wrapper with header and focus state
 */

import { type ReactNode, useCallback } from 'react'
import { type LeafNode, PANEL_INFO } from './types/layout'

interface ZenPanelProps {
  panel: LeafNode
  isFocused: boolean
  canClose: boolean
  children: ReactNode
  onFocus: () => void
  onClose: () => void
}

export function ZenPanel({
  panel,
  isFocused,
  canClose,
  children,
  onFocus,
  onClose,
}: ZenPanelProps) {
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
          <span className="zen-panel-title">{displayLabel}</span>
        </div>
        
        <div className="zen-panel-header-right">
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
