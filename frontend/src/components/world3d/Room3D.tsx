import { useState, useMemo, useRef, useCallback } from 'react'
import { Html } from '@react-three/drei'
import { RoomFloor } from './RoomFloor'
import { RoomWalls } from './RoomWalls'
import { RoomNameplate } from './RoomNameplate'
import { TaskWall3D } from './TaskWall3D'
import { ZenBeeldje } from './ZenBeeldje'
import { GridRoomRenderer } from './grid/GridRoomRenderer'
import { GridDebugOverlay, GridDebugLabels } from './grid/GridDebugOverlay'
import { getBlueprintForRoom } from '@/lib/grid'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import { useDragDrop } from '@/contexts/DragDropContext'
import { useGridDebug } from '@/hooks/useGridDebug'
import { useZenMode } from '@/components/zen'
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

  // Only render when dragging
  if (!drag.isDragging) return null

  const isSourceRoom = drag.sourceRoomId === roomId

  return (
    <Html
      position={[0, 0.5, 0]}
      center
      zIndexRange={[10, 15]}
      style={{ pointerEvents: 'auto' }}
    >
      <div
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          e.dataTransfer.dropEffect = 'move'
          if (!isSourceRoom) setIsDropTarget(true)
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!isSourceRoom) setIsDropTarget(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          // Only unset if actually leaving the element (not entering a child)
          const rect = e.currentTarget.getBoundingClientRect()
          const { clientX, clientY } = e
          if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
            setIsDropTarget(false)
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsDropTarget(false)
          if (!isSourceRoom) {
            dropOnRoom(roomId)
          }
        }}
        style={{
          // Use a generous fixed size that covers the room area at most zoom levels
          width: `${Math.max(size * 18, 200)}px`,
          height: `${Math.max(size * 18, 200)}px`,
          background: isDropTarget
            ? 'rgba(255, 165, 0, 0.3)'
            : isSourceRoom
              ? 'rgba(100, 100, 100, 0.08)'
              : 'rgba(79, 70, 229, 0.1)',
          borderRadius: '20px',
          border: isDropTarget
            ? '3px dashed rgba(255, 165, 0, 0.9)'
            : isSourceRoom
              ? '2px dashed rgba(100, 100, 100, 0.25)'
              : '2px dashed rgba(79, 70, 229, 0.35)',
          transition: 'all 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
          boxShadow: isDropTarget ? '0 0 30px rgba(255, 165, 0, 0.3)' : 'none',
        }}
      >
        {isDropTarget && (
          <div style={{
            color: 'rgba(255, 165, 0, 0.95)',
            fontSize: '16px',
            fontWeight: 700,
            fontFamily: 'system-ui, sans-serif',
            textShadow: '0 1px 4px rgba(0,0,0,0.3)',
            background: 'rgba(0,0,0,0.4)',
            padding: '6px 14px',
            borderRadius: '10px',
          }}>
            📥 Drop here
          </div>
        )}
        {isSourceRoom && (
          <div style={{
            color: 'rgba(100, 100, 100, 0.6)',
            fontSize: '12px',
            fontWeight: 500,
            fontFamily: 'system-ui, sans-serif',
          }}>
            (current room)
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
  const zenMode = useZenMode()
  
  // Handler for Zen Beeldje activation
  const handleZenActivate = useCallback(() => {
    if (room.project_id && room.project_name) {
      zenMode.enterWithProject({
        projectId: room.project_id,
        projectName: room.project_name,
        projectColor: room.project_color || undefined,
      })
    }
  }, [room.project_id, room.project_name, room.project_color, zenMode])

  // ─── Hover state with 80ms debounce/hysteresis ──────────────
  const [hovered, setHovered] = useState(false)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Track pointer down position to detect drag vs click
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)

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
  
  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY }
  }, [])

  // ─── Click handler (focus-level aware) ──────────────────────
  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    
    // Ignore clicks that were actually drags (camera rotation)
    if (pointerDownPos.current) {
      const dx = Math.abs(e.clientX - pointerDownPos.current.x)
      const dy = Math.abs(e.clientY - pointerDownPos.current.y)
      const dragThreshold = 5 // pixels
      
      if (dx > dragThreshold || dy > dragThreshold) {
        // This was a drag, not a click - ignore
        pointerDownPos.current = null
        return
      }
    }
    pointerDownPos.current = null

    // Only allow room clicks from overview or firstperson to zoom in
    // At room/board/bot level: no click action (use back button or Escape to navigate)
    if (state.level === 'overview' || state.level === 'firstperson') {
      focusRoom(room.id)
    }
  }, [state.level, room.id, focusRoom])

  return (
    <group
      position={position}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onPointerDown={handlePointerDown}
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

      {/* ─── Task Wall (3D whiteboard with embedded TaskBoard) ─────── */}
      {/* Only visible when zoomed into a room (not in overview) */}
      {room.project_id && state.level !== 'overview' && (
        <TaskWall3D
          projectId={room.project_id}
          roomId={room.id}
          position={[0, 2.8, size / 2 - 1.0]}
          rotation={[0, Math.PI, 0]}
          width={Math.min(size * 0.94, 7.8)}
          height={3.1}
        />
      )}

      {/* ─── Zen Beeldje (meditation statue for project-focused Zen Mode) ─ */}
      {/* Only visible when room has a project assigned */}
      {room.project_id && room.project_name && (
        <ZenBeeldje
          position={[-size / 2 + 8.5, 0.3, 4.5]}
          projectName={room.project_name}
          projectColor={room.project_color || undefined}
          onActivate={handleZenActivate}
        />
      )}
    </group>
  )
}
