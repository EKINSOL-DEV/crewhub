import { useState, useMemo } from 'react'
import { X, Check } from 'lucide-react'
import type { AgentRuntime } from '@/hooks/useAgentsRegistry'

interface AgentMultiSelectSheetProps {
  agents: AgentRuntime[]
  onConfirm: (agentIds: string[]) => void
  onClose: () => void
}

const MIN_AGENTS = 2
const MAX_AGENTS = 5

export function AgentMultiSelectSheet({ agents, onConfirm, onClose }: AgentMultiSelectSheetProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (agentId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(agentId)) {
        next.delete(agentId)
      } else if (next.size < MAX_AGENTS) {
        next.add(agentId)
      }
      return next
    })
  }

  const canConfirm = selected.size >= MIN_AGENTS
  const selectedAgents = useMemo(
    () => agents.filter(r => selected.has(r.agent.id)),
    [agents, selected]
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column',
      background: '#0f172a',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <button onClick={onClose} style={{
          width: 36, height: 36, borderRadius: 10, border: 'none',
          background: 'transparent', color: '#94a3b8', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <X size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#f1f5f9' }}>New Group</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Select {MIN_AGENTS}-{MAX_AGENTS} agents
          </div>
        </div>
        <button
          onClick={() => onConfirm(Array.from(selected))}
          disabled={!canConfirm}
          style={{
            padding: '8px 18px', borderRadius: 12, border: 'none',
            background: canConfirm ? '#6366f1' : 'rgba(255,255,255,0.06)',
            color: canConfirm ? '#fff' : '#475569',
            fontSize: 14, fontWeight: 600, cursor: canConfirm ? 'pointer' : 'default',
          }}
        >
          Continue ({selected.size})
        </button>
      </header>

      {/* Selected chips */}
      {selectedAgents.length > 0 && (
        <div style={{
          padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          {selectedAgents.map(r => (
            <button
              key={r.agent.id}
              onClick={() => toggle(r.agent.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px 5px 8px', borderRadius: 20,
                border: 'none', background: (r.agent.color || '#6366f1') + '22',
                color: r.agent.color || '#6366f1', fontSize: 13, cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 14 }}>{r.agent.icon || r.agent.name.charAt(0)}</span>
              {r.agent.name}
              <X size={12} />
            </button>
          ))}
        </div>
      )}

      {/* Agent list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {agents.map(runtime => {
          const { agent } = runtime
          const isSelected = selected.has(agent.id)
          const isDisabled = !isSelected && selected.size >= MAX_AGENTS
          const color = agent.color || '#6366f1'

          return (
            <button
              key={agent.id}
              onClick={() => !isDisabled && toggle(agent.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                width: '100%', padding: '12px',
                background: isSelected ? color + '10' : 'transparent',
                border: 'none', borderRadius: 14, cursor: isDisabled ? 'default' : 'pointer',
                textAlign: 'left', color: 'inherit',
                opacity: isDisabled ? 0.35 : 1,
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: color + '25', color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 600, flexShrink: 0,
              }}>
                {agent.icon || agent.name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>
                  {agent.name}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                  {runtime.status === 'offline' ? 'Offline' : 'Online'}
                </div>
              </div>

              {/* Checkbox */}
              <div style={{
                width: 26, height: 26, borderRadius: 8,
                border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.15)',
                background: isSelected ? color : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {isSelected && <Check size={16} color="#fff" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
