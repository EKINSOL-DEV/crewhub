import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import type { Zone } from '../lib/zones'
import { zoneRegistry, zonePersistence } from '../lib/zones'

interface ZoneContextValue {
  activeZone: Zone
  isTransitioning: boolean
  /** Phase 1: immediate switch. Phase 2 adds fade + scene-ready gate and returns a Promise. */
  switchZone: (zoneId: string) => void
}

const ZoneContext = createContext<ZoneContextValue | null>(null)

function parseZoneIdFromPath(pathname: string): string | null {
  // MVP URL format: /zone/:zoneId
  // Keep it tolerant and non-invasive for other routes.
  const m = /^\/zone\/([^/]+)(?:\/.*)?$/.exec(pathname)
  return m?.[1] ?? null
}

function safeGetZoneOrDefault(zoneId: string | null | undefined): Zone {
  if (zoneId) {
    const z = zoneRegistry.get(zoneId)
    if (z) return z
  }
  return zoneRegistry.getDefault()
}

export function ZoneProvider({ children }: { children: ReactNode }) {
  const [activeZone, setActiveZone] = useState<Zone>(() => {
    // Priority:
    // 1) URL (/zone/:zoneId)
    // 2) localStorage last active
    // 3) registry default
    const fromUrl = parseZoneIdFromPath(window.location.pathname)
    if (fromUrl) return safeGetZoneOrDefault(fromUrl)

    const savedId = zonePersistence.getActiveZoneId()
    return safeGetZoneOrDefault(savedId)
  })

  const [isTransitioning, setIsTransitioning] = useState(false)

  // Keep URL in sync if we are on a /zone/* route.
  useEffect(() => {
    const current = window.location.pathname
    if (current.startsWith('/zone/')) {
      window.history.replaceState(null, '', `/zone/${activeZone.id}`)
    }
  }, [activeZone.id])

  // Handle browser back/forward when user is on /zone/*.
  useEffect(() => {
    const onPopState = () => {
      const zoneId = parseZoneIdFromPath(window.location.pathname)
      if (!zoneId) return
      const target = safeGetZoneOrDefault(zoneId)
      setActiveZone(target)
      zonePersistence.saveActiveZone(target.id)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const switchZone = useCallback(
    (zoneId: string) => {
      if (isTransitioning) return
      if (activeZone.id === zoneId) return

      let target = zoneRegistry.get(zoneId)
      if (!target) {
        console.warn(`[Zone] Zone "${zoneId}" not found, falling back to default`)
        target = zoneRegistry.getDefault()
      }

      setIsTransitioning(true)

      // Phase 1: we don't yet have access to the active camera position from here.
      // We still persist last-visit metadata so Phase 2 can start restoring positions.
      zonePersistence.saveActiveZone(target.id)

      setActiveZone(target)

      // Minimal debounce to avoid rapid double-switching.
      setTimeout(() => setIsTransitioning(false), 100)
    },
    [activeZone.id, isTransitioning]
  )

  const value = useMemo<ZoneContextValue>(
    () => ({
      activeZone,
      isTransitioning,
      switchZone,
    }),
    [activeZone, isTransitioning, switchZone]
  )

  return <ZoneContext.Provider value={value}>{children}</ZoneContext.Provider>
}

export function useZoneContext(): ZoneContextValue {
  const ctx = useContext(ZoneContext)
  if (!ctx) throw new Error('useZoneContext must be used within ZoneProvider')
  return ctx
}

/** Convenience alias */
export const useZone = useZoneContext
