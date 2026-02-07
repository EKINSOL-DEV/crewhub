import { useState, useCallback, useEffect, createContext, useContext, useRef, type ReactNode } from 'react'
import { type LayoutNode, createSplit, createLeaf, getAllPanels } from '../types/layout'

// ── Types ──────────────────────────────────────────────────────

export interface ZenProjectFilter {
  projectId: string
  projectName: string
  projectColor?: string
}

/**
 * A single Zen Mode workspace tab
 */
export interface ZenTab {
  id: string
  label: string
  projectFilter: ZenProjectFilter | null
  layout: LayoutNode
  focusedPanelId: string
  maximizedPanelId: string | null
  scrollPositions: Record<string, number>  // panelId -> scrollY
  createdAt: number
}

/**
 * Tab bar state
 */
export interface ZenTabsState {
  tabs: ZenTab[]
  activeTabId: string
  closedTabs: ZenTab[]  // For "reopen closed tab" (max 5)
}

/**
 * Persisted state shape
 */
interface PersistedZenState {
  version: 1
  tabs: ZenTab[]
  activeTabId: string
  closedTabs: ZenTab[]
  lastModified: number
}

// ── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = 'zen-tabs-state'
const MAX_TABS = 10
const MAX_CLOSED_TABS = 5
const DEBOUNCE_MS = 500

// UUID helper (fallback for non-secure contexts like http://)
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for http:// contexts
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// ── Default Layout ─────────────────────────────────────────────

function createDefaultLayout(): LayoutNode {
  return createSplit('row',
    createLeaf('chat'),
    createLeaf('tasks'),
    0.6
  )
}

function createDefaultTab(projectFilter?: ZenProjectFilter): ZenTab {
  const layout = createDefaultLayout()
  const panels = getAllPanels(layout)
  const chatPanel = panels.find(p => p.panelType === 'chat')
  
  return {
    id: generateUUID(),
    label: projectFilter?.projectName || 'Zen Mode',
    projectFilter: projectFilter || null,
    layout,
    focusedPanelId: chatPanel?.panelId || panels[0]?.panelId || '',
    maximizedPanelId: null,
    scrollPositions: {},
    createdAt: Date.now(),
  }
}

// ── Persistence ────────────────────────────────────────────────

function loadPersistedState(): ZenTabsState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    
    const parsed = JSON.parse(stored) as PersistedZenState
    
    // Validate version
    if (parsed.version !== 1) {
      console.warn('[ZenTabs] Unknown state version, resetting')
      return null
    }
    
    // Validate tabs array
    if (!Array.isArray(parsed.tabs) || parsed.tabs.length === 0) {
      return null
    }
    
    // Ensure active tab exists
    const activeExists = parsed.tabs.some(t => t.id === parsed.activeTabId)
    if (!activeExists) {
      parsed.activeTabId = parsed.tabs[0].id
    }
    
    return {
      tabs: parsed.tabs,
      activeTabId: parsed.activeTabId,
      closedTabs: parsed.closedTabs || [],
    }
  } catch (e) {
    console.warn('[ZenTabs] Failed to load persisted state:', e)
    return null
  }
}

function persistState(state: ZenTabsState): void {
  try {
    const persisted: PersistedZenState = {
      version: 1,
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      closedTabs: state.closedTabs.slice(0, MAX_CLOSED_TABS),
      lastModified: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
  } catch (e) {
    console.warn('[ZenTabs] Failed to persist state:', e)
  }
}

// ── Legacy Migration ───────────────────────────────────────────

function migrateLegacyState(): ZenTabsState | null {
  try {
    // Check for old layout format
    const legacyLayout = localStorage.getItem('zen-layout-current')
    const legacyAgent = localStorage.getItem('zen-last-agent')
    
    if (!legacyLayout) return null
    
    const parsed = JSON.parse(legacyLayout)
    const layout = parsed.root as LayoutNode
    
    // Create a tab from legacy layout
    const panels = getAllPanels(layout)
    const chatPanel = panels.find(p => p.panelType === 'chat')
    
    // Try to restore agent info to the chat panel
    let agentInfo: { id: string; name: string; icon?: string } | null = null
    if (legacyAgent) {
      try {
        agentInfo = JSON.parse(legacyAgent)
      } catch { /* ignore */ }
    }
    
    const tab: ZenTab = {
      id: 'migrated-tab',
      label: 'Zen Mode',
      projectFilter: null,
      layout,
      focusedPanelId: parsed.focusedPanelId || chatPanel?.panelId || panels[0]?.panelId || '',
      maximizedPanelId: null,
      scrollPositions: {},
      createdAt: Date.now(),
    }
    
    console.log('[ZenTabs] Migrated legacy layout', { agentInfo })
    
    // Clean up legacy keys after migration
    // localStorage.removeItem('zen-layout-current')
    // Keep for now for backwards compatibility
    
    return {
      tabs: [tab],
      activeTabId: tab.id,
      closedTabs: [],
    }
  } catch (e) {
    console.warn('[ZenTabs] Failed to migrate legacy state:', e)
    return null
  }
}

// ── Hook Return Type ───────────────────────────────────────────

export interface UseZenModeReturn {
  // Zen Mode state
  isActive: boolean
  
  // Tabs state
  tabs: ZenTab[]
  activeTab: ZenTab | null
  activeTabId: string
  tabCount: number
  canAddTab: boolean
  closedTabs: ZenTab[]
  
  // Legacy compatibility
  selectedAgentId: string | null
  selectedAgentName: string | null
  selectedAgentIcon: string | null
  selectedAgentColor: string | null
  projectFilter: ZenProjectFilter | null
  
  // Tab actions
  createTab: (projectFilter?: ZenProjectFilter) => string | null
  closeTab: (tabId: string) => void
  switchTab: (tabId: string) => void
  updateTabLayout: (tabId: string, layout: LayoutNode, focusedPanelId?: string, maximizedPanelId?: string | null) => void
  updateTabLabel: (tabId: string, label: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  reopenClosedTab: () => void
  
  // Scroll position tracking
  setScrollPosition: (panelId: string, scrollY: number) => void
  getScrollPosition: (panelId: string) => number
  
  // Zen Mode actions
  toggle: () => void
  enter: (agentId?: string, agentName?: string, agentIcon?: string, agentColor?: string) => void
  enterWithProject: (projectFilter: ZenProjectFilter, agentId?: string, agentName?: string, agentIcon?: string, agentColor?: string) => void
  exit: () => void
  selectAgent: (agentId: string, agentName: string, agentIcon?: string, agentColor?: string) => void
  clearProjectFilter: () => void
}

// ── Context ────────────────────────────────────────────────────

const ZenModeContext = createContext<UseZenModeReturn | null>(null)

// ── Provider ───────────────────────────────────────────────────

interface ZenModeProviderProps {
  children: ReactNode
}

export function ZenModeProvider({ children }: ZenModeProviderProps) {
  // Core state
  const [isActive, setIsActive] = useState(false)
  const [tabsState, setTabsState] = useState<ZenTabsState>(() => {
    // Try to load persisted state, then legacy, then default
    const persisted = loadPersistedState()
    if (persisted) return persisted
    
    const migrated = migrateLegacyState()
    if (migrated) return migrated
    
    const defaultTab = createDefaultTab()
    return {
      tabs: [defaultTab],
      activeTabId: defaultTab.id,
      closedTabs: [],
    }
  })
  
  // Legacy agent state (for compatibility with existing components)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [selectedAgentName, setSelectedAgentName] = useState<string | null>(null)
  const [selectedAgentIcon, setSelectedAgentIcon] = useState<string | null>(null)
  const [selectedAgentColor, setSelectedAgentColor] = useState<string | null>(null)
  
  // Debounced persistence
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Persist on state change (debounced)
  useEffect(() => {
    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current)
    }
    persistTimeoutRef.current = setTimeout(() => {
      persistState(tabsState)
    }, DEBOUNCE_MS)
    
    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current)
      }
    }
  }, [tabsState])
  
  // Persist immediately on unmount/unload
  useEffect(() => {
    const handleUnload = () => {
      persistState(tabsState)
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      persistState(tabsState)
    }
  }, [tabsState])
  
  // Derived values
  const activeTab = tabsState.tabs.find(t => t.id === tabsState.activeTabId) || null
  const tabCount = tabsState.tabs.length
  const canAddTab = tabCount < MAX_TABS
  
  // ── Tab Actions ──────────────────────────────────────────────
  
  const createTab = useCallback((projectFilter?: ZenProjectFilter): string | null => {
    let newTabId: string | null = null
    
    setTabsState(prev => {
      if (prev.tabs.length >= MAX_TABS) {
        console.warn('[ZenTabs] Maximum tabs reached')
        return prev
      }
      
      const newTab = createDefaultTab(projectFilter)
      newTabId = newTab.id
      
      return {
        ...prev,
        tabs: [...prev.tabs, newTab],
        activeTabId: newTab.id,
      }
    })
    
    return newTabId
  }, [])
  
  const closeTab = useCallback((tabId: string) => {
    setTabsState(prev => {
      // Don't close the last tab
      if (prev.tabs.length <= 1) {
        return prev
      }
      
      const tabIndex = prev.tabs.findIndex(t => t.id === tabId)
      if (tabIndex === -1) return prev
      
      const closedTab = prev.tabs[tabIndex]
      const newTabs = prev.tabs.filter(t => t.id !== tabId)
      
      // If closing active tab, switch to adjacent tab
      let newActiveId = prev.activeTabId
      if (tabId === prev.activeTabId) {
        // Prefer the tab to the left, or the first tab
        const newIndex = Math.min(tabIndex, newTabs.length - 1)
        newActiveId = newTabs[newIndex]?.id || newTabs[0]?.id
      }
      
      // Add to closed tabs (for reopen)
      const newClosedTabs = [closedTab, ...prev.closedTabs].slice(0, MAX_CLOSED_TABS)
      
      return {
        tabs: newTabs,
        activeTabId: newActiveId,
        closedTabs: newClosedTabs,
      }
    })
  }, [])
  
  const switchTab = useCallback((tabId: string) => {
    setTabsState(prev => {
      if (prev.activeTabId === tabId) return prev
      if (!prev.tabs.some(t => t.id === tabId)) return prev
      return { ...prev, activeTabId: tabId }
    })
  }, [])
  
  const updateTabLayout = useCallback((
    tabId: string,
    layout: LayoutNode,
    focusedPanelId?: string,
    maximizedPanelId?: string | null
  ) => {
    setTabsState(prev => ({
      ...prev,
      tabs: prev.tabs.map(tab =>
        tab.id === tabId
          ? {
              ...tab,
              layout,
              focusedPanelId: focusedPanelId ?? tab.focusedPanelId,
              maximizedPanelId: maximizedPanelId !== undefined ? maximizedPanelId : tab.maximizedPanelId,
            }
          : tab
      ),
    }))
  }, [])
  
  const updateTabLabel = useCallback((tabId: string, label: string) => {
    setTabsState(prev => ({
      ...prev,
      tabs: prev.tabs.map(tab =>
        tab.id === tabId ? { ...tab, label: label.trim() || 'Zen Mode' } : tab
      ),
    }))
  }, [])
  
  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setTabsState(prev => {
      if (fromIndex < 0 || fromIndex >= prev.tabs.length) return prev
      if (toIndex < 0 || toIndex >= prev.tabs.length) return prev
      if (fromIndex === toIndex) return prev
      
      const newTabs = [...prev.tabs]
      const [moved] = newTabs.splice(fromIndex, 1)
      newTabs.splice(toIndex, 0, moved)
      
      return { ...prev, tabs: newTabs }
    })
  }, [])
  
  const reopenClosedTab = useCallback(() => {
    setTabsState(prev => {
      if (prev.closedTabs.length === 0) return prev
      if (prev.tabs.length >= MAX_TABS) return prev
      
      const [tabToReopen, ...remainingClosed] = prev.closedTabs
      
      // Give it a new ID to avoid conflicts
      const reopenedTab: ZenTab = {
        ...tabToReopen,
        id: generateUUID(),
        createdAt: Date.now(),
      }
      
      return {
        tabs: [...prev.tabs, reopenedTab],
        activeTabId: reopenedTab.id,
        closedTabs: remainingClosed,
      }
    })
  }, [])
  
  // ── Scroll Position Tracking ─────────────────────────────────
  
  const setScrollPosition = useCallback((panelId: string, scrollY: number) => {
    setTabsState(prev => {
      const activeTab = prev.tabs.find(t => t.id === prev.activeTabId)
      if (!activeTab) return prev
      
      // Only update if significantly different (avoid unnecessary re-renders)
      const currentScroll = activeTab.scrollPositions[panelId] || 0
      if (Math.abs(currentScroll - scrollY) < 10) return prev
      
      return {
        ...prev,
        tabs: prev.tabs.map(tab =>
          tab.id === prev.activeTabId
            ? {
                ...tab,
                scrollPositions: { ...tab.scrollPositions, [panelId]: scrollY },
              }
            : tab
        ),
      }
    })
  }, [])
  
  const getScrollPosition = useCallback((panelId: string): number => {
    const tab = tabsState.tabs.find(t => t.id === tabsState.activeTabId)
    return tab?.scrollPositions[panelId] || 0
  }, [tabsState])
  
  // ── Zen Mode Actions ─────────────────────────────────────────

  const toggle = useCallback(() => {
    setIsActive(prev => !prev)
  }, [])

  const enter = useCallback((
    agentId?: string,
    agentName?: string,
    agentIcon?: string,
    agentColor?: string
  ) => {
    setIsActive(true)
    if (agentId) setSelectedAgentId(agentId)
    if (agentName) setSelectedAgentName(agentName)
    if (agentIcon) setSelectedAgentIcon(agentIcon)
    if (agentColor) setSelectedAgentColor(agentColor)
  }, [])
  
  const enterWithProject = useCallback((
    projectFilter: ZenProjectFilter,
    agentId?: string,
    agentName?: string,
    agentIcon?: string,
    agentColor?: string
  ) => {
    setTabsState(prev => {
      // Check if there's already a tab for this project
      const existingTab = prev.tabs.find(
        t => t.projectFilter?.projectId === projectFilter.projectId
      )
      
      if (existingTab) {
        // Switch to existing tab
        return { ...prev, activeTabId: existingTab.id }
      } else {
        // Create new tab for this project (respecting max tabs)
        if (prev.tabs.length >= MAX_TABS) {
          console.warn('[ZenTabs] Maximum tabs reached, cannot create project tab')
          return prev
        }
        
        const newTab = createDefaultTab(projectFilter)
        return {
          ...prev,
          tabs: [...prev.tabs, newTab],
          activeTabId: newTab.id,
        }
      }
    })
    
    setIsActive(true)
    if (agentId) setSelectedAgentId(agentId)
    if (agentName) setSelectedAgentName(agentName)
    if (agentIcon) setSelectedAgentIcon(agentIcon)
    if (agentColor) setSelectedAgentColor(agentColor)
  }, [])

  const exit = useCallback(() => {
    setIsActive(false)
  }, [])
  
  const clearProjectFilter = useCallback(() => {
    setTabsState(prev => ({
      ...prev,
      tabs: prev.tabs.map(tab =>
        tab.id === prev.activeTabId
          ? { ...tab, projectFilter: null, label: 'Zen Mode' }
          : tab
      ),
    }))
  }, [])

  const selectAgent = useCallback((
    agentId: string,
    agentName: string,
    agentIcon?: string,
    agentColor?: string
  ) => {
    setSelectedAgentId(agentId)
    setSelectedAgentName(agentName)
    setSelectedAgentIcon(agentIcon || null)
    setSelectedAgentColor(agentColor || null)
  }, [])

  // Persist agent preference (legacy compatibility)
  useEffect(() => {
    if (selectedAgentId) {
      localStorage.setItem('zen-last-agent', JSON.stringify({
        id: selectedAgentId,
        name: selectedAgentName,
        icon: selectedAgentIcon,
        color: selectedAgentColor,
      }))
    }
  }, [selectedAgentId, selectedAgentName, selectedAgentIcon, selectedAgentColor])

  // Restore last selected agent on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('zen-last-agent')
      if (stored) {
        const { id, name, icon, color } = JSON.parse(stored)
        if (id && name) {
          setSelectedAgentId(id)
          setSelectedAgentName(name)
          setSelectedAgentIcon(icon)
          setSelectedAgentColor(color)
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [])

  const value: UseZenModeReturn = {
    // Zen Mode state
    isActive,
    
    // Tabs state
    tabs: tabsState.tabs,
    activeTab,
    activeTabId: tabsState.activeTabId,
    tabCount,
    canAddTab,
    closedTabs: tabsState.closedTabs,
    
    // Legacy compatibility
    selectedAgentId,
    selectedAgentName,
    selectedAgentIcon,
    selectedAgentColor,
    projectFilter: activeTab?.projectFilter || null,
    
    // Tab actions
    createTab,
    closeTab,
    switchTab,
    updateTabLayout,
    updateTabLabel,
    reorderTabs,
    reopenClosedTab,
    
    // Scroll position tracking
    setScrollPosition,
    getScrollPosition,
    
    // Zen Mode actions
    toggle,
    enter,
    enterWithProject,
    exit,
    selectAgent,
    clearProjectFilter,
  }

  return (
    <ZenModeContext.Provider value={value}>
      {children}
    </ZenModeContext.Provider>
  )
}

// ── Hook ───────────────────────────────────────────────────────

/**
 * Hook to access shared Zen Mode state.
 * Must be used within a ZenModeProvider.
 */
export function useZenMode(): UseZenModeReturn {
  const context = useContext(ZenModeContext)
  if (!context) {
    throw new Error('useZenMode must be used within a ZenModeProvider')
  }
  return context
}
