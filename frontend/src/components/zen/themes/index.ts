/**
 * Zen Mode Theme Registry
 * Exports all themes and utility functions for theme management
 */

import { tokyoNight, type ZenTheme, themeToCSSVariables, themeToTailwindVars } from './tokyo-night'
import { dracula } from './dracula'
import { nord } from './nord'
import { solarizedDark } from './solarized-dark'
import { solarizedLight } from './solarized-light'
import { gruvboxDark } from './gruvbox-dark'
import { oneDark } from './one-dark'
import { catppuccinMocha } from './catppuccin-mocha'
import { githubLight } from './github-light'

// ── Re-export Types ───────────────────────────────────────────────

export type { ZenTheme }
export { themeToCSSVariables, themeToTailwindVars }

// ── All Themes ────────────────────────────────────────────────────

export const themes: ZenTheme[] = [
  tokyoNight,
  dracula,
  nord,
  solarizedDark,
  solarizedLight,
  gruvboxDark,
  oneDark,
  catppuccinMocha,
  githubLight,
]

// ── Theme Registry ────────────────────────────────────────────────

const themeMap = new Map<string, ZenTheme>(themes.map((theme) => [theme.id, theme]))

/**
 * Get a theme by its ID
 */
export function getTheme(id: string): ZenTheme | undefined {
  return themeMap.get(id)
}

/**
 * Get all available themes
 */
export function getAllThemes(): ZenTheme[] {
  return themes
}

/**
 * Get themes filtered by type (dark/light)
 */
export function getThemesByType(type: 'dark' | 'light'): ZenTheme[] {
  return themes.filter((theme) => theme.type === type)
}

/**
 * Get the default theme (Github Light)
 */
export function getDefaultTheme(): ZenTheme {
  return githubLight
}

// ── Individual Theme Exports ──────────────────────────────────────

export {
  tokyoNight,
  dracula,
  nord,
  solarizedDark,
  solarizedLight,
  gruvboxDark,
  oneDark,
  catppuccinMocha,
  githubLight,
}

// ── Theme Metadata ────────────────────────────────────────────────

export interface ThemeInfo {
  id: string
  name: string
  type: 'dark' | 'light'
  description: string
  preview: {
    bg: string
    accent: string
    fg: string
  }
}

export const themeInfo: ThemeInfo[] = [
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    type: 'dark',
    description: 'A dark theme with soft blue accents',
    preview: { bg: '#1a1b26', accent: '#7aa2f7', fg: '#c0caf5' },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    type: 'dark',
    description: 'Vibrant purple and pink accents',
    preview: { bg: '#282a36', accent: '#bd93f9', fg: '#f8f8f2' },
  },
  {
    id: 'nord',
    name: 'Nord',
    type: 'dark',
    description: 'Arctic, north-bluish color palette',
    preview: { bg: '#2e3440', accent: '#88c0d0', fg: '#eceff4' },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    type: 'dark',
    description: 'Precision colors for machines and people',
    preview: { bg: '#002b36', accent: '#268bd2', fg: '#839496' },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    type: 'light',
    description: 'Solarized light variant',
    preview: { bg: '#fdf6e3', accent: '#268bd2', fg: '#657b83' },
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    type: 'dark',
    description: 'Retro groove color scheme',
    preview: { bg: '#282828', accent: '#fe8019', fg: '#ebdbb2' },
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    type: 'dark',
    description: "Atom's iconic One Dark theme",
    preview: { bg: '#282c34', accent: '#61afef', fg: '#abb2bf' },
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    type: 'dark',
    description: 'Soothing pastel theme',
    preview: { bg: '#1e1e2e', accent: '#cba6f7', fg: '#cdd6f4' },
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    type: 'light',
    description: 'Clean and professional light theme',
    preview: { bg: '#ffffff', accent: '#0969da', fg: '#24292f' },
  },
]
