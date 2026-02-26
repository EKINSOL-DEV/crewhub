// ─── Enhanced Navigation System ─────────────────────────────────
// Builds on the existing A* pathfinding with:
//   1. Path smoothing (remove unnecessary waypoints)
//   2. Zone-based navigation ("go to the coffee machine")
//   3. Multi-room pathfinding awareness (future: cross-room via doors)
//
// Architecture Decision: Keep A* on our grid
// ===========================================
// We evaluated three pathfinding approaches:
//
// 1. **Grid A* (current)** — Our 20×20 grid with 8-directional movement
//    ✅ Already implemented and working
//    ✅ Perfect fit for our tile-based world
//    ✅ No external dependencies
//    ✅ Easy to update when props change
//    ⚠️  Paths are grid-snapped (jagged without smoothing)
//
// 2. **NavMesh (three-pathfinding)** — Polygon-based navigation mesh
//    ✅ Smooth paths, handles complex geometry
//    ✅ Proven library (donmccurdy/three-pathfinding)
//    ⚠️  Requires generating a navmesh from our grid (extra step)
//    ⚠️  Overkill for rectangular rooms with axis-aligned obstacles
//    ⚠️  Navmesh must regenerate when props are moved
//    ❌ Adds ~25KB dependency
//
// 3. **Recast Navigation (recast-navigation-js)** — Industry-standard WASM
//    ✅ Full pathfinding + obstacle avoidance + crowd simulation
//    ✅ WebAssembly = fast
//    ⚠️  Designed for complex 3D geometry (overkill for 2D grid)
//    ⚠️  ~400KB+ WASM binary
//    ❌ Massive dependency for our simple rooms
//
// 4. **Yuka.js** — Game AI library with steering + pathfinding + vision
//    ✅ Steering behaviors (arrive, flee, wander, follow)
//    ✅ NavMesh pathfinding built-in
//    ✅ Vision system with field-of-view
//    ✅ Goal-driven agent design
//    ⚠️  Would require migrating our entire bot movement system
//    ⚠️  Heavy abstraction layer over what we can do with simple code
//    ❌ All-or-nothing architecture (can't use pieces easily)
//
// **Decision: Grid A* + path smoothing**
// Our rooms are simple rectangular grids. Path smoothing gives us nice
// curves without navmesh complexity. If rooms become complex (multi-level,
// irregular shapes), we can upgrade to three-pathfinding.

import { findPath, findNearestWalkable, type PathNode } from '@/lib/grid/pathfinding'
import type { GridCell } from '@/lib/grid/types'

// ─── Zone System ────────────────────────────────────────────────

export type ZoneName = 'nw' | 'n' | 'ne' | 'w' | 'center' | 'e' | 'sw' | 's' | 'se'

const ZONE_LABELS: Record<ZoneName, string> = {
  nw: 'northwest corner',
  n: 'north wall',
  ne: 'northeast corner',
  w: 'west wall',
  center: 'center',
  e: 'east wall',
  sw: 'southwest corner',
  s: 'south wall (near door)',
  se: 'southeast corner',
}

/**
 * Map a grid coordinate to a 3×3 zone name.
 * The grid is divided into thirds along each axis.
 */
export function gridToZone(x: number, z: number, width: number = 20, depth: number = 20): ZoneName {
  let col: string
  if (x < width / 3) {
    col = 'w'
  } else if (x >= (2 * width) / 3) {
    col = 'e'
  } else {
    col = ''
  }
  let row: string
  if (z < depth / 3) {
    row = 'n'
  } else if (z >= (2 * depth) / 3) {
    row = 's'
  } else {
    row = ''
  }
  const zone = (row + col) as ZoneName
  return zone || 'center'
}

/** Get a human-readable label for a zone */
export function getZoneLabel(zone: ZoneName): string {
  return ZONE_LABELS[zone] || zone
}

// ─── Navigation Path ────────────────────────────────────────────

export interface NavigationConfig {
  /** Enable path smoothing (default: true) */
  smooth: boolean
  /** Smoothing tension 0-1 (default: 0.5, higher = smoother) */
  smoothTension: number
  /** Maximum path length before giving up (default: 100 cells) */
  maxPathLength: number
}

export interface NavigationPath {
  /** Grid waypoints (raw A* output) */
  rawPath: PathNode[]
  /** Smoothed waypoints (if smoothing enabled) */
  smoothedPath: PathNode[]
  /** Total path distance in grid cells */
  distance: number
  /** Zone of the destination */
  destinationZone: ZoneName
  /** Estimated travel time in seconds at given speed */
  estimatedTime: number
}

const DEFAULT_NAV_CONFIG: NavigationConfig = {
  smooth: true,
  smoothTension: 0.5,
  maxPathLength: 100,
}

/**
 * Enhanced navigation over the existing A* pathfinder.
 *
 * Adds:
 *   - Path smoothing (Ramer-Douglas-Peucker simplification)
 *   - Zone-aware navigation
 *   - Travel time estimation
 *   - Prop-target resolution ("navigate to coffee-machine")
 */
export class SpatialNavigator {
  private readonly grid: GridCell[][]
  private readonly walkableMask: boolean[][]
  private readonly width: number
  private readonly depth: number
  private readonly config: NavigationConfig

  constructor(grid: GridCell[][], config?: Partial<NavigationConfig>) {
    this.grid = grid
    this.config = { ...DEFAULT_NAV_CONFIG, ...config }
    this.depth = grid.length
    this.width = grid.length > 0 ? grid[0].length : 0
    this.walkableMask = grid.map((row) => row.map((cell) => cell.walkable && cell.type !== 'door'))
  }

  /**
   * Find a path from start to end with smoothing.
   *
   * @param from - Start position in grid coords
   * @param to - End position in grid coords
   * @param speed - Bot speed in grid cells per second (default: 2)
   */
  navigate(from: PathNode, to: PathNode, speed: number = 2): NavigationPath | null {
    // Ensure target is walkable (find nearest if not)
    let target = to
    if (!this.walkableMask[to.z]?.[to.x]) {
      const nearest = findNearestWalkable(this.walkableMask, to)
      if (!nearest) return null
      target = nearest
    }

    // Find raw A* path
    const rawPath = findPath(this.walkableMask, from, target)
    if (!rawPath) return null

    // Enforce max path length
    if (rawPath.length > this.config.maxPathLength) return null

    // Smooth if enabled
    const smoothedPath = this.config.smooth
      ? smoothPath(rawPath, this.walkableMask, this.config.smoothTension)
      : rawPath

    // Calculate total distance
    const distance = this.calculatePathDistance(smoothedPath)

    return {
      rawPath,
      smoothedPath,
      distance,
      destinationZone: gridToZone(target.x, target.z, this.width, this.depth),
      estimatedTime: distance / speed,
    }
  }

  /**
   * Navigate to a prop by name. Finds the prop on the grid and
   * pathfinds to an adjacent walkable cell.
   *
   * @param from - Start position
   * @param propId - Prop ID to navigate to (e.g., "coffee-machine")
   * @param speed - Bot speed
   */
  navigateToProp(from: PathNode, propId: string, speed: number = 2): NavigationPath | null {
    // Find the prop on the grid
    const propCells = this.findPropCells(propId)
    if (propCells.length === 0) return null

    // Find the closest adjacent walkable cell to the prop
    let bestTarget: PathNode | null = null
    let bestDist = Infinity

    for (const cell of propCells) {
      // Check all 8 neighbors
      for (const [dx, dz] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        const nx = cell.x + dx
        const nz = cell.z + dz
        if (nx < 0 || nx >= this.width || nz < 0 || nz >= this.depth) continue
        if (!this.walkableMask[nz][nx]) continue

        const dist = Math.sqrt((nx - from.x) ** 2 + (nz - from.z) ** 2)
        if (dist < bestDist) {
          bestDist = dist
          bestTarget = { x: nx, z: nz }
        }
      }
    }

    if (!bestTarget) return null
    return this.navigate(from, bestTarget, speed)
  }

  /**
   * Navigate to the center of a zone.
   */
  navigateToZone(from: PathNode, zone: ZoneName, speed: number = 2): NavigationPath | null {
    const target = this.getZoneCenter(zone)
    return this.navigate(from, target, speed)
  }

  /**
   * Get all props with their zones.
   * Useful for generating room layout descriptions.
   */
  getPropLayout(): { propId: string; x: number; z: number; zone: ZoneName; zoneLabel: string }[] {
    const props = new Map<string, { propId: string; x: number; z: number }>()

    for (let z = 0; z < this.depth; z++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[z][x]
        if (cell.propId && !cell.spanParent) {
          const key = `${cell.propId}@${x},${z}`
          if (!props.has(key)) {
            props.set(key, { propId: cell.propId, x, z })
          }
        }
      }
    }

    return Array.from(props.values()).map((p) => {
      const zone = gridToZone(p.x, p.z, this.width, this.depth)
      return { ...p, zone, zoneLabel: getZoneLabel(zone) }
    })
  }

  /**
   * Generate a natural language layout summary.
   * Token-efficient format for context envelope injection.
   */
  getLayoutSummary(roomName?: string): string {
    const layout = this.getPropLayout()
    if (layout.length === 0) return roomName ? `${roomName}: empty room` : 'Empty room'

    // Group props by zone
    const byZone = new Map<string, string[]>()
    for (const p of layout) {
      if (!byZone.has(p.zoneLabel)) byZone.set(p.zoneLabel, [])
      byZone.get(p.zoneLabel)!.push(p.propId)
    }

    const parts = Array.from(byZone.entries())
      .map(([zone, props]) => {
        const propList = props.join(', ')
        return `${propList} (${zone})`
      })
      .join(', ')

    const prefix = roomName ? `${roomName}: ` : ''
    return `${prefix}${parts}. Door: south.`
  }

  // ─── Private helpers ──────────────────────────────────────────

  private findPropCells(propId: string): { x: number; z: number }[] {
    const cells: { x: number; z: number }[] = []
    const lowerPropId = propId.toLowerCase()

    for (let z = 0; z < this.depth; z++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[z][x]
        if (cell.propId?.toLowerCase().includes(lowerPropId)) {
          cells.push({ x, z })
        }
      }
    }
    return cells
  }

  private getZoneCenter(zone: ZoneName): PathNode {
    const w = this.width
    const d = this.depth
    const third = (size: number) => Math.floor(size / 3)

    const colMap: Record<string, number> = {
      w: Math.floor(third(w) / 2),
      '': Math.floor(w / 2),
      e: w - Math.floor(third(w) / 2) - 1,
    }
    const rowMap: Record<string, number> = {
      n: Math.floor(third(d) / 2),
      '': Math.floor(d / 2),
      s: d - Math.floor(third(d) / 2) - 1,
    }

    let col: string
    if (zone.includes('w')) {
      col = 'w'
    } else if (zone.includes('e')) {
      col = 'e'
    } else {
      col = ''
    }
    let row: string
    if (zone.startsWith('n')) {
      row = 'n'
    } else if (zone.startsWith('s')) {
      row = 's'
    } else {
      row = ''
    }

    return { x: colMap[col], z: rowMap[row] }
  }

  private calculatePathDistance(path: PathNode[]): number {
    let distance = 0
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x
      const dz = path[i].z - path[i - 1].z
      distance += Math.hypot(dx, dz)
    }
    return distance
  }
}

// ─── Path Smoothing ─────────────────────────────────────────────

/**
 * Smooth an A* grid path using line-of-sight simplification.
 *
 * Algorithm:
 *   1. Start with the full A* path
 *   2. Try to skip intermediate waypoints by checking line-of-sight
 *   3. If a straight line from A to C is obstacle-free, remove B
 *   4. Repeat until no more waypoints can be removed
 *
 * This is similar to the "simple stupid funnel algorithm" but
 * adapted for our 2D grid. More sophisticated than RDP
 * (Ramer-Douglas-Peucker) because it respects obstacles.
 *
 * @param path - Raw A* path
 * @param walkableMask - Grid walkability
 * @param _tension - Smoothing tension (reserved for future Catmull-Rom curves)
 */
export function smoothPath(
  path: PathNode[],
  walkableMask: boolean[][],
  _tension: number = 0.5
): PathNode[] {
  if (path.length <= 2) return path

  const result: PathNode[] = [path[0]]
  let current = 0

  while (current < path.length - 1) {
    // Try to skip as far ahead as possible
    let farthest = current + 1

    for (let i = path.length - 1; i > current + 1; i--) {
      if (hasLineOfSight(walkableMask, path[current], path[i])) {
        farthest = i
        break
      }
    }

    result.push(path[farthest])
    current = farthest
  }

  return result
}

/**
 * Check if there's a clear line-of-sight between two grid points.
 * Uses Bresenham to walk the line and checks each cell for walkability.
 */
function hasLineOfSight(walkableMask: boolean[][], from: PathNode, to: PathNode): boolean {
  const depth = walkableMask.length
  if (depth === 0) return false
  const width = walkableMask[0].length

  const dx = Math.abs(to.x - from.x)
  const dz = Math.abs(to.z - from.z)
  const sx = from.x < to.x ? 1 : -1
  const sz = from.z < to.z ? 1 : -1
  let err = dx - dz
  let x = from.x
  let z = from.z

  while (true) {
    if (x < 0 || x >= width || z < 0 || z >= depth) return false
    if (!walkableMask[z][x]) return false
    if (x === to.x && z === to.z) break

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

  return true
}
