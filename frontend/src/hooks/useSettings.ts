/**
 * useSettings — Settings migration hook.
 *
 * Reads from API first, falls back to localStorage.
 * Writes to both API and localStorage (gradual migration).
 * Caches in memory with invalidation.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getSettings as apiGetSettings,
  updateSetting as apiUpdateSetting,
  updateSettingsBatch as apiUpdateSettingsBatch,
} from '@/lib/api'

// Keys we migrate from localStorage → API
const MIGRATED_KEYS = [
  'crewhub-theme',
  'crewhub-accent',
  'crewhub-environment',
  'crewhub-view-mode',
  'crewhub-grid-debug',
  'crewhub-lighting',
  'crewhub-idle-threshold',
  'crewhub-offline-threshold',
  'crewhub-session-config',
] as const

interface UseSettingsReturn {
  /** All settings (merged API + localStorage) */
  settings: Record<string, string>
  /** Whether settings have been loaded */
  loaded: boolean
  /** Whether the API is available */
  apiAvailable: boolean
  /** Get a single setting */
  get: (key: string) => string | null
  /** Set a single setting (writes to API + localStorage) */
  set: (key: string, value: string) => Promise<void>
  /** Set multiple settings at once */
  setBatch: (updates: Record<string, string>) => Promise<void>
  /** Remove a setting */
  remove: (key: string) => Promise<void>
  /** Force refresh from API */
  refresh: () => Promise<void>
}

// Module-level cache so all hook instances share state
let cachedSettings: Record<string, string> = {}
let cacheTimestamp = 0
const CACHE_TTL_MS = 30_000 // 30 seconds

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<Record<string, string>>(cachedSettings)
  const [loaded, setLoaded] = useState(cacheTimestamp > 0)
  const [apiAvailable, setApiAvailable] = useState(true)
  const mountedRef = useRef(true)

  // Load settings from localStorage as baseline
  const loadLocalSettings = useCallback((): Record<string, string> => {
    const local: Record<string, string> = {}
    for (const key of MIGRATED_KEYS) {
      const val = localStorage.getItem(key)
      if (val !== null) {
        local[key] = val
      }
    }
    return local
  }, [])

  // Fetch settings from API and merge with localStorage fallback
  const fetchSettings = useCallback(async () => {
    const now = Date.now()
    // Skip if cache is fresh
    if (cacheTimestamp > 0 && now - cacheTimestamp < CACHE_TTL_MS) {
      if (mountedRef.current) {
        setSettings(cachedSettings)
        setLoaded(true)
      }
      return
    }

    const localSettings = loadLocalSettings()

    try {
      const apiSettings = await apiGetSettings()
      // Merge: API values take priority over localStorage
      const merged = { ...localSettings, ...apiSettings }
      cachedSettings = merged
      cacheTimestamp = now
      setApiAvailable(true)

      // Migrate: if there are localStorage keys not yet in API, push them up
      const toMigrate: Record<string, string> = {}
      for (const key of MIGRATED_KEYS) {
        if (localSettings[key] && !apiSettings[key]) {
          toMigrate[key] = localSettings[key]
        }
      }
      if (Object.keys(toMigrate).length > 0) {
        try {
          await apiUpdateSettingsBatch(toMigrate)
        } catch {
          // Migration is best-effort; don't block
        }
      }

      if (mountedRef.current) {
        setSettings(merged)
        setLoaded(true)
      }
    } catch {
      // API unavailable — use localStorage only
      cachedSettings = localSettings
      cacheTimestamp = now
      if (mountedRef.current) {
        setSettings(localSettings)
        setApiAvailable(false)
        setLoaded(true)
      }
    }
  }, [loadLocalSettings])

  useEffect(() => {
    mountedRef.current = true
    fetchSettings()
    return () => {
      mountedRef.current = false
    }
  }, [fetchSettings])

  const get = useCallback(
    (key: string): string | null => {
      return settings[key] ?? localStorage.getItem(key) ?? null
    },
    [settings]
  )

  const set = useCallback(
    async (key: string, value: string) => {
      // Always write to localStorage (backward compat)
      localStorage.setItem(key, value)

      // Update local state
      const updated = { ...cachedSettings, [key]: value }
      cachedSettings = updated
      setSettings(updated)

      // Try to write to API
      if (apiAvailable) {
        try {
          await apiUpdateSetting(key, value)
        } catch {
          // API write failed; localStorage is the source of truth
        }
      }
    },
    [apiAvailable]
  )

  const setBatch = useCallback(
    async (updates: Record<string, string>) => {
      // Write each to localStorage
      for (const [key, value] of Object.entries(updates)) {
        localStorage.setItem(key, value)
      }

      // Update local state
      const updated = { ...cachedSettings, ...updates }
      cachedSettings = updated
      setSettings(updated)

      // Try to write to API
      if (apiAvailable) {
        try {
          await apiUpdateSettingsBatch(updates)
        } catch {
          // Best-effort
        }
      }
    },
    [apiAvailable]
  )

  const remove = useCallback(
    async (key: string) => {
      localStorage.removeItem(key)
      const updated = { ...cachedSettings }
      delete updated[key]
      cachedSettings = updated
      setSettings(updated)

      if (apiAvailable) {
        try {
          // Use empty string to "delete" in API
          await apiUpdateSetting(key, '')
        } catch {
          // Best-effort
        }
      }
    },
    [apiAvailable]
  )

  const refresh = useCallback(async () => {
    cacheTimestamp = 0 // Force refresh
    await fetchSettings()
  }, [fetchSettings])

  return {
    settings,
    loaded,
    apiAvailable,
    get,
    set,
    setBatch,
    remove,
    refresh,
  }
}
