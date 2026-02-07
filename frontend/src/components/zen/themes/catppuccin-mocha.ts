/**
 * Catppuccin Mocha Theme for Zen Mode
 * A soothing pastel theme for the high-spirited
 * https://github.com/catppuccin/catppuccin
 */

import type { ZenTheme } from './tokyo-night'

export const catppuccinMocha: ZenTheme = {
  id: 'catppuccin-mocha',
  name: 'Catppuccin Mocha',
  type: 'dark',
  colors: {
    // Background layers (Base, Mantle, Crust)
    bg: '#1e1e2e',
    bgPanel: '#181825',
    bgHover: '#313244',
    bgActive: '#45475a',
    
    // Foreground (Text, Subtext, Overlay)
    fg: '#cdd6f4',
    fgMuted: '#a6adc8',
    fgDim: '#6c7086',
    
    // Borders
    border: '#45475a',
    borderFocus: '#cba6f7',
    
    // Accent - Mauve (purple)
    accent: '#cba6f7',
    accentHover: '#f5c2e7',
    
    // Status
    success: '#a6e3a1',
    warning: '#f9e2af',
    error: '#f38ba8',
    info: '#89dceb',
    
    // Chat
    userBubble: '#45475a',
    assistantBubble: '#11111b',
    
    // Syntax
    syntax: {
      keyword: '#cba6f7',
      string: '#a6e3a1',
      comment: '#6c7086',
      function: '#89b4fa',
      variable: '#cdd6f4',
    }
  }
}
