import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getBlueprintForRoom, gridToWorld, findInteractionCells } from '@/lib/grid'
import { SESSION_CONFIG } from '@/lib/sessionConfig'
import type { BotStatus } from './Bot3D'

// ─── Types ──────────────────────────────────────────────────────

export type BotAnimState =
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

  // ── Active walking (laptop) state ──
  isActiveWalking: boolean     // true when bot is walking with laptop (active status)
  typingPause: boolean         // bot is paused briefly as if "typing"
  typingPauseTimer: number     // remaining seconds of current typing pause
  nextTypingPauseTimer: number // seconds until next typing pause
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

// ─── Room Interaction Points (Grid-Based) ───────────────────────

/**
 * Get world-space positions for room furniture that bots interact with.
 * Uses grid blueprint interaction points instead of hardcoded positions.
 *
 * Note: deskPosition is kept for reference but bots no longer pathfind to desks.
 * Coffee and sleep positions are still used.
 */
export function getRoomInteractionPoints(
  roomName: string,
  _roomSize: number,
  roomPosition: [number, number, number],
): RoomInteractionPoints {
  const rx = roomPosition[0]
  const rz = roomPosition[2]
  const blueprint = getBlueprintForRoom(roomName)
  const { cells, cellSize, gridWidth, gridDepth } = blueprint

  // Get interaction cells from grid
  const workCells = findInteractionCells(cells, 'work')
  const coffeeCells = findInteractionCells(cells, 'coffee')
  const sleepCells = findInteractionCells(cells, 'sleep')

  // Convert first found cell of each type to world coords
  const toWorld = (cell: { x: number; z: number }): [number, number, number] => {
    const [relX, , relZ] = gridToWorld(cell.x, cell.z, cellSize, gridWidth, gridDepth)
    return [rx + relX, 0, rz + relZ]
  }

  // Fallback: use walkable center for desk, and a corner for sleep
  const fallbackDesk: [number, number, number] = (() => {
    const [relX, , relZ] = gridToWorld(
      blueprint.walkableCenter.x,
      blueprint.walkableCenter.z,
      cellSize, gridWidth, gridDepth,
    )
    return [rx + relX, 0, rz + relZ]
  })()

  const fallbackSleep: [number, number, number] = (() => {
    const [relX, , relZ] = gridToWorld(17, 17, cellSize, gridWidth, gridDepth)
    return [rx + relX, 0, rz + relZ]
  })()

  return {
    deskPosition: workCells.length > 0 ? toWorld(workCells[0]) : fallbackDesk,
    coffeePosition: coffeeCells.length > 0 ? toWorld(coffeeCells[0]) : null,
    sleepCorner: sleepCells.length > 0 ? toWorld(sleepCells[0]) : fallbackSleep,
  }
}

// ─── Walkable Zone (Grid-Based) ─────────────────────────────────

export interface WalkableCenter {
  x: number
  z: number
  radius: number
}

/**
 * Returns a safe circular walkable area in the center of each room.
 * Uses the grid blueprint's walkableCenter + computed radius from walkable cells.
 */
export function getWalkableCenter(
  roomName: string,
  roomSize: number,
  roomPosition: [number, number, number],
): WalkableCenter {
  const rx = roomPosition[0]
  const rz = roomPosition[2]
  const blueprint = getBlueprintForRoom(roomName)
  const { cellSize, gridWidth, gridDepth } = blueprint

  // Convert blueprint walkable center from grid to world coords
  const [relX, , relZ] = gridToWorld(
    blueprint.walkableCenter.x,
    blueprint.walkableCenter.z,
    cellSize, gridWidth, gridDepth,
  )

  // Default radius: ~35% of half-room-size (same as before)
  const defaultRadius = roomSize * 0.17

  return {
    x: rx + relX,
    z: rz + relZ,
    radius: defaultRadius,
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
    // Active walking (laptop)
    isActiveWalking: false,
    typingPause: false,
    typingPauseTimer: 0,
    nextTypingPauseTimer: 0,
  }
}

/**
 * Manages bot animation state based on status.
 * Returns a mutable ref read by Bot3D's useFrame for zero-overhead integration.
 *
 * State transitions:
 *   active  → idle-wandering (with laptop, typing pauses)
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
    x: (Math.random() - 0.5) * 0.3,
    z: (Math.random() - 0.5) * 0.3,
  })

  // Track previous status to avoid unnecessary resets
  const prevStatusRef = useRef<string>(status)

  // ─── React to status changes ────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    const j = jitter.current
    prevStatusRef.current = status

    // Check if current animation phase is already compatible with the new status.
    // If so, skip the reset entirely — prevents jitter from status flickering.
    const phaseCompatible: Record<string, string[]> = {
      active: [], // Always reinitialize for active (need typing pause setup)
      idle: ['idle-wandering', 'getting-coffee'],
      sleeping: ['sleeping-walking', 'sleeping'],
      offline: ['offline'],
    }
    const compatible = phaseCompatible[status] || []

    // Special handling: if already actively walking with laptop and staying active, skip reset
    if (status === 'active' && s.isActiveWalking && s.phase === 'idle-wandering') {
      return
    }

    // Special handling: active→idle transition needs speed/flag update even if phase matches
    if (status === 'idle' && s.isActiveWalking) {
      s.isActiveWalking = false
      s.typingPause = false
      s.typingPauseTimer = 0
      s.nextTypingPauseTimer = 0
      s.bodyTilt = 0
      s.walkSpeed = SESSION_CONFIG.botWalkSpeedIdle
      // Phase is already idle-wandering, so no need to reset everything else
      return
    }

    if (compatible.includes(s.phase)) {
      return
    }

    switch (status) {
      case 'active': {
        // Active bots wander around the room WITH a laptop (no desk targeting)
        s.phase = 'idle-wandering'
        s.targetX = null
        s.targetZ = null
        s.walkSpeed = 0.5 // moderate walk speed — purposeful but relaxed
        s.freezeWhenArrived = false
        s.arrived = false
        s.resetWanderTarget = true
        s.bodyTilt = 0
        s.headBob = false
        s.opacity = 1
        s.yOffset = 0
        s.showZzz = false
        s.sleepRotZ = 0
        s.coffeeTimer = 0
        // Typing pause setup
        s.isActiveWalking = true
        s.typingPause = false
        s.typingPauseTimer = 0
        s.nextTypingPauseTimer = 5 + Math.random() * 10 // first pause in 5-15s
        break
      }

      case 'idle': {
        const hasCoffee = interactionPoints?.coffeePosition != null
        const goCoffee = hasCoffee && Math.random() > 0.5

        if (goCoffee && interactionPoints?.coffeePosition) {
          s.phase = 'getting-coffee'
          s.targetX = interactionPoints.coffeePosition[0] + j.x * 0.5
          s.targetZ = interactionPoints.coffeePosition[2] + j.z * 0.5
          s.walkSpeed = SESSION_CONFIG.botWalkSpeedCoffee
          s.freezeWhenArrived = true
          s.arrived = false
          s.coffeeTimer = SESSION_CONFIG.coffeeMinTimeS + Math.random() * (SESSION_CONFIG.coffeeMaxTimeS - SESSION_CONFIG.coffeeMinTimeS)
        } else {
          s.phase = 'idle-wandering'
          s.targetX = null
          s.targetZ = null
          s.walkSpeed = SESSION_CONFIG.botWalkSpeedIdle
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
        // Clear active walking state
        s.isActiveWalking = false
        s.typingPause = false
        s.typingPauseTimer = 0
        s.nextTypingPauseTimer = 0
        break
      }

      case 'sleeping': {
        if (interactionPoints) {
          s.phase = 'sleeping-walking'
          s.targetX = interactionPoints.sleepCorner[0] + j.x * 0.3
          s.targetZ = interactionPoints.sleepCorner[2] + j.z * 0.3
          s.walkSpeed = SESSION_CONFIG.botWalkSpeedSleepWalk
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
        // Clear active walking state
        s.isActiveWalking = false
        s.typingPause = false
        s.typingPauseTimer = 0
        s.nextTypingPauseTimer = 0
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
        // Clear active walking state
        s.isActiveWalking = false
        s.typingPause = false
        s.typingPauseTimer = 0
        s.nextTypingPauseTimer = 0
        break
      }
    }
  }, [status, interactionPoints])

  return stateRef
}

// ─── Per-frame animation state transitions ──────────────────────
// Called from Bot3D's single useFrame to avoid extra callbacks.

export function tickAnimState(s: AnimState, delta: number): void {
  switch (s.phase) {
    case 'getting-coffee': {
      if (s.arrived) {
        s.coffeeTimer -= delta
        if (s.coffeeTimer <= 0) {
          s.phase = 'idle-wandering'
          s.targetX = null
          s.targetZ = null
          s.walkSpeed = SESSION_CONFIG.botWalkSpeedIdle
          s.freezeWhenArrived = false
          s.arrived = false
          s.resetWanderTarget = true
        }
      }
      break
    }

    case 'sleeping-walking': {
      if (s.arrived) {
        s.phase = 'sleeping'
        s.yOffset = -0.1
        s.showZzz = true
        s.sleepRotZ = 0.12
        s.bodyTilt = -0.08
        s.walkSpeed = 0
      }
      break
    }
  }

  // ─── Typing pause management (active walking bots with laptop) ──
  if (s.isActiveWalking && s.phase === 'idle-wandering') {
    if (s.typingPause) {
      // Currently paused — count down pause duration
      s.typingPauseTimer -= delta
      if (s.typingPauseTimer <= 0) {
        // Resume walking
        s.typingPause = false
        s.bodyTilt = 0
        s.nextTypingPauseTimer = 5 + Math.random() * 10 // next pause in 5-15s
      }
    } else {
      // Walking — count down to next pause
      s.nextTypingPauseTimer -= delta
      if (s.nextTypingPauseTimer <= 0) {
        // Start a typing pause
        s.typingPause = true
        s.typingPauseTimer = 1.0 + Math.random() * 1.0 // pause for 1-2s
        s.bodyTilt = 0.04 // slight forward lean (looking at laptop)
      }
    }
  }
}

// ─── Sleeping ZZZ Particles ─────────────────────────────────────

/**
 * Lightweight ZZZ particles using sprite planes instead of Troika <Text>.
 * Accepts animRef to control visibility: only shows when bot has actually
 * arrived at sleep corner (showZzz === true), not during walking-to-sleep.
 */
export function SleepingZs({ animRef }: { animRef: React.MutableRefObject<AnimState> }) {
  const groupRef = useRef<THREE.Group>(null)
  const spriteRefs = useRef<THREE.Sprite[]>([])

  // Create shared material instances (one per Z for independent opacity)
  const materials = useRef(
    [0, 1, 2].map(() =>
      new THREE.SpriteMaterial({
        color: 0x9ca3af,
        transparent: true,
        opacity: 0.8,
      })
    )
  ).current

  useFrame(({ clock }) => {
    if (!groupRef.current) return

    // Only show when the animation state says so (arrived at sleep corner)
    const show = animRef.current.showZzz
    groupRef.current.visible = show
    if (!show) return

    const t = clock.getElapsedTime()
    spriteRefs.current.forEach((sprite, i) => {
      if (!sprite) return
      const phase = (t * 0.6 + i * 1.2) % 3
      sprite.position.y = 0.7 + phase * 0.25
      sprite.position.x = Math.sin(t + i) * 0.12
      const opacity = phase < 2.5 ? 0.8 : Math.max(0, 0.8 - (phase - 2.5) * 1.6)
      const s = 0.1 * (0.5 + phase * 0.12)
      sprite.scale.set(s, s, 1)
      materials[i].opacity = opacity
    })
  })

  return (
    <group ref={groupRef}>
      {[0, 1, 2].map(i => (
        <sprite
          key={i}
          ref={(el: THREE.Sprite | null) => { if (el) spriteRefs.current[i] = el }}
          material={materials[i]}
        />
      ))}
    </group>
  )
}
