import { useWorldFocus } from '@/contexts/WorldFocusContext'
import type { Room } from '@/hooks/useRooms'

interface RoomTabsBarProps {
  rooms: Room[]
  roomBotCounts: Map<string, number>
  parkingBotCount: number
}

export function RoomTabsBar({ rooms, roomBotCounts, parkingBotCount }: RoomTabsBarProps) {
  const { state, focusRoom, goOverview } = useWorldFocus()

  const handleTabClick = (roomId: string) => {
    if (state.focusedRoomId === roomId) {
      goOverview()
    } else {
      focusRoom(roomId)
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 15,
        display: 'flex',
        gap: 6,
        padding: '6px 10px',
        borderRadius: 16,
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(200,200,200,0.4)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {rooms.map(room => {
        const count = roomBotCounts.get(room.id) || 0
        const isFocused = state.focusedRoomId === room.id
        return (
          <button
            key={room.id}
            onClick={() => handleTabClick(room.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 12px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: isFocused ? 700 : 500,
              color: isFocused ? '#fff' : '#374151',
              background: isFocused
                ? (room.color || '#4f46e5')
                : 'rgba(0,0,0,0.04)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              if (!isFocused) {
                e.currentTarget.style.background = 'rgba(0,0,0,0.08)'
              }
            }}
            onMouseLeave={e => {
              if (!isFocused) {
                e.currentTarget.style.background = 'rgba(0,0,0,0.04)'
              }
            }}
          >
            <span>{room.icon || '📦'}</span>
            {/* Project color dot / HQ star */}
            {room.is_hq ? (
              <span style={{ color: '#FFD700', fontSize: 11, lineHeight: 1 }}>★</span>
            ) : room.project_color ? (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: room.project_color,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
            ) : null}
            <span>{room.name}</span>
            {count > 0 && (
              <span
                style={{
                  minWidth: 18,
                  height: 18,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 9,
                  fontSize: 10,
                  fontWeight: 700,
                  background: isFocused ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)',
                  color: isFocused ? '#fff' : '#6b7280',
                  padding: '0 4px',
                }}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}

      {/* Parking tab */}
      {parkingBotCount > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 10px',
            fontSize: 12,
            color: '#9ca3af',
            fontWeight: 500,
          }}
        >
          🅿️ {parkingBotCount}
        </div>
      )}
    </div>
  )
}
