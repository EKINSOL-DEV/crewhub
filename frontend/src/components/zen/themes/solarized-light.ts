/**
 * Solarized Light Theme for Zen Mode
 * Precision colors for machines and people - Light variant
 * https://ethanschoonover.com/solarized/
 */

import type { ZenTheme } from './tokyo-night'

export const solarizedLight: ZenTheme = {
  id: 'solarized-light',
  name: 'Solarized Light',
  type: 'light',
  colors: {
    // Background layers
    bg: '#fdf6e3',
    bgPanel: '#eee8d5',
    bgHover: '#e4ddc6',
    bgActive: '#d9d2b8',

    // Foreground
    fg: '#657b83',
    fgMuted: '#839496',
    fgDim: '#93a1a1',

    // Borders
    border: '#d9d2b8',
    borderFocus: '#268bd2',

    // Accent - Blue
    accent: '#268bd2',
    accentHover: '#1a6091',

    // Status
    success: '#859900',
    warning: '#b58900',
    error: '#dc322f',
    info: '#2aa198',

    // Chat
    userBubble: '#eee8d5',
    assistantBubble: '#fdf6e3',

    // Syntax
    syntax: {
      keyword: '#859900',
      string: '#2aa198',
      comment: '#93a1a1',
      function: '#268bd2',
      variable: '#657b83',
    },
  },
}
