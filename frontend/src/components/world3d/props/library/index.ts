/**
 * Prop Component Library — Reusable PARTS_DATA for 7 standard parts.
 * Phase 2: Component Library with standardized PARTS_DATA format.
 *
 * Each component defines geometry, default colors, and emissive properties
 * in a format consumable by DynamicProp and the generation pipeline.
 */

export interface LibraryPart {
  type: 'box' | 'cylinder' | 'sphere' | 'cone' | 'torus'
  position: [number, number, number]
  rotation: [number, number, number]
  args: number[]
  color: string
  emissive: boolean
}

export interface LibraryComponent {
  id: string
  name: string
  description: string
  category: 'furniture' | 'tech' | 'decoration' | 'mechanical'
  parts: LibraryPart[]
  /** Suggested placement offset when composing */
  placementOffset: [number, number, number]
}

// ── 1. Desk Legs ────────────────────────────────────────────────

export const DESK_LEGS: LibraryComponent = {
  id: 'desk-legs',
  name: 'Desk Legs',
  description: 'Four standard desk/table legs with cross-brace',
  category: 'furniture',
  placementOffset: [0, 0, 0],
  parts: [
    { type: 'box', position: [-0.35, 0.18, -0.2], rotation: [0, 0, 0], args: [0.05, 0.36, 0.05], color: '#8B6238', emissive: false },
    { type: 'box', position: [0.35, 0.18, -0.2], rotation: [0, 0, 0], args: [0.05, 0.36, 0.05], color: '#8B6238', emissive: false },
    { type: 'box', position: [-0.35, 0.18, 0.2], rotation: [0, 0, 0], args: [0.05, 0.36, 0.05], color: '#8B6238', emissive: false },
    { type: 'box', position: [0.35, 0.18, 0.2], rotation: [0, 0, 0], args: [0.05, 0.36, 0.05], color: '#8B6238', emissive: false },
    { type: 'box', position: [0, 0.08, 0], rotation: [0, 0, 0], args: [0.6, 0.03, 0.03], color: '#6B4F2E', emissive: false },
  ],
}

// ── 2. Monitor Screen ───────────────────────────────────────────

export const MONITOR_SCREEN: LibraryComponent = {
  id: 'monitor-screen',
  name: 'Monitor Screen',
  description: 'Flat screen display with bezel, stand, and indicator LED',
  category: 'tech',
  placementOffset: [0, 0.4, 0],
  parts: [
    { type: 'box', position: [0, 0.5, 0], rotation: [0, 0, 0], args: [0.5, 0.32, 0.03], color: '#1a1a2e', emissive: false },
    { type: 'box', position: [0, 0.5, 0.02], rotation: [0, 0, 0], args: [0.44, 0.26, 0.01], color: '#00ff88', emissive: true },
    { type: 'box', position: [0, 0.32, 0], rotation: [0, 0, 0], args: [0.06, 0.12, 0.04], color: '#333333', emissive: false },
    { type: 'cylinder', position: [0, 0.25, 0], rotation: [0, 0, 0], args: [0.12, 0.14, 0.02, 16], color: '#444444', emissive: false },
    { type: 'sphere', position: [0.2, 0.36, 0.02], rotation: [0, 0, 0], args: [0.012, 8, 8], color: '#00ff00', emissive: true },
  ],
}

// ── 3. Keyboard Keys ────────────────────────────────────────────

export const KEYBOARD_KEYS: LibraryComponent = {
  id: 'keyboard-keys',
  name: 'Keyboard',
  description: 'Compact keyboard with key rows and status LEDs',
  category: 'tech',
  placementOffset: [0, 0.02, 0.15],
  parts: [
    { type: 'box', position: [0, 0.02, 0], rotation: [0, 0, 0], args: [0.35, 0.02, 0.12], color: '#2a2a3e', emissive: false },
    { type: 'box', position: [0, 0.035, -0.03], rotation: [0, 0, 0], args: [0.3, 0.012, 0.02], color: '#444466', emissive: false },
    { type: 'box', position: [0, 0.035, 0], rotation: [0, 0, 0], args: [0.3, 0.012, 0.02], color: '#444466', emissive: false },
    { type: 'box', position: [0, 0.035, 0.03], rotation: [0, 0, 0], args: [0.3, 0.012, 0.02], color: '#444466', emissive: false },
    { type: 'sphere', position: [0.14, 0.035, -0.045], rotation: [0, 0, 0], args: [0.006, 6, 6], color: '#00ff00', emissive: true },
    { type: 'sphere', position: [0.15, 0.035, -0.045], rotation: [0, 0, 0], args: [0.006, 6, 6], color: '#ffaa00', emissive: true },
  ],
}

// ── 4. Chair Seat ───────────────────────────────────────────────

export const CHAIR_SEAT: LibraryComponent = {
  id: 'chair-seat',
  name: 'Chair Seat',
  description: 'Ergonomic seat with backrest and gas-lift column',
  category: 'furniture',
  placementOffset: [0, 0, 0],
  parts: [
    { type: 'box', position: [0, 0.25, 0], rotation: [0, 0, 0], args: [0.38, 0.05, 0.38], color: '#6688AA', emissive: false },
    { type: 'box', position: [0, 0.48, -0.17], rotation: [0, 0, 0], args: [0.38, 0.42, 0.04], color: '#6688AA', emissive: false },
    { type: 'cylinder', position: [0, 0.12, 0], rotation: [0, 0, 0], args: [0.025, 0.025, 0.22, 8], color: '#555555', emissive: false },
    { type: 'cylinder', position: [0, 0.01, 0], rotation: [0, 0, 0], args: [0.15, 0.15, 0.03, 12], color: '#444444', emissive: false },
  ],
}

// ── 5. LED Panel ────────────────────────────────────────────────

export const LED_PANEL: LibraryComponent = {
  id: 'led-panel',
  name: 'LED Panel',
  description: 'Status indicator panel with 4 colored LEDs and mounting plate',
  category: 'tech',
  placementOffset: [0, 0.5, 0.1],
  parts: [
    { type: 'box', position: [0, 0, 0], rotation: [0, 0, 0], args: [0.12, 0.06, 0.015], color: '#333333', emissive: false },
    { type: 'sphere', position: [-0.035, 0, 0.01], rotation: [0, 0, 0], args: [0.01, 8, 8], color: '#00ff00', emissive: true },
    { type: 'sphere', position: [-0.012, 0, 0.01], rotation: [0, 0, 0], args: [0.01, 8, 8], color: '#ffaa00', emissive: true },
    { type: 'sphere', position: [0.012, 0, 0.01], rotation: [0, 0, 0], args: [0.01, 8, 8], color: '#ff4444', emissive: true },
    { type: 'sphere', position: [0.035, 0, 0.01], rotation: [0, 0, 0], args: [0.01, 8, 8], color: '#00aaff', emissive: true },
  ],
}

// ── 6. Decorative Base / Pedestal ───────────────────────────────

export const PEDESTAL_BASE: LibraryComponent = {
  id: 'pedestal-base',
  name: 'Pedestal Base',
  description: 'Tiered display pedestal with accent ring',
  category: 'decoration',
  placementOffset: [0, 0, 0],
  parts: [
    { type: 'cylinder', position: [0, 0.03, 0], rotation: [0, 0, 0], args: [0.25, 0.28, 0.06, 16], color: '#555566', emissive: false },
    { type: 'cylinder', position: [0, 0.08, 0], rotation: [0, 0, 0], args: [0.2, 0.22, 0.04, 16], color: '#666677', emissive: false },
    { type: 'torus', position: [0, 0.06, 0], rotation: [1.5708, 0, 0], args: [0.24, 0.008, 8, 24], color: '#DAA520', emissive: true },
  ],
}

// ── 7. Mechanical Gears ─────────────────────────────────────────

export const MECHANICAL_GEARS: LibraryComponent = {
  id: 'mechanical-gears',
  name: 'Mechanical Gears',
  description: 'Interlocking gear pair for steampunk/mechanical props',
  category: 'mechanical',
  placementOffset: [0, 0.3, 0],
  parts: [
    { type: 'torus', position: [0, 0, 0], rotation: [1.5708, 0, 0], args: [0.12, 0.02, 6, 12], color: '#B87333', emissive: false },
    { type: 'cylinder', position: [0, 0, 0], rotation: [0, 0, 0], args: [0.04, 0.04, 0.03, 8], color: '#888888', emissive: false },
    { type: 'torus', position: [0.18, 0.05, 0], rotation: [1.5708, 0, 0], args: [0.08, 0.015, 6, 10], color: '#B87333', emissive: false },
    { type: 'cylinder', position: [0.18, 0.05, 0], rotation: [0, 0, 0], args: [0.025, 0.025, 0.025, 8], color: '#888888', emissive: false },
  ],
}

// ── Full Library ────────────────────────────────────────────────

export const COMPONENT_LIBRARY: LibraryComponent[] = [
  DESK_LEGS,
  MONITOR_SCREEN,
  KEYBOARD_KEYS,
  CHAIR_SEAT,
  LED_PANEL,
  PEDESTAL_BASE,
  MECHANICAL_GEARS,
]

/** Lookup by id */
export function getLibraryComponent(id: string): LibraryComponent | undefined {
  return COMPONENT_LIBRARY.find(c => c.id === id)
}

/** Get components by category */
export function getComponentsByCategory(category: LibraryComponent['category']): LibraryComponent[] {
  return COMPONENT_LIBRARY.filter(c => c.category === category)
}
