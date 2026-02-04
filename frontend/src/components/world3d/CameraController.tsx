import { useEffect, useRef, useState, useCallback } from 'react'
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

// ─── Overview Camera Presets ───────────────────────────────────

export interface CameraPreset {
  name: string
  icon: string
  /** Polar angle from Y axis (radians). Lower = more overhead. */
  polarAngle: number
  /** Azimuth angle around Y axis (radians). */
  azimuthAngle: number
  /** Camera distance from target. */
  distance: number
}

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    name: 'Isometric',
    icon: '🏗️',
    polarAngle: 1.0,           // ~57° from Y axis ≈ 33° elevation
    azimuthAngle: Math.PI / 4, // 45°
    distance: 75,
  },
  {
    name: 'Management Sim',
    icon: '🏛️',
    polarAngle: 0.55,          // ~31.5° from Y axis ≈ 58.5° elevation (more overhead)
    azimuthAngle: Math.PI / 4, // 45°
    distance: 90,              // Slightly further out to see more of the world
  },
]

// ─── Preset Store (module-level, persisted to localStorage) ────

const PRESET_STORAGE_KEY = 'crewhub-camera-preset'
const PRESET_CYCLE_EVENT = 'crewhub:camera-preset-cycle'

function loadPresetIndex(): number {
  try {
    const stored = localStorage.getItem(PRESET_STORAGE_KEY)
    if (stored !== null) {
      const idx = parseInt(stored, 10)
      if (idx >= 0 && idx < CAMERA_PRESETS.length) return idx
    }
  } catch { /* ignore */ }
  return 0
}

function savePresetIndex(index: number) {
  try { localStorage.setItem(PRESET_STORAGE_KEY, String(index)) } catch { /* ignore */ }
}

/** Get current preset index (for reading outside React) */
export function getCurrentPresetIndex(): number {
  return loadPresetIndex()
}

/** Get current preset (for reading outside React) */
export function getCurrentPreset(): CameraPreset {
  return CAMERA_PRESETS[loadPresetIndex()] || CAMERA_PRESETS[0]
}

/** Cycle to next preset — dispatches event for CameraController to handle */
export function cyclePreset() {
  window.dispatchEvent(new CustomEvent(PRESET_CYCLE_EVENT))
}

// ─── Helpers ───────────────────────────────────────────────────

/** Convert a preset's spherical coordinates to a camera look-at position (target at origin). */
function presetToLookAt(preset: CameraPreset) {
  return {
    posX: preset.distance * Math.sin(preset.polarAngle) * Math.sin(preset.azimuthAngle),
    posY: preset.distance * Math.cos(preset.polarAngle),
    posZ: preset.distance * Math.sin(preset.polarAngle) * Math.cos(preset.azimuthAngle),
    targetX: 0,
    targetY: 0,
    targetZ: 0,
  }
}

// ─── Camera presets per focus level ────────────────────────────

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
  const { isDragging } = useDragState()
  const prevLevelRef = useRef<FocusLevel>('overview')
  const prevRoomIdRef = useRef<string | null>(null)
  const prevBotKeyRef = useRef<string | null>(null)

  // Lerp target for smooth orbital following (orbit center tracks bot)
  const followTarget = useRef(new THREE.Vector3())
  const isFollowing = useRef(false)

  // Smooth velocity for WASD movement
  const wasdVelocity = useRef(new THREE.Vector3())
  const wasdRotVelocity = useRef(0)

  // ─── Camera preset state (overview mode only) ─────────────────
  const [presetIndex, setPresetIndex] = useState(loadPresetIndex)

  // Helper to cycle and animate to next preset
  const doCyclePreset = useCallback(() => {
    const controls = controlsRef.current
    if (!controls || state.level !== 'overview') return

    const newIndex = (presetIndex + 1) % CAMERA_PRESETS.length
    setPresetIndex(newIndex)
    savePresetIndex(newIndex)

    const preset = CAMERA_PRESETS[newIndex]
    if (preset) {
      controls.rotateTo(preset.azimuthAngle, preset.polarAngle, true)
      controls.dollyTo(preset.distance, true)
    }
  }, [presetIndex, state.level])

  // ─── Listen for preset cycle events (from WorldNavigation button) ─

  useEffect(() => {
    const handleCycleEvent = () => doCyclePreset()
    window.addEventListener(PRESET_CYCLE_EVENT, handleCycleEvent)
    return () => window.removeEventListener(PRESET_CYCLE_EVENT, handleCycleEvent)
  }, [doCyclePreset])

  // ─── 'C' key: cycle camera presets (overview only) ────────────

  useEffect(() => {
    if (state.level !== 'overview') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) return
      if (e.code === 'KeyC') {
        doCyclePreset()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.level, doCyclePreset])

  // ─── Disable camera controls during drag ──────────────────────

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    controls.enabled = !isDragging
  }, [isDragging])

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
    if (state.level === 'firstperson') {
      controls.enabled = false
      prevLevelRef.current = state.level
      return
    }

    // Re-enable when exiting first person
    if ((prevLevelRef.current as string) === 'firstperson') {
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

    prevLevelRef.current = state.level
    prevRoomIdRef.current = state.focusedRoomId
    prevBotKeyRef.current = state.focusedBotKey

    // Apply constraints + interaction config for the new level
    applyConstraints(controls, state.level)

    if (state.level === 'overview') {
      isFollowing.current = false
      const preset = CAMERA_PRESETS[presetIndex] || CAMERA_PRESETS[0]
      const c = presetToLookAt(preset)
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
  }, [state.level, state.focusedRoomId, state.focusedBotKey, roomPositions, presetIndex])

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
