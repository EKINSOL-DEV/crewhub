import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import type { BotStatus } from './Bot3D'

// ─── Types ──────────────────────────────────────────────────────

export type BotAnimState =
  | 'walking-to-desk'
  | 'working'
  | 'idle-wandering'
  | 'getting-coffee'
  | 'sleeping-walking'
  | 'sleeping'
  | 'offline'

export interface AnimState {
  phase: BotAnimState
  targetX: number | null       // world-space target X (null = random wander)
  targetZ: number | null       // world-space target Z
  walkSpeed: number
  freezeWhenArrived: boolean   // stop moving after reaching target
  arrived: boolean             // set by Bot3D when close to target
  bodyTilt: number             // radians, positive = forward lean
  headBob: boolean             // enable subtle work bobbing
  opacity: number              // 1 = normal, 0.4 = offline fade
  yOffset: number              // vertical shift (sleeping crouch)
  showZzz: boolean             // render ZZZ particles
  sleepRotZ: number            // sideways lean when sleeping
  coffeeTimer: number          // seconds remaining at coffee machine
  resetWanderTarget: boolean   // signal Bot3D to pick new random target
}

export interface RoomInteractionPoints {
  deskPosition: [number, number, number]
  coffeePosition: [number, number, number] | null
  sleepCorner: [number, number, number]
}

// Locally-defined bounds type (avoids circular import from World3DView)
interface RoomBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

// ─── Room Interaction Points ────────────────────────────────────

function getRoomType(roomName: string): string {
  const name = roomName.toLowerCase()
  if (name.includes('headquarter')) return 'headquarters'
  if (name.includes('dev')) return 'dev'
  if (name.includes('creative') || name.includes('design')) return 'creative'
  if (name.includes('marketing')) return 'marketing'
  if (name.includes('thinking') || name.includes('strategy')) return 'thinking'
  if (name.includes('automation') || name.includes('cron')) return 'automation'
  if (name.includes('comms') || name.includes('comm')) return 'comms'
  if (name.includes('ops') || name.includes('operation')) return 'ops'
  return 'default'
}

/**
 * Get world-space positions for room furniture that bots interact with.
 * Positions are approximate — near the relevant props placed by RoomProps.tsx.
 */
export function getRoomInteractionPoints(
  roomName: string,
  roomSize: number,
  roomPosition: [number, number, number],
): RoomInteractionPoints {
  const h = roomSize / 2
  const s = roomSize / 12 // scale factor matching RoomProps
  const rx = roomPosition[0]
  const rz = roomPosition[2]
  const roomType = getRoomType(roomName)

  switch (roomType) {
    case 'headquarters':
      return {
        deskPosition: [rx + (-h + 3 * s), 0, rz + (h - 3 * s)],
        coffeePosition: [rx + (h - 1.5 * s), 0, rz + (-h + 2.5 * s)],
        sleepCorner: [rx + (h - 2 * s), 0, rz + (h - 2 * s)],
      }
    case 'dev':
      return {
        deskPosition: [rx + (-h + 3 * s), 0, rz + (h - 3 * s)],
        coffeePosition: null,
        sleepCorner: [rx + (h - 2 * s), 0, rz + (-h + 2 * s)],
      }
    case 'creative':
      return {
        deskPosition: [rx + (h - 2.5 * s), 0, rz + (h - 3 * s)],
        coffeePosition: null,
        sleepCorner: [rx + (-h + 2 * s), 0, rz + (-h + 2 * s)],
      }
    case 'marketing':
      return {
        deskPosition: [rx + (-h + 3 * s), 0, rz + (h - 3 * s)],
        coffeePosition: null,
        sleepCorner: [rx + (h - 2 * s), 0, rz + (-h + 2 * s)],
      }
    case 'thinking':
      return {
        deskPosition: [rx, 0, rz],
        coffeePosition: null,
        sleepCorner: [rx + (-h + 2 * s), 0, rz + (-h + 2 * s)],
      }
    case 'automation':
      return {
        deskPosition: [rx + (-h + 2.5 * s), 0, rz + (-h + 2.5 * s)],
        coffeePosition: null,
        sleepCorner: [rx + (h - 2 * s), 0, rz + (h - 2 * s)],
      }
    case 'comms':
      return {
        deskPosition: [rx + (h - 3 * s), 0, rz + (-h + 3 * s)],
        coffeePosition: null,
        sleepCorner: [rx + (-h + 2 * s), 0, rz + (h - 2 * s)],
      }
    case 'ops':
      return {
        deskPosition: [rx, 0, rz],
        coffeePosition: null,
        sleepCorner: [rx + (-h + 2 * s), 0, rz + (h - 2 * s)],
      }
    default:
      return {
        deskPosition: [rx + (-h + 3 * s), 0, rz + (h - 3 * s)],
        coffeePosition: null,
        sleepCorner: [rx + (h - 2 * s), 0, rz + (-h + 2 * s)],
      }
  }
}

// ─── Animation State Machine Hook ───────────────────────────────

function createDefaultAnimState(): AnimState {
  return {
    phase: 'idle-wandering',
    targetX: null,
    targetZ: null,
    walkSpeed: 0.5,
    freezeWhenArrived: false,
    arrived: false,
    bodyTilt: 0,
    headBob: false,
    opacity: 1,
    yOffset: 0,
    showZzz: false,
    sleepRotZ: 0,
    coffeeTimer: 0,
    resetWanderTarget: false,
  }
}

/**
 * Manages bot animation state based on status.
 * Returns a mutable ref read by Bot3D's useFrame for zero-overhead integration.
 *
 * State transitions:
 *   active  → walking-to-desk → working (tilt, head bob)
 *   idle    → getting-coffee (if available, 50%) | idle-wandering (slow)
 *   sleeping → sleeping-walking → sleeping (crouch, ZZZ)
 *   offline → frozen, faded
 */
export function useBotAnimation(
  status: BotStatus,
  interactionPoints: RoomInteractionPoints | null,
  _roomBounds: RoomBounds | undefined,
): React.MutableRefObject<AnimState> {
  const stateRef = useRef<AnimState>(createDefaultAnimState())

  // Per-bot random offsets so multiple bots don't stack on the same furniture
  const jitter = useRef({
    x: (Math.random() - 0.5) * 0.8,
    z: (Math.random() - 0.5) * 0.8,
  })

  // ─── React to status changes ────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    const j = jitter.current

    switch (status) {
      case 'active': {
        if (interactionPoints) {
          s.phase = 'walking-to-desk'
          s.targetX = interactionPoints.deskPosition[0] + j.x
          s.targetZ = interactionPoints.deskPosition[2] + j.z
          s.walkSpeed = 1.2
          s.freezeWhenArrived = true
          s.arrived = false
        } else {
          s.phase = 'idle-wandering'
          s.targetX = null
          s.targetZ = null
          s.walkSpeed = 1.2
          s.freezeWhenArrived = false
          s.arrived = false
          s.resetWanderTarget = true
        }
        s.bodyTilt = 0
        s.headBob = false
        s.opacity = 1
        s.yOffset = 0
        s.showZzz = false
        s.sleepRotZ = 0
        s.coffeeTimer = 0
        break
      }

      case 'idle': {
        const hasCoffee = interactionPoints?.coffeePosition != null
        const goCoffee = hasCoffee && Math.random() > 0.5

        if (goCoffee && interactionPoints?.coffeePosition) {
          s.phase = 'getting-coffee'
          s.targetX = interactionPoints.coffeePosition[0] + j.x * 0.5
          s.targetZ = interactionPoints.coffeePosition[2] + j.z * 0.5
          s.walkSpeed = 0.6
          s.freezeWhenArrived = true
          s.arrived = false
          s.coffeeTimer = 5 + Math.random() * 5
        } else {
          s.phase = 'idle-wandering'
          s.targetX = null
          s.targetZ = null
          s.walkSpeed = 0.3
          s.freezeWhenArrived = false
          s.arrived = false
          s.resetWanderTarget = true
        }
        s.bodyTilt = 0
        s.headBob = false
        s.opacity = 1
        s.yOffset = 0
        s.showZzz = false
        s.sleepRotZ = 0
        break
      }

      case 'sleeping': {
        if (interactionPoints) {
          s.phase = 'sleeping-walking'
          s.targetX = interactionPoints.sleepCorner[0] + j.x * 0.3
          s.targetZ = interactionPoints.sleepCorner[2] + j.z * 0.3
          s.walkSpeed = 0.4
          s.freezeWhenArrived = true
          s.arrived = false
        } else {
          // No interaction points — sleep in place
          s.phase = 'sleeping'
          s.targetX = null
          s.targetZ = null
          s.walkSpeed = 0
          s.freezeWhenArrived = true
          s.arrived = true
          s.yOffset = -0.1
          s.showZzz = true
          s.sleepRotZ = 0.12
          s.bodyTilt = -0.08
        }
        s.headBob = false
        s.opacity = 1
        s.coffeeTimer = 0
        break
      }

      case 'offline': {
        s.phase = 'offline'
        s.targetX = null
        s.targetZ = null
        s.walkSpeed = 0
        s.freezeWhenArrived = true
        s.arrived = true
        s.bodyTilt = 0
        s.headBob = false
        s.opacity = 0.4
        s.yOffset = 0
        s.showZzz = false
        s.sleepRotZ = 0
        s.coffeeTimer = 0
        break
      }
    }
  }, [status, interactionPoints])

  // ─── Per-frame sub-state transitions ──────────────────────────
  useFrame((_, delta) => {
    const s = stateRef.current

    switch (s.phase) {
      case 'walking-to-desk': {
        if (s.arrived) {
          // Arrived at desk → start working
          s.phase = 'working'
          s.bodyTilt = 0.12  // ~7° forward lean
          s.headBob = true
          s.walkSpeed = 0
        }
        break
      }

      case 'getting-coffee': {
        if (s.arrived) {
          // Standing at coffee machine — count down
          s.coffeeTimer -= delta
          if (s.coffeeTimer <= 0) {
            // Coffee break done → start wandering
            s.phase = 'idle-wandering'
            s.targetX = null
            s.targetZ = null
            s.walkSpeed = 0.3
            s.freezeWhenArrived = false
            s.arrived = false
            s.resetWanderTarget = true
          }
        }
        break
      }

      case 'sleeping-walking': {
        if (s.arrived) {
          // Arrived at sleep corner → settle down
          s.phase = 'sleeping'
          s.yOffset = -0.1
          s.showZzz = true
          s.sleepRotZ = 0.12
          s.bodyTilt = -0.08  // lean back slightly
          s.walkSpeed = 0
        }
        break
      }

      // working, sleeping, idle-wandering, offline — no per-frame transitions
    }
  })

  return stateRef
}

// ─── Sleeping ZZZ Particles ─────────────────────────────────────

export function SleepingZs() {
  const zRefs = useRef<THREE.Group[]>([])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    zRefs.current.forEach((ref, i) => {
      if (!ref) return
      const phase = (t * 0.6 + i * 1.2) % 3
      ref.position.y = 0.7 + phase * 0.25
      ref.position.x = Math.sin(t + i) * 0.12
      const opacity = phase < 2.5 ? 0.8 : Math.max(0, 0.8 - (phase - 2.5) * 1.6)
      ref.scale.setScalar(0.5 + phase * 0.12)
      ref.children.forEach(child => {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial
        if (mat && mat.opacity !== undefined) mat.opacity = opacity
      })
    })
  })

  return (
    <group>
      {[0, 1, 2].map(i => (
        <group key={i} ref={el => { if (el) zRefs.current[i] = el }}>
          <Text
            fontSize={0.1}
            color="#9ca3af"
            anchorX="center"
            anchorY="middle"
            material-transparent
            material-opacity={0.8}
          >
            Z
          </Text>
        </group>
      ))}
    </group>
  )
}
