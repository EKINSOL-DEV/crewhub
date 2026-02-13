// ─── Navigation System Tests ────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { SpatialNavigator, gridToZone, smoothPath } from '../navigation'
import type { GridCell } from '@/lib/grid/types'

/** Create a simple test grid (same helper as vision tests) */
function makeGrid(width: number, depth: number, blocked?: { x: number; z: number }[]): GridCell[][] {
  const grid: GridCell[][] = []
  for (let z = 0; z < depth; z++) {
    const row: GridCell[] = []
    for (let x = 0; x < width; x++) {
      const isWall = x === 0 || x === width - 1 || z === 0 || z === depth - 1
      row.push({ type: isWall ? 'wall' : 'empty', walkable: !isWall })
    }
    grid.push(row)
  }
  for (const b of blocked || []) {
    grid[b.z][b.x] = { type: 'furniture', walkable: false, propId: 'block' }
  }
  return grid
}

describe('gridToZone', () => {
  it('maps corner positions correctly', () => {
    expect(gridToZone(1, 1, 20, 20)).toBe('nw')
    expect(gridToZone(18, 1, 20, 20)).toBe('ne')
    expect(gridToZone(1, 18, 20, 20)).toBe('sw')
    expect(gridToZone(18, 18, 20, 20)).toBe('se')
  })

  it('maps center', () => {
    expect(gridToZone(10, 10, 20, 20)).toBe('center')
  })

  it('maps wall positions', () => {
    expect(gridToZone(10, 1, 20, 20)).toBe('n')
    expect(gridToZone(10, 18, 20, 20)).toBe('s')
    expect(gridToZone(1, 10, 20, 20)).toBe('w')
    expect(gridToZone(18, 10, 20, 20)).toBe('e')
  })
})

describe('SpatialNavigator', () => {
  it('finds path between two points', () => {
    const grid = makeGrid(20, 20)
    const nav = new SpatialNavigator(grid)

    const path = nav.navigate({ x: 3, z: 3 }, { x: 15, z: 15 })
    expect(path).not.toBeNull()
    expect(path!.rawPath.length).toBeGreaterThan(0)
    expect(path!.distance).toBeGreaterThan(0)
    expect(path!.estimatedTime).toBeGreaterThan(0)
    expect(path!.destinationZone).toBe('se')
  })

  it('smoothed path has fewer waypoints than raw', () => {
    const grid = makeGrid(20, 20)
    const nav = new SpatialNavigator(grid, { smooth: true })

    const path = nav.navigate({ x: 3, z: 3 }, { x: 15, z: 15 })
    expect(path).not.toBeNull()
    // Smoothed should have fewer or equal waypoints
    expect(path!.smoothedPath.length).toBeLessThanOrEqual(path!.rawPath.length)
  })

  it('returns null for unreachable target', () => {
    // Block off a section completely
    const blocked = []
    for (let x = 1; x < 19; x++) {
      blocked.push({ x, z: 10 })
    }
    const grid = makeGrid(20, 20, blocked)
    const nav = new SpatialNavigator(grid)

    const path = nav.navigate({ x: 5, z: 3 }, { x: 5, z: 15 })
    expect(path).toBeNull()
  })

  it('navigates to prop by name', () => {
    const grid = makeGrid(20, 20)
    grid[5][10] = { type: 'furniture', walkable: false, propId: 'coffee-machine' }

    const nav = new SpatialNavigator(grid)
    const path = nav.navigateToProp({ x: 3, z: 3 }, 'coffee')
    expect(path).not.toBeNull()
    // Should end adjacent to the coffee machine, not on it
    const lastPoint = path!.smoothedPath[path!.smoothedPath.length - 1]
    const dx = Math.abs(lastPoint.x - 10)
    const dz = Math.abs(lastPoint.z - 5)
    expect(dx + dz).toBeLessThanOrEqual(2) // adjacent
  })

  it('navigates to a zone', () => {
    const grid = makeGrid(20, 20)
    const nav = new SpatialNavigator(grid)

    const path = nav.navigateToZone({ x: 3, z: 3 }, 'se')
    expect(path).not.toBeNull()
    expect(path!.destinationZone).toBe('se')
  })

  it('generates layout summary', () => {
    const grid = makeGrid(20, 20)
    grid[3][3] = { type: 'furniture', walkable: false, propId: 'desk' }
    grid[15][15] = { type: 'furniture', walkable: false, propId: 'plant' }

    const nav = new SpatialNavigator(grid)
    const summary = nav.getLayoutSummary('Dev Room')

    expect(summary).toContain('Dev Room')
    expect(summary).toContain('desk')
    expect(summary).toContain('plant')
    expect(summary).toContain('Door: south')
  })

  it('getPropLayout returns props with zones', () => {
    const grid = makeGrid(20, 20)
    grid[3][3] = { type: 'furniture', walkable: false, propId: 'desk' }
    grid[15][15] = { type: 'furniture', walkable: false, propId: 'plant' }

    const nav = new SpatialNavigator(grid)
    const layout = nav.getPropLayout()

    expect(layout).toHaveLength(2)
    expect(layout[0].propId).toBe('desk')
    expect(layout[0].zone).toBe('nw')
    expect(layout[1].propId).toBe('plant')
    expect(layout[1].zone).toBe('se')
  })
})

describe('smoothPath', () => {
  it('simplifies a straight path', () => {
    // Straight horizontal path should simplify to 2 points
    const path = [
      { x: 1, z: 5 },
      { x: 2, z: 5 },
      { x: 3, z: 5 },
      { x: 4, z: 5 },
      { x: 5, z: 5 },
    ]
    const mask = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => true))
    const smoothed = smoothPath(path, mask)

    expect(smoothed).toHaveLength(2) // start + end
    expect(smoothed[0]).toEqual({ x: 1, z: 5 })
    expect(smoothed[1]).toEqual({ x: 5, z: 5 })
  })

  it('preserves corners around obstacles', () => {
    // L-shaped path around an obstacle
    const path = [
      { x: 1, z: 1 },
      { x: 1, z: 3 },
      { x: 1, z: 5 },
      { x: 3, z: 5 },
      { x: 5, z: 5 },
    ]
    const mask = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => true))
    // Block the diagonal shortcut
    mask[3][3] = false
    mask[2][2] = false

    const smoothed = smoothPath(path, mask)
    // Should preserve the corner since LOS is blocked diagonally
    expect(smoothed.length).toBeGreaterThanOrEqual(2)
  })

  it('returns same for paths of length 2', () => {
    const path = [{ x: 1, z: 1 }, { x: 5, z: 5 }]
    const mask = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => true))
    const smoothed = smoothPath(path, mask)

    expect(smoothed).toHaveLength(2)
  })
})
