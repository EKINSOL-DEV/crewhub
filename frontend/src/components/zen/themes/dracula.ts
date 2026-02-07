/**
 * Dracula Theme for Zen Mode
 * A dark theme with vibrant purple and pink accents
 * https://draculatheme.com/
 */

import type { ZenTheme } from './tokyo-night'

export const dracula: ZenTheme = {
  id: 'dracula',
  name: 'Dracula',
  type: 'dark',
  colors: {
    // Background layers
    bg: '#282a36',
    bgPanel: '#21222c',
    bgHover: '#343746',
    bgActive: '#44475a',
    
    // Foreground
    fg: '#f8f8f2',
    fgMuted: '#6272a4',
    fgDim: '#44475a',
    
    // Borders
    border: '#44475a',
    borderFocus: '#bd93f9',
    
    // Accent - Purple
    accent: '#bd93f9',
    accentHover: '#caa9fa',
    
    // Status
    success: '#50fa7b',
    warning: '#ffb86c',
    error: '#ff5555',
    info: '#8be9fd',
    
    // Chat
    userBubble: '#44475a',
    assistantBubble: '#1e1f29',
    
    // Syntax
    syntax: {
      keyword: '#ff79c6',
      string: '#f1fa8c',
      comment: '#6272a4',
      function: '#50fa7b',
      variable: '#f8f8f2',
    }
  }
}
