import { useState, useEffect, useCallback } from 'react'
import { GrassEnvironment } from './GrassEnvironment'
import { IslandEnvironment } from './IslandEnvironment'
import { FloatingEnvironment } from './FloatingEnvironment'

// ─── Environment Types ───────────────────────────────────────────

export type EnvironmentType = 'grass' | 'island' | 'floating'

const STORAGE_KEY = 'crewhub-environment'
const DEFAULT_ENVIRONMENT: EnvironmentType = 'grass'

export function getStoredEnvironment(): EnvironmentType {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'grass' || stored === 'island' || stored === 'floating') return stored
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_ENVIRONMENT
}

export function setStoredEnvironment(env: EnvironmentType): void {
  try {
    localStorage.setItem(STORAGE_KEY, env)
  } catch {
    // localStorage unavailable
  }
  // Dispatch custom event so other components can react
  window.dispatchEvent(new CustomEvent('crewhub-environment-change', { detail: env }))
}

// ─── Hook for environment state ──────────────────────────────────

export function useEnvironment(): [EnvironmentType, (env: EnvironmentType) => void] {
  const [environment, setEnvironment] = useState<EnvironmentType>(getStoredEnvironment)

  const handleChange = useCallback((env: EnvironmentType) => {
    setEnvironment(env)
    setStoredEnvironment(env)
  }, [])

  // Listen for changes from other components (e.g., settings panel)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<EnvironmentType>).detail
      setEnvironment(detail)
    }
    window.addEventListener('crewhub-environment-change', handler)
    return () => window.removeEventListener('crewhub-environment-change', handler)
  }, [])

  return [environment, handleChange]
}

// ─── Environment Switcher Component ──────────────────────────────

interface EnvironmentSwitcherProps {
  buildingWidth: number
  buildingDepth: number
}

export function EnvironmentSwitcher({ buildingWidth, buildingDepth }: EnvironmentSwitcherProps) {
  const [environment] = useEnvironment()

  switch (environment) {
    case 'island':
      return <IslandEnvironment buildingWidth={buildingWidth} buildingDepth={buildingDepth} />
    case 'floating':
      return <FloatingEnvironment buildingWidth={buildingWidth} buildingDepth={buildingDepth} />
    case 'grass':
    default:
      return <GrassEnvironment buildingWidth={buildingWidth} buildingDepth={buildingDepth} />
  }
}
