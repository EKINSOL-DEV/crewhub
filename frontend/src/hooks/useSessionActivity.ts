import { useRef, useEffect, useCallback } from 'react'
import type { CrewSession } from '@/lib/api'

/**
 * Shared hook that tracks token changes to detect actively running sessions.
 * Extracted from PlaygroundView for reuse in both 2D and 3D views.
 */
export function useSessionActivity(sessions: CrewSession[]) {
  const tokenTrackingRef = useRef<Map<string, { previousTokens: number; lastChangeTime: number }>>(new Map())

  useEffect(() => {
    const now = Date.now()
    const tracking = tokenTrackingRef.current
    sessions.forEach(session => {
      const currentTokens = session.totalTokens || 0
      const tracked = tracking.get(session.key)
      if (!tracked) {
        tracking.set(session.key, { previousTokens: currentTokens, lastChangeTime: session.updatedAt })
      } else if (tracked.previousTokens !== currentTokens) {
        tracking.set(session.key, { previousTokens: currentTokens, lastChangeTime: now })
      }
    })
    // Cleanup stale keys
    const currentKeys = new Set(sessions.map(s => s.key))
    for (const key of tracking.keys()) {
      if (!currentKeys.has(key)) tracking.delete(key)
    }
  }, [sessions])

  const isActivelyRunning = useCallback((sessionKey: string): boolean => {
    const tracked = tokenTrackingRef.current.get(sessionKey)
    if (!tracked) return false
    // Token count changed in last 30s → actively generating
    if (Date.now() - tracked.lastChangeTime < 30000) return true
    // Also check updatedAt — catches tool work that doesn't generate tokens
    const session = sessions.find(s => s.key === sessionKey)
    if (session && (Date.now() - session.updatedAt) < 30000) return true
    return false
  }, [sessions])

  return { isActivelyRunning }
}
