import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import { useWorldFocus, type FocusLevel } from '@/contexts/WorldFocusContext'
import { useDragState } from '@/contexts/DragDropContext'
import { botPositionRegistry } from './Bot3D'
import { getIsPropBeingMoved, getIsPropBeingDragged, getIsLongPressPending } from '@/hooks/usePropMovement'
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
  posX: -45, posY: 40, posZ: -45,
  targetX: 0, targetY: 0, targetZ: 0,
}

function getRoomCamera(roomPos: [number, number, number]) {
  // Offset in the same direction as OVERVIEW_CAMERA (-X, -Z quadrant)
  // so zooming in from overview to room keeps the same viewing angle.
  // Tuned by Nicky for good task board visibility
  return {
    posX: roomPos[0] - 7,
    posY: 6.7,
    posZ: roomPos[2] - 12,
    targetX: roomPos[0] - 2,
    targetY: 1.5,
    targetZ: roomPos[2],
  }
}

// Board is on back wall at z+5.5 from room center, facing -Z
function getBoardCamera(roomPos: [number, number, number], roomSize: number = 12) {
  // Board is at front wall: z = roomPos[2] + roomSize/2 - 1
  const boardZ = roomPos[2] + roomSize / 2 - 1
  // Tuned by Nicky for perfect board view
  // Tiny X offset to prevent 360° spin while staying mostly centered
  return {
    posX: roomPos[0] - 0.5,
    posY: 4.2,
    posZ: roomPos[2] - 2,
    targetX: roomPos[0],
    targetY: 2.5,
    targetZ: boardZ,
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
    case 'board':
      controls.minDistance = 2
      controls.maxDistance = 8
      controls.minPolarAngle = Math.PI / 4
      controls.maxPolarAngle = Math.PI / 2.2
      // Zoom only, minimal rotation (viewing board)
      controls.mouseButtons.left = ACTION.ROTATE
      controls.mouseButtons.right = ACTION.NONE
      controls.mouseButtons.wheel = ACTION.DOLLY
      controls.touches.one = ACTION.TOUCH_ROTATE
      controls.touches.two = ACTION.TOUCH_DOLLY
      controls.touches.three = ACTION.NONE
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

// Reserved for future use (bot-specific camera positioning)
export function getBotCamera(botPos: { x: number; y: number; z: number }) {
  return {
    posX: botPos.x + BOT_CAM_OFFSET.x,
    posY: BOT_CAM_OFFSET.y,
    posZ: botPos.z + BOT_CAM_OFFSET.z,
    targetX: botPos.x,
    targetY: 0.5,
    targetZ: botPos.z,
  }
}

// ─── WASD keyboard state for overview/room camera movement ─────

const _wasdKeys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  rotateLeft: false,
  rotateRight: false,
  fast: false,
}

const WASD_SPEED = 15        // units per second (base)
const WASD_FAST_MULT = 2.5   // shift multiplier
const WASD_ROTATE_SPEED = 1.2 // radians per second
const WASD_SMOOTHING = 0.12  // lerp factor for velocity smoothing

/** Returns true if an interactive input element is focused */
function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

export function CameraController({ roomPositions }: CameraControllerProps) {
  const controlsRef = useRef<CameraControlsImpl>(null)
  const { state } = useWorldFocus()
  const { isDragging, isInteractingWithUI } = useDragState()
  const prevLevelRef = useRef<FocusLevel | null>(null)
  const prevRoomIdRef = useRef<string | null>(null)
  const prevBotKeyRef = useRef<string | null>(null)
  const isInitialMount = useRef(true)

  // Lerp target for smooth orbital following (orbit center tracks bot)
  const followTarget = useRef(new THREE.Vector3())
  const isFollowing = useRef(false)

  // Smooth velocity for WASD movement
  const wasdVelocity = useRef(new THREE.Vector3())
  const wasdRotVelocity = useRef(0)

  // ─── Disable camera controls when fullscreen overlay is open ──
  useEffect(() => {
    const handler = (e: Event) => {
      const controls = controlsRef.current
      if (!controls) return
      const detail = (e as CustomEvent).detail
      if (detail?.open) {
        controls.enabled = false
      } else {
        // Re-enable only if not otherwise disabled
        controls.enabled = !isDragging && !isInteractingWithUI
      }
    }
    window.addEventListener('fullscreen-overlay', handler)
    return () => window.removeEventListener('fullscreen-overlay', handler)
  }, [isDragging, isInteractingWithUI])

  // ─── Disable camera controls during drag ──────────────────────
  // Tracks both bot drag (DragDropContext) and prop drag (usePropMovement)

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    controls.enabled = !isDragging && !isInteractingWithUI
  }, [isDragging, isInteractingWithUI])

  // Also disable when prop is being moved or dragged (polled each frame)
  useFrame(() => {
    const controls = controlsRef.current
    if (!controls) return
    const propMoving = getIsPropBeingMoved()
    const propDragging = getIsPropBeingDragged()
    const longPressPending = getIsLongPressPending()
    const shouldDisable = propMoving || propDragging || longPressPending
    // Only update if changed to avoid unnecessary work
    if (shouldDisable && controls.enabled) {
      controls.enabled = false
    } else if (!shouldDisable && !isDragging && !isInteractingWithUI && !controls.enabled) {
      controls.enabled = true
    }
  })

  // ─── WASD keyboard listeners (overview + room only) ───────────

  const wasdEnabled = state.level === 'overview' || state.level === 'room'

  useEffect(() => {
    if (!wasdEnabled) {
      // Reset keys when leaving overview/room
      _wasdKeys.forward = false
      _wasdKeys.backward = false
      _wasdKeys.left = false
      _wasdKeys.right = false
      _wasdKeys.rotateLeft = false
      _wasdKeys.rotateRight = false
      _wasdKeys.fast = false
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) return
      // Don't move camera when a prop is selected for movement, being dragged, or long-press pending
      if (getIsPropBeingMoved() || getIsPropBeingDragged() || getIsLongPressPending()) return
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    _wasdKeys.forward = true; break
        case 'KeyS': case 'ArrowDown':  _wasdKeys.backward = true; break
        case 'KeyA': case 'ArrowLeft':  _wasdKeys.left = true; break
        case 'KeyD': case 'ArrowRight': _wasdKeys.right = true; break
        case 'KeyQ':                    _wasdKeys.rotateLeft = true; break
        case 'KeyE':                    _wasdKeys.rotateRight = true; break
        case 'ShiftLeft': case 'ShiftRight': _wasdKeys.fast = true; break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    _wasdKeys.forward = false; break
        case 'KeyS': case 'ArrowDown':  _wasdKeys.backward = false; break
        case 'KeyA': case 'ArrowLeft':  _wasdKeys.left = false; break
        case 'KeyD': case 'ArrowRight': _wasdKeys.right = false; break
        case 'KeyQ':                    _wasdKeys.rotateLeft = false; break
        case 'KeyE':                    _wasdKeys.rotateRight = false; break
        case 'ShiftLeft': case 'ShiftRight': _wasdKeys.fast = false; break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      _wasdKeys.forward = false
      _wasdKeys.backward = false
      _wasdKeys.left = false
      _wasdKeys.right = false
      _wasdKeys.rotateLeft = false
      _wasdKeys.rotateRight = false
      _wasdKeys.fast = false
    }
  }, [wasdEnabled])

  // ─── Transition on focus change ──────────────────────────────

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    // Disable orbital controls in first person mode
    // IMPORTANT: CameraControls.update() unconditionally sets camera.position
    // and camera.lookAt every frame, even when enabled=false. We must patch
    // update() to a no-op to prevent it from overriding PointerLockControls.
    if (state.level === 'firstperson') {
      controls.enabled = false
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(controls as any).__originalUpdate = controls.update
      controls.update = () => false
      prevLevelRef.current = state.level
      return
    }

    // Re-enable when exiting first person
    if ((prevLevelRef.current as string) === 'firstperson') {
      // Restore the original update method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orig = (controls as any).__originalUpdate
      if (orig) {
        controls.update = orig
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (controls as any).__originalUpdate
      }
      // Sync CameraControls internal state from actual camera position
      // (camera was moved by FirstPersonController). This ensures the
      // exit-transition animates FROM the FP position, not the old orbital pos.
      const cam = controls.camera
      const lookDir = new THREE.Vector3()
      cam.getWorldDirection(lookDir)
      const target = lookDir.multiplyScalar(5).add(cam.position.clone())
      controls.setLookAt(
        cam.position.x, cam.position.y, cam.position.z,
        target.x, target.y, target.z,
        false, // instant — update both current and end
      )
      controls.enabled = true
    }

    // Skip if nothing changed
    if (
      state.level === prevLevelRef.current &&
      state.focusedRoomId === prevRoomIdRef.current &&
      state.focusedBotKey === prevBotKeyRef.current
    ) {
      return
    }

    // On initial mount, skip transition animation — jump to position instantly
    const enableTransition = !isInitialMount.current
    if (isInitialMount.current) {
      isInitialMount.current = false
    }

    prevLevelRef.current = state.level
    prevRoomIdRef.current = state.focusedRoomId
    prevBotKeyRef.current = state.focusedBotKey

    // Apply constraints + interaction config for the new level
    applyConstraints(controls, state.level)

    if (state.level === 'overview') {
      isFollowing.current = false
      const c = OVERVIEW_CAMERA
      controls.setLookAt(c.posX, c.posY, c.posZ, c.targetX, c.targetY, c.targetZ, enableTransition)
    } else if (state.level === 'room' && state.focusedRoomId) {
      isFollowing.current = false
      const roomEntry = roomPositions.find(rp => rp.roomId === state.focusedRoomId)
      if (roomEntry) {
        const c = getRoomCamera(roomEntry.position)
        controls.setLookAt(c.posX, c.posY, c.posZ, c.targetX, c.targetY, c.targetZ, enableTransition)
      }
    } else if (state.level === 'board' && state.focusedRoomId) {
      isFollowing.current = false
      const roomEntry = roomPositions.find(rp => rp.roomId === state.focusedRoomId)
      if (roomEntry) {
        const c = getBoardCamera(roomEntry.position)
        controls.setLookAt(c.posX, c.posY, c.posZ, c.targetX, c.targetY, c.targetZ, enableTransition)
      }
    } else if (state.level === 'bot' && state.focusedBotKey) {
      // Fly-to the bot's orbital position, preserving current camera azimuth
      const botPos = botPositionRegistry.get(state.focusedBotKey)
      if (botPos) {
        // Get current azimuth to preserve viewing angle
        const currentAzimuth = controls.azimuthAngle
        const distance = 7 // orbital distance from bot
        const height = BOT_CAM_OFFSET.y
        
        // Calculate camera position using current azimuth (no 180° flip)
        const camX = botPos.x + Math.sin(currentAzimuth) * distance
        const camZ = botPos.z + Math.cos(currentAzimuth) * distance
        
        controls.setLookAt(camX, height, camZ, botPos.x, 0.5, botPos.z, true)
        followTarget.current.set(botPos.x, 0.5, botPos.z)
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

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls) return

    // ─── WASD movement (overview + room) ──────────────────────
    if (wasdEnabled) {
      // Build desired velocity from key state
      const targetVel = new THREE.Vector3()
      const speed = _wasdKeys.fast ? WASD_SPEED * WASD_FAST_MULT : WASD_SPEED

      if (_wasdKeys.forward)  targetVel.z -= speed
      if (_wasdKeys.backward) targetVel.z += speed
      if (_wasdKeys.left)     targetVel.x -= speed
      if (_wasdKeys.right)    targetVel.x += speed

      // Smooth velocity (lerp toward target)
      wasdVelocity.current.lerp(targetVel, WASD_SMOOTHING)

      // Zero out tiny residual velocity
      if (wasdVelocity.current.lengthSq() < 0.001) {
        wasdVelocity.current.set(0, 0, 0)
      }

      // Apply truck (strafe left/right) and forward (in/out) relative to camera orientation
      if (wasdVelocity.current.lengthSq() > 0) {
        const dt = Math.min(delta, 0.05) // cap to avoid jumps on tab refocus
        controls.truck(wasdVelocity.current.x * dt, 0, false)
        controls.forward(-wasdVelocity.current.z * dt, false)
      }

      // Q/E rotation
      let targetRot = 0
      if (_wasdKeys.rotateLeft)  targetRot += WASD_ROTATE_SPEED
      if (_wasdKeys.rotateRight) targetRot -= WASD_ROTATE_SPEED
      wasdRotVelocity.current += (targetRot - wasdRotVelocity.current) * WASD_SMOOTHING
      if (Math.abs(wasdRotVelocity.current) < 0.001) wasdRotVelocity.current = 0
      if (wasdRotVelocity.current !== 0) {
        const dt = Math.min(delta, 0.05)
        controls.rotate(wasdRotVelocity.current * dt, 0, false)
      }
    }

    // ─── Bot orbital follow ───────────────────────────────────
    if (!isFollowing.current || state.level !== 'bot' || !state.focusedBotKey) return

    const botPos = botPositionRegistry.get(state.focusedBotKey)
    if (!botPos) return

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
