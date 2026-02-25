// ─── Grid Data Model ────────────────────────────────────────────
// Phase 1: Data model for the 20×20 grid system (v0.3.0)

export type CellType = 'empty' | 'wall' | 'door' | 'furniture' | 'decoration' | 'interaction'
export type InteractionType = 'work' | 'coffee' | 'rest' | 'sleep'
export type Direction = 'north' | 'south' | 'east' | 'west'

export interface GridCell {
  type: CellType
  walkable: boolean
  propId?: string // e.g., 'desk', 'monitor', 'server-rack', 'plant'
  interactionType?: InteractionType
  rotation?: 0 | 90 | 180 | 270 // degrees
  span?: { w: number; d: number } // multi-cell props (desk = 2x1)
  spanParent?: { x: number; z: number } // points to top-left cell of multi-cell prop
}

export interface PropPlacement {
  propId: string
  x: number
  z: number
  type?: CellType
  interactionType?: InteractionType
  rotation?: 0 | 90 | 180 | 270
  span?: { w: number; d: number }
}

export interface RoomBlueprint {
  id: string // e.g., 'headquarters', 'dev-room'
  name: string // display name
  gridWidth: number // cells (20)
  gridDepth: number // cells (20)
  cellSize: number // world units per cell (0.6)
  cells: GridCell[][] // [z][x] — row-major
  placements?: PropPlacement[] // original placements from JSON (for editing)
  doorPositions: { x: number; z: number; facing: Direction }[]
  walkableCenter: { x: number; z: number } // grid coords of center walkable area
  interactionPoints: {
    work: { x: number; z: number }[]
    coffee: { x: number; z: number }[]
    sleep: { x: number; z: number }[]
  }
}

export interface BuildingLayout {
  rooms: { blueprintId: string; gridX: number; gridZ: number }[]
  hallways: { fromRoom: number; toRoom: number }[] // indices into rooms array
}
