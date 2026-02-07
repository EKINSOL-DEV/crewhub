/**
 * Zen Mode Components
 * Export all Zen Mode related components, hooks, and types
 */

// ── Components ────────────────────────────────────────────────────
export { ZenMode, ZenModeButton } from './ZenMode'
export { ZenTopBar } from './ZenTopBar'
export { ZenStatusBar } from './ZenStatusBar'
export { ZenChatPanel } from './ZenChatPanel'
export { ZenPanel } from './ZenPanel'
export { ZenPanelContainer } from './ZenPanelContainer'
export { ZenSessionsPanel } from './ZenSessionsPanel'
export { ZenActivityPanel } from './ZenActivityPanel'
export { ZenEmptyPanel } from './ZenEmptyPanel'

// ── Hooks ─────────────────────────────────────────────────────────
export { useZenMode, type UseZenModeReturn } from './hooks/useZenMode'
export { useZenLayout, LAYOUT_PRESETS, type UseZenLayoutReturn } from './hooks/useZenLayout'
export { useZenKeyboard, KEYBOARD_SHORTCUTS, type ShortcutHint } from './hooks/useZenKeyboard'

// ── Types ─────────────────────────────────────────────────────────
export {
  type PanelType,
  type LeafNode,
  type SplitNode,
  type LayoutNode,
  type ZenLayoutState,
  type LayoutPreset,
  type LayoutPresetConfig,
  type PanelInfo,
  PANEL_INFO,
  generatePanelId,
  createLeaf,
  createSplit,
  findPanel,
  getAllPanels,
  countPanels,
  updatePanel,
  removePanel,
  splitPanel,
} from './types/layout'

// ── Themes ────────────────────────────────────────────────────────
export { tokyoNight, themeToCSSVariables, type ZenTheme } from './themes/tokyo-night'
