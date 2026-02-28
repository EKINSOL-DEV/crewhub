import { useRef, useEffect, useCallback } from 'react'
import type { CrewSession } from '@/lib/api'
import { SESSION_CONFIG } from '@/lib/sessionConfig'

/**
 * Shared hook that tracks token changes to detect actively running sessions.
 * Extracted from PlaygroundView for reuse in both 2D and 3D views.
 */
export function useSessionActivity(sessions: CrewSession[]) {
  const tokenTrackingRef = useRef<Map<string, { previousTokens: number; lastChangeTime: number }>>(
    new Map()
  )

  useEffect(() => {
    const now = Date.now()
    const tracking = tokenTrackingRef.current
    sessions.forEach((session) => {
      const currentTokens = session.totalTokens || 0
      const tracked = tracking.get(session.key)
      if (!tracked) {
        tracking.set(session.key, {
          previousTokens: currentTokens,
          lastChangeTime: session.updatedAt,
        })
      } else if (tracked.previousTokens !== currentTokens) {
        tracking.set(session.key, { previousTokens: currentTokens, lastChangeTime: now })
      }
    })
    // Cleanup stale keys
    const currentKeys = new Set(sessions.map((s) => s.key))
    for (const key of tracking.keys()) {
      if (!currentKeys.has(key)) tracking.delete(key)
    }
  }, [sessions])

  const isActivelyRunning = useCallback(
    (sessionKey: string): boolean => {
      // Claude Code sessions have explicit status — no heuristics needed
      const session = sessions.find((s) => s.key === sessionKey)
      if (session?.source === 'claude_code') {
        const activeStatuses = ['responding', 'tool_use', 'waiting_permission']
        return activeStatuses.includes(session.status ?? '')
      }

      const tracked = tokenTrackingRef.current.get(sessionKey)
      if (!tracked) return false
      // Token count changed recently → actively generating
      if (Date.now() - tracked.lastChangeTime < SESSION_CONFIG.tokenChangeThresholdMs) return true
      // Also check updatedAt — catches tool work that doesn't generate tokens
      if (session && Date.now() - session.updatedAt < SESSION_CONFIG.updatedAtActiveMs) return true
      return false
    },
    [sessions]
  )

  return { isActivelyRunning }
}
