/**
 * Bot placement position helpers and debug bot utilities.
 * Pure functions — no React imports.
 */
import type { CrewSession } from '@/lib/api'
import type { DebugBot } from '@/hooks/useDebugBots'
import type { PathNode } from '@/lib/grid/pathfinding'
import { gridToWorld } from '@/lib/grid'

// ─── Bot Position Helpers ──────────────────────────────────────

export function getBotPositionsInRoom(
  roomPos: [number, number, number],
  roomSize: number,
  botCount: number
): [number, number, number][] {
  const positions: [number, number, number][] = []
  const floorY = roomPos[1] + 0.16
  const margin = 2.5

  if (botCount === 0) return positions
  if (botCount === 1) {
    positions.push([roomPos[0], floorY, roomPos[2] + 0.5])
    return positions
  }

  const availableWidth = roomSize - margin * 2
  const cols = Math.min(botCount, 3)
  const rows = Math.ceil(botCount / cols)
  const spacingX = availableWidth / (cols + 1)
  const spacingZ = availableWidth / (rows + 1)

  for (let i = 0; i < botCount; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = roomPos[0] - availableWidth / 2 + (col + 1) * spacingX
    const z = roomPos[2] - availableWidth / 2 + (row + 1) * spacingZ
    positions.push([x, floorY, z])
  }
  return positions
}

export function getBotPositionsInParking(
  parkingX: number,
  parkingZ: number,
  parkingWidth: number,
  parkingDepth: number,
  botCount: number
): [number, number, number][] {
  const positions: [number, number, number][] = []
  const floorY = 0.14
  const margin = 2

  if (botCount === 0) return positions

  const availableWidth = parkingWidth - margin * 2
  const availableDepth = parkingDepth - margin * 2
  const cols = Math.min(botCount, 3)
  const rows = Math.ceil(botCount / cols)
  const spacingX = availableWidth / (cols + 1)
  const spacingZ = availableDepth / (rows + 1)

  for (let i = 0; i < botCount; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = parkingX - availableWidth / 2 + (col + 1) * spacingX
    const z = parkingZ - availableDepth / 2 + (row + 1) * spacingZ
    positions.push([x, floorY, z])
  }
  return positions
}

/**
 * Spawn bots on shuffled patrol waypoints instead of a uniform grid.
 * Falls back to getBotPositionsInRoom when waypoints are unavailable.
 */
export function getGridAwareBotPositions(
  roomPos: [number, number, number],
  roomSize: number,
  botCount: number,
  waypoints: PathNode[],
  cellSize: number,
  gridWidth: number,
  gridDepth: number
): [number, number, number][] {
  if (botCount === 0) return []
  if (waypoints.length === 0) {
    return getBotPositionsInRoom(roomPos, roomSize, botCount)
  }

  const floorY = roomPos[1] + 0.16
  const roomCenterX = roomPos[0]
  const roomCenterZ = roomPos[2]

  // Shuffle waypoints for variety
  const shuffled = [...waypoints].sort(() => Math.random() - 0.5)

  const positions: [number, number, number][] = []
  for (let i = 0; i < botCount; i++) {
    const wp = shuffled[i % shuffled.length]
    const [relX, , relZ] = gridToWorld(wp.x, wp.z, cellSize, gridWidth, gridDepth)
    positions.push([roomCenterX + relX, floorY, roomCenterZ + relZ])
  }

  return positions
}

// ─── Debug Bot Utilities ────────────────────────────────────────

export function debugBotToCrewSession(bot: DebugBot): CrewSession {
  const now = Date.now()
  let updatedAt = now
  if (bot.status === 'idle') {
    updatedAt = now - 10_000
  } else if (bot.status === 'sleeping') {
    updatedAt = now - 600_000
  } else if (bot.status === 'offline') {
    updatedAt = now - 7_200_000
  }

  return {
    key: `debug:${bot.id}`,
    kind: 'debug',
    channel: 'debug',
    displayName: `🧪 ${bot.name}`,
    label: `debug-${bot.status}`,
    updatedAt,
    sessionId: bot.id,
    model: 'debug-bot',
  }
}

export function isDebugSession(key: string): boolean {
  return key.startsWith('debug:debug-')
}
