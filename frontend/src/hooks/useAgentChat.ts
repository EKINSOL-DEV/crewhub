import { useState, useEffect, useCallback, useRef } from 'react'
import { API_BASE } from '@/lib/api'

export interface ChatMessageData {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  tokens?: number
  tools?: { name: string; status: string }[]
}

export interface UseAgentChatReturn {
  messages: ChatMessageData[]
  isSending: boolean
  error: string | null
  sendMessage: (text: string) => Promise<void>
  loadOlderMessages: () => Promise<void>
  hasMore: boolean
  isLoadingHistory: boolean
}

interface HistoryResponse {
  messages: ChatMessageData[]
  hasMore: boolean
  oldestTimestamp: number | null
}

export function useAgentChat(sessionKey: string): UseAgentChatReturn {
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const initialLoadDone = useRef(false)

  // Load initial history on mount
  useEffect(() => {
    if (!sessionKey || initialLoadDone.current) return
    initialLoadDone.current = true

    const loadInitial = async () => {
      setIsLoadingHistory(true)
      setError(null)
      try {
        const resp = await fetch(
          `${API_BASE}/chat/${encodeURIComponent(sessionKey)}/history?limit=30`
        )
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data: HistoryResponse = await resp.json()
        setMessages(data.messages)
        setHasMore(data.hasMore)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load history')
      } finally {
        setIsLoadingHistory(false)
      }
    }
    loadInitial()
  }, [sessionKey])

  // Reset when session changes
  useEffect(() => {
    return () => {
      initialLoadDone.current = false
    }
  }, [sessionKey])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isSending) return

      // Optimistically add user message
      const userMsg: ChatMessageData = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
        tools: [],
      }
      setMessages((prev) => [...prev, userMsg])
      setIsSending(true)
      setError(null)

      try {
        const resp = await fetch(
          `${API_BASE}/chat/${encodeURIComponent(sessionKey)}/send`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: trimmed }),
          }
        )

        if (resp.status === 429) {
          setError('Too many messages. Wait a moment…')
          setIsSending(false)
          return
        }

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()

        if (data.success && data.response) {
          const assistantMsg: ChatMessageData = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: data.response,
            timestamp: Date.now(),
            tokens: data.tokens || 0,
            tools: [],
          }
          setMessages((prev) => [...prev, assistantMsg])
        } else {
          setError(data.error || 'No response from agent')
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to send message')
      } finally {
        setIsSending(false)
      }
    },
    [sessionKey, isSending]
  )

  const loadOlderMessages = useCallback(async () => {
    if (isLoadingHistory || !hasMore || messages.length === 0) return

    const oldest = messages[0]?.timestamp
    if (!oldest) return

    setIsLoadingHistory(true)
    try {
      const resp = await fetch(
        `${API_BASE}/chat/${encodeURIComponent(sessionKey)}/history?limit=30&before=${oldest}`
      )
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data: HistoryResponse = await resp.json()
      setMessages((prev) => [...data.messages, ...prev])
      setHasMore(data.hasMore)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load older messages')
    } finally {
      setIsLoadingHistory(false)
    }
  }, [sessionKey, isLoadingHistory, hasMore, messages])

  return {
    messages,
    isSending,
    error,
    sendMessage,
    loadOlderMessages,
    hasMore,
    isLoadingHistory,
  }
}
