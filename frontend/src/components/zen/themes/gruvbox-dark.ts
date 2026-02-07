/**
 * Gruvbox Dark Theme for Zen Mode
 * Retro groove color scheme
 * https://github.com/morhetz/gruvbox
 */

import type { ZenTheme } from './tokyo-night'

export const gruvboxDark: ZenTheme = {
  id: 'gruvbox-dark',
  name: 'Gruvbox Dark',
  type: 'dark',
  colors: {
    // Background layers
    bg: '#282828',
    bgPanel: '#3c3836',
    bgHover: '#504945',
    bgActive: '#665c54',
    
    // Foreground
    fg: '#ebdbb2',
    fgMuted: '#a89984',
    fgDim: '#665c54',
    
    // Borders
    border: '#504945',
    borderFocus: '#fe8019',
    
    // Accent - Orange
    accent: '#fe8019',
    accentHover: '#fabd2f',
    
    // Status
    success: '#b8bb26',
    warning: '#fabd2f',
    error: '#fb4934',
    info: '#83a598',
    
    // Chat
    userBubble: '#504945',
    assistantBubble: '#1d2021',
    
    // Syntax
    syntax: {
      keyword: '#fb4934',
      string: '#b8bb26',
      comment: '#928374',
      function: '#fabd2f',
      variable: '#ebdbb2',
    }
  }
}
