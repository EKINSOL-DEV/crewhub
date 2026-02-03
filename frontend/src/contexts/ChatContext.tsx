import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

// ── Types ──────────────────────────────────────────────────────

export interface ChatState {
  isOpen: boolean
  isMinimized: boolean
  sessionKey: string | null
  agentName: string | null
  agentIcon: string | null
  agentColor: string | null
  isPinned: boolean
}

export interface ChatContextValue {
  chat: ChatState
  openChat: (sessionKey: string, agentName: string, agentIcon?: string, agentColor?: string) => void
  closeChat: () => void
  togglePin: () => void
  toggleMinimize: () => void
}

// ── Storage ────────────────────────────────────────────────────

const STORAGE_KEY = 'crewhub-chat-state'

interface StoredChatState {
  isPinned: boolean
  sessionKey: string | null
  agentName: string | null
  agentIcon: string | null
  agentColor: string | null
}

function loadStoredState(): StoredChatState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
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
  if (stored?.isPinned && stored.sessionKey) {
    return {
      isOpen: true,
      isMinimized: false,
      sessionKey: stored.sessionKey,
      agentName: stored.agentName,
      agentIcon: stored.agentIcon,
      agentColor: stored.agentColor,
      isPinned: true,
    }
  }
  return {
    isOpen: false,
    isMinimized: false,
    sessionKey: null,
    agentName: null,
    agentIcon: null,
    agentColor: null,
    isPinned: false,
  }
}

// ── Context ────────────────────────────────────────────────────

const ChatContext = createContext<ChatContextValue | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chat, setChat] = useState<ChatState>(getInitialState)

  // Persist pinned state
  useEffect(() => {
    if (chat.isPinned && chat.sessionKey) {
      saveStoredState({
        isPinned: true,
        sessionKey: chat.sessionKey,
        agentName: chat.agentName,
        agentIcon: chat.agentIcon,
        agentColor: chat.agentColor,
      })
    } else if (!chat.isPinned) {
      clearStoredState()
    }
  }, [chat.isPinned, chat.sessionKey, chat.agentName, chat.agentIcon, chat.agentColor])

  const openChat = useCallback(
    (sessionKey: string, agentName: string, agentIcon?: string, agentColor?: string) => {
      setChat((prev) => ({
        ...prev,
        isOpen: true,
        isMinimized: false,
        sessionKey,
        agentName,
        agentIcon: agentIcon ?? prev.agentIcon,
        agentColor: agentColor ?? prev.agentColor,
      }))
    },
    []
  )

  const closeChat = useCallback(() => {
    setChat((prev) => ({
      ...prev,
      isOpen: false,
      isMinimized: false,
      isPinned: false,
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

  return (
    <ChatContext.Provider value={{ chat, openChat, closeChat, togglePin, toggleMinimize }}>
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
