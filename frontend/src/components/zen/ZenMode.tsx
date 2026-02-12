/**
 * Zen Mode - Full-screen focused workspace
 * A tmux-inspired interface for distraction-free agent interaction
 * 
 * Phase 5: Advanced Features (FINAL PHASE)
 * - Enhanced command palette with all commands
 * - Keyboard shortcut overlay
 * - Session management (spawn/kill)
 * - Layout persistence with named presets
 * - Quick actions
 * - Polish: animations, loading skeletons, error boundaries, tooltips
 * 
 * Phase 6: Tabs & State Persistence
 * - Multiple workspace tabs
 * - Per-tab layout/scroll persistence
 * - localStorage-backed state
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { ZenTopBar } from './ZenTopBar'
import { ZenStatusBar } from './ZenStatusBar'
import { ZenPanelContainer } from './ZenPanelContainer'
import { ZenChatPanel } from './ZenChatPanel'
import { ZenSessionsPanel } from './ZenSessionsPanel'
import { ZenActivityPanel } from './ZenActivityPanel'
import { ZenRoomsPanel } from './ZenRoomsPanel'
import { ZenTasksPanel } from './ZenTasksPanel'
import { ZenKanbanPanel } from './ZenKanbanPanel'
import { ZenCronPanel } from './ZenCronPanel'
import { ZenLogsPanel } from './ZenLogsPanel'
import { ProjectsPanel } from './ProjectsPanel'
import { ZenEmptyPanel } from './ZenEmptyPanel'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import { useRoomsContext } from '@/contexts/RoomsContext'
import { ZenThemePicker } from './ZenThemePicker'
import { ZenCommandPalette, useCommandRegistry } from './ZenCommandPalette'
import { ZenKeyboardHelp } from './ZenKeyboardHelp'
import { ZenAgentPicker } from './ZenSessionManager'
import { ZenSaveLayoutModal, ZenLayoutPicker, addRecentLayout, type SavedLayout } from './ZenLayoutManager'
import { ZenErrorBoundary } from './ZenErrorBoundary'
import { useZenMode, type ZenProjectFilter } from './hooks/useZenMode'
import { useZenKeyboard } from './hooks/useZenKeyboard'
import { useZenTheme } from './hooks/useZenTheme'
import { 
  type LeafNode, 
  type LayoutNode,
  type PanelType, 
  type LayoutPreset, 
  countPanels,
  getAllPanels,
  findPanel,
  updatePanel,
  removePanel,
  splitPanel as splitPanelInTree,
  createLeaf,
  createSplit,
} from './types/layout'
import './ZenMode.css'

interface ZenModeProps {
  sessionKey: string | null
  agentName: string | null
  agentIcon: string | null
  agentColor: string | null
  roomName?: string
  connected: boolean
  onExit: () => void
  exitLabel?: string       // "World" (CrewHub) or "Projects" (standalone)
  exitIcon?: string        // "🌍" or "📋"
  projectFilter?: ZenProjectFilter | null  // Filter tasks to specific project
  onClearProjectFilter?: () => void
}

// ── Layout Presets ────────────────────────────────────────────────

const LAYOUT_PRESETS: Record<LayoutPreset, () => LayoutNode> = {
  default: () => createSplit('row', createLeaf('chat'), createLeaf('tasks'), 0.6),
  'multi-chat': () => createSplit('row', createLeaf('chat'), createLeaf('chat'), 0.5),
  monitor: () => createSplit('row', createLeaf('sessions'), createLeaf('activity'), 0.4),
}

export function ZenMode({
  sessionKey: initialSessionKey,
  agentName: initialAgentName,
  agentIcon: initialAgentIcon,
  agentColor: _agentColor,
  roomName,
  connected,
  onExit,
  exitLabel,
  exitIcon,
  projectFilter: propProjectFilter,
  onClearProjectFilter: propClearProjectFilter,
}: ZenModeProps) {
  const [agentStatus, setAgentStatus] = useState<'active' | 'thinking' | 'idle' | 'error'>('idle')
  
  // Room filter state (for filtering sessions by room)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [selectedRoomName, setSelectedRoomName] = useState<string>('All Rooms')
  
  // World focus context for room focus mode
  const { state: worldFocusState } = useWorldFocus()
  const { rooms } = useRoomsContext()
  
  // Zen Mode tabs context
  const zenMode = useZenMode()
  const {
    tabs,
    activeTab,
    activeTabId,
    canAddTab,
    closedTabs,
    createTab,
    closeTab,
    switchTab,
    updateTabLayout,
    updateTabLabel,
    reopenClosedTab,
    setScrollPosition: _setScrollPosition,
    getScrollPosition: _getScrollPosition,
    clearProjectFilter: zenClearProjectFilter,
    setProjectFilter: zenSetProjectFilter,
    projectFilter: zenProjectFilter,
  } = zenMode
  
  // Use project filter from tab or prop
  const projectFilter = zenProjectFilter || propProjectFilter
  const clearProjectFilter = zenClearProjectFilter || propClearProjectFilter
  
  // Get the project ID for tasks filtering
  const activeProjectId = useMemo(() => {
    if (projectFilter?.projectId) {
      return projectFilter.projectId
    }
    if (worldFocusState.level === 'room' && worldFocusState.focusedRoomId) {
      const room = rooms.find(r => r.id === worldFocusState.focusedRoomId)
      return room?.project_id || undefined
    }
    return undefined
  }, [projectFilter, worldFocusState.level, worldFocusState.focusedRoomId, rooms])
  
  const activeProjectName = useMemo(() => {
    if (projectFilter?.projectName) {
      return projectFilter.projectName
    }
    if (worldFocusState.level === 'room' && worldFocusState.focusedRoomId) {
      const room = rooms.find(r => r.id === worldFocusState.focusedRoomId)
      return room?.project_name || room?.name || undefined
    }
    return undefined
  }, [projectFilter, worldFocusState.level, worldFocusState.focusedRoomId, rooms])

  // Find a room belonging to the active project (for context envelope)
  const activeProjectRoomId = useMemo(() => {
    if (!activeProjectId) return undefined
    // If we have a focused room that matches the project, prefer that
    if (worldFocusState.level === 'room' && worldFocusState.focusedRoomId) {
      const room = rooms.find(r => r.id === worldFocusState.focusedRoomId)
      if (room?.project_id === activeProjectId) return room.id
    }
    // Otherwise find first room for this project
    const projectRoom = rooms.find(r => r.project_id === activeProjectId)
    return projectRoom?.id
  }, [activeProjectId, worldFocusState.level, worldFocusState.focusedRoomId, rooms])
  
  // Project filter change handler (shared across panels)
  const handleProjectFilterChange = useCallback((projectId: string | null, projectName: string, projectColor?: string) => {
    if (projectId) {
      zenSetProjectFilter({ projectId, projectName, projectColor })
    } else {
      zenClearProjectFilter?.()
    }
  }, [zenSetProjectFilter, zenClearProjectFilter])
  
  // Modal states
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [showAgentPicker, setShowAgentPicker] = useState(false)
  const [showSaveLayout, setShowSaveLayout] = useState(false)
  const [showLayoutPicker, setShowLayoutPicker] = useState(false)
  
  // Check if any modal is open
  const isModalOpen = showThemePicker || showCommandPalette || showKeyboardHelp || 
                      showAgentPicker || showSaveLayout || showLayoutPicker
  
  // Theme state — use the global unified theme context
  // (useZenTheme is called inside ThemeProvider, we just access it here)
  const theme = useZenTheme()
  
  // Ref for applying theme CSS variables
  const zenContainerRef = useRef<HTMLDivElement>(null)
  
  // ── Layout State (derived from active tab) ──────────────────────
  
  const layout = activeTab?.layout || LAYOUT_PRESETS.default()
  const focusedPanelId = activeTab?.focusedPanelId || ''
  const maximizedPanelId = activeTab?.maximizedPanelId || null
  
  const allPanels = useMemo(() => getAllPanels(layout), [layout])
  const panelCount = allPanels.length
  const focusedPanel = useMemo(() => findPanel(layout, focusedPanelId), [layout, focusedPanelId])
  const isMaximized = maximizedPanelId !== null
  
  // Effective layout (respects maximize)
  const effectiveLayout = useMemo(() => {
    if (maximizedPanelId) {
      const maximizedPanel = findPanel(layout, maximizedPanelId)
      return maximizedPanel || layout
    }
    return layout
  }, [layout, maximizedPanelId])
  
  // ── Layout Actions ──────────────────────────────────────────────
  
  const focusPanel = useCallback((panelId: string) => {
    if (!activeTab) return
    updateTabLayout(activeTab.id, layout, panelId, maximizedPanelId)
  }, [activeTab, layout, maximizedPanelId, updateTabLayout])
  
  const focusNextPanel = useCallback(() => {
    if (!activeTab) return
    const currentIndex = allPanels.findIndex(p => p.panelId === focusedPanelId)
    const nextIndex = (currentIndex + 1) % allPanels.length
    focusPanel(allPanels[nextIndex].panelId)
  }, [activeTab, allPanels, focusedPanelId, focusPanel])
  
  const focusPrevPanel = useCallback(() => {
    if (!activeTab) return
    const currentIndex = allPanels.findIndex(p => p.panelId === focusedPanelId)
    const prevIndex = (currentIndex - 1 + allPanels.length) % allPanels.length
    focusPanel(allPanels[prevIndex].panelId)
  }, [activeTab, allPanels, focusedPanelId, focusPanel])
  
  const focusPanelByIndex = useCallback((index: number) => {
    if (!activeTab || index < 0 || index >= allPanels.length) return
    focusPanel(allPanels[index].panelId)
  }, [activeTab, allPanels, focusPanel])
  
  const splitPanelAction = useCallback((panelId: string, direction: 'row' | 'col', newType: PanelType = 'empty') => {
    if (!activeTab) return
    const newLayout = splitPanelInTree(layout, panelId, direction, newType)
    const newPanels = getAllPanels(newLayout)
    const newPanel = newPanels.find(p => !allPanels.some(op => op.panelId === p.panelId))
    updateTabLayout(activeTab.id, newLayout, newPanel?.panelId || focusedPanelId, null)
  }, [activeTab, layout, allPanels, focusedPanelId, updateTabLayout])
  
  const closePanelAction = useCallback((panelId: string) => {
    if (!activeTab) return
    if (countPanels(layout) <= 1) return
    
    const newLayout = removePanel(layout, panelId)
    if (!newLayout) return
    
    const newPanels = getAllPanels(newLayout)
    const newFocusedId = panelId === focusedPanelId
      ? newPanels[0]?.panelId || ''
      : focusedPanelId
    
    updateTabLayout(activeTab.id, newLayout, newFocusedId, null)
  }, [activeTab, layout, focusedPanelId, updateTabLayout])
  
  const resizePanelAction = useCallback((panelId: string, absoluteRatio: number) => {
    if (!activeTab) return
    
    const setRatio = (node: LayoutNode): LayoutNode => {
      if (node.kind === 'leaf') return node
      
      const inA = findPanel(node.a, panelId)
      const inB = findPanel(node.b, panelId)
      
      if ((inA && node.a.kind === 'leaf') || (inB && node.b.kind === 'leaf')) {
        const newRatio = inA ? absoluteRatio : (1 - absoluteRatio)
        const clampedRatio = Math.max(0.15, Math.min(0.85, newRatio))
        return { ...node, ratio: clampedRatio }
      }
      
      if (inA) return { ...node, a: setRatio(node.a) }
      if (inB) return { ...node, b: setRatio(node.b) }
      
      return node
    }
    
    updateTabLayout(activeTab.id, setRatio(layout))
  }, [activeTab, layout, updateTabLayout])
  
  const toggleMaximize = useCallback(() => {
    if (!activeTab) return
    if (maximizedPanelId) {
      updateTabLayout(activeTab.id, layout, focusedPanelId, null)
    } else {
      updateTabLayout(activeTab.id, layout, focusedPanelId, focusedPanelId)
    }
  }, [activeTab, layout, focusedPanelId, maximizedPanelId, updateTabLayout])
  
  const restoreLayout = useCallback(() => {
    if (!activeTab || !maximizedPanelId) return
    updateTabLayout(activeTab.id, layout, focusedPanelId, null)
  }, [activeTab, layout, focusedPanelId, maximizedPanelId, updateTabLayout])
  
  const applyPreset = useCallback((preset: LayoutPreset) => {
    if (!activeTab) return
    const newLayout = LAYOUT_PRESETS[preset]()
    const newPanels = getAllPanels(newLayout)
    const chatPanel = newPanels.find(p => p.panelType === 'chat')
    updateTabLayout(activeTab.id, newLayout, chatPanel?.panelId || newPanels[0]?.panelId || '', null)
  }, [activeTab, updateTabLayout])
  
  const cyclePresets = useCallback(() => {
    const presetNames: LayoutPreset[] = ['default', 'multi-chat', 'monitor']
    const hasActivity = allPanels.some(p => p.panelType === 'activity')
    const hasSessions = allPanels.some(p => p.panelType === 'sessions')
    const chatCount = allPanels.filter(p => p.panelType === 'chat').length
    
    let currentPreset: LayoutPreset = 'default'
    if (chatCount === 2 && !hasActivity && !hasSessions) {
      currentPreset = 'multi-chat'
    } else if (hasActivity && hasSessions && chatCount === 0) {
      currentPreset = 'monitor'
    }
    
    const currentIndex = presetNames.indexOf(currentPreset)
    const nextPreset = presetNames[(currentIndex + 1) % presetNames.length]
    applyPreset(nextPreset)
  }, [allPanels, applyPreset])
  
  const updatePanelState = useCallback((panelId: string, updates: Partial<LeafNode>) => {
    if (!activeTab) return
    updateTabLayout(activeTab.id, updatePanel(layout, panelId, updates))
  }, [activeTab, layout, updateTabLayout])
  
  const setPanelAgent = useCallback((panelId: string, sessionKey: string, agentName: string, agentIcon?: string) => {
    updatePanelState(panelId, {
      agentSessionKey: sessionKey,
      agentName,
      agentIcon,
    })
  }, [updatePanelState])
  
  // Apply theme CSS variables when theme changes
  useEffect(() => {
    const container = zenContainerRef.current
    if (!container) return
    
    const vars = {
      '--zen-bg': theme.currentTheme.colors.bg,
      '--zen-bg-panel': theme.currentTheme.colors.bgPanel,
      '--zen-bg-hover': theme.currentTheme.colors.bgHover,
      '--zen-bg-active': theme.currentTheme.colors.bgActive,
      '--zen-fg': theme.currentTheme.colors.fg,
      '--zen-fg-muted': theme.currentTheme.colors.fgMuted,
      '--zen-fg-dim': theme.currentTheme.colors.fgDim,
      '--zen-border': theme.currentTheme.colors.border,
      '--zen-border-focus': theme.currentTheme.colors.borderFocus,
      '--zen-accent': theme.currentTheme.colors.accent,
      '--zen-accent-hover': theme.currentTheme.colors.accentHover,
      '--zen-success': theme.currentTheme.colors.success,
      '--zen-warning': theme.currentTheme.colors.warning,
      '--zen-error': theme.currentTheme.colors.error,
      '--zen-info': theme.currentTheme.colors.info,
      '--zen-user-bubble': theme.currentTheme.colors.userBubble,
      '--zen-assistant-bubble': theme.currentTheme.colors.assistantBubble,
      '--zen-syntax-keyword': theme.currentTheme.colors.syntax.keyword,
      '--zen-syntax-string': theme.currentTheme.colors.syntax.string,
      '--zen-syntax-comment': theme.currentTheme.colors.syntax.comment,
      '--zen-syntax-function': theme.currentTheme.colors.syntax.function,
      '--zen-syntax-variable': theme.currentTheme.colors.syntax.variable,
    }
    Object.entries(vars).forEach(([key, value]) => {
      container.style.setProperty(key, value)
    })
    container.setAttribute('data-zen-theme', theme.currentTheme.id)
    container.setAttribute('data-zen-theme-type', theme.currentTheme.type)
  }, [theme.currentTheme])
  
  // Clean up theme on unmount
  useEffect(() => {
    return () => {
      const root = document.documentElement
      root.removeAttribute('data-zen-theme')
      root.removeAttribute('data-zen-theme-type')
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
    if (initialSessionKey && initialAgentName && activeTab) {
      const chatPanel = allPanels.find(p => p.panelType === 'chat')
      if (chatPanel && !chatPanel.agentSessionKey) {
        setPanelAgent(chatPanel.panelId, initialSessionKey, initialAgentName, initialAgentIcon || undefined)
      }
    }
  }, [initialSessionKey, initialAgentName, initialAgentIcon, activeTab, allPanels, setPanelAgent])

  // Handle adding a panel of specific type
  const handleAddPanel = useCallback((type: string) => {
    splitPanelAction(focusedPanelId, 'row', type as PanelType)
  }, [focusedPanelId, splitPanelAction])
  
  // Handle adding a new tab
  const handleAddTab = useCallback((filter?: ZenProjectFilter) => {
    createTab(filter)
  }, [createTab])

  // Command registry
  const commands = useCommandRegistry({
    onExit,
    onOpenThemePicker: () => setShowThemePicker(true),
    onCycleLayouts: cyclePresets,
    onSplitVertical: () => splitPanelAction(focusedPanelId, 'col', 'empty'),
    onSplitHorizontal: () => splitPanelAction(focusedPanelId, 'row', 'empty'),
    onClosePanel: () => closePanelAction(focusedPanelId),
    onToggleMaximize: toggleMaximize,
    themes: theme.themes.map(t => ({ id: t.id, name: t.name })),
    onSetTheme: theme.setTheme,
    onOpenKeyboardHelp: () => setShowKeyboardHelp(true),
    onSaveLayout: () => setShowSaveLayout(true),
    onLoadLayout: () => setShowLayoutPicker(true),
    onNewChat: () => setShowAgentPicker(true),
    onAddPanel: handleAddPanel,
  })

  // Keyboard shortcuts
  useZenKeyboard({
    enabled: !isModalOpen,
    actions: {
      onExit,
      onFocusNext: focusNextPanel,
      onFocusPrev: focusPrevPanel,
      onFocusPanelByIndex: focusPanelByIndex,
      onSplitVertical: () => splitPanelAction(focusedPanelId, 'col', 'empty'),
      onSplitHorizontal: () => splitPanelAction(focusedPanelId, 'row', 'empty'),
      onClosePanel: () => closePanelAction(focusedPanelId),
      onToggleMaximize: toggleMaximize,
      onCycleLayouts: cyclePresets,
      onSaveLayout: () => setShowSaveLayout(true),
      onResizeLeft: () => resizePanelAction(focusedPanelId, -0.05),
      onResizeRight: () => resizePanelAction(focusedPanelId, 0.05),
      onResizeUp: () => resizePanelAction(focusedPanelId, -0.05),
      onResizeDown: () => resizePanelAction(focusedPanelId, 0.05),
      onOpenThemePicker: () => setShowThemePicker(true),
      onOpenCommandPalette: () => setShowCommandPalette(true),
      onOpenKeyboardHelp: () => setShowKeyboardHelp(true),
      onNewChat: () => setShowAgentPicker(true),
      // Tab shortcuts
      onNewTab: () => handleAddTab(),
      onCloseTab: () => closeTab(activeTabId),
      onNextTab: () => {
        const currentIndex = tabs.findIndex(t => t.id === activeTabId)
        const nextIndex = (currentIndex + 1) % tabs.length
        switchTab(tabs[nextIndex].id)
      },
      onPrevTab: () => {
        const currentIndex = tabs.findIndex(t => t.id === activeTabId)
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length
        switchTab(tabs[prevIndex].id)
      },
      onReopenClosedTab: reopenClosedTab,
    },
  })

  const handleStatusChange = useCallback((status: 'active' | 'thinking' | 'idle' | 'error') => {
    setAgentStatus(status)
  }, [])
  
  // Handle session selection from sessions panel
  const handleSelectSession = useCallback((sessionKey: string, agentName: string, agentIcon?: string) => {
    if (focusedPanel?.panelType === 'chat') {
      setPanelAgent(focusedPanel.panelId, sessionKey, agentName, agentIcon)
    } else {
      const chatPanel = allPanels.find(p => p.panelType === 'chat')
      if (chatPanel) {
        setPanelAgent(chatPanel.panelId, sessionKey, agentName, agentIcon)
        focusPanel(chatPanel.panelId)
      }
    }
  }, [focusedPanel, allPanels, setPanelAgent, focusPanel])
  
  // Handle empty panel type selection
  const handleSelectPanelType = useCallback((panelId: string, type: PanelType) => {
    updatePanelState(panelId, { panelType: type })
  }, [updatePanelState])
  
  // Handle theme selection
  const handleSelectTheme = useCallback((themeId: string) => {
    theme.setTheme(themeId)
  }, [theme])
  
  // Handle agent picker selection
  const handleAgentPickerSelect = useCallback((agentId: string, agentName: string, agentIcon: string) => {
    splitPanelAction(focusedPanelId, 'row', 'chat')
    setTimeout(() => {
      const newChatPanel = allPanels.find(p => 
        p.panelType === 'chat' && !p.agentSessionKey
      )
      if (newChatPanel) {
        setPanelAgent(newChatPanel.panelId, `agent:${agentId}:main`, agentName, agentIcon)
      }
    }, 50)
    setShowAgentPicker(false)
  }, [focusedPanelId, allPanels, splitPanelAction, setPanelAgent])
  
  // Handle save layout
  const handleSaveLayout = useCallback((savedLayout: SavedLayout) => {
    addRecentLayout(savedLayout.id)
  }, [])
  
  // Handle layout preset selection
  const handleSelectPreset = useCallback((preset: LayoutPreset) => {
    applyPreset(preset)
    addRecentLayout(preset)
  }, [applyPreset])
  
  // Handle saved layout selection
  const handleSelectSavedLayout = useCallback((savedLayout: SavedLayout) => {
    addRecentLayout(savedLayout.id)
  }, [])
  
  // Get the name of the focused agent for status bar
  const focusedAgentName = useMemo(() => {
    if (focusedPanel?.panelType === 'chat' && focusedPanel.agentName) {
      return focusedPanel.agentName
    }
    return initialAgentName
  }, [focusedPanel, initialAgentName])
  
  // Can close panels if more than one
  const canClose = panelCount > 1

  // Render panel content based on type with error boundary
  const renderPanel = useCallback((panel: LeafNode) => {
    const panelContent = (() => {
      switch (panel.panelType) {
        case 'chat':
          return (
            <ZenChatPanel
              sessionKey={panel.agentSessionKey || null}
              agentName={panel.agentName || null}
              agentIcon={panel.agentIcon || null}
              roomId={activeProjectRoomId}
              onStatusChange={handleStatusChange}
              onChangeAgent={() => setShowAgentPicker(true)}
              onSelectAgent={(agentId, agentName, agentIcon) => {
                setPanelAgent(panel.panelId, `agent:${agentId}:main`, agentName, agentIcon)
              }}
            />
          )
        
        case 'sessions':
          return (
            <ZenSessionsPanel
              selectedSessionKey={focusedPanel?.panelType === 'chat' 
                ? focusedPanel.agentSessionKey 
                : undefined}
              onSelectSession={handleSelectSession}
              roomFilter={selectedRoomId}
            />
          )
        
        case 'activity':
          return <ZenActivityPanel />
        
        case 'rooms':
          return (
            <ZenRoomsPanel
              selectedRoomId={selectedRoomId || undefined}
              onSelectRoom={(roomId, roomName) => {
                setSelectedRoomId(roomId)
                setSelectedRoomName(roomName)
              }}
            />
          )
        
        case 'tasks':
          return (
            <ZenTasksPanel 
              projectId={activeProjectId}
              roomFocusName={activeProjectName}
              onProjectFilterChange={handleProjectFilterChange}
            />
          )
        
        case 'kanban':
          return (
            <ZenKanbanPanel 
              projectId={activeProjectId}
              roomFocusName={activeProjectName}
              onProjectFilterChange={handleProjectFilterChange}
            />
          )
        
        case 'cron':
          return <ZenCronPanel />
        
        case 'logs':
          return <ZenLogsPanel />
        
        case 'projects':
        case 'documents':
          return (
            <ProjectsPanel
              projectId={activeProjectId ?? null}
              projectName={activeProjectName ?? null}
              onProjectFilterChange={handleProjectFilterChange}
            />
          )
        
        case 'empty':
        default:
          return (
            <ZenEmptyPanel 
              onSelectPanelType={(type) => handleSelectPanelType(panel.panelId, type)} 
            />
          )
      }
    })()
    
    return (
      <ZenErrorBoundary 
        panelType={panel.panelType}
        onReset={() => handleSelectPanelType(panel.panelId, 'empty')}
      >
        {panelContent}
      </ZenErrorBoundary>
    )
  }, [
    handleStatusChange,
    handleSelectSession,
    handleSelectPanelType,
    focusedPanel,
    setPanelAgent,
    selectedRoomId,
    activeProjectId,
    activeProjectName,
    handleProjectFilterChange,
  ])

  return (
    <div 
      ref={zenContainerRef}
      className="zen-mode zen-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Zen Mode - Focused workspace"
    >
      <ZenTopBar 
        onExit={onExit}
        exitLabel={exitLabel}
        exitIcon={exitIcon}
        isMaximized={isMaximized}
        onRestore={isMaximized ? restoreLayout : undefined}
        layoutName={isMaximized ? 'Maximized' : undefined}
        themeName={theme.currentTheme.name}
        onOpenThemePicker={() => setShowThemePicker(true)}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        onOpenKeyboardHelp={() => setShowKeyboardHelp(true)}
        projectFilter={projectFilter ? { name: projectFilter.projectName, color: projectFilter.projectColor } : undefined}
        onClearProjectFilter={clearProjectFilter}
        // Tab bar props
        tabs={tabs}
        activeTabId={activeTabId}
        canAddTab={canAddTab}
        closedTabsCount={closedTabs.length}
        onSwitchTab={switchTab}
        onCloseTab={closeTab}
        onAddTab={handleAddTab}
        onReopenClosedTab={reopenClosedTab}
        onRenameTab={updateTabLabel}
      />
      
      <main className="zen-main">
        <ZenPanelContainer
          node={effectiveLayout}
          focusedPanelId={focusedPanelId}
          canClose={canClose}
          onFocus={focusPanel}
          onClose={closePanelAction}
          onResize={resizePanelAction}
          onSplit={(panelId: string, direction: 'row' | 'col') => splitPanelAction(panelId, direction, 'empty')}
          onChangePanelType={handleSelectPanelType}
          renderPanel={renderPanel}
        />
      </main>
      
      <ZenStatusBar
        agentName={focusedAgentName}
        agentStatus={agentStatus}
        roomName={selectedRoomId ? selectedRoomName : roomName}
        connected={connected}
        panelCount={panelCount}
        focusedPanelIndex={allPanels.findIndex(p => p.panelId === focusedPanelId) + 1}
        themeName={theme.currentTheme.name}
      />
      
      {/* Theme Picker Modal */}
      {showThemePicker && (
        <ZenThemePicker
          currentThemeId={theme.currentTheme.id}
          onSelectTheme={handleSelectTheme}
          onClose={() => setShowThemePicker(false)}
        />
      )}
      
      {/* Command Palette */}
      {showCommandPalette && (
        <ZenCommandPalette
          commands={commands}
          onClose={() => setShowCommandPalette(false)}
        />
      )}
      
      {/* Keyboard Help Overlay */}
      {showKeyboardHelp && (
        <ZenKeyboardHelp
          onClose={() => setShowKeyboardHelp(false)}
        />
      )}
      
      {/* Agent Picker (Quick New Chat) */}
      {showAgentPicker && (
        <ZenAgentPicker
          onClose={() => setShowAgentPicker(false)}
          onSelect={handleAgentPickerSelect}
        />
      )}
      
      {/* Save Layout Modal */}
      {showSaveLayout && (
        <ZenSaveLayoutModal
          layout={layout}
          onClose={() => setShowSaveLayout(false)}
          onSave={handleSaveLayout}
        />
      )}
      
      {/* Layout Picker Modal */}
      {showLayoutPicker && (
        <ZenLayoutPicker
          onClose={() => setShowLayoutPicker(false)}
          onSelectPreset={handleSelectPreset}
          onSelectSaved={handleSelectSavedLayout}
          onDeleteSaved={() => {}}
        />
      )}
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
      className="zen-mode-button"
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
        color: isHovered ? '#4a6da7' : 'rgba(255, 255, 255, 0.8)',
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
      <span style={{ 
        fontSize: '9px', 
        opacity: 0.7, 
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginLeft: '2px',
      }}>[alpha]</span>
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
