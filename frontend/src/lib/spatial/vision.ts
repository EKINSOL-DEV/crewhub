// ─── Vision System ──────────────────────────────────────────────
// Raycasting-based line-of-sight for bots.
//
// Uses a 2D grid raycasting approach (Bresenham's line algorithm)
// instead of Three.js 3D raycasting. This is more appropriate for
// CrewHub because:
//   1. Our rooms are 2D grids with obstacles (walls, furniture)
//   2. 3D raycasting requires scene mesh references (tight coupling)
//   3. Grid raycasting is O(n) in line length, not scene complexity
//   4. Results are deterministic and testable without a renderer
//
// Three.js Raycaster is better for:
//   - Mouse picking / click detection (already used in R3F)
//   - 3D projectile collision
//   - Complex mesh intersection tests
//
// For our 2D grid world, Bresenham is the right tool.

import type { GridCell } from '@/lib/grid/types'

export interface VisionConfig {
  /** Maximum vision range in grid cells (default: 10) */
  range: number
  /** Field of view in degrees (default: 120 = ~human peripheral) */
  fovDegrees: number
  /** Number of rays to cast within FOV (default: 12) */
  rayCount: number
  /** Whether walls block vision (default: true) */
  wallsBlock: boolean
  /** Whether furniture blocks vision (default: true) */
  furnitureBlocks: boolean
}

export interface VisionResult {
  /** Whether the target is visible */
  visible: boolean
  /** Distance in grid cells (Euclidean) */
  distance: number
  /** Zone name of the target */
  zone: string
  /** If blocked, what blocked it */
  blockedBy?: string
  /** Grid coords of blocking cell */
  blockedAt?: { x: number; z: number }
}

const DEFAULT_CONFIG: VisionConfig = {
  range: 10,
  fovDegrees: 120,
  rayCount: 12,
  wallsBlock: true,
  furnitureBlocks: true,
}

/**
 * 2D grid-based vision system using Bresenham's line algorithm.
 *
 * Usage:
 *   const vision = new VisionSystem(grid, config)
 *   const result = vision.canSee(botPos, targetPos, botFacingAngle)
 *   const visible = vision.getVisibleCells(botPos, botFacingAngle)
 */
export class VisionSystem {
  private readonly grid: GridCell[][]
  private readonly config: VisionConfig
  private readonly width: number
  private readonly depth: number

  constructor(grid: GridCell[][], config?: Partial<VisionConfig>) {
    this.grid = grid
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.depth = grid.length
    this.width = grid.length > 0 ? grid[0].length : 0
  }

  /**
   * Check if a bot at `from` can see `to`, considering facing direction.
   *
   * @param from - Bot position in grid coords
   * @param to - Target position in grid coords
   * @param facingAngle - Bot facing direction in radians (0 = north/+z, π/2 = east)
   */
  canSee(
    from: { x: number; z: number },
    to: { x: number; z: number },
    facingAngle?: number
  ): VisionResult {
    const dx = to.x - from.x
    const dz = to.z - from.z
    const distance = Math.sqrt(dx * dx + dz * dz)

    // Range check
    if (distance > this.config.range) {
      return { visible: false, distance, zone: '', blockedBy: 'out-of-range' }
    }

    // FOV check (if facing angle provided)
    if (facingAngle !== undefined && this.config.fovDegrees < 360) {
      const angleToTarget = Math.atan2(dx, dz)
      let angleDiff = angleToTarget - facingAngle
      // Normalize to [-π, π]
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI

      const halfFov = (this.config.fovDegrees / 2) * (Math.PI / 180)
      if (Math.abs(angleDiff) > halfFov) {
        return { visible: false, distance, zone: '', blockedBy: 'outside-fov' }
      }
    }

    // Line-of-sight check using Bresenham
    const line = this.bresenhamLine(from.x, from.z, to.x, to.z)

    // Check each cell along the line (skip start and end)
    for (let i = 1; i < line.length - 1; i++) {
      const { x, z } = line[i]
      if (x < 0 || x >= this.width || z < 0 || z >= this.depth) {
        return {
          visible: false,
          distance,
          zone: '',
          blockedBy: 'out-of-bounds',
          blockedAt: { x, z },
        }
      }

      const cell = this.grid[z][x]
      if (this.isBlocking(cell)) {
        return {
          visible: false,
          distance,
          zone: '',
          blockedBy: cell.propId || cell.type,
          blockedAt: { x, z },
        }
      }
    }

    return { visible: true, distance, zone: '' }
  }

  /**
   * Get all cells visible from a position within the FOV cone.
   * Returns a set of grid coordinates that the bot can "see".
   *
   * Casts `rayCount` rays evenly distributed across the FOV.
   * Each ray stops at the first blocking cell or max range.
   */
  getVisibleCells(from: { x: number; z: number }, facingAngle: number): { x: number; z: number }[] {
    const visible = new Map<string, { x: number; z: number }>()
    const halfFov = (this.config.fovDegrees / 2) * (Math.PI / 180)
    const { rayCount, range } = this.config

    for (let i = 0; i < rayCount; i++) {
      const angle = facingAngle - halfFov + (2 * halfFov * i) / (rayCount - 1 || 1)

      // Cast ray to max range
      const endX = Math.round(from.x + Math.sin(angle) * range)
      const endZ = Math.round(from.z + Math.cos(angle) * range)

      const line = this.bresenhamLine(from.x, from.z, endX, endZ)

      for (const { x, z } of line) {
        if (x < 0 || x >= this.width || z < 0 || z >= this.depth) break

        const key = `${x},${z}`
        visible.set(key, { x, z })

        const cell = this.grid[z][x]
        if (this.isBlocking(cell)) break // Ray stops at blocking cell
      }
    }

    return Array.from(visible.values())
  }

  /**
   * Get all visible props (named objects) from a position.
   * Returns unique prop IDs with their positions and distances.
   */
  getVisibleProps(
    from: { x: number; z: number },
    facingAngle: number
  ): { propId: string; x: number; z: number; distance: number }[] {
    const cells = this.getVisibleCells(from, facingAngle)
    const props = new Map<string, { propId: string; x: number; z: number; distance: number }>()

    for (const cell of cells) {
      const gridCell = this.grid[cell.z][cell.x]
      if (gridCell.propId && !gridCell.spanParent) {
        // Only count anchor cells (skip span children to avoid duplicates)
        const key = `${gridCell.propId}@${cell.x},${cell.z}`
        if (!props.has(key)) {
          const dx = cell.x - from.x
          const dz = cell.z - from.z
          props.set(key, {
            propId: gridCell.propId,
            x: cell.x,
            z: cell.z,
            distance: Math.sqrt(dx * dx + dz * dz),
          })
        }
      }
    }

    return Array.from(props.values()).sort((a, b) => a.distance - b.distance)
  }

  // ─── Private helpers ──────────────────────────────────────────

  private isBlocking(cell: GridCell): boolean {
    if (cell.type === 'wall' && this.config.wallsBlock) return true
    if (cell.type === 'furniture' && this.config.furnitureBlocks) return true
    return false
  }

  /**
   * Bresenham's line algorithm — returns all grid cells along a line
   * from (x0, z0) to (x1, z1). Classic integer-only rasterization.
   */
  private bresenhamLine(
    x0: number,
    z0: number,
    x1: number,
    z1: number
  ): { x: number; z: number }[] {
    const cells: { x: number; z: number }[] = []
    const dx = Math.abs(x1 - x0)
    const dz = Math.abs(z1 - z0)
    const sx = x0 < x1 ? 1 : -1
    const sz = z0 < z1 ? 1 : -1
    let err = dx - dz
    let x = x0
    let z = z0

    while (true) {
      cells.push({ x, z })
      if (x === x1 && z === z1) break
      const e2 = 2 * err
      if (e2 > -dz) {
        err -= dz
        x += sx
      }
      if (e2 < dx) {
        err += dx
        z += sz
      }
    }

    return cells
  }
}
