import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'

// ─── Types ─────────────────────────────────────────────────────

export type FocusLevel = 'overview' | 'room' | 'bot'

export interface WorldFocusState {
  level: FocusLevel
  focusedRoomId: string | null
  focusedBotKey: string | null
  isAnimating: boolean
}

interface WorldFocusContextValue {
  state: WorldFocusState
  focusRoom: (roomId: string) => void
  focusBot: (botKey: string, roomId: string) => void
  goBack: () => void
  goOverview: () => void
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
  focusBot: () => {},
  goBack: () => {},
  goOverview: () => {},
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
      if (prev.level === 'bot') {
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

  return (
    <WorldFocusContext.Provider value={{ state, focusRoom, focusBot, goBack, goOverview }}>
      {children}
    </WorldFocusContext.Provider>
  )
}

// ─── Hook ──────────────────────────────────────────────────────

export function useWorldFocus(): WorldFocusContextValue {
  return useContext(WorldFocusContext)
}
