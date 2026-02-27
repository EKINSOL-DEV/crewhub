import { describe, it, expect, vi, afterEach } from 'vitest'
import { tickAnimState } from '@/components/world3d/botAnimTick'
import type { AnimState } from '@/components/world3d/BotAnimations'

function baseState(): AnimState {
  return {
    phase: 'idle-wandering',
    targetX: 1,
    targetZ: 2,
    walkSpeed: 1,
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
    isActiveWalking: false,
    typingPause: false,
    typingPauseTimer: 0,
    nextTypingPauseTimer: 0,
  }
}

afterEach(() => vi.restoreAllMocks())

describe('botAnimTick', () => {
  it('transitions from getting-coffee to idle-wandering when timer ends', () => {
    const s = baseState()
    s.phase = 'getting-coffee'
    s.arrived = true
    s.coffeeTimer = 0.1

    tickAnimState(s, 0.2)

    expect(s.phase).toBe('idle-wandering')
    expect(s.targetX).toBeNull()
    expect(s.targetZ).toBeNull()
    expect(s.arrived).toBe(false)
    expect(s.resetWanderTarget).toBe(true)
  })

  it('transitions from sleeping-walking to sleeping when arrived', () => {
    const s = baseState()
    s.phase = 'sleeping-walking'
    s.arrived = true

    tickAnimState(s, 0.1)

    expect(s.phase).toBe('sleeping')
    expect(s.showZzz).toBe(true)
    expect(s.walkSpeed).toBe(0)
    expect(s.yOffset).toBe(-0.1)
  })

  it('toggles typing pause off when pause timer elapses', () => {
    const s = baseState()
    s.isActiveWalking = true
    s.typingPause = true
    s.typingPauseTimer = 0.1

    tickAnimState(s, 0.2)

    expect(s.typingPause).toBe(false)
    expect(s.bodyTilt).toBe(0)
    expect(s.nextTypingPauseTimer).toBeGreaterThanOrEqual(5)
  })

  it('starts typing pause when nextTypingPauseTimer reaches zero', () => {
    const s = baseState()
    s.isActiveWalking = true
    s.nextTypingPauseTimer = 0.1
    vi.spyOn(Math, 'random').mockReturnValue(0)

    tickAnimState(s, 0.2)

    expect(s.typingPause).toBe(true)
    expect(s.typingPauseTimer).toBe(1)
    expect(s.bodyTilt).toBe(0.04)
  })
})
