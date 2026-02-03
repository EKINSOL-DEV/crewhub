import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { API_BASE } from '@/lib/api'

// ─── Types ─────────────────────────────────────────────────────

export interface DragState {
  isDragging: boolean
  sessionKey: string | null
  sessionName: string | null
  sourceRoomId: string | null
}

interface DragDropContextValue {
  drag: DragState
  startDrag: (sessionKey: string, sessionName: string, sourceRoomId: string) => void
  endDrag: () => void
  dropOnRoom: (targetRoomId: string) => Promise<void>
}

const defaultDrag: DragState = {
  isDragging: false,
  sessionKey: null,
  sessionName: null,
  sourceRoomId: null,
}

const DragDropContext = createContext<DragDropContextValue>({
  drag: defaultDrag,
  startDrag: () => {},
  endDrag: () => {},
  dropOnRoom: async () => {},
})

// ─── Provider ──────────────────────────────────────────────────

interface DragDropProviderProps {
  children: ReactNode
  /** Called after a successful drop to refresh room assignments */
  onAssignmentChanged?: () => void
}

export function DragDropProvider({ children, onAssignmentChanged }: DragDropProviderProps) {
  const [drag, setDrag] = useState<DragState>(defaultDrag)

  const startDrag = useCallback((sessionKey: string, sessionName: string, sourceRoomId: string) => {
    setDrag({
      isDragging: true,
      sessionKey,
      sessionName,
      sourceRoomId,
    })
  }, [])

  const endDrag = useCallback(() => {
    setDrag(defaultDrag)
  }, [])

  const dropOnRoom = useCallback(async (targetRoomId: string) => {
    const { sessionKey, sourceRoomId } = drag
    if (!sessionKey || targetRoomId === sourceRoomId) {
      endDrag()
      return
    }

    try {
      const response = await fetch(`${API_BASE}/session-room-assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_key: sessionKey,
          room_id: targetRoomId,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        console.error('Failed to assign bot to room:', err)
      } else {
        // Refresh assignments so the view updates
        onAssignmentChanged?.()
      }
    } catch (err) {
      console.error('Failed to assign bot to room:', err)
    } finally {
      endDrag()
    }
  }, [drag, endDrag, onAssignmentChanged])

  return (
    <DragDropContext.Provider value={{ drag, startDrag, endDrag, dropOnRoom }}>
      {children}
    </DragDropContext.Provider>
  )
}

// ─── Hook ──────────────────────────────────────────────────────

export function useDragDrop(): DragDropContextValue {
  return useContext(DragDropContext)
}
