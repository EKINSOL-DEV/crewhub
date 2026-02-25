/**
 * useZenTheme Hook
 * Manages theme state with localStorage persistence
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  type ZenTheme,
  getTheme,
  getDefaultTheme,
  getAllThemes,
  themeToCSSVariables,
} from '../themes'

const STORAGE_KEY = 'zen-theme'

export interface UseZenThemeReturn {
  /** Current active theme */
  currentTheme: ZenTheme
  /** All available themes */
  themes: ZenTheme[]
  /** Dark themes only */
  darkThemes: ZenTheme[]
  /** Light themes only */
  lightThemes: ZenTheme[]
  /** Set theme by ID */
  setTheme: (themeId: string) => void
  /** Check if a theme ID is the current theme */
  isCurrentTheme: (themeId: string) => boolean
  /** Toggle between current theme and a specific theme */
  toggleTheme: (themeId: string) => void
  /** Cycle to next theme */
  nextTheme: () => void
  /** Cycle to previous theme */
  prevTheme: () => void
  /** Apply theme CSS variables to an element */
  applyTheme: (element?: HTMLElement | null) => void
}

export function useZenTheme(): UseZenThemeReturn {
  const allThemes = useMemo(() => getAllThemes(), [])

  // Initialize from localStorage or default
  const [currentTheme, setCurrentTheme] = useState<ZenTheme>(() => {
    if (typeof window === 'undefined') return getDefaultTheme()

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const theme = getTheme(stored)
        if (theme) return theme
      }
    } catch {
      // Ignore storage errors
    }
    return getDefaultTheme()
  })

  // Persist to localStorage when theme changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, currentTheme.id)
    } catch {
      // Ignore storage errors
    }
  }, [currentTheme])

  // Apply theme CSS variables to document root
  const applyTheme = useCallback(
    (element?: HTMLElement | null) => {
      const target = element || document.documentElement
      const vars = themeToCSSVariables(currentTheme)

      Object.entries(vars).forEach(([key, value]) => {
        target.style.setProperty(key, value)
      })

      target.setAttribute('data-zen-theme', currentTheme.id)
      target.setAttribute('data-zen-theme-type', currentTheme.type)
    },
    [currentTheme]
  )

  // Set theme by ID
  const setTheme = useCallback((themeId: string) => {
    const theme = getTheme(themeId)
    if (theme) {
      setCurrentTheme(theme)
    }
  }, [])

  // Check if theme is current
  const isCurrentTheme = useCallback(
    (themeId: string) => {
      return currentTheme.id === themeId
    },
    [currentTheme]
  )

  // Toggle between themes
  const toggleTheme = useCallback(
    (themeId: string) => {
      if (currentTheme.id === themeId) {
        setCurrentTheme(getDefaultTheme())
      } else {
        const theme = getTheme(themeId)
        if (theme) setCurrentTheme(theme)
      }
    },
    [currentTheme]
  )

  // Cycle to next theme
  const nextTheme = useCallback(() => {
    const currentIndex = allThemes.findIndex((t) => t.id === currentTheme.id)
    const nextIndex = (currentIndex + 1) % allThemes.length
    setCurrentTheme(allThemes[nextIndex])
  }, [allThemes, currentTheme])

  // Cycle to previous theme
  const prevTheme = useCallback(() => {
    const currentIndex = allThemes.findIndex((t) => t.id === currentTheme.id)
    const prevIndex = (currentIndex - 1 + allThemes.length) % allThemes.length
    setCurrentTheme(allThemes[prevIndex])
  }, [allThemes, currentTheme])

  // Filtered theme lists
  const darkThemes = useMemo(() => allThemes.filter((t) => t.type === 'dark'), [allThemes])
  const lightThemes = useMemo(() => allThemes.filter((t) => t.type === 'light'), [allThemes])

  return {
    currentTheme,
    themes: allThemes,
    darkThemes,
    lightThemes,
    setTheme,
    isCurrentTheme,
    toggleTheme,
    nextTheme,
    prevTheme,
    applyTheme,
  }
}
