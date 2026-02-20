/**
 * Building layout constants and calculation utilities.
 * Pure functions — no React imports.
 */
import type { Room } from '@/hooks/useRooms'

// ─── Layout Constants ──────────────────────────────────────────
export const ROOM_SIZE = 12
export const HQ_SIZE = 16 // HQ is larger — command center feel
export const HALLWAY_WIDTH = 4
export const BUILDING_PADDING = 3 // padding inside building walls around the grid
export const PARKING_WIDTH = 9 // width of parking/break area (compact break room)
export const PARKING_DEPTH_MIN = ROOM_SIZE // minimum depth (≈ 1 room tall)

/** Get the effective size for a room (HQ is larger) */
export function getRoomSize(room: { is_hq?: boolean }): number {
  return room.is_hq ? HQ_SIZE : ROOM_SIZE
}

// ─── Room bounds for wandering ──────────────────────────────────

export interface RoomBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export function getRoomBounds(roomPos: [number, number, number], roomSize: number): RoomBounds {
  const margin = 2.5
  return {
    minX: roomPos[0] - roomSize / 2 + margin,
    maxX: roomPos[0] + roomSize / 2 - margin,
    minZ: roomPos[2] - roomSize / 2 + margin,
    maxZ: roomPos[2] + roomSize / 2 - margin,
  }
}

export function getParkingBounds(x: number, z: number, width: number, depth: number): RoomBounds {
  const margin = 2
  return {
    minX: x - width / 2 + margin,
    maxX: x + width / 2 - margin,
    minZ: z - depth / 2 + margin,
    maxZ: z + depth / 2 - margin,
  }
}

// ─── Building Layout Calculation ───────────────────────────────

export interface BuildingLayout {
  roomPositions: { room: Room; position: [number, number, number]; size: number }[]
  buildingWidth: number
  buildingDepth: number
  buildingCenterX: number
  buildingCenterZ: number
  parkingArea: { x: number; z: number; width: number; depth: number }
  entranceX: number
  cols: number
  rows: number
  gridOriginX: number
  gridOriginZ: number
}

/**
 * Adaptive grid layout — size chosen based on total room count:
 *   ≤ 1 room  → 1×1  (HQ only)
 *   ≤ 4 rooms → 2×2  (HQ at top-left, col=0 row=0)
 *   ≤ 6 rooms → 3×2  (HQ at top-center, col=1 row=0)
 *   7-9 rooms → 3×3  (HQ at center cell, col=1 row=1)
 *   > 9 rooms → 3×3  (capped at 8 peripheral slots)
 */
export function calculateBuildingLayout(rooms: Room[]): BuildingLayout {
  const sorted = [...rooms].sort((a, b) => a.sort_order - b.sort_order)

  const hqRoom = sorted.find(r => r.is_hq)
  const otherRooms = sorted.filter(r => !r.is_hq)
  const centerRoom = hqRoom || sorted[0]
  const peripheralRooms = hqRoom ? otherRooms : sorted.slice(1)

  // Grid parameters — spacing is center-to-center distance
  const cellPitch = HQ_SIZE + HALLWAY_WIDTH // 16 + 4 = 20

  const totalRooms = rooms.length

  let cols: number
  let rows: number
  let hqCol: number
  let hqRow: number
  let gridCells: [number, number][]

  if (totalRooms <= 1) {
    cols = 1; rows = 1; hqCol = 0; hqRow = 0
    gridCells = []
  } else if (totalRooms <= 4) {
    cols = 2; rows = 2; hqCol = 0; hqRow = 0
    gridCells = [
      [1, 0],
      [0, 1], [1, 1],
    ]
  } else if (totalRooms <= 6) {
    cols = 3; rows = 2; hqCol = 1; hqRow = 0
    gridCells = [
      [0, 0], [2, 0],
      [0, 1], [1, 1], [2, 1],
    ]
  } else {
    cols = 3; rows = 3; hqCol = 1; hqRow = 1
    gridCells = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r === 1 && c === 1) continue
        gridCells.push([c, r])
      }
    }
  }

  const gridOffsetX = -(cols - 1) * cellPitch / 2
  const gridOffsetZ = -(rows - 1) * cellPitch / 2

  const roomPositions: BuildingLayout['roomPositions'] = []

  const hqX = gridOffsetX + hqCol * cellPitch
  const hqZ = gridOffsetZ + hqRow * cellPitch
  roomPositions.push({
    room: centerRoom,
    position: [hqX, 0, hqZ],
    size: getRoomSize(centerRoom),
  })

  for (let i = 0; i < Math.min(peripheralRooms.length, gridCells.length); i++) {
    const [c, r] = gridCells[i]
    const x = gridOffsetX + c * cellPitch
    const z = gridOffsetZ + r * cellPitch
    roomPositions.push({
      room: peripheralRooms[i],
      position: [x, 0, z],
      size: ROOM_SIZE,
    })
  }

  let minX = Infinity, maxX = -Infinity
  let minZ = Infinity, maxZ = -Infinity
  for (const rp of roomPositions) {
    const half = rp.size / 2
    minX = Math.min(minX, rp.position[0] - half)
    maxX = Math.max(maxX, rp.position[0] + half)
    minZ = Math.min(minZ, rp.position[2] - half)
    maxZ = Math.max(maxZ, rp.position[2] + half)
  }

  const parkingX = maxX + BUILDING_PADDING + HALLWAY_WIDTH / 2 + PARKING_WIDTH / 2
  const parkingZ = 0
  const parkingRightEdge = parkingX + PARKING_WIDTH / 2 + BUILDING_PADDING
  const leftEdge = minX - BUILDING_PADDING

  const buildingWidth = parkingRightEdge - leftEdge
  const buildingDepth = (maxZ - minZ) + BUILDING_PADDING * 2
  const buildingCenterX = (leftEdge + parkingRightEdge) / 2
  const buildingCenterZ = (minZ - BUILDING_PADDING + maxZ + BUILDING_PADDING) / 2

  const parkingDepth = Math.min(Math.max(PARKING_DEPTH_MIN, ROOM_SIZE * 2), buildingDepth - BUILDING_PADDING * 2)
  const parkingArea = { x: parkingX, z: parkingZ, width: PARKING_WIDTH, depth: parkingDepth }

  const entranceX = 0
  const gridOriginX = gridOffsetX
  const gridOriginZ = gridOffsetZ

  return {
    roomPositions,
    buildingWidth,
    buildingDepth,
    buildingCenterX,
    buildingCenterZ,
    parkingArea,
    entranceX,
    cols,
    rows,
    gridOriginX,
    gridOriginZ,
  }
}
