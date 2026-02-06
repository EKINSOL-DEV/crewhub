import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'

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

// ─── Provider ──────────────────────────────────────────────────

export function WorldFocusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorldFocusState>(defaultState)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setWithAnimation = useCallback((updater: (prev: WorldFocusState) => WorldFocusState) => {
    // Debounce rapid clicks (200ms)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setState(prev => ({ ...updater(prev), isAnimating: true }))
      // Clear animating after camera transition (~900ms)
      setTimeout(() => setState(prev => ({ ...prev, isAnimating: false })), 900)
    }, 50)
  }, [])

  const focusRoom = useCallback((roomId: string) => {
    setWithAnimation(prev => {
      // If already focused on this room, go back to overview
      if (prev.level === 'room' && prev.focusedRoomId === roomId) {
        return { ...defaultState }
      }
      return {
        level: 'room',
        focusedRoomId: roomId,
        focusedBotKey: null,
        isAnimating: false,
      }
    })
  }, [setWithAnimation])

  const focusBoard = useCallback((roomId: string) => {
    setWithAnimation(() => ({
      level: 'board',
      focusedRoomId: roomId,
      focusedBotKey: null,
      isAnimating: false,
    }))
  }, [setWithAnimation])

  const focusBot = useCallback((botKey: string, roomId: string) => {
    setWithAnimation(() => ({
      level: 'bot',
      focusedRoomId: roomId,
      focusedBotKey: botKey,
      isAnimating: false,
    }))
  }, [setWithAnimation])

  const goBack = useCallback(() => {
    setWithAnimation(prev => {
      if (prev.level === 'firstperson') {
        const restored = prev.previousState || { level: 'overview' as FocusLevel, focusedRoomId: null, focusedBotKey: null }
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
    })
  }, [setWithAnimation])

  const goOverview = useCallback(() => {
    setWithAnimation(() => ({ ...defaultState }))
  }, [setWithAnimation])

  const enterFirstPerson = useCallback(() => {
    setState(prev => ({
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
    setState(prev => {
      const restored = prev.previousState || { level: 'overview' as FocusLevel, focusedRoomId: null, focusedBotKey: null }
      return {
        level: restored.level,
        focusedRoomId: restored.focusedRoomId,
        focusedBotKey: restored.focusedBotKey,
        isAnimating: true,
      }
    })
    // Clear animating after camera transition
    setTimeout(() => setState(prev => ({ ...prev, isAnimating: false })), 900)
  }, [])

  return (
    <WorldFocusContext.Provider value={{ state, focusRoom, focusBoard, focusBot, goBack, goOverview, enterFirstPerson, exitFirstPerson }}>
      {children}
    </WorldFocusContext.Provider>
  )
}

// ─── Hook ──────────────────────────────────────────────────────

export function useWorldFocus(): WorldFocusContextValue {
  return useContext(WorldFocusContext)
}
