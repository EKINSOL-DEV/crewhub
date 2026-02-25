// ─── Vision System Tests ────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { VisionSystem } from '../vision'
import type { GridCell } from '@/lib/grid/types'

/** Create a simple test grid */
function makeGrid(
  width: number,
  depth: number,
  blocked?: { x: number; z: number; type?: string }[]
): GridCell[][] {
  const grid: GridCell[][] = []
  for (let z = 0; z < depth; z++) {
    const row: GridCell[] = []
    for (let x = 0; x < width; x++) {
      const isWall = x === 0 || x === width - 1 || z === 0 || z === depth - 1
      row.push({ type: isWall ? 'wall' : 'empty', walkable: !isWall })
    }
    grid.push(row)
  }
  // Place obstacles
  for (const b of blocked || []) {
    grid[b.z][b.x] = {
      type: (b.type as GridCell['type']) || 'furniture',
      walkable: false,
      propId: b.type || 'obstacle',
    }
  }
  return grid
}

describe('VisionSystem', () => {
  it('can see an unobstructed target', () => {
    const grid = makeGrid(10, 10)
    const vision = new VisionSystem(grid, { range: 10, fovDegrees: 360 })

    const result = vision.canSee({ x: 3, z: 3 }, { x: 7, z: 3 })
    expect(result.visible).toBe(true)
    expect(result.distance).toBeCloseTo(4)
  })

  it('cannot see through a wall', () => {
    const grid = makeGrid(10, 10, [{ x: 5, z: 3, type: 'wall' }])
    const vision = new VisionSystem(grid, { range: 10, fovDegrees: 360 })

    const result = vision.canSee({ x: 3, z: 3 }, { x: 7, z: 3 })
    expect(result.visible).toBe(false)
    expect(result.blockedBy).toBe('wall')
    expect(result.blockedAt).toEqual({ x: 5, z: 3 })
  })

  it('cannot see through furniture', () => {
    const grid = makeGrid(10, 10, [{ x: 5, z: 5, type: 'furniture' }])
    const vision = new VisionSystem(grid, { range: 10, fovDegrees: 360 })

    const result = vision.canSee({ x: 3, z: 5 }, { x: 7, z: 5 })
    expect(result.visible).toBe(false)
    expect(result.blockedBy).toBe('furniture')
  })

  it('respects range limit', () => {
    const grid = makeGrid(20, 20)
    const vision = new VisionSystem(grid, { range: 5, fovDegrees: 360 })

    const result = vision.canSee({ x: 3, z: 3 }, { x: 15, z: 3 })
    expect(result.visible).toBe(false)
    expect(result.blockedBy).toBe('out-of-range')
  })

  it('respects field of view', () => {
    const grid = makeGrid(20, 20)
    const vision = new VisionSystem(grid, { range: 15, fovDegrees: 90 })

    // atan2(dx, dz): angle 0 = +z direction (south in grid), π = -z (north)
    // Facing south (angle 0), target is directly south — should be visible
    const ahead = vision.canSee({ x: 10, z: 10 }, { x: 10, z: 15 }, 0)
    expect(ahead.visible).toBe(true)

    // Target is directly north — should NOT be visible with 90° FOV when facing south
    const behind = vision.canSee({ x: 10, z: 10 }, { x: 10, z: 5 }, 0)
    expect(behind.visible).toBe(false)
    expect(behind.blockedBy).toBe('outside-fov')
  })

  it('gets visible cells within FOV cone', () => {
    const grid = makeGrid(20, 20)
    const vision = new VisionSystem(grid, { range: 5, fovDegrees: 90, rayCount: 8 })

    const cells = vision.getVisibleCells({ x: 10, z: 10 }, 0)
    expect(cells.length).toBeGreaterThan(0)

    // All cells should be within range
    for (const cell of cells) {
      const dx = cell.x - 10
      const dz = cell.z - 10
      const dist = Math.sqrt(dx * dx + dz * dz)
      expect(dist).toBeLessThanOrEqual(6) // range + 1 for rounding
    }
  })

  it('getVisibleProps returns props with distances', () => {
    const grid = makeGrid(10, 10)
    grid[3][5] = { type: 'furniture', walkable: false, propId: 'desk' }
    grid[7][5] = { type: 'furniture', walkable: false, propId: 'plant' }

    // Use 360° FOV to see all props regardless of facing direction
    const vision = new VisionSystem(grid, {
      range: 10,
      fovDegrees: 360,
      rayCount: 24,
      furnitureBlocks: false,
    })
    const props = vision.getVisibleProps({ x: 5, z: 5 }, 0)

    expect(props.length).toBe(2)
    // Sorted by distance — both at distance 2
    const propIds = props.map((p) => p.propId).sort()
    expect(propIds).toEqual(['desk', 'plant'])
    expect(props[0].distance).toBeCloseTo(2)
    expect(props[1].distance).toBeCloseTo(2)
  })

  it('handles same position (distance 0)', () => {
    const grid = makeGrid(10, 10)
    const vision = new VisionSystem(grid, { range: 10, fovDegrees: 360 })

    const result = vision.canSee({ x: 5, z: 5 }, { x: 5, z: 5 })
    expect(result.visible).toBe(true)
    expect(result.distance).toBe(0)
  })
})
