import { useState, useCallback, useEffect } from 'react'

// ─── Lighting Config Types ──────────────────────────────────────

export type ShadowMapType = 'BasicShadowMap' | 'PCFShadowMap' | 'PCFSoftShadowMap' | 'VSMShadowMap'

export interface ShadowConfig {
  enabled: boolean
  type: ShadowMapType
  mapSize: number
  bias: number
  normalBias: number
  radius: number
  darkness: number
  camera: {
    near: number
    far: number
    size: number
  }
}

export interface LightingConfig {
  ambient: { intensity: number; color: string }
  hemisphere: { skyColor: string; groundColor: string; intensity: number }
  sun: { intensity: number; color: string; position: [number, number, number]; castShadow: boolean }
  fill: { intensity: number; color: string; position: [number, number, number] }
  shadows: ShadowConfig
  toneMapping:
    | 'NoToneMapping'
    | 'ACESFilmicToneMapping'
    | 'ReinhardToneMapping'
    | 'CineonToneMapping'
  toneMappingExposure: number
  environmentIntensity: number
}

// ─── Brighter Defaults ──────────────────────────────────────────

export const DEFAULT_SHADOWS: ShadowConfig = {
  enabled: false,
  type: 'PCFSoftShadowMap',
  mapSize: 2048,
  bias: -0.001,
  normalBias: 0.02,
  radius: 2,
  darkness: 0.4,
  camera: {
    near: 0.5,
    far: 100,
    size: 30,
  },
}

export const DEFAULT_LIGHTING: LightingConfig = {
  ambient: { intensity: 0.8, color: '#ffffff' },
  hemisphere: { skyColor: '#87CEEB', groundColor: '#8B7355', intensity: 0.6 },
  sun: { intensity: 1.5, color: '#FFF5E6', position: [15, 25, 10], castShadow: false },
  fill: { intensity: 0.4, color: '#E6F0FF', position: [-10, 15, -8] },
  shadows: { ...DEFAULT_SHADOWS },
  toneMapping: 'ACESFilmicToneMapping',
  toneMappingExposure: 1,
  environmentIntensity: 1,
}

const STORAGE_KEY = 'crewhub-lighting'

function loadConfig(): LightingConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LightingConfig>
      // Deep-merge shadows to handle old configs missing the shadows field or partial shadows
      const shadows: ShadowConfig = {
        ...DEFAULT_SHADOWS,
        ...(parsed.shadows || undefined),
        camera: {
          ...DEFAULT_SHADOWS.camera,
          ...(parsed.shadows?.camera || undefined),
        },
      }
      return { ...DEFAULT_LIGHTING, ...parsed, shadows }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_LIGHTING
}

function saveConfig(config: LightingConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    /* ignore */
  }
}

// ─── Shared state (singleton across components) ─────────────────

let sharedConfig: LightingConfig = loadConfig()
const listeners = new Set<(config: LightingConfig) => void>()

function notifyListeners() {
  for (const fn of listeners) fn(sharedConfig)
}

// ─── Hook ───────────────────────────────────────────────────────

export function useLightingConfig() {
  const [config, setConfigLocal] = useState<LightingConfig>(sharedConfig) // NOSONAR

  useEffect(() => {
    const handler = (c: LightingConfig) => setConfigLocal({ ...c })
    listeners.add(handler)
    // Sync on mount in case another component already updated
    setConfigLocal({ ...sharedConfig })
    return () => {
      listeners.delete(handler)
    }
  }, [])

  const setConfig = useCallback(
    (update: Partial<LightingConfig> | ((prev: LightingConfig) => LightingConfig)) => {
      if (typeof update === 'function') {
        sharedConfig = update(sharedConfig)
      } else {
        sharedConfig = { ...sharedConfig, ...update }
      }
      saveConfig(sharedConfig)
      notifyListeners()
    },
    []
  )

  const resetConfig = useCallback(() => {
    sharedConfig = { ...DEFAULT_LIGHTING }
    saveConfig(sharedConfig)
    notifyListeners()
  }, [])

  const importConfig = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json) as Partial<LightingConfig>
      sharedConfig = { ...DEFAULT_LIGHTING, ...parsed }
      saveConfig(sharedConfig)
      notifyListeners()
      return true
    } catch {
      return false
    }
  }, [])

  const exportConfig = useCallback((): string => {
    return JSON.stringify(sharedConfig, null, 2)
  }, [])

  return { config, setConfig, resetConfig, importConfig, exportConfig }
}

// ─── Visibility toggle (shared state) ──────────────────────────

let lightingPanelVisible = false
const visibilityListeners = new Set<(v: boolean) => void>()

function notifyVisibility() {
  for (const fn of visibilityListeners) fn(lightingPanelVisible)
}

export function useLightingPanelVisibility() {
  const [visible, setVisibleLocal] = useState(lightingPanelVisible) // NOSONAR

  useEffect(() => {
    const handler = (v: boolean) => setVisibleLocal(v)
    visibilityListeners.add(handler)
    setVisibleLocal(lightingPanelVisible)
    return () => {
      visibilityListeners.delete(handler)
    }
  }, [])

  const setVisible = useCallback((v: boolean) => {
    lightingPanelVisible = v
    notifyVisibility()
  }, [])

  const toggle = useCallback(() => {
    lightingPanelVisible = !lightingPanelVisible
    notifyVisibility()
  }, [])

  return { visible, setVisible, toggle }
}
