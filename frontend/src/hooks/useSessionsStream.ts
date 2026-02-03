import { useState, useEffect, useCallback, useRef } from "react"
import { api, type CrewSession } from "@/lib/api"

export interface SessionsStreamState {
  sessions: CrewSession[]
  loading: boolean
  error: string | null
  connected: boolean
  connectionMethod: "sse" | "polling" | "disconnected"
  reconnecting: boolean
}

const getAuthToken = (): string => localStorage.getItem("openclaw_token") || ""

const MAX_BACKOFF_MS = 30_000
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
  
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
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
  
  const setupSSE = useCallback(() => {
    if (!enabledRef.current) return
    
    // Clean up any existing SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    
    try {
      const token = getAuthToken()
      const sseUrl = token ? `/api/events?token=${encodeURIComponent(token)}` : "/api/events"
      const eventSource = new EventSource(sseUrl)
      eventSourceRef.current = eventSource
      
      eventSource.onopen = () => {
        // SSE connected successfully — stop polling, reset counter
        reconnectAttemptsRef.current = 0
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
      }
      
      eventSource.addEventListener("sessions-refresh", (event) => {
        try {
          const { sessions } = JSON.parse(event.data)
          setState(prev => ({ ...prev, sessions: sessions || [], loading: false, error: null }))
        } catch (error) {
          console.error("Failed to parse sessions-refresh event:", error)
        }
      })
      
      eventSource.addEventListener("session-created", (event) => {
        try {
          const session: CrewSession = JSON.parse(event.data)
          setState(prev => ({ ...prev, sessions: [...prev.sessions, session] }))
        } catch (error) {
          console.error("Failed to parse session-created event:", error)
        }
      })
      
      eventSource.addEventListener("session-updated", (event) => {
        try {
          const updatedSession: CrewSession = JSON.parse(event.data)
          setState(prev => ({
            ...prev,
            sessions: prev.sessions.map(s => s.key === updatedSession.key ? updatedSession : s)
          }))
        } catch (error) {
          console.error("Failed to parse session-updated event:", error)
        }
      })
      
      eventSource.addEventListener("session-removed", (event) => {
        try {
          const { key } = JSON.parse(event.data)
          setState(prev => ({ ...prev, sessions: prev.sessions.filter(s => s.key !== key) }))
        } catch (error) {
          console.error("Failed to parse session-removed event:", error)
        }
      })
      
      eventSource.onerror = () => {
        eventSource.close()
        eventSourceRef.current = null
        
        // Calculate backoff: 1s, 2s, 4s, 8s, 16s, 30s, 30s, 30s...
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), MAX_BACKOFF_MS)
        reconnectAttemptsRef.current++
        
        console.log(`SSE disconnected — reconnecting in ${delay / 1000}s (attempt ${reconnectAttemptsRef.current})`)
        
        // Switch to polling to keep data fresh while reconnecting
        setState(prev => ({
          ...prev,
          connected: false,
          connectionMethod: "polling",
          reconnecting: true,
        }))
        startPolling()
        
        // Schedule next SSE attempt
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = setTimeout(setupSSE, delay)
      }
    } catch {
      // SSE constructor failed — poll and retry
      setState(prev => ({
        ...prev,
        connected: false,
        connectionMethod: "polling",
        reconnecting: true,
      }))
      startPolling()
      
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), MAX_BACKOFF_MS)
      reconnectAttemptsRef.current++
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = setTimeout(setupSSE, delay)
    }
  }, [fetchSessions, startPolling, stopPolling])
  
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
    setupSSE()
    return () => {
      if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null }
      if (pollingIntervalRef.current) { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null }
      if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null }
    }
  }, [enabled, setupSSE])
  
  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }))
    await fetchSessions()
  }, [fetchSessions])
  
  return { ...state, refresh }
}

// Backwards compatibility alias
export { useSessionsStream as useMinionsStream }
export type { SessionsStreamState as MinionsStreamState }
