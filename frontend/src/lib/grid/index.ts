// ─── Grid System — Public API ───────────────────────────────────
// Re-exports everything for easy importing:
//   import { findPath, ROOM_BLUEPRINTS, gridToWorld } from '@/lib/grid'

// Types
export type {
  CellType,
  InteractionType,
  Direction,
  GridCell,
  RoomBlueprint,
  BuildingLayout,
} from './types'

// Blueprint utilities
export {
  createEmptyGrid,
  placeOnGrid,
  placeDoor,
  getWalkableMask,
  findInteractionCells,
  gridToWorld,
  worldToGrid,
} from './blueprintUtils'

// Room blueprints
export {
  ROOM_BLUEPRINTS,
  getBlueprintForRoom,
} from './blueprints'

// Pathfinding
export type { PathNode } from './pathfinding'
export {
  findPath,
  findNearestWalkable,
} from './pathfinding'
