import { useWorldFocus } from '@/contexts/WorldFocusContext'
import type { Room } from '@/hooks/useRooms'
import { zoneRegistry } from '@/lib/zones'
import { useZone } from '@/hooks/useZone'

interface RoomTabsBarProps {
  readonly rooms: Room[]
  readonly roomBotCounts: Map<string, number>
  readonly parkingBotCount: number
}

export function RoomTabsBar({ rooms, roomBotCounts, parkingBotCount }: RoomTabsBarProps) {
  const { state, focusRoom, goOverview } = useWorldFocus()
  const { activeZone, switchZone, isTransitioning } = useZone()
  const zones = zoneRegistry.getAll()

  const handleTabClick = (roomId: string) => {
    if (
      state.focusedRoomId === roomId &&
      (state.level === 'room' || state.level === 'bot' || state.level === 'board')
    ) {
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
      {rooms.map((room) => {
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
              background: isFocused ? room.color || '#4f46e5' : 'rgba(0,0,0,0.04)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!isFocused) {
                e.currentTarget.style.background = 'rgba(0,0,0,0.08)'
              }
            }}
            onMouseLeave={(e) => {
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

      {/* Zone switcher */}
      {zones.length > 1 && (
        <>
          <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.1)', flexShrink: 0 }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <select
              value={activeZone.id}
              onChange={(e) => switchZone(e.target.value)}
              disabled={isTransitioning}
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 28px 5px 12px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                color: '#374151',
                background: 'rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                fontFamily: 'system-ui, sans-serif',
                opacity: isTransitioning ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.04)'
              }}
            >
              {zones.map((z) => {
                let label = ''
                if (z.id === 'creator-center') label = ' [ALPHA PREVIEW]'
                if (z.id === 'game-center' || z.id === 'academy') label = ' [PLANNED]'
                return (
                  <option key={z.id} value={z.id}>
                    {z.icon} {z.name}
                    {label}
                  </option>
                )
              })}
            </select>
            <span
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 10,
                color: '#9ca3af',
                pointerEvents: 'none',
              }}
            >
              ▼
            </span>
          </div>
        </>
      )}
    </div>
  )
}
