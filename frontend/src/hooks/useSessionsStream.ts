import { useState, useEffect, useCallback, useRef } from "react"
import { api, type CrewSession } from "@/lib/api"
import { sseManager } from "@/lib/sseManager"

export interface SessionsStreamState {
  sessions: CrewSession[]
  loading: boolean
  error: string | null
  connected: boolean
  connectionMethod: "sse" | "polling" | "disconnected"
  reconnecting: boolean
}

const POLLING_INTERVAL_MS = 5_000

/**
 * Compute a lightweight fingerprint of sessions data.
 * Used to skip state updates when the data hasn't actually changed,
 * preventing unnecessary re-renders of the entire 3D scene.
 */
function computeSessionsFingerprint(sessions: CrewSession[]): string {
  if (sessions.length === 0) return ""
  // Use key + updatedAt as a fast proxy for data equality.
  // Sorting ensures order-independent comparison.
  return sessions
    .map(s => `${s.key}:${s.updatedAt || 0}:${s.totalTokens || 0}`)
    .sort()
    .join("|")
}

export function useSessionsStream(enabled: boolean = true) {
  const [state, setState] = useState<SessionsStreamState>({
    sessions: [],
    loading: true,
    error: null,
    connected: false,
    connectionMethod: "disconnected",
    reconnecting: false,
  })
  
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollingActiveRef = useRef(false)
  const consecutiveFailsRef = useRef(0)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  // Data deduplication: track fingerprint to avoid re-renders with identical data
  const sessionsFingerprintRef = useRef<string>("")
  // Track whether we've successfully fetched data at least once
  const hasFetchedRef = useRef(false)
  // Track whether SSE was ever connected (to distinguish initial connect from reconnect)
  const wasEverConnectedRef = useRef(false)
  
  const fetchSessions = useCallback(async () => {
    try {
      const data = await api.getSessions()
      const sessions = data.sessions || []
      const fingerprint = computeSessionsFingerprint(sessions)

      if (fingerprint === sessionsFingerprintRef.current && hasFetchedRef.current) {
        // Data unchanged — only clear loading flag if needed
        setState(prev => prev.loading ? { ...prev, loading: false } : prev)
      } else {
        sessionsFingerprintRef.current = fingerprint
        setState(prev => ({ ...prev, sessions, loading: false, error: null }))
      }
      hasFetchedRef.current = true
      return true
    } catch (err) {
      console.error("Failed to fetch crew:", err)
      // Avoid unnecessary re-renders when error is already set
      setState(prev => {
        if (prev.error && !prev.loading) return prev
        return { ...prev, error: "Failed to load crew", loading: false }
      })
      return false
    }
  }, [])
  
  const stopPolling = useCallback(() => {
    pollingActiveRef.current = false
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current)
      pollingTimeoutRef.current = null
    }
    consecutiveFailsRef.current = 0
  }, [])
  
  const startPolling = useCallback(() => {
    stopPolling()
    pollingActiveRef.current = true
    consecutiveFailsRef.current = 0
    
    // Use setTimeout chain with progressive backoff on consecutive failures.
    // Normal: 5s intervals. After failures: 10s, 20s, 40s, up to 60s.
    const schedulePoll = (immediate: boolean) => {
      if (!pollingActiveRef.current) return
      
      const fails = consecutiveFailsRef.current
      const delay = immediate ? 0 : (
        fails === 0
          ? POLLING_INTERVAL_MS
          : Math.min(POLLING_INTERVAL_MS * Math.pow(2, Math.min(fails, 4)), 60_000)
      )
      
      pollingTimeoutRef.current = setTimeout(async () => {
        if (!pollingActiveRef.current) return
        pollingTimeoutRef.current = null
        const success = await fetchSessions()
        if (success) {
          consecutiveFailsRef.current = 0
        } else {
          consecutiveFailsRef.current++
        }
        schedulePoll(false)
      }, delay)
    }
    
    schedulePoll(true)
  }, [fetchSessions, stopPolling])

  // Handle SSE connection state changes
  useEffect(() => {
    if (!enabled) {
      setState({
        sessions: [],
        loading: false,
        error: null,
        connected: false,
        connectionMethod: "disconnected",
        reconnecting: false,
      })
      return
    }

    // Track whether the very first onStateChange callback is the immediate/initial one.
    // sseManager.onStateChange fires immediately with the current state on subscribe.
    // On initial mount, SSE is typically "disconnected" (no subscribers yet), which would
    // start polling and fetch data. Then ~1s later SSE connects and fetches AGAIN — causing
    // a visible flash/re-render. We fix this by:
    // 1. Doing ONE initial fetch on mount (below), independent of SSE state
    // 2. Not starting polling on the initial "disconnected" callback
    // 3. Only re-fetching on SSE connect if this is a RECONNECT (might have missed events)
    let isInitialCallback = true

    const unsubscribeState = sseManager.onStateChange((connectionState) => {
      const isInitial = isInitialCallback
      isInitialCallback = false

      if (connectionState === "connected") {
        stopPolling()
        const isReconnect = wasEverConnectedRef.current
        wasEverConnectedRef.current = true
        setState(prev => ({
          ...prev,
          connected: true,
          connectionMethod: "sse",
          reconnecting: false,
          error: null,
        }))
        // On reconnect: re-fetch because we might have missed SSE events while disconnected.
        // On initial connect: skip fetch — the initial fetch (below) already has/is getting data.
        // The fingerprint check in fetchSessions provides a safety net either way.
        if (isReconnect) {
          fetchSessions()
        }
      } else if (connectionState === "connecting") {
        setState(prev => ({
          ...prev,
          // Don't show "reconnecting" on initial connection attempt
          reconnecting: !isInitial,
        }))
      } else {
        // disconnected
        if (isInitial) {
          // Initial mount: SSE hasn't started yet. Don't start polling —
          // we do a single fetch below, and SSE will connect shortly.
          // This prevents the double-fetch that caused the re-render flash.
        } else {
          // Actual disconnection after being connected — fall back to polling
          setState(prev => ({
            ...prev,
            connected: false,
            connectionMethod: "polling",
            reconnecting: true,
          }))
          startPolling()
        }
      }
    })

    // Always do one initial fetch, regardless of SSE state.
    // This ensures data loads immediately without waiting for SSE to connect.
    fetchSessions()

    return () => {
      unsubscribeState()
      stopPolling()
    }
  }, [enabled, fetchSessions, startPolling, stopPolling])

  // Subscribe to session events via central SSE manager
  // Uses queueMicrotask to defer state updates out of the SSE message handler,
  // avoiding Chrome's "message handler took Xms" violations (threshold: 50ms).
  useEffect(() => {
    if (!enabled) return

    const handleSessionsRefresh = (event: MessageEvent) => {
      try {
        const { sessions } = JSON.parse(event.data)
        const newSessions = sessions || []
        // Defer state update to avoid blocking the message handler
        queueMicrotask(() => {
          const fingerprint = computeSessionsFingerprint(newSessions)
          if (fingerprint === sessionsFingerprintRef.current) return
          sessionsFingerprintRef.current = fingerprint
          setState(prev => ({ ...prev, sessions: newSessions, loading: false, error: null }))
        })
      } catch (error) {
        console.error("Failed to parse sessions-refresh event:", error)
      }
    }

    const handleSessionCreated = (event: MessageEvent) => {
      try {
        const session: CrewSession = JSON.parse(event.data)
        // Defer state update to avoid blocking the message handler
        queueMicrotask(() => {
          setState(prev => {
            // Avoid duplicates
            if (prev.sessions.some(s => s.key === session.key)) return prev
            const newSessions = [...prev.sessions, session]
            sessionsFingerprintRef.current = computeSessionsFingerprint(newSessions)
            return { ...prev, sessions: newSessions }
          })
        })
      } catch (error) {
        console.error("Failed to parse session-created event:", error)
      }
    }

    const handleSessionUpdated = (event: MessageEvent) => {
      try {
        const updatedSession: CrewSession = JSON.parse(event.data)
        // Defer state update to avoid blocking the message handler
        queueMicrotask(() => {
          setState(prev => {
            const idx = prev.sessions.findIndex(s => s.key === updatedSession.key)
            if (idx === -1) return prev // Session not found, skip
            // Quick check: if updatedAt hasn't changed, skip
            const existing = prev.sessions[idx]
            if (existing.updatedAt === updatedSession.updatedAt && existing.totalTokens === updatedSession.totalTokens) {
              return prev
            }
            // Use splice for O(1) update instead of map for O(n)
            const newSessions = [...prev.sessions]
            newSessions[idx] = updatedSession
            sessionsFingerprintRef.current = computeSessionsFingerprint(newSessions)
            return { ...prev, sessions: newSessions }
          })
        })
      } catch (error) {
        console.error("Failed to parse session-updated event:", error)
      }
    }

    const handleSessionRemoved = (event: MessageEvent) => {
      try {
        const { key } = JSON.parse(event.data)
        // Defer state update to avoid blocking the message handler
        queueMicrotask(() => {
          setState(prev => {
            if (!prev.sessions.some(s => s.key === key)) return prev // Already gone
            const newSessions = prev.sessions.filter(s => s.key !== key)
            sessionsFingerprintRef.current = computeSessionsFingerprint(newSessions)
            return { ...prev, sessions: newSessions }
          })
        })
      } catch (error) {
        console.error("Failed to parse session-removed event:", error)
      }
    }

    // Subscribe to all session events
    const unsubscribeRefresh = sseManager.subscribe("sessions-refresh", handleSessionsRefresh)
    const unsubscribeCreated = sseManager.subscribe("session-created", handleSessionCreated)
    const unsubscribeUpdated = sseManager.subscribe("session-updated", handleSessionUpdated)
    const unsubscribeRemoved = sseManager.subscribe("session-removed", handleSessionRemoved)

    return () => {
      unsubscribeRefresh()
      unsubscribeCreated()
      unsubscribeUpdated()
      unsubscribeRemoved()
    }
  }, [enabled])
  
  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }))
    await fetchSessions()
  }, [fetchSessions])
  
  return { ...state, refresh }
}

// Backwards compatibility alias
export { useSessionsStream as useMinionsStream }
export type { SessionsStreamState as MinionsStreamState }
