/**
 * Zen Mode Layout Types
 * Split-tree model for flexible panel layouts (like tmux)
 */

// ── Panel Types ───────────────────────────────────────────────────

export type PanelType = 
  | 'chat'      // Chat interface with an agent
  | 'sessions'  // List of all sessions
  | 'activity'  // Real-time SSE activity feed
  | 'rooms'     // Room navigation
  | 'tasks'     // Task board
  | 'kanban'    // Kanban board view
  | 'cron'      // Cron jobs viewer
  | 'logs'      // System logs
  | 'docs'      // Documentation browser
  | 'projects'  // Projects panel (overview + documents)
  | 'documents' // Legacy alias for projects
  | 'details'   // Session details (future)
  | 'browser'   // Embedded browser panel
  | 'empty'     // Placeholder panel

// ── Layout Node Types ─────────────────────────────────────────────

/**
 * Leaf node - contains a single panel
 */
export interface LeafNode {
  kind: 'leaf'
  panelId: string
  panelType: PanelType
  // Per-panel state
  agentSessionKey?: string
  agentName?: string
  agentIcon?: string
  // Browser panel state
  browserUrl?: string
}

/**
 * Split node - contains two children arranged horizontally or vertically
 */
export interface SplitNode {
  kind: 'split'
  dir: 'row' | 'col'  // row = horizontal (side by side), col = vertical (stacked)
  ratio: number       // 0-1, how much space the first child takes
  a: LayoutNode       // First child
  b: LayoutNode       // Second child
}

/**
 * A layout node is either a leaf (panel) or a split (container)
 */
export type LayoutNode = LeafNode | SplitNode

// ── Layout State ──────────────────────────────────────────────────

export interface ZenLayoutState {
  root: LayoutNode
  focusedPanelId: string
  maximizedPanelId: string | null
  savedLayout: LayoutNode | null  // Saved layout before maximize
}

// ── Layout Presets ────────────────────────────────────────────────

export type LayoutPreset = 'default' | 'multi-chat' | 'monitor'

export interface LayoutPresetConfig {
  name: string
  description: string
  layout: LayoutNode
}

// ── Panel Info ────────────────────────────────────────────────────
// Re-exported from the panel registry (single source of truth)

export interface PanelInfo {
  id: string
  type: PanelType
  icon: string
  label: string
}

// PANEL_INFO is now derived from the registry.
// This re-export maintains backwards compatibility for all existing imports.
export { PANEL_INFO } from '../registry/PanelRegistry'

// ── Helper Functions ──────────────────────────────────────────────

let panelIdCounter = 0

/**
 * Generate a unique panel ID
 */
export function generatePanelId(): string {
  return `panel-${++panelIdCounter}-${Date.now()}`
}

/**
 * Create a leaf node
 */
export function createLeaf(type: PanelType, sessionKey?: string, agentName?: string, agentIcon?: string): LeafNode {
  return {
    kind: 'leaf',
    panelId: generatePanelId(),
    panelType: type,
    agentSessionKey: sessionKey,
    agentName,
    agentIcon,
  }
}

/**
 * Create a split node
 */
export function createSplit(dir: 'row' | 'col', a: LayoutNode, b: LayoutNode, ratio = 0.5): SplitNode {
  return {
    kind: 'split',
    dir,
    ratio,
    a,
    b,
  }
}

/**
 * Find a panel by ID in the layout tree
 */
export function findPanel(node: LayoutNode, panelId: string): LeafNode | null {
  if (node.kind === 'leaf') {
    return node.panelId === panelId ? node : null
  }
  return findPanel(node.a, panelId) || findPanel(node.b, panelId)
}

/**
 * Get all leaf panels in the layout tree
 */
export function getAllPanels(node: LayoutNode): LeafNode[] {
  if (node.kind === 'leaf') {
    return [node]
  }
  return [...getAllPanels(node.a), ...getAllPanels(node.b)]
}

/**
 * Count total panels in layout
 */
export function countPanels(node: LayoutNode): number {
  if (node.kind === 'leaf') return 1
  return countPanels(node.a) + countPanels(node.b)
}

/**
 * Update a panel in the layout tree (immutable)
 */
export function updatePanel(node: LayoutNode, panelId: string, updates: Partial<LeafNode>): LayoutNode {
  if (node.kind === 'leaf') {
    if (node.panelId === panelId) {
      return { ...node, ...updates }
    }
    return node
  }
  return {
    ...node,
    a: updatePanel(node.a, panelId, updates),
    b: updatePanel(node.b, panelId, updates),
  }
}

/**
 * Remove a panel from the layout tree
 * Returns the sibling if the panel is found, or null if layout would become empty
 */
export function removePanel(node: LayoutNode, panelId: string): LayoutNode | null {
  if (node.kind === 'leaf') {
    return node.panelId === panelId ? null : node
  }
  
  const newA = removePanel(node.a, panelId)
  const newB = removePanel(node.b, panelId)
  
  // If one child was removed, return the other
  if (newA === null) return newB
  if (newB === null) return newA
  
  // Both children still exist
  return { ...node, a: newA, b: newB }
}

/**
 * Split a panel in the layout tree
 */
export function splitPanel(
  node: LayoutNode,
  panelId: string,
  dir: 'row' | 'col',
  newPanelType: PanelType
): LayoutNode {
  if (node.kind === 'leaf') {
    if (node.panelId === panelId) {
      return createSplit(dir, node, createLeaf(newPanelType))
    }
    return node
  }
  return {
    ...node,
    a: splitPanel(node.a, panelId, dir, newPanelType),
    b: splitPanel(node.b, panelId, dir, newPanelType),
  }
}

/**
 * Resize a split at the given panel
 * Finds the parent split and adjusts its ratio
 */
export function resizePanelSplit(
  node: LayoutNode,
  panelId: string,
  deltaRatio: number,
  _isChildA: boolean = true
): LayoutNode {
  if (node.kind === 'leaf') return node
  
  const panelInA = findPanel(node.a, panelId)
  const panelInB = findPanel(node.b, panelId)
  
  if (panelInA) {
    if (node.a.kind === 'leaf' && node.a.panelId === panelId) {
      // This split is the direct parent
      const newRatio = Math.max(0.1, Math.min(0.9, node.ratio + deltaRatio))
      return { ...node, ratio: newRatio }
    }
    return { ...node, a: resizePanelSplit(node.a, panelId, deltaRatio, true) }
  }
  
  if (panelInB) {
    if (node.b.kind === 'leaf' && node.b.panelId === panelId) {
      // This split is the direct parent, but panel is on B side
      const newRatio = Math.max(0.1, Math.min(0.9, node.ratio - deltaRatio))
      return { ...node, ratio: newRatio }
    }
    return { ...node, b: resizePanelSplit(node.b, panelId, deltaRatio, false) }
  }
  
  return node
}
