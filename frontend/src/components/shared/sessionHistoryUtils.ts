import { useEffect, useMemo, useState } from 'react'
import { api, type SessionMessage } from '@/lib/api'

export interface SessionUsageTotals {
  input: number
  output: number
  total: number
  cost: number
}

export function parseSessionHistory(rawEntries: any[]): SessionMessage[] {
  return rawEntries
    .filter((entry: any) => entry.type === 'message' && entry.message)
    .map((entry: any) => {
      const message = entry.message
      let content = message.content
      if (typeof content === 'string') {
        content = [{ type: 'text', text: content }]
      }
      if (!Array.isArray(content)) {
        content = []
      }
      return {
        role: message.role || 'unknown',
        content,
        model: message.model || entry.model,
        usage: message.usage,
        stopReason: message.stopReason,
        timestamp: entry.timestamp ? new Date(entry.timestamp).getTime() : undefined,
      } as SessionMessage
    })
}

export function calculateUsageTotals(messages: SessionMessage[]): SessionUsageTotals {
  let input = 0
  let output = 0
  let total = 0
  let cost = 0

  for (const message of messages) {
    if (!message.usage) continue
    input += message.usage.input || 0
    output += message.usage.output || 0
    total += message.usage.totalTokens || 0
    cost += message.usage.cost?.total || 0
  }

  return { input, output, total, cost }
}

export function useSessionHistory(sessionKey: string | undefined, limit = 200) {
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [loading, setLoading] = useState(Boolean(sessionKey))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionKey) {
      setMessages([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    api
      .getSessionHistory(sessionKey, limit)
      .then((response) => {
        if (cancelled) return
        setMessages(parseSessionHistory(response.messages || []))
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sessionKey, limit])

  const usageTotals = useMemo(() => calculateUsageTotals(messages), [messages])

  return {
    messages,
    loading,
    error,
    usageTotals,
  }
}
