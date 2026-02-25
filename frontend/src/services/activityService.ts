/**
 * Centralized Activity Service
 *
 * Single source of truth for all activity/event data in CrewHub.
 * Used by:
 * - Desktop: ZenActivityPanel, ActivityLogStream
 * - Mobile: Activity Panel, ActiveTasksOverlay
 * - 3D World: ActivityLogStream
 *
 * This service ensures no duplicate fetches and consistent data across the app.
 */

import { API_BASE } from '@/lib/api'
import { sseManager } from '@/lib/sseManager'

// ── Types ─────────────────────────────────────────────────────

export interface ActivityEvent {
  id: string
  type:
    | 'created'
    | 'updated'
    | 'removed'
    | 'status'
    | 'message'
    | 'tool_call'
    | 'tool_result'
    | 'thinking'
  timestamp: number
  sessionKey: string
  sessionName?: string
  description: string
  icon: string
  color?: string
  details?: string
}

export interface LogEntry {
  role: string
  content: string
  timestamp?: number
  tools?: { name: string; status?: string }[]
}

export interface SessionHistory {
  sessionKey: string
  messages: LogEntry[]
  lastFetch: number
}

// ── Cache ─────────────────────────────────────────────────────

const historyCache = new Map<string, SessionHistory>()
const CACHE_TTL = 5000 // 5 seconds

// ── Helper: Humanize Tool Calls ───────────────────────────────

function humanizeToolCall(
  name: string,
  args?: Record<string, unknown>
): { text: string; icon: string; color: string } {
  const argStr = (key: string) => {
    const val = args?.[key]
    if (typeof val === 'string') return val
    return ''
  }

  switch (name) {
    case 'exec': {
      const cmd = argStr('command')
      if (cmd)
        return {
          text: `Running: ${cmd.slice(0, 80)}${cmd.length > 80 ? '…' : ''}`,
          icon: '🔧',
          color: '#6b7280',
        }
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
      return {
        text: query ? `Searching: ${query.slice(0, 60)}` : 'Searching the web',
        icon: '🔍',
        color: '#f59e0b',
      }
    }
    case 'web_fetch': {
      const url = argStr('url')
      return {
        text: url ? `Fetching: ${url.slice(0, 60)}` : 'Fetching webpage',
        icon: '🌐',
        color: '#f59e0b',
      }
    }
    case 'message': {
      const action = argStr('action')
      return {
        text: action ? `Message: ${action}` : 'Sending message',
        icon: '💬',
        color: '#06b6d4',
      }
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

// ── Parse Messages to Log Entries ─────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMessagesToLogEntries(messages: any[]): LogEntry[] {
  return messages
    .filter((m: any) => m?.message?.role && m.message.role !== 'thinking')
    .map((m: any) => {
      const msg = m.message
      // Extract text content from content array or string
      let content = ''
      if (typeof msg.content === 'string') {
        content = msg.content
      } else if (Array.isArray(msg.content)) {
        content = msg.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text || '')
          .join('\n')
      }
      // Extract tool calls
      const tools: { name: string; status?: string }[] = []
      if (Array.isArray(msg.content)) {
        for (const c of msg.content) {
          if (c.type === 'toolCall' || c.type === 'tool_use') {
            tools.push({ name: c.name || c.toolName || 'tool' })
          }
        }
      }
      // For toolResult role, use toolName
      if (msg.role === 'toolResult' && msg.toolName) {
        return {
          role: 'tool',
          content: content || `[${msg.toolName} result]`,
          timestamp: m.timestamp ? new Date(m.timestamp).getTime() : undefined,
          tools: [],
        }
      }
      let role: string
      if (msg.role === 'assistant') {
        role = 'assistant'
      } else if (msg.role === 'user') {
        role = 'user'
      } else {
        role = 'system'
      }
      return {
        role,
        content: content || (tools.length > 0 ? '' : '[no content]'),
        timestamp: m.timestamp ? new Date(m.timestamp).getTime() : undefined,
        tools,
      }
    })
    .filter((e: LogEntry) => e.content || (e.tools && e.tools.length > 0))
}

// ── Parse Messages to Activity Entries ────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMessagesToActivityEntries(messages: any[]): ActivityEvent[] {
  const entries: ActivityEvent[] = []

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
            sessionKey: '', // Will be set by caller
            description: text,
            type: 'tool_call',
            icon,
            color,
          })
        } else if (block.type === 'text' && block.text) {
          const preview = block.text.slice(0, 150).replaceAll(/\n/g, ' ')
          if (preview.trim()) {
            entries.push({
              id: `msg-${ts}-${Math.random().toString(36).slice(2, 6)}`,
              timestamp: ts,
              sessionKey: '',
              description: preview + (block.text.length > 150 ? '…' : ''),
              type: 'message',
              icon: '💭',
              color: '#374151',
            })
          }
        } else if (block.type === 'thinking' && block.thinking) {
          const preview = block.thinking.slice(0, 100).replaceAll(/\n/g, ' ')
          if (preview.trim()) {
            entries.push({
              id: `think-${ts}-${Math.random().toString(36).slice(2, 6)}`,
              timestamp: ts,
              sessionKey: '',
              description: preview + (block.thinking.length > 100 ? '…' : ''),
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
          sessionKey: '',
          description: isError ? `❌ ${toolName} failed` : `✓ ${toolName} done`,
          type: 'tool_result',
          icon: isError ? '❌' : '✅',
          color: isError ? '#ef4444' : '#6b7280',
        })
      }
    }
  }

  return entries.slice(-20)
}

// ── API: Fetch Session History ───────────────────────────────

export async function fetchSessionHistory(
  sessionKey: string,
  options: { limit?: number; skipCache?: boolean } = {}
): Promise<SessionHistory> {
  const { limit = 100, skipCache = false } = options

  // Check cache first
  if (!skipCache) {
    const cached = historyCache.get(sessionKey)
    if (cached && Date.now() - cached.lastFetch < CACHE_TTL) {
      return cached
    }
  }

  try {
    const res = await fetch(
      `${API_BASE}/sessions/${encodeURIComponent(sessionKey)}/history?limit=${limit}`
    )
    if (!res.ok) {
      throw new Error(`Failed to fetch history: ${res.status}`)
    }
    const data = await res.json()
    const messages = parseMessagesToLogEntries(data.messages || [])

    const result: SessionHistory = {
      sessionKey,
      messages,
      lastFetch: Date.now(),
    }

    historyCache.set(sessionKey, result)
    return result
  } catch (error) {
    console.error(`[activityService] Failed to fetch history for ${sessionKey}:`, error)
    throw error
  }
}

// ── API: Fetch Activity Entries ──────────────────────────────

export async function fetchActivityEntries(
  sessionKey: string,
  options: { limit?: number; skipCache?: boolean } = {}
): Promise<ActivityEvent[]> {
  const { limit = 50 } = options

  try {
    const res = await fetch(
      `${API_BASE}/sessions/${encodeURIComponent(sessionKey)}/history?limit=${limit}`
    )
    if (!res.ok) {
      throw new Error(`Failed to fetch activity: ${res.status}`)
    }
    const data = await res.json()
    const entries = parseMessagesToActivityEntries(data.messages || [])

    // Set sessionKey for all entries
    entries.forEach((e) => {
      e.sessionKey = sessionKey
    })

    return entries
  } catch (error) {
    console.error(`[activityService] Failed to fetch activity for ${sessionKey}:`, error)
    return []
  }
}

// ── SSE: Subscribe to Activity Updates ───────────────────────

export function subscribeToActivityUpdates(sessionKey: string, callback: () => void): () => void {
  const handler = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      const sessions = data.sessions || []
      const match = sessions.find((s: { key: string }) => s.key === sessionKey)
      if (match) {
        // Invalidate cache and notify
        historyCache.delete(sessionKey)
        callback()
      }
    } catch {
      // ignore parse errors
    }
  }

  return sseManager.subscribe('sessions-refresh', handler)
}

// ── Clear Cache ───────────────────────────────────────────────

export function clearActivityCache(sessionKey?: string) {
  if (sessionKey) {
    historyCache.delete(sessionKey)
  } else {
    historyCache.clear()
  }
}
