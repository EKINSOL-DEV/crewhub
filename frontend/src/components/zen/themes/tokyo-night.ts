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
 * Convert hex color to HSL string (e.g. "220 13% 18%") for Tailwind CSS vars
 */
function hexToHSL(hex: string): string {
  // Remove # prefix
  hex = hex.replace(/^#/, '')
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

/**
 * Lighten a hex color by a percentage (0-100)
 */
function lightenHex(hex: string, percent: number): string {
  hex = hex.replace(/^#/, '')
  let r = parseInt(hex.substring(0, 2), 16)
  let g = parseInt(hex.substring(2, 4), 16)
  let b = parseInt(hex.substring(4, 6), 16)
  r = Math.min(255, Math.round(r + (255 - r) * (percent / 100)))
  g = Math.min(255, Math.round(g + (255 - g) * (percent / 100)))
  b = Math.min(255, Math.round(b + (255 - b) * (percent / 100)))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Darken a hex color by a percentage (0-100)
 */
function darkenHex(hex: string, percent: number): string {
  hex = hex.replace(/^#/, '')
  let r = parseInt(hex.substring(0, 2), 16)
  let g = parseInt(hex.substring(2, 4), 16)
  let b = parseInt(hex.substring(4, 6), 16)
  r = Math.max(0, Math.round(r * (1 - percent / 100)))
  g = Math.max(0, Math.round(g * (1 - percent / 100)))
  b = Math.max(0, Math.round(b * (1 - percent / 100)))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Convert theme to CSS custom properties (Zen-prefixed)
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

/**
 * Convert theme to Tailwind/shadcn CSS variables (HSL format without hsl() wrapper)
 * This bridges the Zen theme system to the entire app's design system.
 */
export function themeToTailwindVars(theme: ZenTheme): Record<string, string> {
  const c = theme.colors
  const isDark = theme.type === 'dark'

  // Derive additional colors from the theme palette
  const popoverBg = isDark ? lightenHex(c.bg, 5) : c.bg
  const cardBg = isDark ? lightenHex(c.bg, 3) : c.bg
  const mutedBg = isDark ? lightenHex(c.bg, 8) : darkenHex(c.bg, 4)
  const secondaryBg = isDark ? lightenHex(c.bg, 10) : darkenHex(c.bg, 5)
  const accentBg = isDark ? lightenHex(c.bg, 12) : darkenHex(c.bg, 6)

  return {
    // Core backgrounds
    '--background': hexToHSL(c.bg),
    '--foreground': hexToHSL(c.fg),

    // Card
    '--card': hexToHSL(cardBg),
    '--card-foreground': hexToHSL(c.fg),

    // Popover
    '--popover': hexToHSL(popoverBg),
    '--popover-foreground': hexToHSL(c.fg),

    // Primary (accent)
    '--primary': hexToHSL(c.accent),
    '--primary-foreground': isDark ? hexToHSL(c.bg) : '0 0% 100%',

    // Secondary
    '--secondary': hexToHSL(secondaryBg),
    '--secondary-foreground': hexToHSL(c.fg),

    // Muted
    '--muted': hexToHSL(mutedBg),
    '--muted-foreground': hexToHSL(c.fgMuted),

    // Accent
    '--accent': hexToHSL(accentBg),
    '--accent-foreground': hexToHSL(c.fg),

    // Destructive
    '--destructive': hexToHSL(c.error),
    '--destructive-foreground': isDark ? '0 0% 98%' : '0 0% 100%',

    // Border, input, ring
    '--border': hexToHSL(c.border),
    '--input': hexToHSL(c.border),
    '--ring': hexToHSL(c.accent),

    // Playground gradients
    '--playground-from': hexToHSL(isDark ? darkenHex(c.bg, 10) : lightenHex(c.bg, 3)),
    '--playground-to': hexToHSL(isDark ? darkenHex(c.bgPanel, 10) : lightenHex(c.bgPanel, 3)),
    '--playground-dots': hexToHSL(c.fgMuted),

    // Panel backgrounds
    '--panel-bg': hexToHSL(c.bgPanel),
    '--panel-border': hexToHSL(c.border),

    // Code syntax (HSL format)
    '--code-comment': hexToHSL(c.syntax.comment),
    '--code-keyword': hexToHSL(c.syntax.keyword),
    '--code-string': hexToHSL(c.syntax.string),
    '--code-number': hexToHSL(c.warning), // reuse warning color for numbers
    '--code-function': hexToHSL(c.syntax.function),
    '--code-builtin': hexToHSL(c.syntax.keyword),
  }
}
