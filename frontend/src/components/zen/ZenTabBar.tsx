/**
 * Zen Tab Bar
 * Tab strip for managing multiple Zen Mode workspaces
 */

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react'
import type { ZenTab, ZenProjectFilter } from './hooks/useZenMode'

interface ZenTabBarProps {
  tabs: ZenTab[]
  activeTabId: string
  canAddTab: boolean
  closedTabsCount: number
  onSwitchTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onAddTab: (projectFilter?: ZenProjectFilter) => void
  onReopenClosedTab?: () => void
  onRenameTab?: (tabId: string, newLabel: string) => void
}

interface TabItemProps {
  tab: ZenTab
  isActive: boolean
  isOnly: boolean
  onSelect: () => void
  onClose: () => void
  onRename?: (newLabel: string) => void
}

function TabItem({ tab, isActive, isOnly, onSelect, onClose, onRename }: TabItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(tab.label)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (onRename) {
        setEditValue(tab.label)
        setIsEditing(true)
      }
    },
    [onRename, tab.label]
  )

  const handleRenameSubmit = useCallback(() => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== tab.label) {
      onRename?.(trimmed)
    }
    setIsEditing(false)
  }, [editValue, tab.label, onRename])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleRenameSubmit()
      } else if (e.key === 'Escape') {
        setEditValue(tab.label)
        setIsEditing(false)
      }
    },
    [handleRenameSubmit, tab.label]
  )

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!isOnly) {
        onClose()
      }
    },
    [isOnly, onClose]
  )

  const projectColor = tab.projectFilter?.projectColor

  return (
    <div
      className={`zen-tab ${isActive ? 'zen-tab-active' : ''}`}
      onClick={onSelect}
      onDoubleClick={handleDoubleClick}
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      title={tab.label + (tab.projectFilter ? ` (${tab.projectFilter.projectName})` : '')}
    >
      {/* Project color dot */}
      {tab.projectFilter && (
        <span
          className="zen-tab-dot"
          style={{
            backgroundColor: projectColor || 'var(--zen-accent)',
          }}
        />
      )}

      {/* Tab label */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          className="zen-tab-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={handleKeyDown}
          maxLength={30}
        />
      ) : (
        <span className="zen-tab-label">{tab.label}</span>
      )}

      {/* Close button */}
      {!isOnly && (
        <button
          type="button"
          className="zen-tab-close"
          onClick={handleClose}
          aria-label={`Close ${tab.label}`}
          title="Close tab"
        >
          ×
        </button>
      )}
    </div>
  )
}

export function ZenTabBar({
  tabs,
  activeTabId,
  canAddTab,
  closedTabsCount,
  onSwitchTab,
  onCloseTab,
  onAddTab,
  onReopenClosedTab,
  onRenameTab,
}: ZenTabBarProps) {
  const tabListRef = useRef<HTMLDivElement>(null)
  const [showScrollButtons, setShowScrollButtons] = useState(false)

  // Check if scroll buttons are needed
  useEffect(() => {
    const checkScroll = () => {
      if (tabListRef.current) {
        const { scrollWidth, clientWidth } = tabListRef.current
        setShowScrollButtons(scrollWidth > clientWidth)
      }
    }

    checkScroll()
    window.addEventListener('resize', checkScroll)

    // Also check when tabs change
    const observer = new ResizeObserver(checkScroll)
    if (tabListRef.current) {
      observer.observe(tabListRef.current)
    }

    return () => {
      window.removeEventListener('resize', checkScroll)
      observer.disconnect()
    }
  }, [tabs.length])

  // Scroll active tab into view
  useEffect(() => {
    const activeEl = tabListRef.current?.querySelector('.zen-tab-active')
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [activeTabId])

  const scrollLeft = useCallback(() => {
    if (tabListRef.current) {
      tabListRef.current.scrollBy({ left: -150, behavior: 'smooth' })
    }
  }, [])

  const scrollRight = useCallback(() => {
    if (tabListRef.current) {
      tabListRef.current.scrollBy({ left: 150, behavior: 'smooth' })
    }
  }, [])

  const handleAddTab = useCallback(() => {
    onAddTab()
  }, [onAddTab])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Keyboard navigation within tab bar
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId)
        if (currentIndex === -1) return

        const delta = e.key === 'ArrowLeft' ? -1 : 1
        const newIndex = (currentIndex + delta + tabs.length) % tabs.length
        onSwitchTab(tabs[newIndex].id)
        e.preventDefault()
      }
    },
    [tabs, activeTabId, onSwitchTab]
  )

  const isOnly = tabs.length === 1

  return (
    <div className="zen-tab-bar" role="tablist" onKeyDown={handleKeyDown}>
      {/* Scroll left button */}
      {showScrollButtons && (
        <button
          type="button"
          className="zen-tab-scroll zen-tab-scroll-left"
          onClick={scrollLeft}
          aria-label="Scroll tabs left"
        >
          ◀
        </button>
      )}

      {/* Tab list */}
      <div className="zen-tab-list" ref={tabListRef}>
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            isOnly={isOnly}
            onSelect={() => onSwitchTab(tab.id)}
            onClose={() => onCloseTab(tab.id)}
            onRename={onRenameTab ? (label) => onRenameTab(tab.id, label) : undefined}
          />
        ))}
      </div>

      {/* Scroll right button */}
      {showScrollButtons && (
        <button
          type="button"
          className="zen-tab-scroll zen-tab-scroll-right"
          onClick={scrollRight}
          aria-label="Scroll tabs right"
        >
          ▶
        </button>
      )}

      {/* Add tab button */}
      <button
        type="button"
        className="zen-tab-add"
        onClick={handleAddTab}
        disabled={!canAddTab}
        title={canAddTab ? 'New tab (Ctrl+Alt+T)' : `Maximum ${tabs.length} tabs reached`}
        aria-label="Add new tab"
      >
        +
      </button>

      {/* Reopen closed tab button */}
      {closedTabsCount > 0 && onReopenClosedTab && (
        <button
          type="button"
          className="zen-tab-reopen"
          onClick={onReopenClosedTab}
          title={`Reopen closed tab (${closedTabsCount} available)`}
          aria-label="Reopen last closed tab"
        >
          ↩
        </button>
      )}
    </div>
  )
}
