/**
 * Zen Mode Layout Hook
 * Manages the split-tree layout state and operations
 */

import { useState, useCallback, useEffect } from 'react'
import {
  type LayoutNode,
  type LeafNode,
  type PanelType,
  type ZenLayoutState,
  type LayoutPreset,
  createLeaf,
  createSplit,
  findPanel,
  getAllPanels,
  countPanels,
  updatePanel,
  removePanel,
  splitPanel as splitPanelInTree,
} from '../types/layout'

// ── Layout Presets ────────────────────────────────────────────────

const LAYOUT_PRESETS: Record<LayoutPreset, () => LayoutNode> = {
  // Default: Chat (60%) | Tasks (40%)
  default: () =>
    createSplit(
      'row',
      createLeaf('chat'),
      createLeaf('tasks'),
      0.6 // Chat gets 60%
    ),

  // Multi-Chat: Two chat panels side by side
  'multi-chat': () => createSplit('row', createLeaf('chat'), createLeaf('chat'), 0.5),

  // Monitor: Sessions (40%) | Activity (60%)
  monitor: () => createSplit('row', createLeaf('sessions'), createLeaf('activity'), 0.4),
}

// ── Initial State ─────────────────────────────────────────────────

function getInitialLayout(): ZenLayoutState {
  const root = LAYOUT_PRESETS.default()
  const panels = getAllPanels(root)

  // Focus the chat panel by default, or first panel
  const chatPanel = panels.find((p) => p.panelType === 'chat')
  const focusedPanelId = chatPanel?.panelId || panels[0]?.panelId || ''

  return {
    root,
    focusedPanelId,
    maximizedPanelId: null,
    savedLayout: null,
  }
}

// ── Hook ──────────────────────────────────────────────────────────

export interface UseZenLayoutReturn {
  // State
  layout: LayoutNode
  focusedPanelId: string
  focusedPanel: LeafNode | null
  isMaximized: boolean
  panels: LeafNode[]
  panelCount: number

  // Actions
  focusPanel: (panelId: string) => void
  focusNextPanel: () => void
  focusPrevPanel: () => void
  focusPanelByIndex: (index: number) => void

  splitPanel: (panelId: string, direction: 'row' | 'col', newType?: PanelType) => void
  closePanel: (panelId: string) => void

  resizePanel: (panelId: string, ratio: number) => void

  maximizePanel: (panelId: string) => void
  restoreLayout: () => void
  toggleMaximize: () => void

  applyPreset: (preset: LayoutPreset) => void
  cyclePresets: () => void
  applyLayout: (layout: LayoutNode) => void

  // Panel state
  updatePanelState: (panelId: string, updates: Partial<LeafNode>) => void
  setPanelAgent: (
    panelId: string,
    sessionKey: string,
    agentName: string,
    agentIcon?: string
  ) => void
}

export function useZenLayout(): UseZenLayoutReturn {
  const [state, setState] = useState<ZenLayoutState>(getInitialLayout)

  // Derive computed values
  const allPanels = getAllPanels(state.root)
  const panelCount = countPanels(state.root)
  const focusedPanel = findPanel(state.root, state.focusedPanelId)
  const isMaximized = state.maximizedPanelId !== null

  // Use the actual root or the maximized single panel
  const effectiveLayout = state.maximizedPanelId
    ? findPanel(state.root, state.maximizedPanelId) || state.root
    : state.root

  // ── Focus Actions ───────────────────────────────────────────────

  const focusPanel = useCallback((panelId: string) => {
    setState((prev) => {
      if (prev.focusedPanelId === panelId) return prev
      return { ...prev, focusedPanelId: panelId }
    })
  }, [])

  const focusNextPanel = useCallback(() => {
    setState((prev) => {
      const panels = getAllPanels(prev.root)
      const currentIndex = panels.findIndex((p) => p.panelId === prev.focusedPanelId)
      const nextIndex = (currentIndex + 1) % panels.length
      return { ...prev, focusedPanelId: panels[nextIndex].panelId }
    })
  }, [])

  const focusPrevPanel = useCallback(() => {
    setState((prev) => {
      const panels = getAllPanels(prev.root)
      const currentIndex = panels.findIndex((p) => p.panelId === prev.focusedPanelId)
      const prevIndex = (currentIndex - 1 + panels.length) % panels.length
      return { ...prev, focusedPanelId: panels[prevIndex].panelId }
    })
  }, [])

  const focusPanelByIndex = useCallback((index: number) => {
    setState((prev) => {
      const panels = getAllPanels(prev.root)
      if (index >= 0 && index < panels.length) {
        return { ...prev, focusedPanelId: panels[index].panelId }
      }
      return prev
    })
  }, [])

  // ── Split/Close Actions ─────────────────────────────────────────

  const splitPanelAction = useCallback(
    (panelId: string, direction: 'row' | 'col', newType: PanelType = 'empty') => {
      setState((prev) => {
        const newRoot = splitPanelInTree(prev.root, panelId, direction, newType)
        const newPanels = getAllPanels(newRoot)
        const newPanel = newPanels.find(
          (p) => !getAllPanels(prev.root).some((op) => op.panelId === p.panelId)
        )
        return {
          ...prev,
          root: newRoot,
          focusedPanelId: newPanel?.panelId || prev.focusedPanelId,
          maximizedPanelId: null,
          savedLayout: null,
        }
      })
    },
    []
  )

  const closePanel = useCallback((panelId: string) => {
    setState((prev) => {
      // Don't close if it's the last panel
      if (countPanels(prev.root) <= 1) return prev

      const newRoot = removePanel(prev.root, panelId)
      if (!newRoot) return prev

      // If we're closing the focused panel, focus the first remaining panel
      const newPanels = getAllPanels(newRoot)
      const newFocusedId =
        panelId === prev.focusedPanelId ? newPanels[0]?.panelId || '' : prev.focusedPanelId

      return {
        ...prev,
        root: newRoot,
        focusedPanelId: newFocusedId,
        maximizedPanelId: null,
        savedLayout: null,
      }
    })
  }, [])

  // ── Resize Action ───────────────────────────────────────────────

  const resizePanel = useCallback((panelId: string, absoluteRatio: number) => {
    setState((prev) => {
      // Find the parent split of this panel and set ratio directly
      const setRatio = (node: LayoutNode): LayoutNode => {
        if (node.kind === 'leaf') return node

        const inA = findPanel(node.a, panelId)
        const inB = findPanel(node.b, panelId)

        if ((inA && node.a.kind === 'leaf') || (inB && node.b.kind === 'leaf')) {
          // Direct child, set absolute ratio
          // If panel is in B, we need to invert (1 - ratio)
          const newRatio = inA ? absoluteRatio : 1 - absoluteRatio
          const clampedRatio = Math.max(0.15, Math.min(0.85, newRatio))
          return { ...node, ratio: clampedRatio }
        }

        if (inA) {
          return { ...node, a: setRatio(node.a) }
        }
        if (inB) {
          return { ...node, b: setRatio(node.b) }
        }

        return node
      }

      return { ...prev, root: setRatio(prev.root) }
    })
  }, [])

  // ── Maximize/Restore Actions ────────────────────────────────────

  const maximizePanel = useCallback((panelId: string) => {
    setState((prev) => {
      if (prev.maximizedPanelId === panelId) return prev
      return {
        ...prev,
        maximizedPanelId: panelId,
        savedLayout: prev.root,
        focusedPanelId: panelId,
      }
    })
  }, [])

  const restoreLayout = useCallback(() => {
    setState((prev) => {
      if (!prev.savedLayout) return prev
      return {
        ...prev,
        root: prev.savedLayout,
        maximizedPanelId: null,
        savedLayout: null,
      }
    })
  }, [])

  const toggleMaximize = useCallback(() => {
    setState((prev) => {
      if (prev.maximizedPanelId) {
        // Restore
        if (!prev.savedLayout) return prev
        return {
          ...prev,
          root: prev.savedLayout,
          maximizedPanelId: null,
          savedLayout: null,
        }
      } else {
        // Maximize focused panel
        return {
          ...prev,
          maximizedPanelId: prev.focusedPanelId,
          savedLayout: prev.root,
        }
      }
    })
  }, [])

  // ── Preset Actions ──────────────────────────────────────────────

  const applyPreset = useCallback((preset: LayoutPreset) => {
    setState((_prev) => {
      const root = LAYOUT_PRESETS[preset]()
      const panels = getAllPanels(root)
      const chatPanel = panels.find((p) => p.panelType === 'chat')

      return {
        root,
        focusedPanelId: chatPanel?.panelId || panels[0]?.panelId || '',
        maximizedPanelId: null,
        savedLayout: null,
      }
    })
  }, [])

  const cyclePresets = useCallback(() => {
    const presetNames: LayoutPreset[] = ['default', 'multi-chat', 'monitor']
    setState((prev) => {
      // Try to determine current preset (approximate by panel types)
      const currentPanels = getAllPanels(prev.root)
      const hasActivity = currentPanels.some((p) => p.panelType === 'activity')
      const hasSessions = currentPanels.some((p) => p.panelType === 'sessions')
      const chatCount = currentPanels.filter((p) => p.panelType === 'chat').length

      let currentPreset: LayoutPreset = 'default'
      if (chatCount === 2 && !hasActivity && !hasSessions) {
        currentPreset = 'multi-chat'
      } else if (hasActivity && hasSessions && chatCount === 0) {
        currentPreset = 'monitor'
      }

      const currentIndex = presetNames.indexOf(currentPreset)
      const nextPreset = presetNames[(currentIndex + 1) % presetNames.length]

      const root = LAYOUT_PRESETS[nextPreset]()
      const panels = getAllPanels(root)
      const chatPanel = panels.find((p) => p.panelType === 'chat')

      return {
        root,
        focusedPanelId: chatPanel?.panelId || panels[0]?.panelId || '',
        maximizedPanelId: null,
        savedLayout: null,
      }
    })
  }, [])

  // ── Panel State Actions ─────────────────────────────────────────

  const updatePanelState = useCallback((panelId: string, updates: Partial<LeafNode>) => {
    setState((prev) => ({
      ...prev,
      root: updatePanel(prev.root, panelId, updates),
    }))
  }, [])

  const setPanelAgent = useCallback(
    (panelId: string, sessionKey: string, agentName: string, agentIcon?: string) => {
      updatePanelState(panelId, {
        agentSessionKey: sessionKey,
        agentName,
        agentIcon,
      })
    },
    [updatePanelState]
  )

  // Persist layout to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        'zen-layout-current',
        JSON.stringify({
          root: state.root,
          focusedPanelId: state.focusedPanelId,
          savedAt: Date.now(),
        })
      )
    } catch {
      // Ignore storage errors
    }
  }, [state.root, state.focusedPanelId])

  // Apply a custom layout
  const applyLayout = useCallback((layout: LayoutNode) => {
    const panels = getAllPanels(layout)
    const chatPanel = panels.find((p) => p.panelType === 'chat')

    setState({
      root: layout,
      focusedPanelId: chatPanel?.panelId || panels[0]?.panelId || '',
      maximizedPanelId: null,
      savedLayout: null,
    })
  }, [])

  return {
    layout: effectiveLayout,
    focusedPanelId: state.focusedPanelId,
    focusedPanel,
    isMaximized,
    panels: allPanels,
    panelCount,

    focusPanel,
    focusNextPanel,
    focusPrevPanel,
    focusPanelByIndex,

    splitPanel: splitPanelAction,
    closePanel,

    resizePanel,

    maximizePanel,
    restoreLayout,
    toggleMaximize,

    applyPreset,
    cyclePresets,
    applyLayout,

    updatePanelState,
    setPanelAgent,
  }
}

export { LAYOUT_PRESETS }
