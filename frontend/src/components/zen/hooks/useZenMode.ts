import { useState, useCallback, useEffect } from 'react'

export interface ZenModeState {
  isActive: boolean
  selectedAgentId: string | null
  selectedAgentName: string | null
  selectedAgentIcon: string | null
  selectedAgentColor: string | null
}

export interface UseZenModeReturn {
  isActive: boolean
  selectedAgentId: string | null
  selectedAgentName: string | null
  selectedAgentIcon: string | null
  selectedAgentColor: string | null
  toggle: () => void
  enter: (agentId?: string, agentName?: string, agentIcon?: string, agentColor?: string) => void
  exit: () => void
  selectAgent: (agentId: string, agentName: string, agentIcon?: string, agentColor?: string) => void
}

/**
 * Hook to manage Zen Mode state
 */
export function useZenMode(): UseZenModeReturn {
  const [state, setState] = useState<ZenModeState>({
    isActive: false,
    selectedAgentId: null,
    selectedAgentName: null,
    selectedAgentIcon: null,
    selectedAgentColor: null,
  })

  const toggle = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActive: !prev.isActive,
    }))
  }, [])

  const enter = useCallback((
    agentId?: string,
    agentName?: string,
    agentIcon?: string,
    agentColor?: string
  ) => {
    setState(prev => ({
      ...prev,
      isActive: true,
      selectedAgentId: agentId ?? prev.selectedAgentId,
      selectedAgentName: agentName ?? prev.selectedAgentName,
      selectedAgentIcon: agentIcon ?? prev.selectedAgentIcon,
      selectedAgentColor: agentColor ?? prev.selectedAgentColor,
    }))
  }, [])

  const exit = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActive: false,
    }))
  }, [])

  const selectAgent = useCallback((
    agentId: string,
    agentName: string,
    agentIcon?: string,
    agentColor?: string
  ) => {
    setState(prev => ({
      ...prev,
      selectedAgentId: agentId,
      selectedAgentName: agentName,
      selectedAgentIcon: agentIcon ?? null,
      selectedAgentColor: agentColor ?? null,
    }))
  }, [])

  // Persist preference to localStorage
  useEffect(() => {
    if (state.selectedAgentId) {
      localStorage.setItem('zen-last-agent', JSON.stringify({
        id: state.selectedAgentId,
        name: state.selectedAgentName,
        icon: state.selectedAgentIcon,
        color: state.selectedAgentColor,
      }))
    }
  }, [state.selectedAgentId, state.selectedAgentName, state.selectedAgentIcon, state.selectedAgentColor])

  // Restore last selected agent on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('zen-last-agent')
      if (stored) {
        const { id, name, icon, color } = JSON.parse(stored)
        if (id && name) {
          setState(prev => ({
            ...prev,
            selectedAgentId: id,
            selectedAgentName: name,
            selectedAgentIcon: icon,
            selectedAgentColor: color,
          }))
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [])

  return {
    isActive: state.isActive,
    selectedAgentId: state.selectedAgentId,
    selectedAgentName: state.selectedAgentName,
    selectedAgentIcon: state.selectedAgentIcon,
    selectedAgentColor: state.selectedAgentColor,
    toggle,
    enter,
    exit,
    selectAgent,
  }
}
