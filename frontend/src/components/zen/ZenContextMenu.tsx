/**
 * Zen Context Menu - Right-click context menu for panels
 */

import { useEffect, useRef } from 'react'
import { type PanelType, PANEL_INFO } from './types/layout'

// Available panel types for the submenu
const PANEL_TYPES: PanelType[] = ['chat', 'sessions', 'activity', 'rooms', 'tasks', 'kanban', 'cron', 'logs']

interface ContextMenuPosition {
  x: number
  y: number
}

interface ZenContextMenuProps {
  position: ContextMenuPosition
  canClose: boolean
  onClose: () => void
  onSplitVertical?: () => void
  onSplitHorizontal?: () => void
  onChangePanelType?: (type: PanelType) => void
  onClosePanel?: () => void
}

export function ZenContextMenu({
  position,
  canClose,
  onClose,
  onSplitVertical,
  onSplitHorizontal,
  onChangePanelType,
  onClosePanel,
}: ZenContextMenuProps) {
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
  
  // Adjust position to stay within viewport
  useEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    
    const rect = menu.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    // Adjust horizontally if needed
    if (rect.right > viewportWidth) {
      menu.style.left = `${position.x - rect.width}px`
    }
    
    // Adjust vertically if needed
    if (rect.bottom > viewportHeight) {
      menu.style.top = `${position.y - rect.height}px`
    }
  }, [position])
  
  return (
    <div 
      className="zen-context-menu"
      ref={menuRef}
      style={{ 
        left: position.x, 
        top: position.y 
      }}
      role="menu"
    >
      {/* Split actions */}
      {onSplitVertical && (
        <button
          className="zen-context-menu-item"
          onClick={() => { onSplitVertical(); onClose() }}
          role="menuitem"
        >
          <span className="zen-context-menu-item-icon">⬍</span>
          <span>Split Vertical</span>
        </button>
      )}
      
      {onSplitHorizontal && (
        <button
          className="zen-context-menu-item"
          onClick={() => { onSplitHorizontal(); onClose() }}
          role="menuitem"
        >
          <span className="zen-context-menu-item-icon">⬌</span>
          <span>Split Horizontal</span>
        </button>
      )}
      
      {/* Panel type submenu */}
      {onChangePanelType && (
        <>
          <div className="zen-context-menu-separator" />
          <div className="zen-context-menu-submenu">
            <div className="zen-context-menu-label">Change Panel Type</div>
            {PANEL_TYPES.map(type => {
              const info = PANEL_INFO[type]
              return (
                <button
                  key={type}
                  className="zen-context-menu-item"
                  onClick={() => { onChangePanelType(type); onClose() }}
                  role="menuitem"
                >
                  <span className="zen-context-menu-item-icon">{info.icon}</span>
                  <span>{info.label}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
      
      {/* Close action */}
      {canClose && onClosePanel && (
        <>
          <div className="zen-context-menu-separator" />
          <button
            className="zen-context-menu-item zen-context-menu-item-danger"
            onClick={() => { onClosePanel(); onClose() }}
            role="menuitem"
          >
            <span className="zen-context-menu-item-icon">✕</span>
            <span>Close Panel</span>
          </button>
        </>
      )}
    </div>
  )
}
