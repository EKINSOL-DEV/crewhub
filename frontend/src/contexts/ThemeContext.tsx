import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export type ThemeMode = "light" | "dark" | "system"
export type AccentColor = "blue" | "purple" | "green" | "orange" | "pink" | "cyan" | "rose" | "amber"

export interface ThemeConfig {
  mode: ThemeMode
  accentColor: AccentColor
}

interface ThemeContextValue {
  theme: ThemeConfig
  setTheme: (theme: Partial<ThemeConfig>) => void
  resolvedMode: "light" | "dark"
}

const STORAGE_KEY = "crewhub-theme"

const defaultTheme: ThemeConfig = {
  mode: "light",
  accentColor: "purple",
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

// Accent color configurations (HSL values)
export const accentColors: Record<AccentColor, { name: string; hue: number; primary: string; preview: string }> = {
  blue: { name: "Blue", hue: 217, primary: "217 91% 60%", preview: "#3b82f6" },
  purple: { name: "Purple", hue: 262, primary: "262 83% 58%", preview: "#8b5cf6" },
  green: { name: "Green", hue: 142, primary: "142 71% 45%", preview: "#22c55e" },
  orange: { name: "Orange", hue: 25, primary: "25 95% 53%", preview: "#f97316" },
  pink: { name: "Pink", hue: 330, primary: "330 81% 60%", preview: "#ec4899" },
  cyan: { name: "Cyan", hue: 189, primary: "189 94% 43%", preview: "#06b6d4" },
  rose: { name: "Rose", hue: 347, primary: "347 77% 50%", preview: "#e11d48" },
  amber: { name: "Amber", hue: 38, primary: "38 92% 50%", preview: "#f59e0b" },
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeConfig>(() => {
    if (typeof window === "undefined") return defaultTheme
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        return { ...defaultTheme, ...JSON.parse(stored) }
      } catch {
        return defaultTheme
      }
    }
    return defaultTheme
  })

  const [systemMode, setSystemMode] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark"
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  })

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemMode(e.matches ? "dark" : "light")
    }
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  // Resolve the actual mode
  const resolvedMode = theme.mode === "system" ? systemMode : theme.mode

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement
    const body = document.body

    // Remove existing theme classes
    root.classList.remove("light", "dark")
    body.classList.remove("light", "dark")

    // Add new theme class
    root.classList.add(resolvedMode)
    body.classList.add(resolvedMode)

    // Apply accent color CSS variables
    const accent = accentColors[theme.accentColor]
    root.style.setProperty("--accent-hue", accent.hue.toString())
    root.style.setProperty("--primary", accent.primary)
    
    // Update ring color based on accent
    if (resolvedMode === "dark") {
      root.style.setProperty("--ring", accent.primary)
    } else {
      root.style.setProperty("--ring", accent.primary)
    }
  }, [theme, resolvedMode])

  // Persist theme
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme))
  }, [theme])

  const setTheme = (newTheme: Partial<ThemeConfig>) => {
    setThemeState(prev => ({ ...prev, ...newTheme }))
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
