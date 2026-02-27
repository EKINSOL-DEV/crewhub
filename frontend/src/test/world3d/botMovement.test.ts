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
})
