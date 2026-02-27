// ─── Grid Debug Toggle ──────────────────────────────────────────
// Persisted in localStorage under KEY_CREWHUB_GRID_DEBUG.

import { useState, useCallback, useEffect } from 'react'

const KEY_CREWHUB_GRID_DEBUG = 'crewhub-grid-debug'

const STORAGE_KEY = KEY_CREWHUB_GRID_DEBUG

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Returns [enabled, toggle] for the grid debug overlay.
 * State is shared across components via a simple storage event listener
 * so both SettingsPanel (2D) and Room3D (3D canvas) stay in sync.
 */
export function useGridDebug(): [boolean, (value?: boolean) => void] {
  const [enabled, setEnabled] = useState(readStored)

  // Listen for cross-component changes (custom event)
  useEffect(() => {
    const handler = () => setEnabled(readStored())
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setEnabled(e.newValue === 'true')
    }
    globalThis.addEventListener(KEY_CREWHUB_GRID_DEBUG, handler)
    // Also listen to storage events (other tabs)
    globalThis.addEventListener('storage', storageHandler)
    return () => {
      globalThis.removeEventListener(KEY_CREWHUB_GRID_DEBUG, handler)
      globalThis.removeEventListener('storage', storageHandler)
    }
  }, [])

  const toggle = useCallback((value?: boolean) => {
    const next = value ?? !readStored()
    localStorage.setItem(STORAGE_KEY, String(next))
    setEnabled(next)
    // Notify other components in same tab
    globalThis.dispatchEvent(new Event(KEY_CREWHUB_GRID_DEBUG))
  }, [])

  return [enabled, toggle]
}
