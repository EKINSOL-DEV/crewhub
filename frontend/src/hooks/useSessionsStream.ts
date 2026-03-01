import React, { useState, useEffect, useCallback, useRef } from 'react'
import { api, type CrewSession } from '@/lib/api'
import { sseManager } from '@/lib/sseManager'

export interface SessionsStreamState {
  sessions: CrewSession[]
  loading: boolean
  error: string | null
  connected: boolean
  connectionMethod: 'sse' | 'polling' | 'disconnected'
  reconnecting: boolean
}

const POLLING_INTERVAL_MS = 5_000
const CACHE_KEY = 'crewhub-sessions-cache'
const CACHE_MAX_AGE_MS = 60 * 60 * 1000 // 1 hour
const CACHE_DEBOUNCE_MS = 2_000

/** Read cached sessions from localStorage, ignoring stale or corrupt data. */
function readCachedSessions(): CrewSession[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { sessions: CrewSession[]; savedAt: number }
    if (Date.now() - parsed.savedAt > CACHE_MAX_AGE_MS) return null
    if (!Array.isArray(parsed.sessions) || parsed.sessions.length === 0) return null
    return parsed.sessions
  } catch {
    return null
  }
}

/** Save sessions to localStorage (called on a debounce). */
function writeCachedSessions(sessions: CrewSession[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ sessions, savedAt: Date.now() }))
  } catch {
    // Storage full or unavailable — silently skip
  }
}

/**
 * Compute a lightweight fingerprint of sessions data.
 * Used to skip state updates when the data hasn't actually changed,
 * preventing unnecessary re-renders of the entire 3D scene.
 *
 * Optimized: Uses a single pass with reduce instead of map+sort+join.
 */
function computeSessionsFingerprint(sessions: CrewSession[]): string {
  if (sessions.length === 0) return ''

  // Single pass: build sorted key array and join
  // This is O(n log n) but with lower constant factor than map+sort+join
  const keys = new Array(sessions.length)
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i]
    keys[i] = `${s.key}:${s.updatedAt || 0}:${s.totalTokens || 0}`
  }
  keys.sort((a, b) => a.localeCompare(b))
  return keys.join('|')
}

/**
 * Quick equality check for a single session update.
 * Returns true if the session data is effectively unchanged.
 */
function isSessionUnchanged(existing: CrewSession, updated: CrewSession): boolean {
  return existing.updatedAt === updated.updatedAt && existing.totalTokens === updated.totalTokens
}

// ── Module-level updater factories ────────────────────────────────────────────
// Extracting these reduces setState callback nesting depth below 4 levels.

function makeSessionCreatedUpdater(session: CrewSession, fingerprintRef: { current: string }) {
  return (prev: SessionsStreamState): SessionsStreamState => {
    if (prev.sessions.some((s) => s.key === session.key)) return prev
    const newSessions = [...prev.sessions, session]
    fingerprintRef.current = computeSessionsFingerprint(newSessions)
    return { ...prev, sessions: newSessions }
  }
}

function makeSessionUpdatedUpdater(
  updatedSession: CrewSession,
  fingerprintRef: { current: string }
) {
  return (prev: SessionsStreamState): SessionsStreamState => {
    const idx = prev.sessions.findIndex((s) => s.key === updatedSession.key)
    if (idx === -1) return prev // Session not found, skip

    // Quick check: if data hasn't changed, skip update
    const existing = prev.sessions[idx]
    if (isSessionUnchanged(existing, updatedSession)) {
      return prev
    }

    // Use splice for O(1) update instead of map for O(n)
    const newSessions = [...prev.sessions]
    newSessions[idx] = updatedSession
    fingerprintRef.current = computeSessionsFingerprint(newSessions)
    return { ...prev, sessions: newSessions }
  }
}

function makeSessionRemovedUpdater(key: string, fingerprintRef: { current: string }) {
  return (prev: SessionsStreamState): SessionsStreamState => {
    if (!prev.sessions.some((s) => s.key === key)) return prev // Already gone
    const newSessions = prev.sessions.filter((s) => s.key !== key)
    fingerprintRef.current = computeSessionsFingerprint(newSessions)
    return { ...prev, sessions: newSessions }
  }
}

function handleSSEStateChange(
  connectionState: 'disconnected' | 'connecting' | 'connected',
  isInitial: boolean,
  deps: {
    stopPolling: () => void
    startPolling: () => void
    fetchSessions: () => Promise<boolean>
    wasEverConnectedRef: React.MutableRefObject<boolean>
    setState: React.Dispatch<React.SetStateAction<SessionsStreamState>>
  }
): void {
  const { stopPolling, startPolling, fetchSessions, wasEverConnectedRef, setState } = deps

  if (connectionState === 'connected') {
    stopPolling()
    const isReconnect = wasEverConnectedRef.current
    wasEverConnectedRef.current = true
    setState((prev) => ({
      ...prev,
      connected: true,
      connectionMethod: 'sse',
      reconnecting: false,
      error: null,
    }))
    if (isReconnect) fetchSessions()
    return
  }

  if (connectionState === 'connecting') {
    setState((prev) => ({ ...prev, reconnecting: !isInitial }))
    return
  }

  // disconnected
  if (isInitial) return // Initial mount — SSE will connect shortly
  setState((prev) => ({
    ...prev,
    connected: false,
    connectionMethod: 'polling',
    reconnecting: true,
  }))
  startPolling()
}

export function useSessionsStream(enabled: boolean = true) {
  const [state, setState] = useState<SessionsStreamState>(() => {
    const cached = enabled ? readCachedSessions() : null
    return {
      sessions: cached ?? [],
      loading: true,
      error: null,
      connected: false,
      connectionMethod: 'disconnected',
      reconnecting: false,
    }
  })

  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollingActiveRef = useRef(false)
  // Throttle session-updated SSE events to max 10 re-renders/sec (100ms window)
  const sessionUpdateThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingUpdatesRef = useRef<Map<string, CrewSession>>(new Map())
  const consecutiveFailsRef = useRef(0)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  // Data deduplication: track fingerprint to avoid re-renders with identical data
  const sessionsFingerprintRef = useRef<string>('')
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
        setState((prev) => (prev.loading ? { ...prev, loading: false } : prev))
      } else {
        sessionsFingerprintRef.current = fingerprint
        setState((prev) => ({ ...prev, sessions, loading: false, error: null }))
      }
      hasFetchedRef.current = true
      return true
    } catch (err) {
      console.error('Failed to fetch crew:', err)
      // Avoid unnecessary re-renders when error is already set
      setState((prev) => {
        if (prev.error && !prev.loading) return prev
        return { ...prev, error: 'Failed to load crew', loading: false }
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
      let delay: number
      if (immediate) {
        delay = 0
      } else if (fails === 0) {
        delay = POLLING_INTERVAL_MS
      } else {
        delay = Math.min(POLLING_INTERVAL_MS * Math.pow(2, Math.min(fails, 4)), 60_000)
      }

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
        connectionMethod: 'disconnected',
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

      handleSSEStateChange(connectionState, isInitial, {
        stopPolling,
        startPolling,
        fetchSessions,
        wasEverConnectedRef,
        setState,
      })
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
  // Note: sseManager now handles queueMicrotask deferral internally,
  // so handlers are already running outside the message handler context.
  useEffect(() => {
    if (!enabled) return

    // Handler receives pre-parsed data from sseManager
    const handleSessionsRefresh = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        const newSessions = data.sessions || []
        const fingerprint = computeSessionsFingerprint(newSessions)
        if (fingerprint === sessionsFingerprintRef.current) return
        sessionsFingerprintRef.current = fingerprint
        setState((prev) => ({ ...prev, sessions: newSessions, loading: false, error: null }))
      } catch (error) {
        console.error('Failed to parse sessions-refresh event:', error)
      }
    }

    const handleSessionCreated = (event: MessageEvent) => {
      try {
        const session: CrewSession = JSON.parse(event.data)
        setState(makeSessionCreatedUpdater(session, sessionsFingerprintRef))
      } catch (error) {
        console.error('Failed to parse session-created event:', error)
      }
    }

    const handleSessionUpdated = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)

        // Thin CC activity update: merge into existing session instead of replacing
        if (data.source === 'claude_code' && data.sessionKey && !data.key) {
          setState((prev) => {
            const idx = prev.sessions.findIndex((s) => s.key === data.sessionKey)
            if (idx === -1) return prev
            const updated = { ...prev.sessions[idx] }
            if (data.status) updated.status = data.status
            if (data.activity_detail !== undefined)
              updated.activityDetail = data.activity_detail || undefined
            if (data.activity_tool_name !== undefined)
              updated.activityToolName = data.activity_tool_name || undefined
            updated.updatedAt = Date.now()
            const newSessions = [...prev.sessions]
            newSessions[idx] = updated
            sessionsFingerprintRef.current = computeSessionsFingerprint(newSessions)
            return { ...prev, sessions: newSessions }
          })
          return
        }

        // Full session update (from polling/OpenClaw) — existing logic
        const updatedSession: CrewSession = data
        // Accumulate updates and flush at most every 100ms to prevent
        // high-frequency SSE bursts from triggering per-event React re-renders.
        pendingUpdatesRef.current.set(updatedSession.key, updatedSession)
        if (!sessionUpdateThrottleRef.current) {
          sessionUpdateThrottleRef.current = setTimeout(() => {
            sessionUpdateThrottleRef.current = null
            const batch = new Map(pendingUpdatesRef.current)
            pendingUpdatesRef.current.clear()
            batch.forEach((updated) => {
              setState(makeSessionUpdatedUpdater(updated, sessionsFingerprintRef))
            })
          }, 100)
        }
      } catch (error) {
        console.error('Failed to parse session-updated event:', error)
      }
    }

    const handleSessionRemoved = (event: MessageEvent) => {
      try {
        const { key } = JSON.parse(event.data)
        setState(makeSessionRemovedUpdater(key, sessionsFingerprintRef))
      } catch (error) {
        console.error('Failed to parse session-removed event:', error)
      }
    }

    // Subscribe to all session events
    const unsubscribeRefresh = sseManager.subscribe('sessions-refresh', handleSessionsRefresh)
    const unsubscribeCreated = sseManager.subscribe('session-created', handleSessionCreated)
    const unsubscribeUpdated = sseManager.subscribe('session-updated', handleSessionUpdated)
    const unsubscribeRemoved = sseManager.subscribe('session-removed', handleSessionRemoved)

    const pendingUpdates = pendingUpdatesRef.current
    return () => {
      unsubscribeRefresh()
      unsubscribeCreated()
      unsubscribeUpdated()
      unsubscribeRemoved()
      if (sessionUpdateThrottleRef.current) {
        clearTimeout(sessionUpdateThrottleRef.current)
        sessionUpdateThrottleRef.current = null
      }
      pendingUpdates.clear()
    }
  }, [enabled])

  // Debounce-save sessions to localStorage for instant restore on reload
  useEffect(() => {
    if (!enabled || state.sessions.length === 0) return
    const timer = setTimeout(() => writeCachedSessions(state.sessions), CACHE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [enabled, state.sessions])

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }))
    await fetchSessions()
  }, [fetchSessions])

  return { ...state, refresh }
}

// Backwards compatibility alias
export { useSessionsStream as useMinionsStream }
export type { SessionsStreamState as MinionsStreamState }
