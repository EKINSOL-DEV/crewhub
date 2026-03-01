/**
 * Pre-compute patrol waypoints for bot wandering.
 * Selects well-distributed open-space points in a room grid.
 */
import type { PathNode } from '@/lib/grid/pathfinding'

/**
 * Pre-compute ~targetCount patrol waypoints for a room.
 * Uses openness scoring (3x3 neighbor count) and greedy farthest-point selection
 * starting from the grid center.
 */
export function computeWanderWaypoints(
  botWalkableMask: boolean[][],
  targetCount: number = 12
): PathNode[] {
  const depth = botWalkableMask.length
  if (depth === 0) return []
  const width = botWalkableMask[0].length

  // Build openness map: count walkable neighbors in 3x3 around each cell
  // Exclude cells within 2 cells of grid edges to avoid placing waypoints in corners
  const wallMargin = 2
  const openness: number[][] = []
  let candidates: { x: number; z: number; openness: number }[] = []

  for (let z = 0; z < depth; z++) {
    openness[z] = []
    for (let x = 0; x < width; x++) {
      if (!botWalkableMask[z][x]) {
        openness[z][x] = 0
        continue
      }
      let count = 0
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nz = z + dz
          const nx = x + dx
          if (nz >= 0 && nz < depth && nx >= 0 && nx < width && botWalkableMask[nz][nx]) {
            count++
          }
        }
      }
      openness[z][x] = count
      const nearEdge =
        x < wallMargin || x >= width - wallMargin || z < wallMargin || z >= depth - wallMargin
      if (count >= 7 && !nearEdge) {
        candidates.push({ x, z, openness: count })
      }
    }
  }

  // Fallback: if not enough open cells, accept any walkable cell
  if (candidates.length < targetCount) {
    candidates = []
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        if (botWalkableMask[z][x]) {
          candidates.push({ x, z, openness: openness[z][x] })
        }
      }
    }
  }

  if (candidates.length === 0) return []

  // Greedy farthest-point selection starting from center
  const centerX = Math.floor(width / 2)
  const centerZ = Math.floor(depth / 2)

  // Find the candidate closest to center as first waypoint
  let startIdx = 0
  let startDist = Infinity
  for (let i = 0; i < candidates.length; i++) {
    const d = Math.hypot(candidates[i].x - centerX, candidates[i].z - centerZ)
    if (d < startDist) {
      startDist = d
      startIdx = i
    }
  }

  const selected: PathNode[] = [{ x: candidates[startIdx].x, z: candidates[startIdx].z }]
  const used = new Set<number>([startIdx])

  while (selected.length < targetCount && used.size < candidates.length) {
    let bestIdx = -1
    let bestMinDist = -1

    for (let i = 0; i < candidates.length; i++) {
      if (used.has(i)) continue

      // Find minimum distance to any already-selected waypoint
      let minDist = Infinity
      for (const sel of selected) {
        const d = Math.hypot(candidates[i].x - sel.x, candidates[i].z - sel.z)
        if (d < minDist) minDist = d
      }

      if (minDist > bestMinDist) {
        bestMinDist = minDist
        bestIdx = i
      }
    }

    if (bestIdx === -1) break
    selected.push({ x: candidates[bestIdx].x, z: candidates[bestIdx].z })
    used.add(bestIdx)
  }

  return selected
}
