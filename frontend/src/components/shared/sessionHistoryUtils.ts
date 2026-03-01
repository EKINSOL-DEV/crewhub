/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react'
import { api, type SessionMessage } from '@/lib/api'

export interface SessionUsageTotals {
  input: number
  output: number
  total: number
  cost: number
}

function parseClaudeCodeEntry(entry: any): SessionMessage | null {
  const blocks: any[] = []
  const metadata = entry.metadata
  if (metadata?.type === 'tool_use' && metadata.tool_name) {
    blocks.push({
      type: 'tool_use',
      name: metadata.tool_name,
      id: metadata.tool_use_id,
      arguments: metadata.input_data,
    })
  } else if (metadata?.type === 'tool_result') {
    blocks.push({ type: 'tool_result', text: entry.content })
  } else if (typeof entry.content === 'string' && entry.content.trim()) {
    blocks.push({ type: 'text', text: entry.content })
  }
  if (blocks.length === 0) return null
  return {
    role: entry.role,
    content: blocks,
    model: metadata?.model,
    timestamp: entry.timestamp,
  } as SessionMessage
}

function parseOpenClawEntry(entry: any): SessionMessage {
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
}

export function parseSessionHistory(rawEntries: any[]): SessionMessage[] {
  const results: SessionMessage[] = []

  for (const entry of rawEntries) {
    // Standardized format from Claude Code: {role, content: string, timestamp, metadata}
    if (entry.role && !entry.message) {
      const parsed = parseClaudeCodeEntry(entry)
      if (parsed) results.push(parsed)
      continue
    }

    // OpenClaw raw format: {type: 'message', message: {role, content}, timestamp}
    if (entry.type !== 'message' || !entry.message) continue
    results.push(parseOpenClawEntry(entry))
  }

  return results
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
