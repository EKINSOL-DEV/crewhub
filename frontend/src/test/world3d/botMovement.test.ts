/* eslint-disable @typescript-eslint/no-explicit-any, sonarjs/no-duplicate-string */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import {
  smoothRotateY,
  calculateBounceY,
  applyOpacity,
  updatePositionRegistry,
  handleMeetingMovement,
  isWalkableAt,
  pickWalkableDir,
  handleNoGridWander,
  handleAnimTargetWalk,
  handleRandomGridWalk,
} from '@/components/world3d/botMovement'
import { meetingGatheringState } from '@/lib/meetingStore'
import { botPositionRegistry } from '@/components/world3d/botConstants'

const roomBounds = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 }
const gridData = {
  blueprint: { cellSize: 1, gridWidth: 10, gridDepth: 10 },
  botWalkableMask: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => true)),
}

beforeEach(() => {
  meetingGatheringState.active = false
  meetingGatheringState.positions.clear()
  meetingGatheringState.agentRooms.clear()
  meetingGatheringState.roomPositions.clear()
  botPositionRegistry.clear()
})
afterEach(() => vi.restoreAllMocks())

describe('botMovement utilities', () => {
  it('smoothly rotates and snaps at tiny angle diff', () => {
    const g = new THREE.Group()
    g.rotation.y = Math.PI - 0.01
    smoothRotateY(g, -Math.PI + 0.02, 0.5)
    expect(g.rotation.y).toBeGreaterThan(Math.PI - 0.01)

    g.rotation.y = 0.005
    smoothRotateY(g, 0.0)
    expect(g.rotation.y).toBe(0)
  })

  it('calculates bounce per phase', () => {
    expect(calculateBounceY('getting-coffee', true, false, false, 1)).not.toBe(0)
    expect(calculateBounceY('idle-wandering', true, true, true, 1)).not.toBe(0)
    expect(calculateBounceY('offline', true, false, false, 1)).toBe(0)
  })

  it('applies opacity and clones materials once', () => {
    const g = new THREE.Group()
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshBasicMaterial({ opacity: 1 })
    )
    g.add(mesh)
    const clonable = { current: false }

    applyOpacity(g, 0.4, clonable)
    expect((mesh.material as THREE.Material).opacity).toBe(0.4)
    expect((mesh.material as THREE.Material).transparent).toBe(true)
    expect(clonable.current).toBe(true)
  })

  it('updates position registry only when session key exists', () => {
    updatePositionRegistry('s1', 1, 2, 3)
    updatePositionRegistry(undefined, 9, 9, 9)
    expect(botPositionRegistry.get('s1')).toEqual({ x: 1, y: 2, z: 3 })
    expect(botPositionRegistry.size).toBe(1)
  })

  it('handles meeting movement and resets stale path when inactive', () => {
    const g = new THREE.Group()
    const state = {
      currentX: 0,
      currentZ: 0,
      meetingPathComputed: true,
      meetingWaypoints: [{ x: 1, z: 1 }],
      meetingWaypointIndex: 0,
    }
    const handled = handleMeetingMovement(
      g,
      state,
      'a',
      0.1,
      0,
      0,
      { current: false },
      { current: 0 }
    )
    expect(handled).toBe(false)
    expect(state.meetingPathComputed).toBe(false)
    expect(state.meetingWaypoints).toEqual([])
  })

  it('walkability checks bounds/mask and picks a walkable dir', () => {
    expect(isWalkableAt(0, 0, roomBounds, gridData, 0, 0)).toBe(true)
    expect(isWalkableAt(10, 0, roomBounds, gridData, 0, 0)).toBe(false)
    gridData.botWalkableMask[5][5] = false
    expect(isWalkableAt(0, 0, roomBounds, gridData, 0, 0)).toBe(false)

    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    const dir = pickWalkableDir(0, 0, roomBounds, gridData, 0, 0)
    expect(dir).not.toBeNull()
  })

  it('handles no-grid wander freeze/move behavior', () => {
    const g = new THREE.Group()
    const s = { currentX: 0, currentZ: 0, targetX: 0.1, targetZ: 0.1, waitTimer: 0 }
    const anim = { arrived: false, freezeWhenArrived: true, typingPause: false }
    const frozen = handleNoGridWander(g, s, anim, true, null, 0, 0, 1, 0.1, 'k1')
    expect(frozen).toBe(true)
    expect(botPositionRegistry.get('k1')).toBeTruthy()

    const s2 = { currentX: 0, currentZ: 0, targetX: 1, targetZ: 0, waitTimer: 1 }
    const anim2 = { arrived: false, freezeWhenArrived: false, typingPause: false }
    const handled = handleNoGridWander(g, s2, anim2, false, null, 0, 0, 1, 0.2, 'k2')
    expect(handled).toBe(false)
    expect(s2.currentX).toBeGreaterThan(0)
  })

  it('handles anim target walk for arrive and far-path branches', () => {
    const g = new THREE.Group()
    const s = { currentX: 0, currentZ: 0, targetX: 0.1, targetZ: 0.1 }
    const anim = { arrived: false, freezeWhenArrived: true }
    handleAnimTargetWalk(g, s, anim, gridData, roomBounds, {
      roomCenterX: 0,
      roomCenterZ: 0,
      speed: 1,
      delta: 0.1,
      sessionKey: 'x',
    })
    expect(anim.arrived).toBe(true)

    const s2 = { currentX: 0, currentZ: 0, targetX: 4, targetZ: 0 }
    const anim2 = { arrived: false, freezeWhenArrived: false }
    handleAnimTargetWalk(g, s2, anim2, gridData, roomBounds, {
      roomCenterX: 0,
      roomCenterZ: 0,
      speed: 1,
      delta: 0.2,
      sessionKey: 'x',
    })
    expect(s2.currentX).toBeGreaterThan(0)
  })

  it('handles random grid walk wait/pick/move branches', () => {
    const g = new THREE.Group()
    const s = {
      currentX: 0,
      currentZ: 0,
      dirX: 1,
      dirZ: 0,
      stepsRemaining: 0,
      waitTimer: 0,
      cellProgress: 0,
      cellStartX: 0,
      cellStartZ: 0,
    }

    handleRandomGridWalk(g, s, gridData, roomBounds, {
      roomCenterX: 0,
      roomCenterZ: 0,
      speed: 1,
      delta: 0.1,
    })
    expect(s.stepsRemaining).toBeGreaterThan(0)

    s.waitTimer = 0
    s.stepsRemaining = 1
    s.cellProgress = 0.95
    handleRandomGridWalk(g, s, gridData, roomBounds, {
      roomCenterX: 0,
      roomCenterZ: 0,
      speed: 1,
      delta: 0.2,
    })
    expect(s.stepsRemaining).toBe(0)
  })

  // ── Second-pass: additional branch coverage ──────────────────────

  it('smoothRotateY wraps angle > PI and lerps correctly', () => {
    const g = new THREE.Group()
    // Large positive diff → normalize
    g.rotation.y = 0
    smoothRotateY(g, Math.PI + 0.5, 0.5)
    // After wrapping diff is negative and lerped
    expect(g.rotation.y).toBeLessThan(0)

    // Large negative diff → normalize
    g.rotation.y = 0
    smoothRotateY(g, -(Math.PI + 0.5), 0.5)
    expect(g.rotation.y).toBeGreaterThan(0)
  })

  it('applyOpacity handles array materials', () => {
    const g = new THREE.Group()
    const mat1 = new THREE.MeshBasicMaterial({ opacity: 1 })
    const mat2 = new THREE.MeshBasicMaterial({ opacity: 1 })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [mat1, mat2] as any)
    g.add(mesh)
    const clonable = { current: false }
    applyOpacity(g, 0.3, clonable)
    expect((mesh.material as any)[0].opacity).toBe(0.3)
    expect((mesh.material as any)[1].opacity).toBe(0.3)
    expect(clonable.current).toBe(true)

    // Second call — materials already cloned, should not clone again
    applyOpacity(g, 0.8, clonable)
    expect((mesh.material as any)[0].opacity).toBe(0.8)
  })

  it('calculateBounceY idle-wandering active-walk vs normal-move branches', () => {
    // idle-wandering isActiveWalking=true, typingPause=false, isMoving=true → faster sin
    const r1 = calculateBounceY('idle-wandering', true, true, false, 1)
    expect(r1).not.toBe(0)

    // idle-wandering isActiveWalking=false, isMoving=true → slower sin
    const r2 = calculateBounceY('idle-wandering', true, false, false, 1)
    expect(r2).not.toBe(0)
    // Different sin frequency → different value
    expect(Math.abs(r1) !== Math.abs(r2) || r1 !== r2).toBeTruthy()

    // idle-wandering isMoving=false → 0
    expect(calculateBounceY('idle-wandering', false, true, false, 1)).toBe(0)

    // sleeping-walking isMoving=false → 0
    expect(calculateBounceY('sleeping-walking', false, false, false, 1)).toBe(0)

    // getting-coffee, isMoving=true → non-zero
    expect(calculateBounceY('getting-coffee', true, false, false, 1)).not.toBe(0)
  })

  it('isWalkableAt returns true when gridData is null (open world)', () => {
    expect(isWalkableAt(0, 0, roomBounds, null, 0, 0)).toBe(true)
  })

  it('pickWalkableDir returns null when no walkable neighbors', () => {
    // Block all cells so nothing is walkable
    const blockedGrid = {
      blueprint: { cellSize: 1, gridWidth: 10, gridDepth: 10 },
      botWalkableMask: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => false)),
    }
    const dir = pickWalkableDir(0, 0, roomBounds, blockedGrid, 0, 0)
    expect(dir).toBeNull()
  })

  it('handleNoGridWander uses walkableCenter for new target', () => {
    const g = new THREE.Group()
    const s = {
      currentX: 0,
      currentZ: 0,
      targetX: 0.05,
      targetZ: 0.05,
      waitTimer: -1, // expired
    }
    const anim = { arrived: false, freezeWhenArrived: false, typingPause: false }
    const walkableCenter = { x: 2, z: 2, radius: 3 }
    handleNoGridWander(g, s, anim, false, walkableCenter, 0, 0, 1, 0.1, undefined)
    // New target should be in walkableCenter area
    expect(Math.hypot(s.targetX - 2, s.targetZ - 2)).toBeLessThanOrEqual(3)
    expect(s.waitTimer).toBeGreaterThan(0)
  })

  it('handleNoGridWander uses roomCenter fallback when no walkableCenter', () => {
    const g = new THREE.Group()
    const s = {
      currentX: 0,
      currentZ: 0,
      targetX: 0.05,
      targetZ: 0.05,
      waitTimer: -1,
    }
    const anim = { arrived: false, freezeWhenArrived: false, typingPause: false }
    handleNoGridWander(g, s, anim, false, null, 5, 5, 1, 0.1, undefined)
    // New target should be near (5, 5)
    expect(Math.abs(s.targetX - 5)).toBeLessThanOrEqual(1)
    expect(Math.abs(s.targetZ - 5)).toBeLessThanOrEqual(1)
  })

  it('handleNoGridWander skips move when typingPause=true', () => {
    const g = new THREE.Group()
    const s = {
      currentX: 0,
      currentZ: 0,
      targetX: 2,
      targetZ: 0,
      waitTimer: 10, // active wait so we enter the else branch
    }
    const anim = { arrived: false, freezeWhenArrived: false, typingPause: true }
    // dist > 0.4, typingPause=true → should not move
    handleNoGridWander(g, s, anim, false, null, 0, 0, 1, 0.1, undefined)
    expect(s.currentX).toBe(0) // not moved
  })

  it('handleAnimTargetWalk close-path branch (dist < 0.8)', () => {
    const g = new THREE.Group()
    const s = { currentX: 0, currentZ: 0, targetX: 0.5, targetZ: 0 }
    const anim = { arrived: false, freezeWhenArrived: false }
    handleAnimTargetWalk(g, s, anim, gridData, roomBounds, {
      roomCenterX: 0,
      roomCenterZ: 0,
      speed: 1,
      delta: 0.1,
      sessionKey: undefined,
    })
    // dist=0.5 → close path, direct move
    expect(s.currentX).toBeGreaterThan(0)
    expect(anim.arrived).toBe(false)
  })

  it('handleRandomGridWalk wait timer ticking', () => {
    const g = new THREE.Group()
    const s = {
      currentX: 0,
      currentZ: 0,
      dirX: 1,
      dirZ: 0,
      stepsRemaining: 3,
      waitTimer: 2,
      cellProgress: 0,
      cellStartX: 0,
      cellStartZ: 0,
    }
    handleRandomGridWalk(g, s, gridData, roomBounds, {
      roomCenterX: 0,
      roomCenterZ: 0,
      speed: 1,
      delta: 0.5,
    })
    // Should decrement waitTimer and return early (no position change)
    expect(s.waitTimer).toBeCloseTo(1.5)
    expect(s.currentX).toBe(0)
  })

  it('handleRandomGridWalk obstacle avoidance: when all next cells blocked sets wait', () => {
    const g = new THREE.Group()
    // Block all cells so no direction is walkable
    const allBlockedGrid = {
      blueprint: { cellSize: 1, gridWidth: 10, gridDepth: 10 },
      botWalkableMask: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => false)),
    }
    const s = {
      currentX: 0,
      currentZ: 0,
      dirX: 1,
      dirZ: 0,
      stepsRemaining: 1,
      waitTimer: 0,
      cellProgress: 0,
      cellStartX: 0,
      cellStartZ: 0,
    }
    handleRandomGridWalk(g, s, allBlockedGrid, roomBounds, {
      roomCenterX: 0,
      roomCenterZ: 0,
      speed: 1,
      delta: 0.1,
    })
    // When obstacle found and no dir available → stepsRemaining=0 and waitTimer set
    expect(s.stepsRemaining).toBe(0)
    expect(s.waitTimer).toBeGreaterThan(0)
  })

  it('handleMeetingMovement with active meeting moves bot toward target', () => {
    meetingGatheringState.active = true
    meetingGatheringState.positions.set('bot1', { x: 3, z: 3, angle: 0 })

    const g = new THREE.Group()
    const state = {
      currentX: 0,
      currentZ: 0,
      meetingPathComputed: false,
      meetingWaypoints: [] as { x: number; z: number }[],
      meetingWaypointIndex: 0,
    }
    const handled = handleMeetingMovement(
      g,
      state,
      'bot1',
      0.1,
      0,
      0,
      { current: false },
      { current: 0 }
    )
    expect(handled).toBe(true)
    expect(state.meetingPathComputed).toBe(true)
  })

  it('handleMeetingMovement advances waypoint index when at non-last waypoint', () => {
    meetingGatheringState.active = true
    meetingGatheringState.positions.set('bot2', { x: 5, z: 5, angle: 0 })

    const g = new THREE.Group()
    const state = {
      currentX: 0,
      currentZ: 0,
      meetingPathComputed: true,
      meetingWaypoints: [
        { x: 0.1, z: 0.1 },
        { x: 5, z: 5 },
      ], // waypoint 0 is very close
      meetingWaypointIndex: 0,
    }
    const handled = handleMeetingMovement(
      g,
      state,
      'bot2',
      0.1,
      0,
      0,
      { current: false },
      { current: 0 }
    )
    expect(handled).toBe(true)
    expect(state.meetingWaypointIndex).toBe(1)
  })
})
