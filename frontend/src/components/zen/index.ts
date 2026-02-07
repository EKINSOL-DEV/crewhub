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
export { ZenRoomsPanel } from './ZenRoomsPanel'
export { ZenTasksPanel } from './ZenTasksPanel'
export { ZenCronPanel } from './ZenCronPanel'
export { ZenLogsPanel } from './ZenLogsPanel'
export { ZenEmptyPanel } from './ZenEmptyPanel'
export { ZenThemePicker } from './ZenThemePicker'
export { ZenCommandPalette, useCommandRegistry, type Command } from './ZenCommandPalette'

// ── Hooks ─────────────────────────────────────────────────────────
export { useZenMode, type UseZenModeReturn } from './hooks/useZenMode'
export { useZenLayout, LAYOUT_PRESETS, type UseZenLayoutReturn } from './hooks/useZenLayout'
export { useZenKeyboard, KEYBOARD_SHORTCUTS, type ShortcutHint } from './hooks/useZenKeyboard'
export { useZenTheme, type UseZenThemeReturn } from './hooks/useZenTheme'

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
export {
  type ZenTheme,
  themeToCSSVariables,
  themes,
  getTheme,
  getAllThemes,
  getThemesByType,
  getDefaultTheme,
  themeInfo,
  type ThemeInfo,
  // Individual themes
  tokyoNight,
  dracula,
  nord,
  solarizedDark,
  solarizedLight,
  gruvboxDark,
  oneDark,
  catppuccinMocha,
  githubLight,
} from './themes'

// ── Utilities ─────────────────────────────────────────────────────
export {
  getContrastRatio,
  meetsWCAG_AA,
  meetsWCAG_AA_Large,
  meetsWCAG_AAA,
  getContrastLevel,
  validateThemeContrast,
  type ContrastIssue,
} from './utils/contrast'
