import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'

// ─── Types ─────────────────────────────────────────────────────

export type FocusLevel = 'overview' | 'room' | 'board' | 'bot' | 'firstperson'

export interface WorldFocusState {
  level: FocusLevel
  focusedRoomId: string | null
  focusedBotKey: string | null
  isAnimating: boolean
  /** Previous state stored when entering first person, for restoring on exit */
  previousState?: { level: FocusLevel; focusedRoomId: string | null; focusedBotKey: string | null }
}

interface WorldFocusContextValue {
  state: WorldFocusState
  focusRoom: (roomId: string) => void
  focusBoard: (roomId: string) => void
  focusBot: (botKey: string, roomId: string) => void
  goBack: () => void
  goOverview: () => void
  enterFirstPerson: () => void
  exitFirstPerson: () => void
}

const defaultState: WorldFocusState = {
  level: 'overview',
  focusedRoomId: null,
  focusedBotKey: null,
  isAnimating: false,
}

const WorldFocusContext = createContext<WorldFocusContextValue>({
  state: defaultState,
  focusRoom: () => {},
  focusBoard: () => {},
  focusBot: () => {},
  goBack: () => {},
  goOverview: () => {},
  enterFirstPerson: () => {},
  exitFirstPerson: () => {},
})

// ─── Module-level state updater helpers ────────────────────────
// Extracted to module level to reduce setState callback nesting depth below 4 levels.

function clearIsAnimating(prev: WorldFocusState): WorldFocusState {
  return { ...prev, isAnimating: false }
}

// ─── Provider ──────────────────────────────────────────────────

export function WorldFocusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorldFocusState>(defaultState)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingCallerRef = useRef<string | null>(null)

  // Priority: zoom-in actions should not be overridden by zoom-out actions within the debounce window
  const ZOOM_IN_CALLERS = new Set(['focusRoom', 'focusBoard', 'focusBot'])

  const setWithAnimation = useCallback(
    (updater: (prev: WorldFocusState) => WorldFocusState, _caller?: string) => {
      // Don't let goBack override a pending zoom-in action (race condition from click-outside handlers)
      if (
        debounceRef.current &&
        pendingCallerRef.current &&
        ZOOM_IN_CALLERS.has(pendingCallerRef.current) &&
        _caller === 'goBack'
      ) {
        if (import.meta.env.DEV) {
          console.log(
            `[WorldFocus] Blocked goBack — pending ${pendingCallerRef.current} has priority`
          )
        }
        return
      }
      // Debounce rapid clicks (50ms)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      pendingCallerRef.current = _caller || null
      debounceRef.current = setTimeout(() => {
        pendingCallerRef.current = null
        setState((prev) => {
          // Guard: don't change state during camera animation to prevent glitches
          if (prev.isAnimating) return prev
          const next = { ...updater(prev), isAnimating: true }
          if (import.meta.env.DEV) {
            console.log(
              `[WorldFocus] ${_caller || '?'}: ${prev.level}→${next.level} room=${next.focusedRoomId} bot=${next.focusedBotKey}`
            )
          }
          return next
        })
        // Clear animating after camera transition (~900ms)
        setTimeout(() => setState((prev) => ({ ...prev, isAnimating: false })), 900)
      }, 50)
    },
    []
  )

  const focusRoom = useCallback(
    (roomId: string) => {
      setWithAnimation((prev) => {
        // Already at room level for this room → no-op (use goOverview to leave)
        if (prev.level === 'room' && prev.focusedRoomId === roomId) {
          return prev
        }
        return {
          level: 'room',
          focusedRoomId: roomId,
          focusedBotKey: null,
          isAnimating: false,
        }
      }, 'focusRoom')
    },
    [setWithAnimation]
  )

  const focusBoard = useCallback(
    (roomId: string) => {
      setWithAnimation(
        () => ({
          level: 'board',
          focusedRoomId: roomId,
          focusedBotKey: null,
          isAnimating: false,
        }),
        'focusBoard'
      )
    },
    [setWithAnimation]
  )

  const focusBot = useCallback(
    (botKey: string, roomId: string) => {
      setWithAnimation(
        () => ({
          level: 'bot',
          focusedRoomId: roomId,
          focusedBotKey: botKey,
          isAnimating: false,
        }),
        'focusBot'
      )
    },
    [setWithAnimation]
  )

  const goBack = useCallback(() => {
    setWithAnimation((prev) => {
      if (prev.level === 'firstperson') {
        const restored = prev.previousState || {
          level: 'overview' as FocusLevel,
          focusedRoomId: null,
          focusedBotKey: null,
        }
        return {
          level: restored.level,
          focusedRoomId: restored.focusedRoomId,
          focusedBotKey: restored.focusedBotKey,
          isAnimating: false,
        }
      }
      if (prev.level === 'bot' || prev.level === 'board') {
        return {
          level: 'room',
          focusedRoomId: prev.focusedRoomId,
          focusedBotKey: null,
          isAnimating: false,
        }
      }
      return { ...defaultState }
    }, 'goBack')
  }, [setWithAnimation])

  const goOverview = useCallback(() => {
    setWithAnimation(() => ({ ...defaultState }), 'goOverview')
  }, [setWithAnimation])

  const enterFirstPerson = useCallback(() => {
    setState((prev) => ({
      level: 'firstperson',
      focusedRoomId: null,
      focusedBotKey: null,
      isAnimating: false,
      previousState: {
        level: prev.level,
        focusedRoomId: prev.focusedRoomId,
        focusedBotKey: prev.focusedBotKey,
      },
    }))
  }, [])

  const exitFirstPerson = useCallback(() => {
    setState((prev) => {
      const restored = prev.previousState || {
        level: 'overview' as FocusLevel,
        focusedRoomId: null,
        focusedBotKey: null,
      }
      return {
        level: restored.level,
        focusedRoomId: restored.focusedRoomId,
        focusedBotKey: restored.focusedBotKey,
        isAnimating: true,
      }
    })
    // Clear animating after camera transition
    setTimeout(() => setState((prev) => ({ ...prev, isAnimating: false })), 900)
  }, [])

  const value = useMemo<WorldFocusContextValue>(
    () => ({
      state,
      focusRoom,
      focusBoard,
      focusBot,
      goBack,
      goOverview,
      enterFirstPerson,
      exitFirstPerson,
    }),
    [state, focusRoom, focusBoard, focusBot, goBack, goOverview, enterFirstPerson, exitFirstPerson]
  )

  return <WorldFocusContext.Provider value={value}>{children}</WorldFocusContext.Provider>
}

// ─── Hook ──────────────────────────────────────────────────────

export function useWorldFocus(): WorldFocusContextValue {
  return useContext(WorldFocusContext)
}
