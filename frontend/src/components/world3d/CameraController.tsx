import { useEffect, useRef } from 'react'
import { CameraControls } from '@react-three/drei'
import { useWorldFocus, type FocusLevel } from '@/contexts/WorldFocusContext'
import type CameraControlsImpl from 'camera-controls'

interface RoomPosition {
  roomId: string
  position: [number, number, number]
}

interface CameraControllerProps {
  roomPositions: RoomPosition[]
}

// ─── Camera presets per focus level ────────────────────────────

const OVERVIEW_CAMERA = {
  posX: 45, posY: 40, posZ: 45,
  targetX: 0, targetY: 0, targetZ: 0,
}

function getRoomCamera(roomPos: [number, number, number]) {
  return {
    posX: roomPos[0] + 10,
    posY: 18,
    posZ: roomPos[2] + 10,
    targetX: roomPos[0],
    targetY: 0,
    targetZ: roomPos[2],
  }
}

// ─── Constraints per level ─────────────────────────────────────

function applyConstraints(controls: CameraControlsImpl, level: FocusLevel) {
  switch (level) {
    case 'overview':
      controls.minDistance = 15
      controls.maxDistance = 120
      controls.minPolarAngle = Math.PI / 6
      controls.maxPolarAngle = Math.PI / 3
      break
    case 'room':
      controls.minDistance = 8
      controls.maxDistance = 30
      controls.minPolarAngle = Math.PI / 8
      controls.maxPolarAngle = Math.PI / 2.5
      break
    case 'bot':
      controls.minDistance = 4
      controls.maxDistance = 15
      controls.minPolarAngle = Math.PI / 8
      controls.maxPolarAngle = Math.PI / 2.5
      break
  }
}

// ─── Component ─────────────────────────────────────────────────

export function CameraController({ roomPositions }: CameraControllerProps) {
  const controlsRef = useRef<CameraControlsImpl>(null)
  const { state } = useWorldFocus()
  const prevLevelRef = useRef<FocusLevel>('overview')
  const prevRoomIdRef = useRef<string | null>(null)

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    // Skip if nothing changed
    if (state.level === prevLevelRef.current && state.focusedRoomId === prevRoomIdRef.current) {
      return
    }

    prevLevelRef.current = state.level
    prevRoomIdRef.current = state.focusedRoomId

    // Apply constraints for the new level
    applyConstraints(controls, state.level)

    if (state.level === 'overview') {
      const c = OVERVIEW_CAMERA
      controls.setLookAt(c.posX, c.posY, c.posZ, c.targetX, c.targetY, c.targetZ, true)
    } else if (state.level === 'room' && state.focusedRoomId) {
      const roomEntry = roomPositions.find(rp => rp.roomId === state.focusedRoomId)
      if (roomEntry) {
        const c = getRoomCamera(roomEntry.position)
        controls.setLookAt(c.posX, c.posY, c.posZ, c.targetX, c.targetY, c.targetZ, true)
      }
    }
    // Bot focus (phase 2+) would add follow-camera here
  }, [state.level, state.focusedRoomId, roomPositions])

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minDistance={15}
      maxDistance={120}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI / 3}
      smoothTime={0.4}
      draggingSmoothTime={0.15}
    />
  )
}
