/* eslint-disable react-refresh/only-export-components */
import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SESSION_CONFIG } from '@/lib/sessionConfig'
import type { BotStatus } from './botConstants'
import type { RoomBounds } from './World3DView'

// ─── Types ──────────────────────────────────────────────────────

export type BotAnimState = typeof IDLE_WANDERING | 'sleeping' | 'offline'

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

// WalkableCenter extracted to ./roomInteractionPoints.ts
import type { WalkableCenter } from './roomInteractionPoints'

const IDLE_WANDERING = 'idle-wandering'

export type { WalkableCenter } // NOSONAR

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
 *   idle    → idle-wandering (slow random wander)
 *   sleeping → sleeping (crouch in place, ZZZ)
 *   offline → frozen, faded
 */
export function useBotAnimation(
  status: BotStatus,
  _roomBounds: RoomBounds | undefined
): React.MutableRefObject<AnimState> {
  const stateRef = useRef<AnimState>(createDefaultAnimState())

  // Track previous status to avoid unnecessary resets
  const prevStatusRef = useRef<string>(status)

  // ─── React to status changes ────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    prevStatusRef.current = status

    // Check if current animation phase is already compatible with the new status.
    // If so, skip the reset entirely — prevents jitter from status flickering.
    const phaseCompatible: Record<string, string[]> = {
      active: [], // Always reinitialize for active (need typing pause setup)
      idle: [IDLE_WANDERING],
      sleeping: ['sleeping'],
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
        s.phase = IDLE_WANDERING
        s.targetX = null
        s.targetZ = null
        s.walkSpeed = SESSION_CONFIG.botWalkSpeedIdle
        s.freezeWhenArrived = false
        s.arrived = false
        s.resetWanderTarget = true
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
        // Sleep in place — no walking to a sleep corner
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
  }, [status])

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
