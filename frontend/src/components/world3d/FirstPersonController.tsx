import { useRef, useEffect, useCallback, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import { getBlueprintForRoom } from '@/lib/grid/blueprints'
import { getWalkableMask, worldToGrid } from '@/lib/grid/blueprintUtils'
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib'

// ─── Types ─────────────────────────────────────────────────────

interface RoomCollisionData {
  roomId: string
  roomName: string
  centerX: number
  centerZ: number
  halfSize: number
  walkableMask: boolean[][]
  cellSize: number
  gridWidth: number
  gridDepth: number
}

interface FirstPersonControllerProps {
  /** Room positions from the building layout */
  roomPositions: { roomId: string; roomName: string; position: [number, number, number] }[]
  /** Room size (default 12) */
  roomSize?: number
  /** Building width for perimeter bounds */
  buildingWidth: number
  /** Building depth for perimeter bounds */
  buildingDepth: number
  /** Callback when entering a room (for room name HUD) */
  onEnterRoom?: (roomName: string) => void
  /** Callback when leaving a room */
  onLeaveRoom?: () => void
  /** Callback when pointer lock state changes */
  onLockChange?: (locked: boolean) => void
}

// ─── Constants ─────────────────────────────────────────────────

const EYE_HEIGHT = 0.7
const WALK_SPEED = 3
const RUN_SPEED = 6

// ─── Key state ─────────────────────────────────────────────────

const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  shift: false,
}

// ─── Component ─────────────────────────────────────────────────

export function FirstPersonController({
  roomPositions,
  roomSize = 12,
  buildingWidth,
  buildingDepth,
  onEnterRoom,
  onLeaveRoom,
  onLockChange,
}: FirstPersonControllerProps) {
  const { state, exitFirstPerson } = useWorldFocus()
  const { camera } = useThree()
  const controlsRef = useRef<PointerLockControlsImpl>(null)
  const isLocked = useRef(false)
  const currentRoomRef = useRef<string | null>(null)
  const enabled = state.level === 'firstperson'
  const hasEnteredRef = useRef(false)

  // ─── Build collision data from room positions ────────────────

  const collisionRooms: RoomCollisionData[] = useMemo(() => {
    return roomPositions.map(rp => {
      const blueprint = getBlueprintForRoom(rp.roomName)
      const mask = getWalkableMask(blueprint.cells)
      return {
        roomId: rp.roomId,
        roomName: rp.roomName,
        centerX: rp.position[0],
        centerZ: rp.position[2],
        halfSize: roomSize / 2,
        walkableMask: mask,
        cellSize: blueprint.cellSize,
        gridWidth: blueprint.gridWidth,
        gridDepth: blueprint.gridDepth,
      }
    })
  }, [roomPositions, roomSize])

  // ─── Collision check ─────────────────────────────────────────

  const canMoveTo = useCallback((worldX: number, worldZ: number): boolean => {
    // Check if inside any room
    for (const room of collisionRooms) {
      const dx = worldX - room.centerX
      const dz = worldZ - room.centerZ
      const hs = room.halfSize

      if (dx >= -hs && dx <= hs && dz >= -hs && dz <= hs) {
        // Inside this room's bounds — use walkable mask
        const gridPos = worldToGrid(dx, dz, room.cellSize, room.gridWidth, room.gridDepth)
        // Check the cell and adjacent cells for the player radius
        return room.walkableMask[gridPos.z]?.[gridPos.x] ?? false
      }
    }

    // Outside all rooms — hallway/exterior
    // Allow movement within building perimeter with some margin
    const halfBW = buildingWidth / 2 - 0.5
    const halfBD = buildingDepth / 2 - 0.5
    return worldX >= -halfBW && worldX <= halfBW && worldZ >= -halfBD && worldZ <= halfBD
  }, [collisionRooms, buildingWidth, buildingDepth])

  // ─── Detect which room the player is in ──────────────────────

  const detectRoom = useCallback((worldX: number, worldZ: number): string | null => {
    for (const room of collisionRooms) {
      const dx = Math.abs(worldX - room.centerX)
      const dz = Math.abs(worldZ - room.centerZ)
      if (dx < room.halfSize - 0.5 && dz < room.halfSize - 0.5) {
        return room.roomName
      }
    }
    return null
  }, [collisionRooms])

  // ─── Keyboard listeners ──────────────────────────────────────

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.forward = true
          break
        case 'KeyS':
        case 'ArrowDown':
          keys.backward = true
          break
        case 'KeyA':
        case 'ArrowLeft':
          keys.left = true
          break
        case 'KeyD':
        case 'ArrowRight':
          keys.right = true
          break
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.shift = true
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.forward = false
          break
        case 'KeyS':
        case 'ArrowDown':
          keys.backward = false
          break
        case 'KeyA':
        case 'ArrowLeft':
          keys.left = false
          break
        case 'KeyD':
        case 'ArrowRight':
          keys.right = false
          break
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.shift = false
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      // Reset keys on cleanup
      keys.forward = false
      keys.backward = false
      keys.left = false
      keys.right = false
      keys.shift = false
    }
  }, [enabled])

  // ─── Position camera when entering first person ───────────────
  // NOTE: We do NOT programmatically call lock() — it requires a user gesture.
  // drei's PointerLockControls adds a click handler to `document` that
  // triggers lock() on the next click. The HUD prompts the user to click.

  useEffect(() => {
    if (enabled && !hasEnteredRef.current) {
      hasEnteredRef.current = true
      // Position camera at building entrance or center
      camera.position.set(0, EYE_HEIGHT, 0)
      // Reset camera rotation to look forward (+Z)
      camera.rotation.set(0, 0, 0)
    }
    if (!enabled) {
      hasEnteredRef.current = false
      controlsRef.current?.unlock()
    }
  }, [enabled, camera])

  // ─── Handle pointer lock/unlock events ───────────────────────

  const handleLock = useCallback(() => {
    isLocked.current = true
    onLockChange?.(true)
  }, [onLockChange])

  const handleUnlock = useCallback(() => {
    isLocked.current = false
    onLockChange?.(false)
    // When pointer is unlocked (e.g. user pressed ESC), exit first person
    if (enabled) {
      exitFirstPerson()
    }
  }, [enabled, exitFirstPerson, onLockChange])

  // ─── Movement loop ──────────────────────────────────────────

  const _direction = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
    if (!enabled || !isLocked.current) return

    _direction.set(0, 0, 0)

    if (keys.forward) _direction.z -= 1
    if (keys.backward) _direction.z += 1
    if (keys.left) _direction.x -= 1
    if (keys.right) _direction.x += 1

    if (_direction.lengthSq() === 0) {
      // Still detect room even when standing still
      const roomName = detectRoom(camera.position.x, camera.position.z)
      if (roomName !== currentRoomRef.current) {
        currentRoomRef.current = roomName
        if (roomName) onEnterRoom?.(roomName)
        else onLeaveRoom?.()
      }
      return
    }

    _direction.normalize()

    // Apply camera rotation to movement direction
    _direction.applyQuaternion(camera.quaternion)
    _direction.y = 0 // Stay on ground plane
    _direction.normalize()

    const speed = (keys.shift ? RUN_SPEED : WALK_SPEED) * delta
    const newX = camera.position.x + _direction.x * speed
    const newZ = camera.position.z + _direction.z * speed

    // Try full movement first
    if (canMoveTo(newX, newZ)) {
      camera.position.x = newX
      camera.position.z = newZ
    } else {
      // Wall sliding: try X only, then Z only
      if (canMoveTo(newX, camera.position.z)) {
        camera.position.x = newX
      } else if (canMoveTo(camera.position.x, newZ)) {
        camera.position.z = newZ
      }
      // If neither works, don't move (hit a corner)
    }

    // Lock Y to eye height
    camera.position.y = EYE_HEIGHT

    // Detect room transitions
    const roomName = detectRoom(camera.position.x, camera.position.z)
    if (roomName !== currentRoomRef.current) {
      currentRoomRef.current = roomName
      if (roomName) onEnterRoom?.(roomName)
      else onLeaveRoom?.()
    }
  })

  if (!enabled) return null

  return (
    <PointerLockControls
      ref={controlsRef}
      onLock={handleLock}
      onUnlock={handleUnlock}
    />
  )
}

// ─── HUD Overlay (rendered outside Canvas) ─────────────────────

interface FirstPersonHUDProps {
  currentRoom: string | null
  showRoomLabel: boolean
}

export function FirstPersonHUD({ currentRoom, showRoomLabel }: FirstPersonHUDProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 60,
      }}
    >
      {/* Crosshair */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 20,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{
          position: 'absolute',
          width: 2,
          height: 12,
          background: 'rgba(255,255,255,0.6)',
          borderRadius: 1,
        }} />
        <div style={{
          position: 'absolute',
          width: 12,
          height: 2,
          background: 'rgba(255,255,255,0.6)',
          borderRadius: 1,
        }} />
      </div>

      {/* ESC hint (top-center) */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '6px 16px',
          borderRadius: 8,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          color: 'rgba(255,255,255,0.8)',
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'system-ui, sans-serif',
          animation: 'fpHudFadeOut 4s forwards',
        }}
      >
        Press <strong>ESC</strong> to exit · <strong>WASD</strong> to move · <strong>Shift</strong> to run
      </div>

      {/* Room label (bottom-center, appears on room entry) */}
      {showRoomLabel && currentRoom && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 24px',
            borderRadius: 12,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            color: '#fff',
            fontSize: 18,
            fontWeight: 700,
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '0.5px',
            animation: 'fpRoomFade 2.5s forwards',
          }}
        >
          {currentRoom}
        </div>
      )}

      {/* Controls hint (bottom-left) */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          padding: '6px 12px',
          borderRadius: 8,
          background: 'rgba(0,0,0,0.35)',
          color: 'rgba(255,255,255,0.5)',
          fontSize: 11,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        🚶 First Person Mode
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes fpHudFadeOut {
          0%, 70% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes fpRoomFade {
          0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
          15% { opacity: 1; transform: translateX(-50%) translateY(0); }
          75% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        }
      `}</style>
    </div>
  )
}
