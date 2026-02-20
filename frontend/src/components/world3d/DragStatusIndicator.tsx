import { useDragState } from '@/contexts/DragDropContext'

export function DragStatusIndicator() {
  const drag = useDragState()
  if (!drag.isDragging) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 25,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 18px',
        borderRadius: 14,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(12px)',
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'system-ui, sans-serif',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.15)',
        animation: 'fadeInDown 0.2s ease-out',
        pointerEvents: 'none',
      }}
    >
      <span style={{ fontSize: 16 }}>🤖</span>
      <span>Moving <strong>{drag.sessionName}</strong></span>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
        Drop on room or outside to unassign · Esc to cancel
      </span>
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}
