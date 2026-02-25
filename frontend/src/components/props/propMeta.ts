/**
 * UI metadata for built-in props.
 * Extends the core PropRegistry with display names, categories, icons, and colors.
 */

export type PropCategory =
  | 'furniture'
  | 'decoration'
  | 'tech'
  | 'comms'
  | 'boards'
  | 'machines'
  | 'generated'

export interface PropMeta {
  propId: string // e.g. 'builtin:desk'
  displayName: string
  category: PropCategory
  icon: string // emoji
  color: string // fallback thumbnail bg color
  tags: string[]
}

export const CATEGORY_LABELS: Record<PropCategory, string> = {
  furniture: '🪑 Furniture',
  decoration: '💡 Decoration',
  tech: '🖥️ Tech',
  comms: '📡 Comms',
  boards: '📋 Boards',
  machines: '⚙️ Machines',
  generated: '✨ Generated',
}

export const CATEGORY_COLORS: Record<PropCategory, string> = {
  furniture: '#7c5c3a',
  decoration: '#3a7c5c',
  tech: '#3a5c7c',
  comms: '#6a3a7c',
  boards: '#7c7c3a',
  machines: '#7c3a3a',
  generated: '#3a6a7c',
}

/** All built-in prop metadata, sorted by category + name */
export const BUILTIN_PROP_META: PropMeta[] = [
  // ── Furniture ──────────────────────────────────────────────────
  {
    propId: 'builtin:desk',
    displayName: 'Desk',
    category: 'furniture',
    icon: '🪑',
    color: '#7c5c3a',
    tags: ['office', 'workspace'],
  },
  {
    propId: 'builtin:chair',
    displayName: 'Chair',
    category: 'furniture',
    icon: '🪑',
    color: '#8c6c4a',
    tags: ['seat', 'office'],
  },
  {
    propId: 'builtin:bench',
    displayName: 'Bench',
    category: 'furniture',
    icon: '🪑',
    color: '#9c7c5a',
    tags: ['seat', 'wood'],
  },
  {
    propId: 'builtin:standing-desk',
    displayName: 'Standing Desk',
    category: 'furniture',
    icon: '🖥️',
    color: '#6c4c2a',
    tags: ['ergonomic', 'office'],
  },
  {
    propId: 'builtin:round-table',
    displayName: 'Round Table',
    category: 'furniture',
    icon: '🍽️',
    color: '#8c7c5a',
    tags: ['meeting', 'table'],
  },
  {
    propId: 'builtin:bean-bag',
    displayName: 'Bean Bag',
    category: 'furniture',
    icon: '🛋️',
    color: '#6366F1',
    tags: ['casual', 'seat', 'lounge'],
  },
  {
    propId: 'builtin:bookshelf',
    displayName: 'Bookshelf',
    category: 'furniture',
    icon: '📚',
    color: '#8c6c3a',
    tags: ['books', 'storage'],
  },
  {
    propId: 'builtin:filing-cabinet',
    displayName: 'Filing Cabinet',
    category: 'furniture',
    icon: '🗄️',
    color: '#778899',
    tags: ['storage', 'office'],
  },
  {
    propId: 'builtin:meeting-table',
    displayName: 'Meeting Table',
    category: 'furniture',
    icon: '🤝',
    color: '#7c6a4a',
    tags: ['meeting', 'interactive'],
  },
  {
    propId: 'builtin:desk-with-monitor',
    displayName: 'Desk + Monitor',
    category: 'furniture',
    icon: '💻',
    color: '#4a6c8c',
    tags: ['combo', 'workstation'],
  },
  {
    propId: 'builtin:desk-with-dual-monitors',
    displayName: 'Desk + Dual Monitors',
    category: 'furniture',
    icon: '💻',
    color: '#3a5c7c',
    tags: ['combo', 'workstation', 'power'],
  },
  {
    propId: 'builtin:standing-desk-with-monitor',
    displayName: 'Standing Desk + Monitor',
    category: 'furniture',
    icon: '🖥️',
    color: '#4a7c8c',
    tags: ['ergonomic', 'combo'],
  },
  {
    propId: 'builtin:desk-with-monitor-headset',
    displayName: 'Desk + Monitor + Headset',
    category: 'furniture',
    icon: '🎧',
    color: '#5a6c8c',
    tags: ['combo', 'comms'],
  },
  {
    propId: 'builtin:desk-with-monitor-tablet',
    displayName: 'Desk + Monitor + Tablet',
    category: 'furniture',
    icon: '🖊️',
    color: '#4a6c7c',
    tags: ['combo', 'creative'],
  },

  // ── Decoration ─────────────────────────────────────────────────
  {
    propId: 'builtin:lamp',
    displayName: 'Lamp',
    category: 'decoration',
    icon: '💡',
    color: '#f59e0b',
    tags: ['light', 'cozy'],
  },
  {
    propId: 'builtin:plant',
    displayName: 'Plant',
    category: 'decoration',
    icon: '🌿',
    color: '#22c55e',
    tags: ['nature', 'green', 'organic'],
  },
  {
    propId: 'builtin:desk-lamp',
    displayName: 'Desk Lamp',
    category: 'decoration',
    icon: '🔦',
    color: '#f59e0b',
    tags: ['light', 'desk'],
  },
  {
    propId: 'builtin:cable-mess',
    displayName: 'Cable Mess',
    category: 'decoration',
    icon: '🔌',
    color: '#444444',
    tags: ['cables', 'developer'],
  },
  {
    propId: 'builtin:easel',
    displayName: 'Easel',
    category: 'decoration',
    icon: '🎨',
    color: '#a0522d',
    tags: ['art', 'creative'],
  },
  {
    propId: 'builtin:color-palette',
    displayName: 'Color Palette',
    category: 'decoration',
    icon: '🎨',
    color: '#ec4899',
    tags: ['art', 'creative', 'design'],
  },
  {
    propId: 'builtin:bar-chart',
    displayName: 'Bar Chart',
    category: 'decoration',
    icon: '📊',
    color: '#6366F1',
    tags: ['data', 'analytics'],
  },
  {
    propId: 'builtin:megaphone',
    displayName: 'Megaphone',
    category: 'decoration',
    icon: '📢',
    color: '#f97316',
    tags: ['marketing', 'comms'],
  },

  // ── Tech ───────────────────────────────────────────────────────
  {
    propId: 'builtin:monitor',
    displayName: 'Monitor',
    category: 'tech',
    icon: '🖥️',
    color: '#2d3748',
    tags: ['screen', 'display'],
  },
  {
    propId: 'builtin:server-rack',
    displayName: 'Server Rack',
    category: 'tech',
    icon: '🖥️',
    color: '#1a202c',
    tags: ['server', 'infrastructure'],
  },
  {
    propId: 'builtin:control-panel',
    displayName: 'Control Panel',
    category: 'tech',
    icon: '🎛️',
    color: '#374151',
    tags: ['controls', 'ops'],
  },
  {
    propId: 'builtin:drawing-tablet',
    displayName: 'Drawing Tablet',
    category: 'tech',
    icon: '🖊️',
    color: '#1e293b',
    tags: ['art', 'design', 'creative'],
  },

  // ── Comms ──────────────────────────────────────────────────────
  {
    propId: 'builtin:satellite-dish',
    displayName: 'Satellite Dish',
    category: 'comms',
    icon: '📡',
    color: '#6a3a7c',
    tags: ['signal', 'antenna'],
  },
  {
    propId: 'builtin:antenna-tower',
    displayName: 'Antenna Tower',
    category: 'comms',
    icon: '📶',
    color: '#5a3a6c',
    tags: ['signal', 'tower'],
  },
  {
    propId: 'builtin:headset',
    displayName: 'Headset',
    category: 'comms',
    icon: '🎧',
    color: '#374151',
    tags: ['audio', 'call', 'support'],
  },
  {
    propId: 'builtin:signal-waves',
    displayName: 'Signal Waves',
    category: 'comms',
    icon: '〰️',
    color: '#3a4a7c',
    tags: ['wireless', 'animated'],
  },
  {
    propId: 'builtin:status-lights',
    displayName: 'Status Lights',
    category: 'comms',
    icon: '🚦',
    color: '#3a3a3a',
    tags: ['status', 'indicator'],
  },

  // ── Boards ─────────────────────────────────────────────────────
  {
    propId: 'builtin:notice-board',
    displayName: 'Notice Board',
    category: 'boards',
    icon: '📌',
    color: '#7c7c3a',
    tags: ['wall', 'notes'],
  },
  {
    propId: 'builtin:whiteboard',
    displayName: 'Whiteboard',
    category: 'boards',
    icon: '🗒️',
    color: '#e5e7eb',
    tags: ['wall', 'brainstorm'],
  },
  {
    propId: 'builtin:mood-board',
    displayName: 'Mood Board',
    category: 'boards',
    icon: '🎭',
    color: '#374151',
    tags: ['wall', 'creative', 'design'],
  },
  {
    propId: 'builtin:presentation-screen',
    displayName: 'Presentation Screen',
    category: 'boards',
    icon: '📽️',
    color: '#1a202c',
    tags: ['wall', 'meeting', 'display'],
  },
  {
    propId: 'builtin:small-screen',
    displayName: 'Small Screen',
    category: 'boards',
    icon: '📺',
    color: '#2d3748',
    tags: ['wall', 'dashboard'],
  },
  {
    propId: 'builtin:wall-clock',
    displayName: 'Wall Clock',
    category: 'boards',
    icon: '🕐',
    color: '#374151',
    tags: ['wall', 'time'],
  },
  {
    propId: 'builtin:gear-mechanism',
    displayName: 'Gear Mechanism',
    category: 'boards',
    icon: '⚙️',
    color: '#555555',
    tags: ['wall', 'animated', 'mechanical'],
  },

  // ── Machines ───────────────────────────────────────────────────
  {
    propId: 'builtin:coffee-machine',
    displayName: 'Coffee Machine',
    category: 'machines',
    icon: '☕',
    color: '#7c3a3a',
    tags: ['break', 'kitchen'],
  },
  {
    propId: 'builtin:water-cooler',
    displayName: 'Water Cooler',
    category: 'machines',
    icon: '💧',
    color: '#3a7c8c',
    tags: ['break', 'hydration'],
  },
  {
    propId: 'builtin:conveyor-belt',
    displayName: 'Conveyor Belt',
    category: 'machines',
    icon: '🏭',
    color: '#444444',
    tags: ['automation', 'factory'],
  },
  {
    propId: 'builtin:fire-extinguisher',
    displayName: 'Fire Extinguisher',
    category: 'machines',
    icon: '🧯',
    color: '#cc2222',
    tags: ['safety', 'red'],
  },
]

/** Build a quick lookup map from propId → PropMeta */
export const PROP_META_BY_ID: Map<string, PropMeta> = new Map(
  BUILTIN_PROP_META.map((m) => [m.propId, m])
)

/** All categories in display order */
export const ALL_CATEGORIES: PropCategory[] = [
  'furniture',
  'decoration',
  'tech',
  'comms',
  'boards',
  'machines',
  'generated',
]
