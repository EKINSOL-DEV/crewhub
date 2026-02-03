import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import { useWorldFocus, type FocusLevel } from '@/contexts/WorldFocusContext'
import { botPositionRegistry } from './Bot3D'
import type CameraControlsImpl from 'camera-controls'
import * as THREE from 'three'

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

// ─── Bot follow camera config ──────────────────────────────────

const BOT_CAM_OFFSET = { x: 5, y: 8, z: 5 }
const BOT_CAM_LERP_FACTOR = 0.04 // gentle follow (higher = snappier)

function getBotCamera(botPos: { x: number; y: number; z: number }) {
  return {
    posX: botPos.x + BOT_CAM_OFFSET.x,
    posY: BOT_CAM_OFFSET.y,
    posZ: botPos.z + BOT_CAM_OFFSET.z,
    targetX: botPos.x,
    targetY: 0.5,
    targetZ: botPos.z,
  }
}

export function CameraController({ roomPositions }: CameraControllerProps) {
  const controlsRef = useRef<CameraControlsImpl>(null)
  const { state } = useWorldFocus()
  const prevLevelRef = useRef<FocusLevel>('overview')
  const prevRoomIdRef = useRef<string | null>(null)
  const prevBotKeyRef = useRef<string | null>(null)

  // Lerp targets for smooth bot following
  const followTarget = useRef(new THREE.Vector3())
  const followPos = useRef(new THREE.Vector3())
  const isFollowing = useRef(false)

  // ─── Transition on focus change ──────────────────────────────

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    // Skip if nothing changed
    if (
      state.level === prevLevelRef.current &&
      state.focusedRoomId === prevRoomIdRef.current &&
      state.focusedBotKey === prevBotKeyRef.current
    ) {
      return
    }

    prevLevelRef.current = state.level
    prevRoomIdRef.current = state.focusedRoomId
    prevBotKeyRef.current = state.focusedBotKey

    // Apply constraints for the new level
    applyConstraints(controls, state.level)

    if (state.level === 'overview') {
      isFollowing.current = false
      const c = OVERVIEW_CAMERA
      controls.setLookAt(c.posX, c.posY, c.posZ, c.targetX, c.targetY, c.targetZ, true)
    } else if (state.level === 'room' && state.focusedRoomId) {
      isFollowing.current = false
      const roomEntry = roomPositions.find(rp => rp.roomId === state.focusedRoomId)
      if (roomEntry) {
        const c = getRoomCamera(roomEntry.position)
        controls.setLookAt(c.posX, c.posY, c.posZ, c.targetX, c.targetY, c.targetZ, true)
      }
    } else if (state.level === 'bot' && state.focusedBotKey) {
      // Initial fly-to the bot position
      const botPos = botPositionRegistry.get(state.focusedBotKey)
      if (botPos) {
        const c = getBotCamera(botPos)
        controls.setLookAt(c.posX, c.posY, c.posZ, c.targetX, c.targetY, c.targetZ, true)
        // Initialize follow lerp targets
        followPos.current.set(c.posX, c.posY, c.posZ)
        followTarget.current.set(c.targetX, c.targetY, c.targetZ)
      }
      // Start following after initial transition settles
      setTimeout(() => { isFollowing.current = true }, 900)
    }
  }, [state.level, state.focusedRoomId, state.focusedBotKey, roomPositions])

  // ─── Smooth bot follow in useFrame ───────────────────────────

  useFrame(() => {
    if (!isFollowing.current || state.level !== 'bot' || !state.focusedBotKey || !controlsRef.current) return

    const botPos = botPositionRegistry.get(state.focusedBotKey)
    if (!botPos) return

    const controls = controlsRef.current
    const cam = getBotCamera(botPos)

    // Lerp toward desired camera + target positions
    followPos.current.lerp(new THREE.Vector3(cam.posX, cam.posY, cam.posZ), BOT_CAM_LERP_FACTOR)
    followTarget.current.lerp(new THREE.Vector3(cam.targetX, cam.targetY, cam.targetZ), BOT_CAM_LERP_FACTOR)

    // Apply (false = no transition animation, we handle smoothing ourselves)
    controls.setLookAt(
      followPos.current.x, followPos.current.y, followPos.current.z,
      followTarget.current.x, followTarget.current.y, followTarget.current.z,
      false,
    )
  })

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
