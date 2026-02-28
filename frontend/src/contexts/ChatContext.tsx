/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'

// ── Types ──────────────────────────────────────────────────────

export interface ChatWindowState {
  sessionKey: string
  agentName: string
  agentIcon: string | null
  agentColor: string | null
  isMinimized: boolean
  isPinned: boolean
  showInternals: boolean // Show thinking blocks & tool details
  position: { x: number; y: number }
  size: { width: number; height: number }
  zIndex: number
}

export interface ChatContextValue {
  windows: ChatWindowState[]
  openChat: (sessionKey: string, agentName: string, agentIcon?: string, agentColor?: string) => void
  closeChat: (sessionKey: string) => void
  minimizeChat: (sessionKey: string) => void
  restoreChat: (sessionKey: string) => void
  togglePin: (sessionKey: string) => void
  toggleInternals: (sessionKey: string) => void
  focusChat: (sessionKey: string) => void
  updatePosition: (sessionKey: string, pos: { x: number; y: number }) => void
  updateSize: (sessionKey: string, size: { width: number; height: number }) => void
  onFocusAgent: ((sessionKey: string) => void) | null
  setFocusHandler: (handler: ((sessionKey: string) => void) | null) => void
}

// ── Constants ──────────────────────────────────────────────────

export const DEFAULT_SIZE = { width: 420, height: 520 }
export const MIN_SIZE = { width: 320, height: 350 }
export const MAX_SIZE = { width: 700, height: 800 }

// ── Storage ────────────────────────────────────────────────────

const STORAGE_KEY = 'crewhub-chat-windows'

interface StoredWindow {
  sessionKey: string
  agentName: string
  agentIcon: string | null
  agentColor: string | null
  isMinimized: boolean
  isPinned: boolean
  showInternals: boolean
  position: { x: number; y: number }
  size: { width: number; height: number }
}

function loadStoredWindows(): StoredWindow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as StoredWindow[]
  } catch {
    return []
  }
}

function saveStoredWindows(windows: ChatWindowState[]): void {
  try {
    const toStore: StoredWindow[] = windows.map((w) => ({
      sessionKey: w.sessionKey,
      agentName: w.agentName,
      agentIcon: w.agentIcon,
      agentColor: w.agentColor,
      isMinimized: w.isMinimized,
      isPinned: w.isPinned,
      showInternals: w.showInternals,
      position: w.position,
      size: w.size,
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
  } catch {
    // Ignore storage errors
  }
}

// ── Helpers ────────────────────────────────────────────────────

const FIXED_AGENT_RE = /^(agent:[a-zA-Z0-9_-]+:main|cc:[a-zA-Z0-9_-]+)$/

function isFixedAgent(key: string): boolean {
  return FIXED_AGENT_RE.test(key)
}

let nextZIndex = 1000

function getNextZIndex(): number {
  return ++nextZIndex
}

function getDefaultPosition(index: number): { x: number; y: number } {
  // Cascade windows with offset, starting from center-ish
  const baseX = typeof window === 'undefined' ? 300 : Math.max(200, window.innerWidth / 2 - 200)
  const baseY = typeof window === 'undefined' ? 100 : Math.max(80, window.innerHeight / 4)
  return {
    x: baseX + (index % 5) * 30,
    y: baseY + (index % 5) * 30,
  }
}

// ── Initial state ──────────────────────────────────────────────

function getInitialWindows(): ChatWindowState[] {
  const stored = loadStoredWindows()
  // Only restore chat windows for fixed agents (agent:*:main)
  return stored
    .filter((w) => isFixedAgent(w.sessionKey))
    .map((w, i) => ({
      ...w,
      zIndex: getNextZIndex(),
      isMinimized: w.isMinimized ?? false,
      showInternals: w.showInternals ?? false,
      position: w.position ?? getDefaultPosition(i),
      size: w.size ?? DEFAULT_SIZE,
    }))
}

// ── Context ────────────────────────────────────────────────────

const ChatContext = createContext<ChatContextValue | undefined>(undefined)

export function ChatProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [windows, setWindows] = useState<ChatWindowState[]>(getInitialWindows)
  const focusHandlerRef = useRef<((sessionKey: string) => void) | null>(null)
  const [, setFocusHandlerVersion] = useState(0) // NOSONAR

  const setFocusHandler = useCallback((handler: ((sessionKey: string) => void) | null) => {
    focusHandlerRef.current = handler
    setFocusHandlerVersion((v) => v + 1)
  }, [])

  const onFocusAgent = focusHandlerRef.current

  // Persist state
  useEffect(() => {
    saveStoredWindows(windows)
  }, [windows])

  const openChat = useCallback(
    (sessionKey: string, agentName: string, agentIcon?: string, agentColor?: string) => {
      // Only allow chat for fixed agents (agent:*:main)
      if (!isFixedAgent(sessionKey)) return

      setWindows((prev) => {
        const existing = prev.find((w) => w.sessionKey === sessionKey)
        if (existing) {
          // Already open — restore if minimized and bring to front
          return prev.map((w) =>
            w.sessionKey === sessionKey ? { ...w, isMinimized: false, zIndex: getNextZIndex() } : w
          )
        }
        // New window
        const newWindow: ChatWindowState = {
          sessionKey,
          agentName,
          agentIcon: agentIcon ?? null,
          agentColor: agentColor ?? null,
          isMinimized: false,
          isPinned: false,
          showInternals: false,
          position: getDefaultPosition(prev.length),
          size: { ...DEFAULT_SIZE },
          zIndex: getNextZIndex(),
        }
        return [...prev, newWindow]
      })
    },
    []
  )

  const closeChat = useCallback((sessionKey: string) => {
    setWindows((prev) => prev.filter((w) => w.sessionKey !== sessionKey))
  }, [])

  const minimizeChat = useCallback((sessionKey: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.sessionKey === sessionKey ? { ...w, isMinimized: true } : w))
    )
  }, [])

  const restoreChat = useCallback((sessionKey: string) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.sessionKey === sessionKey ? { ...w, isMinimized: false, zIndex: getNextZIndex() } : w
      )
    )
  }, [])

  const togglePin = useCallback((sessionKey: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.sessionKey === sessionKey ? { ...w, isPinned: !w.isPinned } : w))
    )
  }, [])

  const toggleInternals = useCallback((sessionKey: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.sessionKey === sessionKey ? { ...w, showInternals: !w.showInternals } : w))
    )
  }, [])

  const focusChat = useCallback((sessionKey: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.sessionKey === sessionKey ? { ...w, zIndex: getNextZIndex() } : w))
    )
  }, [])

  const updatePosition = useCallback((sessionKey: string, pos: { x: number; y: number }) => {
    setWindows((prev) =>
      prev.map((w) => (w.sessionKey === sessionKey ? { ...w, position: pos } : w))
    )
  }, [])

  const updateSize = useCallback((sessionKey: string, size: { width: number; height: number }) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.sessionKey === sessionKey
          ? {
              ...w,
              size: {
                width: Math.max(MIN_SIZE.width, Math.min(MAX_SIZE.width, size.width)),
                height: Math.max(MIN_SIZE.height, Math.min(MAX_SIZE.height, size.height)),
              },
            }
          : w
      )
    )
  }, [])

  const value = useMemo<ChatContextValue>(
    () => ({
      windows,
      openChat,
      closeChat,
      minimizeChat,
      restoreChat,
      togglePin,
      toggleInternals,
      focusChat,
      updatePosition,
      updateSize,
      onFocusAgent,
      setFocusHandler,
    }),
    [
      windows,
      openChat,
      closeChat,
      minimizeChat,
      restoreChat,
      togglePin,
      toggleInternals,
      focusChat,
      updatePosition,
      updateSize,
      onFocusAgent,
      setFocusHandler,
    ]
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) {
    throw new Error('useChatContext must be used within a ChatProvider')
  }
  return ctx
}
