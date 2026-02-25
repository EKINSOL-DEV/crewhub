/**
 * CreatorModeContext — global state for Creator Mode (prop placement).
 *
 * Features:
 * - Toggle via [E] key or button
 * - Persist isCreatorMode in localStorage
 * - Prop selection for click-to-place
 * - Undo/redo stack (synced via SSE → API calls)
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { API_BASE } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Placement {
  position: Vec3
  rotation_y: number
  scale: number
  room_id: string | null
}

export interface PlacedProp {
  id: string
  prop_id: string
  position: Vec3
  rotation_y: number
  scale: number
  room_id: string | null
  placed_by: string | null
  placed_at: number
  metadata?: Record<string, unknown> | null
}

export type PlacementAction =
  // M3: scale added so redo-place restores the correct scale
  | {
      type: 'place'
      placedId: string
      propId: string
      position: Vec3
      rotation_y: number
      scale: number
      roomId?: string | null
    }
  | { type: 'remove'; placedId: string; snapshot: PlacedProp }
  | { type: 'move'; placedId: string; from: Placement; to: Placement }

export interface CreatorModeContextValue {
  isCreatorMode: boolean
  toggleCreatorMode: () => void

  /** The prop currently selected to be placed (from the browser) */
  selectedPropId: string | null
  selectProp: (propId: string) => void
  clearSelection: () => void

  /** Current rotation for next placement (degrees, multiple of 90) */
  pendingRotation: number
  rotatePending: () => void
  resetRotation: () => void

  /** Placed props from the backend (loaded & updated via SSE) */
  placedProps: PlacedProp[]
  refreshPlacedProps: () => void

  /** Undo/Redo stack */
  undoStack: PlacementAction[]
  redoStack: PlacementAction[]
  pushAction: (action: PlacementAction) => void
  undo: () => void
  redo: () => void

  /** Prop browser visibility */
  isBrowserOpen: boolean
  openBrowser: () => void
  closeBrowser: () => void
  toggleBrowser: () => void

  /** API key stored in localStorage (for manage-scope requests) */
  apiKey: string | null
}

// ── Context ───────────────────────────────────────────────────────

const CreatorModeContext = createContext<CreatorModeContextValue | null>(null)

export function useCreatorMode(): CreatorModeContextValue {
  const ctx = useContext(CreatorModeContext)
  if (!ctx) throw new Error('useCreatorMode must be used within <CreatorModeProvider>')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────

const LS_CREATOR_KEY = 'crewhub-creator-mode'
const LS_API_KEY = 'crewhub-api-key'

export function CreatorModeProvider({ children }: { children: ReactNode }) {
  const [isCreatorMode, setIsCreatorMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LS_CREATOR_KEY) === 'true'
    } catch {
      return false
    }
  })

  const [selectedPropId, setSelectedPropId] = useState<string | null>(null)
  const [pendingRotation, setPendingRotation] = useState(0)
  const [placedProps, setPlacedProps] = useState<PlacedProp[]>([])
  const [undoStack, setUndoStack] = useState<PlacementAction[]>([])
  const [redoStack, setRedoStack] = useState<PlacementAction[]>([])
  const [isBrowserOpen, setIsBrowserOpen] = useState(false)
  const [apiKey, setApiKey] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LS_API_KEY)
    } catch {
      return null
    }
  })

  // ── Canvas glow class on document root ─────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('creator-mode-active', isCreatorMode)
    return () => document.documentElement.classList.remove('creator-mode-active')
  }, [isCreatorMode])

  // ── Persist creator mode ────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(LS_CREATOR_KEY, isCreatorMode ? 'true' : 'false')
    } catch {
      // ignore
    }
  }, [isCreatorMode])

  // ── Keyboard shortcuts ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      // Don't fire inside text inputs
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return

      if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setIsCreatorMode((prev) => !prev)
      }
      if (e.key.toLowerCase() === 'b' && !e.ctrlKey && !e.metaKey) {
        setIsBrowserOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && selectedPropId) {
        setSelectedPropId(null)
      }
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && selectedPropId) {
        setPendingRotation((prev) => (prev + 90) % 360)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoRef.current()
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))
      ) {
        e.preventDefault()
        redoRef.current()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedPropId])

  // ── Load placed props ──────────────────────────────────────────
  const refreshPlacedProps = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/world/props`)
      if (resp.ok) {
        const data = await resp.json()
        setPlacedProps(data.props ?? [])
      }
    } catch (err) {
      console.warn('[CreatorMode] Failed to load placed props:', err)
    }
  }, [])

  useEffect(() => {
    refreshPlacedProps()
  }, [refreshPlacedProps])

  // ── SSE: listen for prop_update events ──────────────────────────
  useEffect(() => {
    const sseUrl = `${API_BASE}/events`
    const source = new EventSource(sseUrl)

    source.addEventListener('prop_update', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as {
          action: 'place' | 'move' | 'remove'
          placed_id: string
          prop_id: string
          position: Vec3
          rotation_y: number
          scale: number
          room_id: string | null
          placed_by: string | null
          placed_at: number
        }

        if (data.action === 'place') {
          setPlacedProps((prev) => {
            if (prev.some((p) => p.id === data.placed_id)) return prev
            return [
              ...prev,
              {
                id: data.placed_id,
                prop_id: data.prop_id,
                position: data.position,
                rotation_y: data.rotation_y,
                scale: data.scale,
                room_id: data.room_id,
                placed_by: data.placed_by,
                placed_at: data.placed_at,
              },
            ]
          })
        } else if (data.action === 'move') {
          setPlacedProps((prev) =>
            prev.map((p) =>
              p.id === data.placed_id
                ? {
                    ...p,
                    position: data.position,
                    rotation_y: data.rotation_y,
                    scale: data.scale,
                    room_id: data.room_id,
                  }
                : p
            )
          )
        } else if (data.action === 'remove') {
          setPlacedProps((prev) => prev.filter((p) => p.id !== data.placed_id))
        }
      } catch (err) {
        console.warn('[CreatorMode] Failed to parse prop_update SSE event:', err)
      }
    })

    source.onerror = () => {
      // SSE will auto-reconnect; we just ignore the error
    }

    return () => source.close()
  }, [])

  // ── Actions ────────────────────────────────────────────────────

  const toggleCreatorMode = useCallback(() => {
    setIsCreatorMode((prev) => {
      if (prev) {
        // Turning off: clear selection
        setSelectedPropId(null)
        setIsBrowserOpen(false)
      }
      return !prev
    })
  }, [])

  const selectProp = useCallback((propId: string) => {
    setSelectedPropId(propId)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedPropId(null)
    setPendingRotation(0)
  }, [])

  const rotatePending = useCallback(() => {
    setPendingRotation((prev) => (prev + 90) % 360)
  }, [])

  const resetRotation = useCallback(() => setPendingRotation(0), [])

  const pushAction = useCallback((action: PlacementAction) => {
    setUndoStack((prev) => [...prev.slice(-49), action])
    setRedoStack([]) // new action clears redo
  }, [])

  // Forward refs for keyboard handler to avoid stale closures
  const undoRef = useRef<() => void>(() => {})
  const redoRef = useRef<() => void>(() => {})

  const headers = useCallback((): HeadersInit => {
    const key = localStorage.getItem(LS_API_KEY)
    return key
      ? { 'X-API-Key': key, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' }
  }, [])

  const undo = useCallback(async () => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev
      const action = prev[prev.length - 1]
      const next = prev.slice(0, -1)

      // Execute the inverse via API
      ;(async () => {
        try {
          if (action.type === 'place') {
            // Undo a place → delete it
            await fetch(`${API_BASE}/world/props/${action.placedId}`, {
              method: 'DELETE',
              headers: headers(),
            })
          } else if (action.type === 'remove') {
            // Undo a remove → re-place it.
            // C1 fix: the backend assigns a fresh UUID. After the POST, update the
            // redo stack entry to use the new placed_id so redo-remove targets the
            // correct row and doesn't 404.
            const resp = await fetch(`${API_BASE}/world/props`, {
              method: 'POST',
              headers: headers(),
              body: JSON.stringify({
                prop_id: action.snapshot.prop_id,
                position: action.snapshot.position,
                rotation_y: action.snapshot.rotation_y,
                scale: action.snapshot.scale,
                room_id: action.snapshot.room_id,
              }),
            })
            if (resp.ok) {
              const freshPlaced = await resp.json()
              const newPlacedId: string = freshPlaced.id
              // Patch the entry we just pushed to redo with the new id
              setRedoStack((prev) =>
                prev.map((a) =>
                  a === action
                    ? {
                        ...a,
                        placedId: newPlacedId,
                        snapshot: { ...action.snapshot, id: newPlacedId },
                      }
                    : a
                )
              )
            }
          } else if (action.type === 'move') {
            // Undo a move → move back to original position.
            // C2: use clear_room sentinel when original room_id was null so the
            // backend actually clears the column (room_id: null is ambiguous).
            await fetch(`${API_BASE}/world/props/${action.placedId}`, {
              method: 'PATCH',
              headers: headers(),
              body: JSON.stringify({
                position: action.from.position,
                rotation_y: action.from.rotation_y,
                scale: action.from.scale,
                ...(action.from.room_id === null
                  ? { clear_room: true }
                  : { room_id: action.from.room_id }),
              }),
            })
          }
        } catch (err) {
          console.warn('[CreatorMode] Undo API call failed:', err)
        }
      })()

      setRedoStack((r) => [...r, action])
      return next
    })
  }, [headers])

  const redo = useCallback(async () => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev
      const action = prev[prev.length - 1]
      const next = prev.slice(0, -1)

      ;(async () => {
        try {
          if (action.type === 'place') {
            // Redo a place → re-place (M3 fix: include scale so redo restores correct size)
            await fetch(`${API_BASE}/world/props`, {
              method: 'POST',
              headers: headers(),
              body: JSON.stringify({
                prop_id: action.propId,
                position: action.position,
                rotation_y: action.rotation_y,
                scale: action.scale,
                room_id: action.roomId,
              }),
            })
          } else if (action.type === 'remove') {
            // Redo a remove → delete again
            await fetch(`${API_BASE}/world/props/${action.placedId}`, {
              method: 'DELETE',
              headers: headers(),
            })
          } else if (action.type === 'move') {
            // Redo a move → move to new position.
            // C2: use clear_room sentinel when target room_id is null.
            await fetch(`${API_BASE}/world/props/${action.placedId}`, {
              method: 'PATCH',
              headers: headers(),
              body: JSON.stringify({
                position: action.to.position,
                rotation_y: action.to.rotation_y,
                scale: action.to.scale,
                ...(action.to.room_id === null
                  ? { clear_room: true }
                  : { room_id: action.to.room_id }),
              }),
            })
          }
        } catch (err) {
          console.warn('[CreatorMode] Redo API call failed:', err)
        }
      })()

      setUndoStack((u) => [...u, action])
      return next
    })
  }, [headers])

  undoRef.current = undo
  redoRef.current = redo

  // ── Api key from localStorage ──────────────────────────────────
  // Expose setter for UI (users can paste their API key into settings)
  useEffect(() => {
    const raw = localStorage.getItem(LS_API_KEY)
    setApiKey(raw)
  }, [])

  // ── Auto-fetch local admin key at startup ──────────────────────
  // If no key is stored, try the localhost-only bootstrap endpoint.
  // On non-local deployments this will 403/fail silently.
  useEffect(() => {
    const existingKey = localStorage.getItem(LS_API_KEY)
    if (existingKey) return // Already configured

    fetch('/api/auth/local-bootstrap')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.key) {
          localStorage.setItem(LS_API_KEY, data.key)
          setApiKey(data.key)
        }
      })
      .catch(() => {
        /* silently ignore if not local */
      })
  }, [])

  const openBrowser = useCallback(() => setIsBrowserOpen(true), [])
  const closeBrowser = useCallback(() => setIsBrowserOpen(false), [])
  const toggleBrowser = useCallback(() => setIsBrowserOpen((p) => !p), [])

  return (
    <CreatorModeContext.Provider
      value={{
        isCreatorMode,
        toggleCreatorMode,
        selectedPropId,
        selectProp,
        clearSelection,
        pendingRotation,
        rotatePending,
        resetRotation,
        placedProps,
        refreshPlacedProps,
        undoStack,
        redoStack,
        pushAction,
        undo,
        redo,
        isBrowserOpen,
        openBrowser,
        closeBrowser,
        toggleBrowser,
        apiKey,
      }}
    >
      {children}
    </CreatorModeContext.Provider>
  )
}
