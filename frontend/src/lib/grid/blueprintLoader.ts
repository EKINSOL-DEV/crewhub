// ─── Blueprint Loader ───────────────────────────────────────────
// Converts JSON blueprint data into RoomBlueprint objects and
// registers them via blueprintRegistry.
//
// JSON blueprints use a declarative "placements" array instead of
// imperative placeOnGrid() calls. The loader rebuilds the grid
// cells from these placements, producing identical output.
//
// All JSON is validated via Zod schema. Invalid blueprints are
// logged and skipped (graceful degradation).

import type { RoomBlueprint, CellType, InteractionType, Direction, PropPlacement } from './types'
// CellType and InteractionType used for type assertions in loadBlueprintFromJSON
import { createEmptyGrid, placeOnGrid, placeDoor } from './blueprintUtils'
import { blueprintRegistry } from '@/lib/modding/registries'
import { blueprintJSONSchema, type BlueprintJSON } from './blueprintSchema'

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
      type: p.type as CellType | undefined,
      interactionType: p.interactionType as InteractionType | undefined,
      rotation: p.rotation,
      span: p.span,
    })
  }

  // Place doors — derived from doorPositions (canonical source).
  for (const dp of json.doorPositions) {
    placeDoor(grid, dp.x, dp.z)
    if (dp.facing === 'south' || dp.facing === 'north') {
      placeDoor(grid, dp.x + 1, dp.z)
    } else {
      placeDoor(grid, dp.x, dp.z + 1)
    }
  }

  // Convert placements to PropPlacement type
  const placements: PropPlacement[] = json.placements.map((p) => ({
    propId: p.propId,
    x: p.x,
    z: p.z,
    type: p.type as CellType | undefined,
    interactionType: p.interactionType as InteractionType | undefined,
    rotation: p.rotation,
    span: p.span,
  }))

  return {
    id: json.id,
    name: json.name,
    gridWidth: json.gridWidth,
    gridDepth: json.gridDepth,
    cellSize: json.cellSize,
    cells: grid,
    placements,
    doorPositions: json.doorPositions as { x: number; z: number; facing: Direction }[],
    walkableCenter: json.walkableCenter,
    interactionPoints: json.interactionPoints as RoomBlueprint['interactionPoints'],
  }
}

/**
 * Validate and load a blueprint from raw JSON data.
 * Returns null if validation fails (with console warning).
 */
export function validateAndLoadBlueprint(raw: unknown): RoomBlueprint | null {
  const result = blueprintJSONSchema.safeParse(raw)
  if (!result.success) {
    const id = (raw as Record<string, unknown>)?.id ?? 'unknown'
    console.warn(
      `[blueprintLoader] Skipping invalid blueprint "${id}":`,
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    )
    return null
  }
  return loadBlueprintFromJSON(result.data)
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

const BUILTIN_BLUEPRINT_DATA: unknown[] = [
  headquartersJSON,
  devRoomJSON,
  creativeRoomJSON,
  marketingRoomJSON,
  thinkingRoomJSON,
  automationRoomJSON,
  commsRoomJSON,
  opsRoomJSON,
  defaultJSON,
]

/**
 * Register all built-in blueprints via blueprintRegistry.
 * Called once at module load, similar to registerBuiltinProps().
 * Invalid blueprints are logged and skipped.
 */
export function registerBuiltinBlueprints(): void {
  for (const raw of BUILTIN_BLUEPRINT_DATA) {
    const blueprint = validateAndLoadBlueprint(raw)
    if (blueprint) {
      // Ensure proper namespace prefix for builtin blueprints
      const namespacedId = blueprint.id.includes(':') ? blueprint.id : `builtin:${blueprint.id}`
      blueprintRegistry.register(namespacedId, blueprint, 'builtin')
    }
  }
}

// Self-register on module load
registerBuiltinBlueprints()
