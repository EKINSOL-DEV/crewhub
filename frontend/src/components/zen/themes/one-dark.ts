/**
 * One Dark Theme for Zen Mode
 * Atom's iconic One Dark theme
 * https://github.com/atom/one-dark-syntax
 */

import type { ZenTheme } from './tokyo-night'

export const oneDark: ZenTheme = {
  id: 'one-dark',
  name: 'One Dark',
  type: 'dark',
  colors: {
    // Background layers
    bg: '#282c34',
    bgPanel: '#21252b',
    bgHover: '#2c313a',
    bgActive: '#3e4451',
    
    // Foreground
    fg: '#abb2bf',
    fgMuted: '#5c6370',
    fgDim: '#4b5263',
    
    // Borders
    border: '#3e4451',
    borderFocus: '#61afef',
    
    // Accent - Blue
    accent: '#61afef',
    accentHover: '#74b9f0',
    
    // Status
    success: '#98c379',
    warning: '#e5c07b',
    error: '#e06c75',
    info: '#56b6c2',
    
    // Chat
    userBubble: '#3e4451',
    assistantBubble: '#1b1d23',
    
    // Syntax
    syntax: {
      keyword: '#c678dd',
      string: '#98c379',
      comment: '#5c6370',
      function: '#61afef',
      variable: '#e06c75',
    }
  }
}
