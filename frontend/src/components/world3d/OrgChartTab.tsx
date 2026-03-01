// ── Org Chart Tab ── Shows registered agents for HQ room

import { useState, useEffect } from 'react'
import { API_BASE } from '@/lib/api'

interface AgentInfo {
  id: string
  name: string
  icon: string | null
  color: string | null
  default_model: string | null
  bio: string | null
  source: string
  sort_order: number
}

function modelColor(model?: string | null): string {
  if (!model) return '#6b7280'
  const m = model.toLowerCase()
  if (m.includes('opus')) return '#7c3aed'
  if (m.includes('sonnet')) return '#2563eb'
  if (m.includes('haiku')) return '#0891b2'
  if (m.includes('gpt')) return '#059669'
  return '#6b7280'
}

function modelLabel(model?: string | null): string | null {
  if (!model) return null
  const m = model.toLowerCase()
  if (m.includes('opus')) return 'Opus'
  if (m.includes('sonnet')) return 'Sonnet'
  if (m.includes('haiku')) return 'Haiku'
  return model
}

function AgentNode({ agent }: Readonly<{ agent: AgentInfo }>) {
  const color = agent.color || '#6b7280'
  const model = modelLabel(agent.default_model)
  const mColor = modelColor(agent.default_model)

  return (
    <li style={{ listStyle: 'none' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          marginBottom: 2,
          borderRadius: 10,
          background: 'rgba(0,0,0,0.03)',
          borderLeft: `3px solid ${color}`,
        }}
      >
        <span style={{ fontSize: 18 }}>{agent.icon || '🤖'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>{agent.name}</span>
            {model && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: mColor,
                  background: mColor + '15',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}
              >
                {model}
              </span>
            )}
          </div>
          {agent.bio && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{agent.bio}</div>
          )}
        </div>
      </div>
    </li>
  )
}

export function OrgChartTab() {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/agents`)
      .then((r) => r.json())
      .then((data) => {
        const list: AgentInfo[] = data.agents || []
        list.sort((a, b) => a.sort_order - b.sort_order)
        setAgents(list)
      })
      .catch((err) => console.error('Failed to fetch agents:', err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: '16px 20px', overflow: 'auto', flex: 1 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 12,
        }}
      >
        🏢 Team Hierarchy
      </div>
      {loading ? (
        <div style={{ fontSize: 12, color: '#9ca3af', padding: 8 }}>Loading…</div>
      ) : agents.length === 0 ? (
        <div style={{ fontSize: 12, color: '#9ca3af', padding: 8 }}>No agents registered</div>
      ) : (
        <ul style={{ margin: 0, padding: 0 }}>
          {agents.map((agent) => (
            <AgentNode key={agent.id} agent={agent} />
          ))}
        </ul>
      )}
    </div>
  )
}
