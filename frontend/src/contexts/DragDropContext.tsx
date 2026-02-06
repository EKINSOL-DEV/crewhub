import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect, type ReactNode } from 'react'
import { API_BASE } from '@/lib/api'

// ─── Types ─────────────────────────────────────────────────────

export interface DragState {
  isDragging: boolean
  isInteractingWithUI: boolean  // Blocks camera when user interacts with UI overlays
  sessionKey: string | null
  sessionName: string | null
  sourceRoomId: string | null
  error: string | null
}

interface DragActions {
  startDrag: (sessionKey: string, sessionName: string, sourceRoomId: string) => void
  endDrag: () => void
  dropOnRoom: (targetRoomId: string) => Promise<void>
  dropOnParking: () => Promise<void>
  clearError: () => void
  setInteractingWithUI: (value: boolean) => void
}

const defaultDrag: DragState = {
  isDragging: false,
  isInteractingWithUI: false,
  sessionKey: null,
  sessionName: null,
  sourceRoomId: null,
  error: null,
}

// Split into two contexts: state (changes during drag) and actions (stable callbacks)
const DragStateContext = createContext<DragState>(defaultDrag)
const DragActionsContext = createContext<DragActions>({
  startDrag: () => {},
  endDrag: () => {},
  dropOnRoom: async () => {},
  dropOnParking: async () => {},
  clearError: () => {},
  setInteractingWithUI: () => {},
})

// ─── Provider ──────────────────────────────────────────────────

interface DragDropProviderProps {
  children: ReactNode
  /** Called after a successful drop to refresh room assignments */
  onAssignmentChanged?: () => void
}

export function DragDropProvider({ children, onAssignmentChanged }: DragDropProviderProps) {
  const [drag, setDrag] = useState<DragState>(defaultDrag)
  // Use ref for current drag state so callbacks don't need to depend on `drag`
  const dragRef = useRef<DragState>(defaultDrag)
  dragRef.current = drag

  const onAssignmentChangedRef = useRef(onAssignmentChanged)
  onAssignmentChangedRef.current = onAssignmentChanged

  const startDrag = useCallback((sessionKey: string, sessionName: string, sourceRoomId: string) => {
    setDrag({
      isDragging: true,
      isInteractingWithUI: false,
      sessionKey,
      sessionName,
      sourceRoomId,
      error: null,
    })
  }, [])

  const endDrag = useCallback(() => {
    setDrag(prev => ({ ...defaultDrag, error: prev.error }))
  }, [])

  const clearError = useCallback(() => {
    setDrag(prev => ({ ...prev, error: null }))
  }, [])

  const setInteractingWithUI = useCallback((value: boolean) => {
    setDrag(prev => ({ ...prev, isInteractingWithUI: value }))
  }, [])

  const setErrorWithAutoClear = useCallback((message: string) => {
    setDrag({ ...defaultDrag, error: message })
    setTimeout(() => setDrag(s => s.error === message ? { ...s, error: null } : s), 4000)
  }, [])

  const dropOnRoom = useCallback(async (targetRoomId: string) => {
    // Read from ref to avoid stale closures
    const { sessionKey, sourceRoomId } = dragRef.current
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
        const message = err?.detail || err?.message || 'Failed to move bot. Please try again.'
        console.error('Failed to assign bot to room:', err)
        setErrorWithAutoClear(message)
      } else {
        onAssignmentChangedRef.current?.()
        setDrag(defaultDrag)
      }
    } catch (err) {
      const message = 'Network error — couldn\'t move bot. Please retry.'
      console.error('Failed to assign bot to room:', err)
      setErrorWithAutoClear(message)
    }
  }, [endDrag, setErrorWithAutoClear])

  const dropOnParking = useCallback(async () => {
    // Read from ref to avoid stale closures
    const { sessionKey, sourceRoomId } = dragRef.current
    if (!sessionKey || sourceRoomId === 'parking') {
      endDrag()
      return
    }

    try {
      // DELETE the assignment to unassign from room (moves to parking)
      const response = await fetch(`${API_BASE}/session-room-assignments/${encodeURIComponent(sessionKey)}`, {
        method: 'DELETE',
      })

      if (!response.ok && response.status !== 404) {
        const err = await response.json().catch(() => ({}))
        const message = err?.detail || err?.message || 'Failed to unassign bot. Please try again.'
        console.error('Failed to unassign bot from room:', err)
        setErrorWithAutoClear(message)
      } else {
        onAssignmentChangedRef.current?.()
        setDrag(defaultDrag)
      }
    } catch (err) {
      const message = 'Network error — couldn\'t unassign bot. Please retry.'
      console.error('Failed to unassign bot from room:', err)
      setErrorWithAutoClear(message)
    }
  }, [endDrag, setErrorWithAutoClear])

  // Escape key cancels drag
  useEffect(() => {
    if (!drag.isDragging) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        endDrag()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [drag.isDragging, endDrag])

  // Actions are now truly stable (no dependency on `drag` state)
  const actions = useMemo<DragActions>(() => ({
    startDrag,
    endDrag,
    dropOnRoom,
    dropOnParking,
    clearError,
    setInteractingWithUI,
  }), [startDrag, endDrag, dropOnRoom, dropOnParking, clearError, setInteractingWithUI])

  return (
    <DragStateContext.Provider value={drag}>
      <DragActionsContext.Provider value={actions}>
        {children}
        {/* Drag error toast overlay */}
        {drag.error && (
          <div
            style={{
              position: 'fixed',
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(220, 38, 38, 0.95)',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: '10px',
              fontSize: '14px',
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 500,
              zIndex: 9999,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              maxWidth: '400px',
              animation: 'fadeInUp 0.25s ease-out',
            }}
            onClick={clearError}
          >
            <span>⚠️</span>
            <span>{drag.error}</span>
          </div>
        )}
        {/* Full-screen drag overlay (captures drops on outdoor/parking areas) */}
        {drag.isDragging && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40,
              cursor: 'grabbing',
              // Transparent overlay — doesn't block room drop zones which have higher z-index
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(e) => {
              e.preventDefault()
              // If we get here, the drop was NOT on a room drop zone
              // → treat as "drop on outdoor/parking" = unassign
              dropOnParking()
            }}
          />
        )}
      </DragActionsContext.Provider>
    </DragStateContext.Provider>
  )
}

// ─── Hooks ─────────────────────────────────────────────────────

/** Read drag state (re-renders when drag state changes) */
export function useDragState(): DragState {
  return useContext(DragStateContext)
}

/** Read drag actions (stable — doesn't cause re-renders on drag state change) */
export function useDragActions(): DragActions {
  return useContext(DragActionsContext)
}

/** Combined hook for backwards compatibility */
export function useDragDrop(): { drag: DragState } & DragActions {
  const state = useContext(DragStateContext)
  const actions = useContext(DragActionsContext)
  return { drag: state, ...actions }
}
