import { useState, useEffect, useCallback, useRef } from "react"
import { API_BASE } from "@/lib/api"
import { sseManager } from "@/lib/sseManager"

export interface Room {
  id: string
  name: string
  icon: string | null
  color: string | null
  sort_order: number
  project_id: string | null
  project_name: string | null
  project_color: string | null
  is_hq: boolean
  created_at: number
  updated_at: number
}

export interface SessionRoomAssignment {
  session_key: string
  room_id: string
  assigned_at: number
}

export interface RoomAssignmentRule {
  id: string
  room_id: string
  rule_type: "keyword" | "model" | "label_pattern" | "session_type" | "session_key_contains"
  rule_value: string
  priority: number
  created_at: number
}

interface RoomsResponse {
  rooms: Room[]
}

interface AssignmentsResponse {
  assignments: SessionRoomAssignment[]
}

interface RulesResponse {
  rules: RoomAssignmentRule[]
}

export function useRooms() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [sessionAssignments, setSessionAssignments] = useState<Map<string, string>>(new Map())
  const [rules, setRules] = useState<RoomAssignmentRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchRooms = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      const [roomsResponse, assignmentsResponse, rulesResponse] = await Promise.all([
        fetch(`${API_BASE}/rooms`, { signal }),
        fetch(`${API_BASE}/session-room-assignments`, { signal }),
        fetch(`${API_BASE}/room-assignment-rules`, { signal }),
      ])
      
      if (!roomsResponse.ok) throw new Error("Failed to fetch rooms")
      
      const roomsData: RoomsResponse = await roomsResponse.json()
      setRooms(roomsData.rooms || [])
      
      if (assignmentsResponse.ok) {
        const assignmentsData: AssignmentsResponse = await assignmentsResponse.json()
        const assignmentsMap = new Map<string, string>()
        for (const assignment of assignmentsData.assignments || []) {
          assignmentsMap.set(assignment.session_key, assignment.room_id)
        }
        setSessionAssignments(assignmentsMap)
      }
      
      if (rulesResponse.ok) {
        const rulesData: RulesResponse = await rulesResponse.json()
        setRules(rulesData.rules || [])
      }
      
      setError(null)
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') return
      console.error("[useRooms] CATCH - Failed to fetch rooms:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRooms()
    
    // Cleanup: abort any in-flight requests on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchRooms])

  // Listen for SSE rooms-refresh events via central manager
  useEffect(() => {
    const handleRoomsRefresh = () => {
      fetchRooms()
    }

    // Subscribe to rooms-refresh events using the central SSE manager
    const unsubscribe = sseManager.subscribe("rooms-refresh", handleRoomsRefresh)

    return () => {
      unsubscribe()
    }
  }, [fetchRooms])

  /**
   * Apply rules to determine room for a session.
   * Returns room_id or undefined if no rule matches.
   */
  const getRoomFromRules = useCallback((
    sessionKey: string,
    sessionData?: { label?: string; model?: string; channel?: string }
  ): string | undefined => {
    // Rules are already sorted by priority (descending)
    for (const rule of rules) {
      let matches = false
      
      switch (rule.rule_type) {
        case "session_key_contains":
          matches = sessionKey.includes(rule.rule_value)
          break
        case "keyword":
          if (sessionData?.label) {
            matches = sessionData.label.toLowerCase().includes(rule.rule_value.toLowerCase())
          }
          break
        case "model":
          if (sessionData?.model) {
            matches = sessionData.model.toLowerCase().includes(rule.rule_value.toLowerCase())
          }
          break
        case "label_pattern":
          try {
            const regex = new RegExp(rule.rule_value, "i")
            matches = regex.test(sessionData?.label || "") || regex.test(sessionKey)
          } catch {
            // Invalid regex, skip
          }
          break
        case "session_type":
          if (rule.rule_value === "cron") matches = sessionKey.includes(":cron:")
          else if (rule.rule_value === "subagent") matches = sessionKey.includes(":subagent:") || sessionKey.includes(":spawn:")
          else if (rule.rule_value === "main") matches = sessionKey === "agent:main:main"
          else if (rule.rule_value === "slack") matches = sessionKey.includes("slack")
          else if (rule.rule_value === "whatsapp") matches = sessionKey.includes("whatsapp") || sessionData?.channel === "whatsapp"
          else if (rule.rule_value === "telegram") matches = sessionKey.includes("telegram") || sessionData?.channel === "telegram"
          else if (rule.rule_value === "discord") matches = sessionKey.includes("discord") || sessionData?.channel === "discord"
          break
      }
      
      if (matches) {
        return rule.room_id
      }
    }
    
    return undefined
  }, [rules])

  /**
   * Get the room for a session, checking:
   * 1. Explicit assignment (from API)
   * 2. Rules-based routing
   * Returns undefined if neither matches.
   */
  const getRoomForSession = useCallback((
    sessionKey: string,
    sessionData?: { label?: string; model?: string; channel?: string }
  ): string | undefined => {
    // First check explicit assignment
    const explicitRoom = sessionAssignments.get(sessionKey)
    if (explicitRoom) return explicitRoom
    
    // Then check rules
    return getRoomFromRules(sessionKey, sessionData)
  }, [sessionAssignments, getRoomFromRules])

  const createRoom = useCallback(async (room: {
    id: string
    name: string
    icon?: string
    color?: string
    sort_order?: number
  }) => {
    try {
      const response = await fetch(`${API_BASE}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: room.id,
          name: room.name,
          icon: room.icon || null,
          color: room.color || null,
          sort_order: room.sort_order ?? rooms.length
        })
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.detail || "Failed to create room")
      }
      await fetchRooms()
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
    }
  }, [fetchRooms, rooms.length])

  const updateRoom = useCallback(async (roomId: string, updates: {
    name?: string
    icon?: string
    color?: string
    sort_order?: number
  }) => {
    try {
      const response = await fetch(`${API_BASE}/rooms/${roomId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      })
      if (!response.ok) throw new Error("Failed to update room")
      await fetchRooms()
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
    }
  }, [fetchRooms])

  const deleteRoom = useCallback(async (roomId: string) => {
    try {
      const response = await fetch(`${API_BASE}/rooms/${roomId}`, {
        method: "DELETE"
      })
      if (!response.ok) throw new Error("Failed to delete room")
      await fetchRooms()
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
    }
  }, [fetchRooms])

  const reorderRooms = useCallback(async (roomIds: string[]) => {
    try {
      const response = await fetch(`${API_BASE}/rooms/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roomIds)
      })
      if (!response.ok) throw new Error("Failed to reorder rooms")
      await fetchRooms()
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
    }
  }, [fetchRooms])

  return { 
    rooms, 
    sessionAssignments, 
    rules,
    getRoomForSession, 
    getRoomFromRules,
    isLoading, 
    error, 
    refresh: fetchRooms,
    createRoom,
    updateRoom,
    deleteRoom,
    reorderRooms
  }
}
