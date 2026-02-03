import { useState, useMemo } from 'react'
import { Html } from '@react-three/drei'
import { RoomFloor } from './RoomFloor'
import { RoomWalls } from './RoomWalls'
import { RoomNameplate } from './RoomNameplate'
import { GridRoomRenderer } from './grid/GridRoomRenderer'
import { getBlueprintForRoom } from '@/lib/grid'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import { useDragDrop } from '@/contexts/DragDropContext'
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

// ─── Room Drop Zone (visible when dragging) ────────────────────

function RoomDropZone({ roomId, size }: { roomId: string; size: number }) {
  const { drag, dropOnRoom } = useDragDrop()
  const [isDropTarget, setIsDropTarget] = useState(false)

  // Only show drop zone when dragging and not hovering over source room
  if (!drag.isDragging) return null

  const isSourceRoom = drag.sourceRoomId === roomId

  return (
    <Html
      position={[0, 0.5, 0]}
      center
      zIndexRange={[5, 10]}
      style={{ pointerEvents: 'auto' }}
    >
      <div
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          if (!isSourceRoom) setIsDropTarget(true)
        }}
        onDragLeave={() => setIsDropTarget(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDropTarget(false)
          if (!isSourceRoom) {
            dropOnRoom(roomId)
          }
        }}
        style={{
          width: `${size * 14}px`,
          height: `${size * 14}px`,
          background: isDropTarget
            ? 'rgba(255, 165, 0, 0.25)'
            : isSourceRoom
              ? 'rgba(100, 100, 100, 0.1)'
              : 'rgba(79, 70, 229, 0.08)',
          borderRadius: '16px',
          border: isDropTarget
            ? '3px dashed rgba(255, 165, 0, 0.8)'
            : isSourceRoom
              ? '2px dashed rgba(100, 100, 100, 0.3)'
              : '2px dashed rgba(79, 70, 229, 0.3)',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
        }}
      >
        {isDropTarget && (
          <div style={{
            color: 'rgba(255, 165, 0, 0.9)',
            fontSize: '18px',
            fontWeight: 700,
            fontFamily: 'system-ui, sans-serif',
            textShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }}>
            Drop here
          </div>
        )}
      </div>
    </Html>
  )
}

/**
 * Composes a complete 3D room: floor, walls, nameplate, and furniture props.
 * Room size defaults to ~12x12 units.
 */
export function Room3D({ room, position = [0, 0, 0], size = 12 }: Room3DProps) {
  const roomColor = room.color || '#4f46e5'
  const blueprint = useMemo(() => getBlueprintForRoom(room.name), [room.name])

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

      {/* Drop zone overlay (visible during drag) */}
      <RoomDropZone roomId={room.id} size={size} />

      {/* ─── Grid-based furniture props ────────────────────────────── */}
      <GridRoomRenderer blueprint={blueprint} roomPosition={position} />
    </group>
  )
}
