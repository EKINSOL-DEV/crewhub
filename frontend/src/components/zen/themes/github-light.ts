/**
 * GitHub Light Theme for Zen Mode
 * Clean and professional light theme inspired by GitHub
 */

import type { ZenTheme } from './tokyo-night'

export const githubLight: ZenTheme = {
  id: 'github-light',
  name: 'GitHub Light',
  type: 'light',
  colors: {
    // Background layers
    bg: '#ffffff',
    bgPanel: '#f6f8fa',
    bgHover: '#eaeef2',
    bgActive: '#d0d7de',

    // Foreground
    fg: '#24292f',
    fgMuted: '#57606a',
    fgDim: '#8c959f',

    // Borders
    border: '#d0d7de',
    borderFocus: '#0969da',

    // Accent - GitHub Blue
    accent: '#0969da',
    accentHover: '#0550ae',

    // Status
    success: '#1a7f37',
    warning: '#9a6700',
    error: '#cf222e',
    info: '#0550ae',

    // Chat
    userBubble: '#ddf4ff',
    assistantBubble: '#f6f8fa',

    // Syntax
    syntax: {
      keyword: '#cf222e',
      string: '#0a3069',
      comment: '#6e7781',
      function: '#8250df',
      variable: '#953800',
    },
  },
}
