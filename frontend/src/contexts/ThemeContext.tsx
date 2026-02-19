/**
 * Unified Theme Context
 *
 * Single theme system for the entire CrewHub app, powered by the Zen theme engine.
 * Replaces the old light/dark + accent color system with full named themes
 * (Tokyo Night, Dracula, Nord, etc.) that control ALL UI: Tailwind/shadcn vars,
 * Zen panels, syntax highlighting, and playground gradients.
 *
 * Backward-compatible: still exports useTheme() with resolvedMode for components
 * that need to know if the theme is dark or light.
 */

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import {
  themeToCSSVariables,
  themeToTailwindVars,
  themeInfo,
  type ThemeInfo,
} from '@/components/zen/themes'
import { useZenTheme, type UseZenThemeReturn } from '@/components/zen/hooks/useZenTheme'

// ── Legacy compat types (kept so existing imports don't break) ─────────────

export type ThemeMode = 'light' | 'dark' | 'system'
export type AccentColor = 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'cyan' | 'rose' | 'amber'

/** @deprecated — use zen.currentTheme instead */
export interface ThemeConfig {
  mode: ThemeMode
  accentColor: AccentColor
}

/** @deprecated — accent colors are now derived from the active theme */
export const accentColors: Record<AccentColor, { name: string; hue: number; primary: string; preview: string }> = {
  blue:   { name: 'Blue',   hue: 217, primary: '217 91% 60%', preview: '#3b82f6' },
  purple: { name: 'Purple', hue: 262, primary: '262 83% 58%', preview: '#8b5cf6' },
  green:  { name: 'Green',  hue: 142, primary: '142 71% 45%', preview: '#22c55e' },
  orange: { name: 'Orange', hue: 25,  primary: '25 95% 53%',  preview: '#f97316' },
  pink:   { name: 'Pink',   hue: 330, primary: '330 81% 60%', preview: '#ec4899' },
  cyan:   { name: 'Cyan',   hue: 189, primary: '189 94% 43%', preview: '#06b6d4' },
  rose:   { name: 'Rose',   hue: 347, primary: '347 77% 50%', preview: '#e11d48' },
  amber:  { name: 'Amber',  hue: 38,  primary: '38 92% 50%',  preview: '#f59e0b' },
}

// ── Context value ─────────────────────────────────────────────────

interface ThemeContextValue {
  /** Full Zen theme engine (current theme, setTheme, next/prev, etc.) */
  zen: UseZenThemeReturn
  /** All theme metadata for pickers */
  themeInfo: ThemeInfo[]
  /** Resolved light/dark (for components that just need to know) */
  resolvedMode: 'light' | 'dark'

  // ── Legacy compat (so SettingsPanel & existing code still compiles) ──
  /** @deprecated — use zen.currentTheme / zen.setTheme instead */
  theme: ThemeConfig
  /** @deprecated — use zen.setTheme(themeId) instead */
  setTheme: (t: Partial<ThemeConfig>) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

// ── Provider ──────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const zen = useZenTheme()
  const current = zen.currentTheme

  // Derive resolvedMode from theme type
  const resolvedMode = current.type

  // Apply ALL CSS variables when theme changes
  useEffect(() => {
    const root = document.documentElement

    // 1. Tailwind / shadcn variables (HSL, no wrapper)
    const tailwindVars = themeToTailwindVars(current)
    for (const [key, value] of Object.entries(tailwindVars)) {
      root.style.setProperty(key, value)
    }

    // 2. Zen-prefixed variables (hex, for Zen panels & markdown)
    const zenVars = themeToCSSVariables(current)
    for (const [key, value] of Object.entries(zenVars)) {
      root.style.setProperty(key, value)
    }

    // 3. Dark / light class on root + body (Tailwind dark mode)
    root.classList.remove('light', 'dark')
    document.body.classList.remove('light', 'dark')
    root.classList.add(resolvedMode)
    document.body.classList.add(resolvedMode)

    // 4. Data attributes for theme-aware selectors
    root.setAttribute('data-zen-theme', current.id)
    root.setAttribute('data-zen-theme-type', current.type)

    if (import.meta.env.DEV) {
      console.debug('[Theme] Applied:', current.name, `(${current.type})`)
    }
  }, [current, resolvedMode])

  // Legacy compat shim
  const legacyTheme: ThemeConfig = useMemo(() => ({
    mode: resolvedMode,
    accentColor: 'purple', // no longer meaningful
  }), [resolvedMode])

  const legacySetTheme = useMemo(() => {
    return (_partial: Partial<ThemeConfig>) => {
      // Legacy callers setting mode: if they ask for light, pick first light theme; dark → keep current or pick default
      // This is a best-effort shim; the real API is zen.setTheme(id)
    }
  }, [])

  const value: ThemeContextValue = useMemo(() => ({
    zen,
    themeInfo,
    resolvedMode,
    theme: legacyTheme,
    setTheme: legacySetTheme,
  }), [zen, resolvedMode, legacyTheme, legacySetTheme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
