// ─── Blueprint Loader ───────────────────────────────────────────
// Converts JSON blueprint data into RoomBlueprint objects and
// registers them via blueprintRegistry.
//
// JSON blueprints use a declarative "placements" array instead of
// imperative placeOnGrid() calls. The loader rebuilds the grid
// cells from these placements, producing identical output.

import type { RoomBlueprint, CellType, InteractionType, Direction } from './types'
import { createEmptyGrid, placeOnGrid, placeDoor } from './blueprintUtils'
import { blueprintRegistry } from '@/lib/modding/registries'

// ─── JSON Schema Types ──────────────────────────────────────────

interface BlueprintPlacement {
  propId: string
  x: number
  z: number
  type?: CellType          // defaults to 'furniture'
  interactionType?: InteractionType
  rotation?: 0 | 90 | 180 | 270
  span?: { w: number; d: number }
}

interface BlueprintJSON {
  id: string
  name: string
  gridWidth: number
  gridDepth: number
  cellSize: number
  placements: BlueprintPlacement[]
  doors: { x: number; z: number }[]
  doorPositions: { x: number; z: number; facing: Direction }[]
  walkableCenter: { x: number; z: number }
  interactionPoints: {
    work: { x: number; z: number }[]
    coffee: { x: number; z: number }[]
    sleep: { x: number; z: number }[]
  }
}

// ─── Loader ─────────────────────────────────────────────────────

/**
 * Convert a parsed JSON blueprint into a RoomBlueprint.
 * Rebuilds the grid cells by replaying placements through
 * the same createEmptyGrid/placeOnGrid/placeDoor pipeline.
 */
export function loadBlueprintFromJSON(json: BlueprintJSON): RoomBlueprint {
  const grid = createEmptyGrid(json.gridWidth, json.gridDepth)

  // Replay all prop placements
  for (const p of json.placements) {
    placeOnGrid(grid, p.x, p.z, p.propId, {
      type: p.type,
      interactionType: p.interactionType,
      rotation: p.rotation,
      span: p.span,
    })
  }

  // Place doors
  for (const d of json.doors) {
    placeDoor(grid, d.x, d.z)
  }

  return {
    id: json.id,
    name: json.name,
    gridWidth: json.gridWidth,
    gridDepth: json.gridDepth,
    cellSize: json.cellSize,
    cells: grid,
    doorPositions: json.doorPositions,
    walkableCenter: json.walkableCenter,
    interactionPoints: json.interactionPoints,
  }
}

// ─── Built-in Registration ──────────────────────────────────────

// Static imports of JSON blueprint files (bundled by Vite)
import headquartersJSON from './blueprints/headquarters.json'
import devRoomJSON from './blueprints/dev-room.json'
import creativeRoomJSON from './blueprints/creative-room.json'
import marketingRoomJSON from './blueprints/marketing-room.json'
import thinkingRoomJSON from './blueprints/thinking-room.json'
import automationRoomJSON from './blueprints/automation-room.json'
import commsRoomJSON from './blueprints/comms-room.json'
import opsRoomJSON from './blueprints/ops-room.json'
import defaultJSON from './blueprints/default.json'

const BUILTIN_BLUEPRINTS: BlueprintJSON[] = [
  headquartersJSON as BlueprintJSON,
  devRoomJSON as BlueprintJSON,
  creativeRoomJSON as BlueprintJSON,
  marketingRoomJSON as BlueprintJSON,
  thinkingRoomJSON as BlueprintJSON,
  automationRoomJSON as BlueprintJSON,
  commsRoomJSON as BlueprintJSON,
  opsRoomJSON as BlueprintJSON,
  defaultJSON as BlueprintJSON,
]

/**
 * Register all built-in blueprints via blueprintRegistry.
 * Called once at module load, similar to registerBuiltinProps().
 */
export function registerBuiltinBlueprints(): void {
  for (const json of BUILTIN_BLUEPRINTS) {
    const blueprint = loadBlueprintFromJSON(json)
    blueprintRegistry.register(blueprint.id, blueprint, 'builtin')
  }
}

// Self-register on module load
registerBuiltinBlueprints()
