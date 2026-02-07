/**
 * Tokyo Night Theme for Zen Mode
 * A dark, elegant theme with soft blue accents
 */

export interface ZenTheme {
  id: string
  name: string
  type: 'dark' | 'light'
  colors: {
    // Background layers
    bg: string
    bgPanel: string
    bgHover: string
    bgActive: string
    
    // Foreground
    fg: string
    fgMuted: string
    fgDim: string
    
    // Borders
    border: string
    borderFocus: string
    
    // Accent colors
    accent: string
    accentHover: string
    
    // Status colors
    success: string
    warning: string
    error: string
    info: string
    
    // Chat-specific
    userBubble: string
    assistantBubble: string
    
    // Syntax highlighting
    syntax: {
      keyword: string
      string: string
      comment: string
      function: string
      variable: string
    }
  }
}

export const tokyoNight: ZenTheme = {
  id: 'tokyo-night',
  name: 'Tokyo Night',
  type: 'dark',
  colors: {
    // Background layers
    bg: '#1a1b26',
    bgPanel: '#24283b',
    bgHover: '#2f3549',
    bgActive: '#3d4560',
    
    // Foreground
    fg: '#c0caf5',
    fgMuted: '#565f89',
    fgDim: '#3d4560',
    
    // Borders
    border: '#3d4560',
    borderFocus: '#7aa2f7',
    
    // Accent
    accent: '#7aa2f7',
    accentHover: '#89b4fa',
    
    // Status
    success: '#9ece6a',
    warning: '#e0af68',
    error: '#f7768e',
    info: '#7dcfff',
    
    // Chat
    userBubble: '#3d4560',
    assistantBubble: '#1e2030',
    
    // Syntax
    syntax: {
      keyword: '#bb9af7',
      string: '#9ece6a',
      comment: '#565f89',
      function: '#7aa2f7',
      variable: '#c0caf5',
    }
  }
}

/**
 * Convert theme to CSS custom properties
 */
export function themeToCSSVariables(theme: ZenTheme): Record<string, string> {
  return {
    '--zen-bg': theme.colors.bg,
    '--zen-bg-panel': theme.colors.bgPanel,
    '--zen-bg-hover': theme.colors.bgHover,
    '--zen-bg-active': theme.colors.bgActive,
    '--zen-fg': theme.colors.fg,
    '--zen-fg-muted': theme.colors.fgMuted,
    '--zen-fg-dim': theme.colors.fgDim,
    '--zen-border': theme.colors.border,
    '--zen-border-focus': theme.colors.borderFocus,
    '--zen-accent': theme.colors.accent,
    '--zen-accent-hover': theme.colors.accentHover,
    '--zen-success': theme.colors.success,
    '--zen-warning': theme.colors.warning,
    '--zen-error': theme.colors.error,
    '--zen-info': theme.colors.info,
    '--zen-user-bubble': theme.colors.userBubble,
    '--zen-assistant-bubble': theme.colors.assistantBubble,
    '--zen-syntax-keyword': theme.colors.syntax.keyword,
    '--zen-syntax-string': theme.colors.syntax.string,
    '--zen-syntax-comment': theme.colors.syntax.comment,
    '--zen-syntax-function': theme.colors.syntax.function,
    '--zen-syntax-variable': theme.colors.syntax.variable,
  }
}
