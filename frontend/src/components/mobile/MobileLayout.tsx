import { useState, useCallback } from 'react'
import { MobileAgentList } from './MobileAgentList'
import { MobileAgentChat } from './MobileAgentChat'
import { useSessionsStream } from '@/hooks/useSessionsStream'
import { useAgentsRegistry } from '@/hooks/useAgentsRegistry'

interface AgentInfo {
  sessionKey: string
  agentId: string
  agentName: string
  agentIcon: string | null
  agentColor: string | null
}

// Fixed crew members only
const FIXED_AGENT_IDS = ['main', 'dev', 'flowy', 'creator', 'reviewer', 'wtl', 'game-dev']

export function MobileLayout() {
  const { sessions, loading, connected, refresh } = useSessionsStream(true)
  const { agents } = useAgentsRegistry(sessions)
  const [activeAgent, setActiveAgent] = useState<AgentInfo | null>(null)

  // Filter to fixed agents only
  const fixedAgents = agents.filter(r => FIXED_AGENT_IDS.includes(r.agent.id))

  // Get subagent sessions for a given agent id
  const getSubagentSessions = useCallback((agentId: string) => {
    const prefix = `agent:${agentId}:subagent:`
    return sessions.filter(s => s.key.startsWith(prefix))
  }, [sessions])

  const handleSelectAgent = useCallback((agentId: string, name: string, icon: string | null, color: string | null, sessionKey: string) => {
    setActiveAgent({ sessionKey, agentId, agentName: name, agentIcon: icon, agentColor: color })
  }, [])

  const handleBack = useCallback(() => {
    setActiveAgent(null)
  }, [])

  return (
    <div style={{
      height: '100dvh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      background: '#0f172a',
      color: '#e2e8f0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      overflow: 'hidden',
    }}>
      {activeAgent ? (
        <MobileAgentChat
          sessionKey={activeAgent.sessionKey}
          agentName={activeAgent.agentName}
          agentIcon={activeAgent.agentIcon}
          agentColor={activeAgent.agentColor}
          subagentSessions={getSubagentSessions(activeAgent.agentId)}
          onBack={handleBack}
        />
      ) : (
        <MobileAgentList
          agents={fixedAgents}
          loading={loading}
          connected={connected}
          onSelectAgent={handleSelectAgent}
          onRefresh={refresh}
        />
      )}
    </div>
  )
}
