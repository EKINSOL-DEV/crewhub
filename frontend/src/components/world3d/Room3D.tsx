import { useState, useMemo, useRef, useCallback } from 'react'
import { Html } from '@react-three/drei'
import { RoomFloor } from './RoomFloor'
import { RoomWalls } from './RoomWalls'
import { RoomNameplate } from './RoomNameplate'
import { GridRoomRenderer } from './grid/GridRoomRenderer'
import { GridDebugOverlay, GridDebugLabels } from './grid/GridDebugOverlay'
import { getBlueprintForRoom } from '@/lib/grid'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import { useDragDrop } from '@/contexts/DragDropContext'
import { useGridDebug } from '@/hooks/useGridDebug'
import type { Room } from '@/hooks/useRooms'
import type { ThreeEvent } from '@react-three/fiber'

interface Room3DProps {
  room: Room
  position?: [number, number, number]
  size?: number
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
 *
 * Rooms are directly interactive:
 * - Hover: emissive glow on floor/walls, nameplate micro-scale, pointer cursor
 * - Click at overview: focusRoom → camera zooms in, Room HUD opens
 * - Click at room level: floor click re-opens Room HUD, bot clicks handled by Bot3D
 */
export function Room3D({ room, position = [0, 0, 0], size = 12 }: Room3DProps) {
  const roomColor = room.color || '#4f46e5'
  const blueprint = useMemo(() => getBlueprintForRoom(room.name), [room.name])
  const [gridDebugEnabled] = useGridDebug()
  const { state, focusRoom, goBack } = useWorldFocus()
  const isRoomFocused = state.focusedRoomId === room.id && state.level === 'room'

  // ─── Hover state with 80ms debounce/hysteresis ──────────────
  const [hovered, setHovered] = useState(false)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setHovered(true)
    document.body.style.cursor = 'pointer'
  }, [])

  const handlePointerOut = useCallback((_e: ThreeEvent<PointerEvent>) => {
    // 80ms hysteresis to prevent flicker at room boundaries
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => {
      setHovered(false)
      document.body.style.cursor = 'auto'
      hoverTimerRef.current = null
    }, 80)
  }, [])

  // ─── Click handler (focus-level aware) ──────────────────────
  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()

    if (state.level === 'overview' || state.level === 'firstperson') {
      // Overview: zoom into room
      focusRoom(room.id)
    } else if (state.level === 'bot' && state.focusedRoomId === room.id) {
      // Bot level, same room: go back to room level (re-open Room HUD)
      goBack()
    } else if (state.focusedRoomId !== room.id) {
      // Different room: switch to it
      focusRoom(room.id)
    }
    // Room level, same room: no-op — Room HUD stays open
  }, [state.level, state.focusedRoomId, room.id, focusRoom, goBack])

  return (
    <group
      position={position}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* Floor tiles */}
      <RoomFloor
        color={roomColor}
        size={size}
        hovered={hovered}
        projectColor={room.project_color}
        isHQ={room.is_hq}
        floorStyle={room.floor_style || 'default'}
      />

      {/* Perimeter walls */}
      <RoomWalls
        color={roomColor}
        size={size}
        hovered={hovered}
        wallStyle={room.wall_style || 'default'}
      />

      {/* Floating nameplate above entrance */}
      <RoomNameplate
        name={room.name}
        icon={room.icon}
        color={roomColor}
        size={size}
        hovered={hovered}
        projectName={room.project_name}
        projectColor={room.project_color}
        isHQ={room.is_hq}
      />

      {/* Drop zone overlay (visible during drag) */}
      <RoomDropZone roomId={room.id} size={size} />

      {/* ─── Grid-based furniture props ────────────────────────────── */}
      <GridRoomRenderer blueprint={blueprint} roomPosition={position} />

      {/* ─── Grid debug overlay (dev tool) ─────────────────────────── */}
      {gridDebugEnabled && (
        <>
          <GridDebugOverlay blueprint={blueprint} />
          <GridDebugLabels blueprint={blueprint} showLabels={isRoomFocused} />
        </>
      )}
    </group>
  )
}
