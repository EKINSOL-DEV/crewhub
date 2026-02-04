// ─── Room Blueprints ────────────────────────────────────────────
// 20×20 grid blueprints for all 8 room types + default.
// Cell size: 0.6 units → 20 cells × 0.6 = 12 units (matches roomSize).
// Grid is [z][x], row-major. z=0 is north wall (-Z), z=19 is south wall (+Z).
// x=0 is west wall (-X), x=19 is east wall (+X).
//
// Positions translated from the old RoomProps.tsx hardcoded world coordinates
// (default roomSize=12, s=1, h=6):
//   gridX = Math.round((worldX + halfSize) / cellSize)
//   gridZ = Math.round((worldZ + halfSize) / cellSize)
// where halfSize = 6, cellSize = 0.6
//
// NOTE: Wall-mounted props must be placed within 1 interior cell of a wall
// (x/z = 1 or 18) so GridRoomRenderer can snap them to the wall surface.

import type { RoomBlueprint } from './types'
import { createEmptyGrid, placeOnGrid, placeDoor } from './blueprintUtils'

const GRID_W = 20
const GRID_D = 20
const CELL_SIZE = 0.6

// ─── Headquarters ───────────────────────────────────────────────
// Large desk + monitor (back-left), plant (back-right corner),
// notice board (back wall), coffee machine (front-right), water cooler (front-left)

function createHeadquarters(): RoomBlueprint {
  const grid = createEmptyGrid(GRID_W, GRID_D)

  // Desk with monitor — back-left (world ~(-3.5, +3.5) → grid (4, 16))
  placeOnGrid(grid, 4, 16, 'desk-with-monitor', { span: { w: 2, d: 2 } })

  // Chair — in front of desk (world ~(-2.5, +2.5) → grid (6, 14))

  // Work interaction point — at desk
  placeOnGrid(grid, 5, 14, 'work-point', { type: 'interaction', interactionType: 'work' })

  // Plant — back-right corner (world ~(+4.8, +4.8) → grid (18, 18))
  placeOnGrid(grid, 18, 18, 'plant', { type: 'decoration' })

  // Notice board — back wall center
  placeOnGrid(grid, 10, 18, 'notice-board', { type: 'decoration' })

  // Coffee machine — front-right (world ~(+4.5, -4) → grid (18, 3))
  placeOnGrid(grid, 18, 3, 'coffee-machine')
  placeOnGrid(grid, 17, 3, 'coffee-point', { type: 'interaction', interactionType: 'coffee' })

  // Water cooler — front-left (world ~(-4.5, -4) → grid (2, 3))
  placeOnGrid(grid, 2, 3, 'water-cooler')

  // Sleep corner — keep a free walkable corner (interaction-only)
  placeOnGrid(grid, 2, 18, 'sleep-corner', { type: 'interaction', interactionType: 'sleep' })

  // Door — south wall center
  placeDoor(grid, 9, 19)
  placeDoor(grid, 10, 19)

  return {
    id: 'headquarters',
    name: 'Headquarters',
    gridWidth: GRID_W,
    gridDepth: GRID_D,
    cellSize: CELL_SIZE,
    cells: grid,
    doorPositions: [{ x: 9, z: 19, facing: 'south' }],
    walkableCenter: { x: 10, z: 10 },
    interactionPoints: {
      work: [{ x: 5, z: 14 }],
      coffee: [{ x: 17, z: 3 }],
      sleep: [{ x: 2, z: 18 }],
    },
  }
}

// ─── Dev Room ───────────────────────────────────────────────────
// 2 desks with dual monitors (left + right), server rack (back-right),
// whiteboard (back wall), cable mess (center-back)

function createDevRoom(): RoomBlueprint {
  const grid = createEmptyGrid(GRID_W, GRID_D)

  // Desk 1 with dual monitors — left-back (world ~(-3.5, +3.5) → grid (4, 16))
  placeOnGrid(grid, 4, 16, 'desk-with-dual-monitors', { span: { w: 2, d: 2 } })
  placeOnGrid(grid, 5, 14, 'work-point-1', { type: 'interaction', interactionType: 'work' })

  // Desk 2 with dual monitors — right-back (world ~(+3.5, +3.5) → grid (16, 16))
  placeOnGrid(grid, 16, 16, 'desk-with-dual-monitors', { span: { w: 2, d: 2 } })
  placeOnGrid(grid, 17, 14, 'work-point-2', { type: 'interaction', interactionType: 'work' })

  // Server rack — back-right corner (world ~(+4.8, +5.0) → grid (18, 18))
  // Uses span 2×1, so anchor must stay inside: x=17 covers x=17..18
  placeOnGrid(grid, 17, 18, 'server-rack', { span: { w: 2, d: 1 } })

  // Whiteboard — back wall center
  placeOnGrid(grid, 10, 18, 'whiteboard', { type: 'decoration' })

  // Cable mess — on floor between desks (world ~(0, +3.0) → grid (10, 15))
  placeOnGrid(grid, 10, 15, 'cable-mess', { type: 'decoration' })

  // Sleep corner — front-left
  placeOnGrid(grid, 2, 2, 'sleep-corner', { type: 'interaction', interactionType: 'sleep' })

  // Door — south wall center
  placeDoor(grid, 9, 19)
  placeDoor(grid, 10, 19)

  return {
    id: 'dev-room',
    name: 'Dev Room',
    gridWidth: GRID_W,
    gridDepth: GRID_D,
    cellSize: CELL_SIZE,
    cells: grid,
    doorPositions: [{ x: 9, z: 19, facing: 'south' }],
    walkableCenter: { x: 10, z: 10 },
    interactionPoints: {
      work: [{ x: 5, z: 14 }, { x: 17, z: 14 }],
      coffee: [],
      sleep: [{ x: 2, z: 2 }],
    },
  }
}

// ─── Creative Room ──────────────────────────────────────────────
// Easel (center-left), desk + monitor + drawing tablet (right-back),
// color palette, mood board (back wall), plants

function createCreativeRoom(): RoomBlueprint {
  const grid = createEmptyGrid(GRID_W, GRID_D)

  // Easel — center-left (world ~(-3.5, 0) → grid (4, 10))
  placeOnGrid(grid, 4, 10, 'easel', { span: { w: 2, d: 2 } })

  // Desk with monitor + drawing tablet — right-back (world ~(+3.5, +3.5) → grid (16, 16))
  placeOnGrid(grid, 16, 16, 'desk-with-monitor-tablet', { span: { w: 2, d: 2 } })
  placeOnGrid(grid, 17, 14, 'work-point', { type: 'interaction', interactionType: 'work' })

  // Color palette — near easel (world ~(-2.5, +0.3) → grid (6, 10))
  placeOnGrid(grid, 6, 10, 'color-palette', { type: 'decoration' })

  // Mood board — back wall center
  placeOnGrid(grid, 10, 18, 'mood-board', { type: 'decoration' })

  // Plants
  placeOnGrid(grid, 18, 2, 'plant', { type: 'decoration' })
  placeOnGrid(grid, 2, 18, 'plant', { type: 'decoration' })

  // Sleep corner — front-left
  placeOnGrid(grid, 2, 2, 'sleep-corner', { type: 'interaction', interactionType: 'sleep' })

  // Door — south wall center
  placeDoor(grid, 9, 19)
  placeDoor(grid, 10, 19)

  return {
    id: 'creative-room',
    name: 'Creative Room',
    gridWidth: GRID_W,
    gridDepth: GRID_D,
    cellSize: CELL_SIZE,
    cells: grid,
    doorPositions: [{ x: 9, z: 19, facing: 'south' }],
    walkableCenter: { x: 10, z: 10 },
    interactionPoints: {
      work: [{ x: 17, z: 14 }],
      coffee: [],
      sleep: [{ x: 2, z: 2 }],
    },
  }
}

// ─── Marketing Room ─────────────────────────────────────────────
// Standing desk + monitor (left-back), presentation screen (back wall),
// bar chart (right-center), plant, 

function createMarketingRoom(): RoomBlueprint {
  const grid = createEmptyGrid(GRID_W, GRID_D)

  // Standing desk with monitor — left-back (world ~(-3, +3.5) → grid (5, 16))
  placeOnGrid(grid, 5, 16, 'standing-desk-with-monitor', { span: { w: 3, d: 2 } })
  placeOnGrid(grid, 6, 14, 'work-point', { type: 'interaction', interactionType: 'work' })

  // Presentation screen — back wall center
  placeOnGrid(grid, 10, 18, 'presentation-screen', { type: 'decoration' })

  // Bar chart — right-center (world ~(+3.5, 0) → grid (16, 10))
  placeOnGrid(grid, 16, 10, 'bar-chart', { span: { w: 2, d: 2 } })

  // Plant — back-right corner (world ~(+4.8, +4.8) → grid (18, 18))
  placeOnGrid(grid, 18, 18, 'plant', { type: 'decoration' })

  // Guest chair — right-back-ish (world ~(+3.5, +3) → grid (16, 15))

  // Sleep corner — front-left
  placeOnGrid(grid, 2, 2, 'sleep-corner', { type: 'interaction', interactionType: 'sleep' })

  // Door — south wall center
  placeDoor(grid, 9, 19)
  placeDoor(grid, 10, 19)

  return {
    id: 'marketing-room',
    name: 'Marketing Room',
    gridWidth: GRID_W,
    gridDepth: GRID_D,
    cellSize: CELL_SIZE,
    cells: grid,
    doorPositions: [{ x: 9, z: 19, facing: 'south' }],
    walkableCenter: { x: 10, z: 10 },
    interactionPoints: {
      work: [{ x: 6, z: 14 }],
      coffee: [],
      sleep: [{ x: 2, z: 2 }],
    },
  }
}

// ─── Thinking Room ──────────────────────────────────────────────
// Round table (center), bean bags around it, bookshelf (back-right),
// lamp (front-left corner), whiteboard (left wall)

function createThinkingRoom(): RoomBlueprint {
  const grid = createEmptyGrid(GRID_W, GRID_D)

  // Round table — center (spans 4×4, centered around (10,10))
  placeOnGrid(grid, 8, 8, 'round-table', { span: { w: 4, d: 4 } })

  // Bean bags — around the table (outside the 4×4 span at 8,8-11,11)
  placeOnGrid(grid, 7, 9, 'bean-bag', { type: 'decoration' })
  placeOnGrid(grid, 12, 9, 'bean-bag', { type: 'decoration' })
  placeOnGrid(grid, 10, 12, 'bean-bag', { type: 'decoration' })
  placeOnGrid(grid, 7, 12, 'bean-bag', { type: 'decoration' })

  // Work point — near the table
  placeOnGrid(grid, 10, 13, 'work-point', { type: 'interaction', interactionType: 'work' })

  // Bookshelf — back-right (world ~(+4.8, +5.0) → grid (18, 18))
  // Keep footprint inside the room.
  placeOnGrid(grid, 17, 17, 'bookshelf', { span: { w: 2, d: 2 } })

  // Lamp — front-left corner (world ~(-4.5, -4.5) → grid (2, 2))
  placeOnGrid(grid, 2, 2, 'lamp', { type: 'decoration' })

  // Whiteboard — left wall (world ~(-5.5, 0) → grid (1, 10))
  placeOnGrid(grid, 1, 10, 'whiteboard', { type: 'decoration' })

  // Sleep corner — front-right
  placeOnGrid(grid, 18, 2, 'sleep-corner', { type: 'interaction', interactionType: 'sleep' })

  // Door — south wall center
  placeDoor(grid, 9, 19)
  placeDoor(grid, 10, 19)

  return {
    id: 'thinking-room',
    name: 'Thinking Room',
    gridWidth: GRID_W,
    gridDepth: GRID_D,
    cellSize: CELL_SIZE,
    cells: grid,
    doorPositions: [{ x: 9, z: 19, facing: 'south' }],
    walkableCenter: { x: 10, z: 10 },
    interactionPoints: {
      work: [{ x: 10, z: 13 }],
      coffee: [],
      sleep: [{ x: 18, z: 2 }],
    },
  }
}

// ─── Automation Room ────────────────────────────────────────────
// Wall clock + small screens (back wall), conveyor belt (center),
// gear mechanism (right wall), control panel (front-left)

function createAutomationRoom(): RoomBlueprint {
  const grid = createEmptyGrid(GRID_W, GRID_D)

  // Wall clock — back wall center
  placeOnGrid(grid, 10, 18, 'wall-clock', { type: 'decoration' })

  // Small screens — back wall (two rows). Must be within 1 cell of wall.
  placeOnGrid(grid, 8, 18, 'small-screen', { type: 'decoration' })
  placeOnGrid(grid, 12, 18, 'small-screen', { type: 'decoration' })
  placeOnGrid(grid, 8, 17, 'small-screen', { type: 'decoration' })
  placeOnGrid(grid, 12, 17, 'small-screen', { type: 'decoration' })

  // Conveyor belt — center (world ~(0, -0.5) → grid (10, 9)), spans wide
  placeOnGrid(grid, 6, 9, 'conveyor-belt', { span: { w: 8, d: 2 } })

  // Gear mechanism — right wall (world ~(+5.5, 0) → grid (19, 10))
  // Must be at x=18 to be within 1 interior cell of the wall for snapping.
  placeOnGrid(grid, 18, 10, 'gear-mechanism', { type: 'decoration' })

  // Control panel — front-left (world ~(-4, -4) → grid (3, 3))
  placeOnGrid(grid, 3, 3, 'control-panel', { span: { w: 2, d: 2 } })
  placeOnGrid(grid, 4, 5, 'work-point', { type: 'interaction', interactionType: 'work' })

  // Sleep corner — front-right
  placeOnGrid(grid, 18, 2, 'sleep-corner', { type: 'interaction', interactionType: 'sleep' })

  // Door — south wall center
  placeDoor(grid, 9, 19)
  placeDoor(grid, 10, 19)

  return {
    id: 'automation-room',
    name: 'Automation Room',
    gridWidth: GRID_W,
    gridDepth: GRID_D,
    cellSize: CELL_SIZE,
    cells: grid,
    doorPositions: [{ x: 9, z: 19, facing: 'south' }],
    walkableCenter: { x: 10, z: 10 },
    interactionPoints: {
      work: [{ x: 4, z: 5 }],
      coffee: [],
      sleep: [{ x: 18, z: 2 }],
    },
  }
}

// ─── Comms Room ─────────────────────────────────────────────────
// Satellite dish (back-right), antenna tower (back-left), screens (back wall),
// desk + monitor + headset (front-right), signal waves

function createCommsRoom(): RoomBlueprint {
  const grid = createEmptyGrid(GRID_W, GRID_D)

  // Satellite dish — back-right (world ~(+4.5, +4.5) → grid (18, 18))
  placeOnGrid(grid, 18, 18, 'satellite-dish', { type: 'decoration' })

  // Antenna tower — back-left (world ~(-4.8, +4.8) → grid (2, 18))
  // Keep footprint inside.
  placeOnGrid(grid, 2, 17, 'antenna-tower', { span: { w: 2, d: 2 } })

  // Small screens — back wall
  placeOnGrid(grid, 9, 18, 'small-screen', { type: 'decoration' })
  placeOnGrid(grid, 11, 18, 'small-screen', { type: 'decoration' })
  placeOnGrid(grid, 10, 17, 'small-screen', { type: 'decoration' })

  // Desk with monitor + headset — front-right (world ~(+3.5, -3.5) → grid (16, 4))
  placeOnGrid(grid, 16, 4, 'desk-with-monitor-headset', { span: { w: 2, d: 2 } })
  placeOnGrid(grid, 15, 4, 'work-point', { type: 'interaction', interactionType: 'work' })

  // Signal waves — near antenna (wall-mounted)
  placeOnGrid(grid, 4, 18, 'signal-waves', { type: 'decoration' })

  // Sleep corner — front-left
  placeOnGrid(grid, 2, 2, 'sleep-corner', { type: 'interaction', interactionType: 'sleep' })

  // Door — south wall center
  placeDoor(grid, 9, 19)
  placeDoor(grid, 10, 19)

  return {
    id: 'comms-room',
    name: 'Comms Room',
    gridWidth: GRID_W,
    gridDepth: GRID_D,
    cellSize: CELL_SIZE,
    cells: grid,
    doorPositions: [{ x: 9, z: 19, facing: 'south' }],
    walkableCenter: { x: 10, z: 10 },
    interactionPoints: {
      work: [{ x: 15, z: 4 }],
      coffee: [],
      sleep: [{ x: 2, z: 2 }],
    },
  }
}

// ─── Ops Room ───────────────────────────────────────────────────
// Round table (center), 5 monitors (back wall), status lights (right wall),
// filing cabinets (back-left), fire extinguisher (front-right),

function createOpsRoom(): RoomBlueprint {
  const grid = createEmptyGrid(GRID_W, GRID_D)

  // Round table — center
  placeOnGrid(grid, 8, 8, 'round-table', { span: { w: 4, d: 4 } })

  // Monitors — back wall (row of 3 + row of 2)
  placeOnGrid(grid, 8, 18, 'small-screen', { type: 'decoration' })
  placeOnGrid(grid, 10, 18, 'small-screen', { type: 'decoration' })
  placeOnGrid(grid, 12, 18, 'small-screen', { type: 'decoration' })
  placeOnGrid(grid, 9, 17, 'small-screen', { type: 'decoration' })
  placeOnGrid(grid, 11, 17, 'small-screen', { type: 'decoration' })

  // Status lights — right wall (use two cells for vertical separation)
  placeOnGrid(grid, 18, 10, 'status-lights', { type: 'decoration' })
  placeOnGrid(grid, 18, 12, 'status-lights', { type: 'decoration' })

  // Filing cabinets — back-left
  // Each cabinet spans 1×2, keep inside (z=17 and z=15)
  placeOnGrid(grid, 2, 17, 'filing-cabinet', { span: { w: 1, d: 2 } })
  placeOnGrid(grid, 2, 15, 'filing-cabinet', { span: { w: 1, d: 2 } })

  // Fire extinguisher — front-right (world ~(+5.0, -4.8) → grid (18, 2))
  placeOnGrid(grid, 18, 2, 'fire-extinguisher', { type: 'decoration' })

  // Chairs around table (outside the 4×4 span at 8,8-11,11)

  // Work point — near the table (avoid overwriting the table span)
  placeOnGrid(grid, 10, 13, 'work-point', { type: 'interaction', interactionType: 'work' })

  // Sleep corner — front-left
  placeOnGrid(grid, 2, 2, 'sleep-corner', { type: 'interaction', interactionType: 'sleep' })

  // Door — south wall center
  placeDoor(grid, 9, 19)
  placeDoor(grid, 10, 19)

  return {
    id: 'ops-room',
    name: 'Ops Room',
    gridWidth: GRID_W,
    gridDepth: GRID_D,
    cellSize: CELL_SIZE,
    cells: grid,
    doorPositions: [{ x: 9, z: 19, facing: 'south' }],
    walkableCenter: { x: 10, z: 10 },
    interactionPoints: {
      work: [{ x: 10, z: 13 }],
      coffee: [],
      sleep: [{ x: 2, z: 2 }],
    },
  }
}

// ─── Default Room ───────────────────────────────────────────────
// Simple: desk + monitor, lamp, plant

function createDefaultRoom(): RoomBlueprint {
  const grid = createEmptyGrid(GRID_W, GRID_D)

  // Desk with monitor — back-left
  placeOnGrid(grid, 4, 16, 'desk-with-monitor', { span: { w: 2, d: 2 } })

  // Chair

  // Work point
  placeOnGrid(grid, 5, 14, 'work-point', { type: 'interaction', interactionType: 'work' })

  // Lamp — front-right (world ~(+4.5, -4) → grid (18, 3))
  placeOnGrid(grid, 18, 3, 'lamp', { type: 'decoration' })

  // Plant — back-right (world ~(+4.8, +4.8) → grid (18, 18))
  placeOnGrid(grid, 18, 18, 'plant', { type: 'decoration' })

  // Sleep corner
  placeOnGrid(grid, 2, 2, 'sleep-corner', { type: 'interaction', interactionType: 'sleep' })

  // Door — south wall center
  placeDoor(grid, 9, 19)
  placeDoor(grid, 10, 19)

  return {
    id: 'default',
    name: 'Default Room',
    gridWidth: GRID_W,
    gridDepth: GRID_D,
    cellSize: CELL_SIZE,
    cells: grid,
    doorPositions: [{ x: 9, z: 19, facing: 'south' }],
    walkableCenter: { x: 10, z: 10 },
    interactionPoints: {
      work: [{ x: 5, z: 14 }],
      coffee: [],
      sleep: [{ x: 2, z: 2 }],
    },
  }
}

// ─── Blueprint Registry ─────────────────────────────────────────

export const ROOM_BLUEPRINTS: Record<string, RoomBlueprint> = {
  headquarters: createHeadquarters(),
  'dev-room': createDevRoom(),
  'creative-room': createCreativeRoom(),
  'marketing-room': createMarketingRoom(),
  'thinking-room': createThinkingRoom(),
  'automation-room': createAutomationRoom(),
  'comms-room': createCommsRoom(),
  'ops-room': createOpsRoom(),
  default: createDefaultRoom(),
}

/**
 * Get blueprint for a room by name. Uses fuzzy matching similar to
 * the getRoomType() logic in RoomProps.tsx.
 */
export function getBlueprintForRoom(roomName: string): RoomBlueprint {
  const name = roomName.toLowerCase()

  if (name.includes('headquarter')) return ROOM_BLUEPRINTS.headquarters
  if (name.includes('dev')) return ROOM_BLUEPRINTS['dev-room']
  if (name.includes('creative') || name.includes('design')) return ROOM_BLUEPRINTS['creative-room']
  if (name.includes('marketing')) return ROOM_BLUEPRINTS['marketing-room']
  if (name.includes('thinking') || name.includes('strategy')) return ROOM_BLUEPRINTS['thinking-room']
  if (name.includes('automation') || name.includes('cron')) return ROOM_BLUEPRINTS['automation-room']
  if (name.includes('comms') || name.includes('comm')) return ROOM_BLUEPRINTS['comms-room']
  if (name.includes('ops') || name.includes('operation')) return ROOM_BLUEPRINTS['ops-room']

  return ROOM_BLUEPRINTS.default
}
