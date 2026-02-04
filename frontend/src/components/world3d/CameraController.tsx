import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import { useWorldFocus, type FocusLevel } from '@/contexts/WorldFocusContext'
import { useDragState } from '@/contexts/DragDropContext'
import { botPositionRegistry } from './Bot3D'
import CameraControlsImpl from 'camera-controls'
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

// ─── Mouse / touch actions ─────────────────────────────────────

const ACTION = CameraControlsImpl.ACTION

// ─── Constraints + interaction config per level ────────────────

function applyConstraints(controls: CameraControlsImpl, level: FocusLevel) {
  switch (level) {
    case 'overview':
      controls.minDistance = 15
      controls.maxDistance = 120
      controls.minPolarAngle = Math.PI / 6
      controls.maxPolarAngle = Math.PI / 3
      // Full controls: rotate, pan, zoom
      controls.mouseButtons.left = ACTION.ROTATE
      controls.mouseButtons.right = ACTION.TRUCK
      controls.mouseButtons.wheel = ACTION.DOLLY
      controls.touches.one = ACTION.TOUCH_ROTATE
      controls.touches.two = ACTION.TOUCH_DOLLY_TRUCK
      controls.touches.three = ACTION.TOUCH_TRUCK
      break
    case 'room':
      controls.minDistance = 8
      controls.maxDistance = 30
      controls.minPolarAngle = Math.PI / 8
      controls.maxPolarAngle = Math.PI / 2.5
      // Full controls: rotate, pan, zoom
      controls.mouseButtons.left = ACTION.ROTATE
      controls.mouseButtons.right = ACTION.TRUCK
      controls.mouseButtons.wheel = ACTION.DOLLY
      controls.touches.one = ACTION.TOUCH_ROTATE
      controls.touches.two = ACTION.TOUCH_DOLLY_TRUCK
      controls.touches.three = ACTION.TOUCH_TRUCK
      break
    case 'bot':
      controls.minDistance = 2
      controls.maxDistance = 12
      controls.minPolarAngle = Math.PI / 8
      controls.maxPolarAngle = Math.PI / 2.5
      // Orbital mode: rotate + zoom only, NO panning (keep orbit on bot)
      controls.mouseButtons.left = ACTION.ROTATE
      controls.mouseButtons.right = ACTION.NONE
      controls.mouseButtons.wheel = ACTION.DOLLY
      controls.touches.one = ACTION.TOUCH_ROTATE
      controls.touches.two = ACTION.TOUCH_DOLLY
      controls.touches.three = ACTION.NONE
      break
  }
}

// ─── Component ─────────────────────────────────────────────────

// ─── Bot follow camera config ──────────────────────────────────

const BOT_CAM_OFFSET = { x: 4, y: 6.5, z: 4 }
const BOT_CAM_LERP_FACTOR = 0.05 // smooth orbit-target follow

// Reusable vector to avoid GC pressure in useFrame
const _desiredTarget = new THREE.Vector3()

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
  const { isDragging } = useDragState()
  const prevLevelRef = useRef<FocusLevel>('overview')
  const prevRoomIdRef = useRef<string | null>(null)
  const prevBotKeyRef = useRef<string | null>(null)

  // Lerp target for smooth orbital following (orbit center tracks bot)
  const followTarget = useRef(new THREE.Vector3())
  const isFollowing = useRef(false)

  // ─── Disable camera controls during drag ──────────────────────

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    controls.enabled = !isDragging
  }, [isDragging])

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

    // Apply constraints + interaction config for the new level
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
      // Fly-to the bot's initial orbital position
      const botPos = botPositionRegistry.get(state.focusedBotKey)
      if (botPos) {
        const c = getBotCamera(botPos)
        controls.setLookAt(c.posX, c.posY, c.posZ, c.targetX, c.targetY, c.targetZ, true)
        followTarget.current.set(c.targetX, c.targetY, c.targetZ)
      }
      // After fly-to transition completes, enable orbital following
      setTimeout(() => {
        if (controlsRef.current) {
          // Sync follow target from actual camera target to avoid pop
          const target = controlsRef.current.getTarget(new THREE.Vector3())
          followTarget.current.copy(target)
        }
        isFollowing.current = true
      }, 850)
    }
  }, [state.level, state.focusedRoomId, state.focusedBotKey, roomPositions])

  // ─── Orbital bot follow (useFrame) ───────────────────────────
  // Only updates the orbit TARGET (look-at / orbit center).
  // Camera position adjusts automatically via CameraControls,
  // preserving the user's azimuth, polar angle, and distance.
  // This enables free orbital rotation around the focused bot.

  useFrame(() => {
    if (!isFollowing.current || state.level !== 'bot' || !state.focusedBotKey || !controlsRef.current) return

    const botPos = botPositionRegistry.get(state.focusedBotKey)
    if (!botPos) return

    const controls = controlsRef.current

    // Smoothly lerp orbit center toward bot's current position
    _desiredTarget.set(botPos.x, 0.5, botPos.z)
    followTarget.current.lerp(_desiredTarget, BOT_CAM_LERP_FACTOR)

    // Update only the orbit target — user's rotation & zoom are preserved
    controls.setTarget(
      followTarget.current.x,
      followTarget.current.y,
      followTarget.current.z,
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
