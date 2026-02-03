import { useState } from 'react'
import { Html } from '@react-three/drei'
import { RoomFloor } from './RoomFloor'
import { RoomWalls } from './RoomWalls'
import { RoomNameplate } from './RoomNameplate'
import { RoomProps } from './RoomProps'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import type { Room } from '@/hooks/useRooms'

interface Room3DProps {
  room: Room
  position?: [number, number, number]
  size?: number
}

// ─── Room Focus Button (3D icon above room) ────────────────────

function RoomFocusButton({ roomId }: { roomId: string }) {
  const { focusRoom, state } = useWorldFocus()
  const [hovered, setHovered] = useState(false)
  const isFocused = state.focusedRoomId === roomId

  return (
    <Html position={[0, 4.2, 0]} center zIndexRange={[1, 5]} style={{ pointerEvents: 'auto' }}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          focusRoom(roomId)
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          fontSize: 15,
          background: isFocused
            ? 'rgba(79, 70, 229, 0.85)'
            : hovered
              ? 'rgba(0,0,0,0.55)'
              : 'rgba(0,0,0,0.35)',
          color: '#fff',
          transform: hovered ? 'scale(1.15)' : 'scale(1)',
          transition: 'all 0.2s ease',
          boxShadow: hovered
            ? '0 0 12px rgba(79,70,229,0.5)'
            : '0 1px 4px rgba(0,0,0,0.2)',
          fontFamily: 'system-ui, sans-serif',
          lineHeight: 1,
          padding: 0,
        }}
        title={isFocused ? 'Back to overview' : 'Focus on room'}
      >
        🔍
      </button>
    </Html>
  )
}

/**
 * Composes a complete 3D room: floor, walls, nameplate, and furniture props.
 * Room size defaults to ~12x12 units.
 */
export function Room3D({ room, position = [0, 0, 0], size = 12 }: Room3DProps) {
  const roomColor = room.color || '#4f46e5'

  return (
    <group position={position}>
      {/* Floor tiles */}
      <RoomFloor color={roomColor} size={size} />

      {/* Perimeter walls */}
      <RoomWalls color={roomColor} size={size} />

      {/* Floating nameplate above entrance */}
      <RoomNameplate
        name={room.name}
        icon={room.icon}
        color={roomColor}
        size={size}
      />

      {/* Focus button above room */}
      <RoomFocusButton roomId={room.id} />

      {/* ─── Room-specific furniture props ─────────────────────────── */}
      <RoomProps roomName={room.name} roomSize={size} />
    </group>
  )
}
