import { useState, useEffect, useCallback, useRef } from 'react'
import { API_BASE } from '@/lib/api'

export interface ToolCallData {
  name: string
  status: string
  input?: Record<string, unknown>
  result?: string
}

export interface ChatMessageData {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  tokens?: number
  tools?: ToolCallData[]
  thinking?: string[]  // Thinking blocks when raw mode enabled
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

export function useAgentChat(sessionKey: string, raw: boolean = false, roomId?: string): UseAgentChatReturn {
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const initialLoadDone = useRef(false)
  const historyAbortRef = useRef<AbortController | null>(null)
  const sendAbortRef = useRef<AbortController | null>(null)

  // Load initial history on mount or when raw mode changes
  useEffect(() => {
    if (!sessionKey) return
    
    // Reset on raw mode change
    if (initialLoadDone.current) {
      // Re-fetch when raw mode changes
    }
    initialLoadDone.current = true

    // Cancel any in-flight history request
    if (historyAbortRef.current) {
      historyAbortRef.current.abort()
    }
    historyAbortRef.current = new AbortController()

    const loadInitial = async () => {
      setIsLoadingHistory(true)
      setError(null)
      try {
        const rawParam = raw ? '&raw=true' : ''
        const resp = await fetch(
          `${API_BASE}/chat/${encodeURIComponent(sessionKey)}/history?limit=30${rawParam}`,
          { signal: historyAbortRef.current?.signal }
        )
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data: HistoryResponse = await resp.json()
        setMessages(data.messages)
        setHasMore(data.hasMore)
      } catch (e: unknown) {
        // Ignore abort errors
        if (e instanceof Error && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : 'Failed to load history')
      } finally {
        setIsLoadingHistory(false)
      }
    }
    loadInitial()
  }, [sessionKey, raw])

  // Reset and cleanup when session changes
  useEffect(() => {
    return () => {
      initialLoadDone.current = false
      // Abort any in-flight requests on session change or unmount
      if (historyAbortRef.current) {
        historyAbortRef.current.abort()
      }
      if (sendAbortRef.current) {
        sendAbortRef.current.abort()
      }
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

      // Cancel any previous send request
      if (sendAbortRef.current) {
        sendAbortRef.current.abort()
      }
      sendAbortRef.current = new AbortController()

      try {
        const resp = await fetch(
          `${API_BASE}/chat/${encodeURIComponent(sessionKey)}/send`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: trimmed, ...(roomId ? { room_id: roomId } : {}) }),
            signal: sendAbortRef.current.signal,
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
        // Ignore abort errors
        if (e instanceof Error && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : 'Failed to send message')
      } finally {
        setIsSending(false)
      }
    },
    [sessionKey, isSending, roomId]
  )

  const loadOlderMessages = useCallback(async () => {
    if (isLoadingHistory || !hasMore || messages.length === 0) return

    const oldest = messages[0]?.timestamp
    if (!oldest) return

    // Cancel any in-flight history request
    if (historyAbortRef.current) {
      historyAbortRef.current.abort()
    }
    historyAbortRef.current = new AbortController()

    setIsLoadingHistory(true)
    try {
      const rawParam = raw ? '&raw=true' : ''
      const resp = await fetch(
        `${API_BASE}/chat/${encodeURIComponent(sessionKey)}/history?limit=30&before=${oldest}${rawParam}`,
        { signal: historyAbortRef.current.signal }
      )
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data: HistoryResponse = await resp.json()
      setMessages((prev) => [...data.messages, ...prev])
      setHasMore(data.hasMore)
    } catch (e: unknown) {
      // Ignore abort errors
      if (e instanceof Error && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Failed to load older messages')
    } finally {
      setIsLoadingHistory(false)
    }
  }, [sessionKey, raw, isLoadingHistory, hasMore, messages])

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
