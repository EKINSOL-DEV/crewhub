import { useState, useCallback, useEffect } from 'react'
import type { CrewAgent } from './types'

interface WindowState {
  position: { x: number; y: number }
  size: { width: number; height: number }
}

interface OpenWindow {
  id: string
  agent: CrewAgent
  position: { x: number; y: number }
  size: { width: number; height: number }
}

const STORAGE_KEY = 'crew-window-states'
const OPEN_WINDOWS_KEY = 'crew-open-windows'
const DEFAULT_SIZE = { width: 380, height: 500 }

// Load saved window states from localStorage
function loadWindowStates(): Record<string, WindowState> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

// Save window states to localStorage
function saveWindowStates(states: Record<string, WindowState>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states))
  } catch (e) {
    console.error('Failed to save window states:', e)
  }
}

// Load open window agent IDs from localStorage
function loadOpenWindowIds(): string[] {
  try {
    const saved = localStorage.getItem(OPEN_WINDOWS_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

// Save open window agent IDs to localStorage
function saveOpenWindowIds(ids: string[]) {
  try {
    localStorage.setItem(OPEN_WINDOWS_KEY, JSON.stringify(ids))
  } catch (e) {
    console.error('Failed to save open windows:', e)
  }
}

// Calculate position for new window (cascade effect)
function getNextPosition(openWindows: OpenWindow[]): { x: number; y: number } {
  const baseX = 100
  const baseY = 100
  const offset = 30
  const count = openWindows.length

  return {
    x: baseX + ((count * offset) % 200),
    y: baseY + ((count * offset) % 150),
  }
}

/**
 * Hook for managing multiple crew chat windows
 */
export function useCrewWindows() {
  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([])
  const [focusOrder, setFocusOrder] = useState<string[]>([])
  const [windowStates, setWindowStates] = useState<Record<string, WindowState>>(() =>
    loadWindowStates()
  )
  const [restoredFromStorage, setRestoredFromStorage] = useState(false)

  // Save to localStorage when states change
  useEffect(() => {
    saveWindowStates(windowStates)
  }, [windowStates])

  // Save open window IDs when they change (but not on initial restore)
  useEffect(() => {
    if (restoredFromStorage) {
      const openIds = openWindows.map((w) => w.agent.id)
      saveOpenWindowIds(openIds)
    }
  }, [openWindows, restoredFromStorage])

  const openWindow = useCallback(
    (agent: CrewAgent) => {
      setOpenWindows((prev) => {
        // Check if already open
        const existing = prev.find((w) => w.agent.id === agent.id)
        if (existing) {
          // Bring to front
          setFocusOrder((fo) => [...fo.filter((id) => id !== existing.id), existing.id]) // NOSONAR: nested setState in updater - acceptable React pattern for focus management
          return prev
        }

        // Get saved state or defaults
        const savedState = windowStates[agent.id]
        const position = savedState?.position || getNextPosition(prev)
        const size = savedState?.size || DEFAULT_SIZE

        const windowId = `${agent.id}-${Date.now()}`

        setFocusOrder((fo) => [...fo, windowId])
        return [...prev, { id: windowId, agent, position, size }]
      })
    },
    [windowStates]
  )

  const closeWindow = useCallback((windowId: string) => {
    setOpenWindows((prev) => prev.filter((w) => w.id !== windowId))
    setFocusOrder((prev) => prev.filter((id) => id !== windowId))
  }, [])

  const focusWindow = useCallback((windowId: string) => {
    setFocusOrder((prev) => [...prev.filter((id) => id !== windowId), windowId])
  }, [])

  const getZIndex = useCallback(
    (windowId: string) => {
      const index = focusOrder.indexOf(windowId)
      return 100 + (index >= 0 ? index : 0)
    },
    [focusOrder]
  )

  // Update window position/size and save to localStorage
  const updateWindowState = useCallback(
    (
      agentId: string,
      position: { x: number; y: number },
      size: { width: number; height: number }
    ) => {
      setWindowStates((prev) => ({
        ...prev,
        [agentId]: { position, size },
      }))
    },
    []
  )

  // Reset all window states (positions/sizes)
  const resetWindowStates = useCallback(() => {
    setWindowStates({})
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(OPEN_WINDOWS_KEY)
    // Close all open windows so they reopen at default positions
    setOpenWindows([])
    setFocusOrder([])
  }, [])

  // Restore open windows from localStorage (call once when agents are loaded)
  const restoreOpenWindows = useCallback(
    (agents: CrewAgent[]) => {
      if (restoredFromStorage) return // Only restore once

      const savedIds = loadOpenWindowIds()
      if (savedIds.length === 0) {
        setRestoredFromStorage(true)
        return
      }

      const windowsToOpen: OpenWindow[] = []
      const newFocusOrder: string[] = []

      savedIds.forEach((agentId) => {
        const agent = agents.find((a) => a.id === agentId)
        if (agent) {
          const savedState = windowStates[agentId]
          const position = savedState?.position || getNextPosition(windowsToOpen)
          const size = savedState?.size || DEFAULT_SIZE
          const windowId = `${agent.id}-${Date.now()}-${Math.random()}`

          windowsToOpen.push({ id: windowId, agent, position, size })
          newFocusOrder.push(windowId)
        }
      })

      if (windowsToOpen.length > 0) {
        setOpenWindows(windowsToOpen)
        setFocusOrder(newFocusOrder)
      }
      setRestoredFromStorage(true)
    },
    [restoredFromStorage, windowStates]
  )

  return {
    openWindows,
    openWindow,
    closeWindow,
    focusWindow,
    getZIndex,
    updateWindowState,
    resetWindowStates,
    restoreOpenWindows,
  }
}
