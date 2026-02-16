import type { ThreadParticipant } from '@/lib/threads.api'

interface ParticipantAvatarStackProps {
  participants: ThreadParticipant[]
  maxShow?: number
  size?: number
}

export function ParticipantAvatarStack({
  participants,
  maxShow = 4,
  size = 28,
}: ParticipantAvatarStackProps) {
  const shown = participants.slice(0, maxShow)
  const overflow = participants.length - maxShow

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((p, i) => (
        <div
          key={p.id}
          style={{
            width: size, height: size, borderRadius: size * 0.4,
            background: (p.agent_color || '#6366f1') + '30',
            color: p.agent_color || '#6366f1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.5, fontWeight: 600,
            border: '2px solid #0f172a',
            marginLeft: i > 0 ? -(size * 0.3) : 0,
            zIndex: shown.length - i,
            position: 'relative',
          }}
          title={p.agent_name}
        >
          {p.agent_icon || p.agent_name.charAt(0).toUpperCase()}
        </div>
      ))}
      {overflow > 0 && (
        <div style={{
          width: size, height: size, borderRadius: size * 0.4,
          background: 'rgba(255,255,255,0.1)',
          color: '#94a3b8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.38, fontWeight: 600,
          border: '2px solid #0f172a',
          marginLeft: -(size * 0.3),
          position: 'relative',
        }}>
          +{overflow}
        </div>
      )}
    </div>
  )
}
