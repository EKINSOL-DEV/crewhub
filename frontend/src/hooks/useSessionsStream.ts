import { useState, useEffect, useCallback, useRef } from "react"
import { api, type CrewSession } from "@/lib/api"

export interface SessionsStreamState {
  sessions: CrewSession[]
  loading: boolean
  error: string | null
  connected: boolean
  connectionMethod: "sse" | "polling" | "disconnected"
}

const getAuthToken = (): string => localStorage.getItem("openclaw_token") || ""

export function useSessionsStream(enabled: boolean = true) {
  const [state, setState] = useState<SessionsStreamState>({
    sessions: [],
    loading: true,
    error: null,
    connected: false,
    connectionMethod: "disconnected",
  })
  
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  
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
  
  const fallbackToPolling = useCallback(() => {
    setState(prev => ({ ...prev, connectionMethod: "polling", connected: true }))
    fetchSessions()
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
    pollingIntervalRef.current = setInterval(fetchSessions, 5000)
  }, [fetchSessions])
  
  const setupSSE = useCallback(() => {
    if (!enabled) return
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
        reconnectAttemptsRef.current = 0
        setState(prev => ({ ...prev, connected: true, connectionMethod: "sse", error: null }))
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
        setState(prev => ({ ...prev, connected: false, connectionMethod: "disconnected" }))
        
        if (reconnectAttemptsRef.current < 5) {
          const delay = 1000 * Math.pow(2, reconnectAttemptsRef.current)
          reconnectAttemptsRef.current++
          reconnectTimeoutRef.current = setTimeout(setupSSE, delay)
        } else {
          fallbackToPolling()
        }
      }
    } catch {
      fallbackToPolling()
    }
  }, [enabled, fallbackToPolling])
  
  useEffect(() => {
    if (!enabled) {
      setState({ sessions: [], loading: false, error: null, connected: false, connectionMethod: "disconnected" })
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
