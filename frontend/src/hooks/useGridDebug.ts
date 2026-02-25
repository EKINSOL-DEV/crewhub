// ─── Grid Debug Toggle ──────────────────────────────────────────
// Persisted in localStorage under 'crewhub-grid-debug'.

import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'crewhub-grid-debug'

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
    window.addEventListener('crewhub-grid-debug', handler)
    // Also listen to storage events (other tabs)
    window.addEventListener('storage', storageHandler)
    return () => {
      window.removeEventListener('crewhub-grid-debug', handler)
      window.removeEventListener('storage', storageHandler)
    }
  }, [])

  const toggle = useCallback((value?: boolean) => {
    const next = value === undefined ? !readStored() : value
    localStorage.setItem(STORAGE_KEY, String(next))
    setEnabled(next)
    // Notify other components in same tab
    window.dispatchEvent(new Event('crewhub-grid-debug'))
  }, [])

  return [enabled, toggle]
}
