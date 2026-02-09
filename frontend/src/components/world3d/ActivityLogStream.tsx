import { useEffect, useRef, useState, useCallback } from 'react'
import { API_BASE } from '@/lib/api'
import { sseManager } from '@/lib/sseManager'

interface ActivityLogStreamProps {
  sessionKey: string
  onOpenFullLog?: () => void
}

interface ActivityEntry {
  id: string
  timestamp: number
  text: string
  type: 'message' | 'tool_call' | 'tool_result' | 'thinking'
  icon: string
  color: string
}

// ── Humanize tool calls ──────────────────────────────────────

function humanizeToolCall(name: string, args?: Record<string, unknown>): { text: string; icon: string; color: string } {
  const argStr = (key: string) => {
    const val = args?.[key]
    if (typeof val === 'string') return val
    return ''
  }

  switch (name) {
    case 'exec': {
      const cmd = argStr('command')
      if (cmd) return { text: `Running: ${cmd.slice(0, 80)}${cmd.length > 80 ? '…' : ''}`, icon: '🔧', color: '#6b7280' }
      return { text: 'Executing command', icon: '🔧', color: '#6b7280' }
    }
    case 'Read':
    case 'read': {
      const path = argStr('path') || argStr('file_path')
      const file = path ? path.split('/').pop() : ''
      return { text: file ? `Reading ${file}` : 'Reading file', icon: '📖', color: '#3b82f6' }
    }
    case 'Write':
    case 'write': {
      const path = argStr('path') || argStr('file_path')
      const file = path ? path.split('/').pop() : ''
      return { text: file ? `Writing ${file}` : 'Writing file', icon: '✍️', color: '#22c55e' }
    }
    case 'Edit':
    case 'edit': {
      const path = argStr('path') || argStr('file_path')
      const file = path ? path.split('/').pop() : ''
      return { text: file ? `Editing ${file}` : 'Editing file', icon: '✏️', color: '#22c55e' }
    }
    case 'sessions_spawn': {
      const task = argStr('task') || argStr('label') || 'sub-task'
      return { text: `Spawning sub-agent: ${task.slice(0, 60)}`, icon: '🤖', color: '#a855f7' }
    }
    case 'web_search': {
      const query = argStr('query')
      return { text: query ? `Searching: ${query.slice(0, 60)}` : 'Searching the web', icon: '🔍', color: '#f59e0b' }
    }
    case 'web_fetch': {
      const url = argStr('url')
      return { text: url ? `Fetching: ${url.slice(0, 60)}` : 'Fetching webpage', icon: '🌐', color: '#f59e0b' }
    }
    case 'message': {
      const action = argStr('action')
      return { text: action ? `Message: ${action}` : 'Sending message', icon: '💬', color: '#06b6d4' }
    }
    case 'browser': {
      const action = argStr('action')
      return { text: action ? `Browser: ${action}` : 'Using browser', icon: '🌐', color: '#8b5cf6' }
    }
    case 'process': {
      return { text: 'Managing process', icon: '⚙️', color: '#6b7280' }
    }
    default:
      return { text: `Using ${name}`, icon: '🔧', color: '#6b7280' }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMessagesToEntries(messages: any[]): ActivityEntry[] {
  const entries: ActivityEntry[] = []

  for (const raw of messages) {
    // OpenClaw wraps messages: { type, id, timestamp, message: { role, content, ... } }
    const inner = raw.message || raw
    const role = inner.role || raw.role
    const content = inner.content || raw.content
    const ts = inner.timestamp || (raw.timestamp ? new Date(raw.timestamp).getTime() : 0)

    if (!content || !Array.isArray(content)) continue

    if (role === 'assistant') {
      for (const block of content) {
        // OpenClaw uses "toolCall", Anthropic uses "tool_use"
        if ((block.type === 'toolCall' || block.type === 'tool_use') && block.name) {
          const args = block.arguments || block.input
          const { text, icon, color } = humanizeToolCall(block.name, args)
          entries.push({
            id: block.id || `tool-${ts}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: ts,
            text,
            type: 'tool_call',
            icon,
            color,
          })
        } else if (block.type === 'text' && block.text) {
          const preview = block.text.slice(0, 150).replace(/\n/g, ' ')
          if (preview.trim()) {
            entries.push({
              id: `msg-${ts}-${Math.random().toString(36).slice(2, 6)}`,
              timestamp: ts,
              text: preview + (block.text.length > 150 ? '…' : ''),
              type: 'message',
              icon: '💭',
              color: '#374151',
            })
          }
        } else if (block.type === 'thinking' && block.thinking) {
          const preview = block.thinking.slice(0, 100).replace(/\n/g, ' ')
          if (preview.trim()) {
            entries.push({
              id: `think-${ts}-${Math.random().toString(36).slice(2, 6)}`,
              timestamp: ts,
              text: preview + (block.thinking.length > 100 ? '…' : ''),
              type: 'thinking',
              icon: '🧠',
              color: '#9ca3af',
            })
          }
        }
      }
    } else if (role === 'toolResult') {
      // Show tool results as brief entries
      const toolName = inner.toolName || ''
      const isError = inner.isError
      if (toolName) {
        entries.push({
          id: `result-${ts}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: ts,
          text: isError ? `❌ ${toolName} failed` : `✓ ${toolName} done`,
          type: 'tool_result',
          icon: isError ? '❌' : '✅',
          color: isError ? '#ef4444' : '#6b7280',
        })
      }
    }
  }

  return entries.slice(-20)
}

function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// ── Component ──────────────────────────────────────────────────

export function ActivityLogStream({ sessionKey, onOpenFullLog }: ActivityLogStreamProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const lastFetchTimeRef = useRef<number>(0)
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchHistory = useCallback(async () => {
    const now = Date.now()
    // Debounce: max 1 fetch per 5 seconds
    if (now - lastFetchTimeRef.current < 5000) {
      return
    }
    lastFetchTimeRef.current = now

    try {
      const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionKey)}/history?limit=50`)
      if (!res.ok) return
      const data = await res.json()
      const parsed = parseMessagesToEntries(data.messages || [])
      setEntries(parsed)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [sessionKey])

  // Debounced fetch wrapper for SSE events
  const debouncedFetch = useCallback(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
    }
    fetchTimeoutRef.current = setTimeout(() => {
      fetchHistory()
    }, 500) // 500ms debounce on SSE events
  }, [fetchHistory])

  // Initial fetch
  useEffect(() => {
    setLoading(true)
    fetchHistory()
  }, [fetchHistory])

  // Subscribe to SSE for live updates
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        const sessions = data.sessions || []
        const match = sessions.find((s: { key: string }) => s.key === sessionKey)
        if (match) {
          // Debounced refetch when this session was updated
          debouncedFetch()
        }
      } catch {
        // ignore parse errors
      }
    }
    return sseManager.subscribe('sessions-refresh', handler)
  }, [sessionKey, debouncedFetch])

  // Auto-scroll on new entries
  useEffect(() => {
    if (entries.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    prevCountRef.current = entries.length
  }, [entries])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 13 }}>
        Loading activity…
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
        <span style={{ fontSize: 32 }}>💤</span>
        <span style={{ color: '#9ca3af', fontSize: 13 }}>No recent activity</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {entries.map((entry, i) => {
          // Show time header if different from previous
          const prevTime = i > 0 ? formatTime(entries[i - 1].timestamp) : ''
          const thisTime = formatTime(entry.timestamp)
          const showTime = thisTime && thisTime !== prevTime

          return (
            <div key={entry.id}>
              {showTime && (
                <div style={{
                  fontSize: 10,
                  color: '#9ca3af',
                  textAlign: 'center',
                  padding: '4px 0 2px',
                  fontWeight: 500,
                }}>
                  {thisTime}
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '6px 4px',
                  animation: i === entries.length - 1 ? 'activityFadeIn 0.3s ease-out' : undefined,
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{entry.icon}</span>
                <div style={{
                  flex: 1,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: entry.color,
                  background: 'rgba(0, 0, 0, 0.03)',
                  padding: '6px 10px',
                  borderRadius: 10,
                  wordBreak: 'break-word',
                }}>
                  {entry.text}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* View Full Log link */}
      {onOpenFullLog && (
        <button
          onClick={onOpenFullLog}
          style={{
            width: '100%',
            padding: '8px',
            fontSize: 12,
            fontWeight: 500,
            color: '#6b7280',
            background: 'none',
            border: 'none',
            borderTop: '1px solid rgba(0, 0, 0, 0.06)',
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#374151' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6b7280' }}
        >
          View Full Log →
        </button>
      )}

      <style>{`
        @keyframes activityFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
