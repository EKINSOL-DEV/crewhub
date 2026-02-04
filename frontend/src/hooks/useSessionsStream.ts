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

export function useSessionsStream(enabled: boolean = true) {
  const [state, setState] = useState<SessionsStreamState>({
    sessions: [],
    loading: true,
    error: null,
    connected: false,
    connectionMethod: "disconnected",
    reconnecting: false,
  })
  
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  
  const fetchSessions = useCallback(async () => {
    try {
      const data = await api.getSessions()
      setState(prev => ({ ...prev, sessions: data.sessions || [], loading: false, error: null }))
      return true
    } catch (err) {
      console.error("Failed to fetch crew:", err)
      setState(prev => ({ ...prev, error: "Failed to load crew", loading: false }))
      return false
    }
  }, [])
  
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }, [])
  
  const startPolling = useCallback(() => {
    stopPolling()
    fetchSessions()
    pollingIntervalRef.current = setInterval(fetchSessions, POLLING_INTERVAL_MS)
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

    const unsubscribeState = sseManager.onStateChange((connectionState) => {
      if (connectionState === "connected") {
        stopPolling()
        setState(prev => ({
          ...prev,
          connected: true,
          connectionMethod: "sse",
          reconnecting: false,
          error: null,
        }))
        // Fetch initial data since SSE doesn't send it on connect
        fetchSessions()
      } else if (connectionState === "connecting") {
        setState(prev => ({
          ...prev,
          reconnecting: true,
        }))
      } else {
        // disconnected - fall back to polling
        setState(prev => ({
          ...prev,
          connected: false,
          connectionMethod: "polling",
          reconnecting: true,
        }))
        startPolling()
      }
    })

    return () => {
      unsubscribeState()
      stopPolling()
    }
  }, [enabled, fetchSessions, startPolling, stopPolling])

  // Subscribe to session events via central SSE manager
  useEffect(() => {
    if (!enabled) return

    const handleSessionsRefresh = (event: MessageEvent) => {
      try {
        const { sessions } = JSON.parse(event.data)
        setState(prev => ({ ...prev, sessions: sessions || [], loading: false, error: null }))
      } catch (error) {
        console.error("Failed to parse sessions-refresh event:", error)
      }
    }

    const handleSessionCreated = (event: MessageEvent) => {
      try {
        const session: CrewSession = JSON.parse(event.data)
        setState(prev => ({ ...prev, sessions: [...prev.sessions, session] }))
      } catch (error) {
        console.error("Failed to parse session-created event:", error)
      }
    }

    const handleSessionUpdated = (event: MessageEvent) => {
      try {
        const updatedSession: CrewSession = JSON.parse(event.data)
        setState(prev => ({
          ...prev,
          sessions: prev.sessions.map(s => s.key === updatedSession.key ? updatedSession : s)
        }))
      } catch (error) {
        console.error("Failed to parse session-updated event:", error)
      }
    }

    const handleSessionRemoved = (event: MessageEvent) => {
      try {
        const { key } = JSON.parse(event.data)
        setState(prev => ({ ...prev, sessions: prev.sessions.filter(s => s.key !== key) }))
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
