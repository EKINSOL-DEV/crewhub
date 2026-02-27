// ─── Per-frame animation state transitions ──────────────────────
// Extracted from BotAnimations.tsx for Vite HMR compatibility.
// Called from Bot3D's single useFrame to avoid extra callbacks.

import { SESSION_CONFIG } from '@/lib/sessionConfig'
import type { AnimState } from './BotAnimations'

function tickCoffeePhase(s: AnimState, delta: number): void {
  if (s.phase !== 'getting-coffee' || !s.arrived) return

  s.coffeeTimer -= delta
  if (s.coffeeTimer > 0) return

  s.phase = 'idle-wandering'
  s.targetX = null
  s.targetZ = null
  s.walkSpeed = SESSION_CONFIG.botWalkSpeedIdle
  s.freezeWhenArrived = false
  s.arrived = false
  s.resetWanderTarget = true
}

function tickSleepingWalkPhase(s: AnimState): void {
  if (s.phase !== 'sleeping-walking' || !s.arrived) return

  s.phase = 'sleeping'
  s.yOffset = -0.1
  s.showZzz = true
  s.sleepRotZ = 0.12
  s.bodyTilt = -0.08
  s.walkSpeed = 0
}

function tickTypingPause(s: AnimState, delta: number): void {
  if (!s.isActiveWalking || s.phase !== 'idle-wandering') return

  if (s.typingPause) {
    s.typingPauseTimer -= delta
    if (s.typingPauseTimer > 0) return

    s.typingPause = false
    s.bodyTilt = 0
    s.nextTypingPauseTimer = 5 + Math.random() * 10 // next pause in 5-15s
    return
  }

  s.nextTypingPauseTimer -= delta
  if (s.nextTypingPauseTimer > 0) return

  s.typingPause = true
  s.typingPauseTimer = 1 + Math.random() * 1 // pause for 1-2s
  s.bodyTilt = 0.04 // slight forward lean (looking at laptop)
}

export function tickAnimState(s: AnimState, delta: number): void {
  tickCoffeePhase(s, delta)
  tickSleepingWalkPhase(s)
  tickTypingPause(s, delta)
}
