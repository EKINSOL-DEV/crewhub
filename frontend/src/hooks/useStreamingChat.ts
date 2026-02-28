/* eslint-disable react-hooks/exhaustive-deps */
/**
 * useStreamingChat.ts
 * Shared hook for streaming chat across all CrewHub chat UIs.
 * Wraps chatStreamService with React state management.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { streamMessage } from '@/services/chatStreamService'
import { API_BASE } from '@/lib/api'
import { sseManager } from '@/lib/sseManager'

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
  thinking?: string[] // Thinking blocks when raw mode enabled
  isStreaming?: boolean
}

export interface UseStreamingChatReturn {
  messages: ChatMessageData[]
  isSending: boolean
  streamingMessageId: string | null
  error: string | null
  sendMessage: (text: string) => void
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageData[]>>
  hasMore: boolean
  isLoadingHistory: boolean
  loadOlderMessages: () => Promise<void>
}

const THROTTLE_MS = 80

// ── Module-level message-state updater factories ──────────────────────────────
// Extracted to module level to reduce setState callback nesting depth below 4 levels.

function makeStreamingDoneUpdater(id: string, content: string) {
  return (prev: ChatMessageData[]): ChatMessageData[] =>
    prev.map((m) => (m.id === id ? { ...m, content, isStreaming: false } : m))
}

function makeRemoveStreamingMessage(id: string) {
  return (prev: ChatMessageData[]): ChatMessageData[] => prev.filter((m) => m.id !== id)
}

function makeAppendAssistantMessage(response: string) {
  return (prev: ChatMessageData[]): ChatMessageData[] => [
    ...prev,
    {
      id: `assistant-${Date.now()}`,
      role: 'assistant' as const,
      content: response,
      timestamp: Date.now(),
      tools: [] as ChatMessageData['tools'],
    },
  ]
}

export function useStreamingChat(
  sessionKey: string,
  raw: boolean = false,
  roomId?: string
): UseStreamingChatReturn {
  const [messages, setMessagesRaw] = useState<ChatMessageData[]>([]) // NOSONAR
  const setMessages: React.Dispatch<React.SetStateAction<ChatMessageData[]>> = useCallback(
    (action) => {
      setMessagesRaw((prev) => {
        const next = typeof action === 'function' ? action(prev) : action
        messagesRef.current = next
        return next
      })
    },
    []
  )
  const [isSending, setIsSending] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  const messagesRef = useRef<ChatMessageData[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const historyAbortRef = useRef<AbortController | null>(null)
  const fallbackAbortRef = useRef<AbortController | null>(null)
  // Throttling refs
  const pendingContentRef = useRef<string>('')
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamingIdRef = useRef<string | null>(null)

  // Load history
  const loadHistory = useCallback(
    async (before?: number) => {
      if (historyAbortRef.current) historyAbortRef.current.abort()
      historyAbortRef.current = new AbortController()

      setIsLoadingHistory(true)
      try {
        const params = new URLSearchParams({ limit: '50', raw: 'true' })
        if (before) params.set('before', String(before))

        const resp = await fetch(
          `${API_BASE}/chat/${encodeURIComponent(sessionKey)}/history?${params}`,
          { signal: historyAbortRef.current.signal }
        )
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()

        if (before) {
          setMessages((prev) => [...data.messages, ...prev])
        } else {
          setMessages(data.messages)
        }
        setHasMore(data.hasMore)
      } catch (e: unknown) {
        if ((e as Error).name === 'AbortError') return
        setError((e as Error).message || 'Failed to load history')
      } finally {
        setIsLoadingHistory(false)
      }
    },
    [sessionKey, raw]
  )

  // Load initial history on mount
  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Re-fetch history when this session is updated from another window/source
  useEffect(() => {
    if (!sessionKey) return

    const handleSessionUpdated = (event: MessageEvent) => {
      try {
        const updated = JSON.parse(event.data)
        if (updated?.key === sessionKey && !isSending) {
          // Another surface sent/received a message — sync our history
          loadHistory()
        }
      } catch {
        // ignore parse errors
      }
    }

    const unsubscribe = sseManager.subscribe('session-updated', handleSessionUpdated)
    return () => unsubscribe()
  }, [sessionKey, isSending, loadHistory])

  const loadOlderMessages = useCallback(async () => {
    const oldest = messagesRef.current[0]?.timestamp
    if (oldest) await loadHistory(oldest)
  }, [loadHistory])

  const flushPendingContent = useCallback(() => {
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current)
      throttleTimerRef.current = null
    }
    const id = streamingIdRef.current
    const content = pendingContentRef.current
    if (!id) return
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content, isStreaming: true } : m)))
  }, [])

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isSending) return

      // Cancel any in-flight stream
      if (abortRef.current) {
        abortRef.current.abort()
      }

      // Add user message
      const userMsg: ChatMessageData = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
        tools: [],
      }

      // Add empty assistant message (streaming placeholder)
      const assistantId = `assistant-stream-${Date.now()}`
      streamingIdRef.current = assistantId
      pendingContentRef.current = ''

      const assistantMsg: ChatMessageData = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        tools: [],
        isStreaming: true,
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setIsSending(true)
      setStreamingMessageId(assistantId)
      setError(null)

      abortRef.current = streamMessage(sessionKey, trimmed, roomId, {
        onChunk: (chunk: string) => {
          pendingContentRef.current += chunk
          // Throttle state updates
          if (!throttleTimerRef.current) {
            throttleTimerRef.current = setTimeout(() => {
              throttleTimerRef.current = null
              flushPendingContent()
            }, THROTTLE_MS)
          }
        },
        onDone: () => {
          // Cancel any pending throttle timer so it can't fire after we clear the ref
          if (throttleTimerRef.current) {
            clearTimeout(throttleTimerRef.current)
            throttleTimerRef.current = null
          }
          // Capture final content and id BEFORE clearing refs
          const finalContent = pendingContentRef.current
          const id = streamingIdRef.current
          // Single state update: set full content + mark streaming done
          if (id) {
            setMessages(makeStreamingDoneUpdater(id, finalContent))
          }
          setIsSending(false)
          setStreamingMessageId(null)
          streamingIdRef.current = null
          pendingContentRef.current = ''
        },
        onError: (err: string) => {
          void (async () => {
            // On error, fall back to blocking /send
            const id = streamingIdRef.current
            if (id) {
              setMessages(makeRemoveStreamingMessage(id))
            }
            streamingIdRef.current = null
            pendingContentRef.current = ''

            // Fallback: blocking send (async/await avoids deeply nested .then() callbacks)
            if (fallbackAbortRef.current) fallbackAbortRef.current.abort()
            fallbackAbortRef.current = new AbortController()
            try {
              const r = await fetch(`${API_BASE}/chat/${encodeURIComponent(sessionKey)}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: trimmed, ...(roomId ? { room_id: roomId } : {}) }),
                signal: fallbackAbortRef.current.signal,
              })
              const data = await r.json()
              if (data.success && data.response) {
                setMessages(makeAppendAssistantMessage(data.response))
              } else {
                setError(data.error || err || 'Failed to get response')
              }
            } catch {
              setError(err || 'Failed to send message')
            } finally {
              setIsSending(false)
              setStreamingMessageId(null)
            }
          })()
        },
      })
    },
    [sessionKey, isSending, roomId, flushPendingContent]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort()
      if (historyAbortRef.current) historyAbortRef.current.abort()
      if (fallbackAbortRef.current) fallbackAbortRef.current.abort()
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current)
    }
  }, [])

  return {
    messages,
    isSending,
    streamingMessageId,
    error,
    sendMessage,
    setMessages,
    hasMore,
    isLoadingHistory,
    loadOlderMessages,
  }
}
