/**
 * Zen Panel Registry - Single Source of Truth
 * 
 * All panel definitions live here. Command palette, context menus,
 * tab system, and layout persistence all consume this registry.
 * 
 * To add a new panel:
 * 1. Add its ID to the PanelId type
 * 2. Register it in PANEL_REGISTRY below
 * 3. Add its component import in PanelComponents.tsx (lazy or eager)
 * That's it. Everything else auto-populates.
 */

// ── Panel IDs (type-safe) ─────────────────────────────────────────

export type PanelId =
  | 'chat'
  | 'sessions'
  | 'activity'
  | 'rooms'
  | 'tasks'
  | 'kanban'
  | 'cron'
  | 'logs'
  | 'projects'
  | 'docs'       // Documentation browser
  | 'documents'  // Legacy alias for projects
  | 'details'    // Future
  | 'browser'    // Embedded browser panel
  | 'empty'

export type UserPanelId = Exclude<PanelId, 'empty' | 'details' | 'documents' | 'browser'>

// ── Panel Definition ──────────────────────────────────────────────

export type PanelCategory = 'core' | 'productivity' | 'system'

export interface PanelDefinition {
  id: PanelId
  label: string
  icon: string
  description: string
  category: PanelCategory
  /** Keywords for fuzzy search in command palette */
  keywords: string[]
  /** Keyboard shortcut hint in empty panel selector */
  shortcutHint?: string
  /** Whether this panel shows in the "main" grid vs "more" section in empty panel */
  primary: boolean
  /** If true, this panel is hidden from selectors (e.g. 'empty', 'details') */
  hidden?: boolean
  /** Alias for another panel (e.g. documents → projects) */
  aliasOf?: PanelId
}

// ── The Registry ──────────────────────────────────────────────────

const PANEL_DEFINITIONS: PanelDefinition[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: '💬',
    description: 'Chat with an agent',
    category: 'core',
    keywords: ['chat', 'message', 'agent', 'conversation', 'talk'],
    shortcutHint: 'c',
    primary: true,
  },
  {
    id: 'sessions',
    label: 'Sessions',
    icon: '📋',
    description: 'View active sessions',
    category: 'core',
    keywords: ['sessions', 'list', 'agents', 'running'],
    shortcutHint: 's',
    primary: true,
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: '⚡',
    description: 'Real-time event stream',
    category: 'system',
    keywords: ['activity', 'feed', 'events', 'stream', 'realtime'],
    shortcutHint: 'a',
    primary: true,
  },
  {
    id: 'rooms',
    label: 'Rooms',
    icon: '🏠',
    description: 'Browse and filter rooms',
    category: 'core',
    keywords: ['rooms', 'channels', 'browse', 'filter'],
    shortcutHint: 'r',
    primary: true,
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: '✅',
    description: 'Task board overview',
    category: 'productivity',
    keywords: ['tasks', 'todo', 'board', 'backlog', 'checklist'],
    shortcutHint: 't',
    primary: true,
  },
  {
    id: 'kanban',
    label: 'Kanban',
    icon: '📊',
    description: 'Kanban board view',
    category: 'productivity',
    keywords: ['kanban', 'board', 'columns', 'drag', 'workflow'],
    shortcutHint: 'k',
    primary: true,
  },
  {
    id: 'logs',
    label: 'Logs',
    icon: '📜',
    description: 'System logs viewer',
    category: 'system',
    keywords: ['logs', 'system', 'debug', 'output', 'console'],
    shortcutHint: 'l',
    primary: true,
  },
  {
    id: 'cron',
    label: 'Cron',
    icon: '⏰',
    description: 'Scheduled cron jobs',
    category: 'system',
    keywords: ['cron', 'schedule', 'jobs', 'timer', 'periodic'],
    primary: false,
  },
  {
    id: 'docs',
    label: 'Docs',
    icon: '📚',
    description: 'Browse CrewHub documentation',
    category: 'productivity',
    keywords: ['docs', 'documentation', 'markdown', 'guides', 'help', 'readme'],
    shortcutHint: 'd',
    primary: true,
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: '📂',
    description: 'Projects overview & documents',
    category: 'productivity',
    keywords: ['projects', 'documents', 'files', 'overview', 'docs'],
    primary: false,
  },
  // ── Hidden / Internal ──────────────────────────────
  {
    id: 'documents',
    label: 'Projects',
    icon: '📂',
    description: 'Projects overview & documents',
    category: 'productivity',
    keywords: [],
    primary: false,
    hidden: true,
    aliasOf: 'projects',
  },
  {
    id: 'details',
    label: 'Details',
    icon: '🔍',
    description: 'Session details',
    category: 'core',
    keywords: [],
    primary: false,
    hidden: true,
  },
  {
    id: 'browser',
    label: 'Browser',
    icon: '🌐',
    description: 'Embedded browser — open any URL alongside your work',
    category: 'productivity',
    keywords: ['browser', 'web', 'url', 'iframe', 'http', 'internet', 'search', 'google'],
    shortcutHint: 'b',
    primary: true,
  },
  {
    id: 'empty',
    label: 'Empty',
    icon: '◻️',
    description: 'Empty panel placeholder',
    category: 'core',
    keywords: [],
    primary: false,
    hidden: true,
  },
]

// ── Lookup Maps (built once) ──────────────────────────────────────

const _byId = new Map<PanelId, PanelDefinition>()
for (const def of PANEL_DEFINITIONS) {
  _byId.set(def.id, def)
}

// ── Public API ────────────────────────────────────────────────────

/** Get a panel definition by ID */
export function getPanelDef(id: PanelId): PanelDefinition {
  return _byId.get(id) || _byId.get('empty')!
}

/** All panel definitions (including hidden) */
export function getAllPanelDefs(): PanelDefinition[] {
  return PANEL_DEFINITIONS
}

/** Only user-visible panels (for selectors, menus) */
export function getVisiblePanelDefs(): PanelDefinition[] {
  return PANEL_DEFINITIONS.filter(d => !d.hidden)
}

/** Primary panels (shown in main grid of empty panel) */
export function getPrimaryPanelDefs(): PanelDefinition[] {
  return PANEL_DEFINITIONS.filter(d => !d.hidden && d.primary)
}

/** Secondary panels (shown in "More" section) */
export function getSecondaryPanelDefs(): PanelDefinition[] {
  return PANEL_DEFINITIONS.filter(d => !d.hidden && !d.primary)
}

/** Panel IDs for type picker / context menu (visible, non-empty) */
export function getSelectablePanelIds(): PanelId[] {
  return PANEL_DEFINITIONS.filter(d => !d.hidden && d.id !== 'empty').map(d => d.id)
}

/** 
 * PANEL_INFO compat — drop-in replacement for the old PANEL_INFO record.
 * Used by components that just need { icon, label, type } by PanelType.
 */
export const PANEL_INFO: Record<string, { type: string; icon: string; label: string }> = 
  Object.fromEntries(
    PANEL_DEFINITIONS.map(d => [d.id, { type: d.id, icon: d.icon, label: d.label }])
  )

/**
 * Generate command palette entries for "Add Panel" from the registry.
 * Pass onAddPanel callback, get back Command[] array.
 */
export function getPanelCommands(onAddPanel: (type: string) => void): Array<{
  id: string
  label: string
  description: string
  icon: string
  category: 'panel'
  action: () => void
}> {
  return getVisiblePanelDefs()
    .filter(d => d.id !== 'empty')
    .map(d => ({
      id: `panel.add.${d.id}`,
      label: `Add ${d.label} Panel`,
      description: d.description,
      icon: d.icon,
      category: 'panel' as const,
      action: () => onAddPanel(d.id),
    }))
}
