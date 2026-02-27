import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { API_BASE } from '@/lib/api'
import { sseManager } from '@/lib/sseManager'

const APPLICATION_JSON = 'application/json'
const UNKNOWN_ERROR = 'Unknown error'

export type FloorStyle =
  | 'default'
  | 'tiles'
  | 'wood'
  | 'concrete'
  | 'carpet'
  | 'lab'
  | 'marble'
  | 'light-wood'
  | 'light-tiles'
  | 'sand'
export type WallStyle =
  | 'default'
  | 'accent-band'
  | 'two-tone'
  | 'wainscoting'
  | 'light'
  | 'pastel-band'
  | 'glass'

export interface Room {
  id: string
  name: string
  icon: string | null
  color: string | null
  sort_order: number
  floor_style: FloorStyle
  wall_style: WallStyle
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
  rule_type: 'keyword' | 'model' | 'label_pattern' | 'session_type' | 'session_key_contains'
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

interface RoomsContextValue {
  rooms: Room[]
  sessionAssignments: Map<string, string>
  rules: RoomAssignmentRule[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  getRoomForSession: (
    sessionKey: string,
    sessionData?: { label?: string; model?: string; channel?: string }
  ) => string | undefined
  getRoomFromRules: (
    sessionKey: string,
    sessionData?: { label?: string; model?: string; channel?: string }
  ) => string | undefined
  createRoom: (room: {
    id: string
    name: string
    icon?: string
    color?: string
    sort_order?: number
  }) => Promise<{ success: boolean; error?: string }>
  updateRoom: (
    roomId: string,
    updates: {
      name?: string
      icon?: string
      color?: string
      sort_order?: number
      floor_style?: string
      wall_style?: string
    }
  ) => Promise<{ success: boolean; error?: string }>
  deleteRoom: (roomId: string) => Promise<{ success: boolean; error?: string }>
  reorderRooms: (roomIds: string[]) => Promise<{ success: boolean; error?: string }>
}

const RoomsContext = createContext<RoomsContextValue | null>(null)

function matchSessionType(value: string, sessionKey: string, channel?: string): boolean {
  switch (value) {
    case 'cron':
      return sessionKey.includes(':cron:')
    case 'subagent':
      return sessionKey.includes(':subagent:') || sessionKey.includes(':spawn:')
    case 'main':
      return sessionKey === 'agent:main:main'
    case 'slack':
      return sessionKey.includes('slack')
    case 'whatsapp':
      return sessionKey.includes('whatsapp') || channel === 'whatsapp'
    case 'telegram':
      return sessionKey.includes('telegram') || channel === 'telegram'
    case 'discord':
      return sessionKey.includes('discord') || channel === 'discord'
    default:
      return false
  }
}

function doesRuleMatch(
  rule: RoomAssignmentRule,
  sessionKey: string,
  sessionData?: { label?: string; model?: string; channel?: string }
): boolean {
  switch (rule.rule_type) {
    case 'session_key_contains':
      return sessionKey.includes(rule.rule_value)
    case 'keyword':
      return !!sessionData?.label?.toLowerCase().includes(rule.rule_value.toLowerCase())
    case 'model':
      return !!sessionData?.model?.toLowerCase().includes(rule.rule_value.toLowerCase())
    case 'label_pattern':
      try {
        const regex = new RegExp(rule.rule_value, 'i')
        return regex.test(sessionData?.label || '') || regex.test(sessionKey)
      } catch {
        return false
      }
    case 'session_type':
      return matchSessionType(rule.rule_value, sessionKey, sessionData?.channel)
    default:
      return false
  }
}

export function RoomsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [sessionAssignments, setSessionAssignments] = useState<Map<string, string>>(new Map())
  const [rules, setRules] = useState<RoomAssignmentRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const hasFetchedRef = useRef(false)

  // Data deduplication: track fingerprints to avoid re-renders with identical data
  const roomsFingerprintRef = useRef<string>('')
  const assignmentsFingerprintRef = useRef<string>('')
  const rulesFingerprintRef = useRef<string>('')

  const processRoomsResponse = useCallback(async (roomsResponse: Response) => {
    const roomsData: RoomsResponse = await roomsResponse.json()
    const newRooms = roomsData.rooms || []
    const fp = JSON.stringify(newRooms.map((r) => `${r.id}:${r.updated_at}:${r.sort_order}`))
    if (fp !== roomsFingerprintRef.current) {
      roomsFingerprintRef.current = fp
      setRooms(newRooms)
    }
  }, [])

  const processAssignmentsResponse = useCallback(async (response: Response) => {
    if (!response.ok) return
    const data: AssignmentsResponse = await response.json()
    const assignments = data.assignments || []
    const fp = JSON.stringify(
      assignments.map((a) => `${a.session_key}:${a.room_id}`).sort((a, b) => a.localeCompare(b))
    )
    if (fp !== assignmentsFingerprintRef.current) {
      assignmentsFingerprintRef.current = fp
      const assignmentsMap = new Map<string, string>()
      for (const assignment of assignments) {
        assignmentsMap.set(assignment.session_key, assignment.room_id)
      }
      setSessionAssignments(assignmentsMap)
    }
  }, [])

  const processRulesResponse = useCallback(async (response: Response) => {
    if (!response.ok) return
    const data: RulesResponse = await response.json()
    const newRules = data.rules || []
    const fp = JSON.stringify(newRules.map((r) => `${r.id}:${r.priority}:${r.rule_value}`))
    if (fp !== rulesFingerprintRef.current) {
      rulesFingerprintRef.current = fp
      setRules(newRules)
    }
  }, [])

  const fetchRooms = useCallback(async () => {
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

      if (!roomsResponse.ok) throw new Error('Failed to fetch rooms')

      await processRoomsResponse(roomsResponse)
      await processAssignmentsResponse(assignmentsResponse)
      await processRulesResponse(rulesResponse)

      setError(null)
      hasFetchedRef.current = true
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('[RoomsContext] Failed to fetch rooms:', err)
      setError(err instanceof Error ? err.message : UNKNOWN_ERROR)
    } finally {
      setIsLoading(false)
    }
  }, [processRoomsResponse, processAssignmentsResponse, processRulesResponse])

  // Initial fetch - only once
  useEffect(() => {
    if (!hasFetchedRef.current) {
      fetchRooms()
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchRooms])

  // Listen for SSE rooms-refresh events
  useEffect(() => {
    const handleRoomsRefresh = () => {
      fetchRooms()
    }

    const unsubscribe = sseManager.subscribe('rooms-refresh', handleRoomsRefresh)
    return () => {
      unsubscribe()
    }
  }, [fetchRooms])

  /**
   * Apply rules to determine room for a session.
   * Returns room_id or undefined if no rule matches.
   */
  const getRoomFromRules = useCallback(
    (
      sessionKey: string,
      sessionData?: { label?: string; model?: string; channel?: string }
    ): string | undefined => {
      for (const rule of rules) {
        if (doesRuleMatch(rule, sessionKey, sessionData)) {
          return rule.room_id
        }
      }
      return undefined
    },
    [rules]
  )

  /**
   * Get the room for a session, checking:
   * 1. Explicit assignment (from API)
   * 2. Rules-based routing
   * Returns undefined if neither matches.
   */
  const getRoomForSession = useCallback(
    (
      sessionKey: string,
      sessionData?: { label?: string; model?: string; channel?: string }
    ): string | undefined => {
      // First check explicit assignment
      const explicitRoom = sessionAssignments.get(sessionKey)
      if (explicitRoom) return explicitRoom

      // Then check rules
      return getRoomFromRules(sessionKey, sessionData)
    },
    [sessionAssignments, getRoomFromRules]
  )

  const createRoom = useCallback(
    async (room: {
      id: string
      name: string
      icon?: string
      color?: string
      sort_order?: number
    }) => {
      try {
        const response = await fetch(`${API_BASE}/rooms`, {
          method: 'POST',
          headers: { CONTENT_TYPE: APPLICATION_JSON },
          body: JSON.stringify({
            id: room.id,
            name: room.name,
            icon: room.icon || null,
            color: room.color || null,
            sort_order: room.sort_order ?? rooms.length,
          }),
        })
        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.detail || 'Failed to create room')
        }
        await fetchRooms()
        return { success: true }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : UNKNOWN_ERROR }
      }
    },
    [fetchRooms, rooms.length]
  )

  const updateRoom = useCallback(
    async (
      roomId: string,
      updates: {
        name?: string
        icon?: string
        color?: string
        sort_order?: number
        floor_style?: string
        wall_style?: string
      }
    ) => {
      try {
        const response = await fetch(`${API_BASE}/rooms/${roomId}`, {
          method: 'PUT',
          headers: { CONTENT_TYPE: APPLICATION_JSON },
          body: JSON.stringify(updates),
        })
        if (!response.ok) throw new Error('Failed to update room')
        await fetchRooms()
        return { success: true }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : UNKNOWN_ERROR }
      }
    },
    [fetchRooms]
  )

  const deleteRoom = useCallback(
    async (roomId: string) => {
      try {
        const response = await fetch(`${API_BASE}/rooms/${roomId}`, {
          method: 'DELETE',
        })
        if (!response.ok) throw new Error('Failed to delete room')
        await fetchRooms()
        return { success: true }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : UNKNOWN_ERROR }
      }
    },
    [fetchRooms]
  )

  const reorderRooms = useCallback(
    async (roomIds: string[]) => {
      try {
        const response = await fetch(`${API_BASE}/rooms/reorder`, {
          method: 'PUT',
          headers: { CONTENT_TYPE: APPLICATION_JSON },
          body: JSON.stringify(roomIds),
        })
        if (!response.ok) throw new Error('Failed to reorder rooms')
        await fetchRooms()
        return { success: true }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : UNKNOWN_ERROR }
      }
    },
    [fetchRooms]
  )

  const value = useMemo<RoomsContextValue>(
    () => ({
      rooms,
      sessionAssignments,
      rules,
      isLoading,
      error,
      refresh: fetchRooms,
      getRoomForSession,
      getRoomFromRules,
      createRoom,
      updateRoom,
      deleteRoom,
      reorderRooms,
    }),
    [
      rooms,
      sessionAssignments,
      rules,
      isLoading,
      error,
      fetchRooms,
      getRoomForSession,
      getRoomFromRules,
      createRoom,
      updateRoom,
      deleteRoom,
      reorderRooms,
    ]
  )

  return <RoomsContext.Provider value={value}>{children}</RoomsContext.Provider>
}

export function useRoomsContext(): RoomsContextValue {
  const context = useContext(RoomsContext)
  if (!context) {
    throw new Error('useRoomsContext must be used within a RoomsProvider')
  }
  return context
}
