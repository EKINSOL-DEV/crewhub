import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { API_BASE, type CrewSession } from '@/lib/api'

export interface Agent {
  id: string
  name: string
  icon: string | null
  avatar_url: string | null
  color: string | null
  agent_session_key: string | null
  default_model: string | null
  default_room_id: string | null
  sort_order: number
  is_pinned: boolean
  auto_spawn: boolean
  bio: string | null
  created_at: number
  updated_at: number
}

export type AgentStatus = 'offline' | 'idle' | 'thinking' | 'working' | 'supervising'

export interface AgentRuntime {
  agent: Agent
  session?: CrewSession
  status: AgentStatus
  childSessions: CrewSession[]
}

interface AgentsResponse {
  agents: Agent[]
}

export function useAgentsRegistry(sessions: CrewSession[]) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Data deduplication: avoid re-renders when agent data hasn't changed
  const agentsFingerprintRef = useRef<string>('')

  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/agents`)
      if (!response.ok) throw new Error('Failed to fetch agents')
      const data: AgentsResponse = await response.json()
      const newAgents = data.agents || []
      // Deduplicate: only update state if agents actually changed
      const fingerprint = JSON.stringify(
        newAgents.map(
          (a) => `${a.id}:${a.updated_at}:${a.is_pinned}:${a.default_room_id}:${a.color}`
        )
      )
      if (fingerprint !== agentsFingerprintRef.current) {
        agentsFingerprintRef.current = fingerprint
        setAgents(newAgents)
      }
      setError(null)
    } catch (err) {
      console.error('Failed to fetch agents:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAgents()
    const pollInterval = setInterval(fetchAgents, 30000)
    const handleAgentsUpdated = () => fetchAgents()
    window.addEventListener('agents-updated', handleAgentsUpdated)
    return () => {
      clearInterval(pollInterval)
      window.removeEventListener('agents-updated', handleAgentsUpdated)
    }
  }, [fetchAgents])

  const calculateStatus = useCallback(
    (session: CrewSession | undefined, childSessions: CrewSession[]): AgentStatus => {
      if (!session) return 'offline'
      const now = Date.now()
      const lastActivity = session.updatedAt || 0
      const timeSinceActivity = now - lastActivity
      const isRecent = timeSinceActivity < 5 * 60 * 1000

      if (!isRecent) {
        // Check if any child sessions are actively running
        const hasActiveChildren = childSessions.some((s) => now - s.updatedAt < 5 * 60 * 1000)
        if (hasActiveChildren) return 'supervising'
        return 'idle'
      }

      if (session.messages && session.messages.length > 0) {
        const lastMessage = session.messages[session.messages.length - 1]
        if (lastMessage.role === 'assistant') return 'thinking'
        return 'working'
      }
      return 'thinking'
    },
    []
  )

  const agentRuntimes = useMemo((): AgentRuntime[] => {
    return agents.map((agent) => {
      const mainSession = sessions.find(
        (s) => s.key === agent.agent_session_key || s.sessionId === agent.agent_session_key
      )
      const childSessions = sessions.filter((s) => {
        return (
          s.label?.includes(`parent=${agent.agent_session_key}`) ||
          s.key.startsWith(`${agent.agent_session_key}:`)
        )
      })
      return {
        agent,
        session: mainSession,
        status: calculateStatus(mainSession, childSessions),
        childSessions,
      }
    })
  }, [agents, sessions, calculateStatus])

  const pinnedAgents = useMemo(
    () => agentRuntimes.filter((runtime) => runtime.agent.is_pinned),
    [agentRuntimes]
  )

  const togglePin = useCallback(
    async (agentId: string) => {
      try {
        const agent = agents.find((a) => a.id === agentId)
        if (!agent) return
        const response = await fetch(`${API_BASE}/agents/${agentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_pinned: !agent.is_pinned }),
        })
        if (!response.ok) throw new Error('Failed to toggle pin')
        await fetchAgents()
      } catch (err) {
        console.error('Failed to toggle pin:', err)
      }
    },
    [agents, fetchAgents]
  )

  return { agents: agentRuntimes, pinnedAgents, isLoading, error, refresh: fetchAgents, togglePin }
}
