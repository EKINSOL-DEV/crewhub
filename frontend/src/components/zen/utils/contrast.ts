/**
 * WCAG Contrast Ratio Utilities
 * For validating theme accessibility
 */

/**
 * Parse hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`)
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}

/**
 * Calculate relative luminance of a color
 * https://www.w3.org/TR/WCAG20-TECHS/G17.html#G17-tests
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculate contrast ratio between two colors
 * Returns a value between 1 and 21
 * https://www.w3.org/TR/WCAG20-TECHS/G17.html
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b)
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b)

  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Check if a color combination meets WCAG AA requirements
 * for normal text (4.5:1 ratio)
 */
export function meetsWCAG_AA(fg: string, bg: string): boolean {
  return getContrastRatio(fg, bg) >= 4.5
}

/**
 * Check if a color combination meets WCAG AA requirements
 * for large text (3:1 ratio)
 * Large text is 18pt (24px) or 14pt (19px) bold
 */
export function meetsWCAG_AA_Large(fg: string, bg: string): boolean {
  return getContrastRatio(fg, bg) >= 3.0
}

/**
 * Check if a color combination meets WCAG AAA requirements
 * for normal text (7:1 ratio)
 */
export function meetsWCAG_AAA(fg: string, bg: string): boolean {
  return getContrastRatio(fg, bg) >= 7.0
}

/**
 * Get a human-readable contrast level
 */
export function getContrastLevel(fg: string, bg: string): 'fail' | 'AA-large' | 'AA' | 'AAA' {
  const ratio = getContrastRatio(fg, bg)

  if (ratio >= 7.0) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3.0) return 'AA-large'
  return 'fail'
}

/**
 * Validate all critical color pairs in a theme
 * Returns an array of issues (empty = all good)
 */
export interface ContrastIssue {
  pair: string
  fg: string
  bg: string
  ratio: number
  required: number
  level: string
}

import type { ZenTheme } from '../themes/tokyo-night'

export function validateThemeContrast(theme: ZenTheme): ContrastIssue[] {
  const issues: ContrastIssue[] = []

  // Check main text on backgrounds
  const pairs: Array<{ name: string; fg: string; bg: string; largeText?: boolean }> = [
    { name: 'fg on bg', fg: theme.colors.fg, bg: theme.colors.bg },
    { name: 'fg on bgPanel', fg: theme.colors.fg, bg: theme.colors.bgPanel },
    { name: 'fg on bgHover', fg: theme.colors.fg, bg: theme.colors.bgHover },
    { name: 'fgMuted on bg', fg: theme.colors.fgMuted, bg: theme.colors.bg },
    { name: 'fgMuted on bgPanel', fg: theme.colors.fgMuted, bg: theme.colors.bgPanel },
    { name: 'accent on bg', fg: theme.colors.accent, bg: theme.colors.bg, largeText: true },
    {
      name: 'accent on bgPanel',
      fg: theme.colors.accent,
      bg: theme.colors.bgPanel,
      largeText: true,
    },
    { name: 'success on bg', fg: theme.colors.success, bg: theme.colors.bg, largeText: true },
    { name: 'warning on bg', fg: theme.colors.warning, bg: theme.colors.bg, largeText: true },
    { name: 'error on bg', fg: theme.colors.error, bg: theme.colors.bg, largeText: true },
  ]

  for (const pair of pairs) {
    const ratio = getContrastRatio(pair.fg, pair.bg)
    const required = pair.largeText ? 3.0 : 4.5

    if (ratio < required) {
      issues.push({
        pair: pair.name,
        fg: pair.fg,
        bg: pair.bg,
        ratio: Math.round(ratio * 100) / 100,
        required,
        level: pair.largeText ? 'AA-large' : 'AA',
      })
    }
  }

  return issues
}
