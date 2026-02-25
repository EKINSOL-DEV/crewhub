/**
 * Nord Theme for Zen Mode
 * An arctic, north-bluish color palette
 * https://www.nordtheme.com/
 */

import type { ZenTheme } from './tokyo-night'

export const nord: ZenTheme = {
  id: 'nord',
  name: 'Nord',
  type: 'dark',
  colors: {
    // Background layers (Polar Night)
    bg: '#2e3440',
    bgPanel: '#3b4252',
    bgHover: '#434c5e',
    bgActive: '#4c566a',

    // Foreground (Snow Storm)
    fg: '#eceff4',
    fgMuted: '#d8dee9',
    fgDim: '#4c566a',

    // Borders
    border: '#4c566a',
    borderFocus: '#88c0d0',

    // Accent - Frost (Nord8 - Cyan)
    accent: '#88c0d0',
    accentHover: '#8fbcbb',

    // Status (Aurora)
    success: '#a3be8c',
    warning: '#ebcb8b',
    error: '#bf616a',
    info: '#81a1c1',

    // Chat
    userBubble: '#4c566a',
    assistantBubble: '#2e3440',

    // Syntax
    syntax: {
      keyword: '#81a1c1',
      string: '#a3be8c',
      comment: '#616e88',
      function: '#88c0d0',
      variable: '#d8dee9',
    },
  },
}
