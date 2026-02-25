// ─── Per-frame animation state transitions ──────────────────────
// Extracted from BotAnimations.tsx for Vite HMR compatibility.
// Called from Bot3D's single useFrame to avoid extra callbacks.

import { SESSION_CONFIG } from '@/lib/sessionConfig'
import type { AnimState } from './BotAnimations'

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
        s.typingPauseTimer = 1 + Math.random() * 1 // pause for 1-2s
        s.bodyTilt = 0.04 // slight forward lean (looking at laptop)
      }
    }
  }
}
