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
    
    // Fetch initial data
    fetchSessions()
    
    // Subscribe to SSE events via central manager
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
    const unsubRefresh = sseManager.subscribe("sessions-refresh", handleSessionsRefresh)
    const unsubCreated = sseManager.subscribe("session-created", handleSessionCreated)
    const unsubUpdated = sseManager.subscribe("session-updated", handleSessionUpdated)
    const unsubRemoved = sseManager.subscribe("session-removed", handleSessionRemoved)
    
    // Subscribe to connection state changes
    const unsubState = sseManager.onStateChange((sseState) => {
      if (sseState === "connected") {
        stopPolling()
        setState(prev => ({
          ...prev,
          connected: true,
          connectionMethod: "sse",
          reconnecting: false,
          error: null,
        }))
      } else if (sseState === "connecting") {
        setState(prev => ({
          ...prev,
          connected: false,
          connectionMethod: "polling",
          reconnecting: true,
        }))
        // Start polling while reconnecting
        startPolling()
      } else {
        setState(prev => ({
          ...prev,
          connected: false,
          connectionMethod: "disconnected",
          reconnecting: false,
        }))
      }
    })
    
    return () => {
      unsubRefresh()
      unsubCreated()
      unsubUpdated()
      unsubRemoved()
      unsubState()
      stopPolling()
    }
  }, [enabled, fetchSessions, startPolling, stopPolling])
  
  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }))
    await fetchSessions()
  }, [fetchSessions])
  
  return { ...state, refresh }
}

// Backwards compatibility alias
export { useSessionsStream as useMinionsStream }
export type { SessionsStreamState as MinionsStreamState }
