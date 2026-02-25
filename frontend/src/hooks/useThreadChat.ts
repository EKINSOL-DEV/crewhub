/**
 * Hook for thread (group chat) message management.
 * Subscribes to SSE for real-time streaming of agent responses.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { threadsApi, type ThreadMessage } from '@/lib/threads.api'
import { sseManager } from '@/lib/sseManager'

export function useThreadChat(threadId: string) {
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const initialLoadDone = useRef(false)

  // Subscribe to SSE for real-time thread messages (agent responses stream in as they complete)
  useEffect(() => {
    if (!threadId) return

    const handleThreadMessage = (data: any) => {
      if (data?.threadId !== threadId || !data?.message) return
      const msg = data.message as ThreadMessage
      // Deduplicate: skip if we already have this message id
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    }

    const unsub = sseManager.subscribe('thread.message.created', handleThreadMessage)
    return unsub
  }, [threadId])

  // Load initial messages
  useEffect(() => {
    if (!threadId) return
    initialLoadDone.current = true

    const load = async () => {
      setIsLoadingHistory(true)
      setError(null)
      try {
        const data = await threadsApi.getMessages(threadId, 50)
        setMessages(data.messages)
        setHasMore(data.hasMore)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load messages')
      } finally {
        setIsLoadingHistory(false)
      }
    }
    load()
  }, [threadId])

  const sendMessage = useCallback(
    async (
      content: string,
      routingMode: 'broadcast' | 'targeted' = 'broadcast',
      targetAgentIds?: string[]
    ) => {
      if (!content.trim() || isSending) return

      // Optimistic user message
      const optimisticMsg: ThreadMessage = {
        id: `temp-${Date.now()}`,
        thread_id: threadId,
        role: 'user',
        content: content.trim(),
        agent_id: null,
        agent_name: null,
        routing_mode: routingMode,
        target_agent_ids: targetAgentIds || null,
        created_at: Date.now(),
      }
      setMessages((prev) => [...prev, optimisticMsg])
      setIsSending(true)
      setError(null)

      try {
        const result = await threadsApi.sendMessage(
          threadId,
          content.trim(),
          routingMode,
          targetAgentIds
        )

        // Replace optimistic message with real user message.
        // Agent responses arrive in real-time via SSE (thread.message.created),
        // so we only need to reconcile what the POST returns with what SSE already delivered.
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== optimisticMsg.id)
          const existingIds = new Set(filtered.map((m) => m.id))
          const newMsgs = [result.user_message, ...result.responses].filter(
            (m) => !existingIds.has(m.id)
          )
          return [...filtered, ...newMsgs]
        })
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to send')
        // Remove optimistic message
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
      } finally {
        setIsSending(false)
      }
    },
    [threadId, isSending]
  )

  const loadOlderMessages = useCallback(async () => {
    if (isLoadingHistory || !hasMore || messages.length === 0) return
    const oldest = messages[0]?.created_at
    if (!oldest) return

    setIsLoadingHistory(true)
    try {
      const data = await threadsApi.getMessages(threadId, 50, oldest)
      setMessages((prev) => [...data.messages, ...prev])
      setHasMore(data.hasMore)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load older messages')
    } finally {
      setIsLoadingHistory(false)
    }
  }, [threadId, isLoadingHistory, hasMore, messages])

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
