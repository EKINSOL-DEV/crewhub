/**
 * Zen Mode - Full-screen focused workspace
 * A tmux-inspired interface for distraction-free agent interaction
 * 
 * Phase 2: Multi-panel split-tree layout
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ZenTopBar } from './ZenTopBar'
import { ZenStatusBar } from './ZenStatusBar'
import { ZenPanelContainer } from './ZenPanelContainer'
import { ZenChatPanel } from './ZenChatPanel'
import { ZenSessionsPanel } from './ZenSessionsPanel'
import { ZenActivityPanel } from './ZenActivityPanel'
import { ZenEmptyPanel } from './ZenEmptyPanel'
import { useZenLayout } from './hooks/useZenLayout'
import { useZenKeyboard } from './hooks/useZenKeyboard'
import { tokyoNight, themeToCSSVariables } from './themes/tokyo-night'
import { type LeafNode, type PanelType, countPanels } from './types/layout'
import './ZenMode.css'

interface ZenModeProps {
  sessionKey: string | null
  agentName: string | null
  agentIcon: string | null
  agentColor: string | null
  roomName?: string
  connected: boolean
  onExit: () => void
}

export function ZenMode({
  sessionKey: initialSessionKey,
  agentName: initialAgentName,
  agentIcon: initialAgentIcon,
  agentColor: _agentColor,
  roomName,
  connected,
  onExit,
}: ZenModeProps) {
  const [agentStatus, setAgentStatus] = useState<'active' | 'thinking' | 'idle' | 'error'>('idle')
  
  // Layout state
  const layout = useZenLayout()
  
  // Apply theme CSS variables
  useEffect(() => {
    const root = document.documentElement
    const vars = themeToCSSVariables(tokyoNight)
    
    const originalValues: Record<string, string> = {}
    
    Object.entries(vars).forEach(([key, value]) => {
      originalValues[key] = root.style.getPropertyValue(key)
      root.style.setProperty(key, value)
    })

    root.setAttribute('data-zen-theme', tokyoNight.id)

    return () => {
      Object.entries(originalValues).forEach(([key, value]) => {
        if (value) {
          root.style.setProperty(key, value)
        } else {
          root.style.removeProperty(key)
        }
      })
      root.removeAttribute('data-zen-theme')
    }
  }, [])

  // Lock body scroll
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])
  
  // Set initial session on the first chat panel
  useEffect(() => {
    if (initialSessionKey && initialAgentName) {
      const chatPanel = layout.panels.find(p => p.panelType === 'chat')
      if (chatPanel && !chatPanel.agentSessionKey) {
        layout.setPanelAgent(chatPanel.panelId, initialSessionKey, initialAgentName, initialAgentIcon || undefined)
      }
    }
  }, [initialSessionKey, initialAgentName, initialAgentIcon, layout])

  // Keyboard shortcuts
  useZenKeyboard({
    enabled: true,
    actions: {
      onExit,
      onFocusNext: layout.focusNextPanel,
      onFocusPrev: layout.focusPrevPanel,
      onFocusPanelByIndex: layout.focusPanelByIndex,
      onSplitVertical: () => layout.splitPanel(layout.focusedPanelId, 'row', 'empty'),
      onSplitHorizontal: () => layout.splitPanel(layout.focusedPanelId, 'col', 'empty'),
      onClosePanel: () => layout.closePanel(layout.focusedPanelId),
      onToggleMaximize: layout.toggleMaximize,
      onCycleLayouts: layout.cyclePresets,
      onResizeLeft: () => layout.resizePanel(layout.focusedPanelId, -0.05),
      onResizeRight: () => layout.resizePanel(layout.focusedPanelId, 0.05),
      onResizeUp: () => layout.resizePanel(layout.focusedPanelId, -0.05),
      onResizeDown: () => layout.resizePanel(layout.focusedPanelId, 0.05),
    },
  })

  const handleStatusChange = useCallback((status: 'active' | 'thinking' | 'idle' | 'error') => {
    setAgentStatus(status)
  }, [])
  
  // Handle session selection from sessions panel
  const handleSelectSession = useCallback((sessionKey: string, agentName: string, agentIcon?: string) => {
    // Find focused chat panel, or any chat panel, or create one
    const focusedPanel = layout.focusedPanel
    
    if (focusedPanel?.panelType === 'chat') {
      // Update the focused chat panel
      layout.setPanelAgent(focusedPanel.panelId, sessionKey, agentName, agentIcon)
    } else {
      // Find first chat panel
      const chatPanel = layout.panels.find(p => p.panelType === 'chat')
      if (chatPanel) {
        layout.setPanelAgent(chatPanel.panelId, sessionKey, agentName, agentIcon)
        layout.focusPanel(chatPanel.panelId)
      }
    }
  }, [layout])
  
  // Handle empty panel type selection
  const handleSelectPanelType = useCallback((panelId: string, type: PanelType) => {
    layout.updatePanelState(panelId, { panelType: type })
  }, [layout])
  
  // Get the name of the focused agent for status bar
  const focusedAgentName = useMemo(() => {
    const panel = layout.focusedPanel
    if (panel?.panelType === 'chat' && panel.agentName) {
      return panel.agentName
    }
    return initialAgentName
  }, [layout.focusedPanel, initialAgentName])
  
  // Can close panels if more than one
  const canClose = countPanels(layout.layout) > 1

  // Render panel content based on type
  const renderPanel = useCallback((panel: LeafNode) => {
    switch (panel.panelType) {
      case 'chat':
        return (
          <ZenChatPanel
            sessionKey={panel.agentSessionKey || null}
            agentName={panel.agentName || null}
            agentIcon={panel.agentIcon || null}
            onStatusChange={handleStatusChange}
          />
        )
      
      case 'sessions':
        return (
          <ZenSessionsPanel
            selectedSessionKey={layout.focusedPanel?.panelType === 'chat' 
              ? layout.focusedPanel.agentSessionKey 
              : undefined}
            onSelectSession={handleSelectSession}
          />
        )
      
      case 'activity':
        return <ZenActivityPanel />
      
      case 'empty':
      default:
        return (
          <ZenEmptyPanel 
            onSelectPanelType={(type) => handleSelectPanelType(panel.panelId, type)} 
          />
        )
    }
  }, [handleStatusChange, handleSelectSession, handleSelectPanelType, layout.focusedPanel])

  return (
    <div 
      className="zen-mode zen-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Zen Mode - Focused workspace"
    >
      <ZenTopBar 
        onExit={onExit} 
        isMaximized={layout.isMaximized}
        onRestore={layout.isMaximized ? layout.restoreLayout : undefined}
        layoutName={layout.isMaximized ? 'Maximized' : undefined}
      />
      
      <main className="zen-main">
        <ZenPanelContainer
          node={layout.layout}
          focusedPanelId={layout.focusedPanelId}
          canClose={canClose}
          onFocus={layout.focusPanel}
          onClose={layout.closePanel}
          onResize={layout.resizePanel}
          renderPanel={renderPanel}
        />
      </main>
      
      <ZenStatusBar
        agentName={focusedAgentName}
        agentStatus={agentStatus}
        roomName={roomName}
        connected={connected}
        panelCount={layout.panelCount}
        focusedPanelIndex={layout.panels.findIndex(p => p.panelId === layout.focusedPanelId) + 1}
      />
    </div>
  )
}

// ── Zen Mode Entry Button ──────────────────────────────────────

interface ZenModeButtonProps {
  onClick: () => void
}

export function ZenModeButton({ onClick }: ZenModeButtonProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        borderRadius: '8px',
        border: 'none',
        background: isHovered ? 'rgba(122, 162, 247, 0.2)' : 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        color: isHovered ? '#7aa2f7' : 'rgba(255, 255, 255, 0.8)',
        fontSize: '13px',
        fontWeight: 500,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      }}
      title="Enter Zen Mode (Ctrl+Shift+Z)"
    >
      <span style={{ fontSize: '16px' }}>🧘</span>
      <span>Zen</span>
      {isHovered && (
        <span 
          style={{ 
            fontSize: '10px', 
            opacity: 0.7,
            padding: '2px 4px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '3px',
          }}
        >
          Ctrl+Shift+Z
        </span>
      )}
    </button>
  )
}
