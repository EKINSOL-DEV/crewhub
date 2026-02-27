import { useState, useCallback, useEffect } from 'react'
import { Html } from '@react-three/drei'
import { useDragActions } from '@/contexts/DragDropContext'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import { TaskBoard } from '@/components/tasks/TaskBoard'

// ── Props ──────────────────────────────────────────────────────

interface TaskWall3DProps {
  readonly projectId: string
  readonly roomId: string
  readonly position?: [number, number, number]
  readonly rotation?: [number, number, number]
  readonly width?: number
  readonly height?: number
  readonly agents?: Array<{ session_key: string; display_name: string }>
}

// ── Component ──────────────────────────────────────────────────

export function TaskWall3D({
  projectId,
  roomId,
  position = [0, 2.8, 5.5],
  rotation = [0, Math.PI, 0],
  width = 7.8,
  height = 3.1,
  agents = [],
}: TaskWall3DProps) {
  const [isHovered, setIsHovered] = useState(false)
  const { setInteractingWithUI } = useDragActions()
  const { state: focusState, focusBoard } = useWorldFocus()

  // Only enable pointer events when this room is focused (prevent other rooms from intercepting clicks)
  const isThisRoomFocused = focusState.focusedRoomId === roomId
  const pointerEventsEnabled = isThisRoomFocused ? 'auto' : 'none'

  // Clean up interaction flag when room loses focus
  useEffect(() => {
    if (!isThisRoomFocused) {
      setInteractingWithUI(false)
    }
  }, [isThisRoomFocused, setInteractingWithUI])

  // Block camera controls when interacting with the board
  const handlePointerEnter = useCallback(() => {
    if (!isThisRoomFocused) return
    setInteractingWithUI(true)
  }, [isThisRoomFocused, setInteractingWithUI])

  const handlePointerLeave = useCallback(() => {
    if (!isThisRoomFocused) return
    setInteractingWithUI(false)
  }, [isThisRoomFocused, setInteractingWithUI])

  return (
    <group
      position={position}
      rotation={rotation}
      userData={{ isScreenHtml: true }}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      {/* Whiteboard backing */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          color={isHovered ? '#f8fafc' : '#ffffff'}
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/* Frame border */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[width + 0.15, height + 0.15]} />
        <meshStandardMaterial color={isHovered ? '#334155' : '#475569'} roughness={0.5} />
      </mesh>

      {/* Embedded TaskBoard */}
      <Html
        position={[0, 0, 0.01]}
        center
        transform
        scale={0.28}
        zIndexRange={[10, 20]}
        style={{
          width: `${width * 140}px`,
          height: `${height * 140}px`,
          pointerEvents: pointerEventsEnabled,
        }}
      >
        <button
          type="button"
          data-world-ui
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            e.stopPropagation()
            e.nativeEvent.stopImmediatePropagation()
          }}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              e.nativeEvent.stopImmediatePropagation()
            }
          }}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onTouchStart={(e) => {
            e.stopPropagation()
            handlePointerEnter()
          }}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => {
            e.stopPropagation()
            handlePointerLeave()
          }}
          onWheel={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            height: '100%',
            background: '#ffffff',
            borderRadius: '8px',
            overflow: 'hidden',
            padding: '16px',
            boxSizing: 'border-box',
          }}
        >
          <TaskBoard
            projectId={projectId}
            roomId={roomId}
            agents={agents}
            compact={false}
            maxTasksPerColumn={6}
          />
        </button>
      </Html>

      {/* Focus button below the board (only show when not already in board focus) */}
      {focusState.level !== 'board' && (
        <Html
          position={[0, -height / 2 - 0.3, 0.01]}
          center
          transform
          scale={0.275}
          zIndexRange={[10, 20]}
          style={{ pointerEvents: pointerEventsEnabled }}
        >
          <button
            data-world-ui
            onClick={(e) => {
              e.stopPropagation()
              e.nativeEvent.stopImmediatePropagation()
              focusBoard(roomId)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => {
              e.stopPropagation()
              e.nativeEvent.stopImmediatePropagation()
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)'
            }}
          >
            🔍 Focus Board
          </button>
        </Html>
      )}
    </group>
  )
}
