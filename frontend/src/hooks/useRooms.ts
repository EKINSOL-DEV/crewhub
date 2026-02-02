import { useState, useEffect, useCallback } from "react"
import { API_BASE } from "@/lib/api"

export interface Room {
  id: string
  name: string
  icon: string | null
  color: string | null
  sort_order: number
  created_at: number
  updated_at: number
}

export interface SessionRoomAssignment {
  session_key: string
  room_id: string
  assigned_at: number
}

interface RoomsResponse {
  rooms: Room[]
}

interface AssignmentsResponse {
  assignments: SessionRoomAssignment[]
}

export function useRooms() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [sessionAssignments, setSessionAssignments] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRooms = useCallback(async () => {
    try {
      const [roomsResponse, assignmentsResponse] = await Promise.all([
        fetch(`${API_BASE}/rooms`),
        fetch(`${API_BASE}/session-room-assignments`),
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
      
      setError(null)
    } catch (err) {
      console.error("Failed to fetch rooms:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  const getRoomForSession = useCallback((sessionKey: string): string | undefined => {
    return sessionAssignments.get(sessionKey)
  }, [sessionAssignments])

  return { rooms, sessionAssignments, getRoomForSession, isLoading, error, refresh: fetchRooms }
}
