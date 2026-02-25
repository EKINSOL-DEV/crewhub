import { useState } from 'react'
import type { ThreadParticipant } from '@/lib/threads.api'

interface RoutingSelectorProps {
  participants: ThreadParticipant[]
  mode: 'broadcast' | 'targeted'
  targetAgentIds: string[]
  onModeChange: (mode: 'broadcast' | 'targeted') => void
  onTargetChange: (agentIds: string[]) => void
}

export function RoutingSelector({
  participants,
  mode,
  targetAgentIds,
  onModeChange,
  onTargetChange,
}: RoutingSelectorProps) {
  const [showTargets, setShowTargets] = useState(false)

  return (
    <div
      style={{
        padding: '6px 14px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => {
            onModeChange('broadcast')
            setShowTargets(false)
          }}
          style={{
            padding: '5px 12px',
            borderRadius: 16,
            border: 'none',
            background: mode === 'broadcast' ? '#6366f1' : 'rgba(255,255,255,0.06)',
            color: mode === 'broadcast' ? '#fff' : '#94a3b8',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          All agents
        </button>
        <button
          onClick={() => {
            onModeChange('targeted')
            setShowTargets(true)
          }}
          style={{
            padding: '5px 12px',
            borderRadius: 16,
            border: 'none',
            background: mode === 'targeted' ? '#6366f1' : 'rgba(255,255,255,0.06)',
            color: mode === 'targeted' ? '#fff' : '#94a3b8',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Selected
        </button>
      </div>

      {/* Target agent chips */}
      {mode === 'targeted' && showTargets && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {participants.map((p) => {
            const isSelected = targetAgentIds.includes(p.agent_id)
            const color = p.agent_color || '#6366f1'
            return (
              <button
                key={p.agent_id}
                onClick={() => {
                  if (isSelected) {
                    onTargetChange(targetAgentIds.filter((id) => id !== p.agent_id))
                  } else {
                    onTargetChange([...targetAgentIds, p.agent_id])
                  }
                }}
                style={{
                  padding: '3px 10px',
                  borderRadius: 14,
                  border: 'none',
                  background: isSelected ? color + '25' : 'rgba(255,255,255,0.04)',
                  color: isSelected ? color : '#64748b',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {p.agent_icon || ''} {p.agent_name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
