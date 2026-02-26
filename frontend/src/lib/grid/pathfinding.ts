// ─── A* Pathfinding ─────────────────────────────────────────────
// Simple A* implementation on a walkable boolean mask

export interface PathNode {
  x: number
  z: number
}

interface AStarNode {
  x: number
  z: number
  g: number // cost from start
  h: number // heuristic to end
  f: number // g + h
  parent: AStarNode | null
}

// 8-directional movement: cardinals + diagonals
const DIRECTIONS: { dx: number; dz: number; cost: number }[] = [
  { dx: 0, dz: -1, cost: 1 }, // north
  { dx: 1, dz: 0, cost: 1 }, // east
  { dx: 0, dz: 1, cost: 1 }, // south
  { dx: -1, dz: 0, cost: 1 }, // west
  { dx: 1, dz: -1, cost: 1.414 }, // northeast
  { dx: 1, dz: 1, cost: 1.414 }, // southeast
  { dx: -1, dz: 1, cost: 1.414 }, // southwest
  { dx: -1, dz: -1, cost: 1.414 }, // northwest
]

/** Octile distance heuristic (supports 8-directional movement) */
function heuristic(ax: number, az: number, bx: number, bz: number): number {
  const dx = Math.abs(ax - bx)
  const dz = Math.abs(az - bz)
  return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz)
}

function nodeKey(x: number, z: number): string {
  return `${x},${z}`
}

/**
 * Find path from start to end on a walkable grid using A*.
 * Returns array of grid coordinates, or null if no path exists.
 *
 * walkableMask[z][x] = true means the cell is passable.
 * Supports 8-directional movement with diagonal cost √2.
 * For diagonal moves, both adjacent cardinal cells must also be walkable
 * to prevent corner-cutting through walls.
 */
export function findPath( // NOSONAR: complexity from legitimate A* pathfinding algorithm; splitting would obscure the algorithm
  walkableMask: boolean[][],
  start: PathNode,
  end: PathNode
): PathNode[] | null {
  const depth = walkableMask.length
  if (depth === 0) return null
  const width = walkableMask[0].length

  // Bounds check
  if (
    start.x < 0 ||
    start.x >= width ||
    start.z < 0 ||
    start.z >= depth ||
    end.x < 0 ||
    end.x >= width ||
    end.z < 0 ||
    end.z >= depth
  ) {
    return null
  }

  // Start or end not walkable
  if (!walkableMask[start.z][start.x] || !walkableMask[end.z][end.x]) {
    return null
  }

  // Already at the destination
  if (start.x === end.x && start.z === end.z) {
    return [{ x: start.x, z: start.z }]
  }

  const openSet = new Map<string, AStarNode>()
  const closedSet = new Set<string>()

  const startNode: AStarNode = {
    x: start.x,
    z: start.z,
    g: 0,
    h: heuristic(start.x, start.z, end.x, end.z),
    f: heuristic(start.x, start.z, end.x, end.z),
    parent: null,
  }
  openSet.set(nodeKey(start.x, start.z), startNode)

  while (openSet.size > 0) {
    // Find node with lowest f score
    let current: AStarNode | null = null
    for (const node of openSet.values()) {
      if (current === null || node.f < current.f || (node.f === current.f && node.h < current.h)) {
        current = node
      }
    }
    if (!current) break

    // Reached the goal
    if (current.x === end.x && current.z === end.z) {
      const path: PathNode[] = []
      let node: AStarNode | null = current
      while (node) {
        path.push({ x: node.x, z: node.z })
        node = node.parent
      }
      return path.reverse()
    }

    const currentKey = nodeKey(current.x, current.z)
    openSet.delete(currentKey)
    closedSet.add(currentKey)

    // Explore neighbors
    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.dx
      const nz = current.z + dir.dz

      // Bounds check
      if (nx < 0 || nx >= width || nz < 0 || nz >= depth) continue

      // Already visited
      const nKey = nodeKey(nx, nz)
      if (closedSet.has(nKey)) continue

      // Not walkable
      if (!walkableMask[nz][nx]) continue

      // For diagonal moves, check that adjacent cardinal cells are walkable
      // to prevent corner-cutting through walls
      if (dir.dx !== 0 && dir.dz !== 0) {
        if (!walkableMask[current.z][nx] || !walkableMask[nz][current.x]) continue
      }

      const g = current.g + dir.cost
      const existing = openSet.get(nKey)

      if (existing) {
        if (g < existing.g) {
          existing.g = g
          existing.f = g + existing.h
          existing.parent = current
        }
      } else {
        const h = heuristic(nx, nz, end.x, end.z)
        openSet.set(nKey, {
          x: nx,
          z: nz,
          g,
          h,
          f: g + h,
          parent: current,
        })
      }
    }
  }

  return null // No path found
}

/**
 * Find nearest walkable cell to a target (if target itself is not walkable).
 * Uses BFS radiating outward from target.
 * Returns the closest walkable cell, or null if the grid has no walkable cells.
 */
export function findNearestWalkable(walkableMask: boolean[][], target: PathNode): PathNode | null {
  const depth = walkableMask.length
  if (depth === 0) return null
  const width = walkableMask[0].length

  // Clamp target to grid bounds
  const tx = Math.max(0, Math.min(width - 1, target.x))
  const tz = Math.max(0, Math.min(depth - 1, target.z))

  // If already walkable, return it
  if (walkableMask[tz][tx]) {
    return { x: tx, z: tz }
  }

  // BFS from target
  const visited = new Set<string>()
  const queue: PathNode[] = [{ x: tx, z: tz }]
  visited.add(nodeKey(tx, tz))

  while (queue.length > 0) {
    const current = queue.shift()!

    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.dx
      const nz = current.z + dir.dz

      if (nx < 0 || nx >= width || nz < 0 || nz >= depth) continue

      const key = nodeKey(nx, nz)
      if (visited.has(key)) continue
      visited.add(key)

      if (walkableMask[nz][nx]) {
        return { x: nx, z: nz }
      }

      queue.push({ x: nx, z: nz })
    }
  }

  return null
}
