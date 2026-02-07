/**
 * Solarized Dark Theme for Zen Mode
 * Precision colors for machines and people
 * https://ethanschoonover.com/solarized/
 */

import type { ZenTheme } from './tokyo-night'

export const solarizedDark: ZenTheme = {
  id: 'solarized-dark',
  name: 'Solarized Dark',
  type: 'dark',
  colors: {
    // Background layers
    bg: '#002b36',
    bgPanel: '#073642',
    bgHover: '#094554',
    bgActive: '#0b5567',
    
    // Foreground
    fg: '#839496',
    fgMuted: '#657b83',
    fgDim: '#586e75',
    
    // Borders
    border: '#094554',
    borderFocus: '#268bd2',
    
    // Accent - Blue
    accent: '#268bd2',
    accentHover: '#2aa1f5',
    
    // Status
    success: '#859900',
    warning: '#b58900',
    error: '#dc322f',
    info: '#2aa198',
    
    // Chat
    userBubble: '#073642',
    assistantBubble: '#001f27',
    
    // Syntax
    syntax: {
      keyword: '#859900',
      string: '#2aa198',
      comment: '#586e75',
      function: '#268bd2',
      variable: '#839496',
    }
  }
}
