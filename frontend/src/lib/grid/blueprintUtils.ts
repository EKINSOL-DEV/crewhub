// ─── Blueprint Helper Functions ─────────────────────────────────
// Utilities for creating and manipulating room grids

import type { GridCell, CellType, InteractionType } from './types'

/**
 * Create an empty grid filled with 'empty' walkable cells + wall border.
 * Grid is [z][x] (row-major): grid[z][x]
 */
export function createEmptyGrid(width: number, depth: number): GridCell[][] {
  const grid: GridCell[][] = []

  for (let z = 0; z < depth; z++) {
    const row: GridCell[] = []
    for (let x = 0; x < width; x++) {
      const isWall = x === 0 || x === width - 1 || z === 0 || z === depth - 1
      row.push({
        type: isWall ? 'wall' : 'empty',
        walkable: !isWall,
      })
    }
    grid.push(row)
  }

  return grid
}

/**
 * Place a prop on the grid (handles multi-cell spans).
 * For multi-cell props, (x, z) is the top-left corner of the footprint.
 * All spanned cells point back to the anchor via spanParent.
 */
export function placeOnGrid(
  grid: GridCell[][],
  x: number,
  z: number,
  propId: string,
  options?: {
    type?: CellType
    interactionType?: InteractionType
    rotation?: 0 | 90 | 180 | 270
    span?: { w: number; d: number }
  },
): void {
  const cellType = options?.type ?? 'furniture'
  const walkable = cellType === 'interaction' || cellType === 'decoration'
  const span = options?.span
  const w = span?.w ?? 1
  const d = span?.d ?? 1

  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      const cx = x + dx
      const cz = z + dz
      if (cz < 0 || cz >= grid.length || cx < 0 || cx >= grid[0].length) continue

      const cell = grid[cz][cx]
      cell.type = cellType
      cell.walkable = walkable
      cell.propId = propId
      if (options?.interactionType) cell.interactionType = options.interactionType
      if (options?.rotation !== undefined) cell.rotation = options.rotation

      if (span) {
        cell.span = { w, d }
        // All cells except the anchor point back to (x, z)
        if (dx !== 0 || dz !== 0) {
          cell.spanParent = { x, z }
        }
      }
    }
  }
}

/**
 * Place a door on the grid.
 * Sets the cell type to 'door' and makes it walkable.
 */
export function placeDoor(
  grid: GridCell[][],
  x: number,
  z: number,
): void {
  if (z < 0 || z >= grid.length || x < 0 || x >= grid[0].length) return
  grid[z][x] = { type: 'door', walkable: true }
}

/**
 * Get walkable mask (boolean[][]) from grid.
 * Returns grid[z][x] = true if the cell is walkable.
 */
export function getWalkableMask(grid: GridCell[][]): boolean[][] {
  return grid.map(row => row.map(cell => cell.walkable))
}

/**
 * Find all cells of a specific interaction type.
 */
export function findInteractionCells(
  grid: GridCell[][],
  type: InteractionType,
): { x: number; z: number }[] {
  const results: { x: number; z: number }[] = []
  for (let z = 0; z < grid.length; z++) {
    for (let x = 0; x < grid[z].length; x++) {
      if (grid[z][x].interactionType === type) {
        results.push({ x, z })
      }
    }
  }
  return results
}

/**
 * Convert grid coordinates to world coordinates (relative to room origin).
 * Room origin is at the center of the grid.
 * Returns [worldX, worldY, worldZ] where worldY = 0.
 */
export function gridToWorld(
  gridX: number,
  gridZ: number,
  cellSize: number,
  gridWidth: number,
  gridDepth: number,
): [number, number, number] {
  const halfW = (gridWidth * cellSize) / 2
  const halfD = (gridDepth * cellSize) / 2
  const worldX = gridX * cellSize - halfW + cellSize / 2
  const worldZ = gridZ * cellSize - halfD + cellSize / 2
  return [worldX, 0, worldZ]
}

/**
 * Convert world coordinates to grid coordinates.
 * Inverse of gridToWorld. Clamps to grid bounds.
 */
export function worldToGrid(
  worldX: number,
  worldZ: number,
  cellSize: number,
  gridWidth: number,
  gridDepth: number,
): { x: number; z: number } {
  const halfW = (gridWidth * cellSize) / 2
  const halfD = (gridDepth * cellSize) / 2
  const gx = Math.floor((worldX + halfW) / cellSize)
  const gz = Math.floor((worldZ + halfD) / cellSize)
  return {
    x: Math.max(0, Math.min(gridWidth - 1, gx)),
    z: Math.max(0, Math.min(gridDepth - 1, gz)),
  }
}
