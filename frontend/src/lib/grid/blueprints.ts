// ─── Room Blueprints ────────────────────────────────────────────
// 20×20 grid blueprints for all 8 room types + default.
// Cell size: 0.6 units → 20 cells × 0.6 = 12 units (matches roomSize).
// Grid is [z][x], row-major. z=0 is north wall, z=19 is south wall.
// x=0 is west wall, x=19 is east wall.
//
// Positions translated from RoomProps.tsx hardcoded world coordinates:
//   gridX = Math.round((worldX + halfSize) / cellSize)
//   gridZ = Math.round((worldZ + halfSize) / cellSize)
// where halfSize = 6, cellSize = 0.6

import type { RoomBlueprint } from './types'
import { createEmptyGrid, placeOnGrid, placeDoor } from './blueprintUtils'

const GRID_W = 20
const GRID_D = 20
const CELL_SIZE = 0.6

// ─── Headquarters ───────────────────────────────────────────────
// Large desk + monitor (back-left), chair, plant (front-right corner),
// notice board (back wall), coffee machine (right-front), water cooler (left-front)

function createHeadquarters(): RoomBlueprint {
  const grid = createEmptyGrid(GRID_W, GRID_D)

  // Desk with monitor — back-left area (~(-3.5, 3.5) → grid (4, 4))
  placeOnGrid(grid, 3, 3, 'desk-with-monitor', { span: { w: 2, d: 2 } })

  // Chair — in front of desk (~(-1.5, 1.5) → grid (6, 6))
  placeOnGrid(grid, 5, 5, 'chair')

  // Work interaction point — at desk
  placeOnGrid(grid, 5, 4, 'work-point', { type: 'interaction', interactionType: 'work' })

  // Plant — front-right corner (~(3.8, 3.8) → grid (16, 16))
  placeOnGrid(grid, 17, 2, 'plant', { type: 'decoration' })

  // Notice board — back wall center
  // (wall-mounted, mark cell as decoration)
  placeOnGrid(grid, 10, 1, 'notice-board', { type: 'decoration' })

  // Coffee machine — right-side front (~(3.5, -4) → grid (16, 14))
  placeOnGrid(grid, 16, 14, 'coffee-machine')
  placeOnGrid(grid, 15, 14, 'coffee-point', { type: 'interaction', interactionType: 'coffee' })

  // Water cooler — left-side front (~(-4.5, -4) → grid (3, 14))
  placeOnGrid(grid, 3, 14, 'water-cooler')

  // Sleep corner — front-right (~(4, 4) → grid (17, 17))
  placeOnGrid(grid, 17, 17, 'sleep-corner', { type: 'interaction', interactionType: 'sleep' })

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
      work: [{ x: 5, z: 4 }],
      coffee: [{ x: 15, z: 14 }],
      sleep: [{ x: 17, z: 17 }],
    },
  }
}

// ─── Dev Room ───────────────────────────────────────────────────
// 2 desks with dual monitors (left + right), server rack (back-right),
// whiteboard (back wall), cable mess (center-back), desk lamp

function createDevRoom(): RoomBlueprint {
  const grid = createEmptyGrid(GRID_W, GRID_D)

  // Desk 1 with dual monitors — left side (~(-3.5, 3.5) → grid (4, 4))
  placeOnGrid(grid, 3, 3, 'desk-with-dual-monitors', { span: { w: 2, d: 2 } })
  placeOnGrid(grid, 4, 5, 'chair')

  // Work point desk 1
  placeOnGrid(grid, 3, 5, 'work-point-1', { type: 'interaction', interactionType: 'work' })

  // Desk 2 with dual monitors — right side (~(3.5, 3.5) → grid (15, 4))
  placeOnGrid(grid, 15, 3, 'desk-with-dual-monitors', { span: { w: 2, d: 2 } })
  placeOnGrid(grid, 15, 5, 'chair')

  // Work point desk 2
  placeOnGrid(grid, 16, 5, 'work-point-2', { type: 'interaction', interactionType: 'work' })

  // Server rack — back-right (~(3.8, 4) → grid (17, 2))
  placeOnGrid(grid, 17, 2, 'server-rack', { span: { w: 2, d: 1 } })

  // Whiteboard — back wall center (wall-mounted)
  placeOnGrid(grid, 9, 1, 'whiteboard', { type: 'decoration' })
  placeOnGrid(grid, 10, 1, 'whiteboard', { type: 'decoration' })

  // Cable mess — floor between desks (~(0, 3) → grid (10, 6))
  placeOnGrid(grid, 10, 6, 'cable-mess', { type: 'decoration' })

  // Desk lamp on desk 1 (decoration on desk, no extra cell)

  // Sleep corner — back-left (~(-4, -4) → grid (2, 17))
  placeOnGrid(grid, 2, 17, 'sleep-corner', { type: 'interaction', interactionType: 'sleep' })

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
      work: [{ x: 3, z: 5 }, { x: 16, z: 5 }],
      coffee: [],
      sleep: [{ x: 2, z: 17 }],
    },
  }
}

// ─── Creative Room ──────────────────────────────────────────────
// Easel (center-left), desk + monitor + drawing tablet (right),
// color palette, mood board (back wall), plants

function createCreativeRoom(): RoomBlueprint {
  const grid = createEmptyGrid(GRID_W, GRID_D)

  // Easel — center-left (~(-3.5, 0) → grid (4, 10))
  placeOnGrid(grid, 4, 9, 'easel', { span: { w: 2, d: 2 } })

  // Desk with monitor + drawing tablet — right side (~(3.5, 3.5) → grid (15, 4))
  placeOnGrid(grid, 14, 3, 'desk-with-monitor-tablet', { span: { w: 2, d: 2 } })
  placeOnGrid(grid, 16, 5, 'chair')

  // Work point at desk
  placeOnGrid(grid, 14, 5, 'work-point', { type: 'interaction', interactionType: 'work' })

  // Color palette — near easel (~(-1, 0.3) → grid (7, 10))
  placeOnGrid(grid, 7, 10, 'color-palette', { type: 'decoration' })

  // Mood board — back wall center
  placeOnGrid(grid, 9, 1, 'mood-board', { type: 'decoration' })
  placeOnGrid(grid, 10, 1, 'mood-board', { type: 'decoration' })

  // Plants
  placeOnGrid(grid, 17, 16, 'plant', { type: 'decoration' })
  placeOnGrid(grid, 2, 2, 'plant', { type: 'decoration' })

  // Sleep corner — front-left
  placeOnGrid(grid, 2, 17, 'sleep-corner', { type: 'interaction', interactionType: 'sleep' })

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
      work: [{ x: 14, z: 5 }],
      coffee: [],
      sleep: [{ x: 2, z: 17 }],
    },
  }
}

// ─── Marketing Room ─────────────────────────────────────────────
// Standing desk + monitor (left-back), presentation screen (back wall),
// bar chart (right-center), megaphone (on desk), plant, chair

function createMarketingRoom(): RoomBlueprint {
  const grid = createEmptyGrid(GRID_W, GRID_D)

  // Standing desk with monitor — left-back (~(-2, 3.5) → grid (5, 4))
  placeOnGrid(grid, 4, 3, 'standing-desk-with-monitor', { span: { w: 3, d: 2 } })

  // Work point in front of standing desk
  placeOnGrid(grid, 5, 5, 'work-point', { type: 'interaction', interactionType: 'work' })

  // Presentation screen — back wall center
  placeOnGrid(grid, 9, 1, 'presentation-screen', { type: 'decoration' })
  placeOnGrid(grid, 10, 1, 'presentation-screen', { type: 'decoration' })

  // Bar chart — right side (~(3.5, 0) → grid (15, 10))
  placeOnGrid(grid, 15, 9, 'bar-chart', { span: { w: 2, d: 2 } })

  // Megaphone — decoration on desk (no separate cell)

  // Plant — front-right corner
  placeOnGrid(grid, 17, 2, 'plant', { type: 'decoration' })

  // Guest chair — right-back (~(3.5, 3) → grid (15, 6))
  placeOnGrid(grid, 15, 6, 'chair')

  // Sleep corner — front-left
  placeOnGrid(grid, 2, 17, 'sleep-corner', { type: 'interaction', interactionType: 'sleep' })

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
      work: [{ x: 5, z: 5 }],
      coffee: [],
      sleep: [{ x: 2, z: 17 }],
    },
  }
}

// ─── Thinking Room ──────────────────────────────────────────────
// Round table (center), bean bags around it, bookshelf (back-right),
// lamp (front-left corner), whiteboard (left wall)

function createThinkingRoom(): RoomBlueprint {
  const grid = createEmptyGrid(GRID_W, GRID_D)

  // Round table — center (~(0, 0) → grid (9-10, 9-10))
  placeOnGrid(grid, 8, 8, 'round-table', { span: { w: 4, d: 4 } })

  // Bean bags around the table
  placeOnGrid(grid, 6, 12, 'bean-bag', { type: 'decoration' })  // bottom-left of table
  placeOnGrid(grid, 13, 11, 'bean-bag', { type: 'decoration' }) // right of table
  placeOnGrid(grid, 10, 6, 'bean-bag', { type: 'decoration' })  // above table
  placeOnGrid(grid, 6, 8, 'bean-bag', { type: 'decoration' })   // left of table

  // Work point — at table
  placeOnGrid(grid, 7, 10, 'work-point', { type: 'interaction', interactionType: 'work' })

  // Bookshelf — back-right (~(3.8, 4) → grid (17, 2))
  placeOnGrid(grid, 17, 2, 'bookshelf', { span: { w: 2, d: 2 } })

  // Lamp — front-left corner (~(-4.5, -4.5) → grid (2, 16))
  placeOnGrid(grid, 2, 16, 'lamp', { type: 'decoration' })

  // Whiteboard — left wall (~(-5.5, 0) → grid (1, 10))
  placeOnGrid(grid, 1, 9, 'whiteboard', { type: 'decoration' })
  placeOnGrid(grid, 1, 10, 'whiteboard', { type: 'decoration' })

  // Sleep corner — front-left
  placeOnGrid(grid, 2, 17, 'sleep-corner', { type: 'interaction', interactionType: 'sleep' })

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
    walkableCenter: { x: 10, z: 14 },
    interactionPoints: {
      work: [{ x: 7, z: 10 }],
      coffee: [],
      sleep: [{ x: 2, z: 17 }],
    },
  }
}

// ─── Automation Room ────────────────────────────────────────────
// Wall clock (back wall), 4 small screens (back wall), conveyor belt (center),
// gear mechanism (right wall), control panel (front-left)

function createAutomationRoom(): RoomBlueprint {
  const grid = createEmptyGrid(GRID_W, GRID_D)

  // Wall clock — back wall center (wall-mounted)
  placeOnGrid(grid, 10, 1, 'wall-clock', { type: 'decoration' })

  // Small screens — back wall (2 on each side)
  placeOnGrid(grid, 5, 1, 'small-screen', { type: 'decoration' })
  placeOnGrid(grid, 15, 1, 'small-screen', { type: 'decoration' })
  placeOnGrid(grid, 5, 3, 'small-screen', { type: 'decoration' })
  placeOnGrid(grid, 15, 3, 'small-screen', { type: 'decoration' })

  // Conveyor belt — center (~(0, -0.5) → grid (10, 11)), spans wide
  placeOnGrid(grid, 6, 10, 'conveyor-belt', { span: { w: 8, d: 2 } })

  // Gear mechanism — right wall (~(5.5, 0) → grid (18, 10))
  placeOnGrid(grid, 18, 8, 'gear-mechanism', { type: 'decoration' })

  // Control panel — front-left (~(-4, -4) → grid (3, 14))
  placeOnGrid(grid, 3, 14, 'control-panel', { span: { w: 2, d: 2 } })
  placeOnGrid(grid, 3, 16, 'work-point', { type: 'interaction', interactionType: 'work' })

  // Sleep corner — front-right
  placeOnGrid(grid, 17, 17, 'sleep-corner', { type: 'interaction', interactionType: 'sleep' })

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
    walkableCenter: { x: 10, z: 14 },
    interactionPoints: {
      work: [{ x: 3, z: 16 }],
      coffee: [],
      sleep: [{ x: 17, z: 17 }],
    },
  }
}

// ─── Comms Room ─────────────────────────────────────────────────
// Satellite dish (top-right), antenna tower (top-left), screens (back wall),
// desk + monitor + headset (bottom-right), signal waves

function createCommsRoom(): RoomBlueprint {
  const grid = createEmptyGrid(GRID_W, GRID_D)

  // Satellite dish — top-right (wall-mounted, mark area)
  placeOnGrid(grid, 16, 2, 'satellite-dish', { type: 'decoration' })

  // Antenna tower — top-left (~(-3.8, 3.8) → grid (2, 2))
  placeOnGrid(grid, 2, 2, 'antenna-tower', { span: { w: 2, d: 2 } })

  // Small screens — back wall
  placeOnGrid(grid, 7, 1, 'small-screen', { type: 'decoration' })
  placeOnGrid(grid, 12, 1, 'small-screen', { type: 'decoration' })
  placeOnGrid(grid, 10, 3, 'small-screen', { type: 'decoration' })

  // Desk with monitor + headset — bottom-right (~(3.5, -3.5) → grid (15, 15))
  placeOnGrid(grid, 14, 14, 'desk-with-monitor-headset', { span: { w: 2, d: 2 } })
  placeOnGrid(grid, 14, 16, 'chair')

  // Work point at desk
  placeOnGrid(grid, 15, 16, 'work-point', { type: 'interaction', interactionType: 'work' })

  // Signal waves (decoration, doesn't block movement)
  placeOnGrid(grid, 2, 1, 'signal-waves', { type: 'decoration' })

  // Sleep corner — front-left
  placeOnGrid(grid, 2, 17, 'sleep-corner', { type: 'interaction', interactionType: 'sleep' })

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
      work: [{ x: 15, z: 16 }],
      coffee: [],
      sleep: [{ x: 2, z: 17 }],
    },
  }
}

// ─── Ops Room ───────────────────────────────────────────────────
// Round table (center) with dashboard surface, 5 monitors (back wall),
// status lights (right wall), filing cabinets (back-left), fire extinguisher,
// 3 chairs around table

function createOpsRoom(): RoomBlueprint {
  const grid = createEmptyGrid(GRID_W, GRID_D)

  // Round table + dashboard — center
  placeOnGrid(grid, 8, 8, 'round-table', { span: { w: 4, d: 4 } })
  // Dashboard surface is decoration on table (same cells)

  // Monitors — back wall (row of 3 + row of 2)
  placeOnGrid(grid, 5, 1, 'small-screen', { type: 'decoration' })
  placeOnGrid(grid, 10, 1, 'small-screen', { type: 'decoration' })
  placeOnGrid(grid, 15, 1, 'small-screen', { type: 'decoration' })
  placeOnGrid(grid, 7, 3, 'small-screen', { type: 'decoration' })
  placeOnGrid(grid, 13, 3, 'small-screen', { type: 'decoration' })

  // Status lights — right wall
  placeOnGrid(grid, 18, 8, 'status-lights', { type: 'decoration' })
  placeOnGrid(grid, 18, 10, 'status-lights', { type: 'decoration' })

  // Filing cabinets — back-left (~(-3.8, 3.8) → grid (2, 2))
  placeOnGrid(grid, 2, 2, 'filing-cabinet', { span: { w: 1, d: 2 } })
  placeOnGrid(grid, 2, 4, 'filing-cabinet', { span: { w: 1, d: 2 } })

  // Fire extinguisher — near entrance right (~(4, -3.8) → grid (17, 16))
  placeOnGrid(grid, 17, 16, 'fire-extinguisher', { type: 'decoration' })

  // Chairs around table
  placeOnGrid(grid, 6, 10, 'chair')   // left of table
  placeOnGrid(grid, 13, 10, 'chair')  // right of table
  placeOnGrid(grid, 10, 13, 'chair')  // below table

  // Work point — at table
  placeOnGrid(grid, 10, 7, 'work-point', { type: 'interaction', interactionType: 'work' })

  // Sleep corner — front-left
  placeOnGrid(grid, 2, 17, 'sleep-corner', { type: 'interaction', interactionType: 'sleep' })

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
    walkableCenter: { x: 10, z: 14 },
    interactionPoints: {
      work: [{ x: 10, z: 7 }],
      coffee: [],
      sleep: [{ x: 2, z: 17 }],
    },
  }
}

// ─── Default Room ───────────────────────────────────────────────
// Simple: desk + monitor, chair, lamp, plant

function createDefaultRoom(): RoomBlueprint {
  const grid = createEmptyGrid(GRID_W, GRID_D)

  // Desk with monitor — back-left
  placeOnGrid(grid, 3, 3, 'desk-with-monitor', { span: { w: 2, d: 2 } })

  // Chair
  placeOnGrid(grid, 5, 5, 'chair')

  // Work point
  placeOnGrid(grid, 4, 5, 'work-point', { type: 'interaction', interactionType: 'work' })

  // Lamp — right-front (~(3.5, -4) → grid (16, 14))
  placeOnGrid(grid, 16, 14, 'lamp', { type: 'decoration' })

  // Plant — front-right (~(3.8, 3.8) → grid (17, 2))
  placeOnGrid(grid, 17, 2, 'plant', { type: 'decoration' })

  // Sleep corner — front-right
  placeOnGrid(grid, 17, 17, 'sleep-corner', { type: 'interaction', interactionType: 'sleep' })

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
      work: [{ x: 4, z: 5 }],
      coffee: [],
      sleep: [{ x: 17, z: 17 }],
    },
  }
}

// ─── Blueprint Registry ─────────────────────────────────────────

export const ROOM_BLUEPRINTS: Record<string, RoomBlueprint> = {
  'headquarters': createHeadquarters(),
  'dev-room': createDevRoom(),
  'creative-room': createCreativeRoom(),
  'marketing-room': createMarketingRoom(),
  'thinking-room': createThinkingRoom(),
  'automation-room': createAutomationRoom(),
  'comms-room': createCommsRoom(),
  'ops-room': createOpsRoom(),
  'default': createDefaultRoom(),
}

/**
 * Get blueprint for a room by name. Uses fuzzy matching similar to
 * the getRoomType() logic in RoomProps.tsx.
 */
export function getBlueprintForRoom(roomName: string): RoomBlueprint {
  const name = roomName.toLowerCase()

  if (name.includes('headquarter')) return ROOM_BLUEPRINTS['headquarters']
  if (name.includes('dev')) return ROOM_BLUEPRINTS['dev-room']
  if (name.includes('creative') || name.includes('design')) return ROOM_BLUEPRINTS['creative-room']
  if (name.includes('marketing')) return ROOM_BLUEPRINTS['marketing-room']
  if (name.includes('thinking') || name.includes('strategy')) return ROOM_BLUEPRINTS['thinking-room']
  if (name.includes('automation') || name.includes('cron')) return ROOM_BLUEPRINTS['automation-room']
  if (name.includes('comms') || name.includes('comm')) return ROOM_BLUEPRINTS['comms-room']
  if (name.includes('ops') || name.includes('operation')) return ROOM_BLUEPRINTS['ops-room']

  return ROOM_BLUEPRINTS['default']
}
