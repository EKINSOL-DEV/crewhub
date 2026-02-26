import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SESSION_CONFIG } from '@/lib/sessionConfig'
import type { BotStatus } from './botConstants'
import type { RoomBounds } from './World3DView'

// ─── Types ──────────────────────────────────────────────────────

export type BotAnimState =
  | typeof IDLE_WANDERING
  | typeof GETTING_COFFEE
  | typeof SLEEPING_WALKING
  | 'sleeping'
  | 'offline'

export interface AnimState {
  phase: BotAnimState
  targetX: number | null // world-space target X (null = random wander)
  targetZ: number | null // world-space target Z
  walkSpeed: number
  freezeWhenArrived: boolean // stop moving after reaching target
  arrived: boolean // set by Bot3D when close to target
  bodyTilt: number // radians, positive = forward lean
  headBob: boolean // enable subtle work bobbing
  opacity: number // 1 = normal, 0.4 = offline fade
  yOffset: number // vertical shift (sleeping crouch)
  showZzz: boolean // render ZZZ particles
  sleepRotZ: number // sideways lean when sleeping
  coffeeTimer: number // seconds remaining at coffee machine
  resetWanderTarget: boolean // signal Bot3D to pick new random target

  // ── Active walking (laptop) state ──
  isActiveWalking: boolean // true when bot is walking with laptop (active status)
  typingPause: boolean // bot is paused briefly as if "typing"
  typingPauseTimer: number // remaining seconds of current typing pause
  nextTypingPauseTimer: number // seconds until next typing pause
}

// RoomInteractionPoints & WalkableCenter extracted to ./roomInteractionPoints.ts
import type { RoomInteractionPoints, WalkableCenter } from './roomInteractionPoints'

const GETTING_COFFEE = 'getting-coffee'
const IDLE_WANDERING = 'idle-wandering'
const SLEEPING_WALKING = 'sleeping-walking'

export type { RoomInteractionPoints, WalkableCenter } // NOSONAR

// ─── Animation State Machine Hook ───────────────────────────────

function createDefaultAnimState(): AnimState {
  return {
    phase: IDLE_WANDERING,
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
  _roomBounds: RoomBounds | undefined
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
      idle: [IDLE_WANDERING, GETTING_COFFEE],
      sleeping: [SLEEPING_WALKING, 'sleeping'],
      offline: ['offline'],
    }
    const compatible = phaseCompatible[status] || []

    // Special handling: if already actively walking with laptop and staying active, skip reset
    if (status === 'active' && s.isActiveWalking && s.phase === IDLE_WANDERING) {
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
        s.phase = IDLE_WANDERING
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
          s.phase = GETTING_COFFEE
          s.targetX = interactionPoints.coffeePosition[0] + j.x * 0.5
          s.targetZ = interactionPoints.coffeePosition[2] + j.z * 0.5
          s.walkSpeed = SESSION_CONFIG.botWalkSpeedCoffee
          s.freezeWhenArrived = true
          s.arrived = false
          s.coffeeTimer =
            SESSION_CONFIG.coffeeMinTimeS +
            Math.random() * (SESSION_CONFIG.coffeeMaxTimeS - SESSION_CONFIG.coffeeMinTimeS)
        } else {
          s.phase = IDLE_WANDERING
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
          s.phase = SLEEPING_WALKING
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

// tickAnimState extracted to ./botAnimTick.ts for HMR compatibility

// ─── Sleeping ZZZ Particles ─────────────────────────────────────

/**
 * Lightweight ZZZ particles using sprite planes instead of Troika <Text>.
 * Accepts animRef to control visibility: only shows when bot has actually
 * arrived at sleep corner (showZzz === true), not during walking-to-sleep.
 */
export function SleepingZs({ animRef }: Readonly<{ animRef: React.MutableRefObject<AnimState> }>) {
  const groupRef = useRef<THREE.Group>(null)
  const spriteRefs = useRef<THREE.Sprite[]>([])

  // Create shared material instances (one per Z for independent opacity)
  const materials = useRef(
    [0, 1, 2].map(
      () =>
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
      {[0, 1, 2].map((i) => (
        <sprite
          key={`item-${i}`}
          ref={(el: THREE.Sprite | null) => {
            if (el) spriteRefs.current[i] = el
          }}
          material={materials[i]}
        />
      ))}
    </group>
  )
}
