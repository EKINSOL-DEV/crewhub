// ─── Room interaction points & walkable zones ────────────────────
// Extracted from BotAnimations.tsx to avoid mixed exports (React + non-React)
// which breaks Vite HMR Fast Refresh.

import { getBlueprintForRoom, gridToWorld, findInteractionCells } from '@/lib/grid'

export interface RoomInteractionPoints {
  deskPosition: [number, number, number]
  coffeePosition: [number, number, number] | null
  sleepCorner: [number, number, number]
}

// ─── Room Interaction Points (Grid-Based) ───────────────────────

/**
 * Get world-space positions for room furniture that bots interact with.
 * Uses grid blueprint interaction points instead of hardcoded positions.
 *
 * Note: deskPosition is kept for reference but bots no longer pathfind to desks.
 * Coffee and sleep positions are still used.
 */
export function getRoomInteractionPoints(
  roomName: string,
  _roomSize: number,
  roomPosition: [number, number, number]
): RoomInteractionPoints {
  const rx = roomPosition[0]
  const rz = roomPosition[2]
  const blueprint = getBlueprintForRoom(roomName)
  const { cells, cellSize, gridWidth, gridDepth } = blueprint

  // Get interaction cells from grid
  const workCells = findInteractionCells(cells, 'work')
  const coffeeCells = findInteractionCells(cells, 'coffee')
  const sleepCells = findInteractionCells(cells, 'sleep')

  // Convert first found cell of each type to world coords
  const toWorld = (cell: { x: number; z: number }): [number, number, number] => {
    const [relX, , relZ] = gridToWorld(cell.x, cell.z, cellSize, gridWidth, gridDepth)
    return [rx + relX, 0, rz + relZ]
  }

  // Fallback: use walkable center for desk, and a corner for sleep
  const fallbackDesk: [number, number, number] = (() => {
    const [relX, , relZ] = gridToWorld(
      blueprint.walkableCenter.x,
      blueprint.walkableCenter.z,
      cellSize,
      gridWidth,
      gridDepth
    )
    return [rx + relX, 0, rz + relZ]
  })()

  const fallbackSleep: [number, number, number] = (() => {
    const [relX, , relZ] = gridToWorld(17, 17, cellSize, gridWidth, gridDepth)
    return [rx + relX, 0, rz + relZ]
  })()

  return {
    deskPosition: workCells.length > 0 ? toWorld(workCells[0]) : fallbackDesk,
    coffeePosition: coffeeCells.length > 0 ? toWorld(coffeeCells[0]) : null,
    sleepCorner: sleepCells.length > 0 ? toWorld(sleepCells[0]) : fallbackSleep,
  }
}

// ─── Walkable Zone (Grid-Based) ─────────────────────────────────

export interface WalkableCenter {
  x: number
  z: number
  radius: number
}

/**
 * Returns a safe circular walkable area in the center of each room.
 * Uses the grid blueprint's walkableCenter + computed radius from walkable cells.
 */
export function getWalkableCenter(
  roomName: string,
  roomSize: number,
  roomPosition: [number, number, number]
): WalkableCenter {
  const rx = roomPosition[0]
  const rz = roomPosition[2]
  const blueprint = getBlueprintForRoom(roomName)
  const { cellSize, gridWidth, gridDepth } = blueprint

  // Convert blueprint walkable center from grid to world coords
  const [relX, , relZ] = gridToWorld(
    blueprint.walkableCenter.x,
    blueprint.walkableCenter.z,
    cellSize,
    gridWidth,
    gridDepth
  )

  // Default radius: ~35% of half-room-size (same as before)
  const defaultRadius = roomSize * 0.17

  return {
    x: rx + relX,
    z: rz + relZ,
    radius: defaultRadius,
  }
}
