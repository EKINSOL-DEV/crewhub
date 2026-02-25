import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import { GrassEnvironment } from './GrassEnvironment'
import { IslandEnvironment } from './IslandEnvironment'
import { FloatingEnvironment } from './FloatingEnvironment'
import { DesertEnvironment } from './DesertEnvironment'
import { environmentRegistry } from '@/lib/modding/registries'

// ─── Environment Types ───────────────────────────────────────────
// EnvironmentType is now a plain string — any registered id is valid.

export type EnvironmentType = string

const STORAGE_KEY = 'crewhub-environment'
const DEFAULT_ENVIRONMENT = 'desert'

export function getStoredEnvironment(): EnvironmentType {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && environmentRegistry.has(stored)) return stored
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

// ─── Hook for reading available environments from the registry ───

export function useEnvironmentList() {
  return useSyncExternalStore(
    environmentRegistry.subscribe,
    environmentRegistry.getSnapshot,
    environmentRegistry.getSnapshot
  )
}

// ─── Environment Switcher Component ──────────────────────────────

interface EnvironmentSwitcherProps {
  buildingWidth: number
  buildingDepth: number
}

export function EnvironmentSwitcher({ buildingWidth, buildingDepth }: EnvironmentSwitcherProps) {
  const [environment] = useEnvironment()

  // Look up the component from the registry
  const config = environmentRegistry.get(environment)
  if (!config) {
    // Fallback to default if the stored id isn't registered (e.g. mod was removed)
    const fallback = environmentRegistry.get(DEFAULT_ENVIRONMENT)
    if (!fallback) return null
    const Fallback = fallback.component
    return <Fallback buildingWidth={buildingWidth} buildingDepth={buildingDepth} />
  }

  const EnvComponent = config.component
  return <EnvComponent buildingWidth={buildingWidth} buildingDepth={buildingDepth} />
}

// ─── Built-in Environment Registration ───────────────────────────
// Registers the 3 built-in environments. Called once at module load.

function registerBuiltinEnvironments(): void {
  // Batch register all builtins — 1 notification instead of 3
  environmentRegistry.registerBatch([
    {
      id: 'builtin:grass',
      data: {
        name: '🌿 Classic Grass',
        description: 'Flat grass field with tufts and rocks',
        component: GrassEnvironment,
      },
      source: 'builtin',
    },
    {
      id: 'builtin:island',
      data: {
        name: '🏝️ Floating Island',
        description: 'Monument Valley-style floating island',
        component: IslandEnvironment,
      },
      source: 'builtin',
    },
    {
      id: 'builtin:floating',
      data: {
        name: '✨ Sky Platform',
        description: 'Futuristic hexagonal floating platform',
        component: FloatingEnvironment,
      },
      source: 'builtin',
    },
    {
      id: 'builtin:desert',
      data: {
        name: '🏜️ Desert',
        description: 'Sandy desert with cacti, rocks and dunes',
        component: DesertEnvironment,
      },
      source: 'builtin',
    },
  ])
}

// Self-register on module load (same pattern as PropRegistry)
registerBuiltinEnvironments()
