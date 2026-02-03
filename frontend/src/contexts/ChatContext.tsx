import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// ── Types ──────────────────────────────────────────────────────

export interface ChatTab {
  sessionKey: string
  agentName: string
  agentIcon: string | null
  agentColor: string | null
}

export interface ChatState {
  isOpen: boolean
  isMinimized: boolean
  tabs: ChatTab[]
  activeTabKey: string | null
  isPinned: boolean
  position: { x: number; y: number } | null
  size: { width: number; height: number }
}

export interface ChatContextValue {
  chat: ChatState
  openChat: (sessionKey: string, agentName: string, agentIcon?: string, agentColor?: string) => void
  closeTab: (sessionKey: string) => void
  closeChat: () => void
  switchTab: (sessionKey: string) => void
  togglePin: () => void
  toggleMinimize: () => void
  updatePosition: (pos: { x: number; y: number }) => void
  updateSize: (size: { width: number; height: number }) => void
  onFocusAgent: ((sessionKey: string) => void) | null
  setFocusHandler: (handler: ((sessionKey: string) => void) | null) => void
}

// ── Constants ──────────────────────────────────────────────────

const DEFAULT_SIZE = { width: 400, height: 520 }
const MIN_WIDTH = 320
const MIN_HEIGHT = 300
const MAX_WIDTH = 700
const MAX_HEIGHT = 800

export { MIN_WIDTH, MIN_HEIGHT, MAX_WIDTH, MAX_HEIGHT }

// ── Storage ────────────────────────────────────────────────────

const STORAGE_KEY = 'crewhub-chat-state'

interface StoredChatState {
  tabs: ChatTab[]
  activeTabKey: string | null
  isPinned: boolean
  position: { x: number; y: number } | null
  size: { width: number; height: number }
}

function loadStoredState(): StoredChatState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Validate structure
    if (!Array.isArray(parsed.tabs)) return null
    return parsed as StoredChatState
  } catch {
    return null
  }
}

function saveStoredState(state: StoredChatState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

function clearStoredState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore
  }
}

// ── Default state ──────────────────────────────────────────────

function getInitialState(): ChatState {
  const stored = loadStoredState()
  if (stored?.isPinned && stored.tabs.length > 0) {
    return {
      isOpen: true,
      isMinimized: false,
      tabs: stored.tabs,
      activeTabKey: stored.activeTabKey ?? stored.tabs[0]?.sessionKey ?? null,
      isPinned: true,
      position: stored.position ?? null,
      size: stored.size ?? DEFAULT_SIZE,
    }
  }
  return {
    isOpen: false,
    isMinimized: false,
    tabs: [],
    activeTabKey: null,
    isPinned: false,
    position: null,
    size: DEFAULT_SIZE,
  }
}

// ── Context ────────────────────────────────────────────────────

const ChatContext = createContext<ChatContextValue | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chat, setChat] = useState<ChatState>(getInitialState)
  const focusHandlerRef = useRef<((sessionKey: string) => void) | null>(null)
  const [, setFocusHandlerVersion] = useState(0)

  const setFocusHandler = useCallback((handler: ((sessionKey: string) => void) | null) => {
    focusHandlerRef.current = handler
    setFocusHandlerVersion(v => v + 1)
  }, [])

  const onFocusAgent = focusHandlerRef.current

  // Persist state
  useEffect(() => {
    if (chat.isPinned && chat.tabs.length > 0) {
      saveStoredState({
        tabs: chat.tabs,
        activeTabKey: chat.activeTabKey,
        isPinned: true,
        position: chat.position,
        size: chat.size,
      })
    } else if (!chat.isPinned) {
      clearStoredState()
    }
  }, [chat.isPinned, chat.tabs, chat.activeTabKey, chat.position, chat.size])

  const openChat = useCallback(
    (sessionKey: string, agentName: string, agentIcon?: string, agentColor?: string) => {
      setChat((prev) => {
        const existingTab = prev.tabs.find(t => t.sessionKey === sessionKey)
        if (existingTab) {
          // Tab exists → just switch to it and open
          return {
            ...prev,
            isOpen: true,
            isMinimized: false,
            activeTabKey: sessionKey,
          }
        }
        // New tab
        const newTab: ChatTab = {
          sessionKey,
          agentName,
          agentIcon: agentIcon ?? null,
          agentColor: agentColor ?? null,
        }
        return {
          ...prev,
          isOpen: true,
          isMinimized: false,
          tabs: [...prev.tabs, newTab],
          activeTabKey: sessionKey,
        }
      })
    },
    []
  )

  const closeTab = useCallback((sessionKey: string) => {
    setChat((prev) => {
      const newTabs = prev.tabs.filter(t => t.sessionKey !== sessionKey)
      if (newTabs.length === 0) {
        // No tabs left → close panel
        return {
          ...prev,
          isOpen: false,
          isMinimized: false,
          tabs: [],
          activeTabKey: null,
          isPinned: false,
        }
      }
      // If we closed the active tab, switch to another
      let newActiveKey = prev.activeTabKey
      if (prev.activeTabKey === sessionKey) {
        // Try to find the tab that was before the closed one
        const closedIndex = prev.tabs.findIndex(t => t.sessionKey === sessionKey)
        const newIndex = Math.min(closedIndex, newTabs.length - 1)
        newActiveKey = newTabs[newIndex]?.sessionKey ?? newTabs[0]?.sessionKey ?? null
      }
      return {
        ...prev,
        tabs: newTabs,
        activeTabKey: newActiveKey,
      }
    })
  }, [])

  const closeChat = useCallback(() => {
    setChat((prev) => ({
      ...prev,
      isOpen: false,
      isMinimized: false,
      tabs: [],
      activeTabKey: null,
      isPinned: false,
    }))
  }, [])

  const switchTab = useCallback((sessionKey: string) => {
    setChat((prev) => ({
      ...prev,
      activeTabKey: sessionKey,
    }))
  }, [])

  const togglePin = useCallback(() => {
    setChat((prev) => ({
      ...prev,
      isPinned: !prev.isPinned,
    }))
  }, [])

  const toggleMinimize = useCallback(() => {
    setChat((prev) => ({
      ...prev,
      isMinimized: !prev.isMinimized,
    }))
  }, [])

  const updatePosition = useCallback((pos: { x: number; y: number }) => {
    setChat((prev) => ({
      ...prev,
      position: pos,
    }))
  }, [])

  const updateSize = useCallback((size: { width: number; height: number }) => {
    setChat((prev) => ({
      ...prev,
      size: {
        width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, size.width)),
        height: Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, size.height)),
      },
    }))
  }, [])

  return (
    <ChatContext.Provider
      value={{
        chat,
        openChat,
        closeTab,
        closeChat,
        switchTab,
        togglePin,
        toggleMinimize,
        updatePosition,
        updateSize,
        onFocusAgent,
        setFocusHandler,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) {
    throw new Error('useChatContext must be used within a ChatProvider')
  }
  return ctx
}
