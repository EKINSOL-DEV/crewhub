/** Consistent agent-to-color mapping. Use everywhere to avoid color mismatches. */
export type AgentVariant = 'orange' | 'blue' | 'green' | 'purple' | 'amber' | 'pink' | 'cyan'

const AGENT_COLOR_MAP: Record<string, AgentVariant> = {
  main: 'orange',
  dev: 'blue',
  flowy: 'purple',
  creator: 'pink',
  reviewer: 'green',
}

export function getAgentVariant(agentId: string): AgentVariant {
  return AGENT_COLOR_MAP[agentId] || 'orange'
}
