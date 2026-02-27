/**
 * Zen Context Menu - Right-click context menu for panels
 */

import { useEffect, useRef } from 'react'
import { type PanelType } from './types/layout'
import { getSelectablePanelIds, getPanelDef } from './registry'

interface ContextMenuPosition {
  x: number
  y: number
}

interface ZenContextMenuProps {
  readonly position: ContextMenuPosition
  readonly canClose: boolean
  readonly onClose: () => void
  readonly onSplitVertical?: () => void
  readonly onSplitHorizontal?: () => void
  readonly onChangePanelType?: (type: PanelType) => void
  readonly onClosePanel?: () => void
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
        top: position.y,
      }}
      role="menu"
    >
      {/* Split actions */}
      {onSplitVertical && (
        <button
          className="zen-context-menu-item"
          onClick={() => {
            onSplitVertical()
            onClose()
          }}
          role="menuitem"
        >
          <span className="zen-context-menu-item-icon">⬍</span>
          <span>Split Vertical</span>
        </button>
      )}

      {onSplitHorizontal && (
        <button
          className="zen-context-menu-item"
          onClick={() => {
            onSplitHorizontal()
            onClose()
          }}
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
            {getSelectablePanelIds().map((panelId) => {
              const def = getPanelDef(panelId)
              return (
                <button
                  key={panelId}
                  className="zen-context-menu-item"
                  onClick={() => {
                    onChangePanelType(panelId)
                    onClose()
                  }}
                  role="menuitem"
                >
                  <span className="zen-context-menu-item-icon">{def.icon}</span>
                  <span>{def.label}</span>
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
            onClick={() => {
              onClosePanel()
              onClose()
            }}
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
