import { UserMinus, UserPlus, Pencil } from 'lucide-react'
import type { ThreadParticipant } from '@/lib/threads.api'

interface ParticipantListSheetProps {
  readonly participants: ThreadParticipant[]
  readonly threadTitle?: string | null
  readonly onClose: () => void
  readonly onRemoveParticipant: (agentId: string) => void
  readonly onAddParticipants: () => void
  readonly onRename: () => void
}

export function ParticipantListSheet({
  participants,
  threadTitle: _threadTitle,
  onClose,
  onRemoveParticipant,
  onAddParticipants,
  onRename,
}: ParticipantListSheetProps) {
  return (
    <button
      type="button"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        style={{
          background: '#1e293b',
          borderRadius: '20px 20px 0 0',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        }}
      >
        {/* Handle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '12px 0 4px',
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.15)',
            }}
          />
        </div>

        {/* Title */}
        <div
          style={{
            padding: '8px 20px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#f1f5f9' }}>
              Participants ({participants.length})
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={onRename}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: 'none',
              background: 'rgba(255,255,255,0.06)',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={onAddParticipants}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: 'none',
              background: 'rgba(99,102,241,0.15)',
              color: '#818cf8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <UserPlus size={15} />
          </button>
        </div>

        {/* Participant list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {participants.map((p) => {
            const color = p.agent_color || '#6366f1'
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 8px',
                  borderRadius: 12,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: color + '25',
                    color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {p.agent_icon || p.agent_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
                    {p.agent_name}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {p.role === 'owner' ? 'Owner' : 'Member'}
                  </div>
                </div>
                {p.role !== 'owner' && (
                  <button
                    onClick={() => onRemoveParticipant(p.agent_id)}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      border: 'none',
                      background: 'rgba(239,68,68,0.1)',
                      color: '#f87171',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <UserMinus size={14} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </button>
  )
}
